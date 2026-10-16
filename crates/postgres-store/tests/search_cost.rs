//! What the one search matcher's reads cost (api-spec.md "Search";
//! PR-98, the MVP law): each read an index exists to serve is explained
//! against a live schema seeded large enough that the planner has a real
//! choice — a handful of rows is always a sequential scan, whatever the
//! indexes say — and fails if the index it was built for goes unused.
//!
//! The statements are the matcher's own predicates written out with
//! literal values: the planner derives an index range from a `LIKE`
//! prefix or a `to_tsquery` only when it sees the pattern, which a
//! prepared statement's custom plan does and a literal stands in for.

use sqlx::PgPool;

async fn plan_of(pool: &PgPool, sql: &str) -> String {
    let rows: Vec<String> = sqlx::query_scalar(&format!("EXPLAIN {sql}"))
        .fetch_all(pool)
        .await
        .expect("explains");
    rows.join("\n")
}

/// 20 000 tag legs over 2 000 topic names, `name:t0` .. `name:t1999`.
async fn seed_tag_legs(pool: &PgPool) {
    sqlx::query(
        "INSERT INTO mirror_records
             (record_id, family, author, epoch, act_time, position,
              payload_marked, payload_witness)
         SELECT 'act:a' || (i % 400) || ':' || i || ':tag', 'tag',
                'a' || (i % 400), i / 100, i, i % 100, FALSE, ''::bytea
         FROM generate_series(1, 20000) AS i",
    )
    .execute(pool)
    .await
    .expect("seeds records");
    sqlx::query(
        "INSERT INTO mirror_record_legs
             (record_id, leg, source, target, p_d, p_i, domain,
              mask_a00, mask_a01, mask_a10, mask_a11, tier, tau,
              family, epoch, act_time, position)
         SELECT 'act:a' || (i % 400) || ':' || i || ':tag', 't',
                'mint:act:a' || (i % 400) || ':' || (i % 500) || ':publish',
                'name:t' || (i % 2000), 0.5, 0.5, 'epistemic',
                FALSE, TRUE, FALSE, TRUE, 'marginal', 0.0,
                'tag', i / 100, i, i % 100
         FROM generate_series(1, 20000) AS i",
    )
    .execute(pool)
    .await
    .expect("seeds legs");
    sqlx::query("ANALYZE mirror_records, mirror_record_legs")
        .execute(pool)
        .await
        .expect("analyzes");
}

/// A `#prefix` cue folds the tag legs whose target names a topic starting
/// with the cue. In a non-C collation no btree on `target` serves that
/// `LIKE`, so without the pattern-ops index the fold reads every tag leg;
/// with it, the prefix is a range scan over the legs it names.
///
/// The topic-prefix claim fold reads its legs through the pattern-ops index.
/// ´claim:search:the-topic-prefix-fold-uses-its-index´
#[sqlx::test(migrations = "../../migrations")]
async fn the_topic_prefix_fold_reads_through_its_index(pool: PgPool) {
    seed_tag_legs(&pool).await;

    let plan = plan_of(
        &pool,
        "SELECT l.source, r.author, l.target, l.p_i
         FROM mirror_record_legs l
         JOIN mirror_records r ON r.record_id = l.record_id
         WHERE l.leg = 't' AND l.family = 'tag'
           AND NOT r.payload_marked
           AND NOT l.census_unknown
           AND l.target LIKE 'name:' || 't123' || '%'",
    )
    .await;
    assert!(
        plan.contains("mirror_legs_tag_target_prefix_idx"),
        "the prefix fold does not read through its index:\n{plan}"
    );
}

/// 5 000 people with handles `h0` .. `h4999`, written raw; the index
/// follows by trigger.
async fn seed_people(pool: &PgPool) {
    sqlx::query(
        "INSERT INTO actors (id, kind, handle)
         SELECT gen_random_uuid(), 'user', 'h' || i
         FROM generate_series(0, 4999) AS i",
    )
    .execute(pool)
    .await
    .expect("seeds people");
    sqlx::query("ANALYZE search_index")
        .execute(pool)
        .await
        .expect("analyzes");
}

/// Plain text matches a handle by word prefix through the handle field's
/// own full-text index, never by scanning the index table.
///
/// A plain-text handle match reads through the handle field's full-text index.
/// ´claim:search:a-handle-word-match-uses-its-index´
#[sqlx::test(migrations = "../../migrations")]
async fn a_handle_word_match_reads_through_its_index(pool: PgPool) {
    seed_people(&pool).await;

    let plan = plan_of(
        &pool,
        "SELECT s.node_id
         FROM search_index s
         WHERE s.kind = 'user'
           AND s.field = 'handle'
           AND s.words @@ to_tsquery('simple', 'h123:*')",
    )
    .await;
    assert!(
        plan.contains("search_index_handles_fts"),
        "the handle match does not read through its index:\n{plan}"
    );
}
