//! ´mod:module:report´
//!
//! What a content report names (api-spec.md `sendReport`): the reported
//! node's kind and whose it is, read from the L2 registries — `posts`,
//! `comments`, user-kind `actors` — never from the client. The report
//! itself keeps no row; this is its only read.

use sqlx::PgPool;
use uuid::Uuid;

/// A reportable node: its kind as the seen-list spells it (`post`,
/// `comment`, `user`) and the actor it belongs to — a post's or a
/// comment's author, a profile's own actor.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReportTarget {
    pub kind: String,
    pub owner: Uuid,
}

/// The node `id` names, when it is a post, a comment or a person's
/// profile; None for anything else. A removed thing keeps its registry
/// row, so it stays reportable; a pending write that never landed is
/// gone from its registry, and with it the thing to report.
pub async fn target(pool: &PgPool, id: Uuid) -> Result<Option<ReportTarget>, sqlx::Error> {
    sqlx::query_as!(
        ReportTarget,
        r#"SELECT k.kind AS "kind!", k.owner AS "owner!"
           FROM (
               SELECT 'post'::text AS kind, author_id AS owner FROM posts WHERE id = $1
               UNION ALL
               SELECT 'comment', author_id FROM comments WHERE id = $1
               UNION ALL
               SELECT 'user', id FROM actors WHERE id = $1 AND kind = 'user'
               LIMIT 1
           ) k"#,
        id,
    )
    .fetch_optional(pool)
    .await
}
