//! The `User` GraphQL object — assembled from both stores: display content
//! (handle, profile text, timestamps) from Postgres, the `network_role` and
//! moderation cache from the graph. The shared UUID joins them.
//!
//! Slice 0 exposes the core actor fields; avatar/cover (needing
//! `MediaAttachment`) and the private viewer-state fields (bookmarks,
//! sessions, …) land with the slices that introduce them. The `Node`/`Actor`
//! interfaces likewise arrive once a second node type implements them.

use async_graphql::Object;
use chrono::{DateTime, Utc};
use graph_engine::Graph;
use postgres_store::PgPool;
use uuid::Uuid;

use crate::schema::types::{ModeratedText, ModerationStatus, NetworkRole};

/// A person on the platform. Off-graph credentials authenticate the API
/// requests that originate its edges.
pub struct User {
    id: Uuid,
    handle: String,
    display_name: String,
    bio: Option<String>,
    website_url: Option<String>,
    network_role: NetworkRole,
    moderation_status: ModerationStatus,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl User {
    /// Loads a `User` by id, joining the Postgres account/profile with the
    /// graph node's role + moderation cache. `None` when either store lacks
    /// the user — a torn dual-write reads as not-found, never a half User.
    pub async fn load(
        pool: &PgPool,
        graph: &Graph,
        id: Uuid,
    ) -> async_graphql::Result<Option<User>> {
        let Some(record) = postgres_store::users::find_user_by_id(pool, id)
            .await
            .map_err(|e| super::ops::internal("loading user profile", e))?
        else {
            return Ok(None);
        };
        let Some(graph_state) = graph_engine::accounts::fetch_user_graph_state(graph, id)
            .await
            .map_err(|e| super::ops::internal("loading user graph state", e))?
        else {
            return Ok(None);
        };
        Ok(Some(User {
            id: record.id,
            handle: record.username,
            display_name: record.display_name,
            bio: record.bio,
            website_url: record.website_url,
            network_role: graph_state.network_role.into(),
            moderation_status: ModerationStatus::from_graph(&graph_state.moderation_status),
            created_at: record.created_at,
            updated_at: record.updated_at,
        }))
    }
}

#[Object]
impl User {
    async fn id(&self) -> Uuid {
        self.id
    }

    /// The unique mention handle — the User's username.
    async fn handle(&self) -> ModeratedText {
        ModeratedText::normal(self.handle.clone())
    }

    async fn display_name(&self) -> ModeratedText {
        ModeratedText::normal(self.display_name.clone())
    }

    async fn bio(&self) -> ModeratedText {
        ModeratedText::optional(self.bio.clone())
    }

    async fn website_url(&self) -> ModeratedText {
        ModeratedText::optional(self.website_url.clone())
    }

    /// Network-scope role. Only Users carry one.
    async fn network_role(&self) -> NetworkRole {
        self.network_role
    }

    /// Node-level cache: max moderation severity across this actor's fields.
    async fn moderation_status(&self) -> ModerationStatus {
        self.moderation_status
    }

    async fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    /// When this node last changed — its most recent profile version; equals
    /// createdAt if never edited.
    async fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }
}

/// A fresh access + refresh token pair, the issuing session, and the viewer it
/// authenticates.
pub struct AuthPayload {
    pub access_token: String,
    pub refresh_token: String,
    pub session: super::types::Session,
    pub user: User,
}

#[Object]
impl AuthPayload {
    async fn access_token(&self) -> &str {
        &self.access_token
    }

    async fn refresh_token(&self) -> &str {
        &self.refresh_token
    }

    async fn session(&self) -> &super::types::Session {
        &self.session
    }

    async fn user(&self) -> &User {
        &self.user
    }
}
