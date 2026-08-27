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

use common::l1::identifier::NodeId;
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

/// Resolves an L2 id to the node it names, trying each class in turn.
///
/// A keyless account — an applicant before its ceremony — has no Profile on
/// the graph to point at, and so reads as unresolvable like an unknown id.
/// A Type is reached last and only through the registry: the name → id
/// derivation is one-way, so the row is what makes it invertible, and a
/// name with no row yet is reachable by name alone.
pub async fn resolve_id(pool: &PgPool, id: Uuid) -> Result<Option<NodeId>, NodeError> {
    if let Some(address) = store::actor_identity(pool, id)
        .await?
        .and_then(|identity| identity.l0_address)
    {
        return Ok(Some(NodeId::Prof(address)));
    }
    let minted = match content_store::post(pool, id)
        .await
        .map_err(|e| NodeError::Internal(e.to_string()))?
    {
        Some(post) => Some(post.l1_node_id),
        None => content_store::comment(pool, id)
            .await
            .map_err(|e| NodeError::Internal(e.to_string()))?
            .map(|comment| comment.l1_node_id),
    };
    if let Some(minted) = minted {
        return NodeId::parse(&minted)
            .map(Some)
            .map_err(|e| NodeError::Internal(e.to_string()));
    }
    if let Some(name) = hashtag_store::name_by_id(pool, id).await? {
        return NodeId::name(&name)
            .map(Some)
            .map_err(|e| NodeError::Internal(e.to_string()));
    }
    Ok(None)
}
