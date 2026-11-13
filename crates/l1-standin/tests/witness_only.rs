//! Witness-only retention: the host never holds an act's payload or
//! content nonce — the submission carries neither (layer1-interface.md
//! §8.2, "Verified act") — and keeps the content salt it drew only from
//! seal until acceptance, when the row keeps the structural record, both
//! commitments and the dependency opening (§8.4, "Custody across phases").
//!
//! **Budget: this suite runs in ≤ 10 s.** Like `host.rs`, every test spins
//! its own database and replays the workspace migration set.

use common::l1::Family;
use common::l1::client::ActorKey;
use common::l1::handshake::{Proposal, StructuralBody};
use common::l1::identifier::{ActId, NodeId};
use common::l1::proposal::{self, PreSigned, SealedAct};
use l1_standin::{StandIn, StandInConfig};
use sqlx::PgPool;

/// The price every close charges (tests/host.rs explains why no other).
const THETA: i64 = l1_standin::REFERENCE_THETA_MICRO;

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

/// Seals the submission and approves on the device, returning the sealed
/// act the author approved.
async fn land(host: &StandIn, actor: &ActorKey, pre: &PreSigned) -> SealedAct {
    let sealed = host.seal(pre.submission()).await.expect("seals");
    let host_key = host.host_public_key().await.expect("host key");
    let witness = pre.approve(actor, &sealed, &host_key).expect("approves");
    host.approve(witness).await.expect("approval accepted");
    sealed
}

async fn submit(host: &StandIn, actor: &ActorKey, proposal: Proposal) -> (PreSigned, SealedAct) {
    let pre = PreSigned::sign(actor, proposal);
    let sealed = land(host, actor, &pre).await;
    (pre, sealed)
}

/// What an ordering fraud proof reads off an accepted row: the dependency
/// list, nonce and salt, the pre-commitment and the dependency commitment.
type FraudProofColumns = (Vec<String>, Vec<u8>, Vec<u8>, Vec<u8>, Vec<u8>);

/// The dependency opening as stored — nonce, list and salt — each read as
/// nullable, so a missing member shows as `None` rather than a decode error.
type DependencyOpening = (Option<Vec<u8>>, Option<Vec<String>>, Option<Vec<u8>>);

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// The names of `l1_acts`' columns, as the database has them.
async fn act_columns(pool: &PgPool) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT column_name::TEXT FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'l1_acts'",
    )
    .fetch_all(pool)
    .await
    .expect("columns")
}

/// The act's whole row as Postgres renders it — every bytea in hex — so a
/// search finds a value whatever column it might sit in.
async fn row_text(pool: &PgPool, act_id: &ActId) -> String {
    sqlx::query_scalar("SELECT a::TEXT FROM l1_acts a WHERE act_id = $1")
        .bind(act_id.to_string())
        .fetch_one(pool)
        .await
        .expect("the act is stored")
}

/// The row holds neither member of the pair, nor the content pre-digest,
/// in any column; the dependency nonce it does hold is found the same way,
/// so the search is shown to reach the row's bytes.
async fn assert_holds_no_pair(pool: &PgPool, pre: &PreSigned, stage: &str) {
    let text = row_text(pool, &pre.act_id()).await;
    for (what, bytes) in [
        ("payload", pre.proposal.payload.clone()),
        ("content nonce", pre.content_nonce.clone()),
        ("content pre-digest", pre.content_pre_digest().to_vec()),
    ] {
        assert!(
            !text.contains(&hex(&bytes)),
            "{stage}: the row holds the {what}"
        );
    }
    assert!(
        text.contains(&hex(&pre.dependency_nonce)),
        "{stage}: the search reaches the row"
    );
}

/// No column of the act table is any part of the content pair, its length
/// or its pre-digest, and no stored row at any stage — sealed, approved,
/// accepted, or approved and deferred with its content salt dropped by a
/// redaction — holds the payload, the content nonce or the content
/// pre-digest anywhere in its bytes. The stand-in has no dependency
/// tombstone, so there is no later stage.
///
/// The host's row for an act never holds the payload, the content nonce, their pre-digest or a payload length, at any stage.
/// ´claim:standin:the-host-row-never-holds-the-content-pair´
#[sqlx::test(migrations = "../../migrations")]
async fn the_host_row_never_holds_the_content_pair_at_any_stage(pool: PgPool) {
    let columns = act_columns(&pool).await;
    for gone in [
        "payload",
        "payload_len",
        "nonce",
        "nonce_digest",
        "content_nonce",
        "content_pre_digest",
    ] {
        assert!(!columns.iter().any(|c| c == gone), "column {gone}");
    }
    assert!(!columns.iter().any(|c| c.contains("payload")));

    let host = standin(pool.clone());
    let alice = funded_actor(&host, 3 * THETA).await;
    let mut proposal = registration(&alice);
    proposal.payload = (0xA0..=0xBF).collect();
    let pre = PreSigned::sign(&alice, proposal);
    let sealed = host.seal(pre.submission()).await.expect("seals");
    assert_holds_no_pair(&pool, &pre, "sealed").await;
    let host_key = host.host_public_key().await.expect("host key");
    host.approve(pre.approve(&alice, &sealed, &host_key).expect("approves"))
        .await
        .expect("approval accepted");
    assert_holds_no_pair(&pool, &pre, "approved").await;
    host.close_epoch().await.expect("closes");
    assert_holds_no_pair(&pool, &pre, "accepted").await;

    let insolvent = ActorKey::generate();
    let mut proposal = registration(&insolvent);
    proposal.payload = (0xC0..=0xDF).collect();
    let (deferred, _) = submit(&host, &insolvent, proposal).await;
    host.close_epoch().await.expect("closes");
    let dropped = host
        .drop_carriage(&[deferred.act_id().to_string()])
        .await
        .expect("drops");
    assert_eq!(dropped, 1);
    assert_holds_no_pair(&pool, &deferred, "approved, deferred, dropped").await;
}

/// Acceptance drops the content salt and keeps the pre-commitment and both
/// commitments. The witness the host keeps opens over the content
/// pre-digest the author recomputes from the pair it holds, with the salt
/// the seal returned — the host needs neither to keep it.
///
/// Acceptance drops the content salt and keeps the pre-commitment and both commitments; the witness opens over the author's content pre-digest.
/// ´claim:standin:acceptance-keeps-the-witness-and-drops-the-content-salt´
#[sqlx::test(migrations = "../../migrations")]
async fn acceptance_drops_the_content_salt_and_keeps_both_commitments(pool: PgPool) {
    let host = standin(pool.clone());
    let actor = funded_actor(&host, 3 * THETA).await;
    let (pre, sealed) = submit(&host, &actor, registration(&actor)).await;
    let act_id = pre.act_id();

    let package = host.close_epoch().await.expect("closes");
    let salt_held: bool =
        sqlx::query_scalar("SELECT content_salt IS NOT NULL FROM l1_acts WHERE act_id = $1")
            .bind(act_id.to_string())
            .fetch_one(&pool)
            .await
            .expect("the act is stored");
    assert!(!salt_held);

    let stored = host
        .sealed_act(&act_id)
        .await
        .expect("reads")
        .expect("stored");
    assert!(stored.approved);
    assert!(stored.sealed.is_none(), "no content salt after acceptance");
    assert_eq!(stored.pre_commitment, sealed.act.pre_commitment);
    assert_eq!(stored.content_commitment, sealed.act.content_commitment);
    assert_eq!(stored.body, sealed.act.body);

    let record = &package.records[0];
    assert_eq!(record.payload_witness, sealed.act.content_commitment);
    assert_eq!(
        record.payload_witness,
        proposal::content_commitment(
            &act_id,
            &sealed.act.pre_commitment,
            &sealed.content_salt,
            &pre.content_pair().pre_digest(&act_id)
        )
        .to_vec(),
        "the witness the host keeps opens over the pair the author holds"
    );
}

/// Until acceptance the host keeps the content salt, so the exact sealed
/// act reads back whole — sealed, approved, and approved but left
/// unaccepted across a close by an insolvent author.
///
/// Until acceptance the sealed act reads back whole: sealed, approved, and deferred across a close.
/// ´claim:standin:the-sealed-act-reads-back-until-acceptance´
#[sqlx::test(migrations = "../../migrations")]
async fn a_sealed_or_approved_act_reads_back_whole_until_acceptance(pool: PgPool) {
    let host = standin(pool);
    let sealing = funded_actor(&host, 3 * THETA).await;
    let pre = PreSigned::sign(&sealing, registration(&sealing));
    let act_id = pre.act_id();
    let sealed = host.seal(pre.submission()).await.expect("seals");
    let stored = host
        .sealed_act(&act_id)
        .await
        .expect("reads")
        .expect("stored");
    assert!(!stored.approved);
    assert_eq!(stored.sealed.as_ref(), Some(&sealed));
    assert_eq!(stored.dependency_nonce, pre.dependency_nonce);

    let host_key = host.host_public_key().await.expect("host key");
    host.approve(pre.approve(&sealing, &sealed, &host_key).expect("approves"))
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
    let (deferred, deferred_sealed) = submit(&host, &insolvent, registration(&insolvent)).await;
    host.close_epoch().await.expect("closes");
    let stored = host
        .sealed_act(&deferred.act_id())
        .await
        .expect("reads")
        .expect("stored");
    assert_eq!(stored.sealed, Some(deferred_sealed));
}

/// After closes over several epochs, no accepted act anywhere in the table holds a content salt.
/// ´claim:standin:no-accepted-act-holds-a-content-salt´
#[sqlx::test(migrations = "../../migrations")]
async fn no_accepted_act_holds_a_content_salt(pool: PgPool) {
    let host = standin(pool.clone());
    let alice = funded_actor(&host, 10 * THETA).await;
    let bob = funded_actor(&host, 10 * THETA).await;
    let (alice_reg, _) = submit(&host, &alice, registration(&alice)).await;
    host.close_epoch().await.expect("closes");
    submit(&host, &bob, registration(&bob)).await;
    submit(
        &host,
        &alice,
        opinion(&alice, 1, &bob.address(), vec![alice_reg.act_id()]),
    )
    .await;
    host.close_epoch().await.expect("closes");
    submit(&host, &bob, opinion(&bob, 1, &alice.address(), vec![])).await;
    host.close_epoch().await.expect("closes");

    let (accepted, holding): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), COUNT(*) FILTER (WHERE content_salt IS NOT NULL)
         FROM l1_acts WHERE status = 'accepted'",
    )
    .fetch_one(&pool)
    .await
    .expect("counts");
    assert_eq!(accepted, 4);
    assert_eq!(holding, 0);
}

/// The dependency opening is not content custody: list, salt and nonce
/// survive acceptance, so an ordering fraud proof still opens the
/// dependency commitment from the record's own columns (§8.2, "Ordering
/// fraud proof"), and the nonce still recomputes the dependency
/// pre-digest the author signed under.
///
/// The dependency salt is not handshake custody: it survives acceptance, so an ordering fraud proof still opens the dependency commitment from the record's own columns.
/// ´claim:standin:the-dependency-opening-survives-acceptance´
#[sqlx::test(migrations = "../../migrations")]
async fn the_dependency_salt_survives_acceptance_so_the_fraud_proof_still_opens(pool: PgPool) {
    let host = standin(pool.clone());
    let alice = funded_actor(&host, 10 * THETA).await;
    let bob = funded_actor(&host, 10 * THETA).await;
    let (bob_reg, _) = submit(&host, &bob, registration(&bob)).await;
    host.close_epoch().await.expect("closes");
    let (act, _) = submit(
        &host,
        &alice,
        opinion(&alice, 0, &bob.address(), vec![bob_reg.act_id()]),
    )
    .await;
    host.close_epoch().await.expect("closes");

    let act_id = act.act_id();
    let (deps, nonce, deps_salt, pre_commitment, stored): FraudProofColumns = sqlx::query_as(
        "SELECT deps, dependency_nonce, deps_salt, pre_commitment, deps_commitment
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
        proposal::dependency_commitment(&act_id, &pre_commitment, &deps_salt, &deps).to_vec(),
        stored
    );
    assert_eq!(
        proposal::dependency_pre_digest(&act_id, &nonce, &deps),
        act.dependency_pre_digest()
    );
}

/// The dependency nonce lives exactly as long as the dependency opening it
/// was disclosed with: the row holds it beside the list and the dependency
/// salt when sealed, approved, accepted, and after a redaction dropped the
/// content salt of a deferred act; and the table refuses to drop it while
/// the opening is held. The stand-in tombstones no dependency projection,
/// so the opening — and the nonce with it — goes only with the row.
///
/// The dependency nonce is held with the dependency opening at every stage, and never without it.
/// ´claim:standin:the-dependency-nonce-goes-with-its-opening´
#[sqlx::test(migrations = "../../migrations")]
async fn the_dependency_nonce_is_held_exactly_with_its_opening(pool: PgPool) {
    let host = standin(pool.clone());
    let alice = funded_actor(&host, 10 * THETA).await;
    let (reg, _) = submit(&host, &alice, registration(&alice)).await;
    let pre = PreSigned::sign(&alice, opinion(&alice, 1, "bob", vec![reg.act_id()]));
    let opening = |pool: PgPool, act_id: ActId| async move {
        sqlx::query_as::<_, DependencyOpening>(
            "SELECT dependency_nonce, deps, deps_salt FROM l1_acts WHERE act_id = $1",
        )
        .bind(act_id.to_string())
        .fetch_one(&pool)
        .await
        .expect("the act is stored")
    };
    let expect = |row: DependencyOpening, pre: &PreSigned, stage: &str| {
        let (nonce, deps, salt) = row;
        assert_eq!(nonce.as_ref(), Some(&pre.dependency_nonce), "{stage}");
        assert_eq!(
            deps,
            Some(pre.proposal.deps.iter().map(|d| d.to_string()).collect()),
            "{stage}"
        );
        assert!(salt.is_some_and(|s| s.len() == 32), "{stage}");
    };

    let sealed = host.seal(pre.submission()).await.expect("seals");
    expect(opening(pool.clone(), pre.act_id()).await, &pre, "sealed");
    let host_key = host.host_public_key().await.expect("host key");
    host.approve(pre.approve(&alice, &sealed, &host_key).expect("approves"))
        .await
        .expect("approval accepted");
    expect(opening(pool.clone(), pre.act_id()).await, &pre, "approved");
    assert_eq!(host.close_epoch().await.expect("closes").records.len(), 2);
    expect(opening(pool.clone(), pre.act_id()).await, &pre, "accepted");

    let insolvent = ActorKey::generate();
    let (deferred, _) = submit(&host, &insolvent, registration(&insolvent)).await;
    host.close_epoch().await.expect("closes");
    host.drop_carriage(&[deferred.act_id().to_string()])
        .await
        .expect("drops");
    expect(
        opening(pool.clone(), deferred.act_id()).await,
        &deferred,
        "deferred, content salt dropped",
    );

    let alone = sqlx::query("UPDATE l1_acts SET dependency_nonce = NULL WHERE act_id = $1")
        .bind(pre.act_id().to_string())
        .execute(&pool)
        .await;
    assert!(alone.is_err(), "the nonce never leaves its opening");
}

/// The table itself refuses to drop an act's content salt before acceptance with no recorded drop, or to hold one after acceptance.
/// ´claim:standin:the-content-salt-leaves-only-at-acceptance-or-a-recorded-drop´
#[sqlx::test(migrations = "../../migrations")]
async fn the_table_refuses_a_content_salt_dropped_early_or_held_late(pool: PgPool) {
    let host = standin(pool.clone());
    let actor = funded_actor(&host, 3 * THETA).await;
    let (pre, _) = submit(&host, &actor, registration(&actor)).await;
    let act_id = pre.act_id().to_string();
    let early = sqlx::query("UPDATE l1_acts SET content_salt = NULL WHERE act_id = $1")
        .bind(&act_id)
        .execute(&pool)
        .await;
    assert!(early.is_err(), "an approved act keeps its content salt");

    host.close_epoch().await.expect("closes");
    let late = sqlx::query("UPDATE l1_acts SET content_salt = '\\x00' WHERE act_id = $1")
        .bind(&act_id)
        .execute(&pool)
        .await;
    assert!(late.is_err(), "an accepted act holds no content salt");
}
