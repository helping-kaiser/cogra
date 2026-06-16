//! `find_user_by_id` reads — the Postgres half of a `User`. Each
//! `#[sqlx::test]` runs in its own throwaway database with the workspace
//! migrations applied; requires Postgres (`make up`).

use postgres_store::users::find_user_by_id;
use sqlx::PgPool;
use uuid::Uuid;

/// Inserts a bare account row (no profile version yet).
async fn insert_user(pool: &PgPool, id: Uuid, username: &str) -> sqlx::Result<()> {
    sqlx::query("INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, 'x')")
        .bind(id)
        .bind(username)
        .bind(format!("{username}@cogra.test"))
        .execute(pool)
        .await
        .map(|_| ())
}

#[sqlx::test(migrations = "../../migrations")]
async fn returns_the_newest_profile_version(pool: PgPool) -> sqlx::Result<()> {
    // The "current value is ORDER BY created_at DESC LIMIT 1" shape: two
    // versions, the read renders the newest.
    let id = Uuid::new_v4();
    insert_user(&pool, id, "multi").await?;
    sqlx::query(
        "INSERT INTO user_profile_versions (user_id, display_name, bio, website_url, created_at)
         VALUES ($1, 'Old Name', 'old bio', NULL, NOW() - INTERVAL '1 minute'),
                ($1, 'New Name', 'new bio', 'https://example.test', NOW())",
    )
    .bind(id)
    .execute(&pool)
    .await?;

    let user = find_user_by_id(&pool, id).await?.expect("user exists");
    assert_eq!(user.display_name, "New Name");
    assert_eq!(user.bio.as_deref(), Some("new bio"));
    assert_eq!(user.website_url.as_deref(), Some("https://example.test"));
    // `updated_at` is the newest version's timestamp; `created_at` is the
    // account's, so the account predates its latest edit.
    assert!(user.updated_at >= user.created_at);
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn returns_the_redacted_version_unfiltered(pool: PgPool) -> sqlx::Result<()> {
    // `find_user_by_id` is redaction-agnostic: it renders the newest version
    // whether or not `redaction_reason` is set. Honoring redaction (masking the
    // value, surfacing the mark) is the resolver's job, not this read's — so a
    // redacted newest version still comes back with its stored content.
    let id = Uuid::new_v4();
    insert_user(&pool, id, "redacted").await?;
    sqlx::query(
        "INSERT INTO user_profile_versions (user_id, display_name, bio, redaction_reason)
         VALUES ($1, 'Visible', 'redacted bio', 'policy violation')",
    )
    .bind(id)
    .execute(&pool)
    .await?;

    let user = find_user_by_id(&pool, id).await?.expect("user exists");
    assert_eq!(user.display_name, "Visible");
    assert_eq!(user.bio.as_deref(), Some("redacted bio"));
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_user_with_no_profile_version_reads_as_none(pool: PgPool) -> sqlx::Result<()> {
    // Intended: the `JOIN LATERAL … ON TRUE` is an inner join, so an account
    // with zero profile versions yields no row — the read returns `None`, not a
    // half-populated record. Registration always writes the first version in
    // the same transaction as the account, so this state is transient/illegal
    // in practice; the read failing closed is the correct shape.
    let id = Uuid::new_v4();
    insert_user(&pool, id, "profileless").await?;

    assert!(find_user_by_id(&pool, id).await?.is_none());
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_unknown_id_reads_as_none(pool: PgPool) -> sqlx::Result<()> {
    assert!(find_user_by_id(&pool, Uuid::new_v4()).await?.is_none());
    Ok(())
}
