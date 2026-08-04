// Integration tests for the stand-in host: the admission handshake, the
// epoch close (ordering, causal keys, maturities, θ-debits), and the
// published packages. Each test gets its own throwaway database via
// #[sqlx::test]; the workspace migrations create the l1_* tables.

use common::l1::Family;
use common::l1::census::LegRole;
use common::l1::client::ActorKey;
use common::l1::handshake::{ApprovalWitness, Proposal, StructuralBody};
use common::l1::identifier::{ActId, NodeId};
use l1_standin::{StandIn, StandInConfig, StandInError};
use sqlx::PgPool;

const THETA: i64 = 1_000_000; // 1.0 in micro-units — easy arithmetic

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
    assert_eq!(leg.tau, 0.0); // first edge at both endpoints

    // θ-debit consummated; count incremented; B_i monotone.
    let balance = host.balance(&actor.address()).await.expect("balance");
    assert_eq!(balance.action_count, 1);
    assert!((balance.balance - 2.0).abs() < 1e-9);
    assert!((balance.burned_total - 3.0).abs() < 1e-9);

    // The ingest read returns the same package.
    let since = host.epochs_since(-1).await.expect("epochs");
    assert_eq!(since.len(), 1);
    assert_eq!(since[0], package);
    assert!(host.epochs_since(0).await.expect("epochs").is_empty());
}

#[sqlx::test(migrations = "../../migrations")]
async fn empty_close_publishes_nothing(pool: PgPool) {
    let host = standin(pool);
    assert!(host.close_epoch().await.expect("ok").is_none());
    assert!(host.epochs_since(-1).await.expect("ok").is_empty());
}

#[sqlx::test(migrations = "../../migrations")]
async fn seal_rejects_formation_failures(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 3 * THETA).await;

    // Registration toward someone else's Profile.
    let mut bad = registration(&actor);
    bad.body.target = NodeId::Prof("someone-else".into());
    let err = host.seal(actor.pre_sign(bad)).await.expect_err("rejected");
    assert!(matches!(err, StandInError::Formation(_)));

    // Fixed-parameter family with non-fixed parameters.
    let mut bad = registration(&actor);
    bad.body.p_d = 0.5;
    assert!(matches!(
        host.seal(actor.pre_sign(bad)).await,
        Err(StandInError::Formation(_))
    ));

    // Payload over M_payload.
    let mut bad = registration(&actor);
    bad.payload = vec![0u8; 2048];
    assert!(matches!(
        host.seal(actor.pre_sign(bad)).await,
        Err(StandInError::Formation(_))
    ));

    // A formation failure produces no Layer-1 object: nothing to close.
    assert!(host.close_epoch().await.expect("ok").is_none());
}

#[sqlx::test(migrations = "../../migrations")]
async fn seal_rejects_authentication_failures(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 3 * THETA).await;
    let mallory = ActorKey::generate();

    // Author address not bound to the signing key.
    let mut pre = actor.pre_sign(registration(&actor));
    pre.author_pubkey = mallory.public_key_bytes();
    assert!(matches!(
        host.seal(pre).await,
        Err(StandInError::Authentication(_))
    ));

    // Tampered body after pre-signing.
    let mut pre = actor.pre_sign(opinion(&actor, 1, "bob", vec![]));
    pre.proposal.body.p_d = -1.0;
    assert!(matches!(
        host.seal(pre).await,
        Err(StandInError::Authentication(_))
    ));

    // Tampered payload after pre-signing (pre-digest mismatch).
    let mut pre = actor.pre_sign(opinion(&actor, 2, "bob", vec![]));
    pre.proposal.payload = b"swapped".to_vec();
    assert!(matches!(
        host.seal(pre).await,
        Err(StandInError::Authentication(_))
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn seal_rejects_identifier_reuse_and_key_change(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 10 * THETA).await;

    let pre = actor.pre_sign(opinion(&actor, 1, "bob", vec![]));
    host.seal(pre).await.expect("first seal ok");

    // Same act identifier again — equivocation, rejected.
    let pre = actor.pre_sign(opinion(&actor, 1, "carol", vec![]));
    assert!(matches!(
        host.seal(pre).await,
        Err(StandInError::Conflict(_))
    ));

    // Same author-local sequence under a different family — reuse,
    // rejected (UNIQUE(author, seq)).
    let mut prop = registration(&actor);
    prop.body.seq = 1;
    assert!(matches!(
        host.seal(actor.pre_sign(prop)).await,
        Err(StandInError::Conflict(_))
    ));

    // A different key claiming the same address cannot exist by
    // construction (address is key-derived), so key consistency is
    // enforced the other way: the address stays bound to its first key.
}

#[sqlx::test(migrations = "../../migrations")]
async fn approve_verifies_the_witness(pool: PgPool) {
    let host = standin(pool);
    let actor = funded_actor(&host, 3 * THETA).await;
    let mallory = ActorKey::generate();

    let pre = actor.pre_sign(registration(&actor));
    let sealed = host.seal(pre.clone()).await.expect("seals");
    let host_key = host.host_public_key().await.expect("key");

    // Unknown act.
    let bogus = ApprovalWitness {
        act_id: ActId::new("nobody", 9, Family::Opinion).expect("ok"),
        approval_signature: vec![1, 2, 3],
    };
    assert!(matches!(
        host.approve(bogus).await,
        Err(StandInError::UnknownAct(_))
    ));

    // A witness signed by the wrong key.
    let witness = actor.approve(&pre, &sealed, &host_key).expect("client ok");
    let forged = ApprovalWitness {
        act_id: witness.act_id.clone(),
        approval_signature: {
            // mallory signs the same message — must not verify as actor
            let pre2 = mallory.pre_sign(registration(&mallory));
            pre2.pre_signature
        },
    };
    assert!(matches!(
        host.approve(forged).await,
        Err(StandInError::Authentication(_))
    ));

    // The genuine witness lands; a second approval is idempotent.
    host.approve(witness.clone()).await.expect("approves");
    host.approve(witness).await.expect("idempotent");
    let package = host.close_epoch().await.expect("ok").expect("one act");
    assert_eq!(package.records.len(), 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn insolvent_authors_defer_until_funded(pool: PgPool) {
    let host = standin(pool);
    let actor = ActorKey::generate(); // no burn: W1 fails at close
    host.credit_burn(&actor.address(), THETA / 2)
        .await
        .expect("underfunded burn");
    submit(&host, &actor, registration(&actor)).await;

    // W1 defers the act: no epoch closes.
    assert!(host.close_epoch().await.expect("ok").is_none());

    // Committing a burn restores capacity immediately (§7.1); the act
    // lands at the next close.
    host.credit_burn(&actor.address(), THETA)
        .await
        .expect("burn");
    let package = host.close_epoch().await.expect("ok").expect("lands now");
    assert_eq!(package.records.len(), 1);
}

#[sqlx::test(migrations = "../../migrations")]
async fn dependencies_defer_and_order(pool: PgPool) {
    let host = standin(pool);
    let alice = funded_actor(&host, 10 * THETA).await;
    let reg = registration(&alice);
    let reg_id = reg.body.act_id();

    // An act depending on a never-submitted act defers indefinitely.
    let orphan_dep = ActId::new("ghost", 1, Family::Opinion).expect("ok");
    submit(&host, &alice, opinion(&alice, 1, "bob", vec![orphan_dep])).await;
    assert!(host.close_epoch().await.expect("ok").is_none());

    // An act depending on a same-close act lands after it, at a strictly
    // greater Lamport time, whatever the approval order (the dependent
    // was approved first above; now its dependency arrives).
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
    // A: Actor → middle; T: middle → terminal target; T renders the tuple
    // transposed. Both legs share the one act (one record, one key).
    assert_eq!(a.source, NodeId::Addr(publisher.address()));
    assert_eq!(a.target, NodeId::Prof(subject.address()));
    assert_eq!(t.source, NodeId::Prof(subject.address()));
    assert_eq!(t.target, NodeId::name("moderator").expect("ok"));
    // Both legs see the same pre-act state: first appearance of every
    // endpoint, τ = 0 on both.
    assert_eq!(a.tau, 0.0);
    assert_eq!(t.tau, 0.0);
    // One act = one θ-debit, one count increment — never per leg.
    let balance = host.balance(&publisher.address()).await.expect("ok");
    assert_eq!(balance.action_count, 1);
    assert!((balance.balance - 9.0).abs() < 1e-9);
}

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

    // A Bid toward an existing Offer would hang a second Item's incidence
    // on it — rejected at formation.
    let item = NodeId::Mint(ActId::new("lister", 0, Family::Owner).expect("ok"));
    let foreign_offer = NodeId::Mint(ActId::new("other", 1, Family::Bid).expect("ok"));
    assert!(matches!(
        host.seal(actor.pre_sign(hyper(0, Family::Bid, &item, &foreign_offer)))
            .await,
        Err(StandInError::Formation(_))
    ));

    // A Bid minting its own Offer seals.
    let own_offer = NodeId::Mint(ActId::new(&actor.address(), 1, Family::Bid).expect("ok"));
    submit(&host, &actor, hyper(1, Family::Bid, &item, &own_offer)).await;

    // An ordinary-role Send toward an existing Message stays legal — the
    // Edition-5 permission set keeps it, and CoGra's transcript fold, not
    // formation, is what ignores it.
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

#[sqlx::test(migrations = "../../migrations")]
async fn publish_toward_an_existing_mint_revises_rather_than_mints(pool: PgPool) {
    let host = standin(pool);
    let author = funded_actor(&host, 10 * THETA).await;

    // Genesis identity is per record: a Publish toward an existing Content
    // node is the revise gesture, well-formed at the substrate — the L2
    // fold, not formation, decides whether it wins.
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

#[sqlx::test(migrations = "../../migrations")]
async fn founding_participant_self_loops_at_its_own_mint(pool: PgPool) {
    let host = standin(pool);
    let founder = funded_actor(&host, 10 * THETA).await;

    // The found shape: both legs at the act's own mint — the A-leg enters
    // the Chat the act creates, the T-leg mints it.
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
    // The T-leg renders the tuple transposed: the forced-positive
    // component leads.
    assert_eq!((t.p_d, t.p_i), (0.0, 1.0));
}

#[sqlx::test(migrations = "../../migrations")]
async fn maturity_grows_with_prior_degree(pool: PgPool) {
    let host = standin(pool);
    let alice = funded_actor(&host, 10 * THETA).await;
    let bob = funded_actor(&host, 10 * THETA).await;

    submit(&host, &alice, registration(&alice)).await;
    host.close_epoch().await.expect("ok").expect("epoch 0");

    // Bob's opinion toward Alice's Profile: Bob's Actor node is fresh
    // (degree 0) but Alice's Profile has degree 1 from the Registration —
    // max(0, 1) = 1 → τ = 1 − 1/(1+1) = 0.5.
    submit(&host, &bob, opinion(&bob, 0, &alice.address(), vec![])).await;
    let package = host.close_epoch().await.expect("ok").expect("epoch 1");
    assert_eq!(package.epoch, 1);
    let leg = &package.records[0].legs[0];
    assert!((leg.tau - 0.5).abs() < 1e-12);
    // Later acts never contribute to an earlier act's maturity: epoch-0
    // record still reads τ = 0 through the ingest surface.
    let all = host.epochs_since(-1).await.expect("ok");
    assert_eq!(all[0].records[0].legs[0].tau, 0.0);
}

#[sqlx::test(migrations = "../../migrations")]
async fn act_budget_caps_the_epoch(pool: PgPool) {
    // target 1: the epoch fills at one act and closes on approve.
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
    let packages = host.epochs_since(-1).await.expect("ok");
    assert_eq!(packages.len(), 2, "one act per epoch under a budget of 1");
    assert_eq!(packages[0].records.len(), 1);
    assert_eq!(packages[1].records.len(), 1);
}
