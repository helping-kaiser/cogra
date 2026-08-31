//! Genesis-bootstrap integration: the fresh run, the both-sides gate, the
//! idempotent re-run, the crash-repair path, and the unrepairable state
//! (architecture.md "Genesis bootstrap").

use api::bootstrap::{BootstrapError, BootstrapOutcome, GenesisInput, ensure_operator_login, run};
use api::l1::{L1Boundary, StandInBoundary};
use api::profile::ProfileUpdateDraft;
use common::l1::Family;
use common::l1::client::ActorKey;
use l1_standin::{StandIn, StandInConfig};
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

    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 0);
    let ids = mirror::record_ids_in_epoch(&pool, 0).await.expect("ids");
    assert_eq!(ids.len(), 8);
    let publisher_address = genesis::actor_by_handle(&pool, genesis::PUBLISHER_HANDLE)
        .await
        .expect("query")
        .expect("publisher row")
        .l0_address
        .expect("keyed");
    for family in [Family::Publish, Family::Tag] {
        assert!(
            mirror::has_record_by(&pool, &publisher_address, family)
                .await
                .expect("gate"),
            "publisher's {family} record must be in the mirror"
        );
    }
    let operator_address = operator.l0_address.expect("keyed");
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
    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 0);
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 0)
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
        "l1_act_legs",
        "l1_acts",
        "l1_epochs",
        "l1_node_state",
        "l1_accounts",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&pool)
            .await
            .expect("wipe");
    }
    sqlx::query("UPDATE mirror_epoch_cursor SET last_epoch = -1")
        .execute(&pool)
        .await
        .expect("cursor reset");

    let outcome = run(&host, &pool, input()).await.expect("repairs");
    assert_eq!(outcome, BootstrapOutcome::Repaired);
    let publisher_address = genesis::actor_by_handle(&pool, genesis::PUBLISHER_HANDLE)
        .await
        .expect("query")
        .expect("row")
        .l0_address
        .expect("keyed");
    assert!(
        mirror::has_record_by(&pool, &publisher_address, Family::Publish)
            .await
            .expect("gate")
    );
}

/// The recorded L0 address of a cast member, for building act identifiers.
async fn address_of(pool: &PgPool, handle: &str) -> String {
    genesis::actor_by_handle(pool, handle)
        .await
        .expect("query")
        .expect("cast row")
        .l0_address
        .expect("keyed")
}

/// Rewinds a bootstrapped substrate to the state a run interrupted inside
/// the L1 sequence leaves behind: only `keep` of the genesis acts stand
/// (approved, unordered), no epoch is closed, nothing is published or
/// mirrored, and balances are back at their post-burn values. The L2 half
/// is untouched — the crash window under test is inside the sequence.
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
        "UPDATE l1_acts SET status = 'approved', epoch = NULL, act_time = NULL, position = NULL",
    )
    .execute(pool)
    .await
    .expect("unorder");
    for table in [
        "l1_epochs",
        "l1_node_state",
        "mirror_record_legs",
        "mirror_records",
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
    sqlx::query("UPDATE mirror_epoch_cursor SET last_epoch = -1")
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
    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 0);
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 0)
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
        mirror::record_ids_in_epoch(&pool, 0)
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

/// The same identifier holding different content — what a re-run with
/// changed genesis input would produce — is refused as divergence rather
/// than replayed.
///
/// One identifier holding different content is refused as divergence rather than replayed over.
/// ´claim:bootstrap:divergence-is-refused-not-replayed´
#[sqlx::test(migrations = "../../migrations")]
async fn a_diverged_substrate_act_is_refused(pool: PgPool) {
    let host = standin(&pool);
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
        api::ingest::DEFAULT_GC_AFTER_EPOCHS,
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
    let pre = key.pre_sign(write.proposal);
    let sealed = api::relay::submit_pre_signed(
        &boundary,
        pool,
        prepared.id,
        PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        },
    )
    .await
    .expect("seals");
    let host_key = boundary.host_public_key().await.expect("host key");
    let witness = key.approve(&pre, &sealed, &host_key).expect("approves");
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
    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 1);
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
    assert!(matches!(err, BootstrapError::Unrepairable));
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
    let code_bytes: [u8; 16] = {
        const ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
        let mut bits: u64 = 0;
        let mut nbits = 0u32;
        let mut out = Vec::new();
        for c in code.chars().filter(|c| *c != '-') {
            let v = ALPHABET
                .iter()
                .position(|a| *a as char == c)
                .expect("crockford char") as u64;
            bits = (bits << 5) | v;
            nbits += 5;
            if nbits >= 8 {
                nbits -= 8;
                out.push(((bits >> nbits) & 0xFF) as u8);
            }
        }
        out.try_into().expect("16 code bytes")
    };
    let opened = common::l1::key_backup::open(
        &blob,
        &common::l1::key_backup::RecoveryCode::from_bytes(code_bytes),
    )
    .expect("the printed code opens the blob");
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
    assert!(matches!(err, BootstrapError::Unrepairable));
}
