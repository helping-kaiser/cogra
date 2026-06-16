// API entry point — Axum HTTP server hosting the async-graphql schema.
// Startup applies both stores' schemas (Postgres migrations, Memgraph
// constraints + indexes) before serving.

use anyhow::Context;
use tracing_subscriber::EnvFilter;

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let database_url =
        std::env::var("DATABASE_URL").context("DATABASE_URL must be set (see .env.example)")?;
    let pool = postgres_store::connect(&database_url)
        .await
        .context("connecting to PostgreSQL")?;
    postgres_store::run_migrations(&pool)
        .await
        .context("running Postgres migrations")?;
    tracing::info!("PostgreSQL connected, migrations applied");

    let memgraph_host = env_or("MEMGRAPH_HOST", "localhost");
    let memgraph_port = env_or("MEMGRAPH_PORT", "7687")
        .parse()
        .context("MEMGRAPH_PORT must be a port number")?;
    let graph = graph_engine::connect(&memgraph_host, memgraph_port)
        .await
        .context("connecting to Memgraph")?;
    graph_engine::schema::apply_schema(&graph)
        .await
        .context("applying graph constraints + indexes")?;
    tracing::info!("Memgraph connected, graph schema applied");

    let schema = api::schema::build(pool, graph);
    let addr = format!(
        "{}:{}",
        env_or("API_HOST", "0.0.0.0"),
        env_or("API_PORT", "8080")
    );
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("binding {addr}"))?;
    tracing::info!("listening on http://{addr} — /graphql, /health, /playground (dev)");
    axum::serve(listener, api::app(schema)).await?;
    Ok(())
}
