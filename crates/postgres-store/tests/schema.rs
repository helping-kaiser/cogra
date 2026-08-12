//! Schema-level integration tests for the foundation migration. Each
//! `#[sqlx::test]` runs in its own throwaway database created from
//! `DATABASE_URL`, with the workspace migrations applied — requires
//! Postgres to be running (`make up`).

use common::hashtag_uuid;
use postgres_store::genesis::{self, RESERVED_TYPES};
use sqlx::PgPool;
use uuid::Uuid;

#[sqlx::test(migrations = "../../migrations")]
async fn hashtag_ids_are_content_addressed(pool: PgPool) {
    let mut conn = pool.acquire().await.expect("conn");
    for name in RESERVED_TYPES {
        genesis::seed_reserved_type(&mut conn, name)
            .await
            .expect("seeds");
    }
    // Re-seeding is idempotent.
    genesis::seed_reserved_type(&mut conn, "bot-defense")
        .await
        .expect("idempotent");
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM hashtags")
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(count, RESERVED_TYPES.len() as i64);

    // The CHECK constraint enforces the derivation: a random id for a name
    // is rejected even by a buggy writer.
    let err = sqlx::query("INSERT INTO hashtags (id, name) VALUES ($1, $2)")
        .bind(Uuid::new_v4())
        .bind("rogue")
        .execute(&pool)
        .await;
    assert!(
        err.is_err(),
        "non-derived hashtag id must violate the CHECK"
    );

    // And the Rust derivation matches the SQL derivation.
    let stored: Uuid = sqlx::query_scalar("SELECT id FROM hashtags WHERE name = 'bot-defense'")
        .fetch_one(&pool)
        .await
        .expect("row");
    assert_eq!(stored, hashtag_uuid("bot-defense"));
}

#[sqlx::test(migrations = "../../migrations")]
async fn handles_share_one_namespace_across_kinds(pool: PgPool) {
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(&mut conn, Uuid::new_v4(), "user", "alice", b"key1", "addr1")
        .await
        .expect("user row");
    // A collective claiming the same handle collides — one namespace, a
    // mention resolves to exactly one actor (data-model.md "Actors").
    let clash = genesis::insert_actor(
        &mut conn,
        Uuid::new_v4(),
        "collective",
        "alice",
        b"key2",
        "addr2",
    )
    .await;
    assert!(clash.is_err());

    // Unknown kinds are rejected by the CHECK.
    let bad_kind =
        genesis::insert_actor(&mut conn, Uuid::new_v4(), "robot", "bob", b"key3", "addr3").await;
    assert!(bad_kind.is_err());
}

#[sqlx::test(migrations = "../../migrations")]
async fn genesis_seed_round_trips(pool: PgPool) {
    assert!(!genesis::system_actors_present(&pool).await.expect("gate"));
    let mut tx = pool.begin().await.expect("tx");
    for handle in [
        genesis::PUBLISHER_HANDLE,
        genesis::MODERATOR_HANDLE,
        genesis::TREASURY_HANDLE,
    ] {
        let id = Uuid::new_v4();
        // Distinct per actor (data-model.md "Actors"), as the real
        // bootstrap does.
        let pk = format!("pk-{handle}");
        let addr = format!("addr-{handle}");
        genesis::insert_actor(&mut tx, id, "system", handle, pk.as_bytes(), &addr)
            .await
            .expect("actor");
        genesis::insert_profile_version(&mut tx, id, handle, None)
            .await
            .expect("profile");
        genesis::insert_system_key(&mut tx, id, &[7u8; 32])
            .await
            .expect("key");
    }
    tx.commit().await.expect("commit");
    assert!(genesis::system_actors_present(&pool).await.expect("gate"));

    let publisher = genesis::actor_by_handle(&pool, genesis::PUBLISHER_HANDLE)
        .await
        .expect("query")
        .expect("row");
    assert_eq!(publisher.kind, "system");
    let seed = genesis::system_key(&pool, publisher.id)
        .await
        .expect("query")
        .expect("custodied seed");
    assert_eq!(seed, vec![7u8; 32]);
    assert!(
        genesis::actor_by_handle(&pool, "nobody")
            .await
            .expect("query")
            .is_none()
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn parameter_carrier_versions_append(pool: PgPool) {
    assert!(!genesis::parameters_seeded(&pool).await.expect("check"));
    let mut conn = pool.acquire().await.expect("conn");
    genesis::seed_parameter(&mut conn, "gamma", &serde_json::json!(1.0))
        .await
        .expect("seed");
    assert!(genesis::parameters_seeded(&pool).await.expect("check"));
    // Layered properties: a later value appends, never overwrites.
    genesis::seed_parameter(&mut conn, "gamma", &serde_json::json!(0.9))
        .await
        .expect("append");
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM network_parameter_versions WHERE parameter = 'gamma'",
    )
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(count, 2);
}
