//! ´mod:module:ranked-search´
//!
//! `search(order: RANKED)` (api-spec.md "Search", "Order"; ranked-feed-api
//! §4.8): the matches inside the viewer's slice, ordered by the server's
//! ranker pod, then every other match behind the seam in the matcher's own
//! order.
//!
//! **The candidate bound.** A globally ranked tier cannot come from
//! re-ranking page by page, so the ranker is handed every candidate at
//! once — and the candidates are the matches inside the viewer's slice at
//! the pinned epoch. The slice is viewer-bounded, so the candidate set is
//! too, however many matches the query has. The pod's `rankSearch` orders
//! them; a candidate no live path reaches is absent from its answer and
//! stands behind the seam with the out-of-slice matches.
//!
//! **The relay computes nothing.** The ranked head is the pod's order. The
//! one rearrangement here is the query's own: exact-match tier first
//! (ExploreSearch.md:5, "each tier ordered by the reader's ranker"), a
//! stable partition that keeps the pod's order inside each tier and
//! compares no score. Past the seam the rows are the matcher's — tier,
//! then newest first — minus what the head holds.
//!
//! **Paging reuses the pin.** The first page pins the mirror cursor; the
//! opaque cursor carries that epoch, and every later page recomputes the
//! head at it. A ranking re-run at one epoch over one candidate set is
//! identical (miner-api.md "The operation"), so the order never
//! reshuffles across pages and no server state is kept.

use std::collections::{HashMap, HashSet};

use async_graphql::connection::Edge;
use async_graphql::{Context, Enum, ErrorExtensions};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::hashtag_uuid;
use postgres_store::search::{SearchCursor, SearchHit, SearchRequest, Window};
use postgres_store::{PgPool, auth as store, mirror, slice};
use uuid::Uuid;

use super::query::bad_input;
use super::types::{SearchConnection, SearchConnectionFields, SearchEdgeFields};
use crate::ranker_pod::search::{
    FriendAuthorReorder, PodSearchRanking, RankParams, RankSearchVariables,
};
use crate::ranker_pod::{PodError, RankerClient};

/// How a read orders what it serves: by the viewer's ranker, or by time.
#[derive(Enum, Copy, Clone, Debug, PartialEq, Eq, Default)]
pub enum ReadOrder {
    /// The viewer's ranker orders what their slice reaches; the rest
    /// follows behind, newest first.
    Ranked,
    /// Newest first, viewer-independent.
    #[default]
    Newest,
}

fn internal(message: impl Into<String>) -> async_graphql::Error {
    async_graphql::Error::new(message).extend_with(|_, e| e.set("code", "INTERNAL"))
}

fn storage(e: impl std::fmt::Display) -> async_graphql::Error {
    tracing::error!(error = %e, "ranked search read failed");
    internal("the read failed")
}

/// A position in a ranked result: the pin it was read at, and a slot in
/// the ranked head or a keyset position in the tail behind the seam.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RankedCursor {
    Head { epoch: i64, slot: usize },
    Tail { epoch: i64, at: SearchCursor },
}

impl RankedCursor {
    fn epoch(self) -> i64 {
        match self {
            Self::Head { epoch, .. } | Self::Tail { epoch, .. } => epoch,
        }
    }

    /// The cursor as the wire carries it: opaque per the Relay spec.
    pub fn encode(self) -> String {
        B64.encode(match self {
            Self::Head { epoch, slot } => format!("ranked:{epoch}:h:{slot}"),
            Self::Tail { epoch, at } => format!(
                "ranked:{epoch}:t:{}:{}:{}",
                at.tier,
                at.created_at.timestamp_micros(),
                at.node_id
            ),
        })
    }

    /// A wire cursor back to its position; None for anything a ranked
    /// search did not issue.
    pub fn decode(raw: &str) -> Option<Self> {
        let text = String::from_utf8(B64.decode(raw).ok()?).ok()?;
        let parts: Vec<&str> = text.split(':').collect();
        match parts.as_slice() {
            ["ranked", epoch, "h", slot] => Some(Self::Head {
                epoch: epoch.parse().ok().filter(|e: &i64| *e >= 0)?,
                slot: slot.parse().ok()?,
            }),
            ["ranked", epoch, "t", tier, micros, id] => {
                let tier: i32 = tier.parse().ok()?;
                if !(0..=1).contains(&tier) {
                    return None;
                }
                Some(Self::Tail {
                    epoch: epoch.parse().ok().filter(|e: &i64| *e >= 0)?,
                    at: SearchCursor {
                        tier,
                        created_at: chrono::DateTime::from_timestamp_micros(
                            micros.parse().ok()?,
                        )?,
                        node_id: Uuid::parse_str(id).ok()?,
                    },
                })
            }
            _ => None,
        }
    }
}

/// One row of a ranked page, before hydration.
struct Row {
    hit: SearchHit,
    cursor: RankedCursor,
    /// The ranker's score; None past the seam.
    score: Option<f64>,
}

/// One page of `search(order: RANKED)` for `viewer`. `cursor` is the
/// decoded `after` (forward) or `before` (backward).
pub async fn page(
    ctx: &Context<'_>,
    request: SearchRequest,
    viewer: Uuid,
    cursor: Option<RankedCursor>,
    backward: bool,
    limit: i64,
) -> async_graphql::Result<SearchConnection> {
    let pool = ctx.data::<PgPool>()?;
    let ranker = ctx.data::<RankerClient>()?;
    let mirror_cursor = mirror::last_ingested_epoch(pool).await.map_err(storage)?;
    let pin = match cursor {
        Some(c) if c.epoch() > mirror_cursor => return Err(bad_input("invalid cursor")),
        Some(c) => c.epoch(),
        None => mirror_cursor,
    };
    let head = ranked_head(pool, ranker, &request, viewer, pin).await?;
    let head_ids: Vec<Uuid> = head.iter().map(|(hit, _)| hit.node_id).collect();
    let tail = Window {
        within: None,
        excluding: &head_ids,
    };
    // One row past the page tells whether another page exists.
    let take = usize::try_from(limit).unwrap_or(0) + 1;
    let store_limit = |n: usize| i64::try_from(n).unwrap_or(i64::MAX);
    let head_row = |slot: usize| {
        let (hit, score) = &head[slot];
        Row {
            hit: hit.clone(),
            cursor: RankedCursor::Head { epoch: pin, slot },
            score: Some(*score),
        }
    };
    let tail_page = |at: Option<SearchCursor>, backward: bool, limit: i64| {
        tail_rows(&request, pool, tail, pin, at, backward, limit)
    };

    // The result is the head, then the tail. A walk runs inside one part
    // and crosses into the other when its page has room left.
    let mut rows: Vec<Row> = Vec::new();
    if backward {
        let head_end = match cursor {
            Some(RankedCursor::Head { slot, .. }) => slot.min(head.len()),
            Some(RankedCursor::Tail { at, .. }) => {
                rows = tail_page(Some(at), true, store_limit(take)).await?;
                head.len()
            }
            None => {
                rows = tail_page(None, true, store_limit(take)).await?;
                head.len()
            }
        };
        let room = take.saturating_sub(rows.len());
        let mut page: Vec<Row> = (head_end.saturating_sub(room)..head_end)
            .map(head_row)
            .collect();
        page.append(&mut rows);
        rows = page;
    } else {
        let tail_from = match cursor {
            Some(RankedCursor::Tail { at, .. }) => Some(Some(at)),
            Some(RankedCursor::Head { slot, .. }) => {
                rows = head_slots(slot + 1, take, head.len())
                    .map(head_row)
                    .collect();
                (rows.len() < take).then_some(None)
            }
            None => {
                rows = head_slots(0, take, head.len()).map(head_row).collect();
                (rows.len() < take).then_some(None)
            }
        };
        if let Some(at) = tail_from {
            let room = store_limit(take - rows.len());
            rows.extend(tail_page(at, false, room).await?);
        }
    }

    let has_more = rows.len() >= take;
    if has_more {
        if backward {
            rows.remove(0);
        } else {
            rows.pop();
        }
    }
    let (has_previous, has_next) = if backward {
        (has_more, cursor.is_some())
    } else {
        (cursor.is_some(), has_more)
    };

    let mut placed: HashMap<Uuid, (RankedCursor, Option<f64>)> = rows
        .iter()
        .map(|row| (row.hit.node_id, (row.cursor, row.score)))
        .collect();
    let hydrated = super::query::hydrate(pool, rows.into_iter().map(|r| r.hit).collect()).await?;
    let mut connection = SearchConnection::with_additional_fields(
        has_previous,
        has_next,
        SearchConnectionFields {
            request: Some(request),
        },
    );
    connection
        .edges
        .extend(hydrated.into_iter().filter_map(|(hit, result)| {
            let (cursor, score) = placed.remove(&hit.node_id)?;
            Some(Edge::with_additional_fields(
                cursor.encode(),
                result,
                SearchEdgeFields { score },
            ))
        }));
    Ok(connection)
}

/// The head slots a forward page reads from `start`: at most `take`, never
/// past the head's end.
fn head_slots(start: usize, take: usize, len: usize) -> std::ops::Range<usize> {
    let start = start.min(len);
    start..len.min(start.saturating_add(take))
}

/// One walk of the tail behind the seam: the matcher's order minus the
/// head, at `pin`.
async fn tail_rows(
    request: &SearchRequest,
    pool: &PgPool,
    window: Window<'_>,
    pin: i64,
    at: Option<SearchCursor>,
    backward: bool,
    limit: i64,
) -> async_graphql::Result<Vec<Row>> {
    Ok(request
        .find_in(pool, window, at, backward, limit)
        .await
        .map_err(storage)?
        .into_iter()
        .map(|hit| Row {
            cursor: RankedCursor::Tail {
                epoch: pin,
                at: hit.cursor(),
            },
            hit,
            score: None,
        })
        .collect())
}

/// The ranked head at `pin`: the in-slice candidates in the pod's order,
/// partitioned by the query's exact-match tier, each with its score.
/// Empty, with no pod call, when the viewer resolves to no rankable actor
/// or no match lies in their slice: search must still find, so every
/// match then stands behind the seam.
async fn ranked_head(
    pool: &PgPool,
    ranker: &RankerClient,
    request: &SearchRequest,
    viewer: Uuid,
    pin: i64,
) -> async_graphql::Result<Vec<(SearchHit, f64)>> {
    if pin < 0 {
        return Ok(Vec::new());
    }
    let Some(address) = store::actor_identity(pool, viewer)
        .await
        .map_err(storage)?
        .and_then(|identity| identity.realization_address)
    else {
        return Ok(Vec::new());
    };
    let reach = slice::reach(pool, &address, pin)
        .await
        .map_err(storage)?;
    let mut in_slice: Vec<Uuid> = slice::node_rows(pool, &reach)
        .await
        .map_err(storage)?
        .into_values()
        .map(|row| row.id)
        .collect();
    in_slice.extend(
        reach
            .iter()
            .filter_map(|node| node.strip_prefix("name:"))
            .map(hashtag_uuid),
    );
    if in_slice.is_empty() {
        return Ok(Vec::new());
    }
    let window = Window {
        within: Some(&in_slice),
        excluding: &[],
    };
    let candidates = request
        .find_in(pool, window, None, false, i64::MAX)
        .await
        .map_err(storage)?;
    if candidates.is_empty() {
        return Ok(Vec::new());
    }

    let answer = match ranker
        .rank_search(RankSearchVariables {
            viewer,
            candidates: candidates.iter().map(|hit| hit.node_id).collect(),
            params: RankParams {
                kinds: None,
                topic: None,
                gamma: None,
                dust_floor: None,
                recency_half_life_epochs: None,
                friend_author_reorder: Some(FriendAuthorReorder {
                    enabled: false,
                    freshness_threshold_epochs: None,
                    placement: None,
                }),
                settling: None,
            },
            as_of_epoch: Some(pin),
        })
        .await
    {
        Ok(answer) => answer,
        Err(PodError::NotFound) => return Ok(Vec::new()),
        Err(PodError::BadInput(message)) => {
            tracing::error!(
                %viewer,
                pod_message = %message,
                "the ranker pod refused the ranked-search request as bad input: a relay bug"
            );
            return Err(internal("the ranking failed"));
        }
        Err(e) => {
            tracing::error!(%viewer, error = %e, "the ranker pod produced no search ranking");
            return Err(internal("the ranking failed"));
        }
    };
    head_of(answer, pin, candidates).map_err(|malformed| {
        tracing::error!(%viewer, %malformed, "pod search answer malformed");
        internal("the ranking failed")
    })
}

/// The pod's answer as the ranked head: each entry joined to the match it
/// ranks, in the pod's order, then stably partitioned by tier. An `Err`
/// names what is malformed: an answer at another epoch than the pin, an
/// entry that was never a candidate, or one ranked twice.
fn head_of(
    answer: PodSearchRanking,
    pin: i64,
    candidates: Vec<SearchHit>,
) -> Result<Vec<(SearchHit, f64)>, String> {
    if answer.as_of_epoch != pin {
        return Err(format!(
            "ranked epoch {} where {pin} was pinned",
            answer.as_of_epoch
        ));
    }
    let mut by_id: HashMap<Uuid, SearchHit> = candidates
        .into_iter()
        .map(|hit| (hit.node_id, hit))
        .collect();
    let mut seen = HashSet::new();
    let mut head = answer
        .entries
        .into_iter()
        .map(|entry| {
            if !seen.insert(entry.target_id) {
                return Err(format!("{} ranked twice", entry.target_id));
            }
            let hit = by_id
                .remove(&entry.target_id)
                .ok_or_else(|| format!("{} was never a candidate", entry.target_id))?;
            Ok((hit, entry.score))
        })
        .collect::<Result<Vec<_>, String>>()?;
    head.sort_by_key(|(hit, _)| hit.tier);
    Ok(head)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A ranked cursor carries its pin and its place, and decodes back to both; a cursor a ranked search did not issue decodes to nothing.
    /// ´claim:search:a-ranked-cursor-carries-its-pin´
    #[test]
    fn a_ranked_cursor_round_trips_with_its_pin() {
        let head = RankedCursor::Head { epoch: 7, slot: 12 };
        assert_eq!(RankedCursor::decode(&head.encode()), Some(head));
        let tail = RankedCursor::Tail {
            epoch: 3,
            at: SearchCursor {
                tier: 1,
                created_at: chrono::DateTime::from_timestamp_micros(1_791_354_394_123_456)
                    .expect("instant"),
                node_id: Uuid::new_v4(),
            },
        };
        assert_eq!(RankedCursor::decode(&tail.encode()), Some(tail));
        for foreign in [
            "not base64!",
            &B64.encode("ranked:-1:h:0"),
            &B64.encode("ranked:2:h:x"),
            &B64.encode("ranked:2:t:2:0:00000000-0000-0000-0000-000000000000"),
            &B64.encode("search:0:0:00000000-0000-0000-0000-000000000000"),
        ] {
            assert_eq!(RankedCursor::decode(foreign), None, "{foreign}");
        }
    }
}
