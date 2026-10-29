//! ´mod:module:query´
//!
//! The query root: the health probe, the viewer (`me`), the staged-write
//! observation read, and — from slice 2 — the content reads: typed
//! nodes, the chronological listing, and the generic record chronicle.
//! Reads need no authentication — the shared graph is public; the
//! private fields are field-level authorized on their types.

use std::collections::HashMap;

use async_graphql::connection::Edge;
use async_graphql::{Context, Object, SimpleObject};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use postgres_store::search as search_store;
use postgres_store::{PgPool, auth as store, content as content_store, genesis, mirror, staged};
use uuid::Uuid;

use super::ranked_search::{self, ReadOrder};
use super::types::{
    Actor, AskLinkCheck, CommentType, DEFAULT_PAGE_SIZE, EmailChangeLinkCheck,
    EmailChangeLinkState, HashtagType, InviteLinkCheck, KeysetConnection, MediaAttachmentType,
    Node, NodeKind, PostType, Record, RecordConnection, RecordFamily, RecordId, ReferenceCandidate,
    ReferenceTarget, SearchConnection, SearchConnectionFields, SearchEdgeFields, SearchResult,
    StagedWriteType, User, borrowed_vantage, connection_cost, content_cursor, content_cursor_key,
    keyset_connection, keyset_page, list_cost, list_limit, record_connection,
    resolve_reference_target, validate_page_args, viewer_address,
};
use crate::auth::Viewer;
use crate::l1::{L1Boundary, StandInBoundary};
use crate::search::{self, IndexKind, ScopedKind};

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

    /// Anonymous pre-stage check of an ask link, so a member following
    /// one sees who is asking before anything is written, and the app can
    /// gate the staging call. Null when the id references no link. It
    /// reads and never writes; with a viewer, `usable` and `reason` answer
    /// for that viewer's own queue (WAITING_ON_VIEWER).
    async fn ask_link_check(
        &self,
        ctx: &Context<'_>,
        id: Uuid,
    ) -> async_graphql::Result<Option<AskLinkCheck>> {
        let pool = ctx.data::<PgPool>()?;
        let viewer = match ctx.data_opt::<Option<Viewer>>() {
            Some(Some(v)) => Some(v.user_id),
            _ => None,
        };
        Ok(store::ask_link_state(pool, id, viewer)
            .await?
            .map(AskLinkCheck::from_store))
    }

    /// Anonymous pre-sign-in check of an email change's new-address
    /// link, so a device with no session can say what the link is for
    /// before anything applies. It reads and never writes: no side is
    /// confirmed, consumed or reset. Null when the token references no
    /// change — unknown, malformed, an original-address code, a
    /// verification-link token, or a change row a retention sweep has
    /// dropped all answer null alike. Holding the 256-bit token is the
    /// proof: it was mailed to `newEmail`, so its holder learns nothing
    /// about an address they do not already read. For the same reason
    /// the answer carries nothing about the account the change belongs
    /// to — no handle, no current address, no id.
    async fn email_change_link_check(
        &self,
        ctx: &Context<'_>,
        token: String,
    ) -> async_graphql::Result<Option<EmailChangeLinkCheck>> {
        let pool = ctx.data::<PgPool>()?;
        let unverified_carve_out = |change: &store::EmailChange| !change.requires_code;
        Ok(
            store::email_change_by_token(pool, &crate::auth::hash_of(&token))
                .await?
                .filter(|change| !unverified_carve_out(change))
                .map(|change| EmailChangeLinkCheck {
                    state: EmailChangeLinkState::of(change.end()),
                    new_email: change.new_email,
                }),
        )
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

    /// The actor whose view this reader is browsing from
    /// (`design/readme.md` §13). A feed is rooted in the viewer's own
    /// outgoing stances, and a reader who has none is served someone
    /// else's view — named, always, by the borrowed-view band, which
    /// reads this field to know whose name to say.
    ///
    /// **The most specific available vantage wins**, and the answer
    /// always carries whose view it is. In preference order:
    ///
    /// 1. An **invite-link arrival**, still signed out, borrows **the
    ///    inviter's** view, resolved from the link id. That resolution
    ///    arrives with slice 3 and its own band-line ruling.
    /// 2. An **applicant** borrows **the view of the issuer of the invite
    ///    link they registered through** — whoever's vouch lands them —
    ///    from the moment
    ///    the account exists and before either proof is in, whatever they
    ///    stage — and a **landed member** keeps borrowing it until they
    ///    hold a live Opinion, signed toward any target, landed or in
    ///    flight: one whose netted bundle toward its target has neither
    ///    parameter at zero. An inert Opinion (either parameter zero) and
    ///    an Affinity never end it; a live Opinion that expires with none
    ///    landed returns it; an Opinion carried from the application
    ///    signs with the vouch-in batch, so a member who carried a live
    ///    one owns their view from landing on.
    /// 3. A **bare visitor**, with nothing more specific to go on,
    ///    borrows the **Genesis Moderator's** view. Strictly the
    ///    fallback: it is the only vantage that names no relationship
    ///    the reader arrived through.
    ///
    /// **The handle is load-bearing, not decoration.** The band speaks
    /// the name, because a borrowed rank the reader cannot attribute is
    /// exactly the unlabelled feed §9 refuses — so this resolves to an
    /// `Actor`, never to a bare "yes, borrowed".
    ///
    /// Null is the end of the ladder: the reader's view is their own.
    /// It is the rule the band reads as "disappear", not missing data.
    async fn borrowed_view(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Actor>> {
        let pool = ctx.data::<PgPool>()?;
        let vantage = match ctx.data::<Option<Viewer>>()?.as_ref().copied() {
            None => genesis::genesis_moderator(pool).await?,
            Some(viewer) => match store::actor_identity(pool, viewer.user_id).await? {
                Some(account) => borrowed_vantage(ctx, &account).await?,
                None => None,
            },
        };
        Ok(vantage.map(|identity| {
            Actor::User(User {
                identity,
                viewer_session: None,
            })
        }))
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
            Ok(_) | Err(staged::StagedError::NotFound(_) | staged::StagedError::Reaped(_)) => {
                Ok(None)
            }
            Err(e) => Err(async_graphql::Error::new(e.to_string())),
        }
    }

    /// One of the viewer's own uploads — how a client learns that an
    /// asset it uploaded as PROCESSING has become READY (or FAILED).
    /// Polled the way `stagedWrite` is. An upload whose re-encode came
    /// out as bytes the viewer already holds answers as that asset,
    /// READY, under the id it was asked by and with its own
    /// `uploadDigest`; attaching either id attaches the asset, and the
    /// manifest witnesses the upload digest of the id attached. Null for
    /// an unknown id, for somebody else's asset, and without a session:
    /// an upload is nobody else's business until a parent carries it.
    async fn media_attachment(
        &self,
        ctx: &Context<'_>,
        id: Uuid,
    ) -> async_graphql::Result<Option<MediaAttachmentType>> {
        let Some(viewer) = ctx.data::<Option<Viewer>>()?.as_ref().copied() else {
            return Ok(None);
        };
        let pool = ctx.data::<PgPool>()?;
        Ok(postgres_store::media::by_id(pool, id)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
            .filter(|asset| asset.author_id == viewer.user_id)
            .map(MediaAttachmentType::asset))
    }

    /// The viewer's earliest published post whose gallery carries any of
    /// the named uploads — the composer's already-published marker. A
    /// named id resolves through a merge to the asset it became, and the
    /// asset matches by its id or its rendition digest; only the viewer's
    /// own ids name anything, and only the viewer's own posts answer.
    /// Published is landed, carried is the post's current version, and
    /// earliest is the published order. Null when nothing matches, for an
    /// empty list, and without a session. More ids than a post's gallery
    /// holds is BAD_INPUT.
    async fn own_published_placement(
        &self,
        ctx: &Context<'_>,
        media_ids: Vec<Uuid>,
    ) -> async_graphql::Result<Option<PostType>> {
        if media_ids.len() > crate::media::MAX_POST_ATTACHMENTS {
            return Err(bad_input(format!(
                "at most {} media ids per lookup",
                crate::media::MAX_POST_ATTACHMENTS
            )));
        }
        let Some(viewer) = ctx.data::<Option<Viewer>>()?.as_ref().copied() else {
            return Ok(None);
        };
        if media_ids.is_empty() {
            return Ok(None);
        }
        let pool = ctx.data::<PgPool>()?;
        let Some(post) =
            postgres_store::media::first_own_placement(pool, viewer.user_id, &media_ids)
                .await
                .map_err(|e| async_graphql::Error::new(e.to_string()))?
        else {
            return Ok(None);
        };
        Ok(content_store::post(pool, post)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?
            .map(PostType))
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

    /// Any node by its L2 id, typed — a post, a comment or a user, the
    /// types that implement `Node`; null for an unknown id.
    async fn node(&self, ctx: &Context<'_>, id: Uuid) -> async_graphql::Result<Option<Node>> {
        let pool = ctx.data::<PgPool>()?;
        Ok(resolve_nodes(pool, &[id])
            .await?
            .remove(&id)
            .map(Resolved::into_node))
    }

    /// Batch form of `node` — nodes of any type at once, order
    /// preserved; an unknown id yields null in its slot.
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
        let resolved = resolve_nodes(pool, &ids).await?;
        Ok(ids
            .iter()
            .map(|id| resolved.get(id).cloned().map(Resolved::into_node))
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
    /// `genesis: true` keeps only the records that anchor their node (a
    /// post's own Publish, never its edits; a person's first
    /// Registration), `false` only the rest — `Record.act`'s GENESIS.
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
        genesis: Option<bool>,
        since_epoch: Option<i64>,
        until_epoch: Option<i64>,
        after: Option<String>,
        before: Option<String>,
        first: Option<i32>,
        last: Option<i32>,
    ) -> async_graphql::Result<RecordConnection> {
        let pool = ctx.data::<PgPool>()?;
        let page = keyset_page(first, after, last, before)?;
        let mut filter = mirror::RecordFilter {
            family: family.map(|f| f.as_family().as_str().to_string()),
            payload_marked,
            genesis,
            since_epoch,
            until_epoch,
            ..Default::default()
        };
        if let Some(author) = author {
            match crate::nodes::address_of(pool, author).await? {
                Some(address) => filter.author = Some(address),
                None => {
                    return Ok(record_connection(Vec::new(), &page, None));
                }
            }
        }
        if let Some(target) = target {
            match uuid_to_node_string(pool, target).await? {
                Some(node) => filter.target = Some(node),
                None => {
                    return Ok(record_connection(Vec::new(), &page, None));
                }
            }
        }
        if let Some(terminal) = terminal {
            match uuid_to_node_string(pool, terminal).await? {
                Some(node) => filter.terminal = Some(node),
                None => {
                    return Ok(record_connection(Vec::new(), &page, None));
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
        Ok(record_connection(rows, &page, Some(filter)))
    }

    /// Candidate targets for the reference picker.
    ///
    /// Candidates come from the one search matcher (see Search) — names
    /// and titles, exact tier first, then newest — narrowed to what
    /// `prepareReference` accepts: never a topic, never a keyless
    /// account. A UUID still names whatever node it addresses, and a
    /// leading `@` narrows to people.
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
    ///
    /// `kinds` narrows the candidates by the search law — kinds subtract.
    /// Null or empty narrows nothing; otherwise only candidates of a
    /// listed kind are offered, and a kind the finder never offers — a
    /// topic, or a comment by its words, which it carries none of —
    /// reads empty, never an error.
    #[graphql(complexity = "list_cost(limit, child_complexity)")]
    async fn reference_candidates(
        &self,
        ctx: &Context<'_>,
        query: String,
        kinds: Option<Vec<NodeKind>>,
        limit: Option<i32>,
    ) -> async_graphql::Result<Vec<ReferenceCandidate>> {
        let pool = ctx.data::<PgPool>()?;
        let limit = list_limit(limit)?;
        let query = query.trim();
        if query.is_empty() || limit == 0 || query.starts_with('#') {
            return Ok(Vec::new());
        }
        let wanted = |kind: NodeKind| {
            kinds
                .as_deref()
                .is_none_or(|kinds| kinds.is_empty() || kinds.contains(&kind))
        };

        if let Ok(id) = Uuid::parse_str(query) {
            let mut out = Vec::new();
            if let Some(node) = crate::nodes::resolve_id(pool, id)
                .await
                .map_err(|e| async_graphql::Error::new(e.to_string()))?
                && let Some(target) = resolve_reference_target(ctx, &node.to_string()).await?
                && wanted(target.kind())
            {
                out.push(ReferenceCandidate {
                    target,
                    target_id: id,
                });
            }
            return Ok(out);
        }

        let (text, offered): (&str, &[IndexKind]) = match query.strip_prefix('@') {
            Some(handle) => (handle, &[IndexKind::User]),
            None => (query, &[IndexKind::User, IndexKind::Post]),
        };
        let kinds: Vec<IndexKind> = offered
            .iter()
            .copied()
            .filter(|kind| {
                wanted(match kind {
                    IndexKind::User => NodeKind::User,
                    IndexKind::Post => NodeKind::Post,
                    IndexKind::Hashtag => NodeKind::Hashtag,
                })
            })
            .collect();
        if kinds.is_empty() {
            return Ok(Vec::new());
        }
        let Ok(search::Parsed::Unscoped(text)) = search::parse(text) else {
            return Ok(Vec::new());
        };
        let request = search::unscoped(text, &kinds, None, true);
        let hits = search_store::find(pool, &request, None, false, i64::from(limit))
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        Ok(hydrate(pool, hits)
            .await?
            .into_iter()
            .filter_map(|(_, result)| match result {
                SearchResult::Post(post) => Some(ReferenceCandidate {
                    target_id: post.0.id,
                    target: ReferenceTarget::Post(post),
                }),
                SearchResult::User(user) => Some(ReferenceCandidate {
                    target_id: user.identity.id,
                    target: ReferenceTarget::Profile(user),
                }),
                SearchResult::Comment(_) | SearchResult::Hashtag(_) => None,
            })
            .collect())
    }

    /// Global search across nodes; returns a `SearchResult` per edge.
    /// Recall is lexical: plain text matches topic names by substring,
    /// post titles, handles and display names by word (the last word a
    /// prefix), and brings the posts of every person whose display name
    /// matches; `@prefix` names people by handle prefix and `#prefix`
    /// topics by name prefix — bare, the matches lead and everything they
    /// reach follows; with text, the text searches what they reach. The
    /// result is sectioned — people, then topics, then content — and
    /// inside a section an exact match leads, then newest first,
    /// viewer-independent — unless `order: RANKED`, where the server's
    /// ranker container orders each section's matches inside `viewer`'s
    /// slice, exact matches first, and the section's rest follow behind
    /// the seam, newest first; ranking never runs in the backend process
    /// (feed-ranking.md §11). `order: RANKED` needs `viewer`. While the
    /// served kinds stand people beside another kind, the people section
    /// serves its first three in that order, and `hasMorePeople` says
    /// whether more match; `kinds: [USER]` serves them all. Served
    /// kinds grow with the slices: USER, POST, HASHTAG for plain text;
    /// COMMENT is always a valid kind but is served only under a cue —
    /// for plain text it contributes no rows, never an error. A `kinds`
    /// filter drops sections and keeps the rest's semantics. COLLECTIVE,
    /// CHAT, CHAT_MESSAGE, ITEM and OFFER join with their slices and read
    /// empty until then. An empty `kinds` list means the same as null (no
    /// narrowing). `includeSeen: false` drops nodes on the reader's
    /// seen-list (`User.viewHistory`); it needs a session and is ignored
    /// without one. Full semantics in the Search section.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    #[expect(
        clippy::too_many_arguments,
        reason = "each argument is a GraphQL field argument the schema declares; grouping them into a struct would change the published contract"
    )]
    async fn search(
        &self,
        ctx: &Context<'_>,
        query: String,
        kinds: Option<Vec<NodeKind>>,
        #[graphql(default_with = "Some(true)")] include_seen: Option<bool>,
        #[graphql(default_with = "Some(ReadOrder::Newest)")] order: Option<ReadOrder>,
        viewer: Option<Uuid>,
        first: Option<i32>,
        after: Option<String>,
        last: Option<i32>,
        before: Option<String>,
    ) -> async_graphql::Result<SearchConnection> {
        let pool = ctx.data::<PgPool>()?;
        validate_page_args(first, last, after.as_deref(), before.as_deref())
            .map_err(|e| bad_input(e.message))?;
        let ranked_for = match (order.unwrap_or_default(), viewer) {
            (ReadOrder::Ranked, None) => {
                return Err(bad_input("order: RANKED ranks for a viewer; name one"));
            }
            (ReadOrder::Ranked, Some(viewer)) => Some(viewer),
            (ReadOrder::Newest, _) => None,
        };
        let backward = last.is_some() || before.is_some();
        let raw_cursor = if backward { &before } else { &after };
        let (cursor, ranked_cursor) = match (raw_cursor, ranked_for) {
            (None, _) => (None, None),
            (Some(raw), None) => (
                Some(search::decode_cursor(raw).ok_or_else(|| bad_input("invalid cursor"))?),
                None,
            ),
            (Some(raw), Some(_)) => (
                None,
                Some(
                    ranked_search::RankedCursor::decode(raw)
                        .ok_or_else(|| bad_input("invalid cursor"))?,
                ),
            ),
        };
        let had_cursor = raw_cursor.is_some();
        let limit = i64::from(last.or(first).unwrap_or(DEFAULT_PAGE_SIZE));

        let parsed = search::parse(&query).map_err(|_| {
            bad_input(format!(
                "query may be at most {} characters",
                search::MAX_QUERY_CHARS
            ))
        })?;
        let empty = || search_page(Vec::new(), had_cursor, backward, false, None, None);
        let reader = match ctx.data_opt::<Option<Viewer>>() {
            Some(Some(v)) => Some(v.user_id),
            _ => None,
        };
        let exclude_seen_by = reader.filter(|_| include_seen == Some(false));
        let Some(request) = search_request(ctx, parsed, kinds.as_deref(), exclude_seen_by).await?
        else {
            return Ok(empty());
        };
        if let Some(viewer) = ranked_for {
            return ranked_search::page(ctx, request, viewer, ranked_cursor, backward, limit).await;
        }
        let past_people = !backward
            && cursor
                .is_some_and(|c| search_store::section_of(c.tier) > search_store::SECTION_PEOPLE);
        let cap = if past_people {
            None
        } else {
            people_cap(pool, &request, None)
                .await
                .map_err(|e| async_graphql::Error::new(e.to_string()))?
        };
        let window = search_store::Window {
            people: cap.as_ref().map(|cap| cap.served.as_slice()),
            ..search_store::Window::default()
        };
        let mut hits = request
            .find_in(pool, window, cursor, backward, limit + 1)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
        let has_more = hits.len() as i64 > limit;
        if has_more {
            if backward {
                hits.remove(0);
            } else {
                hits.pop();
            }
        }
        let page = hydrate(pool, hits).await?;
        Ok(search_page(
            page,
            cursor.is_some(),
            backward,
            has_more,
            Some(request),
            cap.map(|cap| cap.more),
        ))
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

    /// The governed network parameters, from the operational carrier —
    /// all of them, or the named keys. The catalog is network.md's; the
    /// charter schedule on L1 is binding. Unknown keys are omitted; an
    /// empty `keys` list reads empty.
    async fn network_parameters(
        &self,
        ctx: &Context<'_>,
        keys: Option<Vec<String>>,
    ) -> async_graphql::Result<Vec<super::feed::NetworkParameter>> {
        super::feed::network_parameters(ctx.data::<PgPool>()?, keys).await
    }

    /// Any actor's weight-bounded relevant subgraph — the raw material a
    /// ranker orders into a feed: the viewer's own device, the server's
    /// ranker container, or a delegated miner. Parameterized by the
    /// `viewer` whose feed is ranked: computing any actor's view for any
    /// reader is the public-graph default. Pruned by `dustFloor` (χ) and
    /// `gamma` — defaults are the governed network parameters — not
    /// hop-bounded: membership is best-possible path product ∏(γ·w̃) ≥ χ,
    /// so both travel (miner-api.md "The slice path"). `asOfEpoch` pins
    /// the slice to an earlier epoch (null: the newest ingested); every
    /// page read at one `asOfEpoch` is the same slice. Null if the id
    /// resolves to no rankable actor. Serving the slice is the backend's
    /// whole part in ranking.
    async fn feed_slice(
        &self,
        ctx: &Context<'_>,
        viewer: Uuid,
        dust_floor: Option<f64>,
        gamma: Option<f64>,
        as_of_epoch: Option<i64>,
    ) -> async_graphql::Result<Option<super::feed::FeedSlice>> {
        super::feed::feed_slice(
            ctx.data::<PgPool>()?,
            viewer,
            dust_floor,
            gamma,
            as_of_epoch,
        )
        .await
    }

    /// The ranked feed of `viewer`'s view, computed by the server's
    /// standalone ranker container and relayed (miner-api.md). Ranking
    /// never runs in the backend process: the backend serves the slice,
    /// relays this request, and hydrates the result through `feed`. The
    /// result is a snapshot. The client keeps it as the frozen order
    /// (feed-ranking.md §9.5) and derives its views from it: order,
    /// people, seen and Still settling are applied on the device, never
    /// asked of the server. `asOfEpoch` reports the epoch its scored
    /// entries were ranked at, and a call pinned there reproduces them;
    /// the `asOfEpoch` argument pins the slice to an earlier epoch (null
    /// ranks as of the newest ingested epoch). Null if `viewer` resolves
    /// to no rankable actor.
    async fn feed_ranking(
        &self,
        ctx: &Context<'_>,
        viewer: Uuid,
        as_of_epoch: Option<i64>,
        filter: Option<super::feed::FeedRankFilter>,
    ) -> async_graphql::Result<Option<super::feed::FeedRanking>> {
        super::feed::feed_ranking(ctx, viewer, as_of_epoch, filter).await
    }

    /// The live trace of one thing in `viewer`'s view: its score and the
    /// paths behind it, computed now by the server's standalone ranker
    /// container and relayed (miner-api.md). Paths are never stored, so
    /// every call is a real fetch at the newest ingested epoch; the read
    /// takes no pin and reports none, and its figure may differ from a
    /// held feed's — the reader adopts what the trace finds, and a feed
    /// never re-orders for it. A target no live path reaches answers with
    /// a null score and no paths. Null if `viewer` resolves to no
    /// rankable actor.
    async fn feed_trace(
        &self,
        ctx: &Context<'_>,
        viewer: Uuid,
        target: Uuid,
    ) -> async_graphql::Result<Option<super::trace::FeedTrace>> {
        super::trace::feed_trace(ctx, viewer, target).await
    }

    /// Hydrate a window of a ranking snapshot: the nodes behind the given
    /// ids, in the given order. At most 100 ids per call (the page
    /// budget). An id that resolves to nothing hydratable (a pending write
    /// that expired) is skipped, never an error. The backend serves the
    /// order it is handed.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    async fn feed(
        &self,
        ctx: &Context<'_>,
        ordered_ids: Vec<Uuid>,
        first: Option<i32>,
        after: Option<String>,
        last: Option<i32>,
        before: Option<String>,
    ) -> async_graphql::Result<super::feed::FeedConnection> {
        super::feed::feed(
            ctx.data::<PgPool>()?,
            ordered_ids,
            first,
            after,
            last,
            before,
        )
        .await
    }

    /// Releases from the application registry, newest first; `component`
    /// narrows to one platform component. Answers "what's the current
    /// version?" and "where are version X's patch notes?". Readable
    /// anonymously; served in `released_at` order.
    #[graphql(complexity = "connection_cost(first, last, child_complexity)")]
    async fn app_versions(
        &self,
        ctx: &Context<'_>,
        component: Option<crate::registry::AppComponent>,
        first: Option<i32>,
        after: Option<String>,
        last: Option<i32>,
        before: Option<String>,
    ) -> async_graphql::Result<super::app_versions::AppVersionConnection> {
        super::app_versions::app_versions(
            ctx.data::<PgPool>()?,
            component,
            first,
            after,
            last,
            before,
        )
        .await
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

/// The transport-tier refusal for a malformed read argument
/// (api-spec.md "Errors are tiered"): `BAD_INPUT` in
/// `errors[].extensions.code`.
pub(super) fn bad_input(message: impl Into<String>) -> async_graphql::Error {
    use async_graphql::ErrorExtensions;
    async_graphql::Error::new(message).extend_with(|_, e| e.set("code", "BAD_INPUT"))
}

/// The match request a parsed query makes over `kinds` — the one path
/// `search`, `User.bookmarks(query:)` and `User.viewHistory(query:)`
/// share, so no surface grows a second matcher. None when the request can match nothing: a blank
/// query, a cue that names nothing, or kinds that leave nothing served.
pub(super) async fn search_request(
    ctx: &Context<'_>,
    parsed: search::Parsed<'_>,
    kinds: Option<&[NodeKind]>,
    exclude_seen_by: Option<Uuid>,
) -> async_graphql::Result<Option<search_store::SearchRequest>> {
    Ok(match parsed {
        search::Parsed::Blank => None,
        search::Parsed::Unscoped(text) => {
            let kinds = served_kinds(kinds);
            (!kinds.is_empty()).then(|| {
                search_store::SearchRequest::Match(search::unscoped(
                    text,
                    &kinds,
                    exclude_seen_by,
                    false,
                ))
            })
        }
        search::Parsed::Scoped {
            scope,
            name,
            remainder,
        } => {
            let kinds = scoped_kinds(kinds, scope, remainder.is_none());
            let Some(named) = search::cue(scope, name).filter(|_| !kinds.is_empty()) else {
                return Ok(None);
            };
            Some(search_store::SearchRequest::Scoped(search::scoped(
                named,
                remainder,
                &kinds,
                exclude_seen_by,
                viewer_address(ctx).await?,
            )))
        }
    })
}

/// The index kinds a `kinds` argument serves to plain text. Null or
/// empty narrows nothing; COMMENT is served only under a cue, and the
/// kinds whose slices have not shipped read empty.
fn served_kinds(kinds: Option<&[NodeKind]>) -> Vec<IndexKind> {
    match kinds {
        None | Some([]) => IndexKind::ALL.to_vec(),
        Some(kinds) => IndexKind::ALL
            .into_iter()
            .filter(|served| {
                kinds.iter().any(|kind| match served {
                    IndexKind::User => *kind == NodeKind::User,
                    IndexKind::Post => *kind == NodeKind::Post,
                    IndexKind::Hashtag => *kind == NodeKind::Hashtag,
                })
            })
            .collect(),
    }
}

/// The kinds a `kinds` argument serves under a cue: null or empty
/// narrows nothing, and the cue decides the rest — its matches lead only
/// when it is bare ([`search::Scope::kinds`]).
fn scoped_kinds(kinds: Option<&[NodeKind]>, scope: search::Scope, bare: bool) -> Vec<ScopedKind> {
    let served = scope.kinds(bare);
    match kinds {
        None | Some([]) => served.to_vec(),
        Some(kinds) => served
            .iter()
            .copied()
            .filter(|served| {
                kinds.iter().any(|kind| match served {
                    ScopedKind::User => *kind == NodeKind::User,
                    ScopedKind::Post => *kind == NodeKind::Post,
                    ScopedKind::Comment => *kind == NodeKind::Comment,
                    ScopedKind::Hashtag => *kind == NodeKind::Hashtag,
                })
            })
            .collect(),
    }
}

/// A capped people section: the people it serves, in order, and whether
/// more match behind its "See all profiles" door.
pub(super) struct PeopleCap {
    pub(super) served: Vec<Uuid>,
    pub(super) more: bool,
}

/// The capped people section of `request` in the matcher's own order —
/// with `list`, that reader's list's (newest save, or newest first
/// seeing): its first [`search::PEOPLE_SECTION_CAP`] people, and whether
/// more match. None when the cap does not apply: the request serves no
/// people, or nothing beside them.
pub(super) async fn people_cap(
    pool: &PgPool,
    request: &search_store::SearchRequest,
    list: Option<search_store::ReaderList>,
) -> Result<Option<PeopleCap>, sqlx::Error> {
    if !request.serves_people_beside_others() {
        return Ok(None);
    }
    let Some(people) = request.people_only() else {
        return Ok(None);
    };
    let window = search_store::Window {
        list,
        ..search_store::Window::default()
    };
    let hits = people
        .find_in(
            pool,
            window,
            None,
            false,
            search::PEOPLE_SECTION_CAP as i64 + 1,
        )
        .await?;
    Ok(Some(PeopleCap {
        more: hits.len() > search::PEOPLE_SECTION_CAP,
        served: hits
            .into_iter()
            .take(search::PEOPLE_SECTION_CAP)
            .map(|hit| hit.node_id)
            .collect(),
    }))
}

/// A capped topics section — History's alone: the topics it serves, in
/// order, and whether more match behind its "See all tags" door.
pub(super) struct TopicsCap {
    pub(super) served: Vec<Uuid>,
    pub(super) more: bool,
}

/// The capped topics section of `request` in the matcher's own order,
/// read from `list`'s (newest first seeing): its first
/// [`search::TOPICS_SECTION_CAP`] topics, and whether more match. None
/// when the cap does not apply: the request serves no topics, or nothing
/// beside them.
pub(super) async fn topics_cap(
    pool: &PgPool,
    request: &search_store::SearchRequest,
    list: Option<search_store::ReaderList>,
) -> Result<Option<TopicsCap>, sqlx::Error> {
    if !request.serves_topics_beside_others() {
        return Ok(None);
    }
    let Some(topics) = request.topics_only() else {
        return Ok(None);
    };
    let window = search_store::Window {
        list,
        ..search_store::Window::default()
    };
    let hits = topics
        .find_in(
            pool,
            window,
            None,
            false,
            search::TOPICS_SECTION_CAP as i64 + 1,
        )
        .await?;
    Ok(Some(TopicsCap {
        more: hits.len() > search::TOPICS_SECTION_CAP,
        served: hits
            .into_iter()
            .take(search::TOPICS_SECTION_CAP)
            .map(|hit| hit.node_id)
            .collect(),
    }))
}

/// How many nodes `request` serves across every page: every match, less
/// the people a capped people section leaves behind its door and, on
/// History, the topics a capped topics section does — the count under
/// exactly the predicate the pages ran.
pub(super) async fn served_count(
    pool: &PgPool,
    request: &search_store::SearchRequest,
    list: Option<search_store::ReaderList>,
) -> Result<i64, sqlx::Error> {
    let mut served = request.count(pool, list).await?;
    if let Some(people) = request
        .people_only()
        .filter(|_| request.serves_people_beside_others())
    {
        let matched = people.count(pool, list).await?;
        served -= (matched - search::PEOPLE_SECTION_CAP as i64).max(0);
    }
    if matches!(list, Some(search_store::ReaderList::History(_)))
        && let Some(topics) = request
            .topics_only()
            .filter(|_| request.serves_topics_beside_others())
    {
        let matched = topics.count(pool, list).await?;
        served -= (matched - search::TOPICS_SECTION_CAP as i64).max(0);
    }
    Ok(served)
}

/// The matched nodes, typed, in match order. A hit whose node vanished
/// between the match and the load is dropped rather than served empty.
pub(super) async fn hydrate(
    pool: &PgPool,
    hits: Vec<search_store::SearchHit>,
) -> async_graphql::Result<Vec<(search_store::SearchHit, SearchResult)>> {
    let ids_of = |kinds: &[&str]| -> Vec<Uuid> {
        hits.iter()
            .filter(|h| kinds.contains(&h.kind.as_str()))
            .map(|h| h.node_id)
            .collect()
    };
    let content = crate::nodes::resolve_content_many(
        pool,
        &ids_of(&[IndexKind::Post.as_store(), ScopedKind::Comment.as_store()]),
    )
    .await
    .map_err(|e| async_graphql::Error::new(e.to_string()))?;
    let mut users: HashMap<Uuid, store::ActorIdentity> =
        store::actor_identities_by_ids(pool, &ids_of(&[IndexKind::User.as_store()]))
            .await?
            .into_iter()
            .map(|identity| (identity.id, identity))
            .collect();
    Ok(hits
        .into_iter()
        .filter_map(|hit| {
            let result = match hit.kind.as_str() {
                "post" => match content.get(&hit.node_id) {
                    Some(crate::nodes::ContentNode::Post(post)) => {
                        SearchResult::Post(PostType(post.clone()))
                    }
                    _ => return None,
                },
                "comment" => match content.get(&hit.node_id) {
                    Some(crate::nodes::ContentNode::Comment(comment)) => {
                        SearchResult::Comment(CommentType(comment.clone()))
                    }
                    _ => return None,
                },
                "user" => SearchResult::User(User {
                    identity: users.remove(&hit.node_id)?,
                    viewer_session: None,
                }),
                "hashtag" => SearchResult::Hashtag(HashtagType {
                    name: hit.name.clone()?,
                }),
                _ => return None,
            };
            Some((hit, result))
        })
        .collect())
}

/// A search page from hydrated hits. `had_cursor` and `has_more` decide
/// the page flags the way every keyset connection does: walking forward,
/// a cursor means a previous page and the extra row a next one; walking
/// backward, the other way round. `more_people` is the people cap's
/// answer when the page already read it.
fn search_page(
    page: Vec<(search_store::SearchHit, SearchResult)>,
    had_cursor: bool,
    backward: bool,
    has_more: bool,
    request: Option<search_store::SearchRequest>,
    more_people: Option<bool>,
) -> SearchConnection {
    let (has_previous, has_next) = if backward {
        (has_more, had_cursor)
    } else {
        (had_cursor, has_more)
    };
    let mut connection = SearchConnection::with_additional_fields(
        has_previous,
        has_next,
        SearchConnectionFields {
            request,
            more_people,
        },
    );
    connection
        .edges
        .extend(page.into_iter().map(|(hit, result)| {
            Edge::with_additional_fields(
                search::encode_cursor(hit.cursor()),
                result,
                SearchEdgeFields { score: None },
            )
        }));
    connection
}

/// Every node among `ids`, typed, in two round trips whatever the batch
/// size: the content classes (`resolve_content_many`), then the user
/// accounts in one read. The id spaces do not overlap — an actor id is
/// never a content id — so each id lands in at most one class.
///
/// A user resolves exactly as `user(id:)` serves it (`kind == "user"`,
/// no viewer session), so a deleted account reads as its husk through
/// the `User` fields here too.
async fn resolve_nodes(
    pool: &PgPool,
    ids: &[Uuid],
) -> async_graphql::Result<HashMap<Uuid, Resolved>> {
    let mut nodes: HashMap<Uuid, Resolved> = crate::nodes::resolve_content_many(pool, ids)
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?
        .into_iter()
        .map(|(id, content)| (id, Resolved::Content(content)))
        .collect();
    for identity in store::actor_identities_by_ids(pool, ids).await? {
        if identity.kind == "user" {
            nodes.insert(identity.id, Resolved::User(identity));
        }
    }
    Ok(nodes)
}

/// A node the batch resolved, kept un-typed so a repeated id can be
/// served twice (the `Node` values themselves are not `Clone`).
#[derive(Clone)]
enum Resolved {
    Content(crate::nodes::ContentNode),
    User(store::ActorIdentity),
}

impl Resolved {
    fn into_node(self) -> Node {
        match self {
            Self::Content(content) => typed_node(content),
            Self::User(identity) => Node::Profile(User {
                identity,
                viewer_session: None,
            }),
        }
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
