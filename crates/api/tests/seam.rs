//! Seam + ingestion integration: a signed record submitted through the
//! L1 boundary lands in the mirror once the epoch closes — the slice-0
//! hand test, automated (roadmap.md Slice 0).

use api::l1::{L1Boundary, StandInBoundary};
use common::l1::Family;
use common::l1::client::ActorKey;
use common::l1::handshake::{Proposal, StructuralBody};
use common::l1::identifier::NodeId;
use common::l1::proposal::PreSigned;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::mirror;
use sqlx::PgPool;

fn registration(actor: &ActorKey) -> Proposal {
    Proposal {
        body: StructuralBody {
            author: actor.address(),
            seq: 0,
            family: Family::Registration,
            middle: None,
            target: NodeId::Prof(actor.address()),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        },
        payload: b"profile".to_vec(),
        deps: vec![],
    }
}

/// Both relay legs go through the boundary trait, and the record lands
/// only once the epoch closes: an ingestion pass before the close moves
/// nothing, the pass after it advances the cursor, and a further pass is
/// a no-op because ingestion resumes from that cursor. The B_i read
/// through the boundary then shows the debit consummated.
///
/// Both relay legs cross the boundary trait and the record lands only once the epoch closes, ingestion resuming from its cursor so a further pass moves nothing.
/// ´claim:relay:a-record-crosses-the-seam-at-the-epoch-close´
#[sqlx::test(migrations = "../../migrations")]
async fn a_record_crosses_the_seam_into_the_mirror(pool: PgPool) {
    let standin = StandIn::new(pool.clone(), StandInConfig::default());
    let boundary = StandInBoundary(standin.clone());
    let actor = ActorKey::generate();
    standin
        .credit_burn(&actor.address(), 10_000_000)
        .await
        .expect("burn");

    let proposal = registration(&actor);
    let act_id = proposal.body.act_id();
    let pre = PreSigned::sign(&actor, proposal);
    let sealed = boundary.seal(pre.submission()).await.expect("seals");
    let host_key = boundary.host_public_key().await.expect("host key");
    let witness = pre.approve(&actor, &sealed, &host_key).expect("approves");
    boundary.approve(witness).await.expect("approved");

    let outcome = api::ingest::ingest_pending(&boundary, &pool, 8)
        .await
        .expect("pass");
    assert_eq!(outcome.epochs, 0);
    assert_eq!(
        mirror::last_ingested_epoch(&pool).await.expect("cursor"),
        0,
        "the empty boundary"
    );

    standin.close_epoch().await.expect("closes");
    let outcome = api::ingest::ingest_pending(&boundary, &pool, 8)
        .await
        .expect("pass");
    assert_eq!(outcome.epochs, 1);
    assert_eq!(
        mirror::last_ingested_epoch(&pool).await.expect("cursor"),
        1,
        "the first epoch is epoch 1"
    );
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 1).await.expect("ids"),
        vec![act_id.to_string()]
    );

    let outcome = api::ingest::ingest_pending(&boundary, &pool, 8)
        .await
        .expect("pass");
    assert_eq!(outcome.epochs, 0);

    let balance = boundary.balance(&actor.address()).await.expect("balance");
    assert_eq!(balance.action_count, 1);
    assert!(balance.balance < balance.burned_total);
}

/// The write-rule pre-check prices a batch exactly, the way the close
/// debits it: a balance of exactly θ × acts carries the batch and one
/// micro-unit less does not. Fifteen acts at the reference θ (0.050186)
/// is a count where a binary floating-point product lands above the
/// exact balance, so a float comparison would refuse an affordable
/// batch. The refusal names both numbers.
///
/// The pre-check decides a balance of exactly the batch's price as affordable, one micro-unit less as not.
/// ´claim:relay:the-write-rule-pre-check-is-exact´
#[sqlx::test(migrations = "../../migrations")]
async fn the_write_rule_pre_check_is_exact_at_the_boundary(pool: PgPool) {
    const ACTS: usize = 15;
    let standin = StandIn::new(pool.clone(), StandInConfig::default());
    let boundary = StandInBoundary(standin.clone());
    let theta = standin.current_theta().await.expect("θ");
    assert_eq!(theta, l1_standin::REFERENCE_THETA_MICRO);
    let price = theta * ACTS as i64;

    let exact = ActorKey::generate();
    standin
        .credit_burn(&exact.address(), price)
        .await
        .expect("burn");
    api::prepare::check_batch_solvency(&boundary, &exact.address(), ACTS)
        .await
        .expect("a balance of exactly θ × acts carries the batch");

    let short = ActorKey::generate();
    standin
        .credit_burn(&short.address(), price - 1)
        .await
        .expect("burn");
    match api::prepare::check_batch_solvency(&boundary, &short.address(), ACTS).await {
        Err(e @ api::prepare::PrepareError::BatchWriteRule { acts: ACTS, .. }) => {
            let message = e.to_string();
            assert!(message.contains("0.752789"), "names the balance: {message}");
            assert!(message.contains("0.050186"), "names θ: {message}");
        }
        other => panic!("expected a batch write-rule refusal, got {other:?}"),
    }
}

/// X-SR3 across the seam: each ingested epoch carries the boundary
/// timestamp its package asserts, and an epoch the mirror took in before
/// the package carried one is filled from the published sequence on the
/// next pass — through the seam, never from the stand-in's tables.
///
/// Every ingested epoch carries its asserted instant, and a missing one is filled from the published sequence.
/// ´claim:relay:epoch-instants-cross-the-seam´
#[sqlx::test(migrations = "../../migrations")]
async fn epoch_instants_cross_the_seam_and_missing_ones_are_filled(pool: PgPool) {
    let standin = StandIn::new(pool.clone(), StandInConfig::default());
    let boundary = StandInBoundary(standin.clone());
    for _ in 0..2 {
        let actor = ActorKey::generate();
        standin
            .credit_burn(&actor.address(), 10_000_000)
            .await
            .expect("burn");
        let pre = PreSigned::sign(&actor, registration(&actor));
        let sealed = boundary.seal(pre.submission()).await.expect("seals");
        let host_key = boundary.host_public_key().await.expect("host key");
        let witness = pre.approve(&actor, &sealed, &host_key).expect("approves");
        boundary.approve(witness).await.expect("approved");
        standin.close_epoch().await.expect("closes");
    }
    api::ingest::ingest_pending(&boundary, &pool, 8)
        .await
        .expect("pass");
    let asserted: Vec<(i64, chrono::DateTime<chrono::Utc>)> = boundary
        .epochs_since(0)
        .await
        .expect("published")
        .into_iter()
        .map(|p| (p.epoch, p.asserted_at))
        .collect();
    assert_eq!(asserted.len(), 2);
    assert_eq!(
        asserted.iter().map(|(epoch, _)| *epoch).collect::<Vec<_>>(),
        vec![1, 2]
    );
    let mirrored = mirror::epoch_instants(&pool, &[1, 2])
        .await
        .expect("instants");
    for (epoch, at) in &asserted {
        assert_eq!(mirrored[epoch], *at);
    }

    sqlx::query("DELETE FROM mirror_epochs")
        .execute(&pool)
        .await
        .expect("forget the instants");
    assert_eq!(
        mirror::first_epoch_without_instant(&pool)
            .await
            .expect("gap"),
        Some(1)
    );
    let outcome = api::ingest::ingest_pending(&boundary, &pool, 8)
        .await
        .expect("pass");
    assert_eq!(outcome.epochs, 0);
    assert_eq!(
        mirror::first_epoch_without_instant(&pool)
            .await
            .expect("gap"),
        None
    );
    let refilled = mirror::epoch_instants(&pool, &[1, 2])
        .await
        .expect("instants");
    for (epoch, at) in &asserted {
        assert_eq!(refilled[epoch], *at);
    }
}

/// The clock closes epochs whether or not anything is orderable, and an
/// empty package crosses the seam like any other: ingestion takes it in,
/// records its instant, and advances the cursor past it, so the epoch a
/// record lands in afterwards is the next one. Nothing in the mirror
/// stands for the empty epoch but its instant.
///
/// An empty epoch package crosses the seam and advances the mirror's cursor.
/// ´claim:relay:an-empty-epoch-crosses-the-seam´
#[sqlx::test(migrations = "../../migrations")]
async fn an_empty_epoch_crosses_the_seam(pool: PgPool) {
    let standin = StandIn::new(pool.clone(), StandInConfig::default());
    let boundary = StandInBoundary(standin.clone());
    for _ in 0..3 {
        assert!(
            standin
                .close_epoch()
                .await
                .expect("closes")
                .records
                .is_empty()
        );
    }
    let outcome = api::ingest::ingest_pending(&boundary, &pool, 8)
        .await
        .expect("pass");
    assert_eq!(outcome.epochs, 3);
    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 3);
    assert_eq!(
        mirror::epoch_instants(&pool, &[1, 2, 3])
            .await
            .expect("instants")
            .len(),
        3,
        "every empty epoch has its instant"
    );
    assert!(
        mirror::record_ids_in_epoch(&pool, 2)
            .await
            .expect("ids")
            .is_empty()
    );

    let actor = ActorKey::generate();
    standin
        .credit_burn(&actor.address(), 10_000_000)
        .await
        .expect("burn");
    let proposal = registration(&actor);
    let act_id = proposal.body.act_id();
    let pre = PreSigned::sign(&actor, proposal);
    let sealed = boundary.seal(pre.submission()).await.expect("seals");
    let host_key = boundary.host_public_key().await.expect("host key");
    let witness = pre.approve(&actor, &sealed, &host_key).expect("approves");
    boundary.approve(witness).await.expect("approved");
    standin.close_epoch().await.expect("closes");
    let outcome = api::ingest::ingest_pending(&boundary, &pool, 8)
        .await
        .expect("pass");
    assert_eq!(outcome.epochs, 1);
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 4).await.expect("ids"),
        vec![act_id.to_string()]
    );
}
