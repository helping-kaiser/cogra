//! Account topology — the `:User` + `:Wallet` + `:PAYS_TO` subgraph every
//! account carries, the two invitation edges a registrant arrives with, and
//! the graph-side reads behind `me` / `logIn`.
//!
//! All writes take a `&mut Txn` rather than `&Graph`: the service layer holds
//! one Memgraph transaction open alongside a Postgres transaction and commits
//! them together (architecture.md "Service-layer transactions"). Writes use
//! `MERGE` keyed on the node UUID with `ON CREATE SET`, so a retry after a
//! committed graph write collapses to a no-op — the idempotent-first-commit
//! discipline from architecture.md "Partial-failure handling".

use common::NetworkRole;
use neo4rs::{Graph, Txn, query};
use uuid::Uuid;

use crate::GraphError;
use crate::props::user_set_body;

/// A registrant's invitation edges: the inviter's pre-committed `:INVITE`
/// edge outward and the invitee's own `:ACTOR` edge back
/// ([invitations.md](../../../docs/primitive/invitations.md)). Both are
/// layer-1 actor edges; defaults are `(+0.5, +0.5)` on each side.
pub struct InvitationEdges {
    /// The inviter node (a `:User` or `:Collective`) — the link's issuer.
    pub inviter_id: Uuid,
    /// Inviter → invitee `:INVITE` tensor, pre-committed at link creation.
    pub inviter_dim1: f64,
    pub inviter_dim2: f64,
    /// Invitee → inviter `:ACTOR` tensor, the registrant's own first edge.
    pub invitee_dim1: f64,
    pub invitee_dim2: f64,
}

/// Creates a registrant's account subgraph in one atomic statement: the
/// `:User` node (`network_role = 'member'`), its `:Wallet` + `:PAYS_TO`
/// binding, and both invitation edges. The caller commits the transaction.
///
/// `wallet_address` is the placeholder from
/// [`common::wallet::placeholder_address`] until the chain lands (slice 5).
#[allow(clippy::too_many_arguments)]
pub async fn create_registrant(
    txn: &mut Txn,
    user_id: Uuid,
    username: &str,
    wallet_id: Uuid,
    wallet_address: &str,
    edges: &InvitationEdges,
) -> Result<(), GraphError> {
    let cypher = format!(
        "WITH localDateTime() AS now
         MATCH (inviter {{id: $inviter_id}})
         MERGE (u:User {{id: $user_id}})
         ON CREATE SET {user_body}
         MERGE (w:Wallet {{id: $wallet_id}})
         ON CREATE SET w.address = $wallet_address,
             w.address_layers = [{{value: $wallet_address, timestamp: now, layer: 1}}]
         MERGE (u)-[pt:PAYS_TO]->(w)
         ON CREATE SET pt.dim1 = 0.0, pt.dim2 = 0.0, pt.timestamp = now, pt.layer = 1
         MERGE (inviter)-[inv:INVITE]->(u)
         ON CREATE SET inv.dim1 = $inviter_dim1, inv.dim2 = $inviter_dim2,
             inv.timestamp = now, inv.layer = 1
         MERGE (u)-[back:ACTOR]->(inviter)
         ON CREATE SET back.dim1 = $invitee_dim1, back.dim2 = $invitee_dim2,
             back.timestamp = now, back.layer = 1",
        user_body = user_set_body("u", "'member'"),
    );
    txn.run(
        query(&cypher)
            .param("inviter_id", edges.inviter_id.to_string())
            .param("user_id", user_id.to_string())
            .param("username", username)
            .param("wallet_id", wallet_id.to_string())
            .param("wallet_address", wallet_address)
            .param("inviter_dim1", edges.inviter_dim1)
            .param("inviter_dim2", edges.inviter_dim2)
            .param("invitee_dim1", edges.invitee_dim1)
            .param("invitee_dim2", edges.invitee_dim2),
    )
    .await?;
    Ok(())
}

/// The graph-side state behind a `:User`: the role and moderation cache that
/// live only on the node. Display fields come from Postgres; this is what the
/// `User` resolver reads from the graph.
pub struct UserGraphState {
    pub network_role: NetworkRole,
    pub moderation_status: String,
}

/// Reads a `:User`'s graph state by id. `None` when no such node exists.
pub async fn fetch_user_graph_state(
    graph: &Graph,
    user_id: Uuid,
) -> Result<Option<UserGraphState>, GraphError> {
    let mut rows = graph
        .execute(
            query(
                "MATCH (u:User {id: $id})
                 RETURN u.network_role AS role, u.moderation_status AS moderation_status",
            )
            .param("id", user_id.to_string()),
        )
        .await?;
    match rows.next().await? {
        Some(row) => {
            let role: String = row.get("role")?;
            let moderation_status: String = row.get("moderation_status")?;
            Ok(Some(UserGraphState {
                network_role: role.parse().map_err(GraphError::role)?,
                moderation_status,
            }))
        }
        None => Ok(None),
    }
}
