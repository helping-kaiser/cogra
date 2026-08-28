//! ´mod:module:media´
//!
//! Media carriage: what happens to an uploaded picture between the wire
//! and the row that points at it.
//!
//! Uploading is not an act. It mints no record, authors nothing, and
//! therefore costs no θ — the only priced act in a media post is the
//! Publish that carries the digests. That is why every control in this
//! module is an L2 policy limit rather than an economic one: a gallery of
//! twenty photos and a text post cost the author exactly the same, so
//! size, rate, and format are the whole of the cost story.
//!
//! The pipeline, in the order it must run:
//!
//! 1. **Sniff** the container out of the bytes. The declared content type
//!    is the client's claim about the file and is never evidence.
//! 2. **Strip** the metadata chunks. A phone photo carries GPS
//!    coordinates and a device serial, reads here are public and
//!    unauthenticated, so publishing one untouched publishes where the
//!    author lives. Clients strip before uploading; this is the check
//!    that makes it true rather than hoped for.
//! 3. **Probe** by decoding. Bytes that do not decode are not an image
//!    whatever their header says, and the dimensions the decode yields
//!    are where the aspect ratio comes from.
//! 4. **Digest** the stripped bytes — after the strip, so the digest
//!    describes exactly what the store holds and what any reader can
//!    recompute from what they were served.
//! 5. **Write the object, then the row.** The two are not one
//!    transaction. An orphaned object is collectable garbage; a row
//!    pointing at nothing is a render that can never succeed.
//!
//! Nothing here transforms the picture: no thumbnails, no downscale, no
//! rendition ladder. Clients crop and re-encode on device, so the stored
//! bytes are already the bytes the post is made of, and the URL carries
//! no size — renditions stay addable later without a contract change.

pub mod blob;
pub mod webp;

use std::sync::Arc;

use postgres_store::PgPool;
use postgres_store::media as store;
use sha2::{Digest, Sha256};
use uuid::Uuid;

pub use blob::{BlobError, BlobStore, S3BlobStore, S3Config};

/// The widest canvas a decode is allowed to open, per axis.
///
/// This is a decompression-bomb bound, not a taste judgement: a
/// compressed image declares its canvas and the decoder allocates the
/// canvas, so a small file can ask for an enormous buffer. 4096 clears
/// every crop the composer produces (4:5 is 3277 × 4096, 1.91:1 is
/// 4096 × 2145) and every twelve-megapixel phone photo (4032 × 3024),
/// and refuses the forty-eight-megapixel originals clients are supposed
/// to downscale before they ever reach the wire.
pub const MAX_PIXEL_DIMENSION: u32 = 4096;

/// What the byte pipeline can refuse, and why. Every variant is a
/// field-level refusal on the uploaded file rather than a server fault:
/// the client sent something, and it can be told exactly what was wrong
/// with it.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum MediaError {
    #[error("only WebP images are accepted")]
    NotWebp,
    #[error("the image file is malformed ({0})")]
    Malformed(&'static str),
    #[error("the file does not decode as an image")]
    Undecodable,
    #[error("animated images are not accepted yet")]
    Animated,
    #[error("the image is larger than {limit} bytes")]
    TooLarge { limit: usize },
}

/// How to reach the media service and what to allow through it.
#[derive(Debug, Clone)]
pub struct MediaConfig {
    pub s3: S3Config,
    /// The origin every `MediaAttachment.url` is minted against — the
    /// media service's own, never the API's. Bytes leave through the
    /// store, so a CDN can sit in front of it without the contract
    /// changing shape.
    pub base_url: String,
    /// The per-asset byte cap. Enforced at the multipart transport before
    /// a byte reaches a resolver, and re-checked here so the two cannot
    /// drift apart silently.
    pub max_upload_bytes: usize,
    pub orphan_reaper_interval_secs: u64,
    pub orphan_max_age_secs: f64,
}

const DEFAULT_MAX_UPLOAD_BYTES: usize = 10 * 1024 * 1024;
const DEFAULT_ORPHAN_REAPER_INTERVAL_SECS: u64 = 600;
const DEFAULT_ORPHAN_MAX_AGE_SECS: f64 = 86_400.0;

fn env_or(var: &str, fallback: &str) -> String {
    std::env::var(var).unwrap_or_else(|_| fallback.to_string())
}

fn env_parsed<T: std::str::FromStr>(var: &str, fallback: T) -> anyhow::Result<T>
where
    T::Err: std::fmt::Display,
{
    match std::env::var(var) {
        Err(_) => Ok(fallback),
        Ok(raw) => raw
            .parse()
            .map_err(|e| anyhow::anyhow!("{var} must be a number: {e}")),
    }
}

impl MediaConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            s3: S3Config {
                endpoint: env_or("MEDIA_S3_ENDPOINT", "http://localhost:9000"),
                bucket: env_or("MEDIA_BUCKET", "cogra-media"),
                access_key_id: env_or("MEDIA_ACCESS_KEY_ID", "cogra_media"),
                secret_access_key: env_or("MEDIA_SECRET_ACCESS_KEY", "cogra_media_secret"),
                region: env_or("MEDIA_REGION", "us-east-1"),
            },
            base_url: env_or("MEDIA_BASE_URL", "http://localhost:3000/media")
                .trim_end_matches('/')
                .to_string(),
            max_upload_bytes: env_parsed("MEDIA_MAX_UPLOAD_BYTES", DEFAULT_MAX_UPLOAD_BYTES)?,
            orphan_reaper_interval_secs: env_parsed(
                "MEDIA_ORPHAN_REAPER_INTERVAL_SECS",
                DEFAULT_ORPHAN_REAPER_INTERVAL_SECS,
            )?,
            orphan_max_age_secs: env_parsed(
                "MEDIA_ORPHAN_MAX_AGE_SECS",
                DEFAULT_ORPHAN_MAX_AGE_SECS,
            )?,
        })
    }
}

/// The bytes as they will be stored, and what was learned proving it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessedAsset {
    pub bytes: Vec<u8>,
    pub digest: [u8; 32],
    pub width: u32,
    pub height: u32,
}

impl ProcessedAsset {
    /// The container ratio the layout reserves space with, in lowest
    /// terms so `1080 × 1350` and `4 × 5` describe the same shape with
    /// the same string.
    pub fn aspect_ratio(&self) -> String {
        let divisor = gcd(self.width, self.height).max(1);
        format!("{}:{}", self.width / divisor, self.height / divisor)
    }
}

fn gcd(a: u32, b: u32) -> u32 {
    if b == 0 { a } else { gcd(b, a % b) }
}

/// Sniff, strip, probe, digest — the whole byte pipeline, with no I/O in
/// it. Synchronous and CPU-bound by nature (a decode is a decode), so
/// callers run it off the async runtime.
pub fn process(bytes: &[u8], max_upload_bytes: usize) -> Result<ProcessedAsset, MediaError> {
    if bytes.len() > max_upload_bytes {
        return Err(MediaError::TooLarge {
            limit: max_upload_bytes,
        });
    }
    if !webp::sniff(bytes) {
        return Err(MediaError::NotWebp);
    }
    let stripped = webp::strip_metadata(bytes)?;
    let probe = webp::probe(&stripped)?;
    let digest: [u8; 32] = Sha256::digest(&stripped).into();
    Ok(ProcessedAsset {
        bytes: stripped,
        digest,
        width: probe.width,
        height: probe.height,
    })
}

/// The object key for an asset id. Server-generated end to end: nothing
/// a client sent reaches it, so a traversal or a collision with someone
/// else's object is unrepresentable rather than defended against.
pub fn storage_key(id: Uuid) -> String {
    format!("{id}.webp")
}

/// The absolute URL a reader fetches the bytes from.
pub fn public_url(base_url: &str, storage_key: &str) -> String {
    format!("{}/{}", base_url.trim_end_matches('/'), storage_key)
}

/// Writes the object, then the row.
///
/// A retried upload of the same picture by the same author resolves to
/// the row that already exists — the object written on this attempt is
/// then an orphan, and it is deleted here rather than left for the
/// sweeper, because the sweeper's window is a day and this is known now.
/// Failing that delete is logged and no more: the row is correct, and an
/// unreferenced object is exactly what the sweeper exists for.
pub async fn store_asset(
    pool: &PgPool,
    blobs: &dyn BlobStore,
    author: Uuid,
    asset: ProcessedAsset,
    alt_text: Option<&str>,
) -> anyhow::Result<store::MediaAttachment> {
    let id = Uuid::new_v4();
    let key = storage_key(id);
    let size_bytes = i64::try_from(asset.bytes.len())?;
    let options = serde_json::json!({ "v": 1, "aspect_ratio": asset.aspect_ratio() });

    blobs.put(&key, asset.bytes, webp::MIME).await?;

    let row = store::insert(
        pool,
        id,
        author,
        &asset.digest,
        "sha256",
        &key,
        webp::MIME,
        size_bytes,
        alt_text,
        &options,
    )
    .await?;

    if row.storage_key != key
        && let Err(e) = blobs.delete(&key).await
    {
        tracing::warn!(error = %e, key, "leaving a duplicate upload's object to the sweeper");
    }
    Ok(row)
}

/// The orphan sweep (development.md, `MEDIA_ORPHAN_*`): the same reaper
/// shape the account and rate-limit sweeps use.
///
/// Rows go first and their objects after, so a crash between the two
/// leaves an unreferenced object — the failure mode the whole write
/// ordering is chosen to prefer. An object whose delete fails is simply
/// not retried: it is unreferenced, it costs storage and nothing else,
/// and a retry queue for it would be more machinery than the problem.
pub async fn orphan_reaper_loop(
    pool: PgPool,
    blobs: Arc<dyn BlobStore>,
    interval_secs: u64,
    max_age_secs: f64,
) {
    let mut ticker = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        ticker.tick().await;
        match store::sweep_orphans(&pool, max_age_secs).await {
            Ok(swept) if swept.is_empty() => {}
            Ok(swept) => {
                tracing::debug!(rows = swept.len(), "media sweeper collected orphans");
                for asset in swept {
                    if let Err(e) = blobs.delete(&asset.storage_key).await {
                        tracing::warn!(error = %e, id = %asset.id, "orphan object not removed");
                    }
                }
            }
            Err(e) => tracing::warn!(error = %e, "media orphan sweep failed"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn one_pixel() -> Vec<u8> {
        let payload: [u8; 8] = [0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08];
        let mut out = Vec::new();
        out.extend_from_slice(b"RIFF");
        out.extend_from_slice(&((12 + payload.len()) as u32).to_le_bytes());
        out.extend_from_slice(b"WEBP");
        out.extend_from_slice(b"VP8L");
        out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        out.extend_from_slice(&payload);
        out
    }

    fn ratio(width: u32, height: u32) -> String {
        ProcessedAsset {
            bytes: Vec::new(),
            digest: [0; 32],
            width,
            height,
        }
        .aspect_ratio()
    }

    /// The three crop shapes the composer offers, at the pixel sizes a
    /// phone actually produces, plus the degenerate ends.
    #[test]
    fn the_aspect_ratio_is_the_shape_in_lowest_terms() {
        assert_eq!(ratio(1080, 1350), "4:5");
        assert_eq!(ratio(1080, 1080), "1:1");
        assert_eq!(ratio(1080, 566), "540:283");
        assert_eq!(ratio(1920, 1080), "16:9");
        assert_eq!(ratio(4032, 3024), "4:3");
        assert_eq!(ratio(1, 1), "1:1");
        assert_eq!(ratio(1023, 1367), "1023:1367");
    }

    #[test]
    fn processing_accepts_a_real_image_and_digests_what_it_stores() {
        let processed = process(&one_pixel(), DEFAULT_MAX_UPLOAD_BYTES).expect("a valid image");
        assert_eq!(processed.width, 1);
        assert_eq!(processed.height, 1);
        let recomputed: [u8; 32] = Sha256::digest(&processed.bytes).into();
        assert_eq!(
            processed.digest, recomputed,
            "the digest is over the stored bytes, not the uploaded ones"
        );
    }

    /// The digest a reader recomputes from the served bytes has to match
    /// the one the envelope commits — which is only true if the strip
    /// happens before the digest, never after.
    #[test]
    fn stripping_metadata_changes_the_digest() {
        let clean = one_pixel();
        let mut with_exif = Vec::new();
        with_exif.extend_from_slice(b"RIFF");
        let body_len = clean.len() - 12 + 8 + 8;
        with_exif.extend_from_slice(&((4 + body_len) as u32).to_le_bytes());
        with_exif.extend_from_slice(b"WEBP");
        with_exif.extend_from_slice(clean.get(12..).unwrap_or_default());
        with_exif.extend_from_slice(b"EXIF");
        with_exif.extend_from_slice(&8u32.to_le_bytes());
        with_exif.extend_from_slice(b"52.5200N");

        let bare = process(&clean, DEFAULT_MAX_UPLOAD_BYTES).expect("a valid image");
        let stripped = process(&with_exif, DEFAULT_MAX_UPLOAD_BYTES).expect("a valid image");
        assert_eq!(bare.digest, stripped.digest, "the same picture, one digest");
        assert_eq!(bare.bytes, stripped.bytes);
        assert_ne!(
            Sha256::digest(&with_exif).as_slice(),
            stripped.digest.as_slice(),
            "the uploaded bytes are not what is committed"
        );
    }

    #[test]
    fn processing_refuses_what_the_policy_excludes() {
        assert_eq!(
            process(b"GIF89a and the rest", DEFAULT_MAX_UPLOAD_BYTES),
            Err(MediaError::NotWebp)
        );
        assert_eq!(
            process(&one_pixel(), 4),
            Err(MediaError::TooLarge { limit: 4 })
        );
    }

    /// A file's own claim about its type never gets a vote — the caller
    /// hands over bytes and the bytes decide.
    #[test]
    fn a_renamed_file_is_still_refused() {
        let mut png = Vec::from(b"\x89PNG\r\n\x1a\n".as_slice());
        png.extend_from_slice(&[0; 64]);
        assert_eq!(
            process(&png, DEFAULT_MAX_UPLOAD_BYTES),
            Err(MediaError::NotWebp)
        );
    }

    #[test]
    fn the_storage_key_and_url_are_derived_from_the_id_alone() {
        let id = Uuid::from_bytes([3; 16]);
        let key = storage_key(id);
        assert_eq!(key, format!("{id}.webp"));
        assert_eq!(
            public_url("https://media.example/bucket/", &key),
            format!("https://media.example/bucket/{id}.webp")
        );
    }
}
