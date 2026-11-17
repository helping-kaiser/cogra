//! Integration tests for the stand-in host: the admission handshake, the
//! epoch close (ordering, causal keys, maturities, θ-debits), and the
//! published packages. Each test gets its own throwaway database via
//! `#[sqlx::test]`; the workspace migrations create the l1_* tables.
//!
//! The pure half of the close — selection, ordering, solvency, maturity —
//! is unit-tested in `close.rs` and needs no database; what lands here is
//! what only a database can show.
//!
//! **Budget: this suite runs in ≤ 25 s** (measured 2026-09-04 at 10 s for
//! 18 tests). Every test spins its own database and replays the whole
//! workspace migration set, so the cost is per test and grows with the
//! migration count, not with what is asserted.

use common::l1::Family;
use common::l1::census::LegRole;
use common::l1::client::ActorKey;
use common::l1::handshake::{ApprovalWitness, Proposal, PublishedRecord, StructuralBody};
use common::l1::identifier::{ActId, NodeId};
use common::l1::proposal::{self, PreSigned, SealedAct, Submission};
use l1_standin::{StandIn, StandInConfig, StandInError};
use sqlx::PgPool;

/// The act price every close charges: the reference, where the wall
/// controller holds at the stand-in's constant width. Funding is stated in
/// multiples of it. A test-only price is not an option — the controller
/// would step any other initialization toward the reference by 0.10 a
/// close, and every multi-close test would pay a moving price.
const THETA: i64 = l1_standin::REFERENCE_THETA_MICRO;

/// `acts` acts' worth of θ, in the units `balance` reports.
fn priced(acts: i64) -> f64 {
    (acts * THETA) as f64 / 1e6
}

fn standin(pool: PgPool) -> StandIn {
    StandIn::new(
        pool,
        StandInConfig {
            epoch_target_acts: 10_000,
            max_payload_bytes: 1024,
            ..StandInConfig::default()
        },
    )
}

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

fn opinion(actor: &ActorKey, seq: u64, target_addr: &str, deps: Vec<ActId>) -> Proposal {
    Proposal {
        body: StructuralBody {
            author: actor.address(),
            seq,
            family: Family::Opinion,
            middle: None,
            target: NodeId::Prof(target_addr.to_string()),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        },
        payload: vec![],
        deps,
    }
}

/// Runs the full handshake for a proposal; returns the approval act id.
/// The host is handed the submission alone; the content pair stays with
/// the device that approves.
async fn submit(host: &StandIn, actor: &ActorKey, proposal: Proposal) -> ActId {
    let act_id = proposal.body.act_id();
    let pre = PreSigned::sign(actor, proposal);
    land(host, actor, &pre).await;
    act_id
}

/// Seals a pre-signed proposal's submission and approves it on the device.
async fn land(host: &StandIn, actor: &ActorKey, pre: &PreSigned) -> SealedAct {
    let sealed = host.seal(pre.submission()).await.expect("seals");
    let host_key = host.host_public_key().await.expect("host key");
    let witness = pre.approve(actor, &sealed, &host_key).expect("approves");
    host.approve(witness).await.expect("approval accepted");
    sealed
}

/// The host's answer to a freshly pre-signed proposal.
async fn seal_of(
    host: &StandIn,
    actor: &ActorKey,
    proposal: Proposal,
) -> Result<SealedAct, StandInError> {
    host.seal(PreSigned::sign(actor, proposal).submission())
        .await
}

/// `n` bytes of a run starting at `from` — fixed nonces a test can find again.
fn run(from: u8, n: usize) -> Vec<u8> {
    (0..n).map(|i| from.wrapping_add(i as u8)).collect()
}

async fn funded_actor(host: &StandIn, micro: i64) -> ActorKey {
    let actor = ActorKey::generate();
    host.credit_burn(&actor.address(), micro)
        .await
        .expect("burn");
    actor
}

/// A single Registration lands, closes into its own epoch as a Binary
/// record with one leg (first edge at both endpoints, so τ = 0), and the
/// θ-debit, count increment, and burn total all land as expected. The
/// ingest read (`epochs_since`) returns the same package back.
///
/// A completed handshake closes into one published record, and the ingest read returns it unchanged.
/// ´claim:handshake:a-completed-act-closes-into-a-published-record´
#[sqlx::test(migrations = "../../migrations")]
async fn handshake_lands_a_record(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 3 * THETA).await;
    let act_id = submit(&host, &actor, registration(&actor)).await;

    let package = host.close_epoch().await.expect("closes");
    assert_eq!(package.epoch, 1, "epochs number from 1");
    assert_eq!(package.records.len(), 1);
    let record = &package.records[0];
    assert_eq!(record.act_id, act_id);
    assert_eq!(record.family, Family::Registration);
    assert_eq!(record.epoch, 1);
    assert_eq!(record.act_time, 1);
    assert_eq!(record.position, 1, "positions number from 1");
    assert_eq!(record.legs.len(), 1);
    let leg = &record.legs[0];
    assert_eq!(leg.role, LegRole::Binary);
    assert_eq!(leg.source, NodeId::Addr(actor.address()));
    assert_eq!(leg.target, NodeId::Prof(actor.address()));
    assert_eq!(leg.tau, 0.0);

    let balance = host.balance(&actor.address()).await.expect("balance");
    assert_eq!(balance.action_count, 1);
    assert!((balance.balance - priced(2)).abs() < 1e-9);
    assert!((balance.burned_total - priced(3)).abs() < 1e-9);

    let since = host.epochs_since(0).await.expect("epochs");
    assert_eq!(
        since.len(),
        1,
        "the empty boundary 0 reads the whole sequence"
    );
    assert_eq!(since[0], package);
    assert!(host.epochs_since(1).await.expect("epochs").is_empty());
}

/// The host is handed only the submission — body, dependency list and
/// nonce, content pre-digest, pre-commitment, pre-signature and key —
/// and still seals, the device approves the seal from the pair it kept,
/// and the act lands. The submission's own rendering shows the dependency
/// nonce it carries and neither member of the pair it does not. The
/// record's witness is the content commitment over the content pre-digest
/// (layer1-interface.md §8.2, "Verified act"), not over the payload bytes.
///
/// A submission without its content pair seals, is approved by the device, and lands with the witness formed over the content pre-digest.
/// ´claim:seal:a-submission-without-its-content-pair-lands´
#[sqlx::test(migrations = "../../migrations")]
async fn a_submission_without_its_content_pair_seals_approves_and_lands(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 3 * THETA).await;
    let mut proposal = registration(&actor);
    proposal.payload = run(0xA0, 32);
    let pre = PreSigned::sign_with_nonces(&actor, proposal, run(0x10, 32), run(0x50, 32));
    let submission: Submission = pre.submission();
    let shown = format!("{submission:?}");
    assert!(shown.contains(&format!("{:?}", pre.dependency_nonce)));
    assert!(!shown.contains(&format!("{:?}", pre.content_nonce)));
    assert!(!shown.contains(&format!("{:?}", pre.proposal.payload)));

    let sealed = host.seal(submission).await.expect("seals with no pair");
    let host_key = host.host_public_key().await.expect("host key");
    assert!(sealed.verify_seal(&host_key));
    let witness = pre
        .approve(&actor, &sealed, &host_key)
        .expect("the device approves from the pair it kept");
    host.approve(witness).await.expect("approval accepted");

    let package = host.close_epoch().await.expect("closes");
    assert_eq!(package.records.len(), 1);
    let record = &package.records[0];
    let act_id = pre.act_id();
    assert_eq!(record.act_id, act_id);
    assert_eq!(record.payload_witness, sealed.act.content_commitment);
    assert_eq!(
        record.payload_witness,
        proposal::content_commitment(
            &act_id,
            &sealed.act.pre_commitment,
            &sealed.content_salt,
            &pre.content_pre_digest()
        )
        .to_vec()
    );
    assert_ne!(
        record.payload_witness,
        common::l1::handshake::content_commitment(
            &act_id,
            &sealed.act.pre_commitment,
            &sealed.content_salt,
            &pre.proposal.payload
        )
        .to_vec(),
        "the witness is not formed over the payload bytes"
    );
}

/// The published record names exactly its act, author, family, place in
/// the order of record, witness and legs — the pattern below is
/// exhaustive, so a payload mark on the type fails to compile — and the
/// read-back package equals the published one. The host never sees a
/// payload, so it publishes nothing about one beyond the witness.
///
/// A published record carries no payload mark, as published and as read back.
/// ´claim:standin:a-published-record-carries-no-payload-mark´
#[sqlx::test(migrations = "../../migrations")]
async fn a_published_record_carries_no_payload_mark(pool: PgPool) {
    let host = standin(pool);
    let alice = funded_actor(&host, 10 * THETA).await;
    let bob = funded_actor(&host, 10 * THETA).await;
    submit(&host, &alice, registration(&alice)).await;
    submit(&host, &bob, opinion(&bob, 0, &alice.address(), vec![])).await;
    let package = host.close_epoch().await.expect("closes");
    assert_eq!(package.records.len(), 2);
    for record in &package.records {
        let PublishedRecord {
            act_id,
            author,
            family,
            epoch,
            act_time,
            position,
            payload_witness,
            legs,
        } = record;
        assert_eq!(&act_id.author, author);
        assert_eq!(act_id.family, *family);
        assert_eq!(*epoch, 1);
        assert!(*act_time >= 1 && *position >= 1 && !legs.is_empty());
        assert_eq!(payload_witness.len(), 32);
        assert!(!format!("{record:?}").contains("payload_marked"));
    }
    assert_eq!(host.epochs_since(0).await.expect("epochs"), vec![package]);
}

/// Every close charges the wall in force and publishes the next: θ is the
/// reference before the first close, epoch 1 charges it as its debit
/// vintage, the controller at width 1 delivers the same wall, and the
/// price the seam reads afterwards is that delivered wall's burn image.
/// The package carries the closure part — cause, partition, final ledger,
/// controller step, marker policy — and the ingest read returns all of it.
///
/// Each close charges the wall in force and publishes the controller's next wall with the package.
/// ´claim:close:each-close-charges-the-wall-in-force´
#[sqlx::test(migrations = "../../migrations")]
async fn each_close_charges_the_wall_in_force(pool: PgPool) {
    use common::l1::handshake::{ClosureCause, LedgerLine, Ratio};
    let host = standin(pool);
    assert_eq!(host.current_theta().await.expect("θ"), THETA);
    let alice = funded_actor(&host, 5 * THETA).await;
    let bob = funded_actor(&host, 5 * THETA).await;
    let reg = registration(&alice);
    let reg_id = reg.body.act_id();
    submit(&host, &alice, reg).await;
    let mut child = opinion(&bob, 0, &alice.address(), vec![]);
    child.body.asserted_parents = vec![reg_id.clone()];
    submit(&host, &bob, child).await;
    submit(&host, &bob, opinion(&bob, 1, "carol", vec![])).await;

    let first = host.close_epoch().await.expect("closes");
    let closure = &first.closure;
    assert_eq!(closure.theta_charged_micro, THETA);
    assert_eq!(closure.cause, ClosureCause::DurationElapsed);
    assert_eq!(closure.marker.identity, "stand-in: the epoch close");
    assert_eq!(closure.marker.edition, 1);
    let step = closure.wall.as_ref().expect("a controller step");
    assert_eq!(step.wall_in_force, l1_standin::REFERENCE_WALL);
    assert_eq!((step.width, step.accepted_rung), (Ratio::ONE, Ratio::ZERO));
    assert_eq!(step.proposal, l1_standin::REFERENCE_WALL);
    assert_eq!(step.delivered, l1_standin::REFERENCE_WALL);
    assert_eq!(step.theta_next_micro, THETA);
    assert_eq!(
        host.current_theta().await.expect("θ"),
        step.theta_next_micro
    );

    let position = |id: &ActId| {
        first
            .records
            .iter()
            .find(|r| &r.act_id == id)
            .map(|r| r.position)
            .expect("published")
    };
    let child_id = ActId::new(&bob.address(), 0, Family::Opinion).expect("ok");
    let lone_id = ActId::new(&bob.address(), 1, Family::Opinion).expect("ok");
    let mut joined = vec![position(&reg_id), position(&child_id)];
    joined.sort_unstable();
    let mut expected = vec![joined, vec![position(&lone_id)]];
    expected.sort_unstable_by_key(|block| block[0]);
    assert_eq!(
        closure.dependent_sets, expected,
        "an asserted parent inside the epoch joins its child's block"
    );

    let mut ledger = vec![
        LedgerLine {
            address: alice.address(),
            accepted_acts: 1,
            action_count: 1,
            residual_balance_micro: Some(4 * THETA),
        },
        LedgerLine {
            address: bob.address(),
            accepted_acts: 2,
            action_count: 2,
            residual_balance_micro: Some(3 * THETA),
        },
    ];
    ledger.sort_by(|a, b| a.address.cmp(&b.address));
    assert_eq!(closure.ledger, ledger);

    submit(&host, &alice, opinion(&alice, 1, &bob.address(), vec![])).await;
    let second = host.close_epoch().await.expect("closes");
    assert_eq!(second.closure.theta_charged_micro, THETA);
    assert_eq!(second.closure.ledger.len(), 1);
    assert_eq!(second.closure.ledger[0].action_count, 2);
    assert_eq!(
        host.epochs_since(0).await.expect("epochs"),
        vec![first, second],
        "the closure part round-trips through the ingest read"
    );
    let balance = host.balance(&alice.address()).await.expect("balance");
    assert!((balance.balance - priced(3)).abs() < 1e-9);
}

/// Which epoch's price is charged when: the close charges exactly what
/// the previous close delivered, and the next close what this one
/// delivered (one-boundary lead). An epoch closed before the controller —
/// a migrated database's history, written here around the crate the way
/// the migration leaves it — keeps the vintage it charged, and the first
/// close after it charges the declared initialization.
///
/// A close charges the previous close's delivered wall, or the initialization after epochs with no controller.
/// ´claim:close:the-price-leads-by-one-boundary´
#[sqlx::test(migrations = "../../migrations")]
async fn the_price_leads_by_one_boundary(pool: PgPool) {
    use common::l1::handshake::Ratio;
    let host = standin(pool.clone());
    let alice = funded_actor(&host, 20 * THETA).await;
    submit(&host, &alice, registration(&alice)).await;
    host.close_epoch().await.expect("closes");

    sqlx::query(
        "UPDATE l1_epochs SET theta_charged_micro = 52810,
                wall_num = NULL, wall_den = NULL, width_num = NULL, width_den = NULL,
                rung_num = NULL, rung_den = NULL, proposal_num = NULL, proposal_den = NULL,
                delivered_num = NULL, delivered_den = NULL, theta_next_micro = NULL
          WHERE epoch = 1",
    )
    .execute(&pool)
    .await
    .expect("the fixture writes a pre-controller epoch around the crate");
    sqlx::query("UPDATE l1_epoch_ledger SET balance_micro = NULL WHERE epoch = 1")
        .execute(&pool)
        .await
        .expect("and its unrecorded balance");
    assert_eq!(
        host.current_theta().await.expect("θ"),
        l1_standin::DECLARATION
            .burn_image(l1_standin::DECLARATION.initialization)
            .expect("on the grid"),
        "after a history with no controller, the initialization is in force"
    );

    submit(&host, &alice, opinion(&alice, 1, "bob", vec![])).await;
    let second = host.close_epoch().await.expect("closes");
    assert_eq!(second.closure.theta_charged_micro, THETA);
    let historical = &host.epochs_since(0).await.expect("epochs")[0];
    assert_eq!(historical.closure.theta_charged_micro, 52_810);
    assert_eq!(historical.closure.wall, None);
    assert_eq!(historical.closure.ledger[0].residual_balance_micro, None);

    let raised = Ratio::new(60_000, 100_000).expect("ratio");
    sqlx::query(
        "UPDATE l1_epochs SET delivered_num = $1, delivered_den = $2, theta_next_micro = 60000
          WHERE epoch = 2",
    )
    .bind(raised.numerator())
    .bind(raised.denominator())
    .execute(&pool)
    .await
    .expect("the fixture delivers another wall around the crate");
    assert_eq!(host.current_theta().await.expect("θ"), 60_000);

    submit(&host, &alice, opinion(&alice, 2, "carol", vec![])).await;
    let third = host.close_epoch().await.expect("closes");
    assert_eq!(
        third.closure.theta_charged_micro, 60_000,
        "epoch 3 charges what epoch 2 delivered"
    );
    let step = third.closure.wall.as_ref().expect("a step");
    assert_eq!(step.wall_in_force, raised);
    assert_eq!(
        step.delivered,
        l1_standin::REFERENCE_WALL,
        "0.6 is outside the deadband of 0.50186 and within one step of it"
    );
    assert_eq!(host.current_theta().await.expect("θ"), THETA);
    let balance = host.balance(&alice.address()).await.expect("balance");
    assert_eq!(
        (balance.balance * 1e6).round() as i64,
        20 * THETA - 2 * THETA - 60_000,
        "epochs 1 and 2 debited the reference, epoch 3 the wall epoch 2 delivered; \
         rewriting a vintage afterwards moves no balance"
    );
}

/// An epoch that fills the act budget closed on its target; one below it
/// closed on the clock.
///
/// A close that fills the act budget publishes the target as its cause.
/// ´claim:close:a-filled-budget-is-the-closure-cause´
#[sqlx::test(migrations = "../../migrations")]
async fn a_filled_budget_is_the_closure_cause(pool: PgPool) {
    use common::l1::handshake::ClosureCause;
    let host = StandIn::new(pool, StandInConfig::new(2, 1024).expect("config"));
    let alice = funded_actor(&host, 10 * THETA).await;
    for seq in 0..3 {
        submit(&host, &alice, opinion(&alice, seq, "bob", vec![])).await;
    }
    let full = host.close_epoch().await.expect("ok");
    assert_eq!(full.closure.cause, ClosureCause::TargetFilled);
    let rest = host.close_epoch().await.expect("ok");
    assert_eq!(rest.closure.cause, ClosureCause::DurationElapsed);
}

/// An epoch with nothing approved in it closes all the same
/// (layer1-interface.md §11.6: at its maximum duration, whatever it holds):
/// a package of zero acts, closed on its duration, with no partition and no
/// ledger line, charging the wall in force and stepping the controller at
/// the declared width. A run of idle closes numbers its epochs in order and
/// holds θ at the reference — a width of 0 would propose the floor and
/// step the wall down at every one — and the act that arrives afterwards
/// lands in the next epoch at that price.
///
/// An epoch with nothing orderable closes on its duration, and idle closes hold θ.
/// ´claim:close:an-empty-epoch-closes-on-its-duration´
#[sqlx::test(migrations = "../../migrations")]
async fn an_empty_epoch_closes_on_its_duration(pool: PgPool) {
    use common::l1::handshake::{ClosureCause, Ratio};
    let host = standin(pool.clone());
    for expected in 1..=12 {
        let empty = host.close_epoch().await.expect("closes");
        assert_eq!(empty.epoch, expected);
        assert!(empty.records.is_empty());
        let closure = &empty.closure;
        assert_eq!(closure.cause, ClosureCause::DurationElapsed);
        assert!(closure.dependent_sets.is_empty() && closure.ledger.is_empty());
        assert_eq!(closure.theta_charged_micro, THETA);
        let step = closure.wall.as_ref().expect("the controller steps");
        assert_eq!(
            (step.width, step.accepted_rung),
            (Ratio::ONE, Ratio::ZERO),
            "the declared width, not a count of the epoch's acts"
        );
        assert_eq!(step.delivered, l1_standin::REFERENCE_WALL);
        assert_eq!(step.theta_next_micro, THETA);
        assert_eq!(host.current_theta().await.expect("θ"), THETA);
    }
    let stored: Vec<(i64, i64)> =
        sqlx::query_as("SELECT epoch, act_count FROM l1_epochs ORDER BY epoch")
            .fetch_all(&pool)
            .await
            .expect("the epoch rows");
    assert_eq!(stored, (1..=12).map(|e| (e, 0)).collect::<Vec<_>>());

    let actor = funded_actor(&host, 3 * THETA).await;
    let act_id = submit(&host, &actor, registration(&actor)).await;
    let landed = host.close_epoch().await.expect("closes");
    assert_eq!((landed.epoch, landed.records.len()), (13, 1));
    assert_eq!(landed.records[0].act_id, act_id);
    assert_eq!(landed.closure.theta_charged_micro, THETA);

    let since = host.epochs_since(0).await.expect("epochs");
    assert_eq!(
        since.iter().map(|p| p.epoch).collect::<Vec<_>>(),
        (1..=13).collect::<Vec<_>>(),
        "the ingest read returns the empty epochs in order"
    );
    assert_eq!(since[12], landed);
    assert!(since[..12].iter().all(|p| p.records.is_empty()));
}

/// Every package carries the boundary triple it closed under: the act
/// budget as its target, a minimum of 0, and the clock's interval as its
/// maximum — none where no clock runs. The ingest read returns it.
///
/// Each package publishes its target size and its minimum and maximum durations.
/// ´claim:close:each-package-publishes-its-boundary-triple´
#[sqlx::test(migrations = "../../migrations")]
async fn each_package_publishes_its_boundary_triple(pool: PgPool) {
    use common::l1::handshake::BoundaryPolicy;
    let unclocked = standin(pool.clone());
    let first = unclocked.close_epoch().await.expect("closes");
    assert_eq!(
        first.closure.boundary,
        BoundaryPolicy {
            target_acts: 10_000,
            min_duration_secs: 0,
            max_duration_secs: None,
        }
    );
    let clocked = StandIn::new(
        pool,
        StandInConfig::new(25, 1024)
            .and_then(|c| c.clocked_every(3))
            .expect("config"),
    );
    let second = clocked.close_epoch().await.expect("closes");
    assert_eq!(
        second.closure.boundary,
        BoundaryPolicy {
            target_acts: 25,
            min_duration_secs: l1_standin::DECLARATION.min_epoch_duration_secs,
            max_duration_secs: Some(3),
        }
    );
    assert_eq!(l1_standin::DECLARATION.min_epoch_duration_secs, 0);
    assert_eq!(
        clocked.epochs_since(0).await.expect("epochs"),
        vec![first, second]
    );
    assert!(matches!(
        StandInConfig::default().clocked_every(0),
        Err(StandInError::Host(_))
    ));
}

/// The close loop closes on its interval with no close asked for: empty
/// epochs while nothing is approved, and the approved act in the next
/// epoch after it arrives.
///
/// The close loop publishes on its interval, empty epochs included, with no close asked for.
/// ´claim:close:the-interval-loop-publishes-without-being-asked´
#[sqlx::test(migrations = "../../migrations")]
async fn close_loop_publishes_on_the_interval(pool: PgPool) {
    let host = StandIn::new(
        pool,
        StandInConfig::new(10_000, 1024)
            .and_then(|c| c.clocked_every(1))
            .expect("config"),
    );
    let clock = tokio::spawn(l1_standin::close_loop(host.clone()));

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
    while host.epochs_since(0).await.expect("epochs").is_empty() {
        assert!(
            std::time::Instant::now() < deadline,
            "the clock never closed an empty epoch"
        );
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    }
    let idle = host.epochs_since(0).await.expect("epochs");
    assert!(idle[0].records.is_empty(), "nothing was approved yet");
    assert_eq!(idle[0].closure.boundary.max_duration_secs, Some(1));

    let actor = funded_actor(&host, 3 * THETA).await;
    let act_id = submit(&host, &actor, registration(&actor)).await;
    let package = loop {
        if let Some(package) = host
            .epochs_since(0)
            .await
            .expect("epochs")
            .into_iter()
            .find(|p| !p.records.is_empty())
        {
            break package;
        }
        assert!(
            std::time::Instant::now() < deadline,
            "interval close never published the approved act"
        );
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
    };
    assert_eq!(package.records.len(), 1);
    assert_eq!(package.records[0].act_id, act_id);
    clock.abort();
}

/// Three distinct formation failures — a Registration targeting someone
/// else's Profile, a fixed-parameter family given non-fixed (p_d, p_i),
/// and more declared dependencies than the dependency bound — all reject
/// at seal. None produces a Layer-1 object, so a subsequent close
/// publishes an empty epoch.
///
/// A proposal that fails formation rejects at seal and leaves no Layer 1 object behind.
/// ´claim:seal:formation-failures-leave-no-record-behind´
#[sqlx::test(migrations = "../../migrations")]
async fn seal_rejects_formation_failures(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 3 * THETA).await;

    let mut bad = registration(&actor);
    bad.body.target = NodeId::Prof("someone-else".into());
    let err = seal_of(&host, &actor, bad).await.expect_err("rejected");
    assert!(matches!(err, StandInError::Formation(_)));

    let mut bad = registration(&actor);
    bad.body.p_d = 0.5;
    assert!(matches!(
        seal_of(&host, &actor, bad).await,
        Err(StandInError::Formation(_))
    ));

    let deps = (0..65)
        .map(|seq| ActId::new("elsewhere", seq, Family::Opinion).expect("ok"))
        .collect();
    assert!(matches!(
        seal_of(&host, &actor, opinion(&actor, 1, "bob", deps)).await,
        Err(StandInError::Formation(_))
    ));

    assert!(host.close_epoch().await.expect("ok").records.is_empty());
}

/// M_payload is a carriage bound, not an act check (layer1-interface.md
/// §8.2, "Verified act"), and the host never holds the pair it bounds: a
/// proposal whose payload is over the configured bound seals and lands.
///
/// A payload over the carriage bound is not the host's to refuse: the act seals and lands.
/// ´claim:seal:the-payload-bound-is-not-an-act-check´
#[sqlx::test(migrations = "../../migrations")]
async fn a_payload_over_the_carriage_bound_seals_and_lands(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 3 * THETA).await;
    let mut long = registration(&actor);
    long.payload = vec![0u8; 2 * host.config().max_payload_bytes];
    let act_id = submit(&host, &actor, long).await;
    let package = host.close_epoch().await.expect("closes");
    assert_eq!(package.records.len(), 1);
    assert_eq!(package.records[0].act_id, act_id);
}

/// Four authentication failures reject at seal: an author address that
/// does not bind to the signing key, a body changed after pre-signing, a
/// content pre-digest the author did not sign, and a dependency nonce the
/// dependency pre-digest was not formed under. Each changes what the
/// pre-commitment recomputes from, and none needs the payload to detect.
///
/// A submission whose pre-signature does not bind its author, body and both pre-digests rejects at seal.
/// ´claim:seal:authentication-failures-reject-at-seal´
#[sqlx::test(migrations = "../../migrations")]
async fn seal_rejects_authentication_failures(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 3 * THETA).await;
    let mallory = ActorKey::generate();

    let mut submission = PreSigned::sign(&actor, registration(&actor)).submission();
    submission.author_pubkey = mallory.public_key_bytes();
    assert!(matches!(
        host.seal(submission).await,
        Err(StandInError::Authentication(_))
    ));

    let mut submission = PreSigned::sign(&actor, opinion(&actor, 1, "bob", vec![])).submission();
    submission.body.p_d = -1.0;
    assert!(matches!(
        host.seal(submission).await,
        Err(StandInError::Authentication(_))
    ));

    let mut submission = PreSigned::sign(&actor, opinion(&actor, 2, "bob", vec![])).submission();
    submission.content_pre_digest[0] ^= 1;
    assert!(matches!(
        host.seal(submission).await,
        Err(StandInError::Authentication(_))
    ));

    let mut submission = PreSigned::sign(&actor, opinion(&actor, 3, "bob", vec![])).submission();
    submission.dependency_nonce[0] ^= 1;
    assert!(matches!(
        host.seal(submission).await,
        Err(StandInError::Authentication(_))
    ));
}

/// Reusing an act identifier is equivocation and rejects with Conflict;
/// reusing an author-local sequence number under a different family
/// rejects the same way, via UNIQUE(author, seq).
///
/// Reusing an act identifier or an author-local sequence number rejects as a conflict.
/// ´claim:seal:identifier-reuse-is-a-conflict´
#[sqlx::test(migrations = "../../migrations")]
async fn seal_rejects_identifier_reuse_and_key_change(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 10 * THETA).await;

    seal_of(&host, &actor, opinion(&actor, 1, "bob", vec![]))
        .await
        .expect("first seal ok");

    assert!(matches!(
        seal_of(&host, &actor, opinion(&actor, 1, "carol", vec![])).await,
        Err(StandInError::Conflict(_))
    ));

    let mut prop = registration(&actor);
    prop.body.seq = 1;
    assert!(matches!(
        seal_of(&host, &actor, prop).await,
        Err(StandInError::Conflict(_))
    ));
}

/// The host applies no nonce policy (layer1-interface.md §8.2: the
/// content nonce's freshness and non-reuse are carriage obligations, and
/// nothing is stated for the dependency nonce). One author's two acts
/// under the same dependency nonce both seal, approve and land in one
/// epoch — the content nonces differ, as the device draws them, but the
/// host never sees those.
///
/// One author's two acts under one dependency nonce both seal and land: the host refuses no nonce reuse.
/// ´claim:seal:a-reused-dependency-nonce-is-not-refused´
#[sqlx::test(migrations = "../../migrations")]
async fn one_dependency_nonce_twice_by_one_author_seals_and_lands_both(pool: PgPool) {
    let host = standin(pool);
    let alice = funded_actor(&host, 10 * THETA).await;
    let shared = run(0x42, 32);
    let first =
        PreSigned::sign_with_nonces(&alice, registration(&alice), run(0x01, 32), shared.clone());
    let second = PreSigned::sign_with_nonces(
        &alice,
        opinion(&alice, 1, "carol", vec![first.act_id()]),
        run(0x81, 32),
        shared,
    );
    land(&host, &alice, &first).await;
    land(&host, &alice, &second).await;
    let package = host.close_epoch().await.expect("closes");
    let landed: Vec<ActId> = package.records.iter().map(|r| r.act_id.clone()).collect();
    assert_eq!(landed, vec![first.act_id(), second.act_id()]);
}

/// Nor does the host hold the dependency nonce to a length: a nonce of
/// any length — empty included — is whatever bytes the dependency
/// pre-digest recomputes from, and the act seals and lands under it.
///
/// A dependency nonce of any length seals: the host applies no length rule to it.
/// ´claim:seal:the-dependency-nonce-has-no-length-rule´
#[sqlx::test(migrations = "../../migrations")]
async fn a_dependency_nonce_of_any_length_seals(pool: PgPool) {
    let host = standin(pool);
    let alice = funded_actor(&host, 10 * THETA).await;
    let floor = common::l1::crypto::SALT_LEN;
    for (seq, length) in [0, 1, floor - 1, floor + 1].into_iter().enumerate() {
        let pre = PreSigned::sign_with_nonces(
            &alice,
            opinion(&alice, seq as u64, "bob", vec![]),
            run(0x01, 32),
            run(0x60, length),
        );
        land(&host, &alice, &pre).await;
    }
    assert_eq!(host.close_epoch().await.expect("closes").records.len(), 4);
}

/// A submission whose pre-commitment was formed the one-nonce way — one
/// nonce under both pre-digests, under the formulas that came before the
/// two-nonce handshake — is refused at seal as an authentication failure
/// even with its own pre-signature valid over it, and stores nothing: the
/// same act seals afterwards under two nonces.
///
/// A one-nonce pre-commitment never verifies at seal, and the refusal leaves no row.
/// ´claim:seal:a-one-nonce-pre-commitment-is-refused´
#[sqlx::test(migrations = "../../migrations")]
async fn a_one_nonce_pre_commitment_is_refused_and_leaves_no_row(pool: PgPool) {
    use common::l1::crypto::{self, tags};
    let host = standin(pool.clone());
    let actor = funded_actor(&host, 3 * THETA).await;
    let old = actor.pre_sign(registration(&actor));
    let act_id = old.proposal.body.act_id();
    let old_content_pre_digest = crypto::pre_digest(
        tags::PRE_DIGEST_CONTENT,
        act_id.to_string().as_bytes(),
        &old.nonce,
        &old.proposal.payload,
    );
    let one_nonce = Submission::new(
        old.proposal.body.clone(),
        old.proposal.deps.clone(),
        old.nonce.clone(),
        old_content_pre_digest,
        old.pre_commitment(),
        old.pre_signature.clone(),
        old.author_pubkey.clone(),
    );
    assert!(crypto::verify_digest(
        &crypto::verifying_key_from_bytes(&old.author_pubkey).expect("key"),
        &old.pre_commitment(),
        &old.pre_signature
    ));
    let refused = host.seal(one_nonce).await;
    assert!(
        matches!(refused, Err(StandInError::Authentication(_))),
        "{refused:?}"
    );
    let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM l1_acts WHERE act_id = $1")
        .bind(act_id.to_string())
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(rows, 0, "a refused seal stores nothing");
    seal_of(&host, &actor, registration(&actor))
        .await
        .expect("the same act seals under two nonces");
}

/// An unknown act rejects with UnknownAct; a witness signed by the
/// wrong key rejects with Authentication (mallory signing the same
/// message must not verify as the actor); and the genuine witness
/// lands, with a second approval idempotent.
///
/// Only the actor's own approval witness lands the act, and approving twice lands it once.
/// ´claim:handshake:only-the-actors-own-witness-approves´
#[sqlx::test(migrations = "../../migrations")]
async fn approve_verifies_the_witness(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 3 * THETA).await;
    let mallory = ActorKey::generate();

    let pre = PreSigned::sign(&actor, registration(&actor));
    let sealed = host.seal(pre.submission()).await.expect("seals");
    let host_key = host.host_public_key().await.expect("key");

    let bogus = ApprovalWitness {
        act_id: ActId::new("nobody", 9, Family::Opinion).expect("ok"),
        approval_signature: vec![1, 2, 3],
    };
    assert!(matches!(
        host.approve(bogus).await,
        Err(StandInError::UnknownAct(_))
    ));

    let witness = pre.approve(&actor, &sealed, &host_key).expect("client ok");
    let forged = ApprovalWitness {
        act_id: witness.act_id.clone(),
        approval_signature: PreSigned::sign(&mallory, registration(&mallory)).pre_signature,
    };
    assert!(matches!(
        host.approve(forged).await,
        Err(StandInError::Authentication(_))
    ));

    host.approve(witness.clone()).await.expect("approves");
    host.approve(witness).await.expect("idempotent");
    let package = host.close_epoch().await.expect("ok");
    assert_eq!(package.records.len(), 1);
}

/// An actor with no burn fails W1 at close, deferring the act
/// indefinitely; crediting a burn restores capacity immediately
/// (layer1-interface.md §7.1), and the act lands at the next close.
///
/// An author who cannot pay the θ-debit defers until a burn funds the act.
/// ´claim:close:an-unfunded-act-defers-until-its-burn-lands´
#[sqlx::test(migrations = "../../migrations")]
async fn insolvent_authors_defer_until_funded(pool: PgPool) {
    let host = standin(pool);
    let actor = ActorKey::generate();
    host.credit_burn(&actor.address(), THETA / 2)
        .await
        .expect("underfunded burn");
    submit(&host, &actor, registration(&actor)).await;

    assert!(host.close_epoch().await.expect("ok").records.is_empty());

    host.credit_burn(&actor.address(), THETA)
        .await
        .expect("burn");
    let package = host.close_epoch().await.expect("ok");
    assert_eq!(package.records.len(), 1);
}

/// Burns requested through the seam, as a count of `l1_admission_burns`
/// rows — the realization-side proof that a burn happened once.
async fn burn_rows(pool: &PgPool, address: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM l1_admission_burns WHERE address = $1")
        .bind(address)
        .fetch_one(pool)
        .await
        .expect("count")
}

/// An admission burn request is idempotent by its key: a retry returns
/// the same ticket, keeps one burn and credits once, and a zero-delay
/// burn has settled by the time the request returns. The same key naming
/// another amount is not a retry and is refused.
///
/// A retried burn request with the same key is the same burn: one row, one credit, one ticket.
/// ´claim:standin:a-burn-request-is-idempotent-by-its-key´
#[sqlx::test(migrations = "../../migrations")]
async fn a_burn_request_is_idempotent_by_its_key(pool: PgPool) {
    use common::l1::handshake::BurnSettlement;
    let host = standin(pool.clone());
    let actor = ActorKey::generate();
    let key = sqlx::types::Uuid::new_v4();

    let first = host
        .request_admission_burn(&actor.address(), 5 * THETA, key)
        .await
        .expect("requests");
    let again = host
        .request_admission_burn(&actor.address(), 5 * THETA, key)
        .await
        .expect("a retry is answered");
    assert_eq!(first, again);
    assert_eq!(burn_rows(&pool, &actor.address()).await, 1);
    assert_eq!(
        host.burn_settlement(&first).await.expect("reads"),
        BurnSettlement::Settled {
            pinned_micro: 5 * THETA
        }
    );
    let balance = host.balance(&actor.address()).await.expect("balance");
    assert!(
        (balance.burned_total - priced(5)).abs() < 1e-9,
        "credited once"
    );

    assert!(matches!(
        host.request_admission_burn(&actor.address(), 6 * THETA, key)
            .await,
        Err(StandInError::Conflict(_))
    ));
    assert!(matches!(
        host.burn_settlement(&common::l1::handshake::BurnTicket("not-a-ticket".into()))
            .await,
        Err(StandInError::UnknownAct(_))
    ));
}

/// With a settlement delay, a burn reads pending and B_i stays untouched
/// until that many epochs have closed; the close that reaches the due
/// epoch settles it and credits B_i, and the act it funds lands at the
/// close after. An empty epoch is an epoch: idle closes count toward the
/// delay like any other.
///
/// A burn under a settlement delay stays pending, B_i untouched, until the delay's epochs have closed.
/// ´claim:standin:a-burn-settles-after-its-delay´
#[sqlx::test(migrations = "../../migrations")]
async fn a_burn_settles_after_its_delay(pool: PgPool) {
    use common::l1::handshake::BurnSettlement;
    let host = StandIn::new(
        pool.clone(),
        StandInConfig::new(10_000, 1024)
            .and_then(|c| c.settling_after(2))
            .expect("config"),
    );
    let applicant = ActorKey::generate();
    let ticket = host
        .request_admission_burn(&applicant.address(), 3 * THETA, sqlx::types::Uuid::new_v4())
        .await
        .expect("requests");
    assert_eq!(
        host.burn_settlement(&ticket).await.expect("reads"),
        BurnSettlement::Pending
    );
    assert_eq!(
        host.balance(&applicant.address())
            .await
            .expect("balance")
            .burned_total,
        0.0
    );
    submit(&host, &applicant, registration(&applicant)).await;
    let epoch_1 = host.close_epoch().await.expect("ok");
    assert!(
        epoch_1.records.is_empty(),
        "the funded act is insolvent while the burn is pending"
    );
    assert_eq!(
        host.burn_settlement(&ticket).await.expect("reads"),
        BurnSettlement::Pending,
        "requested at the empty boundary 0 with a delay of 2: due at epoch 2"
    );
    let epoch_2 = host.close_epoch().await.expect("ok");
    assert_eq!(epoch_2.epoch, 2, "the empty epoch 1 counted");
    assert!(
        epoch_2.records.is_empty(),
        "the burn settles at this close, after its selection"
    );
    assert_eq!(
        host.burn_settlement(&ticket).await.expect("reads"),
        BurnSettlement::Settled {
            pinned_micro: 3 * THETA
        }
    );
    let package = host.close_epoch().await.expect("ok");
    assert_eq!(package.records[0].author, applicant.address());
}

/// A negative settlement delay is refused at the config, like every
/// degenerate operating value.
/// ´claim:standin:a-negative-settlement-delay-is-refused´
#[test]
fn a_negative_settlement_delay_is_refused() {
    assert!(matches!(
        StandInConfig::default().settling_after(-1),
        Err(StandInError::Host(_))
    ));
}

/// An act depending on a never-submitted act defers indefinitely. An act
/// depending on a same-close act lands after it, at a strictly greater
/// Lamport time, whatever the approval order — here the dependent is
/// approved first and its dependency arrives after.
///
/// A dependency defers its dependent until it lands, then precedes it in both the order and the causal key.
/// ´claim:close:a-dependency-defers-then-precedes-its-dependent´
#[sqlx::test(migrations = "../../migrations")]
async fn dependencies_defer_and_order(pool: PgPool) {
    let host = standin(pool);
    let alice = funded_actor(&host, 10 * THETA).await;
    let reg = registration(&alice);
    let reg_id = reg.body.act_id();

    let orphan_dep = ActId::new("ghost", 1, Family::Opinion).expect("ok");
    submit(&host, &alice, opinion(&alice, 1, "bob", vec![orphan_dep])).await;
    assert!(host.close_epoch().await.expect("ok").records.is_empty());

    submit(
        &host,
        &alice,
        opinion(&alice, 2, "carol", vec![reg_id.clone()]),
    )
    .await;
    submit(&host, &alice, reg).await;
    let package = host.close_epoch().await.expect("ok");
    assert_eq!(package.records.len(), 2);
    let pos = |id: &ActId| {
        package
            .records
            .iter()
            .find(|r| &r.act_id == id)
            .map(|r| (r.position, r.act_time))
            .expect("present")
    };
    let dep_op = ActId::new(&alice.address(), 2, Family::Opinion).expect("ok");
    let (reg_pos, reg_time) = pos(&reg_id);
    let (op_pos, op_time) = pos(&dep_op);
    assert!(
        reg_pos < op_pos,
        "dependency precedes dependent in the order"
    );
    assert!(
        reg_time < op_time,
        "dependency at strictly lower causal key"
    );
}

/// A hyper act (Tag) projects two legs at one causal key: the A-leg
/// Actor → middle, the T-leg middle → terminal target. Both legs see the
/// same pre-act state — first appearance of every endpoint, so τ = 0 on
/// both — and one act consummates exactly one θ-debit and one count
/// increment, never per leg.
///
/// A hyper act projects two legs at one causal key and consummates exactly one θ-debit.
/// ´claim:record:a-hyper-act-projects-two-legs-at-one-key´
#[sqlx::test(migrations = "../../migrations")]
async fn hyper_acts_project_two_legs_at_one_key(pool: PgPool) {
    let host = standin(pool);
    let publisher = funded_actor(&host, 10 * THETA).await;
    let subject = ActorKey::generate();

    let tag = Proposal {
        body: StructuralBody {
            author: publisher.address(),
            seq: 0,
            family: Family::Tag,
            middle: Some(NodeId::Prof(subject.address())),
            target: NodeId::name("moderator").expect("ok"),
            p_d: 0.0,
            p_i: 0.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        },
        payload: b"role payload".to_vec(),
        deps: vec![],
    };
    submit(&host, &publisher, tag).await;
    let package = host.close_epoch().await.expect("ok");
    assert_eq!(package.records.len(), 1);
    let record = &package.records[0];
    assert_eq!(record.legs.len(), 2);
    let a = record
        .legs
        .iter()
        .find(|l| l.role == LegRole::A)
        .expect("A leg");
    let t = record
        .legs
        .iter()
        .find(|l| l.role == LegRole::T)
        .expect("T leg");
    assert_eq!(a.source, NodeId::Addr(publisher.address()));
    assert_eq!(a.target, NodeId::Prof(subject.address()));
    assert_eq!(t.source, NodeId::Prof(subject.address()));
    assert_eq!(t.target, NodeId::name("moderator").expect("ok"));
    assert_eq!(a.tau, 0.0);
    assert_eq!(t.tau, 0.0);
    let balance = host.balance(&publisher.address()).await.expect("ok");
    assert_eq!(balance.action_count, 1);
    assert!((balance.balance - priced(9)).abs() < 1e-9);
}

/// Bid/T is fresh-mint-only and rejects at formation (seal.rs) when
/// targeted at an existing Offer, but a Bid minting its own Offer seals.
/// An ordinary-role Send toward an existing Message stays legal — L1's
/// permission set keeps it, and CoGra's transcript fold, not formation,
/// is what ignores it.
///
/// A Bid may only mint a fresh Offer, where an ordinary Send toward an existing Message stays legal.
/// ´claim:seal:bid-mints-fresh-where-send-may-revisit´
#[sqlx::test(migrations = "../../migrations")]
async fn bid_is_fresh_mint_only_while_ordinary_send_stays_legal(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 10 * THETA).await;

    let hyper = |seq, family, middle: &NodeId, target: &NodeId| Proposal {
        body: StructuralBody {
            author: actor.address(),
            seq,
            family,
            middle: Some(middle.clone()),
            target: target.clone(),
            p_d: 0.5,
            p_i: 0.5,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        },
        payload: vec![],
        deps: vec![],
    };

    let item = NodeId::Mint(ActId::new("lister", 0, Family::Owner).expect("ok"));
    let foreign_offer = NodeId::Mint(ActId::new("other", 1, Family::Bid).expect("ok"));
    assert!(matches!(
        seal_of(&host, &actor, hyper(0, Family::Bid, &item, &foreign_offer)).await,
        Err(StandInError::Formation(_))
    ));

    let own_offer = NodeId::Mint(ActId::new(&actor.address(), 1, Family::Bid).expect("ok"));
    submit(&host, &actor, hyper(1, Family::Bid, &item, &own_offer)).await;

    let chat = NodeId::Mint(ActId::new("founder", 0, Family::Participant).expect("ok"));
    let foreign_message = NodeId::Mint(ActId::new("other", 2, Family::Send).expect("ok"));
    submit(
        &host,
        &actor,
        hyper(2, Family::Send, &chat, &foreign_message),
    )
    .await;

    let package = host.close_epoch().await.expect("ok");
    assert_eq!(package.records.len(), 2);
}

/// The revise gesture: a Publish toward an existing Content node is
/// well-formed at the substrate (seal.rs) and lands as a revision rather
/// than a fresh mint.
///
/// A Publish toward an existing Content node lands as a revision rather than a fresh mint.
/// ´claim:record:a-publish-toward-an-existing-mint-revises´
#[sqlx::test(migrations = "../../migrations")]
async fn publish_toward_an_existing_mint_revises_rather_than_mints(pool: PgPool) {
    let host = standin(pool);
    let author = funded_actor(&host, 10 * THETA).await;

    let existing = NodeId::Mint(ActId::new("other", 1, Family::Publish).expect("ok"));
    let revise = Proposal {
        body: StructuralBody {
            author: author.address(),
            seq: 0,
            family: Family::Publish,
            middle: None,
            target: existing.clone(),
            p_d: 0.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        },
        payload: b"revised body".to_vec(),
        deps: vec![],
    };
    submit(&host, &author, revise).await;
    let package = host.close_epoch().await.expect("ok");
    assert_eq!(package.records.len(), 1);
    assert_eq!(package.records[0].family, Family::Publish);
    assert_eq!(package.records[0].legs[0].target, existing);
}

/// The found shape: both legs land at the act's own mint — the A-leg
/// enters the Chat the act creates, the T-leg mints it. The T-leg's
/// (p_d, p_i) reads back transposed from the act's own (census.rs
/// `leg_params`).
///
/// A founding Participant lands both legs at the act's own mint, the T-leg's parameters transposed.
/// ´claim:record:a-founding-participant-self-loops-at-its-mint´
#[sqlx::test(migrations = "../../migrations")]
async fn founding_participant_self_loops_at_its_own_mint(pool: PgPool) {
    let host = standin(pool);
    let founder = funded_actor(&host, 10 * THETA).await;

    let own_mint =
        NodeId::Mint(ActId::new(&founder.address(), 0, Family::Participant).expect("ok"));
    let found = Proposal {
        body: StructuralBody {
            author: founder.address(),
            seq: 0,
            family: Family::Participant,
            middle: Some(own_mint.clone()),
            target: own_mint.clone(),
            p_d: 1.0,
            p_i: 0.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        },
        payload: b"founding payload".to_vec(),
        deps: vec![],
    };
    submit(&host, &founder, found).await;

    let package = host.close_epoch().await.expect("ok");
    assert_eq!(package.records.len(), 1);
    let record = &package.records[0];
    assert_eq!(record.family, Family::Participant);
    assert_eq!(record.legs.len(), 2);
    let a = record
        .legs
        .iter()
        .find(|l| l.role == LegRole::A)
        .expect("A leg");
    let t = record
        .legs
        .iter()
        .find(|l| l.role == LegRole::T)
        .expect("T leg");
    assert_eq!(a.source, NodeId::Addr(founder.address()));
    assert_eq!(a.target, own_mint);
    assert_eq!(t.source, own_mint);
    assert_eq!(t.target, own_mint);
    assert_eq!((t.p_d, t.p_i), (0.0, 1.0));
}

/// Bob's opinion toward Alice's Profile matures with the prior degree:
/// Bob's Actor node is fresh (degree 0) but Alice's Profile has degree 1
/// from the Registration — max(0, 1) = 1 → τ = 1 − 1/(1+1) = 0.5. Later
/// acts never contribute to an earlier act's maturity: the epoch-1
/// record still reads τ = 0 through the ingest surface.
///
/// Maturity reads the degree the endpoints carried before the act, and no later act revises it.
/// ´claim:record:maturity-reads-the-degree-before-the-act´
#[sqlx::test(migrations = "../../migrations")]
async fn maturity_grows_with_prior_degree(pool: PgPool) {
    let host = standin(pool);
    let alice = funded_actor(&host, 10 * THETA).await;
    let bob = funded_actor(&host, 10 * THETA).await;

    submit(&host, &alice, registration(&alice)).await;
    host.close_epoch().await.expect("ok");

    submit(&host, &bob, opinion(&bob, 0, &alice.address(), vec![])).await;
    let package = host.close_epoch().await.expect("ok");
    assert_eq!(package.epoch, 2);
    let leg = &package.records[0].legs[0];
    assert!((leg.tau - 0.5).abs() < 1e-12);
    let all = host.epochs_since(0).await.expect("ok");
    assert_eq!(all[0].records[0].legs[0].tau, 0.0);
}

/// With the epoch target act budget set to 1, a close takes one act and
/// leaves the other approved, so each of two submitted acts lands in its
/// own epoch. The budget caps the epoch; it does not close it — the clock
/// does.
///
/// A close takes no more acts than the budget, so under a budget of 1 each act lands in its own epoch.
/// ´claim:close:the-act-budget-caps-the-epoch´
#[sqlx::test(migrations = "../../migrations")]
async fn act_budget_caps_the_epoch(pool: PgPool) {
    let host = StandIn::new(
        pool.clone(),
        StandInConfig {
            epoch_target_acts: 1,
            max_payload_bytes: 1024,
            ..StandInConfig::default()
        },
    );
    let alice = funded_actor(&host, 10 * THETA).await;
    submit(&host, &alice, registration(&alice)).await;
    submit(&host, &alice, opinion(&alice, 1, "bob", vec![])).await;
    host.close_epoch().await.expect("ok");
    host.close_epoch().await.expect("ok");
    let packages = host.epochs_since(0).await.expect("ok");
    assert_eq!(packages.len(), 2, "one act per epoch under a budget of 1");
    assert_eq!(packages[0].records.len(), 1);
    assert_eq!(packages[1].records.len(), 1);
    let keys: Vec<(i64, i64)> = packages
        .iter()
        .flat_map(|p| p.records.iter().map(|r| (r.epoch, r.position)))
        .collect();
    assert_eq!(
        keys,
        vec![(1, 1), (2, 1)],
        "each close numbers its own epoch from 1, its acts from 1"
    );
}

/// Approving never closes: closing is the substrate's own clock, so a
/// backlog cannot put a locked close on every request (L1-06).
///
/// Approving an act does not close an epoch — the clock does.
/// ´claim:close:approving-does-not-close-an-epoch´
#[sqlx::test(migrations = "../../migrations")]
async fn approving_does_not_close_an_epoch(pool: PgPool) {
    let host = StandIn::new(
        pool.clone(),
        StandInConfig {
            epoch_target_acts: 1,
            max_payload_bytes: 1024,
            ..StandInConfig::default()
        },
    );
    let alice = funded_actor(&host, 10 * THETA).await;
    submit(&host, &alice, registration(&alice)).await;
    submit(&host, &alice, opinion(&alice, 1, "bob", vec![])).await;

    assert!(
        host.epochs_since(0).await.expect("ok").is_empty(),
        "the act budget is full twice over and nothing has closed"
    );
    let closed = host.close_epoch().await.expect("the clock closes it");
    assert_eq!(closed.records.len(), 1, "one act under a budget of 1");
}

/// The stand-in's own tables hold the numbering, so even a writer that
/// goes around the crate cannot store what has no order of record: no
/// epoch 0 row, no accepted act at position 0, and no accepted (epoch,
/// position) twice (layer1-interface.md §7.2).
///
/// The stand-in's tables refuse an epoch 0, a position 0 and a repeated (epoch, position).
/// ´claim:standin:the-tables-refuse-a-numbering-without-an-order-of-record´
#[sqlx::test(migrations = "../../migrations")]
async fn the_tables_refuse_a_numbering_without_an_order_of_record(pool: PgPool) {
    let zero = sqlx::query(
        "INSERT INTO l1_epochs
             (epoch, act_count, theta_charged_micro, closure_cause, marker_policy, marker_edition,
              target_acts, min_duration_secs)
         VALUES (0, 0, 50186, 'duration', 'stand-in: the epoch close', 1, 10000, 0)",
    )
    .execute(&pool)
    .await;
    assert!(
        zero.as_ref()
            .is_err_and(|e| e.to_string().contains("l1_epochs_numbered_from_one")),
        "no epoch 0, and for that reason alone: {zero:?}"
    );

    let host = standin(pool.clone());
    let alice = funded_actor(&host, 10 * THETA).await;
    let first = submit(&host, &alice, registration(&alice)).await;
    let second = submit(&host, &alice, opinion(&alice, 1, "bob", vec![])).await;
    let package = host.close_epoch().await.expect("ok");
    assert_eq!(package.records.len(), 2);

    let position_zero = sqlx::query("UPDATE l1_acts SET position = 0 WHERE act_id = $1")
        .bind(first.to_string())
        .execute(&pool)
        .await;
    assert!(position_zero.is_err(), "no position 0: {position_zero:?}");
    let repeated = sqlx::query(
        "UPDATE l1_acts SET position = (SELECT position FROM l1_acts WHERE act_id = $1)
         WHERE act_id = $2",
    )
    .bind(first.to_string())
    .bind(second.to_string())
    .execute(&pool)
    .await;
    assert!(repeated.is_err(), "no repeated position: {repeated:?}");
}

/// One stored act that will not parse fails the whole close and stays
/// selectable, and the same value inside a published epoch fails the
/// ingest read — the ruled behavior for a substrate written around the
/// crate that owns its tables (L1-01/L1-02, ruling 11). Only a writer that
/// is not this crate can produce such a row: every column it writes comes
/// from a value that already parsed.
///
/// A malformed stored act wedges the close and the ingest read rather than being skipped.
/// ´claim:close:a-malformed-stored-act-wedges-the-close´
#[sqlx::test(migrations = "../../migrations")]
async fn a_malformed_stored_act_wedges_the_close(pool: PgPool) {
    let host = standin(pool.clone());
    let alice = funded_actor(&host, 10 * THETA).await;
    let act_id = submit(&host, &alice, registration(&alice)).await;

    sqlx::query("UPDATE l1_acts SET family = 'not-a-family' WHERE act_id = $1")
        .bind(act_id.to_string())
        .execute(&pool)
        .await
        .expect("the fixture writes around the crate");

    let wedged = host.close_epoch().await;
    assert!(
        matches!(wedged, Err(StandInError::Formation(_))),
        "the close refuses rather than skipping: {wedged:?}"
    );
    let still_approved: String = sqlx::query_scalar("SELECT status FROM l1_acts WHERE act_id = $1")
        .bind(act_id.to_string())
        .fetch_one(&pool)
        .await
        .expect("the row is still there");
    assert_eq!(still_approved, "approved", "and it stays selectable");
}

/// A hyper act whose middle went missing in storage is refused, not
/// panicked on: the read path does not re-run formation and the column is
/// nullable, so the library path has to answer for it (L1-01).
///
/// A stored hyper act with no middle is refused rather than taking the library path down.
/// ´claim:close:a-stored-hyper-act-without-a-middle-is-refused´
#[sqlx::test(migrations = "../../migrations")]
async fn a_stored_hyper_act_without_a_middle_is_refused(pool: PgPool) {
    let host = standin(pool.clone());
    let alice = funded_actor(&host, 10 * THETA).await;
    let chat = ActId::new(&alice.address(), 0, Family::Participant).expect("valid");
    let founding = Proposal {
        body: StructuralBody {
            author: alice.address(),
            seq: 0,
            family: Family::Participant,
            middle: Some(NodeId::Mint(chat.clone())),
            target: NodeId::Mint(chat.clone()),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        },
        payload: vec![],
        deps: vec![],
    };
    submit(&host, &alice, founding).await;

    sqlx::query("UPDATE l1_acts SET middle = NULL WHERE act_id = $1")
        .bind(chat.to_string())
        .execute(&pool)
        .await
        .expect("the fixture writes around the crate");

    let refused = host.close_epoch().await;
    assert!(
        matches!(refused, Err(StandInError::Formation(_))),
        "no panic, an error: {refused:?}"
    );
}
