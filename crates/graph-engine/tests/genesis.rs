//! Integration tests for the genesis bootstrap graph write — require Memgraph
//! (`make up`); connection comes from MEMGRAPH_HOST / MEMGRAPH_PORT.
//!
//! The `:Network` singleton is one global node a real `make bootstrap` may
//! already have created, and a shared Memgraph can't host one per test. So
//! these tests use fresh UUIDs and unique handles for the genesis
//! User/Wallet/Hashtag (which they own and clean up), and branch on whether a
//! singleton pre-exists — owning and removing it only when they created it,
//! never destroying a real one (see graph-engine/tests/schema.rs, PR 2 item 3).

use graph_engine::Graph;
use graph_engine::genesis::{GenesisInput, bootstrap, genesis_identity, is_bootstrapped};
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

/// Fresh ids and unique handles so the genesis nodes never collide with a real
/// bootstrap's `:User`/`:Hashtag` UNIQUE constraints.
fn fresh_input() -> GenesisInput {
    let tag = Uuid::new_v4().simple().to_string();
    GenesisInput {
        network_id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        username: format!("genesis-{tag}"),
        wallet_id: Uuid::new_v4(),
        wallet_address: format!("unfunded:{tag}"),
        hashtag_id: Uuid::new_v4(),
        hashtag_name: format!("bot-defense-{tag}"),
        guidelines_hash: "deadbeef".into(),
    }
}

async fn run_bootstrap(graph: &Graph, input: &GenesisInput) {
    let mut txn = graph.start_txn().await.expect("open txn");
    bootstrap(&mut txn, input).await.expect("bootstrap");
    txn.commit().await.expect("commit");
}

/// Removes the genesis User/Wallet/Hashtag this test created; the `:Network`
/// singleton only when the test owned it (none pre-existed).
async fn cleanup(graph: &Graph, input: &GenesisInput, owns_network: bool) {
    let mut ids = vec![
        input.user_id.to_string(),
        input.wallet_id.to_string(),
        input.hashtag_id.to_string(),
    ];
    if owns_network {
        ids.push(input.network_id.to_string());
    }
    graph
        .run(query("MATCH (n) WHERE n.id IN $ids DETACH DELETE n").param("ids", ids))
        .await
        .expect("cleanup");
}

/// Counts nodes/edges matched by a single-`$id` pattern returning `count AS c`.
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

#[tokio::test]
async fn bootstrap_writes_the_four_genesis_nodes() {
    let graph = test_graph().await;
    let owns_network = !is_bootstrapped(&graph).await.expect("pre-check");
    let input = fresh_input();
    run_bootstrap(&graph, &input).await;

    // The instance now reads as bootstrapped regardless of who owns the singleton.
    assert!(is_bootstrapped(&graph).await.expect("post-check"));

    // The genesis User: moderator role, normal moderation cache, handle set.
    let mut rows = graph
        .execute(
            query(
                "MATCH (u:User {id: $id})
                 RETURN u.network_role AS role, u.moderation_status AS mod, u.username AS name",
            )
            .param("id", input.user_id.to_string()),
        )
        .await
        .expect("user query");
    let row = rows
        .next()
        .await
        .expect("row")
        .expect("genesis user exists");
    assert_eq!(row.get::<String>("role").expect("role"), "moderator");
    assert_eq!(row.get::<String>("mod").expect("mod"), "normal");
    assert_eq!(row.get::<String>("name").expect("name"), input.username);

    // The Wallet + its zeroed structural PAYS_TO binding at layer 1.
    let mut rows = graph
        .execute(
            query(
                "MATCH (:User {id: $id})-[e:PAYS_TO]->(w:Wallet {id: $wid})
                 RETURN e.dim1 AS d1, e.dim2 AS d2, e.layer AS layer, w.address AS addr",
            )
            .param("id", input.user_id.to_string())
            .param("wid", input.wallet_id.to_string()),
        )
        .await
        .expect("wallet query");
    let row = rows
        .next()
        .await
        .expect("row")
        .expect("PAYS_TO edge exists");
    assert_eq!(row.get::<f64>("d1").expect("d1"), 0.0);
    assert_eq!(row.get::<f64>("d2").expect("d2"), 0.0);
    assert_eq!(row.get::<i64>("layer").expect("layer"), 1);
    assert_eq!(
        row.get::<String>("addr").expect("addr"),
        input.wallet_address
    );

    // The bot-defense Hashtag carries its name.
    let name: String = {
        let mut rows = graph
            .execute(
                query("MATCH (h:Hashtag {id: $id}) RETURN h.name AS name")
                    .param("id", input.hashtag_id.to_string()),
            )
            .await
            .expect("hashtag query");
        rows.next()
            .await
            .expect("row")
            .expect("hashtag exists")
            .get("name")
            .expect("name")
    };
    assert_eq!(name, input.hashtag_name);

    cleanup(&graph, &input, owns_network).await;
}

#[tokio::test]
async fn rerunning_bootstrap_is_a_no_op() {
    let graph = test_graph().await;
    let owns_network = !is_bootstrapped(&graph).await.expect("pre-check");
    let input = fresh_input();

    // Two commits with the same ids — the retry after a partial failure. The
    // MERGE on the node ids and singleton marker must adopt, never duplicate.
    run_bootstrap(&graph, &input).await;
    run_bootstrap(&graph, &input).await;

    assert_eq!(
        count(
            &graph,
            "MATCH (u:User {id: $id}) RETURN count(u) AS c",
            input.user_id
        )
        .await,
        1,
        "exactly one genesis User after re-run"
    );
    assert_eq!(
        count(
            &graph,
            "MATCH (w:Wallet {id: $id}) RETURN count(w) AS c",
            input.wallet_id
        )
        .await,
        1,
        "exactly one Wallet after re-run"
    );
    assert_eq!(
        count(
            &graph,
            "MATCH (h:Hashtag {id: $id}) RETURN count(h) AS c",
            input.hashtag_id
        )
        .await,
        1,
        "exactly one Hashtag after re-run"
    );
    assert_eq!(
        count(
            &graph,
            "MATCH (:User {id: $id})-[r:PAYS_TO]->() RETURN count(r) AS c",
            input.user_id,
        )
        .await,
        1,
        "exactly one PAYS_TO edge after re-run"
    );

    cleanup(&graph, &input, owns_network).await;
}

#[tokio::test]
async fn genesis_identity_resolves_the_committed_user() {
    let graph = test_graph().await;

    if is_bootstrapped(&graph).await.expect("pre-check") {
        // A real singleton's `genesis_user_id` points at the real genesis User,
        // which this test must neither assert against nor mutate.
        return;
    }

    // No singleton yet: the pointer-backed read has nothing to resolve.
    assert!(
        genesis_identity(&graph)
            .await
            .expect("identity read")
            .is_none(),
        "no singleton means no genesis identity"
    );

    let input = fresh_input();
    run_bootstrap(&graph, &input).await;

    // The singleton's pointer resolves back to the committed genesis User — the
    // id and handle the bootstrap reuses to complete a half-failed run.
    let identity = genesis_identity(&graph)
        .await
        .expect("identity read")
        .expect("genesis identity after bootstrap");
    assert_eq!(identity.user_id, input.user_id, "pointer targets the user");
    assert_eq!(identity.username, input.username, "handle round-trips");

    cleanup(&graph, &input, true).await;
}

#[tokio::test]
async fn is_bootstrapped_reflects_the_singleton() {
    let graph = test_graph().await;

    if is_bootstrapped(&graph).await.expect("check") {
        // A real singleton is already present (e.g. `make bootstrap` ran): only
        // the true side is observable on the shared instance.
        return;
    }

    // The false branch: no singleton yet. Bootstrap creates it, flipping the
    // signal to true.
    assert!(
        !is_bootstrapped(&graph).await.expect("check"),
        "no singleton means not bootstrapped"
    );
    let input = fresh_input();
    run_bootstrap(&graph, &input).await;
    assert!(
        is_bootstrapped(&graph).await.expect("check"),
        "the singleton makes the instance bootstrapped"
    );

    cleanup(&graph, &input, true).await;
}
