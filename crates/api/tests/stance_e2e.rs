//! The stance control, end to end through the real HTTP surface
//! (roadmap.md slice 2.2): the one generic `prepareStance` toward any
//! passive node, the raw-edge semantic — a record carries exactly the
//! values picked, never a delta against the bundle (design.md §8.1) —
//! the read-side bundle fold and its projection (design.md §8.2), and
//! the severance gesture that nets a bundle to `(0,0)` with as many
//! counter-records as the conviction takes (feed-ranking.md §8.1).

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

    async fn landed_post(&self, token: &str, key: &ActorKey, title: &str) -> String {
        let prepared = self
            .gql(
                Some(token),
                PREPARE_POST,
                json!({ "input": {
                    "title": title,
                    "content": "a body",
                    "license": { "attribution": 1.0, "provenance": 0.0 },
                }}),
            )
            .await;
        let node = prepared["preparePost"]["node"]
            .as_str()
            .expect("node")
            .to_string();
        self.land(token, key, &prepared["preparePost"]["writes"])
            .await;
        node
    }

    async fn landed_comment(&self, token: &str, key: &ActorKey, target: &str) -> String {
        let prepared = self
            .gql(
                Some(token),
                PREPARE_COMMENT,
                json!({ "input": {
                    "target": target,
                    "content": "a reply",
                    "license": { "attribution": 0.0, "provenance": 0.0 },
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

    async fn prepare_stance(&self, token: &str, target: &str, p_d: f64, p_i: f64) -> Value {
        self.gql(
            Some(token),
            PREPARE_STANCE,
            json!({ "input": { "target": target, "pDirected": p_d, "pInterest": p_i }}),
        )
        .await
    }

    /// A stance driven all the way to landed.
    async fn land_stance(&self, token: &str, key: &ActorKey, target: &str, p_d: f64, p_i: f64) {
        let prepared = self.prepare_stance(token, target, p_d, p_i).await;
        assert_eq!(
            prepared["prepareStance"]["userErrors"]
                .as_array()
                .expect("array"),
            &Vec::<Value>::new(),
            "stance refused: {prepared}"
        );
        self.land(token, key, &prepared["prepareStance"]["writes"])
            .await;
    }

    async fn prepare_severance(&self, token: &str, target: &str) -> Value {
        self.gql(
            Some(token),
            PREPARE_SEVERANCE,
            json!({ "input": { "target": target }}),
        )
        .await
    }

    /// The viewer's bundle toward a person, with an optional pick.
    async fn user_bundle(&self, token: &str, id: &str, pick: Option<(f64, f64)>) -> Value {
        let pick = match pick {
            Some((p_d, p_i)) => json!({ "pDirected": p_d, "pInterest": p_i }),
            None => Value::Null,
        };
        let data = self
            .gql(
                Some(token),
                r#"query($id: UUID!, $pick: StancePickInput) {
                     user(id: $id) { viewerStance(pick: $pick) { ...B } }
                   }
                   fragment B on StanceBundle {
                     pDirected pInterest rawPDirected rawPInterest
                     recordCount inert severed severanceCost
                     projected { pDirected pInterest inert severed }
                   }"#,
                json!({ "id": id, "pick": pick }),
            )
            .await;
        data["user"]["viewerStance"].clone()
    }

    async fn post_bundle(&self, token: &str, id: &str, include_pending: bool) -> Value {
        let data = self
            .gql(
                Some(token),
                r#"query($id: UUID!, $ip: Boolean!) {
                     post(id: $id) {
                       viewerStance(includePending: $ip) {
                         pDirected pInterest recordCount severed severanceCost
                       }
                     }
                   }"#,
                json!({ "id": id, "ip": include_pending }),
            )
            .await;
        data["post"]["viewerStance"].clone()
    }

    async fn comment_bundle(&self, token: &str, id: &str) -> Value {
        let data = self
            .gql(
                Some(token),
                r#"query($id: UUID!) {
                     comment(id: $id) {
                       viewerStance { pDirected pInterest recordCount }
                     }
                   }"#,
                json!({ "id": id }),
            )
            .await;
        data["comment"]["viewerStance"].clone()
    }

    /// The author's landed stance records toward one target, as the
    /// chronicle shows them — the raw authored parameters.
    async fn stance_records(&self, author: &Uuid) -> Vec<Value> {
        let listing = self
            .gql(
                None,
                r#"query($a: UUID!) {
                     records(author: $a, first: 50) {
                       edges { node { id family pDirected pInterest } }
                     }
                   }"#,
                json!({ "a": author.to_string() }),
            )
            .await;
        listing["records"]["edges"]
            .as_array()
            .expect("edges")
            .iter()
            .filter(|e| e["node"]["family"] == "OPINION" || e["node"]["family"] == "AFFINITY")
            .cloned()
            .collect()
    }
}

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) {
    node writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_COMMENT: &str = r#"mutation($input: PrepareCommentInput!) {
  prepareComment(input: $input) {
    node writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_STANCE: &str = r#"mutation($input: PrepareStanceInput!) {
  prepareStance(input: $input) {
    writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_SEVERANCE: &str = r#"mutation($input: PrepareSeveranceInput!) {
  prepareSeverance(input: $input) {
    writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

fn f(v: &Value) -> f64 {
    v.as_f64().unwrap_or_else(|| panic!("not a number: {v}"))
}

/// Every passive node kind takes the same gesture; this is the Profile
/// target.
#[sqlx::test(migrations = "../../migrations")]
async fn a_stance_lands_toward_a_profile(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;

    rig.land_stance(&token, &ak, &target_id.to_string(), 0.4, 0.6)
        .await;

    let bundle = rig.user_bundle(&token, &target_id.to_string(), None).await;
    assert_eq!(f(&bundle["pDirected"]), 0.4);
    assert_eq!(f(&bundle["pInterest"]), 0.6);
    assert_eq!(bundle["recordCount"], 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_stance_lands_toward_a_post(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post").await;

    rig.land_stance(&token, &ak, &post, -0.5, 0.25).await;

    let bundle = rig.post_bundle(&token, &post, true).await;
    assert_eq!(f(&bundle["pDirected"]), -0.5);
    assert_eq!(f(&bundle["pInterest"]), 0.25);
    assert_eq!(bundle["recordCount"], 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_stance_lands_toward_a_comment(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post").await;
    let comment = rig.landed_comment(&token, &ak, &post).await;

    rig.land_stance(&token, &ak, &comment, 0.75, -0.2).await;

    let bundle = rig.comment_bundle(&token, &comment).await;
    assert_eq!(f(&bundle["pDirected"]), 0.75);
    assert_eq!(f(&bundle["pInterest"]), -0.2);
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_unknown_target_is_refused(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let refused = rig
        .prepare_stance(&token, &Uuid::new_v4().to_string(), 0.1, 0.1)
        .await;
    assert_eq!(
        refused["prepareStance"]["userErrors"][0]["code"], "BAD_INPUT",
        "{refused}"
    );
    assert_eq!(
        refused["prepareStance"]["userErrors"][0]["field"],
        json!(["target"])
    );
    assert!(refused["prepareStance"]["writes"].is_null());
}

/// With no viewer at all, an acting mutation is a transport fault rather
/// than a userError (api-spec.md "Conventions").
#[sqlx::test(migrations = "../../migrations")]
async fn a_guest_cannot_stance(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;

    let refused = rig
        .gql_raw(
            None,
            PREPARE_STANCE,
            json!({ "input": {
                "target": target_id.to_string(), "pDirected": 0.1, "pInterest": 0.1
            }}),
        )
        .await;
    assert!(refused.get("errors").is_some(), "{refused}");
}

/// The record carries the picked values verbatim. Under the superseded
/// intended-net-state semantics the second record would have carried the
/// delta (0.2, 0.2) so the bundle would net to the stated (0.7, 0.7);
/// here it carries the picked (0.7, 0.7) and the bundle sums to (1.2,
/// 1.2), clipped to (1, 1). This test fails under delta semantics.
#[sqlx::test(migrations = "../../migrations")]
async fn a_stance_record_carries_the_picked_values_not_a_delta(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (author_id, ak) = rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let target = target_id.to_string();

    rig.land_stance(&token, &ak, &target, 0.5, 0.5).await;
    rig.land_stance(&token, &ak, &target, 0.7, 0.7).await;

    let records = rig.stance_records(&author_id).await;
    assert_eq!(
        records.len(),
        2,
        "two records, not one rewritten: {records:?}"
    );
    let mut authored: Vec<f64> = records.iter().map(|r| f(&r["node"]["pDirected"])).collect();
    authored.sort_by(|a, b| a.partial_cmp(b).expect("ordered"));
    assert_eq!(
        authored,
        vec![0.5, 0.7],
        "each record carries exactly what was picked"
    );

    let bundle = rig.user_bundle(&token, &target, None).await;
    assert_eq!(f(&bundle["pDirected"]), 1.0);
    assert_eq!(bundle["recordCount"], 2);
}

/// Restating the same pick is a further record, never a refusal — the
/// backend no longer knows what the bundle "already nets to".
#[sqlx::test(migrations = "../../migrations")]
async fn restating_the_same_pick_is_a_further_record(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let target = target_id.to_string();

    rig.land_stance(&token, &ak, &target, 0.3, 0.3).await;
    rig.land_stance(&token, &ak, &target, 0.3, 0.3).await;

    let bundle = rig.user_bundle(&token, &target, None).await;
    assert_eq!(bundle["recordCount"], 2);
    assert!((f(&bundle["pDirected"]) - 0.6).abs() < 1e-9);
}

/// A counter-pick walks the bundle back without erasing the history.
#[sqlx::test(migrations = "../../migrations")]
async fn a_counter_pick_walks_the_bundle_back(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let target = target_id.to_string();

    rig.land_stance(&token, &ak, &target, 0.5, 0.5).await;
    rig.land_stance(&token, &ak, &target, -0.5, -0.5).await;

    let bundle = rig.user_bundle(&token, &target, None).await;
    assert_eq!(f(&bundle["pDirected"]), 0.0);
    assert_eq!(f(&bundle["pInterest"]), 0.0);
    assert_eq!(bundle["severed"], true, "the bundle nets to (0,0)");
    assert_eq!(bundle["recordCount"], 2, "both records still stand");
}

/// The `Dimension` scalar refuses out-of-range input at parse time, so
/// this never reaches the resolver: it is a transport fault, not a
/// userError.
#[sqlx::test(migrations = "../../migrations")]
async fn stance_parameters_outside_the_range_are_refused(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let refused = rig
        .gql_raw(
            Some(&token),
            PREPARE_STANCE,
            json!({ "input": {
                "target": target_id.to_string(), "pDirected": 1.5, "pInterest": 0.1
            }}),
        )
        .await;
    assert!(refused.get("errors").is_some(), "{refused}");
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_empty_bundle_reads_as_zero_and_costs_no_severance(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let bundle = rig.user_bundle(&token, &target_id.to_string(), None).await;
    assert_eq!(f(&bundle["pDirected"]), 0.0);
    assert_eq!(bundle["recordCount"], 0);
    assert_eq!(bundle["inert"], true);
    assert_eq!(bundle["severed"], true);
    assert_eq!(bundle["severanceCost"], 0);
    assert!(bundle["projected"].is_null(), "no pick, no projection");
}

/// The clip is the read rule, not the storage. A bundle carrying more
/// conviction than `±1` still has to serve that history: clients fold
/// the landing locally under the drag and price severance off the sum
/// (design.md §8.3), and neither is derivable from the clipped pair. The
/// bundle here sums to (2.4, 1.5), driving both axes past the clip.
#[sqlx::test(migrations = "../../migrations")]
async fn the_raw_sums_serve_what_the_fold_clips(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let target = target_id.to_string();

    for _ in 0..3 {
        rig.land_stance(&token, &ak, &target, 0.8, 0.5).await;
    }

    let bundle = rig.user_bundle(&token, &target, None).await;
    assert_eq!(f(&bundle["pDirected"]), 1.0, "the fold clips: {bundle}");
    assert_eq!(f(&bundle["pInterest"]), 1.0);
    assert!(
        (f(&bundle["rawPDirected"]) - 2.4).abs() < 1e-9,
        "the raw sum does not: {bundle}"
    );
    assert!((f(&bundle["rawPInterest"]) - 1.5).abs() < 1e-9);
    assert_eq!(bundle["recordCount"], 3);
}

/// Severance is priced off the sum: `⌈max(|Σ_d|, |Σ_i|)⌉`. Serving the
/// raw pair is what lets a cost surface state that number without
/// asking the backend to price a bundle it is already showing. Checked
/// inside the clip, past it, and past it on the negative side.
#[sqlx::test(migrations = "../../migrations")]
async fn severance_cost_agrees_with_the_served_raw_sums(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    for (handle, p_d, p_i, reps) in [("a", 0.4, 0.6, 1), ("b", 0.8, 0.5, 3), ("c", -0.9, -0.2, 3)] {
        let (id, _) = rig
            .seed_member(handle, &format!("{handle}@example.com"))
            .await;
        let target = id.to_string();
        for _ in 0..reps {
            rig.land_stance(&token, &ak, &target, p_d, p_i).await;
        }

        let bundle = rig.user_bundle(&token, &target, None).await;
        let raw_d = f(&bundle["rawPDirected"]);
        let raw_i = f(&bundle["rawPInterest"]);
        let expected = raw_d.abs().max(raw_i.abs()).ceil() as i64;
        assert_eq!(
            bundle["severanceCost"], expected,
            "⌈max(|{raw_d}|, |{raw_i}|)⌉ for {handle}: {bundle}"
        );
    }
}

/// The projection answers where a candidate stance would land the bundle,
/// and asking leaves current standing untouched.
#[sqlx::test(migrations = "../../migrations")]
async fn a_pick_projects_where_the_bundle_lands(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let target = target_id.to_string();

    rig.land_stance(&token, &ak, &target, 0.5, 0.5).await;

    let bundle = rig.user_bundle(&token, &target, Some((0.1, 0.1))).await;
    assert_eq!(f(&bundle["pDirected"]), 0.5);
    let projected = &bundle["projected"];
    assert!((f(&projected["pDirected"]) - 0.6).abs() < 1e-9);
    assert_eq!(projected["inert"], false);
    assert_eq!(projected["severed"], false);
}

/// One `(+1, +1)` edge plus a new `(-1, -1)` nets to zero, and the
/// control has to say so before the pick is committed (design.md §8.2).
#[sqlx::test(migrations = "../../migrations")]
async fn a_projection_can_name_severance_before_it_is_authored(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let target = target_id.to_string();

    rig.land_stance(&token, &ak, &target, 1.0, 1.0).await;

    let bundle = rig.user_bundle(&token, &target, Some((-1.0, -1.0))).await;
    assert_eq!(bundle["projected"]["severed"], true);
    assert_eq!(bundle["projected"]["inert"], true);
}

/// Connection returns to zero while valence stays live: the stance then
/// carries nothing, and the projection has to say so (edges.md §1).
#[sqlx::test(migrations = "../../migrations")]
async fn a_projection_flags_an_inert_axis(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let target = target_id.to_string();

    rig.land_stance(&token, &ak, &target, 0.4, 0.4).await;

    let bundle = rig.user_bundle(&token, &target, Some((0.1, -0.4))).await;
    assert_eq!(bundle["projected"]["inert"], true);
    assert_eq!(bundle["projected"]["severed"], false);
}

/// The fold never nets across authors (layer1-interface.md §11.3), so one
/// viewer's stance toward a target leaves another's bundle at zero.
#[sqlx::test(migrations = "../../migrations")]
async fn the_bundle_is_per_viewer(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    rig.seed_member("other", "other@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let other = rig.log_in("other@example.com").await;
    let target = target_id.to_string();

    rig.land_stance(&token, &ak, &target, 0.8, 0.8).await;

    let theirs = rig.user_bundle(&other, &target, None).await;
    assert_eq!(f(&theirs["pDirected"]), 0.0);
    assert_eq!(theirs["recordCount"], 0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_guest_reads_no_bundle(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;

    let data = rig
        .gql(
            None,
            r#"query($id: UUID!) { user(id: $id) { viewerStance { pDirected } } }"#,
            json!({ "id": target_id.to_string() }),
        )
        .await;
    assert!(data["user"]["viewerStance"].is_null());
}

/// The L1 view and the L2 view are the reader's choice: a stance still in
/// flight counts in the pending-inclusive read and not in the landed one.
/// The write stops at the pre-commitment, where the record is authored
/// but not landed.
#[sqlx::test(migrations = "../../migrations")]
async fn the_pending_view_counts_what_is_still_in_flight(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post").await;

    let prepared = rig.prepare_stance(&token, &post, 0.6, 0.6).await;
    rig.pre_sign(&token, &ak, &prepared["prepareStance"]["writes"])
        .await;

    let l2 = rig.post_bundle(&token, &post, true).await;
    assert_eq!(f(&l2["pDirected"]), 0.6, "the L2 view counts it");
    assert_eq!(l2["recordCount"], 1);

    let l1 = rig.post_bundle(&token, &post, false).await;
    assert_eq!(f(&l1["pDirected"]), 0.0, "the L1 view does not");
    assert_eq!(l1["recordCount"], 0);
}

/// A landed record is counted once, not twice — the staged row stays
/// behind in `landed` state and must not be added to the mirror's sum.
#[sqlx::test(migrations = "../../migrations")]
async fn a_landed_stance_is_not_double_counted(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post").await;

    rig.land_stance(&token, &ak, &post, 0.4, 0.4).await;

    let bundle = rig.post_bundle(&token, &post, true).await;
    assert_eq!(f(&bundle["pDirected"]), 0.4);
    assert_eq!(bundle["recordCount"], 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn severance_nets_a_short_bundle_in_one_record(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let target = target_id.to_string();

    rig.land_stance(&token, &ak, &target, 0.5, 0.5).await;

    let severed = rig.prepare_severance(&token, &target).await;
    let writes = severed["prepareSeverance"]["writes"]
        .as_array()
        .expect("writes");
    assert_eq!(writes.len(), 1, "one counter-record suffices: {severed}");
    rig.land(&token, &ak, &severed["prepareSeverance"]["writes"])
        .await;

    let bundle = rig.user_bundle(&token, &target, None).await;
    assert_eq!(f(&bundle["pDirected"]), 0.0);
    assert_eq!(f(&bundle["pInterest"]), 0.0);
    assert_eq!(bundle["severed"], true);
}

/// A bundle carrying more conviction than one record can walk back needs
/// several, each its own priced act (feed-ranking.md §8.1). The valence
/// sum here is 2.4, past what a single record can cancel.
#[sqlx::test(migrations = "../../migrations")]
async fn severance_of_a_long_bundle_stages_a_batch(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let target = target_id.to_string();

    for _ in 0..3 {
        rig.land_stance(&token, &ak, &target, 0.8, 0.5).await;
    }
    let before = rig.user_bundle(&token, &target, None).await;
    assert_eq!(before["severanceCost"], 3, "⌈2.4⌉ counter-records");

    let severed = rig.prepare_severance(&token, &target).await;
    let writes = severed["prepareSeverance"]["writes"]
        .as_array()
        .expect("writes");
    assert_eq!(
        writes.len(),
        3,
        "the batch is the gesture's cost: {severed}"
    );

    rig.land(&token, &ak, &severed["prepareSeverance"]["writes"])
        .await;
    let bundle = rig.user_bundle(&token, &target, None).await;
    assert_eq!(f(&bundle["pDirected"]), 0.0, "netted exactly");
    assert_eq!(f(&bundle["pInterest"]), 0.0);
    assert_eq!(bundle["severed"], true);
    assert_eq!(bundle["recordCount"], 6, "nothing was erased");
}

#[sqlx::test(migrations = "../../migrations")]
async fn severing_an_already_netted_bundle_is_refused(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let (target_id, _) = rig.seed_member("target", "target@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let refused = rig.prepare_severance(&token, &target_id.to_string()).await;
    assert_eq!(
        refused["prepareSeverance"]["userErrors"][0]["code"], "BAD_INPUT",
        "{refused}"
    );
    assert!(refused["prepareSeverance"]["writes"].is_null());
}

#[sqlx::test(migrations = "../../migrations")]
async fn severance_toward_an_unknown_target_is_refused(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let refused = rig
        .prepare_severance(&token, &Uuid::new_v4().to_string())
        .await;
    assert_eq!(
        refused["prepareSeverance"]["userErrors"][0]["field"],
        json!(["target"]),
        "{refused}"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn severance_works_toward_content_too(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post").await;

    rig.land_stance(&token, &ak, &post, 0.9, 0.9).await;
    let severed = rig.prepare_severance(&token, &post).await;
    rig.land(&token, &ak, &severed["prepareSeverance"]["writes"])
        .await;

    let bundle = rig.post_bundle(&token, &post, true).await;
    assert_eq!(f(&bundle["pDirected"]), 0.0);
    assert_eq!(bundle["severed"], true);
}

/// Severance computes against the pending-inclusive view, so a sever
/// issued while a stance is still in flight covers it too: the sum
/// reaches 1.4 on both axes, so the batch is ⌈1.4⌉ = 2 counter-records.
#[sqlx::test(migrations = "../../migrations")]
async fn severance_counts_a_stance_still_in_flight(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, ak) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post = rig.landed_post(&token, &ak, "A post").await;

    rig.land_stance(&token, &ak, &post, 0.5, 0.5).await;
    let inflight = rig.prepare_stance(&token, &post, 0.9, 0.9).await;
    rig.pre_sign(&token, &ak, &inflight["prepareStance"]["writes"])
        .await;

    let severed = rig.prepare_severance(&token, &post).await;
    assert_eq!(
        severed["prepareSeverance"]["writes"]
            .as_array()
            .expect("writes")
            .len(),
        2,
        "the in-flight record is part of what severance must cancel: {severed}"
    );
}
