//! Topics, end to end through the real HTTP surface (roadmap.md slice
//! 2.3): the Tag hyper-edge in the creation batch and standalone, the
//! naming service's refusals, the current-topics fold as the read
//! surface serves it, and the follow / unfollow round trip that rides
//! the generic stance toward a Type.

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

const GC: i64 = 8;

struct Rig {
    app: axum::Router,
    pool: PgPool,
    standin: StandIn,
}

struct Signed {
    id: String,
    pre: common::l1::handshake::PreSignedProposal,
    act: common::l1::handshake::VerifiedAct,
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
            GC,
        )
        .await
        .expect("ingests");
        assert!(
            outcome.promotion_failures.is_empty(),
            "confirm-side promotion failed: {:?}",
            outcome.promotion_failures
        );
    }

    async fn pre_sign(&self, token: &str, key: &ActorKey, writes: &Value) -> Vec<Signed> {
        let mut signed = Vec::new();
        for write in writes.as_array().expect("writes") {
            let id = write["id"].as_str().expect("id").to_string();
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
            let act = wire::decode_verified_act(
                &B64.decode(
                    sealed["submitProposals"]["stagedWrites"][0]["verifiedAct"]
                        .as_str()
                        .unwrap_or_else(|| panic!("seal refused: {sealed}")),
                )
                .expect("b64"),
            )
            .expect("decodes");
            signed.push(Signed { id, pre, act });
        }
        signed
    }

    async fn approve(&self, token: &str, key: &ActorKey, signed: &[Signed]) {
        let host_key = self.standin.host_public_key().await.expect("host key");
        for write in signed {
            let witness = key
                .approve(&write.pre, &write.act, &host_key)
                .expect("approves");
            let approved = self
                .gql(
                    Some(token),
                    "mutation($input: ApproveActsInput!) {
                       approveActs(input: $input) {
                         stagedWrites { state } userErrors { code message }
                       }
                     }",
                    json!({ "input": { "approvals": [{
                        "stagedWriteId": write.id,
                        "signature": B64.encode(witness.approval_signature),
                    }]}}),
                )
                .await;
            assert_eq!(
                approved["approveActs"]["userErrors"]
                    .as_array()
                    .expect("array"),
                &Vec::<Value>::new(),
                "approval refused: {approved}"
            );
        }
    }

    /// The whole path for a batch of prepared writes, to landed.
    async fn land(&self, token: &str, key: &ActorKey, writes: &Value) {
        let signed = self.pre_sign(token, key, writes).await;
        self.approve(token, key, &signed).await;
        self.close_and_ingest().await;
    }

    /// Prepares a post carrying the given topics, without landing it.
    async fn prepare_post(&self, token: &str, title: &str, tags: Value) -> Value {
        self.gql(
            Some(token),
            PREPARE_POST,
            json!({ "input": {
                "title": title,
                "content": "a body",
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "tags": tags,
            }}),
        )
        .await
    }

    /// A post with its topics, driven all the way to landed.
    async fn landed_post(&self, token: &str, key: &ActorKey, title: &str, tags: Value) -> String {
        let prepared = self.prepare_post(token, title, tags).await;
        assert_eq!(
            prepared["preparePost"]["userErrors"]
                .as_array()
                .expect("array"),
            &Vec::<Value>::new(),
            "post refused: {prepared}"
        );
        let node = prepared["preparePost"]["node"]
            .as_str()
            .expect("node")
            .to_string();
        self.land(token, key, &prepared["preparePost"]["writes"])
            .await;
        node
    }

    async fn landed_comment(
        &self,
        token: &str,
        key: &ActorKey,
        target: &str,
        tags: Value,
    ) -> String {
        let prepared = self
            .gql(
                Some(token),
                PREPARE_COMMENT,
                json!({ "input": {
                    "target": target,
                    "content": "a reply",
                    "license": { "attribution": 0.0, "provenance": 0.0 },
                    "tags": tags,
                }}),
            )
            .await;
        let node = prepared["prepareComment"]["node"]
            .as_str()
            .expect("node")
            .to_string();
        self.land(token, key, &prepared["prepareComment"]["writes"])
            .await;
        node
    }

    async fn prepare_tag(&self, token: &str, target: &str, tag: Value) -> Value {
        let mut input = json!({ "target": target });
        merge(&mut input, tag);
        self.gql(Some(token), PREPARE_TAG, json!({ "input": input }))
            .await
    }

    /// One standalone tag, landed.
    async fn land_tag(&self, token: &str, key: &ActorKey, target: &str, tag: Value) {
        let prepared = self.prepare_tag(token, target, tag).await;
        assert_eq!(
            prepared["prepareTag"]["userErrors"]
                .as_array()
                .expect("array"),
            &Vec::<Value>::new(),
            "tag refused: {prepared}"
        );
        self.land(token, key, &prepared["prepareTag"]["writes"])
            .await;
    }

    /// The registry rows CoGra's naming service holds.
    async fn registry_names(&self) -> Vec<String> {
        sqlx::query_scalar::<_, String>("SELECT name FROM hashtags ORDER BY name")
            .fetch_all(&self.pool)
            .await
            .expect("registry")
    }
}

/// Folds a tag object into a mutation input object.
fn merge(into: &mut Value, from: Value) {
    let object = from.as_object().expect("tag object").clone();
    let target = into.as_object_mut().expect("input object");
    for (k, v) in object {
        target.insert(k, v);
    }
}

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) {
    node writes { id family canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_COMMENT: &str = r#"mutation($input: PrepareCommentInput!) {
  prepareComment(input: $input) {
    node writes { id family canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_TAG: &str = r#"mutation($input: PrepareTagInput!) {
  prepareTag(input: $input) {
    writes { id family canonicalProposal } userErrors { code message field }
  }
}"#;

fn tag(name: &str) -> Value {
    json!({ "name": name })
}

fn errors(payload: &Value, mutation: &str) -> Value {
    payload[mutation]["userErrors"].clone()
}

// ---------------------------------------------------------------------
// The creation batch: one act per topic, on top of the minting record.
// ---------------------------------------------------------------------

#[sqlx::test(migrations = "../../migrations")]
async fn a_post_with_topics_stages_one_act_per_topic(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let prepared = rig
        .prepare_post(&token, "A post", json!([tag("rust"), tag("graphs")]))
        .await;
    let writes = prepared["preparePost"]["writes"]
        .as_array()
        .expect("writes");
    assert_eq!(writes.len(), 3, "one Publish plus two Tags: {prepared}");
    assert_eq!(writes[0]["family"], "PUBLISH", "the minting record leads");
    assert_eq!(writes[1]["family"], "TAG");
    assert_eq!(writes[2]["family"], "TAG");
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_post_without_topics_stages_only_its_minting_record(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let prepared = rig.prepare_post(&token, "A post", json!([])).await;
    assert_eq!(
        prepared["preparePost"]["writes"]
            .as_array()
            .expect("writes")
            .len(),
        1
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_comment_carries_topics_too(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post", json!([])).await;

    let prepared = rig
        .gql(
            Some(&token),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": post,
                "content": "a reply",
                "license": { "attribution": 0.0, "provenance": 0.0 },
                "tags": [tag("rust")],
            }}),
        )
        .await;
    let writes = prepared["prepareComment"]["writes"]
        .as_array()
        .expect("writes");
    assert_eq!(writes.len(), 2, "{prepared}");
    assert_eq!(writes[0]["family"], "REVIEW");
    assert_eq!(writes[1]["family"], "TAG");
}

/// A comment's Tag enters the Comment the Review's terminal leg mints,
/// not the post the Review's A leg entered.
#[sqlx::test(migrations = "../../migrations")]
async fn a_comments_tag_enters_the_comment(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (author_id, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post", json!([])).await;
    rig.landed_comment(&token, &ak, &post, json!([tag("rust")]))
        .await;

    let listing = rig
        .gql(
            None,
            r#"query($a: UUID!) {
                 records(author: $a, family: TAG, first: 10) {
                   edges { node { targetId terminalId } }
                 }
               }"#,
            json!({ "a": author_id.to_string() }),
        )
        .await;
    let node = &listing["records"]["edges"][0]["node"];
    assert_eq!(node["terminalId"], "name:rust");
    assert!(
        node["targetId"]
            .as_str()
            .expect("target")
            .ends_with(":review"),
        "the middle is the minted Comment: {node}"
    );
}

/// The whole batch lands through one signing loop, and the Tag's middle
/// is the node the Publish minted — which only exists once prepare has
/// allocated the sequence value.
#[sqlx::test(migrations = "../../migrations")]
async fn the_batch_lands_whole(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (author_id, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    rig.landed_post(&token, &ak, "A post", json!([tag("rust")]))
        .await;

    let listing = rig
        .gql(
            None,
            r#"query($a: UUID!) {
                 records(author: $a, family: TAG, first: 10) {
                   edges { node { id family targetId terminalId pDirected pInterest } }
                 }
               }"#,
            json!({ "a": author_id.to_string() }),
        )
        .await;
    let edges = listing["records"]["edges"].as_array().expect("edges");
    assert_eq!(edges.len(), 1, "the Tag landed: {listing}");
    let node = &edges[0]["node"];
    assert_eq!(
        node["terminalId"], "name:rust",
        "the terminal leg names the Type"
    );
    assert!(
        node["targetId"]
            .as_str()
            .expect("target")
            .starts_with("mint:act:"),
        "the middle is the minted content node: {node}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn staging_a_tag_registers_its_name(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let before = rig.registry_names().await;
    assert!(!before.contains(&"rust".to_string()));

    // Prepare only — no signing, no landing. The row is written in the
    // transaction that stages the act (D5), because the composer needs
    // the name the moment it is declared.
    rig.prepare_post(&token, "A post", json!([tag("#Rust")]))
        .await;

    assert!(
        rig.registry_names().await.contains(&"rust".to_string()),
        "the canonical name is registered at prepare"
    );
}

// ---------------------------------------------------------------------
// The refusals — every one before a single act is staged.
// ---------------------------------------------------------------------

#[sqlx::test(migrations = "../../migrations")]
async fn an_illegal_name_refuses_the_whole_batch(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    for bad in ["", "has space", "münchen", "colon:inside"] {
        let refused = rig
            .prepare_post(&token, "A post", json!([tag("ok"), tag(bad)]))
            .await;
        assert_eq!(
            errors(&refused, "preparePost")[0]["code"],
            "BAD_INPUT",
            "for {bad:?}: {refused}"
        );
        assert_eq!(
            errors(&refused, "preparePost")[0]["field"],
            json!(["tags", "1", "name"]),
            "for {bad:?}"
        );
        assert!(
            refused["preparePost"]["writes"].is_null(),
            "nothing staged for {bad:?}"
        );
    }
    assert!(
        rig.registry_names().await.is_empty(),
        "a refused batch registers no name"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn duplicate_names_after_canonicalization_are_refused(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let refused = rig
        .prepare_post(
            &token,
            "A post",
            json!([tag("rust"), tag("Rust"), tag("#rust")]),
        )
        .await;
    assert_eq!(errors(&refused, "preparePost")[0]["code"], "BAD_INPUT");
    assert_eq!(
        errors(&refused, "preparePost")[0]["field"],
        json!(["tags", "1", "name"]),
        "{refused}"
    );
    assert!(refused["preparePost"]["writes"].is_null());
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_batch_cap_admits_ten_and_refuses_eleven(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let ten: Vec<Value> = (0..10).map(|i| tag(&format!("t{i}"))).collect();
    let accepted = rig.prepare_post(&token, "Ten", json!(ten)).await;
    assert_eq!(
        errors(&accepted, "preparePost").as_array().expect("array"),
        &Vec::<Value>::new(),
        "ten is at the cap: {accepted}"
    );
    assert_eq!(
        accepted["preparePost"]["writes"]
            .as_array()
            .expect("writes")
            .len(),
        11,
        "the minting record plus ten tags"
    );

    let eleven: Vec<Value> = (0..11).map(|i| tag(&format!("t{i}"))).collect();
    let refused = rig.prepare_post(&token, "Eleven", json!(eleven)).await;
    assert_eq!(errors(&refused, "preparePost")[0]["code"], "BAD_INPUT");
    assert_eq!(
        errors(&refused, "preparePost")[0]["field"],
        json!(["tags"]),
        "the batch is the offender, not one entry: {refused}"
    );
    assert!(refused["preparePost"]["writes"].is_null());
}

/// Confidence is narrower than its scalar: `Dimension` admits `[-1, 1]`
/// but the census bounds Tag confidence to `[0, 1]`, so a negative
/// confidence is a field-level refusal rather than a formation fault
/// dressed up as an internal error (D12).
#[sqlx::test(migrations = "../../migrations")]
async fn negative_confidence_is_a_field_level_refusal(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let refused = rig
        .prepare_post(
            &token,
            "A post",
            json!([{ "name": "rust", "pInterest": -0.5 }]),
        )
        .await;
    assert_eq!(errors(&refused, "preparePost")[0]["code"], "BAD_INPUT");
    assert_eq!(
        errors(&refused, "preparePost")[0]["field"],
        json!(["tags", "0", "pInterest"]),
        "{refused}"
    );
}

/// Out of the scalar's own range is a transport fault, as everywhere
/// else `Dimension` is used.
#[sqlx::test(migrations = "../../migrations")]
async fn a_parameter_off_the_dimension_scale_is_a_transport_fault(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let refused = rig
        .gql_raw(
            Some(&token),
            PREPARE_POST,
            json!({ "input": {
                "title": "A post",
                "content": "a body",
                "license": { "attribution": 0.0, "provenance": 0.0 },
                "tags": [{ "name": "rust", "pInterest": 1.5 }],
            }}),
        )
        .await;
    assert!(refused.get("errors").is_some(), "{refused}");
}

// ---------------------------------------------------------------------
// The standalone gesture, and the un-tag that rides it.
// ---------------------------------------------------------------------

#[sqlx::test(migrations = "../../migrations")]
async fn a_standalone_tag_stages_one_act(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post", json!([])).await;

    let prepared = rig.prepare_tag(&token, &post, tag("rust")).await;
    let writes = prepared["prepareTag"]["writes"].as_array().expect("writes");
    assert_eq!(writes.len(), 1, "{prepared}");
    assert_eq!(writes[0]["family"], "TAG");
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_standalone_tag_names_its_own_fields_on_refusal(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post", json!([])).await;

    let bad_name = rig.prepare_tag(&token, &post, tag("has space")).await;
    assert_eq!(errors(&bad_name, "prepareTag")[0]["field"], json!(["name"]));

    let bad_confidence = rig
        .prepare_tag(&token, &post, json!({ "name": "rust", "pInterest": -0.1 }))
        .await;
    assert_eq!(
        errors(&bad_confidence, "prepareTag")[0]["field"],
        json!(["pInterest"])
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn tagging_something_that_is_not_content_is_refused(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let refused = rig
        .prepare_tag(&token, &Uuid::new_v4().to_string(), tag("rust"))
        .await;
    assert_eq!(errors(&refused, "prepareTag")[0]["code"], "BAD_INPUT");
    assert_eq!(
        errors(&refused, "prepareTag")[0]["field"],
        json!(["target"]),
        "{refused}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_guest_cannot_tag(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let refused = rig
        .gql_raw(
            None,
            PREPARE_TAG,
            json!({ "input": { "target": Uuid::new_v4().to_string(), "name": "rust" }}),
        )
        .await;
    assert!(refused.get("errors").is_some(), "{refused}");
}

/// The un-tag: a further Tag at relevance 0, an ordinary priced record
/// that the fold reads as withdrawn — never an erasure (hashtag.md §4).
#[sqlx::test(migrations = "../../migrations")]
async fn un_tagging_is_a_further_tag_at_relevance_zero(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (author_id, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig
        .landed_post(&token, &ak, "A post", json!([tag("rust")]))
        .await;

    rig.land_tag(
        &token,
        &ak,
        &post,
        json!({ "name": "rust", "pDirected": 0.0 }),
    )
    .await;

    let listing = rig
        .gql(
            None,
            r#"query($a: UUID!) {
                 records(author: $a, family: TAG, first: 10) {
                   edges { node { pDirected pInterest } }
                 }
               }"#,
            json!({ "a": author_id.to_string() }),
        )
        .await;
    assert_eq!(
        listing["records"]["edges"].as_array().expect("edges").len(),
        2,
        "the withdrawal is a record of its own: {listing}"
    );
}
