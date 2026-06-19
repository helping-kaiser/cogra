//! The `User` GraphQL object — assembled from both stores: display content
//! (handle, profile text, timestamps) from Postgres, the `network_role` and
//! moderation cache from the graph. The shared UUID joins them.
//!
//! Slice 0 exposes the core actor fields; avatar/cover (needing
//! `MediaAttachment`) and the private viewer-state fields (bookmarks,
//! sessions, …) land with the slices that introduce them. The `Node`/`Actor`
//! interfaces likewise arrive once a second node type implements them.

use async_graphql::{Object, SimpleObject};
use chrono::{DateTime, Utc};
use graph_engine::Graph;
use postgres_store::PgPool;
use uuid::Uuid;

use crate::schema::errors::UserError;
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
/// authenticates — the success result shared by verifyEmail, logIn, and
/// refreshSession.
#[derive(SimpleObject)]
pub struct AuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub session: super::types::Session,
    pub user: User,
}

/// Declares an auth result payload — a nullable `auth` session plus the implied
/// `userErrors` list — with `ok` / `err` constructors. The named result field
/// is null exactly when `userErrors` is non-empty (api-spec.md).
macro_rules! auth_payload {
    ($(#[doc = $doc:literal])+ $name:ident) => {
        $(#[doc = $doc])+
        #[derive(SimpleObject)]
        pub struct $name {
            pub auth: Option<AuthSession>,
            pub user_errors: Vec<UserError>,
        }
        impl $name {
            pub fn ok(auth: AuthSession) -> Self {
                Self { auth: Some(auth), user_errors: Vec::new() }
            }
            pub fn err(error: UserError) -> Self {
                Self { auth: None, user_errors: vec![error] }
            }
        }
    };
}

auth_payload!(
    /// First session from a verified registration; `auth` is null with a
    /// VERIFICATION_TOKEN_INVALID userError when the token is invalid or its
    /// pending registration expired.
    VerifyEmailPayload
);
auth_payload!(
    /// A session from credentials; `auth` is null with an INVALID_CREDENTIALS
    /// userError when the email / password pair did not match.
    LogInPayload
);
auth_payload!(
    /// A rotated session; `auth` is null with a REFRESH_TOKEN_INVALID userError
    /// when the refresh token is invalid, expired, or was already rotated.
    RefreshPayload
);

/// The viewer's `User` after an `editProfile`. `user` is null with a userError
/// when the edit was rejected — `BAD_INPUT` for a bad field value,
/// `HANDLE_TAKEN` for a handle already in use (api-spec.md). An anonymous
/// caller gets a tier-1 `UNAUTHENTICATED` transport fault instead, not a
/// userError.
#[derive(SimpleObject)]
pub struct EditProfilePayload {
    pub user: Option<User>,
    pub user_errors: Vec<UserError>,
}

impl EditProfilePayload {
    pub fn ok(user: User) -> Self {
        Self {
            user: Some(user),
            user_errors: Vec::new(),
        }
    }
    pub fn err(error: UserError) -> Self {
        Self {
            user: None,
            user_errors: vec![error],
        }
    }
}
