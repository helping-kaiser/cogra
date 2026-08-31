//! The slice-2 hand test, automated end to end through the real HTTP
//! surface (roadmap "Slice 2": post from the phone, read it back):
//! every GraphQL call through the router with real bearer tokens,
//! every signature by the device-side `ActorKey`, and the reads —
//! listing, node, thread, chronicle — anonymous, because the shared
//! graph needs no account to read.

use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::client::ActorKey;
use common::l1::wire;
use http_body_util::BodyExt;
use l1_standin::StandIn;
use postgres_store::PgPool;
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

mod rig;
use rig::TestMailer;

struct Rig {
    app: axum::Router,
    pool: PgPool,
    standin: StandIn,
}

impl Rig {
    async fn new(pool: PgPool) -> Self {
        let mailer = Arc::new(TestMailer::default());
        let (app, standin) = rig::connect_info_app_with_standin(
            pool.clone(),
            mailer,
            api::ratelimit::RateLimitConfig::unlimited(),
        );
        Self { app, pool, standin }
    }

    async fn gql_raw(&self, token: Option<&str>, query: &str, variables: Value) -> Value {
        let mut builder = Request::builder()
            .method("POST")
            .uri("/graphql")
            .header("content-type", "application/json");
        if let Some(token) = token {
            builder = builder.header("authorization", format!("Bearer {token}"));
        }
        let body = json!({ "query": query, "variables": variables }).to_string();
        let response = self
            .app
            .clone()
            .oneshot(builder.body(Body::from(body)).expect("request"))
            .await
            .expect("response");
        let bytes = response
            .into_body()
            .collect()
            .await
            .expect("body")
            .to_bytes();
        serde_json::from_slice(&bytes).unwrap_or_else(|e| {
            panic!(
                "non-JSON response ({e}): {}",
                String::from_utf8_lossy(&bytes)
            )
        })
    }

    async fn gql(&self, token: Option<&str>, query: &str, variables: Value) -> Value {
        let json = self.gql_raw(token, query, variables).await;
        assert!(
            json.get("errors").is_none(),
            "unexpected transport errors: {json}"
        );
        json["data"].clone()
    }

    async fn seed_member(&self, handle: &str, email: &str) -> (Uuid, ActorKey) {
        let key = ActorKey::generate();
        let id = Uuid::new_v4();
        let mut conn = self.pool.acquire().await.expect("conn");
        postgres_store::genesis::insert_actor(
            &mut conn,
            id,
            "user",
            handle,
            &key.public_key_bytes(),
            &key.address(),
        )
        .await
        .expect("actor");
        drop(conn);
        postgres_store::genesis::insert_credentials(
            &self.pool,
            id,
            email,
            &api::auth::hash_password("a strong password").expect("hash"),
        )
        .await
        .expect("credentials");
        self.standin
            .credit_burn(&key.address(), 10_000_000)
            .await
            .expect("burn");
        (id, key)
    }

    async fn log_in(&self, email: &str) -> String {
        let login = self
            .gql(
                None,
                r#"mutation($input: LogInInput!) {
                     logIn(input: $input) { auth { accessToken } userErrors { code } }
                   }"#,
                json!({ "input": { "email": email, "password": "a strong password" }}),
            )
            .await;
        login["logIn"]["auth"]["accessToken"]
            .as_str()
            .expect("session")
            .to_string()
    }

    async fn close_and_ingest(&self) {
        self.standin.close_epoch().await.expect("closes");
        let outcome = api::ingest::ingest_pending(
            &api::l1::StandInBoundary(self.standin.clone()),
            &self.pool,
            8,
        )
        .await
        .expect("ingests");
        assert!(
            outcome.promotion_failures.is_empty(),
            "confirm-side promotion failed: {:?}",
            outcome.promotion_failures
        );
    }

    /// The device's two signing steps over a `PrepareContentPayload`'s
    /// writes, through the session-authorized relay mutations.
    async fn sign_prepared(&self, token: &str, key: &ActorKey, writes: &Value) {
        let host_key = self.standin.host_public_key().await.expect("host key");
        for write in writes.as_array().expect("writes") {
            let id = write["id"].as_str().expect("id");
            let proposal = wire::decode_proposal(
                &B64.decode(write["canonicalProposal"].as_str().expect("proposal"))
                    .expect("b64"),
            )
            .expect("decodes");
            let pre = key.pre_sign(proposal);
            let sealed = self
                .gql(
                    Some(token),
                    "mutation($input: SubmitProposalsInput!) {
                       submitProposals(input: $input) {
                         stagedWrites { id verifiedAct } userErrors { code message }
                       }
                     }",
                    json!({ "input": { "proposals": [{
                        "stagedWriteId": id,
                        "signature": B64.encode(wire::encode_pre_commitment_of(&pre)),
                    }]}}),
                )
                .await;
            let staged = &sealed["submitProposals"]["stagedWrites"][0];
            let act = wire::decode_verified_act(
                &B64.decode(staged["verifiedAct"].as_str().expect("sealed"))
                    .expect("b64"),
            )
            .expect("decodes");
            let witness = key.approve(&pre, &act, &host_key).expect("approves");
            self.gql(
                Some(token),
                "mutation($input: ApproveActsInput!) {
                   approveActs(input: $input) {
                     stagedWrites { state } userErrors { code message }
                   }
                 }",
                json!({ "input": { "approvals": [{
                    "stagedWriteId": id,
                    "signature": B64.encode(witness.approval_signature),
                }]}}),
            )
            .await;
        }
    }
}

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) {
    node
    writes { id canonicalProposal }
    userErrors { code message field }
  }
}"#;

const PREPARE_COMMENT: &str = r#"mutation($input: PrepareCommentInput!) {
  prepareComment(input: $input) {
    node
    writes { id canonicalProposal }
    userErrors { code message field }
  }
}"#;

const PREPARE_POST_EDIT: &str = r#"mutation($input: PreparePostEditInput!) {
  preparePostEdit(input: $input) {
    node
    writes { id canonicalProposal }
    userErrors { code message field }
  }
}"#;

/// Everything a client needs to draw the veil: the title's status outside
/// it, the body's three statuses inside it, the node-level cache, and the
/// author's reason.
const READ_VEIL: &str = r#"query($id: UUID!) { post(id: $id) {
  title { value status }
  description { value status }
  content { value status }
  attachmentsStatus
  moderationStatus
  sensitiveReason
} }"#;

/// The whole slice-2 round trip: a post composed and signed "on the
/// phone", then read back anonymously through every read shape — the
/// listing, the typed node, and the interface lookup — because the shared
/// graph needs no session. A second member's comment then serves under
/// the post in the thread read; the chronicle serves the same records
/// generically, filtered by target; and one record round-trips by
/// identifier through the `RecordId` scalar.
#[sqlx::test(migrations = "../../migrations")]
async fn post_from_the_phone_read_it_back(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (author_id, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let prepared = rig
        .gql(
            Some(&token),
            PREPARE_POST,
            json!({ "input": {
                "title": "Hello graph",
                "content": "The very first post.",
                "license": { "attribution": 1.0, "provenance": 0.0 },
            }}),
        )
        .await;
    assert_eq!(
        prepared["preparePost"]["userErrors"]
            .as_array()
            .expect("array"),
        &Vec::<Value>::new()
    );
    let post_id = prepared["preparePost"]["node"].as_str().expect("node id");
    rig.sign_prepared(&token, &key, &prepared["preparePost"]["writes"])
        .await;
    rig.close_and_ingest().await;

    let listing = rig
        .gql(
            None,
            r#"{ posts(first: 10) { edges { cursor node {
                 id title { value status } content { value }
                 attachments { id altText } attachmentsStatus
                 author { id handle } moderationStatus createdAt updatedAt
               } } pageInfo { hasNextPage hasPreviousPage } } }"#,
            json!({}),
        )
        .await;
    let edges = listing["posts"]["edges"].as_array().expect("edges");
    assert_eq!(edges.len(), 1);
    let post = &edges[0]["node"];
    assert_eq!(post["id"], post_id);
    assert_eq!(post["title"]["value"], "Hello graph");
    assert_eq!(post["title"]["status"], "NORMAL");
    assert_eq!(post["content"]["value"], "The very first post.");
    assert_eq!(post["author"]["handle"], "author");
    assert_eq!(post["author"]["id"], author_id.to_string());
    assert_eq!(post["moderationStatus"], "NORMAL");
    assert_eq!(
        post["attachments"].as_array().expect("gallery list").len(),
        0
    );
    assert_eq!(post["attachmentsStatus"], "NORMAL");
    assert_eq!(listing["posts"]["pageInfo"]["hasNextPage"], false);

    let node = rig
        .gql(
            None,
            r#"query($id: UUID!) { node(id: $id) { __typename id } }"#,
            json!({ "id": post_id }),
        )
        .await;
    assert_eq!(node["node"]["__typename"], "Post");

    let (_, commenter_key) = rig.seed_member("commenter", "commenter@example.com").await;
    let commenter_token = rig.log_in("commenter@example.com").await;
    let prepared = rig
        .gql(
            Some(&commenter_token),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": post_id,
                "content": "Great start!",
                "license": { "attribution": 0.0, "provenance": 0.0 },
                "pInterest": 0.5,
            }}),
        )
        .await;
    assert_eq!(
        prepared["prepareComment"]["userErrors"]
            .as_array()
            .expect("array"),
        &Vec::<Value>::new()
    );
    let comment_id = prepared["prepareComment"]["node"]
        .as_str()
        .expect("comment id");
    rig.sign_prepared(
        &commenter_token,
        &commenter_key,
        &prepared["prepareComment"]["writes"],
    )
    .await;
    rig.close_and_ingest().await;

    let thread = rig
        .gql(
            None,
            r#"query($id: UUID!) { post(id: $id) {
                 comments(first: 10) { edges { node {
                   id content { value } author { handle }
                   attachments { id }
                   target { __typename ... on Post { id } }
                 } } }
               } }"#,
            json!({ "id": post_id }),
        )
        .await;
    let comments = thread["post"]["comments"]["edges"]
        .as_array()
        .expect("edges");
    assert_eq!(comments.len(), 1);
    assert_eq!(comments[0]["node"]["id"], comment_id);
    assert_eq!(comments[0]["node"]["content"]["value"], "Great start!");
    assert_eq!(comments[0]["node"]["author"]["handle"], "commenter");
    assert_eq!(comments[0]["node"]["target"]["__typename"], "Post");
    assert_eq!(comments[0]["node"]["target"]["id"], post_id);

    let records = rig
        .gql(
            None,
            r#"query($target: UUID!) { records(target: $target, first: 10) {
                 edges { node {
                   id family author { handle } targetId terminalId
                   pDirected pInterest landingEpoch payloadMarked
                   payloadState payloadWitness
                   terminal { __typename ... on Comment { id } }
                 } }
               } }"#,
            json!({ "target": post_id }),
        )
        .await;
    let record_edges = records["records"]["edges"].as_array().expect("edges");
    assert_eq!(record_edges.len(), 2, "genesis Publish + the Review");
    let review = record_edges
        .iter()
        .map(|e| &e["node"])
        .find(|n| n["family"] == "REVIEW")
        .expect("review record");
    assert_eq!(review["author"]["handle"], "commenter");
    assert_eq!(review["payloadState"], "FULL");
    assert_eq!(review["terminal"]["__typename"], "Comment");
    assert_eq!(review["terminal"]["id"], comment_id);
    let publish = record_edges
        .iter()
        .map(|e| &e["node"])
        .find(|n| n["family"] == "PUBLISH")
        .expect("publish record");
    assert_eq!(publish["pInterest"], 1.0);
    assert!(publish["payloadMarked"].as_bool().expect("marked"));

    let record_id = publish["id"].as_str().expect("record id");
    let single = rig
        .gql(
            None,
            r#"query($id: RecordId!) { record(id: $id) { id family } }"#,
            json!({ "id": record_id }),
        )
        .await;
    assert_eq!(single["record"]["id"], record_id);
    assert_eq!(single["record"]["family"], "PUBLISH");
}

#[sqlx::test(migrations = "../../migrations")]
async fn content_writes_need_a_member_session(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let response = rig
        .gql_raw(
            None,
            PREPARE_POST,
            json!({ "input": {
                "content": "anonymous?",
                "license": { "attribution": 0.0, "provenance": 0.0 },
            }}),
        )
        .await;
    assert_eq!(
        response["errors"][0]["extensions"]["code"], "UNAUTHENTICATED",
        "an unauthenticated prepare is a transport fault, not a userError: {response}"
    );
}

/// The author's own sensitive mark, end to end: it rides the payload the
/// device signs, and it reads back through the status fields both clients
/// already veil on — no new read plumbing, which is the point.
///
/// The body veils as one region (media, words and description together)
/// and the title stays readable, so choosing to look is informed
/// (design/readme.md §13, moderation.md §1).
#[sqlx::test(migrations = "../../migrations")]
async fn a_self_marked_post_veils_its_body_and_keeps_its_title(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let prepared = rig
        .gql(
            Some(&token),
            PREPARE_POST,
            json!({ "input": {
                "title": "A hard thing",
                "description": "Beside the words",
                "content": "The body nobody sees unmarked.",
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "sensitive": true,
                "sensitiveReason": "Depicts an injury",
            }}),
        )
        .await;
    let post_id = prepared["preparePost"]["node"].as_str().expect("node id");
    rig.sign_prepared(&token, &key, &prepared["preparePost"]["writes"])
        .await;
    rig.close_and_ingest().await;

    let veiled = rig.gql(None, READ_VEIL, json!({ "id": post_id })).await;
    let post = &veiled["post"];
    assert_eq!(post["title"]["status"], "NORMAL", "the title stays outside");
    assert_eq!(post["title"]["value"], "A hard thing");
    assert_eq!(post["description"]["status"], "SENSITIVE");
    assert_eq!(post["content"]["status"], "SENSITIVE");
    assert_eq!(post["attachmentsStatus"], "SENSITIVE");
    assert_eq!(post["moderationStatus"], "SENSITIVE");
    assert_eq!(post["sensitiveReason"], "Depicts an injury");
    assert_eq!(
        post["content"]["value"], "The body nobody sees unmarked.",
        "SENSITIVE is a filter, not a removal — the value still travels"
    );

    let edit = rig
        .gql(
            Some(&token),
            PREPARE_POST_EDIT,
            json!({ "input": {
                "id": post_id,
                "title": "A hard thing",
                "description": "Beside the words",
                "content": "Softened.",
            }}),
        )
        .await;
    rig.sign_prepared(&token, &key, &edit["preparePostEdit"]["writes"])
        .await;
    rig.close_and_ingest().await;

    let unmarked = rig.gql(None, READ_VEIL, json!({ "id": post_id })).await;
    let post = &unmarked["post"];
    assert_eq!(
        post["content"]["status"], "NORMAL",
        "an edit carries the complete content state, so omitting the mark unmarks"
    );
    assert_eq!(post["description"]["status"], "NORMAL");
    assert_eq!(post["attachmentsStatus"], "NORMAL");
    assert_eq!(post["moderationStatus"], "NORMAL");
    assert!(post["sensitiveReason"].is_null());

    let remarked = rig
        .gql(
            Some(&token),
            PREPARE_POST_EDIT,
            json!({ "input": {
                "id": post_id,
                "title": "A hard thing",
                "content": "Marked again.",
                "sensitive": true,
            }}),
        )
        .await;
    rig.sign_prepared(&token, &key, &remarked["preparePostEdit"]["writes"])
        .await;
    rig.close_and_ingest().await;

    let post = &rig.gql(None, READ_VEIL, json!({ "id": post_id })).await["post"];
    assert_eq!(post["content"]["status"], "SENSITIVE");
    assert!(
        post["sensitiveReason"].is_null(),
        "a mark without a reason reads back as a mark without a reason"
    );
}

/// A reason without the switch is refused rather than dropped: the author
/// wrote a warning no reader would ever be shown.
#[sqlx::test(migrations = "../../migrations")]
async fn a_sensitive_reason_without_the_mark_is_refused(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, _key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let prepared = rig
        .gql(
            Some(&token),
            PREPARE_POST,
            json!({ "input": {
                "content": "unmarked",
                "license": { "attribution": 0.0, "provenance": 0.0 },
                "sensitiveReason": "why",
            }}),
        )
        .await;
    let errors = prepared["preparePost"]["userErrors"]
        .as_array()
        .expect("userErrors");
    assert_eq!(errors.len(), 1);
    assert_eq!(errors[0]["code"], "BAD_INPUT");
    assert_eq!(errors[0]["field"][0], "sensitiveReason");
    assert!(prepared["preparePost"]["writes"].is_null());
}

/// A comment seals through the same seal a post does, so it carries the
/// same switch and veils the same way.
#[sqlx::test(migrations = "../../migrations")]
async fn a_self_marked_comment_veils_its_body(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, author_key) = rig.seed_member("author", "author@example.com").await;
    let author_token = rig.log_in("author@example.com").await;
    let (_, bob_key) = rig.seed_member("bob", "bob@example.com").await;
    let bob_token = rig.log_in("bob@example.com").await;

    let prepared = rig
        .gql(
            Some(&author_token),
            PREPARE_POST,
            json!({ "input": {
                "title": "Host",
                "content": "The thread starts here.",
                "license": { "attribution": 0.0, "provenance": 0.0 },
            }}),
        )
        .await;
    let post_id = prepared["preparePost"]["node"].as_str().expect("node id");
    rig.sign_prepared(&author_token, &author_key, &prepared["preparePost"]["writes"])
        .await;
    rig.close_and_ingest().await;

    let commented = rig
        .gql(
            Some(&bob_token),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": post_id,
                "content": "Hard to look at.",
                "license": { "attribution": 0.0, "provenance": 0.0 },
                "sensitive": true,
                "sensitiveReason": "Describes the injury",
            }}),
        )
        .await;
    let comment_id = commented["prepareComment"]["node"]
        .as_str()
        .expect("node id");
    rig.sign_prepared(&bob_token, &bob_key, &commented["prepareComment"]["writes"])
        .await;
    rig.close_and_ingest().await;

    let read = rig
        .gql(
            None,
            r#"query($id: UUID!) { comment(id: $id) {
                 content { value status } attachmentsStatus
                 moderationStatus sensitiveReason } }"#,
            json!({ "id": comment_id }),
        )
        .await;
    let comment = &read["comment"];
    assert_eq!(comment["content"]["status"], "SENSITIVE");
    assert_eq!(comment["attachmentsStatus"], "SENSITIVE");
    assert_eq!(comment["moderationStatus"], "SENSITIVE");
    assert_eq!(comment["sensitiveReason"], "Describes the injury");
}

/// The two refusal tiers stay apart: commenting on an unknown target is a
/// BAD_INPUT userError pinned to the field, while an out-of-range stance
/// never reaches the resolver at all — it refuses at the scalar boundary
/// as a transport fault.
#[sqlx::test(migrations = "../../migrations")]
async fn a_refused_prepare_reports_user_errors(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, _key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let prepared = rig
        .gql(
            Some(&token),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": Uuid::new_v4(),
                "content": "into the void",
                "license": { "attribution": 0.0, "provenance": 0.0 },
            }}),
        )
        .await;
    let errors = prepared["prepareComment"]["userErrors"]
        .as_array()
        .expect("userErrors");
    assert_eq!(errors.len(), 1);
    assert_eq!(errors[0]["code"], "BAD_INPUT");
    assert_eq!(errors[0]["field"][0], "target");
    assert!(prepared["prepareComment"]["writes"].is_null());
    assert!(prepared["prepareComment"]["node"].is_null());

    let response = rig
        .gql_raw(
            Some(&token),
            PREPARE_POST,
            json!({ "input": {
                "content": "x",
                "license": { "attribution": 0.0, "provenance": 0.0 },
                "pDirected": 1.5,
            }}),
        )
        .await;
    assert!(
        response["errors"][0]["message"]
            .as_str()
            .expect("message")
            .contains("Dimension"),
        "expected a Dimension validation refusal: {response}"
    );
}
