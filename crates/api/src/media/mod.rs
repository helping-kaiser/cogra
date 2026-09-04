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
pub mod resumable;
pub mod video;
pub mod webp;

use std::sync::Arc;

use postgres_store::PgPool;
use postgres_store::media as store;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::env_or;

pub use blob::{BlobError, BlobStore, ObjectBlobStore, S3Config};

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
}

const DEFAULT_MAX_UPLOAD_BYTES: usize = 10 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_UPLOAD_BYTES: usize = 100 * 1024 * 1024;
const DEFAULT_ORPHAN_REAPER_INTERVAL_SECS: u64 = 600;
const DEFAULT_ORPHAN_MAX_AGE_SECS: f64 = 86_400.0;

/// The smallest a non-final part may be, fixed by S3 and inherited by
/// every store that speaks it. Configuration is checked against this
/// rather than trusted, because a part size below it produces an upload
/// that accepts every part and then refuses to assemble.
pub const MIN_MULTIPART_PART_BYTES: usize = 5 * 1024 * 1024;

const DEFAULT_UPLOAD_PART_SIZE_BYTES: usize = 8 * 1024 * 1024;

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

    /// The caps as the byte pipeline takes them.
    pub fn caps(&self) -> UploadCaps {
        UploadCaps {
            still_bytes: self.max_upload_bytes,
            video_bytes: self.max_video_upload_bytes,
        }
    }
}

/// The per-type byte caps, carried together because the pipeline picks
/// between them only after it has sniffed what it is holding.
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
pub fn process(bytes: &[u8], caps: UploadCaps) -> Result<ProcessedAsset, MediaError> {
    if webp::sniff(bytes) {
        if bytes.len() > caps.still_bytes {
            return Err(MediaError::TooLarge {
                limit: caps.still_bytes,
            });
        }
        let stripped = webp::strip_metadata(bytes)?;
        let probe = webp::probe(&stripped)?;
        let digest: [u8; 32] = Sha256::digest(&stripped).into();
        return Ok(ProcessedAsset {
            bytes: stripped,
            digest,
            width: probe.width,
            height: probe.height,
            mime: webp::MIME,
            duration_ms: probe.duration_ms,
        });
    }

    if video::sniff(bytes) {
        if bytes.len() > caps.video_bytes {
            return Err(MediaError::TooLarge {
                limit: caps.video_bytes,
            });
        }
        let stripped = video::strip_metadata(bytes)?;
        let probe = video::probe(&stripped)?;
        let digest: [u8; 32] = Sha256::digest(&stripped).into();
        return Ok(ProcessedAsset {
            bytes: stripped,
            digest,
            width: probe.width,
            height: probe.height,
            mime: video::MIME,
            duration_ms: Some(probe.duration_ms),
        });
    }

    Err(MediaError::Unsupported)
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
/// The upload cannot enforce a parent's limit, because an asset is
/// uploaded before it is attached and nothing at that moment knows which
/// parent it is headed for. So the widest limit is the one the upload
/// admits, and the parent applies its own when the context is finally
/// known.
pub const MAX_POST_VIDEO_BYTES: i64 = 100 * 1024 * 1024;

/// The largest video a comment will carry — half a post's.
///
/// A comment is an answer, and its media is a supporting clip rather
/// than a body: the picture caps are already asymmetric for the same
/// reason (four against ten), and the video budget follows them down.
/// The cover rides the still cap either way.
pub const MAX_COMMENT_VIDEO_BYTES: i64 = 50 * 1024 * 1024;

/// Which parent a gallery is being planned for. The two differ in how
/// many assets they take, in how large a video they carry, and in
/// whether a cover means anything.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GalleryKind {
    Post,
    Comment,
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
/// uploaded, where it sits in the gallery, and what it is a picture of.
///
/// The description is here rather than on the upload because it is a fact
/// about *this placement*: the same asset can read differently in two
/// parents, and correcting a description is a new version of the parent,
/// never a re-upload (data-model.md "Media attachments"). That is what
/// lets a client upload the moment a picture is picked.
#[derive(Debug, Clone)]
pub struct AttachmentDraft {
    pub media_id: Uuid,
    pub display_order: i32,
    pub is_cover: Option<bool>,
    pub alt_text: Option<String>,
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
///    the asset rather than a second entry, which is what lets "ten
///    pictures or one video" stay one counting rule. The video's byte
///    cap is the parent's own, and this is the first moment it can be
///    applied: an asset is uploaded before it is attached, so the upload
///    admits the widest limit and the parent narrows it here. A comment
///    carries half a post's video for the same reason it carries four
///    pictures rather than ten.
///
/// The ownership comparison is written against the author rather than
/// against "the viewer" even though this slice has no `actAs` and the two
/// are always the same actor — so the Collectives slice adds a parameter
/// rather than a rule.
pub async fn plan_gallery(
    pool: &PgPool,
    author: Uuid,
    kind: GalleryKind,
    drafts: &[AttachmentDraft],
) -> Result<PlannedGallery, GalleryPlanError> {
    if drafts.is_empty() {
        return Ok(PlannedGallery::default());
    }
    let bound = kind.bound();
    if drafts.len() > bound {
        return Err(GalleryError::at(
            vec!["attachments".to_string()],
            format!("at most {bound} attachments, got {}", drafts.len()),
        )
        .into());
    }

    let mut ids: Vec<Uuid> = Vec::with_capacity(drafts.len());
    let mut alts: Vec<Option<String>> = Vec::with_capacity(drafts.len());
    for (i, draft) in drafts.iter().enumerate() {
        if draft.display_order != i as i32 {
            return Err(GalleryError::at(
                gallery_path(i, "displayOrder"),
                format!(
                    "attachments are in gallery order, so displayOrder here is {i}, not {}",
                    draft.display_order
                ),
            )
            .into());
        }
        if let Some(is_cover) = draft.is_cover
            && kind.has_cover()
            && is_cover != (i == 0)
        {
            return Err(GalleryError::at(
                gallery_path(i, "isCover"),
                "the first attachment is the cover",
            )
            .into());
        }
        alts.push(
            checked_alt_text(draft.alt_text.as_deref())
                .map_err(|message| GalleryError::at(gallery_path(i, "altText"), message))?,
        );
        if ids.contains(&draft.media_id) {
            return Err(GalleryError::at(
                gallery_path(i, "mediaId"),
                "this asset is already in the gallery",
            )
            .into());
        }
        ids.push(draft.media_id);
    }

    let rows = store::assets_by_ids(pool, &ids)
        .await
        .map_err(|e| GalleryPlanError::Internal(e.to_string()))?;
    let mut manifest = Vec::with_capacity(ids.len());
    for (i, id) in ids.iter().enumerate() {
        let Some(asset) = rows.iter().find(|a| a.id == *id) else {
            return Err(GalleryError::at(gallery_path(i, "mediaId"), "no such asset").into());
        };
        if asset.author_id != author {
            return Err(GalleryError::at(
                gallery_path(i, "mediaId"),
                "an attachment must be an asset you uploaded",
            )
            .into());
        }
        if asset.redacted_at.is_some() {
            return Err(GalleryError::at(
                gallery_path(i, "mediaId"),
                "this asset has been removed",
            )
            .into());
        }
        if asset.mime_type == video::MIME {
            if drafts.len() > 1 {
                return Err(GalleryError::at(
                    gallery_path(i, "mediaId"),
                    "a body is pictures or one video, never both",
                )
                .into());
            }
            let cap = kind.video_bytes();
            if asset.size_bytes.is_some_and(|size| size > cap) {
                return Err(GalleryError::at(
                    gallery_path(i, "mediaId"),
                    format!("the video is larger than the {cap} bytes this carries"),
                )
                .into());
            }
        }
        manifest.push(manifest_entry(asset, alts[i].clone())?);
    }
    Ok(PlannedGallery {
        attachment_ids: ids,
        manifest,
    })
}

/// Checks the poster named on an upload, before any bytes are stored.
///
/// The cover arrives as an ordinary uploaded asset and is named here —
/// either a frame the client pulled out of the video or a picture the
/// author chose instead, which the server cannot tell apart and has no
/// reason to. There is no server-side frame extraction: that would be a
/// decoder in the upload path, and the upload path decodes nothing it
/// does not have to.
///
/// Four ways to get it wrong, each refused against the field that
/// carried it:
///
/// 1. **A cover on something that is not a video.** A still is not
///    covered by anything, so naming one is a mistake worth reporting
///    rather than a value worth ignoring.
/// 2. **An asset that is not there.**
/// 3. **Someone else's asset.** The same anti-hijack rule a gallery runs
///    (data-model.md "Why parents point at attachments"): a cover must be
///    an asset this author uploaded, so a poster can never point into
///    another account's media.
/// 4. **A video, or a removed asset.** A poster is the still a reader
///    sees before playback — a video cannot stand in for one, and bytes
///    that are gone cannot either.
pub async fn plan_cover(
    pool: &PgPool,
    author: Uuid,
    uploaded_is_video: bool,
    cover: Option<Uuid>,
) -> Result<Option<Uuid>, GalleryPlanError> {
    let Some(id) = cover else {
        return Ok(None);
    };
    let path = vec!["coverMediaId".to_string()];
    if !uploaded_is_video {
        return Err(GalleryError::at(path, "only a video takes a cover").into());
    }
    let rows = store::assets_by_ids(pool, std::slice::from_ref(&id))
        .await
        .map_err(|e| GalleryPlanError::Internal(e.to_string()))?;
    let Some(asset) = rows.first() else {
        return Err(GalleryError::at(path, "no such asset").into());
    };
    if asset.author_id != author {
        return Err(GalleryError::at(path, "a cover must be an asset you uploaded").into());
    }
    if asset.redacted_at.is_some() {
        return Err(GalleryError::at(path, "this asset has been removed").into());
    }
    if asset.mime_type != webp::MIME {
        return Err(GalleryError::at(path, "a cover must be an image, not a video").into());
    }
    Ok(Some(id))
}

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

/// One asset's manifest entry — the three facts a reader needs to render
/// it honestly. Everything the server measured (aspect ratio, byte size,
/// duration) stays out: an author signs what they wrote, never a
/// measurement.
///
/// The description comes from the caller rather than from the asset row,
/// because the row holds none: alt text is a fact about this placement,
/// and this entry is where the author's statement about it is sealed
/// (data-model.md "Media attachments").
fn manifest_entry(
    asset: &store::MediaAttachment,
    alt_text: Option<String>,
) -> Result<common::envelope::MediaAsset, GalleryPlanError> {
    let digest = asset.digest.as_slice().try_into().map_err(|_| {
        GalleryPlanError::Internal(format!("asset {} carries a mis-sized digest", asset.id))
    })?;
    Ok(common::envelope::MediaAsset {
        digest,
        mime: asset.mime_type.clone(),
        alt_text,
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
    let path = vec![field.to_string()];
    let rows = store::assets_by_ids(pool, std::slice::from_ref(&id))
        .await
        .map_err(|e| GalleryPlanError::Internal(e.to_string()))?;
    let Some(asset) = rows.first() else {
        return Err(GalleryError::at(path, "no such asset").into());
    };
    if asset.author_id != author {
        return Err(
            GalleryError::at(path, "a profile picture must be an asset you uploaded").into(),
        );
    }
    if asset.redacted_at.is_some() {
        return Err(GalleryError::at(path, "this asset has been removed").into());
    }
    Ok(Some(Some(manifest_entry(asset, None)?)))
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
/// Each placement's description is read off the same entry for the same
/// reason — the junction row caches what the version's manifest witnessed,
/// so a gallery read never has to decode a payload.
///
/// A digest with no row is dropped rather than failing the promotion. The
/// record is ordered fact whatever CoGra holds; a manifest entry whose
/// asset is gone renders as one fewer picture, not as a post that will not
/// load.
pub async fn resolve_manifest(
    pool: &PgPool,
    author: Uuid,
    manifest: &[common::envelope::MediaAsset],
) -> Result<Vec<store::GalleryPlacement>, sqlx::Error> {
    if manifest.is_empty() {
        return Ok(Vec::new());
    }
    let digests: Vec<Vec<u8>> = manifest.iter().map(|a| a.digest.to_vec()).collect();
    let rows = store::assets_by_digests(pool, author, &digests).await?;
    Ok(manifest
        .iter()
        .filter_map(|entry| {
            rows.iter()
                .find(|row| row.digest == entry.digest)
                .map(|row| store::GalleryPlacement {
                    attachment_id: row.id,
                    alt_text: entry.alt_text.clone(),
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

/// Writes the object, then the row.
///
/// Bytes and derived facts only: the row carries nothing the author typed,
/// which is what lets a picture upload the moment it is picked
/// (data-model.md "Media attachments").
///
/// The poster is stated here rather than set later because an asset row
/// is immutable once written: the only honest moment to name what covers
/// an asset is the moment it is created.
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
    cover_media_id: Option<Uuid>,
) -> anyhow::Result<store::MediaAttachment> {
    let id = Uuid::new_v4();
    let key = storage_key(id, asset.mime);
    let size_bytes = i64::try_from(asset.bytes.len())?;
    let mut options = serde_json::json!({ "v": 1, "aspect_ratio": asset.aspect_ratio() });
    if let Some(duration_ms) = asset.duration_ms
        && let Some(map) = options.as_object_mut()
    {
        map.insert("duration_ms".into(), duration_ms.into());
    }

    blobs.put(&key, asset.bytes, asset.mime).await?;

    let row = store::insert(
        pool,
        id,
        author,
        &asset.digest,
        "sha256",
        &key,
        asset.mime,
        size_bytes,
        &options,
        cover_media_id,
    )
    .await?;

    if row.storage_key != key
        && let Err(e) = blobs.delete(&key).await
    {
        tracing::warn!(error = %e, key, "leaving a duplicate upload's object to the sweeper");
    }
    Ok(row)
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
        fn chunk(fourcc: &[u8; 4], payload: &[u8]) -> Vec<u8> {
            let mut out = Vec::new();
            out.extend_from_slice(fourcc);
            out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
            out.extend_from_slice(payload);
            if payload.len() % 2 == 1 {
                out.push(0);
            }
            out
        }
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
        let mut out = Vec::new();
        out.extend_from_slice(b"RIFF");
        out.extend_from_slice(&((4 + body.len()) as u32).to_le_bytes());
        out.extend_from_slice(b"WEBP");
        out.extend_from_slice(&body);
        out
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
