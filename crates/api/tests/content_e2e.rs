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

#[sqlx::test(migrations = "../../migrations")]
async fn post_from_the_phone_read_it_back(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (author_id, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    // Compose and sign the post "on the phone".
    let prepared = rig
        .gql(
            Some(&token),
            PREPARE_POST,
            json!({ "input": {
                "title": "Hello graph",
                "content": "The very first post.",
                "license": { "attribution": 1.0, "oversight": 0.0 },
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

    // Read it back — anonymously: the listing, the typed node, and the
    // interface lookup all serve without a session.
    let listing = rig
        .gql(
            None,
            r#"{ posts(first: 10) { edges { cursor node {
                 id title { value status } content { value }
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
    assert_eq!(listing["posts"]["pageInfo"]["hasNextPage"], false);

    let node = rig
        .gql(
            None,
            r#"query($id: UUID!) { node(id: $id) { __typename id } }"#,
            json!({ "id": post_id }),
        )
        .await;
    assert_eq!(node["node"]["__typename"], "Post");

    // A second member comments; the thread read serves it under the post.
    let (_, commenter_key) = rig.seed_member("commenter", "commenter@example.com").await;
    let commenter_token = rig.log_in("commenter@example.com").await;
    let prepared = rig
        .gql(
            Some(&commenter_token),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": post_id,
                "content": "Great start!",
                "license": { "attribution": 0.0, "oversight": 0.0 },
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

    // The chronicle: the post's records — its genesis Publish and the
    // comment's Review — read generically, filtered by target.
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

    // One record by its identifier round-trips through the RecordId
    // scalar.
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
                "license": { "attribution": 0.0, "oversight": 0.0 },
            }}),
        )
        .await;
    assert_eq!(
        response["errors"][0]["extensions"]["code"], "UNAUTHENTICATED",
        "an unauthenticated prepare is a transport fault, not a userError: {response}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_refused_prepare_reports_user_errors(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, _key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    // Commenting on an unknown target refuses with BAD_INPUT at the
    // field, not a transport fault.
    let prepared = rig
        .gql(
            Some(&token),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": Uuid::new_v4(),
                "content": "into the void",
                "license": { "attribution": 0.0, "oversight": 0.0 },
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

    // An out-of-range stance refuses at the scalar boundary.
    let response = rig
        .gql_raw(
            Some(&token),
            PREPARE_POST,
            json!({ "input": {
                "content": "x",
                "license": { "attribution": 0.0, "oversight": 0.0 },
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
