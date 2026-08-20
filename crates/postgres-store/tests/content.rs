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
        order,
        created_at,
        Some("title"),
        None,
        body,
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
        order,
        created_at,
        body,
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

#[sqlx::test(migrations = "../../migrations")]
async fn same_instant_pending_entries_paginate_without_loss(pool: PgPool) {
    let author = actor(&pool, "author").await;
    // Two pre-commitment signatures in the same microsecond: nothing
    // serializes two authors' signing apart, so the authoring instant
    // alone cannot key the walk.
    let one = post(&pool, author, None, at(0), "one").await;
    let two = post(&pool, author, None, at(0), "two").await;

    let all = page(&pool, None, 10).await;
    assert_eq!(all.len(), 2, "both pending entries are listed");

    // Walking one at a time must visit both — the exclusive cursor may
    // not swallow the sibling sharing its instant.
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

    // And the walk ends there, rather than looping on the tie.
    assert!(page(&pool, Some(cursor_of(&second[0])), 1).await.is_empty());
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_page_boundary_survives_the_entry_landing_under_it(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let old = post(&pool, author, Some(order(1, 0)), at(0), "landed-old").await;
    let new = post(&pool, author, Some(order(1, 1)), at(10), "landed-new").await;
    let pending_first = post(&pool, author, None, at(20), "p1").await;
    let pending_second = post(&pool, author, None, at(30), "p2").await;

    // Page one ends inside the pending set.
    let page1 = page(&pool, None, 2).await;
    assert_eq!(
        page1.iter().map(|p| p.id).collect::<Vec<_>>(),
        vec![pending_second, pending_first]
    );
    let boundary = cursor_of(&page1[1]);

    // Both pending entries land before the client asks for page two —
    // their keys move out of the pending namespace and into the landed
    // one, under the cursor the client is holding.
    let mut tx = pool.begin().await.expect("tx");
    content::land_post(&mut tx, pending_first, order(2, 0))
        .await
        .expect("lands");
    content::land_post(&mut tx, pending_second, order(2, 1))
        .await
        .expect("lands");
    tx.commit().await.expect("commit");

    // Page two resumes where the cursor's entry actually sits now, so it
    // serves the rest and nothing twice.
    let page2 = page(&pool, Some(boundary), 10).await;
    assert_eq!(
        page2.iter().map(|p| p.id).collect::<Vec<_>>(),
        vec![new, old],
        "an entry that landed between pages must not be served again"
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn landing_one_write_leaves_another_writes_pending_version(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let id = post(&pool, author, Some(order(1, 0)), at(0), "genesis").await;

    // Two unlanded edits sit on the node, each staged by its own write
    // and dated from its own pre-commitment.
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post_version(&mut tx, id, Some("title"), None, "first edit", true, at(10))
        .await
        .expect("first");
    content::insert_post_version(
        &mut tx,
        id,
        Some("title"),
        None,
        "second edit",
        true,
        at(20),
    )
    .await
    .expect("second");
    tx.commit().await.expect("commit");

    // Landing the earlier one drops its mark and only its mark.
    let mut tx = pool.begin().await.expect("tx");
    assert!(
        content::land_post_version(&mut tx, id, at(10))
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
    content::insert_post_version(&mut tx, id, Some("title"), None, "doomed", true, at(10))
        .await
        .expect("first");
    content::insert_post_version(&mut tx, id, Some("title"), None, "survivor", true, at(20))
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

#[sqlx::test(migrations = "../../migrations")]
async fn discarding_a_pending_post_takes_the_pending_thread_under_it(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let commenter = actor(&pool, "commenter").await;

    // A pending post, a pending comment on it, and a pending reply to
    // that comment: one thread, three staged writes, none landed.
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

    // Plus a comment that already landed on the pending post — ordered
    // fact, and not expiry's to remove.
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

    // The landed comment stays and reads as an orphan: its target is
    // gone, so `target` resolves to null (data-model.md "Content
    // nodes").
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
