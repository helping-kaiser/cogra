// Staged writes (data-model.md "Staged writes"): the L2 row a write
// occupies from prepare until confirm — the canonical proposal, joined by
// the pre-commitment and the host-sealed verified act as the handshake
// advances (architecture.md "The write path"). Staged state is
// operational: exempt from append-only history, cleared and reaped when a
// write never lands.

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

/// Allocates the author's next act sequence value s_q
/// (`def:graph:act-identifier` — actor-chosen, unique, fixed before
/// submission). The counter row is created at zero on first use and caught
/// up against the mirror on every allocation, so acts landed outside the
/// prepare path (bootstrap repair, the dev CLI) can never cause identifier
/// reuse. Runs on a connection so prepare composes it with the staged
/// insert in one transaction.
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
                    FROM mirror_records WHERE author = $1)
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
              asserted_parents, deps, payload, prepared_epoch)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                 $14, $15, $16)",
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
                host_seal, prepared_epoch
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
    let actual = sqlx::query_scalar!("SELECT state FROM staged_writes WHERE id = $1", id)
        .fetch_optional(pool)
        .await?
        .ok_or(StagedError::NotFound(id))?;
    Err(StagedError::WrongState {
        id,
        expected: from_strs.join(" or "),
        actual,
    })
}

/// Stores the device's pre-commitment leg and moves the write into
/// `sealing`. Accepts a retry from `sealing` (a relay that died between
/// recording and sealing).
pub async fn record_pre_signed(
    pool: &PgPool,
    id: Uuid,
    pre: &PreSignedParts,
) -> Result<(), StagedError> {
    let updated = sqlx::query!(
        "UPDATE staged_writes
         SET state = 'sealing', author_pubkey = $2, nonce = $3,
             pre_signature = $4, updated_at = NOW()
         WHERE id = $1 AND state IN ('awaiting_pre_sign', 'sealing')",
        id,
        &pre.author_pubkey,
        &pre.nonce,
        &pre.pre_signature,
    )
    .execute(pool)
    .await?
    .rows_affected();
    if updated == 1 {
        return Ok(());
    }
    let actual = sqlx::query_scalar!("SELECT state FROM staged_writes WHERE id = $1", id)
        .fetch_optional(pool)
        .await?
        .ok_or(StagedError::NotFound(id))?;
    Err(StagedError::WrongState {
        id,
        expected: "awaiting_pre_sign or sealing".to_string(),
        actual,
    })
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
    let actual = sqlx::query_scalar!("SELECT state FROM staged_writes WHERE id = $1", id)
        .fetch_optional(pool)
        .await?
        .ok_or(StagedError::NotFound(id))?;
    Err(StagedError::WrongState {
        id,
        expected: "sealing".to_string(),
        actual,
    })
}

/// Returns a failed seal to `awaiting_pre_sign` so the device can retry.
pub async fn revert_to_pre_sign(pool: &PgPool, id: Uuid) -> Result<(), StagedError> {
    transition(
        pool,
        id,
        &[StagedState::Sealing],
        StagedState::AwaitingPreSign,
    )
    .await
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
/// identifier — a record landing after its staged write was collected
/// still promotes (the mirror governs; late landing wins), though its
/// staged payload is already gone.
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
pub async fn expire_one(pool: &PgPool, id: Uuid, current_epoch: i64) -> Result<(), StagedError> {
    let updated = sqlx::query!(
        "UPDATE staged_writes
         SET state = 'expired', payload = ''::bytea, expired_epoch = $2,
             updated_at = NOW()
         WHERE id = $1 AND state NOT IN ('landed', 'expired')",
        id,
        current_epoch,
    )
    .execute(pool)
    .await?
    .rows_affected();
    if updated == 1 {
        Ok(())
    } else {
        Err(StagedError::NotFound(id))
    }
}

/// GC, first phase: expires every unlanded staged write prepared at least
/// `gc_after_epochs` epochs ago, dropping its staged payload. The expired
/// row remains observable until the reap so a device polling a lost
/// handshake sees the terminal state rather than a vanished id.
pub async fn expire_due(
    pool: &PgPool,
    current_epoch: i64,
    gc_after_epochs: i64,
) -> Result<u64, StagedError> {
    Ok(sqlx::query!(
        "UPDATE staged_writes
         SET state = 'expired', payload = ''::bytea, expired_epoch = $1,
             updated_at = NOW()
         WHERE state NOT IN ('landed', 'expired')
           AND prepared_epoch + $2 <= $1",
        current_epoch,
        gc_after_epochs,
    )
    .execute(pool)
    .await?
    .rows_affected())
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
