//! ´mod:module:registry´
//!
//! The application registry (data-model.md "Application registry"): one
//! row per release per platform component, read by `appVersions` and
//! written by the operator's release CLI (`api::registry`).
//!
//! Append-only by construction: this module offers an insert and reads,
//! and no update or delete exists, so a past release's page stays
//! resolvable. Newest first is the registry's own order — `released_at`,
//! with the primary key breaking ties so the keyset walk is total.

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

/// A release as the operator publishes it, for one component.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewRelease {
    /// The component as the table spells it: `backend`, `ios`, `android`
    /// or `web`.
    pub component: String,
    pub version: String,
    /// The release's notes, one entry per line, in the order written.
    pub notes: Vec<String>,
    pub patch_notes_url: String,
    /// Actors credited beyond the commit history; empty stores NULL, the
    /// table's "nobody" (data-model.md).
    pub released_by: Vec<Uuid>,
    pub released_at: DateTime<Utc>,
}

/// One release row as the registry holds it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Release {
    pub component: String,
    pub version: String,
    pub notes: Vec<String>,
    pub patch_notes_url: String,
    /// NULL when nobody beyond the commit history is credited.
    pub released_by: Option<Vec<Uuid>>,
    pub released_at: DateTime<Utc>,
}

impl Release {
    /// The row's place in the registry's order.
    pub fn cursor(&self) -> ReleaseCursor {
        ReleaseCursor {
            released_at: self.released_at,
            component: self.component.clone(),
            version: self.version.clone(),
        }
    }
}

/// A position in the registry's order: `released_at`, then the primary
/// key, which makes the key unique.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReleaseCursor {
    pub released_at: DateTime<Utc>,
    pub component: String,
    pub version: String,
}

#[derive(Debug, thiserror::Error)]
pub enum RegistryError {
    /// The component already has a release under this version: the
    /// primary key refuses a second row, so a published release is never
    /// rewritten.
    #[error("{component} {version} is already published")]
    AlreadyPublished { component: String, version: String },
    #[error(transparent)]
    Store(#[from] sqlx::Error),
}

/// Appends one release row. A `(component, version)` already published is
/// [`RegistryError::AlreadyPublished`]; an empty notes list is refused by
/// the table's CHECK and surfaces as a store error.
pub async fn publish_release(
    conn: &mut PgConnection,
    release: &NewRelease,
) -> Result<(), RegistryError> {
    let released_by = (!release.released_by.is_empty()).then_some(release.released_by.as_slice());
    let inserted = sqlx::query!(
        "INSERT INTO versions
             (component, version, notes, patch_notes_url, released_by, released_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
        release.component,
        release.version,
        &release.notes,
        release.patch_notes_url,
        released_by as Option<&[Uuid]>,
        release.released_at,
    )
    .execute(&mut *conn)
    .await;
    match inserted {
        Ok(_) => Ok(()),
        Err(sqlx::Error::Database(db)) if db.is_unique_violation() => {
            Err(RegistryError::AlreadyPublished {
                component: release.component.clone(),
                version: release.version.clone(),
            })
        }
        Err(e) => Err(e.into()),
    }
}

/// A page of releases in the registry's order, newest first, starting
/// after `cursor`; `component` narrows to one component. A backward walk
/// reads the rows before `cursor` and still returns them newest first.
pub async fn list_releases(
    pool: &PgPool,
    component: Option<&str>,
    cursor: Option<&ReleaseCursor>,
    backward: bool,
    limit: i64,
) -> Result<Vec<Release>, sqlx::Error> {
    let at = cursor.map(|c| c.released_at);
    let at_component = cursor.map(|c| c.component.as_str());
    let at_version = cursor.map(|c| c.version.as_str());
    if backward {
        let mut rows = sqlx::query_as!(
            Release,
            r#"SELECT component, version, notes, patch_notes_url, released_by, released_at
               FROM versions
               WHERE ($1::text IS NULL OR component = $1)
                 AND ($2::timestamptz IS NULL
                      OR (released_at, component, version) > ($2, $3::text, $4::text))
               ORDER BY released_at ASC, component ASC, version ASC
               LIMIT $5"#,
            component,
            at,
            at_component,
            at_version,
            limit,
        )
        .fetch_all(pool)
        .await?;
        rows.reverse();
        Ok(rows)
    } else {
        sqlx::query_as!(
            Release,
            r#"SELECT component, version, notes, patch_notes_url, released_by, released_at
               FROM versions
               WHERE ($1::text IS NULL OR component = $1)
                 AND ($2::timestamptz IS NULL
                      OR (released_at, component, version) < ($2, $3::text, $4::text))
               ORDER BY released_at DESC, component DESC, version DESC
               LIMIT $5"#,
            component,
            at,
            at_component,
            at_version,
            limit,
        )
        .fetch_all(pool)
        .await
    }
}

/// How many releases the registry holds, narrowed to `component` when
/// one is named.
pub async fn count_releases(pool: &PgPool, component: Option<&str>) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!" FROM versions
           WHERE ($1::text IS NULL OR component = $1)"#,
        component,
    )
    .fetch_one(pool)
    .await
}
