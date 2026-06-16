//! Graph schema — constraints and indexes from
//! docs/implementation/graph-data-model.md, applied on startup.
//!
//! Every statement is idempotent in Memgraph (re-creating an existing
//! constraint or index is a no-op), so `apply_schema` runs unconditionally
//! on every API start.
//!
//! The edge-tensor-uniformity invariant is NOT here: Memgraph constraints
//! are node-only, so it is enforced by service-layer write paths and
//! integration tests — see graph-data-model.md "Tensor uniformity
//! enforcement".

use neo4rs::Graph;

use crate::GraphError;

/// Node constraints and indexes, one statement per entry.
///
/// Shape per label: `id` UNIQUE + an `:Label(id)` lookup index; handle
/// labels (`User.username`, `Collective.name`, `Hashtag.name`) add a
/// UNIQUE on the handle; `:Network` adds the singleton-marker
/// existence + uniqueness pair that makes a second singleton insert
/// impossible.
const SCHEMA_STATEMENTS: &[&str] = &[
    // Actor nodes
    "CREATE CONSTRAINT ON (u:User) ASSERT u.id IS UNIQUE",
    "CREATE CONSTRAINT ON (u:User) ASSERT u.username IS UNIQUE",
    "CREATE INDEX ON :User(id)",
    "CREATE CONSTRAINT ON (c:Collective) ASSERT c.id IS UNIQUE",
    "CREATE CONSTRAINT ON (c:Collective) ASSERT c.name IS UNIQUE",
    "CREATE INDEX ON :Collective(id)",
    // Content nodes
    "CREATE CONSTRAINT ON (p:Post) ASSERT p.id IS UNIQUE",
    "CREATE INDEX ON :Post(id)",
    "CREATE CONSTRAINT ON (c:Comment) ASSERT c.id IS UNIQUE",
    "CREATE INDEX ON :Comment(id)",
    "CREATE CONSTRAINT ON (c:Chat) ASSERT c.id IS UNIQUE",
    "CREATE INDEX ON :Chat(id)",
    "CREATE CONSTRAINT ON (m:ChatMessage) ASSERT m.id IS UNIQUE",
    "CREATE INDEX ON :ChatMessage(id)",
    "CREATE CONSTRAINT ON (i:Item) ASSERT i.id IS UNIQUE",
    "CREATE INDEX ON :Item(id)",
    // Topic nodes
    "CREATE CONSTRAINT ON (h:Hashtag) ASSERT h.id IS UNIQUE",
    "CREATE CONSTRAINT ON (h:Hashtag) ASSERT h.name IS UNIQUE",
    "CREATE INDEX ON :Hashtag(id)",
    // Carrier nodes
    "CREATE CONSTRAINT ON (p:Proposal) ASSERT p.id IS UNIQUE",
    "CREATE INDEX ON :Proposal(id)",
    "CREATE CONSTRAINT ON (c:Campaign) ASSERT c.id IS UNIQUE",
    "CREATE INDEX ON :Campaign(id)",
    "CREATE CONSTRAINT ON (s:Settlement) ASSERT s.id IS UNIQUE",
    "CREATE INDEX ON :Settlement(id)",
    "CREATE CONSTRAINT ON (w:Wallet) ASSERT w.id IS UNIQUE",
    "CREATE INDEX ON :Wallet(id)",
    // Junction nodes
    "CREATE CONSTRAINT ON (m:ChatMember) ASSERT m.id IS UNIQUE",
    "CREATE INDEX ON :ChatMember(id)",
    "CREATE CONSTRAINT ON (m:CollectiveMember) ASSERT m.id IS UNIQUE",
    "CREATE INDEX ON :CollectiveMember(id)",
    "CREATE CONSTRAINT ON (o:ItemOwnership) ASSERT o.id IS UNIQUE",
    "CREATE INDEX ON :ItemOwnership(id)",
    // System nodes
    "CREATE CONSTRAINT ON (n:Network) ASSERT n.id IS UNIQUE",
    "CREATE CONSTRAINT ON (n:Network) ASSERT EXISTS (n.singleton_marker)",
    "CREATE CONSTRAINT ON (n:Network) ASSERT n.singleton_marker IS UNIQUE",
    "CREATE INDEX ON :Network(id)",
];

/// Applies the full constraint + index set. Safe to run on every startup.
pub async fn apply_schema(graph: &Graph) -> Result<(), GraphError> {
    for statement in SCHEMA_STATEMENTS {
        graph.run(neo4rs::query(statement)).await?;
    }
    Ok(())
}
