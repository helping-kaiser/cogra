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
use common::l1::{crypto, wire};
use postgres_store::{PgPool, auth as store, staged};
use uuid::Uuid;

use crate::auth::Viewer;
use crate::onboarding::OnboardingError;

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
    /// A live application already holds this email.
    ApplicationInProgress,
    /// The email-verification token is invalid or expired.
    VerificationTokenInvalid,
    /// Refresh token invalid, expired, or reuse-detected.
    RefreshTokenInvalid,
    /// The prepare pre-check: W1 solvency or W2 stamps.
    WriteRuleFailed,
    /// The staged write was garbage-collected unlanded.
    StagedWriteExpired,
    /// A submitted signature does not verify the record.
    SignatureInvalid,
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
                message: (*m).to_string(),
                code: ErrorCode::WeakPassword,
                field: path("password"),
            },
            OnboardingError::BadInput { field, message } => UserError {
                message: message.clone(),
                code: ErrorCode::BadInput,
                field: path(field),
            },
            OnboardingError::ApplicationInProgress => {
                UserError::new(ErrorCode::ApplicationInProgress, e.to_string())
            }
            OnboardingError::VerificationTokenInvalid => {
                UserError::new(ErrorCode::VerificationTokenInvalid, e.to_string())
            }
            OnboardingError::Unauthenticated => {
                UserError::new(ErrorCode::Unauthenticated, e.to_string())
            }
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

/// One accepted record of the shared graph, as the mirror carries it.
/// The read surface grows with the content slice; slice 1 exposes the
/// identity and causal key.
pub struct Record {
    pub act_id: String,
    pub family: RecordFamily,
    pub epoch: i64,
    pub act_time: i64,
    pub position: i64,
}

#[Object]
impl Record {
    /// L1's own record identifier, verbatim.
    async fn id(&self) -> &str {
        &self.act_id
    }

    async fn family(&self) -> RecordFamily {
        self.family
    }

    /// The landing epoch.
    async fn epoch(&self) -> i64 {
        self.epoch
    }

    /// Authoritative act time — the first component of the causal key.
    async fn act_time(&self) -> i64 {
        self.act_time
    }

    /// Position within the epoch's authoritative order.
    async fn position(&self) -> i64 {
        self.position
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
/// Field-authorized to the staging actor's session (or applicant token).
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
        let row = postgres_store::mirror::record_meta(pool, &act_id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        Ok(row.map(|r| Record {
            act_id: r.record_id,
            family: RecordFamily::from_str_lossy(&r.family),
            epoch: r.epoch,
            act_time: r.act_time,
            position: r.position,
        }))
    }
}

// ---------------------------------------------------------------------
// Auth and account types
// ---------------------------------------------------------------------

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
/// viewer it authenticates — the success result shared by logIn,
/// refreshSession, and the landing claim.
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
/// one actor.
#[derive(Interface)]
#[graphql(field(name = "id", ty = "Uuid"), field(name = "handle", ty = "String"))]
pub enum Actor {
    User(User),
}

/// A member account. The server-side login (credentials, sessions)
/// authenticates the service, never the graph.
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
    async fn display_name(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<String>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(store::current_display_name(pool, self.identity.id).await?)
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
    async fn staged_writes(
        &self,
        ctx: &Context<'_>,
        after: Option<String>,
        before: Option<String>,
        first: Option<i32>,
        last: Option<i32>,
    ) -> async_graphql::Result<Option<Connection<String, StagedWriteType>>> {
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

    /// The account's invite links — service-side staging state, not
    /// graph structure. Field-level: each link's id is the link
    /// capability, so this resolves only for the issuing actor.
    async fn invite_links(
        &self,
        ctx: &Context<'_>,
        after: Option<String>,
        before: Option<String>,
        first: Option<i32>,
        last: Option<i32>,
    ) -> async_graphql::Result<Option<Connection<String, InviteLink>>> {
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

    /// The inviter's approval queue.
    async fn applicants(
        &self,
        ctx: &Context<'_>,
        after: Option<String>,
        before: Option<String>,
        first: Option<i32>,
        last: Option<i32>,
    ) -> async_graphql::Result<Connection<String, Applicant>> {
        let pool = ctx.data::<PgPool>()?;
        let rows = store::applicants_for_link(pool, self.0.id).await?;
        offset_connection(rows, after, before, first, last, Applicant).await
    }
}

/// A staged applicant — off-graph service state only; nothing exists on
/// the graph until the Registration lands. Visible to the issuing
/// inviter (their approval queue) and to the applicant's own device.
pub struct Applicant(pub store::Applicant);

#[Object]
impl Applicant {
    async fn id(&self) -> Uuid {
        self.0.id
    }

    async fn handle(&self) -> &str {
        &self.0.handle
    }

    async fn email_verified(&self) -> bool {
        self.0.email_verified_at.is_some()
    }

    /// When the inviter's priced approval happened; null while pending.
    async fn approved_at(&self) -> Option<DateTime<Utc>> {
        self.0.approved_at
    }

    /// When the applicant's Registration confirmed and the account
    /// landed; null before.
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

/// The applicant's own view of their application, authorized by the
/// applicant token.
pub struct ApplicationView {
    pub applicant: store::Applicant,
    pub staged_registration: Option<staged::StagedWrite>,
}

#[Object]
impl ApplicationView {
    async fn applicant(&self) -> Applicant {
        Applicant(self.applicant.clone())
    }

    /// The staged Registration awaiting the device's signatures — its
    /// handshake state and, once sealed, the verified act. Null before
    /// approval and after landing. Re-staged automatically if a previous
    /// staging expired.
    async fn staged_registration(&self) -> Option<StagedWriteType> {
        self.staged_registration.clone().map(StagedWriteType)
    }
}

/// Builds an offset-cursor connection over an already-loaded, ordered
/// list. Slice-1 lists are small; keyset pagination arrives with the
/// content slice's read surfaces.
pub async fn offset_connection<T, G>(
    items: Vec<T>,
    after: Option<String>,
    before: Option<String>,
    first: Option<i32>,
    last: Option<i32>,
    wrap: impl Fn(T) -> G,
) -> async_graphql::Result<Connection<String, G>>
where
    G: async_graphql::OutputType,
{
    use async_graphql::connection::query;
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
