//! Genesis-bootstrap integration: the fresh run, the both-sides gate, the
//! idempotent re-run, the crash-repair path, and the unrepairable state
//! (architecture.md "Genesis bootstrap").
//!
//! **Why this suite writes `l1_*` SQL directly** — the one place outside
//! `l1-standin` that does, and a deliberate exception to CLAUDE.md's SQL
//! boundary rather than an oversight. What is under test is what the
//! bootstrap does when the *substrate* is in a state it did not put it
//! in: a wiped mirror, an act sealed but never approved, an author
//! sequence occupied by something else. The seam has no operation for
//! any of that — by design, since a substrate does not offer "forget the
//! last hour" — so the only way to build those states is to write the
//! tables. The exception is bounded: it lives in test code, it never
//! ships, and it goes away with the tables at the swap, when the
//! bootstrap's crash windows have to be re-tested against whatever the
//! real Layer 1 offers instead. `l1-standin`'s `table_ownership` test
//! guards the migration set, which is the copy that outlives the swap;
//! this file is not in its scope and does not need to be.

use api::bootstrap::{BootstrapError, BootstrapOutcome, GenesisInput, ensure_operator_login, run};
use api::l1::{L1Boundary, StandInBoundary};
use api::profile::ProfileUpdateDraft;
use common::l1::Family;
use common::l1::client::ActorKey;
use common::l1::identifier::ActId;
use common::l1::proposal::{
    PreSigned, content_commitment, content_pre_digest, dependency_pre_digest, pre_commitment,
};
use l1_standin::{StandIn, StandInConfig};
use postgres_store::content as content_store;
use postgres_store::genesis;
use postgres_store::mirror;
use postgres_store::staged::{self, PreSignedParts};
use sqlx::PgPool;
use uuid::Uuid;

fn input() -> GenesisInput {
    GenesisInput {
        handle: "operator".into(),
        display_name: "The Operator".into(),
        guidelines_version: "1".into(),
        guidelines_hash: "deadbeef".into(),
        burn_per_account_micro: 10_000_000,
    }
}

fn standin(pool: &PgPool) -> StandIn {
    StandIn::new(pool.clone(), StandInConfig::default())
}

/// The L2 half is the cast rows, the reserved Types and the parameter
/// carrier; the L1 half is the genesis records landing as the instance's
/// first accepted acts — four Registrations, two endorsement Opinions,
/// The Charter, and the genesis role Tag, with the Genesis Moderator's
/// Registration first.
///
/// A fresh bootstrap lands both halves: the L2 cast, reserved Types and parameter carrier, and the L1 genesis sequence as the instance's first accepted acts.
/// ´claim:bootstrap:a-fresh-run-lands-both-halves´
#[sqlx::test(migrations = "../../migrations")]
async fn fresh_bootstrap_creates_both_halves(pool: PgPool) {
    let host = standin(&pool);
    let outcome = run(&host, &pool, input()).await.expect("bootstraps");
    assert_eq!(outcome, BootstrapOutcome::Fresh);

    assert!(genesis::system_actors_present(&pool).await.expect("gate"));
    assert!(genesis::parameters_seeded(&pool).await.expect("seeded"));
    let hashtags: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM hashtags")
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(hashtags, genesis::RESERVED_TYPES.len() as i64);
    let operator = genesis::actor_by_handle(&pool, "operator")
        .await
        .expect("query")
        .expect("operator row");
    assert_eq!(operator.kind, "user");

    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 1);
    let ids = mirror::record_ids_in_epoch(&pool, 1).await.expect("ids");
    assert_eq!(ids.len(), 8);
    let publisher_address = genesis::actor_by_handle(&pool, genesis::PUBLISHER_HANDLE)
        .await
        .expect("query")
        .expect("publisher row")
        .realization_address
        .expect("keyed");
    for family in [Family::Publish, Family::Tag] {
        assert!(
            mirror::has_record_by(&pool, &publisher_address, family)
                .await
                .expect("gate"),
            "publisher's {family} record must be in the mirror"
        );
    }
    let operator_address = operator.realization_address.expect("keyed");
    assert!(
        mirror::has_record_by(&pool, &operator_address, Family::Registration)
            .await
            .expect("gate")
    );

    assert_eq!(ids[0], format!("act:{operator_address}:0:registration"));
}

/// A second run reports AlreadyComplete and lands nothing new: still
/// exactly one epoch of eight records.
///
/// A second run reports the genesis already complete and lands nothing new.
/// ´claim:bootstrap:a-rerun-lands-nothing-new´
#[sqlx::test(migrations = "../../migrations")]
async fn rerun_is_idempotent(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("first run");
    let outcome = run(&host, &pool, input()).await.expect("second run");
    assert_eq!(outcome, BootstrapOutcome::AlreadyComplete);
    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 1);
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 1)
            .await
            .expect("ids")
            .len(),
        8
    );
}

/// The crash window where the L2 half committed and the L1 half never
/// happened — simulated by wiping the substrate and the mirror's
/// projection of it. The re-run completes the missing half, keyed on the
/// stored identities.
///
/// A crash between the two halves is repaired by the re-run, which completes the missing half keyed on the identities already stored.
/// ´claim:bootstrap:a-crash-between-the-halves-is-repaired´
#[sqlx::test(migrations = "../../migrations")]
async fn crash_before_the_l1_half_is_repaired(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("first run");

    for table in [
        "mirror_record_legs",
        "mirror_records",
        "mirror_epochs",
        "l1_act_legs",
        "l1_acts",
        "l1_epoch_ledger",
        "l1_epochs",
        "l1_node_state",
        "l1_accounts",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&pool)
            .await
            .expect("wipe");
    }
    sqlx::query("UPDATE mirror_epoch_cursor SET last_epoch = 0")
        .execute(&pool)
        .await
        .expect("cursor reset");

    let outcome = run(&host, &pool, input()).await.expect("repairs");
    assert_eq!(outcome, BootstrapOutcome::Repaired);
    let publisher_address = genesis::actor_by_handle(&pool, genesis::PUBLISHER_HANDLE)
        .await
        .expect("query")
        .expect("row")
        .realization_address
        .expect("keyed");
    assert!(
        mirror::has_record_by(&pool, &publisher_address, Family::Publish)
            .await
            .expect("gate")
    );
}

/// The repair path is where a changed input is most dangerous: the
/// stored parameter rows are reloaded only for keys, and the Charter
/// about to be sealed is built wholly from the current input — so
/// without a check the immutable record would permanently contradict the
/// rows already committed. `guidelines_hash` is the digest of the
/// document the binary was built with, so a repair run by a newer build
/// than the first run is how the values genuinely differ in production.
///
/// A repair run whose genesis input disagrees with what the first run committed is refused rather than sealing the contradiction.
/// ´claim:bootstrap:a-changed-genesis-input-is-refused-on-repair´
#[sqlx::test(migrations = "../../migrations")]
async fn a_repair_run_with_changed_input_is_refused(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("first run");

    for table in [
        "mirror_record_legs",
        "mirror_records",
        "mirror_epochs",
        "l1_act_legs",
        "l1_acts",
        "l1_epoch_ledger",
        "l1_epochs",
        "l1_node_state",
        "l1_accounts",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&pool)
            .await
            .expect("wipe");
    }
    sqlx::query("UPDATE mirror_epoch_cursor SET last_epoch = 0")
        .execute(&pool)
        .await
        .expect("cursor reset");

    let changed = GenesisInput {
        guidelines_hash: "c0ffee".into(),
        ..input()
    };
    let err = run(&host, &pool, changed).await.expect_err("diverged");
    assert!(matches!(err, BootstrapError::Diverged(_)), "got {err:?}");
    assert!(
        err.to_string().contains("guidelines_hash"),
        "the refusal names the parameter that disagreed: {err}"
    );

    let outcome = run(&host, &pool, input()).await.expect("unchanged repairs");
    assert_eq!(outcome, BootstrapOutcome::Repaired);
}

/// The recorded address of a cast member, for building act identifiers.
async fn address_of(pool: &PgPool, handle: &str) -> String {
    genesis::actor_by_handle(pool, handle)
        .await
        .expect("query")
        .expect("cast row")
        .realization_address
        .expect("keyed")
}

/// Keeps a copy of every act's handshake custody — the content salt the
/// host holds until acceptance; it never holds the payload or the content
/// nonce — as acceptance drops it, so a rewind can put an act back in the
/// state it held before the close. Installed before the first run; the
/// table and trigger are test scaffolding in the test's own database.
async fn keep_custody(pool: &PgPool) {
    for statement in [
        "CREATE TABLE test_custody (act_id TEXT PRIMARY KEY, content_salt BYTEA)",
        "CREATE FUNCTION test_keep_custody() RETURNS trigger AS $$
         BEGIN
             INSERT INTO test_custody VALUES (OLD.act_id, OLD.content_salt)
             ON CONFLICT (act_id) DO NOTHING;
             RETURN NEW;
         END $$ LANGUAGE plpgsql",
        "CREATE TRIGGER test_keep_custody BEFORE UPDATE OF status ON l1_acts
         FOR EACH ROW WHEN (NEW.status = 'accepted' AND OLD.content_salt IS NOT NULL)
         EXECUTE FUNCTION test_keep_custody()",
    ] {
        sqlx::query(statement)
            .execute(pool)
            .await
            .expect("custody scaffolding");
    }
}

/// Rewinds a bootstrapped substrate to the state a run interrupted inside
/// the L1 sequence leaves behind: only `keep` of the genesis acts stand
/// (approved, unordered, with the handshake custody an unaccepted act
/// still holds), no epoch is closed, nothing is published or mirrored, and
/// balances are back at their post-burn values. The L2 half is untouched —
/// the crash window under test is inside the sequence. Needs
/// [`keep_custody`] installed before the first run.
async fn rewind_to_partial_genesis(pool: &PgPool, keep: &[String]) {
    sqlx::query("DELETE FROM l1_act_legs")
        .execute(pool)
        .await
        .expect("wipe");
    sqlx::query("DELETE FROM l1_acts WHERE NOT (act_id = ANY($1))")
        .bind(keep)
        .execute(pool)
        .await
        .expect("wipe");
    sqlx::query(
        "UPDATE l1_acts SET status = 'approved', epoch = NULL, act_time = NULL, position = NULL,
                content_salt = c.content_salt
           FROM test_custody c WHERE c.act_id = l1_acts.act_id",
    )
    .execute(pool)
    .await
    .expect("unorder");
    for table in [
        "l1_epoch_ledger",
        "l1_epochs",
        "l1_node_state",
        "mirror_record_legs",
        "mirror_records",
        "mirror_epochs",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(pool)
            .await
            .expect("wipe");
    }
    sqlx::query("UPDATE l1_accounts SET balance_micro = burned_total_micro, action_count = 0")
        .execute(pool)
        .await
        .expect("undebit");
    sqlx::query("UPDATE mirror_epoch_cursor SET last_epoch = 0")
        .execute(pool)
        .await
        .expect("cursor reset");
}

/// The crash window inside the sequence: burns landed, the four
/// Registrations and the first endorsement Opinion approved, then nothing
/// more. The re-run finishes the sequence, and the genesis burn is
/// credited at most once per cast member across both runs.
///
/// A crash part-way through the genesis sequence is repaired by finishing it, the genesis burn crediting at most once per cast member across both runs.
/// ´claim:bootstrap:a-crash-inside-the-sequence-is-finished-not-repeated´
#[sqlx::test(migrations = "../../migrations")]
async fn crash_inside_the_l1_sequence_is_repaired(pool: PgPool) {
    let host = standin(&pool);
    keep_custody(&pool).await;
    run(&host, &pool, input()).await.expect("first run");
    let operator = address_of(&pool, "operator").await;
    let publisher = address_of(&pool, genesis::PUBLISHER_HANDLE).await;
    let moderator = address_of(&pool, genesis::MODERATOR_HANDLE).await;
    let treasury = address_of(&pool, genesis::TREASURY_HANDLE).await;

    rewind_to_partial_genesis(
        &pool,
        &[
            format!("act:{operator}:0:registration"),
            format!("act:{publisher}:0:registration"),
            format!("act:{moderator}:0:registration"),
            format!("act:{treasury}:0:registration"),
            format!("act:{operator}:1:opinion"),
        ],
    )
    .await;

    let outcome = run(&host, &pool, input()).await.expect("repairs");
    assert_eq!(outcome, BootstrapOutcome::Repaired);
    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 1);
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 1)
            .await
            .expect("ids")
            .len(),
        8
    );
    assert!(
        mirror::has_record_by(&pool, &publisher, Family::Publish)
            .await
            .expect("gate")
    );
    for address in [&operator, &publisher, &moderator, &treasury] {
        let balance = host.balance(address).await.expect("balance");
        assert_eq!(balance.burned_total, 10.0);
    }
}

/// The narrowest crash window: The Treasury's Registration was sealed but
/// the crash hit before its approval was recorded. The re-run recovers
/// the approval from the custodied key rather than re-sealing.
///
/// An act sealed but not yet approved when the crash hit has its approval recovered from the custodied key rather than being sealed a second time.
/// ´claim:bootstrap:a-sealed-act-is-recovered-not-resealed´
#[sqlx::test(migrations = "../../migrations")]
async fn a_sealed_unapproved_act_is_recovered(pool: PgPool) {
    let host = standin(&pool);
    keep_custody(&pool).await;
    run(&host, &pool, input()).await.expect("first run");
    let operator = address_of(&pool, "operator").await;
    let publisher = address_of(&pool, genesis::PUBLISHER_HANDLE).await;
    let moderator = address_of(&pool, genesis::MODERATOR_HANDLE).await;
    let treasury = address_of(&pool, genesis::TREASURY_HANDLE).await;

    rewind_to_partial_genesis(
        &pool,
        &[
            format!("act:{operator}:0:registration"),
            format!("act:{publisher}:0:registration"),
            format!("act:{moderator}:0:registration"),
            format!("act:{treasury}:0:registration"),
        ],
    )
    .await;
    sqlx::query(
        "UPDATE l1_acts SET status = 'sealed', approval_signature = NULL, approved_at = NULL
         WHERE act_id = $1",
    )
    .bind(format!("act:{treasury}:0:registration"))
    .execute(&pool)
    .await
    .expect("unapprove");

    let outcome = run(&host, &pool, input()).await.expect("repairs");
    assert_eq!(outcome, BootstrapOutcome::Repaired);
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 1)
            .await
            .expect("ids")
            .len(),
        8
    );
    assert!(
        mirror::has_record_by(&pool, &treasury, Family::Registration)
            .await
            .expect("gate"),
        "the recovered approval must land the sealed Registration"
    );
}

/// The crash window the host cannot cover: The Charter was sealed, and the
/// run died before its carriage was written or its approval relayed. The
/// host never held the payload or the content nonce, so the re-run
/// recovers the approval from the custodied key and the nonces the
/// bootstrap kept before the seal ([`PreSigned::recover`]), writes the
/// carriage, and the Charter lands with a carriage that opens its witness
/// — the nonce moved out of the handshake custody once carried.
///
/// A seal whose carriage was never written is recovered from the nonces kept before the seal, and lands carried.
/// ´claim:bootstrap:a-seal-without-its-carriage-is-recovered´
#[sqlx::test(migrations = "../../migrations")]
async fn a_sealed_act_whose_carriage_was_never_written_is_recovered(pool: PgPool) {
    let host = standin(&pool);
    keep_custody(&pool).await;
    run(&host, &pool, input()).await.expect("first run");
    let operator = address_of(&pool, "operator").await;
    let publisher = address_of(&pool, genesis::PUBLISHER_HANDLE).await;
    let charter = format!("act:{publisher}:1:publish");
    let mut keep = registrations(&pool).await;
    keep.extend([
        format!("act:{operator}:1:opinion"),
        format!("act:{operator}:2:opinion"),
        charter.clone(),
    ]);
    rewind_to_partial_genesis(&pool, &keep).await;
    for statement in [
        "UPDATE l1_acts SET status = 'sealed', approval_signature = NULL, approved_at = NULL
         WHERE act_id = $1",
        "UPDATE genesis_handshake_nonces g SET content_nonce = c.content_nonce
         FROM act_payloads c WHERE c.act_id = g.act_id AND g.act_id = $1",
        "DELETE FROM act_payloads WHERE act_id = $1",
    ] {
        sqlx::query(statement)
            .bind(&charter)
            .execute(&pool)
            .await
            .expect("rewinds to the crash");
    }

    let outcome = run(&host, &pool, input()).await.expect("repairs");
    assert_eq!(outcome, BootstrapOutcome::Repaired);
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 1)
            .await
            .expect("ids")
            .len(),
        8
    );
    let id = ActId::parse(&charter).expect("act id");
    let stored = host.sealed_act(&id).await.expect("reads").expect("stored");
    let carriage = content_store::act_payload(&pool, &charter)
        .await
        .expect("reads")
        .expect("the resume wrote the carriage");
    assert_eq!(
        content_commitment(
            &id,
            &stored.pre_commitment,
            carriage.content_salt.as_deref().expect("salt"),
            &content_pre_digest(
                &id,
                carriage.content_nonce.as_deref().expect("nonce"),
                carriage.payload.as_deref().expect("payload"),
            ),
        )
        .to_vec(),
        stored.content_commitment
    );
    assert_eq!(
        genesis::handshake_nonces(&pool, &charter)
            .await
            .expect("reads")
            .expect("kept")
            .content_nonce,
        None
    );
}

/// The same identifier holding different content is refused as
/// divergence rather than replayed. The divergence is driven through the
/// substrate here because that is what this claim covers; a re-run with
/// changed *input* is a different path, covered below.
///
/// One identifier holding different content is refused as divergence rather than replayed over.
/// ´claim:bootstrap:divergence-is-refused-not-replayed´
#[sqlx::test(migrations = "../../migrations")]
async fn a_diverged_substrate_act_is_refused(pool: PgPool) {
    let host = standin(&pool);
    keep_custody(&pool).await;
    run(&host, &pool, input()).await.expect("first run");
    let operator = address_of(&pool, "operator").await;
    let publisher = address_of(&pool, genesis::PUBLISHER_HANDLE).await;
    let moderator = address_of(&pool, genesis::MODERATOR_HANDLE).await;
    let treasury = address_of(&pool, genesis::TREASURY_HANDLE).await;

    rewind_to_partial_genesis(
        &pool,
        &[
            format!("act:{operator}:0:registration"),
            format!("act:{publisher}:0:registration"),
            format!("act:{moderator}:0:registration"),
            format!("act:{treasury}:0:registration"),
        ],
    )
    .await;
    sqlx::query("UPDATE l1_acts SET p_d = 0.5 WHERE act_id = $1")
        .bind(format!("act:{operator}:0:registration"))
        .execute(&pool)
        .await
        .expect("tamper");

    let err = run(&host, &pool, input()).await.expect_err("diverged");
    assert!(matches!(err, BootstrapError::Diverged(_)), "got {err:?}");
}

/// A different act holds the author-local sequence, so the identifier the
/// genesis sequence needs does not exist and the seal conflicts. That too
/// is refused truthfully rather than replayed.
///
/// An author-local sequence value another act already holds is refused truthfully rather than worked around.
/// ´claim:bootstrap:an-occupied-sequence-is-refused´
#[sqlx::test(migrations = "../../migrations")]
async fn an_occupied_author_sequence_is_refused(pool: PgPool) {
    let host = standin(&pool);
    keep_custody(&pool).await;
    run(&host, &pool, input()).await.expect("first run");
    let operator = address_of(&pool, "operator").await;
    let publisher = address_of(&pool, genesis::PUBLISHER_HANDLE).await;
    let moderator = address_of(&pool, genesis::MODERATOR_HANDLE).await;
    let treasury = address_of(&pool, genesis::TREASURY_HANDLE).await;

    rewind_to_partial_genesis(
        &pool,
        &[
            format!("act:{operator}:0:registration"),
            format!("act:{publisher}:0:registration"),
            format!("act:{moderator}:0:registration"),
            format!("act:{treasury}:0:registration"),
        ],
    )
    .await;
    sqlx::query("UPDATE l1_acts SET act_id = $2, family = 'opinion' WHERE act_id = $1")
        .bind(format!("act:{treasury}:0:registration"))
        .bind(format!("act:{treasury}:0:opinion"))
        .execute(&pool)
        .await
        .expect("morph");

    let err = run(&host, &pool, input()).await.expect_err("occupied");
    assert!(matches!(err, BootstrapError::Diverged(_)), "got {err:?}");
}

/// Every genesis act lands under the two-nonce handshake and witness-only
/// on the substrate, and each one with a payload — the Charter and the
/// role Tag — has its whole content pair beside it in `act_payloads`: the
/// pair's content pre-digest and the salt open the witness the host kept,
/// and the pair's nonce is no longer in the bootstrap's handshake custody.
/// A full-empty payload has no carriage row; its pre-commitment, which
/// the host keeps, recomputes from the empty payload and the nonces the
/// bootstrap kept, and its record reads unmarked.
///
/// Every genesis act lands witness-only on the substrate, with carriage beside each payload that opens its witness.
/// ´claim:bootstrap:genesis-carriage-opens-the-witness-the-host-kept´
#[sqlx::test(migrations = "../../migrations")]
async fn every_genesis_act_lands_witness_only_with_its_carriage_beside_it(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("bootstraps");
    let ids = mirror::record_ids_in_epoch(&pool, 1).await.expect("ids");
    assert_eq!(ids.len(), 8);
    let mut carried = 0;
    for id in ids {
        let act_id = ActId::parse(&id).expect("a record id");
        let stored = host
            .sealed_act(&act_id)
            .await
            .expect("reads")
            .expect("stored");
        assert!(stored.sealed.is_none(), "{id} kept its handshake custody");
        let carriage = content_store::act_payload(&pool, &id).await.expect("reads");
        let kept = genesis::handshake_nonces(&pool, &id)
            .await
            .expect("reads")
            .expect("the bootstrap kept the act's nonces");
        assert_eq!(kept.dependency_nonce, stored.dependency_nonce);
        let marked = mirror::record_full(&pool, &id)
            .await
            .expect("reads")
            .expect("landed")
            .payload_marked;
        let Some(carriage) = carriage else {
            let empty = content_pre_digest(
                &act_id,
                &kept
                    .content_nonce
                    .expect("an empty payload's nonce stays kept"),
                &[],
            );
            assert_eq!(
                pre_commitment(
                    &stored.body,
                    &empty,
                    &dependency_pre_digest(&act_id, &stored.dependency_nonce, &stored.deps)
                )
                .to_vec(),
                stored.pre_commitment,
                "{id} has no carriage, so its payload is the empty one"
            );
            assert!(!marked, "{id}: an empty payload reads unmarked");
            continue;
        };
        carried += 1;
        assert!(marked, "{id}: a carried payload reads marked");
        assert_eq!(
            kept.content_nonce, None,
            "{id}: the nonce moved into carriage"
        );
        let payload = carriage.payload.expect("full carriage holds its payload");
        let nonce = carriage
            .content_nonce
            .expect("full carriage holds its nonce");
        let salt = carriage.content_salt.expect("full carriage holds its salt");
        assert_eq!(
            content_commitment(
                &act_id,
                &stored.pre_commitment,
                &salt,
                &content_pre_digest(&act_id, &nonce, &payload)
            )
            .to_vec(),
            stored.content_commitment,
            "the carriage of {id} opens its witness"
        );
    }
    assert_eq!(carried, 2, "the Charter and the role Tag carry payloads");
}

/// Rewinds a bootstrapped substrate to a run interrupted after its first
/// epoch closed over `keep` alone: those acts stand accepted and
/// witness-only, every other genesis act is gone, and the mirror is empty
/// so the re-run ingests the kept epoch again. The L2 half and the
/// genesis carriage are untouched.
async fn rewind_keeping_accepted(pool: &PgPool, keep: &[String]) {
    sqlx::query("DELETE FROM l1_act_legs WHERE NOT (act_id = ANY($1))")
        .bind(keep)
        .execute(pool)
        .await
        .expect("wipe");
    sqlx::query("DELETE FROM l1_acts WHERE NOT (act_id = ANY($1))")
        .bind(keep)
        .execute(pool)
        .await
        .expect("wipe");
    for table in ["mirror_record_legs", "mirror_records", "mirror_epochs"] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(pool)
            .await
            .expect("wipe");
    }
    sqlx::query("UPDATE mirror_epoch_cursor SET last_epoch = 0")
        .execute(pool)
        .await
        .expect("cursor reset");
}

async fn registrations(pool: &PgPool) -> Vec<String> {
    let mut ids = Vec::new();
    for handle in [
        "operator",
        genesis::PUBLISHER_HANDLE,
        genesis::MODERATOR_HANDLE,
        genesis::TREASURY_HANDLE,
    ] {
        ids.push(format!(
            "act:{}:0:registration",
            address_of(pool, handle).await
        ));
    }
    ids
}

/// A repair resuming over genesis acts the substrate already accepted —
/// their salt gone, their carriage and kept nonces beside them — is not
/// mistaken for divergence: it finishes the sequence.
///
/// A repair over accepted, witness-only genesis acts finishes the sequence rather than refusing it as divergence.
/// ´claim:bootstrap:a-repair-over-witness-only-acts-finishes´
#[sqlx::test(migrations = "../../migrations")]
async fn a_genesis_repair_over_an_accepted_act_is_not_refused_as_diverged(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("first run");
    let keep = registrations(&pool).await;
    rewind_keeping_accepted(&pool, &keep).await;

    let outcome = run(&host, &pool, input()).await.expect("repairs");
    assert_eq!(outcome, BootstrapOutcome::Repaired);
    let publisher = address_of(&pool, genesis::PUBLISHER_HANDLE).await;
    assert!(
        mirror::has_record_by(&pool, &publisher, Family::Publish)
            .await
            .expect("gate")
    );
    let witness_only: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM l1_acts WHERE status = 'accepted' AND content_salt IS NULL",
    )
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(witness_only, 8);
}

/// An accepted act is still compared: a stored body, pre-commitment or
/// carriage that disagrees with the genesis input is refused, the
/// carriage case as unrepairable because it is the carriage that is wrong.
/// The pre-commitment is the host's binding of the payload — recomputed
/// from the input and the kept nonces, it stands in for the payload the
/// host never held. (The kept acts are Registrations, whose empty payloads
/// carry no row, so the carriage case plants one that does not open the
/// witness.)
///
/// A repair over an accepted act still refuses a body, pre-commitment or carriage that disagrees with the genesis input.
/// ´claim:bootstrap:a-witness-only-act-is-still-compared´
#[sqlx::test(migrations = "../../migrations")]
async fn a_genesis_repair_with_changed_input_over_an_accepted_act_is_still_refused(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("first run");
    let keep = registrations(&pool).await;
    rewind_keeping_accepted(&pool, &keep).await;
    let operator_reg = keep[0].clone();

    sqlx::query("UPDATE l1_acts SET p_d = 0.5 WHERE act_id = $1")
        .bind(&operator_reg)
        .execute(&pool)
        .await
        .expect("tamper the body");
    let err = run(&host, &pool, input()).await.expect_err("diverged");
    assert!(matches!(err, BootstrapError::Diverged(_)), "got {err:?}");
    sqlx::query("UPDATE l1_acts SET p_d = 1.0 WHERE act_id = $1")
        .bind(&operator_reg)
        .execute(&pool)
        .await
        .expect("restore the body");

    let original: Vec<u8> =
        sqlx::query_scalar("SELECT pre_commitment FROM l1_acts WHERE act_id = $1")
            .bind(&operator_reg)
            .fetch_one(&pool)
            .await
            .expect("reads");
    sqlx::query("UPDATE l1_acts SET pre_commitment = $2 WHERE act_id = $1")
        .bind(&operator_reg)
        .bind(vec![0x0f_u8; 32])
        .execute(&pool)
        .await
        .expect("tamper the pre-commitment");
    let err = run(&host, &pool, input()).await.expect_err("diverged");
    assert!(matches!(err, BootstrapError::Diverged(_)), "got {err:?}");
    sqlx::query("UPDATE l1_acts SET pre_commitment = $2 WHERE act_id = $1")
        .bind(&operator_reg)
        .bind(&original)
        .execute(&pool)
        .await
        .expect("restore the pre-commitment");

    sqlx::query(
        "INSERT INTO act_payloads (act_id, payload, content_nonce, content_salt)
         VALUES ($1, '\\x01', '\\x02', '\\x00')",
    )
    .bind(&operator_reg)
    .execute(&pool)
    .await
    .expect("plant a carriage row");
    let err = run(&host, &pool, input()).await.expect_err("unrepairable");
    assert!(
        matches!(err, BootstrapError::Unrepairable(_)),
        "got {err:?}"
    );
}

/// Drives one profile update authored by the Genesis Moderator through
/// prepare, pre-signature, and approval with the custodied genesis key.
/// The act stands approved and unordered; ordering it is the caller's
/// choice, which is what lets a test aim the promotion at either of the
/// bootstrap's two ingestion steps. Returns the operator's actor id and
/// the staged write's.
async fn relay_operator_profile_update(host: &StandIn, pool: &PgPool) -> (Uuid, Uuid) {
    let operator = genesis::actor_by_handle(pool, "operator")
        .await
        .expect("query")
        .expect("operator row");
    let seed: [u8; 32] = genesis::system_key(pool, operator.id)
        .await
        .expect("query")
        .expect("custodied seed")
        .as_slice()
        .try_into()
        .expect("32-byte seed");
    let key = ActorKey::from_seed(seed);

    let boundary = StandInBoundary(host.clone());
    let prepared = api::profile::prepare_profile_update(
        pool,
        &boundary,
        api::prepare::Staging::unbudgeted(api::ingest::DEFAULT_GC_AFTER_EPOCHS),
        operator.id,
        ProfileUpdateDraft {
            display_name: Some("The Operator, edited".into()),
            bio: None,
            website_url: None,
            avatar_media_id: None,
        },
    )
    .await
    .expect("prepares update");

    let write = staged::load(pool, prepared.id).await.expect("loads");
    let pre = PreSigned::sign(&key, write.proposal);
    let sealed =
        api::relay::submit_pre_signed(&boundary, pool, prepared.id, PreSignedParts::from(&pre))
            .await
            .expect("seals");
    let host_key = boundary.host_public_key().await.expect("host key");
    let witness = pre.approve(&key, &sealed, &host_key).expect("approves");
    api::relay::submit_approval(&boundary, pool, prepared.id, witness.approval_signature)
        .await
        .expect("relays");

    (operator.id, prepared.id)
}

/// Breaks the profile promotion the way `profile::land_one` breaks: the
/// copy-forward merge reads the current version to carry unchanged
/// fields, so with no version row the promotion cannot build the new one.
async fn clear_profile_versions(pool: &PgPool, actor: Uuid) {
    sqlx::query("DELETE FROM actor_profile_versions WHERE actor_id = $1")
        .bind(actor)
        .execute(pool)
        .await
        .expect("clears versions");
}

/// The bootstrap's catch-up ingestion (its first step) refuses on a
/// promotion failure instead of walking on into the gate: a genesis the
/// operator is told completed must not sit on a promotion that silently
/// never happened.
///
/// The window is the one a re-run on a live instance walks into: an epoch
/// closed and not yet ingested, carrying a write whose promotion will
/// fail. The refusal is a refusal to complete, not a rollback — the
/// record landed and the mirror governs, exactly as ingestion left it.
///
/// A promotion that cannot complete refuses the run rather than letting it walk on, so an operator told the genesis completed is never sitting on a promotion that silently did not.
/// ´claim:bootstrap:a-failed-promotion-refuses-the-run´
#[sqlx::test(migrations = "../../migrations")]
async fn a_failed_promotion_refuses_the_catch_up_ingestion(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("first run");

    let (operator, staged_id) = relay_operator_profile_update(&host, &pool).await;
    host.close_epoch().await.expect("closes");
    clear_profile_versions(&pool, operator).await;

    let err = run(&host, &pool, input()).await.expect_err("refuses");
    let message = match err {
        BootstrapError::PromotionFailed(message) => message,
        other => panic!("expected PromotionFailed, got {other:?}"),
    };
    assert!(
        message.contains("profile promotion failed"),
        "unexpected: {message}"
    );
    assert!(
        message.contains("seeded profile version"),
        "unexpected: {message}"
    );
    assert!(
        message.contains(&staged_id.to_string()),
        "the failing staged write must name itself: {message}"
    );
    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 2);
}

/// The bootstrap's second ingestion — the one that lands the genesis
/// sequence it just wrote — refuses on the same terms.
///
/// The write is left approved and unordered so the bootstrap's own epoch
/// close is what orders it, putting the promotion in that second
/// ingestion. Getting the re-run there needs the gate pointed down the
/// repair path: the mirror is a rebuildable cache, so dropping the record
/// that keys the L1 half of the gate — while the cursor stands, leaving
/// the catch-up ingestion nothing to do — sends the run through the epoch
/// close to the second ingestion.
///
/// (´claim:bootstrap:a-failed-promotion-refuses-the-run´)
#[sqlx::test(migrations = "../../migrations")]
async fn a_failed_promotion_refuses_the_genesis_ingestion(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("first run");

    let (operator, staged_id) = relay_operator_profile_update(&host, &pool).await;
    clear_profile_versions(&pool, operator).await;

    let publisher = address_of(&pool, genesis::PUBLISHER_HANDLE).await;
    let charter = format!("act:{publisher}:1:publish");
    sqlx::query("DELETE FROM mirror_record_legs WHERE record_id = $1")
        .bind(&charter)
        .execute(&pool)
        .await
        .expect("wipe legs");
    sqlx::query("DELETE FROM mirror_records WHERE record_id = $1")
        .bind(&charter)
        .execute(&pool)
        .await
        .expect("wipe record");

    let err = run(&host, &pool, input()).await.expect_err("refuses");
    let message = match err {
        BootstrapError::PromotionFailed(message) => message,
        other => panic!("expected PromotionFailed, got {other:?}"),
    };
    assert!(
        message.contains("profile promotion failed"),
        "unexpected: {message}"
    );
    assert!(
        message.contains(&staged_id.to_string()),
        "the failing staged write must name itself: {message}"
    );
}

/// With the L2 half wiped — custodied keys included — while the L1
/// records stand, there is nothing left to sign with and the instance is
/// beyond repair.
///
/// With the L2 half gone and its custodied keys with it, an instance whose L1 records stand is beyond repair and says so.
/// ´claim:bootstrap:a-lost-l2-half-is-unrepairable´
#[sqlx::test(migrations = "../../migrations")]
async fn missing_l2_half_with_l1_records_is_unrepairable(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("first run");

    for table in [
        "system_actor_keys",
        "actor_profile_versions",
        "network_parameter_versions",
        "hashtags",
        "actors",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&pool)
            .await
            .expect("wipe");
    }

    let err = run(&host, &pool, input()).await.expect_err("unrepairable");
    assert!(matches!(err, BootstrapError::Unrepairable(_)));
}

/// The credentials verify like any login, and the uploaded blob is a
/// standard key-backup blob: the printed code opens it, and inside is the
/// custodied genesis seed — recovered here by re-parsing the code's
/// display form the way a client would, stripping the separators and
/// decoding Crockford base32. Re-running mints nothing new: credentials
/// stand, the blob stands, and no second code is printed.
///
/// The genesis account finishes as an ordinary one: its credentials log in, its printed code opens a standard key-backup blob holding the custodied seed, and a re-run mints no second code.
/// ´claim:bootstrap:the-genesis-account-is-an-ordinary-one´
#[sqlx::test(migrations = "../../migrations")]
async fn the_operator_login_completes_the_genesis_account(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("bootstraps");

    let login = ensure_operator_login(&pool, "operator", "op@example.com", "a strong password")
        .await
        .expect("operator login");
    assert!(login.credentials_created);
    let code = login.recovery_code.expect("a fresh code on first run");

    let credentials = postgres_store::auth::credentials_by_email(&pool, "op@example.com")
        .await
        .expect("query")
        .expect("credentials row");
    assert!(api::auth::verify_password(
        &credentials.password_hash,
        "a strong password"
    ));

    let blob = postgres_store::auth::latest_key_backup(&pool, credentials.actor_id)
        .await
        .expect("query")
        .expect("blob row");
    let retyped = common::l1::key_backup::RecoveryCode::from_input(&code)
        .expect("the printed code reads back through the reference parser");
    let opened =
        common::l1::key_backup::open(&blob, &retyped).expect("the printed code opens the blob");
    let custodied = genesis::system_key(&pool, credentials.actor_id)
        .await
        .expect("query")
        .expect("custodied seed");
    assert_eq!(opened.as_slice(), custodied.as_slice());

    let rerun = ensure_operator_login(&pool, "operator", "other@example.com", "another password")
        .await
        .expect("rerun");
    assert!(!rerun.credentials_created);
    assert!(rerun.recovery_code.is_none());
    let unchanged = postgres_store::auth::credentials_by_email(&pool, "op@example.com")
        .await
        .expect("query");
    assert!(unchanged.is_some(), "the original login is untouched");
}

/// The operator login needs an instance that has actually been bootstrapped behind it.
/// ´claim:bootstrap:the-operator-login-needs-a-genesis´
#[sqlx::test(migrations = "../../migrations")]
async fn the_operator_login_requires_a_bootstrapped_instance(pool: PgPool) {
    let err = ensure_operator_login(&pool, "operator", "op@example.com", "pw pw pw pw")
        .await
        .expect_err("no genesis actor yet");
    assert!(matches!(err, BootstrapError::Unrepairable(_)));
}
