//! ´mod:module:staged´
//!
//! Staged writes (data-model.md "Staged writes"): the L2 row a write
//! occupies from prepare until confirm — the canonical proposal, joined by
//! the pre-commitment and the host-sealed verified act as the handshake
//! advances (architecture.md "The write path").
//!
//! Staged state is operational: exempt from append-only history, cleared
//! and reaped when a write never lands.

use common::l1::census::Family;
use common::l1::handshake::{PreSignedProposal, Proposal, StructuralBody, VerifiedAct};
use common::l1::identifier::{ActId, NodeId};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum StagedError {
    #[error("staged write {0} not found")]
    NotFound(Uuid),
    #[error("staged write {id} is {actual}, not {expected}")]
    WrongState {
        id: Uuid,
        expected: String,
        actual: String,
    },
    /// A stored row no longer parses into seam types — operationally
    /// impossible unless the row was edited out-of-band.
    #[error("staged write {0} is corrupt: {1}")]
    Corrupt(Uuid, String),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

impl From<crate::content::ContentError> for StagedError {
    fn from(e: crate::content::ContentError) -> Self {
        match e {
            crate::content::ContentError::Storage(e) => Self::Storage(e),
        }
    }
}

/// Handshake progress, states per api-spec.md "The write flow".
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StagedState {
    AwaitingPreSign,
    Sealing,
    AwaitingApproval,
    Relaying,
    Landed,
    Expired,
}

impl StagedState {
    pub fn as_str(self) -> &'static str {
        match self {
            StagedState::AwaitingPreSign => "awaiting_pre_sign",
            StagedState::Sealing => "sealing",
            StagedState::AwaitingApproval => "awaiting_approval",
            StagedState::Relaying => "relaying",
            StagedState::Landed => "landed",
            StagedState::Expired => "expired",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "awaiting_pre_sign" => StagedState::AwaitingPreSign,
            "sealing" => StagedState::Sealing,
            "awaiting_approval" => StagedState::AwaitingApproval,
            "relaying" => StagedState::Relaying,
            "landed" => StagedState::Landed,
            "expired" => StagedState::Expired,
            _ => return None,
        })
    }
}

/// One staged write, reconstructed into seam types. The staging actor is
/// one actor row for every writer — an applicant's staged Registration
/// stages under their own account's actor row (auth.md §Application).
#[derive(Debug, Clone)]
pub struct StagedWrite {
    pub id: Uuid,
    pub actor_id: Uuid,
    pub state: StagedState,
    pub proposal: Proposal,
    pub prepared_epoch: i64,
    /// The L2 node the payload envelope carries, for a write that mints
    /// or edits one — the display rows this write owns while pending.
    pub node_id: Option<Uuid>,
    /// The authoring instant: when the device's pre-commitment was
    /// recorded, which is what the content dates from (substrate.md §6).
    pub pre_signed_at: Option<chrono::DateTime<chrono::Utc>>,
    /// The pre-commitment leg, present from pre-sign submission on.
    pub pre_signed: Option<PreSignedParts>,
    /// The host additions, present from the seal on.
    pub sealed: Option<SealedParts>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PreSignedParts {
    pub author_pubkey: Vec<u8>,
    pub nonce: Vec<u8>,
    pub pre_signature: Vec<u8>,
}

#[derive(Debug, Clone)]
pub struct SealedParts {
    pub content_salt: Vec<u8>,
    pub deps_salt: Vec<u8>,
    pub content_commitment: Vec<u8>,
    pub deps_commitment: Vec<u8>,
    pub host_seal: Vec<u8>,
}

impl StagedWrite {
    /// The pre-signed proposal as submitted to the seal leg.
    pub fn pre_signed_proposal(&self) -> Option<PreSignedProposal> {
        let p = self.pre_signed.as_ref()?;
        Some(PreSignedProposal {
            proposal: self.proposal.clone(),
            author_pubkey: p.author_pubkey.clone(),
            nonce: p.nonce.clone(),
            pre_signature: p.pre_signature.clone(),
        })
    }

    /// The host-sealed verified act, once the seal has returned.
    pub fn verified_act(&self) -> Option<VerifiedAct> {
        let p = self.pre_signed.as_ref()?;
        let s = self.sealed.as_ref()?;
        Some(VerifiedAct {
            proposal: self.proposal.clone(),
            author_pubkey: p.author_pubkey.clone(),
            nonce: p.nonce.clone(),
            pre_signature: p.pre_signature.clone(),
            content_salt: s.content_salt.clone(),
            deps_salt: s.deps_salt.clone(),
            content_commitment: s.content_commitment.clone(),
            deps_commitment: s.deps_commitment.clone(),
            host_seal: s.host_seal.clone(),
        })
    }
}

/// Allocates the author's next act sequence value s_q — actor-chosen,
/// unique, and fixed before submission (layer1-interface.md §8.1). The
/// counter row is created at zero on first use and caught
/// up against the mirror on every allocation, so acts landed outside the
/// prepare path (bootstrap repair, the dev CLI) can never cause identifier
/// reuse. Runs on a connection so prepare composes it with the staged
/// insert in one transaction.
///
/// The catch-up reads the sequence out of the record identifier, which is
/// L1's own string stored verbatim: `act:<author>:<seq>:<family>`, whose
/// third field is the sequence (`common::l1::identifier::ActId`). The
/// digits test is not decoration. An unqualified `::BIGINT` raises on the
/// first row whose third field is not a number, and the raise is not
/// scoped to that row — it fails the allocation, and with it every
/// prepare this author attempts, for as long as the row is in the mirror.
/// A row that is not an act identifier carries no sequence to catch up
/// to, so skipping it is also the right answer; `tests/staged.rs` pins
/// the decomposition against the Rust parser it mirrors.
pub async fn allocate_seq(conn: &mut PgConnection, author: &str) -> Result<i64, StagedError> {
    sqlx::query!(
        "INSERT INTO author_seq_counters (author, next_seq) VALUES ($1, 0)
         ON CONFLICT (author) DO NOTHING",
        author,
    )
    .execute(&mut *conn)
    .await?;
    Ok(sqlx::query_scalar!(
        r#"UPDATE author_seq_counters
           SET next_seq = GREATEST(
                   next_seq,
                   (SELECT COALESCE(MAX(split_part(record_id, ':', 3)::BIGINT) + 1, 0)
                    FROM mirror_records
                    WHERE author = $1
                      AND split_part(record_id, ':', 3) ~ '^[0-9]{1,18}$')
               ) + 1
           WHERE author = $1
           RETURNING next_seq - 1 AS "seq!""#,
        author,
    )
    .fetch_one(&mut *conn)
    .await?)
}

/// Inserts a freshly prepared staged write in `awaiting_pre_sign`. Runs on
/// a connection so prepare composes it with `allocate_seq` in one
/// transaction.
pub async fn insert(
    conn: &mut PgConnection,
    id: Uuid,
    actor_id: Uuid,
    proposal: &Proposal,
    prepared_epoch: i64,
    node_id: Option<Uuid>,
) -> Result<(), StagedError> {
    let body = &proposal.body;
    let seq = i64::try_from(body.seq)
        .map_err(|_| StagedError::Corrupt(id, "seq exceeds the storable range".into()))?;
    let parents: Vec<String> = body.asserted_parents.iter().map(ActId::to_string).collect();
    let deps: Vec<String> = proposal.deps.iter().map(ActId::to_string).collect();
    sqlx::query!(
        "INSERT INTO staged_writes
             (id, actor_id, act_id, author, seq, family,
              middle, target, p_d, p_i, settlement_ref, license,
              asserted_parents, deps, payload, prepared_epoch, node_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, $15, $16, $17)",
        id,
        actor_id,
        body.act_id().to_string(),
        body.author,
        seq,
        body.family.as_str(),
        body.middle.as_ref().map(NodeId::to_string),
        body.target.to_string(),
        body.p_d,
        body.p_i,
        body.settlement_ref.as_ref().map(ActId::to_string),
        body.license.as_deref(),
        &parents,
        &deps,
        &proposal.payload,
        prepared_epoch,
        node_id,
    )
    .execute(conn)
    .await?;
    Ok(())
}

/// Loads one staged write, reconstructed into seam types.
pub async fn load(pool: &PgPool, id: Uuid) -> Result<StagedWrite, StagedError> {
    let row = sqlx::query!(
        "SELECT id, actor_id, author, seq, family, middle,
                target, p_d, p_i, settlement_ref, license, asserted_parents,
                deps, payload, state, author_pubkey, nonce, pre_signature,
                content_salt, deps_salt, content_commitment, deps_commitment,
                host_seal, prepared_epoch, node_id, pre_signed_at
         FROM staged_writes WHERE id = $1",
        id,
    )
    .fetch_optional(pool)
    .await?
    .ok_or(StagedError::NotFound(id))?;

    let corrupt = |what: &str| StagedError::Corrupt(id, what.to_string());
    let family = Family::parse(&row.family).ok_or_else(|| corrupt("family"))?;
    let middle = row
        .middle
        .as_deref()
        .map(NodeId::parse)
        .transpose()
        .map_err(|e| StagedError::Corrupt(id, e.to_string()))?;
    let target = NodeId::parse(&row.target).map_err(|e| StagedError::Corrupt(id, e.to_string()))?;
    let parse_ids = |ids: &[String]| -> Result<Vec<ActId>, StagedError> {
        ids.iter()
            .map(|s| ActId::parse(s).map_err(|e| StagedError::Corrupt(id, e.to_string())))
            .collect()
    };
    let proposal = Proposal {
        body: StructuralBody {
            author: row.author,
            seq: u64::try_from(row.seq).map_err(|_| corrupt("seq"))?,
            family,
            middle,
            target,
            p_d: row.p_d,
            p_i: row.p_i,
            settlement_ref: row
                .settlement_ref
                .as_deref()
                .map(ActId::parse)
                .transpose()
                .map_err(|e| StagedError::Corrupt(id, e.to_string()))?,
            license: row.license,
            asserted_parents: parse_ids(&row.asserted_parents)?,
        },
        payload: row.payload,
        deps: parse_ids(&row.deps)?,
    };
    let pre_signed = match (row.author_pubkey, row.nonce, row.pre_signature) {
        (Some(author_pubkey), Some(nonce), Some(pre_signature)) => Some(PreSignedParts {
            author_pubkey,
            nonce,
            pre_signature,
        }),
        (None, None, None) => None,
        _ => return Err(corrupt("pre-commitment leg")),
    };
    let sealed = match (
        row.content_salt,
        row.deps_salt,
        row.content_commitment,
        row.deps_commitment,
        row.host_seal,
    ) {
        (
            Some(content_salt),
            Some(deps_salt),
            Some(content_commitment),
            Some(deps_commitment),
            Some(host_seal),
        ) => Some(SealedParts {
            content_salt,
            deps_salt,
            content_commitment,
            deps_commitment,
            host_seal,
        }),
        (None, None, None, None, None) => None,
        _ => return Err(corrupt("seal leg")),
    };
    Ok(StagedWrite {
        id: row.id,
        actor_id: row.actor_id,
        state: StagedState::parse(&row.state).ok_or_else(|| corrupt("state"))?,
        proposal,
        prepared_epoch: row.prepared_epoch,
        node_id: row.node_id,
        pre_signed_at: row.pre_signed_at,
        pre_signed,
        sealed,
    })
}

/// Whether the actor has a live staged write of the family toward the
/// target — the in-flight half of a graph-derived read (auth.md
/// "Reciprocation is the joiner's own act"). Expired stagings are
/// ignored; a landed one is fine — its record is in the mirror anyway.
pub async fn has_live_targeting(
    pool: &PgPool,
    actor_id: Uuid,
    family: Family,
    target: &str,
) -> Result<bool, StagedError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT EXISTS(
               SELECT 1 FROM staged_writes
               WHERE actor_id = $1 AND family = $2 AND target = $3
                 AND state <> 'expired'
           ) AS "exists!""#,
        actor_id,
        family.as_str(),
        target,
    )
    .fetch_one(pool)
    .await?)
}

/// Whether the actor has an unlanded, unexpired staged write of the
/// family toward the target — the edit-serialization guard (post.md §4:
/// the backend serializes edits per (node, author)). Unlike
/// `has_live_targeting`, a landed row does not count: its record is in
/// the mirror and the next edit chains behind it.
pub async fn has_pending_targeting(
    pool: &PgPool,
    actor_id: Uuid,
    family: Family,
    target: &str,
) -> Result<bool, StagedError> {
    Ok(sqlx::query_scalar!(
        r#"SELECT EXISTS(
               SELECT 1 FROM staged_writes
               WHERE actor_id = $1 AND family = $2 AND target = $3
                 AND state NOT IN ('expired', 'landed')
           ) AS "exists!""#,
        actor_id,
        family.as_str(),
        target,
    )
    .fetch_one(pool)
    .await?)
}

/// An actor's staged writes, newest first (api-spec `User.stagedWrites`).
/// Loads one by one — N+1 by choice: an actor holds a handful of live
/// stagings at slice-1 scale, and `load` owns the row-to-seam parse.
pub async fn list_for_actor(
    pool: &PgPool,
    actor_id: Uuid,
) -> Result<Vec<StagedWrite>, StagedError> {
    let ids = sqlx::query_scalar!(
        "SELECT id FROM staged_writes WHERE actor_id = $1 ORDER BY created_at DESC",
        actor_id,
    )
    .fetch_all(pool)
    .await?;
    let mut writes = Vec::with_capacity(ids.len());
    for id in ids {
        writes.push(load(pool, id).await?);
    }
    Ok(writes)
}

/// The refusal a state-guarded write owes when it matched no row.
///
/// A miss has exactly two causes and they are different answers: the row
/// is gone, or the row is somewhere else in the handshake. Every guarded
/// write in this module re-reads the state to tell them apart, and each
/// one that wrote that block out longhand was a chance to answer the
/// second with the first.
async fn missed_transition(pool: &PgPool, id: Uuid, expected: &str) -> StagedError {
    match sqlx::query_scalar!("SELECT state FROM staged_writes WHERE id = $1", id)
        .fetch_optional(pool)
        .await
    {
        Ok(Some(actual)) => StagedError::WrongState {
            id,
            expected: expected.to_string(),
            actual,
        },
        Ok(None) => StagedError::NotFound(id),
        Err(e) => StagedError::Storage(e),
    }
}

/// Guarded state transition: `from` → `to`, failing with the actual state
/// when the row is elsewhere in the handshake.
async fn transition(
    pool: &PgPool,
    id: Uuid,
    from: &[StagedState],
    to: StagedState,
) -> Result<(), StagedError> {
    let from_strs: Vec<&str> = from.iter().map(|s| s.as_str()).collect();
    let updated = sqlx::query!(
        "UPDATE staged_writes SET state = $2, updated_at = NOW()
         WHERE id = $1 AND state = ANY($3)",
        id,
        to.as_str(),
        &from_strs as &[&str],
    )
    .execute(pool)
    .await?
    .rows_affected();
    if updated == 1 {
        return Ok(());
    }
    Err(missed_transition(pool, id, &from_strs.join(" or ")).await)
}

/// Stores the device's pre-commitment leg and moves the write into
/// `sealing`, returning the authoring instant the content dates from.
/// Accepts a retry from `sealing` (a relay that died between recording
/// and sealing) — `pre_signed_at` is set only the first time, so a retry
/// gets back the same instant rather than moving it.
pub async fn record_pre_signed(
    pool: &PgPool,
    id: Uuid,
    pre: &PreSignedParts,
) -> Result<chrono::DateTime<chrono::Utc>, StagedError> {
    let recorded = sqlx::query_scalar!(
        "UPDATE staged_writes
         SET state = 'sealing', author_pubkey = $2, nonce = $3,
             pre_signature = $4, pre_signed_at = COALESCE(pre_signed_at, NOW()),
             updated_at = NOW()
         WHERE id = $1 AND state IN ('awaiting_pre_sign', 'sealing')
         RETURNING pre_signed_at",
        id,
        &pre.author_pubkey,
        &pre.nonce,
        &pre.pre_signature,
    )
    .fetch_optional(pool)
    .await?;
    match recorded {
        Some(Some(at)) => Ok(at),
        Some(None) => Err(StagedError::Corrupt(
            id,
            "pre-commitment recorded without an authoring instant".into(),
        )),
        None => Err(missed_transition(pool, id, "awaiting_pre_sign or sealing").await),
    }
}

/// Stores the host additions of the sealed verified act and moves the
/// write into `awaiting_approval`.
pub async fn record_sealed(pool: &PgPool, id: Uuid, act: &VerifiedAct) -> Result<(), StagedError> {
    let updated = sqlx::query!(
        "UPDATE staged_writes
         SET state = 'awaiting_approval', content_salt = $2, deps_salt = $3,
             content_commitment = $4, deps_commitment = $5, host_seal = $6,
             updated_at = NOW()
         WHERE id = $1 AND state = 'sealing'",
        id,
        &act.content_salt,
        &act.deps_salt,
        &act.content_commitment,
        &act.deps_commitment,
        &act.host_seal,
    )
    .execute(pool)
    .await?
    .rows_affected();
    if updated == 1 {
        return Ok(());
    }
    Err(missed_transition(pool, id, StagedState::Sealing.as_str()).await)
}

/// Returns a failed seal to `awaiting_pre_sign` so the device can retry,
/// taking the write's pending display rows with it in the same
/// transaction. The rows were staged against a pre-commitment the
/// substrate refused, so nothing was ever the author's content; leaving
/// them readable would publish a write that failed to seal. A retry of
/// the leg re-stages them — `stage_pending` is idempotent.
pub async fn revert_to_pre_sign(pool: &PgPool, id: Uuid) -> Result<(), StagedError> {
    let mut tx = pool.begin().await?;
    let reverted = sqlx::query_as!(
        StagedRows,
        "UPDATE staged_writes
         SET state = 'awaiting_pre_sign', updated_at = NOW()
         WHERE id = $1 AND state = 'sealing'
         RETURNING node_id, pre_signed_at",
        id,
    )
    .fetch_optional(&mut *tx)
    .await?;
    let Some(staged_rows) = reverted else {
        return Err(missed_transition(pool, id, StagedState::Sealing.as_str()).await);
    };
    discard_pending_content(&mut tx, std::iter::once(staged_rows)).await?;
    tx.commit().await?;
    Ok(())
}

/// Marks the approval relayed: `awaiting_approval` → `relaying`. Accepts a
/// retry from `relaying` (the substrate's approve is idempotent).
pub async fn record_relaying(pool: &PgPool, id: Uuid) -> Result<(), StagedError> {
    transition(
        pool,
        id,
        &[StagedState::AwaitingApproval, StagedState::Relaying],
        StagedState::Relaying,
    )
    .await
}

/// One staged write promoted by an ingested epoch — the confirm hook for
/// the flows built on top (landing an applicant, promoting display rows).
#[derive(Debug, Clone)]
pub struct PromotedWrite {
    pub id: Uuid,
    pub actor_id: Uuid,
    pub act_id: String,
    pub family: String,
}

/// Confirm: marks every staged write whose record landed in `epoch` as
/// `landed`, returning the promoted rows. Matching is by the act
/// identifier — a record landing after its staged write expired still
/// promotes, display rows and all (the mirror governs; late landing
/// wins). The payload it needs is still on the expired row: expiry stops
/// serving the content, the reap is what destroys it. Past the reap
/// there is no row to match and the record stays unpromoted.
pub async fn promote_landed(pool: &PgPool, epoch: i64) -> Result<Vec<PromotedWrite>, StagedError> {
    let rows = sqlx::query!(
        "UPDATE staged_writes
         SET state = 'landed', updated_at = NOW()
         WHERE state <> 'landed'
           AND act_id IN (SELECT record_id FROM mirror_records WHERE epoch = $1)
         RETURNING id, actor_id, act_id, family",
        epoch,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|r| PromotedWrite {
            id: r.id,
            actor_id: r.actor_id,
            act_id: r.act_id,
            family: r.family,
        })
        .collect())
}

/// Expires one staged write immediately — the terminal path for a
/// handshake that can never complete (a seal lost before it was stored).
///
/// A write already in a terminal state is refused as `WrongState`, not as
/// `NotFound`: the row is there, and saying otherwise would send a caller
/// looking for a write it is holding.
pub async fn expire_one(pool: &PgPool, id: Uuid, current_epoch: i64) -> Result<(), StagedError> {
    let mut tx = pool.begin().await?;
    let expired = sqlx::query_as!(
        StagedRows,
        "UPDATE staged_writes
         SET state = 'expired', expired_epoch = $2, updated_at = NOW()
         WHERE id = $1 AND state NOT IN ('landed', 'expired')
         RETURNING node_id, pre_signed_at",
        id,
        current_epoch,
    )
    .fetch_optional(&mut *tx)
    .await?;
    let Some(expired) = expired else {
        return Err(missed_transition(pool, id, "neither landed nor expired").await);
    };
    discard_pending_content(&mut tx, std::iter::once(expired)).await?;
    tx.commit().await?;
    Ok(())
}

/// GC, first phase: expires every unlanded staged write prepared at least
/// `gc_after_epochs` epochs ago, taking whatever it had on screen while
/// pending with it in the same transaction. The content leaves every
/// reader's view at once — on the graph nothing ever existed
/// (substrate.md §6) — while the row itself remains until the reap: a
/// device polling a lost handshake sees the terminal state rather than a
/// vanished id, and the payload stays with it, invisible, so a record
/// that lands late can still be promoted.
pub async fn expire_due(
    pool: &PgPool,
    current_epoch: i64,
    gc_after_epochs: i64,
) -> Result<u64, StagedError> {
    let mut tx = pool.begin().await?;
    let expired = sqlx::query_as!(
        StagedRows,
        "UPDATE staged_writes
         SET state = 'expired', expired_epoch = $1, updated_at = NOW()
         WHERE state NOT IN ('landed', 'expired')
           AND prepared_epoch + $2 <= $1
         RETURNING node_id, pre_signed_at",
        current_epoch,
        gc_after_epochs,
    )
    .fetch_all(&mut *tx)
    .await?;
    let count = expired.len() as u64;
    discard_pending_content(&mut tx, expired.into_iter()).await?;
    tx.commit().await?;
    Ok(count)
}

/// The display side of expiry: every node an expired write owned loses
/// the pending rows *that write* staged, named by the authoring instant
/// they were written under. A write that minted nothing (Registration,
/// Attach) carries no node id, and one that never reached its
/// pre-commitment staged nothing — neither has anything to discard.
async fn discard_pending_content(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    nodes: impl Iterator<Item = StagedRows>,
) -> Result<(), StagedError> {
    let (ids, instants): (Vec<Uuid>, Vec<_>) =
        nodes.filter_map(|s| s.node_id.zip(s.pre_signed_at)).unzip();
    crate::content::discard_pending_many(tx, &ids, &instants).await?;
    Ok(())
}

/// The display rows one staged write owns: the node it minted or edited,
/// and the authoring instant its rows carry.
struct StagedRows {
    node_id: Option<Uuid>,
    pre_signed_at: Option<chrono::DateTime<chrono::Utc>>,
}

/// GC, second phase: deletes expired rows another `gc_after_epochs` epochs
/// after expiry.
pub async fn reap_expired(
    pool: &PgPool,
    current_epoch: i64,
    gc_after_epochs: i64,
) -> Result<u64, StagedError> {
    Ok(sqlx::query!(
        "DELETE FROM staged_writes
         WHERE state = 'expired' AND expired_epoch + $2 <= $1",
        current_epoch,
        gc_after_epochs,
    )
    .execute(pool)
    .await?
    .rows_affected())
}
