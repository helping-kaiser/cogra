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
            },
        )
        .await
        .expect("prepares post");
        self.land(&prepared, key).await;
        prepared.node
    }
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
