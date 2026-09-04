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
use common::l1::handshake::{ApprovalWitness, Proposal, StructuralBody};
use common::l1::identifier::{ActId, NodeId};
use l1_standin::{StandIn, StandInConfig, StandInError};
use sqlx::PgPool;

/// 1.0 in micro-units — easy arithmetic.
const THETA: i64 = 1_000_000;

fn standin(pool: PgPool) -> StandIn {
    StandIn::new(
        pool,
        StandInConfig {
            theta_micro: THETA,
            epoch_target_acts: 10_000,
            max_payload_bytes: 1024,
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
async fn submit(host: &StandIn, actor: &ActorKey, proposal: Proposal) -> ActId {
    let act_id = proposal.body.act_id();
    let pre = actor.pre_sign(proposal);
    let sealed = host.seal(pre.clone()).await.expect("seals");
    let host_key = host.host_public_key().await.expect("host key");
    let witness = actor.approve(&pre, &sealed, &host_key).expect("approves");
    host.approve(witness).await.expect("approval accepted");
    act_id
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

    let package = host
        .close_epoch()
        .await
        .expect("closes")
        .expect("non-empty");
    assert_eq!(package.epoch, 0);
    assert_eq!(package.records.len(), 1);
    let record = &package.records[0];
    assert_eq!(record.act_id, act_id);
    assert_eq!(record.family, Family::Registration);
    assert_eq!(record.act_time, 1);
    assert_eq!(record.position, 0);
    assert!(record.payload_marked);
    assert_eq!(record.legs.len(), 1);
    let leg = &record.legs[0];
    assert_eq!(leg.role, LegRole::Binary);
    assert_eq!(leg.source, NodeId::Addr(actor.address()));
    assert_eq!(leg.target, NodeId::Prof(actor.address()));
    assert_eq!(leg.tau, 0.0);

    let balance = host.balance(&actor.address()).await.expect("balance");
    assert_eq!(balance.action_count, 1);
    assert!((balance.balance - 2.0).abs() < 1e-9);
    assert!((balance.burned_total - 3.0).abs() < 1e-9);

    let since = host.epochs_since(-1).await.expect("epochs");
    assert_eq!(since.len(), 1);
    assert_eq!(since[0], package);
    assert!(host.epochs_since(0).await.expect("epochs").is_empty());
}

/// An epoch with nothing approved in it publishes no package at all.
/// ´claim:close:an-empty-epoch-publishes-nothing´
#[sqlx::test(migrations = "../../migrations")]
async fn empty_close_publishes_nothing(pool: PgPool) {
    let host = standin(pool);
    assert!(host.close_epoch().await.expect("ok").is_none());
    assert!(host.epochs_since(-1).await.expect("ok").is_empty());
}

/// The close loop publishes an approved act on its interval, with no close asked for.
/// ´claim:close:the-interval-loop-publishes-without-being-asked´
#[sqlx::test(migrations = "../../migrations")]
async fn close_loop_publishes_on_the_interval(pool: PgPool) {
    let host = standin(pool);
    let clock = tokio::spawn(l1_standin::close_loop(host.clone(), 1));

    let actor = funded_actor(&host, 3 * THETA).await;
    let act_id = submit(&host, &actor, registration(&actor)).await;

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(15);
    let package = loop {
        if let Some(package) = host.epochs_since(-1).await.expect("epochs").pop() {
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
/// and a payload over M_payload — all reject at seal. None produces a
/// Layer-1 object, so a subsequent close has nothing to publish.
///
/// A proposal that fails formation rejects at seal and leaves no Layer 1 object behind.
/// ´claim:seal:formation-failures-leave-no-record-behind´
#[sqlx::test(migrations = "../../migrations")]
async fn seal_rejects_formation_failures(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 3 * THETA).await;

    let mut bad = registration(&actor);
    bad.body.target = NodeId::Prof("someone-else".into());
    let err = host.seal(actor.pre_sign(bad)).await.expect_err("rejected");
    assert!(matches!(err, StandInError::Formation(_)));

    let mut bad = registration(&actor);
    bad.body.p_d = 0.5;
    assert!(matches!(
        host.seal(actor.pre_sign(bad)).await,
        Err(StandInError::Formation(_))
    ));

    let mut bad = registration(&actor);
    bad.payload = vec![0u8; 2048];
    assert!(matches!(
        host.seal(actor.pre_sign(bad)).await,
        Err(StandInError::Formation(_))
    ));

    assert!(host.close_epoch().await.expect("ok").is_none());
}

/// Three authentication failures reject at seal: an author address that
/// does not bind to the signing key, a proposal body tampered after
/// pre-signing, and a payload tampered after pre-signing (which
/// mismatches the pre-digest).
///
/// A proposal whose signature does not bind its author, body, and payload rejects at seal.
/// ´claim:seal:authentication-failures-reject-at-seal´
#[sqlx::test(migrations = "../../migrations")]
async fn seal_rejects_authentication_failures(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 3 * THETA).await;
    let mallory = ActorKey::generate();

    let mut pre = actor.pre_sign(registration(&actor));
    pre.author_pubkey = mallory.public_key_bytes();
    assert!(matches!(
        host.seal(pre).await,
        Err(StandInError::Authentication(_))
    ));

    let mut pre = actor.pre_sign(opinion(&actor, 1, "bob", vec![]));
    pre.proposal.body.p_d = -1.0;
    assert!(matches!(
        host.seal(pre).await,
        Err(StandInError::Authentication(_))
    ));

    let mut pre = actor.pre_sign(opinion(&actor, 2, "bob", vec![]));
    pre.proposal.payload = b"swapped".to_vec();
    assert!(matches!(
        host.seal(pre).await,
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

    let pre = actor.pre_sign(opinion(&actor, 1, "bob", vec![]));
    host.seal(pre).await.expect("first seal ok");

    let pre = actor.pre_sign(opinion(&actor, 1, "carol", vec![]));
    assert!(matches!(
        host.seal(pre).await,
        Err(StandInError::Conflict(_))
    ));

    let mut prop = registration(&actor);
    prop.body.seq = 1;
    assert!(matches!(
        host.seal(actor.pre_sign(prop)).await,
        Err(StandInError::Conflict(_))
    ));
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

    let pre = actor.pre_sign(registration(&actor));
    let sealed = host.seal(pre.clone()).await.expect("seals");
    let host_key = host.host_public_key().await.expect("key");

    let bogus = ApprovalWitness {
        act_id: ActId::new("nobody", 9, Family::Opinion).expect("ok"),
        approval_signature: vec![1, 2, 3],
    };
    assert!(matches!(
        host.approve(bogus).await,
        Err(StandInError::UnknownAct(_))
    ));

    let witness = actor.approve(&pre, &sealed, &host_key).expect("client ok");
    let forged = ApprovalWitness {
        act_id: witness.act_id.clone(),
        approval_signature: {
            let pre2 = mallory.pre_sign(registration(&mallory));
            pre2.pre_signature
        },
    };
    assert!(matches!(
        host.approve(forged).await,
        Err(StandInError::Authentication(_))
    ));

    host.approve(witness.clone()).await.expect("approves");
    host.approve(witness).await.expect("idempotent");
    let package = host.close_epoch().await.expect("ok").expect("one act");
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

    assert!(host.close_epoch().await.expect("ok").is_none());

    host.credit_burn(&actor.address(), THETA)
        .await
        .expect("burn");
    let package = host.close_epoch().await.expect("ok").expect("lands now");
    assert_eq!(package.records.len(), 1);
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
    assert!(host.close_epoch().await.expect("ok").is_none());

    submit(
        &host,
        &alice,
        opinion(&alice, 2, "carol", vec![reg_id.clone()]),
    )
    .await;
    submit(&host, &alice, reg).await;
    let package = host.close_epoch().await.expect("ok").expect("lands");
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
    let package = host.close_epoch().await.expect("ok").expect("lands");
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
    assert!((balance.balance - 9.0).abs() < 1e-9);
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
        host.seal(actor.pre_sign(hyper(0, Family::Bid, &item, &foreign_offer)))
            .await,
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

    let package = host.close_epoch().await.expect("ok").expect("lands");
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
    let package = host.close_epoch().await.expect("ok").expect("lands");
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

    let package = host.close_epoch().await.expect("ok").expect("lands");
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
/// acts never contribute to an earlier act's maturity: the epoch-0
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
    host.close_epoch().await.expect("ok").expect("epoch 0");

    submit(&host, &bob, opinion(&bob, 0, &alice.address(), vec![])).await;
    let package = host.close_epoch().await.expect("ok").expect("epoch 1");
    assert_eq!(package.epoch, 1);
    let leg = &package.records[0].legs[0];
    assert!((leg.tau - 0.5).abs() < 1e-12);
    let all = host.epochs_since(-1).await.expect("ok");
    assert_eq!(all[0].records[0].legs[0].tau, 0.0);
}

/// With the epoch target act budget set to 1, the epoch fills at one act
/// and closes on approve, so each of two submitted acts lands in its own
/// epoch.
///
/// An epoch closes as soon as the act budget fills, so each act lands in its own epoch.
/// ´claim:close:the-act-budget-caps-the-epoch´
#[sqlx::test(migrations = "../../migrations")]
async fn act_budget_caps_the_epoch(pool: PgPool) {
    let host = StandIn::new(
        pool.clone(),
        StandInConfig {
            theta_micro: THETA,
            epoch_target_acts: 1,
            max_payload_bytes: 1024,
        },
    );
    let alice = funded_actor(&host, 10 * THETA).await;
    submit(&host, &alice, registration(&alice)).await;
    submit(&host, &alice, opinion(&alice, 1, "bob", vec![])).await;
    host.close_epoch().await.expect("ok").expect("epoch 0");
    host.close_epoch().await.expect("ok").expect("epoch 1");
    let packages = host.epochs_since(-1).await.expect("ok");
    assert_eq!(packages.len(), 2, "one act per epoch under a budget of 1");
    assert_eq!(packages[0].records.len(), 1);
    assert_eq!(packages[1].records.len(), 1);
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
            theta_micro: THETA,
            epoch_target_acts: 1,
            max_payload_bytes: 1024,
        },
    );
    let alice = funded_actor(&host, 10 * THETA).await;
    submit(&host, &alice, registration(&alice)).await;
    submit(&host, &alice, opinion(&alice, 1, "bob", vec![])).await;

    assert!(
        host.epochs_since(-1).await.expect("ok").is_empty(),
        "the act budget is full twice over and nothing has closed"
    );
    host.close_epoch()
        .await
        .expect("ok")
        .expect("the clock closes it");
}

/// One stored act that will not parse fails the whole close and stays
/// selectable, and the same value inside a published epoch fails the
/// ingest read — the ruled behavior for a substrate written around the
/// crate that owns its tables (L1-01/L1-02, ruling 11).
///
/// A malformed stored act wedges the close and the ingest read rather than being skipped.
/// ´claim:close:a-malformed-stored-act-wedges-the-close´
#[sqlx::test(migrations = "../../migrations")]
async fn a_malformed_stored_act_wedges_the_close(pool: PgPool) {
    let host = standin(pool.clone());
    let alice = funded_actor(&host, 10 * THETA).await;
    let act_id = submit(&host, &alice, registration(&alice)).await;

    // Only a writer that is not this crate can produce such a row: every
    // column here is written from a value that already parsed.
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
