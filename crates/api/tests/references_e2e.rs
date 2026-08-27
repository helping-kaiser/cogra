//! Citations, end to end through the real HTTP surface (roadmap.md slice
//! 2.4): the Reference hyper-edge riding a creation batch, the whole-batch
//! solvency pre-check that either stages all of it or none of it, the
//! standalone citation and its withdrawal, and the reference row as the
//! read surface serves it — including the mention that must type as a
//! person for the render to reach a profile.

use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::client::ActorKey;
use common::l1::wire;
use http_body_util::BodyExt;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::PgPool;
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

mod rig;
use rig::TestMailer;

const GC: i64 = 8;

/// The stand-in's act price in micro-units. The solvency tests fund an
/// author in multiples of it, so they state what they mean — "enough for
/// two acts, not three" — instead of a magic number.
const THETA_MICRO: i64 = StandInConfig::DEFAULT_THETA_MICRO;

struct Citer {
    app: axum::Router,
    pool: PgPool,
    standin: StandIn,
}

struct SignedWrite {
    id: String,
    pre: common::l1::handshake::PreSignedProposal,
    act: common::l1::handshake::VerifiedAct,
}

impl Citer {
    async fn new(pool: PgPool) -> Self {
        let mailer = Arc::new(TestMailer::default());
        let (app, standin) = rig::connect_info_app_with_standin(
            pool.clone(),
            mailer,
            api::ratelimit::RateLimitConfig::unlimited(),
        );
        Self { app, pool, standin }
    }

    async fn gql(&self, token: Option<&str>, query: &str, variables: Value) -> Value {
        let json = self.gql_raw(token, query, variables).await;
        assert!(
            json.get("errors").is_none(),
            "unexpected transport errors: {json}"
        );
        json["data"].clone()
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

    /// A member with a chosen θ endowment, in whole acts.
    async fn member_funded_for(&self, handle: &str, email: &str, acts: i64) -> (Uuid, ActorKey) {
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
            .credit_burn(&key.address(), acts * THETA_MICRO)
            .await
            .expect("burn");
        (id, key)
    }

    async fn member(&self, handle: &str, email: &str) -> (Uuid, ActorKey) {
        self.member_funded_for(handle, email, 200).await
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

    async fn pre_sign(&self, token: &str, key: &ActorKey, writes: &Value) -> Vec<SignedWrite> {
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
            signed.push(SignedWrite { id, pre, act });
        }
        signed
    }

    async fn approve(&self, token: &str, key: &ActorKey, signed: &[SignedWrite]) {
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

    async fn land(&self, token: &str, key: &ActorKey, writes: &Value) {
        let signed = self.pre_sign(token, key, writes).await;
        self.approve(token, key, &signed).await;
        self.close_and_ingest().await;
    }

    async fn prepare_post_citing(&self, token: &str, title: &str, references: Value) -> Value {
        self.gql(
            Some(token),
            PREPARE_POST,
            json!({ "input": {
                "title": title,
                "content": "a body",
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "references": references,
            }}),
        )
        .await
    }

    /// A post carrying citations, driven all the way to landed.
    async fn landed_post_citing(
        &self,
        token: &str,
        key: &ActorKey,
        title: &str,
        references: Value,
    ) -> String {
        let prepared = self.prepare_post_citing(token, title, references).await;
        assert_eq!(
            refusals(&prepared, "preparePost"),
            Vec::<Value>::new(),
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

    async fn plain_post(&self, token: &str, key: &ActorKey, title: &str) -> String {
        self.landed_post_citing(token, key, title, json!([])).await
    }

    async fn cite_from(&self, token: &str, artifact: &str, target: &str, extra: Value) -> Value {
        let mut input = json!({ "artifact": artifact, "target": target });
        if let Some(fields) = extra.as_object() {
            let object = input.as_object_mut().expect("input object");
            for (k, v) in fields {
                object.insert(k.clone(), v.clone());
            }
        }
        self.gql(Some(token), PREPARE_REFERENCE, json!({ "input": input }))
            .await
    }

    /// One standalone citation, landed.
    async fn land_citation(
        &self,
        token: &str,
        key: &ActorKey,
        artifact: &str,
        target: &str,
        extra: Value,
    ) {
        let prepared = self.cite_from(token, artifact, target, extra).await;
        assert_eq!(
            refusals(&prepared, "prepareReference"),
            Vec::<Value>::new(),
            "citation refused: {prepared}"
        );
        self.land(token, key, &prepared["prepareReference"]["writes"])
            .await;
    }

    async fn references_of_post(&self, token: Option<&str>, post: &str) -> Value {
        let data = self
            .gql(token, POST_REFERENCES, json!({ "id": post }))
            .await;
        data["post"]["references"].clone()
    }

    /// How many staged writes this author has in flight — the assertion
    /// behind "a refused batch leaves nothing behind".
    async fn writes_in_flight(&self, actor: Uuid) -> i64 {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM staged_writes WHERE actor_id = $1")
            .bind(actor)
            .fetch_one(&self.pool)
            .await
            .expect("counts")
    }
}

fn refusals(payload: &Value, mutation: &str) -> Vec<Value> {
    payload[mutation]["userErrors"]
        .as_array()
        .expect("userErrors array")
        .clone()
}

fn families(payload: &Value, mutation: &str) -> Vec<String> {
    payload[mutation]["writes"]
        .as_array()
        .expect("writes array")
        .iter()
        .map(|w| w["family"].as_str().expect("family").to_string())
        .collect()
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

const PREPARE_REFERENCE: &str = r#"mutation($input: PrepareReferenceInput!) {
  prepareReference(input: $input) {
    writes { id family canonicalProposal } userErrors { code message field }
  }
}"#;

const WITHDRAW_REFERENCE: &str = r#"mutation($input: PrepareReferenceWithdrawalInput!) {
  prepareReferenceWithdrawal(input: $input) {
    writes { id family canonicalProposal } userErrors { code message field }
  }
}"#;

/// The reference row as a client renders it: enough of each target to
/// draw a chip, plus the raw identifier that is always there.
const POST_REFERENCES: &str = r#"query($id: UUID!) {
  post(id: $id) {
    references {
      targetId relevance support pending
      target {
        __typename
        ... on Post { id title { value } }
        ... on Comment { id }
        ... on User { id handle }
      }
    }
  }
}"#;

/// One priced act per citation, on top of the minting record — and the
/// citations come after the mint in relay order, because each declares it
/// as a dependency.
#[sqlx::test(migrations = "../../migrations")]
async fn a_post_stages_one_act_per_declared_citation(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let (bob, _) = rig.member("bob", "bob@example.test").await;
    let cited = rig.plain_post(&token, &key, "cited").await;

    let prepared = rig
        .prepare_post_citing(
            &token,
            "citing",
            json!([{ "target": cited }, { "target": bob }]),
        )
        .await;

    assert_eq!(refusals(&prepared, "preparePost"), Vec::<Value>::new());
    assert_eq!(
        families(&prepared, "preparePost"),
        vec!["PUBLISH", "REFERENCE", "REFERENCE"],
        "the minting record leads; each citation is its own priced act"
    );
}

/// A Comment is a citing artifact like any other passive node, so the
/// same batch rides a reply.
#[sqlx::test(migrations = "../../migrations")]
async fn a_comment_stages_its_citations_too(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let parent = rig.plain_post(&token, &key, "parent").await;
    let cited = rig.plain_post(&token, &key, "cited").await;

    let prepared = rig
        .gql(
            Some(&token),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": parent,
                "content": "a reply that cites",
                "license": { "attribution": 0.0, "provenance": 0.0 },
                "references": [{ "target": cited }],
            }}),
        )
        .await;

    assert_eq!(refusals(&prepared, "prepareComment"), Vec::<Value>::new());
    assert_eq!(
        families(&prepared, "prepareComment"),
        vec!["REVIEW", "REFERENCE"],
    );
}

/// Tags and citations batch together, and the whole thing is one gesture
/// to the author: 1 + 2 + 2 = 5 priced acts through one prepare.
#[sqlx::test(migrations = "../../migrations")]
async fn tags_and_citations_batch_into_one_gesture(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let (bob, _) = rig.member("bob", "bob@example.test").await;
    let cited = rig.plain_post(&token, &key, "cited").await;

    let prepared = rig
        .gql(
            Some(&token),
            PREPARE_POST,
            json!({ "input": {
                "title": "both",
                "content": "a body",
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "tags": [{ "name": "rust" }, { "name": "graphs" }],
                "references": [{ "target": cited }, { "target": bob }],
            }}),
        )
        .await;

    assert_eq!(refusals(&prepared, "preparePost"), Vec::<Value>::new());
    assert_eq!(
        families(&prepared, "preparePost"),
        vec!["PUBLISH", "TAG", "TAG", "REFERENCE", "REFERENCE"],
    );
}

/// A malformed batch must not leave half its acts in flight: the citation
/// check runs before the minting record is staged, so a refusal leaves
/// the author with nothing at all — not a post whose citations went
/// missing.
#[sqlx::test(migrations = "../../migrations")]
async fn a_batch_refused_for_one_citation_stages_none_of_itself(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (alice, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let cited = rig.plain_post(&token, &key, "cited").await;
    let before = rig.writes_in_flight(alice).await;

    let prepared = rig
        .prepare_post_citing(
            &token,
            "doomed",
            json!([{ "target": cited }, { "target": Uuid::new_v4() }]),
        )
        .await;

    let errors = refusals(&prepared, "preparePost");
    assert_eq!(errors.len(), 1, "{prepared}");
    assert_eq!(errors[0]["code"], "BAD_INPUT");
    assert_eq!(
        errors[0]["field"],
        json!(["references", "1", "target"]),
        "the refusal names the offending entry"
    );
    assert!(prepared["preparePost"]["writes"].is_null());
    assert_eq!(
        rig.writes_in_flight(alice).await,
        before,
        "not even the minting record was staged"
    );
}

/// The ten-citation cap is a batch fault, reported against the whole
/// field rather than against whichever entry sits at the limit.
#[sqlx::test(migrations = "../../migrations")]
async fn the_citation_cap_refuses_the_batch_as_a_batch(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (alice, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let mut targets = Vec::new();
    for i in 0..11 {
        targets.push(json!({ "target": rig.plain_post(&token, &key, &format!("t{i}")).await }));
    }
    let before = rig.writes_in_flight(alice).await;

    let prepared = rig
        .prepare_post_citing(&token, "too many", json!(targets))
        .await;

    let errors = refusals(&prepared, "preparePost");
    assert_eq!(errors[0]["field"], json!(["references"]), "{prepared}");
    assert_eq!(rig.writes_in_flight(alice).await, before);
}

/// Either the balance carries the whole gesture or none of it is staged.
/// Without this the author reads one gesture and gets an arbitrary prefix
/// of it — a post whose citations silently went missing.
///
/// Bob is funded for exactly two acts, which is what makes the pair of
/// attempts a clean split: a post with one citation is two acts and goes
/// through, a post with two is three and is refused entire.
#[sqlx::test(migrations = "../../migrations")]
async fn a_balance_that_cannot_carry_the_batch_refuses_all_of_it(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, alice_key) = rig.member("alice", "alice@example.test").await;
    let alice_token = rig.log_in("alice@example.test").await;
    let one = rig.plain_post(&alice_token, &alice_key, "one").await;
    let two = rig.plain_post(&alice_token, &alice_key, "two").await;

    let (bob, _) = rig.member_funded_for("bob", "bob@example.test", 2).await;
    let bob_token = rig.log_in("bob@example.test").await;

    let refused = rig
        .prepare_post_citing(
            &bob_token,
            "three acts",
            json!([{ "target": one }, { "target": two }]),
        )
        .await;
    let errors = refusals(&refused, "preparePost");
    assert_eq!(errors.len(), 1, "{refused}");
    assert_eq!(errors[0]["code"], "WRITE_RULE_FAILED");
    assert!(
        errors[0]["message"]
            .as_str()
            .expect("message")
            .contains("3 acts"),
        "the refusal quotes the batch it priced: {}",
        errors[0]["message"]
    );
    assert_eq!(
        rig.writes_in_flight(bob).await,
        0,
        "a batch refused for solvency stages nothing"
    );

    let accepted = rig
        .prepare_post_citing(&bob_token, "two acts", json!([{ "target": one }]))
        .await;
    assert_eq!(
        refusals(&accepted, "preparePost"),
        Vec::<Value>::new(),
        "what the balance does carry still goes through: {accepted}"
    );
}

/// Citing after publishing is what post.md §3 promises with "or later",
/// and the parameters default so a plain citation needs only its target.
#[sqlx::test(migrations = "../../migrations")]
async fn a_standalone_citation_defaults_both_parameters(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let carrier = rig.plain_post(&token, &key, "carrier").await;
    let cited = rig.plain_post(&token, &key, "cited").await;

    rig.land_citation(&token, &key, &carrier, &cited, json!({}))
        .await;

    let row = &rig.references_of_post(Some(&token), &carrier).await[0];
    assert_eq!(row["relevance"], json!(0.1), "the declared default");
    assert_eq!(row["support"], json!(0.1));
}

/// Withdrawal nets rather than declares, so its cost is the batch length —
/// and quoting that count is why the batch is assembled server-side
/// instead of letting a client author one negating record that would
/// silently under-net.
#[sqlx::test(migrations = "../../migrations")]
async fn withdrawing_a_citation_quotes_its_counter_record_count(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let carrier = rig.plain_post(&token, &key, "carrier").await;
    let cited = rig.plain_post(&token, &key, "cited").await;

    for _ in 0..3 {
        rig.land_citation(
            &token,
            &key,
            &carrier,
            &cited,
            json!({ "relevance": 0.8, "support": 0.4 }),
        )
        .await;
    }

    let withdrawal = rig
        .gql(
            Some(&token),
            WITHDRAW_REFERENCE,
            json!({ "input": { "artifact": carrier, "target": cited }}),
        )
        .await;
    assert_eq!(
        refusals(&withdrawal, "prepareReferenceWithdrawal"),
        Vec::<Value>::new()
    );
    assert_eq!(
        families(&withdrawal, "prepareReferenceWithdrawal"),
        vec!["REFERENCE", "REFERENCE", "REFERENCE"],
        "⌈max(2.4, 1.2)⌉ counter-records, each its own priced act"
    );

    rig.land(
        &token,
        &key,
        &withdrawal["prepareReferenceWithdrawal"]["writes"],
    )
    .await;
    assert_eq!(
        rig.references_of_post(Some(&token), &carrier).await,
        json!([]),
        "a netted bundle leaves the reference row"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn citing_an_artifact_that_is_not_there_names_the_artifact_field(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let cited = rig.plain_post(&token, &key, "cited").await;

    let refused = rig
        .cite_from(&token, &Uuid::new_v4().to_string(), &cited, json!({}))
        .await;
    let errors = refusals(&refused, "prepareReference");
    assert_eq!(errors[0]["field"], json!(["artifact"]), "{refused}");
}

/// Both citation parameters span exactly the `Dimension` range, so an
/// out-of-range value is refused by the scalar before any resolver sees
/// it — and nothing is staged. This is the same reason `TagInput` range-
/// checks only its confidence, which is narrower than its scalar.
#[sqlx::test(migrations = "../../migrations")]
async fn a_parameter_outside_the_census_range_never_reaches_the_write_path(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (alice, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let carrier = rig.plain_post(&token, &key, "carrier").await;
    let cited = rig.plain_post(&token, &key, "cited").await;
    let before = rig.writes_in_flight(alice).await;

    let refused = rig
        .gql_raw(
            Some(&token),
            PREPARE_REFERENCE,
            json!({ "input": {
                "artifact": carrier, "target": cited, "support": -1.5,
            }}),
        )
        .await;

    let message = refused["errors"][0]["message"]
        .as_str()
        .unwrap_or_else(|| panic!("expected a scalar refusal: {refused}"));
    assert!(message.contains("Dimension"), "{message}");
    assert_eq!(rig.writes_in_flight(alice).await, before);
}

/// The orientation trap, asserted through the whole stack: a citation
/// authored at (relevance, support) must read back at exactly that pair,
/// which it can only do if the gesture writes the act tuple and the fold
/// un-transposes the T-leg.
#[sqlx::test(migrations = "../../migrations")]
async fn the_reference_row_serves_relevance_and_support_the_right_way_round(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let cited = rig.plain_post(&token, &key, "cited").await;
    let carrier = rig
        .landed_post_citing(
            &token,
            &key,
            "carrier",
            json!([{ "target": cited, "relevance": -0.75, "support": 0.25 }]),
        )
        .await;

    let rows = rig.references_of_post(Some(&token), &carrier).await;
    assert_eq!(rows.as_array().expect("rows").len(), 1);
    assert_eq!(rows[0]["relevance"], json!(-0.75));
    assert_eq!(rows[0]["support"], json!(0.25));
    assert_eq!(rows[0]["target"]["__typename"], "Post");
    assert_eq!(rows[0]["target"]["title"]["value"], "cited");
}

/// The orientation, checked from the side the resolver never touches.
///
/// `the_reference_row_serves_relevance_and_support_the_right_way_round`
/// writes through the gesture builder and reads through the fold, so a
/// transposition present in *both* halves cancels and the assertion still
/// passes. This one writes through the API and reads the mirror raw,
/// asserting each of the three renderings the census fixes separately:
/// the staged act tuple and the A-leg carry `(relevance, support)`
/// verbatim, and the T-leg carries them transposed. A single-sided error
/// moves exactly one of the three.
#[sqlx::test(migrations = "../../migrations")]
async fn the_stored_legs_carry_the_census_orientation(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let cited = rig.plain_post(&token, &key, "cited").await;
    let carrier = rig.plain_post(&token, &key, "carrier").await;

    let prepared = rig
        .cite_from(
            &token,
            &carrier,
            &cited,
            json!({ "relevance": -0.75, "support": 0.25 }),
        )
        .await;

    let staged: (f64, f64) = sqlx::query_as(
        "SELECT p_d, p_i FROM staged_writes WHERE family = 'reference'",
    )
    .fetch_one(&rig.pool)
    .await
    .expect("staged write");
    assert_eq!(
        staged,
        (-0.75, 0.25),
        "the staged act tuple is (relevance, support), never a leg rendering"
    );

    rig.land(&token, &key, &prepared["prepareReference"]["writes"])
        .await;

    let legs: Vec<(String, f64, f64)> = sqlx::query_as(
        "SELECT leg, p_d, p_i FROM mirror_record_legs
         WHERE family = 'reference' ORDER BY leg",
    )
    .fetch_all(&rig.pool)
    .await
    .expect("legs");
    assert_eq!(
        legs,
        vec![
            ("a".to_string(), -0.75, 0.25),
            ("t".to_string(), 0.25, -0.75),
        ],
        "the A-leg renders the act tuple verbatim and the T-leg transposes \
         it (layer1-interface.md §9.6)"
    );
}

/// The hand test's second half: a mention must type as a person, or the
/// render has nothing to send the reader to.
#[sqlx::test(migrations = "../../migrations")]
async fn a_mention_types_as_the_person_it_names(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let (bob, _) = rig.member("bob", "bob@example.test").await;
    let carrier = rig
        .landed_post_citing(&token, &key, "carrier", json!([{ "target": bob }]))
        .await;

    let rows = rig.references_of_post(Some(&token), &carrier).await;
    assert_eq!(rows[0]["target"]["__typename"], "User");
    assert_eq!(rows[0]["target"]["handle"], "bob");
    assert_eq!(rows[0]["target"]["id"], json!(bob));
    assert!(
        rows[0]["relevance"].as_f64().expect("relevance") > 0.0
            && rows[0]["support"].as_f64().expect("support") > 0.0,
        "a default mention vouches weakly"
    );
}

/// A topic is tagged, never referenced (D21) — refused on every write
/// shape that names a target, and refused *before* anything is staged.
///
/// The topic is tagged onto a throwaway post first, because a Type's L2
/// id is what a client would cite it by and the registry row is what
/// makes that id resolvable at all. So this is the strongest form of the
/// refusal: a topic that plainly exists, named by the id the finder
/// itself would once have handed back.
#[sqlx::test(migrations = "../../migrations")]
async fn a_topic_is_refused_as_a_citation_target(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (alice, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;

    let tagged = rig
        .gql(
            Some(&token),
            PREPARE_POST,
            json!({ "input": {
                "title": "tagged",
                "content": "a body",
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "tags": [{ "name": "rust" }],
            }}),
        )
        .await;
    rig.land(&token, &key, &tagged["preparePost"]["writes"])
        .await;

    let topic = rig
        .gql(
            Some(&token),
            "query { hashtag(name: \"rust\") { id } }",
            json!({}),
        )
        .await["hashtag"]["id"]
        .as_str()
        .expect("topic id")
        .to_string();

    let in_flight_before = rig.writes_in_flight(alice).await;

    let batch = rig
        .prepare_post_citing(&token, "carrier", json!([{ "target": topic }]))
        .await;
    let refused = refusals(&batch, "preparePost");
    assert_eq!(refused.len(), 1, "creation batch refused: {batch}");
    assert_eq!(
        refused[0]["field"],
        json!(["references", "0", "target"]),
        "the refusal names the entry the client sent: {batch}"
    );
    assert_eq!(
        rig.writes_in_flight(alice).await,
        in_flight_before,
        "a refused batch stages nothing"
    );

    let carrier = rig.plain_post(&token, &key, "carrier").await;
    let standalone = rig.cite_from(&token, &carrier, &topic, json!({})).await;
    let refused = refusals(&standalone, "prepareReference");
    assert_eq!(refused.len(), 1, "standalone refused: {standalone}");
    assert_eq!(refused[0]["field"], json!(["target"]));

    let withdrawal = rig
        .gql(
            Some(&token),
            WITHDRAW_REFERENCE,
            json!({ "input": { "artifact": carrier, "target": topic }}),
        )
        .await;
    let refused = refusals(&withdrawal, "prepareReferenceWithdrawal");
    assert_eq!(refused.len(), 1, "withdrawal refused: {withdrawal}");
    assert_eq!(refused[0]["field"], json!(["target"]));
}

/// The mirror reaches further than CoGra's own target policy: L1's
/// incidence admits a Type-target Reference, so one authored where this
/// narrowing does not run can still land in the mirror. The read side
/// must degrade rather than fail — a null `target` beside a `targetId`
/// that still names the far end, exactly as an untypeable node does.
///
/// The gesture is staged straight at the boundary because the planning
/// layer is precisely what refuses it; nothing reachable through the
/// GraphQL write path can produce this record.
#[sqlx::test(migrations = "../../migrations")]
async fn a_topic_target_record_serves_a_null_target_beside_its_id(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (alice, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let carrier = rig.plain_post(&token, &key, "carrier").await;

    let carrier_id = Uuid::parse_str(&carrier).expect("carrier uuid");
    let middle = postgres_store::content::post(&rig.pool, carrier_id)
        .await
        .expect("post")
        .expect("row")
        .l1_node_id;
    let reference = api::references::PlannedReference {
        target_id: Uuid::nil(),
        target: common::l1::identifier::NodeId::name("rust").expect("node"),
        relevance: 0.5,
        support: 0.5,
    };
    let gesture = api::references::reference_gesture(
        &key.address(),
        common::l1::identifier::NodeId::parse(&middle).expect("node"),
        &reference,
        vec![],
    );
    let prepared = api::prepare::prepare(
        &api::l1::StandInBoundary(rig.standin.clone()),
        &rig.pool,
        GC,
        alice,
        gesture,
    )
    .await
    .expect("the substrate admits what CoGra declines to prepare");

    rig.land(
        &token,
        &key,
        &json!([{
            "id": prepared.id,
            "canonicalProposal": B64.encode(wire::encode_proposal(&prepared.proposal)),
        }]),
    )
    .await;

    let rows = rig.references_of_post(Some(&token), &carrier).await;
    assert_eq!(rows.as_array().expect("rows").len(), 1, "{rows}");
    assert_eq!(rows[0]["target"], json!(null), "{rows}");
    assert!(
        rows[0]["targetId"]
            .as_str()
            .expect("targetId")
            .starts_with("name:"),
        "the citation still names its far end: {rows}"
    );
}

/// Only the carrier author's own citations (D12). A stranger's citation
/// off someone else's post reaches a viewer through the citer, at a
/// forward-path weight the ranker computes — and the ranker is slice 3.
#[sqlx::test(migrations = "../../migrations")]
async fn a_strangers_citation_stays_off_the_carriers_row(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, alice_key) = rig.member("alice", "alice@example.test").await;
    let alice_token = rig.log_in("alice@example.test").await;
    let (_, mallory_key) = rig.member("mallory", "mallory@example.test").await;
    let mallory_token = rig.log_in("mallory@example.test").await;

    let cited = rig.plain_post(&alice_token, &alice_key, "cited").await;
    let carrier = rig
        .landed_post_citing(
            &alice_token,
            &alice_key,
            "carrier",
            json!([{ "target": cited }]),
        )
        .await;
    let elsewhere = rig
        .plain_post(&mallory_token, &mallory_key, "elsewhere")
        .await;

    rig.land_citation(
        &mallory_token,
        &mallory_key,
        &carrier,
        &elsewhere,
        json!({ "relevance": 1.0, "support": 1.0 }),
    )
    .await;

    let rows = rig.references_of_post(Some(&alice_token), &carrier).await;
    assert_eq!(
        rows.as_array().expect("rows").len(),
        1,
        "the stranger's citation is not on the row: {rows}"
    );
    assert_eq!(rows[0]["target"]["title"]["value"], "cited");
}

/// A staged citation is the viewer's own act in flight: visible to its
/// author from the pre-commitment onward, invisible to everyone else and
/// to the L1 view.
#[sqlx::test(migrations = "../../migrations")]
async fn a_pending_citation_shows_to_its_author_alone(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let (_, bystander_key) = rig.member("bystander", "bystander@example.test").await;
    let _ = &bystander_key;
    let bystander_token = rig.log_in("bystander@example.test").await;

    let carrier = rig.plain_post(&token, &key, "carrier").await;
    let cited = rig.plain_post(&token, &key, "cited").await;

    let prepared = rig.cite_from(&token, &carrier, &cited, json!({})).await;
    rig.pre_sign(&token, &key, &prepared["prepareReference"]["writes"])
        .await;

    let own = rig.references_of_post(Some(&token), &carrier).await;
    assert_eq!(own.as_array().expect("rows").len(), 1);
    assert_eq!(own[0]["pending"], json!(true));

    let others = rig
        .references_of_post(Some(&bystander_token), &carrier)
        .await;
    assert_eq!(
        others,
        json!([]),
        "an in-flight act belongs to whoever staged it"
    );

    let landed_view = rig
        .gql(
            Some(&token),
            r#"query($id: UUID!) {
                 post(id: $id) { references(includePending: false) { targetId } }
               }"#,
            json!({ "id": carrier }),
        )
        .await;
    assert_eq!(
        landed_view["post"]["references"],
        json!([]),
        "includePending: false serves only what has landed"
    );
}

/// Claim 84: before the Profile arm, a mention's terminal leg served null
/// on the chronicle and the record read as pointing at nothing.
#[sqlx::test(migrations = "../../migrations")]
async fn a_mentions_record_terminal_resolves_to_the_person(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;
    let (bob, _) = rig.member("bob", "bob@example.test").await;
    rig.landed_post_citing(&token, &key, "carrier", json!([{ "target": bob }]))
        .await;

    let data = rig
        .gql(
            Some(&token),
            r#"query {
                 records(family: REFERENCE, first: 10) {
                   edges { node {
                     terminalId
                     terminal { __typename ... on User { id handle } }
                   } }
                 }
               }"#,
            json!({}),
        )
        .await;
    let node = &data["records"]["edges"][0]["node"];
    assert_eq!(node["terminal"]["__typename"], "User", "{data}");
    assert_eq!(node["terminal"]["handle"], "bob");
    assert_eq!(node["terminal"]["id"], json!(bob));
    assert!(
        node["terminalId"]
            .as_str()
            .expect("terminalId")
            .starts_with("prof:"),
        "the raw identifier is the Profile's"
    );
}

/// The finder's candidate as the picker renders it: the same union the
/// reference row draws, plus the id a `ReferenceInput` will name.
const REFERENCE_CANDIDATES: &str = r#"query($query: String!, $limit: Int) {
  referenceCandidates(query: $query, limit: $limit) {
    targetId
    target {
      __typename
      ... on Post { id title { value } }
      ... on Comment { id }
      ... on User { id handle }
    }
  }
}"#;

/// A person is findable by the handle as typed — bare, `@`-sigilled, or
/// in whatever case and padding the field carries. `actor(handle:)` folds
/// case but rejects the sigil outright, so the finder strips it the way
/// `hashtag(name:)` strips its own `#`; a picker whose first keystroke is
/// `@` would otherwise never resolve.
#[sqlx::test(migrations = "../../migrations")]
async fn the_finder_offers_a_person_by_bare_or_sigilled_handle(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (alice, _) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;

    for typed in ["alice", "@alice", "  @Alice  "] {
        let found = rig
            .gql(
                Some(&token),
                REFERENCE_CANDIDATES,
                json!({ "query": typed }),
            )
            .await["referenceCandidates"]
            .clone();
        let candidates = found.as_array().expect("candidates");
        assert_eq!(candidates.len(), 1, "for {typed}: {found}");
        assert_eq!(found[0]["target"]["__typename"], "User", "for {typed}");
        assert_eq!(found[0]["target"]["handle"], "alice", "for {typed}");
        assert_eq!(found[0]["targetId"], json!(alice), "for {typed}");
    }
}

/// Every class the citation union carries is findable by its own L2 id,
/// and the id comes back unchanged — the picker hands the composer
/// exactly what `prepareReference` takes.
#[sqlx::test(migrations = "../../migrations")]
async fn the_finder_offers_each_target_class_by_its_id(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (alice, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;

    let post = rig.plain_post(&token, &key, "findable").await;
    let prepared = rig
        .gql(
            Some(&token),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": post,
                "content": "a reply",
                "license": { "attribution": 0.0, "provenance": 0.0 },
            }}),
        )
        .await;
    let comment = prepared["prepareComment"]["node"]
        .as_str()
        .expect("comment node")
        .to_string();
    rig.land(&token, &key, &prepared["prepareComment"]["writes"])
        .await;

    for (query, expected) in [
        (post.clone(), "Post"),
        (comment.clone(), "Comment"),
        (alice.to_string(), "User"),
    ] {
        let found = rig
            .gql(
                Some(&token),
                REFERENCE_CANDIDATES,
                json!({ "query": query }),
            )
            .await["referenceCandidates"]
            .clone();
        assert_eq!(
            found.as_array().expect("candidates").len(),
            1,
            "for {query}: {found}"
        );
        assert_eq!(found[0]["target"]["__typename"], expected, "for {query}");
        assert_eq!(found[0]["targetId"], json!(query), "for {query}");
    }
}

/// The finder may only offer what `prepareReference` accepts, so a topic
/// is unofferable however it is named (D21) — by its `#name` and by the
/// very L2 id the registry makes resolvable. A topic that plainly
/// exists is the case worth pinning: the miss test covers names nothing
/// answers to, and an absence that held only for unregistered topics
/// would be no narrowing at all.
#[sqlx::test(migrations = "../../migrations")]
async fn the_finder_never_offers_a_topic(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (_, key) = rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;

    let tagged = rig
        .gql(
            Some(&token),
            PREPARE_POST,
            json!({ "input": {
                "title": "tagged",
                "content": "a body",
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "tags": [{ "name": "rust" }],
            }}),
        )
        .await;
    rig.land(&token, &key, &tagged["preparePost"]["writes"])
        .await;

    let topic = rig
        .gql(
            Some(&token),
            "query { hashtag(name: \"rust\") { id } }",
            json!({}),
        )
        .await["hashtag"]["id"]
        .as_str()
        .expect("topic id")
        .to_string();

    for query in ["#rust", topic.as_str()] {
        let found = rig
            .gql(
                Some(&token),
                REFERENCE_CANDIDATES,
                json!({ "query": query }),
            )
            .await;
        assert_eq!(
            found["referenceCandidates"],
            json!([]),
            "a topic is not offerable, for {query}"
        );
    }
}

/// A finder runs on every keystroke, so most of what it is handed is a
/// prefix of something still being typed. None of it may be an error:
/// an empty list is the answer, whatever the shape of the miss.
#[sqlx::test(migrations = "../../migrations")]
async fn the_finder_answers_a_miss_with_an_empty_list_never_an_error(pool: PgPool) {
    let rig = Citer::new(pool).await;
    rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;

    let unknown = Uuid::new_v4().to_string();
    for typed in [
        "",
        "   ",
        "@",
        "nobody",
        "@nobody",
        "#",
        "#never-tagged",
        "not a handle at all!",
        "ab",
        unknown.as_str(),
    ] {
        let answer = rig
            .gql_raw(
                Some(&token),
                REFERENCE_CANDIDATES,
                json!({ "query": typed }),
            )
            .await;
        assert!(
            answer.get("errors").is_none(),
            "a miss must not error, for {typed:?}: {answer}"
        );
        assert_eq!(
            answer["data"]["referenceCandidates"],
            json!([]),
            "for {typed:?}"
        );
    }
}

/// `limit` carries the list contract the topic surfaces already use:
/// bounded by it, and over-asking refuses rather than silently clamping.
#[sqlx::test(migrations = "../../migrations")]
async fn the_finder_bounds_itself_by_the_list_limit(pool: PgPool) {
    let rig = Citer::new(pool).await;
    rig.member("alice", "alice@example.test").await;
    let token = rig.log_in("alice@example.test").await;

    let none = rig
        .gql(
            Some(&token),
            REFERENCE_CANDIDATES,
            json!({ "query": "alice", "limit": 0 }),
        )
        .await;
    assert_eq!(none["referenceCandidates"], json!([]));

    let one = rig
        .gql(
            Some(&token),
            REFERENCE_CANDIDATES,
            json!({ "query": "alice", "limit": 1 }),
        )
        .await;
    assert_eq!(
        one["referenceCandidates"].as_array().expect("list").len(),
        1
    );

    let refused = rig
        .gql_raw(
            Some(&token),
            REFERENCE_CANDIDATES,
            json!({ "query": "alice", "limit": 101 }),
        )
        .await;
    assert!(
        refused.get("errors").is_some(),
        "over-asking refuses: {refused}"
    );
}

/// Reads are public — the shared graph is (api-spec.md) — and the finder
/// adds no gate of its own: an anonymous picker resolves what an
/// authenticated one does, with the private fields still authorized on
/// the types themselves.
#[sqlx::test(migrations = "../../migrations")]
async fn the_finder_resolves_for_an_anonymous_viewer_too(pool: PgPool) {
    let rig = Citer::new(pool).await;
    let (alice, _) = rig.member("alice", "alice@example.test").await;

    let found = rig
        .gql(None, REFERENCE_CANDIDATES, json!({ "query": "alice" }))
        .await;
    assert_eq!(found["referenceCandidates"][0]["targetId"], json!(alice));
}
