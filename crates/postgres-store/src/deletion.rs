//! ´mod:module:deletion´
//!
//! The store half of an account deletion's execution (erasure.md §2, §5
//! step 4, §6; auth.md "Self-service deletion"): what runs once a
//! confirmed deletion's grace has passed. The executor in `api` drives it
//! in three motions, each resumable:
//!
//! 1. **The claim** ([`claim`]) — one transaction, the point of no
//!    return. Under the account lock it re-reads the deletion row, stamps
//!    `executed_at`, and forgets the identity association: the
//!    credentials are redacted in place, every session is revoked, and the
//!    mailed capabilities, key backups, device locks and carried acts are
//!    deleted. From its commit on the account cannot sign in, refresh, act
//!    or cancel, and its links answer `DELETION_TOKEN_INVALID`.
//! 2. **The redaction** — one transaction per act, the substrate's own
//!    rule (data-model.md "Redacting an act"): the executor reduces every
//!    Registration act ([`registration_acts`]) and blanks its profile
//!    rows ([`blank_profile_rows`]) in that act's transaction, and with
//!    the content sweep removes every post and comment chain
//!    ([`authored_content_nodes`]).
//! 3. **The close** ([`close`]) — one transaction under the account lock:
//!    the private per-user state goes, the profile gets its tombstone,
//!    and the handle takes its redacted form last.
//!
//! The redacted handle is the completion mark: it commits with the rest
//! of the close, so an executed row whose account still carries its own
//! handle is an execution that stopped part-way, and [`incomplete`]
//! hands it back for the executor to finish. Every step is idempotent,
//! so finishing is re-running.
//!
//! Nothing here touches the graph: the actor row, its key and address,
//! every record, every entity and version row stay.

use common::l1::census::Family;
use sqlx::{PgConnection, Postgres, Transaction};
use uuid::Uuid;

use crate::PgPool;
use crate::auth::{self, RevokedReason};
use crate::content::LandingOrder;
use crate::removal::{ACCOUNT_REMOVAL, ActRows};
use crate::retention;

type Timestamp = chrono::DateTime<chrono::Utc>;

/// The storage form of an executed account's handle (erasure.md "Handle
/// post-redaction"): unique by construction, and outside the handle
/// grammar, which has no `-`, so no registration can claim it.
pub fn redacted_handle(actor_id: Uuid) -> String {
    format!("redacted-user-{actor_id}")
}

/// An execution the executor holds: claimed now, or claimed earlier and
/// not yet closed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Execution {
    pub deletion_id: Uuid,
    pub user_id: Uuid,
    /// The account's realization address — None for an account that never
    /// attached a key, which has no act to redact.
    pub address: Option<String>,
    /// The content-level opt-in.
    pub include_content: bool,
    /// The claim's moment.
    pub executed_at: Timestamp,
}

/// The accounts whose confirmed deletion is due — oldest deadline first,
/// at most `limit`. A read only: [`claim`] decides under the lock.
pub async fn due(pool: &PgPool, limit: i64) -> Result<Vec<Uuid>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT user_id FROM auth_account_deletions
         WHERE confirmed_at IS NOT NULL AND cancelled_at IS NULL
           AND superseded_at IS NULL AND executed_at IS NULL
           AND scheduled_for <= NOW()
         ORDER BY scheduled_for
         LIMIT $1",
        limit,
    )
    .fetch_all(pool)
    .await
}

/// Executions that were claimed but never closed — an executor that
/// stopped between the claim and the close. Their accounts still carry
/// their own handle, which the close redacts last.
pub async fn incomplete(pool: &PgPool) -> Result<Vec<Execution>, sqlx::Error> {
    sqlx::query_as!(
        Execution,
        r#"SELECT d.id AS deletion_id, d.user_id, a.realization_address AS address,
                  d.include_content, d.executed_at AS "executed_at!"
           FROM auth_account_deletions d
           JOIN actors a ON a.id = d.user_id
           WHERE d.executed_at IS NOT NULL
             AND a.handle <> 'redacted-user-' || a.id::text
           ORDER BY d.executed_at"#,
    )
    .fetch_all(pool)
    .await
}

/// Claims the account's due deletion and forgets its identity
/// association, in one transaction. None when nothing is due any more —
/// a cancel committed first, or another executor claimed it.
///
/// The account lock comes first and the deletion row second, the order
/// `open_account_deletion` takes them in, so a request, a landing and a
/// claim never wait on each other in a cycle. A cancel locks only the
/// deletion row: one committed first leaves no due row here; one waiting
/// behind this claim re-reads the row once it commits, finds it executed,
/// and ends nothing.
///
/// The identity association goes here rather than at the close (erasure.md
/// §6 lists it with the tombstones): none of it is archived — the
/// credentials and the secrets are operational data, the carried acts are
/// deleted unarchived (ruling PR-21) — so the archive-first order is not
/// at stake, and from this commit on no sign-in, refresh or session can
/// act on the account while its redactions run.
pub async fn claim(pool: &PgPool, user_id: Uuid) -> Result<Option<Execution>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    if !auth::lock_account(&mut tx, user_id).await? {
        return Ok(None);
    }
    let Some(row) = sqlx::query!(
        "SELECT id, include_content FROM auth_account_deletions
         WHERE user_id = $1 AND confirmed_at IS NOT NULL AND cancelled_at IS NULL
           AND superseded_at IS NULL AND executed_at IS NULL
           AND scheduled_for <= NOW()
         FOR UPDATE",
        user_id,
    )
    .fetch_optional(&mut *tx)
    .await?
    else {
        return Ok(None);
    };
    let executed_at = sqlx::query_scalar!(
        "UPDATE auth_account_deletions SET executed_at = NOW() WHERE id = $1
         RETURNING executed_at AS \"executed_at!\"",
        row.id,
    )
    .fetch_one(&mut *tx)
    .await?;
    forget_identity(&mut tx, user_id).await?;
    let address = sqlx::query_scalar!(
        "SELECT realization_address FROM actors WHERE id = $1",
        user_id,
    )
    .fetch_one(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(Some(Execution {
        deletion_id: row.id,
        user_id,
        address,
        include_content: row.include_content,
        executed_at,
    }))
}

/// The identity association's forget, on the claim's transaction:
///
/// - the credentials row is redacted in place — address, password hash,
///   verification token and reuse stamp to NULL; the row stays, keyed by
///   the actor (data-model.md "User-scoped FKs are defense-in-depth");
/// - every live session is revoked as the owner's own act (auth.md
///   "Sessions"), so a replay reads benignly;
/// - the mailed capabilities still open — an email change, which carries
///   the new address, and a password reset — are deleted;
/// - the key backup and its challenge, and every device lock, are
///   deleted: what the account kept for the reader alone, which nobody
///   can authenticate to again (auth.md "Device lock": "Deleted with the
///   account");
/// - the acts carried with an application are deleted outright, whatever
///   the content opt-in says (ruling PR-21): author-only, never on Layer
///   1, and nobody to keep them for.
async fn forget_identity(conn: &mut PgConnection, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "UPDATE user_credentials
         SET email = NULL, password_hash = NULL,
             email_verification_token_hash = NULL, reuse_detected_at = NULL
         WHERE actor_id = $1",
        user_id,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!(
        "UPDATE auth_refresh_tokens SET revoked_at = NOW(), revoked_reason = $2
         WHERE user_id = $1 AND revoked_at IS NULL",
        user_id,
        RevokedReason::Owner.as_str(),
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!("DELETE FROM auth_email_changes WHERE user_id = $1", user_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query!("DELETE FROM auth_password_resets WHERE user_id = $1", user_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query!("DELETE FROM auth_key_backups WHERE user_id = $1", user_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query!(
        "DELETE FROM auth_key_backup_challenges WHERE user_id = $1",
        user_id,
    )
    .execute(&mut *conn)
    .await?;
    sqlx::query!("DELETE FROM auth_device_locks WHERE user_id = $1", user_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query!(
        "DELETE FROM staged_writes WHERE actor_id = $1 AND state = 'carried'",
        user_id,
    )
    .execute(&mut *conn)
    .await?;
    Ok(())
}

/// One Registration act of the account: its identifier and the profile
/// rows it owns.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegistrationAct {
    pub act_id: String,
    pub rows: ActRows,
}

/// Every Registration act of the account — the admission Registration and
/// every profile update, landed (off the mirror, by the address) and in
/// flight (off its staged writes) — oldest first. These are the
/// Registration bundle the identity level reduces (erasure.md §2).
pub async fn registration_acts(
    pool: &PgPool,
    user_id: Uuid,
    address: &str,
) -> Result<Vec<RegistrationAct>, sqlx::Error> {
    let family = Family::Registration.as_str();
    let landed = sqlx::query!(
        "SELECT record_id, epoch, act_time, position FROM mirror_records
         WHERE author = $1 AND family = $2
         ORDER BY epoch, act_time, position",
        address,
        family,
    )
    .fetch_all(pool)
    .await?;
    let staged = sqlx::query!(
        "SELECT act_id, pre_signed_at FROM staged_writes
         WHERE actor_id = $1 AND family = $2 AND state <> 'carried'
         ORDER BY seq",
        user_id,
        family,
    )
    .fetch_all(pool)
    .await?;
    let mut acts: Vec<RegistrationAct> = landed
        .into_iter()
        .map(|r| RegistrationAct {
            act_id: r.record_id,
            rows: ActRows {
                order: Some(LandingOrder {
                    landed_epoch: r.epoch,
                    act_time: r.act_time,
                    position: r.position,
                }),
                instant: None,
            },
        })
        .collect();
    for s in staged {
        match acts.iter_mut().find(|a| a.act_id == s.act_id) {
            Some(known) => known.rows.instant = s.pre_signed_at,
            None => acts.push(RegistrationAct {
                act_id: s.act_id,
                rows: ActRows {
                    order: None,
                    instant: s.pre_signed_at,
                },
            }),
        }
    }
    Ok(acts)
}

/// One content node the account authored a record on: the family of its
/// chain and the node's own identifier.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthoredNode {
    pub family: String,
    pub node: String,
}

/// Every node the account wrote a chain of `families` on — landed records
/// by their own leg's target, staged writes by theirs, carried ones left
/// out — each once. The content sweep removes the account's own chain on
/// each (erasure.md §2 "Content-level").
pub async fn authored_content_nodes(
    pool: &PgPool,
    user_id: Uuid,
    address: &str,
    families: &[Family],
) -> Result<Vec<AuthoredNode>, sqlx::Error> {
    let families: Vec<String> = families.iter().map(|f| f.as_str().to_string()).collect();
    sqlx::query_as!(
        AuthoredNode,
        r#"SELECT family AS "family!", node AS "node!" FROM (
               SELECT r.family, l.target AS node
               FROM mirror_records r
               JOIN mirror_record_legs l ON l.record_id = r.record_id
               WHERE r.author = $1 AND r.family = ANY($3) AND l.leg IN ('binary', 't')
               UNION
               SELECT family, target AS node FROM staged_writes
               WHERE actor_id = $2 AND family = ANY($3) AND state <> 'carried'
           ) authored
           ORDER BY family, node"#,
        address,
        user_id,
        &families,
    )
    .fetch_all(pool)
    .await
}

/// Blanks the profile rows one Registration act owns, on that act's
/// redaction transaction — display name emptied, bio, avatar and website
/// cleared, the reason set (data-model.md "Display-content versioning").
/// The rows stay, with their coordinates and their pending mark, so an
/// update landing later lands onto a row that shows nothing. Returns the
/// rows blanked; a blanked row is not touched again.
pub async fn blank_profile_rows(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    act: &ActRows,
) -> Result<u64, sqlx::Error> {
    if act.is_empty() {
        return Ok(0);
    }
    let order = act.order;
    Ok(sqlx::query!(
        "UPDATE actor_profile_versions
         SET display_name = '', bio = NULL, avatar_id = NULL, website_url = NULL,
             redaction_reason = $2
         WHERE actor_id = $1 AND redaction_reason IS NULL
           AND ((landed_epoch = $3 AND act_time = $4 AND position = $5)
                OR created_at = $6)",
        actor_id,
        ACCOUNT_REMOVAL,
        order.map(|o| o.landed_epoch),
        order.map(|o| o.act_time),
        order.map(|o| o.position),
        act.instant,
    )
    .execute(&mut **tx)
    .await?
    .rows_affected())
}

/// What a close did.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Closed {
    /// The close found the execution already closed and wrote nothing.
    pub already: bool,
    /// The profile tombstone this close appended.
    pub tombstoned: bool,
    /// The avatars the close's blanking left with no live placement, held
    /// on its transaction; the executor moves their bytes after commit.
    pub held_media: Vec<Uuid>,
}

/// Closes an execution, in one transaction under the account lock:
///
/// 1. the private per-user state is deleted outright — the seen-list,
///    bookmarks, the account's own hide list, chat read pointers and
///    preferences (erasure.md §2; layers.md §4's carve-outs; ruling
///    ER-G13 for the seen-list). **Not** the account's own notification
///    list (`user_notifications`, `user_notification_state`): whether it
///    goes is open with jakob, and its delete belongs here, beside these;
/// 2. any profile row still unblanked — the registration seed, which
///    carries the handle and which no act owns — is blanked, and the
///    avatars it named are held when no live placement is left;
/// 3. the profile tombstone is appended unless this execution already
///    wrote it: one row, the reason set, `created_at` the close's own
///    instant (the mark's moment), the current landed version's
///    coordinates copied — the removal engine's head rule;
/// 4. the handle takes its redacted form — last, the completion mark.
///
/// Idempotent: a second close finds the handle redacted and writes
/// nothing.
pub async fn close(pool: &PgPool, execution: &Execution) -> Result<Closed, sqlx::Error> {
    let user_id = execution.user_id;
    let mut tx = pool.begin().await?;
    auth::lock_account(&mut tx, user_id).await?;
    let handle = sqlx::query_scalar!("SELECT handle FROM actors WHERE id = $1 FOR UPDATE", user_id)
        .fetch_one(&mut *tx)
        .await?;
    if handle == redacted_handle(user_id) {
        return Ok(Closed {
            already: true,
            ..Closed::default()
        });
    }
    delete_private_state(&mut tx, user_id).await?;
    let avatars = sqlx::query_scalar!(
        r#"WITH open_rows AS (
               SELECT version_id, avatar_id FROM actor_profile_versions
               WHERE actor_id = $1 AND redaction_reason IS NULL
               FOR UPDATE
           )
           UPDATE actor_profile_versions v
           SET display_name = '', bio = NULL, avatar_id = NULL, website_url = NULL,
               redaction_reason = $2
           FROM open_rows o
           WHERE v.version_id = o.version_id
           RETURNING o.avatar_id"#,
        user_id,
        ACCOUNT_REMOVAL,
    )
    .fetch_all(&mut *tx)
    .await?;
    let avatars: Vec<Uuid> = avatars.into_iter().flatten().collect();
    let tombstoned = append_profile_tombstone(&mut tx, user_id, execution.executed_at).await?;
    sqlx::query!(
        "UPDATE actors SET handle = $2 WHERE id = $1",
        user_id,
        redacted_handle(user_id),
    )
    .execute(&mut *tx)
    .await?;
    let held_media = retention::hold_unplaced(&mut tx, &avatars).await?;
    tx.commit().await?;
    Ok(Closed {
        already: false,
        tombstoned,
        held_media,
    })
}

/// The private per-user state an executed account loses outright — rows
/// that feed only its own frontend and carry no graph structure. Other
/// readers' rows naming the account stay: their hides of it, their
/// bookmarks of it, their notifications about it (data-model.md
/// "User-scoped FKs are defense-in-depth").
async fn delete_private_state(conn: &mut PgConnection, user_id: Uuid) -> Result<(), sqlx::Error> {
    sqlx::query!("DELETE FROM user_view_log WHERE user_id = $1", user_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query!("DELETE FROM user_bookmarks WHERE user_id = $1", user_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query!("DELETE FROM user_hidden_actors WHERE viewer_id = $1", user_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query!("DELETE FROM chat_read_state WHERE user_id = $1", user_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query!("DELETE FROM user_preferences WHERE user_id = $1", user_id)
        .execute(&mut *conn)
        .await?;
    Ok(())
}

/// Appends the profile tombstone unless this execution wrote it already —
/// a row carrying the account-deletion reason authored at or after the
/// claim, which no blanked row can be: each keeps the instant it was
/// authored at, and nothing is authored for the account after the claim.
async fn append_profile_tombstone(
    conn: &mut PgConnection,
    user_id: Uuid,
    executed_at: Timestamp,
) -> Result<bool, sqlx::Error> {
    let written = sqlx::query_scalar!(
        r#"SELECT EXISTS(
               SELECT 1 FROM actor_profile_versions
               WHERE actor_id = $1 AND redaction_reason = $2 AND NOT pending
                 AND created_at >= $3
           ) AS "exists!""#,
        user_id,
        ACCOUNT_REMOVAL,
        executed_at,
    )
    .fetch_one(&mut *conn)
    .await?;
    if written {
        return Ok(false);
    }
    let head = sqlx::query!(
        "SELECT landed_epoch, act_time, position FROM actor_profile_versions
         WHERE actor_id = $1 AND NOT pending
         ORDER BY landed_epoch DESC NULLS LAST, act_time DESC NULLS LAST,
                  position DESC NULLS LAST, created_at DESC, version_id DESC
         LIMIT 1",
        user_id,
    )
    .fetch_optional(&mut *conn)
    .await?;
    let (epoch, act_time, position) = match head {
        Some(h) => (h.landed_epoch, h.act_time, h.position),
        None => (None, None, None),
    };
    sqlx::query!(
        "INSERT INTO actor_profile_versions
             (actor_id, display_name, redaction_reason, landed_epoch, act_time, position)
         VALUES ($1, '', $2, $3, $4, $5)",
        user_id,
        ACCOUNT_REMOVAL,
        epoch,
        act_time,
        position,
    )
    .execute(&mut *conn)
    .await?;
    Ok(true)
}
