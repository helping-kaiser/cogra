//! User display-content reads — the Postgres half of a `User`. The graph
//! half (`network_role`, moderation cache) is read separately from
//! graph-engine and combined in the API resolver.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

/// The Postgres-side view of a `User`: the immutable account row joined to its
/// current (top) profile version. `updated_at` is the latest profile
/// version's timestamp; `created_at` is the account's.
#[derive(Debug)]
pub struct UserRecord {
    pub id: Uuid,
    pub username: String,
    pub display_name: String,
    pub bio: Option<String>,
    pub website_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Reads a user's account + current profile by id. `None` when no such user
/// exists. The `LATERAL` subquery selects the newest profile version — the
/// "current value is `ORDER BY created_at DESC LIMIT 1`" display-content shape.
pub async fn find_user_by_id(pool: &PgPool, id: Uuid) -> Result<Option<UserRecord>, sqlx::Error> {
    // Columns are listed in `UserRecord` field order — `query_as!` binds by
    // position. The LATERAL join hides the source columns' NOT NULL, so sqlx
    // infers `display_name`/`updated_at` as nullable; the `!` overrides assert
    // the non-null they carry in the schema. `bio`/`website_url` are genuinely
    // nullable and map to `Option` as-is.
    sqlx::query_as!(
        UserRecord,
        r#"SELECT u.id,
                  u.username,
                  pv.display_name AS "display_name!",
                  pv.bio,
                  pv.website_url,
                  u.created_at,
                  pv.created_at AS "updated_at!"
           FROM users u
           JOIN LATERAL (
               SELECT display_name, bio, website_url, created_at
               FROM user_profile_versions
               WHERE user_id = u.id
               ORDER BY created_at DESC
               LIMIT 1
           ) pv ON TRUE
           WHERE u.id = $1"#,
        id
    )
    .fetch_optional(pool)
    .await
}
