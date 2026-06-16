// Graph database layer — Memgraph via bolt protocol.
// All Cypher queries live here. Returns domain types from `common`.
// Connection: neo4rs::Graph (bolt-compatible with Memgraph).

pub mod schema;

use neo4rs::ConfigBuilder;

/// Re-exported so callers don't need a direct neo4rs dependency.
pub use neo4rs::Graph;

#[derive(Debug, thiserror::Error)]
pub enum GraphError {
    #[error("graph database error: {0}")]
    Db(#[from] neo4rs::Error),
}

/// Opens the Memgraph connection pool. No auth — Memgraph community
/// edition runs authless (see docker/docker-compose.yml).
pub async fn connect(host: &str, port: u16) -> Result<Graph, GraphError> {
    let config = ConfigBuilder::default()
        .uri(format!("bolt://{host}:{port}"))
        .user("")
        .password("")
        // neo4rs defaults to a database named "neo4j"; Memgraph's default
        // database is "memgraph".
        .db("memgraph")
        .build()?;
    Ok(Graph::connect(config).await?)
}

/// Round-trip probe — true when Memgraph answers `RETURN 1`.
pub async fn ping(graph: &Graph) -> bool {
    graph.run(neo4rs::query("RETURN 1")).await.is_ok()
}
