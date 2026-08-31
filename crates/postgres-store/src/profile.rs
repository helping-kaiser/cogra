//! ´mod:module:profile´
//!
//! Actor profile display content (data-model.md "Actors"): append-only
//! version rows over `actor_profile_versions`, newest row wins.
//!
//! Reads serve the profile surface; the write is confirm-side promotion of
//! a landed parallel Registration (user.md §4) — the version row appears in
//! the same flow as the record that witnesses it, and carries that record's
//! landing coordinates, which are what decide between versions.

use crate::content::LandingOrder;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

/// One profile version row — the newest is the profile
/// (data-model.md "Display-content versioning").
#[derive(Debug, Clone)]
pub struct ProfileVersion {
    pub display_name: String,
    pub bio: Option<String>,
    pub avatar_id: Option<Uuid>,
    pub website_url: Option<String>,
    pub redaction_reason: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// The actor's current profile — the version whose record landed last,
/// `created_at` then `version_id` deciding only where no record does (the
/// registration seed, and rows written before the coordinates existed);
/// None for an actor that never got one (impossible for registered users,
/// who are seeded at registration).
pub async fn current_profile(
    pool: &PgPool,
    actor_id: Uuid,
) -> Result<Option<ProfileVersion>, sqlx::Error> {
    sqlx::query_as!(
        ProfileVersion,
        "SELECT display_name, bio, avatar_id, website_url,
                redaction_reason, created_at
         FROM actor_profile_versions
         WHERE actor_id = $1
         ORDER BY landed_epoch DESC NULLS LAST,
                  act_time DESC NULLS LAST,
                  position DESC NULLS LAST,
                  created_at DESC, version_id DESC
         LIMIT 1",
        actor_id,
    )
    .fetch_optional(pool)
    .await
}

/// Appends a profile version row — promotion of a landed profile
/// update, full merged field set (an edit's unchanged fields are copied
/// forward by the caller, mirroring the content promotions). `order` is
/// the promoting record's landing coordinates, which order this version
/// against the others.
#[allow(clippy::too_many_arguments)]
pub async fn insert_profile_version(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    display_name: &str,
    bio: Option<&str>,
    avatar_id: Option<Uuid>,
    website_url: Option<&str>,
    order: LandingOrder,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO actor_profile_versions
             (actor_id, display_name, bio, avatar_id, website_url,
              landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        actor_id,
        display_name,
        bio,
        avatar_id,
        website_url,
        order.landed_epoch,
        order.act_time,
        order.position,
    )
    .execute(&mut **tx)
    .await?;
    Ok(())
}
