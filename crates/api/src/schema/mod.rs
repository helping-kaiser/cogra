//! The GraphQL schema — the exported `schema.graphql` is generated from
//! here and is the frontend contract.
//!
//! Slice 0 carries no product surface: the pre-rebase auth/content schema
//! was retired with the dual-store design, and the rebuilt surface arrives
//! with slice 1 (onboarding and client-signed writes — roadmap.md). What
//! remains is the health probe.

use async_graphql::{Context, EmptyMutation, EmptySubscription, Object, Schema, SimpleObject};
use postgres_store::PgPool;

pub type ApiSchema = Schema<Query, EmptyMutation, EmptySubscription>;

/// Connectivity report for the API process and its store.
#[derive(SimpleObject)]
pub struct Health {
    /// Version of the backend serving this schema.
    backend_version: String,
    /// True when PostgreSQL answers a round-trip probe.
    postgres_connected: bool,
    /// The last L1 epoch fully ingested into the record mirror; -1 until
    /// the first epoch lands.
    mirror_epoch: i64,
}

/// The query root.
pub struct Query;

#[Object]
impl Query {
    /// Reports whether the API can reach its store, and how far the record
    /// mirror has ingested.
    async fn health(&self, ctx: &Context<'_>) -> async_graphql::Result<Health> {
        let pool = ctx.data::<PgPool>()?;
        let mirror_epoch = postgres_store::mirror::last_ingested_epoch(pool)
            .await
            .unwrap_or(-1);
        Ok(Health {
            backend_version: env!("CARGO_PKG_VERSION").to_string(),
            postgres_connected: postgres_store::ping(pool).await,
            mirror_epoch,
        })
    }
}

/// Builds the executable schema with the live store handle attached.
pub fn build(pool: PgPool) -> ApiSchema {
    Schema::build(Query, EmptyMutation, EmptySubscription)
        .data(pool)
        .finish()
}

/// The schema's SDL — what `schema.graphql` must contain.
pub fn sdl() -> String {
    Schema::build(Query, EmptyMutation, EmptySubscription)
        .finish()
        .sdl()
}
