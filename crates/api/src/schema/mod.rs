//! The GraphQL schema — the exported `schema.graphql` is generated from
//! here and is the frontend contract (checked in, CI-diffed; Apollo
//! Kotlin and GraphQL Code Generator both generate from it).
//!
//! Slice 1's surface: onboarding and the applicant flow, sessions and
//! credentials, invite links, and the client-signed write path's relay
//! legs (api-spec.md).

mod mutation;
mod query;
pub mod types;

use std::sync::Arc;

use async_graphql::{EmptySubscription, Schema};
use l1_standin::StandIn;
use postgres_store::PgPool;

pub use mutation::Mutation;
pub use query::Query;

use crate::auth::AuthConfig;
use crate::l1::StandInBoundary;
use crate::mailer::Mailer;
use crate::onboarding::OnboardingConfig;

pub type ApiSchema = Schema<Query, Mutation, EmptySubscription>;

/// Everything the resolvers reach through the schema context.
pub struct ApiContext {
    pub pool: PgPool,
    pub boundary: StandInBoundary,
    /// The stand-in's dev L0 surface the admission funding uses —
    /// replaced at the swap along with the crate (roadmap.md).
    pub funding: StandIn,
    pub auth: AuthConfig,
    pub mailer: Arc<dyn Mailer>,
    pub onboarding: OnboardingConfig,
}

/// Builds the executable schema with the live handles attached.
pub fn build(ctx: ApiContext) -> ApiSchema {
    Schema::build(Query, Mutation, EmptySubscription)
        .data(ctx.pool)
        .data(ctx.boundary)
        .data(ctx.funding)
        .data(ctx.auth)
        .data(ctx.mailer)
        .data(ctx.onboarding)
        .finish()
}

/// The schema's SDL — what `schema.graphql` must contain.
pub fn sdl() -> String {
    Schema::build(Query, Mutation, EmptySubscription)
        .finish()
        .sdl()
}
