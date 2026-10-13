//! ´mod:module:api´
//!
//! The pod's reads of the api (ranker-core §4.2 steps 2–3): the governed
//! ranking parameters, and the viewer's slice paged to its end at one
//! pinned epoch. The pod is to the api any anonymous reader — no session,
//! no credential (miner-api.md "Push model").
//!
//! The client is generated at compile time from the api's checked-in
//! `schema.graphql` and the pod's documents (`graphql/api.graphql`), so an
//! api contract change that breaks the pod fails the pod's build.

use std::time::Duration;

use graphql_client::GraphQLQuery;
use ranker::{
    CausalKey, Family, LegRole, NetworkParams, NodeKind, RecencyShape, Slice, SliceLeg, SliceNode,
    SliceRecord, TieBreakerKey,
};

/// The api schema's `UUID` scalar, named as the generated code expects.
#[expect(
    clippy::upper_case_acronyms,
    reason = "graphql_client resolves a custom scalar by its schema name, and schema.graphql names it UUID"
)]
type UUID = uuid::Uuid;
/// The api schema's `RecordId` scalar: L1's record identifier, verbatim.
type RecordId = String;
/// The api schema's `Dimension` scalar: a parameter in `[-1, 1]`.
type Dimension = f64;

#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "../../schema.graphql",
    query_path = "graphql/api.graphql",
    response_derives = "Debug, Clone"
)]
pub struct SliceNodes;

#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "../../schema.graphql",
    query_path = "graphql/api.graphql",
    response_derives = "Debug, Clone"
)]
pub struct SliceRecords;

#[derive(GraphQLQuery)]
#[graphql(
    schema_path = "../../schema.graphql",
    query_path = "graphql/api.graphql",
    response_derives = "Debug, Clone"
)]
pub struct RankingParameters;

/// Records and nodes per slice page: the api's page cap.
pub const PAGE: i64 = 100;

/// The governed parameters the ranking reads (feed-ranking.md §12).
pub const PARAMETER_KEYS: [&str; 6] = [
    "k",
    "gamma",
    "dust_floor",
    "recency_half_life_epochs",
    "recency_shape",
    "tie_breaker_composition",
];

/// Why a read of the api produced nothing usable. Every variant is the
/// pod's `INTERNAL`; the variant is the logged cause.
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("the api is unreachable: {0}")]
    Unreachable(#[from] reqwest::Error),
    #[error("the api's answer does not decode: {0}")]
    Undecodable(String),
    #[error("the api answered a fault: {0}")]
    Fault(String),
    #[error("the published parameter {key} is unusable: {reason}")]
    Parameter { key: String, reason: String },
    #[error("the slice changed epoch between pages: {first} then {later}")]
    Unpinned { first: i64, later: i64 },
    #[error("the slice names a {what} the ranker does not know: {token}")]
    Unknown { what: &'static str, token: String },
}

/// The api, as the pod reads it.
#[derive(Clone)]
pub struct ApiClient {
    http: reqwest::Client,
    url: String,
}

impl ApiClient {
    pub fn new(url: &str, timeout: Duration) -> Result<Self, reqwest::Error> {
        Ok(Self {
            http: reqwest::Client::builder().timeout(timeout).build()?,
            url: url.to_string(),
        })
    }

    async fn call<Q: GraphQLQuery>(
        &self,
        variables: Q::Variables,
    ) -> Result<Q::ResponseData, ApiError> {
        let body = serde_json::to_vec(&Q::build_query(variables))
            .map_err(|e| ApiError::Undecodable(e.to_string()))?;
        let response = self
            .http
            .post(&self.url)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(body)
            .send()
            .await?;
        let status = response.status();
        let bytes = response.bytes().await?;
        let answer: graphql_client::Response<Q::ResponseData> = serde_json::from_slice(&bytes)
            .map_err(|e| ApiError::Undecodable(format!("HTTP {status}: {e}")))?;
        if let Some(error) = answer.errors.as_deref().and_then(<[_]>::first) {
            return Err(ApiError::Fault(error.message.clone()));
        }
        answer
            .data
            .ok_or_else(|| ApiError::Undecodable(format!("HTTP {status}: no data and no error")))
    }

    /// The governed ranking parameters, from the published carrier.
    ///
    /// A composition naming a key the ruled vocabulary lacks is refused,
    /// never mapped: an instance whose genesis predates the ruling must be
    /// re-genesised, and translating old names silently would be a
    /// divergent computation (ranked-feed-api §6.2, X-4).
    pub async fn parameters(&self) -> Result<NetworkParams, ApiError> {
        let data = self
            .call::<RankingParameters>(ranking_parameters::Variables {
                keys: Some(PARAMETER_KEYS.iter().map(|k| k.to_string()).collect()),
            })
            .await?;
        let read = |key: &str| -> Result<serde_json::Value, ApiError> {
            let raw = data
                .network_parameters
                .iter()
                .find(|p| p.key == key)
                .ok_or_else(|| ApiError::Parameter {
                    key: key.to_string(),
                    reason: "not published".into(),
                })?;
            serde_json::from_str(&raw.value).map_err(|e| ApiError::Parameter {
                key: key.to_string(),
                reason: e.to_string(),
            })
        };
        let bad = |key: &str, reason: &str| ApiError::Parameter {
            key: key.to_string(),
            reason: reason.to_string(),
        };
        let k = read("k")?
            .as_u64()
            .and_then(|k| u32::try_from(k).ok())
            .ok_or_else(|| bad("k", "not a whole number"))?;
        let gamma = read("gamma")?
            .as_f64()
            .ok_or_else(|| bad("gamma", "not a number"))?;
        let dust_floor = read("dust_floor")?
            .as_f64()
            .ok_or_else(|| bad("dust_floor", "not a number"))?;
        let half_life_epochs = read("recency_half_life_epochs")?
            .as_u64()
            .and_then(|h| u32::try_from(h).ok())
            .ok_or_else(|| bad("recency_half_life_epochs", "not a whole number"))?;
        let shape = read("recency_shape")?
            .as_str()
            .and_then(RecencyShape::from_parameter)
            .ok_or_else(|| bad("recency_shape", "not a known shape"))?;
        let composition = read("tie_breaker_composition")?;
        let names = composition
            .as_array()
            .ok_or_else(|| bad("tie_breaker_composition", "not a list"))?;
        let mut tie_breakers = Vec::with_capacity(names.len());
        for name in names {
            let key = name
                .as_str()
                .and_then(TieBreakerKey::from_parameter)
                .ok_or_else(|| {
                    bad(
                        "tie_breaker_composition",
                        &format!(
                            "{name} is no ruled key — the composition predates PR-19; re-genesis this instance"
                        ),
                    )
                })?;
            tie_breakers.push(key);
        }
        Ok(NetworkParams {
            k,
            gamma,
            dust_floor,
            half_life_epochs,
            shape,
            tie_breakers,
        })
    }

    /// The viewer's slice, every page, at one epoch: the first page pins
    /// it, and every later page is read at that pin. `None` when the api
    /// finds no rankable actor for the viewer.
    pub async fn slice(
        &self,
        viewer: uuid::Uuid,
        dust_floor: Option<f64>,
        gamma: Option<f64>,
        as_of_epoch: Option<i64>,
    ) -> Result<Option<Slice>, ApiError> {
        let mut pin = as_of_epoch;
        let mut nodes = Vec::new();
        let mut after = None;
        loop {
            let data = self
                .call::<SliceNodes>(slice_nodes::Variables {
                    viewer,
                    dust_floor,
                    gamma,
                    as_of_epoch: pin,
                    first: Some(PAGE),
                    after: after.take(),
                })
                .await?;
            let Some(slice) = data.feed_slice else {
                return Ok(None);
            };
            check_pin(&mut pin, slice.as_of_epoch)?;
            for edge in slice.nodes.edges {
                nodes.push(node(edge.node)?);
            }
            if !slice.nodes.page_info.has_next_page {
                break;
            }
            after = slice.nodes.page_info.end_cursor;
        }
        let mut records = Vec::new();
        let mut after = None;
        loop {
            let data = self
                .call::<SliceRecords>(slice_records::Variables {
                    viewer,
                    dust_floor,
                    gamma,
                    as_of_epoch: pin,
                    first: Some(PAGE),
                    after: after.take(),
                })
                .await?;
            let Some(slice) = data.feed_slice else {
                return Ok(None);
            };
            check_pin(&mut pin, slice.as_of_epoch)?;
            for edge in slice.records.edges {
                records.push(record(edge.node)?);
            }
            if !slice.records.page_info.has_next_page {
                break;
            }
            after = slice.records.page_info.end_cursor;
        }
        let Some(as_of_epoch) = pin else {
            return Err(ApiError::Undecodable("a slice without an epoch".into()));
        };
        Ok(Some(Slice {
            as_of_epoch,
            viewer: viewer.to_string(),
            nodes,
            records,
        }))
    }
}

fn check_pin(pin: &mut Option<i64>, read: i64) -> Result<(), ApiError> {
    match *pin {
        None => {
            *pin = Some(read);
            Ok(())
        }
        Some(first) if first == read => Ok(()),
        Some(first) => Err(ApiError::Unpinned { first, later: read }),
    }
}

fn kind(kind: &slice_nodes::NodeKind) -> Result<NodeKind, ApiError> {
    use slice_nodes::NodeKind as Wire;
    Ok(match kind {
        Wire::USER => NodeKind::User,
        Wire::COLLECTIVE => NodeKind::Collective,
        Wire::POST => NodeKind::Post,
        Wire::COMMENT => NodeKind::Comment,
        Wire::CHAT => NodeKind::Chat,
        Wire::CHAT_MESSAGE => NodeKind::ChatMessage,
        Wire::ITEM => NodeKind::Item,
        Wire::HASHTAG => NodeKind::Hashtag,
        Wire::PROPOSAL => NodeKind::Proposal,
        Wire::CAMPAIGN => NodeKind::Campaign,
        Wire::OFFER => NodeKind::Offer,
        Wire::Other(token) => {
            return Err(ApiError::Unknown {
                what: "node kind",
                token: token.clone(),
            });
        }
    })
}

fn node(wire: slice_nodes::SliceNodesFeedSliceNodesEdgesNode) -> Result<SliceNode, ApiError> {
    Ok(SliceNode {
        graph_id: wire.graph_id,
        id: wire.id.map(|id| id.to_string()),
        kind: wire.kind.as_ref().map(kind).transpose()?,
        genesis: wire.genesis.map(|g| CausalKey {
            landing_epoch: g.landing_epoch,
            act_time: g.act_time,
            position: g.position,
        }),
        statistics: None,
    })
}

fn family(family: &slice_records::RecordFamily) -> Result<Family, ApiError> {
    use slice_records::RecordFamily as Wire;
    Ok(match family {
        Wire::REGISTRATION => Family::Registration,
        Wire::PUBLISH => Family::Publish,
        Wire::OPINION => Family::Opinion,
        Wire::AFFINITY => Family::Affinity,
        Wire::PARTICIPANT => Family::Participant,
        Wire::OWNER => Family::Owner,
        Wire::JOIN_REQUEST => Family::JoinRequest,
        Wire::ACCEPT => Family::Accept,
        Wire::RATIFY => Family::Ratify,
        Wire::WITHDRAW => Family::Withdraw,
        Wire::RESCIND => Family::Rescind,
        Wire::LEAVE => Family::Leave,
        Wire::TAG => Family::Tag,
        Wire::REVIEW => Family::Review,
        Wire::BID => Family::Bid,
        Wire::INVITATION => Family::Invitation,
        Wire::DE_INVITE => Family::DeInvite,
        Wire::SEND => Family::Send,
        Wire::REFERENCE => Family::Reference,
        Wire::Other(token) => {
            return Err(ApiError::Unknown {
                what: "family",
                token: token.clone(),
            });
        }
    })
}

fn role(role: &slice_records::RecordLegRole) -> Result<LegRole, ApiError> {
    use slice_records::RecordLegRole as Wire;
    match role {
        Wire::BINARY => Ok(LegRole::Binary),
        Wire::A => Ok(LegRole::A),
        Wire::T => Ok(LegRole::T),
        Wire::Other(token) => Err(ApiError::Unknown {
            what: "leg role",
            token: token.clone(),
        }),
    }
}

fn record(
    wire: slice_records::SliceRecordsFeedSliceRecordsEdgesNode,
) -> Result<SliceRecord, ApiError> {
    let legs = wire
        .legs
        .iter()
        .map(|leg| {
            Ok(SliceLeg {
                role: role(&leg.role)?,
                source: leg.source_id.clone(),
                target: leg.target_id.clone(),
                p_d: leg.p_directed,
                p_i: leg.p_interest,
                tau: leg.maturity,
                census_unknown: leg.census_unknown,
            })
        })
        .collect::<Result<Vec<_>, ApiError>>()?;
    Ok(SliceRecord {
        record_id: wire.id,
        family: family(&wire.family)?,
        author: wire.author_id,
        key: CausalKey {
            landing_epoch: wire.landing_epoch,
            act_time: wire.act_time,
            position: wire.position,
        },
        legs,
    })
}
