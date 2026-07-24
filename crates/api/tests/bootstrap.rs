//! Genesis-bootstrap integration: the fresh run, the both-sides gate, the
//! idempotent re-run, the crash-repair path, and the unrepairable state
//! (architecture.md "Genesis bootstrap").

use api::bootstrap::{BootstrapError, BootstrapOutcome, GenesisInput, run};
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
    let publisher = genesis::actor_by_handle(&pool, genesis::PUBLISHER_HANDLE)
        .await
        .expect("query")
        .expect("publisher row");
    for family in [Family::Publish, Family::Tag] {
        assert!(
            mirror::has_record_by(&pool, &publisher.l0_address, family)
                .await
                .expect("gate"),
            "publisher's {family} record must be in the mirror"
        );
    }
    assert!(
        mirror::has_record_by(&pool, &operator.l0_address, Family::Registration)
            .await
            .expect("gate")
    );

    // The first record is the Genesis Moderator's Registration.
    assert_eq!(
        ids[0],
        format!("act:{}:0:registration", operator.l0_address)
    );
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
    let publisher = genesis::actor_by_handle(&pool, genesis::PUBLISHER_HANDLE)
        .await
        .expect("query")
        .expect("row");
    assert!(
        mirror::has_record_by(&pool, &publisher.l0_address, Family::Publish)
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
