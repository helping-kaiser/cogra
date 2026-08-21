//! Profile display-content store tests (data-model.md "Actors"):
//! newest-wins version reads, the append-only insert, and the
//! one-namespace handle lookup. Requires Postgres (`make up`).

use postgres_store::{auth, genesis, profile};
use sqlx::PgPool;
use uuid::Uuid;

async fn seed_actor(pool: &PgPool, handle: &str) -> Uuid {
    let id = Uuid::new_v4();
    // The pubkey column is UNIQUE; any distinct bytes serve a store test.
    let mut pubkey = [0u8; 32];
    pubkey[..handle.len().min(32)].copy_from_slice(&handle.as_bytes()[..handle.len().min(32)]);
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(
        &mut conn,
        id,
        "user",
        handle,
        &pubkey,
        &format!("l0_{handle}"),
    )
    .await
    .expect("actor");
    genesis::insert_profile_version(&mut conn, id, handle, None)
        .await
        .expect("seed profile");
    id
}

#[sqlx::test(migrations = "../../migrations")]
async fn current_profile_serves_the_newest_version(pool: PgPool) {
    let actor = seed_actor(&pool, "ada").await;
    let first = profile::current_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("seeded");
    assert_eq!(first.display_name, "ada");
    assert_eq!(first.bio, None);

    let mut tx = pool.begin().await.expect("tx");
    profile::insert_profile_version(
        &mut tx,
        actor,
        "Ada L",
        Some("Curious."),
        None,
        None,
        Some("https://ada.example"),
    )
    .await
    .expect("inserts");
    tx.commit().await.expect("commits");

    let current = profile::current_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(current.display_name, "Ada L");
    assert_eq!(current.bio.as_deref(), Some("Curious."));
    assert_eq!(current.website_url.as_deref(), Some("https://ada.example"));
    assert!(current.created_at >= first.created_at);

    // Append-only: the older row survives underneath.
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM actor_profile_versions WHERE actor_id = $1")
            .bind(actor)
            .fetch_one(&pool)
            .await
            .expect("count");
    assert_eq!(count, 2);
}

/// Two version rows written in one transaction carry the same
/// `created_at` — `now()` is the transaction timestamp — so this is the
/// same-instant collision the monotonic key exists for, forced through
/// the real write path rather than simulated.
#[sqlx::test(migrations = "../../migrations")]
async fn same_instant_writes_both_land_and_the_later_one_is_current(pool: PgPool) {
    let actor = seed_actor(&pool, "ada").await;

    let mut tx = pool.begin().await.expect("tx");
    profile::insert_profile_version(&mut tx, actor, "First", None, None, None, None)
        .await
        .expect("first insert");
    profile::insert_profile_version(&mut tx, actor, "Second", None, None, None, None)
        .await
        .expect("second insert");
    tx.commit().await.expect("commits");

    let stamps: Vec<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
        "SELECT created_at FROM actor_profile_versions
         WHERE actor_id = $1 AND display_name IN ('First', 'Second')
         ORDER BY version_id",
    )
    .bind(actor)
    .fetch_all(&pool)
    .await
    .expect("stamps");
    assert_eq!(stamps.len(), 2, "both same-instant rows survive");
    assert_eq!(stamps[0], stamps[1], "the collision is real, not near-miss");

    let current = profile::current_profile(&pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(current.display_name, "Second", "the later write is current");
}

#[sqlx::test(migrations = "../../migrations")]
async fn current_profile_is_none_for_unknown_actor(pool: PgPool) {
    assert!(
        profile::current_profile(&pool, Uuid::new_v4())
            .await
            .expect("reads")
            .is_none()
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn handle_lookup_resolves_exactly_one_actor(pool: PgPool) {
    let ada = seed_actor(&pool, "ada").await;
    seed_actor(&pool, "adam").await;

    let found = auth::actor_identity_by_handle(&pool, "ada")
        .await
        .expect("reads")
        .expect("resolves");
    assert_eq!(found.id, ada);
    assert_eq!(found.kind, "user");

    assert!(
        auth::actor_identity_by_handle(&pool, "nobody")
            .await
            .expect("reads")
            .is_none()
    );
}
