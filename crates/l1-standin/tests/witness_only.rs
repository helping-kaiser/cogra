//! Witness-only retention: the host holds an act's payload, content salt
//! and proposal nonce from seal until acceptance — the handshake needs
//! them to form the commitments — and at acceptance keeps only the
//! structural record, the payload length and both commitments
//! (data-model.md "Act payload carriage").
//!
//! **Budget: this suite runs in ≤ 10 s.** Like `host.rs`, every test spins
//! its own database and replays the workspace migration set.

use common::l1::Family;
use common::l1::client::ActorKey;
use common::l1::handshake::{Proposal, StructuralBody, content_commitment, deps_commitment};
use common::l1::identifier::{ActId, NodeId};
use l1_standin::{StandIn, StandInConfig};
use sqlx::PgPool;

const THETA: i64 = 1_000_000;

fn standin(pool: PgPool) -> StandIn {
    StandIn::new(
        pool,
        StandInConfig {
            theta_micro: THETA,
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

fn opinion(actor: &ActorKey, seq: u64, target: &str, deps: Vec<ActId>) -> Proposal {
    Proposal {
        body: StructuralBody {
            author: actor.address(),
            seq,
            family: Family::Opinion,
            middle: None,
            target: NodeId::Prof(target.to_string()),
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

async fn funded_actor(host: &StandIn, micro: i64) -> ActorKey {
    let actor = ActorKey::generate();
    host.credit_burn(&actor.address(), micro)
        .await
        .expect("burn");
    actor
}

/// Seals and approves, returning the sealed act the author approved.
async fn submit(
    host: &StandIn,
    actor: &ActorKey,
    proposal: Proposal,
) -> common::l1::handshake::VerifiedAct {
    let pre = actor.pre_sign(proposal);
    let sealed = host.seal(pre.clone()).await.expect("seals");
    let host_key = host.host_public_key().await.expect("host key");
    let witness = actor.approve(&pre, &sealed, &host_key).expect("approves");
    host.approve(witness).await.expect("approval accepted");
    sealed
}

/// The handshake custody columns of one stored act, as the table holds them.
async fn custody(pool: &PgPool, act_id: &ActId) -> (bool, bool, bool, i64) {
    sqlx::query_as(
        "SELECT payload IS NULL, content_salt IS NULL, nonce IS NULL, payload_len
         FROM l1_acts WHERE act_id = $1",
    )
    .bind(act_id.to_string())
    .fetch_one(pool)
    .await
    .expect("the act is stored")
}

/// Acceptance nulls the payload, its content salt and the proposal nonce, and keeps the payload length, the pre-commitment and both commitments.
/// ´claim:standin:acceptance-keeps-the-witness-and-drops-the-handshake-custody´
#[sqlx::test(migrations = "../../migrations")]
async fn acceptance_nulls_the_payload_salt_and_nonce_and_keeps_length_and_commitments(
    pool: PgPool,
) {
    let host = standin(pool.clone());
    let actor = funded_actor(&host, 3 * THETA).await;
    let sealed = submit(&host, &actor, registration(&actor)).await;
    let act_id = sealed.proposal.body.act_id();

    let package = host
        .close_epoch()
        .await
        .expect("closes")
        .expect("non-empty");
    assert_eq!(custody(&pool, &act_id).await, (true, true, true, 7));

    let stored = host
        .sealed_act(&act_id)
        .await
        .expect("reads")
        .expect("stored");
    assert!(stored.approved);
    assert!(
        stored.sealed.is_none(),
        "no handshake custody after acceptance"
    );
    assert_eq!(stored.payload_len, 7);
    assert_eq!(stored.pre_commitment, sealed.pre_commitment);
    assert_eq!(stored.content_commitment, sealed.content_commitment);
    assert_eq!(stored.body, sealed.proposal.body);

    let record = &package.records[0];
    assert_eq!(record.payload_witness, sealed.content_commitment);
    assert_eq!(
        record.payload_witness,
        content_commitment(
            &act_id,
            &sealed.pre_commitment,
            &sealed.content_salt,
            &sealed.proposal.payload
        )
        .to_vec(),
        "the witness the host keeps opens over the carriage the author holds"
    );
}

/// Until acceptance the host keeps the custody the handshake needs: a sealed act, an approved one, and an approved act an insolvent author leaves unaccepted across a close all still read back whole.
/// ´claim:standin:handshake-custody-holds-until-acceptance´
#[sqlx::test(migrations = "../../migrations")]
async fn a_sealed_or_approved_act_keeps_its_payload_until_acceptance(pool: PgPool) {
    let host = standin(pool.clone());
    let sealing = funded_actor(&host, 3 * THETA).await;
    let pre = sealing.pre_sign(registration(&sealing));
    let act_id = pre.proposal.body.act_id();
    let sealed = host.seal(pre.clone()).await.expect("seals");
    let stored = host
        .sealed_act(&act_id)
        .await
        .expect("reads")
        .expect("stored");
    assert!(!stored.approved);
    assert_eq!(stored.sealed.as_ref(), Some(&sealed));

    let host_key = host.host_public_key().await.expect("host key");
    host.approve(sealing.approve(&pre, &sealed, &host_key).expect("approves"))
        .await
        .expect("approval accepted");
    let stored = host
        .sealed_act(&act_id)
        .await
        .expect("reads")
        .expect("stored");
    assert!(stored.approved);
    assert_eq!(stored.sealed.as_ref(), Some(&sealed));

    let insolvent = ActorKey::generate();
    let deferred = submit(&host, &insolvent, registration(&insolvent)).await;
    host.close_epoch()
        .await
        .expect("closes")
        .expect("non-empty");
    let deferred_id = deferred.proposal.body.act_id();
    assert_eq!(custody(&pool, &deferred_id).await, (false, false, false, 7));
    let stored = host
        .sealed_act(&deferred_id)
        .await
        .expect("reads")
        .expect("stored");
    assert_eq!(stored.sealed, Some(deferred));
}

/// After closes over several epochs, no accepted act anywhere in the table holds a payload, a content salt or a nonce.
/// ´claim:standin:no-accepted-act-holds-handshake-custody´
#[sqlx::test(migrations = "../../migrations")]
async fn every_accepted_act_holds_no_payload_salt_or_nonce(pool: PgPool) {
    let host = standin(pool.clone());
    let alice = funded_actor(&host, 10 * THETA).await;
    let bob = funded_actor(&host, 10 * THETA).await;
    let alice_reg = submit(&host, &alice, registration(&alice)).await;
    host.close_epoch()
        .await
        .expect("closes")
        .expect("non-empty");
    submit(&host, &bob, registration(&bob)).await;
    submit(
        &host,
        &alice,
        opinion(
            &alice,
            1,
            &bob.address(),
            vec![alice_reg.proposal.body.act_id()],
        ),
    )
    .await;
    host.close_epoch()
        .await
        .expect("closes")
        .expect("non-empty");
    submit(&host, &bob, opinion(&bob, 1, &alice.address(), vec![])).await;
    host.close_epoch()
        .await
        .expect("closes")
        .expect("non-empty");

    let (accepted, holding): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*),
                COUNT(*) FILTER (WHERE payload IS NOT NULL
                                    OR content_salt IS NOT NULL
                                    OR nonce IS NOT NULL)
         FROM l1_acts WHERE status = 'accepted'",
    )
    .fetch_one(&pool)
    .await
    .expect("counts");
    assert_eq!(accepted, 4);
    assert_eq!(holding, 0);
}

/// The dependency salt is not handshake custody: it survives acceptance, so an ordering fraud proof still opens the dependency commitment from the record's own columns.
/// ´claim:standin:the-dependency-opening-survives-acceptance´
#[sqlx::test(migrations = "../../migrations")]
async fn the_dependency_salt_survives_acceptance_so_the_fraud_proof_still_opens(pool: PgPool) {
    let host = standin(pool.clone());
    let alice = funded_actor(&host, 10 * THETA).await;
    let bob = funded_actor(&host, 10 * THETA).await;
    let bob_reg = submit(&host, &bob, registration(&bob)).await;
    host.close_epoch()
        .await
        .expect("closes")
        .expect("non-empty");
    let dep = bob_reg.proposal.body.act_id();
    let act = submit(&host, &alice, opinion(&alice, 0, &bob.address(), vec![dep])).await;
    host.close_epoch()
        .await
        .expect("closes")
        .expect("non-empty");

    let act_id = act.proposal.body.act_id();
    let (deps, deps_salt, pre_commitment, stored): (Vec<String>, Vec<u8>, Vec<u8>, Vec<u8>) =
        sqlx::query_as(
            "SELECT deps, deps_salt, pre_commitment, deps_commitment
             FROM l1_acts WHERE act_id = $1 AND status = 'accepted'",
        )
        .bind(act_id.to_string())
        .fetch_one(&pool)
        .await
        .expect("the accepted act");
    let deps: Vec<ActId> = deps
        .iter()
        .map(|d| ActId::parse(d).expect("a stored act id"))
        .collect();
    assert_eq!(
        deps_commitment(&act_id, &pre_commitment, &deps_salt, &deps).to_vec(),
        stored
    );
}

/// A published epoch read back after acceptance marks its payloads exactly as the close published them, though the payload bytes are gone.
/// ´claim:standin:a-read-back-epoch-still-marks-its-payloads´
#[sqlx::test(migrations = "../../migrations")]
async fn a_published_epoch_read_back_after_acceptance_still_marks_its_payload(pool: PgPool) {
    let host = standin(pool);
    let alice = funded_actor(&host, 10 * THETA).await;
    let bob = funded_actor(&host, 10 * THETA).await;
    submit(&host, &alice, registration(&alice)).await;
    submit(&host, &bob, opinion(&bob, 0, &alice.address(), vec![])).await;
    let package = host
        .close_epoch()
        .await
        .expect("closes")
        .expect("non-empty");
    let marked: Vec<(Family, bool)> = package
        .records
        .iter()
        .map(|r| (r.family, r.payload_marked))
        .collect();
    assert!(marked.contains(&(Family::Registration, true)));
    assert!(marked.contains(&(Family::Opinion, false)));

    let read_back = host.epochs_since(-1).await.expect("epochs");
    assert_eq!(read_back, vec![package]);
}

/// The table itself refuses to drop an act's handshake custody before acceptance, or to drop one part of it alone.
/// ´claim:standin:custody-leaves-only-whole-and-only-at-acceptance´
#[sqlx::test(migrations = "../../migrations")]
async fn the_table_refuses_custody_dropped_early_or_in_part(pool: PgPool) {
    let host = standin(pool.clone());
    let actor = funded_actor(&host, 3 * THETA).await;
    let act_id = submit(&host, &actor, registration(&actor))
        .await
        .proposal
        .body
        .act_id();
    let early = sqlx::query(
        "UPDATE l1_acts SET payload = NULL, content_salt = NULL, nonce = NULL WHERE act_id = $1",
    )
    .bind(act_id.to_string())
    .execute(&pool)
    .await;
    assert!(early.is_err(), "an approved act keeps its custody");

    host.close_epoch()
        .await
        .expect("closes")
        .expect("non-empty");
    let partial = sqlx::query("UPDATE l1_acts SET content_salt = '\\x00' WHERE act_id = $1")
        .bind(act_id.to_string())
        .execute(&pool)
        .await;
    assert!(partial.is_err(), "a salt without its payload is refused");
}
