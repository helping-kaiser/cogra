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

    // Omitting singleton_marker fails the existence constraint — isolation-safe
    // since a rejected CREATE persists nothing.
    let unmarked = graph
        .run(query("CREATE (:Network {id: $id})").param("id", Uuid::new_v4().to_string()))
        .await;
    assert!(
        unmarked.is_err(),
        ":Network without singleton_marker must be rejected"
    );

    // The singleton is a global node a real `make bootstrap` may already have
    // created, and the marker-uniqueness constraint can only be exercised
    // against a live singleton. Branch on whether one exists so this test
    // exercises the constraint either way and never destroys a real :Network.
    let mut rows = graph
        .execute(query(
            "MATCH (n:Network {singleton_marker: 'singleton'}) RETURN count(n) AS c",
        ))
        .await
        .expect("count existing singletons");
    let existing: i64 = rows
        .next()
        .await
        .expect("count row")
        .expect("count row present")
        .get("c")
        .expect("count column");

    // Only when none exists do we create one — and then we own it, so removing
    // it on the way out is safe. When a real singleton is present we leave it.
    let created_id = if existing == 0 {
        let id = Uuid::new_v4().to_string();
        graph
            .run(
                query("CREATE (:Network {id: $id, singleton_marker: 'singleton'})")
                    .param("id", id.clone()),
            )
            .await
            .expect("first singleton insert");
        Some(id)
    } else {
        None
    };

    // A second marked node collides with the now-guaranteed singleton.
    let second = graph
        .run(query(
            "CREATE (:Network {id: randomUUID(), singleton_marker: 'singleton'})",
        ))
        .await;
    assert!(
        second.is_err(),
        "second :Network singleton must be rejected"
    );

    if let Some(id) = created_id {
        graph
            .run(query("MATCH (n:Network {id: $id}) DELETE n").param("id", id))
            .await
            .expect("cleanup");
    }
}
