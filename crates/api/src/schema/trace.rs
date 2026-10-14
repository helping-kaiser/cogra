//! ´mod:module:trace´
//!
//! The live trace read, `feedTrace` (api-spec.md "Feed"; ranked-feed-api
//! §4.11, X-SR1): the paths behind one thing's standing in a viewer's
//! view. Paths are never stored, so every trace is a real live fetch
//! (PR-39): the answer is what the latest ranking of the thing finds, and
//! the reader's card adopts it — client state, never written here, and
//! never a reason to re-order a feed.
//!
//! **No pin.** The read takes no `asOfEpoch` and answers none: a client
//! has no use for one, and an echoed epoch invites a re-pin. The relay
//! picks the epoch itself — the mirror cursor at call time, exactly as an
//! unpinned `feedRanking` does — and passes it to the pod's `rankSearch`
//! explicitly, so one pin-resolution path serves both reads and the pod's
//! slice pages stay one consistent snapshot from the first page.
//!
//! **The relay computes nothing.** The pod extracts; the relay hydrates the
//! id-level wire (RC-G1 (c)) — node identifiers into `SliceNode`s, record
//! identifiers into public `Record`s — and keeps the pod's order of paths
//! and of hop members. No figure is summed, re-sorted or re-derived here.

use std::collections::{HashMap, HashSet};

use async_graphql::{Context, ErrorExtensions, SimpleObject};
use postgres_store::{PgPool, mirror};
use uuid::Uuid;

use super::feed::{SliceNode, slice_nodes};
use super::types::Record;
use crate::ranker_pod::{
    PodError, PodTrace, PodTracePath, RankerClient, TraceFriendAuthorReorder, TraceRankParams,
    TraceVariables,
};

fn internal(message: impl Into<String>) -> async_graphql::Error {
    async_graphql::Error::new(message).extend_with(|_, e| e.set("code", "INTERNAL"))
}

fn storage(e: impl std::fmt::Display) -> async_graphql::Error {
    tracing::error!(error = %e, "trace read failed");
    internal("the read failed")
}

/// One thing's standing in a viewer's view, as this read found it.
#[derive(SimpleObject)]
pub struct FeedTrace {
    /// S(viewer, target) — the signed greedy disjoint-sum (feed-ranking.md
    /// §6.1) — as this read found it. Null when no live path reaches the
    /// target: unreached, unknown, or moved on.
    pub score: Option<f64>,
    /// The extracted paths behind `score`, in extraction order (strongest
    /// first); their contributions add up to it. Empty when `score` is
    /// null.
    pub paths: Vec<RankPath>,
}

/// One extracted path from the viewer to the target.
#[derive(SimpleObject)]
pub struct RankPath {
    /// The path's nodes, viewer → … → target, persons as one node under
    /// their profile identifier.
    pub nodes: Vec<SliceNode>,
    /// The path's hops: hop `i` crosses `nodes[i]` → `nodes[i + 1]`.
    pub hops: Vec<RankHop>,
    /// σ(π): +1 or −1.
    pub sign: i32,
    /// σ(π)·m(π)·f(Δt): this path's term of the score.
    pub contribution: f64,
    /// m(π) = ∏ γ·w̃ over the hops. For spot-checks; never drawn.
    pub magnitude: f64,
    /// f(Δt) of the path's terminal stance record. For spot-checks; never
    /// drawn.
    pub recency: f64,
}

/// One folded hop: a per-author bundle netted into an effective edge
/// (feed-ranking.md §3.2).
#[derive(SimpleObject)]
pub struct RankHop {
    /// The bundle's folded directed parameter p̄_d.
    pub p_directed: f64,
    /// The bundle's folded interest parameter p̄_i.
    pub p_interest: f64,
    /// This hop's factor γ·w̃. For spot-checks; never drawn.
    pub weight: f64,
    /// Exactly the fold's member records, in the causal order. The leg a
    /// member contributes is the one in its `legs` whose ends are the
    /// hop's, persons folded (`addr:a` is `prof:a`).
    pub records: Vec<Record>,
}

/// The `feedTrace` relay. Null when `viewer` resolves to no rankable
/// actor; a target the ranking leaves absent is an answer with no paths,
/// never an error.
pub async fn feed_trace(
    ctx: &Context<'_>,
    viewer: Uuid,
    target: Uuid,
) -> async_graphql::Result<Option<FeedTrace>> {
    let pool = ctx.data::<PgPool>()?;
    let ranker = ctx.data::<RankerClient>()?;
    let epoch = mirror::last_ingested_epoch(pool).await.map_err(storage)?;
    if epoch < 0 {
        return Ok(None);
    }
    let answer = match ranker
        .trace(TraceVariables {
            viewer,
            candidates: vec![target],
            params: TraceRankParams {
                kinds: None,
                topic: None,
                gamma: None,
                dust_floor: None,
                recency_half_life_epochs: None,
                friend_author_reorder: Some(TraceFriendAuthorReorder {
                    enabled: false,
                    freshness_threshold_epochs: None,
                    placement: None,
                }),
                settling: None,
            },
            as_of_epoch: Some(epoch),
        })
        .await
    {
        Ok(answer) => answer,
        Err(PodError::NotFound) => return Ok(None),
        Err(PodError::BadInput(message)) => {
            tracing::error!(
                %viewer,
                pod_message = %message,
                "the ranker pod refused the trace request as bad input: a relay bug"
            );
            return Err(internal("the trace failed"));
        }
        Err(e) => {
            tracing::error!(%viewer, %target, error = %e, "the ranker pod produced no trace");
            return Err(internal("the trace failed"));
        }
    };
    let malformed = |malformed: String| {
        tracing::error!(%viewer, %target, %malformed, "pod trace answer malformed");
        internal("the trace failed")
    };
    let Some((score, paths)) = the_entry(answer, epoch, target).map_err(malformed)? else {
        return Ok(Some(FeedTrace {
            score: None,
            paths: Vec::new(),
        }));
    };
    let paths = hydrate(pool, paths, epoch).await?.map_err(malformed)?;
    Ok(Some(FeedTrace {
        score: Some(score),
        paths,
    }))
}

/// The one entry the pod answered for `target`, if any, as its score and
/// paths. An `Err` names what is malformed: an answer at another epoch
/// than the one asked, or an entry for anything but the target.
fn the_entry(
    answer: PodTrace,
    epoch: i64,
    target: Uuid,
) -> Result<Option<(f64, Vec<PodTracePath>)>, String> {
    if answer.as_of_epoch != epoch {
        return Err(format!(
            "traced at epoch {} where {epoch} was asked",
            answer.as_of_epoch
        ));
    }
    let mut entries = answer.entries.into_iter();
    let entry = entries.next();
    if entries.next().is_some() {
        return Err("more than one entry for one target".to_string());
    }
    match entry {
        None => Ok(None),
        Some(entry) if entry.target_id == target => Ok(Some((entry.score, entry.paths))),
        Some(entry) => Err(format!(
            "an entry for {} in a trace of {target}",
            entry.target_id
        )),
    }
}

/// The pod's paths in the public shapes, in the pod's order: node ids as
/// `SliceNode`s typed at `epoch`, record ids as the mirror's `Record`s.
/// The inner `Err` names a record the mirror does not hold — an answer
/// the slice could not have produced.
async fn hydrate(
    pool: &PgPool,
    paths: Vec<PodTracePath>,
    epoch: i64,
) -> async_graphql::Result<Result<Vec<RankPath>, String>> {
    let mut node_ids: Vec<String> = Vec::new();
    let mut seen_nodes = HashSet::new();
    let mut record_ids: Vec<String> = Vec::new();
    let mut seen_records = HashSet::new();
    for path in &paths {
        for id in &path.node_ids {
            if seen_nodes.insert(id.clone()) {
                node_ids.push(id.clone());
            }
        }
        for id in path.hops.iter().flat_map(|hop| &hop.record_ids) {
            if seen_records.insert(id.clone()) {
                record_ids.push(id.clone());
            }
        }
    }
    let nodes: HashMap<String, SliceNode> = slice_nodes(pool, node_ids, epoch)
        .await?
        .into_iter()
        .map(|node| (node.graph_id.clone(), node))
        .collect();
    let records = mirror::records_by_ids(pool, &record_ids)
        .await
        .map_err(storage)?;
    Ok(paths
        .into_iter()
        .map(|path| {
            Ok(RankPath {
                nodes: path
                    .node_ids
                    .iter()
                    .map(|id| {
                        nodes
                            .get(id)
                            .cloned()
                            .ok_or_else(|| format!("node {id} did not hydrate"))
                    })
                    .collect::<Result<_, String>>()?,
                hops: path
                    .hops
                    .into_iter()
                    .map(|hop| {
                        Ok(RankHop {
                            p_directed: hop.p_directed,
                            p_interest: hop.p_interest,
                            weight: hop.weight,
                            records: hop
                                .record_ids
                                .iter()
                                .map(|id| {
                                    records
                                        .get(id)
                                        .cloned()
                                        .map(Record)
                                        .ok_or_else(|| format!("record {id} is not in the mirror"))
                                })
                                .collect::<Result<_, String>>()?,
                        })
                    })
                    .collect::<Result<_, String>>()?,
                sign: i32::try_from(path.sign)
                    .map_err(|_| format!("sign {} is not ±1", path.sign))?,
                contribution: path.contribution,
                magnitude: path.magnitude,
                recency: path.recency,
            })
        })
        .collect())
}
