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
use postgres_store::media::{GalleryEntry, MediaAttachment};
use postgres_store::removal::{self as removal_store, Removal};
use postgres_store::{
    PgPool, auth as store, bookmarks as bookmarks_store, content as content_store,
    media as media_store,
};
use uuid::Uuid;

use crate::schema::types::RecordAct;

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

/// Actors by their address atom — the `prof:` arm of a target
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
                    .realization_address
                    .clone()
                    .map(|address| (address, identity))
            })
            .collect())
    }
}

/// Actors by their own id — the author every content node names.
///
/// `ActorByAddressLoader` cannot serve this: it keys on the address,
/// which is what a citation carries, while a post carries its author's
/// row id. A page of a hundred posts resolves a hundred authors, and
/// each of those resolves an avatar, so this is where that fan-out
/// starts.
pub struct ActorByIdLoader(PgPool);

impl Loader<Uuid> for ActorByIdLoader {
    type Value = ActorIdentity;
    type Error = LoadError;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, ActorIdentity>, LoadError> {
        Ok(store::actor_identities_by_ids(&self.0, keys)
            .await
            .map_err(LoadError::from_display)?
            .into_iter()
            .map(|identity| (identity.id, identity))
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

/// Assets by their own id — the poster an asset names as its cover.
///
/// A poster hangs off the asset rather than off the page's node, so a
/// gallery resolves one per covered asset and a feed page multiplies that
/// by every post on it. Same N+1 as the galleries above, one level
/// further in.
///
/// An id with no row is absent from the map, which the resolver reads as
/// "no poster" — the same answer a null column gives, and the right one
/// either way: a cover that is gone is a video without one, never a read
/// that fails.
pub struct MediaByIdLoader(PgPool);

impl Loader<Uuid> for MediaByIdLoader {
    type Value = MediaAttachment;
    type Error = LoadError;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, MediaAttachment>, LoadError> {
        Ok(media_store::assets_by_ids(&self.0, keys)
            .await
            .map_err(LoadError::from_display)?
            .into_iter()
            .map(|asset| (asset.id, asset))
            .collect())
    }
}

/// When an act's payload was reduced, keyed on the act identifier.
///
/// `Record.payloadState` and `Record.redactedAt` are per-record fields, so
/// a chronicle page asks once per record; batching collapses a page into
/// one read. A key with no row is absent from the map, which the resolver
/// reads as FULL — the same answer an act that never carried a payload
/// deserves.
pub struct PayloadStateLoader(PgPool);

impl Loader<String> for PayloadStateLoader {
    type Value = chrono::DateTime<chrono::Utc>;
    type Error = LoadError;

    async fn load(
        &self,
        keys: &[String],
    ) -> Result<HashMap<String, chrono::DateTime<chrono::Utc>>, LoadError> {
        Ok(content_store::reduced_payload_acts(&self.0, keys)
            .await
            .map_err(LoadError::from_display)?
            .into_iter()
            .collect())
    }
}

/// A removed post's mark, keyed on the post id: `Post.removal` and a
/// removed post's `updatedAt` ask once per removed card on a page. A post
/// with no tombstone is absent.
pub struct PostRemovalLoader(PgPool);

impl Loader<Uuid> for PostRemovalLoader {
    type Value = Removal;
    type Error = LoadError;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Removal>, LoadError> {
        removal_store::post_removals(&self.0, keys)
            .await
            .map_err(LoadError::from_display)
    }
}

/// The comment side of [`PostRemovalLoader`].
pub struct CommentRemovalLoader(PgPool);

impl Loader<Uuid> for CommentRemovalLoader {
    type Value = Removal;
    type Error = LoadError;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Removal>, LoadError> {
        removal_store::comment_removals(&self.0, keys)
            .await
            .map_err(LoadError::from_display)
    }
}

/// Whether a stance record left its bundle walked back, keyed on the
/// record identifier: `Record.severed` on every record of a page asks
/// once. A record that folds into no stance bundle is absent, which the
/// resolver reads as null.
pub struct SeveringRecordLoader(PgPool);

impl Loader<String> for SeveringRecordLoader {
    type Value = bool;
    type Error = LoadError;

    async fn load(&self, keys: &[String]) -> Result<HashMap<String, bool>, LoadError> {
        postgres_store::stance::severing_records(&self.0, keys)
            .await
            .map_err(LoadError::from_display)
    }
}

/// What a record did beyond its family (`Record.act`), keyed on the record
/// identifier: every record of a page asks once. The three readings are
/// three independent reads — the mirror's genesis shape, the stance
/// bundles a walk-back is read off, the application ledger's landing
/// vouches — run side by side for the whole batch. A record none of them
/// names is absent, which the resolver reads as ORDINARY.
///
/// The precedence is `RecordAct`'s declared order. The readings cannot
/// actually meet — a genesis is a minting act or a Registration, a
/// walk-back and a vouch are Opinions or Affinities — but the order is the
/// contract's, so it is applied rather than assumed.
pub struct RecordActLoader(PgPool);

impl Loader<String> for RecordActLoader {
    type Value = RecordAct;
    type Error = LoadError;

    async fn load(&self, keys: &[String]) -> Result<HashMap<String, RecordAct>, LoadError> {
        let (genesis, walked_back, vouches) = tokio::try_join!(
            async {
                postgres_store::mirror::genesis_records(&self.0, keys)
                    .await
                    .map_err(LoadError::from_display)
            },
            async {
                postgres_store::stance::walk_back_records(&self.0, keys)
                    .await
                    .map_err(LoadError::from_display)
            },
            async {
                store::admitting_vouch_records(&self.0, keys)
                    .await
                    .map_err(LoadError::from_display)
            },
        )?;
        Ok(keys
            .iter()
            .filter_map(|id| {
                let act = if genesis.contains(id) {
                    RecordAct::Genesis
                } else if walked_back.contains(id) {
                    RecordAct::WalkBack
                } else if vouches.contains(id) {
                    RecordAct::Vouch
                } else {
                    return None;
                };
                Some((id.clone(), act))
            })
            .collect())
    }
}

/// An epoch's attested boundary timestamp, keyed on the epoch:
/// `Record.landedAt` on every record of a page asks once per distinct
/// epoch. An epoch the mirror has not ingested is absent.
pub struct EpochInstantLoader(PgPool);

impl Loader<i64> for EpochInstantLoader {
    type Value = chrono::DateTime<chrono::Utc>;
    type Error = LoadError;

    async fn load(
        &self,
        keys: &[i64],
    ) -> Result<HashMap<i64, chrono::DateTime<chrono::Utc>>, LoadError> {
        postgres_store::mirror::epoch_instants(&self.0, keys)
            .await
            .map_err(LoadError::from_display)
    }
}

/// When a viewer kept a node, keyed on `(viewer, node)`.
///
/// `viewerBookmarkedAt` is a per-node field every menu host reads, so a
/// feed page of twenty cards asks twenty times. The viewer rides in the
/// key rather than in the loader because the loaders are registered once
/// on the schema, not per request — a key without its viewer would let
/// one reader's batch answer another's. A pair with no row is absent
/// from the map, which the resolver reads as "not kept".
pub struct BookmarkLoader(PgPool);

impl Loader<(Uuid, Uuid)> for BookmarkLoader {
    type Value = chrono::DateTime<chrono::Utc>;
    type Error = LoadError;

    async fn load(
        &self,
        keys: &[(Uuid, Uuid)],
    ) -> Result<HashMap<(Uuid, Uuid), chrono::DateTime<chrono::Utc>>, LoadError> {
        Ok(bookmarks_store::bookmarked_at_many(&self.0, keys)
            .await
            .map_err(LoadError::from_display)?
            .into_iter()
            .map(|(viewer, node, at)| ((viewer, node), at))
            .collect())
    }
}

/// The post a comment's thread hangs under, keyed on the comment's id.
///
/// A Saved comment row names "the post it answers" and opens the post it
/// hangs under; for a reply that is the thread's post, any number of
/// levels up. A page of comment rows resolves in two reads: one walk
/// for the whole batch, then the posts it found.
pub struct ThreadPostLoader(PgPool);

impl Loader<Uuid> for ThreadPostLoader {
    type Value = Post;
    type Error = LoadError;

    async fn load(&self, keys: &[Uuid]) -> Result<HashMap<Uuid, Post>, LoadError> {
        let pairs = content_store::thread_posts(&self.0, keys)
            .await
            .map_err(LoadError::from_display)?;
        let post_ids: Vec<Uuid> = pairs.iter().map(|(_, post)| *post).collect();
        let posts = crate::nodes::resolve_content_many(&self.0, &post_ids)
            .await
            .map_err(LoadError::from_display)?;
        Ok(pairs
            .into_iter()
            .filter_map(|(comment, post)| match posts.get(&post) {
                Some(crate::nodes::ContentNode::Post(p)) => Some((comment, p.clone())),
                _ => None,
            })
            .collect())
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
    pub actors_by_id: DataLoader<ActorByIdLoader>,
    pub post_galleries: DataLoader<PostGalleryLoader>,
    pub comment_galleries: DataLoader<CommentGalleryLoader>,
    pub media: DataLoader<MediaByIdLoader>,
    pub payload_states: DataLoader<PayloadStateLoader>,
    pub post_removals: DataLoader<PostRemovalLoader>,
    pub comment_removals: DataLoader<CommentRemovalLoader>,
    pub severing_records: DataLoader<SeveringRecordLoader>,
    pub record_acts: DataLoader<RecordActLoader>,
    pub epoch_instants: DataLoader<EpochInstantLoader>,
    pub bookmarks: DataLoader<BookmarkLoader>,
    pub thread_posts: DataLoader<ThreadPostLoader>,
}

impl NodeLoaders {
    pub fn new(pool: PgPool) -> Self {
        Self {
            posts: DataLoader::new(PostByNodeLoader(pool.clone()), tokio::spawn),
            comments: DataLoader::new(CommentByNodeLoader(pool.clone()), tokio::spawn),
            actors: DataLoader::new(ActorByAddressLoader(pool.clone()), tokio::spawn),
            actors_by_id: DataLoader::new(ActorByIdLoader(pool.clone()), tokio::spawn),
            post_galleries: DataLoader::new(PostGalleryLoader(pool.clone()), tokio::spawn),
            comment_galleries: DataLoader::new(CommentGalleryLoader(pool.clone()), tokio::spawn),
            media: DataLoader::new(MediaByIdLoader(pool.clone()), tokio::spawn),
            payload_states: DataLoader::new(PayloadStateLoader(pool.clone()), tokio::spawn),
            post_removals: DataLoader::new(PostRemovalLoader(pool.clone()), tokio::spawn),
            comment_removals: DataLoader::new(CommentRemovalLoader(pool.clone()), tokio::spawn),
            severing_records: DataLoader::new(SeveringRecordLoader(pool.clone()), tokio::spawn),
            record_acts: DataLoader::new(RecordActLoader(pool.clone()), tokio::spawn),
            epoch_instants: DataLoader::new(EpochInstantLoader(pool.clone()), tokio::spawn),
            bookmarks: DataLoader::new(BookmarkLoader(pool.clone()), tokio::spawn),
            thread_posts: DataLoader::new(ThreadPostLoader(pool), tokio::spawn),
        }
    }
}
