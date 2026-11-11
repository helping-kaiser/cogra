//! ´mod:module:multipart´
//!
//! The `/graphql` multipart envelope (the GraphQL multipart request
//! specification, jaydenseric/graphql-multipart-request-spec), parsed with
//! limits of its own.
//!
//! async-graphql's own multipart parse (`receive_batch_body`) gives every
//! field one size limit — the file cap — so the `operations` and `map`
//! fields, which it reads whole into memory, could each grow to the upload
//! transport ceiling. `MultipartOptions` has no other knob (7.2.1). The
//! parse here is the same pipeline on the library it already rides,
//! `multer`, whose `SizeLimit::for_field` gives the two JSON fields the
//! JSON body ceiling while a file keeps the transport ceiling.
//!
//! A per-field limit bounds field *data* only. `multer` holds the preamble
//! and each part's header block in its buffer until the delimiter arrives,
//! bounded by nothing but its whole-stream limit, so the body is also
//! metered: everything outside a file's data shares one small budget
//! ([`MULTIPART_ENVELOPE_BYTES`] past the two JSON fields), and the budget
//! opens by one file cap only while a file's data streams. Every refusal
//! happens while the body streams; nothing is buffered first and measured
//! after.

use std::collections::HashMap;
use std::io::SeekFrom;
use std::pin::Pin;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::task::{Context, Poll};

use async_graphql::futures_util::{Stream, ready};
use async_graphql::http::receive_batch_json;
use async_graphql::{BatchRequest, ParseRequestError, UploadValue};
use axum::body::Bytes;
use multer::{Constraints, Multipart, SizeLimit};
use tokio::io::{AsyncSeekExt, AsyncWriteExt};

/// The bytes a multipart envelope may spend outside its `operations`,
/// `map` and file data: the preamble, every boundary and part header
/// block, ignored parts, and the epilogue.
///
/// Chosen, not measured to the byte: both clients' envelopes
/// (apollo-upload-client on the web, Apollo Kotlin on Android) carry three
/// part header blocks of one or two headers each, well under a kilobyte.
/// 64 KiB is room for any lawful client's headers and the one metered
/// chunk in flight ([`METERED_CHUNK_BYTES`]) many times over, and is small
/// beside the two JSON fields it rides with.
pub const MULTIPART_ENVELOPE_BYTES: usize = 64 * 1024;

/// The largest piece the meter hands the parser at once. The parser reads
/// every chunk that is ready in one go; handing it one bounded piece per
/// poll keeps what it holds beyond the meter's count to a single piece,
/// so a fast client's in-flight bytes are never charged to the envelope
/// budget ahead of the field they belong to.
const METERED_CHUNK_BYTES: usize = 16 * 1024;

/// The limits one multipart request answers to.
#[derive(Clone, Copy, Debug)]
pub struct MultipartLimits {
    /// The ceiling on each of the `operations` and `map` fields — the
    /// JSON body ceiling, so both paths into `/graphql` hold a request's
    /// JSON to one number.
    pub json_field_bytes: usize,
    /// The ceiling on one file's data — the upload transport ceiling.
    pub file_bytes: usize,
    /// The most files one request carries.
    pub max_files: usize,
}

/// Why a multipart envelope was not parsed.
#[derive(Debug)]
pub enum MultipartRefusal {
    /// A field, the envelope, or the body went past its ceiling.
    TooLarge,
    /// The envelope is malformed; answered the way the library answers
    /// its own parse errors.
    Malformed(ParseRequestError),
}

/// A malformed envelope the library's parse would have accepted.
#[derive(Debug, thiserror::Error)]
enum EnvelopeError {
    #[error("a request carries at most {0} file(s)")]
    TooManyFiles(usize),
    #[error("file fields follow the operations and map fields")]
    FileBeforeOperations,
}

impl From<EnvelopeError> for MultipartRefusal {
    fn from(e: EnvelopeError) -> Self {
        MultipartRefusal::Malformed(ParseRequestError::InvalidRequest(Box::new(e)))
    }
}

impl From<multer::Error> for MultipartRefusal {
    fn from(e: multer::Error) -> Self {
        match e {
            multer::Error::FieldSizeExceeded { .. } | multer::Error::StreamSizeExceeded { .. } => {
                MultipartRefusal::TooLarge
            }
            multer::Error::StreamReadFailed(ref cause)
                if cause.is::<OverBudget>() || crate::over_the_body_limit(&**cause) =>
            {
                MultipartRefusal::TooLarge
            }
            other => MultipartRefusal::Malformed(ParseRequestError::InvalidMultipart(other)),
        }
    }
}

/// Parses a multipart `/graphql` body whose content type is
/// `content_type`, in the library's semantics — `operations` is a JSON
/// batch request, `map` names each file's variable paths, a file absent
/// from the map is ignored, a mapped file that never arrives is
/// [`ParseRequestError::MissingFiles`] — under `limits` and the envelope
/// budget.
///
/// Two answers are stricter than the library's and the specification's
/// field order makes them lawful: a file part before `operations` and
/// `map` is refused, and so is a file past `limits.max_files` (the library
/// spends that option only on its whole-stream limit and never counts).
pub async fn receive_batch_multipart<S>(
    content_type: &mime::Mime,
    body: S,
    limits: MultipartLimits,
) -> Result<BatchRequest, MultipartRefusal>
where
    S: Stream<Item = Result<Bytes, axum::Error>> + Send + Unpin + 'static,
{
    let Some(boundary) = content_type.get_param("boundary") else {
        return Err(MultipartRefusal::Malformed(
            ParseRequestError::InvalidMultipart(multer::Error::NoBoundary),
        ));
    };
    let json_field = limits.json_field_bytes as u64;
    let file = limits.file_bytes as u64;
    let envelope = MULTIPART_ENVELOPE_BYTES as u64;
    let meter = Arc::new(Meter::new(
        json_field.saturating_mul(2).saturating_add(envelope),
    ));
    let constraints = Constraints::new().size_limit(
        SizeLimit::new()
            .per_field(file)
            .for_field("operations", json_field)
            .for_field("map", json_field),
    );
    let mut multipart = Multipart::with_constraints(
        Metered::new(body, meter.clone()),
        boundary.as_str(),
        constraints,
    );

    let mut request: Option<BatchRequest> = None;
    let mut map: Option<HashMap<String, Vec<String>>> = None;
    let mut files = Vec::new();
    while let Some(mut field) = multipart.next_field().await? {
        match field.name() {
            Some("operations") => {
                let bytes = field.bytes().await?;
                request = Some(
                    receive_batch_json(bytes.as_ref())
                        .await
                        .map_err(MultipartRefusal::Malformed)?,
                );
            }
            Some("map") => {
                let bytes = field.bytes().await?;
                map = Some(serde_json::from_slice(&bytes).map_err(|e| {
                    MultipartRefusal::Malformed(ParseRequestError::InvalidFilesMap(Box::new(e)))
                })?);
            }
            Some(name) => {
                let Some(filename) = field.file_name() else {
                    continue;
                };
                if request.is_none() || map.is_none() {
                    return Err(EnvelopeError::FileBeforeOperations.into());
                }
                if files.len() >= limits.max_files {
                    return Err(EnvelopeError::TooManyFiles(limits.max_files).into());
                }
                let name = name.to_owned();
                let filename = filename.to_owned();
                let content_type = field.content_type().map(ToString::to_string);
                meter.allow(file.saturating_add(envelope));
                let content = spool(&mut field).await?;
                meter.allow(envelope);
                files.push((name, filename, content_type, content));
            }
            None => {}
        }
    }

    let mut request = request.ok_or(MultipartRefusal::Malformed(
        ParseRequestError::MissingOperatorsPart,
    ))?;
    let mut map = map.ok_or(MultipartRefusal::Malformed(
        ParseRequestError::MissingMapPart,
    ))?;
    for (name, filename, content_type, content) in files {
        let Some(paths) = map.remove(&name) else {
            continue;
        };
        let upload = UploadValue {
            filename,
            content_type,
            content,
        };
        for path in paths {
            let clone = upload
                .try_clone()
                .map_err(|e| MultipartRefusal::Malformed(ParseRequestError::Io(e)))?;
            match &mut request {
                BatchRequest::Single(request) => request.set_upload(&path, clone),
                BatchRequest::Batch(requests) => {
                    let mut split = path.splitn(2, '.');
                    let index = split.next().and_then(|i| i.parse::<usize>().ok());
                    if let (Some(index), Some(path)) = (index, split.next())
                        && let Some(request) = requests.get_mut(index)
                    {
                        request.set_upload(path, clone);
                    }
                }
            }
        }
    }
    if !map.is_empty() {
        return Err(MultipartRefusal::Malformed(ParseRequestError::MissingFiles));
    }
    Ok(request)
}

/// Streams one file field into an anonymous temporary file, rewound for
/// the resolver that reads it — the library's spool, written through
/// tokio's file rather than blocking writes on the runtime.
async fn spool(field: &mut multer::Field<'_>) -> Result<std::fs::File, MultipartRefusal> {
    let io = |e: std::io::Error| MultipartRefusal::Malformed(ParseRequestError::Io(e));
    let mut file = tokio::fs::File::from_std(tempfile::tempfile().map_err(io)?);
    while let Some(chunk) = field.chunk().await? {
        file.write_all(&chunk).await.map_err(io)?;
    }
    file.flush().await.map_err(io)?;
    file.seek(SeekFrom::Start(0)).await.map_err(io)?;
    Ok(file.into_std().await)
}

/// The body's running byte count and the count it may not pass.
struct Meter {
    read: AtomicU64,
    limit: AtomicU64,
}

impl Meter {
    fn new(limit: u64) -> Self {
        Self {
            read: AtomicU64::new(0),
            limit: AtomicU64::new(limit),
        }
    }

    /// Lets the body run `bytes` past what it has delivered so far.
    fn allow(&self, bytes: u64) {
        let read = self.read.load(Ordering::Relaxed);
        self.limit
            .store(read.saturating_add(bytes), Ordering::Relaxed);
    }
}

/// The body ran past the envelope's budget.
#[derive(Debug, thiserror::Error)]
#[error("the multipart envelope is larger than this endpoint accepts")]
struct OverBudget;

/// The request body as the parser sees it: at most one bounded piece per
/// poll, each charged to the [`Meter`] before the parser holds it.
///
/// After handing over a piece it answers the next poll `Pending` and wakes
/// itself at once — the cooperative yield — so the parser's read-ahead
/// loop stops at every piece and works through it before pulling more.
struct Metered<S> {
    inner: S,
    held: Bytes,
    yielded: bool,
    meter: Arc<Meter>,
}

impl<S> Metered<S> {
    fn new(inner: S, meter: Arc<Meter>) -> Self {
        Self {
            inner,
            held: Bytes::new(),
            yielded: false,
            meter,
        }
    }
}

impl<S> Stream for Metered<S>
where
    S: Stream<Item = Result<Bytes, axum::Error>> + Unpin,
{
    type Item = Result<Bytes, Box<dyn std::error::Error + Send + Sync>>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let this = &mut *self;
        if this.yielded {
            this.yielded = false;
            cx.waker().wake_by_ref();
            return Poll::Pending;
        }
        if this.held.is_empty() {
            match ready!(Pin::new(&mut this.inner).poll_next(cx)) {
                None => return Poll::Ready(None),
                Some(Err(e)) => return Poll::Ready(Some(Err(Box::new(e)))),
                Some(Ok(bytes)) => this.held = bytes,
            }
        }
        let piece = this.held.split_to(this.held.len().min(METERED_CHUNK_BYTES));
        let read = this
            .meter
            .read
            .fetch_add(piece.len() as u64, Ordering::Relaxed)
            .saturating_add(piece.len() as u64);
        if read > this.meter.limit.load(Ordering::Relaxed) {
            return Poll::Ready(Some(Err(Box::new(OverBudget))));
        }
        this.yielded = true;
        Poll::Ready(Some(Ok(piece)))
    }
}
