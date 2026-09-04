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

use common::l1::identifier::NodeId;
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

/// The L0 address attached to an actor, or `None` for a keyless account
/// — an applicant before its ceremony — or an id no actor answers to.
pub async fn address_of(pool: &PgPool, actor: Uuid) -> Result<Option<String>, sqlx::Error> {
    Ok(store::actor_identity(pool, actor)
        .await?
        .and_then(|identity| identity.l0_address))
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

/// The minted node a content id names — [`resolve_content`] with the row
/// dropped, for the callers that only want the identifier.
pub async fn resolve_content_node(pool: &PgPool, id: Uuid) -> Result<Option<NodeId>, NodeError> {
    let Some(content) = resolve_content(pool, id)
        .await
        .map_err(|e| NodeError::Internal(e.to_string()))?
    else {
        return Ok(None);
    };
    NodeId::parse(content.l1_node_id())
        .map(Some)
        .map_err(|e| NodeError::Internal(format!("stored node id: {e}")))
}

/// Resolves an L2 id to the node it names, trying each class in turn.
///
/// A keyless account — an applicant before its ceremony — has no Profile on
/// the graph to point at, and so reads as unresolvable like an unknown id.
/// A Type is reached last and only through the registry: the name → id
/// derivation is one-way, so the row is what makes it invertible, and a
/// name with no row yet is reachable by name alone.
pub async fn resolve_id(pool: &PgPool, id: Uuid) -> Result<Option<NodeId>, NodeError> {
    if let Some(address) = address_of(pool, id).await? {
        return Ok(Some(NodeId::Prof(address)));
    }
    if let Some(node) = resolve_content_node(pool, id).await? {
        return Ok(Some(node));
    }
    if let Some(name) = hashtag_store::name_by_id(pool, id).await? {
        return NodeId::name(&name)
            .map(Some)
            .map_err(|e| NodeError::Internal(e.to_string()));
    }
    Ok(None)
}
