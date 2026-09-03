//! ´mod:module:blob´
//!
//! The seam between CoGra and the bytes: a store that holds objects under
//! server-generated keys and knows nothing else about them.
//!
//! The trait speaks the S3 object protocol rather than a filesystem
//! because that is the boundary that survives the store leaving this
//! machine — another host, another provider, or a federated peer serving
//! its own members' media. The store is its own service with its own
//! lifecycle; the API is a client of it and never holds bytes itself
//! (architecture.md "Infrastructure").
//!
//! The trait carries the store's multipart upload beside its whole-object
//! put for the same reason it speaks S3 at all: assembling a large upload
//! out of independently retryable parts is what the object protocol
//! already does, and reimplementing it a layer up would be a second,
//! worse copy of a mechanism the store ships.
//!
//! Two ordering facts the callers depend on. **Blob first, row second:**
//! a blob write and a Postgres commit are not one transaction, and of the
//! two failure modes an orphaned object is collectable garbage while a
//! row pointing at nothing is a render that can never succeed. **Keys are
//! server-generated:** nothing a client sent reaches a key, so a
//! traversal or an overwrite of someone else's object is not defended
//! against, it is unrepresentable.

use std::pin::Pin;

use object_store::aws::AmazonS3Builder;
use object_store::multipart::{MultipartStore, PartId};
use object_store::path::Path as ObjectPath;
use object_store::{
    Attribute, Attributes, Error as ObjectStoreError, ObjectStore, ObjectStoreExt, PutOptions,
    PutPayload,
};

/// What a caller can do about a failed byte operation: nothing, except
/// refuse the write and say so. The store is a separate service, so its
/// failures are the ordinary failures of a network call.
#[derive(Debug, thiserror::Error)]
pub enum BlobError {
    #[error("the media store refused the object: {0}")]
    Store(#[from] ObjectStoreError),
    #[error("the media store is misconfigured: {0}")]
    Config(String),
}

/// An asset's bytes are immutable — the row is never updated after upload
/// and a corrected picture is a new asset — so a reader may cache them
/// forever. `immutable` is what tells a browser not to revalidate at all.
const CACHE_CONTROL: &str = "public, max-age=31536000, immutable";

/// The object store, as everything above it sees it.
pub trait BlobStore: Send + Sync {
    /// Writes the object and does not return until the store has it. The
    /// row that points at this key is written only after this resolves.
    fn put<'a>(
        &'a self,
        key: &'a str,
        bytes: Vec<u8>,
        mime: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<(), BlobError>> + Send + 'a>>;

    /// The object's bytes. Readers fetch media from the store's own
    /// origin, so this is for verification and tooling rather than the
    /// serving path.
    fn get<'a>(
        &'a self,
        key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<u8>, BlobError>> + Send + 'a>>;

    /// Whether the object is there. A missing object under a live row is
    /// the one inconsistency the write ordering cannot produce, so this
    /// exists to prove that rather than to be relied on.
    fn exists<'a>(
        &'a self,
        key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<bool, BlobError>> + Send + 'a>>;

    /// Removes the object. Deleting one that is already gone succeeds:
    /// the sweeper and, later, the redaction cascade both retry, and a
    /// retry must converge rather than fail on its own prior success.
    fn delete<'a>(
        &'a self,
        key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<(), BlobError>> + Send + 'a>>;

    /// Opens a multipart upload against `key` and hands back the store's
    /// own identifier for it.
    ///
    /// The identifier is what makes an upload outlive the request that
    /// started it: it is persisted beside the session row, and every
    /// later part carries it, so a client that lost its connection
    /// resumes against the same upload rather than starting over.
    fn create_multipart<'a>(
        &'a self,
        key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<String, BlobError>> + Send + 'a>>;

    /// Writes one part and returns the store's identifier for it, which
    /// the completion has to quote back.
    ///
    /// `part_idx` is zero-based; the S3 part number is one greater, which
    /// is the object store's own convention rather than ours.
    ///
    /// **Re-sending a part replaces it.** S3 defines a part number as
    /// naming a position rather than an attempt — "if you upload a new
    /// part using the same part number as a previously uploaded part, the
    /// previously uploaded part gets overwritten" — so a client that
    /// retries a part it is unsure of cannot corrupt the upload by
    /// sending it twice. That is the property the whole resumable path
    /// rests on, and it belongs to the store, not to us.
    fn put_part<'a>(
        &'a self,
        key: &'a str,
        upload_id: &'a str,
        part_idx: usize,
        bytes: Vec<u8>,
    ) -> Pin<Box<dyn Future<Output = Result<String, BlobError>> + Send + 'a>>;

    /// Assembles the parts into the object at `key`, in the order given.
    ///
    /// The identifiers are quoted from what this server recorded at each
    /// part write rather than from a listing of the store, which is what
    /// S3's own guidance asks for: "maintain your own list of the part
    /// numbers that you specified when uploading parts and the
    /// corresponding ETag values".
    fn complete_multipart<'a>(
        &'a self,
        key: &'a str,
        upload_id: &'a str,
        content_ids: Vec<String>,
    ) -> Pin<Box<dyn Future<Output = Result<(), BlobError>> + Send + 'a>>;

    /// Discards an upload and every part written under it.
    ///
    /// Aborting one that is already gone succeeds, for the same reason
    /// [`BlobStore::delete`] does: the sweeper retries, and a retry has to
    /// converge rather than fail on its own prior success. Until this
    /// runs, the parts are storage nobody can read — which is why an
    /// abandoned session is swept rather than left to age out.
    fn abort_multipart<'a>(
        &'a self,
        key: &'a str,
        upload_id: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<(), BlobError>> + Send + 'a>>;
}

/// How to reach the media service.
#[derive(Debug, Clone)]
pub struct S3Config {
    pub endpoint: String,
    pub bucket: String,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub region: String,
}

/// The one implementation, over any object store.
///
/// It is generic rather than S3-specific so the test double and the
/// running service are the *same* code: a rig exercising an in-memory
/// backend exercises this put, this delete, and this not-found handling,
/// not a parallel implementation that only looks similar. No local
/// filesystem variant exists — a dev-only backend that production never
/// runs is how a dev posture stops being a preview of release.
/// The store is bound to [`MultipartStore`] as well as [`ObjectStore`]
/// because resumable upload is not an extra this seam can do without: a
/// backend that cannot hold parts between requests cannot carry a large
/// upload across a dropped connection, and a deployment posture that
/// silently loses that is exactly what the generic-over-one-implementation
/// choice above exists to prevent.
pub struct ObjectBlobStore<S: ObjectStore + MultipartStore>(S);

/// The media service as it actually runs.
///
/// Plain http is permitted only when the operator's own endpoint asks
/// for it, which in practice means a development store on the same
/// machine. A production endpoint is https and this never loosens it.
///
/// Path-style addressing, because a bucket name in the hostname needs
/// DNS entries per bucket that a self-hosted store does not have.
pub fn s3(config: &S3Config) -> Result<ObjectBlobStore<object_store::aws::AmazonS3>, BlobError> {
    let allow_http = config.endpoint.starts_with("http://");
    let store = AmazonS3Builder::new()
        .with_endpoint(&config.endpoint)
        .with_bucket_name(&config.bucket)
        .with_access_key_id(&config.access_key_id)
        .with_secret_access_key(&config.secret_access_key)
        .with_region(&config.region)
        .with_allow_http(allow_http)
        .with_virtual_hosted_style_request(false)
        .build()?;
    Ok(ObjectBlobStore(store))
}

/// A store that keeps objects in this process. For test rigs and nothing
/// else: it is not a deployment posture, and it forgets everything when
/// the process ends.
pub fn in_memory() -> ObjectBlobStore<object_store::memory::InMemory> {
    ObjectBlobStore(object_store::memory::InMemory::new())
}

impl<S: ObjectStore + MultipartStore> BlobStore for ObjectBlobStore<S> {
    fn put<'a>(
        &'a self,
        key: &'a str,
        bytes: Vec<u8>,
        mime: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<(), BlobError>> + Send + 'a>> {
        Box::pin(async move {
            let mut attributes = Attributes::new();
            attributes.insert(Attribute::ContentType, mime.to_string().into());
            attributes.insert(Attribute::CacheControl, CACHE_CONTROL.into());
            let options = PutOptions {
                attributes,
                ..Default::default()
            };
            self.0
                .put_opts(&ObjectPath::from(key), PutPayload::from(bytes), options)
                .await?;
            Ok(())
        })
    }

    fn get<'a>(
        &'a self,
        key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<u8>, BlobError>> + Send + 'a>> {
        Box::pin(async move {
            let result = self.0.get(&ObjectPath::from(key)).await?;
            Ok(result.bytes().await?.to_vec())
        })
    }

    fn exists<'a>(
        &'a self,
        key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<bool, BlobError>> + Send + 'a>> {
        Box::pin(async move {
            match self.0.head(&ObjectPath::from(key)).await {
                Ok(_) => Ok(true),
                Err(ObjectStoreError::NotFound { .. }) => Ok(false),
                Err(e) => Err(e.into()),
            }
        })
    }

    fn delete<'a>(
        &'a self,
        key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<(), BlobError>> + Send + 'a>> {
        Box::pin(async move {
            match self.0.delete(&ObjectPath::from(key)).await {
                Ok(()) | Err(ObjectStoreError::NotFound { .. }) => Ok(()),
                Err(e) => Err(e.into()),
            }
        })
    }

    fn create_multipart<'a>(
        &'a self,
        key: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<String, BlobError>> + Send + 'a>> {
        Box::pin(async move { Ok(self.0.create_multipart(&ObjectPath::from(key)).await?) })
    }

    fn put_part<'a>(
        &'a self,
        key: &'a str,
        upload_id: &'a str,
        part_idx: usize,
        bytes: Vec<u8>,
    ) -> Pin<Box<dyn Future<Output = Result<String, BlobError>> + Send + 'a>> {
        Box::pin(async move {
            let part = self
                .0
                .put_part(
                    &ObjectPath::from(key),
                    &upload_id.to_string(),
                    part_idx,
                    PutPayload::from(bytes),
                )
                .await?;
            Ok(part.content_id)
        })
    }

    fn complete_multipart<'a>(
        &'a self,
        key: &'a str,
        upload_id: &'a str,
        content_ids: Vec<String>,
    ) -> Pin<Box<dyn Future<Output = Result<(), BlobError>> + Send + 'a>> {
        Box::pin(async move {
            let parts = content_ids
                .into_iter()
                .map(|content_id| PartId { content_id })
                .collect();
            self.0
                .complete_multipart(&ObjectPath::from(key), &upload_id.to_string(), parts)
                .await?;
            Ok(())
        })
    }

    fn abort_multipart<'a>(
        &'a self,
        key: &'a str,
        upload_id: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<(), BlobError>> + Send + 'a>> {
        Box::pin(async move {
            match self
                .0
                .abort_multipart(&ObjectPath::from(key), &upload_id.to_string())
                .await
            {
                Ok(()) | Err(ObjectStoreError::NotFound { .. }) => Ok(()),
                Err(e) => Err(e.into()),
            }
        })
    }
}
