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

    async fn prepare_stance(&self, token: &str, target: Value, p_d: f64, p_i: f64) -> Value {
        let mut input = json!({ "pDirected": p_d, "pInterest": p_i });
        merge(&mut input, target);
        self.gql(Some(token), PREPARE_STANCE, json!({ "input": input }))
            .await
    }

    /// A follow, landed. `target` names the topic the way a client
    /// would — by name, since a topic page reaches an untagged topic.
    async fn follow_topic(&self, token: &str, key: &ActorKey, name: &str, p_d: f64, p_i: f64) {
        let prepared = self
            .prepare_stance(token, json!({ "topicName": name }), p_d, p_i)
            .await;
        assert_eq!(
            prepared["prepareStance"]["userErrors"]
                .as_array()
                .expect("array"),
            &Vec::<Value>::new(),
            "follow refused: {prepared}"
        );
        self.land(token, key, &prepared["prepareStance"]["writes"])
            .await;
    }

    async fn prepare_severance(&self, token: &str, target: Value) -> Value {
        self.gql(Some(token), PREPARE_SEVERANCE, json!({ "input": target }))
            .await
    }

    /// The registry rows CoGra's naming service holds.
    async fn registry_names(&self) -> Vec<String> {
        sqlx::query_scalar::<_, String>("SELECT name FROM hashtags ORDER BY name")
            .fetch_all(&self.pool)
            .await
            .expect("registry")
    }

    /// A post's chip row, as a client reads it.
    async fn post_topics(&self, token: Option<&str>, id: &str, include_pending: bool) -> Value {
        let data = self
            .gql(
                token,
                r#"query($id: UUID!, $ip: Boolean!) {
                     post(id: $id) {
                       topics(includePending: $ip) {
                         relevance confidence pending
                         hashtag { id name { value status } moderationStatus }
                       }
                     }
                   }"#,
                json!({ "id": id, "ip": include_pending }),
            )
            .await;
        data["post"]["topics"].clone()
    }

    async fn comment_topics(&self, token: Option<&str>, id: &str) -> Value {
        let data = self
            .gql(
                token,
                r#"query($id: UUID!) {
                     comment(id: $id) { topics { hashtag { name { value } } } }
                   }"#,
                json!({ "id": id }),
            )
            .await;
        data["comment"]["topics"].clone()
    }

    async fn hashtag(&self, token: Option<&str>, name: &str) -> Value {
        let data = self
            .gql(
                token,
                r#"query($n: String!) {
                     hashtag(name: $n) {
                       id
                       name { value status }
                       moderationStatus
                       taggedContent {
                         relevance confidence pending
                         node { id ... on Post { title { value } } }
                       }
                       viewerStance { pDirected pInterest recordCount severed }
                     }
                   }"#,
                json!({ "n": name }),
            )
            .await;
        data["hashtag"].clone()
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

const PREPARE_STANCE: &str = r#"mutation($input: PrepareStanceInput!) {
  prepareStance(input: $input) {
    writes { id family canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_SEVERANCE: &str = r#"mutation($input: PrepareSeveranceInput!) {
  prepareSeverance(input: $input) {
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

// ---------------------------------------------------------------------
// Following a topic: the generic stance, with the family the target
// fixes (D1), and the severance that undoes it (D9).
// ---------------------------------------------------------------------

/// The target selects the family, so the same `prepareStance` that
/// carries an Opinion toward a Post carries an Affinity toward a Type —
/// no per-act family choice anywhere (edges.md §1).
#[sqlx::test(migrations = "../../migrations")]
async fn following_a_topic_writes_an_affinity(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (author_id, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    rig.follow_topic(&token, &ak, "rust", 0.1, 0.1).await;

    let listing = rig
        .gql(
            None,
            r#"query($a: UUID!) {
                 records(author: $a, first: 10) {
                   edges { node { family targetId terminalId pDirected pInterest } }
                 }
               }"#,
            json!({ "a": author_id.to_string() }),
        )
        .await;
    let node = &listing["records"]["edges"][0]["node"];
    assert_eq!(node["family"], "AFFINITY", "{listing}");
    // Affinity is binary: the Type is the target leg, and there is no
    // terminal leg to carry it.
    assert_eq!(node["targetId"], "name:rust");
    assert!(node["terminalId"].is_null(), "{node}");
    assert_eq!(node["pDirected"], 0.1);
    assert_eq!(node["pInterest"], 0.1);
}

/// A topic nobody has tagged has no registry row, and its id derives
/// one-way from its name — so the id spelling cannot reach it and the
/// name spelling must (D4).
#[sqlx::test(migrations = "../../migrations")]
async fn a_never_tagged_topic_is_followable_by_name(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    assert!(rig.registry_names().await.is_empty());

    rig.follow_topic(&token, &ak, "#Untouched", 0.1, 0.1).await;

    assert_eq!(
        rig.registry_names().await,
        vec!["untouched".to_string()],
        "the follow registers the canonical name, as any record naming it does"
    );
}

/// Once a name has a registry row the id spelling works too — which is
/// what lets a chip carry an id straight into the follow control.
#[sqlx::test(migrations = "../../migrations")]
async fn a_registered_topic_is_followable_by_id(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (author_id, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    rig.landed_post(&token, &ak, "A post", json!([tag("rust")]))
        .await;

    let id = common::hashtag_uuid("rust").to_string();
    let prepared = rig
        .prepare_stance(&token, json!({ "target": id }), 0.1, 0.1)
        .await;
    assert_eq!(
        errors(&prepared, "prepareStance")
            .as_array()
            .expect("array"),
        &Vec::<Value>::new(),
        "{prepared}"
    );
    rig.land(&token, &ak, &prepared["prepareStance"]["writes"])
        .await;

    let listing = rig
        .gql(
            None,
            r#"query($a: UUID!) {
                 records(author: $a, family: AFFINITY, first: 10) {
                   edges { node { targetId } }
                 }
               }"#,
            json!({ "a": author_id.to_string() }),
        )
        .await;
    assert_eq!(
        listing["records"]["edges"][0]["node"]["targetId"],
        "name:rust"
    );
}

/// Unfollowing is `prepareSeverance` on the topic — the same generic
/// gesture every other stance target gets (D9).
#[sqlx::test(migrations = "../../migrations")]
async fn unfollowing_a_topic_severs_the_affinity_bundle(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (author_id, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    rig.follow_topic(&token, &ak, "rust", 0.1, 0.1).await;
    let severed = rig
        .prepare_severance(&token, json!({ "topicName": "rust" }))
        .await;
    let writes = severed["prepareSeverance"]["writes"]
        .as_array()
        .unwrap_or_else(|| panic!("severance refused: {severed}"));
    assert_eq!(writes.len(), 1, "one counter-record suffices: {severed}");
    assert_eq!(writes[0]["family"], "AFFINITY");
    rig.land(&token, &ak, &severed["prepareSeverance"]["writes"])
        .await;

    let listing = rig
        .gql(
            None,
            r#"query($a: UUID!) {
                 records(author: $a, family: AFFINITY, first: 10) {
                   edges { node { pDirected pInterest } }
                 }
               }"#,
            json!({ "a": author_id.to_string() }),
        )
        .await;
    let edges = listing["records"]["edges"].as_array().expect("edges");
    assert_eq!(edges.len(), 2, "nothing was erased: {listing}");
    let sum: f64 = edges
        .iter()
        .map(|e| e["node"]["pDirected"].as_f64().expect("number"))
        .sum();
    assert!(sum.abs() < 1e-9, "the bundle nets to zero: {listing}");
}

#[sqlx::test(migrations = "../../migrations")]
async fn severing_an_unfollowed_topic_is_refused(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let refused = rig
        .prepare_severance(&token, json!({ "topicName": "rust" }))
        .await;
    assert_eq!(errors(&refused, "prepareSeverance")[0]["code"], "BAD_INPUT");
    assert!(refused["prepareSeverance"]["writes"].is_null(), "{refused}");
}

/// Exactly one spelling of the target, in both stance mutations: naming
/// neither leaves the gesture pointing nowhere, and naming both makes
/// the record's endpoint a guess.
#[sqlx::test(migrations = "../../migrations")]
async fn a_stance_names_exactly_one_target(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let id = common::hashtag_uuid("rust").to_string();

    for target in [json!({}), json!({ "target": id, "topicName": "rust" })] {
        let refused = rig.prepare_stance(&token, target.clone(), 0.1, 0.1).await;
        assert_eq!(
            errors(&refused, "prepareStance")[0]["code"],
            "BAD_INPUT",
            "for {target}: {refused}"
        );
        assert_eq!(
            errors(&refused, "prepareStance")[0]["field"],
            json!(["target"]),
            "for {target}"
        );
        assert!(refused["prepareStance"]["writes"].is_null());

        let refused = rig.prepare_severance(&token, target.clone()).await;
        assert_eq!(
            errors(&refused, "prepareSeverance")[0]["code"],
            "BAD_INPUT",
            "for {target}: {refused}"
        );
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_illegal_topic_name_refuses_the_follow(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let refused = rig
        .prepare_stance(&token, json!({ "topicName": "has space" }), 0.1, 0.1)
        .await;
    assert_eq!(errors(&refused, "prepareStance")[0]["code"], "BAD_INPUT");
    assert_eq!(
        errors(&refused, "prepareStance")[0]["field"],
        json!(["topicName"]),
        "{refused}"
    );
    assert!(
        rig.registry_names().await.is_empty(),
        "a refused follow registers nothing"
    );
}

// ---------------------------------------------------------------------
// The read surface: the fold, served.
// ---------------------------------------------------------------------

/// Every well-formed name already denotes a Type, and a read never
/// writes the registry (D4).
#[sqlx::test(migrations = "../../migrations")]
async fn an_untagged_name_resolves_without_a_registry_row(pool: PgPool) {
    let rig = Rig::new(pool).await;

    let hashtag = rig.hashtag(None, "#Nobody-Has-Tagged-This").await;
    assert_eq!(
        hashtag["name"]["value"], "nobody-has-tagged-this",
        "canonicalized on the way in: {hashtag}"
    );
    assert_eq!(
        hashtag["id"],
        common::hashtag_uuid("nobody-has-tagged-this").to_string(),
        "the id is derived, not looked up"
    );
    assert_eq!(hashtag["moderationStatus"], "NORMAL");
    assert_eq!(
        hashtag["taggedContent"].as_array().expect("array"),
        &Vec::<Value>::new()
    );
    assert!(
        rig.registry_names().await.is_empty(),
        "reading a topic wrote a row"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_name_the_substrate_could_never_carry_resolves_to_nothing(pool: PgPool) {
    let rig = Rig::new(pool).await;
    for bad in ["", "has space", "münchen"] {
        let data = rig
            .gql(
                None,
                r#"query($n: String!) { hashtag(name: $n) { id } }"#,
                json!({ "n": bad }),
            )
            .await;
        assert!(data["hashtag"].is_null(), "for {bad:?}: {data}");
    }
}

/// A `Hashtag` is not a `Node`: it has no minting record, so there is
/// nothing to date and nothing to land (D2).
#[sqlx::test(migrations = "../../migrations")]
async fn a_hashtag_carries_no_node_fields(pool: PgPool) {
    let rig = Rig::new(pool).await;
    for field in ["createdAt", "updatedAt", "landing { state }"] {
        let refused = rig
            .gql_raw(
                None,
                &format!("query {{ hashtag(name: \"rust\") {{ {field} }} }}"),
                json!({}),
            )
            .await;
        assert!(
            refused.get("errors").is_some(),
            "Hashtag answered {field}: {refused}"
        );
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_posts_chip_row_serves_the_authors_current_topics(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig
        .landed_post(
            &token,
            &ak,
            "A post",
            json!([{ "name": "#Rust", "pDirected": 0.8, "pInterest": 0.9 }]),
        )
        .await;

    let topics = rig.post_topics(None, &post, true).await;
    let chips = topics.as_array().expect("array");
    assert_eq!(chips.len(), 1, "{topics}");
    assert_eq!(chips[0]["hashtag"]["name"]["value"], "rust");
    assert_eq!(chips[0]["relevance"], 0.8);
    assert_eq!(chips[0]["confidence"], 0.9);
    assert_eq!(chips[0]["pending"], false);
}

/// Defaults, as jakob ruled them: a modest relevance claim held with
/// full confidence in one's own declaration (D13).
#[sqlx::test(migrations = "../../migrations")]
async fn omitted_parameters_land_the_declared_defaults(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig
        .landed_post(&token, &ak, "A post", json!([tag("rust")]))
        .await;

    let topics = rig.post_topics(None, &post, true).await;
    assert_eq!(topics[0]["relevance"], 0.1);
    assert_eq!(topics[0]["confidence"], 1.0);
}

/// The un-tag, read through the fold: relevance 0 is a record like any
/// other, and the chip is gone without anything being erased.
#[sqlx::test(migrations = "../../migrations")]
async fn un_tagging_takes_the_chip_off_the_row(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig
        .landed_post(&token, &ak, "A post", json!([tag("rust"), tag("graphs")]))
        .await;
    assert_eq!(
        rig.post_topics(None, &post, true)
            .await
            .as_array()
            .map(Vec::len),
        Some(2)
    );

    rig.land_tag(
        &token,
        &ak,
        &post,
        json!({ "name": "rust", "pDirected": 0.0 }),
    )
    .await;

    let topics = rig.post_topics(None, &post, true).await;
    let chips = topics.as_array().expect("array");
    assert_eq!(chips.len(), 1, "the withdrawn claim is gone: {topics}");
    assert_eq!(chips[0]["hashtag"]["name"]["value"], "graphs");

    // And re-tagging brings it back — the fold reads the newest record,
    // not a tombstone.
    rig.land_tag(&token, &ak, &post, tag("rust")).await;
    assert_eq!(
        rig.post_topics(None, &post, true)
            .await
            .as_array()
            .map(Vec::len),
        Some(2)
    );
}

/// Third-party claims are the ranker's to weight, so 2.3's chip row
/// carries only the content-intrinsic channel (D8).
#[sqlx::test(migrations = "../../migrations")]
async fn a_strangers_tag_stays_off_the_chip_row(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let (_, sk) = rig.seed_member("stranger", "stranger@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let stranger = rig.log_in("stranger@example.com").await;
    let post = rig
        .landed_post(&token, &ak, "A post", json!([tag("rust")]))
        .await;

    rig.land_tag(&stranger, &sk, &post, tag("spam")).await;

    let topics = rig.post_topics(None, &post, true).await;
    let chips = topics.as_array().expect("array");
    assert_eq!(
        chips.len(),
        1,
        "the stranger's claim is not the post's: {topics}"
    );
    assert_eq!(chips[0]["hashtag"]["name"]["value"], "rust");

    // Nor does it reach the topic page's author-owned channel.
    let spam = rig.hashtag(None, "spam").await;
    assert_eq!(
        spam["taggedContent"].as_array().expect("array"),
        &Vec::<Value>::new(),
        "{spam}"
    );
}

/// A tag still in flight is the author's own content from the moment
/// they sign it — and nobody else's business until it lands.
#[sqlx::test(migrations = "../../migrations")]
async fn a_pending_tag_shows_to_its_author_only(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    rig.seed_member("other", "other@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let other = rig.log_in("other@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post", json!([])).await;

    let prepared = rig.prepare_tag(&token, &post, tag("rust")).await;
    rig.pre_sign(&token, &ak, &prepared["prepareTag"]["writes"])
        .await;

    let mine = rig.post_topics(Some(&token), &post, true).await;
    assert_eq!(mine.as_array().map(Vec::len), Some(1), "{mine}");
    assert_eq!(mine[0]["pending"], true);

    let landed_only = rig.post_topics(Some(&token), &post, false).await;
    assert_eq!(
        landed_only.as_array().expect("array"),
        &Vec::<Value>::new(),
        "the L1 view carries only what landed"
    );

    let theirs = rig.post_topics(Some(&other), &post, true).await;
    assert_eq!(
        theirs.as_array().expect("array"),
        &Vec::<Value>::new(),
        "an unlanded act is not on the graph"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_comments_chip_row_reads_the_same_fold(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post", json!([])).await;
    let comment = rig
        .landed_comment(&token, &ak, &post, json!([tag("rust")]))
        .await;

    let topics = rig.comment_topics(None, &comment).await;
    assert_eq!(topics.as_array().map(Vec::len), Some(1), "{topics}");
    assert_eq!(topics[0]["hashtag"]["name"]["value"], "rust");
    assert_eq!(
        rig.post_topics(None, &post, true)
            .await
            .as_array()
            .map(Vec::len),
        Some(0),
        "the comment's topic is not the post's"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_topic_page_lists_the_content_tagged_with_it(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    rig.landed_post(&token, &ak, "Tagged", json!([tag("rust")]))
        .await;
    rig.landed_post(&token, &ak, "Untagged", json!([])).await;

    let hashtag = rig.hashtag(None, "rust").await;
    let listed = hashtag["taggedContent"].as_array().expect("array");
    assert_eq!(listed.len(), 1, "{hashtag}");
    assert_eq!(listed[0]["node"]["title"]["value"], "Tagged");
    assert_eq!(listed[0]["relevance"], 0.1);
    assert_eq!(listed[0]["pending"], false);
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_tagged_content_limit_refuses_over_asking(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let refused = rig
        .gql_raw(
            None,
            r#"query { hashtag(name: "rust") { taggedContent(limit: 101) { pending } } }"#,
            json!({}),
        )
        .await;
    assert!(refused.get("errors").is_some(), "{refused}");
}

/// The follow control's read: the topic page shows where the viewer's
/// own Affinity bundle stands, and what severing it would cost.
#[sqlx::test(migrations = "../../migrations")]
async fn a_topic_page_reads_the_viewers_own_follow(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    rig.seed_member("other", "other@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let other = rig.log_in("other@example.com").await;

    assert!(
        rig.hashtag(None, "rust").await["viewerStance"].is_null(),
        "a guest reads no bundle"
    );

    rig.follow_topic(&token, &ak, "rust", 0.1, 0.1).await;

    let mine = rig.hashtag(Some(&token), "rust").await;
    assert_eq!(mine["viewerStance"]["pDirected"], 0.1, "{mine}");
    assert_eq!(mine["viewerStance"]["recordCount"], 1);
    assert_eq!(mine["viewerStance"]["severed"], false);

    let theirs = rig.hashtag(Some(&other), "rust").await;
    assert_eq!(
        theirs["viewerStance"]["recordCount"], 0,
        "the fold never nets across authors: {theirs}"
    );
}

/// Follow, then unfollow, then read: the round trip a topic page runs.
#[sqlx::test(migrations = "../../migrations")]
async fn follow_and_unfollow_round_trip_through_the_topic_page(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    rig.follow_topic(&token, &ak, "rust", 0.6, 0.6).await;
    assert_eq!(
        rig.hashtag(Some(&token), "rust").await["viewerStance"]["severed"],
        false
    );

    let severed = rig
        .prepare_severance(&token, json!({ "topicName": "rust" }))
        .await;
    rig.land(&token, &ak, &severed["prepareSeverance"]["writes"])
        .await;

    let after = rig.hashtag(Some(&token), "rust").await;
    assert_eq!(after["viewerStance"]["pDirected"], 0.0, "{after}");
    assert_eq!(after["viewerStance"]["severed"], true);
    assert_eq!(
        after["viewerStance"]["recordCount"], 2,
        "the follow and its counter-record both stand"
    );
}
