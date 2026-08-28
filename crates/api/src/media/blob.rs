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
//! Two ordering facts the callers depend on. **Blob first, row second:**
//! a blob write and a Postgres commit are not one transaction, and of the
//! two failure modes an orphaned object is collectable garbage while a
//! row pointing at nothing is a render that can never succeed. **Keys are
//! server-generated:** nothing a client sent reaches a key, so a
//! traversal or an overwrite of someone else's object is not defended
//! against, it is unrepresentable.

use std::pin::Pin;

use object_store::aws::AmazonS3Builder;
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
pub struct ObjectBlobStore<S: ObjectStore>(S);

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

impl<S: ObjectStore> BlobStore for ObjectBlobStore<S> {
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
}
