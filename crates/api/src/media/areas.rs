//! ´mod:module:areas´
//!
//! The three media areas (data-model.md "Media areas"): which store an
//! asset's bytes sit in, and the one verified move that carries them
//! between stores.
//!
//! - **Live** is the world-readable store every `MediaAttachment.url`
//!   points into. It is open by design: every piece of content carries a
//!   license, and the license is the evidence against misuse, not an
//!   access control.
//! - **Held** is where a deleted asset's bytes go once nothing live shows
//!   them any more: a store with no public policy and no serving route,
//!   reached by the operator over the host alone. No old link, no guessed
//!   key and no crawl reaches bytes there.
//! - **Carried** is where an applicant's carried media waits for the whole
//!   application-to-admission window: not public, served to its author
//!   alone. At the landing the bytes move to the live store, and the move
//!   is confirmed good before the carried batch signs, so a post never
//!   lands naming bytes nobody can fetch.
//!
//! **One move, verified.** Bytes are copied, read back from the
//! destination and checked against the asset's rendition digest R — the
//! digest the record witnesses — before the row says they moved. A copy
//! that does not read back as R is deleted and the move fails, leaving the
//! asset where it was; every move is retryable, and a retry resumes from
//! whichever step a crash left it at, because a destination that already
//! holds R is accepted as moved.
//!
//! **Held moves only what nothing shows.** The move to the operator store
//! re-checks, under the asset's row lock, that no live placement shows it
//! (`media_live_placed`) — the hold flag can go stale between the
//! redaction that set it and the move, and the re-check is what keeps a
//! placement from losing its bytes. The live copy is deleted before the
//! row reads `held`, so no committed state says "held" while the bytes
//! are still public.

use std::sync::Arc;

use postgres_store::media::{self as store, AreaAsset, MediaArea};
use postgres_store::{PgPool, staged};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::{BlobError, BlobStore, MediaConfig, S3Config, blob};

/// The three stores, one per area.
#[derive(Clone)]
pub struct MediaAreas {
    pub live: Arc<dyn BlobStore>,
    pub carried: Arc<dyn BlobStore>,
    pub held: Arc<dyn BlobStore>,
}

impl MediaAreas {
    /// The three buckets of one media service, as configured.
    pub fn s3(config: &MediaConfig) -> Result<Self, BlobError> {
        let bucket = |name: &str| -> Result<Arc<dyn BlobStore>, BlobError> {
            Ok(Arc::new(blob::s3(&S3Config {
                bucket: name.to_string(),
                ..config.s3.clone()
            })?))
        };
        Ok(Self {
            live: bucket(&config.s3.bucket)?,
            carried: bucket(&config.carried_bucket)?,
            held: bucket(&config.held_bucket)?,
        })
    }

    /// Three in-process stores, for test rigs.
    pub fn in_memory() -> Self {
        Self {
            live: Arc::new(blob::in_memory()),
            carried: Arc::new(blob::in_memory()),
            held: Arc::new(blob::in_memory()),
        }
    }

    pub fn store(&self, area: MediaArea) -> &dyn BlobStore {
        match area {
            MediaArea::Live => self.live.as_ref(),
            MediaArea::Carried => self.carried.as_ref(),
            MediaArea::Held => self.held.as_ref(),
        }
    }
}

/// Why a move did not happen. Every one leaves the asset in the area it
/// was in, and every one is retryable.
#[derive(Debug, thiserror::Error)]
pub enum MoveError {
    #[error("asset {0}'s bytes are in neither store")]
    Missing(Uuid),
    #[error("asset {0}'s stored bytes do not match its digest")]
    Corrupt(Uuid),
    #[error("asset {0}'s copy did not read back as its digest")]
    Unverified(Uuid),
    #[error("asset {0} is digested with {1}, which the move cannot verify")]
    UnknownDigest(Uuid, String),
    #[error("the staged write's payload is not a content envelope: {0}")]
    Envelope(String),
    #[error(transparent)]
    Blob(#[from] BlobError),
    #[error("storage: {0}")]
    Storage(String),
}

impl From<sqlx::Error> for MoveError {
    fn from(e: sqlx::Error) -> Self {
        Self::Storage(e.to_string())
    }
}

impl From<staged::StagedError> for MoveError {
    fn from(e: staged::StagedError) -> Self {
        Self::Storage(e.to_string())
    }
}

fn holds_digest(bytes: &[u8], digest: &[u8]) -> bool {
    Sha256::digest(bytes).as_slice() == digest
}

/// Puts the asset's bytes in `to`, verified: the copy is read back from
/// `to` and must hash to R. A destination that already holds R is the
/// move resumed and is accepted as it is.
async fn place_verified(
    asset: &AreaAsset,
    from: &dyn BlobStore,
    to: &dyn BlobStore,
) -> Result<(), MoveError> {
    if asset.digest_algo != "sha256" {
        return Err(MoveError::UnknownDigest(
            asset.id,
            asset.digest_algo.clone(),
        ));
    }
    let key = asset.storage_key.as_str();
    match to.get(key).await {
        Ok(bytes) if holds_digest(&bytes, &asset.digest) => return Ok(()),
        Ok(_) => {}
        Err(e) if e.is_not_found() => {}
        Err(e) => return Err(e.into()),
    }
    let bytes = match from.get(key).await {
        Ok(bytes) => bytes,
        Err(e) if e.is_not_found() => return Err(MoveError::Missing(asset.id)),
        Err(e) => return Err(e.into()),
    };
    if !holds_digest(&bytes, &asset.digest) {
        return Err(MoveError::Corrupt(asset.id));
    }
    to.put(key, bytes, &asset.mime_type).await?;
    let back = to.get(key).await?;
    if !holds_digest(&back, &asset.digest) {
        if let Err(e) = to.delete(key).await {
            tracing::warn!(error = %e, asset = %asset.id, "an unverified copy was not removed");
        }
        return Err(MoveError::Unverified(asset.id));
    }
    Ok(())
}

/// What one held move did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Held {
    /// The bytes left the live store for the operator store.
    Moved,
    /// The bytes were already in the operator store.
    AlreadyHeld,
    /// A live placement shows the asset again — the hold went stale — so
    /// its bytes stay where that placement reads them.
    StillPlaced,
    /// The asset is not held.
    NotHeld,
    /// No ready asset has this id.
    Gone,
}

/// Moves a held asset's bytes into the operator-only store.
///
/// Under the asset's row lock: re-check that no live placement shows it,
/// put the bytes in the operator store verified, delete the live copy, and
/// only then record the area — so no committed state reads `held` while a
/// public copy remains. A failure anywhere leaves the row in the live
/// area for the next pass to retry; a crash after the live copy went
/// resumes at the flip, because the operator store already holds R.
pub async fn hold(pool: &PgPool, areas: &MediaAreas, media_id: Uuid) -> Result<Held, MoveError> {
    let mut tx = pool.begin().await?;
    let Some(asset) = store::lock_area_asset(&mut tx, media_id).await? else {
        return Ok(Held::Gone);
    };
    if asset.held_at.is_none() {
        return Ok(Held::NotHeld);
    }
    if asset.area == MediaArea::Held {
        return Ok(Held::AlreadyHeld);
    }
    if asset.placed {
        return Ok(Held::StillPlaced);
    }
    let from = areas.store(asset.area);
    place_verified(&asset, from, areas.held.as_ref()).await?;
    from.delete(&asset.storage_key).await?;
    store::set_area(&mut tx, asset.id, asset.area, MediaArea::Held).await?;
    tx.commit().await?;
    Ok(Held::Moved)
}

/// Moves every listed asset that is held, logging what fails: the hold
/// committed already, and the reconciler retries a failed move.
pub async fn hold_all(pool: &PgPool, areas: &MediaAreas, media: &[Uuid]) -> Vec<Uuid> {
    let mut moved = Vec::new();
    for &id in media {
        match hold(pool, areas, id).await {
            Ok(Held::Moved) => moved.push(id),
            Ok(_) => {}
            Err(e) => tracing::warn!(
                error = %e,
                asset = %id,
                "a held asset's bytes did not move; the reconciler retries"
            ),
        }
    }
    moved
}

/// How many held assets one reconciler pass moves.
const HELD_BATCH: i64 = 100;

/// The reconciler's pass: every held asset whose bytes are still in the
/// live store is moved, oldest hold first. Returns the assets it moved.
pub async fn settle_held(pool: &PgPool, areas: &MediaAreas) -> Vec<Uuid> {
    match store::held_unmoved(pool, HELD_BATCH).await {
        Ok(ids) => hold_all(pool, areas, &ids).await,
        Err(e) => {
            tracing::warn!(error = %e, "the held-media scan failed; the next pass retries it");
            Vec::new()
        }
    }
}

/// The rendition digests a content envelope names: every manifest entry
/// and every cover. A payload that is not a content envelope names none.
fn named_digests(payload: &[u8]) -> Vec<Vec<u8>> {
    let Ok(content) = common::envelope::CograContent::decode_payload(payload) else {
        return Vec::new();
    };
    let mut digests = Vec::new();
    for asset in &content.media {
        digests.push(asset.digest.to_vec());
        if let Some(cover) = asset.cover {
            digests.push(cover.to_vec());
        }
    }
    digests.sort();
    digests.dedup();
    digests
}

/// The carried write's named media, resolved to the author's assets, and
/// whether every name resolved.
async fn carried_assets(
    pool: &PgPool,
    staged_id: Uuid,
) -> Result<(Vec<AreaAsset>, bool), MoveError> {
    let write = staged::load(pool, staged_id).await?;
    let digests = named_digests(&write.proposal.payload);
    if digests.is_empty() {
        return Ok((Vec::new(), true));
    }
    let assets = store::area_assets_by_digests(pool, write.actor_id, &digests).await?;
    let complete = digests
        .iter()
        .all(|d| assets.iter().any(|a| a.digest == *d));
    Ok((assets, complete))
}

/// Publishes a carried write's media: every asset it names that still
/// waits in the carried store moves to the live store, verified, before
/// its row reads `live`. Returns the assets this call moved. The carried
/// copy is removed after the flip, best-effort — it sits in a non-public
/// store, so a leftover is storage, not exposure.
///
/// The landing calls this before the carried batch signs, and signs only
/// once [`carried_media_published`] holds; a failure refuses nothing
/// permanently — the next attempt resumes the move.
pub async fn publish_carried(
    pool: &PgPool,
    areas: &MediaAreas,
    staged_id: Uuid,
) -> Result<Vec<Uuid>, MoveError> {
    let (assets, _) = carried_assets(pool, staged_id).await?;
    let mut moved = Vec::new();
    for named in assets.iter().filter(|a| a.area == MediaArea::Carried) {
        let mut tx = pool.begin().await?;
        let Some(asset) = store::lock_area_asset(&mut tx, named.id).await? else {
            continue;
        };
        if asset.area != MediaArea::Carried {
            continue;
        }
        place_verified(&asset, areas.carried.as_ref(), areas.live.as_ref()).await?;
        store::set_area(&mut tx, asset.id, MediaArea::Carried, MediaArea::Live).await?;
        tx.commit().await?;
        if let Err(e) = areas.carried.delete(&asset.storage_key).await {
            tracing::warn!(
                error = %e,
                asset = %asset.id,
                "a published asset's carried copy was not removed"
            );
        }
        moved.push(asset.id);
    }
    Ok(moved)
}

/// The sign gate's predicate: true exactly when every asset the carried
/// write names resolves to a ready asset of its author's whose bytes are
/// in the live store — moved there and verified, or uploaded there. A
/// name that resolves to no asset fails closed: a post naming bytes
/// nobody can fetch never signs. A write naming no media holds trivially.
pub async fn carried_media_published(pool: &PgPool, staged_id: Uuid) -> Result<bool, MoveError> {
    let (assets, complete) = carried_assets(pool, staged_id).await?;
    Ok(complete && assets.iter().all(|a| a.area == MediaArea::Live))
}

/// The move and its confirmation in one call — what the landing's sign
/// gate runs: publish, then read the predicate back from the rows.
pub async fn ensure_carried_published(
    pool: &PgPool,
    areas: &MediaAreas,
    staged_id: Uuid,
) -> Result<bool, MoveError> {
    publish_carried(pool, areas, staged_id).await?;
    carried_media_published(pool, staged_id).await
}

#[cfg(test)]
mod tests {
    use super::holds_digest;
    use sha2::{Digest, Sha256};

    /// A copy is accepted only when its bytes hash to the asset's digest.
    /// ´claim:media:a-moved-copy-verifies-against-the-rendition-digest´
    #[test]
    fn a_copy_verifies_only_against_its_own_digest() {
        let bytes = b"the picture";
        let digest = Sha256::digest(bytes);
        assert!(holds_digest(bytes, &digest));
        assert!(!holds_digest(b"the picture, altered", &digest));
        assert!(!holds_digest(bytes, &[0u8; 32]));
    }
}
