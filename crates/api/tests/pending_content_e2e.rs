//! The pending-content canon, end to end through the real HTTP surface
//! (substrate.md §6; api-spec.md "The graph is a chronicle"): a prepared
//! record is its author's content from the moment they sign it, so it
//! reads to **every** viewer — anonymous included — marked pending and
//! ahead of the newest landed entry; it keeps its authoring date when it
//! lands; and it leaves every view if it expires unlanded. The handshake
//! behind it stays the author's own business throughout.

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

/// Far enough past every prepared epoch that one sweep collects the lot.
const FAR_FUTURE_EPOCH: i64 = 1_000;
const GC: i64 = 8;

struct Rig {
    app: axum::Router,
    pool: PgPool,
    standin: StandIn,
}

/// One write past its pre-commitment: the staged handle, the exact
/// signed proposal, and the act the host sealed over it.
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

    /// The pre-commitment leg alone — the anchor the canon names. The
    /// write stops mid-handshake, which is exactly the state pending
    /// content is read in. The signed parts come back so the same write
    /// can be driven on to landing later: the device's nonce is fresh per
    /// signature, so re-signing a sealed write is a replay mismatch.
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

    /// Submits one raw pre-commitment blob for a staged write — the leg
    /// the rig's `pre_sign` drives with a good signature, exposed so a
    /// test can drive it with a refused one.
    async fn submit_pre_commitment(&self, token: &str, staged_id: &str, blob: &[u8]) -> Value {
        self.gql(
            Some(token),
            "mutation($input: SubmitProposalsInput!) {
               submitProposals(input: $input) {
                 stagedWrites { id } userErrors { code message }
               }
             }",
            json!({ "input": { "proposals": [{
                "stagedWriteId": staged_id,
                "signature": B64.encode(blob),
            }]}}),
        )
        .await
    }

    /// Approval, epoch close and ingestion — the rest of the path, from
    /// already pre-signed writes, so the content lands.
    async fn approve_and_close(&self, token: &str, key: &ActorKey, signed: &[Signed]) {
        self.approve(token, key, signed).await;
        self.close_and_ingest().await;
    }

    /// The approval leg alone — the act becomes orderable, but nothing
    /// has landed until an epoch closes over it.
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

    /// Pre-commitment, approval, epoch close and ingestion — the whole
    /// path, so the content lands.
    async fn land(&self, token: &str, key: &ActorKey, writes: &Value) {
        let signed = self.pre_sign(token, key, writes).await;
        self.approve_and_close(token, key, &signed).await;
    }

    /// Prepares a post and stops at the pre-commitment: pending content.
    async fn pending_post(
        &self,
        token: &str,
        key: &ActorKey,
        title: &str,
        body: &str,
    ) -> (String, String) {
        let prepared = self.prepare_post(token, title, body).await;
        let node = prepared["preparePost"]["node"]
            .as_str()
            .expect("node")
            .to_string();
        let staged = self
            .pre_sign(token, key, &prepared["preparePost"]["writes"])
            .await;
        (node, staged[0].id.clone())
    }

    /// Prepares a post and drives it all the way to landed.
    async fn landed_post(&self, token: &str, key: &ActorKey, title: &str, body: &str) -> String {
        let prepared = self.prepare_post(token, title, body).await;
        let node = prepared["preparePost"]["node"]
            .as_str()
            .expect("node")
            .to_string();
        self.land(token, key, &prepared["preparePost"]["writes"])
            .await;
        node
    }

    async fn prepare_post(&self, token: &str, title: &str, body: &str) -> Value {
        let prepared = self
            .gql(
                Some(token),
                PREPARE_POST,
                json!({ "input": {
                    "title": title,
                    "content": body,
                    "license": { "attribution": 1.0, "provenance": 0.0 },
                }}),
            )
            .await;
        assert_eq!(
            prepared["preparePost"]["userErrors"]
                .as_array()
                .expect("array"),
            &Vec::<Value>::new(),
            "prepare refused: {prepared}"
        );
        prepared
    }

    /// One GC sweep past every prepared epoch — every unlanded write
    /// expires, and its pending content goes with it.
    async fn expire_everything(&self) {
        postgres_store::staged::expire_due(&self.pool, FAR_FUTURE_EPOCH, GC)
            .await
            .expect("expires");
    }

    async fn listed(&self, token: Option<&str>, args: &str) -> Vec<Value> {
        let listing = self
            .gql(
                token,
                &format!(
                    r#"{{ posts({args}) {{ edges {{ cursor node {{
                         id title {{ value }} content {{ value }}
                         author {{ handle }} createdAt
                         landing {{ state epoch }}
                       }} }} }} }}"#
                ),
                json!({}),
            )
            .await;
        listing["posts"]["edges"].as_array().expect("edges").clone()
    }

    /// The profile chronicle: one author's records, newest-first. The
    /// connection takes no `includePending` — the record set has no
    /// pending namespace to opt out of.
    async fn chronicle(&self, author: &Uuid) -> Vec<Value> {
        let listing = self
            .gql(None, CHRONICLE, json!({ "a": author.to_string() }))
            .await;
        listing["records"]["edges"]
            .as_array()
            .expect("edges")
            .clone()
    }

    /// Every record on one node — the same chronicle, filtered to a
    /// target.
    async fn records_on(&self, target: &str) -> Vec<Value> {
        let listing = self
            .gql(
                None,
                r#"query($t: UUID!) {
                     records(target: $t, first: 10) { edges { node { id } } }
                   }"#,
                json!({ "t": target }),
            )
            .await;
        listing["records"]["edges"]
            .as_array()
            .expect("edges")
            .clone()
    }
}

const CHRONICLE: &str = r#"query($a: UUID!) {
  records(author: $a, first: 10) {
    edges { node {
      id family landingEpoch
      target { id landing { state epoch } ... on Post { title { value } } }
    } }
  }
}"#;

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

/// Anonymously — no session at all — the listing serves pending content
/// whole, marked pending and with no epoch, because a pending write has
/// no causal key. The typed reads agree. The chronicle holds only ordered
/// fact, so for a node whose record has not landed it is well-formed and
/// empty: not an actor match, and not an error.
///
/// Pending content serves whole to every viewer, marked pending and without an epoch, while the chronicle stays well-formed and empty for it.
/// ´claim:pending:pending-content-reads-to-everyone´
#[sqlx::test(migrations = "../../migrations")]
async fn pending_content_reads_in_full_to_every_viewer(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let (post_id, _) = rig
        .pending_post(&token, &key, "Still settling", "Signed, not yet ordered.")
        .await;

    let edges = rig.listed(None, "first: 10").await;
    assert_eq!(edges.len(), 1, "the pending post is in the listing");
    let node = &edges[0]["node"];
    assert_eq!(node["id"], post_id);
    assert_eq!(node["title"]["value"], "Still settling");
    assert_eq!(node["content"]["value"], "Signed, not yet ordered.");
    assert_eq!(node["author"]["handle"], "author");
    assert_eq!(node["landing"]["state"], "PENDING");
    assert!(
        node["landing"]["epoch"].is_null(),
        "a pending node has no epoch: {node}"
    );

    let single = rig
        .gql(
            None,
            r#"query($id: UUID!) {
                 post(id: $id) { id landing { state epoch } }
                 node(id: $id) { __typename id landing { state } }
               }"#,
            json!({ "id": post_id }),
        )
        .await;
    assert_eq!(single["post"]["landing"]["state"], "PENDING");
    assert_eq!(single["node"]["__typename"], "Post");
    assert_eq!(single["node"]["landing"]["state"], "PENDING");

    let records = rig
        .gql(
            None,
            r#"query($t: UUID!) { records(target: $t, first: 10) { edges { node { id } } } }"#,
            json!({ "t": post_id }),
        )
        .await;
    assert_eq!(
        records["records"]["edges"].as_array().expect("edges").len(),
        0
    );
}

/// The content is public; the handshake handle is not. Nothing on the
/// content surface carries the staged-write id.
///
/// The content is public and the handshake behind it is not, so nothing on the content surface carries the staged-write handle.
/// ´claim:pending:the-handshake-never-reaches-the-content-surface´
#[sqlx::test(migrations = "../../migrations")]
async fn the_handshake_stays_the_authors_own_business(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    rig.seed_member("stranger", "stranger@example.com").await;
    let stranger = rig.log_in("stranger@example.com").await;
    let (_, staged_id) = rig
        .pending_post(&token, &key, "Public content", "Private ceremony.")
        .await;

    const STAGED: &str = r#"query($id: UUID!) { stagedWrite(id: $id) { id state } }"#;

    let anonymous = rig.gql(None, STAGED, json!({ "id": staged_id })).await;
    assert!(anonymous["stagedWrite"].is_null());
    let other = rig
        .gql(Some(&stranger), STAGED, json!({ "id": staged_id }))
        .await;
    assert!(other["stagedWrite"].is_null());
    let own = rig
        .gql(Some(&token), STAGED, json!({ "id": staged_id }))
        .await;
    assert_eq!(own["stagedWrite"]["id"], staged_id);

    let leak = rig
        .gql_raw(
            None,
            r#"{ posts(first: 1) { edges { node { stagedWriteId } } } }"#,
            json!({}),
        )
        .await;
    assert!(
        leak["errors"][0]["message"]
            .as_str()
            .expect("message")
            .contains("stagedWriteId"),
        "a Post must not expose the staged-write handle: {leak}"
    );
}

/// Landing clears the pending mark and leaves the authoring date where it was.
/// ´claim:pending:landing-clears-the-mark-and-keeps-the-date´
#[sqlx::test(migrations = "../../migrations")]
async fn landing_drops_the_mark_without_moving_the_authoring_date(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let prepared = rig.prepare_post(&token, "Dated at authoring", "body").await;
    let post_id = prepared["preparePost"]["node"].as_str().expect("node");
    let signed = rig
        .pre_sign(&token, &key, &prepared["preparePost"]["writes"])
        .await;

    let pending = rig.listed(None, "first: 10").await;
    let created_at = pending[0]["node"]["createdAt"].clone();
    assert_eq!(pending[0]["node"]["landing"]["state"], "PENDING");

    rig.approve_and_close(&token, &key, &signed).await;

    let landed = rig.listed(None, "first: 10").await;
    assert_eq!(landed.len(), 1, "landing does not duplicate the entry");
    let node = &landed[0]["node"];
    assert_eq!(node["id"], post_id);
    assert_eq!(node["landing"]["state"], "LANDED");
    assert!(
        node["landing"]["epoch"].is_i64(),
        "a landed node carries the graph's clock: {node}"
    );
    assert_eq!(
        node["createdAt"], created_at,
        "the epoch dates the content, it never redates it"
    );
}

/// Expiry takes the content out of every view unmarked, because on the
/// graph nothing ever existed to redact. The author's own staged row
/// stays observable in its terminal state until the reap — that surface
/// is the handshake, not the content.
///
/// Expiry takes content out of every view unmarked, nothing having existed on the graph to redact, while the author's own staged row stays observable until the reap.
/// ´claim:pending:expiry-leaves-no-mark-on-the-graph´
#[sqlx::test(migrations = "../../migrations")]
async fn expired_pending_content_leaves_every_view(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let landed = rig.landed_post(&token, &key, "Survivor", "landed").await;
    let (doomed, staged_id) = rig
        .pending_post(&token, &key, "Never lands", "gone shortly")
        .await;

    assert_eq!(rig.listed(None, "first: 10").await.len(), 2);

    rig.expire_everything().await;

    let edges = rig.listed(None, "first: 10").await;
    assert_eq!(edges.len(), 1, "only the landed post remains: {edges:?}");
    assert_eq!(edges[0]["node"]["id"], landed);

    let gone = rig
        .gql(
            None,
            r#"query($id: UUID!) { post(id: $id) { id } node(id: $id) { id } }"#,
            json!({ "id": doomed }),
        )
        .await;
    assert!(gone["post"].is_null(), "the post row is gone: {gone}");
    assert!(gone["node"].is_null());

    let staged = rig
        .gql(
            Some(&token),
            r#"query($id: UUID!) { stagedWrite(id: $id) { state } }"#,
            json!({ "id": staged_id }),
        )
        .await;
    assert_eq!(staged["stagedWrite"]["state"], "EXPIRED");
}

/// A structurally valid pre-commitment whose signature covers nothing:
/// the relay records it and stages the content, and then the substrate
/// refuses the seal. Nothing that pre-commitment staged is readable — the
/// content was never the author's, because the substrate never took it.
/// The write is back in the device's hands, retryable, and a proper
/// signature re-stages the very same content.
///
/// Content the substrate refused to seal is readable to nobody, the write returning to the device's hands where a proper signature re-stages the very same content.
/// ´claim:pending:a-refused-seal-leaves-nothing-readable´
#[sqlx::test(migrations = "../../migrations")]
async fn a_refused_seal_leaves_no_readable_pending_content(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let prepared = rig.prepare_post(&token, "Never seals", "body").await;
    let post_id = prepared["preparePost"]["node"].as_str().expect("node");
    let write = &prepared["preparePost"]["writes"][0];
    let staged_id = write["id"].as_str().expect("id");

    let proposal = wire::decode_proposal(
        &B64.decode(write["canonicalProposal"].as_str().expect("proposal"))
            .expect("b64"),
    )
    .expect("decodes");
    let pre = key.pre_sign(proposal);
    let mut forged = pre.pre_signature.clone();
    forged[0] ^= 0xff;
    let refused = rig
        .submit_pre_commitment(
            &token,
            staged_id,
            &wire::encode_pre_commitment(&pre.nonce, &forged),
        )
        .await;
    assert_eq!(
        refused["submitProposals"]["userErrors"][0]["code"], "SIGNATURE_INVALID",
        "the seal must refuse a forged pre-commitment: {refused}"
    );

    let gone = rig
        .gql(
            None,
            r#"query($id: UUID!) { post(id: $id) { id } node(id: $id) { id } }"#,
            json!({ "id": post_id }),
        )
        .await;
    assert!(
        gone["post"].is_null(),
        "a write that failed to seal publishes nothing: {gone}"
    );
    assert!(gone["node"].is_null());
    assert!(rig.listed(None, "first: 10").await.is_empty());

    let staged = rig
        .gql(
            Some(&token),
            r#"query($id: UUID!) { stagedWrite(id: $id) { state } }"#,
            json!({ "id": staged_id }),
        )
        .await;
    assert_eq!(staged["stagedWrite"]["state"], "AWAITING_PRE_SIGN");

    rig.pre_sign(&token, &key, &prepared["preparePost"]["writes"])
        .await;
    let retried = rig.listed(None, "first: 10").await;
    assert_eq!(retried.len(), 1, "the retry re-stages the content");
    assert_eq!(retried[0]["node"]["id"], post_id);
}

/// A comment prepared against a pending post whose parent then expires:
/// staging it can never succeed, because the parent it would hang under
/// is gone. The refusal leaves the write where the device can act on it,
/// rather than stranded in `sealing` until GC.
///
/// A staging failure hands the write back to the device to act on rather than stranding it until collection.
/// ´claim:pending:a-staging-failure-hands-the-write-back´
#[sqlx::test(migrations = "../../migrations")]
async fn a_staging_failure_hands_the_write_back_instead_of_wedging_it(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let (post_id, post_staged) = rig.pending_post(&token, &key, "host", "b").await;

    let (_, commenter_key) = rig.seed_member("commenter", "commenter@example.com").await;
    let commenter = rig.log_in("commenter@example.com").await;
    let prepared = rig
        .gql(
            Some(&commenter),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": post_id,
                "content": "Orphaned before it was signed.",
                "license": { "attribution": 0.0, "provenance": 0.0 },
            }}),
        )
        .await;
    let write = &prepared["prepareComment"]["writes"][0];
    let staged_id = write["id"].as_str().expect("id").to_string();

    postgres_store::staged::expire_one(
        &rig.pool,
        Uuid::parse_str(&post_staged).expect("uuid"),
        FAR_FUTURE_EPOCH,
    )
    .await
    .expect("expires the parent");

    let proposal = wire::decode_proposal(
        &B64.decode(write["canonicalProposal"].as_str().expect("proposal"))
            .expect("b64"),
    )
    .expect("decodes");
    let pre = commenter_key.pre_sign(proposal);
    let refused = rig
        .submit_pre_commitment(
            &commenter,
            &staged_id,
            &wire::encode_pre_commitment(&pre.nonce, &pre.pre_signature),
        )
        .await;
    assert!(
        !refused["submitProposals"]["userErrors"]
            .as_array()
            .expect("errors")
            .is_empty(),
        "staging a comment with no parent must fail the leg: {refused}"
    );

    let staged = rig
        .gql(
            Some(&commenter),
            r#"query($id: UUID!) { stagedWrite(id: $id) { state } }"#,
            json!({ "id": staged_id }),
        )
        .await;
    assert_eq!(
        staged["stagedWrite"]["state"], "AWAITING_PRE_SIGN",
        "a failed staging must not wedge the write: {staged}"
    );
}

/// Both pending entries sort ahead of the newest landed one, newest
/// authored first among themselves. The cursor namespace carries a walk
/// across that boundary: page one ends inside the pending set and page
/// two crosses into the landed one, while walking backward from the same
/// cursor serves the newer neighbours — the pending set — still
/// newest-first.
///
/// Pending entries lead the listing, newest authored first, and one cursor namespace carries a walk across the boundary into the landed set in both directions.
/// ´claim:pending:one-cursor-namespace-spans-pending-and-landed´
#[sqlx::test(migrations = "../../migrations")]
async fn pending_entries_lead_the_listing_and_page_by_their_own_cursor(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let old = rig.landed_post(&token, &key, "landed-old", "b").await;
    let new = rig.landed_post(&token, &key, "landed-new", "b").await;
    let (pending_first, _) = rig.pending_post(&token, &key, "pending-1", "b").await;
    let (pending_second, _) = rig.pending_post(&token, &key, "pending-2", "b").await;

    let all = rig.listed(None, "first: 10").await;
    let order: Vec<&str> = all
        .iter()
        .map(|e| e["node"]["id"].as_str().expect("id"))
        .collect();
    assert_eq!(
        order,
        vec![
            pending_second.as_str(),
            pending_first.as_str(),
            new.as_str(),
            old.as_str()
        ]
    );

    let page1 = rig.listed(None, "first: 2").await;
    assert_eq!(page1.len(), 2);
    let cursor = page1[1]["cursor"].as_str().expect("cursor");
    let page2 = rig
        .listed(None, &format!("first: 2, after: \"{cursor}\""))
        .await;
    let page2_ids: Vec<&str> = page2
        .iter()
        .map(|e| e["node"]["id"].as_str().expect("id"))
        .collect();
    assert_eq!(page2_ids, vec![new.as_str(), old.as_str()]);

    let back = rig
        .listed(None, &format!("last: 2, before: \"{cursor}\""))
        .await;
    let back_ids: Vec<&str> = back
        .iter()
        .map(|e| e["node"]["id"].as_str().expect("id"))
        .collect();
    assert_eq!(back_ids, vec![pending_second.as_str()]);
}

/// The default is the canon — pending content shows — and the opt-out
/// serves only what has landed.
///
/// The canon is the default view and the settled graph is the opt-out.
/// ´claim:pending:the-canon-is-the-default-view´
#[sqlx::test(migrations = "../../migrations")]
async fn include_pending_false_serves_only_what_landed(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let landed = rig.landed_post(&token, &key, "landed", "b").await;
    rig.pending_post(&token, &key, "pending", "b").await;

    let settled = rig.listed(None, "first: 10, includePending: false").await;
    assert_eq!(settled.len(), 1);
    assert_eq!(settled[0]["node"]["id"], landed);
    assert_eq!(settled[0]["node"]["landing"]["state"], "LANDED");

    assert_eq!(rig.listed(None, "first: 10").await.len(), 2);
}

/// The default view is the canon: the pending edit's text, marked pending
/// on a node whose own record landed (D4). The opt-out is the settled
/// graph — the version that landed, and a landing state that says so. The
/// epoch contract holds there, because nothing on screen is unlanded any
/// more.
///
/// (´claim:pending:the-canon-is-the-default-view´)
#[sqlx::test(migrations = "../../migrations")]
async fn include_pending_false_serves_the_version_that_landed(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post_id = rig.landed_post(&token, &key, "Old title", "Old body").await;

    let edit = rig
        .gql(
            Some(&token),
            PREPARE_POST_EDIT,
            json!({ "input": { "id": post_id, "title": "New title", "content": "Old body" }}),
        )
        .await;
    rig.pre_sign(&token, &key, &edit["preparePostEdit"]["writes"])
        .await;

    let default = rig.listed(None, "first: 10").await;
    assert_eq!(default[0]["node"]["title"]["value"], "New title");
    assert_eq!(default[0]["node"]["landing"]["state"], "PENDING");

    let settled = rig.listed(None, "first: 10, includePending: false").await;
    assert_eq!(settled.len(), 1);
    let node = &settled[0]["node"];
    assert_eq!(node["id"], post_id);
    assert_eq!(
        node["title"]["value"], "Old title",
        "the opt-out must not serve an unlanded edit: {node}"
    );
    assert_eq!(node["landing"]["state"], "LANDED");
    assert!(
        node["landing"]["epoch"].is_i64(),
        "a LANDED node carries its epoch: {node}"
    );
}

/// The record set carries no pending namespace — a record is in the
/// chronicle exactly when it is ordered fact — so the listing needs no
/// opt-out to serve the settled graph, and a signed-but-unordered Publish
/// is simply not there. The pending node's own chronicle is well-formed
/// and empty; landing is what puts a record in it.
///
/// A record is in the chronicle exactly when it is ordered fact, so the record set needs no opt-out to serve the settled graph.
/// ´claim:pending:the-chronicle-holds-only-ordered-fact´
#[sqlx::test(migrations = "../../migrations")]
async fn the_chronicle_omits_a_pending_record_until_it_lands(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (author, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let landed = rig.landed_post(&token, &key, "Landed", "b").await;

    let prepared = rig.prepare_post(&token, "Pending", "b").await;
    let pending = prepared["preparePost"]["node"]
        .as_str()
        .expect("node")
        .to_string();
    let signed = rig
        .pre_sign(&token, &key, &prepared["preparePost"]["writes"])
        .await;

    let edges = rig.chronicle(&author).await;
    assert_eq!(edges.len(), 1, "only ordered fact is listed: {edges:#?}");
    assert_eq!(edges[0]["node"]["family"], "PUBLISH");
    assert_eq!(edges[0]["node"]["target"]["id"], landed.as_str());
    assert!(
        edges[0]["node"]["landingEpoch"].is_i64(),
        "a chronicle row always carries its landing epoch: {edges:#?}"
    );

    assert!(
        rig.records_on(&pending).await.is_empty(),
        "a pending node has no record yet"
    );

    rig.approve_and_close(&token, &key, &signed).await;
    let edges = rig.chronicle(&author).await;
    assert_eq!(edges.len(), 2);
    let targets: Vec<&str> = edges
        .iter()
        .map(|e| e["node"]["target"]["id"].as_str().expect("id"))
        .collect();
    assert!(targets.contains(&pending.as_str()), "{targets:?}");
    assert_eq!(rig.records_on(&pending).await.len(), 1);
}

/// With the edit signed but unordered, the chronicle still holds only the
/// one Publish that landed, at its own landing epoch. A row does point at
/// the node, and a node read is always current, so the target carries the
/// pending edit's text marked PENDING: the chronicle's landed-only
/// guarantee is over which records exist, not over which version the node
/// they name serves. Landing the edit is what adds the edit's own row.
///
/// The chronicle's landed-only guarantee is over which records exist, never over which version the node they name serves.
/// ´claim:pending:the-guarantee-is-over-records-not-versions´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unlanded_edit_adds_no_chronicle_row(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (author, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post_id = rig.landed_post(&token, &key, "Old title", "Old body").await;

    let edit = rig
        .gql(
            Some(&token),
            PREPARE_POST_EDIT,
            json!({ "input": { "id": post_id, "title": "New title", "content": "Old body" }}),
        )
        .await;
    let signed = rig
        .pre_sign(&token, &key, &edit["preparePostEdit"]["writes"])
        .await;

    let edges = rig.chronicle(&author).await;
    assert_eq!(edges.len(), 1, "the unlanded edit is not fact: {edges:#?}");
    let row = &edges[0]["node"];
    assert_eq!(row["family"], "PUBLISH");
    assert!(row["landingEpoch"].is_i64());

    assert_eq!(row["target"]["id"], post_id.as_str());
    assert_eq!(row["target"]["title"]["value"], "New title");
    assert_eq!(row["target"]["landing"]["state"], "PENDING");

    rig.approve_and_close(&token, &key, &signed).await;
    let edges = rig.chronicle(&author).await;
    assert_eq!(edges.len(), 2, "the landed edit is its own record");
    assert_eq!(edges[0]["node"]["target"]["landing"]["state"], "LANDED");
}

/// (´claim:pending:pending-content-reads-to-everyone´)
#[sqlx::test(migrations = "../../migrations")]
async fn a_pending_comment_reads_in_its_thread(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post_id = rig.landed_post(&token, &key, "host", "b").await;

    let (_, commenter_key) = rig.seed_member("commenter", "commenter@example.com").await;
    let commenter = rig.log_in("commenter@example.com").await;
    let prepared = rig
        .gql(
            Some(&commenter),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": post_id,
                "content": "Settling too.",
                "license": { "attribution": 0.0, "provenance": 0.0 },
            }}),
        )
        .await;
    let comment_id = prepared["prepareComment"]["node"].as_str().expect("node");
    rig.pre_sign(
        &commenter,
        &commenter_key,
        &prepared["prepareComment"]["writes"],
    )
    .await;

    let thread = rig
        .gql(
            None,
            r#"query($id: UUID!) { post(id: $id) {
                 comments(first: 10) { edges { node {
                   id content { value } author { handle } landing { state epoch }
                 } } }
                 settled: comments(first: 10, includePending: false) { edges { node { id } } }
               } }"#,
            json!({ "id": post_id }),
        )
        .await;
    let edges = thread["post"]["comments"]["edges"]
        .as_array()
        .expect("edges");
    assert_eq!(edges.len(), 1);
    assert_eq!(edges[0]["node"]["id"], comment_id);
    assert_eq!(edges[0]["node"]["content"]["value"], "Settling too.");
    assert_eq!(edges[0]["node"]["author"]["handle"], "commenter");
    assert_eq!(edges[0]["node"]["landing"]["state"], "PENDING");
    assert!(edges[0]["node"]["landing"]["epoch"].is_null());
    assert_eq!(
        thread["post"]["settled"]["edges"]
            .as_array()
            .expect("edges")
            .len(),
        0,
        "the opt-out reaches the thread read too"
    );
}

/// An edit is a record, and a prepared record is its author's content
/// from the moment they sign it: the new title is on screen at once, the
/// node reads pending, and the body reads as the snapshot has it. The
/// node keeps its landing position — an edit never moves it.
///
/// A signed edit is its author's content from that moment: the new text is on screen marked pending, and the node keeps its landing position.
/// ´claim:pending:a-signed-edit-shows-at-once´
#[sqlx::test(migrations = "../../migrations")]
async fn a_pending_edit_shows_its_new_text_marked_pending(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post_id = rig.landed_post(&token, &key, "Old title", "Old body").await;

    let edit = rig
        .gql(
            Some(&token),
            PREPARE_POST_EDIT,
            json!({ "input": { "id": post_id, "title": "New title", "content": "Old body" }}),
        )
        .await;
    assert_eq!(
        edit["preparePostEdit"]["userErrors"]
            .as_array()
            .expect("array"),
        &Vec::<Value>::new(),
        "prepare refused: {edit}"
    );
    let signed = rig
        .pre_sign(&token, &key, &edit["preparePostEdit"]["writes"])
        .await;

    const READ: &str = r#"query($id: UUID!) { post(id: $id) {
         title { value } content { value } landing { state epoch }
       } }"#;

    let pending = rig.gql(None, READ, json!({ "id": post_id })).await;
    assert_eq!(pending["post"]["title"]["value"], "New title");
    assert_eq!(pending["post"]["content"]["value"], "Old body");
    assert_eq!(pending["post"]["landing"]["state"], "PENDING");
    assert!(pending["post"]["landing"]["epoch"].is_null());

    let listing = rig.listed(None, "first: 10").await;
    assert_eq!(listing.len(), 1);
    assert_eq!(listing[0]["node"]["id"], post_id);

    rig.approve_and_close(&token, &key, &signed).await;

    let landed = rig.gql(None, READ, json!({ "id": post_id })).await;
    assert_eq!(landed["post"]["title"]["value"], "New title");
    assert_eq!(landed["post"]["landing"]["state"], "LANDED");
    assert!(landed["post"]["landing"]["epoch"].is_i64());
}

/// The act is approved — orderable, but not yet ordered — and GC's first
/// phase runs in that window: the content leaves every view while the
/// staged row stays behind, unreaped. Then the epoch closes over the act
/// after all. The mirror governs, so the content comes back, this time
/// with its real landing order.
///
/// The mirror governs, so an act ordered after its write expired but before the reap brings the content back at its real landing order.
/// ´claim:pending:a-late-landing-still-promotes´
#[sqlx::test(migrations = "../../migrations")]
async fn a_record_landing_after_expiry_but_before_the_reap_still_promotes(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;

    let prepared = rig
        .prepare_post(&token, "Late lander", "slow to order")
        .await;
    let post_id = prepared["preparePost"]["node"].as_str().expect("node");
    let signed = rig
        .pre_sign(&token, &key, &prepared["preparePost"]["writes"])
        .await;

    rig.approve(&token, &key, &signed).await;

    rig.expire_everything().await;
    assert!(
        rig.listed(None, "first: 10").await.is_empty(),
        "expiry takes the content off screen"
    );

    rig.close_and_ingest().await;

    let edges = rig.listed(None, "first: 10").await;
    assert_eq!(edges.len(), 1, "the late landing promotes: {edges:?}");
    let node = &edges[0]["node"];
    assert_eq!(node["id"], post_id);
    assert_eq!(node["title"]["value"], "Late lander");
    assert_eq!(node["content"]["value"], "slow to order");
    assert_eq!(node["landing"]["state"], "LANDED");
    assert!(
        node["landing"]["epoch"].is_i64(),
        "the rebuilt rows carry the record's own landing order: {node}"
    );
}

/// An expired edit leaves the version that landed on screen.
/// ´claim:pending:an-expired-edit-leaves-the-landed-version´
#[sqlx::test(migrations = "../../migrations")]
async fn an_expired_edit_leaves_the_previous_version_rendered(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let post_id = rig.landed_post(&token, &key, "Old title", "Old body").await;

    let edit = rig
        .gql(
            Some(&token),
            PREPARE_POST_EDIT,
            json!({ "input": { "id": post_id, "title": "Doomed title", "content": "Old body" }}),
        )
        .await;
    rig.pre_sign(&token, &key, &edit["preparePostEdit"]["writes"])
        .await;
    rig.expire_everything().await;

    const READ: &str = r#"query($id: UUID!) { post(id: $id) {
         id title { value } landing { state epoch }
       } }"#;
    let after = rig.gql(None, READ, json!({ "id": post_id })).await;
    assert_eq!(
        after["post"]["title"]["value"], "Old title",
        "the expired version leaves the view; the node itself stays"
    );
    assert_eq!(after["post"]["landing"]["state"], "LANDED");
    assert!(after["post"]["landing"]["epoch"].is_i64());
}
