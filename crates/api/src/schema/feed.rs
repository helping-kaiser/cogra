//! ´mod:module:feed´
//!
//! The backend's part in ranking (api-spec.md "Feed"): the governed
//! parameters a ranker reads (`networkParameters`), the viewer's slice it
//! ranks over (`feedSlice`), the relay of a ranking request to the server
//! ranker pod (`feedRanking`), and the hydration of the ordered ids it
//! hands back (`feed`).
//!
//! Ranking never runs in this process (feed-ranking.md §11). Nothing here
//! orders, weighs or scores: the slice is a reachability closure (see
//! `postgres_store::slice`), the relay translates and carries (see
//! [`feed_ranking`]), and `feed` serves the order it is handed.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use async_graphql::connection::{
    Connection, ConnectionNameType, DisableNodesField, Edge, EdgeNameType, EmptyFields,
};
use async_graphql::{Context, Enum, ErrorExtensions, InputObject, Object, SimpleObject, Union};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD as B64;
use common::hashtag_uuid;
use common::l1::identifier::NodeId;
use postgres_store::{PgPool, auth as store, hashtag, mirror, params, settling, slice};
use uuid::Uuid;

use crate::auth::Viewer;
use crate::ranker_pod::{
    FriendAuthorReorder, PodError, PodKind, PodMark, PodRanking, RankParams, RankVariables,
    RankerClient, SettlingCandidate,
};

use super::query::bad_input;
use super::types::{
    CommentType, DEFAULT_PAGE_SIZE, HashtagType, MAX_PAGE_SIZE, NodeKind, PostType,
    RecordConnection, User, connection_cost, keyset_page, slice_record_connection,
    validate_page_args,
};

/// The transport-tier fault for a server-side failure the caller cannot
/// correct (api-spec.md "Errors are tiered"): `INTERNAL`.
fn internal(message: impl Into<String>) -> async_graphql::Error {
    async_graphql::Error::new(message).extend_with(|_, e| e.set("code", "INTERNAL"))
}

fn storage(e: impl std::fmt::Display) -> async_graphql::Error {
    tracing::error!(error = %e, "ranked-feed read failed");
    internal("the read failed")
}

/// One governed network parameter, from the operational carrier — the
/// cache of the charter's replayable parameter schedule. The schedule on
/// L1 is binding; the carrier is rebuildable from it.
#[derive(SimpleObject)]
pub struct NetworkParameter {
    /// The catalog key (network.md), e.g. "gamma", "dust_floor",
    /// "reserve_share".
    pub key: String,
    /// The current value, serialized per the parameter's kind.
    pub value: String,
    /// The epoch of the finalization payload this value came from (the
    /// genesis charter payload for never-amended parameters).
    pub as_of_epoch: i64,
}

/// The `networkParameters` read: every parameter in force, or the named
/// keys, ascending by key. An unknown key is omitted and an empty list
/// reads empty. A never-amended parameter reads the Charter's landing
/// epoch, since the Charter's payload is where its value comes from.
pub async fn network_parameters(
    pool: &PgPool,
    keys: Option<Vec<String>>,
) -> async_graphql::Result<Vec<NetworkParameter>> {
    if keys.as_ref().is_some_and(Vec::is_empty) {
        return Ok(Vec::new());
    }
    let rows = params::all_current(pool, keys.as_deref())
        .await
        .map_err(storage)?;
    let charter = if rows.iter().any(|row| row.landed_epoch.is_none()) {
        Some(
            params::charter_epoch(pool)
                .await
                .map_err(storage)?
                .ok_or_else(|| {
                    tracing::error!(
                        "the parameter carrier is seeded but the Charter has not landed"
                    );
                    internal("the genesis Charter has not landed")
                })?,
        )
    } else {
        None
    };
    rows.into_iter()
        .map(|row| {
            Ok(NetworkParameter {
                key: row.parameter,
                value: row.value.to_string(),
                as_of_epoch: match (row.landed_epoch, charter) {
                    (Some(epoch), _) | (None, Some(epoch)) => epoch,
                    (None, None) => return Err(internal("the genesis Charter has not landed")),
                },
            })
        })
        .collect()
}

/// The viewer's relevant subgraph for ranking: the slice's node set and
/// the raw accepted records among those nodes, as of one epoch. Downloaded
/// by the ranker. The backend computes no order over it. Pages of one
/// slice stay consistent when every page is read at the same `asOfEpoch`.
pub struct FeedSlice {
    viewer: Uuid,
    as_of_epoch: i64,
    reach: Arc<Vec<String>>,
}

/// The slice supply's read log (ranked-feed-api §3.6, perf watch P-7): how
/// often each (viewer, epoch) slice is read from its first page. The slice
/// is generic — one per viewer and epoch, never shaped by a filter — so a
/// repeat read of one key is exactly what a slice cache would have served.
/// No cache is built ahead of that measurement; this log is the
/// measurement's source, and every first-page read is traced with its
/// running count.
///
/// Memory stays bounded by keeping only the keys of the newest epochs
/// seen: a repeat is counted "in the same epoch", and a slice pinned far
/// back is a spot-check, not traffic a cache would serve.
#[derive(Clone, Default)]
pub struct SliceReadLog(Arc<Mutex<SliceReads>>);

#[derive(Default)]
struct SliceReads {
    counts: HashMap<(Uuid, i64), u64>,
    newest_epoch: i64,
}

impl SliceReadLog {
    /// Epochs behind the newest one whose keys are still counted.
    const EPOCHS_KEPT: i64 = 2;

    /// Counts one first-page read of the (viewer, epoch) slice and returns
    /// the running count: above 1 is a repeat.
    pub fn record(&self, viewer: Uuid, as_of_epoch: i64) -> u64 {
        let reads = {
            let mut log = self
                .0
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            if as_of_epoch > log.newest_epoch {
                log.newest_epoch = as_of_epoch;
                let floor = as_of_epoch - Self::EPOCHS_KEPT;
                log.counts.retain(|(_, epoch), _| *epoch >= floor);
            }
            let count = log.counts.entry((viewer, as_of_epoch)).or_insert(0);
            *count += 1;
            *count
        };
        tracing::info!(
            %viewer,
            as_of_epoch,
            reads,
            repeat = reads > 1,
            "slice supply: first-page read"
        );
        reads
    }

    /// How many first-page reads the (viewer, epoch) slice has had.
    pub fn reads(&self, viewer: Uuid, as_of_epoch: i64) -> u64 {
        self.0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .counts
            .get(&(viewer, as_of_epoch))
            .copied()
            .unwrap_or(0)
    }
}

/// The `feedSlice` read. Argument faults are `BAD_INPUT`; a governed χ
/// above 0 is `INTERNAL`, because the bound it would need is not built
/// and serving the plain closure under it would claim a bound it never
/// applied. Null when the viewer resolves to no rankable actor — an
/// unknown id, a keyless account, or a mirror with nothing ingested.
pub async fn feed_slice(
    pool: &PgPool,
    viewer: Uuid,
    dust_floor: Option<f64>,
    gamma: Option<f64>,
    as_of_epoch: Option<i64>,
) -> async_graphql::Result<Option<FeedSlice>> {
    if gamma.is_some_and(|gamma| gamma.is_nan() || gamma <= 0.0 || gamma > 1.0) {
        return Err(bad_input("gamma must lie in (0, 1]"));
    }
    if dust_floor.is_some_and(|floor| floor.is_nan() || floor < 0.0) {
        return Err(bad_input("dustFloor must be non-negative"));
    }
    let governed = params::current(pool, "dust_floor")
        .await
        .map_err(storage)?
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    if governed > 0.0 {
        tracing::error!(governed, "slice bound for χ > 0 not built");
        return Err(internal(
            "the slice bound for a positive dust floor is not built",
        ));
    }
    if dust_floor.is_some_and(|floor| floor > governed) {
        return Err(bad_input(
            "dustFloor may only be finer than the network's dust floor",
        ));
    }
    let cursor = mirror::last_ingested_epoch(pool).await.map_err(storage)?;
    if let Some(pin) = as_of_epoch
        && !(0..=cursor).contains(&pin)
    {
        return Err(bad_input(format!(
            "asOfEpoch must lie in 0..={cursor}, the ingested epochs"
        )));
    }
    if cursor < 0 {
        return Ok(None);
    }
    let Some(address) = store::actor_identity(pool, viewer)
        .await
        .map_err(storage)?
        .and_then(|identity| identity.realization_address)
    else {
        return Ok(None);
    };
    let as_of_epoch = as_of_epoch.unwrap_or(cursor);
    let reach = slice::reach(pool, &address, as_of_epoch)
        .await
        .map_err(storage)?;
    Ok(Some(FeedSlice {
        viewer,
        as_of_epoch,
        reach: Arc::new(reach),
    }))
}

#[Object]
impl FeedSlice {
    /// The newest epoch whose certificate the slice includes — the base
    /// of every recency age (feed-ranking.md §5.3). Passing it back as
    /// `feedSlice(asOfEpoch:)` re-reads the same slice.
    async fn as_of_epoch(&self) -> i64 {
        self.as_of_epoch
    }

    /// The slice's nodes, ascending by L1 identifier.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    async fn nodes(
        &self,
        ctx: &Context<'_>,
        first: Option<i32>,
        after: Option<String>,
        last: Option<i32>,
        before: Option<String>,
    ) -> async_graphql::Result<SliceNodeConnection> {
        let pool = ctx.data::<PgPool>()?;
        validate_page_args(first, last, after.as_deref(), before.as_deref())
            .map_err(|e| bad_input(e.message))?;
        if after.is_none() && before.is_none() {
            ctx.data::<SliceReadLog>()?
                .record(self.viewer, self.as_of_epoch);
        }
        let backward = last.is_some() || before.is_some();
        let limit = i64::from(
            last.or(first)
                .unwrap_or(DEFAULT_PAGE_SIZE)
                .clamp(0, MAX_PAGE_SIZE),
        );
        let decode = |raw: &Option<String>| -> async_graphql::Result<Option<String>> {
            raw.as_deref()
                .map(|raw| decode_node_cursor(raw).ok_or_else(|| bad_input("invalid cursor")))
                .transpose()
        };
        let (after, before) = (decode(&after)?, decode(&before)?);
        let mut ids = slice::node_ids(
            pool,
            &self.reach,
            self.as_of_epoch,
            after.as_deref(),
            before.as_deref(),
            backward,
            limit + 1,
        )
        .await
        .map_err(storage)?;
        let has_more = ids.len() as i64 > limit;
        if has_more {
            if backward {
                ids.remove(0);
            } else {
                ids.pop();
            }
        }
        let (has_previous, has_next) = if backward {
            (has_more, before.is_some())
        } else {
            (after.is_some(), has_more)
        };
        let nodes = slice_nodes(pool, ids, self.as_of_epoch).await?;
        let mut connection = SliceNodeConnection::with_additional_fields(
            has_previous,
            has_next,
            SliceNodeConnectionFields {
                reach: self.reach.clone(),
                as_of_epoch: self.as_of_epoch,
            },
        );
        connection.edges.extend(
            nodes
                .into_iter()
                .map(|node| Edge::new(encode_node_cursor(&node.graph_id), node)),
        );
        Ok(connection)
    }

    /// The accepted records among the slice's nodes, newest first in
    /// landing order: every record owning a leg the walk traversed.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    async fn records(
        &self,
        ctx: &Context<'_>,
        first: Option<i32>,
        after: Option<String>,
        last: Option<i32>,
        before: Option<String>,
    ) -> async_graphql::Result<RecordConnection> {
        let pool = ctx.data::<PgPool>()?;
        let page = keyset_page(first, after, last, before).map_err(|e| bad_input(e.message))?;
        let rows = slice::records(
            pool,
            &self.reach,
            self.as_of_epoch,
            page.cursor.map(|c| c.order()),
            page.backward,
            page.limit + 1,
        )
        .await
        .map_err(storage)?;
        Ok(slice_record_connection(
            rows,
            &page,
            self.reach.clone(),
            self.as_of_epoch,
        ))
    }
}

/// A record's place in the authoritative order: its landing epoch and
/// causal key (𝕋^act, pos).
#[derive(SimpleObject, Clone, Copy)]
pub struct CausalKey {
    pub landing_epoch: i64,
    pub act_time: i64,
    pub position: i64,
}

/// One node of a slice, keyed by its L1 identifier — the identifier every
/// record leg names. Persons appear under their profile identifier: a leg
/// naming `addr:a` names the same person as `prof:a`.
#[derive(SimpleObject)]
pub struct SliceNode {
    /// The node's raw L1 identifier (an `addr`/`prof`, `name`, or `mint`).
    pub graph_id: String,
    /// CoGra's L2 id, when CoGra carries a row for the node. Null for a
    /// node CoGra has no row for. Such a node still transits, and is never
    /// a ranking candidate.
    pub id: Option<Uuid>,
    /// The node's kind, when CoGra carries a row for it. Null exactly
    /// when `id` is.
    pub kind: Option<NodeKind>,
    /// The node's genesis authorship record (a mint's own minting record,
    /// a person's Registration) — the recency fallback's key
    /// (feed-ranking.md §7), never refreshed by an update. Null for an
    /// authorless node (a Type).
    pub genesis: Option<CausalKey>,
}

/// Types the given identifiers from CoGra's rows — never from identifier
/// syntax, except a Type, whose id is a pure function of its name.
async fn slice_nodes(
    pool: &PgPool,
    graph_ids: Vec<String>,
    as_of_epoch: i64,
) -> async_graphql::Result<Vec<SliceNode>> {
    let rows = slice::node_rows(pool, &graph_ids).await.map_err(storage)?;
    let genesis = slice::genesis_keys(pool, &graph_ids, as_of_epoch)
        .await
        .map_err(storage)?;
    Ok(graph_ids
        .into_iter()
        .map(|graph_id| {
            let (id, kind) = match graph_id.strip_prefix("name:") {
                Some(name) => (Some(hashtag_uuid(name)), Some(NodeKind::Hashtag)),
                None => match rows
                    .get(&graph_id)
                    .and_then(|row| row_kind(&row.kind).map(|kind| (row.id, kind)))
                {
                    Some((id, kind)) => (Some(id), Some(kind)),
                    None => (None, None),
                },
            };
            SliceNode {
                genesis: genesis
                    .get(&graph_id)
                    .map(|&(landing_epoch, act_time, position)| CausalKey {
                        landing_epoch,
                        act_time,
                        position,
                    }),
                graph_id,
                id,
                kind,
            }
        })
        .collect())
}

/// The contract kind of a store row. A system actor is an account like
/// any other on the graph (`User` resolves it), so it types as one.
fn row_kind(kind: &str) -> Option<NodeKind> {
    match kind {
        "user" | "system" => Some(NodeKind::User),
        "collective" => Some(NodeKind::Collective),
        "post" => Some(NodeKind::Post),
        "comment" => Some(NodeKind::Comment),
        _ => None,
    }
}

fn encode_node_cursor(graph_id: &str) -> String {
    B64.encode(graph_id)
}

fn decode_node_cursor(raw: &str) -> Option<String> {
    String::from_utf8(B64.decode(raw).ok()?).ok()
}

/// Names the slice's node connection `SliceNodeConnection`.
pub struct SliceNodeConnectionName;

impl ConnectionNameType for SliceNodeConnectionName {
    fn type_name<T: async_graphql::OutputType>() -> String {
        "SliceNodeConnection".to_string()
    }
}

/// Names the slice's node edge `SliceNodeEdge`.
pub struct SliceNodeEdgeName;

impl EdgeNameType for SliceNodeEdgeName {
    fn type_name<T: async_graphql::OutputType>() -> String {
        "SliceNodeEdge".to_string()
    }
}

/// `SliceNodeConnection`'s own field: the node count, resolved only when
/// asked.
pub struct SliceNodeConnectionFields {
    reach: Arc<Vec<String>>,
    as_of_epoch: i64,
}

#[Object]
impl SliceNodeConnectionFields {
    /// How many nodes the slice holds, across every page, independent of
    /// the cursor.
    #[graphql(complexity = 0)]
    async fn total_count(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<i32>> {
        let pool = ctx.data::<PgPool>()?;
        let total = slice::count_nodes(pool, &self.reach, self.as_of_epoch)
            .await
            .map_err(storage)?;
        Ok(Some(i32::try_from(total).unwrap_or(i32::MAX)))
    }
}

/// A page of a slice's nodes.
pub type SliceNodeConnection = Connection<
    String,
    SliceNode,
    SliceNodeConnectionFields,
    EmptyFields,
    SliceNodeConnectionName,
    SliceNodeEdgeName,
    DisableNodesField,
>;

/// What narrows the ranker's candidates. Only arguments that change what
/// the ranker must compute ride here; every other sheet axis is a device
/// cut (feed-ranking.md §9.1; miner-api.md:63-64).
#[derive(InputObject, Default)]
pub struct FeedRankFilter {
    /// Rankable kinds in scope. Null means Posts only (feed-ranking.md
    /// §9.3). An empty list ranks nothing.
    pub kinds: Option<Vec<NodeKind>>,
    /// A topic (Hashtag id). Only content reaching the viewer over Tag
    /// records toward it is a candidate (FeedTopic; hashtag.md §5).
    pub topic: Option<Uuid>,
}

/// One ranking snapshot.
#[derive(SimpleObject)]
pub struct FeedRanking {
    /// The epoch the ranked slice reads as of (FeedSlice.asOfEpoch).
    pub as_of_epoch: i64,
    /// The landed targets, scored, in RANKED order, best first. A target
    /// no live path reaches is absent, not zero-scored (feed-ranking.md
    /// §7). This is the pinned snapshot: a call pinned at `asOfEpoch`
    /// reproduces it.
    pub entries: Vec<FeedEntry>,
    /// Content still settling, with its place in both woven orders.
    /// Carries no score by construction. Read live on every call, never
    /// part of the pinned snapshot.
    pub settling: Vec<SettlingEntry>,
}

/// One landed target.
#[derive(SimpleObject)]
pub struct FeedEntry {
    pub target_id: Uuid,
    pub kind: NodeKind,
    /// S(u, target) — the signed greedy disjoint-sum (feed-ranking.md
    /// §6.1).
    pub score: f64,
    /// The viewer's held opinion of the person behind the row, read at
    /// `asOfEpoch`. Null when none is held, for a Tags row, or when the
    /// reader is not the viewer.
    pub mark: Option<PeopleMark>,
    /// This entry's 0-based index among `entries` in NEWEST order. The
    /// indices are a permutation of 0..|entries|-1.
    pub newest_index: i32,
}

/// One settling row.
#[derive(SimpleObject)]
pub struct SettlingEntry {
    pub target_id: Uuid,
    pub kind: NodeKind,
    /// As FeedEntry.mark: the viewer's held opinion of the row's author.
    pub mark: Option<PeopleMark>,
    /// The row's 0-based index in the woven RANKED list (`entries` and
    /// `settling` together).
    pub ranked_position: i32,
    /// The row's 0-based index in the woven NEWEST list.
    pub newest_position: i32,
}

/// How the viewer holds the person behind a row (OS-18 S1): the sign of
/// the folded p̄_d of the viewer's own Opinion → Profile bundle toward
/// them. SIGNLESS is a held bundle with p̄_d = 0 and p̄_i ≠ 0.
#[derive(Enum, Copy, Clone, Debug, PartialEq, Eq)]
pub enum PeopleMark {
    For,
    Against,
    Signless,
}

/// The `feedRanking` relay (ranked-feed-api §4.2): resolve the pin, read
/// the settling candidates, forward the request to the ranker pod, and map
/// its answer into the public shapes. Null when the viewer resolves to no
/// rankable actor.
///
/// **The relay computes nothing** (PR-9/PR-10; PR-49 "main infra (DB +
/// relay) under minimal load"). Its database reads are the mirror cursor
/// and the staged candidates; the slice pages the pod pulls back are the
/// slice supply's. It reads no stance fold and no `user_view_log`, and it
/// never cuts, sorts, weighs, merges or weaves: the pod emits the order,
/// both permutations, the woven places and the people marks, and the
/// reader's device applies them. What the relay does to the answer is
/// translation (the pod's id-level kinds and `ref`s into the public types),
/// one id comparison (marks ride only when the session's reader is the
/// viewer), and an index-set check that refuses a malformed permutation
/// rather than handing the device an undefined composition.
///
/// No pooled connection is held across the pod call: the pod calls back
/// into this api for the slice, so a held connection per relay request
/// would starve the pool under load.
pub async fn feed_ranking(
    ctx: &Context<'_>,
    viewer: Uuid,
    as_of_epoch: Option<i64>,
    filter: Option<FeedRankFilter>,
) -> async_graphql::Result<Option<FeedRanking>> {
    let pool = ctx.data::<PgPool>()?;
    let ranker = ctx.data::<RankerClient>()?;
    let filter = filter.unwrap_or_default();

    let cursor = mirror::last_ingested_epoch(pool).await.map_err(storage)?;
    if let Some(pin) = as_of_epoch
        && !(0..=cursor).contains(&pin)
    {
        return Err(bad_input(format!(
            "asOfEpoch must lie in 0..={cursor}, the ingested epochs"
        )));
    }
    if cursor < 0 {
        return Ok(None);
    }
    let pinned = as_of_epoch.unwrap_or(cursor);

    let kinds = filter.kinds.unwrap_or_else(|| vec![NodeKind::Post]);
    if kinds.is_empty() {
        return Ok(Some(FeedRanking {
            as_of_epoch: pinned,
            entries: Vec::new(),
            settling: Vec::new(),
        }));
    }

    let candidates = settling_candidates(pool, &kinds, filter.topic).await?;
    let staged_kinds: HashMap<Uuid, NodeKind> = candidates
        .iter()
        .map(|(candidate, kind)| (candidate.ref_, *kind))
        .collect();
    let params = RankParams {
        kinds: Some(kinds.iter().copied().map(pod_kind).collect()),
        topic: filter.topic,
        gamma: None,
        dust_floor: None,
        recency_half_life_epochs: None,
        friend_author_reorder: Some(FriendAuthorReorder {
            enabled: false,
            freshness_threshold_epochs: None,
            placement: None,
        }),
        settling: Some(candidates.into_iter().map(|(c, _)| c).collect()),
    };

    let answer = match ranker
        .rank(RankVariables {
            viewer,
            params,
            as_of_epoch: Some(pinned),
        })
        .await
    {
        Ok(answer) => answer,
        Err(PodError::NotFound) => return Ok(None),
        Err(PodError::BadInput(message)) => {
            tracing::error!(
                %viewer,
                pod_message = %message,
                "the ranker pod refused the relay's request as bad input: a relay bug"
            );
            return Err(internal("the ranking failed"));
        }
        Err(e) => {
            tracing::error!(%viewer, error = %e, "the ranker pod produced no ranking");
            return Err(internal("the ranking failed"));
        }
    };

    let reader_is_viewer =
        matches!(ctx.data_opt::<Option<Viewer>>(), Some(Some(reader)) if reader.user_id == viewer);
    map_answer(answer, pinned, &staged_kinds, reader_is_viewer)
        .map(Some)
        .map_err(|malformed| {
            tracing::error!(%viewer, %malformed, "pod answer malformed");
            internal("the ranking failed")
        })
}

/// The settling candidates in the pod's wire form, each with its kind from
/// the staged read. The author atom is translated into the slice's own
/// person key (`prof:<atom>`), the one rule the slice applies to every
/// person (`postgres_store::slice`), so the pod joins it against
/// `SliceNode.graphId` without a mapping of its own.
///
/// Only Posts and Comments can settle in a feed: a Type never pends, and
/// a Profile pends only under its Registration, which an applicant
/// carries — held, author-only, never a candidate.
async fn settling_candidates(
    pool: &PgPool,
    kinds: &[NodeKind],
    topic: Option<Uuid>,
) -> async_graphql::Result<Vec<(SettlingCandidate, NodeKind)>> {
    let tables: Vec<String> = kinds
        .iter()
        .filter_map(|kind| match kind {
            NodeKind::Post => Some("post".to_string()),
            NodeKind::Comment => Some("comment".to_string()),
            _ => None,
        })
        .collect();
    if tables.is_empty() {
        return Ok(Vec::new());
    }
    let topic = match topic {
        None => None,
        Some(topic) => match hashtag::names_by_ids(pool, &[topic])
            .await
            .map_err(storage)?
            .into_iter()
            .next()
        {
            Some((_, name)) => Some(NodeId::name(&name).map_err(storage)?.to_string()),
            // A topic no Type carries admits no settling candidate; the
            // pod answers the landed side of the same unknown topic.
            None => return Ok(Vec::new()),
        },
    };
    Ok(settling::candidates(pool, &tables, topic.as_deref())
        .await
        .map_err(storage)?
        .into_iter()
        .map(|row| {
            let kind = if row.kind == "comment" {
                NodeKind::Comment
            } else {
                NodeKind::Post
            };
            (
                SettlingCandidate {
                    ref_: row.node_id,
                    author: NodeId::Prof(row.author).to_string(),
                    family: row.family,
                    p_directed: row.p_d,
                    p_interest: row.p_i,
                    authored_at: row.authored_at,
                },
                kind,
            )
        })
        .collect())
}

/// The pod's answer in the public shapes, field for field. Composes
/// nothing: entries keep the pod's array order, and the permutations and
/// places pass through as the pod emitted them, once their index sets are
/// checked. An `Err` names what is malformed.
fn map_answer(
    answer: PodRanking,
    pinned: i64,
    staged_kinds: &HashMap<Uuid, NodeKind>,
    reader_is_viewer: bool,
) -> Result<FeedRanking, String> {
    if answer.as_of_epoch != pinned {
        return Err(format!(
            "ranked epoch {} where {pinned} was pinned",
            answer.as_of_epoch
        ));
    }
    let mark = |mark: Option<PodMark>| -> Result<Option<PeopleMark>, String> {
        let mark = match mark {
            None => None,
            Some(PodMark::FOR) => Some(PeopleMark::For),
            Some(PodMark::AGAINST) => Some(PeopleMark::Against),
            Some(PodMark::SIGNLESS) => Some(PeopleMark::Signless),
            Some(PodMark::Other(other)) => return Err(format!("unknown people mark {other}")),
        };
        Ok(mark.filter(|_| reader_is_viewer))
    };

    let landed = answer.entries.len();
    if !is_index_set(answer.entries.iter().map(|e| e.newest_index), landed) {
        return Err(format!("newestIndex is not a permutation of 0..{landed}"));
    }
    let entries = answer
        .entries
        .into_iter()
        .map(|entry| {
            Ok(FeedEntry {
                target_id: entry.target_id,
                kind: api_kind(&entry.target_kind)?,
                score: entry.score,
                mark: mark(entry.mark)?,
                newest_index: index(entry.newest_index)?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    let woven = landed + answer.settling.len();
    if !is_index_set(answer.settling.iter().map(|p| p.ranked_position), woven)
        || !is_index_set(answer.settling.iter().map(|p| p.newest_position), woven)
    {
        return Err(format!(
            "settling positions duplicated or outside the woven list of {woven}"
        ));
    }
    let mut placed = HashSet::new();
    let settling = answer
        .settling
        .into_iter()
        .map(|place| {
            let kind = *staged_kinds
                .get(&place.ref_)
                .ok_or_else(|| format!("a place for {} which was never a candidate", place.ref_))?;
            if !placed.insert(place.ref_) {
                return Err(format!("{} placed twice", place.ref_));
            }
            Ok(SettlingEntry {
                target_id: place.ref_,
                kind,
                mark: mark(place.mark)?,
                ranked_position: index(place.ranked_position)?,
                newest_position: index(place.newest_position)?,
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    Ok(FeedRanking {
        as_of_epoch: answer.as_of_epoch,
        entries,
        settling,
    })
}

/// Whether `indices` are distinct and each lies in 0..`len` — an index-set
/// check, never a comparison of keys.
fn is_index_set(indices: impl Iterator<Item = i64>, len: usize) -> bool {
    let mut seen = HashSet::new();
    indices
        .into_iter()
        .all(|i| usize::try_from(i).is_ok_and(|i| i < len) && seen.insert(i))
}

fn index(i: i64) -> Result<i32, String> {
    i32::try_from(i).map_err(|_| format!("index {i} exceeds the wire's Int"))
}

/// The public kind as the pod's schema spells it; the two enums carry the
/// same values (ranker-schema.graphql).
fn pod_kind(kind: NodeKind) -> PodKind {
    match kind {
        NodeKind::User => PodKind::USER,
        NodeKind::Collective => PodKind::COLLECTIVE,
        NodeKind::Post => PodKind::POST,
        NodeKind::Comment => PodKind::COMMENT,
        NodeKind::Chat => PodKind::CHAT,
        NodeKind::ChatMessage => PodKind::CHAT_MESSAGE,
        NodeKind::Item => PodKind::ITEM,
        NodeKind::Hashtag => PodKind::HASHTAG,
        NodeKind::Proposal => PodKind::PROPOSAL,
        NodeKind::Campaign => PodKind::CAMPAIGN,
        NodeKind::Offer => PodKind::OFFER,
    }
}

fn api_kind(kind: &PodKind) -> Result<NodeKind, String> {
    Ok(match kind {
        PodKind::USER => NodeKind::User,
        PodKind::COLLECTIVE => NodeKind::Collective,
        PodKind::POST => NodeKind::Post,
        PodKind::COMMENT => NodeKind::Comment,
        PodKind::CHAT => NodeKind::Chat,
        PodKind::CHAT_MESSAGE => NodeKind::ChatMessage,
        PodKind::ITEM => NodeKind::Item,
        PodKind::HASHTAG => NodeKind::Hashtag,
        PodKind::PROPOSAL => NodeKind::Proposal,
        PodKind::CAMPAIGN => NodeKind::Campaign,
        PodKind::OFFER => NodeKind::Offer,
        PodKind::Other(other) => return Err(format!("unknown node kind {other}")),
    })
}

/// What a feed row can be: the kinds V1.0 ranks. Later slices add members
/// as their kinds join. A union, not `Node`: a Hashtag is not a Node, and
/// the feed serves topics (GraphQL spec §3.8, *Unions*).
#[derive(Union)]
pub enum FeedItem {
    Post(PostType),
    Comment(CommentType),
    User(User),
    Hashtag(HashtagType),
}

/// Names the hydrated feed's connection `FeedConnection`.
pub struct FeedConnectionName;

impl ConnectionNameType for FeedConnectionName {
    fn type_name<T: async_graphql::OutputType>() -> String {
        "FeedConnection".to_string()
    }
}

/// Names the hydrated feed's edge `FeedEdge`.
pub struct FeedEdgeName;

impl EdgeNameType for FeedEdgeName {
    fn type_name<T: async_graphql::OutputType>() -> String {
        "FeedEdge".to_string()
    }
}

/// A hydrated window of a ranking snapshot.
pub type FeedConnection = Connection<
    String,
    FeedItem,
    EmptyFields,
    EmptyFields,
    FeedConnectionName,
    FeedEdgeName,
    DisableNodesField,
>;

/// The `feed` read: the nodes behind `ordered_ids`, in the given order.
/// An id that resolves to nothing hydratable is skipped; the cursor is
/// the id's slot in the handed list, so skipping never shifts a page.
pub async fn feed(
    pool: &PgPool,
    ordered_ids: Vec<Uuid>,
    first: Option<i32>,
    after: Option<String>,
    last: Option<i32>,
    before: Option<String>,
) -> async_graphql::Result<FeedConnection> {
    if ordered_ids.len() > MAX_PAGE_SIZE as usize {
        return Err(bad_input(format!("at most {MAX_PAGE_SIZE} ids per window")));
    }
    validate_page_args(first, last, after.as_deref(), before.as_deref())
        .map_err(|e| bad_input(e.message))?;
    let decode = |raw: &Option<String>| -> async_graphql::Result<Option<usize>> {
        raw.as_deref()
            .map(|raw| decode_slot_cursor(raw).ok_or_else(|| bad_input("invalid cursor")))
            .transpose()
    };
    let (after, before) = (decode(&after)?, decode(&before)?);
    let backward = last.is_some() || before.is_some();
    let limit = usize::try_from(
        last.or(first)
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(0, MAX_PAGE_SIZE),
    )
    .unwrap_or(0);

    let hydrated = hydrate(pool, &ordered_ids).await?;
    let window: Vec<usize> = (0..ordered_ids.len())
        .filter(|slot| after.is_none_or(|a| *slot > a) && before.is_none_or(|b| *slot < b))
        .filter(|slot| hydrated.contains_key(&ordered_ids[*slot]))
        .collect();
    let has_more = window.len() > limit;
    let page: Vec<usize> = if backward {
        window[window.len().saturating_sub(limit)..].to_vec()
    } else {
        window.into_iter().take(limit).collect()
    };
    let (has_previous, has_next) = if backward {
        (has_more, before.is_some())
    } else {
        (after.is_some(), has_more)
    };
    let mut connection = FeedConnection::new(has_previous, has_next);
    for slot in page {
        let id = ordered_ids[slot];
        let item = match hydrated.get(&id) {
            Some(Hydrated::Content(crate::nodes::ContentNode::Post(post))) => {
                FeedItem::Post(PostType(post.clone()))
            }
            Some(Hydrated::Content(crate::nodes::ContentNode::Comment(comment))) => {
                FeedItem::Comment(CommentType(comment.clone()))
            }
            Some(Hydrated::Person(identity)) => FeedItem::User(User {
                identity: identity.clone(),
                viewer_session: None,
            }),
            Some(Hydrated::Topic(name)) => FeedItem::Hashtag(HashtagType { name: name.clone() }),
            None => continue,
        };
        connection
            .edges
            .push(Edge::new(encode_slot_cursor(slot), item));
    }
    Ok(connection)
}

enum Hydrated {
    Content(crate::nodes::ContentNode),
    Person(store::ActorIdentity),
    Topic(String),
}

/// Every hydratable node among `ids`, in three round trips: content rows,
/// accounts, and the topic registry.
async fn hydrate(pool: &PgPool, ids: &[Uuid]) -> async_graphql::Result<HashMap<Uuid, Hydrated>> {
    let mut out: HashMap<Uuid, Hydrated> = HashMap::new();
    for (id, node) in crate::nodes::resolve_content_many(pool, ids)
        .await
        .map_err(storage)?
    {
        out.insert(id, Hydrated::Content(node));
    }
    for identity in store::actor_identities_by_ids(pool, ids)
        .await
        .map_err(storage)?
    {
        out.insert(identity.id, Hydrated::Person(identity));
    }
    for (id, name) in hashtag::names_by_ids(pool, ids).await.map_err(storage)? {
        out.insert(id, Hydrated::Topic(name));
    }
    Ok(out)
}

fn encode_slot_cursor(slot: usize) -> String {
    B64.encode(format!("feed:{slot}"))
}

fn decode_slot_cursor(raw: &str) -> Option<usize> {
    String::from_utf8(B64.decode(raw).ok()?)
        .ok()?
        .strip_prefix("feed:")?
        .parse()
        .ok()
}
