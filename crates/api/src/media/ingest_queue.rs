//! ´mod:module:ingest-queue´
//!
//! The ingest worker: what happens to an upload between the moment it
//! lands and the moment it may be attached.
//!
//! **The ordering is the whole design.** A payload envelope commits an
//! asset's digest at prepare, and once it has, the bytes may never change
//! — a reader hashing what it was served must get the digest the record
//! carries. So every change the server makes to an upload happens
//! strictly before prepare can see it: the asset is `processing` until its
//! final bytes exist, `ready` only then, and prepare refuses anything
//! else (`usable_asset` in the parent module). There is no path by which
//! a digest that was ever committable is replaced.
//!
//! **Most uploads never come here.** The byte pipeline decides at upload
//! whether a clip is within target, from the probe it runs anyway, and a
//! clip that is — every Android upload, every web upload the browser
//! could compress — is stored `ready` on the spot. Only a clip outside
//! the served target — its video, or audio that is not already AAC — is
//! stored `processing` and queued.
//!
//! **The queue is the table.** A `processing` row is a job; a worker
//! leases one with `FOR UPDATE SKIP LOCKED` and renews the lease while it
//! works, so jobs survive a restart (an unrenewed lease lapses and the row
//! is claimable again) and several workers never collide. That is the
//! whole of the machinery an in-process worker at this scale needs; a job
//! is stateless beyond its row, so more workers — here or on other
//! machines — are more copies of the same loop.
//!
//! **One job, in order:** read the upload, run it through ffmpeg — audio
//! is always re-encoded to AAC, and the video track is copied unchanged
//! when it is already the served target on its own terms
//! (`transcode::VideoPlan`) or re-encoded to it otherwise — run the
//! result through the very byte pipeline an upload runs (sniff, cap,
//! strip, probe, digest — so the rendition is validated exactly as an
//! upload is), write the rendition's object, settle the row `ready`
//! pointing at it, and only then delete the original. A crash between any
//! two steps leaves either a row still `processing` (the job re-runs) or
//! an unreferenced object — never a row pointing at bytes that are gone.

use std::sync::Arc;
use std::time::Duration;

use postgres_store::PgPool;
use postgres_store::media as store;
use uuid::Uuid;

use super::transcode::{self, Ffmpeg, TranscodeError, Transfer, VideoPlan, video_bps_for};
use super::{
    BlobStore, MediaConfig, Probe, UploadCaps, asset_options, process, storage_key, video,
};

/// How many times a job is claimed before it is failed for good.
///
/// A retry is for the faults that pass — a store that was briefly
/// unreachable, a deadline missed under load. A file that fails the same
/// way three times is not going to succeed on the fourth, and a client is
/// polling for an answer.
pub const MAX_ATTEMPTS: i32 = 3;

/// How long a job that failed in a way worth retrying waits before it is
/// claimable again: long enough for a store that blinked to come back,
/// short enough that the author's poll still ends in minutes.
const RETRY_AFTER: Duration = Duration::from_secs(30);

/// The server has no usable ffmpeg. Each `REASON_*` is what an author
/// reads when their upload could not be made servable — worded for the
/// author rather than the operator, whose detail goes to the log.
pub const REASON_NO_ENCODER: &str = "the server cannot re-encode video right now";
/// ffmpeg ran and refused the file, or produced something the byte
/// pipeline would not store.
pub const REASON_DID_NOT_ENCODE: &str = "the video could not be re-encoded";
/// Even the floor rate overruns the cap: the one refusal an author can
/// act on, by trimming the clip.
pub const REASON_TOO_LONG: &str =
    "the video is too long to fit the size limit at a watchable quality";
/// The upload is HDR and the server's ffmpeg cannot tone-map it. Served
/// without the tone map it would play washed out, under a digest that can
/// never be replaced, so it is refused instead.
pub const REASON_NO_TONE_MAP: &str = "the server cannot convert HDR video right now";
/// The job was claimed [`MAX_ATTEMPTS`] times without settling.
pub const REASON_GAVE_UP: &str = "processing did not finish after several attempts";
/// The rendition is byte-identical to a live asset this author holds.
pub const REASON_DUPLICATE: &str = "an identical video is already among your uploads";

/// How the ingest worker runs.
#[derive(Debug, Clone, Copy)]
pub struct IngestSettings {
    /// How long a claim holds a job before another worker may take it.
    /// Renewed every third of itself while the job runs, so only a worker
    /// that stopped renewing — because it died — loses one.
    pub lease: Duration,
    /// How long an idle worker waits before looking for work again.
    pub poll: Duration,
    /// The longest one ffmpeg run may take.
    pub deadline: Duration,
    /// How long a job that failed in a way worth retrying waits.
    pub retry_after: Duration,
}

impl IngestSettings {
    pub fn from_config(config: &MediaConfig) -> Self {
        Self {
            lease: Duration::from_secs(config.ingest_lease_secs),
            poll: Duration::from_secs(config.ingest_poll_secs),
            deadline: Duration::from_secs(config.transcode_timeout_secs),
            retry_after: RETRY_AFTER,
        }
    }
}

/// What one pass did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Settled {
    /// No job was waiting.
    Idle,
    /// The job's asset is `ready`.
    Ready,
    /// The job's asset is `failed`, for this reason.
    Failed(String),
    /// The job hit a fault worth retrying and was handed back.
    Retrying,
    /// The row stopped being `processing` while the job ran — swept, or
    /// settled elsewhere — and the job's output was discarded.
    Abandoned,
}

/// Why one job did not produce a rendition.
enum JobError {
    /// The upload will never become servable; the asset fails with this.
    Refused(&'static str),
    /// Worth another attempt.
    Transient(String),
    /// The row was no longer ours to settle.
    Gone,
}

/// The worker loop, spawned once per worker at startup.
///
/// A job that settles is followed straight by the next claim, so a queue
/// drains without waiting out the poll; only an empty queue sleeps.
pub async fn ingest_loop(
    pool: PgPool,
    blobs: Arc<dyn BlobStore>,
    config: MediaConfig,
    ffmpeg: Option<Arc<Ffmpeg>>,
) {
    let settings = IngestSettings::from_config(&config);
    let mut ticker = tokio::time::interval(settings.poll);
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        match ingest_once(&pool, blobs.as_ref(), &config, ffmpeg.as_deref(), settings).await {
            Ok(Settled::Idle) => {
                ticker.tick().await;
            }
            Ok(_) => {}
            Err(e) => {
                tracing::warn!(error = %e, "media ingest claim failed");
                ticker.tick().await;
            }
        }
    }
}

/// Claims one job, if there is one, and settles it.
///
/// The rendition is written under a key of its own per attempt, never one
/// derived from the asset id: two attempts at one job — a lease that
/// lapsed under a stalled worker — then write two objects, and each
/// attempt can only ever delete its own.
pub async fn ingest_once(
    pool: &PgPool,
    blobs: &dyn BlobStore,
    config: &MediaConfig,
    ffmpeg: Option<&Ffmpeg>,
    settings: IngestSettings,
) -> Result<Settled, sqlx::Error> {
    let lease_secs = settings.lease.as_secs_f64();
    let Some(job) = store::claim_ingest(pool, lease_secs).await? else {
        return Ok(Settled::Idle);
    };

    if job.attempts > MAX_ATTEMPTS {
        return fail(pool, blobs, &job, REASON_GAVE_UP).await;
    }

    let rendition_key = storage_key(Uuid::new_v4(), video::MIME);
    let work = run_job(blobs, config, ffmpeg, settings, &job, &rendition_key);
    tokio::pin!(work);
    let mut renew = tokio::time::interval(settings.lease / 3);
    renew.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    renew.tick().await;
    let outcome = loop {
        tokio::select! {
            outcome = &mut work => break outcome,
            _ = renew.tick() => match store::renew_ingest_lease(pool, job.id, lease_secs).await {
                Ok(true) => {}
                Ok(false) => break Err(JobError::Gone),
                Err(e) => tracing::warn!(error = %e, id = %job.id, "ingest lease not renewed"),
            },
        }
    };

    match outcome {
        Ok(rendition) => settle_ready(pool, blobs, &job, rendition).await,
        Err(JobError::Refused(why)) => fail(pool, blobs, &job, why).await,
        Err(JobError::Transient(detail)) => {
            tracing::warn!(id = %job.id, attempt = job.attempts, detail, "media ingest will retry");
            store::release_ingest(pool, job.id, settings.retry_after.as_secs_f64()).await?;
            Ok(Settled::Retrying)
        }
        Err(JobError::Gone) => {
            discard(blobs, &rendition_key).await;
            Ok(Settled::Abandoned)
        }
    }
}

/// A rendition written to the store and waiting for its row.
struct Written {
    key: String,
    digest: [u8; 32],
    size_bytes: i64,
    options: serde_json::Value,
}

/// Re-encodes one upload and writes the result, touching no row.
async fn run_job(
    blobs: &dyn BlobStore,
    config: &MediaConfig,
    ffmpeg: Option<&Ffmpeg>,
    settings: IngestSettings,
    job: &store::IngestJob,
    key: &str,
) -> Result<Written, JobError> {
    let ffmpeg = ffmpeg.ok_or(JobError::Refused(REASON_NO_ENCODER))?;
    let source = blobs
        .get(&job.storage_key)
        .await
        .map_err(|e| JobError::Transient(format!("reading the upload: {e}")))?;

    let scratch = tokio::task::spawn_blocking(tempfile::tempdir)
        .await
        .map_err(|e| JobError::Transient(e.to_string()))?
        .map_err(|e| JobError::Transient(format!("scratch directory: {e}")))?;
    let input = scratch.path().join("upload.mp4");
    let output = scratch.path().join("rendition.mp4");

    let (caps, video_bps) = plan(config, job.scale, &job.options);
    let source_probe = video::probe(&source).ok();
    let transfer = transfer_of(source_probe);
    if transfer.is_hdr() && !ffmpeg.tone_maps() {
        return Err(JobError::Refused(REASON_NO_TONE_MAP));
    }
    let video_plan =
        video_plan_if_in_target(source_probe, source.len() as u64, caps.video_bytes as u64)
            .unwrap_or(VideoPlan::Encode {
                bps: video_bps,
                transfer,
            });
    tokio::fs::write(&input, source)
        .await
        .map_err(|e| JobError::Transient(format!("writing the upload to scratch: {e}")))?;
    match ffmpeg
        .transcode(&input, &output, video_plan, settings.deadline)
        .await
    {
        Ok(()) => {}
        Err(e @ TranscodeError::Failed { .. }) => {
            tracing::warn!(id = %job.id, error = %e, "ffmpeg refused an upload");
            return Err(JobError::Refused(REASON_DID_NOT_ENCODE));
        }
        Err(e) => return Err(JobError::Transient(e.to_string())),
    }

    let rendition = tokio::fs::read(&output)
        .await
        .map_err(|e| JobError::Transient(format!("reading the rendition: {e}")))?;
    let processed = tokio::task::spawn_blocking(move || process(&rendition, caps))
        .await
        .map_err(|e| JobError::Transient(e.to_string()))?
        .map_err(|e| {
            tracing::warn!(id = %job.id, error = %e, "the pipeline refused a rendition");
            JobError::Refused(refusal(&e))
        })?;
    assert_rendition_is_aac(job.id, &processed)?;

    let written = Written {
        key: key.to_string(),
        digest: processed.digest,
        size_bytes: i64::try_from(processed.bytes.len())
            .map_err(|e| JobError::Transient(e.to_string()))?,
        options: asset_options(&processed),
    };
    blobs
        .put(key, processed.bytes, processed.mime)
        .await
        .map_err(|e| JobError::Transient(format!("writing the rendition: {e}")))?;
    Ok(written)
}

/// The caps a job's rendition is held to, and the video rate it is encoded
/// at.
///
/// Both follow from the destination the upload named: a comment clip is
/// re-encoded to fit a comment, never to a size only a post may carry, and
/// the rendition is validated against the same cap the rate was planned
/// for.
fn plan(
    config: &MediaConfig,
    scale: store::MediaScale,
    options: &serde_json::Value,
) -> (UploadCaps, u64) {
    let caps = config.caps_for(scale.into());
    let duration_ms = options.get("duration_ms").and_then(|v| v.as_u64());
    (caps, video_bps_for(duration_ms, caps.video_bytes as u64))
}

/// The transfer an upload's own SPS states, off the probe the job ran to
/// plan the video track ([`video_plan_if_in_target`]) — the same header
/// read the upload ran, repeated here because the job holds the bytes
/// and nothing else. An upload whose probe failed carries no signal, and
/// is re-encoded as the SDR it is taken to be.
fn transfer_of(probe: Option<Probe>) -> Transfer {
    probe
        .and_then(|probe| probe.signal)
        .map_or(Transfer::Sdr, |signal| signal.transfer)
}

/// Whether the upload's own video track is already the served target —
/// canvas, rate, and an SDR 8-bit 4:2:0 signal
/// ([`transcode::within_target`], [`video::Signal::is_served`]) — in
/// which case ffmpeg can copy it (`VideoPlan::Copy`) rather than
/// re-encode it. A rendition is only ever reached because *something*
/// was outside target; when video was not that something, its bytes are
/// ones ffmpeg does not have to touch.
///
/// `None` when there is nothing to state either way — the probe failed,
/// or the video itself is outside target — and the caller falls back to
/// [`VideoPlan::Encode`].
fn video_plan_if_in_target(
    probe: Option<Probe>,
    size_bytes: u64,
    cap_bytes: u64,
) -> Option<VideoPlan> {
    let probe = probe?;
    let in_target = transcode::within_target(
        probe.width,
        probe.height,
        probe.duration_ms,
        size_bytes,
        cap_bytes,
    ) && probe.signal.is_none_or(|signal| signal.is_served());
    in_target.then_some(VideoPlan::Copy)
}

/// The author-facing sentence for a rendition the pipeline refused.
///
/// The one refusal an author can act on is the size: a clip long enough
/// that even the floor rate overruns the cap. Anything else means the
/// encoder produced something the pipeline would not store, which is the
/// server's fault and reads as a failed re-encode.
fn refusal(e: &super::MediaError) -> &'static str {
    match e {
        super::MediaError::TooLarge { .. } => REASON_TOO_LONG,
        _ => REASON_DID_NOT_ENCODE,
    }
}

/// The witness guarantee's last gate: a rendition is the bytes a digest
/// is about to be committed over, and ffmpeg's own recipe
/// ([`transcode::Ffmpeg::args`]) always re-encodes audio to AAC. If it
/// ever produced anything else, the encode did not do its job, and the
/// job fails the same way any other refused rendition does.
fn assert_rendition_is_aac(
    job_id: Uuid,
    processed: &super::ProcessedAsset,
) -> Result<(), JobError> {
    if processed.audio_aac {
        return Ok(());
    }
    tracing::warn!(id = %job_id, "ffmpeg's own rendition did not come out AAC");
    Err(JobError::Refused(REASON_DID_NOT_ENCODE))
}

/// Points the row at its rendition, then drops the original.
async fn settle_ready(
    pool: &PgPool,
    blobs: &dyn BlobStore,
    job: &store::IngestJob,
    written: Written,
) -> Result<Settled, sqlx::Error> {
    let rendition = store::Rendition {
        digest: &written.digest,
        storage_key: &written.key,
        size_bytes: written.size_bytes,
        options: &written.options,
    };
    match store::finish_ingest(pool, job.id, rendition).await {
        Ok(Some(_)) => {
            discard(blobs, &job.storage_key).await;
            Ok(Settled::Ready)
        }
        Ok(None) => {
            discard(blobs, &written.key).await;
            Ok(Settled::Abandoned)
        }
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            discard(blobs, &written.key).await;
            fail(pool, blobs, job, REASON_DUPLICATE).await
        }
        Err(e) => Err(e),
    }
}

/// Settles the row as failed and drops the original, which nobody will
/// ever be served.
async fn fail(
    pool: &PgPool,
    blobs: &dyn BlobStore,
    job: &store::IngestJob,
    why: &str,
) -> Result<Settled, sqlx::Error> {
    if store::fail_ingest(pool, job.id, why).await? {
        discard(blobs, &job.storage_key).await;
        Ok(Settled::Failed(why.to_string()))
    } else {
        Ok(Settled::Abandoned)
    }
}

/// Deletes an object nothing will reference. A failure is logged and no
/// more: an unreferenced object costs storage and nothing else, the same
/// trade every cleanup in this module makes.
async fn discard(blobs: &dyn BlobStore, key: &str) {
    if let Err(e) = blobs.delete(key).await {
        tracing::warn!(error = %e, key, "media ingest left an unreferenced object");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn probe(width: u32, height: u32, duration_ms: u64, audio_aac: bool) -> Probe {
        Probe {
            width,
            height,
            duration_ms: Some(duration_ms),
            signal: None,
            audio_aac,
        }
    }

    /// A source whose own video is already within target — canvas, rate,
    /// and (no signal at all, here, which reads as served) — is planned
    /// as a copy whatever its audio is, because copying is a video
    /// question alone. One outside it, or with no probe to read at all,
    /// falls back to an encode.
    ///
    /// A source video already within target is planned as a copy, never an encode.
    /// ´claim:media:an-in-target-video-is-planned-as-a-copy´
    #[test]
    fn an_in_target_video_is_copied_whatever_its_audio() {
        const CAP: u64 = 100 * 1024 * 1024;
        let lean = probe(1080, 1920, 30_000, false);
        let size = 4_300_000u64 * 30 / 8;
        assert!(
            matches!(
                video_plan_if_in_target(Some(lean), size, CAP),
                Some(VideoPlan::Copy)
            ),
            "a phone-shaped clip is in target on video alone"
        );

        let wide = probe(2560, 1440, 30_000, true);
        assert!(
            video_plan_if_in_target(Some(wide), 1_000_000, CAP).is_none(),
            "a canvas over 1080 on its short side falls back to an encode"
        );

        assert!(
            video_plan_if_in_target(None, size, CAP).is_none(),
            "no probe to read is no fact to state either way"
        );
    }

    /// A 150-second clip fits a post at the standard rate, and a comment
    /// only at a lower one: 92 % of 50 MiB is 385 875 968 bits, over 150 s
    /// is 2 572 506 bps, less the 128 000 of audio is 2 444 506. The
    /// rendition is then held to the cap the rate was planned for.
    ///
    /// A re-encode plans for, and validates against, the cap of the destination the upload named.
    /// ´claim:media:a-re-encode-is-sized-for-its-destination´
    #[test]
    fn a_job_is_planned_for_the_destination_it_named() {
        let config = MediaConfig::default();
        let options = serde_json::json!({ "v": 1, "duration_ms": 150_000 });

        let (post_caps, post_bps) = plan(&config, store::MediaScale::Post, &options);
        assert_eq!(post_bps, super::super::transcode::STANDARD_VIDEO_BPS);
        assert_eq!(post_caps.video_bytes, 100 * 1024 * 1024);

        let (comment_caps, comment_bps) = plan(&config, store::MediaScale::Comment, &options);
        assert_eq!(comment_bps, 2_444_506);
        assert_eq!(comment_caps.video_bytes, 50 * 1024 * 1024);
    }

    /// An HDR upload on a server whose ffmpeg cannot tone-map is refused
    /// with a reason its author reads, before ffmpeg runs: re-encoded
    /// without the tone map it would play washed out under a digest that
    /// can never be replaced.
    ///
    /// An HDR upload fails with a reason when the server's ffmpeg cannot tone-map it.
    /// ´claim:media:hdr-without-a-tone-map-fails-with-a-reason´
    #[tokio::test]
    async fn an_hdr_upload_without_a_tone_map_is_refused() {
        let blobs = super::super::blob::in_memory();
        let source = video::tests::h264_with_sps(&video::tests::SPS_PQ);
        assert!(transfer_of(video::probe(&source).ok()).is_hdr());
        blobs
            .put("ingest/hdr.mp4", source, video::MIME)
            .await
            .expect("the upload is stored");
        let job = store::IngestJob {
            id: Uuid::new_v4(),
            author_id: Uuid::new_v4(),
            storage_key: "ingest/hdr.mp4".into(),
            mime_type: video::MIME.into(),
            options: serde_json::json!({ "v": 1, "duration_ms": 2_500 }),
            scale: store::MediaScale::Post,
            attempts: 1,
        };
        let config = MediaConfig::default();
        let outcome = run_job(
            &blobs,
            &config,
            Some(&Ffmpeg::without_tone_map()),
            IngestSettings::from_config(&config),
            &job,
            "rendition.mp4",
        )
        .await;
        assert!(
            matches!(outcome, Err(JobError::Refused(REASON_NO_TONE_MAP))),
            "refused for want of a tone map"
        );
    }
}
