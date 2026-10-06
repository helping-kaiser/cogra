//! ´mod:module:nodes´
//!
//! L2 identifier → L1 node resolution, shared by every gesture that points
//! at a node the client named by its display id.
//!
//! Every passive node class is addressable the same way, and the classes
//! whose slices have not landed yet simply have no id to resolve here. The
//! resolution is one lookup order over the L2 tables, so it lives once:
//! a stance and a citation that disagreed about what a UUID names would be
//! a bug no test of either alone could see.
//!
//! An unresolvable id comes back as `Ok(None)` rather than an error, because
//! the refusal it becomes is the *caller's*: a stance names the offender
//! `target`, a citation names `references.2.target`, and the field path is
//! what makes the refusal actionable (api-spec.md "Conventions").

use std::collections::HashMap;

use common::l1::identifier::{ActId, NodeId};
use postgres_store::content::{Comment, Post};
use postgres_store::{PgPool, auth as store, content as content_store, hashtag as hashtag_store};
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum NodeError {
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
    /// A stored identifier the L1 grammar does not parse — the L2 row and
    /// the graph disagree, which is a mirror fault, never client input.
    #[error("internal: {0}")]
    Internal(String),
}

/// An actor's address was asked for and is not there.
#[derive(Debug, thiserror::Error)]
pub enum AddressError {
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
    /// Every caller of [`required_address`] stands past an attach proof,
    /// so a keyless actor here is a fault rather than an answer.
    #[error("actor without an attached address")]
    Missing,
}

/// The address attached to an actor, or `None` for a keyless account
/// — an applicant before its ceremony — or an id no actor answers to.
pub async fn address_of(pool: &PgPool, actor: Uuid) -> Result<Option<String>, sqlx::Error> {
    Ok(store::actor_identity(pool, actor)
        .await?
        .and_then(|identity| identity.realization_address))
}

/// [`address_of`] with the absence raised, for the gestures that are
/// only reachable by an actor that already has one. Callers map this
/// into their own error type; the refusal reads the same everywhere
/// because it is written once.
pub async fn required_address(pool: &PgPool, actor: Uuid) -> Result<String, AddressError> {
    address_of(pool, actor).await?.ok_or(AddressError::Missing)
}

/// The content row an L2 id names.
#[derive(Clone)]
pub enum ContentNode {
    Post(Post),
    Comment(Comment),
}

impl ContentNode {
    /// The minted L1 identifier the row carries.
    pub fn l1_node_id(&self) -> &str {
        match self {
            Self::Post(post) => &post.l1_node_id,
            Self::Comment(comment) => &comment.l1_node_id,
        }
    }

    /// Whether the genesis record has landed — the row carries its landing
    /// coordinates once confirm promotes it, and none while it is pending.
    pub fn landed(&self) -> bool {
        match self {
            Self::Post(post) => post.order.is_some(),
            Self::Comment(comment) => comment.order.is_some(),
        }
    }
}

/// A node a gesture points at, with the act that mints it while that act
/// has not landed.
///
/// Pending content reads to every viewer (substrate.md §6), so any gesture
/// can name a node whose genesis record is still in flight. A record
/// toward it must not be ordered ahead of the record that mints it, and the
/// only instrument that orders one act behind another is a declared
/// dependency (layer1-interface.md §8.2: "declaring that q's authoritative
/// time must exceed each member's"). `awaits` is that dependency; a gesture
/// built on this node carries it in `deps`, so the epoch close holds the
/// gesture until its node stands — and, should the node never land, the
/// gesture expires with it rather than landing toward nothing.
///
/// Only a minted node can be pending: a Profile or a Type is not the
/// product of a content act, so `awaits` is always `None` for them.
#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedNode {
    pub node: NodeId,
    pub awaits: Option<ActId>,
}

impl ResolvedNode {
    /// A node that is not the product of an act still in flight.
    fn settled(node: NodeId) -> Self {
        Self { node, awaits: None }
    }

    /// The node a content row names, awaiting its minting act while the
    /// row carries no landing coordinates.
    ///
    /// A content node is always minted — its identifier *is* its genesis
    /// act's — so an identifier of any other shape is a diverged row, not
    /// input.
    fn of_content(content: &ContentNode) -> Result<Self, NodeError> {
        let node = NodeId::parse(content.l1_node_id())
            .map_err(|e| NodeError::Internal(format!("stored node id: {e}")))?;
        if content.landed() {
            return Ok(Self::settled(node));
        }
        match &node {
            NodeId::Mint(act) => Ok(Self {
                awaits: Some(act.clone()),
                node,
            }),
            other => Err(NodeError::Internal(format!(
                "content row names an unminted node: {other}"
            ))),
        }
    }
}

/// The dependency list a gesture declares: the acts the site already
/// orders it behind, plus each named node's minting act while that is in
/// flight (a [`ResolvedNode::awaits`]). Duplicates collapse, because a
/// dependency named twice orders nothing further and still spends the
/// substrate's per-act dependency budget.
pub fn deps_awaiting<'a>(
    site: &[ActId],
    awaits: impl IntoIterator<Item = &'a Option<ActId>>,
) -> Vec<ActId> {
    let mut deps = site.to_vec();
    for act in awaits.into_iter().flatten() {
        if !deps.contains(act) {
            deps.push(act.clone());
        }
    }
    deps
}

/// The content row an L2 id names, or `None` when it names no content.
///
/// One dispatch for the whole crate: a tag, a citation and a comment
/// that disagreed about which class a UUID belongs to would be a bug no
/// test of one of them could see.
pub async fn resolve_content(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<ContentNode>, content_store::ContentError> {
    Ok(resolve_content_many(pool, &[id]).await?.remove(&id))
}

/// [`resolve_content`] over a batch, in three round trips whatever the
/// batch size: the class dispatch, then one read per class.
///
/// The per-id shape would be two reads *each* — the batch cap is a
/// hundred, so `nodes` alone was two hundred serialized round trips.
pub async fn resolve_content_many(
    pool: &PgPool,
    ids: &[Uuid],
) -> Result<HashMap<Uuid, ContentNode>, content_store::ContentError> {
    let refs = content_store::content_refs(pool, ids).await?;
    let (posts, comments): (Vec<_>, Vec<_>) = refs.iter().partition(|r| r.kind == "post");
    let post_nodes: Vec<String> = posts.iter().map(|r| r.l1_node_id.clone()).collect();
    let comment_nodes: Vec<String> = comments.iter().map(|r| r.l1_node_id.clone()).collect();

    let mut by_node: HashMap<String, ContentNode> = HashMap::new();
    for post in content_store::posts_by_nodes(pool, &post_nodes).await? {
        by_node.insert(post.l1_node_id.clone(), ContentNode::Post(post));
    }
    for comment in content_store::comments_by_nodes(pool, &comment_nodes).await? {
        by_node.insert(comment.l1_node_id.clone(), ContentNode::Comment(comment));
    }

    Ok(refs
        .into_iter()
        .filter_map(|r| by_node.remove(&r.l1_node_id).map(|node| (r.id, node)))
        .collect())
}

/// The minted node a content id names, with its minting act while that is
/// still in flight — the shape a gesture *on* the node needs.
pub async fn resolve_content_target(
    pool: &PgPool,
    id: Uuid,
) -> Result<Option<ResolvedNode>, NodeError> {
    let Some(content) = resolve_content(pool, id)
        .await
        .map_err(|e| NodeError::Internal(e.to_string()))?
    else {
        return Ok(None);
    };
    ResolvedNode::of_content(&content).map(Some)
}

/// Resolves an L2 id to the node it names — [`resolve_target`] with the
/// pending state dropped.
pub async fn resolve_id(pool: &PgPool, id: Uuid) -> Result<Option<NodeId>, NodeError> {
    Ok(resolve_target(pool, id).await?.map(|r| r.node))
}

/// Resolves an L2 id to the node it names, trying each class in turn, with
/// the minting act a gesture toward it must wait for.
///
/// A keyless account — an applicant before its ceremony — has no Profile on
/// the graph to point at, and so reads as unresolvable like an unknown id.
/// A Type is reached last and only through the registry: the name → id
/// derivation is one-way, so the row is what makes it invertible, and a
/// name with no row yet is reachable by name alone.
pub async fn resolve_target(pool: &PgPool, id: Uuid) -> Result<Option<ResolvedNode>, NodeError> {
    if let Some(address) = address_of(pool, id).await? {
        return Ok(Some(ResolvedNode::settled(NodeId::Prof(address))));
    }
    if let Some(node) = resolve_content_target(pool, id).await? {
        return Ok(Some(node));
    }
    if let Some(name) = hashtag_store::name_by_id(pool, id).await? {
        return NodeId::name(&name)
            .map(|node| Some(ResolvedNode::settled(node)))
            .map_err(|e| NodeError::Internal(e.to_string()));
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use common::l1::census::Family;

    fn act(author: &str, seq: u64) -> ActId {
        ActId::new(author, seq, Family::Publish).expect("act")
    }

    fn awaiting(a: ActId) -> ResolvedNode {
        ResolvedNode {
            node: NodeId::Mint(a.clone()),
            awaits: Some(a),
        }
    }

    /// A gesture on a pending node declares the act that mints it, beside whatever its site already orders it behind.
    /// ´claim:nodes:a-gesture-on-a-pending-node-awaits-its-mint´
    #[test]
    fn a_pending_node_adds_its_minting_act_to_the_site_deps() {
        let own = act("alice", 0);
        let foreign = act("bob", 3);
        let deps = deps_awaiting(
            std::slice::from_ref(&own),
            [&awaiting(foreign.clone()).awaits],
        );
        assert_eq!(deps, vec![own, foreign]);
    }

    /// (´claim:nodes:a-gesture-on-a-pending-node-awaits-its-mint´)
    #[test]
    fn a_settled_node_adds_nothing_and_a_repeat_collapses() {
        let own = act("alice", 0);
        let settled = ResolvedNode::settled(NodeId::Prof("bob".into()));
        let repeat = awaiting(own.clone());
        let deps = deps_awaiting(
            std::slice::from_ref(&own),
            [&settled.awaits, &repeat.awaits],
        );
        assert_eq!(deps, vec![own], "a profile awaits nothing; a repeat orders nothing further");
    }
}
