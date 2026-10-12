//! ´mod:module:slice´
//!
//! The viewer's ranking slice (api-spec.md `feedSlice`; miner-api.md
//! "The slice path"): the node set a ranker needs and the accepted
//! records among it, read as of one epoch.
//!
//! Membership is "best-possible path product ∏(γ·w̃) ≥ χ"
//! (feed-ranking.md §11). The governed χ is 0 at the MVP and a viewer may
//! only set it finer, so every path product of non-negative factors
//! qualifies and the slice is the viewer's forward-reachable closure.
//! That is why nothing here weighs an edge: the store computes
//! reachability, never a weight, and the ranker derives `w̃` itself.
//! The bound for a positive χ is not built, and the api refuses to serve
//! a slice under one rather than claim a bound it does not apply.
//!
//! The walk follows feed-ranking.md §3's declared traversal policy:
//! forward along stored leg direction only, persons as one node (an
//! `addr:` and a `prof:` of one atom), Types as sinks, and the control
//! families never expanded. Channel gating is the ranker's: the slice is
//! the superset it narrows.

use std::collections::HashMap;

use sqlx::PgPool;

use crate::mirror::{self, MirrorError, RecordFull, RecordRow};

/// The control families: they carry procedure, not stance, and are never
/// traversed (feed-ranking.md §3 "Traversal policy").
pub const CONTROL_FAMILIES: [&str; 4] = ["withdraw", "rescind", "leave", "de-invite"];

/// A person's two graph identifiers, `addr:a` and `prof:a`, are one node
/// (feed-ranking.md §3 "Persons are one node"). The slice serves a person
/// under the profile identifier; this is the fold every node read applies.
pub fn canonical(node: &str) -> String {
    match node.strip_prefix("addr:") {
        Some(atom) => format!("prof:{atom}"),
        None => node.to_string(),
    }
}

/// The viewer's forward closure at `as_of`: every node reached from the
/// viewer's person over accepted legs landed at or before that epoch.
///
/// Both identifiers of every reached person are in the set, so the walk
/// continues from a stance that landed on a Profile exactly as from one
/// that landed on the Actor. A Type is reached but never expanded.
pub async fn reach(
    pool: &PgPool,
    viewer_address: &str,
    as_of: i64,
) -> Result<Vec<String>, sqlx::Error> {
    let seeds = vec![
        format!("addr:{viewer_address}"),
        format!("prof:{viewer_address}"),
    ];
    sqlx::query_scalar!(
        r#"WITH RECURSIVE reach(node) AS (
               SELECT unnest($1::text[])
             UNION
               SELECT next.node
               FROM reach r
               JOIN mirror_record_legs l ON l.source = r.node
               CROSS JOIN LATERAL (VALUES
                   (l.target),
                   (CASE WHEN l.target LIKE 'addr:%' THEN 'prof:' || substr(l.target, 6)
                         WHEN l.target LIKE 'prof:%' THEN 'addr:' || substr(l.target, 6)
                         ELSE l.target END)) AS next(node)
               WHERE r.node NOT LIKE 'name:%'
                 AND l.epoch <= $2
                 AND l.family <> ALL($3::text[])
           )
           SELECT node AS "node!" FROM reach"#,
        &seeds,
        as_of,
        &CONTROL_FAMILIES.map(String::from),
    )
    .fetch_all(pool)
    .await
}

/// One page of the slice's records, newest-first in landing order, keyset
/// on the causal key: every record owning a leg the walk traversed — a
/// leg out of a reached node that is not a Type, landed by `as_of`, of a
/// traversable family.
pub async fn records(
    pool: &PgPool,
    reach: &[String],
    as_of: i64,
    cursor: Option<(i64, i64, i64)>,
    backward: bool,
    limit: i64,
) -> Result<Vec<RecordFull>, MirrorError> {
    let (ce, ca, cp) = match cursor {
        Some((e, a, p)) => (Some(e), Some(a), Some(p)),
        None => (None, None, None),
    };
    let control = CONTROL_FAMILIES.map(String::from);
    let rows = if backward {
        sqlx::query_as!(
            RecordRow,
            r#"SELECT * FROM (
                   SELECT r.record_id, r.family, r.author, r.epoch, r.act_time,
                          r.position, r.payload_marked, r.payload_witness
                   FROM mirror_records r
                   WHERE r.epoch <= $2
                     AND EXISTS (
                         SELECT 1 FROM mirror_record_legs l
                         WHERE l.record_id = r.record_id
                           AND l.source = ANY($1)
                           AND l.source NOT LIKE 'name:%'
                           AND l.family <> ALL($3::text[]))
                     AND ($4::bigint IS NULL
                          OR (r.epoch, r.act_time, r.position) > ($4, $5, $6))
                   ORDER BY r.epoch ASC, r.act_time ASC, r.position ASC
                   LIMIT $7
               ) page
               ORDER BY epoch DESC, act_time DESC, position DESC"#,
            reach,
            as_of,
            &control,
            ce,
            ca,
            cp,
            limit,
        )
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as!(
            RecordRow,
            r#"SELECT r.record_id, r.family, r.author, r.epoch, r.act_time,
                      r.position, r.payload_marked, r.payload_witness
               FROM mirror_records r
               WHERE r.epoch <= $2
                 AND EXISTS (
                     SELECT 1 FROM mirror_record_legs l
                     WHERE l.record_id = r.record_id
                       AND l.source = ANY($1)
                       AND l.source NOT LIKE 'name:%'
                       AND l.family <> ALL($3::text[]))
                 AND ($4::bigint IS NULL
                      OR (r.epoch, r.act_time, r.position) < ($4, $5, $6))
               ORDER BY r.epoch DESC, r.act_time DESC, r.position DESC
               LIMIT $7"#,
            reach,
            as_of,
            &control,
            ce,
            ca,
            cp,
            limit,
        )
        .fetch_all(pool)
        .await?
    };
    mirror::with_legs(pool, rows).await
}

/// How many records the slice ships, across every page.
pub async fn count_records(
    pool: &PgPool,
    reach: &[String],
    as_of: i64,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!"
           FROM mirror_records r
           WHERE r.epoch <= $2
             AND EXISTS (
                 SELECT 1 FROM mirror_record_legs l
                 WHERE l.record_id = r.record_id
                   AND l.source = ANY($1)
                   AND l.source NOT LIKE 'name:%'
                   AND l.family <> ALL($3::text[]))"#,
        reach,
        as_of,
        &CONTROL_FAMILIES.map(String::from),
    )
    .fetch_one(pool)
    .await
}

/// One page of the slice's node identifiers, ascending, persons under
/// their profile identifier: the reached set closed over the endpoints of
/// every shipped record's legs. An endpoint the walk never reached is a
/// node of the slice (a ranker must find every leg's ends) but was never
/// expanded. `after`/`before` are exclusive bounds on the identifier.
pub async fn node_ids(
    pool: &PgPool,
    reach: &[String],
    as_of: i64,
    after: Option<&str>,
    before: Option<&str>,
    backward: bool,
    limit: i64,
) -> Result<Vec<String>, sqlx::Error> {
    let mut ids = sqlx::query_scalar!(
        r#"WITH shipped AS (
               SELECT DISTINCT l.record_id
               FROM mirror_record_legs l
               WHERE l.source = ANY($1)
                 AND l.source NOT LIKE 'name:%'
                 AND l.epoch <= $2
                 AND l.family <> ALL($3::text[])
           ),
           ends AS (
               SELECT unnest($1::text[]) AS node
               UNION
               SELECT e.source FROM mirror_record_legs e JOIN shipped s USING (record_id)
               UNION
               SELECT e.target FROM mirror_record_legs e JOIN shipped s USING (record_id)
           ),
           nodes AS (
               SELECT DISTINCT CASE WHEN node LIKE 'addr:%' THEN 'prof:' || substr(node, 6)
                                    ELSE node END AS graph_id
               FROM ends
           )
           SELECT graph_id AS "graph_id!"
           FROM nodes
           WHERE ($4::text IS NULL OR graph_id > $4)
             AND ($5::text IS NULL OR graph_id < $5)
           ORDER BY CASE WHEN $6 THEN NULL ELSE graph_id END ASC,
                    graph_id DESC
           LIMIT $7"#,
        reach,
        as_of,
        &CONTROL_FAMILIES.map(String::from),
        after,
        before,
        backward,
        limit,
    )
    .fetch_all(pool)
    .await?;
    if backward {
        ids.reverse();
    }
    Ok(ids)
}

/// How many nodes the slice ships, across every page.
pub async fn count_nodes(pool: &PgPool, reach: &[String], as_of: i64) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar!(
        r#"WITH shipped AS (
               SELECT DISTINCT l.record_id
               FROM mirror_record_legs l
               WHERE l.source = ANY($1)
                 AND l.source NOT LIKE 'name:%'
                 AND l.epoch <= $2
                 AND l.family <> ALL($3::text[])
           ),
           ends AS (
               SELECT unnest($1::text[]) AS node
               UNION
               SELECT e.source FROM mirror_record_legs e JOIN shipped s USING (record_id)
               UNION
               SELECT e.target FROM mirror_record_legs e JOIN shipped s USING (record_id)
           )
           SELECT COUNT(DISTINCT CASE WHEN node LIKE 'addr:%' THEN 'prof:' || substr(node, 6)
                                      ELSE node END) AS "count!"
           FROM ends"#,
        reach,
        as_of,
        &CONTROL_FAMILIES.map(String::from),
    )
    .fetch_one(pool)
    .await
}

/// A node's genesis authorship record's causal key (feed-ranking.md §7's
/// recency fallback key): `(landing epoch, act time, position)`.
pub type GenesisKey = (i64, i64, i64);

/// The genesis key of every given node that has one at `as_of`: a minted
/// node's own minting act (a mint names the act that minted it), a
/// person's Registration. A Type is authorless and has none. An update
/// record is never a genesis, so an edit never moves the key.
pub async fn genesis_keys(
    pool: &PgPool,
    graph_ids: &[String],
    as_of: i64,
) -> Result<HashMap<String, GenesisKey>, sqlx::Error> {
    let minting: Vec<String> = graph_ids
        .iter()
        .filter_map(|g| g.strip_prefix("mint:").map(String::from))
        .collect();
    let persons: Vec<String> = graph_ids
        .iter()
        .filter_map(|g| g.strip_prefix("prof:").map(String::from))
        .collect();
    let mut keys = HashMap::new();
    for row in sqlx::query!(
        "SELECT record_id, epoch, act_time, position FROM mirror_records
         WHERE record_id = ANY($1) AND epoch <= $2",
        &minting,
        as_of,
    )
    .fetch_all(pool)
    .await?
    {
        keys.insert(
            format!("mint:{}", row.record_id),
            (row.epoch, row.act_time, row.position),
        );
    }
    for row in sqlx::query!(
        r#"SELECT DISTINCT ON (author) author, epoch, act_time, position
           FROM mirror_records
           WHERE family = 'registration' AND author = ANY($1) AND epoch <= $2
           ORDER BY author, epoch, act_time, position"#,
        &persons,
        as_of,
    )
    .fetch_all(pool)
    .await?
    {
        keys.insert(
            format!("prof:{}", row.author),
            (row.epoch, row.act_time, row.position),
        );
    }
    Ok(keys)
}

/// What CoGra carries for a node: its L2 id and the store's kind for it.
#[derive(Debug, Clone)]
pub struct NodeRow {
    pub id: uuid::Uuid,
    /// `user`, `collective` or `system` for a person (the actor row's
    /// kind), `post` or `comment` for a minted content node.
    pub kind: String,
}

/// CoGra's rows behind the given node identifiers, keyed by identifier:
/// a person by the actor fronting the atom, a minted node by its post or
/// comment row. A node CoGra carries no row for is absent — the genesis
/// Charter is a minted node with none. Types are a pure function of their
/// name and are the caller's to derive.
pub async fn node_rows(
    pool: &PgPool,
    graph_ids: &[String],
) -> Result<HashMap<String, NodeRow>, sqlx::Error> {
    let atoms: Vec<String> = graph_ids
        .iter()
        .filter_map(|g| g.strip_prefix("prof:").map(String::from))
        .collect();
    let mints: Vec<String> = graph_ids
        .iter()
        .filter(|g| g.starts_with("mint:"))
        .cloned()
        .collect();
    let mut rows = HashMap::new();
    for row in sqlx::query!(
        r#"SELECT realization_address AS "address!", id, kind FROM actors
           WHERE realization_address = ANY($1)"#,
        &atoms,
    )
    .fetch_all(pool)
    .await?
    {
        rows.insert(
            format!("prof:{}", row.address),
            NodeRow {
                id: row.id,
                kind: row.kind,
            },
        );
    }
    for row in sqlx::query!(
        r#"SELECT l1_node_id AS "node!", id AS "id!", 'post' AS "kind!" FROM posts
           WHERE l1_node_id = ANY($1)
           UNION ALL
           SELECT l1_node_id, id, 'comment' FROM comments
           WHERE l1_node_id = ANY($1)"#,
        &mints,
    )
    .fetch_all(pool)
    .await?
    {
        rows.insert(
            row.node,
            NodeRow {
                id: row.id,
                kind: row.kind,
            },
        );
    }
    Ok(rows)
}
