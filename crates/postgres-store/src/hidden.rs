//! ´mod:module:hidden´
//!
//! The hidden-actors list (data-model.md "Personal frontend state";
//! feed-ranking.md §8.2, §9.1): `user_hidden_actors`, its two writers and
//! its reader.
//!
//! # A viewer-side comfort, never the graph
//!
//! Hiding is applied post-rank on the viewer's own side: the list never
//! leaves the device's reads of it, never reaches a rank request, and never
//! changes what the hidden actor's records do to anyone else's feed. So
//! nothing here touches a record or a staged write.
//!
//! # Once per actor, removable
//!
//! The primary key `(viewer_id, hidden_id)` is the once-per-actor law: a
//! hide is `ON CONFLICT DO NOTHING`, so hiding a hidden actor keeps its
//! first moment. Unhiding genuinely deletes the row (api-spec.md "Private
//! viewer state"). The hidden side cascades, so an account the reaper or an
//! applicant's own delete removes takes its hides with it; a member's
//! erasure keeps its `actors` row, so hides of a deleted member stand.

use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

/// One hidden actor, as the list serves it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HiddenActor {
    pub actor_id: Uuid,
    pub hidden_at: Timestamp,
}

/// A keyset position on the list: `(hidden_at, actor_id)`, both descending.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HiddenCursor {
    pub hidden_at: Timestamp,
    pub actor_id: Uuid,
}

impl HiddenActor {
    pub fn cursor(&self) -> HiddenCursor {
        HiddenCursor {
            hidden_at: self.hidden_at,
            actor_id: self.actor_id,
        }
    }
}

/// Hides `actor` from `viewer`'s feed — now, or at `at` (an Undo of an
/// unhide restoring the row's place). An actor already hidden keeps its
/// first moment. `None` when `actor` names no actor.
pub async fn hide(
    pool: &PgPool,
    viewer: Uuid,
    actor: Uuid,
    at: Option<Timestamp>,
) -> Result<Option<HiddenActor>, sqlx::Error> {
    let inserted = sqlx::query_as!(
        HiddenActor,
        r#"INSERT INTO user_hidden_actors (viewer_id, hidden_id, hidden_at)
           SELECT $1, a.id, COALESCE($3, NOW())
           FROM actors a WHERE a.id = $2
           ON CONFLICT (viewer_id, hidden_id) DO NOTHING
           RETURNING hidden_id AS actor_id, hidden_at"#,
        viewer,
        actor,
        at,
    )
    .fetch_optional(pool)
    .await?;
    if inserted.is_some() {
        return Ok(inserted);
    }
    sqlx::query_as!(
        HiddenActor,
        r#"SELECT hidden_id AS actor_id, hidden_at FROM user_hidden_actors
           WHERE viewer_id = $1 AND hidden_id = $2"#,
        viewer,
        actor,
    )
    .fetch_optional(pool)
    .await
}

/// Unhides `actor` — a genuine delete. Answers whether a row went;
/// unhiding an actor not hidden is no fault.
pub async fn unhide(pool: &PgPool, viewer: Uuid, actor: Uuid) -> Result<bool, sqlx::Error> {
    let removed = sqlx::query!(
        "DELETE FROM user_hidden_actors WHERE viewer_id = $1 AND hidden_id = $2",
        viewer,
        actor,
    )
    .execute(pool)
    .await?
    .rows_affected();
    Ok(removed > 0)
}

/// One page of `viewer`'s hidden actors, most recently hidden first.
/// Walking forward reads past `cursor` toward earlier hides; walking
/// backward reads toward later ones and returns them in the same order.
pub async fn hidden_actors(
    pool: &PgPool,
    viewer: Uuid,
    cursor: Option<HiddenCursor>,
    backward: bool,
    limit: i64,
) -> Result<Vec<HiddenActor>, sqlx::Error> {
    let (at, id) = match cursor {
        Some(c) => (Some(c.hidden_at), Some(c.actor_id)),
        None => (None, None),
    };
    if backward {
        let mut rows = sqlx::query_as!(
            HiddenActor,
            r#"SELECT hidden_id AS actor_id, hidden_at FROM user_hidden_actors
               WHERE viewer_id = $1
                 AND ($2::timestamptz IS NULL OR (hidden_at, hidden_id) > ($2, $3::uuid))
               ORDER BY hidden_at ASC, hidden_id ASC
               LIMIT $4"#,
            viewer,
            at,
            id,
            limit,
        )
        .fetch_all(pool)
        .await?;
        rows.reverse();
        Ok(rows)
    } else {
        sqlx::query_as!(
            HiddenActor,
            r#"SELECT hidden_id AS actor_id, hidden_at FROM user_hidden_actors
               WHERE viewer_id = $1
                 AND ($2::timestamptz IS NULL OR (hidden_at, hidden_id) < ($2, $3::uuid))
               ORDER BY hidden_at DESC, hidden_id DESC
               LIMIT $4"#,
            viewer,
            at,
            id,
            limit,
        )
        .fetch_all(pool)
        .await
    }
}

/// How many actors `viewer` has hidden — the settings row's count.
pub async fn count_hidden(pool: &PgPool, viewer: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "n!" FROM user_hidden_actors WHERE viewer_id = $1"#,
        viewer,
    )
    .fetch_one(pool)
    .await
}
