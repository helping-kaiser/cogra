//! Integration tests for the genesis Postgres reads that back the both-stores
//! bootstrap gate: `genesis_present`, `genesis_invitation_id`, and the
//! `ON CONFLICT` idempotency of the genesis `users` insert.
//!
//! Each `#[sqlx::test]` runs in its own throwaway database with the workspace
//! migrations applied — requires Postgres to be running (`make up`).

use chrono::{Duration, Utc};
use postgres_store::genesis::{
    genesis_invitation_id, genesis_present, insert_genesis_invitation, insert_genesis_profile,
    insert_genesis_user,
};
use sqlx::PgPool;
use uuid::Uuid;

#[sqlx::test(migrations = "../../migrations")]
async fn genesis_present_flips_on_the_users_row(pool: PgPool) -> sqlx::Result<()> {
    let user_id = Uuid::new_v4();

    // The Postgres half of the gate: false until the genesis row lands.
    assert!(
        !genesis_present(&pool, user_id).await?,
        "absent before insert"
    );

    let mut conn = pool.acquire().await?;
    insert_genesis_user(&mut conn, user_id, "genesis", "genesis@cogra.local", "hash").await?;

    assert!(
        genesis_present(&pool, user_id).await?,
        "present after insert"
    );
    // Keyed on the id — an unrelated id stays absent.
    assert!(
        !genesis_present(&pool, Uuid::new_v4()).await?,
        "a different id is not the genesis row"
    );
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn insert_genesis_user_is_idempotent_on_conflict(pool: PgPool) -> sqlx::Result<()> {
    let user_id = Uuid::new_v4();
    let mut conn = pool.acquire().await?;

    insert_genesis_user(
        &mut conn,
        user_id,
        "genesis",
        "genesis@cogra.local",
        "first-hash",
    )
    .await?;
    // A second write with the same id is a no-op, not a primary-key error — and
    // it must not overwrite the committed row.
    insert_genesis_user(
        &mut conn,
        user_id,
        "genesis",
        "genesis@cogra.local",
        "second-hash",
    )
    .await?;

    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&pool)
        .await?;
    assert_eq!(count, 1, "exactly one row after the conflicting re-insert");
    let stored: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&pool)
        .await?;
    assert_eq!(stored, "first-hash", "the original row is untouched");
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn genesis_invitation_id_returns_the_earliest_owned(pool: PgPool) -> sqlx::Result<()> {
    let inviter_id = Uuid::new_v4();

    assert!(
        genesis_invitation_id(&pool, inviter_id).await?.is_none(),
        "no invitation yet"
    );

    let mut conn = pool.acquire().await?;
    let first = insert_genesis_invitation(
        &mut conn,
        inviter_id,
        0.5,
        0.5,
        Utc::now() + Duration::days(365),
    )
    .await?;

    // A later second invitation for the same inviter — backdating `first` here
    // would be circular, so we forward-date this one to pin the ordering.
    sqlx::query(
        "INSERT INTO auth_invitations
             (inviter_id, inviter_type, inviter_dim1, inviter_dim2, single_use, expires_at, created_at)
         VALUES ($1, 'user', 0.5, 0.5, FALSE, $2, NOW() + INTERVAL '1 hour')",
    )
    .bind(inviter_id)
    .bind(Utc::now() + Duration::days(365))
    .execute(&pool)
    .await?;

    assert_eq!(
        genesis_invitation_id(&pool, inviter_id).await?,
        Some(first),
        "the earliest invitation is the genesis link"
    );
    // Scoped to the inviter — a different owner sees none.
    assert!(
        genesis_invitation_id(&pool, Uuid::new_v4())
            .await?
            .is_none(),
        "another inviter owns no genesis link"
    );
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn genesis_profile_rides_the_users_row(pool: PgPool) -> sqlx::Result<()> {
    // The profile FKs to users, so the gate's single-run guarantee is what keeps
    // it from duplicating — this pins that the row writes against a present user.
    let user_id = Uuid::new_v4();
    let mut conn = pool.acquire().await?;
    insert_genesis_user(&mut conn, user_id, "genesis", "genesis@cogra.local", "hash").await?;
    insert_genesis_profile(&mut conn, user_id, "genesis").await?;

    let display: String =
        sqlx::query_scalar("SELECT display_name FROM user_profile_versions WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&pool)
            .await?;
    assert_eq!(display, "genesis");
    Ok(())
}
