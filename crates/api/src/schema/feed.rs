//! ´mod:module:feed´
//!
//! The backend's part in ranking (api-spec.md "Feed"): the governed
//! parameters a ranker reads (`networkParameters`), the viewer's slice it
//! ranks over (`feedSlice`), and the hydration of the ordered ids it
//! hands back (`feed`).
//!
//! Ranking never runs in this process (feed-ranking.md §11). Nothing here
//! orders, weighs or scores: the slice is a reachability closure (see
//! `postgres_store::slice`), and `feed` serves the order it is handed.

use std::collections::HashMap;
use std::sync::Arc;

use async_graphql::connection::{
    Connection, ConnectionNameType, DisableNodesField, Edge, EdgeNameType, EmptyFields,
};
use async_graphql::{Context, ErrorExtensions, Object, SimpleObject, Union};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD as B64;
use common::hashtag_uuid;
use postgres_store::{PgPool, auth as store, hashtag, mirror, params, slice};
use uuid::Uuid;

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
    as_of_epoch: i64,
    reach: Arc<Vec<String>>,
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
