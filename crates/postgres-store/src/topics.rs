//! ´mod:module:topics´
//!
//! The current-topics fold (hashtag.md §4): newest-wins per
//! (author, content, Type) bundle, relevance 0 read as withdrawn.
//!
//! A Tag is a standing claim, not an event, so an author's latest record
//! in a bundle is their current claim and the earlier ones are history
//! (graph-model.md §4). Withdrawal is *declared* — re-tagging at relevance
//! 0 — rather than netted: the census bounds Tag confidence to c ∈ [0, 1],
//! so no counter-record could net an accumulated bundle back down. That is
//! why this module picks a winner instead of summing, and why the
//! zero-check happens *after* the pick: a newer 0 has to be able to hide
//! an older non-zero claim.
//!
//! # Which column carries relevance
//!
//! A Tag is a hyper-edge whose act tuple is (relevance, confidence), and
//! the census transposes it on the T-leg (layer1-interface.md §9.6;
//! `common::l1::census::leg_params`). The two halves of the write path
//! therefore store the same claim in *opposite* columns:
//!
//! | half                        | relevance | confidence |
//! |-----------------------------|-----------|------------|
//! | landed T-leg (mirror)       | `p_i`     | `p_d`      |
//! | staged write (act tuple)    | `p_d`     | `p_i`      |
//!
//! Reading the wrong one silently swaps every claim's relevance for its
//! confidence — a fold that still returns rows, just wrong ones. The
//! transposition guard in tests/topics.rs is what holds this table honest.
//!
//! Only T-legs are read. The A-leg (author → content) carries the same act
//! and adds nothing a topic read needs; the author comes from the parent
//! record, which is authoritative for it.

use sqlx::PgPool;

/// Which view of the graph a topics read takes: L1's — only what has
/// landed — or L2's, which also counts one actor's acts still in flight
/// (api-spec.md "Conventions", the `includePending` split).
///
/// The pending half names *whose* acts it counts, because a staged write
/// is not on the graph: only its own author may see it. Passing an actor
/// other than the requesting viewer would leak an unlanded act.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TopicView<'a> {
    Landed,
    IncludingPending { actor: &'a str },
}

impl<'a> TopicView<'a> {
    /// The `includePending` argument as the API takes it: pending rows
    /// count only in the L2 view, and only when there is a viewer whose
    /// own in-flight acts they can be.
    pub fn from_include_pending(include_pending: bool, viewer: Option<&'a str>) -> Self {
        match (include_pending, viewer) {
            (true, Some(actor)) => TopicView::IncludingPending { actor },
            _ => TopicView::Landed,
        }
    }

    /// `(pending counted, whose)` — the shape the queries bind.
    fn params(self) -> (bool, &'a str) {
        match self {
            TopicView::Landed => (false, ""),
            TopicView::IncludingPending { actor } => (true, actor),
        }
    }
}

/// Which Tag records a topic read admits — feed-ranking.md §4's channel
/// test, the same test that decides which records a viewer's topic feed
/// surfaces.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TagChannel {
    /// Content-intrinsic only: the tag's author is the content's author.
    /// This channel needs no forward-path weight, so it is the one a
    /// build without the ranker can evaluate correctly (D8).
    AuthorOwned,
    /// Every author's current claims — hashtag.md §4's union. A third
    /// party's tag reaches a viewer only through the tagger, at the
    /// viewer's forward-path weight, so this channel is honest only once
    /// the ranker can apply that gate.
    AnyAuthor,
}

/// One current topic claim on a node.
#[derive(Debug, Clone, PartialEq)]
pub struct TopicClaim {
    /// The Type's canonical name — the `name(s)` atom, lowercase, no `#`.
    pub name: String,
    /// The claiming author's L0 address atom.
    pub author: String,
    /// Relevance `r ∈ [−1, 1]`. Never 0: the fold reads 0 as withdrawn.
    pub relevance: f64,
    /// Confidence `c ∈ [0, 1]`.
    pub confidence: f64,
    /// True when the winning record is still in flight.
    pub pending: bool,
}

/// One node currently tagged with a Type.
#[derive(Debug, Clone, PartialEq)]
pub struct TaggedNode {
    /// The tagged node's L1 identifier, verbatim — `posts.l1_node_id` and
    /// `comments.l1_node_id` store the same string.
    pub node: String,
    /// The claiming author's L0 address atom.
    pub author: String,
    pub relevance: f64,
    pub confidence: f64,
    pub pending: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum TopicsError {
    /// A stored Tag T-leg whose terminal target is not a `name(s)`
    /// identifier. Formation forbids it (`census::endpoint_check`), so
    /// this means the mirror itself is corrupt.
    #[error("tag leg targets `{0}`, which is not a Type identifier")]
    NotATypeTarget(String),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

/// Strips the `name:` constructor, leaving the canonical name.
fn type_name(target: &str) -> Result<String, TopicsError> {
    target
        .strip_prefix("name:")
        .map(str::to_string)
        .ok_or_else(|| TopicsError::NotATypeTarget(target.to_string()))
}

/// The current topics of one node, as one author declares them.
///
/// The bundle key is (author, content, Type); this read fixes the first
/// two, so the newest record per Type is the whole fold. Verdict marks are
/// excluded — The Moderator's `(0,0)` + payload Tag declares no topic
/// (hashtag.md §6) — and so is any bundle whose winner sits at relevance 0.
///
/// `author` is the content's own author for the chip row (D8): the
/// content-intrinsic channel, the one that needs no forward-path weight.
///
/// # The two halves filter on different actors
///
/// The landed half selects on `author`; the pending half selects on the
/// actor named by `view`, because a staged write is visible only to
/// whoever staged it. Every returned claim is then attributed to
/// `author`. So a call whose viewer is not the content's author, made
/// with [`TopicView::IncludingPending`], mixes the viewer's own in-flight
/// tags into the author's chip row under the author's name. Count pending
/// only when the two actors are the same one — `crates/api`'s
/// `topic_claims` gates on exactly that.
pub async fn topics_of(
    pool: &PgPool,
    node: &str,
    author: &str,
    view: TopicView<'_>,
) -> Result<Vec<TopicClaim>, TopicsError> {
    let (with_pending, pending_actor) = view.params();
    let rows = sqlx::query!(
        r#"WITH candidates AS (
               SELECT l.target                AS target,
                      l.p_i                   AS relevance,
                      l.p_d                   AS confidence,
                      FALSE                   AS pending,
                      r.epoch                 AS epoch,
                      r.act_time              AS act_time,
                      r.position              AS position,
                      NULL::timestamptz       AS authored_at
               FROM mirror_record_legs l
               JOIN mirror_records r ON r.record_id = l.record_id
               WHERE l.leg = 't' AND l.family = 'tag'
                 AND l.source = $1
                 AND r.author = $2
                 AND NOT r.payload_marked
             UNION ALL
               SELECT s.target, s.p_d, s.p_i, TRUE, 0, 0, 0, s.pre_signed_at
               FROM staged_writes s
               WHERE $3
                 AND s.family = 'tag'
                 AND s.middle = $1
                 AND s.author = $4
                 AND octet_length(s.payload) = 0
                 AND s.pre_signed_at IS NOT NULL
                 AND s.state NOT IN ('landed', 'expired')
           ),
           winners AS (
               SELECT DISTINCT ON (target) *
               FROM candidates
               ORDER BY target, pending DESC,
                        epoch DESC, act_time DESC, position DESC,
                        authored_at DESC
           )
           SELECT target       AS "target!",
                  relevance    AS "relevance!",
                  confidence   AS "confidence!",
                  pending      AS "pending!"
           FROM winners
           WHERE relevance <> 0
           ORDER BY target"#,
        node,
        author,
        with_pending,
        pending_actor,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(|r| {
            Ok(TopicClaim {
                name: type_name(&r.target)?,
                author: author.to_string(),
                relevance: r.relevance,
                confidence: r.confidence,
                pending: r.pending,
            })
        })
        .collect()
}

/// The nodes currently tagged with one Type, newest claim first.
///
/// `canonical_name` is the bare name; the Type identifier is built from
/// it here. `channel` decides whose tags count — see [`TagChannel`], and
/// note that admitting `AnyAuthor` publishes third-party claims with no
/// forward-path gate on them.
///
/// The author-owned gate reads the middle's own author out of its
/// identifier: a minted node names its genesis act, a Profile names its
/// actor's atom, and an atom cannot contain a colon — which is what makes
/// that split unambiguous (`common::l1::identifier`).
pub async fn tagged_with(
    pool: &PgPool,
    canonical_name: &str,
    channel: TagChannel,
    view: TopicView<'_>,
    limit: u32,
) -> Result<Vec<TaggedNode>, TopicsError> {
    let target = format!("name:{canonical_name}");
    let (with_pending, pending_actor) = view.params();
    let author_owned = channel == TagChannel::AuthorOwned;
    let rows = sqlx::query!(
        r#"WITH candidates AS (
               SELECT l.source                AS node,
                      r.author                AS author,
                      l.p_i                   AS relevance,
                      l.p_d                   AS confidence,
                      FALSE                   AS pending,
                      r.epoch                 AS epoch,
                      r.act_time              AS act_time,
                      r.position              AS position,
                      NULL::timestamptz       AS authored_at
               FROM mirror_record_legs l
               JOIN mirror_records r ON r.record_id = l.record_id
               WHERE l.leg = 't' AND l.family = 'tag'
                 AND l.target = $1
                 AND NOT r.payload_marked
                 AND (NOT $2 OR r.author = CASE
                         WHEN l.source LIKE 'mint:act:%' THEN split_part(l.source, ':', 3)
                         WHEN l.source LIKE 'prof:%'     THEN split_part(l.source, ':', 2)
                     END)
             UNION ALL
               SELECT s.middle, s.author, s.p_d, s.p_i, TRUE, 0, 0, 0, s.pre_signed_at
               FROM staged_writes s
               WHERE $3
                 AND s.family = 'tag'
                 AND s.target = $1
                 AND s.author = $4
                 AND s.middle IS NOT NULL
                 AND octet_length(s.payload) = 0
                 AND s.pre_signed_at IS NOT NULL
                 AND s.state NOT IN ('landed', 'expired')
                 AND (NOT $2 OR s.author = CASE
                         WHEN s.middle LIKE 'mint:act:%' THEN split_part(s.middle, ':', 3)
                         WHEN s.middle LIKE 'prof:%'     THEN split_part(s.middle, ':', 2)
                     END)
           ),
           winners AS (
               SELECT DISTINCT ON (author, node) *
               FROM candidates
               ORDER BY author, node, pending DESC,
                        epoch DESC, act_time DESC, position DESC,
                        authored_at DESC
           )
           SELECT node        AS "node!",
                  author      AS "author!",
                  relevance   AS "relevance!",
                  confidence  AS "confidence!",
                  pending     AS "pending!"
           FROM winners
           WHERE relevance <> 0
           ORDER BY pending DESC, epoch DESC, act_time DESC, position DESC,
                    authored_at DESC, node
           LIMIT $5"#,
        target,
        author_owned,
        with_pending,
        pending_actor,
        i64::from(limit),
    )
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| TaggedNode {
            node: r.node,
            author: r.author,
            relevance: r.relevance,
            confidence: r.confidence,
            pending: r.pending,
        })
        .collect())
}
