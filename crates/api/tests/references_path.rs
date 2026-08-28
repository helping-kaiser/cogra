//! Slice 2.4 — the Reference act and its declared fold (roadmap "Slice
//! 2.4"): planning refusals, the act tuple as the write path really
//! stores it, the netting fold, the landed/pending split, and the
//! withdrawal batch.
//!
//! The orientation is the thing under test throughout. Reference is Review
//! with its legs transposed, so the act tuple is (effort, enthusiasm) and
//! the T-leg stores it swapped — a fold reading the wrong column still
//! returns rows, just wrong ones. Two kinds of test guard that: one drives
//! real citations through the write path and reads them back, and the
//! fixtures that need controlled sums derive their storage orientation
//! from `census::leg_params` rather than restating it.

use api::l1::{L1Boundary, StandInBoundary};
use api::references::{
    self, MAX_LIVE_REFERENCES_PER_ARTIFACT, MAX_REFERENCES_PER_BATCH, ReferenceDraft,
    ReferenceError, ReferencesError,
};
use common::l1::census::{Family, LegRole, leg_params};
use common::l1::client::ActorKey;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::references::{ReferenceView, references_of};
use postgres_store::staged::{self, PreSignedParts};
use postgres_store::{content as content_store, genesis, references as store_refs};
use sqlx::PgPool;
use uuid::Uuid;

const GC: i64 = 8;

fn license() -> api::content::License {
    api::content::License {
        attribution: 1.0,
        provenance: 0.0,
    }
}

struct Rig {
    pool: PgPool,
    standin: StandIn,
    boundary: StandInBoundary,
}

impl Rig {
    async fn new(pool: PgPool) -> Self {
        let standin = StandIn::new(pool.clone(), StandInConfig::default());
        let boundary = StandInBoundary(standin.clone());
        Self {
            pool,
            standin,
            boundary,
        }
    }

    async fn funded_actor(&self, handle: &str) -> (Uuid, ActorKey) {
        let key = ActorKey::generate();
        let id = Uuid::new_v4();
        let mut conn = self.pool.acquire().await.expect("conn");
        genesis::insert_actor(
            &mut conn,
            id,
            "user",
            handle,
            &key.public_key_bytes(),
            &key.address(),
        )
        .await
        .expect("actor row");
        self.standin
            .credit_burn(&key.address(), 10_000_000)
            .await
            .expect("burn");
        (id, key)
    }

    async fn sign_and_relay(&self, id: Uuid, key: &ActorKey) {
        let write = staged::load(&self.pool, id).await.expect("loads");
        let pre = key.pre_sign(write.proposal);
        let parts = PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        };
        let sealed = api::relay::submit_pre_signed(&self.boundary, &self.pool, id, parts)
            .await
            .expect("seals");
        let host_key = self.boundary.host_public_key().await.expect("host key");
        let witness = key.approve(&pre, &sealed, &host_key).expect("approves");
        api::relay::submit_approval(&self.boundary, &self.pool, id, witness.approval_signature)
            .await
            .expect("relays");
    }

    async fn close_and_ingest(&self) {
        self.standin.close_epoch().await.expect("closes");
        let outcome = api::ingest::ingest_pending(&self.boundary, &self.pool, GC)
            .await
            .expect("ingests");
        assert!(
            outcome.promotion_failures.is_empty(),
            "promotion failed: {:?}",
            outcome.promotion_failures
        );
    }

    async fn post(&self, actor: Uuid, key: &ActorKey, title: &str) -> Uuid {
        let prepared = api::content::prepare_post(
            &self.pool,
            &self.boundary,
            GC,
            actor,
            api::content::PostDraft {
                title: Some(title.into()),
                description: None,
                content: "body".into(),
                license: license(),
                p_directed: None,
                tags: vec![],
                references: vec![],
            },
        )
        .await
        .expect("prepares post");
        self.sign_and_relay(prepared.writes[0].id, key).await;
        self.close_and_ingest().await;
        prepared.node
    }

    /// Authors one citation and drives it all the way onto the graph.
    async fn cite(
        &self,
        actor: Uuid,
        key: &ActorKey,
        artifact: Uuid,
        target: Uuid,
        relevance: f64,
        support: f64,
    ) {
        let prepared = references::prepare_reference(
            &self.pool,
            &self.boundary,
            GC,
            actor,
            artifact,
            &ReferenceDraft {
                target,
                relevance: Some(relevance),
                support: Some(support),
            },
        )
        .await
        .expect("prepares citation");
        self.sign_and_relay(prepared.id, key).await;
        self.close_and_ingest().await;
    }

    async fn node_of(&self, post: Uuid) -> String {
        content_store::post(&self.pool, post)
            .await
            .expect("reads")
            .expect("post row")
            .l1_node_id
    }

    async fn address(&self, actor: Uuid) -> String {
        postgres_store::auth::actor_identity(&self.pool, actor)
            .await
            .expect("identity")
            .expect("row")
            .l0_address
            .expect("address")
    }
}

fn bad_input(e: ReferencesError) -> ReferenceError {
    match e {
        ReferencesError::BadInput(e) => e,
        other => panic!("expected a field-level refusal, got {other:?}"),
    }
}

fn draft(target: Uuid) -> ReferenceDraft {
    ReferenceDraft {
        target,
        relevance: None,
        support: None,
    }
}

/// The cap is a batch fault, so it is reported against the `references`
/// path rather than against whichever entry happens to sit at the limit —
/// and it is checked before any entry is resolved, so an over-long batch
/// carrying an unresolvable target still reports the cap.
#[sqlx::test(migrations = "../../migrations")]
async fn the_reference_batch_cap_admits_ten_and_refuses_eleven(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let mut targets = Vec::new();
    for i in 0..MAX_REFERENCES_PER_BATCH + 1 {
        targets.push(rig.post(alice, &key, &format!("t{i}")).await);
    }

    let at_cap: Vec<ReferenceDraft> = targets[..MAX_REFERENCES_PER_BATCH]
        .iter()
        .map(|t| draft(*t))
        .collect();
    let planned = references::plan_batch(&rig.pool, &at_cap)
        .await
        .expect("legal");
    assert_eq!(planned.len(), MAX_REFERENCES_PER_BATCH);
    assert_eq!(references::act_count(&planned), MAX_REFERENCES_PER_BATCH);

    let over: Vec<ReferenceDraft> = targets.iter().map(|t| draft(*t)).collect();
    let e = bad_input(
        references::plan_batch(&rig.pool, &over)
            .await
            .expect_err("refused"),
    );
    assert_eq!(e.path, vec!["references".to_string()]);
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_cap_is_checked_before_the_entries(pool: PgPool) {
    let over: Vec<ReferenceDraft> = (0..MAX_REFERENCES_PER_BATCH + 1)
        .map(|_| draft(Uuid::new_v4()))
        .collect();
    let e = bad_input(
        references::plan_batch(&pool, &over)
            .await
            .expect_err("refused"),
    );
    assert_eq!(
        e.path,
        vec!["references".to_string()],
        "the whole-batch fault is the one to report"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_unresolvable_target_names_its_own_entry(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let real = rig.post(alice, &key, "real").await;

    let batch = [draft(real), draft(Uuid::new_v4())];
    let e = bad_input(
        references::plan_batch(&rig.pool, &batch)
            .await
            .expect_err("refused"),
    );
    assert_eq!(
        e.path,
        vec![
            "references".to_string(),
            "1".to_string(),
            "target".to_string()
        ]
    );
}

/// A standalone citation roots its refusal at the mutation's own field,
/// not at a batch path that does not exist there.
#[sqlx::test(migrations = "../../migrations")]
async fn a_standalone_unresolvable_target_names_the_bare_field(pool: PgPool) {
    let e = bad_input(
        references::plan_one(&pool, &draft(Uuid::new_v4()))
            .await
            .expect_err("refused"),
    );
    assert_eq!(e.path, vec!["target".to_string()]);
}

#[sqlx::test(migrations = "../../migrations")]
async fn one_target_cited_twice_in_a_batch_is_refused(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let one = rig.post(alice, &key, "one").await;
    let two = rig.post(alice, &key, "two").await;

    let batch = [draft(one), draft(two), draft(one)];
    let e = bad_input(
        references::plan_batch(&rig.pool, &batch)
            .await
            .expect_err("refused"),
    );
    assert_eq!(
        e.path,
        vec![
            "references".to_string(),
            "2".to_string(),
            "target".to_string()
        ],
        "the later citation is the offender"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_artifact_cannot_cite_itself(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let post = rig.post(alice, &key, "post").await;

    let e = bad_input(
        references::prepare_reference(&rig.pool, &rig.boundary, GC, alice, post, &draft(post))
            .await
            .expect_err("refused"),
    );
    assert_eq!(e.path, vec!["target".to_string()]);
}

#[sqlx::test(migrations = "../../migrations")]
async fn citing_from_an_artifact_that_does_not_exist_names_the_artifact(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let target = rig.post(alice, &key, "target").await;

    let e = bad_input(
        references::prepare_reference(
            &rig.pool,
            &rig.boundary,
            GC,
            alice,
            Uuid::new_v4(),
            &draft(target),
        )
        .await
        .expect_err("refused"),
    );
    assert_eq!(e.path, vec!["artifact".to_string()]);
}

/// A mention is a Reference whose target is the person's Profile (D2), so
/// the target resolver must reach an Actor's Profile node and the census
/// must admit it as a terminal target.
#[sqlx::test(migrations = "../../migrations")]
async fn a_mention_resolves_its_target_to_a_profile(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, _) = rig.funded_actor("alice").await;
    let (bob, _) = rig.funded_actor("bob").await;
    let bob_address = rig.address(bob).await;

    let planned = references::plan_one(&rig.pool, &draft(bob))
        .await
        .expect("resolves");
    assert_eq!(planned.target.to_string(), format!("prof:{bob_address}"));

    let alice_address = rig.address(alice).await;
    let middle = common::l1::identifier::NodeId::parse("mint:act:alice:0:publish").expect("node");
    let g = references::reference_gesture(&alice_address, middle, &planned, vec![]);
    let target = match &g.target {
        api::prepare::Target::Node(n) => n.clone(),
        api::prepare::Target::OwnMint => panic!("never an own mint"),
    };
    g.family
        .endpoint_check(
            &alice_address,
            &common::l1::identifier::NodeId::Addr(alice_address.clone()),
            g.middle.as_ref(),
            &target,
        )
        .expect("a Profile is a legal terminal target");
}

/// The claim-9 trap, verified against the real write path rather than a
/// hand-built row: a citation authored at (relevance, support) must read
/// back at exactly that pair, which it can only do if the gesture writes
/// the act tuple and the fold un-transposes the T-leg.
#[sqlx::test(migrations = "../../migrations")]
async fn a_landed_citation_reads_back_at_the_parameters_it_was_authored_with(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let carrier = rig.post(alice, &key, "carrier").await;
    let cited = rig.post(alice, &key, "cited").await;

    rig.cite(alice, &key, carrier, cited, -0.75, 0.25).await;

    let artifact = rig.node_of(carrier).await;
    let cited_node = rig.node_of(cited).await;
    let address = rig.address(alice).await;
    let claims = references_of(&rig.pool, &artifact, &address, ReferenceView::Landed)
        .await
        .expect("folds");

    assert_eq!(claims.len(), 1);
    assert_eq!(claims[0].target, cited_node);
    assert_eq!(
        claims[0].relevance, -0.75,
        "relevance survives the round trip"
    );
    assert_eq!(claims[0].support, 0.25, "support survives the round trip");
    assert!(!claims[0].pending);
    assert_eq!(claims[0].records, 1);

    let leg = sqlx::query_as::<_, (f64, f64)>(
        "SELECT l.p_d, l.p_i FROM mirror_record_legs l
         WHERE l.leg = 't' AND l.family = 'reference' AND l.source = $1",
    )
    .bind(&artifact)
    .fetch_one(&rig.pool)
    .await
    .expect("t-leg row");
    assert_eq!(
        leg,
        leg_params(LegRole::T, -0.75, 0.25),
        "the T-leg stores the act tuple transposed"
    );
}

/// The citation carries no payload (D14), which is what keeps it inside
/// the netted bundle the read side is built on.
#[sqlx::test(migrations = "../../migrations")]
async fn a_citation_commits_an_empty_payload(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let carrier = rig.post(alice, &key, "carrier").await;
    let cited = rig.post(alice, &key, "cited").await;

    let prepared =
        references::prepare_reference(&rig.pool, &rig.boundary, GC, alice, carrier, &draft(cited))
            .await
            .expect("prepares");
    assert!(prepared.proposal.payload.is_empty());
    assert_eq!(prepared.proposal.body.family, Family::Reference);
}

/// Inserts one landed Reference record straight into the mirror, deriving
/// the T-leg's stored orientation from the census so the fixture cannot
/// disagree with the write path about which column is which.
#[allow(clippy::too_many_arguments)]
async fn seed_reference(
    pool: &PgPool,
    record: &str,
    author: &str,
    artifact: &str,
    target: &str,
    relevance: f64,
    support: f64,
    payload_marked: bool,
) {
    sqlx::query(
        "INSERT INTO mirror_records
             (record_id, family, author, epoch, act_time, position,
              payload_marked, payload_witness)
         VALUES ($1, 'reference', $2, 0, 0, 0, $3, '\\x00')",
    )
    .bind(record)
    .bind(author)
    .bind(payload_marked)
    .execute(pool)
    .await
    .expect("record row");

    let (t_pd, t_pi) = leg_params(LegRole::T, relevance, support);
    sqlx::query(
        "INSERT INTO mirror_record_legs
             (record_id, leg, source, target, p_d, p_i, domain,
              mask_a00, mask_a01, mask_a10, mask_a11, tier, tau,
              family, epoch, act_time, position)
         VALUES ($1, 't', $2, $3, $4, $5, 'tribal',
                 TRUE, TRUE, TRUE, TRUE, 'full', 1.0,
                 'reference', 0, 0, 0)",
    )
    .bind(record)
    .bind(artifact)
    .bind(target)
    .bind(t_pd)
    .bind(t_pi)
    .execute(pool)
    .await
    .expect("leg row");
}

/// Fills the artifact's reference row to `live` standing bundles plus
/// `netted` bundles that have been walked back to `(0, 0)`, so a test can
/// state the fold's view and let the cap read it.
///
/// The record identifiers are well-formed `act:<author>:<seq>:<family>`
/// rather than opaque labels: `allocate_seq` reads the author's highest
/// landed sequence out of the mirror by splitting the identifier, so a
/// fixture that seeds under an author who then prepares has to speak the
/// same grammar the write path allocates in.
async fn seed_standing_set(pool: &PgPool, author: &str, artifact: &str, live: usize, netted: usize) {
    let mut seq = 9000;
    for i in 0..live {
        seed_reference(
            pool,
            &format!("act:{author}:{seq}:reference"),
            author,
            artifact,
            &format!("prof:live{i}"),
            0.1,
            0.1,
            false,
        )
        .await;
        seq += 1;
    }
    for i in 0..netted {
        let target = format!("prof:gone{i}");
        for (relevance, support) in [(0.1, 0.1), (-0.1, -0.1)] {
            seed_reference(
                pool,
                &format!("act:{author}:{seq}:reference"),
                author,
                artifact,
                &target,
                relevance,
                support,
                false,
            )
            .await;
            seq += 1;
        }
    }
}

/// D22's standing-set cap. The batch cap bounds one gesture; this bounds
/// what the gestures accumulate into, and it is the standalone citation —
/// the only one that meets an artifact already carrying a set — that
/// meets it.
#[sqlx::test(migrations = "../../migrations")]
async fn the_standing_reference_cap_refuses_the_citation_past_fifty(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let artifact = rig.post(alice, &key, "carrier").await;
    let target = rig.post(alice, &key, "cited").await;
    let node = rig.node_of(artifact).await;
    let address = rig.address(alice).await;
    seed_standing_set(
        &rig.pool,
        &address,
        &node,
        MAX_LIVE_REFERENCES_PER_ARTIFACT,
        0,
    )
    .await;

    let e = bad_input(
        references::prepare_reference(&rig.pool, &rig.boundary, GC, alice, artifact, &draft(target))
            .await
            .expect_err("refused"),
    );
    assert_eq!(e.path, vec!["target".to_string()]);
    assert!(e.message.contains("withdraw one first"), "{}", e.message);
}

/// The cap counts the fold's view, not the records behind it: an artifact
/// carrying fifty-one bundles of which one has netted away has a slot
/// free, and the citation that fills it is admitted.
#[sqlx::test(migrations = "../../migrations")]
async fn a_netted_bundle_frees_a_slot_under_the_standing_reference_cap(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let artifact = rig.post(alice, &key, "carrier").await;
    let target = rig.post(alice, &key, "cited").await;
    let node = rig.node_of(artifact).await;
    let address = rig.address(alice).await;
    seed_standing_set(
        &rig.pool,
        &address,
        &node,
        MAX_LIVE_REFERENCES_PER_ARTIFACT - 1,
        1,
    )
    .await;

    references::prepare_reference(&rig.pool, &rig.boundary, GC, alice, artifact, &draft(target))
        .await
        .expect("the freed slot admits the citation");
}

/// The cap is per (author, artifact): another author's fifty citations
/// from the same artifact leave the viewer's own set empty.
#[sqlx::test(migrations = "../../migrations")]
async fn the_standing_reference_cap_counts_only_the_citing_authors_own_set(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let (bob, _) = rig.funded_actor("bob").await;
    let artifact = rig.post(alice, &key, "carrier").await;
    let target = rig.post(alice, &key, "cited").await;
    let node = rig.node_of(artifact).await;
    let alice_address = rig.address(alice).await;
    seed_standing_set(
        &rig.pool,
        &alice_address,
        &node,
        MAX_LIVE_REFERENCES_PER_ARTIFACT,
        0,
    )
    .await;

    references::prepare_reference(&rig.pool, &rig.boundary, GC, bob, artifact, &draft(target))
        .await
        .expect("bob's own set on this artifact is empty");
}

/// The fold nets — it does not pick a winner. Three records from one
/// author toward one target sum, and the sum is what the view reports;
/// newest-wins would have reported the last record's pair alone.
#[sqlx::test(migrations = "../../migrations")]
async fn a_multi_record_bundle_sums_rather_than_taking_the_newest(pool: PgPool) {
    seed_reference(&pool, "r1", "alice", "art", "tgt", 0.2, 0.1, false).await;
    seed_reference(&pool, "r2", "alice", "art", "tgt", 0.3, 0.1, false).await;
    seed_reference(&pool, "r3", "alice", "art", "tgt", 0.1, 0.2, false).await;

    let claims = references_of(&pool, "art", "alice", ReferenceView::Landed)
        .await
        .expect("folds");
    assert_eq!(claims.len(), 1, "one bundle, not three rows");
    assert!((claims[0].relevance - 0.6).abs() < 1e-12, "0.2+0.3+0.1");
    assert!((claims[0].support - 0.4).abs() < 1e-12, "0.1+0.1+0.2");
    assert_eq!(claims[0].records, 3);
}

/// Sum *then* clip: a bundle carrying more conviction than one record can
/// express folds to the census ceiling, never past it.
#[sqlx::test(migrations = "../../migrations")]
async fn a_bundle_past_the_ceiling_clips(pool: PgPool) {
    seed_reference(&pool, "r1", "alice", "art", "tgt", 0.9, -0.9, false).await;
    seed_reference(&pool, "r2", "alice", "art", "tgt", 0.8, -0.8, false).await;

    let claims = references_of(&pool, "art", "alice", ReferenceView::Landed)
        .await
        .expect("folds");
    assert_eq!(claims[0].relevance, 1.0);
    assert_eq!(claims[0].support, -1.0);
}

/// Withdrawal on this family is netting, so a bundle whose records cancel
/// leaves the view — the citation stands as a record and stops standing as
/// a claim.
#[sqlx::test(migrations = "../../migrations")]
async fn a_bundle_netting_to_zero_drops_out_of_the_view(pool: PgPool) {
    seed_reference(&pool, "r1", "alice", "art", "gone", 0.5, 0.5, false).await;
    seed_reference(&pool, "r2", "alice", "art", "gone", -0.5, -0.5, false).await;
    seed_reference(&pool, "r3", "alice", "art", "kept", 0.5, 0.5, false).await;

    let claims = references_of(&pool, "art", "alice", ReferenceView::Landed)
        .await
        .expect("folds");
    assert_eq!(claims.len(), 1);
    assert_eq!(claims[0].target, "kept");
}

/// A bundle inert on one axis still stands: only (0,0) is withdrawal.
#[sqlx::test(migrations = "../../migrations")]
async fn a_bundle_inert_on_one_axis_is_kept(pool: PgPool) {
    seed_reference(&pool, "r1", "alice", "art", "tgt", 0.5, 0.0, false).await;

    let claims = references_of(&pool, "art", "alice", ReferenceView::Landed)
        .await
        .expect("folds");
    assert_eq!(claims.len(), 1);
    assert_eq!(claims[0].relevance, 0.5);
    assert_eq!(claims[0].support, 0.0);
}

/// Payload-marked records are read individually, never through the netted
/// bundle — so one must not move the fold.
#[sqlx::test(migrations = "../../migrations")]
async fn a_payload_marked_record_is_excluded_from_the_fold(pool: PgPool) {
    seed_reference(&pool, "r1", "alice", "art", "tgt", 0.4, 0.4, false).await;
    seed_reference(&pool, "r2", "alice", "art", "tgt", 0.5, 0.5, true).await;

    let claims = references_of(&pool, "art", "alice", ReferenceView::Landed)
        .await
        .expect("folds");
    assert_eq!(claims.len(), 1);
    assert_eq!(
        claims[0].relevance, 0.4,
        "the marked record does not sum in"
    );
    assert_eq!(claims[0].records, 1);
}

/// The bundle is keyed by the full incidence: the same author citing the
/// same target from two artifacts authors two bundles, never one.
#[sqlx::test(migrations = "../../migrations")]
async fn the_same_target_from_two_artifacts_is_two_bundles(pool: PgPool) {
    seed_reference(&pool, "r1", "alice", "art-one", "tgt", 0.5, 0.5, false).await;
    seed_reference(&pool, "r2", "alice", "art-two", "tgt", 0.3, 0.3, false).await;

    let one = references_of(&pool, "art-one", "alice", ReferenceView::Landed)
        .await
        .expect("folds");
    assert_eq!(one.len(), 1);
    assert_eq!(one[0].relevance, 0.5);

    let two = references_of(&pool, "art-two", "alice", ReferenceView::Landed)
        .await
        .expect("folds");
    assert_eq!(two.len(), 1);
    assert_eq!(two[0].relevance, 0.3);
}

/// Another author's citation off the same artifact is a different bundle
/// and does not join the carrier author's row (D12).
#[sqlx::test(migrations = "../../migrations")]
async fn a_third_party_citation_is_not_folded_into_the_authors(pool: PgPool) {
    seed_reference(&pool, "r1", "alice", "art", "tgt", 0.5, 0.5, false).await;
    seed_reference(&pool, "r2", "mallory", "art", "tgt", 0.9, 0.9, false).await;

    let claims = references_of(&pool, "art", "alice", ReferenceView::Landed)
        .await
        .expect("folds");
    assert_eq!(claims.len(), 1);
    assert_eq!(claims[0].relevance, 0.5);
    assert_eq!(claims[0].author, "alice");
}

/// A staged citation is invisible to the L1 view and visible to its own
/// author's L2 view, from the pre-commitment onward.
#[sqlx::test(migrations = "../../migrations")]
async fn a_pending_citation_shows_only_in_the_pending_inclusive_view(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let carrier = rig.post(alice, &key, "carrier").await;
    let cited = rig.post(alice, &key, "cited").await;
    let artifact = rig.node_of(carrier).await;
    let address = rig.address(alice).await;

    let prepared = references::prepare_reference(
        &rig.pool,
        &rig.boundary,
        GC,
        alice,
        carrier,
        &ReferenceDraft {
            target: cited,
            relevance: Some(0.6),
            support: Some(-0.2),
        },
    )
    .await
    .expect("prepares");

    let early = references_of(
        &rig.pool,
        &artifact,
        &address,
        ReferenceView::IncludingPending { actor: &address },
    )
    .await
    .expect("folds");
    assert!(early.is_empty(), "nothing counts before the pre-commitment");

    rig.sign_and_relay(prepared.id, &key).await;

    let landed = references_of(&rig.pool, &artifact, &address, ReferenceView::Landed)
        .await
        .expect("folds");
    assert!(landed.is_empty(), "the L1 view shows only what has landed");

    let pending = references_of(
        &rig.pool,
        &artifact,
        &address,
        ReferenceView::IncludingPending { actor: &address },
    )
    .await
    .expect("folds");
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].relevance, 0.6, "the staged row is the act tuple");
    assert_eq!(pending[0].support, -0.2);
    assert!(pending[0].pending);

    rig.close_and_ingest().await;

    let after = references_of(&rig.pool, &artifact, &address, ReferenceView::Landed)
        .await
        .expect("folds");
    assert_eq!(after.len(), 1);
    assert_eq!(after[0].relevance, 0.6, "landing preserves the orientation");
    assert_eq!(after[0].support, -0.2);
    assert!(!after[0].pending);
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_view_constructor_needs_both_the_flag_and_a_viewer(pool: PgPool) {
    let _ = &pool;
    assert_eq!(
        ReferenceView::from_include_pending(true, Some("alice")),
        ReferenceView::IncludingPending { actor: "alice" }
    );
    assert_eq!(
        ReferenceView::from_include_pending(true, None),
        ReferenceView::Landed,
        "no viewer, no in-flight acts to count"
    );
    assert_eq!(
        ReferenceView::from_include_pending(false, Some("alice")),
        ReferenceView::Landed
    );
}

/// The bundle read returns raw sums in act-tuple space, which is what
/// withdrawal needs: a clipped sum has already lost how far from zero the
/// bundle really sits.
#[sqlx::test(migrations = "../../migrations")]
async fn the_bundle_read_returns_raw_unclipped_sums(pool: PgPool) {
    seed_reference(&pool, "r1", "alice", "art", "tgt", 0.9, -0.9, false).await;
    seed_reference(&pool, "r2", "alice", "art", "tgt", 0.9, -0.9, false).await;

    let sum = store_refs::bundle(&pool, "alice", "art", "tgt", ReferenceView::Landed)
        .await
        .expect("bundle");
    assert!((sum.p_d - 1.8).abs() < 1e-12, "raw, not clipped to 1.0");
    assert!((sum.p_i + 1.8).abs() < 1e-12);
    assert_eq!(sum.records, 2);
}

/// Withdrawal costs `⌈max(|Σ_d|, |Σ_i|)⌉` acts, not one — the consequence
/// of netting rather than declaring, and the reason it is assembled
/// server-side rather than left to a client authoring one negating record.
#[sqlx::test(migrations = "../../migrations")]
async fn withdrawal_stages_the_counter_records_that_net_the_bundle(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let carrier = rig.post(alice, &key, "carrier").await;
    let cited = rig.post(alice, &key, "cited").await;

    rig.cite(alice, &key, carrier, cited, 0.9, 0.5).await;
    rig.cite(alice, &key, carrier, cited, 0.9, 0.5).await;
    rig.cite(alice, &key, carrier, cited, 0.7, 0.3).await;

    let artifact = rig.node_of(carrier).await;
    let cited_node = rig.node_of(cited).await;
    let address = rig.address(alice).await;

    let before = store_refs::bundle(
        &rig.pool,
        &address,
        &artifact,
        &cited_node,
        ReferenceView::Landed,
    )
    .await
    .expect("bundle");
    assert!((before.p_d - 2.5).abs() < 1e-12);
    assert!((before.p_i - 1.3).abs() < 1e-12);

    let batch = references::prepare_reference_withdrawal(
        &rig.pool,
        &rig.boundary,
        GC,
        alice,
        carrier,
        cited,
    )
    .await
    .expect("withdraws");
    assert_eq!(batch.len(), 3, "⌈max(2.5, 1.3)⌉ counter-records");

    for prepared in &batch {
        assert_eq!(prepared.proposal.body.family, Family::Reference);
        assert!(prepared.proposal.payload.is_empty());
        rig.sign_and_relay(prepared.id, &key).await;
    }
    rig.close_and_ingest().await;

    let after = store_refs::bundle(
        &rig.pool,
        &address,
        &artifact,
        &cited_node,
        ReferenceView::Landed,
    )
    .await
    .expect("bundle");
    assert!(after.p_d.abs() < 1e-12, "the sum is netted exactly");
    assert!(after.p_i.abs() < 1e-12);

    let claims = references_of(&rig.pool, &artifact, &address, ReferenceView::Landed)
        .await
        .expect("folds");
    assert!(claims.is_empty(), "a netted bundle leaves the view");
}

/// Withdrawing what is not there stages nothing and says so, rather than
/// charging θ for a batch of no records.
#[sqlx::test(migrations = "../../migrations")]
async fn withdrawing_an_absent_citation_is_refused(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, key) = rig.funded_actor("alice").await;
    let carrier = rig.post(alice, &key, "carrier").await;
    let cited = rig.post(alice, &key, "cited").await;

    let e = bad_input(
        references::prepare_reference_withdrawal(
            &rig.pool,
            &rig.boundary,
            GC,
            alice,
            carrier,
            cited,
        )
        .await
        .expect_err("refused"),
    );
    assert_eq!(e.path, vec!["target".to_string()]);
}
