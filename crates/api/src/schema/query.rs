//! The slice-1 query root: the health probe, the viewer (`me`), the
//! applicant's own view, and the staged-write observation read. Reads
//! need no authentication — the shared graph is public; the private
//! fields are field-level authorized on their types.

use async_graphql::{Context, Object, SimpleObject};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use postgres_store::{PgPool, auth as store, staged};
use uuid::Uuid;

use super::mutation::application_view;
use super::types::{ApplicationView, InviteLinkCheck, StagedWriteType, User};
use crate::auth::Viewer;
use crate::l1::{L1Boundary, StandInBoundary};

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

    /// The host key the device verifies seals against before approving
    /// (base64) — realization transparency: every host-added field of a
    /// verified act is checkable on-device.
    async fn host_public_key(&self, ctx: &Context<'_>) -> async_graphql::Result<String> {
        let boundary = ctx.data::<StandInBoundary>()?;
        let key = boundary
            .host_public_key()
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        Ok(B64.encode(key))
    }

    /// Anonymous pre-submit check of an invite link, so the app can gate
    /// the registration form and key ceremony on a usable capability.
    /// Null when the id references no link.
    async fn invite_link_check(
        &self,
        ctx: &Context<'_>,
        id: Uuid,
    ) -> async_graphql::Result<Option<InviteLinkCheck>> {
        let pool = ctx.data::<PgPool>()?;
        let Some(link) = store::invite_link(pool, id).await? else {
            return Ok(None);
        };
        let inviter = store::actor_identity(pool, link.inviter_id)
            .await?
            .ok_or_else(|| async_graphql::Error::new("invite link without inviter"))?;
        Ok(Some(InviteLinkCheck {
            usable: store::invite_link_usable(pool, id).await?,
            inviter_handle: inviter.handle,
            expires_at: link.expires_at,
        }))
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
