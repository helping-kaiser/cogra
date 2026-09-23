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
//! Nothing here transforms a picture: no thumbnails, no downscale, no
//! rendition ladder. Clients crop and re-encode stills on device, so the
//! stored bytes are already the bytes the post is made of, and the URL
//! carries no size — renditions stay addable later without a contract
//! change.
//!
//! **A video is held to a target instead.** Clients compress where they
//! can, and the same probe that proves an upload decides whether it is
//! within the served target ([`transcode`]). One that is stored `ready`
//! at once; one that is not is stored `processing`, and the [`ingest_queue`]
//! worker re-encodes it before anything may attach it. Either way the
//! bytes a digest is committed over are the only bytes the asset ever
//! serves.

pub mod blob;
pub mod ingest_queue;
pub mod resumable;
pub mod transcode;
pub mod video;
pub mod webp;

use std::sync::Arc;

use postgres_store::PgPool;
use postgres_store::media as store;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::env_or;

pub use blob::{BlobError, BlobStore, ObjectBlobStore, S3Config};

/// The widest canvas the pipeline admits, per axis.
///
/// For a still this is a decompression-bomb bound: a compressed image
/// declares its canvas and the decoder allocates the canvas, so a small
/// file can ask for an enormous buffer. 4096 clears every crop the
/// composer produces (4:5 is 3277 × 4096, 1.91:1 is 4096 × 2145) and
/// every twelve-megapixel phone photo (4032 × 3024), and refuses the
/// forty-eight-megapixel originals clients are supposed to downscale
/// before they ever reach the wire.
///
/// A video is never decoded here, so the bound is not about allocation
/// on this side — but the declared canvas is not inert either: it is
/// what `aspectRatio` is derived from and what a client reserves layout
/// with. A container declaring 65535 × 65535 would serve a plausible
/// "1:1" for a canvas no reader can lay out. The same number bounds both
/// because it is the same statement — the widest picture this pipeline
/// carries — and it clears DCI 4K (4096 × 2160).
pub const MAX_PIXEL_DIMENSION: u32 = 4096;

/// What a probe learned about the stored bytes: the canvas, the playing
/// time where the format states one, and a video's signal.
///
/// One type for both formats. They differ only in which facts are always
/// present, which is what the `Option`s say — two nearly identical types
/// differing in those fields is a distinction the caller has to re-unify
/// anyway.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Probe {
    pub width: u32,
    pub height: u32,
    /// Milliseconds of playback. Video always states one — a fact about
    /// the asset, never a limit on it: there is deliberately no duration
    /// cap. A still states one only when it is animated.
    pub duration_ms: Option<u64>,
    /// What a video's own bitstream says about its samples — bit depth,
    /// chroma format, transfer. Absent on a still, and on a clip whose
    /// sequence parameter set does not parse.
    pub signal: Option<video::Signal>,
}

/// What the byte pipeline can refuse, and why. Every variant is a
/// field-level refusal on the uploaded file rather than a server fault:
/// the client sent something, and it can be told exactly what was wrong
/// with it.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum MediaError {
    #[error("only WebP images and MP4 video are accepted")]
    Unsupported,
    #[error("the file is malformed ({0})")]
    Malformed(&'static str),
    #[error("the file does not decode")]
    Undecodable,
    #[error("{0}")]
    Codec(&'static str),
    #[error("the file is larger than {limit} bytes")]
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
    /// The per-asset byte cap for a still. Enforced at the multipart
    /// transport before a byte reaches a resolver, and re-checked here so
    /// the two cannot drift apart silently.
    pub max_upload_bytes: usize,
    /// The per-asset byte cap for video, ten times the still's.
    ///
    /// The parity is with the *body* rather than with one picture: a post
    /// carries ten pictures or one video, so ten stills at their cap and
    /// one video at this one are the same hundred megabytes. A video post
    /// can reach 110 MiB with its cover, which is accepted for the
    /// friendlier round number.
    ///
    /// There is deliberately **no duration cap** beside it. A long, low
    /// bitrate video is a legitimate thing to publish, and the byte cap
    /// already bounds what the store holds and what a reader downloads.
    pub max_video_upload_bytes: usize,
    pub orphan_reaper_interval_secs: u64,
    pub orphan_max_age_secs: f64,
    /// How large a piece a resumable upload is cut into.
    ///
    /// The server dictates this rather than the client proposing it,
    /// because getting it wrong is only discovered at assembly: S3
    /// requires every part but the last to clear
    /// [`MIN_MULTIPART_PART_BYTES`], so a client that guessed smaller
    /// would upload an entire file and have the completion refuse it.
    ///
    /// It is also the knob that decides what a blip costs. A dropped
    /// connection loses at most the part in flight, so a smaller part
    /// means a cheaper retry and more round trips — which is the trade
    /// S3's own guidance names when it recommends smaller parts over a
    /// spotty network.
    pub upload_part_size_bytes: usize,
    /// How long an unfinished upload may sit before the sweep collects
    /// it and releases its parts.
    pub upload_session_ttl_secs: f64,
    /// The ffmpeg the ingest worker drives — a name looked up on `PATH`,
    /// or a path.
    pub ffmpeg: String,
    /// The longest one re-encode may run before it is killed and retried.
    pub transcode_timeout_secs: u64,
    /// How long an idle ingest worker waits before looking for work.
    pub ingest_poll_secs: u64,
    /// How long a worker's claim on a job holds without renewal — the
    /// most a restart delays the job that was in flight.
    pub ingest_lease_secs: u64,
    /// How many ingest workers run in this process. Each drives one
    /// ffmpeg at a time, and ffmpeg spreads one encode over every core,
    /// so one is the right number until uploads queue behind each other.
    pub ingest_workers: usize,
}

const DEFAULT_MAX_UPLOAD_BYTES: usize = 10 * 1024 * 1024;
const DEFAULT_TRANSCODE_TIMEOUT_SECS: u64 = 1800;
const DEFAULT_INGEST_POLL_SECS: u64 = 2;
const DEFAULT_INGEST_LEASE_SECS: u64 = 60;
const DEFAULT_INGEST_WORKERS: usize = 1;
const DEFAULT_MAX_VIDEO_UPLOAD_BYTES: usize = 100 * 1024 * 1024;
const DEFAULT_ORPHAN_REAPER_INTERVAL_SECS: u64 = 600;
const DEFAULT_ORPHAN_MAX_AGE_SECS: f64 = 86_400.0;

/// The smallest a non-final part may be, fixed by S3 and inherited by
/// every store that speaks it. Configuration is checked against this
/// rather than trusted, because a part size below it produces an upload
/// that accepts every part and then refuses to assemble.
pub const MIN_MULTIPART_PART_BYTES: usize = 5 * 1024 * 1024;

const DEFAULT_UPLOAD_PART_SIZE_BYTES: usize = 8 * 1024 * 1024;

/// Where a client stops sending an upload in one request and opens a
/// resumable session instead.
///
/// One part, deliberately: "below 8 MiB a single-shot `uploadMedia` is
/// one round trip and resumability buys nothing, while every video and
/// any still near its cap belongs on this path" (api-spec.md, "Resuming
/// a large upload"). Both clients switch at this number, and it leaves
/// here through `client-constants.json` so neither has to restate it.
pub const RESUMABLE_THRESHOLD_BYTES: usize = DEFAULT_UPLOAD_PART_SIZE_BYTES;

/// A day, the same window an unreferenced asset gets.
///
/// The two are one policy said twice: an upload nobody finished and an
/// asset nobody attached are both the residue of a compose that was
/// abandoned, and there is no reason for them to age out on different
/// clocks. S3's own guidance is to abort incomplete uploads on a
/// lifecycle rule; this is that rule, run by the server that opened them.
const DEFAULT_UPLOAD_SESSION_TTL_SECS: f64 = 86_400.0;

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

impl Default for MediaConfig {
    fn default() -> Self {
        Self {
            s3: S3Config {
                endpoint: "http://localhost:9000".into(),
                bucket: "cogra-media".into(),
                access_key_id: "cogra_media".into(),
                secret_access_key: "cogra_media_secret".into(),
                region: "us-east-1".into(),
            },
            base_url: "http://localhost:3000/media".into(),
            max_upload_bytes: DEFAULT_MAX_UPLOAD_BYTES,
            max_video_upload_bytes: DEFAULT_MAX_VIDEO_UPLOAD_BYTES,
            orphan_reaper_interval_secs: DEFAULT_ORPHAN_REAPER_INTERVAL_SECS,
            orphan_max_age_secs: DEFAULT_ORPHAN_MAX_AGE_SECS,
            upload_part_size_bytes: DEFAULT_UPLOAD_PART_SIZE_BYTES,
            upload_session_ttl_secs: DEFAULT_UPLOAD_SESSION_TTL_SECS,
            ffmpeg: "ffmpeg".into(),
            transcode_timeout_secs: DEFAULT_TRANSCODE_TIMEOUT_SECS,
            ingest_poll_secs: DEFAULT_INGEST_POLL_SECS,
            ingest_lease_secs: DEFAULT_INGEST_LEASE_SECS,
            ingest_workers: DEFAULT_INGEST_WORKERS,
        }
    }
}

impl MediaConfig {
    /// The MEDIA_* overrides on top of the defaults (development.md
    /// "Environment Variables").
    pub fn from_env() -> anyhow::Result<Self> {
        let base = Self::default();
        Ok(Self {
            s3: S3Config {
                endpoint: env_or("MEDIA_S3_ENDPOINT", &base.s3.endpoint),
                bucket: env_or("MEDIA_BUCKET", &base.s3.bucket),
                access_key_id: env_or("MEDIA_ACCESS_KEY_ID", &base.s3.access_key_id),
                secret_access_key: env_or("MEDIA_SECRET_ACCESS_KEY", &base.s3.secret_access_key),
                region: env_or("MEDIA_REGION", &base.s3.region),
            },
            base_url: env_or("MEDIA_BASE_URL", &base.base_url)
                .trim_end_matches('/')
                .to_string(),
            max_upload_bytes: env_parsed("MEDIA_MAX_UPLOAD_BYTES", base.max_upload_bytes)?,
            max_video_upload_bytes: env_parsed(
                "MEDIA_MAX_VIDEO_UPLOAD_BYTES",
                base.max_video_upload_bytes,
            )?,
            orphan_reaper_interval_secs: env_parsed(
                "MEDIA_ORPHAN_REAPER_INTERVAL_SECS",
                base.orphan_reaper_interval_secs,
            )?,
            orphan_max_age_secs: env_parsed("MEDIA_ORPHAN_MAX_AGE_SECS", base.orphan_max_age_secs)?,
            upload_part_size_bytes: {
                let size = env_parsed("MEDIA_UPLOAD_PART_SIZE_BYTES", base.upload_part_size_bytes)?;
                if size < MIN_MULTIPART_PART_BYTES {
                    anyhow::bail!(
                        "MEDIA_UPLOAD_PART_SIZE_BYTES must be at least {MIN_MULTIPART_PART_BYTES} \
                         bytes, the floor S3 puts under every part but the last"
                    );
                }
                size
            },
            upload_session_ttl_secs: env_parsed(
                "MEDIA_UPLOAD_SESSION_TTL_SECS",
                base.upload_session_ttl_secs,
            )?,
            ffmpeg: env_or("MEDIA_FFMPEG", &base.ffmpeg),
            transcode_timeout_secs: env_parsed(
                "MEDIA_TRANSCODE_TIMEOUT_SECS",
                base.transcode_timeout_secs,
            )?,
            ingest_poll_secs: env_parsed("MEDIA_INGEST_POLL_SECS", base.ingest_poll_secs)?,
            ingest_lease_secs: {
                let lease = env_parsed("MEDIA_INGEST_LEASE_SECS", base.ingest_lease_secs)?;
                if lease < 3 {
                    anyhow::bail!(
                        "MEDIA_INGEST_LEASE_SECS must be at least 3: the lease is renewed \
                         every third of itself"
                    );
                }
                lease
            },
            ingest_workers: env_parsed("MEDIA_INGEST_WORKERS", base.ingest_workers)?,
        })
    }

    /// The hard multipart ceiling, distinct from the policy cap.
    ///
    /// The transport cannot produce a GraphQL field error — it refuses
    /// the request before a resolver exists — so the two limits are set
    /// apart deliberately: an ordinary over-cap upload passes the
    /// transport and is refused by the resolver with a readable error
    /// naming `file`, and only a wildly oversized body is cut at the
    /// connection, where a status code is the only answer available.
    ///
    /// It is twice the *larger* cap because the transport reads a body
    /// before anything has sniffed it: which cap applies is a fact about
    /// bytes the transport has not seen yet, so the ceiling has to admit
    /// the widest one and let the resolver refuse by type.
    pub fn transport_limit_bytes(&self) -> usize {
        self.max_upload_bytes
            .max(self.max_video_upload_bytes)
            .saturating_mul(2)
    }

    /// The caps as the byte pipeline takes them, for an upload headed for
    /// `destination`.
    ///
    /// The still cap is one number wherever a picture goes. The video cap
    /// is the destination's own, bounded by the configured one — which is
    /// the widest any upload may be, and so also bounds a comment's.
    pub fn caps_for(&self, destination: GalleryKind) -> UploadCaps {
        UploadCaps {
            still_bytes: self.max_upload_bytes,
            video_bytes: self
                .max_video_upload_bytes
                .min(usize::try_from(destination.video_bytes()).unwrap_or(usize::MAX)),
        }
    }
}

/// The per-type byte caps, carried together because the pipeline picks
/// between them only after it has sniffed what it is holding.
///
/// The video cap is already the destination's: every check an upload
/// meets — the size, whether it is within target, the rate a re-encode
/// plans for, and the validation of the rendition — reads this one number,
/// so a clip is sized for the parent it was uploaded for.
#[derive(Debug, Clone, Copy)]
pub struct UploadCaps {
    pub still_bytes: usize,
    pub video_bytes: usize,
}

/// The bytes as they will be stored, and what was learned proving it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessedAsset {
    pub bytes: Vec<u8>,
    pub digest: [u8; 32],
    pub width: u32,
    pub height: u32,
    /// What the bytes turned out to be, decided by sniffing them rather
    /// than by anything the client declared.
    pub mime: &'static str,
    /// Milliseconds of playback, where the format carries a duration —
    /// video always, an animated still when its frames state one. Null on
    /// a single-frame picture, which is what `durationMs` reads.
    pub duration_ms: Option<u64>,
    /// Whether these bytes must be re-encoded before they may be served:
    /// a video outside the target [`transcode::within_target`] states.
    /// Always false on a still.
    pub needs_transcode: bool,
}

impl ProcessedAsset {
    /// Whether this asset can stand as another's poster. A cover is the
    /// still a reader sees before playback, so a video cannot be one.
    pub fn is_still(&self) -> bool {
        self.mime == webp::MIME
    }
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
///
/// **The sniff picks the path, and the path picks the cap.** Which limit
/// applies is a fact about the bytes, not about anything the client
/// said, so the format is decided first and the size checked second —
/// and checked before any parse, so an oversized file is refused without
/// being walked.
///
/// Both paths strip before they digest. A still drops its metadata
/// chunks and a video drops its metadata boxes, and in each case the
/// digest is taken over what survives — so the stored bytes carry
/// nothing identifying and a reader can recompute the committed digest
/// from exactly what it was served. Neither strip re-encodes anything:
/// the media travels through byte for byte, and a file that arrived
/// clean is stored unchanged.
///
/// The video strip runs before the probe deliberately. The probe is then
/// reading the container that will actually be stored, so a rewrite that
/// damaged the file refuses the upload instead of publishing something
/// that will not play.
///
/// The probe's answer also decides whether a video needs re-encoding —
/// canvas, duration, byte count, and the signal its sequence parameter set
/// states are all it takes — so a clip already within target costs nothing
/// beyond this call. A clip that is HDR, deeper than 8 bits, or not 4:2:0
/// is outside the target whatever its rate: readers are served 8-bit SDR.
pub fn process(bytes: &[u8], caps: UploadCaps) -> Result<ProcessedAsset, MediaError> {
    let format = Format::of(bytes).ok_or(MediaError::Unsupported)?;
    let limit = format.cap(caps);
    if bytes.len() > limit {
        return Err(MediaError::TooLarge { limit });
    }
    let stripped = (format.strip)(bytes)?;
    let probe = (format.probe)(&stripped)?;
    let needs_transcode = !format.still
        && (!transcode::within_target(
            probe.width,
            probe.height,
            probe.duration_ms,
            stripped.len() as u64,
            caps.video_bytes as u64,
        ) || probe.signal.is_some_and(|signal| !signal.is_served()));
    Ok(ProcessedAsset {
        digest: Sha256::digest(&stripped).into(),
        bytes: stripped,
        width: probe.width,
        height: probe.height,
        mime: format.mime,
        duration_ms: probe.duration_ms,
        needs_transcode,
    })
}

/// One stored format's half of the pipeline: the cap that bounds it, the
/// strip that cleans it, the probe that proves it.
///
/// The two formats' passes were written out twice and differed only in
/// which three of these they named, which is exactly the shape a table
/// carries better than a branch: a third format is a row, not another
/// copy of the sniff-cap-strip-probe-digest sequence.
struct Format {
    mime: &'static str,
    still: bool,
    strip: fn(&[u8]) -> Result<Vec<u8>, MediaError>,
    probe: fn(&[u8]) -> Result<Probe, MediaError>,
}

impl Format {
    /// The format the bytes are, decided by the bytes alone.
    fn of(bytes: &[u8]) -> Option<Self> {
        if webp::sniff(bytes) {
            return Some(Self {
                mime: webp::MIME,
                still: true,
                strip: webp::strip_metadata,
                probe: webp::probe,
            });
        }
        if video::sniff(bytes) {
            return Some(Self {
                mime: video::MIME,
                still: false,
                strip: video::strip_metadata,
                probe: video::probe,
            });
        }
        None
    }

    fn cap(&self, caps: UploadCaps) -> usize {
        if self.still {
            caps.still_bytes
        } else {
            caps.video_bytes
        }
    }
}

/// Assets one post's gallery may carry.
///
/// Ten is the batch cap an author already knows from tags and citations,
/// and it covers the widest realistic gesture — a group photo set. It is
/// also a **query-budget input**: the read side prices `Post.attachments`
/// at this many rows, so raising it reprices every read that carries a
/// gallery and the budget suite has to be re-measured, never assumed.
///
/// Uploading is not an act, so θ prices none of this. A count cap is one
/// of the only three cost controls media has (size, count, rate).
pub const MAX_POST_ATTACHMENTS: usize = 10;

/// Assets one comment's gallery may carry. A comment gallery is a
/// supporting picture, not an album — comments are text-plus-optional
/// media, deliberately asymmetric to a post's words-or-media body.
pub const MAX_COMMENT_ATTACHMENTS: usize = 4;

/// How long one picture's description may be.
///
/// It rides the payload envelope, which is bounded whole by `M_payload`
/// (64 KiB at the stand-in). Overrunning that bound is a formation error
/// naming a byte count, so the friendly refusal happens here instead —
/// field-scoped, at prepare, naming the entry the author can still fix.
///
/// The bound lives beside `MAX_POST_ATTACHMENTS` because the two multiply
/// and the product is what has to fit: ten descriptions at this cap is
/// 10 000 characters, ~15% of the envelope in ASCII and under two thirds
/// of it in the worst case UTF-8 admits. Moving either number re-does that
/// arithmetic — it is not headroom either one owns alone.
pub const MAX_ALT_TEXT_CHARS: usize = 1000;

/// The largest video a post will carry — the upload cap restated as a
/// composition rule.
///
/// An upload names the parent it is headed for, and is sized, planned and
/// validated against that parent's cap ([`MediaConfig::caps_for`]). The
/// parent applies its own cap again when the asset is attached, because
/// an asset uploaded for one parent can be attached to the other.
pub const MAX_POST_VIDEO_BYTES: i64 = 100 * 1024 * 1024;

/// The largest video a comment will carry — half a post's.
///
/// A comment is an answer, and its media is a supporting clip rather
/// than a body: the picture caps are already asymmetric for the same
/// reason (four against ten), and the video budget follows them down.
/// The cover rides the still cap either way.
pub const MAX_COMMENT_VIDEO_BYTES: i64 = 50 * 1024 * 1024;

/// Which parent media is headed for: the gallery being planned, or the
/// destination an upload named. The two differ in how many assets they
/// take, in how large a video they carry, and in whether a cover means
/// anything.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GalleryKind {
    Post,
    Comment,
}

impl From<GalleryKind> for store::MediaScale {
    fn from(kind: GalleryKind) -> Self {
        match kind {
            GalleryKind::Post => Self::Post,
            GalleryKind::Comment => Self::Comment,
        }
    }
}

impl From<store::MediaScale> for GalleryKind {
    fn from(scale: store::MediaScale) -> Self {
        match scale {
            store::MediaScale::Post => Self::Post,
            store::MediaScale::Comment => Self::Comment,
        }
    }
}

impl GalleryKind {
    fn bound(self) -> usize {
        match self {
            Self::Post => MAX_POST_ATTACHMENTS,
            Self::Comment => MAX_COMMENT_ATTACHMENTS,
        }
    }

    /// The byte cap this parent puts on a video.
    fn video_bytes(self) -> i64 {
        match self {
            Self::Post => MAX_POST_VIDEO_BYTES,
            Self::Comment => MAX_COMMENT_VIDEO_BYTES,
        }
    }

    /// Whether a cover means anything here. `isCover` applies to post
    /// galleries only; a comment gallery ignores it (api-spec.md
    /// "Content authoring").
    fn has_cover(self) -> bool {
        matches!(self, Self::Post)
    }
}

/// One attachment placement as the wire states it — an asset already
/// uploaded, where it sits in the gallery, what it is a picture of, and,
/// for a clip, which still covers it.
///
/// The description and the poster are here rather than on the upload
/// because both are facts about *this placement*: the same asset can read
/// differently in two parents, and correcting a description or naming a
/// different cover is a new version of the parent, never a re-upload
/// (data-model.md "Media attachments"). That is what lets a client upload
/// the moment a picture is picked.
#[derive(Debug, Clone)]
pub struct AttachmentDraft {
    pub media_id: Uuid,
    pub display_order: i32,
    pub is_cover: Option<bool>,
    pub alt_text: Option<String>,
    /// The still that stands in for this clip before playback — an asset
    /// this author uploaded, either a frame the client cut out of the
    /// video or a picture chosen instead. Only a video placement takes
    /// one; a video may always go without.
    pub cover_media_id: Option<Uuid>,
}

/// A field-level refusal carrying the path into the input that names the
/// offender (api-spec.md "Error types", whose own example path is a media
/// one). Same shape as a tag's or a citation's, so the clients' existing
/// field-error plumbing reaches a gallery without learning anything new.
#[derive(Debug, thiserror::Error)]
#[error("{message}")]
pub struct GalleryError {
    pub path: Vec<String>,
    pub message: String,
}

impl GalleryError {
    fn at(path: Vec<String>, message: impl Into<String>) -> Self {
        Self {
            path,
            message: message.into(),
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum GalleryPlanError {
    #[error(transparent)]
    BadInput(#[from] GalleryError),
    #[error("internal: {0}")]
    Internal(String),
}

/// A checked gallery: the asset ids in gallery order, and the manifest
/// those assets produce for the payload envelope.
///
/// The two are the same gallery said twice — once for Postgres and once
/// for the record — and they are built together here so they cannot come
/// apart. The manifest is what the winning record witnesses; the ids are
/// what the junction rows point at.
#[derive(Debug, Clone, Default)]
pub struct PlannedGallery {
    pub attachment_ids: Vec<Uuid>,
    pub manifest: Vec<common::envelope::MediaAsset>,
}

fn gallery_path(index: usize, field: &str) -> Vec<String> {
    vec![
        "attachments".to_string(),
        index.to_string(),
        field.to_string(),
    ]
}

/// Checks a gallery whole and resolves it, before anything is staged.
///
/// Three rules, in the order a client wants to hear them:
///
/// 1. **The count.** Checked over the whole list first, so an eleventh
///    picture refuses the gesture rather than being silently dropped from
///    the middle of it.
/// 2. **The stated order.** `displayOrder` names the entry's position and
///    the envelope's manifest carries order as array position; requiring
///    the two to agree is what stops Postgres and the witnessed record
///    from telling a reader two different stories. Same for `isCover`,
///    which the manifest expresses as "index 0".
/// 3. **The descriptions.** Trimmed, length-checked, and blank folded to
///    absent so `""` and null cannot mean two different nothings. This is
///    where a description is checked because this is where one is
///    authored: the upload carries bytes and nothing authored, and the
///    manifest entry composed below is what the record witnesses.
/// 4. **The assets.** Every id must name an un-redacted asset **this
///    author uploaded** — the anti-hijack rule (data-model.md "Why parents
///    point at attachments"). Cross-author re-use is not a permission this
///    path can grant: sharing someone else's picture is a link to their
///    post, never a reference to their asset.
///
/// 5. **The body's shape.** A body is pictures or one video, so a video
///    sharing a gallery with anything else is refused — its cover rides
///    the placement rather than a second entry, which is what lets "ten
///    pictures or one video" stay one counting rule. The video's byte
///    cap is the parent's own. The upload was already sized for the
///    parent it named, but an asset uploaded for a post can be attached
///    to a comment, so the parent checks again here. A comment carries
///    half a post's video for the same reason it carries four pictures
///    rather than ten.
///
/// The ownership comparison is written against the author rather than
/// against "the viewer" even though this slice has no `actAs` and the two
/// are always the same actor — so the Collectives slice adds a parameter
/// rather than a rule.
///
/// Posters are read in the same round trip as the assets they cover: both
/// answer to the same three rules, so splitting the read would buy a
/// second query for nothing.
pub async fn plan_gallery(
    pool: &PgPool,
    author: Uuid,
    kind: GalleryKind,
    drafts: &[AttachmentDraft],
) -> Result<PlannedGallery, GalleryPlanError> {
    let Some(entries) = gallery_entries(kind, drafts)? else {
        return Ok(PlannedGallery::default());
    };
    let ids: Vec<Uuid> = entries
        .iter()
        .flat_map(|entry| std::iter::once(entry.id).chain(entry.cover))
        .collect();
    let rows = store::assets_by_ids(pool, &ids)
        .await
        .map_err(|e| GalleryPlanError::Internal(e.to_string()))?;
    resolve_gallery(author, kind, &entries, &rows)
}

/// One gallery entry as the client stated it, after the checks that need
/// no asset row: the asset, the description it authored, and the poster it
/// named.
#[derive(Debug)]
struct EntryDraft {
    id: Uuid,
    alt_text: Option<String>,
    cover: Option<Uuid>,
}

/// The half of gallery planning that reads only what the client sent:
/// the bound, gallery order, the cover flag, the descriptions, and
/// duplicate entries.
///
/// `None` for an empty gallery, which is not a refusal.
///
/// Split from the half that needs the asset rows so the rules are
/// reachable from a unit test — the branch matrix is the thing worth
/// testing here, and it needs no database once the rows are in hand.
///
/// A placement naming itself as its poster is refused here rather than
/// left to the junction's own CHECK: a constraint violation would surface
/// as a server error instead of the field refusal the author can act on.
fn gallery_entries(
    kind: GalleryKind,
    drafts: &[AttachmentDraft],
) -> Result<Option<Vec<EntryDraft>>, GalleryError> {
    if drafts.is_empty() {
        return Ok(None);
    }
    let bound = kind.bound();
    if drafts.len() > bound {
        return Err(GalleryError::at(
            vec!["attachments".to_string()],
            format!("at most {bound} attachments, got {}", drafts.len()),
        ));
    }

    let mut entries: Vec<EntryDraft> = Vec::with_capacity(drafts.len());
    for (i, draft) in drafts.iter().enumerate() {
        if draft.display_order != i as i32 {
            return Err(GalleryError::at(
                gallery_path(i, "displayOrder"),
                format!(
                    "attachments are in gallery order, so displayOrder here is {i}, not {}",
                    draft.display_order
                ),
            ));
        }
        if let Some(is_cover) = draft.is_cover
            && kind.has_cover()
            && is_cover != (i == 0)
        {
            return Err(GalleryError::at(
                gallery_path(i, "isCover"),
                "the first attachment is the cover",
            ));
        }
        let alt_text = checked_alt_text(draft.alt_text.as_deref())
            .map_err(|message| GalleryError::at(gallery_path(i, "altText"), message))?;
        if entries.iter().any(|e| e.id == draft.media_id) {
            return Err(GalleryError::at(
                gallery_path(i, "mediaId"),
                "this asset is already in the gallery",
            ));
        }
        if draft.cover_media_id == Some(draft.media_id) {
            return Err(GalleryError::at(
                gallery_path(i, "coverMediaId"),
                "an attachment cannot be its own cover",
            ));
        }
        entries.push(EntryDraft {
            id: draft.media_id,
            alt_text,
            cover: draft.cover_media_id,
        });
    }

    Ok(Some(entries))
}

/// The half of gallery planning that reads the asset rows: the
/// anti-hijack rule per entry, the body's shape, and the poster.
fn resolve_gallery(
    author: Uuid,
    kind: GalleryKind,
    entries: &[EntryDraft],
    rows: &[store::MediaAttachment],
) -> Result<PlannedGallery, GalleryPlanError> {
    let mut manifest = Vec::with_capacity(entries.len());
    for (i, entry) in entries.iter().enumerate() {
        let path = gallery_path(i, "mediaId");
        let asset = usable_asset(
            rows.iter().find(|a| a.id == entry.id),
            author,
            &path,
            "an attachment must be an asset you uploaded",
        )?;
        if asset.mime_type == video::MIME {
            if entries.len() > 1 {
                return Err(
                    GalleryError::at(path, "a body is pictures or one video, never both").into(),
                );
            }
            let cap = kind.video_bytes();
            if asset.size_bytes.is_some_and(|size| size > cap) {
                return Err(GalleryError::at(
                    path,
                    format!("the video is larger than the {cap} bytes this carries"),
                )
                .into());
            }
        }
        let cover = resolve_cover(author, i, entry, asset, rows)?;
        manifest.push(manifest_entry(asset, entry.alt_text.clone(), cover)?);
    }
    Ok(PlannedGallery {
        attachment_ids: entries.iter().map(|entry| entry.id).collect(),
        manifest,
    })
}

/// The poster this placement names, checked against its own row.
///
/// The cover arrives as an ordinary uploaded asset — either a frame the
/// client pulled out of the video or a picture the author chose instead,
/// which the server cannot tell apart and has no reason to. There is no
/// server-side frame extraction: that would be a decoder in the upload
/// path, and the upload path decodes nothing it does not have to.
///
/// Four ways to get it wrong, each refused against the field that carried
/// it:
///
/// 1. **A cover on something that is not a video.** A still is not covered
///    by anything, so naming one is a mistake worth reporting rather than
///    a value worth ignoring.
/// 2. **An asset that is not there.**
/// 3. **Someone else's asset.** The same anti-hijack rule a gallery entry
///    runs (data-model.md "Why parents point at attachments"): a cover
///    must be an asset this author uploaded, so a poster can never point
///    into another account's media.
/// 4. **A video, or a removed asset.** A poster is the still a reader sees
///    before playback — a video cannot stand in for one, and bytes that
///    are gone cannot either.
///
/// A clip that names none is not a failure: a video can always go without
/// a cover, and then it is the clip's own first frame a player shows.
fn resolve_cover<'a>(
    author: Uuid,
    index: usize,
    entry: &EntryDraft,
    asset: &store::MediaAttachment,
    rows: &'a [store::MediaAttachment],
) -> Result<Option<&'a store::MediaAttachment>, GalleryError> {
    let Some(id) = entry.cover else {
        return Ok(None);
    };
    let path = gallery_path(index, "coverMediaId");
    if asset.mime_type != video::MIME {
        return Err(GalleryError::at(path, "only a video takes a cover"));
    }
    let cover = usable_asset(
        rows.iter().find(|a| a.id == id),
        author,
        &path,
        "a cover must be an asset you uploaded",
    )?;
    if cover.mime_type != webp::MIME {
        return Err(GalleryError::at(
            path,
            "a cover must be an image, not a video",
        ));
    }
    Ok(Some(cover))
}

/// The four rules every asset reference runs before it may be used: the
/// asset is there, this author uploaded it, it has not been removed, and
/// its bytes are final.
///
/// Written once because it is the anti-hijack rule (data-model.md "Why
/// parents point at attachments") and three surfaces — a gallery entry, a
/// poster, a profile picture — each carried their own copy. Only the
/// ownership sentence differs, because each names a different thing to
/// the author.
///
/// **The last rule is the witness guarantee's gate.** Every path from an
/// asset id to a payload envelope passes through here, and the envelope
/// commits the asset's digest. An asset that is still `processing` has a
/// digest that is about to change, so committing it would publish a
/// witness the served bytes will never match; refusing here is what
/// makes "the bytes behind a committed digest never change" a property of
/// the code rather than of timing. A failed asset is refused with the
/// reason it failed, which is the one thing its author can act on.
fn usable_asset<'a>(
    asset: Option<&'a store::MediaAttachment>,
    author: Uuid,
    path: &[String],
    not_yours: &str,
) -> Result<&'a store::MediaAttachment, GalleryError> {
    let asset = asset.ok_or_else(|| GalleryError::at(path.to_vec(), "no such asset"))?;
    if asset.author_id != author {
        return Err(GalleryError::at(path.to_vec(), not_yours));
    }
    if asset.redacted_at.is_some() {
        return Err(GalleryError::at(
            path.to_vec(),
            "this asset has been removed",
        ));
    }
    match asset.state {
        store::AssetState::Ready => Ok(asset),
        store::AssetState::Processing => Err(GalleryError::at(path.to_vec(), NOT_READY_MESSAGE)),
        store::AssetState::Failed => Err(GalleryError::at(
            path.to_vec(),
            format!(
                "this asset could not be processed: {}",
                asset
                    .failure_reason
                    .as_deref()
                    .unwrap_or("no reason recorded")
            ),
        )),
    }
}

/// What prepare says about an asset that is still `processing`.
pub const NOT_READY_MESSAGE: &str =
    "this asset is still being processed; attach it once its state is READY";

/// The description as the manifest will carry it: trimmed, length-checked,
/// and blank folded to absent so `""` and null cannot mean two different
/// nothings. The caller supplies the field path; the message is the same
/// wherever a description is authored.
fn checked_alt_text(raw: Option<&str>) -> Result<Option<String>, String> {
    match raw.map(str::trim) {
        Some(alt) if alt.chars().count() > MAX_ALT_TEXT_CHARS => Err(format!(
            "alt text is longer than {MAX_ALT_TEXT_CHARS} characters"
        )),
        Some(alt) if !alt.is_empty() => Ok(Some(alt.to_string())),
        _ => Ok(None),
    }
}

/// One asset's manifest entry — the facts a reader needs to render it
/// honestly. Everything the server measured (aspect ratio, byte size,
/// duration) stays out: an author signs what they wrote, never a
/// measurement.
///
/// The description and the poster come from the caller rather than from
/// the asset row, because the row holds neither: both are facts about this
/// placement, and this entry is where the author's statement about them is
/// sealed (data-model.md "Media attachments"). The cover is witnessed by
/// its digest rather than its id, the way the manifest names every asset.
fn manifest_entry(
    asset: &store::MediaAttachment,
    alt_text: Option<String>,
    cover: Option<&store::MediaAttachment>,
) -> Result<common::envelope::MediaAsset, GalleryPlanError> {
    Ok(common::envelope::MediaAsset {
        digest: manifest_digest(asset)?,
        mime: asset.mime_type.clone(),
        alt_text,
        cover: cover.map(manifest_digest).transpose()?,
    })
}

/// An asset's digest as the manifest carries it, or the internal refusal a
/// mis-sized one is.
fn manifest_digest(
    asset: &store::MediaAttachment,
) -> Result<[u8; common::envelope::MEDIA_DIGEST_LEN], GalleryPlanError> {
    asset.digest.as_slice().try_into().map_err(|_| {
        GalleryPlanError::Internal(format!("asset {} carries a mis-sized digest", asset.id))
    })
}

/// Checks one profile image slot — the avatar or the cover.
///
/// Three-valued, and the three values are kept apart end to end: absent
/// leaves the picture as it stands, an explicit null clears it back to the
/// monogram, an id replaces it. That is the profile-update rule
/// (api-spec.md "Content authoring") and it differs from a content edit's
/// two-valued one, which is exactly why it is written out rather than
/// folded into the gallery path.
///
/// The same anti-hijack rule a gallery runs: the picture must be one this
/// author uploaded, and it must not have been removed.
///
/// The slot's manifest entry carries no description: `avatarMediaId` is
/// the whole input (api-spec.md `PrepareProfileUpdateInput`), so there is
/// nothing authored here to witness. An avatar is named beside a display
/// name, and the name is what a reader is read.
pub async fn plan_profile_image(
    pool: &PgPool,
    author: Uuid,
    field: &'static str,
    slot: Option<Option<Uuid>>,
) -> Result<Option<Option<common::envelope::MediaAsset>>, GalleryPlanError> {
    let Some(chosen) = slot else {
        return Ok(None);
    };
    let Some(id) = chosen else {
        return Ok(Some(None));
    };
    let rows = store::assets_by_ids(pool, std::slice::from_ref(&id))
        .await
        .map_err(|e| GalleryPlanError::Internal(e.to_string()))?;
    Ok(Some(Some(checked_profile_image(
        rows.first(),
        author,
        field,
    )?)))
}

/// The half of profile-image planning that reads the asset row: the
/// anti-hijack rule, and the slot's own shape.
///
/// **A profile picture is a still**, so the slot answers to the picture
/// cap and nothing wider. A video would otherwise reach an avatar through
/// the video cap — ten times a picture's — and no profile surface plays
/// one: the profile carries "one image, the avatar", picked and cropped
/// circular 1:1 (design.md "Profile header"). The refusal is the one a
/// poster already gives for the same reason, said against the field that
/// carried the id.
fn checked_profile_image(
    asset: Option<&store::MediaAttachment>,
    author: Uuid,
    field: &'static str,
) -> Result<common::envelope::MediaAsset, GalleryPlanError> {
    let path = vec![field.to_string()];
    let asset = usable_asset(
        asset,
        author,
        &path,
        "a profile picture must be an asset you uploaded",
    )?;
    if asset.mime_type != webp::MIME {
        return Err(
            GalleryError::at(path, "a profile picture must be an image, not a video").into(),
        );
    }
    manifest_entry(asset, None, None)
}

/// The asset one profile image slot's manifest entry names, resolved the
/// way a gallery's is — from the record, so a promotion reconstructs the
/// row without the request that produced it.
///
/// The outer option is the slot's three-valuedness; the inner one is
/// whether the digest still answers to a row.
pub async fn resolve_profile_image(
    pool: &PgPool,
    author: Uuid,
    slot: &Option<Option<common::envelope::MediaAsset>>,
) -> Result<Option<Option<Uuid>>, sqlx::Error> {
    let Some(chosen) = slot else {
        return Ok(None);
    };
    let Some(asset) = chosen else {
        return Ok(Some(None));
    };
    let placements = resolve_manifest(pool, author, std::slice::from_ref(asset)).await?;
    Ok(Some(placements.first().map(|p| p.attachment_id)))
}

/// The gallery a landed or staged payload's manifest names, in the
/// manifest's own order — how a gallery is written from the record rather
/// than from the request that produced it.
///
/// The manifest carries digests, and `(author, digest)` names at most one
/// asset, so the record is the source the junction rows are derived from.
/// That is what makes a gallery rebuildable: a mirror rebuild replays the
/// payload and reconstructs the same rows without the original request.
/// Each placement's description and poster are read off the same entry for
/// the same reason — the junction row caches what the version's manifest
/// witnessed, so a gallery read never has to decode a payload.
///
/// A digest with no row is dropped rather than failing the promotion. The
/// record is ordered fact whatever CoGra holds; a manifest entry whose
/// asset is gone renders as one fewer picture, not as a post that will not
/// load. A *cover* digest with no row is thinner still: the placement is
/// written without a poster rather than dropped, because the clip is the
/// body and the still that fronts it is not.
///
/// Posters are looked up in the same round trip, and by digest for the
/// same reason the entries are: the manifest names assets by their bytes,
/// so the record is what the junction rows are derived from.
pub async fn resolve_manifest(
    pool: &PgPool,
    author: Uuid,
    manifest: &[common::envelope::MediaAsset],
) -> Result<Vec<store::GalleryPlacement>, sqlx::Error> {
    if manifest.is_empty() {
        return Ok(Vec::new());
    }
    let digests: Vec<Vec<u8>> = manifest
        .iter()
        .flat_map(|a| std::iter::once(a.digest).chain(a.cover))
        .map(|digest| digest.to_vec())
        .collect();
    let rows = store::assets_by_digests(pool, author, &digests).await?;
    let id_of = |digest: &[u8]| {
        rows.iter()
            .find(|row| row.digest == digest)
            .map(|row| row.id)
    };
    Ok(manifest
        .iter()
        .filter_map(|entry| {
            id_of(&entry.digest).map(|attachment_id| store::GalleryPlacement {
                attachment_id,
                alt_text: entry.alt_text.clone(),
                cover_media_id: entry.cover.as_ref().and_then(|c| id_of(c)),
            })
        })
        .collect())
}

/// The object key for an asset id. Server-generated end to end: nothing
/// a client sent reaches it, so a traversal or a collision with someone
/// else's object is unrepresentable rather than defended against.
///
/// The extension follows the sniffed format rather than any name the
/// upload carried, so a key describes what the store actually holds.
pub fn storage_key(id: Uuid, mime: &str) -> String {
    let extension = if mime == video::MIME { "mp4" } else { "webp" };
    format!("{id}.{extension}")
}

/// The absolute URL a reader fetches the bytes from.
pub fn public_url(base_url: &str, storage_key: &str) -> String {
    format!("{}/{}", base_url.trim_end_matches('/'), storage_key)
}

/// Where an upload waiting to be re-encoded is kept.
///
/// Under a prefix of its own, like a resumable upload's staging key, so
/// the bytes that will never be served are told apart from the ones that
/// are at a glance. The rendition gets an ordinary asset key when it
/// exists, and this object is deleted.
pub fn ingest_key(id: Uuid) -> String {
    format!("ingest/{id}.mp4")
}

/// The layout facts a row carries about its bytes.
pub(crate) fn asset_options(asset: &ProcessedAsset) -> serde_json::Value {
    let mut options = serde_json::json!({ "v": 1, "aspect_ratio": asset.aspect_ratio() });
    if let Some(duration_ms) = asset.duration_ms
        && let Some(map) = options.as_object_mut()
    {
        map.insert("duration_ms".into(), duration_ms.into());
    }
    options
}

/// Writes the object, then the row.
///
/// Bytes and derived facts only: the row carries nothing the author typed,
/// which is what lets a picture upload the moment it is picked
/// (data-model.md "Media attachments").
///
/// A video outside the served target is written `processing`, under its
/// [`ingest_key`], for the [`ingest_queue`] worker to re-encode; everything else
/// is written `ready` under its final key, and is attachable at once.
///
/// A retried upload of the same picture by the same author resolves to
/// the row that already exists — the object written on this attempt is
/// then an orphan, and it is deleted here rather than left for the
/// sweeper, because the sweeper's window is a day and this is known now.
/// Failing that delete is logged and no more: the row is correct, and an
/// unreferenced object is exactly what the sweeper exists for.
///
/// The destination is written on the row whichever way it goes: a
/// `processing` row is re-encoded for that parent's cap long after the
/// request that named it is gone.
pub async fn store_asset(
    pool: &PgPool,
    blobs: &dyn BlobStore,
    author: Uuid,
    destination: GalleryKind,
    asset: ProcessedAsset,
) -> Result<store::MediaAttachment, GalleryPlanError> {
    let id = Uuid::new_v4();
    let key = if asset.needs_transcode {
        ingest_key(id)
    } else {
        storage_key(id, asset.mime)
    };
    let size_bytes = i64::try_from(asset.bytes.len()).map_err(internal)?;
    let options = asset_options(&asset);
    let digest = asset.digest;
    let mime = asset.mime;
    let needs_transcode = asset.needs_transcode;

    blobs.put(&key, asset.bytes, mime).await.map_err(internal)?;

    let scale = destination.into();
    let row = if needs_transcode {
        store::insert_processing(
            pool, id, author, &digest, "sha256", &key, mime, size_bytes, &options, scale,
        )
        .await
    } else {
        store::insert(
            pool, id, author, &digest, "sha256", &key, mime, size_bytes, &options, scale,
        )
        .await
    }
    .map_err(internal)?;

    if row.storage_key != key
        && let Err(e) = blobs.delete(&key).await
    {
        tracing::warn!(error = %e, key, "leaving a duplicate upload's object to the sweeper");
    }
    Ok(row)
}

fn internal(e: impl std::fmt::Display) -> GalleryPlanError {
    GalleryPlanError::Internal(e.to_string())
}

/// How many orphaned assets one sweep tick collects — the bound
/// `resumable::SWEEP_BATCH` puts on the session sweep sharing this tick.
const ORPHAN_SWEEP_BATCH: i64 = 200;

/// The orphan sweep (development.md, `MEDIA_ORPHAN_*`): the same reaper
/// shape the account and rate-limit sweeps use.
///
/// Rows go first and their objects after, so a crash between the two
/// leaves an unreferenced object — the failure mode the whole write
/// ordering is chosen to prefer. An object whose delete fails is simply
/// not retried: it is unreferenced, it costs storage and nothing else,
/// and a retry queue for it would be more machinery than the problem.
///
/// The abandoned-upload sweep rides the same tick. The two collect the
/// two halves of one abandoned compose — the asset nobody attached and
/// the upload nobody finished — and splitting them across two loops
/// would be a second interval to configure for no gain. It runs first
/// because a session it finishes collecting can leave an asset behind
/// for the orphan sweep to see on this very pass.
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
        resumable::sweep_expired(&pool, &blobs).await;
        match store::sweep_orphans(&pool, max_age_secs, ORPHAN_SWEEP_BATCH).await {
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

/// The gallery-planning rules, unit-tested.
///
/// Both halves of `plan_gallery` are pure once the asset rows are in
/// hand, and every branch worth pinning lives in one of them — so the
/// matrix is tested directly here rather than through a server-and-
/// database round trip, and the integration suites keep testing that the
/// two halves are wired to a real store.
#[cfg(test)]
mod planning_tests {
    use super::*;

    fn asset(author: Uuid, mime: &str) -> store::MediaAttachment {
        store::MediaAttachment {
            id: Uuid::new_v4(),
            author_id: author,
            digest: vec![7u8; 32],
            digest_algo: "sha256".into(),
            storage_key: "k.webp".into(),
            mime_type: mime.into(),
            size_bytes: Some(1024),
            options: serde_json::json!({}),
            state: store::AssetState::Ready,
            failure_reason: None,
            redaction_reason: None,
            redacted_at: None,
            created_at: chrono::Utc::now(),
        }
    }

    fn draft(id: Uuid, order: i32) -> AttachmentDraft {
        AttachmentDraft {
            media_id: id,
            display_order: order,
            is_cover: None,
            alt_text: None,
            cover_media_id: None,
        }
    }

    fn entry(id: Uuid, cover: Option<Uuid>) -> EntryDraft {
        EntryDraft {
            id,
            alt_text: None,
            cover,
        }
    }

    fn path_of(e: &GalleryPlanError) -> Vec<String> {
        match e {
            GalleryPlanError::BadInput(e) => e.path.clone(),
            GalleryPlanError::Internal(e) => panic!("expected a field refusal, got {e}"),
        }
    }

    /// An empty gallery is not a refusal; a gallery past the kind's
    /// bound, out of order, carrying the same asset twice, or flagging
    /// the wrong cover is refused against the field that carried it.
    ///
    /// The client-side gallery rules are each refused against the field that carried them.
    /// ´claim:media:the-gallery-rules-name-their-field´
    #[test]
    fn the_gallery_rules_name_their_field() {
        assert!(
            gallery_entries(GalleryKind::Post, &[])
                .expect("empty is not a refusal")
                .is_none()
        );

        let over: Vec<AttachmentDraft> = (0..=GalleryKind::Post.bound())
            .map(|i| draft(Uuid::new_v4(), i as i32))
            .collect();
        assert_eq!(
            gallery_entries(GalleryKind::Post, &over)
                .expect_err("over the bound")
                .path,
            vec!["attachments".to_string()]
        );

        let misordered = [draft(Uuid::new_v4(), 1)];
        assert_eq!(
            gallery_entries(GalleryKind::Post, &misordered)
                .expect_err("out of gallery order")
                .path,
            gallery_path(0, "displayOrder")
        );

        let twice = Uuid::new_v4();
        let duplicated = [draft(twice, 0), draft(twice, 1)];
        assert_eq!(
            gallery_entries(GalleryKind::Post, &duplicated)
                .expect_err("the same asset twice")
                .path,
            gallery_path(1, "mediaId")
        );

        let mut wrong_cover = draft(Uuid::new_v4(), 0);
        wrong_cover.is_cover = Some(false);
        assert_eq!(
            gallery_entries(GalleryKind::Post, &[wrong_cover])
                .expect_err("the first attachment is the cover")
                .path,
            gallery_path(0, "isCover")
        );

        let itself = Uuid::new_v4();
        let mut self_poster = draft(itself, 0);
        self_poster.cover_media_id = Some(itself);
        assert_eq!(
            gallery_entries(GalleryKind::Post, &[self_poster])
                .expect_err("an attachment cannot be its own cover")
                .path,
            gallery_path(0, "coverMediaId")
        );
    }

    /// The poster's own rules, each against the field that named it — and
    /// the two states that are not refusals: a clip with a still over it,
    /// and a clip with none.
    ///
    /// A cover is the author's own still over a video, refused at the placement's own coverMediaId.
    /// ´claim:media:a-cover-is-the-authors-own-still-over-a-video´
    #[test]
    fn a_cover_is_the_authors_own_still_over_a_video() {
        let author = Uuid::new_v4();
        let video = asset(author, video::MIME);
        let still = asset(author, webp::MIME);
        let rows = [video.clone(), still.clone()];
        let covered = [entry(video.id, Some(still.id))];

        assert!(resolve_gallery(author, GalleryKind::Post, &covered, &rows).is_ok());
        assert!(
            resolve_gallery(
                author,
                GalleryKind::Post,
                &[entry(video.id, None)],
                std::slice::from_ref(&video),
            )
            .is_ok(),
            "a video can always go without a cover"
        );

        let path = gallery_path(0, "coverMediaId");
        assert_eq!(
            path_of(
                &resolve_gallery(
                    author,
                    GalleryKind::Post,
                    &[entry(still.id, Some(video.id))],
                    &rows,
                )
                .expect_err("only a video takes a cover")
            ),
            path
        );
        assert_eq!(
            path_of(
                &resolve_gallery(
                    author,
                    GalleryKind::Post,
                    &covered,
                    std::slice::from_ref(&video),
                )
                .expect_err("no such asset")
            ),
            path
        );
        let theirs = store::MediaAttachment {
            author_id: Uuid::new_v4(),
            ..still.clone()
        };
        assert_eq!(
            path_of(
                &resolve_gallery(
                    author,
                    GalleryKind::Post,
                    &covered,
                    &[video.clone(), theirs]
                )
                .expect_err("someone else's still")
            ),
            path
        );
        let removed = store::MediaAttachment {
            redacted_at: Some(chrono::Utc::now()),
            ..still.clone()
        };
        assert_eq!(
            path_of(
                &resolve_gallery(
                    author,
                    GalleryKind::Post,
                    &covered,
                    &[video.clone(), removed]
                )
                .expect_err("a removed still")
            ),
            path
        );
        let second_clip = asset(author, video::MIME);
        assert_eq!(
            path_of(
                &resolve_gallery(
                    author,
                    GalleryKind::Post,
                    &[entry(video.id, Some(second_clip.id))],
                    &[video.clone(), second_clip],
                )
                .expect_err("a video cannot cover a video")
            ),
            path
        );
    }

    /// The poster is witnessed by digest and written onto the placement,
    /// and it never becomes a gallery entry of its own — the counting rule
    /// "ten pictures or one video" depends on that.
    ///
    /// A witnessed poster resolves back onto the placement without ever becoming a gallery entry.
    /// ´claim:media:a-poster-rides-the-placement-not-the-gallery´
    #[test]
    fn a_poster_rides_the_placement_not_the_gallery() {
        let author = Uuid::new_v4();
        let video = asset(author, video::MIME);
        let still = store::MediaAttachment {
            digest: vec![9u8; 32],
            ..asset(author, webp::MIME)
        };
        let planned = resolve_gallery(
            author,
            GalleryKind::Post,
            &[entry(video.id, Some(still.id))],
            &[video.clone(), still.clone()],
        )
        .expect("a covered clip");

        assert_eq!(planned.attachment_ids, vec![video.id]);
        assert_eq!(planned.manifest.len(), 1);
        assert_eq!(
            planned.manifest[0].cover.expect("a witnessed poster"),
            still.digest.as_slice()
        );
    }

    /// The anti-hijack rule and the body's shape, each against the entry
    /// that broke them.
    ///
    /// An attachment must be an asset this author still holds, and a body is pictures or one video.
    /// ´claim:media:an-attachment-is-the-authors-own-and-the-body-has-one-shape´
    #[test]
    fn an_attachment_is_the_authors_own_and_the_body_has_one_shape() {
        let author = Uuid::new_v4();
        let stranger = Uuid::new_v4();
        let mine = asset(author, webp::MIME);
        let entries = vec![entry(mine.id, None)];

        assert!(
            resolve_gallery(
                author,
                GalleryKind::Post,
                &entries,
                std::slice::from_ref(&mine)
            )
            .is_ok()
        );
        assert_eq!(
            path_of(
                &resolve_gallery(author, GalleryKind::Post, &entries, &[]).expect_err("absent")
            ),
            gallery_path(0, "mediaId")
        );

        let theirs = store::MediaAttachment {
            author_id: stranger,
            ..mine.clone()
        };
        assert_eq!(
            path_of(
                &resolve_gallery(author, GalleryKind::Post, &entries, &[theirs])
                    .expect_err("someone else's asset")
            ),
            gallery_path(0, "mediaId")
        );

        let removed = store::MediaAttachment {
            redacted_at: Some(chrono::Utc::now()),
            ..mine.clone()
        };
        assert_eq!(
            path_of(
                &resolve_gallery(author, GalleryKind::Post, &entries, &[removed])
                    .expect_err("a removed asset")
            ),
            gallery_path(0, "mediaId")
        );

        let video = asset(author, video::MIME);
        let mixed = vec![entry(mine.id, None), entry(video.id, None)];
        assert_eq!(
            path_of(
                &resolve_gallery(
                    author,
                    GalleryKind::Post,
                    &mixed,
                    &[mine.clone(), video.clone()],
                )
                .expect_err("pictures or one video, never both")
            ),
            gallery_path(1, "mediaId")
        );

        let oversized = store::MediaAttachment {
            size_bytes: Some(GalleryKind::Comment.video_bytes() + 1),
            ..video.clone()
        };
        assert_eq!(
            path_of(
                &resolve_gallery(
                    author,
                    GalleryKind::Comment,
                    &[entry(video.id, None)],
                    &[oversized],
                )
                .expect_err("past the parent's video cap")
            ),
            gallery_path(0, "mediaId")
        );
    }

    /// Nothing that is not `ready` reaches a manifest: a clip still being
    /// re-encoded is refused as the attachment and as a poster alike, and a
    /// failed one is refused with the reason it failed — so no envelope can
    /// commit a digest the served bytes will not match.
    ///
    /// Prepare refuses an asset whose bytes are not final, naming the field that carried it.
    /// ´claim:media:prepare-refuses-an-asset-that-is-not-ready´
    #[test]
    fn prepare_refuses_an_asset_that_is_not_ready() {
        let author = Uuid::new_v4();
        let processing = store::MediaAttachment {
            state: store::AssetState::Processing,
            ..asset(author, video::MIME)
        };
        let refused = resolve_gallery(
            author,
            GalleryKind::Post,
            &[entry(processing.id, None)],
            std::slice::from_ref(&processing),
        )
        .expect_err("a processing clip is not attachable");
        assert_eq!(path_of(&refused), gallery_path(0, "mediaId"));
        assert_eq!(refused.to_string(), NOT_READY_MESSAGE);

        let failed = store::MediaAttachment {
            state: store::AssetState::Failed,
            failure_reason: Some(ingest_queue::REASON_DID_NOT_ENCODE.into()),
            ..asset(author, video::MIME)
        };
        let refused = resolve_gallery(
            author,
            GalleryKind::Post,
            &[entry(failed.id, None)],
            std::slice::from_ref(&failed),
        )
        .expect_err("a failed clip is not attachable");
        assert!(
            refused
                .to_string()
                .contains(ingest_queue::REASON_DID_NOT_ENCODE),
            "the author reads why: {refused}"
        );

        let video = asset(author, video::MIME);
        let pending_poster = store::MediaAttachment {
            state: store::AssetState::Processing,
            ..asset(author, webp::MIME)
        };
        assert_eq!(
            path_of(
                &resolve_gallery(
                    author,
                    GalleryKind::Post,
                    &[entry(video.id, Some(pending_poster.id))],
                    &[video.clone(), pending_poster],
                )
                .expect_err("a poster is held to the same rule")
            ),
            gallery_path(0, "coverMediaId")
        );
    }

    /// The slot's own rules: the author's own asset, still there, and a
    /// picture rather than a video.
    ///
    /// A profile picture is a still the account uploaded itself, refused against the field that named it.
    /// ´claim:media:a-profile-picture-is-the-authors-own-still´
    #[test]
    fn a_profile_picture_is_the_authors_own_still() {
        let author = Uuid::new_v4();
        let mine = asset(author, webp::MIME);
        checked_profile_image(Some(&mine), author, "avatarMediaId")
            .expect("an author's own picture is a profile picture");

        let slot = vec!["avatarMediaId".to_string()];
        assert_eq!(
            path_of(
                &checked_profile_image(
                    Some(&asset(Uuid::new_v4(), webp::MIME)),
                    author,
                    "avatarMediaId"
                )
                .expect_err("someone else's asset")
            ),
            slot
        );
        assert_eq!(
            path_of(
                &checked_profile_image(Some(&asset(author, video::MIME)), author, "avatarMediaId")
                    .expect_err("a video is not a profile picture")
            ),
            slot
        );
        assert_eq!(
            path_of(
                &checked_profile_image(None, author, "avatarMediaId").expect_err("no such asset")
            ),
            slot
        );
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

    /// A two-frame animation, built to the container specification's
    /// layout the way the webp module's own fixtures are.
    fn animated_two_frames() -> Vec<u8> {
        use webp::{chunk, container};
        let mut vp8x = vec![0x02, 0, 0, 0];
        vp8x.extend_from_slice(&[0, 0, 0]);
        vp8x.extend_from_slice(&[0, 0, 0]);
        let mut body = chunk(b"VP8X", &vp8x);
        body.extend_from_slice(&chunk(b"ANIM", &[0, 0, 0, 0, 0, 0]));
        for duration in [40u32, 60] {
            let mut frame = Vec::new();
            for triple in [0u32, 0, 0, 0, duration] {
                frame.extend_from_slice(&triple.to_le_bytes()[..3]);
            }
            frame.push(0);
            frame.extend_from_slice(&chunk(
                b"VP8L",
                &[0x2F, 0x00, 0x00, 0x00, 0x00, 0x88, 0x88, 0x08],
            ));
            body.extend_from_slice(&chunk(b"ANMF", &frame));
        }
        container(&body)
    }

    /// An animated WebP is accepted and carries the duration its frames state, while a still carries none.
    /// ´claim:media:an-animated-still-is-accepted-with-its-duration´
    #[test]
    fn an_animated_webp_is_accepted_and_timed() {
        let processed = process(&animated_two_frames(), caps()).expect("an animation is accepted");
        assert_eq!(processed.mime, webp::MIME);
        assert_eq!(
            processed.duration_ms,
            Some(100),
            "40 ms and 60 ms of frames"
        );

        let still = process(&one_pixel(), caps()).expect("a still is accepted");
        assert_eq!(still.duration_ms, None, "a single frame has no duration");
    }

    fn caps() -> UploadCaps {
        UploadCaps {
            still_bytes: DEFAULT_MAX_UPLOAD_BYTES,
            video_bytes: DEFAULT_MAX_VIDEO_UPLOAD_BYTES,
        }
    }

    fn ratio(width: u32, height: u32) -> String {
        ProcessedAsset {
            bytes: Vec::new(),
            digest: [0; 32],
            width,
            height,
            mime: webp::MIME,
            duration_ms: None,
            needs_transcode: false,
        }
        .aspect_ratio()
    }

    /// The three crop shapes the composer offers, at the pixel sizes a
    /// phone actually produces, plus the degenerate ends.
    ///
    /// An aspect ratio is the pixel shape reduced to lowest terms, at the sizes a phone produces and at the degenerate ends alike.
    /// ´claim:media:an-aspect-ratio-is-the-shape-in-lowest-terms´
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

    /// Processing admits a real image and digests exactly the bytes it goes on to store.
    /// ´claim:media:processing-digests-what-it-stores´
    #[test]
    fn processing_accepts_a_real_image_and_digests_what_it_stores() {
        let processed = process(&one_pixel(), caps()).expect("a valid image");
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
    ///
    /// Metadata is stripped before the digest is taken, so the digest a reader recomputes from the served bytes is the one the envelope commits.
    /// ´claim:media:the-strip-precedes-the-digest´
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

        let bare = process(&clean, caps()).expect("a valid image");
        let stripped = process(&with_exif, caps()).expect("a valid image");
        assert_eq!(bare.digest, stripped.digest, "the same picture, one digest");
        assert_eq!(bare.bytes, stripped.bytes);
        assert_ne!(
            Sha256::digest(&with_exif).as_slice(),
            stripped.digest.as_slice(),
            "the uploaded bytes are not what is committed"
        );
    }

    /// Bytes the media policy excludes are refused at processing rather than stored.
    /// ´claim:media:the-policy-refuses-at-processing´
    #[test]
    fn processing_refuses_what_the_policy_excludes() {
        assert_eq!(
            process(b"GIF89a and the rest", caps()),
            Err(MediaError::Unsupported),
            "GIF converts on the device; it never reaches the server"
        );
        assert_eq!(
            process(
                &one_pixel(),
                UploadCaps {
                    still_bytes: 4,
                    video_bytes: DEFAULT_MAX_VIDEO_UPLOAD_BYTES,
                }
            ),
            Err(MediaError::TooLarge { limit: 4 })
        );
    }

    /// A still is capped where a still is capped, whatever room the video cap leaves beside it.
    /// ´claim:media:each-type-is-capped-on-its-own´
    #[test]
    fn a_still_is_not_admitted_by_the_video_cap() {
        let over = UploadCaps {
            still_bytes: 4,
            video_bytes: DEFAULT_MAX_VIDEO_UPLOAD_BYTES,
        };
        assert_eq!(
            process(&one_pixel(), over),
            Err(MediaError::TooLarge { limit: 4 }),
            "the wider video cap is not a still's to borrow"
        );
        assert_eq!(
            DEFAULT_MAX_VIDEO_UPLOAD_BYTES,
            10 * DEFAULT_MAX_UPLOAD_BYTES,
            "one video is capped where ten pictures are"
        );
    }

    /// A comment's video cap is half a post's; a picture's is one number
    /// wherever it goes; and the configured video cap bounds both, being
    /// the widest any upload may be.
    ///
    /// An upload's video cap is its destination's, bounded by the configured one, and a picture's is the same at either.
    /// ´claim:media:an-uploads-cap-is-its-destinations´
    #[test]
    fn an_uploads_caps_are_its_destinations() {
        let config = MediaConfig::default();
        let post = config.caps_for(GalleryKind::Post);
        let comment = config.caps_for(GalleryKind::Comment);
        assert_eq!(post.video_bytes as i64, MAX_POST_VIDEO_BYTES);
        assert_eq!(comment.video_bytes as i64, MAX_COMMENT_VIDEO_BYTES);
        assert_eq!(post.still_bytes, comment.still_bytes);

        let narrow = MediaConfig {
            max_video_upload_bytes: 1024,
            ..MediaConfig::default()
        };
        assert_eq!(narrow.caps_for(GalleryKind::Post).video_bytes, 1024);
        assert_eq!(narrow.caps_for(GalleryKind::Comment).video_bytes, 1024);
    }

    /// A file's own claim about its type never gets a vote — the caller
    /// hands over bytes and the bytes decide.
    ///
    /// A file's own claim about its type never gets a vote: the bytes decide, whatever the name says.
    /// ´claim:media:the-bytes-decide-the-type´
    #[test]
    fn a_renamed_file_is_still_refused() {
        let mut png = Vec::from(b"\x89PNG\r\n\x1a\n".as_slice());
        png.extend_from_slice(&[0; 64]);
        assert_eq!(process(&png, caps()), Err(MediaError::Unsupported));
    }

    /// An asset's storage key and public URL derive from its identifier alone, so nothing about the upload leaks into either.
    /// ´claim:media:the-storage-key-derives-from-the-id´
    #[test]
    fn the_storage_key_and_url_are_derived_from_the_id_alone() {
        let id = Uuid::from_bytes([3; 16]);
        let key = storage_key(id, webp::MIME);
        assert_eq!(key, format!("{id}.webp"));
        assert_eq!(
            storage_key(id, video::MIME),
            format!("{id}.mp4"),
            "the extension follows the sniffed format"
        );
        assert_eq!(
            public_url("https://media.example/bucket/", &key),
            format!("https://media.example/bucket/{id}.webp")
        );
    }
}
