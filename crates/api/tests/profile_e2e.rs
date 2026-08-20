//! Slice 2.1 — the profile surface through the real HTTP router
//! (roadmap "Slice 2.1": edit your bio from your own profile): the
//! `user` / `actor` lookups by id and handle with their argument rule,
//! the grown profile fields, and a bio edit signed by the device key
//! end to end, read back anonymously.

use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::census::Family;
use common::l1::client::ActorKey;
use common::l1::identifier::NodeId;
use common::l1::wire;
use http_body_util::BodyExt;
use l1_standin::StandIn;
use postgres_store::PgPool;
use postgres_store::staged::{self, PreSignedParts};
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

mod rig;
use rig::TestMailer;

const GC: i64 = 8;

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

    fn boundary(&self) -> api::l1::StandInBoundary {
        api::l1::StandInBoundary(self.standin.clone())
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

    /// A member with a landed anchoring Registration — the shape every
    /// profile update chains from.
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
        postgres_store::genesis::insert_profile_version(&mut conn, id, handle, None)
            .await
            .expect("seed profile");
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
        let anchor = api::prepare::prepare(
            &self.boundary(),
            &self.pool,
            GC,
            id,
            api::prepare::Gesture {
                author: key.address(),
                family: Family::Registration,
                middle: None,
                target: api::prepare::Target::Node(NodeId::Prof(key.address())),
                p_d: 1.0,
                p_i: 1.0,
                settlement_ref: None,
                license: None,
                asserted_parents: vec![],
                deps: vec![],
                payload: vec![],
                node: None,
            },
        )
        .await
        .expect("prepares anchor");
        let write = staged::load(&self.pool, anchor.id).await.expect("loads");
        let pre = key.pre_sign(write.proposal);
        let parts = PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        };
        let sealed = api::relay::submit_pre_signed(&self.boundary(), &self.pool, anchor.id, parts)
            .await
            .expect("seals");
        let host_key = self.standin.host_public_key().await.expect("host key");
        let witness = key.approve(&pre, &sealed, &host_key).expect("approves");
        api::relay::submit_approval(
            &self.boundary(),
            &self.pool,
            anchor.id,
            witness.approval_signature,
        )
        .await
        .expect("relays");
        self.close_and_ingest().await;
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
        api::ingest::ingest_pending(&self.boundary(), &self.pool, GC)
            .await
            .expect("ingests");
    }

    /// The device's two signing steps over a `PreparePayload`'s writes,
    /// through the session-authorized relay mutations.
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
            let staged_write = &sealed["submitProposals"]["stagedWrites"][0];
            let act = wire::decode_verified_act(
                &B64.decode(staged_write["verifiedAct"].as_str().expect("sealed"))
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

const USER_QUERY: &str = r#"query($id: UUID, $handle: String) {
    user(id: $id, handle: $handle) {
        id
        handle
        displayName { value status }
        bio { value status }
        websiteUrl { value status }
    }
}"#;

#[sqlx::test(migrations = "../../migrations")]
async fn user_resolves_by_id_and_handle(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (id, _key) = rig.seed_member("ada", "ada@example.com").await;

    let by_handle = rig.gql(None, USER_QUERY, json!({ "handle": "ada" })).await;
    assert_eq!(
        by_handle["user"]["id"].as_str(),
        Some(id.to_string().as_str())
    );
    assert_eq!(by_handle["user"]["displayName"]["value"], "ada");
    assert_eq!(by_handle["user"]["displayName"]["status"], "NORMAL");
    assert_eq!(by_handle["user"]["bio"]["value"], Value::Null);

    // Case-insensitive resolution (auth.md "Handle and email format").
    let folded = rig
        .gql(None, USER_QUERY, json!({ "handle": "  AdA " }))
        .await;
    assert_eq!(folded["user"]["id"].as_str(), Some(id.to_string().as_str()));

    let by_id = rig.gql(None, USER_QUERY, json!({ "id": id })).await;
    assert_eq!(by_id["user"]["handle"], "ada");

    // No match and never-registrable handles resolve to null.
    assert_eq!(
        rig.gql(None, USER_QUERY, json!({ "handle": "nobody" }))
            .await["user"],
        Value::Null
    );
    assert_eq!(
        rig.gql(None, USER_QUERY, json!({ "handle": "not-a-handle!" }))
            .await["user"],
        Value::Null
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn actor_resolves_and_argument_rule_holds(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (id, _key) = rig.seed_member("ada", "ada@example.com").await;

    let actor = rig
        .gql(
            None,
            r#"query($handle: String) {
                 actor(handle: $handle) { __typename id handle displayName { value } }
               }"#,
            json!({ "handle": "ada" }),
        )
        .await;
    assert_eq!(actor["actor"]["__typename"], "User");
    assert_eq!(actor["actor"]["id"].as_str(), Some(id.to_string().as_str()));

    // Exactly one argument — both or neither is a transport fault.
    let both = rig
        .gql_raw(
            None,
            r#"query($id: UUID, $handle: String) { actor(id: $id, handle: $handle) { id } }"#,
            json!({ "id": id, "handle": "ada" }),
        )
        .await;
    assert!(both.get("errors").is_some(), "expected errors: {both}");
    let neither = rig
        .gql_raw(None, r#"query { user { id } }"#, json!({}))
        .await;
    assert!(
        neither.get("errors").is_some(),
        "expected errors: {neither}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn bio_edit_lands_through_the_write_path(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_id, key) = rig.seed_member("ada", "ada@example.com").await;
    let token = rig.log_in("ada@example.com").await;

    let prepared = rig
        .gql(
            Some(&token),
            r#"mutation($input: PrepareProfileUpdateInput!) {
                 prepareProfileUpdate(input: $input) {
                   writes { id canonicalProposal }
                   userErrors { code message }
                 }
               }"#,
            json!({ "input": { "bio": "Hello from the hand test." }}),
        )
        .await;
    assert_eq!(
        prepared["prepareProfileUpdate"]["userErrors"],
        json!([]),
        "unexpected userErrors"
    );
    rig.sign_prepared(&token, &key, &prepared["prepareProfileUpdate"]["writes"])
        .await;
    rig.close_and_ingest().await;

    // Read back anonymously — the shared graph is public.
    let user = rig.gql(None, USER_QUERY, json!({ "handle": "ada" })).await;
    assert_eq!(user["user"]["bio"]["value"], "Hello from the hand test.");
    assert_eq!(user["user"]["displayName"]["value"], "ada");
}

#[sqlx::test(migrations = "../../migrations")]
async fn empty_update_refuses_with_a_user_error(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_id, _key) = rig.seed_member("ada", "ada@example.com").await;
    let token = rig.log_in("ada@example.com").await;

    let refused = rig
        .gql(
            Some(&token),
            r#"mutation($input: PrepareProfileUpdateInput!) {
                 prepareProfileUpdate(input: $input) {
                   writes { id }
                   userErrors { code field message }
                 }
               }"#,
            json!({ "input": {} }),
        )
        .await;
    let payload = &refused["prepareProfileUpdate"];
    assert_eq!(payload["writes"], Value::Null);
    assert_eq!(payload["userErrors"][0]["code"], "BAD_INPUT");
}
