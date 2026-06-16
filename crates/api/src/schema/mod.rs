//! The GraphQL schema — the exported `schema.graphql` is generated from here
//! and is the frontend contract (docs/implementation/api-spec.md).
//!
//! The schema builds without store handles (`sdl()` needs no databases); live
//! handles and the JWT keys are injected as context data by `build()` and
//! read by resolvers at request time. The per-request `Viewer` is injected by
//! the GraphQL HTTP handler (see `crate::app`).

mod ops;
mod types;
mod user;

use std::sync::Arc;

use async_graphql::{Context, EmptySubscription, Object, Schema, SimpleObject};
use graph_engine::Graph;
use postgres_store::PgPool;

use crate::auth::Viewer;
use crate::auth::jwt::JwtKeys;
use types::{LogInInput, RefreshSessionInput, RegisterInput, RegisterPayload, VerifyEmailInput};
use user::{AuthPayload, User};

pub type ApiSchema = Schema<Query, Mutation, EmptySubscription>;

/// Connectivity report for the API process and its two stores.
#[derive(SimpleObject)]
pub struct Health {
    /// Version of the backend serving this schema.
    backend_version: String,
    /// True when PostgreSQL (the display-content store) answers a round-trip
    /// probe.
    postgres_connected: bool,
    /// True when Memgraph (the graph store) answers a round-trip probe.
    memgraph_connected: bool,
}

/// The query root.
pub struct Query;

#[Object]
impl Query {
    /// Reports whether the API can reach both of its stores. Reachable stores
    /// answer round-trip probes; a `false` means that store is down or
    /// unreachable, not that the API itself is.
    async fn health(&self, ctx: &Context<'_>) -> async_graphql::Result<Health> {
        let pool = ctx.data::<PgPool>()?;
        let graph = ctx.data::<Graph>()?;
        Ok(Health {
            backend_version: env!("CARGO_PKG_VERSION").to_string(),
            postgres_connected: postgres_store::ping(pool).await,
            memgraph_connected: graph_engine::ping(graph).await,
        })
    }

    /// Resolve the request's auth token to the viewer's own User node. Null
    /// when the request is unauthenticated — the one query a client cannot
    /// express generically, since it does not yet know its own id.
    async fn me(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<User>> {
        let viewer = ctx.data_opt::<Viewer>().copied().unwrap_or(Viewer(None));
        match viewer.0 {
            None => Ok(None),
            Some(id) => User::load(ctx.data::<PgPool>()?, ctx.data::<Graph>()?, id).await,
        }
    }
}

/// The mutation root. Slice 0 carries only the auth/account gestures that
/// precede a session; the wider write surface arrives with later slices.
pub struct Mutation;

#[Object]
impl Mutation {
    /// Submit a registration through an invite link. Writes the off-graph
    /// pending record and sends the verification email (dev: logs the token)
    /// — no User node or session exists until verifyEmail.
    async fn register(
        &self,
        ctx: &Context<'_>,
        input: RegisterInput,
    ) -> async_graphql::Result<RegisterPayload> {
        ops::register(ctx, input).await
    }

    /// Complete registration with the emailed verification token. Atomically
    /// creates the User node and its Wallet, writes the two invitation edges,
    /// and issues the first session (auth.md).
    async fn verify_email(
        &self,
        ctx: &Context<'_>,
        input: VerifyEmailInput,
    ) -> async_graphql::Result<AuthPayload> {
        ops::verify_email(ctx, input).await
    }

    /// Authenticate with email + password; issues a new session.
    async fn log_in(
        &self,
        ctx: &Context<'_>,
        input: LogInInput,
    ) -> async_graphql::Result<AuthPayload> {
        ops::log_in(ctx, input).await
    }

    /// Rotate the refresh token and mint a fresh access token.
    async fn refresh_session(
        &self,
        ctx: &Context<'_>,
        input: RefreshSessionInput,
    ) -> async_graphql::Result<AuthPayload> {
        ops::refresh_session(ctx, input).await
    }
}

/// Builds the executable schema with live store handles and JWT keys attached.
pub fn build(pool: PgPool, graph: Graph, jwt: Arc<JwtKeys>) -> ApiSchema {
    Schema::build(Query, Mutation, EmptySubscription)
        .data(pool)
        .data(graph)
        .data(jwt)
        .finish()
}

/// The schema's SDL — what `schema.graphql` must contain.
pub fn sdl() -> String {
    Schema::build(Query, Mutation, EmptySubscription)
        .finish()
        .sdl()
}
