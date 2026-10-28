//! ´mod:module:stance´
//!
//! The generic stance gesture (api-spec.md "The generic stance"): one
//! write for sentiment and connection toward any passive node. The target
//! selects the family — Affinity toward a Type, Opinion toward everything
//! else (edges.md §2).
//!
//! The record carries exactly the values picked: one new edge against the
//! author's bundle, never a delta derived from it (design.md §8.1). Where
//! the bundle lands is a read-side fold the picker shows (`bundle`), never
//! folded into what is written.
//!
//! Severance is the one gesture that does state a net: it walks the bundle
//! to `(0, 0)` with counter-records, each its own priced act
//! (feed-ranking.md §8.1).

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::hashtag::canonicalize;
use common::l1::census::Family;
use common::l1::exact::Decimal;
use common::l1::fold::{BundleSum, Standing};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::stance::{BundleView, HeldCursor};
use postgres_store::{PgPool, stance as stance_store};
use uuid::Uuid;

use crate::l1::L1Boundary;
use crate::nodes::{self, NodeError};
use crate::prepare::{self, Gesture, PrepareError, Staging, Target};
use crate::ratelimit::SigningClass;

#[derive(Debug, thiserror::Error)]
pub enum StanceError {
    #[error("{message}")]
    BadInput {
        field: &'static str,
        message: String,
    },
    #[error(transparent)]
    Prepare(#[from] PrepareError),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
    #[error("internal: {0}")]
    Internal(String),
}

impl From<NodeError> for StanceError {
    fn from(e: NodeError) -> Self {
        match e {
            NodeError::Storage(e) => Self::Storage(e),
            NodeError::Internal(m) => Self::Internal(m),
        }
    }
}

/// A resolved stance target: the node the record points at, and the family
/// the census fixes for that node class.
#[derive(Debug, Clone)]
pub struct StanceTarget {
    pub node: NodeId,
    pub family: Family,
    /// The act minting the node while it is still in flight. A stance on
    /// pending content declares it, so the record lands behind the node or
    /// expires with it, never toward a node that never existed.
    pub awaits: Option<ActId>,
}

/// How a stance names the node it points at.
///
/// Almost every stance target is an L2 id, but a Type is not a minted
/// node: it is anchored vacuously, its id is a pure function of its name,
/// and that derivation is one-way. A topic nobody has tagged yet
/// therefore has no registry row to look an id back up in — and it is
/// followable all the same, because the Type exists the moment the name
/// does. So the topic case names the topic (hashtag.md §2; D4).
#[derive(Debug, Clone)]
pub enum TargetRef {
    Node(Uuid),
    Topic(String),
}

impl TargetRef {
    /// The wire's two spellings: exactly one of them, or the request does
    /// not name a target at all.
    pub fn of(target: Option<Uuid>, topic_name: Option<String>) -> Result<Self, StanceError> {
        match (target, topic_name) {
            (Some(id), None) => Ok(Self::Node(id)),
            (None, Some(name)) => Ok(Self::Topic(name)),
            _ => Err(StanceError::BadInput {
                field: "target",
                message: "provide exactly one of target or topicName".into(),
            }),
        }
    }
}

/// Resolves an API reference to the passive node a stance points at.
///
/// Every passive node class is a stance target under the same control and
/// the same fold; the classes whose slices have not landed yet simply have
/// no id to resolve here. A Type resolves to Affinity — the follow-topic
/// gesture — and everything else to Opinion (api-spec.md "The generic
/// stance").
pub async fn resolve_target(
    pool: &PgPool,
    target: &TargetRef,
) -> Result<StanceTarget, StanceError> {
    let (node, awaits) = match target {
        TargetRef::Topic(raw) => {
            let name = canonicalize(raw).map_err(|e| StanceError::BadInput {
                field: "topicName",
                message: e.to_string(),
            })?;
            let node = NodeId::name(&name).map_err(|e| StanceError::Internal(e.to_string()))?;
            (node, None)
        }
        TargetRef::Node(id) => {
            let resolved = resolve_id(pool, *id).await?;
            (resolved.node, resolved.awaits)
        }
    };
    let family = family_for(&node);
    Ok(StanceTarget {
        node,
        family,
        awaits,
    })
}

/// Resolves an L2 id to the node a stance points at, naming `target` as
/// the offending field when nothing answers to the id.
async fn resolve_id(pool: &PgPool, target: Uuid) -> Result<nodes::ResolvedNode, StanceError> {
    nodes::resolve_target(pool, target)
        .await?
        .ok_or_else(|| StanceError::BadInput {
            field: "target",
            message: "no such stance target".into(),
        })
}

/// The family the target's node class fixes. Domain, mask and tier follow
/// from it — never a caller's choice (edges.md §1).
fn family_for(node: &NodeId) -> Family {
    match node {
        NodeId::Name(_) => Family::Affinity,
        _ => Family::Opinion,
    }
}

/// A bundle read together with the node it points at — the node a stance
/// or severance toward it will name, which the device binds its acts to.
#[derive(Debug, Clone)]
pub struct TargetBundle {
    pub node: NodeId,
    pub standing: Standing,
}

/// The author's bundle toward a target — the read the pad's readout folds
/// (design.md §8.2). Returns the raw sums; the clip is `BundleSum::fold`,
/// and whether the bundle is severed or says nothing is the standing's own
/// reading (`Standing`).
pub async fn bundle(
    pool: &PgPool,
    viewer: Uuid,
    target: Uuid,
    include_pending: bool,
) -> Result<TargetBundle, StanceError> {
    let author = author_address(pool, viewer).await?;
    let resolved = resolve_target(pool, &TargetRef::Node(target)).await?;
    let standing = read_standing(pool, &author, &resolved, include_pending).await?;
    Ok(TargetBundle {
        node: resolved.node,
        standing,
    })
}

/// The viewer's bundle toward a Type named by name — the read behind a
/// topic page's follow control, which has to work on a topic that has
/// never been tagged and so has no id to look up.
pub async fn topic_bundle(
    pool: &PgPool,
    viewer: Uuid,
    canonical_name: &str,
    include_pending: bool,
) -> Result<TargetBundle, StanceError> {
    let author = author_address(pool, viewer).await?;
    let resolved = resolve_target(pool, &TargetRef::Topic(canonical_name.to_string())).await?;
    let standing = read_standing(pool, &author, &resolved, include_pending).await?;
    Ok(TargetBundle {
        node: resolved.node,
        standing,
    })
}

/// The author's Publish bundle toward their own post: the sums of every
/// Publish record the viewer wrote toward `node`, genesis and edits
/// alike, unclipped. The caller has already established that the viewer
/// is the post's creator; this is the store question only.
pub async fn publish_backing(
    pool: &PgPool,
    viewer: Uuid,
    node: &str,
    include_pending: bool,
) -> Result<BundleSum, StanceError> {
    let author = author_address(pool, viewer).await?;
    stance_store::publish_bundle(
        pool,
        &author,
        node,
        BundleView::from_include_pending(include_pending),
    )
    .await
    .map_err(StanceError::Storage)
}

async fn read_standing(
    pool: &PgPool,
    author: &str,
    resolved: &StanceTarget,
    include_pending: bool,
) -> Result<Standing, StanceError> {
    stance_store::standing(
        pool,
        author,
        resolved.family,
        &resolved.node.to_string(),
        BundleView::from_include_pending(include_pending),
    )
    .await
    .map_err(StanceError::Storage)
}

async fn author_address(pool: &PgPool, viewer: Uuid) -> Result<String, StanceError> {
    crate::nodes::required_address(pool, viewer)
        .await
        .map_err(|e| StanceError::Internal(e.to_string()))
}

/// Prepares one stance record carrying exactly the picked values.
pub async fn prepare_stance<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    staging: Staging,
    viewer: Uuid,
    target: &TargetRef,
    p_d: f64,
    p_i: f64,
) -> Result<prepare::Prepared, StanceError> {
    if !(-1.0..=1.0).contains(&p_d) || !(-1.0..=1.0).contains(&p_i) {
        return Err(StanceError::BadInput {
            field: "pDirected",
            message: "stance parameters must lie in [-1, 1]".into(),
        });
    }
    let author = author_address(pool, viewer).await?;
    let resolved = resolve_target(pool, target).await?;
    prepare::check_write_rule(
        boundary,
        pool,
        &staging,
        viewer,
        &author,
        &[(SigningClass::Stance, 1)],
    )
    .await?;
    Ok(prepare::prepare(
        boundary,
        pool,
        staging.gc_after_epochs,
        viewer,
        stance_gesture(&author, &resolved, p_d, p_i),
    )
    .await?)
}

/// Prepares the severance gesture: the counter-records that net the
/// author's bundle toward the target to `(0, 0)` — or, for a standing an
/// empty sign left at `(0, 0)`, the one `(0, 0)` record its walk-back
/// costs (`Standing::severance_batch`).
///
/// The batch is computed against the pending-inclusive view, so a sever
/// followed by a refetch reads `(0,0)` at once rather than after the acts
/// land. Each counter-record is its own priced act, so the batch length is
/// the gesture's cost — legible before signing (api-spec.md "Conventions").
pub async fn prepare_severance<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    staging: Staging,
    viewer: Uuid,
    target: &TargetRef,
) -> Result<Vec<prepare::Prepared>, StanceError> {
    let author = author_address(pool, viewer).await?;
    let resolved = resolve_target(pool, target).await?;
    let standing = read_standing(pool, &author, &resolved, true).await?;
    let batch = standing.severance_batch();
    if batch.is_empty() {
        return Err(StanceError::BadInput {
            field: "target",
            message: "the bundle toward this target already nets to (0, 0)".into(),
        });
    }
    prepare::check_write_rule(
        boundary,
        pool,
        &staging,
        viewer,
        &author,
        &[(SigningClass::Stance, batch.len())],
    )
    .await?;
    let mut prepared = Vec::with_capacity(batch.len());
    for (p_d, p_i) in batch {
        prepared.push(
            prepare::prepare(
                boundary,
                pool,
                staging.gc_after_epochs,
                viewer,
                stance_gesture(&author, &resolved, p_d, p_i),
            )
            .await?,
        );
    }
    Ok(prepared)
}

fn stance_gesture(author: &str, resolved: &StanceTarget, p_d: f64, p_i: f64) -> Gesture {
    Gesture {
        author: author.to_string(),
        family: resolved.family,
        middle: None,
        target: Target::Node(resolved.node.clone()),
        p_d,
        p_i,
        settlement_ref: None,
        license: None,
        asserted_parents: vec![],
        deps: nodes::deps_awaiting(&[], [&resolved.awaits]),
        payload: vec![],
        node: None,
    }
}

/// The held-topics list's wire cursor (api-spec.md `User.heldTopics`):
/// the folded association it resumes from, as the exact decimal the order
/// compared, and the canonical name that breaks ties — opaque per the
/// Relay spec.
pub fn encode_held_cursor(cursor: &HeldCursor) -> String {
    B64.encode(format!("held:{}:{}", cursor.association, cursor.name))
}

/// A wire cursor back to its position; None for anything this list did
/// not issue. Both halves are checked before they reach SQL: the
/// association must be a decimal inside the fold's range, and the name a
/// canonical topic name, so a forged cursor is a refusal rather than a
/// failed cast.
pub fn decode_held_cursor(cursor: &str) -> Option<HeldCursor> {
    let text = String::from_utf8(B64.decode(cursor).ok()?).ok()?;
    let rest = text.strip_prefix("held:")?;
    let (association, name) = rest.split_once(':')?;
    if association.len() > MAX_CURSOR_DECIMAL {
        return None;
    }
    let value = association.parse::<Decimal>().ok()?.to_f64();
    if !(-1.0..=1.0).contains(&value) || canonicalize(name).ok()? != name {
        return None;
    }
    Some(HeldCursor {
        association: association.to_string(),
        name: name.to_string(),
    })
}

/// The longest association a cursor may carry. A folded value is a clip
/// of a sum of census parameters, so its text is short; the bound keeps a
/// forged cursor from handing SQL an arbitrarily long numeral.
const MAX_CURSOR_DECIMAL: usize = 64;

#[cfg(test)]
mod tests {
    use super::*;

    /// A held-topics cursor decodes back to its position, and one this list did not issue decodes to nothing.
    /// ´claim:topics:a-held-cursor-round-trips´
    #[test]
    fn a_held_cursor_round_trips_and_a_foreign_one_does_not_decode() {
        for cursor in [
            HeldCursor {
                association: "0.6".into(),
                name: "saltmaps".into(),
            },
            HeldCursor {
                association: "-1".into(),
                name: "a.b-c_d".into(),
            },
        ] {
            assert_eq!(
                decode_held_cursor(&encode_held_cursor(&cursor)),
                Some(cursor)
            );
        }
        for foreign in [
            "not base64!",
            &B64.encode("hidden:0.5:rust"),
            &B64.encode("held:0.5"),
            &B64.encode("held:half:rust"),
            &B64.encode("held:1.5:rust"),
            &B64.encode("held:1e999999:rust"),
            &B64.encode("held:0.5:Rust"),
            &B64.encode("held:0.5:has space"),
            &B64.encode(format!("held:0.{}:rust", "1".repeat(80))),
        ] {
            assert_eq!(decode_held_cursor(foreign), None, "{foreign}");
        }
    }
}
