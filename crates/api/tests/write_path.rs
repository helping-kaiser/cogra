//! The five-step write path, end to end against the stand-in
//! (architecture.md "The write path"): prepare → pre-sign (device) →
//! seal → approve (device) → confirm through the ingestion pass — plus
//! every refusal branch: formation, the write rule, bad signatures,
//! out-of-order legs, lost seals, and the staged-write GC.

use api::l1::{L1Boundary, StandInBoundary};
use api::prepare::{self, Gesture, PrepareError};
use api::relay::{self, RelayError};
use common::l1::Family;
use common::l1::client::ActorKey;
use common::l1::identifier::NodeId;
use common::l1::proposal::PreSigned;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::staged::{self, PreSignedParts, StagedState};
use postgres_store::{genesis, mirror};
use sqlx::PgPool;
use uuid::Uuid;

const GC: i64 = 8;

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

    /// A funded user with an actors row — the prepare path's author shape.
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

    fn registration(&self, key: &ActorKey) -> Gesture {
        Gesture {
            author: key.address(),
            family: Family::Registration,
            middle: None,
            target: prepare::Target::Node(NodeId::Prof(key.address())),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
            deps: vec![],
            payload: b"profile".to_vec(),
            node: None,
        }
    }

    /// Runs the device's two signing steps against a prepared staged
    /// write, leaving it relaying.
    async fn sign_and_relay(&self, id: Uuid, key: &ActorKey) {
        let write = staged::load(&self.pool, id).await.expect("loads");
        let pre = PreSigned::sign(key, write.proposal);
        let sealed =
            relay::submit_pre_signed(&self.boundary, &self.pool, id, PreSignedParts::from(&pre))
                .await
                .expect("seals");
        let host_key = self.boundary.host_public_key().await.expect("host key");
        let witness = pre.approve(key, &sealed, &host_key).expect("approves");
        relay::submit_approval(&self.boundary, &self.pool, id, witness.approval_signature)
            .await
            .expect("relays");
    }

    /// Closes the epoch and runs the ingestion pass.
    async fn close_and_ingest(&self) -> api::ingest::IngestOutcome {
        self.standin.close_epoch().await.expect("closes");
        let outcome = api::ingest::ingest_pending(&self.boundary, &self.pool, GC)
            .await
            .expect("ingests");
        assert!(
            outcome.promotion_failures.is_empty(),
            "confirm-side promotion failed: {:?}",
            outcome.promotion_failures
        );
        outcome
    }
}

/// The whole write path in order. Confirmation is asynchronous — the
/// ingestion pass is what lands the record — and the landed act has
/// debited θ from the author's residual balance.
///
/// The write path runs its five steps in order, confirmation being asynchronous and the landed act having debited the author's residual balance.
/// ´claim:relay:the-five-steps-land-and-confirm´
#[sqlx::test(migrations = "../../migrations")]
async fn the_five_steps_land_a_record_and_confirm_the_staged_write(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;

    let prepared = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        actor_id,
        rig.registration(&key),
    )
    .await
    .expect("prepares");
    assert_eq!(prepared.proposal.body.seq, 0);
    assert_eq!(prepared.gc_after_epochs, GC);
    assert_eq!(
        staged::load(&rig.pool, prepared.id)
            .await
            .expect("loads")
            .state,
        StagedState::AwaitingPreSign
    );

    rig.sign_and_relay(prepared.id, &key).await;
    assert_eq!(
        staged::load(&rig.pool, prepared.id)
            .await
            .expect("loads")
            .state,
        StagedState::Relaying
    );

    let outcome = rig.close_and_ingest().await;
    assert_eq!(outcome.epochs, 1);
    assert_eq!(outcome.promoted.len(), 1);
    assert_eq!(outcome.promoted[0].id, prepared.id);
    assert_eq!(outcome.promoted[0].actor_id, actor_id);
    assert_eq!(
        staged::load(&rig.pool, prepared.id)
            .await
            .expect("loads")
            .state,
        StagedState::Landed
    );
    assert_eq!(
        mirror::record_ids_in_epoch(&rig.pool, 1)
            .await
            .expect("ids"),
        vec![prepared.proposal.body.act_id().to_string()]
    );

    let balance = rig.boundary.balance(&key.address()).await.expect("balance");
    assert_eq!(balance.action_count, 1);
    assert!(balance.balance < balance.burned_total);
}

/// Prepare allocates consecutive author-local sequence values.
/// ´claim:relay:prepare-allocates-consecutively´
#[sqlx::test(migrations = "../../migrations")]
async fn prepare_allocates_consecutive_sequence_values(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    for expected_seq in 0..2u64 {
        let prepared = prepare::prepare(
            &rig.boundary,
            &rig.pool,
            GC,
            actor_id,
            rig.registration(&key),
        )
        .await
        .expect("prepares");
        assert_eq!(prepared.proposal.body.seq, expected_seq);
    }
}

/// Three formation faults are refused at prepare, before anything is
/// staged: parameters off Registration's census-fixed `(1, 1)`, an
/// Opinion aimed at a raw address atom, and a payload past the published
/// carriage bound M_payload. No refusal leaves a staged write behind.
///
/// A formation fault is refused at prepare, before anything is staged, and no such refusal leaves a staged write behind.
/// ´claim:relay:formation-faults-refuse-before-staging´
#[sqlx::test(migrations = "../../migrations")]
async fn prepare_refuses_a_malformed_gesture_before_staging(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;

    let mut bad_params = rig.registration(&key);
    bad_params.p_d = 0.5;
    assert!(matches!(
        prepare::prepare(&rig.boundary, &rig.pool, GC, actor_id, bad_params).await,
        Err(PrepareError::Formation(_))
    ));

    let mut bad_target = rig.registration(&key);
    bad_target.family = Family::Opinion;
    bad_target.target = prepare::Target::Node(NodeId::Addr(key.address()));
    assert!(matches!(
        prepare::prepare(&rig.boundary, &rig.pool, GC, actor_id, bad_target).await,
        Err(PrepareError::Formation(_))
    ));

    let mut oversized = rig.registration(&key);
    oversized.payload = vec![0; StandInConfig::default().max_payload_bytes + 1];
    assert!(matches!(
        prepare::prepare(&rig.boundary, &rig.pool, GC, actor_id, oversized).await,
        Err(PrepareError::Formation(_))
    ));

    let staged_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM staged_writes")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(staged_count, 0);
}

/// An author with no burn has b_i = 0 < θ. That is a normal, visible
/// account state rather than an auth fault, and prepare says so.
///
/// An unfunded author is a normal, visible account state rather than an auth fault, and prepare says so.
/// ´claim:relay:an-unfunded-author-is-a-visible-state´
#[sqlx::test(migrations = "../../migrations")]
async fn prepare_surfaces_an_unfunded_author_as_a_write_rule_state(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let key = ActorKey::generate();
    let id = Uuid::new_v4();
    let mut conn = rig.pool.acquire().await.expect("conn");
    genesis::insert_actor(
        &mut conn,
        id,
        "user",
        "pauper",
        &key.public_key_bytes(),
        &key.address(),
    )
    .await
    .expect("actor row");

    match prepare::prepare(&rig.boundary, &rig.pool, GC, id, rig.registration(&key)).await {
        Err(PrepareError::WriteRule { balance, theta }) => {
            assert_eq!(balance, 0.0);
            assert!(theta > 0.0);
        }
        other => panic!("expected a write-rule refusal, got {other:?}"),
    }
}

/// A garbage signature is refused per act and leaves nothing on L1. The
/// write returns to `awaiting_pre_sign`, so the honest signature then
/// seals on the retry.
///
/// A garbage signature is refused per act and leaves nothing on the substrate, the write returning to await its pre-signature so an honest one seals on the retry.
/// ´claim:relay:a-bad-signature-leaves-the-write-retryable´
#[sqlx::test(migrations = "../../migrations")]
async fn a_bad_pre_signature_is_refused_and_the_device_can_retry(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let prepared = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        actor_id,
        rig.registration(&key),
    )
    .await
    .expect("prepares");

    let garbage = PreSignedParts {
        author_pubkey: key.public_key_bytes(),
        content_nonce: vec![0; 32],
        dependency_nonce: vec![1; 32],
        pre_signature: vec![0; 64],
    };
    assert!(matches!(
        relay::submit_pre_signed(&rig.boundary, &rig.pool, prepared.id, garbage).await,
        Err(RelayError::SignatureInvalid(_))
    ));
    assert_eq!(
        staged::load(&rig.pool, prepared.id)
            .await
            .expect("loads")
            .state,
        StagedState::AwaitingPreSign
    );
    rig.sign_and_relay(prepared.id, &key).await;
}

/// A client that lost the response re-submits and gets the stored act
/// back rather than a substrate conflict. Approval retries are
/// idempotent the same way.
///
/// A client that lost the response re-submits and is handed the stored act back rather than a substrate conflict, approval retrying the same way.
/// ´claim:relay:a-replay-is-answered-from-the-stored-seal´
#[sqlx::test(migrations = "../../migrations")]
async fn a_lost_response_replays_the_stored_seal(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let prepared = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        actor_id,
        rig.registration(&key),
    )
    .await
    .expect("prepares");

    let write = staged::load(&rig.pool, prepared.id).await.expect("loads");
    let pre = PreSigned::sign(&key, write.proposal);
    let parts = PreSignedParts::from(&pre);
    let first = relay::submit_pre_signed(&rig.boundary, &rig.pool, prepared.id, parts.clone())
        .await
        .expect("seals");
    let second = relay::submit_pre_signed(&rig.boundary, &rig.pool, prepared.id, parts)
        .await
        .expect("replays");
    assert_eq!(first, second);

    let host_key = rig.boundary.host_public_key().await.expect("host key");
    let witness = pre.approve(&key, &first, &host_key).expect("approves");
    relay::submit_approval(
        &rig.boundary,
        &rig.pool,
        prepared.id,
        witness.approval_signature.clone(),
    )
    .await
    .expect("relays");
    relay::submit_approval(
        &rig.boundary,
        &rig.pool,
        prepared.id,
        witness.approval_signature,
    )
    .await
    .expect("relays again");
}

/// A re-signing client submitting different bytes is refused: answering
/// with the stored act would tell it that its new bytes were sealed. The
/// sealed handshake survives the refusal, so the exact replay still
/// answers.
///
/// A re-submission of different bytes is refused rather than answered, since answering would tell the client its new bytes were sealed, and the sealed handshake survives to answer the exact replay.
/// ´claim:relay:a-differing-resubmission-is-refused´
#[sqlx::test(migrations = "../../migrations")]
async fn a_differing_resubmission_is_refused_not_answered(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let prepared = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        actor_id,
        rig.registration(&key),
    )
    .await
    .expect("prepares");

    let write = staged::load(&rig.pool, prepared.id).await.expect("loads");
    let pre = PreSigned::sign(&key, write.proposal);
    let parts = PreSignedParts::from(&pre);
    let sealed = relay::submit_pre_signed(&rig.boundary, &rig.pool, prepared.id, parts.clone())
        .await
        .expect("seals");

    let differing = PreSignedParts {
        content_nonce: vec![9; 32],
        ..parts.clone()
    };
    assert!(matches!(
        relay::submit_pre_signed(&rig.boundary, &rig.pool, prepared.id, differing).await,
        Err(RelayError::ReplayMismatch(id)) if id == prepared.id
    ));

    let replayed = relay::submit_pre_signed(&rig.boundary, &rig.pool, prepared.id, parts)
        .await
        .expect("replays");
    assert_eq!(sealed, replayed);
}

/// Approval before the seal exists is refused on state, and an approval
/// of a sealed act carrying a garbage witness signature is refused by the
/// host.
///
/// Approval before the seal exists is refused on state, and one carrying a garbage witness signature is refused by the host.
/// ´claim:relay:approval-is-refused-out-of-order-or-unwitnessed´
#[sqlx::test(migrations = "../../migrations")]
async fn approval_is_refused_out_of_order_and_on_a_bad_witness(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let prepared = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        actor_id,
        rig.registration(&key),
    )
    .await
    .expect("prepares");

    assert!(matches!(
        relay::submit_approval(&rig.boundary, &rig.pool, prepared.id, vec![0; 64]).await,
        Err(RelayError::Staged(staged::StagedError::WrongState { .. }))
    ));

    let write = staged::load(&rig.pool, prepared.id).await.expect("loads");
    let pre = PreSigned::sign(&key, write.proposal);
    relay::submit_pre_signed(
        &rig.boundary,
        &rig.pool,
        prepared.id,
        PreSignedParts::from(&pre),
    )
    .await
    .expect("seals");
    assert!(matches!(
        relay::submit_approval(&rig.boundary, &rig.pool, prepared.id, vec![0; 64]).await,
        Err(RelayError::SignatureInvalid(_))
    ));
    assert_eq!(
        staged::load(&rig.pool, prepared.id)
            .await
            .expect("loads")
            .state,
        StagedState::AwaitingApproval
    );
}

/// Simulates a relay crash between the substrate's seal and our store:
/// the act is sealed on L1 directly while the staged write still believes
/// it is awaiting the pre-signature. The relay's own submission then
/// conflicts, and because the salts are gone no approval can ever be
/// produced — terminal, so the device re-prepares and gets a fresh
/// sequence value.
///
/// A seal lost between the substrate and the store is terminal: no approval can ever be produced, so the device re-prepares at a fresh sequence value.
/// ´claim:relay:a-lost-seal-is-terminal´
#[sqlx::test(migrations = "../../migrations")]
async fn a_seal_lost_before_storing_expires_the_write(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let prepared = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        actor_id,
        rig.registration(&key),
    )
    .await
    .expect("prepares");

    let write = staged::load(&rig.pool, prepared.id).await.expect("loads");
    let pre = PreSigned::sign(&key, write.proposal);
    rig.boundary
        .seal(pre.submission())
        .await
        .expect("seals on L1");

    assert!(matches!(
        relay::submit_pre_signed(&rig.boundary, &rig.pool, prepared.id, PreSignedParts::from(&pre)).await,
        Err(RelayError::Wedged(id)) if id == prepared.id
    ));
    assert_eq!(
        staged::load(&rig.pool, prepared.id)
            .await
            .expect("loads")
            .state,
        StagedState::Expired
    );

    let again = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        actor_id,
        rig.registration(&key),
    )
    .await
    .expect("prepares again");
    assert_eq!(again.proposal.body.seq, 1);
}

/// A write prepared and abandoned before its device ever signs is
/// collected once the epoch clock — driven here by another actor's writes
/// — passes the GC bound. Expiry is the first phase of that: the write
/// reaches its terminal state and stops serving content, while the
/// payload rides the row until the reap, so a record landing in that
/// window still promotes (data-model.md "Staged writes").
///
/// A write abandoned before signing is collected once the epoch clock passes its bound, expiry stopping the content while the payload rides the row until the reap.
/// ´claim:relay:an-abandoned-write-is-collected´
#[sqlx::test(migrations = "../../migrations")]
async fn the_ingestion_pass_collects_writes_that_never_land(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let (walker_id, walker) = rig.funded_actor("walker").await;

    let abandoned = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        actor_id,
        rig.registration(&key),
    )
    .await
    .expect("prepares");

    for _ in 0..GC {
        let w = prepare::prepare(
            &rig.boundary,
            &rig.pool,
            GC,
            walker_id,
            rig.registration(&walker),
        )
        .await
        .expect("prepares");
        rig.sign_and_relay(w.id, &walker).await;
        rig.close_and_ingest().await;
    }

    let w = staged::load(&rig.pool, abandoned.id).await.expect("loads");
    assert_eq!(w.state, StagedState::Expired);
    assert!(!w.proposal.payload.is_empty());

    staged::reap_expired(&rig.pool, 1_000, GC)
        .await
        .expect("reaps");
    assert!(matches!(
        staged::load(&rig.pool, abandoned.id).await,
        Err(staged::StagedError::NotFound(_))
    ));
}

impl Rig {
    async fn prepared_registration(&self, actor_id: Uuid, key: &ActorKey) -> Uuid {
        prepare::prepare(
            &self.boundary,
            &self.pool,
            GC,
            actor_id,
            self.registration(key),
        )
        .await
        .expect("prepares")
        .id
    }

    /// The stand-in's rows for one act: none means nothing reached the host.
    async fn host_rows(&self, act_id: &str) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM l1_acts WHERE act_id = $1")
            .bind(act_id)
            .fetch_one(&self.pool)
            .await
            .expect("counts")
    }

    /// The stand-in's row for one act as text, every column rendered —
    /// bytes as their hex — for a search of what the host holds.
    async fn host_row_text(&self, act_id: &str) -> String {
        sqlx::query_scalar("SELECT row_to_json(a)::text FROM l1_acts a WHERE act_id = $1")
            .bind(act_id)
            .fetch_one(&self.pool)
            .await
            .expect("the host's row")
    }

    /// Asserts a refused submission left the write unsigned: still
    /// awaiting its pre-signature, holding no pre-commitment leg, so no
    /// staged row is left that a later relay could submit.
    async fn assert_unsigned(&self, id: Uuid) {
        let write = staged::load(&self.pool, id).await.expect("loads");
        assert_eq!(write.state, StagedState::AwaitingPreSign);
        assert!(write.pre_signed.is_none(), "nothing was recorded");
        assert_eq!(
            self.host_rows(&write.proposal.body.act_id().to_string())
                .await,
            0,
            "nothing reached the host"
        );
    }
}

/// A content nonce its author already used for another act is refused at
/// the API — CoGra carries the pair, and non-reuse is a carriage check
/// (layer1-interface.md §8.2, "Entropy custody") — before anything is
/// sent to the host: the stand-in holds no row for the second act, and its
/// staged write stays unsigned. Re-signed under a fresh content nonce, the
/// same write lands.
///
/// A content nonce reused by its author is refused before the host sees the act, and the same write re-signed under a fresh nonce lands.
/// ´claim:relay:a-reused-content-nonce-never-reaches-the-host´
#[sqlx::test(migrations = "../../migrations")]
async fn a_reused_content_nonce_is_refused_before_the_host_sees_the_act(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let first = rig.prepared_registration(actor_id, &key).await;
    let second = rig.prepared_registration(actor_id, &key).await;

    let write = staged::load(&rig.pool, first).await.expect("loads");
    let used = PreSigned::sign(&key, write.proposal);
    relay::submit_pre_signed(&rig.boundary, &rig.pool, first, PreSignedParts::from(&used))
        .await
        .expect("the first use seals");

    let write = staged::load(&rig.pool, second).await.expect("loads");
    let reused = PreSigned::sign_with_nonces(
        &key,
        write.proposal.clone(),
        used.content_nonce.clone(),
        vec![0x5a; 32],
    );
    assert!(
        reused.submission().verify_pre_commitment().is_ok(),
        "the reuse is the only fault: the host would seal it"
    );
    let refused = relay::submit_pre_signed(
        &rig.boundary,
        &rig.pool,
        second,
        PreSignedParts::from(&reused),
    )
    .await;
    assert!(
        matches!(&refused, Err(RelayError::Carriage(m)) if m.contains("already used")),
        "got {refused:?}"
    );
    rig.assert_unsigned(second).await;

    rig.sign_and_relay(second, &key).await;
    rig.close_and_ingest().await;
    assert_eq!(
        staged::load(&rig.pool, second).await.expect("loads").state,
        StagedState::Landed
    );
}

/// The other carriage checks refuse the same way, each before anything
/// reaches the host and each on a write whose signature is otherwise good:
/// a content nonce equal to the dependency nonce — the host keeps the
/// dependency nonce, so anyone reading its rows could test payload
/// guesses against P — a content nonce or a dependency nonce off the
/// published length, and a payload past M_payload. For each, the same
/// staged write re-signed without the fault lands.
///
/// A content pair failing a carriage check is refused before the host sees the act, and the write re-signed without the fault lands.
/// ´claim:relay:a-failed-carriage-check-never-reaches-the-host´
#[sqlx::test(migrations = "../../migrations")]
async fn a_content_pair_failing_a_carriage_check_never_reaches_the_host(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let max = StandInConfig::default().max_payload_bytes;
    let cases: [(&str, Vec<u8>, Vec<u8>, bool); 4] = [
        (
            "repeats the dependency nonce",
            vec![0x11; 32],
            vec![0x11; 32],
            false,
        ),
        (
            "content nonce is 31 bytes",
            vec![0x22; 31],
            vec![0x23; 32],
            false,
        ),
        (
            "dependency nonce is 33 bytes",
            vec![0x33; 32],
            vec![0x34; 33],
            false,
        ),
        ("exceeds M_payload", vec![0x44; 32], vec![0x45; 32], true),
    ];
    let mut ids = Vec::new();
    for (case, content_nonce, dependency_nonce, oversized) in cases {
        let id = rig.prepared_registration(actor_id, &key).await;
        let original = staged::load(&rig.pool, id).await.expect("loads").proposal;
        if oversized {
            sqlx::query("UPDATE staged_writes SET payload = $2 WHERE id = $1")
                .bind(id)
                .bind(vec![0x55u8; max + 1])
                .execute(&rig.pool)
                .await
                .expect("the fixture grows the staged payload past the bound");
        }
        let write = staged::load(&rig.pool, id).await.expect("loads");
        let faulty =
            PreSigned::sign_with_nonces(&key, write.proposal, content_nonce, dependency_nonce);
        let refused =
            relay::submit_pre_signed(&rig.boundary, &rig.pool, id, PreSignedParts::from(&faulty))
                .await;
        assert!(
            matches!(refused, Err(RelayError::Carriage(_))),
            "{case}: got {refused:?}"
        );
        rig.assert_unsigned(id).await;
        if oversized {
            sqlx::query("UPDATE staged_writes SET payload = $2 WHERE id = $1")
                .bind(id)
                .bind(&original.payload)
                .execute(&rig.pool)
                .await
                .expect("restores the payload");
        }
        rig.sign_and_relay(id, &key).await;
        ids.push(id);
    }
    rig.close_and_ingest().await;
    for id in ids {
        assert_eq!(
            staged::load(&rig.pool, id).await.expect("loads").state,
            StagedState::Landed
        );
    }
}

/// The stand-in's row for an act written through the API holds neither the
/// payload nor the content nonce at any stage — sealed, approved, accepted
/// — while it does hold the dependency nonce, the control that the search
/// sees bytes at all (layer1-interface.md §8.2: the host's checks never
/// need the pair, and CoGra is its carrier). The pair sits in CoGra's
/// carriage once the record lands.
///
/// The host's row for an act written through the API never holds the payload or the content nonce.
/// ´claim:relay:the-host-never-holds-the-content-pair´
#[sqlx::test(migrations = "../../migrations")]
async fn the_host_never_holds_the_content_pair_of_an_api_write(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let id = rig.prepared_registration(actor_id, &key).await;
    let write = staged::load(&rig.pool, id).await.expect("loads");
    let act_id = write.proposal.body.act_id().to_string();
    let payload_hex = hex::encode(&write.proposal.payload);
    let pre = PreSigned::sign(&key, write.proposal);
    let content_hex = hex::encode(&pre.content_nonce);
    let dependency_hex = hex::encode(&pre.dependency_nonce);
    let check = |row: String, stage: &str| {
        assert!(!row.contains(&payload_hex), "{stage}: the payload");
        assert!(!row.contains(&content_hex), "{stage}: the content nonce");
        assert!(row.contains(&dependency_hex), "{stage}: the control");
    };

    let sealed = relay::submit_pre_signed(&rig.boundary, &rig.pool, id, PreSignedParts::from(&pre))
        .await
        .expect("seals");
    check(rig.host_row_text(&act_id).await, "sealed");
    let host_key = rig.boundary.host_public_key().await.expect("host key");
    let witness = pre.approve(&key, &sealed, &host_key).expect("approves");
    relay::submit_approval(&rig.boundary, &rig.pool, id, witness.approval_signature)
        .await
        .expect("relays");
    check(rig.host_row_text(&act_id).await, "approved");
    rig.close_and_ingest().await;
    check(rig.host_row_text(&act_id).await, "accepted");

    let carriage = postgres_store::content::act_payload(&rig.pool, &act_id)
        .await
        .expect("reads")
        .expect("carried");
    assert_eq!(carriage.content_nonce, Some(pre.content_nonce.clone()));
}
