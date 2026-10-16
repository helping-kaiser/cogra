//! The `search_index` projection follows its sources by trigger
//! (data-model.md "Search index"), against a live schema.
//!
//! Every write here is raw SQL that calls no store function, so what the
//! index shows afterwards is the trigger's work alone — the write path a
//! forgotten writer, a migration, or an operator's hand-run statement
//! takes. The redaction and removal cases are the guarantee the trigger
//! exists for: content that must vanish never stays findable.

use std::time::Duration;

use sqlx::PgPool;
use uuid::Uuid;

/// A node's index rows as (field, value), ordered by field.
async fn indexed(pool: &PgPool, node: Uuid) -> Vec<(String, String)> {
    sqlx::query_as("SELECT field, value FROM search_index WHERE node_id = $1 ORDER BY field")
        .bind(node)
        .fetch_all(pool)
        .await
        .expect("index rows")
}

fn row(field: &str, value: &str) -> (String, String) {
    (field.to_owned(), value.to_owned())
}

async fn run(pool: &PgPool, sql: &str, node: Uuid) {
    sqlx::query(sql)
        .bind(node)
        .execute(pool)
        .await
        .unwrap_or_else(|e| panic!("{sql}: {e}"));
}

/// A user actor and its first profile version, written raw.
async fn user(pool: &PgPool, handle: &str, display_name: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO actors (id, kind, handle) VALUES ($1, 'user', $2)")
        .bind(id)
        .bind(handle)
        .execute(pool)
        .await
        .expect("actor");
    sqlx::query("INSERT INTO actor_profile_versions (actor_id, display_name) VALUES ($1, $2)")
        .bind(id)
        .bind(display_name)
        .execute(pool)
        .await
        .expect("profile");
    id
}

/// A post and its first version, written raw.
async fn post(pool: &PgPool, author: Uuid, title: &str) -> Uuid {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO posts (id, author_id, l1_node_id) VALUES ($1, $2, 'raw:' || $1::text)",
    )
    .bind(id)
    .bind(author)
    .execute(pool)
    .await
    .expect("post");
    sqlx::query("INSERT INTO post_versions (post_id, title, content) VALUES ($1, $2, 'body')")
        .bind(id)
        .bind(title)
        .execute(pool)
        .await
        .expect("version");
    id
}

/// A registered topic, written raw.
async fn topic(pool: &PgPool, name: &str) -> Uuid {
    let id = common::hashtag_uuid(name);
    sqlx::query("INSERT INTO hashtags (id, name) VALUES ($1, $2)")
        .bind(id)
        .bind(name)
        .execute(pool)
        .await
        .expect("topic");
    id
}

/// Raw inserts of every source kind are indexed though no writer
/// refreshed anything.
///
/// A source written by raw SQL, through no store function, is indexed all the same.
/// ´claim:search:a-raw-write-is-indexed´
#[sqlx::test(migrations = "../../migrations")]
async fn a_raw_write_is_indexed_with_no_writer_refreshing(pool: PgPool) {
    let sol = user(&pool, "sol", "Sol Brine").await;
    let maps = post(&pool, sol, "Salt maps").await;
    let tide = topic(&pool, "tide").await;

    assert_eq!(
        indexed(&pool, sol).await,
        vec![row("display_name", "Sol Brine"), row("handle", "sol")]
    );
    assert_eq!(indexed(&pool, maps).await, vec![row("title", "Salt maps")]);
    assert_eq!(indexed(&pool, tide).await, vec![row("name", "tide")]);
}

/// A rename, a retitle in place, and a newer version appended all
/// replace the indexed value; the old one is gone.
///
/// A raw rename or retitle replaces the indexed value, and the old one stops matching.
/// ´claim:search:a-raw-rename-replaces-the-indexed-value´
#[sqlx::test(migrations = "../../migrations")]
async fn a_raw_rename_or_retitle_replaces_the_old_value(pool: PgPool) {
    let sol = user(&pool, "sol", "Sol Brine").await;
    let maps = post(&pool, sol, "Salt maps").await;

    run(
        &pool,
        "UPDATE actors SET handle = 'tidewater' WHERE id = $1",
        sol,
    )
    .await;
    assert_eq!(
        indexed(&pool, sol).await,
        vec![row("display_name", "Sol Brine"), row("handle", "tidewater")]
    );

    run(
        &pool,
        "UPDATE post_versions SET title = 'Tide charts' WHERE post_id = $1",
        maps,
    )
    .await;
    assert_eq!(
        indexed(&pool, maps).await,
        vec![row("title", "Tide charts")]
    );

    run(
        &pool,
        "INSERT INTO post_versions (post_id, title, content, landed_epoch, act_time, position)
         VALUES ($1, 'Harbour lights', 'body', 5, 5, 0)",
        maps,
    )
    .await;
    assert_eq!(
        indexed(&pool, maps).await,
        vec![row("title", "Harbour lights")]
    );

    run(
        &pool,
        "UPDATE post_versions SET title = NULL WHERE post_id = $1 AND landed_epoch = 5",
        maps,
    )
    .await;
    assert_eq!(
        indexed(&pool, maps).await,
        vec![row("title", "")],
        "an untitled post keeps its row, with the empty title"
    );
}

/// Redaction appended as a tombstone, or set in place on the current
/// version, leaves the node no row — for a user, the handle goes with
/// the name.
///
/// A redacted current version, appended or set in place, leaves its node no row.
/// ´claim:search:a-redaction-takes-the-rows-away´
#[sqlx::test(migrations = "../../migrations")]
async fn a_redaction_takes_the_rows_away(pool: PgPool) {
    let sol = user(&pool, "sol", "Sol Brine").await;
    let kel = user(&pool, "kel", "Kel Marsh").await;
    let maps = post(&pool, sol, "Salt maps").await;
    let charts = post(&pool, sol, "Tide charts").await;

    run(
        &pool,
        "INSERT INTO post_versions
             (post_id, title, content, redaction_reason, landed_epoch, act_time, position)
         VALUES ($1, '[removed]', '[removed]', 'policy', 9, 9, 0)",
        maps,
    )
    .await;
    assert_eq!(indexed(&pool, maps).await, Vec::new(), "tombstone appended");

    run(
        &pool,
        "UPDATE post_versions SET redaction_reason = 'policy' WHERE post_id = $1",
        charts,
    )
    .await;
    assert_eq!(
        indexed(&pool, charts).await,
        Vec::new(),
        "redacted in place"
    );

    run(
        &pool,
        "UPDATE actor_profile_versions SET redaction_reason = 'policy' WHERE actor_id = $1",
        sol,
    )
    .await;
    assert_eq!(indexed(&pool, sol).await, Vec::new(), "a redacted account");
    assert_eq!(
        indexed(&pool, kel).await,
        vec![row("display_name", "Kel Marsh"), row("handle", "kel")],
        "a neighbour is untouched"
    );
}

/// Deleting a source row takes what it fed: a post's versions, the
/// post, a profile's versions (the name goes, the handle stays), the
/// actor, a topic.
///
/// A deleted source row takes the index rows it fed with it.
/// ´claim:search:a-removed-source-takes-the-rows-away´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removed_source_takes_the_rows_away(pool: PgPool) {
    let sol = user(&pool, "sol", "Sol Brine").await;
    let maps = post(&pool, sol, "Salt maps").await;
    let tide = topic(&pool, "tide").await;

    run(&pool, "DELETE FROM post_versions WHERE post_id = $1", maps).await;
    assert_eq!(indexed(&pool, maps).await, Vec::new(), "no version left");
    run(&pool, "DELETE FROM posts WHERE id = $1", maps).await;
    assert_eq!(indexed(&pool, maps).await, Vec::new(), "no post left");

    run(
        &pool,
        "DELETE FROM actor_profile_versions WHERE actor_id = $1",
        sol,
    )
    .await;
    assert_eq!(indexed(&pool, sol).await, vec![row("handle", "sol")]);
    run(&pool, "DELETE FROM actors WHERE id = $1", sol).await;
    assert_eq!(indexed(&pool, sol).await, Vec::new(), "no actor left");

    run(&pool, "DELETE FROM hashtags WHERE id = $1", tide).await;
    assert_eq!(indexed(&pool, tide).await, Vec::new(), "no topic left");
}

/// TRUNCATE fires no row-level trigger; the statement-level one empties
/// what the truncated table fed.
///
/// A truncated source leaves no index row behind.
/// ´claim:search:a-truncated-source-leaves-no-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_truncate_takes_the_rows_away(pool: PgPool) {
    let sol = user(&pool, "sol", "Sol Brine").await;
    let maps = post(&pool, sol, "Salt maps").await;
    let tide = topic(&pool, "tide").await;

    sqlx::query("TRUNCATE post_versions CASCADE")
        .execute(&pool)
        .await
        .expect("truncate versions");
    assert_eq!(indexed(&pool, maps).await, Vec::new());
    assert_eq!(indexed(&pool, sol).await.len(), 2, "users are untouched");

    sqlx::query("TRUNCATE actor_profile_versions")
        .execute(&pool)
        .await
        .expect("truncate profiles");
    assert_eq!(indexed(&pool, sol).await, vec![row("handle", "sol")]);

    sqlx::query("TRUNCATE hashtags CASCADE")
        .execute(&pool)
        .await
        .expect("truncate topics");
    assert_eq!(indexed(&pool, tide).await, Vec::new());
}

/// A redaction on one connection races a profile edit on another. Both
/// append a version row, so nothing in the source tables orders them —
/// the foreign-key checks share the actor row — and the edit holds its
/// re-derivation open while the redaction's waits. Once both commit,
/// neither name is findable: the redaction's re-derivation ran after the
/// edit committed and took the rows the edit wrote.
///
/// A redaction racing an edit on another connection leaves neither name findable.
/// ´claim:search:a-redaction-racing-an-edit-leaves-nothing´
#[sqlx::test(migrations = "../../migrations")]
async fn a_redaction_racing_an_edit_leaves_nothing_findable(pool: PgPool) {
    let sol = user(&pool, "sol", "Sol Brine").await;

    let mut edit = pool.begin().await.expect("edit tx");
    sqlx::query(
        "INSERT INTO actor_profile_versions (actor_id, display_name) VALUES ($1, 'Sol Salt')",
    )
    .bind(sol)
    .execute(&mut *edit)
    .await
    .expect("edit");

    let racing = pool.clone();
    let redaction = tokio::spawn(async move {
        let mut tx = racing.begin().await.expect("redaction tx");
        sqlx::query(
            "INSERT INTO actor_profile_versions
                 (actor_id, display_name, redaction_reason, landed_epoch, act_time, position)
             VALUES ($1, '[redacted]', 'policy', 99, 99, 0)",
        )
        .bind(sol)
        .execute(&mut *tx)
        .await
        .expect("tombstone");
        tx.commit().await.expect("redaction commit");
    });

    let mut waited = 0;
    loop {
        let blocked: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM pg_stat_activity
             WHERE datname = current_database() AND wait_event_type = 'Lock'",
        )
        .fetch_one(&pool)
        .await
        .expect("activity");
        if blocked > 0 {
            break;
        }
        waited += 1;
        assert!(waited < 500, "the redaction never waited on the edit");
        tokio::time::sleep(Duration::from_millis(10)).await;
    }

    edit.commit().await.expect("edit commit");
    redaction.await.expect("redaction task");

    assert_eq!(indexed(&pool, sol).await, Vec::new());
}
