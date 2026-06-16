//! Schema-level integration tests for the foundation migration.
//!
//! Each `#[sqlx::test]` runs in its own throwaway database created from
//! `DATABASE_URL`, with the workspace migrations applied — requires
//! Postgres to be running (`make up`).

use common::{HASHTAG_NAMESPACE, hashtag_uuid};
use sqlx::PgPool;
use uuid::Uuid;

#[sqlx::test(migrations = "../../migrations")]
async fn hashtag_check_accepts_the_rust_derivation(pool: PgPool) -> sqlx::Result<()> {
    // The load-bearing cross-check: the namespace literal in the migration's
    // CHECK constraint and common::HASHTAG_NAMESPACE must derive identical
    // UUIDs, or content-addressing breaks across the Rust/SQL boundary.
    let id = hashtag_uuid("bot-defense");
    sqlx::query("INSERT INTO hashtags (id, name) VALUES ($1, $2)")
        .bind(id)
        .bind("bot-defense")
        .execute(&pool)
        .await?;

    let db_derived: Uuid = sqlx::query_scalar("SELECT uuid_generate_v5($1::uuid, 'bot-defense')")
        .bind(HASHTAG_NAMESPACE)
        .fetch_one(&pool)
        .await?;
    assert_eq!(id, db_derived);
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn hashtag_check_rejects_a_non_derived_uuid(pool: PgPool) {
    let result = sqlx::query("INSERT INTO hashtags (id, name) VALUES ($1, $2)")
        .bind(Uuid::new_v4())
        .bind("bot-defense")
        .execute(&pool)
        .await;
    let err = result.expect_err("random id must violate the derivation CHECK");
    assert!(err.to_string().contains("hashtags_check"), "{err}");
}

#[sqlx::test(migrations = "../../migrations")]
async fn current_version_is_the_newest_row(pool: PgPool) -> sqlx::Result<()> {
    // The display-content versioning shape: entity row + append-only
    // version rows; the rendered value is ORDER BY created_at DESC LIMIT 1.
    let post_id = Uuid::new_v4();
    sqlx::query("INSERT INTO posts (id, author_id, author_type) VALUES ($1, $2, 'user')")
        .bind(post_id)
        .bind(Uuid::new_v4())
        .execute(&pool)
        .await?;
    sqlx::query(
        "INSERT INTO post_versions (post_id, content, created_at)
         VALUES ($1, 'first', NOW() - INTERVAL '1 minute'), ($1, 'edited', NOW())",
    )
    .bind(post_id)
    .execute(&pool)
    .await?;

    let current: String = sqlx::query_scalar(
        "SELECT content FROM post_versions
         WHERE post_id = $1 ORDER BY created_at DESC LIMIT 1",
    )
    .bind(post_id)
    .fetch_one(&pool)
    .await?;
    assert_eq!(current, "edited");
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn author_type_is_constrained_to_actor_kinds(pool: PgPool) {
    let result =
        sqlx::query("INSERT INTO posts (id, author_id, author_type) VALUES ($1, $2, 'robot')")
            .bind(Uuid::new_v4())
            .bind(Uuid::new_v4())
            .execute(&pool)
            .await;
    assert!(
        result.is_err(),
        "author_type outside (user, collective) must be rejected"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn encrypted_message_versions_require_an_epoch(pool: PgPool) -> sqlx::Result<()> {
    let chat_id = Uuid::new_v4();
    let msg_id = Uuid::new_v4();
    sqlx::query("INSERT INTO chats (id) VALUES ($1)")
        .bind(chat_id)
        .execute(&pool)
        .await?;
    sqlx::query(
        "INSERT INTO chat_messages (id, chat_id, author_id, author_type)
         VALUES ($1, $2, $3, 'user')",
    )
    .bind(msg_id)
    .bind(chat_id)
    .bind(Uuid::new_v4())
    .execute(&pool)
    .await?;

    // Encrypted without epoch: rejected by the consistency CHECK.
    let missing_epoch = sqlx::query(
        "INSERT INTO chat_message_versions (chat_message_id, content, content_privacy)
         VALUES ($1, 'ciphertext', 'encrypted')",
    )
    .bind(msg_id)
    .execute(&pool)
    .await;
    assert!(
        missing_epoch.is_err(),
        "encrypted version without epoch must be rejected"
    );

    // Plaintext with epoch: also rejected.
    let stray_epoch = sqlx::query(
        "INSERT INTO chat_message_versions (chat_message_id, content, epoch)
         VALUES ($1, 'hello', 1)",
    )
    .bind(msg_id)
    .execute(&pool)
    .await;
    assert!(
        stray_epoch.is_err(),
        "plaintext version with epoch must be rejected"
    );

    // The two legal shapes.
    sqlx::query(
        "INSERT INTO chat_message_versions (chat_message_id, content)
         VALUES ($1, 'hello')",
    )
    .bind(msg_id)
    .execute(&pool)
    .await?;
    sqlx::query(
        "INSERT INTO chat_message_versions (chat_message_id, content, content_privacy, epoch, created_at)
         VALUES ($1, 'ciphertext', 'encrypted', 1, NOW() + INTERVAL '1 second')",
    )
    .bind(msg_id)
    .execute(&pool)
    .await?;
    Ok(())
}
