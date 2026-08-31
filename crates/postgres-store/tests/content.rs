//! Display-content store tests: the pending/landed boundary the listing
//! walks and the expiry path that clears it (data-model.md "Content
//! nodes"). These exercise the store functions directly, because a node
//! can carry the rows of more than one staged write and the API's own
//! serialization rules make that state hard to reach end to end — the
//! store's contract has to hold on its own.

use postgres_store::content::{self, ContentCursor, LandingOrder, Post};
use postgres_store::genesis;
use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

fn at(secs: i64) -> Timestamp {
    chrono::DateTime::from_timestamp(1_800_000_000 + secs, 0).expect("in range")
}

fn order(epoch: i64, position: i64) -> LandingOrder {
    LandingOrder {
        landed_epoch: epoch,
        act_time: position + 1,
        position,
    }
}

async fn actor(pool: &PgPool, handle: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut conn = pool.acquire().await.expect("conn");
    genesis::insert_actor(
        &mut conn,
        id,
        "user",
        handle,
        format!("pk-{handle}").as_bytes(),
        &format!("addr-{handle}"),
    )
    .await
    .expect("actor row");
    id
}

/// A stand-in mint identifier. Only its uniqueness matters here, and
/// the row's own id supplies that.
fn node_of(id: Uuid, family: &str) -> String {
    format!("mint:act:{id}:0:{family}")
}

/// A post entity row plus its first version, pending unless `order` is
/// given.
async fn post(
    pool: &PgPool,
    author: Uuid,
    order: Option<LandingOrder>,
    created_at: Timestamp,
    body: &str,
) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post(
        &mut tx,
        id,
        author,
        &node_of(id, "publish"),
        "a=0;o=0",
        order,
        created_at,
        Some("title"),
        None,
        body,
        None,
    )
    .await
    .expect("post");
    tx.commit().await.expect("commit");
    id
}

/// A comment entity row plus its first version, pending unless `order`
/// is given. The parent's kind is read from the store rather than
/// passed, so a test names only what it is arranging.
async fn comment(
    pool: &PgPool,
    author: Uuid,
    target: Uuid,
    order: Option<LandingOrder>,
    created_at: Timestamp,
    body: &str,
) -> Uuid {
    let target_type = content::content_kind(pool, target)
        .await
        .expect("kind")
        .expect("the parent is content");
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_comment(
        &mut tx,
        id,
        target,
        target_type,
        author,
        &node_of(id, "review"),
        "a=0;o=0",
        order,
        created_at,
        body,
        None,
    )
    .await
    .expect("comment");
    tx.commit().await.expect("commit");
    id
}

/// Every version row of a post, oldest first, with its pending mark.
/// The runtime query API, not the checked macro: integration tests are
/// not covered by the committed offline metadata.
async fn pending_versions(pool: &PgPool, post_id: Uuid) -> Vec<(Timestamp, bool)> {
    sqlx::query_as::<_, (Timestamp, bool)>(
        "SELECT created_at, pending FROM post_versions
         WHERE post_id = $1 ORDER BY created_at",
    )
    .bind(post_id)
    .fetch_all(pool)
    .await
    .expect("versions")
}

/// The cursor a resolver would hand back for a listing entry: its sort
/// key and its own id.
fn cursor_of(p: &Post) -> ContentCursor {
    ContentCursor {
        order: p.sort_key(),
        id: Some(p.id),
    }
}

async fn page(pool: &PgPool, cursor: Option<ContentCursor>, limit: i64) -> Vec<Post> {
    content::list_posts(pool, cursor, false, limit, true)
        .await
        .expect("lists")
}

/// Two pre-commitment signatures can fall in the same microsecond —
/// nothing serializes two authors' signing apart — so the authoring instant
/// alone cannot key the walk. Walking one entry at a time must visit both
/// without the exclusive cursor swallowing the sibling that shares its
/// instant, and must then end rather than loop on the tie.
#[sqlx::test(migrations = "../../migrations")]
async fn same_instant_pending_entries_paginate_without_loss(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let one = post(&pool, author, None, at(0), "one").await;
    let two = post(&pool, author, None, at(0), "two").await;

    let all = page(&pool, None, 10).await;
    assert_eq!(all.len(), 2, "both pending entries are listed");

    let first = page(&pool, None, 1).await;
    assert_eq!(first.len(), 1);
    let second = page(&pool, Some(cursor_of(&first[0])), 1).await;
    assert_eq!(
        second.len(),
        1,
        "the same-instant sibling must survive the page boundary"
    );

    let mut walked = vec![first[0].id, second[0].id];
    walked.sort();
    let mut expected = vec![one, two];
    expected.sort();
    assert_eq!(walked, expected);

    assert!(page(&pool, Some(cursor_of(&second[0])), 1).await.is_empty());
}

/// A page boundary can fall inside the pending set and then have its own
/// entry land underneath it: the key moves out of the pending namespace
/// into the landed one, under the cursor the client is still holding. Page
/// two must resume where that entry actually sits now, serving the rest and
/// nothing twice.
#[sqlx::test(migrations = "../../migrations")]
async fn a_page_boundary_survives_the_entry_landing_under_it(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let old = post(&pool, author, Some(order(1, 0)), at(0), "landed-old").await;
    let new = post(&pool, author, Some(order(1, 1)), at(10), "landed-new").await;
    let pending_first = post(&pool, author, None, at(20), "p1").await;
    let pending_second = post(&pool, author, None, at(30), "p2").await;

    let page1 = page(&pool, None, 2).await;
    assert_eq!(
        page1.iter().map(|p| p.id).collect::<Vec<_>>(),
        vec![pending_second, pending_first]
    );
    let boundary = cursor_of(&page1[1]);

    let mut tx = pool.begin().await.expect("tx");
    content::land_post(&mut tx, pending_first, order(2, 0))
        .await
        .expect("lands");
    content::land_post(&mut tx, pending_second, order(2, 1))
        .await
        .expect("lands");
    tx.commit().await.expect("commit");

    let page2 = page(&pool, Some(boundary), 10).await;
    assert_eq!(
        page2.iter().map(|p| p.id).collect::<Vec<_>>(),
        vec![new, old],
        "an entry that landed between pages must not be served again"
    );
}

/// A node can carry two unlanded edits, each staged by its own write and
/// dated from its own pre-commitment. Landing the earlier one drops its
/// pending mark and only its own.
#[sqlx::test(migrations = "../../migrations")]
async fn landing_one_write_leaves_another_writes_pending_version(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let id = post(&pool, author, Some(order(1, 0)), at(0), "genesis").await;

    let mut tx = pool.begin().await.expect("tx");
    content::insert_post_version(
        &mut tx,
        id,
        Some("title"),
        None,
        "first edit",
        None,
        None,
        at(10),
    )
    .await
    .expect("first");
    content::insert_post_version(
        &mut tx,
        id,
        Some("title"),
        None,
        "second edit",
        None,
        None,
        at(20),
    )
    .await
    .expect("second");
    tx.commit().await.expect("commit");

    let mut tx = pool.begin().await.expect("tx");
    assert!(
        content::land_post_version(&mut tx, id, at(10), order(2, 0))
            .await
            .expect("lands")
    );
    tx.commit().await.expect("commit");

    assert_eq!(
        pending_versions(&pool, id).await,
        vec![(at(0), false), (at(10), false), (at(20), true)],
        "landing one write must not land another's pending text"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn discarding_one_write_leaves_another_writes_pending_version(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let id = post(&pool, author, Some(order(1, 0)), at(0), "genesis").await;
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post_version(
        &mut tx,
        id,
        Some("title"),
        None,
        "doomed",
        None,
        None,
        at(10),
    )
    .await
    .expect("first");
    content::insert_post_version(
        &mut tx,
        id,
        Some("title"),
        None,
        "survivor",
        None,
        None,
        at(20),
    )
    .await
    .expect("second");
    tx.commit().await.expect("commit");

    let mut tx = pool.begin().await.expect("tx");
    content::discard_pending(&mut tx, id, at(10))
        .await
        .expect("discards");
    tx.commit().await.expect("commit");

    assert_eq!(
        pending_versions(&pool, id).await,
        vec![(at(0), false), (at(20), true)],
        "expiring one write must not take another's pending text"
    );
}

/// Discarding a pending post takes the pending thread beneath it — the
/// pending comment on it, and the pending reply under that comment. A
/// comment that already landed is ordered fact and not expiry's to remove:
/// it stays, and reads as an orphan whose `target` resolves to null
/// (data-model.md "Content nodes").
#[sqlx::test(migrations = "../../migrations")]
async fn discarding_a_pending_post_takes_the_pending_thread_under_it(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let commenter = actor(&pool, "commenter").await;

    let host = post(&pool, author, None, at(0), "host").await;
    let reply = comment(&pool, commenter, host, None, at(10), "on a pending post").await;
    let nested = comment(
        &pool,
        commenter,
        reply,
        None,
        at(20),
        "on a pending comment",
    )
    .await;

    let landed = comment(
        &pool,
        commenter,
        host,
        Some(order(2, 0)),
        at(30),
        "already ordered",
    )
    .await;

    let mut tx = pool.begin().await.expect("tx");
    content::discard_pending(&mut tx, host, at(0))
        .await
        .expect("discards");
    tx.commit().await.expect("commit");

    assert!(content::post(&pool, host).await.expect("read").is_none());
    assert!(
        content::comment(&pool, reply)
            .await
            .expect("read")
            .is_none(),
        "a pending comment on a discarded pending post goes with it"
    );
    assert!(
        content::comment(&pool, nested)
            .await
            .expect("read")
            .is_none(),
        "and so does the pending reply under that comment"
    );

    let orphan = content::comment(&pool, landed)
        .await
        .expect("read")
        .expect("the landed comment survives");
    assert_eq!(orphan.target_id, host);
    assert!(
        content::post(&pool, orphan.target_id)
            .await
            .expect("read")
            .is_none()
    );
}

/// Two landed edits whose authoring instants run the opposite way from
/// their records: the edit written second was ordered first by L1, which is
/// what a promotion pass replaying two epochs out of order produces. The
/// records decide which one renders, and the listing read resolves the same
/// version as the single read.
#[sqlx::test(migrations = "../../migrations")]
async fn the_edit_whose_record_landed_last_renders_the_post(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let id = post(&pool, author, Some(order(1, 0)), at(0), "genesis").await;

    let mut tx = pool.begin().await.expect("tx");
    content::insert_post_version(
        &mut tx,
        id,
        Some("title"),
        None,
        "landed later",
        None,
        Some(order(9, 0)),
        at(100),
    )
    .await
    .expect("later record");
    content::insert_post_version(
        &mut tx,
        id,
        Some("title"),
        None,
        "landed earlier",
        None,
        Some(order(2, 0)),
        at(200),
    )
    .await
    .expect("earlier record");
    tx.commit().await.expect("commit");

    let rendered = content::post(&pool, id)
        .await
        .expect("read")
        .expect("the post is there");
    assert_eq!(
        rendered.content, "landed later",
        "the records order the versions; the clock only proxied them"
    );
    assert_eq!(
        rendered.version_created_at,
        at(100),
        "updatedAt follows the winning version, not the newest instant"
    );

    let listed = page(&pool, None, 10).await;
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].content, "landed later");
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_comment_edit_whose_record_landed_last_renders_the_comment(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let commenter = actor(&pool, "commenter").await;
    let host = post(&pool, author, Some(order(1, 0)), at(0), "host").await;
    let id = comment(&pool, commenter, host, Some(order(1, 1)), at(10), "genesis").await;

    let mut tx = pool.begin().await.expect("tx");
    content::insert_comment_version(
        &mut tx,
        id,
        "landed later",
        None,
        Some(order(9, 0)),
        at(100),
    )
    .await
    .expect("later record");
    content::insert_comment_version(
        &mut tx,
        id,
        "landed earlier",
        None,
        Some(order(2, 0)),
        at(200),
    )
    .await
    .expect("earlier record");
    tx.commit().await.expect("commit");

    let rendered = content::comment(&pool, id)
        .await
        .expect("read")
        .expect("the comment is there");
    assert_eq!(rendered.content, "landed later");

    let thread = content::comments_for_target(&pool, host, None, false, 10, true)
        .await
        .expect("thread");
    assert_eq!(thread.len(), 1);
    assert_eq!(
        thread[0].content, "landed later",
        "the thread read resolves the same version as the single read"
    );
}

/// An unlanded edit has no place in the order yet, so it renders above
/// every landed version regardless of what the coordinates say — the
/// author's own text, from the moment they signed it (substrate.md §6). A
/// reader who asked for only what the graph has settled skips it and gets
/// the newest landed version instead.
#[sqlx::test(migrations = "../../migrations")]
async fn a_pending_edit_outranks_a_version_that_landed_after_it_was_signed(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let id = post(&pool, author, Some(order(1, 0)), at(0), "genesis").await;

    let mut tx = pool.begin().await.expect("tx");
    content::insert_post_version(
        &mut tx,
        id,
        Some("title"),
        None,
        "pending",
        None,
        None,
        at(10),
    )
    .await
    .expect("pending edit");
    content::insert_post_version(
        &mut tx,
        id,
        Some("title"),
        None,
        "landed",
        None,
        Some(order(9, 0)),
        at(20),
    )
    .await
    .expect("landed edit");
    tx.commit().await.expect("commit");

    let rendered = content::post(&pool, id)
        .await
        .expect("read")
        .expect("the post is there");
    assert_eq!(rendered.content, "pending");
    assert!(rendered.version_pending);

    let landed_only = content::list_posts(&pool, None, false, 10, false)
        .await
        .expect("lists");
    assert_eq!(landed_only.len(), 1);
    assert_eq!(landed_only[0].content, "landed");
    assert!(!landed_only[0].version_pending);
}

/// A version row written before the coordinates existed carries none, and
/// falls back to its instant — but never above a version the graph
/// ordered. Written through raw SQL because no store function can
/// produce a landed row without coordinates any more, which is the
/// point: only the migration's own legacy rows look like this.
#[sqlx::test(migrations = "../../migrations")]
async fn a_landed_version_without_coordinates_falls_below_one_with_them(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let id = post(&pool, author, Some(order(1, 0)), at(0), "genesis").await;

    let mut tx = pool.begin().await.expect("tx");
    content::insert_post_version(
        &mut tx,
        id,
        Some("title"),
        None,
        "ordered by the graph",
        None,
        Some(order(2, 0)),
        at(10),
    )
    .await
    .expect("landed edit");
    tx.commit().await.expect("commit");

    sqlx::query(
        "INSERT INTO post_versions (post_id, title, content, pending, created_at)
         VALUES ($1, 'title', 'legacy', FALSE, $2)",
    )
    .bind(id)
    .bind(at(20))
    .execute(&pool)
    .await
    .expect("legacy row");

    let rendered = content::post(&pool, id)
        .await
        .expect("read")
        .expect("the post is there");
    assert_eq!(
        rendered.content, "ordered by the graph",
        "a timestamp cannot outrank a landing position"
    );
}
