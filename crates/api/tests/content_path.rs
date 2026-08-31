//! Slice 2 — content authoring and reads, end to end against the
//! stand-in (roadmap "Slice 2"): a Post's genesis Publish and a
//! Comment's genesis Review through the five-step write path, edit
//! chains, promotion into carriage and display rows, the chronicle
//! reads, and every refusal branch the prepare surface owns —
//! eligibility, serialization, and unknown targets.

use api::content::{
    self, CommentDraft, CommentEditDraft, ContentError, License, PostDraft, PostEditDraft,
};
use api::l1::{L1Boundary, StandInBoundary};
use common::envelope::CograContent;
use common::l1::client::ActorKey;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::staged::{self, PreSignedParts};
use postgres_store::{content as content_store, genesis, mirror};
use sqlx::PgPool;
use uuid::Uuid;

/// The cursor a resolver hands back for a listing entry: its sort key
/// and its own id.
fn cursor_of(p: &content_store::Post) -> content_store::ContentCursor {
    content_store::ContentCursor {
        order: p.sort_key(),
        id: Some(p.id),
    }
}

const GC: i64 = 8;

fn license() -> License {
    License {
        attribution: 1.0,
        provenance: 0.0,
    }
}

struct Rig {
    pool: PgPool,
    standin: StandIn,
    boundary: StandInBoundary,
}

impl Rig {
    async fn new(pool: PgPool) -> Self {
        let standin = StandIn::new(pool.clone(), StandInConfig::default());
        let boundary = StandInBoundary(standin.clone());
        Self {
            pool,
            standin,
            boundary,
        }
    }

    async fn funded_actor(&self, handle: &str) -> (Uuid, ActorKey) {
        let key = ActorKey::generate();
        let id = Uuid::new_v4();
        let mut conn = self.pool.acquire().await.expect("conn");
        genesis::insert_actor(
            &mut conn,
            id,
            "user",
            handle,
            &key.public_key_bytes(),
            &key.address(),
        )
        .await
        .expect("actor row");
        self.standin
            .credit_burn(&key.address(), 10_000_000)
            .await
            .expect("burn");
        (id, key)
    }

    async fn sign_and_relay(&self, id: Uuid, key: &ActorKey) {
        let write = staged::load(&self.pool, id).await.expect("loads");
        let pre = key.pre_sign(write.proposal);
        let parts = PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        };
        let sealed = api::relay::submit_pre_signed(&self.boundary, &self.pool, id, parts)
            .await
            .expect("seals");
        let host_key = self.boundary.host_public_key().await.expect("host key");
        let witness = key.approve(&pre, &sealed, &host_key).expect("approves");
        api::relay::submit_approval(&self.boundary, &self.pool, id, witness.approval_signature)
            .await
            .expect("relays");
    }

    async fn close_and_ingest(&self) {
        self.standin.close_epoch().await.expect("closes");
        let outcome = api::ingest::ingest_pending(&self.boundary, &self.pool, GC)
            .await
            .expect("ingests");
        assert!(
            outcome.promotion_failures.is_empty(),
            "confirm-side promotion failed: {:?}",
            outcome.promotion_failures
        );
    }

    /// Drives one prepared content write through signatures and confirm.
    async fn land(&self, prepared: &content::PreparedContent, key: &ActorKey) {
        self.sign_and_relay(prepared.writes[0].id, key).await;
        self.close_and_ingest().await;
    }

    async fn post(&self, actor: Uuid, key: &ActorKey, title: &str, body: &str) -> Uuid {
        let prepared = content::prepare_post(
            &self.pool,
            &self.boundary,
            GC,
            actor,
            PostDraft {
                title: Some(title.into()),
                description: None,
                content: Some(body.into()),
                license: license(),
                p_directed: None,
                tags: vec![],
                references: vec![],
                attachments: vec![],
                sensitive: Default::default(),
            },
        )
        .await
        .expect("prepares post");
        self.land(&prepared, key).await;
        prepared.node
    }
}

/// The self-mark is witnessed, not Postgres-side bookkeeping: it rides
/// the envelope the device signs, so a reader can check the veil against
/// the record and a mirror rebuild restores it with the body it belongs
/// to. The display row is the projection of that payload.
#[sqlx::test(migrations = "../../migrations")]
async fn a_self_mark_rides_the_signed_payload_into_the_display_row(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("alice").await;

    let prepared = content::prepare_post(
        &rig.pool,
        &rig.boundary,
        GC,
        actor,
        PostDraft {
            title: Some("A hard thing".into()),
            description: None,
            content: Some("The body".into()),
            license: license(),
            p_directed: None,
            tags: vec![],
            references: vec![],
            attachments: vec![],
            sensitive: content::SelfMarkDraft {
                sensitive: true,
                reason: Some("  Depicts an injury  ".into()),
            },
        },
    )
    .await
    .expect("prepares");

    let decoded =
        CograContent::decode_payload(&prepared.writes[0].proposal.payload).expect("decodes");
    let mark = decoded.sensitive.as_ref().expect("the payload carries it");
    assert_eq!(mark.reason.as_deref(), Some("  Depicts an injury  "));

    rig.land(&prepared, &key).await;

    let post = content_store::post(&rig.pool, prepared.node)
        .await
        .expect("reads")
        .expect("post row");
    assert!(post.sensitive);
    assert_eq!(
        post.sensitive_reason.as_deref(),
        Some("  Depicts an injury  ")
    );

    let edit = content::prepare_post_edit(
        &rig.pool,
        &rig.boundary,
        GC,
        actor,
        content::PostEditDraft {
            id: prepared.node,
            title: Some("A hard thing".into()),
            description: None,
            content: Some("Softened".into()),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("prepares edit");
    assert!(
        CograContent::decode_payload(&edit.writes[0].proposal.payload)
            .expect("decodes")
            .sensitive
            .is_none(),
        "an edit carries the complete content state, so an unmarked edit omits the keys"
    );
    rig.land(&edit, &key).await;

    let post = content_store::post(&rig.pool, prepared.node)
        .await
        .expect("reads")
        .expect("post row");
    assert!(!post.sensitive);
    assert!(post.sensitive_reason.is_none());
}

/// A blank reason is no reason, and a reason without the switch is a
/// refusal rather than a silent drop — the author would otherwise sign a
/// warning nobody is ever shown.
#[sqlx::test(migrations = "../../migrations")]
async fn a_self_mark_reconciles_its_switch_and_its_reason(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, _key) = rig.funded_actor("alice").await;

    let draft = |sensitive: bool, reason: Option<&str>| PostDraft {
        title: None,
        description: None,
        content: Some("The body".into()),
        license: license(),
        p_directed: None,
        tags: vec![],
        references: vec![],
        attachments: vec![],
        sensitive: content::SelfMarkDraft {
            sensitive,
            reason: reason.map(Into::into),
        },
    };

    let blank = content::prepare_post(&rig.pool, &rig.boundary, GC, actor, draft(true, Some("  ")))
        .await
        .expect("prepares");
    assert_eq!(
        CograContent::decode_payload(&blank.writes[0].proposal.payload)
            .expect("decodes")
            .sensitive
            .expect("marked")
            .reason,
        None,
        "a blank reason is no reason"
    );

    let refused = content::prepare_post(
        &rig.pool,
        &rig.boundary,
        GC,
        actor,
        draft(false, Some("why")),
    )
    .await;
    assert!(
        matches!(
            refused,
            Err(content::ContentError::BadInput {
                field: "sensitiveReason",
                ..
            })
        ),
        "a reason without the mark is refused"
    );
}

/// The gesture is a genesis Publish — target the mint of its own act,
/// `p_i` census-fixed at 1, the license structural — and its envelope
/// decodes back to the draft, node id included. Landing leaves the
/// display row visible with its node binding and landing order, carriage
/// holding the exact envelope bytes, and the chronicle serving it in both
/// the newest-first listing and the record read.
#[sqlx::test(migrations = "../../migrations")]
async fn a_post_lands_with_carriage_display_row_and_envelope_binding(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("alice").await;

    let prepared = content::prepare_post(
        &rig.pool,
        &rig.boundary,
        GC,
        actor,
        PostDraft {
            title: Some("First".into()),
            description: Some("hello".into()),
            content: Some("The body".into()),
            license: license(),
            p_directed: Some(0.4),
            tags: vec![],
            references: vec![],
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("prepares");

    let body = &prepared.writes[0].proposal.body;
    assert_eq!(body.family, common::l1::Family::Publish);
    assert_eq!(body.p_i, 1.0);
    assert_eq!(body.license.as_deref(), Some("a=1;o=0"));
    let own_mint = format!("mint:{}", body.act_id());
    assert_eq!(body.target.to_string(), own_mint);

    let decoded =
        CograContent::decode_payload(&prepared.writes[0].proposal.payload).expect("decodes");
    assert_eq!(decoded.node, prepared.node);
    assert_eq!(decoded.title.as_deref(), Some("First"));
    assert_eq!(decoded.body.as_deref(), Some("The body"));

    rig.land(&prepared, &key).await;

    let post = content_store::post(&rig.pool, prepared.node)
        .await
        .expect("reads")
        .expect("post row");
    assert_eq!(post.author_id, actor);
    assert_eq!(post.l1_node_id, own_mint);
    assert_eq!(post.title.as_deref(), Some("First"));
    assert_eq!(post.description.as_deref(), Some("hello"));
    assert_eq!(post.content, "The body");
    assert!(post.redaction_reason.is_none());

    let carried = sqlx::query_as::<_, (Vec<u8>, String)>(
        "SELECT payload, payload_state FROM act_payloads WHERE act_id = $1",
    )
    .bind(body.act_id().to_string())
    .fetch_one(&rig.pool)
    .await
    .expect("carriage row");
    assert_eq!(carried.0, prepared.writes[0].proposal.payload);
    assert_eq!(carried.1, "full");

    let listed = content_store::list_posts(&rig.pool, None, false, 10, true)
        .await
        .expect("lists");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, prepared.node);
    let record = mirror::record_full(&rig.pool, &body.act_id().to_string())
        .await
        .expect("reads record")
        .expect("record");
    assert!(record.payload_marked);
    assert_eq!(record.target().expect("leg").target, own_mint);
}

/// An edit's payload is a whole snapshot, not a patch: it restates the
/// body it keeps, and an absent title stores NULL because the snapshot is
/// the whole state — a Post without that field. An explicit empty title
/// stores NULL the same way. Each edit chains behind the previous one:
/// the first behind the genesis record, the second behind the first.
#[sqlx::test(migrations = "../../migrations")]
async fn a_post_edit_replaces_the_snapshot_and_appends_a_version(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("alice").await;
    let post_id = rig.post(actor, &key, "Old title", "Old body").await;

    let edit = content::prepare_post_edit(
        &rig.pool,
        &rig.boundary,
        GC,
        actor,
        PostEditDraft {
            id: post_id,
            title: Some("New title".into()),
            description: None,
            content: Some("Old body".into()),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("prepares edit");
    let body = &edit.writes[0].proposal.body;
    assert_eq!(body.p_d, 0.0);
    assert!(body.license.is_none());
    assert_eq!(body.asserted_parents.len(), 1);
    rig.land(&edit, &key).await;

    let post = content_store::post(&rig.pool, post_id)
        .await
        .expect("reads")
        .expect("post");
    assert_eq!(post.title.as_deref(), Some("New title"));
    assert_eq!(post.content, "Old body");

    let clear = content::prepare_post_edit(
        &rig.pool,
        &rig.boundary,
        GC,
        actor,
        PostEditDraft {
            id: post_id,
            title: None,
            description: None,
            content: Some("New body".into()),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("prepares clear");
    assert_eq!(
        clear.writes[0].proposal.body.asserted_parents[0].to_string(),
        edit.writes[0].proposal.body.act_id().to_string(),
    );
    rig.land(&clear, &key).await;

    let post = content_store::post(&rig.pool, post_id)
        .await
        .expect("reads")
        .expect("post");
    assert_eq!(post.title, None);
    assert_eq!(post.content, "New body");

    let empty = content::prepare_post_edit(
        &rig.pool,
        &rig.boundary,
        GC,
        actor,
        PostEditDraft {
            id: post_id,
            title: Some(String::new()),
            description: Some("Sub".into()),
            content: Some("Newer body".into()),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("prepares empty title");
    rig.land(&empty, &key).await;

    let post = content_store::post(&rig.pool, post_id)
        .await
        .expect("reads")
        .expect("post");
    assert_eq!(post.title, None);
    assert_eq!(post.description.as_deref(), Some("Sub"));
    assert_eq!(post.content, "Newer body");

    let versions =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM post_versions WHERE post_id = $1")
            .bind(post_id)
            .fetch_one(&rig.pool)
            .await
            .expect("counts");
    assert_eq!(versions, 4, "append-only: genesis + three edits");
}

/// Three refusals at prepare: a non-creator's edit, which the fold would
/// never read anyway (post.md §4); an unknown id, as NotFound; and a
/// second edit while one is in flight, because the backend serializes
/// edits per (node, author) (substrate.md §9). Once the first lands, the
/// next edit stages again.
#[sqlx::test(migrations = "../../migrations")]
async fn edit_eligibility_and_serialization_refuse(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, alice_key) = rig.funded_actor("alice").await;
    let (bob, _bob_key) = rig.funded_actor("bob").await;
    let post_id = rig.post(alice, &alice_key, "Title", "Body").await;

    let refused = content::prepare_post_edit(
        &rig.pool,
        &rig.boundary,
        GC,
        bob,
        PostEditDraft {
            id: post_id,
            title: Some("Hijack".into()),
            description: None,
            content: Some("Body".into()),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await;
    assert!(matches!(refused, Err(ContentError::NotCreator)));

    let refused = content::prepare_post_edit(
        &rig.pool,
        &rig.boundary,
        GC,
        alice,
        PostEditDraft {
            id: Uuid::new_v4(),
            title: Some("x".into()),
            description: None,
            content: Some("Body".into()),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await;
    assert!(matches!(refused, Err(ContentError::NotFound)));

    let first = content::prepare_post_edit(
        &rig.pool,
        &rig.boundary,
        GC,
        alice,
        PostEditDraft {
            id: post_id,
            title: Some("One".into()),
            description: None,
            content: Some("Body".into()),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("first edit stages");
    let second = content::prepare_post_edit(
        &rig.pool,
        &rig.boundary,
        GC,
        alice,
        PostEditDraft {
            id: post_id,
            title: Some("Two".into()),
            description: None,
            content: Some("Body".into()),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await;
    assert!(matches!(second, Err(ContentError::BadInput { .. })));

    rig.land(&first, &alice_key).await;
    content::prepare_post_edit(
        &rig.pool,
        &rig.boundary,
        GC,
        alice,
        PostEditDraft {
            id: post_id,
            title: Some("Three".into()),
            description: None,
            content: Some("Body".into()),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("stages after landing");
}

/// Bob comments on Alice's post — a genesis Review minting the Comment on
/// its terminal leg — and Alice replies to Bob's comment, so
/// comment-on-comment threading holds. The thread read gives the post's
/// direct children as Bob's comment alone, oldest-first, with the reply
/// living under that comment. A comment edit is an ordinary-role Review
/// at `(0, 0)` with an A leg back to the genesis parent, and commenting
/// on nothing refuses.
#[sqlx::test(migrations = "../../migrations")]
async fn comments_thread_and_edit_on_posts_and_comments(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, alice_key) = rig.funded_actor("alice").await;
    let (bob, bob_key) = rig.funded_actor("bob").await;
    let post_id = rig.post(alice, &alice_key, "Title", "Body").await;

    let comment = content::prepare_comment(
        &rig.pool,
        &rig.boundary,
        GC,
        bob,
        CommentDraft {
            target: post_id,
            content: "First!".into(),
            license: license(),
            p_directed: None,
            tags: vec![],
            references: vec![],
            p_interest: Some(0.6),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("prepares comment");
    let body = &comment.writes[0].proposal.body;
    assert_eq!(body.family, common::l1::Family::Review);
    assert_eq!(body.p_d, content::DEFAULT_STANCE);
    assert_eq!(body.p_i, 0.6);
    assert!(body.middle.is_some());
    rig.land(&comment, &bob_key).await;

    let row = content_store::comment(&rig.pool, comment.node)
        .await
        .expect("reads")
        .expect("comment row");
    assert_eq!(row.target_id, post_id);
    assert_eq!(row.target_type, "post");
    assert_eq!(row.author_id, bob);
    assert_eq!(row.content, "First!");

    let reply = content::prepare_comment(
        &rig.pool,
        &rig.boundary,
        GC,
        alice,
        CommentDraft {
            target: comment.node,
            content: "Thanks".into(),
            license: license(),
            p_directed: None,
            tags: vec![],
            references: vec![],
            p_interest: None,
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("prepares reply");
    rig.land(&reply, &alice_key).await;

    let reply_row = content_store::comment(&rig.pool, reply.node)
        .await
        .expect("reads")
        .expect("reply row");
    assert_eq!(reply_row.target_id, comment.node);
    assert_eq!(reply_row.target_type, "comment");

    let on_post = content_store::comments_for_target(&rig.pool, post_id, None, false, 10, true)
        .await
        .expect("thread");
    assert_eq!(on_post.len(), 1);
    assert_eq!(on_post[0].id, comment.node);
    let on_comment =
        content_store::comments_for_target(&rig.pool, comment.node, None, false, 10, true)
            .await
            .expect("replies");
    assert_eq!(on_comment.len(), 1);
    assert_eq!(on_comment[0].id, reply.node);

    let edit = content::prepare_comment_edit(
        &rig.pool,
        &rig.boundary,
        GC,
        bob,
        CommentEditDraft {
            id: comment.node,
            content: "First! (edited)".into(),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("prepares comment edit");
    let body = &edit.writes[0].proposal.body;
    assert_eq!((body.p_d, body.p_i), (0.0, 0.0));
    assert_eq!(
        body.middle.as_ref().expect("parent").to_string(),
        content_store::post(&rig.pool, post_id)
            .await
            .expect("reads")
            .expect("post")
            .l1_node_id,
    );
    rig.land(&edit, &bob_key).await;
    let row = content_store::comment(&rig.pool, comment.node)
        .await
        .expect("reads")
        .expect("comment");
    assert_eq!(row.content, "First! (edited)");

    let refused = content::prepare_comment(
        &rig.pool,
        &rig.boundary,
        GC,
        bob,
        CommentDraft {
            target: Uuid::new_v4(),
            content: "into the void".into(),
            license: license(),
            p_directed: None,
            tags: vec![],
            references: vec![],
            p_interest: None,
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await;
    assert!(matches!(refused, Err(ContentError::BadInput { .. })));
}

/// Newest-first, so the last post leads. The keyset cursor continues
/// exactly where the page ended, and walking backward from that same
/// cursor serves the newer neighbors instead — still newest-first. The
/// record chronicle pages the five Publishes the same way.
#[sqlx::test(migrations = "../../migrations")]
async fn the_listing_pages_by_keyset_in_landing_order(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("alice").await;
    let mut ids = Vec::new();
    for i in 0..5 {
        ids.push(rig.post(actor, &key, &format!("t{i}"), "b").await);
    }

    let page1 = content_store::list_posts(&rig.pool, None, false, 2, true)
        .await
        .expect("page 1");
    assert_eq!(
        page1.iter().map(|p| p.id).collect::<Vec<_>>(),
        vec![ids[4], ids[3]]
    );

    let page2 = content_store::list_posts(&rig.pool, Some(cursor_of(&page1[1])), false, 2, true)
        .await
        .expect("page 2");
    assert_eq!(
        page2.iter().map(|p| p.id).collect::<Vec<_>>(),
        vec![ids[2], ids[1]]
    );

    let back = content_store::list_posts(&rig.pool, Some(cursor_of(&page2[1])), true, 2, true)
        .await
        .expect("backward");
    assert_eq!(
        back.iter().map(|p| p.id).collect::<Vec<_>>(),
        vec![ids[3], ids[2]]
    );

    let records = mirror::records(
        &rig.pool,
        &mirror::RecordFilter {
            family: Some("publish".into()),
            ..Default::default()
        },
        None,
        false,
        10,
    )
    .await
    .expect("records");
    assert_eq!(records.len(), 5);
    assert!(
        records
            .windows(2)
            .all(|w| (w[0].epoch, w[0].act_time, w[0].position)
                > (w[1].epoch, w[1].act_time, w[1].position))
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_chain_head_tracks_the_newest_landed_edit(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("alice").await;
    let post_id = rig.post(actor, &key, "T", "B").await;
    let post = content_store::post(&rig.pool, post_id)
        .await
        .expect("reads")
        .expect("post");

    let genesis_head = mirror::chain_head(
        &rig.pool,
        &key.address(),
        common::l1::Family::Publish,
        &post.l1_node_id,
    )
    .await
    .expect("head")
    .expect("genesis is the head");

    let edit = content::prepare_post_edit(
        &rig.pool,
        &rig.boundary,
        GC,
        actor,
        PostEditDraft {
            id: post_id,
            title: Some("T2".into()),
            description: None,
            content: Some("B".into()),
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("edit");
    assert_eq!(
        edit.writes[0].proposal.body.asserted_parents[0].to_string(),
        genesis_head
    );
    rig.land(&edit, &key).await;

    let new_head = mirror::chain_head(
        &rig.pool,
        &key.address(),
        common::l1::Family::Publish,
        &post.l1_node_id,
    )
    .await
    .expect("head")
    .expect("head exists");
    assert_eq!(new_head, edit.writes[0].proposal.body.act_id().to_string());
}

/// The chronicle's filters compose: author narrows to Bob's records,
/// terminal to the review that minted a comment — its revision chain —
/// and payload-marked and epoch-window compose on top. Records page
/// backward too: from the newest record's cursor the backward walk serves
/// the older neighbor.
///
/// Carriage is idempotent under a forced double-promotion. Re-running the
/// content landing pass over already-promoted writes is a clean no-op:
/// carriage inserts ignore the conflict and version rows land by their
/// own key, so the pass reports nothing and duplicates nothing. The real
/// `promote_landed` filter never re-selects a landed row, so this
/// exercises a path production does not take.
#[sqlx::test(migrations = "../../migrations")]
async fn the_chronicle_filters_compose_and_carriage_is_idempotent(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (alice, alice_key) = rig.funded_actor("alice").await;
    let (bob, bob_key) = rig.funded_actor("bob").await;
    let post_id = rig.post(alice, &alice_key, "T", "B").await;
    let comment = content::prepare_comment(
        &rig.pool,
        &rig.boundary,
        GC,
        bob,
        CommentDraft {
            target: post_id,
            content: "c".into(),
            license: license(),
            p_directed: None,
            tags: vec![],
            references: vec![],
            p_interest: None,
            attachments: vec![],
            sensitive: Default::default(),
        },
    )
    .await
    .expect("prepares");
    rig.land(&comment, &bob_key).await;
    let comment_node = content_store::comment(&rig.pool, comment.node)
        .await
        .expect("reads")
        .expect("row")
        .l1_node_id;

    let by_bob = mirror::records(
        &rig.pool,
        &mirror::RecordFilter {
            author: Some(bob_key.address()),
            ..Default::default()
        },
        None,
        false,
        10,
    )
    .await
    .expect("records");
    assert_eq!(by_bob.len(), 1);
    assert_eq!(by_bob[0].family, "review");

    let minting = mirror::records(
        &rig.pool,
        &mirror::RecordFilter {
            terminal: Some(comment_node.clone()),
            ..Default::default()
        },
        None,
        false,
        10,
    )
    .await
    .expect("records");
    assert_eq!(minting.len(), 1);
    assert_eq!(minting[0].record_id, by_bob[0].record_id);

    let publish_epoch = content_store::post(&rig.pool, post_id)
        .await
        .expect("reads")
        .expect("post")
        .order
        .expect("landed")
        .landed_epoch;
    let windowed = mirror::records(
        &rig.pool,
        &mirror::RecordFilter {
            family: Some("publish".into()),
            payload_marked: Some(true),
            since_epoch: Some(publish_epoch),
            until_epoch: Some(publish_epoch),
            ..Default::default()
        },
        None,
        false,
        10,
    )
    .await
    .expect("records");
    assert_eq!(windowed.len(), 1);
    let outside = mirror::records(
        &rig.pool,
        &mirror::RecordFilter {
            family: Some("publish".into()),
            since_epoch: Some(publish_epoch + 1),
            ..Default::default()
        },
        None,
        false,
        10,
    )
    .await
    .expect("records");
    assert!(outside.is_empty());

    let all = mirror::records(&rig.pool, &mirror::RecordFilter::default(), None, false, 10)
        .await
        .expect("records");
    assert!(all.len() >= 2);
    let newest = (all[0].epoch, all[0].act_time, all[0].position);
    let older = mirror::records(
        &rig.pool,
        &mirror::RecordFilter::default(),
        Some(newest),
        false,
        1,
    )
    .await
    .expect("forward from newest");
    assert_eq!(older.len(), 1);
    assert_eq!(older[0].record_id, all[1].record_id);
    let back = mirror::records(
        &rig.pool,
        &mirror::RecordFilter::default(),
        Some((older[0].epoch, older[0].act_time, older[0].position)),
        true,
        5,
    )
    .await
    .expect("backward");
    assert_eq!(back[back.len() - 1].record_id, all[0].record_id);

    let promoted = sqlx::query_as::<_, (Uuid, Uuid, String, String)>(
        "SELECT id, actor_id, act_id, family FROM staged_writes WHERE state = 'landed'",
    )
    .fetch_all(&rig.pool)
    .await
    .expect("landed rows");
    let versions_before = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM post_versions")
        .fetch_one(&rig.pool)
        .await
        .expect("counts");
    let writes: Vec<staged::PromotedWrite> = promoted
        .iter()
        .map(|r| staged::PromotedWrite {
            id: r.0,
            actor_id: r.1,
            act_id: r.2.clone(),
            family: r.3.clone(),
        })
        .collect();
    let failures = content::land_promoted(&rig.pool, &writes).await;
    assert!(
        failures.is_empty(),
        "re-promotion is a no-op, not a failure: {failures:?}"
    );
    let carriage = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM act_payloads")
        .fetch_one(&rig.pool)
        .await
        .expect("counts");
    assert_eq!(carriage, 2, "one carriage row per landed content act");
    let versions_after = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM post_versions")
        .fetch_one(&rig.pool)
        .await
        .expect("counts");
    assert_eq!(versions_after, versions_before, "nothing duplicated");
}

mod galleries {
    //! ´mod:module:galleries´
    //!
    //! The gallery half of the content path: what an attachment list does
    //! to the envelope, to the junction rows, and to a reader — including
    //! the expiry the whole re-keying exists for.

    use super::*;
    use api::media::AttachmentDraft;
    use postgres_store::media as media_store;

    /// An asset row without the upload path: the byte pipeline has its own
    /// end-to-end test and nothing here is about bytes. The digest is what
    /// binds the row to the manifest, so it is the field these fixtures
    /// vary.
    async fn asset(pool: &PgPool, author: Uuid, fill: u8) -> Uuid {
        let id = Uuid::new_v4();
        media_store::insert(
            pool,
            id,
            author,
            &[fill; 32],
            "sha256",
            &format!("{id}.webp"),
            "image/webp",
            1024,
            Some(&format!("picture {fill}")),
            &serde_json::json!({ "v": 1, "aspect_ratio": "4:5" }),
        )
        .await
        .expect("asset row");
        id
    }

    fn placements(ids: &[Uuid]) -> Vec<AttachmentDraft> {
        ids.iter()
            .enumerate()
            .map(|(i, id)| AttachmentDraft {
                media_id: *id,
                display_order: i as i32,
                is_cover: Some(i == 0),
            })
            .collect()
    }

    /// The gallery a post currently renders, in order — the junction rows
    /// of the version the read side would pick.
    async fn rendered(pool: &PgPool, post_id: Uuid) -> Vec<Uuid> {
        let post = content_store::post(pool, post_id)
            .await
            .expect("reads")
            .expect("post");
        media_store::post_galleries(pool, &[post.version_id])
            .await
            .expect("gallery")
            .into_iter()
            .map(|(_, entry)| entry.asset.id)
            .collect()
    }

    fn media_post(attachments: Vec<AttachmentDraft>) -> PostDraft {
        PostDraft {
            title: Some("Look".into()),
            description: Some("Words beside it".into()),
            content: None,
            license: license(),
            p_directed: None,
            tags: vec![],
            references: vec![],
            attachments,
            sensitive: Default::default(),
        }
    }

    /// A media post lands with its gallery on the version row and its
    /// manifest on the record, the two saying the same thing in the same
    /// order — which is what makes a gallery rebuildable from the record
    /// rather than only from the request that made it.
    #[sqlx::test(migrations = "../../migrations")]
    async fn a_media_post_lands_with_its_manifest_and_its_junction_rows(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, key) = rig.funded_actor("alice").await;
        let (a, b) = (
            asset(&rig.pool, actor, 1).await,
            asset(&rig.pool, actor, 2).await,
        );

        let prepared = content::prepare_post(
            &rig.pool,
            &rig.boundary,
            GC,
            actor,
            media_post(placements(&[a, b])),
        )
        .await
        .expect("prepares");

        let decoded =
            CograContent::decode_payload(&prepared.writes[0].proposal.payload).expect("decodes");
        assert_eq!(decoded.media.len(), 2);
        assert_eq!(decoded.media[0].digest, [1; 32], "array position is order");
        assert_eq!(decoded.media[1].digest, [2; 32]);
        assert_eq!(decoded.media[0].mime, "image/webp");
        assert_eq!(decoded.media[0].alt_text.as_deref(), Some("picture 1"));
        assert_eq!(
            decoded.body.as_deref(),
            Some(""),
            "a media post's words are empty, not absent"
        );
        assert_eq!(
            prepared.writes.len(),
            1,
            "a gallery mints nothing: two pictures, still one act"
        );

        rig.land(&prepared, &key).await;
        assert_eq!(rendered(&rig.pool, prepared.node).await, vec![a, b]);

        let version = content_store::post(&rig.pool, prepared.node)
            .await
            .expect("reads")
            .expect("post")
            .version_id;
        let entries = media_store::post_galleries(&rig.pool, &[version])
            .await
            .expect("gallery");
        assert!(entries[0].1.is_cover, "the first picture is the cover");
        assert!(!entries[1].1.is_cover);
        assert_eq!(entries[0].1.display_order, 0);
        assert_eq!(entries[1].1.display_order, 1);
    }

    /// **The D7 scenario.** A post lands with pictures A and B; an edit
    /// changes its words and its gallery to B and C; the edit never lands
    /// and expires. Both halves roll back together — before the gallery
    /// was versioned, the text returned to the landed version and the new
    /// gallery stayed, so a reader saw the old words under the new
    /// pictures and the winning record's manifest disagreed with the
    /// screen.
    ///
    /// The words here are the title and description: a media post's body
    /// *is* its gallery, and words beside media are the description, so
    /// those are the version-row text a media post edits.
    #[sqlx::test(migrations = "../../migrations")]
    async fn an_expired_edit_rolls_back_the_words_and_the_gallery_together(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, key) = rig.funded_actor("alice").await;
        let (a, b, c) = (
            asset(&rig.pool, actor, 1).await,
            asset(&rig.pool, actor, 2).await,
            asset(&rig.pool, actor, 3).await,
        );

        let prepared = content::prepare_post(
            &rig.pool,
            &rig.boundary,
            GC,
            actor,
            PostDraft {
                title: Some("Before".into()),
                description: Some("The landed words".into()),
                content: None,
                license: license(),
                p_directed: None,
                tags: vec![],
                references: vec![],
                attachments: placements(&[a, b]),
                sensitive: Default::default(),
            },
        )
        .await
        .expect("prepares");
        rig.land(&prepared, &key).await;
        let post_id = prepared.node;
        assert_eq!(rendered(&rig.pool, post_id).await, vec![a, b]);

        let edit = content::prepare_post_edit(
            &rig.pool,
            &rig.boundary,
            GC,
            actor,
            PostEditDraft {
                id: post_id,
                title: Some("After".into()),
                description: Some("The pending words".into()),
                content: None,
                attachments: placements(&[b, c]),
                sensitive: Default::default(),
            },
        )
        .await
        .expect("prepares edit");

        let write = staged::load(&rig.pool, edit.writes[0].id)
            .await
            .expect("loads");
        let pre = key.pre_sign(write.proposal);
        api::relay::submit_pre_signed(
            &rig.boundary,
            &rig.pool,
            edit.writes[0].id,
            PreSignedParts {
                author_pubkey: pre.author_pubkey.clone(),
                nonce: pre.nonce.clone(),
                pre_signature: pre.pre_signature.clone(),
            },
        )
        .await
        .expect("seals");

        let pending = content_store::post(&rig.pool, post_id)
            .await
            .expect("reads")
            .expect("post");
        assert_eq!(pending.description.as_deref(), Some("The pending words"));
        assert_eq!(pending.title.as_deref(), Some("After"));
        assert_eq!(rendered(&rig.pool, post_id).await, vec![b, c]);

        staged::expire_one(&rig.pool, edit.writes[0].id, 999)
            .await
            .expect("expires");

        let after = content_store::post(&rig.pool, post_id)
            .await
            .expect("reads")
            .expect("post");
        assert_eq!(
            after.description.as_deref(),
            Some("The landed words"),
            "the words roll back"
        );
        assert_eq!(after.title.as_deref(), Some("Before"));
        assert_eq!(
            rendered(&rig.pool, post_id).await,
            vec![a, b],
            "and the gallery rolls back with them"
        );
        let remaining = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM post_attachments")
            .fetch_one(&rig.pool)
            .await
            .expect("counts");
        assert_eq!(remaining, 2, "the discarded version took its junction rows");
    }

    /// A superseded version keeps the gallery it carried, so a picture an
    /// edit dropped is still referenced and the orphan sweeper leaves it
    /// alone — right, because the old digests stay committed on the record
    /// that carried them.
    #[sqlx::test(migrations = "../../migrations")]
    async fn a_superseded_version_keeps_its_own_gallery(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, key) = rig.funded_actor("alice").await;
        let (a, b) = (
            asset(&rig.pool, actor, 1).await,
            asset(&rig.pool, actor, 2).await,
        );

        let prepared = content::prepare_post(
            &rig.pool,
            &rig.boundary,
            GC,
            actor,
            media_post(placements(&[a])),
        )
        .await
        .expect("prepares");
        rig.land(&prepared, &key).await;

        let edit = content::prepare_post_edit(
            &rig.pool,
            &rig.boundary,
            GC,
            actor,
            PostEditDraft {
                id: prepared.node,
                title: None,
                description: None,
                content: None,
                attachments: placements(&[b]),
                sensitive: Default::default(),
            },
        )
        .await
        .expect("prepares edit");
        rig.land(&edit, &key).await;

        assert_eq!(rendered(&rig.pool, prepared.node).await, vec![b]);
        let swept = media_store::sweep_orphans(&rig.pool, -1.0)
            .await
            .expect("sweeps");
        assert!(
            swept.is_empty(),
            "the dropped picture is still on the superseded version"
        );
    }

    /// A comment carries the smaller gallery and no cover: its media
    /// supports the words rather than replacing them.
    #[sqlx::test(migrations = "../../migrations")]
    async fn a_comment_carries_media_beside_its_words(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, key) = rig.funded_actor("alice").await;
        let post = rig.post(actor, &key, "Parent", "Words").await;
        let a = asset(&rig.pool, actor, 7).await;

        let prepared = content::prepare_comment(
            &rig.pool,
            &rig.boundary,
            GC,
            actor,
            CommentDraft {
                target: post,
                content: "An answer, with a picture".into(),
                license: license(),
                p_directed: None,
                p_interest: None,
                tags: vec![],
                references: vec![],
                attachments: placements(&[a]),
                sensitive: Default::default(),
            },
        )
        .await
        .expect("prepares");
        rig.land(&prepared, &key).await;

        let comment = content_store::comment(&rig.pool, prepared.node)
            .await
            .expect("reads")
            .expect("comment");
        assert_eq!(comment.content, "An answer, with a picture");
        let gallery = media_store::comment_galleries(&rig.pool, &[comment.version_id])
            .await
            .expect("gallery");
        assert_eq!(gallery.len(), 1);
        assert_eq!(gallery[0].1.asset.id, a);
        assert!(!gallery[0].1.is_cover, "a comment gallery has no cover");
    }

    /// `PreparedContent` is not `Debug` — it carries signing material —
    /// so a refusal is unwrapped by matching rather than by `expect_err`.
    fn refused(r: Result<content::PreparedContent, ContentError>) -> ContentError {
        match r {
            Ok(_) => panic!("expected a refusal, got a prepared write"),
            Err(e) => e,
        }
    }

    fn gallery_refusal(e: ContentError) -> (Vec<String>, String) {
        match e {
            ContentError::Gallery(e) => (e.path, e.message),
            other => panic!("expected a gallery refusal, got {other}"),
        }
    }

    /// Every gallery refusal, each naming its offender: the count over the
    /// whole list, an order contradicting the position the envelope will
    /// witness, the same picture twice, an asset that is not there, and —
    /// the anti-hijack rule — someone else's picture.
    #[sqlx::test(migrations = "../../migrations")]
    async fn a_gallery_is_refused_whole_and_names_the_offending_entry(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, _key) = rig.funded_actor("alice").await;
        let (stranger, _stranger_key) = rig.funded_actor("mallory").await;
        let mine = asset(&rig.pool, actor, 1).await;
        let theirs = asset(&rig.pool, stranger, 2).await;

        let mut eleven = Vec::new();
        for fill in 10..21u8 {
            eleven.push(asset(&rig.pool, actor, fill).await);
        }

        let cases: Vec<(Vec<AttachmentDraft>, Vec<String>)> = vec![
            (placements(&eleven), vec!["attachments".into()]),
            (
                vec![AttachmentDraft {
                    media_id: mine,
                    display_order: 3,
                    is_cover: None,
                }],
                vec!["attachments".into(), "0".into(), "displayOrder".into()],
            ),
            (
                vec![
                    AttachmentDraft {
                        media_id: mine,
                        display_order: 0,
                        is_cover: None,
                    },
                    AttachmentDraft {
                        media_id: mine,
                        display_order: 1,
                        is_cover: None,
                    },
                ],
                vec!["attachments".into(), "1".into(), "mediaId".into()],
            ),
            (
                placements(&[Uuid::new_v4()]),
                vec!["attachments".into(), "0".into(), "mediaId".into()],
            ),
            (
                placements(&[theirs]),
                vec!["attachments".into(), "0".into(), "mediaId".into()],
            ),
        ];

        for (attachments, expected) in cases {
            let e = refused(
                content::prepare_post(&rig.pool, &rig.boundary, GC, actor, media_post(attachments))
                    .await,
            );
            assert_eq!(gallery_refusal(e).0, expected);
        }

        assert_eq!(
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM staged_writes")
                .fetch_one(&rig.pool)
                .await
                .expect("counts"),
            0,
            "a refused gallery leaves nothing in flight"
        );
    }

    /// A comment's gallery is bounded lower than a post's, checked the
    /// same way and over the whole list.
    #[sqlx::test(migrations = "../../migrations")]
    async fn a_comment_gallery_stops_at_four(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, key) = rig.funded_actor("alice").await;
        let post = rig.post(actor, &key, "Parent", "Words").await;
        let mut five = Vec::new();
        for fill in 1..6u8 {
            five.push(asset(&rig.pool, actor, fill).await);
        }
        let e = refused(
            content::prepare_comment(
                &rig.pool,
                &rig.boundary,
                GC,
                actor,
                CommentDraft {
                    target: post,
                    content: "Too many".into(),
                    license: license(),
                    p_directed: None,
                    p_interest: None,
                    tags: vec![],
                    references: vec![],
                    attachments: placements(&five),
                    sensitive: Default::default(),
                },
            )
            .await,
        );
        let (path, message) = gallery_refusal(e);
        assert_eq!(path, vec!["attachments".to_string()]);
        assert!(message.contains("at most 4"), "{message}");
    }

    /// The body's exclusive-or, refused from both sides — words beside a
    /// gallery, and a post with neither — on a create and on an edit.
    #[sqlx::test(migrations = "../../migrations")]
    async fn a_post_body_is_words_or_media_and_never_both_or_neither(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, key) = rig.funded_actor("alice").await;
        let a = asset(&rig.pool, actor, 1).await;

        let both = PostDraft {
            content: Some("Words".into()),
            ..media_post(placements(&[a]))
        };
        let neither = PostDraft {
            content: Some("   ".into()),
            ..media_post(vec![])
        };
        for draft in [both, neither] {
            match refused(content::prepare_post(&rig.pool, &rig.boundary, GC, actor, draft).await) {
                ContentError::BadInput { field, .. } => assert_eq!(field, "content"),
                other => panic!("expected a body refusal, got {other}"),
            }
        }

        let post = rig.post(actor, &key, "Parent", "Words").await;
        match refused(
            content::prepare_post_edit(
                &rig.pool,
                &rig.boundary,
                GC,
                actor,
                PostEditDraft {
                    id: post,
                    title: None,
                    description: None,
                    content: Some("Words".into()),
                    attachments: placements(&[a]),
                    sensitive: Default::default(),
                },
            )
            .await,
        ) {
            ContentError::BadInput { field, .. } => assert_eq!(field, "content"),
            other => panic!("expected a body refusal, got {other}"),
        }
    }
}
