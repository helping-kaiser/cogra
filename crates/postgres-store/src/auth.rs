//! ´mod:module:auth´
//!
//! Authentication and onboarding state: invite links, accounts and their
//! applications, credentials, refresh-token sessions, and key backups
//! (auth.md; data-model.md "Authentication state").
//!
//! Auth gates the service, never the graph — nothing here is authoritative
//! about any record.

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

pub mod constraints {
    //! ´mod:module:constraints´
    //!
    //! The unique-constraint names this module's callers turn into
    //! refusals.
    //!
    //! PostgreSQL names the constraint, not the column, in a
    //! `unique_violation`: the error's `column_name` field is populated
    //! for a not-null violation and left empty for this one (PostgreSQL
    //! "Error and Notice Message Fields"). So the name is the only handle
    //! a refusal has, and two of these four are names PostgreSQL chose
    //! implicitly for an inline `UNIQUE` — nothing in a migration writes
    //! them down. The other two are standalone unique indexes and have no
    //! constraint row at all; the error carries the index's name just the
    //! same. A rename would silently turn a clean refusal into a 500,
    //! which is what `tests/schema.rs` pins.

    pub const ACTORS_HANDLE: &str = "actors_handle_key";
    pub const ACTORS_PUBKEY: &str = "actors_actor_pubkey_key";
    pub const ACTORS_ADDRESS: &str = "actors_realization_address_key";
    pub const CREDENTIALS_EMAIL: &str = "user_credentials_email_key";

    /// Every name a refusal in this module depends on — what the schema
    /// test walks.
    pub const ALL: [&str; 4] = [
        ACTORS_HANDLE,
        ACTORS_PUBKEY,
        ACTORS_ADDRESS,
        CREDENTIALS_EMAIL,
    ];
}

/// One invite link (data-model.md `auth_invite_links`): pure service-side
/// staging UX — nothing binds until the inviter's priced approval.
#[derive(Debug, Clone)]
pub struct InviteLink {
    pub id: Uuid,
    pub inviter_id: Uuid,
    pub single_use: bool,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
}

/// The account state gating acting through CoGra (auth.md "Account
/// states"): service state on the credentials row, never a graph fact.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccountState {
    Guest,
    Applicant,
    Member,
}

impl AccountState {
    pub fn as_str(self) -> &'static str {
        match self {
            AccountState::Guest => "guest",
            AccountState::Applicant => "applicant",
            AccountState::Member => "member",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "guest" => AccountState::Guest,
            "applicant" => AccountState::Applicant,
            "member" => AccountState::Member,
            _ => return None,
        })
    }
}

fn decode_account_state(s: &str) -> Result<AccountState, sqlx::Error> {
    AccountState::parse(s)
        .ok_or_else(|| sqlx::Error::Decode(format!("unknown account_state {s:?}").into()))
}

/// One application attempt (data-model.md `auth_applications`): the
/// invite-link provenance and approval/landing bookkeeping of an account
/// in the applicant state. The joined proof fields (`handle`,
/// `email_verified`, `key_attached`) come off the account rows — they are
/// what approvability reads.
#[derive(Debug, Clone)]
pub struct Application {
    pub id: Uuid,
    pub account_id: Uuid,
    pub invite_link_id: Uuid,
    pub handle: String,
    pub email_verified: bool,
    pub key_attached: bool,
    pub approved_at: Option<DateTime<Utc>>,
    pub landed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Why a session was revoked (auth.md "Reuse detection"): only a
/// `Rotated` token's replay can signal theft — `Owner` and `Security`
/// revocations replay benignly from signed-out devices.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RevokedReason {
    Rotated,
    Owner,
    Security,
}

impl RevokedReason {
    pub fn as_str(self) -> &'static str {
        match self {
            RevokedReason::Rotated => "rotated",
            RevokedReason::Owner => "owner",
            RevokedReason::Security => "security",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "rotated" => RevokedReason::Rotated,
            "owner" => RevokedReason::Owner,
            "security" => RevokedReason::Security,
            _ => return None,
        })
    }
}

fn decode_revoked_reason(s: &str) -> Result<RevokedReason, sqlx::Error> {
    RevokedReason::parse(s)
        .ok_or_else(|| sqlx::Error::Decode(format!("unknown revoked_reason {s:?}").into()))
}

/// One refresh-token session row (auth.md "Sessions"). A rotated row
/// links its successor and carries the successor's token sealed under
/// the consumed token — openable only by presenting that raw token,
/// never from the database alone.
#[derive(Debug, Clone)]
pub struct Session {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: DateTime<Utc>,
    pub device_label: Option<String>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub revoked_reason: Option<RevokedReason>,
    pub successor_id: Option<Uuid>,
    pub successor_enc: Option<Vec<u8>>,
}

/// The account half of a user-kind actor (data-model.md
/// `user_credentials`).
#[derive(Debug, Clone)]
pub struct Credentials {
    pub actor_id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub account_state: AccountState,
    pub email_verified_at: Option<DateTime<Utc>>,
}

/// Maps one user_credentials row onto the struct, decoding the account
/// state — the one mapping in this module that cannot be a `query_as!`,
/// because `account_state` is TEXT in the column and an enum in the
/// struct and the decode is fallible.
macro_rules! credentials_from_row {
    ($r:expr) => {
        Ok(Credentials {
            actor_id: $r.actor_id,
            email: $r.email,
            password_hash: $r.password_hash,
            account_state: decode_account_state(&$r.account_state)?,
            email_verified_at: $r.email_verified_at,
        })
    };
}

/// Maps one auth_invite_links row (a sqlx anonymous record) onto the
/// struct — the queries all select the same field set.
macro_rules! invite_link_from_row {
    ($r:expr) => {
        InviteLink {
            id: $r.id,
            inviter_id: $r.inviter_id,
            single_use: $r.single_use,
            created_at: $r.created_at,
            expires_at: $r.expires_at,
            revoked_at: $r.revoked_at,
        }
    };
}

pub async fn create_invite_link(
    pool: &PgPool,
    id: Uuid,
    inviter_id: Uuid,
    single_use: bool,
    expires_at: DateTime<Utc>,
) -> Result<InviteLink, sqlx::Error> {
    sqlx::query!(
        "INSERT INTO auth_invite_links (id, inviter_id, single_use, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id, inviter_id, single_use, created_at, expires_at, revoked_at",
        id,
        inviter_id,
        single_use,
        expires_at,
    )
    .fetch_one(pool)
    .await
    .map(|r| invite_link_from_row!(r))
}

pub async fn invite_link(pool: &PgPool, id: Uuid) -> Result<Option<InviteLink>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, inviter_id, single_use, created_at, expires_at, revoked_at
         FROM auth_invite_links WHERE id = $1",
        id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| invite_link_from_row!(r)))
}

pub async fn invite_links_for(
    pool: &PgPool,
    inviter_id: Uuid,
) -> Result<Vec<InviteLink>, sqlx::Error> {
    Ok(sqlx::query!(
        "SELECT id, inviter_id, single_use, created_at, expires_at, revoked_at
         FROM auth_invite_links WHERE inviter_id = $1
         ORDER BY created_at DESC",
        inviter_id,
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| invite_link_from_row!(r))
    .collect())
}

/// Revokes the issuer's own link; false when the link is not theirs (or
/// does not exist).
pub async fn revoke_invite_link(
    pool: &PgPool,
    id: Uuid,
    inviter_id: Uuid,
) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE auth_invite_links SET revoked_at = NOW()
         WHERE id = $1 AND inviter_id = $2 AND revoked_at IS NULL",
        id,
        inviter_id,
    )
    .execute(pool)
    .await?
    .rows_affected()
        == 1)
}

/// Whether the link can stage a new applicant now: live, and — for a
/// single-use link — its one slot not already held by an application
/// through it (invitations.md §4 "Link modes"). Applications carry no
/// timer, so a waiting one holds the slot exactly as an approved or
/// landed one does; the reaper deleting a never-verified account is what
/// frees it (auth.md "Expiry").
pub async fn invite_link_usable(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT EXISTS(
               SELECT 1 FROM auth_invite_links l
               WHERE l.id = $1
                 AND l.revoked_at IS NULL
                 AND l.expires_at > NOW()
                 AND (NOT l.single_use OR NOT EXISTS(
                     SELECT 1 FROM auth_applications a
                     WHERE a.invite_link_id = l.id
                 ))
           ) AS "usable!""#,
        id,
    )
    .fetch_one(pool)
    .await
}

/// The outcome of a registration against the two uniqueness constraints
/// (auth.md "Registration collision").
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegisterOutcome {
    Created,
    HandleTaken,
    EmailInUse,
}

/// Registers an account through an invite link, in one transaction
/// (auth.md §Application step 2): the actor row (no key yet), the
/// credentials in the applicant state, the first profile version
/// (display name = handle until the owner edits), and the application
/// row against the link. A dead account — never verified and past
/// `dead_before` — holding the handle or email is deleted first, so the
/// experience never depends on the reaper's schedule.
#[allow(clippy::too_many_arguments)]
pub async fn register_account(
    pool: &PgPool,
    account_id: Uuid,
    application_id: Uuid,
    invite_link_id: Uuid,
    handle: &str,
    email: &str,
    password_hash: &str,
    verification_token_hash: &[u8],
    dead_before: DateTime<Utc>,
) -> Result<RegisterOutcome, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let dead: Vec<Uuid> = sqlx::query_scalar!(
        "SELECT c.actor_id FROM user_credentials c
         JOIN actors a ON a.id = c.actor_id
         WHERE c.email_verified_at IS NULL
           AND c.created_at < $1
           AND (a.handle = $2 OR c.email = $3)",
        dead_before,
        handle,
        email,
    )
    .fetch_all(&mut *tx)
    .await?;
    delete_account_rows(&mut tx, &dead).await?;

    let inserted = sqlx::query!(
        "INSERT INTO actors (id, kind, handle) VALUES ($1, 'user', $2)",
        account_id,
        handle,
    )
    .execute(&mut *tx)
    .await;
    if let Some(outcome) = refused_unique(inserted)? {
        return Ok(outcome);
    }
    let inserted = sqlx::query!(
        "INSERT INTO user_credentials
             (actor_id, email, password_hash, account_state,
              email_verification_token_hash)
         VALUES ($1, $2, $3, 'applicant', $4)",
        account_id,
        email,
        password_hash,
        verification_token_hash,
    )
    .execute(&mut *tx)
    .await;
    if let Some(outcome) = refused_unique(inserted)? {
        return Ok(outcome);
    }
    sqlx::query!(
        "INSERT INTO actor_profile_versions (actor_id, display_name)
         VALUES ($1, $2)",
        account_id,
        handle,
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "INSERT INTO auth_applications (id, account_id, invite_link_id)
         VALUES ($1, $2, $3)",
        application_id,
        account_id,
        invite_link_id,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(RegisterOutcome::Created)
}

/// Maps a unique-constraint violation onto the registration outcome it
/// refuses with; passes every other result through.
fn refused_unique(
    result: Result<sqlx::postgres::PgQueryResult, sqlx::Error>,
) -> Result<Option<RegisterOutcome>, sqlx::Error> {
    match result {
        Ok(_) => Ok(None),
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => match e.constraint() {
            Some(constraints::ACTORS_HANDLE) => Ok(Some(RegisterOutcome::HandleTaken)),
            Some(constraints::CREDENTIALS_EMAIL) => Ok(Some(RegisterOutcome::EmailInUse)),
            _ => Err(sqlx::Error::Database(e)),
        },
        Err(e) => Err(e),
    }
}

/// Deletes accounts whole — profile versions, credentials, and the actor
/// row, whose FK cascades take sessions, applications, backups, and the
/// other user-scoped rows. Only ever called for never-verified accounts,
/// which cannot have touched L1 (auth.md "Reaper").
async fn delete_account_rows(conn: &mut PgConnection, ids: &[Uuid]) -> Result<(), sqlx::Error> {
    if ids.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        "DELETE FROM actor_profile_versions WHERE actor_id = ANY($1)",
        ids,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!("DELETE FROM user_credentials WHERE actor_id = ANY($1)", ids)
        .execute(&mut *conn)
        .await?;
    sqlx::query!("DELETE FROM actors WHERE id = ANY($1)", ids)
        .execute(&mut *conn)
        .await?;
    Ok(())
}

/// Maps one application row (a sqlx anonymous record, account rows
/// joined) onto the struct — the queries all select the same field set.
macro_rules! application_from_row {
    ($r:expr) => {
        Application {
            id: $r.id,
            account_id: $r.account_id,
            invite_link_id: $r.invite_link_id,
            handle: $r.handle,
            email_verified: $r.email_verified,
            key_attached: $r.key_attached,
            approved_at: $r.approved_at,
            landed_at: $r.landed_at,
            created_at: $r.created_at,
        }
    };
}

pub async fn application(pool: &PgPool, id: Uuid) -> Result<Option<Application>, sqlx::Error> {
    Ok(sqlx::query!(
        r#"SELECT ap.id, ap.account_id, ap.invite_link_id, a.handle,
                  (c.email_verified_at IS NOT NULL) AS "email_verified!",
                  (a.actor_pubkey IS NOT NULL) AS "key_attached!",
                  ap.approved_at, ap.landed_at, ap.created_at
           FROM auth_applications ap
           JOIN actors a ON a.id = ap.account_id
           JOIN user_credentials c ON c.actor_id = ap.account_id
           WHERE ap.id = $1"#,
        id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| application_from_row!(r)))
}

/// The account's newest application — the applicant's own view of its
/// progress (`User.application`); None when the account has none.
pub async fn latest_application_for(
    pool: &PgPool,
    account_id: Uuid,
) -> Result<Option<Application>, sqlx::Error> {
    Ok(sqlx::query!(
        r#"SELECT ap.id, ap.account_id, ap.invite_link_id, a.handle,
                  (c.email_verified_at IS NOT NULL) AS "email_verified!",
                  (a.actor_pubkey IS NOT NULL) AS "key_attached!",
                  ap.approved_at, ap.landed_at, ap.created_at
           FROM auth_applications ap
           JOIN actors a ON a.id = ap.account_id
           JOIN user_credentials c ON c.actor_id = ap.account_id
           WHERE ap.account_id = $1
           ORDER BY ap.created_at DESC LIMIT 1"#,
        account_id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| application_from_row!(r)))
}

/// The inviter's approval queue for one link, newest first.
pub async fn applications_for_link(
    pool: &PgPool,
    invite_link_id: Uuid,
) -> Result<Vec<Application>, sqlx::Error> {
    Ok(sqlx::query!(
        r#"SELECT ap.id, ap.account_id, ap.invite_link_id, a.handle,
                  (c.email_verified_at IS NOT NULL) AS "email_verified!",
                  (a.actor_pubkey IS NOT NULL) AS "key_attached!",
                  ap.approved_at, ap.landed_at, ap.created_at
           FROM auth_applications ap
           JOIN actors a ON a.id = ap.account_id
           JOIN user_credentials c ON c.actor_id = ap.account_id
           WHERE ap.invite_link_id = $1
           ORDER BY ap.created_at DESC"#,
        invite_link_id,
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| application_from_row!(r))
    .collect())
}

/// Marks the email channel proven (auth.md §Application step 4).
/// Single-use, and dead accounts — past `dead_before`, never verified —
/// cannot verify: they are already replaceable.
///
/// A carve-out change's link is never an ordinary verification token,
/// even though it sits in the same column: it was mailed to the new
/// address, so it must not verify the old one — whatever state its
/// change is in (`apply_email_change` is its only way in).
pub async fn verify_account_email(
    pool: &PgPool,
    verification_token_hash: &[u8],
    dead_before: DateTime<Utc>,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        "UPDATE user_credentials
         SET email_verified_at = NOW()
         WHERE email_verification_token_hash = $1
           AND email_verified_at IS NULL
           AND created_at >= $2
           AND NOT EXISTS (SELECT 1 FROM auth_email_changes
                           WHERE new_email_token_hash = $1)
         RETURNING actor_id",
        verification_token_hash,
        dead_before,
    )
    .fetch_optional(pool)
    .await
}

/// The live, unverified account holding an email — the resend target.
/// An account mid carve-out is not one: its address is being replaced,
/// and a fresh link to the replaced address would revive the very link
/// the change killed (auth.md "The unverified carve-out").
pub async fn unverified_account_by_email(
    pool: &PgPool,
    email: &str,
    dead_before: DateTime<Utc>,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT c.actor_id FROM user_credentials c
         WHERE c.email = $1 AND c.email_verified_at IS NULL AND c.created_at >= $2
           AND NOT EXISTS (
               SELECT 1 FROM auth_email_changes e
               WHERE e.user_id = c.actor_id AND NOT e.requires_code
                 AND e.cancelled_at IS NULL AND e.applied_at IS NULL
                 AND e.expires_at > NOW())",
        email,
        dead_before,
    )
    .fetch_optional(pool)
    .await
}

/// Replaces the verification token for a resend — the raw token never
/// persists, so a resend mints a fresh secret.
pub async fn rotate_verification_token(
    pool: &PgPool,
    account_id: Uuid,
    new_token_hash: &[u8],
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE user_credentials SET email_verification_token_hash = $2
         WHERE actor_id = $1 AND email_verified_at IS NULL",
        account_id,
        new_token_hash,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// The outcome of a key attach against the actor-identity uniqueness
/// indexes (auth.md §Application step 3): an address binds at most one
/// account.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttachOutcome {
    Attached,
    /// The key or its derived address is already bound to a different
    /// account. The unique indexes are the enforcement, so a concurrent
    /// duplicate attach cannot slip through a check-then-write gap.
    KeyInUse,
    /// The account is not an unapproved applicant.
    Refused,
}

/// Attaches the device-minted actor identity — the key ceremony's server
/// half (auth.md §Application step 3). Replaceable while the account is
/// an applicant with no approved application; `Refused` once approval
/// has bound the address (or the account is not an applicant at all),
/// `KeyInUse` when the key is bound to a different account.
pub async fn attach_actor_key(
    pool: &PgPool,
    account_id: Uuid,
    actor_pubkey: &[u8],
    address: &str,
) -> Result<AttachOutcome, sqlx::Error> {
    let updated = sqlx::query!(
        "UPDATE actors a
         SET actor_pubkey = $2, realization_address = $3
         FROM user_credentials c
         WHERE a.id = $1 AND c.actor_id = a.id
           AND a.kind = 'user'
           AND c.account_state = 'applicant'
           AND NOT EXISTS(
               SELECT 1 FROM auth_applications ap
               WHERE ap.account_id = a.id AND ap.approved_at IS NOT NULL
           )",
        account_id,
        actor_pubkey,
        address,
    )
    .execute(pool)
    .await;
    match updated {
        Ok(r) if r.rows_affected() == 1 => Ok(AttachOutcome::Attached),
        Ok(_) => Ok(AttachOutcome::Refused),
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => match e.constraint() {
            Some(constraints::ACTORS_PUBKEY | constraints::ACTORS_ADDRESS) => {
                Ok(AttachOutcome::KeyInUse)
            }
            _ => Err(sqlx::Error::Database(e)),
        },
        Err(e) => Err(e),
    }
}

/// Marks the inviter's priced approval — the `approved_at IS NULL`
/// predicate is the concurrency gate against a duplicate approval.
/// Refused (None) unless the application is still waiting and approvable:
/// email verified and key attached, both enforced here as well as
/// validated by the caller (auth.md §Application). No clock gates it — an
/// application waits on a vouch with no timer (auth.md "Expiry").
pub async fn approve_application(pool: &PgPool, id: Uuid) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        "UPDATE auth_applications ap
         SET approved_at = NOW()
         FROM actors a, user_credentials c
         WHERE ap.id = $1 AND a.id = ap.account_id AND c.actor_id = ap.account_id
           AND ap.approved_at IS NULL
           AND ap.landed_at IS NULL
           AND c.email_verified_at IS NOT NULL
           AND a.actor_pubkey IS NOT NULL
         RETURNING ap.account_id",
        id,
    )
    .fetch_optional(pool)
    .await
}

/// Locks the application row for the caller's transaction — the
/// serialization point of the admission staging sequence (auth.md
/// "Approval and landing" step 1): the approving mutation and the
/// status-poll repair hook queue here instead of racing the funding
/// burn. False when the row is gone.
pub async fn lock_application(conn: &mut PgConnection, id: Uuid) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query_scalar!(
        "SELECT id FROM auth_applications WHERE id = $1 FOR UPDATE",
        id,
    )
    .fetch_optional(conn)
    .await?
    .is_some())
}

/// Lands an account whose Registration confirmed (auth.md "Approval and
/// landing" step 4): flips the account state to member and marks the
/// approved application landed. Nothing moves — the credentials have
/// been the account's since registration. True when an application
/// landed (false for actors with no approved application, e.g. a
/// genesis Registration re-ingested on rebuild).
pub async fn land_account(pool: &PgPool, account_id: Uuid) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let landed = sqlx::query!(
        "UPDATE auth_applications
         SET landed_at = NOW()
         WHERE account_id = $1 AND approved_at IS NOT NULL AND landed_at IS NULL",
        account_id,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected()
        == 1;
    if !landed {
        return Ok(false);
    }
    sqlx::query!(
        "UPDATE user_credentials SET account_state = 'member'
         WHERE actor_id = $1 AND account_state = 'applicant'",
        account_id,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(true)
}

/// The actor that issued the invite link this account's newest
/// application came through — the provenance behind the borrowed view an
/// applicant is shown and behind the reciprocation gesture a member
/// makes; None for accounts without an application trace (genesis
/// actors).
///
/// The newest row is the account's current application, the same rule
/// [`latest_application_for`] reads `User.application` by, and it answers
/// both states with one ordering: an applicant's newest row is the one it
/// waits on, and a landed member's last row is the one they landed
/// through — registration writes an application only for the fresh
/// account it creates, so no row can be created after the landing.
pub async fn inviter_of(
    pool: &PgPool,
    account_id: Uuid,
) -> Result<Option<ActorIdentity>, sqlx::Error> {
    sqlx::query_as!(
        ActorIdentity,
        "SELECT i.id, i.kind, i.handle, i.actor_pubkey, i.realization_address, i.created_at
         FROM auth_applications ap
         JOIN auth_invite_links l ON l.id = ap.invite_link_id
         JOIN actors i ON i.id = l.inviter_id
         WHERE ap.account_id = $1
         ORDER BY ap.created_at DESC LIMIT 1",
        account_id,
    )
    .fetch_optional(pool)
    .await
}

/// Whether the reciprocation latch is set on the account's landed
/// application row (auth.md "Reciprocation is the joiner's own act") —
/// once true, the mirror is not queried again.
pub async fn reciprocation_latched(pool: &PgPool, account_id: Uuid) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT EXISTS(
               SELECT 1 FROM auth_applications
               WHERE account_id = $1 AND landed_at IS NOT NULL
                 AND reciprocated_at IS NOT NULL
           ) AS "exists!""#,
        account_id,
    )
    .fetch_one(pool)
    .await
}

/// Sets the reciprocation latch — the derived cache of the mirror's
/// permanent back-edge (auth.md "Reciprocation is the joiner's own
/// act"); idempotent, the `IS NULL` predicate is the concurrency gate.
pub async fn latch_reciprocated(pool: &PgPool, account_id: Uuid) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE auth_applications
         SET reciprocated_at = NOW()
         WHERE account_id = $1 AND landed_at IS NOT NULL
           AND reciprocated_at IS NULL",
        account_id,
    )
    .execute(pool)
    .await?
    .rows_affected()
        == 1)
}

/// The reaper (auth.md "Reaper"): deletes never-verified accounts past
/// their bound, whole — freeing handle and email. Verified accounts are
/// never reaped; deletion is legitimate exactly because nothing has
/// touched L1.
pub async fn reap_unverified_accounts(
    pool: &PgPool,
    dead_before: DateTime<Utc>,
) -> Result<u64, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let dead: Vec<Uuid> = sqlx::query_scalar!(
        "SELECT actor_id FROM user_credentials
         WHERE email_verified_at IS NULL AND created_at < $1",
        dead_before,
    )
    .fetch_all(&mut *tx)
    .await?;
    let count = dead.len() as u64;
    delete_account_rows(&mut tx, &dead).await?;
    tx.commit().await?;
    Ok(count)
}

/// What one secret sweep removed, per table.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SweptSecrets {
    pub refresh_tokens: u64,
    pub password_resets: u64,
    pub email_changes: u64,
}

impl SweptSecrets {
    pub fn total(&self) -> u64 {
        self.refresh_tokens + self.password_resets + self.email_changes
    }
}

/// Deletes spent bearer-secret rows past their retention bound.
///
/// Three tables here store a token hash and keep the row after the token
/// stops being usable: a refresh token past expiry or revocation, a reset
/// link past use or expiry, an email change once it ended — applied,
/// canceled, or run out. None of them is evidence of anything once the
/// window closes, and a hash that no longer answers any question is only
/// a hash left lying around, so the row goes.
///
/// The two windows are different because the tables are. A refresh
/// token's revoked row is what reuse detection recognises a replayed
/// token by (auth.md "Refresh rotation"), so it is kept long enough for
/// that answer to still be worth giving — 30 days. A reset link proves
/// nothing once consumed, and an ended email change only tells a late
/// link what ended it, so both go on the short window; after it, a
/// stale change link reads as unknown.
///
/// `auth_invite_links` and `auth_applications` are deliberately not
/// swept: neither declares a secret column, and both are the provenance
/// record of how an account came to exist — who invited whom, which
/// application landed. That is an audit trail, and an audit trail with a
/// reaper is not one.
pub async fn sweep_spent_secrets(
    pool: &PgPool,
    refresh_grace_secs: f64,
    single_use_grace_secs: f64,
) -> Result<SweptSecrets, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let refresh_tokens = sqlx::query!(
        "DELETE FROM auth_refresh_tokens
         WHERE expires_at < now() - make_interval(secs => $1)
            OR revoked_at < now() - make_interval(secs => $1)",
        refresh_grace_secs,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();
    let password_resets = sqlx::query!(
        "DELETE FROM auth_password_resets
         WHERE expires_at < now() - make_interval(secs => $1)
            OR used_at < now() - make_interval(secs => $1)",
        single_use_grace_secs,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();
    let email_changes = sqlx::query!(
        "DELETE FROM auth_email_changes
         WHERE expires_at < now() - make_interval(secs => $1)
            OR applied_at < now() - make_interval(secs => $1)
            OR cancelled_at < now() - make_interval(secs => $1)",
        single_use_grace_secs,
    )
    .execute(&mut *tx)
    .await?
    .rows_affected();
    tx.commit().await?;
    Ok(SweptSecrets {
        refresh_tokens,
        password_resets,
        email_changes,
    })
}

pub async fn credentials_by_email(
    pool: &PgPool,
    email: &str,
) -> Result<Option<Credentials>, sqlx::Error> {
    sqlx::query!(
        "SELECT actor_id, email, password_hash, account_state, email_verified_at
         FROM user_credentials WHERE email = $1",
        email,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| credentials_from_row!(r))
    .transpose()
}

pub async fn credentials_by_actor(
    pool: &PgPool,
    actor_id: Uuid,
) -> Result<Option<Credentials>, sqlx::Error> {
    sqlx::query!(
        "SELECT actor_id, email, password_hash, account_state, email_verified_at
         FROM user_credentials WHERE actor_id = $1",
        actor_id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| credentials_from_row!(r))
    .transpose()
}

pub async fn update_password_hash(
    pool: &PgPool,
    actor_id: Uuid,
    password_hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE user_credentials SET password_hash = $2 WHERE actor_id = $1",
        actor_id,
        password_hash,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Inserts a fresh session row (the raw token never persists — only its
/// hash; auth.md "Refresh token").
pub async fn insert_session(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    token_hash: &[u8],
    expires_at: DateTime<Utc>,
    device_label: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO auth_refresh_tokens
             (id, user_id, token_hash, expires_at, device_label)
         VALUES ($1, $2, $3, $4, $5)",
        id,
        user_id,
        token_hash,
        expires_at,
        device_label,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Maps one auth_refresh_tokens row (a sqlx anonymous record) onto the
/// struct — the queries all select the same field set. Fallible: the
/// stored revoked_reason must decode.
macro_rules! session_from_row {
    ($r:expr) => {
        Ok(Session {
            id: $r.id,
            user_id: $r.user_id,
            created_at: $r.created_at,
            last_used_at: $r.last_used_at,
            expires_at: $r.expires_at,
            device_label: $r.device_label,
            revoked_at: $r.revoked_at,
            revoked_reason: $r
                .revoked_reason
                .as_deref()
                .map(decode_revoked_reason)
                .transpose()?,
            successor_id: $r.successor_id,
            successor_enc: $r.successor_enc,
        })
    };
}

pub async fn session_by_token_hash(
    pool: &PgPool,
    token_hash: &[u8],
) -> Result<Option<Session>, sqlx::Error> {
    sqlx::query!(
        "SELECT id, user_id, created_at, last_used_at, expires_at,
                device_label, revoked_at, revoked_reason,
                successor_id, successor_enc
         FROM auth_refresh_tokens WHERE token_hash = $1",
        token_hash,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| session_from_row!(r))
    .transpose()
}

pub async fn session(pool: &PgPool, id: Uuid) -> Result<Option<Session>, sqlx::Error> {
    sqlx::query!(
        "SELECT id, user_id, created_at, last_used_at, expires_at,
                device_label, revoked_at, revoked_reason,
                successor_id, successor_enc
         FROM auth_refresh_tokens WHERE id = $1",
        id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| session_from_row!(r))
    .transpose()
}

/// Rotation (auth.md "Refresh token"): consumes the presented row and
/// mints its successor in one transaction — every successful refresh
/// invalidates the old token, bounding a stolen token to a single use.
/// The consumed row links the successor and stores it sealed under the
/// consumed token (`successor_enc`), so a grace-window replay can be
/// answered idempotently; that link is set after the insert, since the
/// foreign key needs the successor row to exist. Returns false when a
/// concurrent refresh consumed the row first — the caller re-reads and
/// takes the replay path instead of erroring.
pub async fn rotate_session(
    pool: &PgPool,
    old_id: Uuid,
    new_id: Uuid,
    new_token_hash: &[u8],
    new_expires_at: DateTime<Utc>,
    successor_enc: &[u8],
) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(row) = sqlx::query!(
        "UPDATE auth_refresh_tokens
         SET revoked_at = NOW(), last_used_at = NOW(),
             revoked_reason = 'rotated'
         WHERE id = $1 AND revoked_at IS NULL
         RETURNING user_id, device_label",
        old_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Ok(false);
    };
    sqlx::query!(
        "INSERT INTO auth_refresh_tokens
             (id, user_id, token_hash, expires_at, device_label)
         VALUES ($1, $2, $3, $4, $5)",
        new_id,
        row.user_id,
        new_token_hash,
        new_expires_at,
        row.device_label.as_deref(),
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query!(
        "UPDATE auth_refresh_tokens
         SET successor_id = $2, successor_enc = $3
         WHERE id = $1",
        old_id,
        new_id,
        successor_enc,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(true)
}

/// Active sessions for the session list — unexpired and unrevoked.
pub async fn sessions_for(pool: &PgPool, user_id: Uuid) -> Result<Vec<Session>, sqlx::Error> {
    sqlx::query!(
        "SELECT id, user_id, created_at, last_used_at, expires_at,
                device_label, revoked_at, revoked_reason,
                successor_id, successor_enc
         FROM auth_refresh_tokens
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY created_at DESC",
        user_id,
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|r| session_from_row!(r))
    .collect()
}

/// Revokes one of the user's sessions; false when it is not theirs.
/// Always owner-initiated — sign-out and the session list are the only
/// callers.
pub async fn revoke_session(pool: &PgPool, id: Uuid, user_id: Uuid) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE auth_refresh_tokens
         SET revoked_at = NOW(), revoked_reason = 'owner'
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL",
        id,
        user_id,
    )
    .execute(pool)
    .await?
    .rows_affected()
        == 1)
}

/// Revokes every session except `keep` (password change, "revoke all
/// others"). Pass None to revoke all (reset, reuse detection, deletion).
/// The reason decides how a later replay of the revoked tokens is read
/// (auth.md "Reuse detection").
pub async fn revoke_sessions(
    pool: &PgPool,
    user_id: Uuid,
    keep: Option<Uuid>,
    reason: RevokedReason,
) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE auth_refresh_tokens
         SET revoked_at = NOW(), revoked_reason = $3
         WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2)",
        user_id,
        keep,
        reason.as_str(),
    )
    .execute(pool)
    .await?
    .rows_affected())
}

/// Stamps the account's reuse-detection mark (auth.md "Reuse
/// detection"). A later detection overwrites an undelivered one — the
/// notice carries the latest incident. No-op for a vanished account.
pub async fn mark_reuse_detected(pool: &PgPool, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE user_credentials SET reuse_detected_at = NOW() WHERE actor_id = $1",
        user_id,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Takes the account's pending reuse-detection mark: returns the
/// detection time and clears it, so the notice is delivered exactly
/// once. Lock-then-clear in one statement — a concurrent taker blocks
/// on the row lock and re-evaluates the `IS NOT NULL` predicate against
/// the committed row (READ COMMITTED), so it takes nothing.
///
/// The clear rides a data-modifying `WITH`, which PostgreSQL runs to
/// completion whether or not the primary query reads its output, and
/// which cannot see the sibling's effect — so the value returned is the
/// detection time and not the NULL just written. A plain
/// `UPDATE … RETURNING reuse_detected_at` would return the new value:
/// `RETURNING old.column` is PostgreSQL 18, and this runs on 16.
pub async fn take_reuse_detected(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Option<DateTime<Utc>>, sqlx::Error> {
    sqlx::query_scalar!(
        r#"
        WITH marked AS (
            SELECT actor_id, reuse_detected_at
            FROM user_credentials
            WHERE actor_id = $1 AND reuse_detected_at IS NOT NULL
            FOR UPDATE
        ), cleared AS (
            UPDATE user_credentials c
            SET reuse_detected_at = NULL
            FROM marked m
            WHERE c.actor_id = m.actor_id
        )
        SELECT reuse_detected_at AS "reuse_detected_at!" FROM marked
        "#,
        user_id,
    )
    .fetch_optional(pool)
    .await
}

pub async fn create_password_reset(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    token_hash: &[u8],
    expires_at: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO auth_password_resets (id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)",
        id,
        user_id,
        token_hash,
        expires_at,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Consumes a live reset token, returning its account. None when the
/// token is unknown, expired, or already used.
pub async fn consume_password_reset(
    pool: &PgPool,
    token_hash: &[u8],
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        "UPDATE auth_password_resets SET used_at = NOW()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id",
        token_hash,
    )
    .fetch_optional(pool)
    .await
}

/// One email change (data-model.md `auth_email_changes`) — the two-sided
/// proof of auth.md "Email change", or the unverified carve-out's
/// one-sided one.
#[derive(Debug, Clone)]
pub struct EmailChange {
    pub id: Uuid,
    pub user_id: Uuid,
    pub new_email: String,
    /// False on the unverified carve-out: no code exists, and the new
    /// address's verification link is the whole proof.
    pub requires_code: bool,
    pub original_confirmed_at: Option<DateTime<Utc>>,
    pub new_verified_at: Option<DateTime<Utc>>,
    pub failed_attempts: i32,
    pub code_disabled_at: Option<DateTime<Utc>>,
    pub cancelled_at: Option<DateTime<Utc>>,
    pub applied_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    /// Whether the change ran out before anything else ended it — read
    /// against the database clock, the one the guards below use.
    pub ran_out: bool,
}

/// What ended a change. A change ends once, so at most one holds; a
/// cancel stamped on an already run-out change (a supersede) still
/// reads as run out, because that is what ended it first.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmailChangeEnd {
    Applied,
    Canceled,
    RanOut,
}

impl EmailChange {
    /// None while the change is live.
    pub fn end(&self) -> Option<EmailChangeEnd> {
        if self.applied_at.is_some() {
            Some(EmailChangeEnd::Applied)
        } else if self.ran_out {
            Some(EmailChangeEnd::RanOut)
        } else if self.cancelled_at.is_some() {
            Some(EmailChangeEnd::Canceled)
        } else {
            None
        }
    }

    /// The current-address code is still owed.
    pub fn code_owed(&self) -> bool {
        self.requires_code && self.original_confirmed_at.is_none()
    }

    /// The new address's link is still owed.
    pub fn link_owed(&self) -> bool {
        self.new_verified_at.is_none()
    }
}

/// Maps one auth_email_changes row onto the struct — the queries all
/// select the same field set.
macro_rules! email_change_from_row {
    ($r:expr) => {
        EmailChange {
            id: $r.id,
            user_id: $r.user_id,
            new_email: $r.new_email,
            requires_code: $r.requires_code,
            original_confirmed_at: $r.original_confirmed_at,
            new_verified_at: $r.new_verified_at,
            failed_attempts: $r.failed_attempts,
            code_disabled_at: $r.code_disabled_at,
            cancelled_at: $r.cancelled_at,
            applied_at: $r.applied_at,
            created_at: $r.created_at,
            expires_at: $r.expires_at,
            ran_out: $r.ran_out,
        }
    };
}

/// The fresh secrets a request arms.
#[derive(Debug, Clone, Copy)]
pub struct EmailChangeSecrets<'a> {
    pub original_code_hash: &'a [u8],
    pub new_email_token_hash: &'a [u8],
}

/// Opens an email change, ending any change still standing as canceled
/// (one per account), and answers whether the change needs the
/// current-address code.
///
/// Which path a change takes is read here, under the account's row lock,
/// not by the caller: a verify landing between the caller's read and
/// this write would otherwise open a codeless change on a verified
/// account. On the unverified carve-out the code is not stored, and the
/// new address's token becomes the account's verification token — the
/// replaced address's link dies in the same write (auth.md "The
/// unverified carve-out").
pub async fn open_email_change(
    pool: &PgPool,
    id: Uuid,
    user_id: Uuid,
    new_email: &str,
    secrets: EmailChangeSecrets<'_>,
    expires_at: DateTime<Utc>,
) -> Result<bool, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let verified = sqlx::query_scalar!(
        r#"SELECT email_verified_at IS NOT NULL AS "verified!"
           FROM user_credentials WHERE actor_id = $1 FOR UPDATE"#,
        user_id,
    )
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query!(
        "UPDATE auth_email_changes SET cancelled_at = NOW()
         WHERE user_id = $1 AND cancelled_at IS NULL AND applied_at IS NULL",
        user_id,
    )
    .execute(&mut *tx)
    .await?;
    let code_hash = verified.then_some(secrets.original_code_hash);
    sqlx::query!(
        "INSERT INTO auth_email_changes
             (id, user_id, new_email, requires_code, original_code_hash,
              new_email_token_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
        id,
        user_id,
        new_email,
        verified,
        code_hash,
        secrets.new_email_token_hash,
        expires_at,
    )
    .execute(&mut *tx)
    .await?;
    if !verified {
        sqlx::query!(
            "UPDATE user_credentials SET email_verification_token_hash = $2
             WHERE actor_id = $1 AND email_verified_at IS NULL",
            user_id,
            secrets.new_email_token_hash,
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(verified)
}

/// The change a new-side token belongs to, whatever its state and
/// whoever owns it — the caller answers ownership first.
pub async fn email_change_by_token(
    pool: &PgPool,
    new_email_token_hash: &[u8],
) -> Result<Option<EmailChange>, sqlx::Error> {
    Ok(sqlx::query!(
        r#"SELECT id, user_id, new_email, requires_code, original_confirmed_at,
                  new_verified_at, failed_attempts, code_disabled_at,
                  cancelled_at, applied_at, created_at, expires_at,
                  expires_at <= COALESCE(cancelled_at, NOW()) AS "ran_out!"
           FROM auth_email_changes WHERE new_email_token_hash = $1"#,
        new_email_token_hash,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| email_change_from_row!(r)))
}

/// The account's newest change, whatever its state.
pub async fn latest_email_change(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Option<EmailChange>, sqlx::Error> {
    Ok(sqlx::query!(
        r#"SELECT id, user_id, new_email, requires_code, original_confirmed_at,
                  new_verified_at, failed_attempts, code_disabled_at,
                  cancelled_at, applied_at, created_at, expires_at,
                  expires_at <= COALESCE(cancelled_at, NOW()) AS "ran_out!"
           FROM auth_email_changes WHERE user_id = $1
           ORDER BY created_at DESC, id DESC LIMIT 1"#,
        user_id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| email_change_from_row!(r)))
}

/// The account's live change — unended and inside its window — if any.
pub async fn pending_email_change(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Option<EmailChange>, sqlx::Error> {
    Ok(sqlx::query!(
        r#"SELECT id, user_id, new_email, requires_code, original_confirmed_at,
                  new_verified_at, failed_attempts, code_disabled_at,
                  cancelled_at, applied_at, created_at, expires_at,
                  FALSE AS "ran_out!"
           FROM auth_email_changes
           WHERE user_id = $1 AND cancelled_at IS NULL AND applied_at IS NULL
             AND expires_at > NOW()"#,
        user_id,
    )
    .fetch_optional(pool)
    .await?
    .map(|r| email_change_from_row!(r)))
}

/// Marks a live change's new address proven. Idempotent: an already
/// proven side keeps its first stamp. False when the change is no
/// longer live.
pub async fn confirm_email_change_link(pool: &PgPool, id: Uuid) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE auth_email_changes
         SET new_verified_at = COALESCE(new_verified_at, NOW())
         WHERE id = $1 AND cancelled_at IS NULL AND applied_at IS NULL
           AND expires_at > NOW()",
        id,
    )
    .execute(pool)
    .await?
    .rows_affected()
        == 1)
}

/// What one code submission did to a live change's code side.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CodeSubmission {
    /// The code matched and the change's code side is now proven.
    Confirmed(Uuid),
    /// The change's code side was already proven by this same code — a
    /// retry.
    AlreadyConfirmed(Uuid),
    /// The code did not match; the wrong-try count is not yet at the cap.
    Wrong,
    /// The code is disabled — by this wrong try reaching the cap, or by
    /// an earlier one. Even the right code answers this until a fresh
    /// code is minted.
    Disabled,
    /// No live change with a code is pending.
    NotLive,
}

/// Submits a code against the account's live change, counting a wrong
/// one; the try that reaches `cap` disables the code and already answers
/// `Disabled`, so the reader learns the code died at the moment it did.
///
/// The row is locked for the read-compare-write, so two concurrent
/// wrong tries cannot both read the count below the cap.
pub async fn submit_email_change_code(
    pool: &PgPool,
    user_id: Uuid,
    code_hash: &[u8],
    cap: i32,
) -> Result<CodeSubmission, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(row) = sqlx::query!(
        "SELECT id, original_code_hash, original_confirmed_at, code_disabled_at
         FROM auth_email_changes
         WHERE user_id = $1 AND requires_code
           AND cancelled_at IS NULL AND applied_at IS NULL AND expires_at > NOW()
         FOR UPDATE",
        user_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Ok(CodeSubmission::NotLive);
    };
    let matches = row.original_code_hash.as_deref() == Some(code_hash);
    let outcome = if row.code_disabled_at.is_some() {
        CodeSubmission::Disabled
    } else if row.original_confirmed_at.is_some() {
        // A spent code is not a guess: neither a retry nor a stray press
        // after the side landed counts toward the cap.
        if matches {
            CodeSubmission::AlreadyConfirmed(row.id)
        } else {
            CodeSubmission::Wrong
        }
    } else if matches {
        sqlx::query!(
            "UPDATE auth_email_changes SET original_confirmed_at = NOW() WHERE id = $1",
            row.id,
        )
        .execute(&mut *tx)
        .await?;
        CodeSubmission::Confirmed(row.id)
    } else {
        let disabled = sqlx::query_scalar!(
            r#"UPDATE auth_email_changes
               SET failed_attempts = failed_attempts + 1,
                   code_disabled_at = CASE WHEN failed_attempts + 1 >= $2
                                           THEN NOW() END
               WHERE id = $1
               RETURNING code_disabled_at IS NOT NULL AS "disabled!""#,
            row.id,
            cap,
        )
        .fetch_one(&mut *tx)
        .await?;
        if disabled {
            CodeSubmission::Disabled
        } else {
            CodeSubmission::Wrong
        }
    };
    tx.commit().await?;
    Ok(outcome)
}

/// The fresh secrets a resend offers; only the owed sides take theirs.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ResentSides {
    /// A fresh code replaced the old one and re-armed the wrong-try count.
    pub code: bool,
    /// A fresh link token replaced the old one.
    pub link: bool,
}

/// Re-arms a live change's owed sides with fresh secrets; a proven side
/// is never reset (auth.md "Email change" — Resend mails the owed
/// side only). A fresh code clears the wrong-try count and the disable.
/// On the carve-out the fresh link token is the account's verification
/// token too, so the previous link dies with it. Answers which sides
/// took a fresh secret — none when no live change is pending.
pub async fn resend_email_change(
    pool: &PgPool,
    user_id: Uuid,
    secrets: EmailChangeSecrets<'_>,
) -> Result<ResentSides, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(row) = sqlx::query!(
        "SELECT id, requires_code, original_confirmed_at, new_verified_at
         FROM auth_email_changes
         WHERE user_id = $1 AND cancelled_at IS NULL AND applied_at IS NULL
           AND expires_at > NOW()
         FOR UPDATE",
        user_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Ok(ResentSides::default());
    };
    let sides = ResentSides {
        code: row.requires_code && row.original_confirmed_at.is_none(),
        link: row.new_verified_at.is_none(),
    };
    if sides.code {
        sqlx::query!(
            "UPDATE auth_email_changes
             SET original_code_hash = $2, failed_attempts = 0, code_disabled_at = NULL
             WHERE id = $1",
            row.id,
            secrets.original_code_hash,
        )
        .execute(&mut *tx)
        .await?;
    }
    if sides.link {
        sqlx::query!(
            "UPDATE auth_email_changes SET new_email_token_hash = $2 WHERE id = $1",
            row.id,
            secrets.new_email_token_hash,
        )
        .execute(&mut *tx)
        .await?;
        if !row.requires_code {
            sqlx::query!(
                "UPDATE user_credentials SET email_verification_token_hash = $2
                 WHERE actor_id = $1 AND email_verified_at IS NULL",
                user_id,
                secrets.new_email_token_hash,
            )
            .execute(&mut *tx)
            .await?;
        }
    }
    tx.commit().await?;
    Ok(sides)
}

/// Calls off the account's live change: both secrets die with it, the
/// address stays, and the row stays so a later link names the cancel.
/// False when nothing was pending.
pub async fn cancel_email_change(pool: &PgPool, user_id: Uuid) -> Result<bool, sqlx::Error> {
    Ok(sqlx::query!(
        "UPDATE auth_email_changes SET cancelled_at = NOW()
         WHERE user_id = $1 AND cancelled_at IS NULL AND applied_at IS NULL
           AND expires_at > NOW()",
        user_id,
    )
    .execute(pool)
    .await?
    .rows_affected()
        == 1)
}

/// The outcome of applying a change against the email uniqueness
/// constraint (auth.md "Email change").
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmailChangeApply {
    /// This call moved the address.
    Applied,
    /// The change is live but a side is still owed.
    NotReady,
    /// The change already ended — applied, canceled, or run out.
    Ended(EmailChangeEnd),
    /// The proven change collides with another account's email; the
    /// change stays live, so a retry within the window can still apply
    /// it if the address frees up.
    EmailInUse,
}

/// Applies a change once every side it needs is proven: the address
/// moves, the change is stamped applied, and — on the carve-out, where
/// the new address's link is the verification link — the account is
/// verified in the same step. A carve-out change on an account already
/// past its unverified bound (`dead_before`) does not apply: that
/// account can no longer verify, as `verify_account_email` holds.
pub async fn apply_email_change(
    pool: &PgPool,
    id: Uuid,
    dead_before: DateTime<Utc>,
) -> Result<EmailChangeApply, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let Some(row) = sqlx::query!(
        r#"SELECT user_id, new_email, requires_code, original_confirmed_at,
                  new_verified_at, cancelled_at, applied_at,
                  expires_at <= COALESCE(cancelled_at, NOW()) AS "ran_out!"
           FROM auth_email_changes WHERE id = $1 FOR UPDATE"#,
        id,
    )
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Ok(EmailChangeApply::NotReady);
    };
    if row.applied_at.is_some() {
        return Ok(EmailChangeApply::Ended(EmailChangeEnd::Applied));
    }
    if row.ran_out {
        return Ok(EmailChangeApply::Ended(EmailChangeEnd::RanOut));
    }
    if row.cancelled_at.is_some() {
        return Ok(EmailChangeApply::Ended(EmailChangeEnd::Canceled));
    }
    let code_side = !row.requires_code || row.original_confirmed_at.is_some();
    if !code_side || row.new_verified_at.is_none() {
        return Ok(EmailChangeApply::NotReady);
    }
    let moved = sqlx::query!(
        "UPDATE user_credentials
         SET email = $2,
             email_verified_at = COALESCE(email_verified_at, NOW())
         WHERE actor_id = $1
           AND ($3 OR (email_verified_at IS NULL AND created_at >= $4))",
        row.user_id,
        row.new_email,
        row.requires_code,
        dead_before,
    )
    .execute(&mut *tx)
    .await;
    match moved {
        Ok(r) if r.rows_affected() == 1 => {}
        Ok(_) => return Ok(EmailChangeApply::NotReady),
        Err(sqlx::Error::Database(e))
            if e.is_unique_violation()
                && e.constraint() == Some(constraints::CREDENTIALS_EMAIL) =>
        {
            return Ok(EmailChangeApply::EmailInUse);
        }
        Err(e) => return Err(e),
    }
    sqlx::query!(
        "UPDATE auth_email_changes SET applied_at = NOW() WHERE id = $1",
        id,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(EmailChangeApply::Applied)
}

/// Renames the account in the one actor namespace. False on a uniqueness
/// collision (surfaced as HANDLE_TAKEN).
pub async fn change_handle(
    pool: &PgPool,
    user_id: Uuid,
    handle: &str,
) -> Result<bool, sqlx::Error> {
    match sqlx::query!(
        "UPDATE actors SET handle = $2 WHERE id = $1 AND kind = 'user'",
        user_id,
        handle,
    )
    .execute(pool)
    .await
    {
        Ok(r) => Ok(r.rows_affected() == 1),
        Err(sqlx::Error::Database(e))
            if e.is_unique_violation() && e.constraint() == Some(constraints::ACTORS_HANDLE) =>
        {
            Ok(false)
        }
        Err(e) => Err(e),
    }
}

/// Stores a client-encrypted key-backup blob — one row per account,
/// replacement overwrites (data-model.md `auth_key_backups`).
pub async fn upload_key_backup(
    pool: &PgPool,
    user_id: Uuid,
    blob: &[u8],
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO auth_key_backups (user_id, blob) VALUES ($1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET blob = EXCLUDED.blob, created_at = NOW()",
        user_id,
        blob,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Whether a blob is already stored — the difference between enabling
/// backup and destroying the previous one, which is what the
/// replacement notice hangs on (auth.md "Key recovery").
pub async fn has_key_backup(pool: &PgPool, user_id: Uuid) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT EXISTS(SELECT 1 FROM auth_key_backups WHERE user_id = $1) AS "exists!""#,
        user_id,
    )
    .fetch_one(pool)
    .await
}

/// Issues the upload challenge, replacing any live one — a client that
/// asks twice keeps only the newest.
pub async fn issue_key_backup_challenge(
    pool: &PgPool,
    user_id: Uuid,
    challenge: &[u8],
    expires_at: DateTime<Utc>,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO auth_key_backup_challenges (user_id, challenge, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id)
         DO UPDATE SET challenge = EXCLUDED.challenge, expires_at = EXCLUDED.expires_at",
        user_id,
        challenge,
        expires_at,
    )
    .execute(pool)
    .await?;
    Ok(())
}

/// Spends the challenge: true only if this exact one was live for the
/// account. The delete is the single-use guarantee, and doing it in one
/// statement is what keeps two concurrent uploads from both spending it.
pub async fn consume_key_backup_challenge(
    pool: &PgPool,
    user_id: Uuid,
    challenge: &[u8],
    now: DateTime<Utc>,
) -> Result<bool, sqlx::Error> {
    let spent = sqlx::query_scalar!(
        "DELETE FROM auth_key_backup_challenges
          WHERE user_id = $1 AND challenge = $2 AND expires_at > $3
          RETURNING user_id",
        user_id,
        challenge,
        now,
    )
    .fetch_optional(pool)
    .await?;
    Ok(spent.is_some())
}

pub async fn latest_key_backup(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Option<Vec<u8>>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT blob FROM auth_key_backups WHERE user_id = $1",
        user_id,
    )
    .fetch_optional(pool)
    .await
}

/// The identity association of one actor row. The key halves are None
/// for a user-kind actor between registration and the key ceremony's
/// attach (auth.md §Application); always present for the other kinds.
#[derive(Debug, Clone)]
pub struct ActorIdentity {
    pub id: Uuid,
    pub kind: String,
    pub handle: String,
    pub actor_pubkey: Option<Vec<u8>>,
    pub realization_address: Option<String>,
    /// When the account row was written — the authoring instant of the
    /// Profile this actor fronts, which precedes its landing.
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub async fn actor_identity(pool: &PgPool, id: Uuid) -> Result<Option<ActorIdentity>, sqlx::Error> {
    sqlx::query_as!(
        ActorIdentity,
        "SELECT id, kind, handle, actor_pubkey, realization_address, created_at FROM actors WHERE id = $1",
        id,
    )
    .fetch_optional(pool)
    .await
}

/// Handle lookup — one namespace across kinds, so a handle resolves to
/// exactly one actor (api-spec.md "Queries"). The caller normalizes
/// (handles are stored case-folded, auth.md "Handle and email format").
pub async fn actor_identity_by_handle(
    pool: &PgPool,
    handle: &str,
) -> Result<Option<ActorIdentity>, sqlx::Error> {
    sqlx::query_as!(
        ActorIdentity,
        "SELECT id, kind, handle, actor_pubkey, realization_address, created_at
         FROM actors WHERE handle = $1",
        handle,
    )
    .fetch_optional(pool)
    .await
}

/// The actor fronting an address atom — the mirror's author strings
/// resolve to accounts through this (None for system actors and
/// unknown addresses).
pub async fn actor_identity_by_address(
    pool: &PgPool,
    address: &str,
) -> Result<Option<ActorIdentity>, sqlx::Error> {
    sqlx::query_as!(
        ActorIdentity,
        "SELECT id, kind, handle, actor_pubkey, realization_address, created_at
         FROM actors WHERE realization_address = $1",
        address,
    )
    .fetch_optional(pool)
    .await
}

/// Every actor among `addresses`, in one round trip — the batched
/// twin of [`actor_identity_by_address`], for a read holding many
/// addresses at once (a page of mentions resolving their profiles).
/// An address nothing answers to is simply absent from the result.
pub async fn actor_identities_by_addresses(
    pool: &PgPool,
    addresses: &[String],
) -> Result<Vec<ActorIdentity>, sqlx::Error> {
    sqlx::query_as!(
        ActorIdentity,
        "SELECT id, kind, handle, actor_pubkey, realization_address, created_at
         FROM actors WHERE realization_address = ANY($1)",
        addresses,
    )
    .fetch_all(pool)
    .await
}

/// Every actor among `ids`, in one round trip — the batched twin of
/// [`actor_identity`], for a page resolving the authors of what it
/// serves. An id nothing answers to is simply absent from the result.
pub async fn actor_identities_by_ids(
    pool: &PgPool,
    ids: &[Uuid],
) -> Result<Vec<ActorIdentity>, sqlx::Error> {
    sqlx::query_as!(
        ActorIdentity,
        "SELECT id, kind, handle, actor_pubkey, realization_address, created_at
         FROM actors WHERE id = ANY($1)",
        ids,
    )
    .fetch_all(pool)
    .await
}

#[cfg(test)]
mod enum_tests {
    use super::{AccountState, RevokedReason};

    /// Both enums are stored as their own strings and decoded back by a
    /// second, independent list. A typo in either half is a decode that
    /// fails at runtime and nowhere earlier.
    ///
    /// Every account state decodes back to the variant that wrote it.
    /// ´claim:auth:an-account-state-round-trips-through-its-column´
    #[test]
    fn account_states_round_trip_through_their_column_form() {
        for state in [
            AccountState::Guest,
            AccountState::Applicant,
            AccountState::Member,
        ] {
            assert_eq!(AccountState::parse(state.as_str()), Some(state));
        }
        assert_eq!(AccountState::parse("Member"), None);
        assert_eq!(AccountState::parse(""), None);
    }

    /// Every revocation reason decodes back to the variant that wrote it.
    /// ´claim:auth:a-revocation-reason-round-trips-through-its-column´
    #[test]
    fn revoked_reasons_round_trip_through_their_column_form() {
        for reason in [
            RevokedReason::Rotated,
            RevokedReason::Owner,
            RevokedReason::Security,
        ] {
            assert_eq!(RevokedReason::parse(reason.as_str()), Some(reason));
        }
        assert_eq!(RevokedReason::parse("rotate"), None);
    }
}
