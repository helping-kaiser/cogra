//! ´mod:module:schema´
//!
//! The pod's own GraphQL schema (ranker-core §4–§5; miner-api.md "Wire
//! form"): `rank` and `rankSearch` over the id-level wire (RC-G1 (c)) —
//! nodes are raw L1 identifiers and records their L1 ids, and the api's
//! relay hydrates. Its exported SDL is the checked-in
//! `ranker-schema.graphql`, which the relay generates its client from.
//!
//! Faults are transport errors with `extensions.code`, from the shared
//! vocabulary (api-spec.md): `NOT_FOUND` when the slice is null (no
//! rankable actor), `BAD_INPUT` for a parameter out of range, an unknown
//! settling family or a friend-fresh reorder asked for, and `INTERNAL` for
//! everything the caller cannot repair — an unreachable api, unusable
//! published parameters, a malformed slice, or a family the ranker does
//! not fold yet. Every `INTERNAL` is logged with its cause.

use async_graphql::{
    Context, EmptyMutation, EmptySubscription, Enum, ErrorExtensions, InputObject, Object, Schema,
    SimpleObject,
};
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::api::{ApiClient, ApiError};

pub type RankerSchema = Schema<Query, EmptyMutation, EmptySubscription>;

/// Builds the schema over an api client. Introspection is a dev-build
/// convenience, off in release as on the api.
pub fn build(api: ApiClient) -> RankerSchema {
    let builder = Schema::build(Query, EmptyMutation, EmptySubscription).data(api);
    if cfg!(debug_assertions) {
        builder.finish()
    } else {
        builder.disable_introspection().finish()
    }
}

/// The schema's SDL — `make ranker-schema` writes it to
/// `ranker-schema.graphql`.
pub fn sdl() -> String {
    Schema::build(Query, EmptyMutation, EmptySubscription)
        .finish()
        .sdl()
}

/// A rankable node's kind — the api's `NodeKind`, verbatim.
#[derive(Enum, Copy, Clone, Debug, PartialEq, Eq)]
pub enum NodeKind {
    User,
    Collective,
    Post,
    Comment,
    Chat,
    ChatMessage,
    Item,
    Hashtag,
    Proposal,
    Campaign,
    Offer,
}

impl NodeKind {
    fn ranker(self) -> ranker::NodeKind {
        match self {
            NodeKind::User => ranker::NodeKind::User,
            NodeKind::Collective => ranker::NodeKind::Collective,
            NodeKind::Post => ranker::NodeKind::Post,
            NodeKind::Comment => ranker::NodeKind::Comment,
            NodeKind::Chat => ranker::NodeKind::Chat,
            NodeKind::ChatMessage => ranker::NodeKind::ChatMessage,
            NodeKind::Item => ranker::NodeKind::Item,
            NodeKind::Hashtag => ranker::NodeKind::Hashtag,
            NodeKind::Proposal => ranker::NodeKind::Proposal,
            NodeKind::Campaign => ranker::NodeKind::Campaign,
            NodeKind::Offer => ranker::NodeKind::Offer,
        }
    }

    fn of(kind: ranker::NodeKind) -> NodeKind {
        match kind {
            ranker::NodeKind::User => NodeKind::User,
            ranker::NodeKind::Collective => NodeKind::Collective,
            ranker::NodeKind::Post => NodeKind::Post,
            ranker::NodeKind::Comment => NodeKind::Comment,
            ranker::NodeKind::Chat => NodeKind::Chat,
            ranker::NodeKind::ChatMessage => NodeKind::ChatMessage,
            ranker::NodeKind::Item => NodeKind::Item,
            ranker::NodeKind::Hashtag => NodeKind::Hashtag,
            ranker::NodeKind::Proposal => NodeKind::Proposal,
            ranker::NodeKind::Campaign => NodeKind::Campaign,
            ranker::NodeKind::Offer => NodeKind::Offer,
        }
    }
}

/// How the viewer holds the person behind a row (OS-18 S1).
#[derive(Enum, Copy, Clone, Debug, PartialEq, Eq)]
pub enum PeopleMark {
    For,
    Against,
    Signless,
}

impl PeopleMark {
    fn of(mark: ranker::PeopleMark) -> PeopleMark {
        match mark {
            ranker::PeopleMark::For => PeopleMark::For,
            ranker::PeopleMark::Against => PeopleMark::Against,
            ranker::PeopleMark::Signless => PeopleMark::Signless,
        }
    }
}

/// Where friend-authored fresh posts would land relative to the ranked
/// feed (miner-api.md).
#[derive(Enum, Copy, Clone, Debug, PartialEq, Eq)]
pub enum FriendAuthorPlacement {
    Interleaved,
    Above,
}

/// The friend-fresh reorder (feed-ranking.md §9.2). Post-MVP (PR-18): the
/// pod accepts it only switched off.
#[derive(InputObject, Clone, Debug)]
pub struct FriendAuthorReorder {
    pub enabled: bool,
    /// Epoch-age threshold on the author's Publish record.
    pub freshness_threshold_epochs: Option<i32>,
    pub placement: Option<FriendAuthorPlacement>,
}

/// A piece of content still settling, with the authorship record it was
/// born with (ranked-feed-api §4.10).
#[derive(InputObject, Clone, Debug)]
pub struct SettlingCandidate {
    /// Opaque correlation: CoGra's id for the node. The pod echoes it and
    /// reads nothing else from it.
    #[graphql(name = "ref")]
    pub reference: Uuid,
    /// The author's person node in the slice's own key form
    /// (`SliceNode.graphId`): `prof:<atom>`.
    pub author: String,
    /// The authorship record's census family (`publish`, `review`, …); it
    /// fixes domain, mask and tier.
    pub family: String,
    /// The staged record's own authored parameters.
    pub p_directed: f64,
    pub p_interest: f64,
    /// The authoring instant: the in-gap tie-break under RANKED and the
    /// order under NEWEST. Never compared with a causal key.
    pub authored_at: DateTime<Utc>,
}

/// The viewer's ranking parameters. Only arguments that change what the
/// ranker computes ride here; the reader's own cuts (seen, people, order,
/// Still settling) are applied on the reader's device.
#[derive(InputObject, Clone, Debug, Default)]
pub struct RankParams {
    /// Rankable kinds in scope. Null means Posts only; an empty list ranks
    /// nothing.
    pub kinds: Option<Vec<NodeKind>>,
    /// A topic (Hashtag id): only content reaching the viewer over Tag
    /// records toward it is a candidate (hashtag.md §5). Null: no
    /// narrowing.
    pub topic: Option<Uuid>,
    /// γ per-hop attenuation in (0, 1]; null: the network default.
    pub gamma: Option<f64>,
    /// χ dust floor, finer than or equal to the network's; null: the
    /// network default.
    pub dust_floor: Option<f64>,
    /// f(Δt) half-life in epochs, 0 disabling recency; null: the network
    /// default.
    pub recency_half_life_epochs: Option<i32>,
    /// Friend-fresh reorder config (feed-ranking.md §9.2); only `enabled:
    /// false` is accepted until the reorder is built.
    pub friend_author_reorder: Option<FriendAuthorReorder>,
    /// Content still settling, each with its own authorship edge. The pod
    /// weaves each candidate whose author a live path reaches, and leaves
    /// the rest unplaced.
    pub settling: Option<Vec<SettlingCandidate>>,
}

/// The tie-breaker cascade's inputs (feed-ranking.md §7). A statistic
/// rides exactly when the governed composition names it.
#[derive(SimpleObject, Clone, Debug)]
pub struct TieBreakers {
    pub net_stance: Option<f64>,
    pub gross_volume: Option<f64>,
    /// Epoch age of the target's genesis record, for display — an update
    /// never refreshes it; null for an authorless Type.
    pub genesis_epoch_age: Option<i64>,
}

/// One raw member record of a hop's bundle, with this leg's parameters,
/// so the hop re-folds from the answer alone.
#[derive(SimpleObject, Clone, Debug)]
pub struct HopMember {
    pub record_id: String,
    pub landing_epoch: i64,
    pub act_time: i64,
    pub position: i64,
    pub p_directed: f64,
    pub p_interest: f64,
    pub maturity: f64,
}

/// One folded hop: a per-author bundle netted into an effective edge
/// (feed-ranking.md §3.2).
#[derive(SimpleObject, Clone, Debug)]
pub struct RankHop {
    /// The bundle's family, as `RecordFamily` spells it.
    pub family: String,
    /// The leg's role, as `RecordLegRole` spells it.
    pub role: String,
    /// The bundle's author, a bare address atom.
    pub author_id: String,
    pub source_id: String,
    pub target_id: String,
    /// The member records' L1 ids, in ≺.
    pub record_ids: Vec<String>,
    pub members: Vec<HopMember>,
    /// The folded parameters (p̄_d, p̄_i).
    pub p_directed: f64,
    pub p_interest: f64,
    /// The ≺-newest member's leg maturity.
    pub maturity: f64,
    /// This hop's factor: γ·w̃ of the folded leg.
    pub weight: f64,
}

/// One extracted path from the viewer to the target, persons as one node.
#[derive(SimpleObject, Clone, Debug)]
pub struct RankPath {
    /// Raw L1 identifiers, viewer → … → target.
    pub node_ids: Vec<String>,
    pub hops: Vec<RankHop>,
    /// σ(π): +1 or −1.
    pub sign: i32,
    /// m(π) = ∏ γ·w̃ over the hops.
    pub magnitude: f64,
    /// f(Δt) of the path's terminal stance record.
    pub recency: f64,
    /// σ(π)·m(π)·f(Δt).
    pub contribution: f64,
}

/// One ranked target, at the id level (RC-G1 (c)); the relay hydrates.
#[derive(SimpleObject, Clone, Debug)]
pub struct FeedEntry {
    pub target_id: Uuid,
    pub target_kind: NodeKind,
    /// S(u, target) — the signed greedy disjoint-sum (feed-ranking.md §6.1).
    pub score: f64,
    pub tie_breakers: TieBreakers,
    /// The viewer's held opinion of the person behind the row, at the pin
    /// (OS-18 S1). Null when none is held, and for a Tags row.
    pub mark: Option<PeopleMark>,
    /// This entry's 0-based index among `entries` in NEWEST order (genesis
    /// causal key, newest first). A permutation of 0..|entries|-1.
    pub newest_index: i32,
    /// The extracted paths behind the score, strongest first.
    pub paths: Vec<RankPath>,
}

/// One woven settling candidate.
#[derive(SimpleObject, Clone, Debug)]
pub struct SettlingPlace {
    #[graphql(name = "ref")]
    pub reference: Uuid,
    /// As FeedEntry.mark, by the candidate's author.
    pub mark: Option<PeopleMark>,
    /// 0-based index in the woven RANKED list (entries and places
    /// together).
    pub ranked_position: i32,
    /// 0-based index in the woven NEWEST list.
    pub newest_position: i32,
}

/// One ranking.
#[derive(SimpleObject, Clone, Debug)]
pub struct FeedRanking {
    /// The epoch the ranked slice reads as of.
    pub as_of_epoch: i64,
    /// The landed targets, scored, in RANKED order, best first. A target no
    /// live path reaches is absent, not zero-scored.
    pub entries: Vec<FeedEntry>,
    /// The placed settling candidates; an unplaced candidate is absent.
    pub settling: Vec<SettlingPlace>,
}

fn fault(code: &'static str, message: impl Into<String>) -> async_graphql::Error {
    async_graphql::Error::new(message).extend_with(|_, e| e.set("code", code))
}

fn internal(cause: &dyn std::fmt::Display) -> async_graphql::Error {
    tracing::error!(cause = %cause, "the ranking failed");
    fault("INTERNAL", "the ranking failed")
}

fn bad_input(field: &str, reason: &str) -> async_graphql::Error {
    fault("BAD_INPUT", format!("{field}: {reason}"))
}

fn from_rank_error(error: ranker::RankError) -> async_graphql::Error {
    match error {
        ranker::RankError::BadInput { field, reason } => bad_input(&field, &reason),
        ranker::RankError::UnsupportedFamily { record_id, family } => {
            tracing::error!(%record_id, %family, "the slice holds a family the ranker does not fold yet");
            fault("INTERNAL", "the ranking failed")
        }
        other => internal(&other),
    }
}

fn from_api_error(error: ApiError) -> async_graphql::Error {
    internal(&error)
}

/// Converts the request's parameters, refusing what the ranker cannot
/// honour before anything is fetched.
fn ranker_params(params: &RankParams) -> Result<ranker::RankParams, async_graphql::Error> {
    if params
        .friend_author_reorder
        .as_ref()
        .is_some_and(|r| r.enabled)
    {
        return Err(bad_input(
            "friendAuthorReorder",
            "the friend-fresh reorder is not built (PR-18); send it disabled",
        ));
    }
    Ok(ranker::RankParams {
        kinds: params
            .kinds
            .as_ref()
            .map(|kinds| kinds.iter().map(|k| k.ranker()).collect()),
        topic: params.topic.map(|t| t.to_string()),
        gamma: params.gamma,
        dust_floor: params.dust_floor,
        half_life_epochs: params.recency_half_life_epochs.map(i64::from),
        seen: Vec::new(),
    })
}

fn settling_candidates(
    params: &RankParams,
) -> Result<Vec<ranker::SettlingCandidate>, async_graphql::Error> {
    params
        .settling
        .iter()
        .flatten()
        .map(|c| {
            let family = ranker::Family::from_census(&c.family).ok_or_else(|| {
                bad_input("settling.family", &format!("unknown family {}", c.family))
            })?;
            Ok(ranker::SettlingCandidate {
                reference: c.reference.to_string(),
                author: c.author.clone(),
                family,
                p_d: c.p_directed,
                p_i: c.p_interest,
                authored_at: c.authored_at.timestamp_micros(),
            })
        })
        .collect()
}

fn uuid_of(id: &str) -> Result<Uuid, async_graphql::Error> {
    Uuid::parse_str(id).map_err(|e| internal(&format!("the slice carries a non-UUID id {id}: {e}")))
}

fn index(i: usize) -> Result<i32, async_graphql::Error> {
    i32::try_from(i).map_err(|_| internal(&"an index past i32"))
}

fn answer(ranking: ranker::FeedRanking) -> Result<FeedRanking, async_graphql::Error> {
    let entries = ranking
        .entries
        .into_iter()
        .map(|ranked| {
            let e = ranked.entry;
            Ok(FeedEntry {
                target_id: uuid_of(&e.target_id)?,
                target_kind: NodeKind::of(e.kind),
                score: e.score,
                tie_breakers: TieBreakers {
                    net_stance: e.tie_breakers.net_stance,
                    gross_volume: e.tie_breakers.gross_volume,
                    genesis_epoch_age: e.tie_breakers.genesis_epoch_age,
                },
                mark: ranked.mark.map(PeopleMark::of),
                newest_index: index(ranked.newest_index as usize)?,
                paths: e
                    .paths
                    .into_iter()
                    .map(|p| RankPath {
                        node_ids: p.nodes,
                        hops: p
                            .hops
                            .into_iter()
                            .map(|h| RankHop {
                                family: h.family.wire_name().to_string(),
                                role: h.role.wire_name().to_string(),
                                author_id: h.author,
                                source_id: h.source,
                                target_id: h.target,
                                record_ids: h.members.iter().map(|m| m.record_id.clone()).collect(),
                                members: h
                                    .members
                                    .into_iter()
                                    .map(|m| HopMember {
                                        record_id: m.record_id,
                                        landing_epoch: m.key.landing_epoch,
                                        act_time: m.key.act_time,
                                        position: m.key.position,
                                        p_directed: m.p_d,
                                        p_interest: m.p_i,
                                        maturity: m.tau,
                                    })
                                    .collect(),
                                p_directed: h.p_directed,
                                p_interest: h.p_interest,
                                maturity: h.tau,
                                weight: h.weight,
                            })
                            .collect(),
                        sign: p.sign,
                        magnitude: p.magnitude,
                        recency: p.recency,
                        contribution: p.contribution,
                    })
                    .collect(),
            })
        })
        .collect::<Result<Vec<_>, async_graphql::Error>>()?;
    let settling = ranking
        .settling
        .into_iter()
        .map(|p| {
            Ok(SettlingPlace {
                reference: uuid_of(&p.reference)?,
                mark: p.mark.map(PeopleMark::of),
                ranked_position: index(p.ranked_position as usize)?,
                newest_position: index(p.newest_position as usize)?,
            })
        })
        .collect::<Result<Vec<_>, async_graphql::Error>>()?;
    Ok(FeedRanking {
        as_of_epoch: ranking.as_of_epoch,
        entries,
        settling,
    })
}

/// The governed parameters, the request checked against them, and the
/// slice — or the fault that stopped the way there.
async fn inputs(
    ctx: &Context<'_>,
    viewer: Uuid,
    params: &RankParams,
    as_of_epoch: Option<i64>,
) -> async_graphql::Result<(ranker::Slice, ranker::RankParams, ranker::NetworkParams)> {
    let api = ctx.data::<ApiClient>()?;
    let request = ranker_params(params)?;
    let network = api.parameters().await.map_err(from_api_error)?;
    ranker::check_params(&request, &network).map_err(from_rank_error)?;
    let slice = api
        .slice(viewer, request.dust_floor, request.gamma, as_of_epoch)
        .await
        .map_err(from_api_error)?
        .ok_or_else(|| fault("NOT_FOUND", "the viewer resolves to no rankable actor"))?;
    Ok((slice, request, network))
}

pub struct Query;

#[Object]
impl Query {
    /// Rank `viewer`'s feed over their slice, which the pod fetches itself
    /// from the api (`feedSlice(viewer, dustFloor, gamma, asOfEpoch)`).
    /// `asOfEpoch` pins the slice (null: the newest ingested epoch); a
    /// ranking re-run at the same epoch over the same candidates is
    /// identical.
    async fn rank(
        &self,
        ctx: &Context<'_>,
        viewer: Uuid,
        params: RankParams,
        as_of_epoch: Option<i64>,
    ) -> async_graphql::Result<FeedRanking> {
        let settling = settling_candidates(&params)?;
        let (slice, request, network) = inputs(ctx, viewer, &params, as_of_epoch).await?;
        let ranking =
            ranker::feed_ranking(&slice, &request, &network, &settling).map_err(from_rank_error)?;
        answer(ranking)
    }

    /// Re-order search candidates by the viewer's feed score: the given ids
    /// in, the in-slice subset a live path reaches out, ordered, each with
    /// its paths. Of the params only the calibration fields are read.
    async fn rank_search(
        &self,
        ctx: &Context<'_>,
        viewer: Uuid,
        candidates: Vec<Uuid>,
        params: RankParams,
        as_of_epoch: Option<i64>,
    ) -> async_graphql::Result<FeedRanking> {
        let (slice, request, network) = inputs(ctx, viewer, &params, as_of_epoch).await?;
        let wanted: Vec<String> = candidates.iter().map(Uuid::to_string).collect();
        let ranking =
            ranker::search_ranking(&slice, &wanted, &request, &network).map_err(from_rank_error)?;
        answer(ranking)
    }
}
