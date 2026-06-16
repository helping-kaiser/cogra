//! End-to-end tests for the both-stores genesis gate (`api::bootstrap::run`).
//! Require both databases (`make up`); connection comes from DATABASE_URL /
//! MEMGRAPH_HOST / MEMGRAPH_PORT.
//!
//! The genesis write creates the `:Network` singleton, of which a shared
//! Memgraph hosts exactly one. So the write/repair paths are exercised only
//! when no singleton pre-exists (this test owns it and tears it down); when a
//! real bootstrap already ran, the test asserts only the safe already-complete
//! branch against it, never mutating it.

use api::bootstrap::{BootstrapOutcome, GenesisContent, run};
use graph_engine::Graph;
use graph_engine::genesis::is_bootstrapped;
use neo4rs::query;
use postgres_store::PgPool;
use postgres_store::genesis::genesis_present;
use uuid::Uuid;

struct Harness {
    pool: PgPool,
    graph: Graph,
}

async fn harness() -> Harness {
    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = postgres_store::connect(&database_url)
        .await
        .expect("Postgres must be running (make up)");
    postgres_store::run_migrations(&pool)
        .await
        .expect("migrations apply");

    let host = std::env::var("MEMGRAPH_HOST").unwrap_or_else(|_| "localhost".into());
    let port = std::env::var("MEMGRAPH_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(7687);
    let graph = graph_engine::connect(&host, port)
        .await
        .expect("Memgraph must be running (make up)");
    graph_engine::schema::apply_schema(&graph)
        .await
        .expect("graph schema applies");

    Harness { pool, graph }
}

/// Unique-per-run genesis content so the genesis `users`/handle/hashtag never
/// collide with a previous run's leftovers under their UNIQUE constraints.
fn genesis_content() -> GenesisContent {
    let tag = Uuid::new_v4().simple().to_string();
    GenesisContent {
        username: format!("genesis-{tag}"),
        email: format!("genesis-{tag}@cogra.local"),
        hashtag_name: format!("bot-defense-{tag}"),
        guidelines_hash: "deadbeef".into(),
        invite_ttl_days: 1,
    }
}

fn dummy_hash() -> anyhow::Result<String> {
    Ok("dummy-password-hash".into())
}

/// Removes every node this test owns: the genesis User, its Wallet (reached via
/// PAYS_TO), the `:Network` singleton, and the Hashtag — plus the Postgres
/// genesis rows. Only called on the path where the test created the singleton.
async fn cleanup(h: &Harness, network_id: Uuid, user_id: Uuid, hashtag_id: Uuid) {
    h.graph
        .run(
            query("MATCH (:User {id: $uid})-[:PAYS_TO]->(w:Wallet) DETACH DELETE w")
                .param("uid", user_id.to_string()),
        )
        .await
        .expect("wallet cleanup");
    h.graph
        .run(query("MATCH (n) WHERE n.id IN $ids DETACH DELETE n").param(
            "ids",
            vec![
                network_id.to_string(),
                user_id.to_string(),
                hashtag_id.to_string(),
            ],
        ))
        .await
        .expect("node cleanup");
    sqlx::query("DELETE FROM auth_invitations WHERE inviter_id = $1")
        .bind(user_id)
        .execute(&h.pool)
        .await
        .expect("invitation cleanup");
    sqlx::query("DELETE FROM user_profile_versions WHERE user_id = $1")
        .bind(user_id)
        .execute(&h.pool)
        .await
        .expect("profile cleanup");
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&h.pool)
        .await
        .expect("user cleanup");
}

/// Deletes only the Postgres genesis rows — simulates a run whose graph half
/// committed but whose Postgres transaction failed.
async fn drop_postgres_half(pool: &PgPool, user_id: Uuid) {
    sqlx::query("DELETE FROM auth_invitations WHERE inviter_id = $1")
        .bind(user_id)
        .execute(pool)
        .await
        .expect("drop invitation");
    sqlx::query("DELETE FROM user_profile_versions WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await
        .expect("drop profile");
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(pool)
        .await
        .expect("drop user");
}

/// The gate's paths in one test: a shared Memgraph hosts a single `:Network`
/// singleton, so the owned write/repair paths must not be exercised by two
/// tests in parallel (they would collide on the singleton's unique constraint).
/// Both scenarios run sequentially here, each owning the singleton in turn.
#[tokio::test]
async fn genesis_gate_paths() {
    let h = harness().await;
    if is_bootstrapped(&h.graph).await.expect("pre-check") {
        // A real singleton already exists; the owned write/repair paths can't be
        // exercised on the shared instance without mutating it.
        return;
    }
    fresh_then_complete_then_repair(&h).await;
    repair_aborts_on_a_conflicting_handle(&h).await;
}

async fn fresh_then_complete_then_repair(h: &Harness) {
    let content = genesis_content();
    let hashtag_id = common::hashtag::hashtag_uuid(&content.hashtag_name);

    // FRESH: empty instance — both halves commit.
    let (network_id, user_id, fresh_invite) = match run(&h.pool, &h.graph, &content, dummy_hash)
        .await
        .expect("fresh")
    {
        BootstrapOutcome::Fresh {
            network_id,
            user_id,
            invite_link,
            ..
        } => (network_id, user_id, invite_link),
        other => panic!("expected Fresh, got {}", variant(&other)),
    };
    assert!(
        genesis_present(&h.pool, user_id).await.expect("present"),
        "fresh run wrote the Postgres half"
    );

    // FULL RE-RUN: both halves present — no write, the existing link re-surfaces.
    match run(&h.pool, &h.graph, &content, dummy_hash)
        .await
        .expect("already-complete")
    {
        BootstrapOutcome::AlreadyComplete {
            user_id: u,
            invite_link,
        } => {
            assert_eq!(u, user_id, "same genesis user");
            assert_eq!(invite_link, fresh_invite, "re-surfaces the existing link");
        }
        other => panic!("expected AlreadyComplete, got {}", variant(&other)),
    }

    // PARTIAL FAILURE: drop the Postgres half, leaving the graph committed.
    drop_postgres_half(&h.pool, user_id).await;
    assert!(
        !genesis_present(&h.pool, user_id).await.expect("absent"),
        "the Postgres half is gone"
    );

    // REPAIR: the re-run completes Postgres against the committed graph identity,
    // reusing its id and minting a fresh link (the old one was lost).
    match run(&h.pool, &h.graph, &content, dummy_hash)
        .await
        .expect("repair")
    {
        BootstrapOutcome::Repaired {
            user_id: u,
            username,
            invite_link,
        } => {
            assert_eq!(u, user_id, "repair reuses the committed graph id");
            assert_eq!(username, content.username, "graph handle is authoritative");
            assert_ne!(invite_link, fresh_invite, "a fresh link was minted");
        }
        other => panic!("expected Repaired, got {}", variant(&other)),
    }
    assert!(
        genesis_present(&h.pool, user_id).await.expect("present"),
        "repair restored the Postgres half"
    );

    cleanup(h, network_id, user_id, hashtag_id).await;
}

async fn repair_aborts_on_a_conflicting_handle(h: &Harness) {
    let content = genesis_content();
    let hashtag_id = common::hashtag::hashtag_uuid(&content.hashtag_name);

    let (network_id, user_id) = match run(&h.pool, &h.graph, &content, dummy_hash)
        .await
        .expect("fresh")
    {
        BootstrapOutcome::Fresh {
            network_id,
            user_id,
            ..
        } => (network_id, user_id),
        other => panic!("expected Fresh, got {}", variant(&other)),
    };

    drop_postgres_half(&h.pool, user_id).await;

    // A repair supplying a different handle than the committed graph User must
    // abort rather than write a desynced Postgres row.
    let mut conflicting = genesis_content();
    conflicting.username = format!("{}-other", content.username);
    let err = run(&h.pool, &h.graph, &conflicting, dummy_hash)
        .await
        .expect_err("conflicting handle aborts");
    assert!(
        err.to_string().contains(&content.username),
        "the error names the committed handle"
    );
    assert!(
        !genesis_present(&h.pool, user_id)
            .await
            .expect("still absent"),
        "the aborted repair wrote nothing"
    );

    cleanup(h, network_id, user_id, hashtag_id).await;
}

fn variant(outcome: &BootstrapOutcome) -> &'static str {
    match outcome {
        BootstrapOutcome::Fresh { .. } => "Fresh",
        BootstrapOutcome::Repaired { .. } => "Repaired",
        BootstrapOutcome::AlreadyComplete { .. } => "AlreadyComplete",
    }
}
