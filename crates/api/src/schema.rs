//! The GraphQL schema — the exported `schema.graphql` is generated from
//! here and is the frontend contract (docs/implementation/api-spec.md).
//!
//! The schema builds without store handles (`sdl()` needs no databases);
//! live handles are injected as context data by `build()` and read by
//! resolvers at request time.

use async_graphql::{Context, EmptyMutation, EmptySubscription, Object, Schema, SimpleObject};
use graph_engine::Graph;
use postgres_store::PgPool;

pub type ApiSchema = Schema<Query, EmptyMutation, EmptySubscription>;

/// Connectivity report for the API process and its two stores.
#[derive(SimpleObject)]
pub struct Health {
    /// Version of the backend serving this schema.
    backend_version: String,
    /// True when PostgreSQL (the display-content store) answers a
    /// round-trip probe.
    postgres_connected: bool,
    /// True when Memgraph (the graph store) answers a round-trip probe.
    memgraph_connected: bool,
}

/// The query root.
pub struct Query;

#[Object]
impl Query {
    /// Reports whether the API can reach both of its stores. Reachable
    /// stores answer round-trip probes; a `false` means that store is
    /// down or unreachable, not that the API itself is.
    async fn health(&self, ctx: &Context<'_>) -> async_graphql::Result<Health> {
        let pool = ctx.data::<PgPool>()?;
        let graph = ctx.data::<Graph>()?;
        Ok(Health {
            backend_version: env!("CARGO_PKG_VERSION").to_string(),
            postgres_connected: postgres_store::ping(pool).await,
            memgraph_connected: graph_engine::ping(graph).await,
        })
    }
}

/// Builds the executable schema with live store handles attached.
pub fn build(pool: PgPool, graph: Graph) -> ApiSchema {
    Schema::build(Query, EmptyMutation, EmptySubscription)
        .data(pool)
        .data(graph)
        .finish()
}

/// The schema's SDL — what `schema.graphql` must contain.
pub fn sdl() -> String {
    Schema::build(Query, EmptyMutation, EmptySubscription)
        .finish()
        .sdl()
}
