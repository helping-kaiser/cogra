//! ´mod:module:query´
//!
//! The query root: the health probe, the viewer (`me`), the staged-write
//! observation read, and — from slice 2 — the content reads: typed
//! nodes, the chronological listing, and the generic record chronicle.
//! Reads need no authentication — the shared graph is public; the
//! private fields are field-level authorized on their types.

use async_graphql::{Context, Object, SimpleObject};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use postgres_store::{PgPool, auth as store, content as content_store, mirror, staged};
use uuid::Uuid;

use super::types::{
    Actor, CommentType, CursorKey, HashtagType, InviteLinkCheck, KeysetConnection, Node, PostType,
    Record, RecordFamily, RecordId, ReferenceCandidate, ReferenceTarget, StagedWriteType, User,
    connection_cost, content_cursor, content_cursor_key, keyset_connection, keyset_page, list_cost,
    list_limit, resolve_reference_target,
};
use crate::auth::Viewer;
use crate::l1::{L1Boundary, StandInBoundary};

/// Connectivity report for the API process and its store.
#[derive(SimpleObject)]
pub struct Health {
    /// Version of the backend serving this schema.
    backend_version: String,
    /// True when PostgreSQL answers a round-trip probe.
    postgres_connected: bool,
    /// The last L1 epoch fully ingested into the record mirror; -1 until
    /// the first epoch lands, null when the cursor could not be read.
    mirror_epoch: Option<i64>,
}

/// The query root.
pub struct Query;

#[Object]
impl Query {
    /// Reports whether the API can reach its store, and how far the record
    /// mirror has ingested. Answers even when the store does not, so a
    /// dumb probe always gets a response: a failed cursor read comes back
    /// as a null `mirrorEpoch` rather than an error, and so stays
    /// distinguishable from the legitimate "-1, nothing ingested".
    async fn health(&self, ctx: &Context<'_>) -> async_graphql::Result<Health> {
        let pool = ctx.data::<PgPool>()?;
        let mirror_epoch = match postgres_store::mirror::last_ingested_epoch(pool).await {
            Ok(epoch) => Some(epoch),
            Err(e) => {
                tracing::error!(error = %e, "mirror epoch cursor read failed");
                None
            }
        };
        Ok(Health {
            backend_version: env!("CARGO_PKG_VERSION").to_string(),
            postgres_connected: match postgres_store::ping(pool).await {
                Ok(()) => true,
                Err(e) => {
                    tracing::warn!(error = %e, "postgres health probe failed");
                    false
                }
            },
            mirror_epoch,
        })
    }

    /// The host key the device verifies seals against before approving
    /// (base64) — realization transparency: every host-added field of a
    /// verified act is checkable on-device.
    async fn host_public_key(&self, ctx: &Context<'_>) -> async_graphql::Result<String> {
        let boundary = ctx.data::<StandInBoundary>()?;
        let key = boundary
            .host_public_key()
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        Ok(B64.encode(key))
    }

    /// Anonymous pre-submit check of an invite link, so the app can gate
    /// the registration form and key ceremony on a usable capability.
    /// Null when the id references no link.
    async fn invite_link_check(
        &self,
        ctx: &Context<'_>,
        id: Uuid,
    ) -> async_graphql::Result<Option<InviteLinkCheck>> {
        let pool = ctx.data::<PgPool>()?;
        let Some(link) = store::invite_link(pool, id).await? else {
            return Ok(None);
        };
        let inviter = store::actor_identity(pool, link.inviter_id)
            .await?
            .ok_or_else(|| async_graphql::Error::new("invite link without inviter"))?;
        Ok(Some(InviteLinkCheck {
            usable: store::invite_link_usable(pool, id).await?,
            inviter_handle: inviter.handle,
            expires_at: link.expires_at,
        }))
    }

    /// The viewer's own account, resolved from the request's auth token.
    /// Null when the request is unauthenticated.
    async fn me(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<User>> {
        let Some(viewer) = ctx.data::<Option<Viewer>>()?.as_ref().copied() else {
            return Ok(None);
        };
        let pool = ctx.data::<PgPool>()?;
        Ok(store::actor_identity(pool, viewer.user_id)
            .await?
            .map(|identity| User::from_viewer(identity, viewer)))
    }

    /// One user by id or unique handle — exactly one argument
    /// (api-spec.md "Queries"). Handles resolve case-insensitively
    /// (auth.md "Handle and email format"); null for no match.
    async fn user(
        &self,
        ctx: &Context<'_>,
        id: Option<Uuid>,
        handle: Option<String>,
    ) -> async_graphql::Result<Option<User>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(lookup_actor(pool, id, handle)
            .await?
            .filter(|identity| identity.kind == "user")
            .map(|identity| User {
                identity,
                viewer_session: None,
            }))
    }

    /// Any actor by id or unique handle — one namespace across kinds, so
    /// a handle resolves to exactly one actor; exactly one argument.
    /// Kinds resolve as their types arrive with the slices — users
    /// today; null for no match.
    async fn actor(
        &self,
        ctx: &Context<'_>,
        id: Option<Uuid>,
        handle: Option<String>,
    ) -> async_graphql::Result<Option<Actor>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(lookup_actor(pool, id, handle)
            .await?
            .filter(|identity| identity.kind == "user")
            .map(|identity| {
                Actor::User(User {
                    identity,
                    viewer_session: None,
                })
            }))
    }

    /// One staged write mid-handshake. Field-level: resolves only for
    /// the staging actor's session; null otherwise.
    async fn staged_write(
        &self,
        ctx: &Context<'_>,
        id: Uuid,
    ) -> async_graphql::Result<Option<StagedWriteType>> {
        let Some(viewer) = ctx.data::<Option<Viewer>>()?.as_ref().copied() else {
            return Ok(None);
        };
        let pool = ctx.data::<PgPool>()?;
        match staged::load(pool, id).await {
            Ok(w) if w.actor_id == viewer.user_id => Ok(Some(StagedWriteType(w))),
            Ok(_) | Err(staged::StagedError::NotFound(_)) => Ok(None),
            Err(e) => Err(async_graphql::Error::new(e.to_string())),
        }
    }

    /// One post by id; null for an unknown id.
    async fn post(&self, ctx: &Context<'_>, id: Uuid) -> async_graphql::Result<Option<PostType>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(content_store::post(pool, id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
            .map(PostType))
    }

    /// One comment by id; null for an unknown id.
    async fn comment(
        &self,
        ctx: &Context<'_>,
        id: Uuid,
    ) -> async_graphql::Result<Option<CommentType>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(content_store::comment(pool, id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
            .map(CommentType))
    }

    /// One topic by name — canonicalized here (lowercase, `#` stripped)
    /// before anything is looked at.
    ///
    /// Every well-formed name already denotes a Type, whether or not any
    /// record has referenced it: Types are anchored vacuously and their
    /// ids are a pure function of the name. So this resolves without a
    /// registry row and without writing one — a client can navigate to
    /// an empty topic page and follow it from there. Null only for a
    /// name the substrate could never carry.
    async fn hashtag(&self, name: String) -> async_graphql::Result<Option<HashtagType>> {
        Ok(common::hashtag::canonicalize(&name)
            .ok()
            .map(|name| HashtagType { name }))
    }

    /// Any node by its L2 id, typed. Coverage grows with the slices —
    /// content nodes resolve here today; null for an unknown id.
    async fn node(&self, ctx: &Context<'_>, id: Uuid) -> async_graphql::Result<Option<Node>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(crate::nodes::resolve_content(pool, id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
            .map(typed_node))
    }

    /// Batch node lookup — order preserved; an unknown id yields null
    /// in its slot.
    #[graphql(complexity = "ids.len() * child_complexity + 1")]
    async fn nodes(
        &self,
        ctx: &Context<'_>,
        ids: Vec<Uuid>,
    ) -> async_graphql::Result<Vec<Option<Node>>> {
        if ids.len() > super::types::MAX_PAGE_SIZE as usize {
            return Err(async_graphql::Error::new(format!(
                "at most {} ids per lookup",
                super::types::MAX_PAGE_SIZE
            )));
        }
        let pool = ctx.data::<PgPool>()?;
        let resolved = crate::nodes::resolve_content_many(pool, &ids)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        Ok(ids
            .iter()
            .map(|id| resolved.get(id).cloned().map(typed_node))
            .collect())
    }

    /// One L1 record by its own identifier — the unit of the chronicle.
    async fn record(
        &self,
        ctx: &Context<'_>,
        id: RecordId,
    ) -> async_graphql::Result<Option<Record>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(mirror::record_full(pool, &id.0)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
            .map(Record))
    }

    /// Generic record lookup over the mirror — the public chronicle,
    /// filterable along the mirror's own indexes, newest-first in
    /// landing order. `target` matches a record's target (the middle
    /// node on hyper families); `terminal` matches the terminal leg —
    /// a comment's revision chain is `records(terminal: <comment>)`.
    /// The UUID filters translate to the mirror's own identifiers, so an
    /// id that resolves to no known node yields an empty page rather than
    /// an error — the same contract a null slot in `nodes` carries.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    #[expect(
        clippy::too_many_arguments,
        reason = "each argument is a GraphQL field argument the schema declares; grouping them into a struct would change the published contract"
    )]
    async fn records(
        &self,
        ctx: &Context<'_>,
        author: Option<Uuid>,
        target: Option<Uuid>,
        terminal: Option<Uuid>,
        family: Option<RecordFamily>,
        payload_marked: Option<bool>,
        since_epoch: Option<i64>,
        until_epoch: Option<i64>,
        after: Option<String>,
        before: Option<String>,
        first: Option<i32>,
        last: Option<i32>,
    ) -> async_graphql::Result<KeysetConnection<Record>> {
        let pool = ctx.data::<PgPool>()?;
        let page = keyset_page(first, after, last, before)?;
        let mut filter = mirror::RecordFilter {
            family: family.map(|f| f.as_family().as_str().to_string()),
            payload_marked,
            since_epoch,
            until_epoch,
            ..Default::default()
        };
        if let Some(author) = author {
            match crate::nodes::address_of(pool, author).await? {
                Some(address) => filter.author = Some(address),
                None => {
                    return Ok(keyset_connection(Vec::new(), &page, record_cursor, Record));
                }
            }
        }
        if let Some(target) = target {
            match uuid_to_node_string(pool, target).await? {
                Some(node) => filter.target = Some(node),
                None => {
                    return Ok(keyset_connection(Vec::new(), &page, record_cursor, Record));
                }
            }
        }
        if let Some(terminal) = terminal {
            match uuid_to_node_string(pool, terminal).await? {
                Some(node) => filter.terminal = Some(node),
                None => {
                    return Ok(keyset_connection(Vec::new(), &page, record_cursor, Record));
                }
            }
        }
        let rows = mirror::records(
            pool,
            &filter,
            page.cursor.map(|c| c.order()),
            page.backward,
            page.limit + 1,
        )
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        Ok(keyset_connection(rows, &page, record_cursor, Record))
    }

    /// Candidate targets for the reference picker.
    ///
    /// **Exact-match resolution only.** Real search — prefix matching,
    /// ranking, snippets — arrives with slice 2.7 *behind this same
    /// field*, so a client binds to it once and does not change when the
    /// implementation is replaced. Two shapes resolve today: a handle,
    /// bare or `@`-sigilled, names a person; a UUID names whatever node
    /// it addresses.
    ///
    /// An empty or unresolvable query yields an empty list, never an
    /// error. A finder runs on every keystroke, so most of what it is
    /// asked is a prefix of something the user is still typing — failing
    /// those would make error noise the normal case.
    ///
    /// A candidate is offerable only if `prepareReference` would accept
    /// it: resolution runs through the write path's own resolver, so the
    /// picker cannot hand back a target the mutation then refuses. Two
    /// classes narrow for exactly that reason. A topic is never offered
    /// — it is tagged, not referenced — which is why a `#`-typed
    /// query finds nothing and a UUID naming a Type yields no candidate.
    /// And a keyless account fronts no Profile on the graph, so it
    /// resolves nowhere for the write path and must not be offered here
    /// either.
    #[graphql(complexity = "list_cost(limit, child_complexity)")]
    async fn reference_candidates(
        &self,
        ctx: &Context<'_>,
        query: String,
        limit: Option<i32>,
    ) -> async_graphql::Result<Vec<ReferenceCandidate>> {
        let pool = ctx.data::<PgPool>()?;
        let limit = list_limit(limit)? as usize;
        let query = query.trim();
        if query.is_empty() || limit == 0 {
            return Ok(Vec::new());
        }

        let mut out = Vec::new();
        if query.starts_with('#') {
            return Ok(Vec::new());
        }
        if let Ok(id) = Uuid::parse_str(query) {
            if let Some(node) = crate::nodes::resolve_id(pool, id)
                .await
                .map_err(|e| async_graphql::Error::new(e.to_string()))?
                && let Some(target) = resolve_reference_target(ctx, &node.to_string()).await?
            {
                out.push(ReferenceCandidate {
                    target,
                    target_id: id,
                });
            }
        } else if let Ok(folded) = crate::auth::normalize_handle(query.trim_start_matches('@'))
            && let Some(identity) = store::actor_identity_by_handle(pool, &folded).await?
            && identity.kind == "user"
            && identity.l0_address.is_some()
        {
            out.push(ReferenceCandidate {
                target_id: identity.id,
                target: ReferenceTarget::Profile(User {
                    identity,
                    viewer_session: None,
                }),
            });
        }
        out.truncate(limit);
        Ok(out)
    }

    /// The chronological listing (roadmap "Slice 2"): every post,
    /// newest-first — pending entries, then landed entries in landing
    /// order, the record set's own order, never wall clock
    /// (graph-model.md §2). `includePending: false` serves only what has
    /// landed on L1. Deliberately not the ranked feed.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    async fn posts(
        &self,
        ctx: &Context<'_>,
        after: Option<String>,
        before: Option<String>,
        first: Option<i32>,
        last: Option<i32>,
        #[graphql(default = true)] include_pending: bool,
    ) -> async_graphql::Result<KeysetConnection<PostType>> {
        let pool = ctx.data::<PgPool>()?;
        let page = keyset_page(first, after, last, before)?;
        let rows = content_store::list_posts(
            pool,
            content_cursor(page.cursor),
            page.backward,
            page.limit + 1,
            include_pending,
        )
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        Ok(keyset_connection(
            rows,
            &page,
            |p| content_cursor_key(p.sort_key(), p.id),
            PostType,
        ))
    }
}

/// A chronicle entry's cursor. The record set carries no pending
/// namespace — a record is in the chronicle exactly when it is ordered
/// fact — so the landing-order key alone identifies the position.
fn record_cursor(r: &mirror::RecordFull) -> CursorKey {
    CursorKey {
        epoch: r.epoch,
        act_time: r.act_time,
        position: r.position,
        id: None,
    }
}

/// The shared id-or-handle resolution behind `user` and `actor`:
/// exactly one argument required; a handle folds before lookup
/// (auth.md), and one that could never register resolves to no actor
/// rather than erroring.
async fn lookup_actor(
    pool: &PgPool,
    id: Option<Uuid>,
    handle: Option<String>,
) -> async_graphql::Result<Option<store::ActorIdentity>> {
    match (id, handle) {
        (Some(id), None) => Ok(store::actor_identity(pool, id).await?),
        (None, Some(handle)) => match crate::auth::normalize_handle(&handle) {
            Ok(folded) => Ok(store::actor_identity_by_handle(pool, &folded).await?),
            Err(_) => Ok(None),
        },
        _ => Err(async_graphql::Error::new(
            "provide exactly one of id or handle",
        )),
    }
}

/// A resolved content row as the `Node` union serves it.
fn typed_node(content: crate::nodes::ContentNode) -> Node {
    match content {
        crate::nodes::ContentNode::Post(post) => Node::Post(PostType(post)),
        crate::nodes::ContentNode::Comment(comment) => Node::Comment(CommentType(comment)),
    }
}

/// A UUID as a mirror identifier, through the crate's one resolver
/// (`nodes::resolve_id`) so that a chronicle filter and a gesture cannot
/// disagree about what an id names.
///
/// A pending content node resolves here like any other, through its
/// display row, so `records(target:)` on it is well-formed and empty
/// rather than naming nothing: the chronicle contains only ordered fact
/// (api-spec.md "The graph is a chronicle"). A UUID naming no node at
/// all resolves to `None`, hence to an empty page.
async fn uuid_to_node_string(pool: &PgPool, id: Uuid) -> async_graphql::Result<Option<String>> {
    Ok(crate::nodes::resolve_id(pool, id)
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?
        .map(|node| node.to_string()))
}
