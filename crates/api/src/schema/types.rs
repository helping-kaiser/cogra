//! The slice-1 GraphQL vocabulary (api-spec.md): scalars, enums, the
//! tiered error model, the write-flow objects, and the auth/account
//! types. Every payload's named result field is nullable — null exactly
//! when `userErrors` is non-empty (the conventions section).

use async_graphql::connection::{Connection, Edge};
use async_graphql::{
    Context, Enum, InputValueError, InputValueResult, Interface, Object, Scalar, ScalarType,
    SimpleObject, Value,
};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use chrono::{DateTime, Utc};
use common::l1::census::Family;
use common::l1::identifier::NodeId;
use common::l1::{crypto, wire};
use postgres_store::{PgPool, auth as store, mirror, profile as profile_store, staged};
use uuid::Uuid;

use l1_standin::StandIn;

use crate::auth::Viewer;
use crate::l1::StandInBoundary;
use crate::onboarding::{self, OnboardingConfig, OnboardingError};

/// A stance dimension: a float constrained to the closed range
/// [-1.0, +1.0]. Prepare validates per family.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Dimension(pub f64);

#[Scalar]
impl ScalarType for Dimension {
    fn parse(value: Value) -> InputValueResult<Self> {
        let Value::Number(n) = &value else {
            return Err(InputValueError::expected_type(value));
        };
        let f = n
            .as_f64()
            .ok_or_else(|| InputValueError::expected_type(value.clone()))?;
        if !(-1.0..=1.0).contains(&f) {
            return Err(InputValueError::custom(
                "a Dimension lies in the closed range [-1.0, +1.0]",
            ));
        }
        Ok(Dimension(f))
    }

    fn to_value(&self) -> Value {
        Value::from(self.0)
    }
}

/// One shared error vocabulary across both tiers: transport faults ride
/// the GraphQL errors array; expected outcomes ride `userErrors`.
#[derive(Enum, Debug, Clone, Copy, PartialEq, Eq)]
#[graphql(rename_items = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// The request needed an authenticated viewer and had none.
    Unauthenticated,
    /// The viewer is not eligible for the field or gesture.
    Forbidden,
    /// The referenced object does not exist.
    NotFound,
    /// Malformed input; `field` names the offender.
    BadInput,
    /// An auth endpoint's per-IP / per-account backoff.
    RateLimited,
    /// Collapsed server fault; detail is logged, not surfaced.
    Internal,
    /// The email / password pair did not match.
    InvalidCredentials,
    /// Invite link invalid, expired, revoked, or consumed.
    InviteUnusable,
    /// The handle is already held in the one actor namespace.
    HandleTaken,
    /// Under the length floor or in the breach corpus.
    WeakPassword,
    /// The email already belongs to an account.
    EmailInUse,
    /// The actor key is already bound to a different account.
    ActorKeyInUse,
    /// The email-verification token is invalid or expired.
    VerificationTokenInvalid,
    /// The password-reset token is invalid, expired, or already used.
    ResetTokenInvalid,
    /// Refresh token invalid, expired, or reuse-detected.
    RefreshTokenInvalid,
    /// The prepare pre-check: W1 solvency or W2 stamps.
    WriteRuleFailed,
    /// The staged write was garbage-collected unlanded.
    StagedWriteExpired,
    /// A submitted signature does not verify the record.
    SignatureInvalid,
    /// The key-backup upload challenge is unknown, expired, or spent.
    ChallengeExpired,
}

/// An expected business outcome, carried as data on the mutation payload
/// — the list is empty exactly when the mutation succeeded.
#[derive(SimpleObject, Debug, Clone)]
pub struct UserError {
    /// Human-readable description of the refusal.
    pub message: String,
    pub code: ErrorCode,
    /// Path into the nested input naming the offending field; null for a
    /// whole-operation failure.
    pub field: Option<Vec<String>>,
}

impl UserError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code,
            field: None,
        }
    }

    pub fn at(code: ErrorCode, message: impl Into<String>, path: Vec<String>) -> Self {
        Self {
            message: message.into(),
            code,
            field: Some(path),
        }
    }

    /// Maps a flow refusal onto the shared vocabulary, rooted at `root`.
    pub fn from_onboarding(e: &OnboardingError, root: &str) -> Self {
        let path = |f: &str| {
            if root.is_empty() {
                Some(vec![f.to_string()])
            } else {
                Some(vec![root.to_string(), f.to_string()])
            }
        };
        match e {
            OnboardingError::InviteUnusable => {
                UserError::new(ErrorCode::InviteUnusable, e.to_string())
            }
            OnboardingError::HandleTaken => UserError {
                message: e.to_string(),
                code: ErrorCode::HandleTaken,
                field: path("handle"),
            },
            OnboardingError::WeakPassword(m) => UserError {
                message: m.clone(),
                code: ErrorCode::WeakPassword,
                field: path("password"),
            },
            OnboardingError::BadInput { field, message } => UserError {
                message: message.clone(),
                code: ErrorCode::BadInput,
                field: path(field),
            },
            OnboardingError::EmailInUse => UserError {
                message: e.to_string(),
                code: ErrorCode::EmailInUse,
                field: path("email"),
            },
            OnboardingError::ActorKeyInUse => UserError {
                message: e.to_string(),
                code: ErrorCode::ActorKeyInUse,
                field: path("actorPubkey"),
            },
            OnboardingError::VerificationTokenInvalid => {
                UserError::new(ErrorCode::VerificationTokenInvalid, e.to_string())
            }
            OnboardingError::Forbidden => UserError::new(ErrorCode::Forbidden, e.to_string()),
            OnboardingError::WriteRule { .. } => {
                UserError::new(ErrorCode::WriteRuleFailed, e.to_string())
            }
            OnboardingError::SignatureInvalid(_) => {
                UserError::new(ErrorCode::SignatureInvalid, e.to_string())
            }
            OnboardingError::StagedWriteExpired => {
                UserError::new(ErrorCode::StagedWriteExpired, e.to_string())
            }
            OnboardingError::Auth(_)
            | OnboardingError::Storage(_)
            | OnboardingError::Internal(_) => {
                tracing::error!(error = %e, "onboarding internal fault");
                UserError::new(ErrorCode::Internal, "internal error")
            }
        }
    }
}

/// The record families of the L1 edge census (layer1-interface.md §9).
#[derive(Enum, Debug, Clone, Copy, PartialEq, Eq)]
#[graphql(rename_items = "SCREAMING_SNAKE_CASE")]
pub enum RecordFamily {
    Registration,
    Publish,
    Opinion,
    Affinity,
    Participant,
    Owner,
    JoinRequest,
    Accept,
    Ratify,
    Withdraw,
    Rescind,
    Leave,
    Tag,
    Review,
    Bid,
    Invitation,
    DeInvite,
    Send,
    Reference,
}

impl RecordFamily {
    pub fn from_family(f: Family) -> Self {
        match f {
            Family::Registration => Self::Registration,
            Family::Publish => Self::Publish,
            Family::Opinion => Self::Opinion,
            Family::Affinity => Self::Affinity,
            Family::Participant => Self::Participant,
            Family::Owner => Self::Owner,
            Family::JoinRequest => Self::JoinRequest,
            Family::Accept => Self::Accept,
            Family::Ratify => Self::Ratify,
            Family::Withdraw => Self::Withdraw,
            Family::Rescind => Self::Rescind,
            Family::Leave => Self::Leave,
            Family::Tag => Self::Tag,
            Family::Review => Self::Review,
            Family::Bid => Self::Bid,
            Family::Invitation => Self::Invitation,
            Family::DeInvite => Self::DeInvite,
            Family::Send => Self::Send,
            Family::Reference => Self::Reference,
        }
    }

    pub fn from_str_lossy(s: &str) -> Self {
        Family::parse(s).map_or(Self::Opinion, Self::from_family)
    }

    pub fn as_family(self) -> Family {
        match self {
            Self::Registration => Family::Registration,
            Self::Publish => Family::Publish,
            Self::Opinion => Family::Opinion,
            Self::Affinity => Family::Affinity,
            Self::Participant => Family::Participant,
            Self::Owner => Family::Owner,
            Self::JoinRequest => Family::JoinRequest,
            Self::Accept => Family::Accept,
            Self::Ratify => Family::Ratify,
            Self::Withdraw => Family::Withdraw,
            Self::Rescind => Family::Rescind,
            Self::Leave => Family::Leave,
            Self::Tag => Family::Tag,
            Self::Review => Family::Review,
            Self::Bid => Family::Bid,
            Self::Invitation => Family::Invitation,
            Self::DeInvite => Family::DeInvite,
            Self::Send => Family::Send,
            Self::Reference => Family::Reference,
        }
    }
}

/// Handshake progress of a staged write (api-spec "The write flow").
#[derive(Enum, Debug, Clone, Copy, PartialEq, Eq)]
#[graphql(rename_items = "SCREAMING_SNAKE_CASE")]
pub enum StagedWriteState {
    /// Prepared; the pre-commitment not yet submitted.
    AwaitingPreSign,
    /// Pre-signed and submitted; the backend awaits the host-sealed
    /// verified act.
    Sealing,
    /// The sealed act is back and awaits the device's approval witness.
    AwaitingApproval,
    /// Approved and submitted for ordering; the backend drives retries
    /// across epoch boundaries.
    Relaying,
    /// The accepted act is in the mirror and the staged effects are
    /// promoted.
    Landed,
    /// Garbage-collected without landing — nothing existed on the graph.
    Expired,
}

impl StagedWriteState {
    pub fn from_store(s: staged::StagedState) -> Self {
        match s {
            staged::StagedState::AwaitingPreSign => Self::AwaitingPreSign,
            staged::StagedState::Sealing => Self::Sealing,
            staged::StagedState::AwaitingApproval => Self::AwaitingApproval,
            staged::StagedState::Relaying => Self::Relaying,
            staged::StagedState::Landed => Self::Landed,
            staged::StagedState::Expired => Self::Expired,
        }
    }
}

/// One accepted record of the shared graph, as the mirror carries it —
/// the unit of the chronicle (api-spec.md "The record"). Decoded display
/// content never rides the record; it lives on the typed nodes.
pub struct Record(pub mirror::RecordFull);

#[Object]
impl Record {
    /// L1's own record identifier, verbatim.
    async fn id(&self) -> RecordId {
        RecordId(self.0.record_id.clone())
    }

    async fn family(&self) -> RecordFamily {
        RecordFamily::from_str_lossy(&self.0.family)
    }

    /// The authoring account. Null when no account fronts the author's
    /// address — system actors, until the actor surface grows.
    async fn author(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<User>> {
        let pool = ctx.data::<PgPool>()?;
        let address = &self.0.author;
        Ok(store::actor_identity_by_address(pool, address)
            .await?
            .map(|identity| User {
                identity,
                viewer_session: None,
            }))
    }

    /// The far end of a binary act, or the middle node the actor's leg
    /// enters on a hyper act (a Review's parent). Resolved as a typed
    /// node when CoGra carries one for it; `targetId` is always the raw
    /// identifier.
    async fn target(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Node>> {
        match self.0.target() {
            Some(leg) => resolve_node_id(ctx, &leg.target).await,
            None => Ok(None),
        }
    }

    /// The raw L1 identifier of `target`.
    async fn target_id(&self) -> Option<String> {
        self.0.target().map(|leg| leg.target.clone())
    }

    /// The terminal leg's node — hyper acts only; minted by the act
    /// when the record is a genesis (a Review's Comment).
    async fn terminal(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Node>> {
        match self.0.terminal() {
            Some(leg) => resolve_node_id(ctx, &leg.target).await,
            None => Ok(None),
        }
    }

    /// The raw L1 identifier of `terminal`; null on binary families.
    async fn terminal_id(&self) -> Option<String> {
        self.0.terminal().map(|leg| leg.target.clone())
    }

    /// The authored directed parameter, as the actor's leg renders it.
    async fn p_directed(&self) -> Dimension {
        Dimension(self.0.target().map_or(0.0, |leg| leg.p_d))
    }

    /// The authored interest parameter, as the actor's leg renders it.
    async fn p_interest(&self) -> Dimension {
        Dimension(self.0.target().map_or(0.0, |leg| leg.p_i))
    }

    /// The landing epoch.
    async fn landing_epoch(&self) -> i64 {
        self.0.epoch
    }

    /// Authoritative act time — the first component of the causal key.
    async fn act_time(&self) -> i64 {
        self.0.act_time
    }

    /// Position within the epoch's authoritative order.
    async fn position(&self) -> i64 {
        self.0.position
    }

    /// Whether the act committed a non-empty payload.
    async fn payload_marked(&self) -> bool {
        self.0.payload_marked
    }

    /// FULL until the payload controller removes; a reduced record
    /// keeps its structure and witness forever (layers.md §5).
    async fn payload_state(&self, ctx: &Context<'_>) -> async_graphql::Result<PayloadState> {
        let pool = ctx.data::<PgPool>()?;
        let reduced = sqlx::query_scalar!(
            r#"SELECT payload_state = 'reduced' AS "reduced!"
               FROM act_payloads WHERE act_id = $1"#,
            self.0.record_id,
        )
        .fetch_optional(pool)
        .await?
        .unwrap_or(false);
        Ok(if reduced {
            PayloadState::Reduced
        } else {
            PayloadState::Full
        })
    }

    /// The content commitment (base64) — the payload bytes in carriage
    /// verify against it.
    async fn payload_witness(&self) -> String {
        B64.encode(&self.0.payload_witness)
    }
}

/// One staged proposal for the device to verify and pre-sign. Each is
/// its own priced act running its own two-signature handshake.
pub struct PreparedWrite {
    pub id: Uuid,
    pub family: RecordFamily,
    pub proposal: common::l1::Proposal,
    pub gc_after_epochs: i64,
}

impl PreparedWrite {
    pub fn from_prepared(p: crate::prepare::Prepared) -> Self {
        Self {
            id: p.id,
            family: RecordFamily::from_family(p.proposal.body.family),
            proposal: p.proposal,
            gc_after_epochs: p.gc_after_epochs,
        }
    }
}

#[Object]
impl PreparedWrite {
    /// The handle for the whole handshake.
    async fn id(&self) -> Uuid {
        self.id
    }

    async fn family(&self) -> RecordFamily {
        self.family
    }

    /// The canonical proposal, serialized for pre-signing (base64). It
    /// carries everything the author asserts — endpoints, parameters,
    /// dependency list, payload bytes — and the device recomputes every
    /// signing base from it: the user never signs blind bytes.
    async fn canonical_proposal(&self) -> String {
        B64.encode(wire::encode_proposal(&self.proposal))
    }

    /// Domain-separated digest over the payload bytes — a transport
    /// cross-check for the parsed proposal. The signing pre-digests are
    /// computed on-device under the private nonce and never leave it.
    async fn content_pre_digest(&self) -> String {
        B64.encode(crypto::sha256_tagged(
            b"cogra-api:transport-digest:content:v1",
            &[&self.proposal.payload],
        ))
    }

    /// Domain-separated digest over the canonical dependency encoding —
    /// the dependency-side transport cross-check.
    async fn dependency_pre_digest(&self) -> String {
        B64.encode(crypto::sha256_tagged(
            b"cogra-api:transport-digest:deps:v1",
            &[&common::l1::handshake::canonical_deps(&self.proposal.deps)],
        ))
    }

    /// A staged write that never completes the handshake and lands is
    /// garbage-collected — staged payload included — after this many
    /// epochs (an operational parameter; data-model.md "Staged writes").
    async fn gc_after_epochs(&self) -> i64 {
        self.gc_after_epochs
    }
}

/// An act mid-handshake, from prepare until confirm or collection.
/// Field-authorized to the staging actor's session.
pub struct StagedWriteType(pub staged::StagedWrite);

#[Object(name = "StagedWrite")]
impl StagedWriteType {
    async fn id(&self) -> Uuid {
        self.0.id
    }

    async fn state(&self) -> StagedWriteState {
        StagedWriteState::from_store(self.0.state)
    }

    async fn family(&self) -> RecordFamily {
        RecordFamily::from_family(self.0.proposal.body.family)
    }

    /// The canonical proposal the handshake covers (base64) — the same
    /// bytes prepare returned, re-readable after a lost response.
    async fn canonical_proposal(&self) -> String {
        B64.encode(wire::encode_proposal(&self.0.proposal))
    }

    /// The host-sealed verified act once the seal has returned (base64):
    /// every host-added field the device verifies before approving. Null
    /// in earlier states.
    async fn verified_act(&self) -> Option<String> {
        self.0
            .verified_act()
            .map(|act| B64.encode(wire::encode_verified_act(&act)))
    }

    /// The accepted record once LANDED; null before.
    async fn record(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Record>> {
        if self.0.state != staged::StagedState::Landed {
            return Ok(None);
        }
        let pool = ctx.data::<PgPool>()?;
        let act_id = self.0.proposal.body.act_id().to_string();
        let row = postgres_store::mirror::record_full(pool, &act_id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        Ok(row.map(Record))
    }
}

// ---------------------------------------------------------------------
// Auth and account types
// ---------------------------------------------------------------------

/// A user account's service state (auth.md "Account states"): it gates
/// acting through CoGra, never reading, and is distinct from the
/// mutual-pair membership of invitations.md §2. GUEST is reserved — no
/// flow creates one yet.
#[derive(Enum, Debug, Clone, Copy, PartialEq, Eq)]
#[graphql(rename_items = "SCREAMING_SNAKE_CASE")]
pub enum AccountState {
    Guest,
    Applicant,
    Member,
}

impl AccountState {
    pub fn from_store(s: store::AccountState) -> Self {
        match s {
            store::AccountState::Guest => Self::Guest,
            store::AccountState::Applicant => Self::Applicant,
            store::AccountState::Member => Self::Member,
        }
    }
}

/// An active authentication session — one per refresh token.
pub struct Session {
    pub row: store::Session,
    pub current_session: Option<Uuid>,
}

#[Object]
impl Session {
    async fn id(&self) -> Uuid {
        self.row.id
    }

    /// Short user-readable origin of the session, e.g. derived from the
    /// device at login.
    async fn device_label(&self) -> Option<&str> {
        self.row.device_label.as_deref()
    }

    async fn created_at(&self) -> DateTime<Utc> {
        self.row.created_at
    }

    /// Null if unused since issue.
    async fn last_used_at(&self) -> Option<DateTime<Utc>> {
        self.row.last_used_at
    }

    async fn expires_at(&self) -> DateTime<Utc> {
        self.row.expires_at
    }

    /// Whether this is the session that issued the current request.
    async fn is_current(&self) -> bool {
        self.current_session == Some(self.row.id)
    }
}

/// A fresh access + refresh token pair, the issuing session, and the
/// viewer it authenticates — the success result shared by register,
/// logIn, and refreshSession.
pub struct AuthSession {
    pub access_token: String,
    pub refresh_token: String,
    pub session_id: Uuid,
    pub user_id: Uuid,
}

#[Object]
impl AuthSession {
    /// The bearer token for `Authorization: Bearer <token>`; 15-minute
    /// lifetime.
    async fn access_token(&self) -> &str {
        &self.access_token
    }

    /// The rotating refresh token. Every refresh consumes it and issues
    /// a successor — replace the stored copy on every refresh.
    async fn refresh_token(&self) -> &str {
        &self.refresh_token
    }

    /// The issuing session.
    async fn session(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Session>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(store::session(pool, self.session_id)
            .await?
            .map(|row| Session {
                row,
                current_session: Some(self.session_id),
            }))
    }

    /// The viewer the pair authenticates.
    async fn user(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<User>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(store::actor_identity(pool, self.user_id)
            .await?
            .map(|identity| User {
                identity,
                viewer_session: Some(self.session_id),
            }))
    }
}

impl AuthSession {
    pub fn from_issued(s: crate::auth::IssuedSession) -> Self {
        Self {
            access_token: s.access_token,
            refresh_token: s.refresh_token,
            session_id: s.session_id,
            user_id: s.user_id,
        }
    }
}

/// An actor in the one handle namespace — a mention resolves to exactly
/// one actor. Interface coverage grows with the slices
/// (api-spec.md "Actors").
#[derive(Interface)]
#[graphql(
    field(name = "id", ty = "Uuid"),
    field(name = "handle", ty = "String"),
    field(
        name = "display_name",
        ty = "ModeratedText",
        desc = "The current display name (the newest profile version)."
    )
)]
pub enum Actor {
    User(User),
}

/// A person on the platform. The server-side account (credentials,
/// sessions) authenticates the service, never the graph; the account
/// state says whether it already fronts a full actor (auth.md).
pub struct User {
    pub identity: store::ActorIdentity,
    /// The requesting session when this User IS the viewer — gates the
    /// private fields.
    pub viewer_session: Option<Uuid>,
}

impl User {
    pub fn from_viewer(identity: store::ActorIdentity, viewer: Viewer) -> Self {
        Self {
            identity,
            viewer_session: Some(viewer.session_id),
        }
    }

    fn is_viewer(&self, ctx: &Context<'_>) -> bool {
        match (self.viewer_session, ctx.data_opt::<Option<Viewer>>()) {
            (Some(_), _) => true,
            (None, Some(Some(v))) => v.user_id == self.identity.id,
            _ => false,
        }
    }

    fn viewer_session_id(&self, ctx: &Context<'_>) -> Option<Uuid> {
        self.viewer_session.or_else(|| {
            ctx.data_opt::<Option<Viewer>>()
                .and_then(|v| v.as_ref())
                .filter(|v| v.user_id == self.identity.id)
                .map(|v| v.session_id)
        })
    }

    async fn profile(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<Option<profile_store::ProfileVersion>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(profile_store::current_profile(pool, self.identity.id).await?)
    }
}

#[Object]
impl User {
    async fn id(&self) -> Uuid {
        self.identity.id
    }

    /// The account's name in the one actor namespace: 3–30 characters of
    /// [a-z0-9_], case-folded.
    async fn handle(&self) -> String {
        self.identity.handle.clone()
    }

    /// The current display name (the newest profile version).
    async fn display_name(&self, ctx: &Context<'_>) -> async_graphql::Result<ModeratedText> {
        Ok(match self.profile(ctx).await? {
            Some(p) => {
                ModeratedText::from_version(Some(p.display_name), p.redaction_reason.is_some())
            }
            // Registration seeds every user's first version row; the
            // handle stands in for actors from before that invariant.
            None => ModeratedText::from_version(Some(self.identity.handle.clone()), false),
        })
    }

    /// The profile biography (the newest profile version); value null
    /// when never set.
    async fn bio(&self, ctx: &Context<'_>) -> async_graphql::Result<ModeratedText> {
        Ok(match self.profile(ctx).await? {
            Some(p) => ModeratedText::from_version(p.bio, p.redaction_reason.is_some()),
            None => ModeratedText::from_version(None, false),
        })
    }

    /// The profile's website link (the newest profile version); value
    /// null when never set.
    async fn website_url(&self, ctx: &Context<'_>) -> async_graphql::Result<ModeratedText> {
        Ok(match self.profile(ctx).await? {
            Some(p) => ModeratedText::from_version(p.website_url, p.redaction_reason.is_some()),
            None => ModeratedText::from_version(None, false),
        })
    }

    /// Active authentication sessions, one per refresh token.
    /// Field-level: resolves only for the account's own viewer; null
    /// otherwise.
    async fn sessions(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Vec<Session>>> {
        if !self.is_viewer(ctx) {
            return Ok(None);
        }
        let pool = ctx.data::<PgPool>()?;
        let current = self.viewer_session_id(ctx);
        Ok(Some(
            store::sessions_for(pool, self.identity.id)
                .await?
                .into_iter()
                .map(|row| Session {
                    row,
                    current_session: current,
                })
                .collect(),
        ))
    }

    /// Acts mid-handshake — awaiting a signature, the host seal, or
    /// confirmation — across devices. Field-level: viewer-only.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    async fn staged_writes(
        &self,
        ctx: &Context<'_>,
        after: Option<String>,
        before: Option<String>,
        first: Option<i32>,
        last: Option<i32>,
    ) -> async_graphql::Result<Option<KeysetConnection<StagedWriteType>>> {
        if !self.is_viewer(ctx) {
            return Ok(None);
        }
        let pool = ctx.data::<PgPool>()?;
        let writes = staged::list_for_actor(pool, self.identity.id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        Ok(Some(
            offset_connection(writes, after, before, first, last, StagedWriteType).await?,
        ))
    }

    /// The client-encrypted key-backup blob, if one was uploaded —
    /// ciphertext under the recovery code; the server cannot decrypt it.
    /// Field-level: viewer-only.
    async fn key_backup(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<String>> {
        if !self.is_viewer(ctx) {
            return Ok(None);
        }
        let pool = ctx.data::<PgPool>()?;
        Ok(store::latest_key_backup(pool, self.identity.id)
            .await?
            .map(|blob| B64.encode(blob)))
    }

    /// The account's attached actor public key (base64), null before
    /// the key ceremony. The client's repair-attach verifies the
    /// device-held key against this before offering it, so a device
    /// carrying another account's key never blind-fires the attach
    /// (roadmap.md slice 1.1). Field-level: viewer-only.
    async fn actor_pubkey(&self, ctx: &Context<'_>) -> Option<String> {
        if !self.is_viewer(ctx) {
            return None;
        }
        self.identity.actor_pubkey.as_ref().map(|k| B64.encode(k))
    }

    /// The account's attached L0 address, null before the key ceremony.
    /// Field-level: viewer-only.
    async fn l0_address(&self, ctx: &Context<'_>) -> Option<String> {
        if !self.is_viewer(ctx) {
            return None;
        }
        self.identity.l0_address.clone()
    }

    /// The actor whose invite this account came through — landing
    /// provenance for the reciprocation gesture; the graph's own record
    /// of the vouch is the inviter's Opinion. Field-level: viewer-only;
    /// null for accounts without an application trace (genesis actors).
    async fn invited_by(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Actor>> {
        if !self.is_viewer(ctx) {
            return Ok(None);
        }
        let pool = ctx.data::<PgPool>()?;
        Ok(store::inviter_of(pool, self.identity.id)
            .await?
            .map(|identity| {
                Actor::User(User {
                    identity,
                    viewer_session: None,
                })
            }))
    }

    /// Whether the viewer's reciprocal Opinion toward invitedBy exists —
    /// confirmed in the record mirror (latched on the landed application
    /// row) or in flight as one of the viewer's staged writes. Drives
    /// the first-login reciprocation prompt (auth.md "Reciprocation is
    /// the joiner's own act"). Vacuously true when invitedBy is null —
    /// and for any viewer but the account's own: the field exists only
    /// to drive the viewer's own prompt.
    async fn has_reciprocated(&self, ctx: &Context<'_>) -> async_graphql::Result<bool> {
        if !self.is_viewer(ctx) {
            return Ok(true);
        }
        let pool = ctx.data::<PgPool>()?;
        let Some(inviter) = store::inviter_of(pool, self.identity.id).await? else {
            return Ok(true);
        };
        if store::reciprocation_latched(pool, self.identity.id).await? {
            return Ok(true);
        }
        // Without both addresses no Opinion can exist — a keyless viewer
        // has signed nothing.
        let (Some(viewer_address), Some(inviter_address)) =
            (&self.identity.l0_address, &inviter.l0_address)
        else {
            return Ok(false);
        };
        let source = NodeId::Addr(viewer_address.clone()).to_string();
        let target = NodeId::Prof(inviter_address.clone()).to_string();
        if mirror::has_opinion_toward(pool, &source, &target).await? {
            store::latch_reciprocated(pool, self.identity.id).await?;
            return Ok(true);
        }
        Ok(staged::has_live_targeting(pool, self.identity.id, Family::Opinion, &target).await?)
    }

    /// The account's service state — gates acting through CoGra (auth.md
    /// "Account states"). Field-level: viewer-only.
    async fn account_state(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<Option<AccountState>> {
        if !self.is_viewer(ctx) {
            return Ok(None);
        }
        let pool = ctx.data::<PgPool>()?;
        Ok(store::credentials_by_actor(pool, self.identity.id)
            .await?
            .map(|c| AccountState::from_store(c.account_state)))
    }

    /// Whether the account's email is verified — one of the two
    /// approvability proofs while an application is pending. Field-level:
    /// viewer-only.
    async fn email_verified(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<bool>> {
        if !self.is_viewer(ctx) {
            return Ok(None);
        }
        let pool = ctx.data::<PgPool>()?;
        Ok(store::credentials_by_actor(pool, self.identity.id)
            .await?
            .map(|c| c.email_verified_at.is_some()))
    }

    /// The account's latest application — the applicant's own view of
    /// its progress; null when the account has none. Reading it is the
    /// admission flow's repair hook: an approved application whose
    /// staged Registration was lost re-stages here, on the poll (auth.md
    /// "Approval and landing"). Field-level: viewer-only.
    async fn application(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Application>> {
        if !self.is_viewer(ctx) {
            return Ok(None);
        }
        let pool = ctx.data::<PgPool>()?;
        let Some(application) = store::latest_application_for(pool, self.identity.id).await? else {
            return Ok(None);
        };
        if application.approved_at.is_some() && application.landed_at.is_none() {
            let boundary = ctx.data::<StandInBoundary>()?;
            let funding = ctx.data::<StandIn>()?;
            let cfg = ctx.data::<OnboardingConfig>()?;
            if let Err(e) =
                onboarding::ensure_admission_staged(pool, boundary, funding, cfg, &application)
                    .await
            {
                tracing::error!(error = %e, "staged-registration repair failed");
            }
        }
        Ok(Some(Application(application)))
    }

    /// The account's invite links — service-side staging state, not
    /// graph structure. Field-level: each link's id is the link
    /// capability, so this resolves only for the issuing actor.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    async fn invite_links(
        &self,
        ctx: &Context<'_>,
        after: Option<String>,
        before: Option<String>,
        first: Option<i32>,
        last: Option<i32>,
    ) -> async_graphql::Result<Option<KeysetConnection<InviteLink>>> {
        if !self.is_viewer(ctx) {
            return Ok(None);
        }
        let pool = ctx.data::<PgPool>()?;
        let links = store::invite_links_for(pool, self.identity.id).await?;
        Ok(Some(
            offset_connection(links, after, before, first, last, InviteLink).await?,
        ))
    }
}

/// The anonymous pre-submit view of an invite link — enough for the app
/// to gate the registration form and key ceremony on a usable capability,
/// and to show who is vouching. Holding the id is holding the link.
#[derive(SimpleObject)]
pub struct InviteLinkCheck {
    /// Whether the link can stage a new applicant now — live, unexpired,
    /// unrevoked, and (single-use) its one slot free.
    pub usable: bool,
    /// The issuing actor's handle.
    pub inviter_handle: String,
    pub expires_at: DateTime<Utc>,
}

/// An invite link: pure service-side staging UX. Nothing binds at issue —
/// the stance values are pre-filled suggestions the inviter adjusts at
/// approval, and the approval itself is the priced act.
pub struct InviteLink(pub store::InviteLink);

#[Object]
impl InviteLink {
    /// The shareable capability: the URL carries only this id, so it is
    /// issuer-visible only.
    async fn id(&self) -> Uuid {
        self.0.id
    }

    /// The issuing actor.
    async fn inviter(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Actor>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(store::actor_identity(pool, self.0.inviter_id)
            .await?
            .map(|identity| {
                Actor::User(User {
                    identity,
                    viewer_session: None,
                })
            }))
    }

    /// A suggestion, never a commitment.
    async fn prefill_p_directed(&self) -> Dimension {
        Dimension(self.0.prefill_p_d)
    }

    async fn prefill_p_interest(&self) -> Dimension {
        Dimension(self.0.prefill_p_i)
    }

    /// One applicant slot (single-use) or many applicants until expiry
    /// (multi-use).
    async fn single_use(&self) -> bool {
        self.0.single_use
    }

    async fn created_at(&self) -> DateTime<Utc> {
        self.0.created_at
    }

    async fn expires_at(&self) -> DateTime<Utc> {
        self.0.expires_at
    }

    /// Null if still live.
    async fn revoked_at(&self) -> Option<DateTime<Utc>> {
        self.0.revoked_at
    }

    /// The inviter's approval queue: applications staged through this
    /// link, with their status.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    async fn applications(
        &self,
        ctx: &Context<'_>,
        after: Option<String>,
        before: Option<String>,
        first: Option<i32>,
        last: Option<i32>,
    ) -> async_graphql::Result<KeysetConnection<Application>> {
        let pool = ctx.data::<PgPool>()?;
        let rows = store::applications_for_link(pool, self.0.id).await?;
        offset_connection(rows, after, before, first, last, Application).await
    }
}

/// An application attempt — the invite-link provenance and
/// approval/landing bookkeeping of an account in the applicant state
/// (auth.md "Application"). Visible to the issuing inviter (their
/// approval queue) and to the applying account itself
/// (`User.application`).
pub struct Application(pub store::Application);

#[Object]
impl Application {
    async fn id(&self) -> Uuid {
        self.0.id
    }

    /// The applying account's handle.
    async fn handle(&self) -> &str {
        &self.0.handle
    }

    /// Whether the account has proved its email channel — one of the two
    /// approvability proofs.
    async fn email_verified(&self) -> bool {
        self.0.email_verified
    }

    /// Whether the account has attached its device-minted key and L0
    /// address — the other approvability proof.
    async fn key_attached(&self) -> bool {
        self.0.key_attached
    }

    /// When the inviter's priced approval happened; null while pending.
    async fn approved_at(&self) -> Option<DateTime<Utc>> {
        self.0.approved_at
    }

    /// When the Registration confirmed and the account became a member;
    /// null before.
    async fn landed_at(&self) -> Option<DateTime<Utc>> {
        self.0.landed_at
    }

    async fn created_at(&self) -> DateTime<Utc> {
        self.0.created_at
    }

    async fn expires_at(&self) -> DateTime<Utc> {
        self.0.expires_at
    }
}

/// The page-size ceiling every connection enforces (api-spec.md
/// "Pagination"): `first`/`last` above it refuse rather than silently
/// clamp, so a client asking for more than it can get finds out.
pub const MAX_PAGE_SIZE: i32 = 100;
/// The page size when neither `first` nor `last` is given — an
/// unqualified list read stays cheap.
pub const DEFAULT_PAGE_SIZE: i32 = 20;

/// The complexity a connection field charges (schema/mod.rs
/// `QueryBudgets`): the requested — or default — page size times the
/// per-item cost, plus one for the field itself. Out-of-range arguments
/// price at the cap; the resolver's own validation refuses them.
pub fn connection_cost(first: Option<i32>, last: Option<i32>, child_complexity: usize) -> usize {
    let requested = first
        .or(last)
        .unwrap_or(DEFAULT_PAGE_SIZE)
        .clamp(0, MAX_PAGE_SIZE);
    requested as usize * child_complexity + 1
}

/// Builds an offset-cursor connection over an already-loaded, ordered
/// list — small operational lists only; mirror-ordered reads use the
/// keyset helpers below. Pages are budgeted: `first`/`last` at most
/// [`MAX_PAGE_SIZE`], [`DEFAULT_PAGE_SIZE`] when neither is given.
pub async fn offset_connection<T, G>(
    items: Vec<T>,
    after: Option<String>,
    before: Option<String>,
    first: Option<i32>,
    last: Option<i32>,
    wrap: impl Fn(T) -> G,
) -> async_graphql::Result<KeysetConnection<G>>
where
    G: async_graphql::OutputType,
{
    use async_graphql::connection::query;
    if first.is_some_and(|n| n > MAX_PAGE_SIZE) || last.is_some_and(|n| n > MAX_PAGE_SIZE) {
        return Err(async_graphql::Error::new(format!(
            "first/last may be at most {MAX_PAGE_SIZE}"
        )));
    }
    let first = match (first, last) {
        (None, None) => Some(DEFAULT_PAGE_SIZE),
        (first, _) => first,
    };
    query(
        after,
        before,
        first,
        last,
        |after: Option<String>, before, first, last| async move {
            let decode =
                |c: Option<String>| -> Option<usize> { c.and_then(|s| s.parse::<usize>().ok()) };
            let len = items.len();
            let mut start = decode(after).map_or(0, |i| (i + 1).min(len));
            let mut end = decode(before).map_or(len, |i| i.min(len)).max(start);
            if let Some(first) = first {
                end = end.min(start + first);
            }
            if let Some(last) = last {
                start = start.max(end.saturating_sub(last));
            }
            let mut connection = Connection::new(start > 0, end < len);
            connection.edges.extend(
                items
                    .into_iter()
                    .enumerate()
                    .skip(start)
                    .take(end - start)
                    .map(|(i, item)| Edge::new(i.to_string(), wrap(item))),
            );
            Ok::<_, async_graphql::Error>(connection)
        },
    )
    .await
}

// ---------------------------------------------------------------------
// Content read surface (slice 2)
// ---------------------------------------------------------------------

/// An L1 record identifier, exactly as Layer 1 minted it — stored and
/// served verbatim (api-spec.md "Scalars").
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordId(pub String);

#[Scalar]
impl ScalarType for RecordId {
    fn parse(value: Value) -> InputValueResult<Self> {
        match value {
            Value::String(s) => Ok(RecordId(s)),
            v => Err(InputValueError::expected_type(v)),
        }
    }

    fn to_value(&self) -> Value {
        Value::String(self.0.clone())
    }
}

/// Per-field moderation state (api-spec.md "Per-field moderation").
/// SENSITIVE is the read-side flag; REDACTED means the value is gone
/// and the mark remains — record-granular, so every field carried by a
/// removed payload goes REDACTED together.
#[derive(Enum, Debug, Clone, Copy, PartialEq, Eq)]
#[graphql(rename_items = "SCREAMING_SNAKE_CASE")]
pub enum FieldModerationStatus {
    Normal,
    Sensitive,
    Redacted,
}

/// Node-level moderation cache — the cheap "is anything wrong here"
/// check; the substrate-visible verdict is the Tag record behind it
/// (moderation.md). Constant NORMAL until the moderation slice stores
/// verdicts (api-spec.md "Content nodes").
#[derive(Enum, Debug, Clone, Copy, PartialEq, Eq)]
#[graphql(rename_items = "SCREAMING_SNAKE_CASE")]
pub enum ModerationStatus {
    Normal,
    Sensitive,
    Illegal,
}

/// An act payload's one-way state (layer1-interface.md §8.4): FULL
/// until the controller removes, REDUCED forever after.
#[derive(Enum, Debug, Clone, Copy, PartialEq, Eq)]
#[graphql(rename_items = "SCREAMING_SNAKE_CASE")]
pub enum PayloadState {
    Full,
    Reduced,
}

/// AI-provenance oversight, three-valued (platform-guidelines.md §5;
/// layer1-interface.md §10 `def:content:license-qualifiers`): NONE — no
/// AI disclosure required; CONDITIONAL — generation details disclosed
/// on query; FULL — the complete provenance chain published alongside
/// the record.
#[derive(Enum, Debug, Clone, Copy, PartialEq, Eq)]
#[graphql(name = "Oversight", rename_items = "SCREAMING_SNAKE_CASE")]
pub enum OversightLevel {
    None,
    Conditional,
    Full,
}

impl OversightLevel {
    pub fn to_content(self) -> crate::content::Oversight {
        match self {
            Self::None => crate::content::Oversight::None,
            Self::Conditional => crate::content::Oversight::Conditional,
            Self::Full => crate::content::Oversight::Full,
        }
    }
}

/// Text carrying its own moderation status. `value` is null when the
/// field is redacted, or unset where the field is optional — `status`
/// disambiguates; empty is a value, null never is.
#[derive(SimpleObject)]
pub struct ModeratedText {
    pub value: Option<String>,
    pub status: FieldModerationStatus,
}

impl ModeratedText {
    /// A display field under the row's redaction state: a tombstoned
    /// version row serves REDACTED with null values (layers.md §5).
    fn from_version(value: Option<String>, redacted: bool) -> Self {
        if redacted {
            Self {
                value: None,
                status: FieldModerationStatus::Redacted,
            }
        } else {
            Self {
                value,
                status: FieldModerationStatus::Normal,
            }
        }
    }
}

/// Where a node stands relative to L1 finality. PENDING: authored and
/// signed, not yet ordered — real content whose place in the order is
/// not yet fixed (substrate.md §6). LANDED: the minting act is ordered
/// fact. There is no expired state: an expired act's content leaves
/// every reader's view.
#[derive(Enum, Debug, Clone, Copy, PartialEq, Eq)]
#[graphql(rename_items = "SCREAMING_SNAKE_CASE")]
pub enum LandingState {
    Pending,
    Landed,
}

/// A node's landing position. `epoch` is the graph's own clock and is
/// null exactly while `state` is PENDING — a pending write has no causal
/// key yet (architecture.md "The write path").
#[derive(SimpleObject, Debug, Clone, Copy, PartialEq, Eq)]
pub struct Landing {
    pub state: LandingState,
    pub epoch: Option<i64>,
}

impl Landing {
    /// A node lands when its own minting record does *and* nothing it
    /// carries is still settling: an unlanded edit leaves the node
    /// pending, because the text on screen is the pending version.
    fn of(order: Option<postgres_store::content::LandingOrder>, version_pending: bool) -> Self {
        match order {
            Some(o) if !version_pending => Self {
                state: LandingState::Landed,
                epoch: Some(o.landed_epoch),
            },
            _ => Self {
                state: LandingState::Pending,
                epoch: None,
            },
        }
    }
}

/// The primary public-content surface: an L1 Content node minted by
/// its author's Publish record, rendered from the display store
/// (post.md).
pub struct PostType(pub postgres_store::content::Post);

#[Object(name = "Post")]
impl PostType {
    async fn id(&self) -> Uuid {
        self.0.id
    }

    /// When this node was created — when its minting record was
    /// authored, which on a pending node precedes landing.
    async fn created_at(&self) -> DateTime<Utc> {
        self.0.created_at
    }

    /// The most recent fold-winning update's promotion; equals
    /// `createdAt` if never changed.
    async fn updated_at(&self) -> DateTime<Utc> {
        self.0.version_created_at.max(self.0.created_at)
    }

    /// Where this post stands relative to L1 finality.
    async fn landing(&self) -> Landing {
        Landing::of(self.0.order, self.0.version_pending)
    }

    async fn title(&self) -> ModeratedText {
        ModeratedText::from_version(self.0.title.clone(), self.0.redaction_reason.is_some())
    }

    async fn description(&self) -> ModeratedText {
        ModeratedText::from_version(
            self.0.description.clone(),
            self.0.redaction_reason.is_some(),
        )
    }

    async fn content(&self) -> ModeratedText {
        ModeratedText::from_version(
            Some(self.0.content.clone()),
            self.0.redaction_reason.is_some(),
        )
    }

    async fn author(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<User>> {
        author_user(ctx, self.0.author_id).await
    }

    async fn moderation_status(&self) -> ModerationStatus {
        ModerationStatus::Normal
    }

    /// This post's direct comments — genesis Reviews whose A leg
    /// enters here — newest-first: pending entries, then landed entries
    /// in landing order (a comment's landing position is its genesis, so
    /// edits never reorder the thread), keyset-paginated.
    /// `includePending: false` serves only what has landed on L1.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    async fn comments(
        &self,
        ctx: &Context<'_>,
        after: Option<String>,
        before: Option<String>,
        first: Option<i32>,
        last: Option<i32>,
        #[graphql(default = true)] include_pending: bool,
    ) -> async_graphql::Result<KeysetConnection<CommentType>> {
        comments_connection(ctx, self.0.id, after, before, first, last, include_pending).await
    }
}

/// The universal threading primitive: an L1 Comment node minted by the
/// terminal leg of its author's Review record (comment.md).
pub struct CommentType(pub postgres_store::content::Comment);

#[Object(name = "Comment")]
impl CommentType {
    async fn id(&self) -> Uuid {
        self.0.id
    }

    /// When this node was created — when its minting record was
    /// authored, which on a pending node precedes landing.
    async fn created_at(&self) -> DateTime<Utc> {
        self.0.created_at
    }

    /// The most recent fold-winning update's promotion; equals
    /// `createdAt` if never changed.
    async fn updated_at(&self) -> DateTime<Utc> {
        self.0.version_created_at.max(self.0.created_at)
    }

    /// Where this comment stands relative to L1 finality.
    async fn landing(&self) -> Landing {
        Landing::of(self.0.order, self.0.version_pending)
    }

    async fn content(&self) -> ModeratedText {
        ModeratedText::from_version(
            Some(self.0.content.clone()),
            self.0.redaction_reason.is_some(),
        )
    }

    async fn author(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<User>> {
        author_user(ctx, self.0.author_id).await
    }

    /// The node this comment is on — the genesis Review's parent.
    async fn target(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<CommentTarget>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(match self.0.target_type.as_str() {
            "post" => postgres_store::content::post(pool, self.0.target_id)
                .await
                .map_err(|e| async_graphql::Error::new(e.to_string()))?
                .map(|p| CommentTarget::Post(PostType(p))),
            "comment" => postgres_store::content::comment(pool, self.0.target_id)
                .await
                .map_err(|e| async_graphql::Error::new(e.to_string()))?
                .map(|c| CommentTarget::Comment(CommentType(c))),
            _ => None,
        })
    }

    async fn moderation_status(&self) -> ModerationStatus {
        ModerationStatus::Normal
    }

    /// This comment's direct replies, newest-first: pending entries,
    /// then landed entries in landing order. `includePending: false`
    /// serves only what has landed on L1.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    async fn replies(
        &self,
        ctx: &Context<'_>,
        after: Option<String>,
        before: Option<String>,
        first: Option<i32>,
        last: Option<i32>,
        #[graphql(default = true)] include_pending: bool,
    ) -> async_graphql::Result<KeysetConnection<CommentType>> {
        comments_connection(ctx, self.0.id, after, before, first, last, include_pending).await
    }
}

/// Every graph-backed thing with an identity and a lifecycle
/// (api-spec.md "Identity and actor interfaces"). Coverage grows with
/// the slices; slice 2 carries the content nodes.
// The allow is a named clippy false positive (rust-clippy #12537):
// `duplicated_attributes` misfires on derive-helper fields that share a
// value — createdAt and updatedAt genuinely have the same GraphQL type.
#[allow(clippy::duplicated_attributes)]
#[derive(Interface)]
#[graphql(
    field(name = "id", ty = "Uuid", desc = "The node's L2 id."),
    field(
        name = "created_at",
        ty = "DateTime<Utc>",
        desc = "When this node was created — when its minting record was authored, which on a pending node precedes landing."
    ),
    field(
        name = "updated_at",
        ty = "DateTime<Utc>",
        desc = "The most recent fold-winning update's promotion; equals createdAt if never changed."
    ),
    field(
        name = "landing",
        ty = "Landing",
        desc = "Where this node stands relative to L1 finality — landing is a substrate fact about every minted node."
    )
)]
pub enum Node {
    Post(PostType),
    Comment(CommentType),
}

/// What a Review can respond to (comment.md §1). Every passive node
/// type is Reviewable on the substrate; the variants grow with the
/// slices that carry them — slice 2 offers Posts and Comments.
#[derive(async_graphql::Union)]
pub enum CommentTarget {
    Post(PostType),
    Comment(CommentType),
}

async fn author_user(ctx: &Context<'_>, author_id: Uuid) -> async_graphql::Result<Option<User>> {
    let pool = ctx.data::<PgPool>()?;
    Ok(store::actor_identity(pool, author_id)
        .await?
        .map(|identity| User {
            identity,
            viewer_session: None,
        }))
}

/// Resolves a raw L1 node identifier to a typed node, when CoGra
/// carries a display row for it (content nodes this slice).
pub async fn resolve_node_id(
    ctx: &Context<'_>,
    l1_node_id: &str,
) -> async_graphql::Result<Option<Node>> {
    let pool = ctx.data::<PgPool>()?;
    if let Some(post) = postgres_store::content::post_by_node(pool, l1_node_id)
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?
    {
        return Ok(Some(Node::Post(PostType(post))));
    }
    if let Some(comment) = postgres_store::content::comment_by_node(pool, l1_node_id)
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?
    {
        return Ok(Some(Node::Comment(CommentType(comment))));
    }
    Ok(None)
}

// ---------------------------------------------------------------------
// Keyset pagination (api-spec.md "Pagination")
// ---------------------------------------------------------------------

/// Connections over mirror-ordered reads carry no `nodes` shortcut —
/// the connection convention is edges + pageInfo (api-spec.md).
pub type KeysetConnection<G> = Connection<
    String,
    G,
    async_graphql::connection::EmptyFields,
    async_graphql::connection::EmptyFields,
    async_graphql::connection::DefaultConnectionName,
    async_graphql::connection::DefaultEdgeName,
    async_graphql::connection::DisableNodesField,
>;

/// A validated keyset page request: the exclusive cursor, the walk
/// direction, and the page size (default 20, max 100 — over-asking
/// refuses).
pub struct KeysetPage {
    pub cursor: Option<(i64, i64, i64)>,
    pub backward: bool,
    pub limit: i64,
}

pub fn keyset_page(
    first: Option<i32>,
    after: Option<String>,
    last: Option<i32>,
    before: Option<String>,
) -> async_graphql::Result<KeysetPage> {
    if first.is_some_and(|n| n > MAX_PAGE_SIZE) || last.is_some_and(|n| n > MAX_PAGE_SIZE) {
        return Err(async_graphql::Error::new(format!(
            "first/last may be at most {MAX_PAGE_SIZE}"
        )));
    }
    if first.is_some_and(|n| n < 0) || last.is_some_and(|n| n < 0) {
        return Err(async_graphql::Error::new("first/last must be non-negative"));
    }
    if (first.is_some() || after.is_some()) && (last.is_some() || before.is_some()) {
        return Err(async_graphql::Error::new(
            "paginate forward (first/after) or backward (last/before), not both",
        ));
    }
    let backward = last.is_some() || before.is_some();
    let cursor = match if backward { &before } else { &after } {
        Some(s) => Some(decode_landing_cursor(s)?),
        None => None,
    };
    let limit = i64::from(
        last.or(first)
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(0, MAX_PAGE_SIZE),
    );
    Ok(KeysetPage {
        cursor,
        backward,
        limit,
    })
}

pub fn encode_landing_cursor(epoch: i64, act_time: i64, position: i64) -> String {
    B64.encode(format!("{epoch}:{act_time}:{position}"))
}

fn decode_landing_cursor(cursor: &str) -> async_graphql::Result<(i64, i64, i64)> {
    let invalid = || async_graphql::Error::new("invalid cursor");
    let raw = B64.decode(cursor).map_err(|_| invalid())?;
    let text = String::from_utf8(raw).map_err(|_| invalid())?;
    let mut parts = text.split(':').map(str::parse::<i64>);
    match (parts.next(), parts.next(), parts.next(), parts.next()) {
        (Some(Ok(e)), Some(Ok(a)), Some(Ok(p)), None) => Ok((e, a, p)),
        _ => Err(invalid()),
    }
}

/// Builds a keyset connection from a page of items fetched with
/// `limit + 1` (the extra row proves another page exists). Items arrive
/// in display order; the extra row sits at the display-order end the
/// walk reached last — trailing on a forward walk, leading on a
/// backward one.
pub fn keyset_connection<T, G>(
    mut items: Vec<T>,
    page: &KeysetPage,
    cursor_of: impl Fn(&T) -> (i64, i64, i64),
    wrap: impl Fn(T) -> G,
) -> KeysetConnection<G>
where
    G: async_graphql::OutputType,
{
    let has_more = items.len() as i64 > page.limit;
    if has_more {
        if page.backward {
            items.remove(0);
        } else {
            items.pop();
        }
    }
    let (has_previous, has_next) = if page.backward {
        (has_more, page.cursor.is_some())
    } else {
        (page.cursor.is_some(), has_more)
    };
    let mut connection = KeysetConnection::new(has_previous, has_next);
    connection.edges.extend(items.into_iter().map(|item| {
        let (e, a, p) = cursor_of(&item);
        Edge::new(encode_landing_cursor(e, a, p), wrap(item))
    }));
    connection
}

/// The shared comments/replies read: a target's direct children,
/// newest-first in landing order.
#[allow(clippy::too_many_arguments)]
async fn comments_connection(
    ctx: &Context<'_>,
    target: Uuid,
    after: Option<String>,
    before: Option<String>,
    first: Option<i32>,
    last: Option<i32>,
    include_pending: bool,
) -> async_graphql::Result<KeysetConnection<CommentType>> {
    let pool = ctx.data::<PgPool>()?;
    let page = keyset_page(first, after, last, before)?;
    let rows = postgres_store::content::comments_for_target(
        pool,
        target,
        page.cursor
            .map(|(e, a, p)| postgres_store::content::LandingOrder {
                landed_epoch: e,
                act_time: a,
                position: p,
            }),
        page.backward,
        page.limit + 1,
        include_pending,
    )
    .await
    .map_err(|e| async_graphql::Error::new(e.to_string()))?;
    Ok(keyset_connection(
        rows,
        &page,
        |c| {
            let k = c.sort_key();
            (k.landed_epoch, k.act_time, k.position)
        },
        CommentType,
    ))
}
