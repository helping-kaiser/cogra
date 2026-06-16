//! The genesis bootstrap graph write — the four nodes brought into existence
//! in one atomic statement when an instance is created
//! ([network.md §2](../../../docs/primitive/network.md),
//! [architecture.md "Genesis bootstrap"](../../../docs/implementation/architecture.md)):
//! the `:Network` singleton, the genesis `:User` (`network_role =
//! 'moderator'`), that User's `:Wallet` + `:PAYS_TO` binding, and the
//! `bot-defense` `:Hashtag`.
//!
//! This is the only writer of these four nodes and the only graph write that
//! depends on out-of-graph authority. It runs from the one-shot bootstrap
//! binary, never from a request path.

use neo4rs::{Graph, Txn, query};
use uuid::Uuid;

use crate::GraphError;
use crate::props::{layered, plain, user_set_body};

/// True once the `:Network` singleton exists — the canonical "this instance
/// is bootstrapped" signal. The one-shot bootstrap checks this first and
/// skips a re-run.
pub async fn is_bootstrapped(graph: &Graph) -> Result<bool, GraphError> {
    let mut rows = graph
        .execute(query(
            "MATCH (n:Network {singleton_marker: 'singleton'}) RETURN count(n) AS c",
        ))
        .await?;
    match rows.next().await? {
        Some(row) => Ok(row.get::<i64>("c")? > 0),
        None => Ok(false),
    }
}

/// Identity and content supplied to the bootstrap at run time — the genesis
/// User's handle and the version-1 platform-guidelines digest. Everything
/// else is a fixed default from
/// [graph-data-model.md](../../../docs/implementation/graph-data-model.md).
pub struct GenesisInput {
    pub network_id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub wallet_id: Uuid,
    pub wallet_address: String,
    pub hashtag_id: Uuid,
    pub hashtag_name: String,
    /// SHA-256 hex digest of the canonical version-1 guidelines document.
    pub guidelines_hash: String,
}

/// The `:Network` singleton's default parameter set
/// ([graph-data-model.md §:Network](../../../docs/implementation/graph-data-model.md)).
/// Each is a layered config property; `guidelines_hash` is the one value
/// supplied at run time (`$guidelines_hash`), the rest are fixed defaults.
fn network_set_body() -> String {
    let mut clauses = vec![
        plain("n", "id", "$network_id"),
        plain("n", "singleton_marker", "'singleton'"),
    ];
    let layered_defaults = [
        ("mod_role_change_quorum_fraction", "0.5"),
        ("mod_role_change_quorum_count", "5000"),
        ("moderation_sensitive_quorum_fraction", "0.25"),
        ("moderation_sensitive_quorum_count", "5000"),
        ("moderation_illegal_quorum_fraction", "0.5"),
        ("moderation_illegal_quorum_count", "10000"),
        ("guidelines_version", "1"),
        ("guidelines_hash", "$guidelines_hash"),
        ("guidelines_change_quorum_fraction", "0.5"),
        ("guidelines_change_quorum_count", "10000"),
        ("property_change_quorum_fraction", "0.25"),
        ("property_change_quorum_count", "5000"),
        ("critical_property_change_quorum_fraction", "0.5"),
        ("critical_property_change_quorum_count", "10000"),
        ("critical_mod_gate_fraction", "0.5"),
        ("active_threshold_days", "30"),
        ("time_decay_half_life_days", "30"),
        ("distance_decay_base", "0.1"),
        ("dust_floor", "0.0"),
    ];
    for (prop, value) in layered_defaults {
        clauses.push(layered("n", prop, value));
    }
    clauses.join(", ")
}

/// Writes the four genesis nodes in one atomic statement. `MERGE` on the
/// singleton marker and the node UUIDs makes a re-run a no-op, so the
/// bootstrap is safe to invoke against an already-bootstrapped instance
/// (it changes nothing). The caller commits the transaction.
pub async fn bootstrap(txn: &mut Txn, input: &GenesisInput) -> Result<(), GraphError> {
    let cypher = format!(
        "WITH localDateTime() AS now
         MERGE (n:Network {{singleton_marker: 'singleton'}})
         ON CREATE SET {network_body}
         MERGE (u:User {{id: $user_id}})
         ON CREATE SET {user_body}
         MERGE (w:Wallet {{id: $wallet_id}})
         ON CREATE SET w.address = $wallet_address,
             w.address_layers = [{{value: $wallet_address, timestamp: now, layer: 1}}]
         MERGE (u)-[pt:PAYS_TO]->(w)
         ON CREATE SET pt.dim1 = 0.0, pt.dim2 = 0.0, pt.timestamp = now, pt.layer = 1
         MERGE (h:Hashtag {{id: $hashtag_id}})
         ON CREATE SET h.name = $hashtag_name,
             h.name_layers = [{{value: $hashtag_name, timestamp: now, layer: 1}}],
             {hashtag_status}, {hashtag_cache}",
        network_body = network_set_body(),
        user_body = user_set_body("u", "'moderator'"),
        hashtag_status = layered("h", "name_status", "'normal'"),
        hashtag_cache = plain("h", "moderation_status", "'normal'"),
    );
    txn.run(
        query(&cypher)
            .param("network_id", input.network_id.to_string())
            .param("guidelines_hash", input.guidelines_hash.as_str())
            .param("user_id", input.user_id.to_string())
            .param("username", input.username.as_str())
            .param("wallet_id", input.wallet_id.to_string())
            .param("wallet_address", input.wallet_address.as_str())
            .param("hashtag_id", input.hashtag_id.to_string())
            .param("hashtag_name", input.hashtag_name.as_str()),
    )
    .await?;
    Ok(())
}
