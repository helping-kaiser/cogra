//! ´mod:module:notifications´
//!
//! The notification list (notifications.md; data-model.md "Personal
//! frontend state"): per-viewer rows pointing at acts other actors made
//! that reached the viewer's content, profile or application, and the
//! seen pointer behind the bell.
//!
//! # Writers
//!
//! Every row is written by one of two kinds of writer, and every writer is
//! idempotent on `(user_id, dedup_key)` — one row per viewer and act:
//!
//! - **Record kinds** (COMMENT, REPLY, MENTION, CITATION, PROFILE_OPINION,
//!   PROFILE_OPINION_WITHDRAWN) are written by [`write_for_epoch`], inside the mirror's own
//!   ingestion transaction, so an epoch's rows commit with the epoch and
//!   advance with its cursor: a crash between epochs skips none, and a
//!   replay or a rebuild writes nothing twice.
//! - **Transition kinds** (APPLICATION_APPROVABLE, APPLICATION_APPROVED,
//!   INVITE_LANDED, APPLICATION_REJECTED) are written in the transition's
//!   own transaction by the store function that makes it.
//!
//! # One act, one row
//!
//! The unit is the act, not the record: a comment that also mentions the
//! viewer is a Review and a Reference, and reports once. A Reference that
//! rides a content act keys on that act — the minting act its citing
//! artifact names, when the reference declared it as a dependency — and
//! the higher kind wins: COMMENT/REPLY over CITATION over MENTION. The
//! winner is chosen inside an epoch and on conflict across epochs alike,
//! so the outcome never depends on which record landed first.
//!
//! # Revisions and withdrawals
//!
//! Every stance record toward a standing pair reports (PR-59): a revised
//! opinion or citation is a new act and a new row. A record that leaves
//! its author's bundle netted to `(0, 0)` is a withdrawal (PR-72). On the
//! viewer's profile it is addressed at the connection it walks back and
//! reports as PROFILE_OPINION_WITHDRAWN — once per bundle and epoch, on
//! the epoch's last record toward it, so a walk-back signed as several
//! counter-records landing together is one row. A netted citation of the
//! viewer's content writes nothing. Either way the earlier row stands
//! (notifications.md "Anti-notification rules"). A record whose own pair
//! is `(0, 0)` changes nothing and writes nothing.
//!
//! # Reads
//!
//! A hidden actor's rows stay out of both the list and the bell while the
//! actor is hidden (PR-11): the filter runs at read time, so an unhide
//! brings them back in place.

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

/// The ten addressed acts, as the `kind` column spells them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Kind {
    Comment,
    Reply,
    Mention,
    Citation,
    ProfileOpinion,
    ProfileOpinionWithdrawn,
    ApplicationApprovable,
    InviteLanded,
    ApplicationApproved,
    ApplicationRejected,
}

impl Kind {
    pub const ALL: [Kind; 10] = [
        Kind::Comment,
        Kind::Reply,
        Kind::Mention,
        Kind::Citation,
        Kind::ProfileOpinion,
        Kind::ProfileOpinionWithdrawn,
        Kind::ApplicationApprovable,
        Kind::InviteLanded,
        Kind::ApplicationApproved,
        Kind::ApplicationRejected,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Kind::Comment => "comment",
            Kind::Reply => "reply",
            Kind::Mention => "mention",
            Kind::Citation => "citation",
            Kind::ProfileOpinion => "profile_opinion",
            Kind::ProfileOpinionWithdrawn => "profile_opinion_withdrawn",
            Kind::ApplicationApprovable => "application_approvable",
            Kind::InviteLanded => "invite_landed",
            Kind::ApplicationApproved => "application_approved",
            Kind::ApplicationRejected => "application_rejected",
        }
    }

    pub fn parse(s: &str) -> Option<Kind> {
        Kind::ALL.into_iter().find(|k| k.as_str() == s)
    }
}

/// One notification row, as the list serves it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Notification {
    pub id: Uuid,
    pub user_id: Uuid,
    pub kind: String,
    pub actor_id: Uuid,
    pub subject_id: Option<Uuid>,
    pub context_id: Option<Uuid>,
    pub record_id: Option<String>,
    pub application_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub read_at: Option<DateTime<Utc>>,
}

impl Notification {
    pub fn cursor(&self) -> NotificationCursor {
        NotificationCursor {
            created_at: self.created_at,
            id: self.id,
        }
    }
}

/// A keyset position on the list: `(created_at, id)`, both descending.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NotificationCursor {
    pub created_at: DateTime<Utc>,
    pub id: Uuid,
}

/// Writes the record kinds for one ingested epoch — the rows its records
/// address. Runs inside the mirror's ingestion transaction, after the
/// epoch's records and legs are in, so a bundle's netted state reads
/// through this epoch. That state is the bundle's exact decimal sum
/// (`SUM(x::text::numeric)`, the sum `stance::ExactSums` documents), so a
/// walk-back the stance read calls severed is the walk-back reported
/// withdrawn here.
///
/// Addressees resolve through the L2 registries: a post's or comment's
/// author through its `l1_node_id`, a profile's account through its
/// realization address. Only user accounts are addressees; a record never
/// addresses its own author. A stance record carrying a payload is read
/// individually, never through its author's bundle (api-spec.md
/// `Record.payloadMarked`), so it is an act of another kind and reports
/// nothing here; neither does a leg with no census spec.
///
/// Rows of one epoch take the pass's statement time, offset by each
/// record's place in the authoritative order, so the list reads an
/// epoch newest first.
pub async fn write_for_epoch(conn: &mut PgConnection, epoch: i64) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query!(
        r#"WITH recs AS (
               SELECT r.record_id, r.family, r.author, r.payload_marked, a.id AS actor_id,
                      ROW_NUMBER() OVER (ORDER BY r.act_time, r.position) AS ord
               FROM mirror_records r
               JOIN actors a ON a.realization_address = r.author
               WHERE r.epoch = $1
           ),
           minting_reviews AS (
               SELECT recs.record_id, recs.actor_id, recs.ord,
                      la.target AS parent, lt.target AS terminal
               FROM recs
               JOIN mirror_record_legs la ON la.record_id = recs.record_id AND la.leg = 'a'
               JOIN mirror_record_legs lt ON lt.record_id = recs.record_id AND lt.leg = 't'
               WHERE recs.family = 'review'
                 AND lt.target = 'mint:' || recs.record_id
           ),
           standing_refs AS (
               SELECT recs.record_id, recs.actor_id, recs.ord,
                      la.target AS middle, lt.target AS cited,
                      COALESCE(
                          (SELECT 'act:' || g
                           FROM staged_writes s, unnest(s.deps) AS g
                           WHERE s.act_id = recs.record_id AND 'mint:' || g = la.target
                           LIMIT 1),
                          'act:' || recs.record_id) AS dedup_key
               FROM recs
               JOIN mirror_record_legs la ON la.record_id = recs.record_id AND la.leg = 'a'
               JOIN mirror_record_legs lt ON lt.record_id = recs.record_id AND lt.leg = 't'
               WHERE recs.family = 'reference'
                 AND NOT recs.payload_marked
                 AND NOT la.census_unknown AND NOT lt.census_unknown
                 AND NOT (la.p_d = 0 AND la.p_i = 0)
                 AND EXISTS (
                     SELECT 1
                     FROM mirror_record_legs b
                     JOIN mirror_records br ON br.record_id = b.record_id
                     WHERE b.leg = 't' AND b.family = 'reference'
                       AND b.source = la.target AND b.target = lt.target
                       AND br.author = recs.author
                       AND NOT br.payload_marked AND NOT b.census_unknown
                     HAVING SUM(b.p_d::text::numeric) <> 0 OR SUM(b.p_i::text::numeric) <> 0)
           ),
           standing_opinions AS (
               SELECT recs.record_id, recs.actor_id, recs.ord, lb.target AS profile
               FROM recs
               JOIN mirror_record_legs lb ON lb.record_id = recs.record_id AND lb.leg = 'binary'
               WHERE recs.family = 'opinion'
                 AND NOT recs.payload_marked
                 AND lb.target LIKE 'prof:%'
                 AND NOT lb.census_unknown
                 AND NOT (lb.p_d = 0 AND lb.p_i = 0)
                 AND EXISTS (
                     SELECT 1
                     FROM mirror_record_legs b
                     JOIN mirror_records br ON br.record_id = b.record_id
                     WHERE b.leg = 'binary' AND b.family = 'opinion'
                       AND b.source = lb.source AND b.target = lb.target
                       AND NOT br.payload_marked AND NOT b.census_unknown
                     HAVING SUM(b.p_d::text::numeric) <> 0 OR SUM(b.p_i::text::numeric) <> 0)
           ),
           withdrawn_opinions AS (
               SELECT DISTINCT ON (lb.source, lb.target)
                      recs.record_id, recs.actor_id, recs.ord, lb.target AS profile
               FROM recs
               JOIN mirror_record_legs lb ON lb.record_id = recs.record_id AND lb.leg = 'binary'
               WHERE recs.family = 'opinion'
                 AND NOT recs.payload_marked
                 AND lb.target LIKE 'prof:%'
                 AND NOT lb.census_unknown
                 AND NOT (lb.p_d = 0 AND lb.p_i = 0)
                 AND NOT EXISTS (
                     SELECT 1
                     FROM mirror_record_legs b
                     JOIN mirror_records br ON br.record_id = b.record_id
                     WHERE b.leg = 'binary' AND b.family = 'opinion'
                       AND b.source = lb.source AND b.target = lb.target
                       AND NOT br.payload_marked AND NOT b.census_unknown
                     HAVING SUM(b.p_d::text::numeric) <> 0 OR SUM(b.p_i::text::numeric) <> 0)
               ORDER BY lb.source, lb.target, recs.ord DESC
           ),
           candidates AS (
               SELECT p.author_id AS user_id, 'comment' AS kind, m.actor_id,
                      c.id AS subject_id, p.id AS context_id, m.record_id,
                      'act:' || m.record_id AS dedup_key, m.ord, 3 AS rank
               FROM minting_reviews m
               JOIN posts p ON p.l1_node_id = m.parent
               LEFT JOIN comments c ON c.l1_node_id = m.terminal
             UNION ALL
               SELECT pc.author_id, 'reply', m.actor_id, c.id, pc.id, m.record_id,
                      'act:' || m.record_id, m.ord, 3
               FROM minting_reviews m
               JOIN comments pc ON pc.l1_node_id = m.parent
               LEFT JOIN comments c ON c.l1_node_id = m.terminal
             UNION ALL
               SELECT a.id, 'mention', s.actor_id,
                      COALESCE(sp.id, sc.id), a.id, s.record_id, s.dedup_key, s.ord, 1
               FROM standing_refs s
               JOIN actors a ON s.cited LIKE 'prof:%'
                            AND a.realization_address = substr(s.cited, 6)
               LEFT JOIN posts sp ON sp.l1_node_id = s.middle
               LEFT JOIN comments sc ON sc.l1_node_id = s.middle
             UNION ALL
               SELECT p.author_id, 'citation', s.actor_id,
                      COALESCE(sp.id, sc.id), p.id, s.record_id, s.dedup_key, s.ord, 2
               FROM standing_refs s
               JOIN posts p ON p.l1_node_id = s.cited
               LEFT JOIN posts sp ON sp.l1_node_id = s.middle
               LEFT JOIN comments sc ON sc.l1_node_id = s.middle
             UNION ALL
               SELECT c.author_id, 'citation', s.actor_id,
                      COALESCE(sp.id, sc.id), c.id, s.record_id, s.dedup_key, s.ord, 2
               FROM standing_refs s
               JOIN comments c ON c.l1_node_id = s.cited
               LEFT JOIN posts sp ON sp.l1_node_id = s.middle
               LEFT JOIN comments sc ON sc.l1_node_id = s.middle
             UNION ALL
               SELECT a.id, 'profile_opinion', o.actor_id, o.actor_id, NULL::uuid,
                      o.record_id, 'act:' || o.record_id, o.ord, 0
               FROM standing_opinions o
               JOIN actors a ON a.realization_address = substr(o.profile, 6)
             UNION ALL
               SELECT a.id, 'profile_opinion_withdrawn', w.actor_id, w.actor_id, NULL::uuid,
                      w.record_id, 'act:' || w.record_id, w.ord, 0
               FROM withdrawn_opinions w
               JOIN actors a ON a.realization_address = substr(w.profile, 6)
           ),
           best AS (
               SELECT DISTINCT ON (cand.user_id, cand.dedup_key) cand.*
               FROM candidates cand
               JOIN actors addressee ON addressee.id = cand.user_id AND addressee.kind = 'user'
               WHERE cand.user_id <> cand.actor_id
               ORDER BY cand.user_id, cand.dedup_key, cand.rank DESC, cand.ord DESC
           )
           INSERT INTO user_notifications
               (user_id, kind, actor_id, subject_id, context_id, record_id, dedup_key, created_at)
           SELECT user_id, kind, actor_id, subject_id, context_id, record_id, dedup_key,
                  statement_timestamp() + ord * INTERVAL '1 microsecond'
           FROM best
           ON CONFLICT (user_id, dedup_key) DO UPDATE
               SET kind = EXCLUDED.kind,
                   subject_id = EXCLUDED.subject_id,
                   context_id = EXCLUDED.context_id,
                   record_id = EXCLUDED.record_id
               WHERE (CASE EXCLUDED.kind WHEN 'comment' THEN 3 WHEN 'reply' THEN 3
                                         WHEN 'citation' THEN 2 WHEN 'mention' THEN 1
                                         ELSE 0 END)
                   > (CASE user_notifications.kind WHEN 'comment' THEN 3 WHEN 'reply' THEN 3
                                                   WHEN 'citation' THEN 2 WHEN 'mention' THEN 1
                                                   ELSE 0 END)"#,
        epoch,
    )
    .execute(conn)
    .await?
    .rows_affected())
}

/// APPLICATION_APPROVABLE: the account's second approvability proof just
/// completed — call it from the transaction that set a proof, under the
/// account lock, and only when that proof was not already held. Writes
/// one row per waiting path, to that path's approver; a path whose
/// account is not yet approvable (this was the first proof) writes
/// nothing. A path staged later never gets one: its approver staged an
/// approvable account themselves.
pub async fn write_approvable(
    conn: &mut PgConnection,
    account_id: Uuid,
) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query!(
        "INSERT INTO user_notifications (user_id, kind, actor_id, application_id, dedup_key)
         SELECT ap.approver_id, 'application_approvable', ap.account_id, ap.id,
                'approvable:' || ap.id
         FROM auth_applications ap
         JOIN user_credentials c ON c.actor_id = ap.account_id
         JOIN actors a ON a.id = ap.account_id
         WHERE ap.account_id = $1
           AND c.account_state = 'applicant'
           AND c.email_verified_at IS NOT NULL
           AND a.actor_pubkey IS NOT NULL
           AND ap.approved_at IS NULL AND ap.rejected_at IS NULL AND ap.landed_at IS NULL
           AND ap.approver_id <> ap.account_id
           AND NOT EXISTS (SELECT 1 FROM auth_applications o
                           WHERE o.account_id = ap.account_id AND o.landed_at IS NOT NULL)
         ON CONFLICT (user_id, dedup_key) DO NOTHING",
        account_id,
    )
    .execute(conn)
    .await?
    .rows_affected())
}

/// APPLICATION_APPROVED: the signing is taken — the voucher's vouch
/// Opinion was relayed (ApprovePad.md "WHEN the signing is taken"). Call
/// it from the transaction that moves the staged write to `relaying`; a
/// write that is no recorded vouch writes nothing. Each vouch is its own
/// act and row, so a path re-vouched after a lapse reports again.
pub async fn write_approved(conn: &mut PgConnection, staged_id: Uuid) -> Result<u64, sqlx::Error> {
    Ok(sqlx::query!(
        "INSERT INTO user_notifications
             (user_id, kind, actor_id, subject_id, application_id, dedup_key)
         SELECT ap.account_id, 'application_approved', v.voucher_id, v.voucher_id, ap.id,
                'approved:' || v.act_id
         FROM staged_writes s
         JOIN auth_application_vouches v ON v.act_id = s.act_id
         JOIN auth_applications ap ON ap.id = v.application_id
         WHERE s.id = $1 AND ap.account_id <> v.voucher_id
         ON CONFLICT (user_id, dedup_key) DO NOTHING",
        staged_id,
    )
    .execute(conn)
    .await?
    .rows_affected())
}

/// INVITE_LANDED: the account landed through `application_id` on
/// `voucher_id`'s vouch — call it from the landing's transaction. Only
/// the approver whose vouch completed the landing gets the row (EC-R3);
/// the row's record is the account's admission Registration.
pub async fn write_landed(
    conn: &mut PgConnection,
    application_id: Uuid,
    voucher_id: Uuid,
    account_id: Uuid,
    registration_record: &str,
) -> Result<u64, sqlx::Error> {
    if voucher_id == account_id {
        return Ok(0);
    }
    Ok(sqlx::query!(
        "INSERT INTO user_notifications
             (user_id, kind, actor_id, subject_id, record_id, application_id, dedup_key)
         VALUES ($1, 'invite_landed', $2, $2, $3, $4, 'landed:' || $4::uuid)
         ON CONFLICT (user_id, dedup_key) DO NOTHING",
        voucher_id,
        account_id,
        registration_record,
        application_id,
    )
    .execute(conn)
    .await?
    .rows_affected())
}

/// APPLICATION_REJECTED: each closed application tells its applicant
/// that its approver closed it — call it from the closing transaction
/// with the rows it closed.
pub async fn write_rejected(
    conn: &mut PgConnection,
    application_ids: &[Uuid],
) -> Result<u64, sqlx::Error> {
    if application_ids.is_empty() {
        return Ok(0);
    }
    Ok(sqlx::query!(
        "INSERT INTO user_notifications (user_id, kind, actor_id, application_id, dedup_key)
         SELECT ap.account_id, 'application_rejected', ap.approver_id, ap.id,
                'rejected:' || ap.id
         FROM auth_applications ap
         WHERE ap.id = ANY($1) AND ap.rejected_at IS NOT NULL
           AND ap.account_id <> ap.approver_id
         ON CONFLICT (user_id, dedup_key) DO NOTHING",
        application_ids,
    )
    .execute(conn)
    .await?
    .rows_affected())
}

/// One page of `viewer`'s list, newest first, a hidden actor's rows left
/// out. Walking forward reads past `cursor` toward older rows; walking
/// backward reads toward newer ones and returns them in the same
/// newest-first order.
pub async fn list(
    pool: &PgPool,
    viewer: Uuid,
    cursor: Option<NotificationCursor>,
    backward: bool,
    limit: i64,
) -> Result<Vec<Notification>, sqlx::Error> {
    let (at, id) = match cursor {
        Some(c) => (Some(c.created_at), Some(c.id)),
        None => (None, None),
    };
    if backward {
        let mut rows = sqlx::query_as!(
            Notification,
            r#"SELECT n.id, n.user_id, n.kind, n.actor_id, n.subject_id, n.context_id,
                      n.record_id, n.application_id, n.created_at, n.read_at
               FROM user_notifications n
               WHERE n.user_id = $1
                 AND NOT EXISTS (SELECT 1 FROM user_hidden_actors h
                                 WHERE h.viewer_id = n.user_id AND h.hidden_id = n.actor_id)
                 AND ($2::timestamptz IS NULL OR (n.created_at, n.id) > ($2, $3::uuid))
               ORDER BY n.created_at ASC, n.id ASC
               LIMIT $4"#,
            viewer,
            at,
            id,
            limit,
        )
        .fetch_all(pool)
        .await?;
        rows.reverse();
        Ok(rows)
    } else {
        sqlx::query_as!(
            Notification,
            r#"SELECT n.id, n.user_id, n.kind, n.actor_id, n.subject_id, n.context_id,
                      n.record_id, n.application_id, n.created_at, n.read_at
               FROM user_notifications n
               WHERE n.user_id = $1
                 AND NOT EXISTS (SELECT 1 FROM user_hidden_actors h
                                 WHERE h.viewer_id = n.user_id AND h.hidden_id = n.actor_id)
                 AND ($2::timestamptz IS NULL OR (n.created_at, n.id) < ($2, $3::uuid))
               ORDER BY n.created_at DESC, n.id DESC
               LIMIT $4"#,
            viewer,
            at,
            id,
            limit,
        )
        .fetch_all(pool)
        .await
    }
}

/// How many rows the viewer's list serves, across every page.
pub async fn count(pool: &PgPool, viewer: Uuid) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT COUNT(*) AS "count!"
           FROM user_notifications n
           WHERE n.user_id = $1
             AND NOT EXISTS (SELECT 1 FROM user_hidden_actors h
                             WHERE h.viewer_id = n.user_id AND h.hidden_id = n.actor_id)"#,
        viewer,
    )
    .fetch_one(pool)
    .await
}

/// The bell's dot: whether a row the list serves arrived after the seen
/// pointer. A hidden actor's rows never light it.
pub async fn has_unread(pool: &PgPool, viewer: Uuid) -> Result<bool, sqlx::Error> {
    sqlx::query_scalar!(
        r#"SELECT EXISTS(
               SELECT 1 FROM user_notifications n
               WHERE n.user_id = $1
                 AND n.created_at > COALESCE(
                         (SELECT seen_at FROM user_notification_state WHERE user_id = $1),
                         '-infinity'::timestamptz)
                 AND NOT EXISTS (SELECT 1 FROM user_hidden_actors h
                                 WHERE h.viewer_id = n.user_id AND h.hidden_id = n.actor_id)
           ) AS "unread!""#,
        viewer,
    )
    .fetch_one(pool)
    .await
}

/// What moving the seen pointer did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeenOutcome {
    /// The pointer stands at `through` or later; the bell reads `unread`.
    Moved { unread: bool },
    /// `through` lies after every moment the list can hold: after now and
    /// after the viewer's newest row.
    InTheFuture,
}

/// Moves the viewer's seen pointer to `through`, never backwards. Row
/// read state is untouched. A moment after both now and the viewer's
/// newest row names nothing the list could have shown and is refused.
pub async fn mark_seen(
    pool: &PgPool,
    viewer: Uuid,
    through: DateTime<Utc>,
) -> Result<SeenOutcome, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let reachable = sqlx::query_scalar!(
        r#"SELECT $2::timestamptz <= GREATEST(
                      clock_timestamp(),
                      (SELECT MAX(created_at) FROM user_notifications WHERE user_id = $1))
               AS "reachable!""#,
        viewer,
        through,
    )
    .fetch_one(&mut *tx)
    .await?;
    if !reachable {
        return Ok(SeenOutcome::InTheFuture);
    }
    sqlx::query!(
        "INSERT INTO user_notification_state (user_id, seen_at) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE
             SET seen_at = GREATEST(user_notification_state.seen_at, EXCLUDED.seen_at)",
        viewer,
        through,
    )
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(SeenOutcome::Moved {
        unread: has_unread(pool, viewer).await?,
    })
}

/// The viewer's seen pointer; None before the list was ever opened.
pub async fn seen_at(pool: &PgPool, viewer: Uuid) -> Result<Option<DateTime<Utc>>, sqlx::Error> {
    sqlx::query_scalar!(
        "SELECT seen_at FROM user_notification_state WHERE user_id = $1",
        viewer,
    )
    .fetch_optional(pool)
    .await
}

/// Marks one of the viewer's rows read, keeping its first `read_at`.
/// None when the id is not one of the viewer's rows — unknown and foreign
/// alike.
pub async fn mark_read(
    pool: &PgPool,
    viewer: Uuid,
    id: Uuid,
) -> Result<Option<Notification>, sqlx::Error> {
    sqlx::query_as!(
        Notification,
        r#"UPDATE user_notifications
           SET read_at = COALESCE(read_at, NOW())
           WHERE id = $1 AND user_id = $2
           RETURNING id, user_id, kind, actor_id, subject_id, context_id,
                     record_id, application_id, created_at, read_at"#,
        id,
        viewer,
    )
    .fetch_optional(pool)
    .await
}

/// Every row addressed to `viewer`, hidden actors' included, newest
/// first — the unfiltered read tests and repair tools use.
pub async fn all_for(pool: &PgPool, viewer: Uuid) -> Result<Vec<Notification>, sqlx::Error> {
    sqlx::query_as!(
        Notification,
        r#"SELECT id, user_id, kind, actor_id, subject_id, context_id,
                  record_id, application_id, created_at, read_at
           FROM user_notifications
           WHERE user_id = $1
           ORDER BY created_at DESC, id DESC"#,
        viewer,
    )
    .fetch_all(pool)
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every kind round-trips through its column spelling, and nothing else parses.
    /// ´claim:notifications:a-kind-round-trips-through-its-column´
    #[test]
    fn every_kind_round_trips_through_its_column_spelling() {
        for kind in Kind::ALL {
            assert_eq!(Kind::parse(kind.as_str()), Some(kind));
        }
        assert_eq!(Kind::parse("like"), None);
        assert_eq!(Kind::parse(""), None);
    }
}
