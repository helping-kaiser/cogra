//! ´mod:module:settling´
//!
//! The settling candidates the ranking relay forwards to the ranker pod
//! (ranked-feed-api §4.10): content the read paths serve as pending —
//! signed, not yet ordered — each with the authorship edge it was born
//! with, as staged. The pod weaves the ones whose author the viewer
//! reaches; this read only finds them.

use sqlx::PgPool;
use uuid::Uuid;

/// One pending node and its own authorship edge.
#[derive(Debug, Clone, PartialEq)]
pub struct SettlingCandidate {
    /// CoGra's id for the node.
    pub node_id: Uuid,
    /// The content table the node lives in: `post` or `comment`.
    pub kind: String,
    /// The minting act's author: L1's bare author atom, as staged.
    pub author: String,
    /// The minting act's census family.
    pub family: String,
    /// The minting act's own authored parameters.
    pub p_d: f64,
    pub p_i: f64,
    /// The authoring instant: when the device's pre-commitment was
    /// recorded, which is what the content dates from.
    pub authored_at: chrono::DateTime<chrono::Utc>,
}

/// Every settling candidate of the given content kinds (`post`,
/// `comment`), optionally under one topic.
///
/// A candidate is a content row still pending, joined to the staged write
/// that mints it. Excluded:
/// - a write carried with an application: held, author-only, never served
///   to anyone else (auth.md "Application");
/// - a write expired or not yet pre-signed: nothing of it is served;
/// - a write whose record already landed by `as_of_epoch`, though the
///   content row has not caught up: by the pin it is landed, so it ranks
///   among the landed entries and must never repeat as settling (W-4).
///
/// Under a `topic` (its Type identifier, `name:<canonical name>`), only
/// content whose own author declares the topic in a pending Tag — the
/// newest such declaration per Type, at non-zero relevance — is a
/// candidate. A third party's pending tag carries no path weight the
/// ranker could test, so it never admits one (ranked-feed-api §4.10,
/// low-confidence #4). A staged Tag's relevance is its `p_d` (see
/// `topics`).
///
/// The rows come back in node id order: a stable request, not an order
/// the ranker reads anything from.
pub async fn candidates(
    pool: &PgPool,
    kinds: &[String],
    topic: Option<&str>,
    as_of_epoch: i64,
) -> Result<Vec<SettlingCandidate>, sqlx::Error> {
    sqlx::query_as!(
        SettlingCandidate,
        r#"WITH pending AS (
               SELECT p.id, 'post' AS kind, p.l1_node_id
               FROM posts p
               WHERE p.landed_epoch IS NULL AND 'post' = ANY($1)
             UNION ALL
               SELECT c.id, 'comment' AS kind, c.l1_node_id
               FROM comments c
               WHERE c.landed_epoch IS NULL AND 'comment' = ANY($1)
           )
           SELECT n.id             AS "node_id!",
                  n.kind           AS "kind!",
                  s.author         AS "author!",
                  s.family         AS "family!",
                  s.p_d            AS "p_d!",
                  s.p_i            AS "p_i!",
                  s.pre_signed_at  AS "authored_at!"
           FROM pending n
           JOIN staged_writes s
             ON s.node_id = n.id AND 'mint:' || s.act_id = n.l1_node_id
           WHERE NOT s.carried
             AND s.state NOT IN ('landed', 'expired', 'carried')
             AND s.pre_signed_at IS NOT NULL
             AND NOT EXISTS (
                 SELECT 1 FROM mirror_records r
                 WHERE r.record_id = s.act_id AND r.epoch <= $2
             )
             AND ($3::text IS NULL OR EXISTS (
                 SELECT 1
                 FROM (
                     SELECT DISTINCT ON (t.target) t.p_d AS relevance
                     FROM staged_writes t
                     WHERE t.family = 'tag'
                       AND t.middle = n.l1_node_id
                       AND t.target = $3
                       AND t.author = s.author
                       AND NOT t.carried
                       AND octet_length(t.payload) = 0
                       AND t.pre_signed_at IS NOT NULL
                       AND t.state NOT IN ('landed', 'expired')
                     ORDER BY t.target, t.pre_signed_at DESC
                 ) newest
                 WHERE newest.relevance <> 0
             ))
           ORDER BY n.id"#,
        kinds,
        as_of_epoch,
        topic,
    )
    .fetch_all(pool)
    .await
}
