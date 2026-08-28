//! ´mod:module:loaders´
//!
//! Batched resolution of the far ends a read hangs off identifiers —
//! async-graphql's own `DataLoader` (async-graphql docs, "Batch loading
//! support"), one loader per node class.
//!
//! # Why a loader rather than a wider query
//!
//! A citation stores its target as an L1 identifier, not a foreign key,
//! and the identifier's own grammar carries the class. So a fold list
//! cannot join its targets in: the rows it returns name posts, comments
//! and profiles indiscriminately, and the tables that answer for them are
//! different tables. Resolving one at a time is the N+1 this module
//! exists to close — a detail read serves a bounded set of citations per
//! node across every node on the page, and each one used to cost its own
//! round trip.
//!
//! # How the batching happens
//!
//! Nothing here schedules anything. async-graphql resolves list elements
//! and sibling fields concurrently (`resolver_utils::resolve_list`), so
//! every `ReferenceClaim.target` on a page is in flight at once; each
//! calls `load_one`, and the loader collects the keys arriving inside its
//! delay window into a single `= ANY($1)` query. That is why `target` is
//! a *resolver* and not a field the fold fills in eagerly: an eager loop
//! is sequential, and a sequential loop is exactly what a loader cannot
//! batch.
//!
//! The loaders are built with [`DataLoader::new`], which is the
//! `NoCache` constructor. They are registered once on the schema rather
//! than per request, and that is only sound *because* there is no cache:
//! a cached loader living that long would serve one request's rows to the
//! next one's read, which is the staleness the record mirror's whole
//! contract forbids.

use std::collections::HashMap;
use std::sync::Arc;

use async_graphql::dataloader::{DataLoader, Loader};
use postgres_store::auth::ActorIdentity;
use postgres_store::content::{Comment, Post};
use postgres_store::media::GalleryEntry;
use postgres_store::{PgPool, auth as store, content as content_store, media as media_store};

/// A batch read's failure, shared out to every key that was waiting on
/// it. `Loader::Error` must be `Clone`, and neither store error is, so
/// the message is what travels — the surfaces that raise it turn any
/// storage fault into the same opaque server error anyway.
#[derive(Debug, Clone, thiserror::Error)]
#[error("{0}")]
pub struct LoadError(Arc<str>);

impl LoadError {
    fn from_display(e: impl std::fmt::Display) -> Self {
        Self(Arc::from(e.to_string().as_str()))
    }
}

/// Posts by their minted L1 node identifier.
pub struct PostByNodeLoader(PgPool);

impl Loader<String> for PostByNodeLoader {
    type Value = Post;
    type Error = LoadError;

    async fn load(&self, keys: &[String]) -> Result<HashMap<String, Post>, LoadError> {
        Ok(content_store::posts_by_nodes(&self.0, keys)
            .await
            .map_err(LoadError::from_display)?
            .into_iter()
            .map(|post| (post.l1_node_id.clone(), post))
            .collect())
    }
}

/// Comments by their minted L1 node identifier.
pub struct CommentByNodeLoader(PgPool);

impl Loader<String> for CommentByNodeLoader {
    type Value = Comment;
    type Error = LoadError;

    async fn load(&self, keys: &[String]) -> Result<HashMap<String, Comment>, LoadError> {
        Ok(content_store::comments_by_nodes(&self.0, keys)
            .await
            .map_err(LoadError::from_display)?
            .into_iter()
            .map(|comment| (comment.l1_node_id.clone(), comment))
            .collect())
    }
}

/// Actors by their L0 address atom — the `prof:` arm of a target
/// identifier, and the only class an address can answer for.
pub struct ActorByAddressLoader(PgPool);

impl Loader<String> for ActorByAddressLoader {
    type Value = ActorIdentity;
    type Error = LoadError;

    async fn load(&self, keys: &[String]) -> Result<HashMap<String, ActorIdentity>, LoadError> {
        Ok(store::actor_identities_by_addresses(&self.0, keys)
            .await
            .map_err(LoadError::from_display)?
            .into_iter()
            .filter_map(|identity| {
                identity
                    .l0_address
                    .clone()
                    .map(|address| (address, identity))
            })
            .collect())
    }
}

/// Post galleries by the version row they hang off.
///
/// The gallery is a per-node list, so a feed page of twenty posts asks
/// twenty times and a detail read asks once per comment on the page. That
/// is the N+1 this loader closes: every `attachments` field on a page
/// reaches it inside one batching window and the whole page's galleries
/// come back in a single query.
///
/// Keyed on the version rather than the post because the gallery belongs
/// to the version — the read that produced the node already resolved which
/// version wins, and re-deciding here could disagree with the text on
/// screen.
pub struct PostGalleryLoader(PgPool);

impl Loader<i64> for PostGalleryLoader {
    type Value = Vec<GalleryEntry>;
    type Error = LoadError;

    async fn load(&self, keys: &[i64]) -> Result<HashMap<i64, Vec<GalleryEntry>>, LoadError> {
        Ok(collect_galleries(
            media_store::post_galleries(&self.0, keys)
                .await
                .map_err(LoadError::from_display)?,
        ))
    }
}

/// Comment galleries, keyed the same way.
pub struct CommentGalleryLoader(PgPool);

impl Loader<i64> for CommentGalleryLoader {
    type Value = Vec<GalleryEntry>;
    type Error = LoadError;

    async fn load(&self, keys: &[i64]) -> Result<HashMap<i64, Vec<GalleryEntry>>, LoadError> {
        Ok(collect_galleries(
            media_store::comment_galleries(&self.0, keys)
                .await
                .map_err(LoadError::from_display)?,
        ))
    }
}

/// Groups a flat gallery read back into one list per version, preserving
/// the query's own ordering — which is gallery order.
///
/// A version with no gallery is simply absent from the map, and the
/// resolver reads that as the empty gallery it is.
fn collect_galleries(rows: Vec<(i64, GalleryEntry)>) -> HashMap<i64, Vec<GalleryEntry>> {
    let mut out: HashMap<i64, Vec<GalleryEntry>> = HashMap::new();
    for (version_id, entry) in rows {
        out.entry(version_id).or_default().push(entry);
    }
    out
}

/// Every loader a request may reach, built over one pool.
///
/// Returned as a bundle rather than registered here so the schema
/// builder stays the single place that says what request data exists.
pub struct NodeLoaders {
    pub posts: DataLoader<PostByNodeLoader>,
    pub comments: DataLoader<CommentByNodeLoader>,
    pub actors: DataLoader<ActorByAddressLoader>,
    pub post_galleries: DataLoader<PostGalleryLoader>,
    pub comment_galleries: DataLoader<CommentGalleryLoader>,
}

impl NodeLoaders {
    pub fn new(pool: PgPool) -> Self {
        Self {
            posts: DataLoader::new(PostByNodeLoader(pool.clone()), tokio::spawn),
            comments: DataLoader::new(CommentByNodeLoader(pool.clone()), tokio::spawn),
            actors: DataLoader::new(ActorByAddressLoader(pool.clone()), tokio::spawn),
            post_galleries: DataLoader::new(PostGalleryLoader(pool.clone()), tokio::spawn),
            comment_galleries: DataLoader::new(CommentGalleryLoader(pool), tokio::spawn),
        }
    }
}
