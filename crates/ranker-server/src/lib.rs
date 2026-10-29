//! The server's ranker pod (ranker-core §4): the pure `ranker` crate behind
//! a small GraphQL schema, in a process and container of its own — never
//! inside the backend (PR-9). The api's relay calls `rank`; the pod fetches
//! the viewer's slice and the governed parameters back from the api itself,
//! ranks, and answers at the id level.
//!
//! Its posture is the miner's (miner-api.md "Delegation and trust"): no
//! credential, no database, no secret, no volume, no state — to the api it
//! is any anonymous reader. Internal network only: it publishes no host
//! port in production, so it has no rate-limiter scope of its own.

pub mod api;
pub mod schema;
pub mod shutdown;

use std::time::Duration;

use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{Value, json};

use crate::schema::RankerSchema;

/// The pod's configuration (ranker-core §4.4).
#[derive(Debug, Clone)]
pub struct Config {
    /// Where the pod reads the slice and the parameters (`API_URL`).
    pub api_url: String,
    /// The listen address (`RANKER_BIND`).
    pub bind: String,
    /// The bound on one api request.
    pub api_timeout: Duration,
}

impl Config {
    /// The dev api: the api's own `/graphql` on its dev port.
    pub const DEFAULT_API_URL: &str = "http://localhost:8080/graphql";
    /// 8090 avoids the dev ports 3000, 8080, 5432 and 9000/9001, which
    /// share one port space with WSL under mirrored networking.
    pub const DEFAULT_BIND: &str = "0.0.0.0:8090";
    pub const DEFAULT_API_TIMEOUT_MS: u64 = 30_000;

    /// The configuration the environment names, the dev defaults beneath.
    pub fn from_env() -> anyhow::Result<Self> {
        use anyhow::Context;
        let env_or =
            |key: &str, default: &str| std::env::var(key).unwrap_or_else(|_| default.to_string());
        let timeout_ms: u64 = env_or(
            "RANKER_API_TIMEOUT_MS",
            &Self::DEFAULT_API_TIMEOUT_MS.to_string(),
        )
        .parse()
        .context("RANKER_API_TIMEOUT_MS must be a number of milliseconds")?;
        Ok(Self {
            api_url: env_or("API_URL", Self::DEFAULT_API_URL),
            bind: env_or("RANKER_BIND", Self::DEFAULT_BIND),
            api_timeout: Duration::from_millis(timeout_ms),
        })
    }
}

/// Process liveness only: the pod holds nothing whose health it could
/// report beyond answering.
async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

async fn graphql(State(schema): State<RankerSchema>, request: GraphQLRequest) -> GraphQLResponse {
    schema.execute(request.into_inner()).await.into()
}

/// The pod's HTTP surface: `POST /graphql` and `GET /health`.
pub fn app(schema: RankerSchema) -> Router {
    Router::new()
        .route("/graphql", post(graphql))
        .route("/health", get(health))
        .with_state(schema)
}
