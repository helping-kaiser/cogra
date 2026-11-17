//! Staged-write integration tests: sequence allocation under the mirror
//! catch-up, the prepare-until-confirm row lifecycle, promotion, and the
//! two-phase GC (data-model.md "Staged writes").

use common::l1::Family;
use common::l1::census::LegRole;
use common::l1::handshake::{
    EpochPackage, Proposal, PublishedLeg, PublishedRecord, StructuralBody,
};
use common::l1::identifier::{ActId, NodeId};
use common::l1::proposal::{CONTENT_EDITION, DEPENDENCY_EDITION, SealedAct, VerifiedAct};
use postgres_store::staged::{self, PreSignedParts, StagedError, StagedState};
use postgres_store::{genesis, mirror};
use sqlx::PgPool;
use uuid::Uuid;

/// Seeds one user actor. The key is derived from the handle so that every
/// actor gets a distinct one, as the schema requires (data-model.md
/// "Actors").
async fn actor(pool: &PgPool, handle: &str, address: &str) -> Uuid {
    let id = Uuid::new_v4();
    let pubkey = format!("pk-{handle}");
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(&mut conn, id, "user", handle, pubkey.as_bytes(), address)
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
    pre_parts_with(vec![2; 32])
}

fn pre_parts_with(content_nonce: Vec<u8>) -> PreSignedParts {
    PreSignedParts {
        author_pubkey: vec![1; 32],
        content_nonce,
        dependency_nonce: vec![9; 32],
        pre_signature: vec![3; 64],
    }
}

/// The sealed act the store rebuilds for `p` under [`pre_parts`]: P is
/// formed from the proposal and both nonces, the editions are the
/// handshake's.
fn sealed_act(p: &Proposal) -> SealedAct {
    SealedAct {
        act: VerifiedAct {
            body: p.body.clone(),
            pre_commitment: pre_parts().pre_signed(p).pre_commitment().to_vec(),
            pre_signature: vec![3; 64],
            content_commitment: vec![6; 32],
            dependency_commitment: vec![7; 32],
            content_edition: CONTENT_EDITION,
            dependency_edition: DEPENDENCY_EDITION,
        },
        content_salt: vec![4; 32],
        dependency_salt: vec![5; 32],
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

async fn stage(pool: &PgPool, actor_id: Uuid, p: &Proposal, prepared_epoch: i64) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    staged::insert(&mut tx, id, actor_id, p, prepared_epoch, None)
        .await
        .expect("insert");
    tx.commit().await.expect("commit");
    id
}

/// Sequence values are monotone and per-author, and an act landed outside
/// the prepare path — bootstrap repair, the dev CLI — pushes the counter
/// past its sequence value rather than letting an identifier be reused.
///
/// Sequence allocation is monotone per author and steps past an act that landed outside the prepare path, so no identifier is reissued.
/// ´claim:staged:sequence-allocation-never-reissues-an-identifier´
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
    assert_eq!(staged::allocate_seq(&mut conn, "bob").await.expect("s"), 0);

    mirror::ingest_epoch(
        &pool,
        &EpochPackage {
            epoch: 1,
            attested_at: chrono::Utc::now(),
            records: vec![published("alice", 7, Family::Registration, 1, 1)],
            closure: Default::default(),
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

/// The catch-up reads the sequence out of the record identifier with
/// `split_part`, which is the same decomposition
/// `common::l1::identifier::ActId::parse` performs in Rust. Two things
/// have to hold: the two agree on a real identifier, and a row that is
/// not one is skipped rather than raising — an unguarded `::BIGINT`
/// would fail the allocation, and with it every prepare that author
/// attempts for as long as the row sits in the mirror.
///
/// SQL and Rust read the same sequence out of a record identifier, and a row that is not one is skipped.
/// ´claim:staged:the-sql-and-rust-identifier-decompositions-agree´
#[sqlx::test(migrations = "../../migrations")]
async fn seq_catch_up_agrees_with_the_rust_parser_and_survives_a_stray_row(pool: PgPool) {
    for id in [
        "act:alice:0:registration",
        "act:alice:12:opinion",
        "act:alice:9007199254740993:publish",
    ] {
        let sql: i64 = sqlx::query_scalar("SELECT split_part($1, ':', 3)::BIGINT")
            .bind(id)
            .fetch_one(&pool)
            .await
            .expect("split_part");
        let parsed = ActId::parse(id).expect("parses");
        assert_eq!(sql as u64, parsed.seq, "{id}");
    }

    mirror::ingest_epoch(
        &pool,
        &EpochPackage {
            epoch: 1,
            attested_at: chrono::Utc::now(),
            records: vec![published("alice", 4, Family::Registration, 1, 1)],
            closure: Default::default(),
        },
    )
    .await
    .expect("ingest");
    sqlx::query(
        "INSERT INTO mirror_records
             (record_id, family, author, epoch, act_time, position,
              payload_marked, payload_witness)
         VALUES ('addr:alice', 'registration', 'alice', 1, 1, 2, FALSE, '\\x00')",
    )
    .execute(&pool)
    .await
    .expect("stray row");

    let mut conn = pool.acquire().await.expect("conn");
    assert_eq!(
        staged::allocate_seq(&mut conn, "alice")
            .await
            .expect("allocates past the stray row"),
        5
    );
}

/// A staged write loads back as what was written, down to the handshake parts nothing has filled yet.
/// ´claim:staged:a-staged-write-round-trips´
#[sqlx::test(migrations = "../../migrations")]
async fn insert_and_load_round_trip_the_proposal(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let p = proposal("alice", 3);
    let id = stage(&pool, actor_id, &p, 4).await;

    let w = staged::load(&pool, id).await.expect("loads");
    assert_eq!(w.id, id);
    assert_eq!(w.actor_id, actor_id);
    assert_eq!(w.state, StagedState::AwaitingPreSign);
    assert_eq!(w.proposal, p);
    assert_eq!(w.prepared_epoch, 4);
    assert!(w.pre_signed.is_none());
    assert!(w.sealed.is_none());
    assert!(w.submission().is_none());
    assert!(w.sealed_act().is_none());
}

/// Loading an id the store never staged is not found, and the diagnostic names the id asked for.
/// ´claim:staged:an-unknown-id-loads-as-not-found´
#[sqlx::test(migrations = "../../migrations")]
async fn load_of_unknown_id_is_not_found(pool: PgPool) {
    let missing = Uuid::new_v4();
    assert!(matches!(
        staged::load(&pool, missing).await,
        Err(StagedError::NotFound(id)) if id == missing
    ));
}

/// A staged row changed behind the store's back is refused at load rather than trusted.
/// ´claim:staged:a-row-changed-behind-the-store-is-refused-at-load´
#[sqlx::test(migrations = "../../migrations")]
async fn a_row_edited_out_of_band_loads_as_corrupt(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let id = stage(&pool, actor_id, &proposal("alice", 0), 0).await;
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

/// The handshake walks pre-sign, seal, then approve, storing each leg's
/// parts as it goes and rebuilding the verified act from them. Pre-sign and
/// approve each accept an idempotent retry from the state they lead to.
///
/// The staged handshake walks pre-sign, seal, and approve, and a retry from the state a step leads to is idempotent.
/// ´claim:staged:the-handshake-walks-its-states-and-retries-idempotently´
#[sqlx::test(migrations = "../../migrations")]
async fn the_handshake_lifecycle_advances_through_its_states(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let p = proposal("alice", 0);
    let id = stage(&pool, actor_id, &p, 0).await;

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
    assert_eq!(w.pre_signed, Some(pre_parts()));
    let submission = w.submission().expect("pre-signed");
    assert_eq!(submission.body, p.body);
    assert_eq!(submission.dependency_nonce, vec![9; 32]);
    assert_eq!(
        submission.content_pre_digest,
        common::l1::proposal::content_pre_digest(&p.body.act_id(), &[2; 32], &p.payload),
        "the content pre-digest is formed from the staged payload and the content nonce"
    );

    let act = sealed_act(&p);
    staged::record_sealed(&pool, id, &act).await.expect("seal");
    let w = staged::load(&pool, id).await.expect("loads");
    assert_eq!(w.state, StagedState::AwaitingApproval);
    assert_eq!(w.sealed_act().expect("act"), act);

    staged::record_relaying(&pool, id).await.expect("relaying");
    staged::record_relaying(&pool, id)
        .await
        .expect("relaying retry");
    assert_eq!(
        staged::load(&pool, id).await.expect("loads").state,
        StagedState::Relaying
    );
}

/// Every transition taken out of turn is refused with the state the row is
/// actually in; an unknown id surfaces NotFound instead. A failed seal is
/// the one way back — it returns the write to awaiting_pre_sign for the
/// device's retry.
///
/// A transition taken out of turn is refused with the state the row is actually in, and a failed seal is the one way back.
/// ´claim:staged:an-out-of-turn-transition-is-refused-with-the-actual-state´
#[sqlx::test(migrations = "../../migrations")]
async fn out_of_order_transitions_are_refused_with_the_actual_state(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let p = proposal("alice", 0);
    let id = stage(&pool, actor_id, &p, 0).await;

    assert!(matches!(
        staged::record_sealed(&pool, id, &sealed_act(&p)).await,
        Err(StagedError::WrongState { actual, .. }) if actual == "awaiting_pre_sign"
    ));
    assert!(matches!(
        staged::record_relaying(&pool, id).await,
        Err(StagedError::WrongState { actual, .. }) if actual == "awaiting_pre_sign"
    ));
    assert!(matches!(
        staged::revert_to_pre_sign(&pool, id).await,
        Err(StagedError::WrongState { .. })
    ));
    assert!(matches!(
        staged::record_relaying(&pool, Uuid::new_v4()).await,
        Err(StagedError::NotFound(_))
    ));

    staged::record_pre_signed(&pool, id, &pre_parts())
        .await
        .expect("pre-sign");
    staged::revert_to_pre_sign(&pool, id).await.expect("revert");
    assert_eq!(
        staged::load(&pool, id).await.expect("loads").state,
        StagedState::AwaitingPreSign
    );
}

/// Promotion lands exactly the staged writes whose records arrived in the
/// epoch and leaves the rest where they were; a second pass over the same
/// epoch promotes nothing further.
///
/// Promotion lands exactly the writes whose records arrived, and a second pass over one epoch promotes nothing further.
/// ´claim:staged:promotion-lands-what-arrived-and-nothing-twice´
#[sqlx::test(migrations = "../../migrations")]
async fn promotion_lands_exactly_the_staged_writes_whose_records_arrive(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let landed = stage(&pool, actor_id, &proposal("alice", 0), 0).await;
    let waiting = stage(&pool, actor_id, &proposal("alice", 1), 0).await;

    mirror::ingest_epoch(
        &pool,
        &EpochPackage {
            epoch: 1,
            attested_at: chrono::Utc::now(),
            records: vec![published("alice", 0, Family::Opinion, 1, 1)],
            closure: Default::default(),
        },
    )
    .await
    .expect("ingest");

    let promoted = staged::promote_landed(&pool, 1).await.expect("promotes");
    assert_eq!(promoted.len(), 1);
    assert_eq!(promoted[0].id, landed);
    assert_eq!(promoted[0].actor_id, actor_id);
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

    assert!(
        staged::promote_landed(&pool, 1)
            .await
            .expect("p")
            .is_empty()
    );
}

/// The two-phase GC: a write past its bound expires while a fresher one
/// and a landed one are spared, and the expired row stays observable for
/// one more window before it reaps. The payload rides the row until that
/// reap, so a record landing in the window can still be promoted
/// (data-model.md "Staged writes").
///
/// Expiry and the reap are two phases, and the payload rides the row until the reap.
/// ´claim:staged:expiry-and-the-reap-are-two-phases´
#[sqlx::test(migrations = "../../migrations")]
async fn gc_expires_then_reaps_and_spares_landed_writes(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let stale = stage(&pool, actor_id, &proposal("alice", 0), 0).await;
    let fresh = stage(&pool, actor_id, &proposal("alice", 1), 5).await;
    let done = stage(&pool, actor_id, &proposal("alice", 2), 0).await;
    sqlx::query("UPDATE staged_writes SET state = 'landed' WHERE id = $1")
        .bind(done)
        .execute(&pool)
        .await
        .expect("mark landed");

    assert_eq!(staged::expire_due(&pool, 7, 8).await.expect("gc"), 0);
    assert_eq!(staged::expire_due(&pool, 8, 8).await.expect("gc"), 1);
    let w = staged::load(&pool, stale).await.expect("loads");
    assert_eq!(w.state, StagedState::Expired);
    assert!(!w.proposal.payload.is_empty());
    assert_eq!(
        staged::load(&pool, fresh).await.expect("loads").state,
        StagedState::AwaitingPreSign
    );
    assert_eq!(
        staged::load(&pool, done).await.expect("loads").state,
        StagedState::Landed
    );

    assert_eq!(staged::reap_expired(&pool, 8, 8).await.expect("gc"), 0);
    assert_eq!(staged::reap_expired(&pool, 16, 8).await.expect("gc"), 1);
    assert!(matches!(
        staged::load(&pool, stale).await,
        Err(StagedError::NotFound(_))
    ));
}

/// Expiring one write reaches only that write, and expiring an
/// already-terminal one is refused.
///
/// Expiring one write reaches only that write, and an already-terminal one is refused.
/// ´claim:staged:expiring-one-write-reaches-only-that-write´
#[sqlx::test(migrations = "../../migrations")]
async fn expire_one_is_targeted_and_terminal(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let doomed = stage(&pool, actor_id, &proposal("alice", 0), 0).await;
    let spared = stage(&pool, actor_id, &proposal("alice", 1), 0).await;

    staged::expire_one(&pool, doomed, 0).await.expect("expires");
    assert_eq!(
        staged::load(&pool, doomed).await.expect("loads").state,
        StagedState::Expired
    );
    assert_eq!(
        staged::load(&pool, spared).await.expect("loads").state,
        StagedState::AwaitingPreSign
    );
    assert!(matches!(
        staged::expire_one(&pool, doomed, 0).await,
        Err(StagedError::WrongState { actual, .. }) if actual == "expired"
    ));
}

/// The mirror governs: a late landing wins over expiry, and the payload the
/// promotion needs is still on the expired row — expiry stops serving the
/// content, the reap is what destroys it (data-model.md "Staged writes").
///
/// The mirror governs expiry: a late landing still promotes, because the payload survives until the reap.
/// ´claim:staged:a-late-landing-outranks-expiry´
#[sqlx::test(migrations = "../../migrations")]
async fn a_record_landing_after_expiry_still_promotes(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let id = stage(&pool, actor_id, &proposal("alice", 0), 0).await;
    staged::expire_one(&pool, id, 0).await.expect("expires");
    assert!(
        !staged::load(&pool, id)
            .await
            .expect("loads")
            .proposal
            .payload
            .is_empty(),
        "the payload outlives expiry, so a late landing has something to promote"
    );

    mirror::ingest_epoch(
        &pool,
        &EpochPackage {
            epoch: 1,
            attested_at: chrono::Utc::now(),
            records: vec![published("alice", 0, Family::Opinion, 1, 1)],
            closure: Default::default(),
        },
    )
    .await
    .expect("ingest");
    let promoted = staged::promote_landed(&pool, 1).await.expect("promotes");
    assert_eq!(promoted.len(), 1);
    assert_eq!(
        staged::load(&pool, id).await.expect("loads").state,
        StagedState::Landed
    );
}

/// A staged write answers as live for its own actor and only at its own
/// target; once expired it is a tombstone and answers no longer.
///
/// A staged write answers as live only for its own actor at its own target, and never once expired.
/// ´claim:staged:a-live-write-answers-only-for-its-author-at-its-target´
#[sqlx::test(migrations = "../../migrations")]
async fn has_live_targeting_sees_only_live_writes_at_the_target(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let other_id = actor(&pool, "carol", "carol").await;
    let id = stage(&pool, actor_id, &proposal("alice", 0), 0).await;

    let hit = staged::has_live_targeting(&pool, actor_id, Family::Opinion, "prof:bob")
        .await
        .expect("query");
    assert!(hit);
    assert!(
        !staged::has_live_targeting(&pool, actor_id, Family::Opinion, "prof:carol")
            .await
            .expect("query")
    );
    assert!(
        !staged::has_live_targeting(&pool, other_id, Family::Opinion, "prof:bob")
            .await
            .expect("query")
    );

    staged::expire_one(&pool, id, 0).await.expect("expires");
    assert!(
        !staged::has_live_targeting(&pool, actor_id, Family::Opinion, "prof:bob")
            .await
            .expect("query")
    );
}

/// A staging nobody signed is superseded rather than left to hold the next
/// edit until GC, and once superseded it can never be signed. A signed one
/// still holds the guard, as does a carried act or an unchained write, and
/// another target or actor is left alone.
///
/// Superseding expires exactly the actor's unsigned chained writes toward the target, and a superseded write can no longer be pre-signed.
/// ´claim:staged:superseding-expires-only-unsigned-chained-writes´
#[sqlx::test(migrations = "../../migrations")]
async fn superseding_expires_only_unsigned_chained_writes(pool: PgPool) {
    let actor_id = actor(&pool, "alice", "alice").await;
    let other_id = actor(&pool, "carol", "carol").await;
    let pending = |pool: PgPool, who: Uuid| async move {
        staged::has_pending_targeting(&pool, who, Family::Opinion, "prof:bob")
            .await
            .expect("query")
    };

    let abandoned = stage(&pool, actor_id, &proposal("alice", 0), 0).await;
    let elsewhere = {
        let mut p = proposal("alice", 1);
        p.body.target = NodeId::parse("prof:dave").expect("ok");
        stage(&pool, actor_id, &p, 0).await
    };
    let unchained = {
        let mut p = proposal("alice", 2);
        p.body.asserted_parents.clear();
        stage(&pool, actor_id, &p, 0).await
    };
    let carried = stage(&pool, actor_id, &proposal("alice", 3), 0).await;
    sqlx::query("UPDATE staged_writes SET carried = true WHERE id = $1")
        .bind(carried)
        .execute(&pool)
        .await
        .expect("carry");
    let theirs = stage(&pool, other_id, &proposal("carol", 0), 0).await;
    assert!(pending(pool.clone(), actor_id).await);

    let superseded =
        staged::supersede_unsigned_targeting(&pool, actor_id, Family::Opinion, "prof:bob", 7)
            .await
            .expect("supersede");
    assert_eq!(superseded, 1, "only the abandoned staging goes");
    let state = |id| {
        let pool = pool.clone();
        async move { staged::load(&pool, id).await.expect("loads").state }
    };
    assert_eq!(state(abandoned).await, StagedState::Expired);
    assert_eq!(state(elsewhere).await, StagedState::AwaitingPreSign);
    assert_eq!(state(unchained).await, StagedState::AwaitingPreSign);
    assert_eq!(state(carried).await, StagedState::AwaitingPreSign);
    assert_eq!(state(theirs).await, StagedState::AwaitingPreSign);
    assert!(
        matches!(
            staged::record_pre_signed(&pool, abandoned, &pre_parts()).await,
            Err(StagedError::WrongState { actual, .. }) if actual == "expired"
        ),
        "a superseded staging can no longer be signed"
    );

    for id in [carried, unchained] {
        staged::expire_one(&pool, id, 0).await.expect("expires");
    }
    assert!(!pending(pool.clone(), actor_id).await);
    let signed = stage(&pool, actor_id, &proposal("alice", 4), 0).await;
    staged::record_pre_signed(&pool, signed, &pre_parts())
        .await
        .expect("pre-sign");
    assert_eq!(
        staged::supersede_unsigned_targeting(&pool, actor_id, Family::Opinion, "prof:bob", 7)
            .await
            .expect("supersede"),
        0
    );
    assert_eq!(state(signed).await, StagedState::Sealing);
    assert!(pending(pool.clone(), actor_id).await);
}

/// A content nonce is its author's once (layer1-interface.md §8.2,
/// "Entropy custody"): a second act by the same author under the same
/// content nonce is refused at the pre-signature with nothing recorded —
/// the write stays unsigned — while a retry of the first act's own leg,
/// and another author's act under the same bytes, are not reuses. The
/// reservation is a digest beside the act, not the nonce, so it outlives
/// the reap that takes the nonce itself: after the first act's payload is
/// reaped, the nonce is still refused.
///
/// A content nonce is refused for a second act by its author, before anything is recorded and after the first act's payload is reaped.
/// ´claim:staged:a-content-nonce-is-its-authors-once´
#[sqlx::test(migrations = "../../migrations")]
async fn a_content_nonce_is_refused_for_a_second_act_by_its_author(pool: PgPool) {
    let alice = actor(&pool, "alice", "alice").await;
    let carol = actor(&pool, "carol", "carol").await;
    let first = stage(&pool, alice, &proposal("alice", 0), 0).await;
    let second = stage(&pool, alice, &proposal("alice", 1), 0).await;
    let theirs = stage(&pool, carol, &proposal("carol", 0), 0).await;

    staged::record_pre_signed(&pool, first, &pre_parts())
        .await
        .expect("first use");
    staged::record_pre_signed(&pool, first, &pre_parts())
        .await
        .expect("a retry of the same act's leg is no reuse");
    assert!(matches!(
        staged::record_pre_signed(&pool, second, &pre_parts()).await,
        Err(StagedError::ContentNonceReused(id)) if id == second
    ));
    let w = staged::load(&pool, second).await.expect("loads");
    assert_eq!(
        w.state,
        StagedState::AwaitingPreSign,
        "nothing was recorded"
    );
    assert!(w.pre_signed.is_none());
    staged::record_pre_signed(&pool, theirs, &pre_parts())
        .await
        .expect("another author's act under the same bytes");

    let mut conn = pool.acquire().await.expect("conn");
    assert_eq!(
        staged::reap_payload(&mut conn, "act:alice:0:opinion")
            .await
            .expect("reaps"),
        1
    );
    let held: Option<Vec<u8>> =
        sqlx::query_scalar("SELECT content_nonce FROM staged_writes WHERE id = $1")
            .bind(first)
            .fetch_one(&pool)
            .await
            .expect("reads");
    assert_eq!(held, None, "the reap took the nonce itself");
    let third = stage(&pool, alice, &proposal("alice", 2), 0).await;
    assert!(
        matches!(
            staged::record_pre_signed(&pool, third, &pre_parts()).await,
            Err(StagedError::ContentNonceReused(_))
        ),
        "the reservation outlives the reap"
    );
    staged::record_pre_signed(&pool, second, &pre_parts_with(vec![7; 32]))
        .await
        .expect("a fresh content nonce signs");
}

/// A write in `sealing` takes only the leg it already recorded, byte for
/// byte. A second leg with other nonces and another signature (a
/// concurrent submit of a different blob) is refused, and the row still
/// holds the first leg. The second leg's content nonce is not reserved,
/// so it stays free for another act.
///
/// A write being sealed takes only a byte-identical retry of its recorded pre-commitment leg.
/// ´claim:staged:a-sealing-write-takes-only-its-recorded-leg´
#[sqlx::test(migrations = "../../migrations")]
async fn a_sealing_write_refuses_a_different_pre_commitment_leg(pool: PgPool) {
    let alice = actor(&pool, "alice", "alice").await;
    let id = stage(&pool, alice, &proposal("alice", 0), 0).await;
    let first = pre_parts();
    let other = PreSignedParts {
        content_nonce: vec![21; 32],
        dependency_nonce: vec![22; 32],
        pre_signature: vec![23; 64],
        ..pre_parts()
    };
    staged::record_pre_signed(&pool, id, &first)
        .await
        .expect("the first leg");
    assert!(
        matches!(
            staged::record_pre_signed(&pool, id, &other).await,
            Err(StagedError::PreSignMismatch(refused)) if refused == id
        ),
        "a different leg is refused while sealing"
    );
    let w = staged::load(&pool, id).await.expect("loads");
    assert_eq!(w.state, StagedState::Sealing);
    assert_eq!(w.pre_signed, Some(first.clone()), "the first leg stands");
    staged::record_pre_signed(&pool, id, &first)
        .await
        .expect("a byte-identical retry still runs");
    let later = stage(&pool, alice, &proposal("alice", 1), 0).await;
    staged::record_pre_signed(&pool, later, &other)
        .await
        .expect("the refused leg's content nonce was never reserved");
}

/// A write a redaction reaped between the relay's load and the recording
/// of its leg is refused as reaped, and nothing is recorded. Without the
/// check, the leg would put a content nonce beside a reaped payload, a
/// row the schema refuses, and the caller would see a storage fault.
///
/// A write reaped after it was loaded is refused as reaped when its leg is recorded.
/// ´claim:staged:a-reaped-write-takes-no-leg´
#[sqlx::test(migrations = "../../migrations")]
async fn a_write_reaped_after_its_load_takes_no_pre_commitment_leg(pool: PgPool) {
    let alice = actor(&pool, "alice", "alice").await;
    let id = stage(&pool, alice, &proposal("alice", 0), 0).await;
    let loaded = staged::load(&pool, id).await.expect("the relay loads it");
    assert_eq!(loaded.state, StagedState::AwaitingPreSign);
    let mut conn = pool.acquire().await.expect("conn");
    assert_eq!(
        staged::reap_payload(&mut conn, "act:alice:0:opinion")
            .await
            .expect("a redaction reaps it"),
        1
    );
    let got = staged::record_pre_signed(&pool, id, &pre_parts()).await;
    assert!(
        matches!(got, Err(StagedError::Reaped(refused)) if refused == id),
        "refused as reaped, got {got:?}"
    );
    let state: String = sqlx::query_scalar("SELECT state FROM staged_writes WHERE id = $1")
        .bind(id)
        .fetch_one(&pool)
        .await
        .expect("reads");
    assert_eq!(state, "awaiting_pre_sign", "nothing was recorded");
}

/// The payload mark is read off CoGra's carriage when the record arrives
/// (data-model.md "Act payload carriage"): a record is marked exactly when
/// its act has a carriage row, full or reduced. A sealed staged write's
/// non-empty pair is promoted into carriage by the ingestion itself, so
/// its record is marked from its first read; an empty payload promotes
/// nothing and reads unmarked, as does a record CoGra carries nothing for.
/// A rebuild from the published sequence over the carriage that stands
/// reads every mark back the same, and a carriage row written after the
/// record arrived marks it then.
///
/// A record is payload-marked exactly when its act has a carriage row, from its first read and across a rebuild.
/// ´claim:staged:the-payload-mark-follows-carriage´
#[sqlx::test(migrations = "../../migrations")]
async fn the_payload_mark_follows_carriage(pool: PgPool) {
    let alice = actor(&pool, "alice", "alice").await;
    let full = proposal("alice", 0);
    let empty = Proposal {
        payload: vec![],
        ..proposal("alice", 1)
    };
    for (p, nonce) in [(&full, vec![2; 32]), (&empty, vec![12; 32])] {
        let id = stage(&pool, alice, p, 0).await;
        let pre = pre_parts_with(nonce);
        staged::record_pre_signed(&pool, id, &pre)
            .await
            .expect("pre-sign");
        let mut sealed = sealed_act(p);
        sealed.act.pre_commitment = pre.pre_signed(p).pre_commitment().to_vec();
        staged::record_sealed(&pool, id, &sealed)
            .await
            .expect("seal");
    }
    sqlx::query(
        "INSERT INTO act_payloads (act_id, payload_state, reduced_at)
         VALUES ('act:alice:2:opinion', 'reduced', NOW())",
    )
    .execute(&pool)
    .await
    .expect("a reduced row");
    let records = (0..4)
        .map(|seq| published("alice", seq, Family::Opinion, 1, seq as i64 + 1))
        .collect::<Vec<_>>();
    let package = EpochPackage {
        epoch: 1,
        attested_at: chrono::Utc::now(),
        records,
        closure: Default::default(),
    };
    mirror::ingest_epoch(&pool, &package)
        .await
        .expect("ingests");
    let marks = || async {
        sqlx::query_as::<_, (String, bool)>(
            "SELECT record_id, payload_marked FROM mirror_records ORDER BY position",
        )
        .fetch_all(&pool)
        .await
        .expect("marks")
    };
    let expected = vec![
        ("act:alice:0:opinion".to_string(), true),
        ("act:alice:1:opinion".to_string(), false),
        ("act:alice:2:opinion".to_string(), true),
        ("act:alice:3:opinion".to_string(), false),
    ];
    assert_eq!(marks().await, expected);
    let promoted: (Vec<u8>, Vec<u8>, Vec<u8>) = sqlx::query_as(
        "SELECT payload, content_nonce, content_salt FROM act_payloads
         WHERE act_id = 'act:alice:0:opinion'",
    )
    .fetch_one(&pool)
    .await
    .expect("promoted at ingestion");
    assert_eq!(promoted, (full.payload.clone(), vec![2; 32], vec![4; 32]));

    mirror::reset(&pool).await.expect("reset");
    mirror::ingest_epoch(&pool, &package)
        .await
        .expect("re-ingests");
    assert_eq!(marks().await, expected, "a rebuild reads the same marks");

    let mut tx = pool.begin().await.expect("tx");
    postgres_store::content::insert_reduced_act_payload(&mut tx, "act:alice:3:opinion", None)
        .await
        .expect("late carriage");
    tx.commit().await.expect("commit");
    assert!(
        marks().await[3].1,
        "a carriage row written after the record arrived marks it"
    );
}

/// The reap takes the payload, its content salt and its content nonce, and
/// leaves the dependency nonce with the rest of the pre-commitment leg:
/// the host holds it beside the dependency list, and it opens no content
/// (data-model.md "Staged writes"). The table refuses a reaped row that
/// still holds the content nonce.
///
/// The redaction reap takes the content nonce with the payload and leaves the dependency nonce.
/// ´claim:staged:the-reap-takes-the-content-nonce-and-leaves-the-dependency-nonce´
#[sqlx::test(migrations = "../../migrations")]
async fn the_reap_takes_the_content_nonce_and_leaves_the_dependency_nonce(pool: PgPool) {
    let alice = actor(&pool, "alice", "alice").await;
    let p = proposal("alice", 0);
    let id = stage(&pool, alice, &p, 0).await;
    staged::record_pre_signed(&pool, id, &pre_parts())
        .await
        .expect("pre-sign");
    staged::record_sealed(&pool, id, &sealed_act(&p))
        .await
        .expect("seal");
    let mut conn = pool.acquire().await.expect("conn");
    staged::reap_payload(&mut conn, "act:alice:0:opinion")
        .await
        .expect("reaps");
    type Bytes = Option<Vec<u8>>;
    let (payload, salt, content_nonce, dependency_nonce): (Bytes, Bytes, Bytes, Bytes) =
        sqlx::query_as(
            "SELECT payload, content_salt, content_nonce, dependency_nonce
         FROM staged_writes WHERE id = $1",
        )
        .bind(id)
        .fetch_one(&pool)
        .await
        .expect("reads");
    assert_eq!((payload, salt, content_nonce), (None, None, None));
    assert_eq!(dependency_nonce, Some(vec![9; 32]));
    assert!(
        sqlx::query("UPDATE staged_writes SET content_nonce = '\\x02' WHERE id = $1")
            .bind(id)
            .execute(&pool)
            .await
            .is_err(),
        "a reaped row cannot hold the content nonce"
    );
}
