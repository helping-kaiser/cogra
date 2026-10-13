//! `cogra-ranker` — the server's ranker pod process (ranker-core §4).

use ranker_server::api::ApiClient;
use ranker_server::{Config, app, schema};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .json()
        .init();
    let config = Config::from_env()?;
    let api = ApiClient::new(&config.api_url, config.api_timeout)?;
    let listener = tokio::net::TcpListener::bind(&config.bind).await?;
    tracing::info!(bind = %config.bind, api = %config.api_url, "the ranker pod listens");
    axum::serve(listener, app(schema::build(api))).await?;
    Ok(())
}
