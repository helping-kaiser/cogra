//! Session and credential lifecycle branches (auth.md "Tokens",
//! "Sessions", "Credentials"): rotation, reuse detection, revocations,
//! password reset and change, the two-sided email change in both orders,
//! handle changes, and the key-backup roundtrip.

use chrono::{Duration, Utc};
use common::l1::client::ActorKey;
use postgres_store::auth::RevokedReason;
use postgres_store::{PgPool, auth as store};
use uuid::Uuid;

use api::auth::{self, AuthConfig, RefreshError};

async fn seed_user(pool: &PgPool, handle: &str, email: &str, password: &str) -> Uuid {
    let id = Uuid::new_v4();
    // A distinct key per actor — the actors table binds a key to at most
    // one account (auth.md §Application).
    let key = ActorKey::generate();
    let mut conn = pool.acquire().await.expect("conn");
    postgres_store::genesis::insert_actor(
        &mut conn,
        id,
        "user",
        handle,
        &key.public_key_bytes(),
        handle,
    )
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

/// Shifts a consumed row's rotation time behind the grace window, so a
/// replay reads as theft rather than the benign refresh race.
async fn backdate_rotation(pool: &PgPool, session_id: Uuid) {
    sqlx::query(
        "UPDATE auth_refresh_tokens
         SET revoked_at = revoked_at - INTERVAL '11 seconds' WHERE id = $1",
    )
    .bind(session_id)
    .execute(pool)
    .await
    .expect("backdate");
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

    // Replaying the consumed token past the grace window is reuse:
    // every session dies.
    let other = auth::issue_session(&pool, &cfg, user, Some("laptop"))
        .await
        .expect("issues");
    backdate_rotation(&pool, first.session_id).await;
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
async fn a_grace_window_replay_returns_the_same_successor(pool: PgPool) {
    let cfg = AuthConfig::ephemeral().expect("cfg");
    let user = seed_user(&pool, "alice", "a@example.com", "a strong password").await;

    let first = auth::issue_session(&pool, &cfg, user, Some("phone"))
        .await
        .expect("issues");
    let second = auth::refresh_session(&pool, &cfg, &first.refresh_token)
        .await
        .expect("rotates");

    // The immediate replay — the retry that lost its response — gets
    // the same successor back, not an error and not a fork.
    let replayed = auth::refresh_session(&pool, &cfg, &first.refresh_token)
        .await
        .expect("answers the replay");
    assert_eq!(replayed.session_id, second.session_id);
    assert_eq!(replayed.refresh_token, second.refresh_token);
    assert!(auth::verify_access_token(&cfg, &replayed.access_token).is_some());

    // No detection fired, and the successor still refreshes normally.
    assert!(
        store::take_reuse_detected(&pool, user)
            .await
            .expect("take")
            .is_none()
    );
    auth::refresh_session(&pool, &cfg, &second.refresh_token)
        .await
        .expect("successor rotates");
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_grace_replay_with_a_consumed_successor_is_theft(pool: PgPool) {
    let cfg = AuthConfig::ephemeral().expect("cfg");
    let user = seed_user(&pool, "alice", "a@example.com", "a strong password").await;

    let first = auth::issue_session(&pool, &cfg, user, None)
        .await
        .expect("issues");
    let second = auth::refresh_session(&pool, &cfg, &first.refresh_token)
        .await
        .expect("rotates");
    // The chain moved on: the successor was itself consumed, so the
    // idempotent answer no longer exists even inside the window.
    auth::refresh_session(&pool, &cfg, &second.refresh_token)
        .await
        .expect("successor rotates");
    assert!(matches!(
        auth::refresh_session(&pool, &cfg, &first.refresh_token).await,
        Err(RefreshError::Reuse)
    ));
    assert!(
        store::take_reuse_detected(&pool, user)
            .await
            .expect("take")
            .is_some()
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn concurrent_refreshes_of_one_token_converge_on_one_successor(pool: PgPool) {
    let cfg = AuthConfig::ephemeral().expect("cfg");
    let user = seed_user(&pool, "alice", "a@example.com", "a strong password").await;

    let first = auth::issue_session(&pool, &cfg, user, None)
        .await
        .expect("issues");
    // The double-fire race: whichever request loses the rotation must
    // still come back with the winner's successor, not an error.
    let (a, b) = tokio::join!(
        auth::refresh_session(&pool, &cfg, &first.refresh_token),
        auth::refresh_session(&pool, &cfg, &first.refresh_token),
    );
    let a = a.expect("one racer");
    let b = b.expect("other racer");
    assert_eq!(a.session_id, b.session_id);
    assert_eq!(a.refresh_token, b.refresh_token);
    assert!(
        store::take_reuse_detected(&pool, user)
            .await
            .expect("take")
            .is_none()
    );
    // Exactly one live session remains: the shared successor.
    let sessions = store::sessions_for(&pool, user).await.expect("list");
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].id, a.session_id);
}

#[sqlx::test(migrations = "../../migrations")]
async fn owner_and_security_revoked_tokens_replay_benignly(pool: PgPool) {
    let cfg = AuthConfig::ephemeral().expect("cfg");
    let user = seed_user(&pool, "alice", "a@example.com", "a strong password").await;

    // "Sign out everywhere else": the signed-out device's next launch
    // replays its revoked token — a benign, owner-initiated state.
    let signed_out = auth::issue_session(&pool, &cfg, user, Some("phone"))
        .await
        .expect("issues");
    let kept = auth::issue_session(&pool, &cfg, user, Some("laptop"))
        .await
        .expect("issues");
    store::revoke_sessions(&pool, user, Some(kept.session_id), RevokedReason::Owner)
        .await
        .expect("revokes others");
    assert!(matches!(
        auth::refresh_session(&pool, &cfg, &signed_out.refresh_token).await,
        Err(RefreshError::Invalid)
    ));
    // No alarm, no collateral: the kept session survives, unstamped.
    assert!(
        store::take_reuse_detected(&pool, user)
            .await
            .expect("take")
            .is_none()
    );
    let kept = auth::refresh_session(&pool, &cfg, &kept.refresh_token)
        .await
        .expect("kept session refreshes");

    // Security-initiated revocation (password change/reset) replays
    // just as benignly.
    store::revoke_sessions(&pool, user, None, RevokedReason::Security)
        .await
        .expect("revokes all");
    assert!(matches!(
        auth::refresh_session(&pool, &cfg, &kept.refresh_token).await,
        Err(RefreshError::Invalid)
    ));
    assert!(
        store::take_reuse_detected(&pool, user)
            .await
            .expect("take")
            .is_none()
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn reuse_detection_stamps_the_account_and_take_clears(pool: PgPool) {
    let cfg = AuthConfig::ephemeral().expect("cfg");
    let user = seed_user(&pool, "alice", "a@example.com", "a strong password").await;

    // No mark before any detection.
    assert!(
        store::take_reuse_detected(&pool, user)
            .await
            .expect("take")
            .is_none()
    );

    let first = auth::issue_session(&pool, &cfg, user, None)
        .await
        .expect("issues");
    auth::refresh_session(&pool, &cfg, &first.refresh_token)
        .await
        .expect("rotates");
    backdate_rotation(&pool, first.session_id).await;
    assert!(matches!(
        auth::refresh_session(&pool, &cfg, &first.refresh_token).await,
        Err(RefreshError::Reuse)
    ));

    // Detection stamped the account; the take returns and clears it.
    let taken = store::take_reuse_detected(&pool, user)
        .await
        .expect("take")
        .expect("mark");
    assert!(Utc::now() - taken < Duration::minutes(1));
    assert!(
        store::take_reuse_detected(&pool, user)
            .await
            .expect("take")
            .is_none()
    );

    // A later detection overwrites an undelivered mark with its own
    // time — the notice carries the latest incident.
    let stale = Utc::now() - Duration::days(3);
    sqlx::query("UPDATE user_credentials SET reuse_detected_at = $1 WHERE actor_id = $2")
        .bind(stale)
        .bind(user)
        .execute(&pool)
        .await
        .expect("seed stale mark");
    let second = auth::issue_session(&pool, &cfg, user, None)
        .await
        .expect("issues");
    auth::refresh_session(&pool, &cfg, &second.refresh_token)
        .await
        .expect("rotates");
    backdate_rotation(&pool, second.session_id).await;
    assert!(matches!(
        auth::refresh_session(&pool, &cfg, &second.refresh_token).await,
        Err(RefreshError::Reuse)
    ));
    let overwritten = store::take_reuse_detected(&pool, user)
        .await
        .expect("take")
        .expect("mark");
    assert!(overwritten > stale + Duration::days(1));
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
    let revoked = store::revoke_sessions(&pool, user, Some(kept.session_id), RevokedReason::Owner)
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
    store::revoke_sessions(&pool, user, None, RevokedReason::Security)
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
    assert_eq!(
        store::apply_email_change_if_complete(&pool, user)
            .await
            .expect("applies nothing"),
        store::EmailChangeApply::NotReady
    );
    let unchanged = store::credentials_by_actor(&pool, user)
        .await
        .expect("query")
        .expect("row");
    assert_eq!(unchanged.email, "old@example.com");

    // New side lands: the change applies. A wrong token matches nothing.
    assert!(
        !store::confirm_email_change_new_side(&pool, user, &auth::new_secret().hash)
            .await
            .expect("query")
    );
    assert!(
        store::confirm_email_change_new_side(&pool, user, &new_side.hash)
            .await
            .expect("marks")
    );
    assert_eq!(
        store::apply_email_change_if_complete(&pool, user)
            .await
            .expect("applies"),
        store::EmailChangeApply::Applied
    );
    let changed = store::credentials_by_actor(&pool, user)
        .await
        .expect("query")
        .expect("row");
    assert_eq!(changed.email, "new@example.com");
    // Idempotent: re-applying changes nothing further.
    assert_eq!(
        store::apply_email_change_if_complete(&pool, user)
            .await
            .expect("no-op"),
        store::EmailChangeApply::NotReady
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_new_side_token_is_scoped_to_its_account(pool: PgPool) {
    let owner = seed_user(&pool, "alice", "a@example.com", "a strong password").await;
    let intruder = seed_user(&pool, "mallory", "m@example.com", "a strong password").await;
    let new_side = auth::new_secret();
    store::create_email_change(
        &pool,
        Uuid::new_v4(),
        owner,
        "moved@example.com",
        &auth::new_secret().hash,
        &new_side.hash,
        Utc::now() + Duration::hours(1),
    )
    .await
    .expect("creates");

    // Another authenticated account presenting the owner's token matches
    // nothing — and does not consume the owner's proof.
    assert!(
        !store::confirm_email_change_new_side(&pool, intruder, &new_side.hash)
            .await
            .expect("query")
    );
    assert!(
        store::confirm_email_change_new_side(&pool, owner, &new_side.hash)
            .await
            .expect("marks")
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_proven_email_change_colliding_with_a_registered_address_reports_in_use(pool: PgPool) {
    let user = seed_user(&pool, "alice", "old@example.com", "a strong password").await;
    let original = auth::new_secret();
    let new_side = auth::new_secret();
    store::create_email_change(
        &pool,
        Uuid::new_v4(),
        user,
        "wanted@example.com",
        &original.hash,
        &new_side.hash,
        Utc::now() + Duration::hours(1),
    )
    .await
    .expect("creates");
    assert!(
        store::confirm_email_change_original_side(&pool, user, &original.hash)
            .await
            .expect("marks")
    );
    assert!(
        store::confirm_email_change_new_side(&pool, user, &new_side.hash)
            .await
            .expect("marks")
    );

    // The address got registered before the change completed.
    let squatter = seed_user(&pool, "bob", "wanted@example.com", "a strong password").await;
    assert_eq!(
        store::apply_email_change_if_complete(&pool, user)
            .await
            .expect("collides cleanly"),
        store::EmailChangeApply::EmailInUse
    );
    let unchanged = store::credentials_by_actor(&pool, user)
        .await
        .expect("query")
        .expect("row");
    assert_eq!(unchanged.email, "old@example.com");

    // The change row stays live: once the address frees up, a retry
    // within the TTL applies it.
    sqlx::query("UPDATE user_credentials SET email = 'elsewhere@example.com' WHERE actor_id = $1")
        .bind(squatter)
        .execute(&pool)
        .await
        .expect("frees");
    assert_eq!(
        store::apply_email_change_if_complete(&pool, user)
            .await
            .expect("applies"),
        store::EmailChangeApply::Applied
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
