//! Display-content store tests: the pending/landed boundary the listing
//! walks and the expiry path that clears it (data-model.md "Content
//! nodes"). These exercise the store functions directly, because a node
//! can carry the rows of more than one staged write and the API's own
//! serialization rules make that state hard to reach end to end — the
//! store's contract has to hold on its own.

use postgres_store::content::{self, LandingOrder};
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

/// A post entity row plus its first version, pending unless `order` is
/// given.
async fn post(
    pool: &PgPool,
    author: Uuid,
    node: &str,
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
        node,
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
/// is given.
async fn comment(
    pool: &PgPool,
    author: Uuid,
    target: Uuid,
    target_type: &str,
    node: &str,
    order: Option<LandingOrder>,
    created_at: Timestamp,
    body: &str,
) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_comment(
        &mut tx,
        id,
        target,
        target_type,
        author,
        node,
        order,
        created_at,
        body,
    )
    .await
    .expect("comment");
    tx.commit().await.expect("commit");
    id
}

async fn pending_versions(pool: &PgPool, post_id: Uuid) -> Vec<(Timestamp, bool)> {
    sqlx::query!(
        "SELECT created_at, pending FROM post_versions
         WHERE post_id = $1 ORDER BY created_at",
        post_id,
    )
    .fetch_all(pool)
    .await
    .expect("versions")
    .into_iter()
    .map(|r| (r.created_at, r.pending))
    .collect()
}

#[sqlx::test(migrations = "../../migrations")]
async fn landing_one_write_leaves_another_writes_pending_version(pool: PgPool) {
    let author = actor(&pool, "author").await;
    let id = post(
        &pool,
        author,
        "mint:act:author:1:publish",
        Some(order(1, 0)),
        at(0),
        "genesis",
    )
    .await;

    // Two unlanded edits sit on the node, each staged by its own write
    // and dated from its own pre-commitment.
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post_version(&mut tx, id, Some("title"), None, "first edit", true, at(10))
        .await
        .expect("first");
    content::insert_post_version(&mut tx, id, Some("title"), None, "second edit", true, at(20))
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
    let id = post(
        &pool,
        author,
        "mint:act:author:1:publish",
        Some(order(1, 0)),
        at(0),
        "genesis",
    )
    .await;
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
    let host = post(&pool, author, "mint:act:author:1:publish", None, at(0), "host").await;
    let reply = comment(
        &pool,
        commenter,
        host,
        "post",
        "mint:act:commenter:1:review",
        None,
        at(10),
        "on a pending post",
    )
    .await;
    let nested = comment(
        &pool,
        commenter,
        reply,
        "comment",
        "mint:act:commenter:2:review",
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
        "post",
        "mint:act:commenter:3:review",
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
        content::comment(&pool, reply).await.expect("read").is_none(),
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
    assert!(content::post(&pool, orphan.target_id).await.expect("read").is_none());
}
