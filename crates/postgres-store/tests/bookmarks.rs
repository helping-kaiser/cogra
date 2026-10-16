//! The Saved list's store (data-model.md "Personal frontend state";
//! `postgres_store::bookmarks`): once per node, a genuine delete, the
//! restored time, the keyset tie-break and the registry-read kind.
//! Requires Postgres (`make up`).

use postgres_store::bookmarks::{self, BookmarkCursor, SaveOutcome};
use postgres_store::content::{self, LandingOrder};
use postgres_store::{genesis, hashtag};
use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

fn at(secs: i64) -> Timestamp {
    chrono::DateTime::from_timestamp(1_800_000_000 + secs, 0).expect("in range")
}

async fn person(pool: &PgPool, handle: &str) -> Uuid {
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
    .expect("actor");
    id
}

async fn post(pool: &PgPool, author: Uuid, title: &str) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post(
        &mut tx,
        id,
        author,
        &format!("mint:act:{id}:0:publish"),
        "a=0;o=0",
        Some(LandingOrder {
            landed_epoch: 1,
            act_time: 1,
            position: 0,
        }),
        at(1),
        Some(title),
        None,
        "x",
        None,
    )
    .await
    .expect("post");
    tx.commit().await.expect("commit");
    id
}

async fn kept(pool: &PgPool, viewer: Uuid, id: Uuid, when: Option<Timestamp>) -> Timestamp {
    match bookmarks::set_bookmark(pool, viewer, id, when)
        .await
        .expect("save")
    {
        SaveOutcome::Kept(b) => b.bookmarked_at,
        other => panic!("not kept: {other:?}"),
    }
}

async fn list(pool: &PgPool, viewer: Uuid) -> Vec<Uuid> {
    bookmarks::bookmarks(pool, viewer, &bookmarks::every_kind(), None, false, 100)
        .await
        .expect("read")
        .into_iter()
        .map(|b| b.content_id)
        .collect()
}

/// Later saves stand above earlier ones, whatever the things' own ages.
///
/// The Saved list reads newest first by save time.
/// ´claim:bookmarks:newest-first-by-save-time´
#[sqlx::test(migrations = "../../migrations")]
async fn bookmarks_read_newest_first_by_save_time(pool: PgPool) {
    let viewer = person(&pool, "reader").await;
    let sol = person(&pool, "sol").await;
    let a = post(&pool, sol, "A").await;
    let b = post(&pool, sol, "B").await;
    kept(&pool, viewer, b, Some(at(10))).await;
    kept(&pool, viewer, a, Some(at(20))).await;
    kept(&pool, viewer, sol, Some(at(15))).await;
    assert_eq!(list(&pool, viewer).await, vec![a, sol, b]);
    assert_eq!(
        bookmarks::count_bookmarks(&pool, viewer, &bookmarks::every_kind())
            .await
            .expect("count"),
        3
    );
}

/// Saving a kept node changes nothing: it keeps its first save time.
///
/// A second save keeps the first time.
/// ´claim:bookmarks:a-second-save-keeps-the-first-time´
#[sqlx::test(migrations = "../../migrations")]
async fn saving_a_kept_node_keeps_its_first_time(pool: PgPool) {
    let viewer = person(&pool, "reader").await;
    let sol = person(&pool, "sol").await;
    let p = post(&pool, sol, "P").await;
    let first = kept(&pool, viewer, p, Some(at(5))).await;
    let again = kept(&pool, viewer, p, Some(at(50))).await;
    let bare = kept(&pool, viewer, p, None).await;
    assert_eq!(first, at(5));
    assert_eq!(again, first);
    assert_eq!(bare, first);
    assert_eq!(list(&pool, viewer).await, vec![p]);
}

/// An unsave deletes the row outright.
///
/// Removing a bookmark deletes its row.
/// ´claim:bookmarks:removing-deletes-the-row´
#[sqlx::test(migrations = "../../migrations")]
async fn removing_deletes_the_row(pool: PgPool) {
    let viewer = person(&pool, "reader").await;
    let sol = person(&pool, "sol").await;
    let p = post(&pool, sol, "P").await;
    kept(&pool, viewer, p, None).await;
    assert!(
        bookmarks::remove_bookmark(&pool, viewer, p)
            .await
            .expect("remove")
    );
    let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM user_bookmarks")
        .fetch_one(&pool)
        .await
        .expect("count");
    assert_eq!(rows, 0);
}

/// Dropping a node that is not kept is no fault and touches nothing.
///
/// Removing an absent bookmark is a no-op.
/// ´claim:bookmarks:removing-an-absent-row-is-a-no-op´
#[sqlx::test(migrations = "../../migrations")]
async fn removing_an_absent_row_is_a_no_op(pool: PgPool) {
    let viewer = person(&pool, "reader").await;
    let sol = person(&pool, "sol").await;
    let p = post(&pool, sol, "P").await;
    let other = post(&pool, sol, "Other").await;
    kept(&pool, viewer, other, None).await;
    assert!(
        !bookmarks::remove_bookmark(&pool, viewer, p)
            .await
            .expect("remove")
    );
    assert_eq!(list(&pool, viewer).await, vec![other]);
}

/// An Undo passes the removed row's own time back, and the row returns
/// between the same neighbours.
///
/// A restored bookmark returns to its place.
/// ´claim:bookmarks:a-restored-row-returns-to-its-place´
#[sqlx::test(migrations = "../../migrations")]
async fn a_restored_row_returns_to_its_place(pool: PgPool) {
    let viewer = person(&pool, "reader").await;
    let sol = person(&pool, "sol").await;
    let a = post(&pool, sol, "A").await;
    let b = post(&pool, sol, "B").await;
    let c = post(&pool, sol, "C").await;
    kept(&pool, viewer, a, Some(at(1))).await;
    let b_at = kept(&pool, viewer, b, Some(at(2))).await;
    kept(&pool, viewer, c, Some(at(3))).await;
    bookmarks::remove_bookmark(&pool, viewer, b)
        .await
        .expect("remove");
    assert_eq!(list(&pool, viewer).await, vec![c, a]);
    kept(&pool, viewer, b, Some(b_at)).await;
    assert_eq!(list(&pool, viewer).await, vec![c, b, a]);
}

/// Two saves at one instant page by node id, so a page boundary between
/// them neither repeats nor skips either.
///
/// Equal save times page by node id.
/// ´claim:bookmarks:equal-save-times-page-by-node-id´
#[sqlx::test(migrations = "../../migrations")]
async fn equal_save_times_page_by_node_id(pool: PgPool) {
    let viewer = person(&pool, "reader").await;
    let sol = person(&pool, "sol").await;
    let mut ids = Vec::new();
    for n in 0..3 {
        let p = post(&pool, sol, &format!("P{n}")).await;
        kept(&pool, viewer, p, Some(at(7))).await;
        ids.push(p);
    }
    ids.sort();
    ids.reverse();
    let first = bookmarks::bookmarks(&pool, viewer, &bookmarks::every_kind(), None, false, 2)
        .await
        .expect("page");
    let cursor: BookmarkCursor = first.last().expect("row").cursor();
    let second = bookmarks::bookmarks(&pool, viewer, &bookmarks::every_kind(), Some(cursor), false, 2)
        .await
        .expect("page");
    let walked: Vec<Uuid> = first
        .iter()
        .chain(second.iter())
        .map(|b| b.content_id)
        .collect();
    assert_eq!(walked, ids);
}

/// The kind column is the registry's answer, whatever was saved.
///
/// A bookmark's kind comes from the registry.
/// ´claim:bookmarks:the-kind-comes-from-the-registry´
#[sqlx::test(migrations = "../../migrations")]
async fn the_kind_comes_from_the_registry(pool: PgPool) {
    let viewer = person(&pool, "reader").await;
    let sol = person(&pool, "sol").await;
    let p = post(&pool, sol, "P").await;
    let c = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_comment(
        &mut tx,
        c,
        p,
        "post",
        sol,
        &format!("mint:act:{c}:0:review"),
        "a=0;o=0",
        None,
        at(2),
        "words",
        None,
    )
    .await
    .expect("comment");
    tx.commit().await.expect("commit");
    for id in [p, c, sol] {
        kept(&pool, viewer, id, None).await;
    }
    let mut kinds: Vec<(Uuid, String)> =
        sqlx::query_as("SELECT content_id, kind FROM user_bookmarks WHERE user_id = $1")
            .bind(viewer)
            .fetch_all(&pool)
            .await
            .expect("rows");
    kinds.sort();
    let mut expected = vec![
        (p, "post".to_string()),
        (c, "comment".to_string()),
        (sol, "user".to_string()),
    ];
    expected.sort();
    assert_eq!(kinds, expected);

    let mut conn = pool.acquire().await.expect("conn");
    hashtag::upsert(&mut conn, "saltmaps").await.expect("tag");
    drop(conn);
    assert_eq!(
        bookmarks::set_bookmark(&pool, viewer, common::hashtag_uuid("saltmaps"), None)
            .await
            .expect("save"),
        SaveOutcome::NotSaveable
    );
    assert_eq!(
        bookmarks::set_bookmark(&pool, viewer, Uuid::new_v4(), None)
            .await
            .expect("save"),
        SaveOutcome::Unknown
    );
}

/// The table itself refuses a kind Saved does not hold.
///
/// A topic kind is refused by the table.
/// ´claim:bookmarks:a-topic-kind-is-refused-by-the-table´
#[sqlx::test(migrations = "../../migrations")]
async fn a_topic_kind_is_refused_by_the_table(pool: PgPool) {
    let viewer = person(&pool, "reader").await;
    let refused = sqlx::query(
        "INSERT INTO user_bookmarks (user_id, content_id, kind) VALUES ($1, $2, 'hashtag')",
    )
    .bind(viewer)
    .bind(Uuid::new_v4())
    .execute(&pool)
    .await;
    assert!(refused.is_err());
}
