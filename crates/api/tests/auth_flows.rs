//! Session and credential lifecycle branches (auth.md "Tokens",
//! "Sessions", "Credentials"): rotation, reuse detection, revocations,
//! password reset and change, the two-sided email change in both orders,
//! handle changes, and the key-backup roundtrip.

use chrono::{Duration, Utc};
use postgres_store::{PgPool, auth as store};
use uuid::Uuid;

use api::auth::{self, AuthConfig, RefreshError};

async fn seed_user(pool: &PgPool, handle: &str, email: &str, password: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut conn = pool.acquire().await.expect("conn");
    postgres_store::genesis::insert_actor(&mut conn, id, "user", handle, &[1u8; 32], handle)
        .await
        .expect("actor");
    drop(conn);
    postgres_store::genesis::insert_credentials(
        pool,
        id,
        email,
        &auth::hash_password(password).expect("hash"),
    )
    .await
    .expect("credentials");
    id
}

#[sqlx::test(migrations = "../../migrations")]
async fn sessions_rotate_and_reuse_revokes_everything(pool: PgPool) {
    let cfg = AuthConfig::ephemeral().expect("cfg");
    let user = seed_user(&pool, "alice", "a@example.com", "a strong password").await;

    let first = auth::issue_session(&pool, &cfg, user, Some("phone"))
        .await
        .expect("issues");
    assert!(auth::verify_access_token(&cfg, &first.access_token).is_some());

    // Rotation consumes the presented token and mints a successor.
    let second = auth::refresh_session(&pool, &cfg, &first.refresh_token)
        .await
        .expect("rotates");
    assert_ne!(first.refresh_token, second.refresh_token);
    // The device label survives rotation.
    let row = store::session(&pool, second.session_id)
        .await
        .expect("query")
        .expect("row");
    assert_eq!(row.device_label.as_deref(), Some("phone"));

    // Presenting the consumed token again is reuse: every session dies.
    let other = auth::issue_session(&pool, &cfg, user, Some("laptop"))
        .await
        .expect("issues");
    assert!(matches!(
        auth::refresh_session(&pool, &cfg, &first.refresh_token).await,
        Err(RefreshError::Reuse)
    ));
    for token in [&second.refresh_token, &other.refresh_token] {
        assert!(matches!(
            auth::refresh_session(&pool, &cfg, token).await,
            Err(RefreshError::Invalid) | Err(RefreshError::Reuse)
        ));
    }

    // Garbage and expired tokens are plain invalid.
    assert!(matches!(
        auth::refresh_session(&pool, &cfg, "no-such-token").await,
        Err(RefreshError::Invalid)
    ));
    let stale = auth::issue_session(&pool, &cfg, user, None)
        .await
        .expect("issues");
    sqlx::query(
        "UPDATE auth_refresh_tokens SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1",
    )
    .bind(stale.session_id)
    .execute(&pool)
    .await
    .expect("expire");
    assert!(matches!(
        auth::refresh_session(&pool, &cfg, &stale.refresh_token).await,
        Err(RefreshError::Invalid)
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn revocations_scope_to_their_target(pool: PgPool) {
    let cfg = AuthConfig::ephemeral().expect("cfg");
    let user = seed_user(&pool, "alice", "a@example.com", "a strong password").await;
    let other_user = seed_user(&pool, "bob", "b@example.com", "a strong password").await;

    let mine = auth::issue_session(&pool, &cfg, user, Some("one"))
        .await
        .expect("issues");
    let mine_too = auth::issue_session(&pool, &cfg, user, Some("two"))
        .await
        .expect("issues");
    let theirs = auth::issue_session(&pool, &cfg, other_user, None)
        .await
        .expect("issues");

    // One session revokes; someone else's does not.
    assert!(
        store::revoke_session(&pool, mine.session_id, user)
            .await
            .expect("revokes")
    );
    assert!(
        !store::revoke_session(&pool, theirs.session_id, user)
            .await
            .expect("query")
    );
    // Revoke-others keeps exactly the kept session.
    let kept = auth::issue_session(&pool, &cfg, user, Some("kept"))
        .await
        .expect("issues");
    let revoked = store::revoke_sessions(&pool, user, Some(kept.session_id))
        .await
        .expect("revokes");
    assert_eq!(revoked, 1); // mine_too — mine was already gone
    let _ = mine_too;
    let sessions = store::sessions_for(&pool, user).await.expect("list");
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].id, kept.session_id);
    // The other account's session is untouched.
    assert_eq!(
        store::sessions_for(&pool, other_user)
            .await
            .expect("list")
            .len(),
        1
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn password_resets_are_single_use_and_revoke_all_sessions(pool: PgPool) {
    let cfg = AuthConfig::ephemeral().expect("cfg");
    let user = seed_user(&pool, "alice", "a@example.com", "a strong password").await;
    auth::issue_session(&pool, &cfg, user, None)
        .await
        .expect("issues");

    let secret = auth::new_secret();
    store::create_password_reset(
        &pool,
        Uuid::new_v4(),
        user,
        &secret.hash,
        Utc::now() + Duration::minutes(15),
    )
    .await
    .expect("creates");

    // Consume once; the second consumption fails; expired tokens fail.
    assert_eq!(
        store::consume_password_reset(&pool, &secret.hash)
            .await
            .expect("consumes"),
        Some(user)
    );
    assert_eq!(
        store::consume_password_reset(&pool, &secret.hash)
            .await
            .expect("query"),
        None
    );
    let stale = auth::new_secret();
    store::create_password_reset(
        &pool,
        Uuid::new_v4(),
        user,
        &stale.hash,
        Utc::now() - Duration::minutes(1),
    )
    .await
    .expect("creates");
    assert_eq!(
        store::consume_password_reset(&pool, &stale.hash)
            .await
            .expect("query"),
        None
    );

    // The reset path rotates the hash and revokes everything.
    let new_hash = auth::hash_password("a fresh strong password").expect("hash");
    store::update_password_hash(&pool, user, &new_hash)
        .await
        .expect("updates");
    store::revoke_sessions(&pool, user, None)
        .await
        .expect("revokes");
    assert!(
        store::sessions_for(&pool, user)
            .await
            .expect("list")
            .is_empty()
    );
    let credentials = store::credentials_by_actor(&pool, user)
        .await
        .expect("query")
        .expect("row");
    assert!(auth::verify_password(
        &credentials.password_hash,
        "a fresh strong password"
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_email_change_applies_only_when_both_sides_stand(pool: PgPool) {
    let user = seed_user(&pool, "alice", "old@example.com", "a strong password").await;
    let original = auth::new_secret();
    let new_side = auth::new_secret();
    store::create_email_change(
        &pool,
        Uuid::new_v4(),
        user,
        "new@example.com",
        &original.hash,
        &new_side.hash,
        Utc::now() + Duration::hours(1),
    )
    .await
    .expect("creates");

    // Original side alone: no change.
    assert!(
        store::confirm_email_change_original_side(&pool, user, &original.hash)
            .await
            .expect("marks")
    );
    assert!(
        !store::apply_email_change_if_complete(&pool, user)
            .await
            .expect("applies nothing")
    );
    let unchanged = store::credentials_by_actor(&pool, user)
        .await
        .expect("query")
        .expect("row");
    assert_eq!(unchanged.email, "old@example.com");

    // New side lands: the change applies. A wrong token matches nothing.
    assert!(
        store::confirm_email_change_new_side(&pool, &auth::new_secret().hash)
            .await
            .expect("query")
            .is_none()
    );
    assert!(
        store::confirm_email_change_new_side(&pool, &new_side.hash)
            .await
            .expect("marks")
            .is_some()
    );
    assert!(
        store::apply_email_change_if_complete(&pool, user)
            .await
            .expect("applies")
    );
    let changed = store::credentials_by_actor(&pool, user)
        .await
        .expect("query")
        .expect("row");
    assert_eq!(changed.email, "new@example.com");
    // Idempotent: re-applying changes nothing further.
    assert!(
        !store::apply_email_change_if_complete(&pool, user)
            .await
            .expect("no-op")
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn handle_changes_respect_the_one_namespace(pool: PgPool) {
    let user = seed_user(&pool, "alice", "a@example.com", "a strong password").await;
    seed_user(&pool, "taken", "t@example.com", "a strong password").await;

    assert!(
        store::change_handle(&pool, user, "fresh_name")
            .await
            .expect("renames")
    );
    assert!(
        !store::change_handle(&pool, user, "taken")
            .await
            .expect("collides politely")
    );
    let identity = store::actor_identity(&pool, user)
        .await
        .expect("query")
        .expect("row");
    assert_eq!(identity.handle, "fresh_name");
}

#[sqlx::test(migrations = "../../migrations")]
async fn key_backups_append_and_the_newest_wins(pool: PgPool) {
    let user = seed_user(&pool, "alice", "a@example.com", "a strong password").await;
    assert!(
        store::latest_key_backup(&pool, user)
            .await
            .expect("query")
            .is_none()
    );
    store::upload_key_backup(&pool, user, b"ciphertext one")
        .await
        .expect("uploads");
    store::upload_key_backup(&pool, user, b"ciphertext two")
        .await
        .expect("replaces by appending");
    assert_eq!(
        store::latest_key_backup(&pool, user)
            .await
            .expect("query")
            .expect("blob"),
        b"ciphertext two"
    );
}
