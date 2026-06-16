//! Schema-level integration tests for the foundation migration.
//!
//! Each `#[sqlx::test]` runs in its own throwaway database created from
//! `DATABASE_URL`, with the workspace migrations applied — requires
//! Postgres to be running (`make up`).

use chrono::{Duration, Utc};
use common::{HASHTAG_NAMESPACE, hashtag_uuid};
use postgres_store::auth::{NewPendingRegistration, upsert_pending_registration};
use postgres_store::genesis::{
    insert_genesis_invitation, insert_genesis_profile, insert_genesis_user,
};
use sqlx::PgPool;
use uuid::Uuid;

/// Seeds a multi-use invitation row and returns its id — the FK every pending
/// registration needs.
async fn seed_invitation(pool: &PgPool) -> Uuid {
    let mut conn = pool.acquire().await.expect("connection");
    insert_genesis_invitation(
        &mut conn,
        Uuid::new_v4(),
        0.5,
        0.5,
        Utc::now() + Duration::days(7),
    )
    .await
    .expect("seed invitation")
}

/// A pending-registration payload bound to `email` and `invitation`, expiring
/// at `expires_at`. The verification-token hash is unique per call.
fn pending<'a>(
    email: &'a str,
    invitation: Uuid,
    token_hash: &'a [u8],
    expires_at: chrono::DateTime<Utc>,
) -> NewPendingRegistration<'a> {
    NewPendingRegistration {
        username: "pending-user",
        email,
        password_hash: "x",
        invitation_id: invitation,
        invitee_dim1: 0.5,
        invitee_dim2: 0.5,
        email_verification_token_hash: token_hash,
        expires_at,
    }
}

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
async fn hashtag_check_literal_namespace_matches_the_rust_constant(
    pool: PgPool,
) -> sqlx::Result<()> {
    // A *direct* cross-check on the literal itself, not the derivation: read
    // the CHECK constraint's source text and assert the namespace UUID baked
    // into it is exactly common::HASHTAG_NAMESPACE. Catches a divergence even
    // if `uuid_generate_v5` happened to agree on the one sampled name.
    let def: String = sqlx::query_scalar(
        "SELECT pg_get_constraintdef(oid)
         FROM pg_constraint
         WHERE conrelid = 'hashtags'::regclass AND contype = 'c'",
    )
    .fetch_one(&pool)
    .await?;
    assert!(
        def.contains(&HASHTAG_NAMESPACE.to_string()),
        "hashtags CHECK literal must equal HASHTAG_NAMESPACE; constraint def: {def}"
    );
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

#[sqlx::test(migrations = "../../migrations")]
async fn pending_registration_email_is_unique(pool: PgPool) -> sqlx::Result<()> {
    // The UNIQUE constraint (migration 20260616120000) is what lets the upsert
    // infer its arbiter index; a raw duplicate INSERT (bypassing ON CONFLICT)
    // proves the constraint itself is present.
    let invitation = seed_invitation(&pool).await;
    let email = "dup@cogra.test";
    let insert = |token: &'static [u8]| {
        sqlx::query(
            "INSERT INTO auth_pending_registrations
                 (username, email, password_hash, invitation_id, invitee_dim1,
                  invitee_dim2, email_verification_token_hash, expires_at)
             VALUES ('u', $1, 'x', $2, 0.5, 0.5, $3, NOW() + INTERVAL '1 day')",
        )
        .bind(email)
        .bind(invitation)
        .bind(token)
    };
    insert(b"hash-a").execute(&pool).await?;
    let dup = insert(b"hash-b").execute(&pool).await;
    let err = dup.expect_err("a second pending row for the same email must be rejected");
    assert!(
        err.to_string()
            .contains("auth_pending_registrations_email_key"),
        "{err}"
    );
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn upsert_overwrites_an_expired_row_but_no_ops_a_live_one(pool: PgPool) -> sqlx::Result<()> {
    let invitation = seed_invitation(&pool).await;
    let email = "collision@cogra.test";

    // A live row blocks the upsert: the WHERE expires_at < NOW() guard fails,
    // DO UPDATE never fires, and the call returns None ("in progress").
    let live_expiry = Utc::now() + Duration::hours(24);
    let first =
        upsert_pending_registration(&pool, pending(email, invitation, b"tok-1", live_expiry))
            .await?;
    assert!(first.is_some(), "fresh insert returns its expiry");
    let blocked =
        upsert_pending_registration(&pool, pending(email, invitation, b"tok-2", live_expiry))
            .await?;
    assert_eq!(blocked, None, "a live pending row blocks the upsert");

    // Expire the row, then the upsert overwrites it and returns the new expiry.
    sqlx::query("UPDATE auth_pending_registrations SET expires_at = NOW() - INTERVAL '1 hour' WHERE email = $1")
        .bind(email)
        .execute(&pool)
        .await?;
    let new_expiry = Utc::now() + Duration::hours(48);
    let overwritten =
        upsert_pending_registration(&pool, pending(email, invitation, b"tok-3", new_expiry))
            .await?;
    assert!(overwritten.is_some(), "an expired row is overwritten");

    // Exactly one row remains, carrying the overwriting token.
    let token: Vec<u8> = sqlx::query_scalar(
        "SELECT email_verification_token_hash FROM auth_pending_registrations WHERE email = $1",
    )
    .bind(email)
    .fetch_one(&pool)
    .await?;
    assert_eq!(token, b"tok-3", "the overwrite replaced the token hash");
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn invitation_dim_check_rejects_out_of_range(pool: PgPool) -> sqlx::Result<()> {
    // inviter_dim{1,2} BETWEEN -1.0 AND 1.0 — the edge-tensor range invariant,
    // enforced at the column. The genesis helper hardcodes 'user' for
    // inviter_type, so an out-of-range dim is the reachable rejection here.
    let mut conn = pool.acquire().await.expect("connection");
    let out_of_range = insert_genesis_invitation(
        &mut conn,
        Uuid::new_v4(),
        2.0,
        0.5,
        Utc::now() + Duration::days(1),
    )
    .await;
    let err = out_of_range.expect_err("dim1 = 2.0 must violate the BETWEEN check");
    assert!(err.to_string().contains("inviter_dim1"), "{err}");
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn invitation_type_check_rejects_unknown_kinds(pool: PgPool) -> sqlx::Result<()> {
    // inviter_type IN ('user', 'collective'); a raw INSERT exercises the arm
    // the genesis helper can't reach.
    let bad_type = sqlx::query(
        "INSERT INTO auth_invitations
             (inviter_id, inviter_type, inviter_dim1, inviter_dim2, expires_at)
         VALUES ($1, 'robot', 0.5, 0.5, NOW() + INTERVAL '1 day')",
    )
    .bind(Uuid::new_v4())
    .execute(&pool)
    .await;
    assert!(
        bad_type.is_err(),
        "inviter_type outside (user, collective) must be rejected"
    );
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn genesis_inserts_write_their_column_values(pool: PgPool) -> sqlx::Result<()> {
    // The three Postgres genesis writes (genesis.rs): the user credential row,
    // its first profile version, and the seeded multi-use invite link.
    let mut conn = pool.acquire().await.expect("connection");
    let user_id = Uuid::new_v4();
    insert_genesis_user(
        &mut conn,
        user_id,
        "genesis",
        "genesis@cogra.test",
        "phc-hash",
    )
    .await?;
    insert_genesis_profile(&mut conn, user_id, "genesis").await?;
    let expires = Utc::now() + Duration::days(30);
    let invite = insert_genesis_invitation(&mut conn, user_id, 0.5, 0.5, expires).await?;

    let (username, email): (String, String) =
        sqlx::query_as("SELECT username, email FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_one(&pool)
            .await?;
    assert_eq!(
        (username.as_str(), email.as_str()),
        ("genesis", "genesis@cogra.test")
    );

    let display_name: String =
        sqlx::query_scalar("SELECT display_name FROM user_profile_versions WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&pool)
            .await?;
    assert_eq!(
        display_name, "genesis",
        "profile display_name seeds to the handle"
    );

    // The invite link is multi-use (single_use = FALSE) and owned by the
    // genesis user with the default (+0.5, +0.5) inviter tensor.
    let (inviter_id, inviter_type, single_use, d1, d2): (Uuid, String, bool, f32, f32) =
        sqlx::query_as(
            "SELECT inviter_id, inviter_type, single_use, inviter_dim1, inviter_dim2
             FROM auth_invitations WHERE id = $1",
        )
        .bind(invite)
        .fetch_one(&pool)
        .await?;
    assert_eq!(inviter_id, user_id);
    assert_eq!(inviter_type, "user");
    assert!(!single_use, "the genesis invite is multi-use");
    assert_eq!((d1, d2), (0.5, 0.5));
    Ok(())
}

#[sqlx::test(migrations = "../../migrations")]
async fn genesis_user_insert_rejects_a_duplicate(pool: PgPool) -> sqlx::Result<()> {
    // The genesis user insert has no ON CONFLICT guard (unlike the request-path
    // insert_user), so a second call with the same email collides on the UNIQUE
    // constraint — the half-committed-bootstrap hazard PR 6 addresses.
    let mut conn = pool.acquire().await.expect("connection");
    insert_genesis_user(&mut conn, Uuid::new_v4(), "g1", "g@cogra.test", "x").await?;
    let dup = insert_genesis_user(&mut conn, Uuid::new_v4(), "g2", "g@cogra.test", "x").await;
    assert!(
        dup.expect_err("duplicate genesis email must be rejected")
            .to_string()
            .contains("users_email_key"),
        "expected a users.email unique violation"
    );
    Ok(())
}
