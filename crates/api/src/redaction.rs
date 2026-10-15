//! ´mod:module:redaction´
//!
//! Honest deletion's substrate (data-model.md "The retention archive",
//! "Act payload carriage"): redacting one act archives its content as one
//! unit and removes every copy of the payload CoGra holds, so "reduced"
//! is true everywhere at once.
//!
//! The deletion engines — account erasure, single-post removal — decide
//! *which* acts to redact and own the display tombstones; this module is
//! what each of them calls per act. It never decides scope.
//!
//! **One transaction per act.** The archive unit, the carriage reduction,
//! the staged reap and the media hold commit together or not at all, so
//! no committed state holds an archive row without the reduction or a
//! reduction without its archive row. The original removes the private
//! value "atomically with" the payload (layer1-interface.md "Custody
//! across phases"); the archive is what keeps that removal from being
//! evidence destruction, so it moves in the same step.
//!
//! **The substrate's copy goes after.** The stand-in is a separate
//! system behind the seam, so its residue — the custody of an act that
//! never reached acceptance — is dropped across [`L1Boundary`] once the
//! Postgres side committed. A crash between the two leaves that residue
//! for the retry, which is idempotent on both sides; nothing on the
//! Postgres side is ever undone by it.

use common::envelope::{CograContent, CograProfile, MediaAsset};
use postgres_store::retention::{self, NewUnit};
use postgres_store::{PgPool, content as content_store, media as media_store, mirror, staged};
use serde_json::json;
use uuid::Uuid;

use crate::l1::{BoundaryError, L1Boundary};

/// Why a redaction could not run.
#[derive(Debug, thiserror::Error)]
pub enum RedactionError {
    /// The act is carried with an application. A carried act never
    /// reached Layer 1 or a reader; it is deleted with its account, never
    /// archived or reaped.
    #[error("act {0} is carried with an application; it is deleted, not redacted")]
    Carried(String),
    #[error("substrate: {0}")]
    Boundary(#[from] BoundaryError),
    #[error("storage: {0}")]
    Storage(String),
}

impl From<sqlx::Error> for RedactionError {
    fn from(e: sqlx::Error) -> Self {
        Self::Storage(e.to_string())
    }
}

impl From<content_store::ContentError> for RedactionError {
    fn from(e: content_store::ContentError) -> Self {
        Self::Storage(e.to_string())
    }
}

impl From<staged::StagedError> for RedactionError {
    fn from(e: staged::StagedError) -> Self {
        Self::Storage(e.to_string())
    }
}

impl From<mirror::MirrorError> for RedactionError {
    fn from(e: mirror::MirrorError) -> Self {
        Self::Storage(e.to_string())
    }
}

/// One act to redact.
#[derive(Debug, Clone, Copy)]
pub struct Redaction<'a> {
    /// The act's author — the account whose media the envelope names.
    pub actor_id: Uuid,
    pub act_id: &'a str,
    /// The archive's trigger, e.g. `user-account-deletion`.
    pub reason: &'a str,
    /// The initiator: the requesting account, or the authorizing act.
    pub redacted_by: &'a str,
}

/// What one act's redaction did, for the caller's log and its
/// reconciler.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Redacted {
    /// The unit this call archived. None when there was nothing left to
    /// archive: the act was already redacted, or carried no bytes.
    pub archived: Option<Uuid>,
    /// The carriage row was missing and the landed staged row still held
    /// the payload, so it was promoted before anything was reaped.
    pub promoted_first: bool,
    /// This call moved the carriage row to `reduced`.
    pub reduced: bool,
    /// This call reaped the staged row's payload, salt and nonce.
    pub staged_reaped: bool,
    /// The assets whose last live placement this redaction removed.
    pub held_media: Vec<Uuid>,
}

/// Redacts every listed act, then drops the substrate's residue for all
/// of them in one call.
///
/// Each act is its own transaction, so a failure part-way leaves every
/// earlier act fully redacted and every later one untouched; re-running
/// the same list completes it, because each step is idempotent.
pub async fn redact<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    redactions: &[Redaction<'_>],
) -> Result<Vec<Redacted>, RedactionError> {
    let mut done = Vec::with_capacity(redactions.len());
    for r in redactions {
        done.push(redact_act(pool, r).await?);
    }
    let act_ids: Vec<String> = redactions.iter().map(|r| r.act_id.to_string()).collect();
    boundary.drop_carriage(&act_ids).await?;
    Ok(done)
}

/// The Postgres half of one act's redaction, in one transaction:
///
/// 1. **Promote first.** An act whose landed staged row is still the only
///    copy of its payload — the admission Registration's handle, before
///    promotion carried it — gets its carriage row from that copy before
///    anything is reaped, or the reap would erase it with no archive.
/// 2. **Archive** the unit: envelope, content salt, proposal nonce, the
///    witness, and the media the envelope names (data-model.md "The
///    retention archive"). An act that never landed is archived from its
///    staged copy, since it can still land later.
/// 3. **Reduce** the carriage row: payload and salt to NULL, state
///    `reduced`.
/// 4. **Reap** the staged row: payload, content salt and nonce to NULL.
/// 5. **Hold** each named asset whose last live placement is now gone.
///
/// The `l1_acts` copy is dropped separately ([`redact`]).
pub async fn redact_act(pool: &PgPool, r: &Redaction<'_>) -> Result<Redacted, RedactionError> {
    let mut tx = pool.begin().await?;
    let carriage = content_store::lock_act_payload(&mut tx, r.act_id).await?;
    let copy = staged::lock_copy(&mut tx, r.act_id).await?;
    if let Some(copy) = &copy
        && copy.state == staged::StagedState::Carried.as_str()
    {
        return Err(RedactionError::Carried(r.act_id.to_string()));
    }

    let mut done = Redacted::default();
    let carriage = match (carriage, &copy) {
        (Some(c), _) => Some(c),
        (None, Some(copy)) if copy.state == staged::StagedState::Landed.as_str() => {
            match (&copy.payload, &copy.content_salt) {
                (Some(payload), Some(salt)) if !payload.is_empty() => {
                    content_store::insert_act_payload(&mut tx, r.act_id, payload, salt).await?;
                    done.promoted_first = true;
                    Some(content_store::ActPayload {
                        payload: Some(payload.clone()),
                        content_salt: Some(salt.clone()),
                        reduced: false,
                        reduced_at: None,
                    })
                }
                _ => None,
            }
        }
        (None, _) => None,
    };

    // The bytes the unit archives: the carriage's while it is full, else
    // the staged copy of an act that has not landed. An act already
    // reduced, or one that never carried bytes, archives nothing — and
    // neither does a staged copy that was never sealed: it has no witness
    // to be verified against, never reached Layer 1, and can never land.
    let source = match &carriage {
        Some(c) => c.payload.clone().map(|p| (p, c.content_salt.clone())),
        None => copy
            .as_ref()
            .and_then(|s| s.payload.clone().map(|p| (p, s.content_salt.clone()))),
    };
    let witness = match source.as_ref().filter(|(p, _)| !p.is_empty()) {
        None => None,
        Some(_) => match mirror::record_full(pool, r.act_id).await? {
            Some(record) => Some(record.payload_witness),
            None => copy.as_ref().and_then(|s| s.content_commitment.clone()),
        },
    };
    let mut media_ids = Vec::new();
    if let (Some((envelope, content_salt)), Some(witness)) = (source, witness) {
        let media = unit_media(pool, r.actor_id, &envelope).await?;
        media_ids = media.iter().map(|m| m.media_id).collect();
        let data = json!({
            "unit": 1,
            "act_id": r.act_id,
            "envelope": hex::encode(&envelope),
            "content_salt": content_salt.as_deref().map(hex::encode),
            "nonce": copy.as_ref().and_then(|s| s.nonce.as_deref()).map(hex::encode),
            "witness": hex::encode(&witness),
            "media": media.iter().map(UnitMedia::to_json).collect::<Vec<_>>(),
        });
        done.archived = retention::insert_unit(
            &mut tx,
            &NewUnit {
                original_id: r.act_id,
                original_type: retention::ACT_PAYLOAD,
                original_data: data,
                redaction_reason: r.reason,
                redacted_by: r.redacted_by,
                media: &media_ids,
            },
        )
        .await?;
    }

    done.reduced = content_store::reduce_act_payload(&mut tx, r.act_id).await?;
    done.staged_reaped = staged::reap_payload(&mut tx, r.act_id).await? > 0;
    done.held_media = retention::hold_unplaced(&mut tx, &media_ids).await?;
    tx.commit().await?;
    Ok(done)
}

/// One asset an archived envelope names: both digests the record
/// witnesses, and the asset row and object key that hold the bytes.
#[derive(Debug, Clone)]
struct UnitMedia {
    role: &'static str,
    rendition_digest: Vec<u8>,
    upload_digest: Option<Vec<u8>>,
    media_id: Uuid,
    storage_key: String,
}

impl UnitMedia {
    fn to_json(&self) -> serde_json::Value {
        json!({
            "role": self.role,
            "rendition_digest": hex::encode(&self.rendition_digest),
            "upload_digest": self.upload_digest.as_deref().map(hex::encode),
            "media_id": self.media_id,
            "storage_key": self.storage_key,
        })
    }
}

/// The media an envelope names, resolved to the author's assets: every
/// manifest entry and every cover, or a profile update's avatar. R and U
/// are read from the manifest (keys 0 and 5); a cover is named by its
/// rendition digest alone. A digest that resolves to no asset is left out
/// — the unit references objects, and there is none to reference — and a
/// payload that is not a content or profile envelope (the admission
/// Registration's handle) names none.
async fn unit_media(
    pool: &PgPool,
    author: Uuid,
    envelope: &[u8],
) -> Result<Vec<UnitMedia>, RedactionError> {
    let named: Vec<MediaAsset> = if let Ok(content) = CograContent::decode_payload(envelope) {
        content.media
    } else if let Ok(profile) = CograProfile::decode_payload(envelope) {
        profile.avatar.flatten().into_iter().collect()
    } else {
        Vec::new()
    };
    let mut wanted: Vec<(&'static str, Vec<u8>, Option<Vec<u8>>)> = Vec::new();
    for asset in &named {
        wanted.push((
            "asset",
            asset.digest.to_vec(),
            asset.upload_digest.map(|u| u.to_vec()),
        ));
        if let Some(cover) = asset.cover {
            wanted.push(("cover", cover.to_vec(), None));
        }
    }
    if wanted.is_empty() {
        return Ok(Vec::new());
    }
    let digests: Vec<Vec<u8>> = wanted.iter().map(|(_, r, _)| r.clone()).collect();
    let rows = media_store::assets_by_digests(pool, author, &digests).await?;
    let mut media: Vec<UnitMedia> = Vec::new();
    for (role, r, u) in wanted {
        let Some(row) = rows.iter().find(|row| row.digest == r) else {
            continue;
        };
        if media.iter().any(|m| m.media_id == row.id) {
            continue;
        }
        media.push(UnitMedia {
            role,
            rendition_digest: r,
            upload_digest: u,
            media_id: row.id,
            storage_key: row.storage_key.clone(),
        });
    }
    Ok(media)
}
