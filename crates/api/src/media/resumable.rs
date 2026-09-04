//! ´mod:module:resumable´
//!
//! Uploading a large file over a connection that drops.
//!
//! The single-shot path sends the whole file in one request, and one
//! request is one failure: a server that is unreachable for a moment
//! costs the entire upload, however many megabytes had already crossed
//! the wire. That is the failure this module exists to remove, and the
//! mechanism is the one the object store already ships. S3 states the
//! case plainly — "if you upload over a spotty network, use multipart
//! upload to increase resiliency against network errors by avoiding
//! upload restarts… you only need to retry uploading the parts that are
//! interrupted during the upload. You don't need to restart uploading
//! your object from the beginning."
//!
//! So the shape here is S3's own, three steps wide:
//!
//! 1. **Begin.** The server opens a multipart upload against a staging
//!    key, records it, and dictates how the client should cut the file
//!    up. Everything knowable before the bytes arrive is checked now —
//!    an upload that could never be accepted is refused before it costs
//!    anyone a megabyte.
//! 2. **Parts.** Each part is its own request and its own failure. A
//!    part number names a *position*, not an attempt, so re-sending one
//!    replaces it in the store and in our own part list alike; a client
//!    that is unsure whether a part landed may simply send it again.
//! 3. **Complete.** The store assembles the parts, and only then does
//!    anything look at what was uploaded — through the very same
//!    pipeline the single-shot path runs. Sniff, strip, probe, digest,
//!    object, row: none of it knows or cares that the bytes arrived in
//!    pieces, which is the point. There is one pipeline and one set of
//!    rules about what may be published, and a second way in must not
//!    become a second answer to that question.
//!
//! **The staging key is not the asset's key.** The pipeline strips
//! metadata before it digests, so the bytes that arrive and the bytes
//! that are stored are different bytes; the final key is derived from an
//! asset id that does not exist until the strip has run. Parts therefore
//! assemble at a key of their own, which is read once, processed, and
//! deleted.
//!
//! **What a declared size is for.** The client states a size and a kind
//! at the start, and neither is ever evidence. They buy an early refusal
//! and they fix the part arithmetic — nothing more. What the file *is*
//! is decided by sniffing the assembled bytes, and the cap it answers to
//! follows from that, so a client that under-declares to buy a larger
//! allowance is refused at completion by the same check that refuses a
//! single-shot upload.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use postgres_store::PgPool;
use postgres_store::media as store;
use uuid::Uuid;

use super::{BlobStore, GalleryError, MediaConfig, MediaError, plan_cover, store_asset};

/// The most parts one upload may be cut into, fixed by S3 at 10 000.
///
/// Nothing CoGra accepts comes close — the largest cap over the smallest
/// legal part size is a few dozen — so this is a guard against a
/// configuration that has gone wrong rather than against a client.
const MAX_PARTS: u64 = 10_000;

/// How many expired sessions one sweep tick collects.
const SWEEP_BATCH: i64 = 200;

/// What the client said it is about to send.
///
/// It selects which cap the *early* refusal uses and nothing else. The
/// sniff at completion decides what the bytes actually are.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeclaredKind {
    Still,
    Video,
}

/// How the client should cut the file up, and how long it has to do it.
#[derive(Debug, Clone)]
pub struct UploadPlan {
    pub session_id: Uuid,
    pub part_size_bytes: usize,
    pub part_count: u32,
    pub expires_at: DateTime<Utc>,
}

/// Where an upload stands after a part landed.
#[derive(Debug, Clone)]
pub struct PartReceipt {
    pub part_number: u32,
    /// Which parts the server holds, ascending. A client that lost track
    /// of its own progress reads its next move off this rather than
    /// guessing.
    pub received_parts: Vec<u32>,
    pub part_count: u32,
}

/// What a session operation can refuse, and how each answer reaches a
/// client.
#[derive(Debug, thiserror::Error)]
pub enum SessionError {
    /// No such session for this viewer — expired, already collected,
    /// never opened, or somebody else's. The four are deliberately one
    /// answer: distinguishing them would tell a caller whether a session
    /// id it does not own exists.
    #[error("no such upload session")]
    NotFound,
    /// A field-level refusal, carrying the path into the input that names
    /// the offender.
    #[error(transparent)]
    BadInput(#[from] GalleryError),
    /// The assembled bytes are not something this server will store.
    #[error(transparent)]
    Refused(#[from] MediaError),
    #[error("internal: {0}")]
    Internal(String),
}

impl SessionError {
    fn internal(e: impl std::fmt::Display) -> Self {
        Self::Internal(e.to_string())
    }
}

fn refuse(field: &str, message: impl Into<String>) -> SessionError {
    SessionError::BadInput(GalleryError {
        path: vec![field.to_string()],
        message: message.into(),
    })
}

/// Where a session's parts assemble.
///
/// Under a prefix of its own, so an operator reading the bucket can tell
/// staging from assets at a glance, and so a lifecycle rule can be
/// written against uploads without touching anything a reader is served.
/// The session id is server-generated, which is what makes the key
/// unguessable and un-collidable for the same reason an asset's is.
pub fn staging_key(session_id: Uuid) -> String {
    format!("uploads/{session_id}")
}

/// The size the part at `part_number` must have, given the cut the server
/// dictated.
///
/// Every part but the last is exactly one part size; the last is
/// whatever remains. Exact rather than "at most" on purpose: it is what
/// makes the assembled length equal the declared length by construction,
/// so no part can quietly widen the upload past what was admitted at the
/// beginning.
fn expected_part_bytes(session: &store::UploadSession, part_number: u32) -> u64 {
    let part_size = session.part_size_bytes as u64;
    let declared = session.declared_bytes as u64;
    if u64::from(part_number) < session.part_count as u64 {
        part_size
    } else {
        declared - (session.part_count as u64 - 1) * part_size
    }
}

/// The cap the declared kind answers to, for the early refusal only.
fn declared_cap(config: &MediaConfig, kind: DeclaredKind) -> usize {
    match kind {
        DeclaredKind::Still => config.max_upload_bytes,
        DeclaredKind::Video => config.max_video_upload_bytes,
    }
}

/// Opens an upload.
///
/// The store's multipart upload is created before the row that records
/// it, the same ordering the single-shot path uses for object and row.
/// The failure it prefers is the reverse of that one, though: a row
/// naming an upload that does not exist would accept parts forever and
/// never assemble, so the upload is made first and the row written
/// second. If the row cannot be written the upload is aborted at once —
/// and a crash in the gap between them leaves an upload only the store's
/// own lifecycle rule will collect, which is exactly the rule S3's
/// guidance asks operators to configure.
pub async fn begin(
    pool: &PgPool,
    blobs: &dyn BlobStore,
    config: &MediaConfig,
    author: Uuid,
    declared_bytes: i64,
    kind: DeclaredKind,
) -> Result<UploadPlan, SessionError> {
    if declared_bytes <= 0 {
        return Err(refuse("declaredBytes", "an upload has to carry bytes"));
    }
    let declared = declared_bytes as u64;
    let cap = declared_cap(config, kind) as u64;
    if declared > cap {
        return Err(refuse(
            "declaredBytes",
            format!("the file is larger than {cap} bytes"),
        ));
    }

    let part_size = config.upload_part_size_bytes as u64;
    let part_count = declared.div_ceil(part_size);
    if part_count > MAX_PARTS {
        return Err(SessionError::Internal(format!(
            "a {declared}-byte upload cut at {part_size} needs {part_count} parts, over the \
             {MAX_PARTS} a multipart upload admits"
        )));
    }

    let session_id = Uuid::new_v4();
    let key = staging_key(session_id);
    let upload_id = blobs
        .create_multipart(&key)
        .await
        .map_err(SessionError::internal)?;

    let part_size_bytes = i32::try_from(part_size).map_err(SessionError::internal)?;
    let part_count_col = i32::try_from(part_count).map_err(SessionError::internal)?;
    let session = match store::open_upload_session(
        pool,
        session_id,
        author,
        &key,
        &upload_id,
        declared_bytes,
        part_size_bytes,
        part_count_col,
        config.upload_session_ttl_secs,
    )
    .await
    {
        Ok(session) => session,
        Err(e) => {
            if let Err(abort) = blobs.abort_multipart(&key, &upload_id).await {
                tracing::warn!(error = %abort, key, "upload not aborted after its row failed");
            }
            return Err(SessionError::internal(e));
        }
    };

    Ok(UploadPlan {
        session_id: session.id,
        part_size_bytes: config.upload_part_size_bytes,
        part_count: part_count as u32,
        expires_at: session.expires_at,
    })
}

/// Takes one part.
///
/// Everything about this is idempotent by construction: the store
/// overwrites a part written under a number it already holds, and the
/// part row's primary key overwrites the identifier that names it. A
/// client that retries a part it never got an answer for lands exactly
/// where a client that sent it once does.
pub async fn receive_part(
    pool: &PgPool,
    blobs: &dyn BlobStore,
    author: Uuid,
    session_id: Uuid,
    part_number: u32,
    bytes: Vec<u8>,
) -> Result<PartReceipt, SessionError> {
    let session = store::upload_session(pool, session_id, author)
        .await
        .map_err(SessionError::internal)?
        .ok_or(SessionError::NotFound)?;

    if session.media_id.is_some() {
        return Err(refuse(
            "partNumber",
            "this upload is already complete and takes no more parts",
        ));
    }
    let part_count = session.part_count as u32;
    if part_number == 0 || part_number > part_count {
        return Err(refuse(
            "partNumber",
            format!("parts are numbered 1 to {part_count}"),
        ));
    }

    let expected = expected_part_bytes(&session, part_number);
    if bytes.len() as u64 != expected {
        return Err(refuse(
            "part",
            format!(
                "part {part_number} is {expected} bytes, got {}",
                bytes.len()
            ),
        ));
    }

    let size_bytes = i32::try_from(bytes.len()).map_err(SessionError::internal)?;
    let content_id = blobs
        .put_part(
            &session.storage_key,
            &session.upload_id,
            (part_number - 1) as usize,
            bytes,
        )
        .await
        .map_err(SessionError::internal)?;

    store::record_upload_part(
        pool,
        session_id,
        part_number as i32,
        &content_id,
        size_bytes,
    )
    .await
    .map_err(SessionError::internal)?;

    let received_parts = store::upload_parts(pool, session_id)
        .await
        .map_err(SessionError::internal)?
        .into_iter()
        .map(|p| p.part_number as u32)
        .collect();

    Ok(PartReceipt {
        part_number,
        received_parts,
        part_count,
    })
}

/// Assembles the upload and puts it through the ordinary pipeline.
///
/// **A completion is retryable.** The connection can drop here too — it
/// is the one request in the whole exchange that is not cheap to repeat
/// blind — so the session remembers the asset it produced and a second
/// call is answered out of that memory. Between the two extremes it also
/// recovers: an upload the store already assembled but that never got
/// past processing is picked up from the staging object rather than
/// re-assembled.
///
/// **The caps are checked again here, against the bytes.** The declared
/// size bought an early refusal and fixed the part arithmetic; it proves
/// nothing. What the file is, and therefore which cap it answers to, is
/// decided by [`super::process`] from the assembled bytes — the same call
/// the single-shot upload makes, so the two paths cannot drift into
/// admitting different things.
pub async fn complete(
    pool: &PgPool,
    blobs: &dyn BlobStore,
    config: &MediaConfig,
    author: Uuid,
    session_id: Uuid,
    cover_media_id: Option<Uuid>,
) -> Result<store::MediaAttachment, SessionError> {
    let session = store::upload_session(pool, session_id, author)
        .await
        .map_err(SessionError::internal)?
        .ok_or(SessionError::NotFound)?;

    if let Some(media_id) = session.media_id {
        return store::by_id(pool, media_id)
            .await
            .map_err(SessionError::internal)?
            .ok_or(SessionError::NotFound);
    }

    let parts = store::upload_parts(pool, session_id)
        .await
        .map_err(SessionError::internal)?;
    let expected: Vec<i32> = (1..=session.part_count).collect();
    let held: Vec<i32> = parts.iter().map(|p| p.part_number).collect();
    if held != expected {
        let missing: Vec<String> = expected
            .iter()
            .filter(|n| !held.contains(n))
            .map(|n| n.to_string())
            .collect();
        return Err(refuse(
            "uploadId",
            format!("the upload is missing part(s) {}", missing.join(", ")),
        ));
    }

    let content_ids: Vec<String> = parts.into_iter().map(|p| p.content_id).collect();
    if let Err(e) = blobs
        .complete_multipart(&session.storage_key, &session.upload_id, content_ids)
        .await
    {
        let assembled = blobs
            .exists(&session.storage_key)
            .await
            .map_err(SessionError::internal)?;
        if !assembled {
            return Err(SessionError::internal(e));
        }
        tracing::debug!(
            session = %session_id,
            "completion re-run over an upload the store had already assembled"
        );
    }

    let bytes = blobs
        .get(&session.storage_key)
        .await
        .map_err(SessionError::internal)?;
    let caps = config.caps();
    let processed = tokio::task::spawn_blocking(move || super::process(&bytes, caps))
        .await
        .map_err(SessionError::internal)?;

    let asset = match processed {
        Ok(asset) => asset,
        Err(e) => {
            discard(pool, blobs, &session).await;
            return Err(SessionError::Refused(e));
        }
    };

    // The session is deliberately left standing when the poster is
    // refused: the bytes are assembled and correct, and the fix is a
    // second `complete` naming a poster that exists — re-sending the
    // whole file because one field was wrong is not the trade. The
    // session ages out on its own, and the sweep now closes its row
    // whatever the store says, so a session left here cannot block the
    // collection of any other.
    let cover = plan_cover(pool, author, !asset.is_still(), cover_media_id)
        .await
        .map_err(|e| match e {
            super::GalleryPlanError::BadInput(e) => SessionError::BadInput(e),
            super::GalleryPlanError::Internal(e) => SessionError::Internal(e),
        })?;

    let row = store_asset(pool, blobs, author, asset, cover)
        .await
        .map_err(|e| match e {
            super::GalleryPlanError::BadInput(e) => SessionError::BadInput(e),
            super::GalleryPlanError::Internal(e) => SessionError::Internal(e),
        })?;

    store::finish_upload_session(pool, session_id, row.id)
        .await
        .map_err(SessionError::internal)?;

    if let Err(e) = blobs.delete(&session.storage_key).await {
        tracing::warn!(error = %e, key = session.storage_key, "staging object left to the sweeper");
    }
    Ok(row)
}

/// Gives up on an upload at the client's word.
///
/// Offered rather than left to the sweep because a client that knows it
/// is done — the user cancelled, the compose was discarded — can release
/// the parts now instead of a day from now, and until they are released
/// the store is holding bytes nobody will ever read.
pub async fn abort(
    pool: &PgPool,
    blobs: &dyn BlobStore,
    author: Uuid,
    session_id: Uuid,
) -> Result<(), SessionError> {
    let session = store::upload_session(pool, session_id, author)
        .await
        .map_err(SessionError::internal)?
        .ok_or(SessionError::NotFound)?;
    discard(pool, blobs, &session).await;
    Ok(())
}

/// Releases everything a session holds, store first and row last.
///
/// The order is the one [`store::close_upload_session`] argues for: the
/// row is the only handle on the store-side upload, so dropping it while
/// the upload lives strands the parts. A store failure here therefore
/// leaves the row for [`sweep_expired`] to retry — which is why nothing
/// in this function is allowed to be fatal to its caller, and why the
/// sweep, having no further retry behind it, closes the row regardless.
async fn discard(pool: &PgPool, blobs: &dyn BlobStore, session: &store::UploadSession) {
    if let Err(e) = blobs
        .abort_multipart(&session.storage_key, &session.upload_id)
        .await
    {
        tracing::warn!(error = %e, session = %session.id, "upload not aborted; left to the sweep");
        return;
    }
    if let Err(e) = blobs.delete(&session.storage_key).await {
        tracing::warn!(error = %e, session = %session.id, "staging object not removed");
        return;
    }
    if let Err(e) = store::close_upload_session(pool, session.id).await {
        tracing::warn!(error = %e, session = %session.id, "upload session row not closed");
    }
}

/// Collects sessions past their expiry.
///
/// This runs on the media reaper's tick beside the orphan sweep rather
/// than on a timer of its own: the two collect the two halves of the same
/// abandoned compose, and a second loop would be a second thing to
/// configure for no gain.
///
/// **The row is always closed, whatever the store said.** This is the
/// last resort — [`discard`] is the retrying path, and the sweep is what
/// it retries into — so a store failure here must not leave the row
/// standing. The batch is `LIMIT`-shaped and ordered by expiry, so rows
/// that can never be collected sort to the *front*: leaving them would
/// fill every batch with the same sessions and stop the sweep collecting
/// anything, silently, while it went on logging warnings. Closing anyway
/// can leave a store-side orphan, which is the failure the whole write
/// ordering already prefers and which the bucket's own lifecycle rule
/// collects (the guidance `media/mod.rs` cites for exactly this).
pub async fn sweep_expired(pool: &PgPool, blobs: &Arc<dyn BlobStore>) {
    let expired = match store::expired_upload_sessions(pool, SWEEP_BATCH).await {
        Ok(expired) => expired,
        Err(e) => {
            tracing::warn!(error = %e, "expired upload sweep failed");
            return;
        }
    };
    if expired.is_empty() {
        return;
    }
    tracing::debug!(
        rows = expired.len(),
        "media sweeper collected upload sessions"
    );

    for session in expired {
        if session.unfinished {
            if let Err(e) = blobs
                .abort_multipart(&session.storage_key, &session.upload_id)
                .await
            {
                tracing::warn!(error = %e, session = %session.id, "expired upload not aborted");
            }
            if let Err(e) = blobs.delete(&session.storage_key).await {
                tracing::warn!(error = %e, session = %session.id, "staging object not removed");
            }
        }
        if let Err(e) = store::close_upload_session(pool, session.id).await {
            tracing::warn!(error = %e, session = %session.id, "expired session row not closed");
        }
    }
}
