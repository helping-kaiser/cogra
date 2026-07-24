//! The slice-1 query root: the health probe, the viewer (`me`), the
//! applicant's own view, and the staged-write observation read. Reads
//! need no authentication — the shared graph is public; the private
//! fields are field-level authorized on their types.

use async_graphql::{Context, Object, SimpleObject};
use postgres_store::{PgPool, auth as store, staged};
use uuid::Uuid;

use super::mutation::application_view;
use super::types::{ApplicationView, StagedWriteType, User};
use crate::auth::Viewer;

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

    /// The viewer's own account, resolved from the request's auth token.
    /// Null when the request is unauthenticated.
    async fn me(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<User>> {
        let Some(viewer) = ctx.data::<Option<Viewer>>()?.as_ref().copied() else {
            return Ok(None);
        };
        let pool = ctx.data::<PgPool>()?;
        Ok(store::actor_identity(pool, viewer.user_id)
            .await?
            .map(|identity| User::from_viewer(identity, viewer)))
    }

    /// The applicant's own view of their application, authorized by the
    /// applicant token; null when the token authorizes nothing.
    async fn application(
        &self,
        ctx: &Context<'_>,
        applicant_token: String,
    ) -> async_graphql::Result<Option<ApplicationView>> {
        application_view(ctx, &applicant_token).await
    }

    /// One staged write mid-handshake. Field-level: resolves only for
    /// the staging actor's session; null otherwise.
    async fn staged_write(
        &self,
        ctx: &Context<'_>,
        id: Uuid,
    ) -> async_graphql::Result<Option<StagedWriteType>> {
        let Some(viewer) = ctx.data::<Option<Viewer>>()?.as_ref().copied() else {
            return Ok(None);
        };
        let pool = ctx.data::<PgPool>()?;
        match staged::load(pool, id).await {
            Ok(w) if w.staged_by == staged::StagedBy::Actor(viewer.user_id) => {
                Ok(Some(StagedWriteType(w)))
            }
            Ok(_) | Err(staged::StagedError::NotFound(_)) => Ok(None),
            Err(e) => Err(async_graphql::Error::new(e.to_string())),
        }
    }
}
