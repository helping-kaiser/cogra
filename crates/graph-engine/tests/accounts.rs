//! Integration tests for the account-topology writes — require Memgraph
//! (`make up`); connection comes from MEMGRAPH_HOST / MEMGRAPH_PORT.
//!
//! These fight the registration write path directly rather than through the
//! API: edge-tensor uniformity (the invariant Memgraph cannot enforce as a
//! constraint, so a test must), idempotent retry, and the missing-inviter
//! abort. Each test tags its nodes with fresh UUIDs and removes them on the
//! way out so the shared instance stays clean.

use common::NetworkRole;
use graph_engine::Graph;
use graph_engine::accounts::{
    InvitationEdges, create_registrant, fetch_user_graph_state, relabel_user_handle,
};
use graph_engine::schema::apply_schema;
use neo4rs::query;
use uuid::Uuid;

async fn test_graph() -> Graph {
    let host = std::env::var("MEMGRAPH_HOST").unwrap_or_else(|_| "localhost".into());
    let port = std::env::var("MEMGRAPH_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(7687);
    let graph = graph_engine::connect(&host, port)
        .await
        .expect("Memgraph must be running (make up)");
    apply_schema(&graph).await.expect("apply schema");
    graph
}

/// Seeds a bare inviter `:User` and returns its id.
async fn seed_inviter(graph: &Graph) -> Uuid {
    let id = Uuid::new_v4();
    graph
        .run(
            query("CREATE (:User {id: $id, username: $u})")
                .param("id", id.to_string())
                .param("u", format!("inviter-{}", id.simple())),
        )
        .await
        .expect("seed inviter");
    id
}

async fn cleanup(graph: &Graph, ids: &[Uuid]) {
    let ids: Vec<String> = ids.iter().map(|i| i.to_string()).collect();
    graph
        .run(query("MATCH (n) WHERE n.id IN $ids DETACH DELETE n").param("ids", ids))
        .await
        .expect("cleanup");
}

/// Commits one registrant via the service-layer transaction shape.
async fn write_registrant(
    graph: &Graph,
    user_id: Uuid,
    wallet_id: Uuid,
    edges: &InvitationEdges,
) -> Result<(), graph_engine::GraphError> {
    let mut txn = graph.start_txn().await.expect("open txn");
    let username = format!("u-{}", user_id.simple());
    let result = create_registrant(
        &mut txn,
        user_id,
        &username,
        wallet_id,
        &format!("unfunded:{wallet_id}"),
        edges,
    )
    .await;
    match result {
        Ok(()) => {
            txn.commit().await.expect("commit");
            Ok(())
        }
        Err(e) => {
            // Drop the txn without committing — the caller asserts nothing
            // persisted, mirroring the service layer rolling both stores back.
            txn.rollback().await.expect("rollback");
            Err(e)
        }
    }
}

/// Counts nodes/edges matched by a single-`$id` pattern that `RETURN`s `count AS c`.
async fn count(graph: &Graph, cypher: &str, id: Uuid) -> i64 {
    let mut rows = graph
        .execute(query(cypher).param("id", id.to_string()))
        .await
        .expect("count query");
    rows.next()
        .await
        .expect("row")
        .expect("count row")
        .get::<i64>("c")
        .expect("count")
}

fn default_edges(inviter_id: Uuid) -> InvitationEdges {
    InvitationEdges {
        inviter_id,
        inviter_dim1: 0.5,
        inviter_dim2: 0.5,
        invitee_dim1: 0.5,
        invitee_dim2: 0.5,
    }
}

/// Reads `(dim1, dim2, layer, has_timestamp)` off a single edge selected by a
/// MATCH pattern that binds the edge as `e`.
async fn edge_tensor(graph: &Graph, pattern: &str, id: Uuid) -> (f64, f64, i64, bool) {
    let mut rows = graph
        .execute(
            query(&format!(
                "MATCH {pattern} RETURN e.dim1 AS dim1, e.dim2 AS dim2, \
                 e.layer AS layer, (e.timestamp IS NOT NULL) AS has_ts"
            ))
            .param("id", id.to_string()),
        )
        .await
        .expect("query edge");
    let row = rows.next().await.expect("row stream").expect("edge exists");
    (
        row.get("dim1").expect("dim1"),
        row.get("dim2").expect("dim2"),
        row.get("layer").expect("layer"),
        row.get("has_ts").expect("has_ts"),
    )
}

#[tokio::test]
async fn registrant_edges_all_carry_the_uniform_tensor() {
    let graph = test_graph().await;
    let inviter_id = seed_inviter(&graph).await;
    let user_id = Uuid::new_v4();
    let wallet_id = Uuid::new_v4();

    write_registrant(&graph, user_id, wallet_id, &default_edges(inviter_id))
        .await
        .expect("write registrant");

    // Every actor/structural edge: dim1, dim2, a timestamp, and layer 1.
    for (label, pattern) in [
        (
            "PAYS_TO",
            "(:User {id: $id})-[e:PAYS_TO]->(:Wallet)".to_string(),
        ),
        (
            "INVITE",
            format!("(:User {{id: '{inviter_id}'}})-[e:INVITE]->(:User {{id: $id}})"),
        ),
        (
            "ACTOR",
            format!("(:User {{id: $id}})-[e:ACTOR]->(:User {{id: '{inviter_id}'}})"),
        ),
    ] {
        let (dim1, dim2, layer, has_ts) = edge_tensor(&graph, &pattern, user_id).await;
        assert!(
            (-1.0..=1.0).contains(&dim1) && (-1.0..=1.0).contains(&dim2),
            "{label} dims in range"
        );
        assert_eq!(layer, 1, "{label} starts at layer 1");
        assert!(has_ts, "{label} carries a timestamp");
    }

    // PAYS_TO is a structural binding, not an actor signal: zeroed dims.
    let (d1, d2, _, _) =
        edge_tensor(&graph, "(:User {id: $id})-[e:PAYS_TO]->(:Wallet)", user_id).await;
    assert_eq!((d1, d2), (0.0, 0.0), "PAYS_TO is a zeroed structural edge");

    cleanup(&graph, &[inviter_id, user_id, wallet_id]).await;
}

#[tokio::test]
async fn retry_with_the_same_ids_is_a_no_op() {
    let graph = test_graph().await;
    let inviter_id = seed_inviter(&graph).await;
    let user_id = Uuid::new_v4();
    let wallet_id = Uuid::new_v4();
    let edges = default_edges(inviter_id);

    // Two committed attempts with identical ids — the retry after a (simulated)
    // partial failure. The MERGE must adopt the existing nodes, not duplicate.
    write_registrant(&graph, user_id, wallet_id, &edges)
        .await
        .expect("first write");
    write_registrant(&graph, user_id, wallet_id, &edges)
        .await
        .expect("retry write");

    assert_eq!(
        count(
            &graph,
            "MATCH (u:User {id: $id}) RETURN count(u) AS c",
            user_id
        )
        .await,
        1,
        "exactly one User after retry"
    );
    assert_eq!(
        count(
            &graph,
            "MATCH (w:Wallet {id: $id}) RETURN count(w) AS c",
            wallet_id
        )
        .await,
        1,
        "exactly one Wallet after retry"
    );
    assert_eq!(
        count(
            &graph,
            "MATCH (:User {id: $id})-[r:ACTOR]->() RETURN count(r) AS c",
            user_id,
        )
        .await,
        1,
        "exactly one ACTOR edge after retry"
    );

    cleanup(&graph, &[inviter_id, user_id, wallet_id]).await;
}

#[tokio::test]
async fn missing_inviter_aborts_and_writes_nothing() {
    let graph = test_graph().await;
    let absent_inviter = Uuid::new_v4(); // never created
    let user_id = Uuid::new_v4();
    let wallet_id = Uuid::new_v4();

    let result = write_registrant(&graph, user_id, wallet_id, &default_edges(absent_inviter)).await;
    assert!(
        matches!(result, Err(graph_engine::GraphError::Invalid(_))),
        "a missing inviter must abort the write"
    );

    // Nothing persisted: the rolled-back transaction left no User or Wallet.
    let mut rows = graph
        .execute(
            query("MATCH (n) WHERE n.id IN $ids RETURN count(n) AS c")
                .param("ids", vec![user_id.to_string(), wallet_id.to_string()]),
        )
        .await
        .expect("count query");
    let c: i64 = rows
        .next()
        .await
        .expect("row")
        .expect("count row")
        .get("c")
        .expect("count");
    assert_eq!(c, 0, "no node persists after the aborted write");
}

/// Commits a handle relabel via the service-layer transaction shape, rolling
/// back (so nothing persists) on error — mirroring the resolver.
async fn relabel(
    graph: &Graph,
    user_id: Uuid,
    new_handle: &str,
) -> Result<(), graph_engine::GraphError> {
    let mut txn = graph.start_txn().await.expect("open txn");
    match relabel_user_handle(&mut txn, user_id, new_handle).await {
        // Memgraph enforces the `username` UNIQUE constraint at COMMIT, not at
        // the SET, so a taken-handle violation surfaces here — mapped to a
        // GraphError exactly as the resolver's `gtx.commit()?` would.
        Ok(()) => txn.commit().await.map_err(graph_engine::GraphError::from),
        Err(e) => {
            txn.rollback().await.expect("rollback");
            Err(e)
        }
    }
}

/// Reads `(username, username_layer_count)` off a `:User`.
async fn handle_state(graph: &Graph, user_id: Uuid) -> (String, i64) {
    let mut rows = graph
        .execute(
            query(
                "MATCH (u:User {id: $id})
                 RETURN u.username AS username, size(u.username_layers) AS layers",
            )
            .param("id", user_id.to_string()),
        )
        .await
        .expect("read handle state");
    let row = rows.next().await.expect("row").expect("user exists");
    (
        row.get("username").expect("username"),
        row.get("layers").expect("layers"),
    )
}

#[tokio::test]
async fn relabel_changes_the_username_and_appends_a_layer() {
    let graph = test_graph().await;
    let inviter_id = seed_inviter(&graph).await;
    let user_id = Uuid::new_v4();
    let wallet_id = Uuid::new_v4();
    write_registrant(&graph, user_id, wallet_id, &default_edges(inviter_id))
        .await
        .expect("write registrant");

    let new_handle = format!("r{}", Uuid::new_v4().simple());
    relabel(&graph, user_id, &new_handle)
        .await
        .expect("relabel");

    let (username, layers) = handle_state(&graph, user_id).await;
    assert_eq!(username, new_handle, "top username is the new handle");
    assert_eq!(layers, 2, "the seed layer plus the relabel");

    cleanup(&graph, &[inviter_id, user_id, wallet_id]).await;
}

#[tokio::test]
async fn relabel_to_the_same_value_appends_no_layer() {
    let graph = test_graph().await;
    let inviter_id = seed_inviter(&graph).await;
    let user_id = Uuid::new_v4();
    let wallet_id = Uuid::new_v4();
    write_registrant(&graph, user_id, wallet_id, &default_edges(inviter_id))
        .await
        .expect("write registrant");

    let (current, _) = handle_state(&graph, user_id).await;
    // Idempotent on the value: a retry after a partial failure must not stack a
    // duplicate layer (architecture.md "Partial-failure handling").
    relabel(&graph, user_id, &current)
        .await
        .expect("relabel no-op");

    let (username, layers) = handle_state(&graph, user_id).await;
    assert_eq!(username, current);
    assert_eq!(layers, 1, "an unchanged value appends nothing");

    cleanup(&graph, &[inviter_id, user_id, wallet_id]).await;
}

#[tokio::test]
async fn relabel_missing_user_errors() {
    let graph = test_graph().await;
    let result = relabel(&graph, Uuid::new_v4(), "ghost").await;
    assert!(
        matches!(result, Err(graph_engine::GraphError::Invalid(_))),
        "relabeling an absent user aborts"
    );
}

#[tokio::test]
async fn relabel_to_a_taken_handle_is_rejected() {
    let graph = test_graph().await;
    let inviter_id = seed_inviter(&graph).await;
    let holder = Uuid::new_v4();
    let editor = Uuid::new_v4();
    let holder_wallet = Uuid::new_v4();
    let editor_wallet = Uuid::new_v4();
    write_registrant(&graph, holder, holder_wallet, &default_edges(inviter_id))
        .await
        .expect("write holder");
    write_registrant(&graph, editor, editor_wallet, &default_edges(inviter_id))
        .await
        .expect("write editor");

    let (holder_handle, _) = handle_state(&graph, holder).await;
    let (editor_before, _) = handle_state(&graph, editor).await;

    // The node `username` UNIQUE constraint is the backstop behind the
    // resolver's availability pre-check.
    assert!(
        relabel(&graph, editor, &holder_handle).await.is_err(),
        "relabeling onto a taken handle must fail"
    );
    let (editor_after, layers) = handle_state(&graph, editor).await;
    assert_eq!(
        editor_after, editor_before,
        "the rejected relabel rolled back"
    );
    assert_eq!(layers, 1, "no layer appended on the rejected relabel");

    cleanup(
        &graph,
        &[inviter_id, holder, editor, holder_wallet, editor_wallet],
    )
    .await;
}

#[tokio::test]
async fn fetch_user_graph_state_reads_role_and_status() {
    let graph = test_graph().await;
    let inviter_id = seed_inviter(&graph).await;
    let user_id = Uuid::new_v4();
    let wallet_id = Uuid::new_v4();

    write_registrant(&graph, user_id, wallet_id, &default_edges(inviter_id))
        .await
        .expect("write registrant");

    let state = fetch_user_graph_state(&graph, user_id)
        .await
        .expect("fetch")
        .expect("registrant has graph state");
    assert_eq!(state.network_role, NetworkRole::Member);
    assert_eq!(state.moderation_status, "normal");

    // An unknown id reads as absent, not an error.
    let absent = fetch_user_graph_state(&graph, Uuid::new_v4())
        .await
        .expect("fetch absent");
    assert!(absent.is_none(), "unknown user has no graph state");

    cleanup(&graph, &[inviter_id, user_id, wallet_id]).await;
}
