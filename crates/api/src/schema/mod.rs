//! ´mod:module:schema´
//!
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
use crate::breach::BreachCorpus;
use crate::l1::StandInBoundary;
use crate::mailer::{Mailer, WebOrigin};
use crate::onboarding::OnboardingConfig;
use crate::ratelimit::RateLimitConfig;

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
    pub web_origin: WebOrigin,
    pub onboarding: OnboardingConfig,
    pub rate_limits: RateLimitConfig,
    pub breach: Arc<dyn BreachCorpus>,
}

/// The per-query demand budgets (roadmap.md slice 1.1; api-spec.md
/// "Query budgets"), enforced in validation before any resolver runs:
/// depth caps nesting, complexity caps total field count with
/// connection fields priced at page size × item cost
/// (`types::connection_cost`) and author-owned fold lists at their
/// stated bound (`types::fold_cost`). A tripped budget is a
/// message-only validation error.
///
/// Both numbers are measured, not chosen: the ceilings below come from
/// replaying every committed client document against this schema, and
/// `tests/client_operations.rs` fails by operation name if either
/// posture stops admitting one. The heaviest operation either client
/// sends is the Android post-detail read at **70 088** complexity and
/// **12** levels; the standard introspection query is cheap (181) but
/// deep (13).
#[derive(Debug, Clone, Copy)]
pub struct QueryBudgets {
    pub depth: usize,
    pub complexity: usize,
    pub introspection_enabled: bool,
}

impl QueryBudgets {
    /// The production posture: introspection off — the schema is
    /// already public as the checked-in `schema.graphql`.
    ///
    /// 100 000 clears the heaviest client operation with ~1.4×
    /// headroom, and 15 levels clear the deepest with three to spare.
    pub fn release() -> Self {
        Self {
            depth: 15,
            complexity: 100_000,
            introspection_enabled: false,
        }
    }

    /// The dev posture: the same ceilings, introspection on for the
    /// playground.
    ///
    /// The ceilings are deliberately identical. A dev posture looser
    /// than release stops being a preview of it — a client document
    /// can then sail through every dev build and be refused only in
    /// production, which is exactly how the release ceiling went a
    /// whole slice without admitting the clients' own reads. Depth 15
    /// is what introspection needs (13 `ofType` levels); its
    /// complexity is smaller than any content read's.
    pub fn dev() -> Self {
        Self {
            depth: 15,
            complexity: 100_000,
            introspection_enabled: true,
        }
    }
}

/// Builds the executable schema with the live handles attached: dev
/// budgets in debug builds (the playground needs introspection),
/// release budgets otherwise.
pub fn build(ctx: ApiContext) -> ApiSchema {
    let budgets = if cfg!(debug_assertions) {
        QueryBudgets::dev()
    } else {
        QueryBudgets::release()
    };
    build_with(ctx, budgets)
}

/// Builds the schema under explicit budgets — the seam the budget tests
/// drive both postures through.
pub fn build_with(ctx: ApiContext, budgets: QueryBudgets) -> ApiSchema {
    let mut builder = Schema::build(Query, Mutation, EmptySubscription)
        .data(ctx.pool)
        .data(ctx.boundary)
        .data(ctx.funding)
        .data(ctx.auth)
        .data(ctx.mailer)
        .data(ctx.web_origin)
        .data(ctx.onboarding)
        .data(ctx.rate_limits)
        .data(ctx.breach)
        .limit_depth(budgets.depth)
        .limit_complexity(budgets.complexity);
    if !budgets.introspection_enabled {
        builder = builder.disable_introspection();
    }
    builder.finish()
}

/// The schema's SDL — what `schema.graphql` must contain.
pub fn sdl() -> String {
    Schema::build(Query, Mutation, EmptySubscription)
        .finish()
        .sdl()
}
