//! Integration tests for the graph schema init — require Memgraph to be
//! running (`make up`); connection comes from MEMGRAPH_HOST / MEMGRAPH_PORT.
//!
//! Tests share the one Memgraph instance, so every node they create is
//! tagged with a fresh UUID and removed again on the way out. The
//! constraints themselves are left in place — they ARE the desired
//! database state.

use graph_engine::schema::apply_schema;
use neo4rs::{Graph, query};
use uuid::Uuid;

async fn test_graph() -> Graph {
    let host = std::env::var("MEMGRAPH_HOST").unwrap_or_else(|_| "localhost".into());
    let port = std::env::var("MEMGRAPH_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(7687);
    graph_engine::connect(&host, port)
        .await
        .expect("Memgraph must be running (make up)")
}

#[tokio::test]
async fn apply_schema_is_idempotent() {
    let graph = test_graph().await;
    apply_schema(&graph).await.expect("first apply");
    apply_schema(&graph)
        .await
        .expect("second apply (startup re-run)");
}

#[tokio::test]
async fn user_id_uniqueness_is_enforced() {
    let graph = test_graph().await;
    apply_schema(&graph).await.expect("apply schema");

    let id = Uuid::new_v4().to_string();
    let username = format!("test-user-{id}");
    let create = "CREATE (:User {id: $id, username: $username})";

    graph
        .run(
            query(create)
                .param("id", id.clone())
                .param("username", username.clone()),
        )
        .await
        .expect("first insert");
    let duplicate = graph
        .run(
            query(create)
                .param("id", id.clone())
                .param("username", format!("{username}-2")),
        )
        .await;
    assert!(duplicate.is_err(), "duplicate User.id must be rejected");

    graph
        .run(query("MATCH (u:User {id: $id}) DELETE u").param("id", id))
        .await
        .expect("cleanup");
}

#[tokio::test]
async fn network_singleton_cannot_be_inserted_twice() {
    let graph = test_graph().await;
    apply_schema(&graph).await.expect("apply schema");

    let id = Uuid::new_v4().to_string();

    // Omitting singleton_marker fails the existence constraint.
    let unmarked = graph
        .run(query("CREATE (:Network {id: $id})").param("id", id.clone()))
        .await;
    assert!(
        unmarked.is_err(),
        ":Network without singleton_marker must be rejected"
    );

    graph
        .run(
            query("CREATE (:Network {id: $id, singleton_marker: 'singleton'})")
                .param("id", id.clone()),
        )
        .await
        .expect("first singleton insert");

    // A second marked node fails the uniqueness constraint.
    let second = graph
        .run(query(
            "CREATE (:Network {id: randomUUID(), singleton_marker: 'singleton'})",
        ))
        .await;
    assert!(
        second.is_err(),
        "second :Network singleton must be rejected"
    );

    graph
        .run(query("MATCH (n:Network {id: $id}) DELETE n").param("id", id))
        .await
        .expect("cleanup");
}
