//! Staged-write integration tests: sequence allocation under the mirror
//! catch-up, the prepare-until-confirm row lifecycle, promotion, and the
//! two-phase GC (data-model.md "Staged writes").

use common::l1::Family;
use common::l1::census::LegRole;
use common::l1::handshake::{
    EpochPackage, Proposal, PublishedLeg, PublishedRecord, StructuralBody, VerifiedAct,
};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::staged::{self, PreSignedParts, StagedBy, StagedError, StagedState};
use postgres_store::{genesis, mirror};
use sqlx::PgPool;
use uuid::Uuid;

async fn actor(pool: &PgPool, handle: &str, address: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(&mut conn, id, "user", handle, &[1u8; 32], address)
        .await
        .expect("actor row");
    id
}

fn proposal(author: &str, seq: u64) -> Proposal {
    Proposal {
        body: StructuralBody {
            author: author.into(),
            seq,
            family: Family::Opinion,
            middle: None,
            target: NodeId::parse("prof:bob").expect("ok"),
            p_d: 0.5,
            p_i: 0.1,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![ActId::parse("act:bob:0:registration").expect("ok")],
        },
        payload: b"staged payload".to_vec(),
        deps: vec![ActId::parse("act:bob:0:registration").expect("ok")],
    }
}

fn pre_parts() -> PreSignedParts {
    PreSignedParts {
        author_pubkey: vec![1; 32],
        nonce: vec![2; 32],
        pre_signature: vec![3; 64],
    }
}

fn verified_act(p: &Proposal) -> VerifiedAct {
    VerifiedAct {
        proposal: p.clone(),
        author_pubkey: vec![1; 32],
        nonce: vec![2; 32],
        pre_signature: vec![3; 64],
        content_salt: vec![4; 32],
        deps_salt: vec![5; 32],
        content_commitment: vec![6; 32],
        deps_commitment: vec![7; 32],
        host_seal: vec![8; 64],
    }
}

/// A published record for `author` with the given seq, for mirror-driven
/// branches (catch-up, promotion).
fn published(author: &str, seq: u64, family: Family, epoch: i64, position: i64) -> PublishedRecord {
    PublishedRecord {
        act_id: ActId::new(author, seq, family).expect("ok"),
        author: author.to_string(),
        family,
        epoch,
        act_time: position + 1,
        position,
        payload_marked: false,
        payload_witness: vec![0xAB; 32],
        legs: vec![PublishedLeg {
            role: LegRole::Binary,
            source: NodeId::Addr(author.to_string()),
            target: NodeId::Prof(author.to_string()),
            p_d: 1.0,
            p_i: 1.0,
            tau: 0.0,
        }],
    }
}

async fn stage(pool: &PgPool, by: StagedBy, p: &Proposal, prepared_epoch: i64) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    staged::insert(&mut tx, id, by, p, prepared_epoch)
        .await
        .expect("insert");
    tx.commit().await.expect("commit");
    id
}

#[sqlx::test(migrations = "../../migrations")]
async fn seq_allocation_is_monotone_and_catches_up_with_the_mirror(pool: PgPool) {
    let mut conn = pool.acquire().await.expect("conn");
    assert_eq!(
        staged::allocate_seq(&mut conn, "alice").await.expect("s"),
        0
    );
    assert_eq!(
        staged::allocate_seq(&mut conn, "alice").await.expect("s"),
        1
    );
    // Independent authors do not share a counter.
    assert_eq!(staged::allocate_seq(&mut conn, "bob").await.expect("s"), 0);

    // An act landed outside the prepare path (bootstrap repair, dev CLI)
    // pushes the counter past its sequence value.
    mirror::ingest_epoch(
        &pool,
        &EpochPackage {
            epoch: 0,
            records: vec![published("alice", 7, Family::Registration, 0, 0)],
        },
    )
    .await
    .expect("ingest");
    assert_eq!(
        staged::allocate_seq(&mut conn, "alice").await.expect("s"),
        8
    );
    assert_eq!(
        staged::allocate_seq(&mut conn, "alice").await.expect("s"),
        9
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn insert_and_load_round_trip_the_proposal(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let p = proposal("alice", 3);
    let id = stage(&pool, StagedBy::Actor(actor_id), &p, 4).await;

    let w = staged::load(&pool, id).await.expect("loads");
    assert_eq!(w.id, id);
    assert_eq!(w.staged_by, StagedBy::Actor(actor_id));
    assert_eq!(w.state, StagedState::AwaitingPreSign);
    assert_eq!(w.proposal, p);
    assert_eq!(w.prepared_epoch, 4);
    assert!(w.pre_signed.is_none());
    assert!(w.sealed.is_none());
    assert!(w.pre_signed_proposal().is_none());
    assert!(w.verified_act().is_none());
}

#[sqlx::test(migrations = "../../migrations")]
async fn load_of_unknown_id_is_not_found(pool: PgPool) {
    let missing = Uuid::new_v4();
    assert!(matches!(
        staged::load(&pool, missing).await,
        Err(StagedError::NotFound(id)) if id == missing
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_row_edited_out_of_band_loads_as_corrupt(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let id = stage(&pool, StagedBy::Actor(actor_id), &proposal("alice", 0), 0).await;
    sqlx::query("UPDATE staged_writes SET family = 'bogus' WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .expect("corrupt");
    assert!(matches!(
        staged::load(&pool, id).await,
        Err(StagedError::Corrupt(_, _))
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_handshake_lifecycle_advances_through_its_states(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let p = proposal("alice", 0);
    let id = stage(&pool, StagedBy::Actor(actor_id), &p, 0).await;

    // Pre-sign: parts stored, state sealing; retry from sealing accepted.
    staged::record_pre_signed(&pool, id, &pre_parts())
        .await
        .expect("pre-sign");
    assert_eq!(
        staged::load(&pool, id).await.expect("loads").state,
        StagedState::Sealing
    );
    staged::record_pre_signed(&pool, id, &pre_parts())
        .await
        .expect("pre-sign retry from sealing");
    let w = staged::load(&pool, id).await.expect("loads");
    let pre = w.pre_signed_proposal().expect("pre-signed");
    assert_eq!(pre.proposal, p);
    assert_eq!(pre.nonce, vec![2; 32]);

    // Seal: host additions stored, state awaiting_approval, act rebuilds.
    let act = verified_act(&p);
    staged::record_sealed(&pool, id, &act).await.expect("seal");
    let w = staged::load(&pool, id).await.expect("loads");
    assert_eq!(w.state, StagedState::AwaitingApproval);
    assert_eq!(w.verified_act().expect("act"), act);

    // Approve: relaying, idempotent retry accepted.
    staged::record_relaying(&pool, id).await.expect("relaying");
    staged::record_relaying(&pool, id)
        .await
        .expect("relaying retry");
    assert_eq!(
        staged::load(&pool, id).await.expect("loads").state,
        StagedState::Relaying
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn out_of_order_transitions_are_refused_with_the_actual_state(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let p = proposal("alice", 0);
    let id = stage(&pool, StagedBy::Actor(actor_id), &p, 0).await;

    // Sealing before any pre-commitment exists.
    assert!(matches!(
        staged::record_sealed(&pool, id, &verified_act(&p)).await,
        Err(StagedError::WrongState { actual, .. }) if actual == "awaiting_pre_sign"
    ));
    // Relaying before the seal.
    assert!(matches!(
        staged::record_relaying(&pool, id).await,
        Err(StagedError::WrongState { actual, .. }) if actual == "awaiting_pre_sign"
    ));
    // Reverting a write that is not sealing.
    assert!(matches!(
        staged::revert_to_pre_sign(&pool, id).await,
        Err(StagedError::WrongState { .. })
    ));
    // Unknown ids surface NotFound, not WrongState.
    assert!(matches!(
        staged::record_relaying(&pool, Uuid::new_v4()).await,
        Err(StagedError::NotFound(_))
    ));

    // A failed seal returns to awaiting_pre_sign for the device's retry.
    staged::record_pre_signed(&pool, id, &pre_parts())
        .await
        .expect("pre-sign");
    staged::revert_to_pre_sign(&pool, id).await.expect("revert");
    assert_eq!(
        staged::load(&pool, id).await.expect("loads").state,
        StagedState::AwaitingPreSign
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn promotion_lands_exactly_the_staged_writes_whose_records_arrive(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let landed = stage(&pool, StagedBy::Actor(actor_id), &proposal("alice", 0), 0).await;
    let waiting = stage(&pool, StagedBy::Actor(actor_id), &proposal("alice", 1), 0).await;

    mirror::ingest_epoch(
        &pool,
        &EpochPackage {
            epoch: 0,
            records: vec![published("alice", 0, Family::Opinion, 0, 0)],
        },
    )
    .await
    .expect("ingest");

    let promoted = staged::promote_landed(&pool, 0).await.expect("promotes");
    assert_eq!(promoted.len(), 1);
    assert_eq!(promoted[0].id, landed);
    assert_eq!(promoted[0].staged_by, StagedBy::Actor(actor_id));
    assert_eq!(promoted[0].act_id, "act:alice:0:opinion");
    assert_eq!(promoted[0].family, "opinion");
    assert_eq!(
        staged::load(&pool, landed).await.expect("loads").state,
        StagedState::Landed
    );
    assert_eq!(
        staged::load(&pool, waiting).await.expect("loads").state,
        StagedState::AwaitingPreSign
    );

    // A second pass over the same epoch promotes nothing further.
    assert!(
        staged::promote_landed(&pool, 0)
            .await
            .expect("p")
            .is_empty()
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn gc_expires_then_reaps_and_spares_landed_writes(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let stale = stage(&pool, StagedBy::Actor(actor_id), &proposal("alice", 0), 0).await;
    let fresh = stage(&pool, StagedBy::Actor(actor_id), &proposal("alice", 1), 5).await;
    let done = stage(&pool, StagedBy::Actor(actor_id), &proposal("alice", 2), 0).await;
    sqlx::query("UPDATE staged_writes SET state = 'landed' WHERE id = $1")
        .bind(done)
        .execute(&pool)
        .await
        .expect("mark landed");

    // Epoch 7, bound 8: nothing due yet (0 + 8 > 7).
    assert_eq!(staged::expire_due(&pool, 7, 8).await.expect("gc"), 0);
    // Epoch 8: the stale write expires — payload dropped, landed spared.
    assert_eq!(staged::expire_due(&pool, 8, 8).await.expect("gc"), 1);
    let w = staged::load(&pool, stale).await.expect("loads");
    assert_eq!(w.state, StagedState::Expired);
    assert!(w.proposal.payload.is_empty());
    assert_eq!(
        staged::load(&pool, fresh).await.expect("loads").state,
        StagedState::AwaitingPreSign
    );
    assert_eq!(
        staged::load(&pool, done).await.expect("loads").state,
        StagedState::Landed
    );

    // The expired row stays observable for one more window, then reaps.
    assert_eq!(staged::reap_expired(&pool, 8, 8).await.expect("gc"), 0);
    assert_eq!(staged::reap_expired(&pool, 16, 8).await.expect("gc"), 1);
    assert!(matches!(
        staged::load(&pool, stale).await,
        Err(StagedError::NotFound(_))
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn expire_one_is_targeted_and_terminal(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let doomed = stage(&pool, StagedBy::Actor(actor_id), &proposal("alice", 0), 0).await;
    let spared = stage(&pool, StagedBy::Actor(actor_id), &proposal("alice", 1), 0).await;

    staged::expire_one(&pool, doomed, 0).await.expect("expires");
    assert_eq!(
        staged::load(&pool, doomed).await.expect("loads").state,
        StagedState::Expired
    );
    assert_eq!(
        staged::load(&pool, spared).await.expect("loads").state,
        StagedState::AwaitingPreSign
    );
    // Expiring an already-terminal write is refused.
    assert!(matches!(
        staged::expire_one(&pool, doomed, 0).await,
        Err(StagedError::NotFound(_))
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_can_stage_a_write_before_any_actor_row_exists(pool: PgPool) {
    // The staged Registration of auth.md "Approval and landing": the
    // staging identity is the applicant row, not an actor.
    let inviter = actor(&pool, "inviter", "inviter").await;
    let link = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO auth_invite_links
             (id, inviter_id, prefill_dim1, prefill_dim2, expires_at)
         VALUES ($1, $2, 0.1, 0.1, NOW() + INTERVAL '1 day')",
    )
    .bind(link)
    .bind(inviter)
    .execute(&pool)
    .await
    .expect("link");
    let applicant = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO auth_applicants
             (id, invite_link_id, handle, email, password_hash,
              email_verification_token_hash, applicant_token_hash,
              actor_pubkey, l0_address, expires_at)
         VALUES ($1, $2, 'newbie', 'n@example.com', 'x', $3, $4, $5, 'newbie',
                 NOW() + INTERVAL '1 day')",
    )
    .bind(applicant)
    .bind(link)
    .bind(vec![9u8; 32])
    .bind(vec![8u8; 32])
    .bind(vec![1u8; 32])
    .execute(&pool)
    .await
    .expect("applicant");

    let p = proposal("newbie", 0);
    let id = stage(&pool, StagedBy::Applicant(applicant), &p, 0).await;
    let w = staged::load(&pool, id).await.expect("loads");
    assert_eq!(w.staged_by, StagedBy::Applicant(applicant));
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_record_landing_after_collection_still_promotes(pool: PgPool) {
    // The mirror governs: late landing wins over expiry, though the staged
    // payload is already gone (data-model.md "Staged writes").
    let actor_id = actor(&pool, "alice", "alice").await;
    let id = stage(&pool, StagedBy::Actor(actor_id), &proposal("alice", 0), 0).await;
    staged::expire_one(&pool, id, 0).await.expect("expires");

    mirror::ingest_epoch(
        &pool,
        &EpochPackage {
            epoch: 0,
            records: vec![published("alice", 0, Family::Opinion, 0, 0)],
        },
    )
    .await
    .expect("ingest");
    let promoted = staged::promote_landed(&pool, 0).await.expect("promotes");
    assert_eq!(promoted.len(), 1);
    assert_eq!(
        staged::load(&pool, id).await.expect("loads").state,
        StagedState::Landed
    );
}
