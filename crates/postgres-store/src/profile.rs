//! ´mod:module:profile´
//!
//! Actor profile display content (data-model.md "Actors"): append-only
//! version rows over `actor_profile_versions`, newest row wins.
//!
//! Reads serve the profile surface. A profile update writes its version
//! row at the pre-commitment signature, marked pending, and every reader
//! is served it from then on (substrate.md §6); confirm drops the mark and
//! stamps the landing coordinates of the record that witnesses it, which
//! are what decide between landed versions. Expiry deletes a pending row
//! (`content::discard_pending_many`), and the previous version renders
//! again.

use crate::content::LandingOrder;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

/// One profile version row — the newest is the profile
/// (data-model.md "Display-content versioning").
#[derive(Debug, Clone)]
pub struct ProfileVersion {
    pub display_name: String,
    pub bio: Option<String>,
    pub avatar_id: Option<Uuid>,
    pub website_url: Option<String>,
    pub redaction_reason: Option<String>,
    /// Whether the update this row renders has not landed yet.
    pub pending: bool,
    /// The authoring instant: the update's pre-commitment signature, or
    /// the seeding instant of a registration or genesis seed.
    pub created_at: Timestamp,
}

/// The actor's current profile — a pending version first, since an
/// update is its author's content from the moment they sign it; else the
/// version whose record landed last, `created_at` then `version_id`
/// deciding only where no record does (the registration seed, and rows
/// written before the coordinates existed). None for an actor that never
/// got one (impossible for registered users, who are seeded at
/// registration).
pub async fn current_profile(
    pool: &PgPool,
    actor_id: Uuid,
) -> Result<Option<ProfileVersion>, sqlx::Error> {
    sqlx::query_as!(
        ProfileVersion,
        "SELECT display_name, bio, avatar_id, website_url,
                redaction_reason, pending, created_at
         FROM actor_profile_versions
         WHERE actor_id = $1
         ORDER BY pending DESC,
                  landed_epoch DESC NULLS LAST,
                  act_time DESC NULLS LAST,
                  position DESC NULLS LAST,
                  created_at DESC, version_id DESC
         LIMIT 1",
        actor_id,
    )
    .fetch_optional(pool)
    .await
}

/// The actor's current *landed* profile — [`current_profile`] with
/// pending versions left out. An update is a delta, so its version row is
/// merged onto this: what the graph has already accepted, never another
/// update still in flight.
pub async fn landed_profile(
    pool: &PgPool,
    actor_id: Uuid,
) -> Result<Option<ProfileVersion>, sqlx::Error> {
    sqlx::query_as!(
        ProfileVersion,
        "SELECT display_name, bio, avatar_id, website_url,
                redaction_reason, pending, created_at
         FROM actor_profile_versions
         WHERE actor_id = $1 AND NOT pending
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

/// Appends a profile version row — full merged field set (an update's
/// unchanged fields are copied forward by the caller, mirroring the
/// content versions). `order` is None at the pre-commitment — the version
/// is pending — and Some for an update promoted without a pending row of
/// its own (a mirror rebuild, or one landing after its pending row
/// expired). `created_at` is the update's authoring instant either way.
///
/// Returns whether a row was written: a pending row for this authoring
/// instant collides with itself, so a retried pre-sign writes nothing.
#[allow(clippy::too_many_arguments)]
pub async fn insert_profile_version(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    display_name: &str,
    bio: Option<&str>,
    avatar_id: Option<Uuid>,
    website_url: Option<&str>,
    order: Option<LandingOrder>,
    created_at: Timestamp,
) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "INSERT INTO actor_profile_versions
             (actor_id, display_name, bio, avatar_id, website_url, pending,
              created_at, landed_epoch, act_time, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (actor_id, created_at) WHERE pending DO NOTHING",
        actor_id,
        display_name,
        bio,
        avatar_id,
        website_url,
        order.is_none(),
        created_at,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        == 1)
}

/// Confirm: writes the update record's landing coordinates onto the
/// pending version row its write staged, and drops the mark. The row is
/// named by its authoring instant, so a landing never stamps another
/// write's row. False when there is none — the update landed without a
/// pending row here, and the promotion path appends the version instead.
pub async fn land_profile_version(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    created_at: Timestamp,
    order: LandingOrder,
) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE actor_profile_versions
            SET pending = FALSE, landed_epoch = $3, act_time = $4,
                position = $5
         WHERE actor_id = $1 AND created_at = $2 AND pending",
        actor_id,
        created_at,
        order.landed_epoch,
        order.act_time,
        order.position,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected()
        == 1)
}
