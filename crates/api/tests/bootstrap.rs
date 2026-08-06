//! Genesis-bootstrap integration: the fresh run, the both-sides gate, the
//! idempotent re-run, the crash-repair path, and the unrepairable state
//! (architecture.md "Genesis bootstrap").

use api::bootstrap::{BootstrapError, BootstrapOutcome, GenesisInput, ensure_operator_login, run};
use common::l1::Family;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::genesis;
use postgres_store::mirror;
use sqlx::PgPool;

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

#[sqlx::test(migrations = "../../migrations")]
async fn fresh_bootstrap_creates_both_halves(pool: PgPool) {
    let host = standin(&pool);
    let outcome = run(&host, &pool, input()).await.expect("bootstraps");
    assert_eq!(outcome, BootstrapOutcome::Fresh);

    // L2 half: cast rows, reserved Types, the parameter carrier.
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

    // L1 half: the genesis records landed as the instance's first accepted
    // acts — 4 Registrations, 2 endorsement Opinions, The Charter, the
    // genesis role Tag.
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

    // The first record is the Genesis Moderator's Registration.
    assert_eq!(ids[0], format!("act:{operator_address}:0:registration"));
}

#[sqlx::test(migrations = "../../migrations")]
async fn rerun_is_idempotent(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("first run");
    let outcome = run(&host, &pool, input()).await.expect("second run");
    assert_eq!(outcome, BootstrapOutcome::AlreadyComplete);
    // Nothing new landed: still exactly one epoch of eight records.
    assert_eq!(mirror::last_ingested_epoch(&pool).await.expect("cursor"), 0);
    assert_eq!(
        mirror::record_ids_in_epoch(&pool, 0)
            .await
            .expect("ids")
            .len(),
        8
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn crash_before_the_l1_half_is_repaired(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("first run");

    // Simulate the crash window: the L2 half committed, the L1 half never
    // happened (wipe the substrate and the mirror projection of it).
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

    // The re-run completes the missing half keyed on the stored identities.
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

#[sqlx::test(migrations = "../../migrations")]
async fn missing_l2_half_with_l1_records_is_unrepairable(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("first run");

    // Wipe the L2 half (keys included) while the L1 records stand.
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

#[sqlx::test(migrations = "../../migrations")]
async fn the_operator_login_completes_the_genesis_account(pool: PgPool) {
    let host = standin(&pool);
    run(&host, &pool, input()).await.expect("bootstraps");

    let login = ensure_operator_login(&pool, "operator", "op@example.com", "a strong password")
        .await
        .expect("operator login");
    assert!(login.credentials_created);
    let code = login.recovery_code.expect("a fresh code on first run");

    // The credentials verify like any login.
    let credentials = postgres_store::auth::credentials_by_email(&pool, "op@example.com")
        .await
        .expect("query")
        .expect("credentials row");
    assert!(api::auth::verify_password(
        &credentials.password_hash,
        "a strong password"
    ));

    // The uploaded blob is a standard key-backup blob: the printed code
    // opens it, and inside is the custodied genesis seed.
    let blob = postgres_store::auth::latest_key_backup(&pool, credentials.actor_id)
        .await
        .expect("query")
        .expect("blob row");
    let code_bytes: [u8; 16] = {
        // Re-parse the display form the way a client would: strip the
        // separators and decode Crockford base32.
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

    // Re-running mints nothing new: credentials stand, the blob stands,
    // no second code is printed.
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

#[sqlx::test(migrations = "../../migrations")]
async fn the_operator_login_requires_a_bootstrapped_instance(pool: PgPool) {
    let err = ensure_operator_login(&pool, "operator", "op@example.com", "pw pw pw pw")
        .await
        .expect_err("no genesis actor yet");
    assert!(matches!(err, BootstrapError::Unrepairable));
}
