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
use l1_standin::{StandIn, StandInConfig};
use postgres_store::staged::{self, PreSignedParts, StagedBy, StagedState};
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
            target: NodeId::Prof(key.address()),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
            deps: vec![],
            payload: b"profile".to_vec(),
        }
    }

    /// Runs the device's two signing steps against a prepared staged
    /// write, leaving it relaying.
    async fn sign_and_relay(&self, id: Uuid, key: &ActorKey) {
        let write = staged::load(&self.pool, id).await.expect("loads");
        let pre = key.pre_sign(write.proposal);
        let parts = PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        };
        let sealed = relay::submit_pre_signed(&self.boundary, &self.pool, id, parts)
            .await
            .expect("seals");
        let host_key = self.boundary.host_public_key().await.expect("host key");
        let witness = key.approve(&pre, &sealed, &host_key).expect("approves");
        relay::submit_approval(&self.boundary, &self.pool, id, witness.approval_signature)
            .await
            .expect("relays");
    }

    /// Closes the epoch and runs the ingestion pass.
    async fn close_and_ingest(&self) -> api::ingest::IngestOutcome {
        self.standin.close_epoch().await.expect("closes");
        api::ingest::ingest_pending(&self.boundary, &self.pool, GC)
            .await
            .expect("ingests")
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_five_steps_land_a_record_and_confirm_the_staged_write(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;

    let prepared = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        StagedBy::Actor(actor_id),
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

    // Confirm is asynchronous: the ingestion pass lands it.
    let outcome = rig.close_and_ingest().await;
    assert_eq!(outcome.epochs, 1);
    assert_eq!(outcome.promoted.len(), 1);
    assert_eq!(outcome.promoted[0].id, prepared.id);
    assert_eq!(outcome.promoted[0].staged_by, StagedBy::Actor(actor_id));
    assert_eq!(
        staged::load(&rig.pool, prepared.id)
            .await
            .expect("loads")
            .state,
        StagedState::Landed
    );
    assert_eq!(
        mirror::record_ids_in_epoch(&rig.pool, 0)
            .await
            .expect("ids"),
        vec![prepared.proposal.body.act_id().to_string()]
    );

    // The act debited θ from the author's residual balance.
    let balance = rig.boundary.balance(&key.address()).await.expect("balance");
    assert_eq!(balance.action_count, 1);
    assert!(balance.balance < balance.burned_total);
}

#[sqlx::test(migrations = "../../migrations")]
async fn prepare_allocates_consecutive_sequence_values(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    for expected_seq in 0..2u64 {
        let prepared = prepare::prepare(
            &rig.boundary,
            &rig.pool,
            GC,
            StagedBy::Actor(actor_id),
            rig.registration(&key),
        )
        .await
        .expect("prepares");
        assert_eq!(prepared.proposal.body.seq, expected_seq);
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn prepare_refuses_a_malformed_gesture_before_staging(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;

    // Registration's parameters are census-fixed at (1, 1).
    let mut bad_params = rig.registration(&key);
    bad_params.p_d = 0.5;
    assert!(matches!(
        prepare::prepare(
            &rig.boundary,
            &rig.pool,
            GC,
            StagedBy::Actor(actor_id),
            bad_params
        )
        .await,
        Err(PrepareError::Formation(_))
    ));

    // An Opinion cannot target a raw address atom.
    let mut bad_target = rig.registration(&key);
    bad_target.family = Family::Opinion;
    bad_target.target = NodeId::Addr(key.address());
    assert!(matches!(
        prepare::prepare(
            &rig.boundary,
            &rig.pool,
            GC,
            StagedBy::Actor(actor_id),
            bad_target
        )
        .await,
        Err(PrepareError::Formation(_))
    ));

    // Nothing was staged by either refusal.
    let staged_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM staged_writes")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(staged_count, 0);
}

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

    // No burn: b_i = 0 < θ — a normal, visible account state.
    match prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        StagedBy::Actor(id),
        rig.registration(&key),
    )
    .await
    {
        Err(PrepareError::WriteRule { balance, theta }) => {
            assert_eq!(balance, 0.0);
            assert!(theta > 0.0);
        }
        other => panic!("expected a write-rule refusal, got {other:?}"),
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_bad_pre_signature_is_refused_and_the_device_can_retry(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let prepared = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        StagedBy::Actor(actor_id),
        rig.registration(&key),
    )
    .await
    .expect("prepares");

    // Garbage signature: refused per act, nothing exists on L1.
    let garbage = PreSignedParts {
        author_pubkey: key.public_key_bytes(),
        nonce: vec![0; 32],
        pre_signature: vec![0; 64],
    };
    assert!(matches!(
        relay::submit_pre_signed(&rig.boundary, &rig.pool, prepared.id, garbage).await,
        Err(RelayError::SignatureInvalid(_))
    ));
    // The write returned to awaiting_pre_sign for the retry…
    assert_eq!(
        staged::load(&rig.pool, prepared.id)
            .await
            .expect("loads")
            .state,
        StagedState::AwaitingPreSign
    );
    // …and the honest signature then seals.
    rig.sign_and_relay(prepared.id, &key).await;
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_lost_response_replays_the_stored_seal(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let prepared = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        StagedBy::Actor(actor_id),
        rig.registration(&key),
    )
    .await
    .expect("prepares");

    let write = staged::load(&rig.pool, prepared.id).await.expect("loads");
    let pre = key.pre_sign(write.proposal);
    let parts = PreSignedParts {
        author_pubkey: pre.author_pubkey.clone(),
        nonce: pre.nonce.clone(),
        pre_signature: pre.pre_signature.clone(),
    };
    let first = relay::submit_pre_signed(&rig.boundary, &rig.pool, prepared.id, parts.clone())
        .await
        .expect("seals");
    // The client re-submits after losing the response: the stored act
    // comes back instead of a substrate conflict.
    let second = relay::submit_pre_signed(&rig.boundary, &rig.pool, prepared.id, parts)
        .await
        .expect("replays");
    assert_eq!(first, second);

    // Approval retries are idempotent too.
    let host_key = rig.boundary.host_public_key().await.expect("host key");
    let witness = key.approve(&pre, &first, &host_key).expect("approves");
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

#[sqlx::test(migrations = "../../migrations")]
async fn approval_is_refused_out_of_order_and_on_a_bad_witness(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let prepared = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        StagedBy::Actor(actor_id),
        rig.registration(&key),
    )
    .await
    .expect("prepares");

    // Approval before the seal exists.
    assert!(matches!(
        relay::submit_approval(&rig.boundary, &rig.pool, prepared.id, vec![0; 64]).await,
        Err(RelayError::Staged(staged::StagedError::WrongState { .. }))
    ));

    // Sealed, but the witness signature is garbage: the host refuses it.
    let write = staged::load(&rig.pool, prepared.id).await.expect("loads");
    let pre = key.pre_sign(write.proposal);
    relay::submit_pre_signed(
        &rig.boundary,
        &rig.pool,
        prepared.id,
        PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        },
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

#[sqlx::test(migrations = "../../migrations")]
async fn a_seal_lost_before_storing_expires_the_write(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let prepared = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        StagedBy::Actor(actor_id),
        rig.registration(&key),
    )
    .await
    .expect("prepares");

    // Simulate a relay crash between the substrate's seal and our store:
    // the act is sealed on L1 directly, while the staged write still
    // believes it is awaiting the pre-signature.
    let write = staged::load(&rig.pool, prepared.id).await.expect("loads");
    let pre = key.pre_sign(write.proposal);
    rig.boundary.seal(pre.clone()).await.expect("seals on L1");

    let parts = PreSignedParts {
        author_pubkey: pre.author_pubkey.clone(),
        nonce: pre.nonce.clone(),
        pre_signature: pre.pre_signature.clone(),
    };
    // The relay's own submission now conflicts: the salts are gone, no
    // approval can ever be produced — terminal, re-prepare.
    assert!(matches!(
        relay::submit_pre_signed(&rig.boundary, &rig.pool, prepared.id, parts).await,
        Err(RelayError::Wedged(id)) if id == prepared.id
    ));
    assert_eq!(
        staged::load(&rig.pool, prepared.id)
            .await
            .expect("loads")
            .state,
        StagedState::Expired
    );

    // The re-prepare mints a fresh sequence value.
    let again = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        StagedBy::Actor(actor_id),
        rig.registration(&key),
    )
    .await
    .expect("prepares again");
    assert_eq!(again.proposal.body.seq, 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_ingestion_pass_collects_writes_that_never_land(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor_id, key) = rig.funded_actor("alice").await;
    let (walker_id, walker) = rig.funded_actor("walker").await;

    // A write prepared and abandoned before its device ever signs.
    let abandoned = prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        StagedBy::Actor(actor_id),
        rig.registration(&key),
    )
    .await
    .expect("prepares");

    // Walk the epoch clock past the GC bound with another actor's writes.
    for _ in 0..GC {
        let w = prepare::prepare(
            &rig.boundary,
            &rig.pool,
            GC,
            StagedBy::Actor(walker_id),
            rig.registration(&walker),
        )
        .await
        .expect("prepares");
        rig.sign_and_relay(w.id, &walker).await;
        rig.close_and_ingest().await;
    }

    let w = staged::load(&rig.pool, abandoned.id).await.expect("loads");
    assert_eq!(w.state, StagedState::Expired);
    assert!(w.proposal.payload.is_empty());
}
