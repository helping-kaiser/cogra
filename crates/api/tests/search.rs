//! `Query.search` and the finder over the one matcher (api-spec.md
//! "Search"; search-surface packet B1): what the index holds, how a
//! query matches it, the order and the keyset over it, the kind and
//! seen-list filters, and the three refusals.
//!
//! Content is seeded through the store's own writers, which keep the
//! index current, so the authoring instants — the recency key — are
//! chosen by the test. Two states have no writer yet and are seeded
//! around one: a redaction (the moderation slice writes it) is a raw
//! tombstone followed by the store's refresh, and the seen-list
//! (`markSeen` is History's) is a raw `user_view_log` row.

mod rig;

use api::ratelimit::RateLimitConfig;
use postgres_store::content::{self, LandingOrder};
use postgres_store::{genesis, hashtag, search as search_store};
use rig::WireRig;
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

type Timestamp = chrono::DateTime<chrono::Utc>;

const SEARCH: &str = r#"query($query: String!, $kinds: [NodeKind!], $includeSeen: Boolean,
                               $first: Int, $after: String, $last: Int, $before: String) {
  search(query: $query, kinds: $kinds, includeSeen: $includeSeen,
         first: $first, after: $after, last: $last, before: $before) {
    edges {
      cursor
      node {
        __typename
        ... on Post { id title { value } }
        ... on Comment { id }
        ... on User { id handle }
        ... on Hashtag { id name { value } }
      }
    }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    totalCount
  }
}"#;

const REFERENCE_CANDIDATES: &str = r#"query($query: String!, $limit: Int) {
  referenceCandidates(query: $query, limit: $limit) {
    targetId
    target {
      __typename
      ... on Post { id title { value } }
      ... on User { id handle }
    }
  }
}"#;

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

fn at(secs: i64) -> Timestamp {
    chrono::DateTime::from_timestamp(1_800_000_000 + secs, 0).expect("in range")
}

fn landed(secs: i64) -> LandingOrder {
    LandingOrder {
        landed_epoch: secs,
        act_time: secs,
        position: 0,
    }
}

/// A person with a key and, optionally, a display name.
async fn person(pool: &PgPool, handle: &str, display_name: Option<&str>) -> Uuid {
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
    if let Some(name) = display_name {
        genesis::insert_profile_version(&mut conn, id, name, Some("a bio about salt"))
            .await
            .expect("profile");
    }
    id
}

/// A landed post authored at `secs`.
async fn post(
    pool: &PgPool,
    author: Uuid,
    secs: i64,
    title: Option<&str>,
    description: Option<&str>,
    body: &str,
) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post(
        &mut tx,
        id,
        author,
        &format!("mint:act:{id}:0:publish"),
        "a=0;o=0",
        Some(landed(secs)),
        at(secs),
        title,
        description,
        body,
        None,
    )
    .await
    .expect("post");
    tx.commit().await.expect("commit");
    id
}

async fn tag(pool: &PgPool, name: &str) {
    let mut conn = pool.acquire().await.expect("conn");
    hashtag::upsert(&mut conn, name).await.expect("tag");
}

async fn search(rig: &WireRig, token: Option<&str>, variables: Value) -> Value {
    rig.gql(token, SEARCH, variables).await["search"].clone()
}

/// What each edge names, in order: a post's title, a person's handle, a
/// topic's name — each prefixed with its typename.
fn names(connection: &Value) -> Vec<String> {
    connection["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|edge| {
            let node = &edge["node"];
            let kind = node["__typename"].as_str().expect("typename");
            let name = match kind {
                "Post" => node["title"]["value"].as_str(),
                "User" => node["handle"].as_str(),
                "Hashtag" => node["name"]["value"].as_str(),
                _ => None,
            }
            .unwrap_or("?");
            format!("{kind}:{name}")
        })
        .collect()
}

fn codes(response: &Value) -> Vec<String> {
    response["errors"]
        .as_array()
        .map(|errors| {
            errors
                .iter()
                .map(|e| e["extensions"]["code"].as_str().unwrap_or("").to_string())
                .collect()
        })
        .unwrap_or_default()
}

/// A person is found by their handle and by their display name, by
/// prefix and by substring, whatever the case typed.
///
/// Handles and display names match case-insensitively by prefix and by substring.
/// ´claim:search:names-match-by-prefix-and-substring´
#[sqlx::test(migrations = "../../migrations")]
async fn search_matches_a_handle_and_a_display_name_by_prefix_and_substring(pool: PgPool) {
    let rig = rig(pool);
    person(&rig.pool, "solarium", Some("Mira Coastline")).await;
    person(&rig.pool, "kel", None).await;

    for typed in ["sol", "SOL", "lariu", "um", "mira", "COAST", "line"] {
        let found = search(&rig, None, json!({ "query": typed })).await;
        assert_eq!(names(&found), vec!["User:solarium"], "for {typed}");
    }
    let miss = search(&rig, None, json!({ "query": "solx" })).await;
    assert_eq!(names(&miss), Vec::<String>::new());
}

/// A topic is found by its name and served as the union's `Hashtag`
/// member — the type that is not a `Node`.
///
/// A registered topic is found by its name and served as a Hashtag.
/// ´claim:search:a-tag-is-found-by-its-name´
#[sqlx::test(migrations = "../../migrations")]
async fn search_finds_a_tag_by_its_name(pool: PgPool) {
    let rig = rig(pool);
    tag(&rig.pool, "saltmaps").await;

    let found = search(&rig, None, json!({ "query": "Maps" })).await;
    assert_eq!(names(&found), vec!["Hashtag:saltmaps"]);
    assert_eq!(found["edges"][0]["node"]["__typename"], "Hashtag");
    assert_eq!(
        found["edges"][0]["node"]["id"],
        json!(common::hashtag_uuid("saltmaps"))
    );
}

/// Titles match by word: every typed word is required, in any order,
/// and the last one matches as a prefix so a title refines as typed.
///
/// A title matches by its words, the last typed word as a prefix.
/// ´claim:search:titles-match-by-word-and-typed-prefix´
#[sqlx::test(migrations = "../../migrations")]
async fn search_matches_title_words_and_a_typed_prefix(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    post(
        &rig.pool,
        sol,
        1,
        Some("Salt maps of the coast road"),
        None,
        "x",
    )
    .await;

    for typed in ["coast", "Salt ma", "road coast", "the coa", "salt-maps"] {
        let found = search(&rig, None, json!({ "query": typed })).await;
        assert_eq!(
            names(&found),
            vec!["Post:Salt maps of the coast road"],
            "for {typed:?}"
        );
    }
    for missing in ["oast", "salt river", "maps x"] {
        let found = search(&rig, None, json!({ "query": missing })).await;
        assert_eq!(names(&found), Vec::<String>::new(), "for {missing:?}");
    }
}

/// Bodies, descriptions and bios are never indexed: words that appear
/// only there find nothing.
///
/// A body, a description or a bio never matches.
/// ´claim:search:never-a-body-a-description-or-a-bio´
#[sqlx::test(migrations = "../../migrations")]
async fn search_never_matches_a_body_a_description_or_a_bio(pool: PgPool) {
    let rig = rig(pool);
    // The person's bio reads "a bio about salt".
    let sol = person(&rig.pool, "sol", Some("Sol")).await;
    post(
        &rig.pool,
        sol,
        1,
        Some("Rubbings"),
        Some("brackish description"),
        "cartography body",
    )
    .await;

    for typed in ["brackish", "cartography", "bio", "about salt"] {
        let found = search(&rig, None, json!({ "query": typed })).await;
        assert_eq!(names(&found), Vec::<String>::new(), "for {typed:?}");
    }
}

/// An untitled words post wears its first line as a name, but that name
/// is display only: its body never matches.
///
/// An untitled words post is never matched, by its body or the first line it wears as a name.
/// ´claim:search:an-untitled-post-is-never-matched´
#[sqlx::test(migrations = "../../migrations")]
async fn an_untitled_words_post_is_never_matched_by_its_body(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    post(&rig.pool, sol, 1, None, None, "Salt flats at first light").await;
    post(&rig.pool, sol, 2, Some("   "), None, "Salt flats again").await;

    let found = search(
        &rig,
        None,
        json!({ "query": "salt flats", "kinds": ["POST"] }),
    )
    .await;
    assert_eq!(names(&found), Vec::<String>::new());
}

/// An untitled media post is named by its kind and author for display,
/// and its description is never indexed.
///
/// (´claim:search:an-untitled-post-is-never-matched´)
#[sqlx::test(migrations = "../../migrations")]
async fn an_untitled_media_post_is_never_matched_by_its_description(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    post(&rig.pool, sol, 1, None, Some("Tide charts in wax"), "").await;

    let found = search(&rig, None, json!({ "query": "tide", "kinds": ["POST"] })).await;
    assert_eq!(names(&found), Vec::<String>::new());
}

/// Only the current title matches: an edit retires the old one, and a
/// handle change retires the old handle.
///
/// Only a node's current value matches; a superseded title or handle no longer does.
/// ´claim:search:only-the-current-value-matches´
#[sqlx::test(migrations = "../../migrations")]
async fn a_superseded_title_no_longer_matches(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let id = post(&rig.pool, sol, 1, Some("First draft"), None, "x").await;
    let mut tx = rig.pool.begin().await.expect("tx");
    content::insert_post_version(
        &mut tx,
        id,
        Some("Salt study"),
        None,
        "x",
        None,
        Some(landed(5)),
        at(5),
    )
    .await
    .expect("edit");
    tx.commit().await.expect("commit");

    let old = search(&rig, None, json!({ "query": "draft" })).await;
    assert_eq!(names(&old), Vec::<String>::new());
    let new = search(&rig, None, json!({ "query": "study" })).await;
    assert_eq!(names(&new), vec!["Post:Salt study"]);

    assert!(
        postgres_store::auth::change_handle(&rig.pool, sol, "tidewater")
            .await
            .expect("rename")
    );
    let gone = search(&rig, None, json!({ "query": "sol" })).await;
    assert_eq!(names(&gone), Vec::<String>::new());
    let renamed = search(&rig, None, json!({ "query": "tide" })).await;
    assert_eq!(names(&renamed), vec!["User:tidewater"]);
}

/// A redacted account keeps a current value — the `redacted-user-…`
/// sentinel — so the index skips it by rule: neither its old names nor
/// the sentinel match, and a substring query for "redacted" surfaces
/// nothing.
///
/// A redacted handle or name never matches, the sentinel included.
/// ´claim:search:redacted-values-never-match´
#[sqlx::test(migrations = "../../migrations")]
async fn a_redacted_handle_never_matches_redacted(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", Some("Sol Brine")).await;
    person(&rig.pool, "kel", None).await;

    sqlx::query(
        "INSERT INTO actor_profile_versions
             (actor_id, display_name, redaction_reason, landed_epoch, act_time, position)
         VALUES ($1, '[redacted]', 'policy', 99, 99, 0)",
    )
    .bind(sol)
    .execute(&rig.pool)
    .await
    .expect("tombstone");
    sqlx::query("UPDATE actors SET handle = $2 WHERE id = $1")
        .bind(sol)
        .bind(format!("redacted-user-{sol}"))
        .execute(&rig.pool)
        .await
        .expect("sentinel");
    let mut conn = rig.pool.acquire().await.expect("conn");
    search_store::refresh_actors(&mut conn, &[sol])
        .await
        .expect("refresh");
    drop(conn);

    for typed in ["redacted", "sol", "brine", &sol.to_string()] {
        let found = search(&rig, None, json!({ "query": typed })).await;
        assert_eq!(names(&found), Vec::<String>::new(), "for {typed:?}");
    }
    let kel = search(&rig, None, json!({ "query": "kel" })).await;
    assert_eq!(names(&kel), vec!["User:kel"]);
}

/// A removed post's current version is a tombstone; its title no
/// longer matches, and neither does the tombstone's marker.
///
/// (´claim:search:redacted-values-never-match´)
#[sqlx::test(migrations = "../../migrations")]
async fn a_removed_posts_title_never_matches(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let id = post(&rig.pool, sol, 1, Some("Salt maps"), None, "x").await;
    sqlx::query(
        "INSERT INTO post_versions
             (post_id, title, content, redaction_reason, pending, created_at,
              landed_epoch, act_time, position)
         VALUES ($1, '[removed]', '[removed]', 'policy', FALSE, $2, 9, 9, 0)",
    )
    .bind(id)
    .bind(at(9))
    .execute(&rig.pool)
    .await
    .expect("tombstone");
    let mut conn = rig.pool.acquire().await.expect("conn");
    search_store::refresh_posts(&mut conn, &[id])
        .await
        .expect("refresh");
    drop(conn);

    for typed in ["salt", "removed"] {
        let found = search(&rig, None, json!({ "query": typed })).await;
        assert_eq!(names(&found), Vec::<String>::new(), "for {typed:?}");
    }
}

/// Exact matches lead, newest first among them; partial matches follow,
/// newest first. Kinds interleave by recency inside a tier.
///
/// Exact matches precede partial ones, and each tier reads newest first.
/// ´claim:search:exact-then-partial-then-newest´
#[sqlx::test(migrations = "../../migrations")]
async fn exact_matches_precede_partial_then_newest_first(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    post(&rig.pool, sol, 1, Some("Salt"), None, "x").await;
    post(&rig.pool, sol, 2, Some("Salt maps"), None, "x").await;
    post(&rig.pool, sol, 3, Some("SALT"), None, "x").await;
    post(&rig.pool, sol, 4, Some("Coarse salt"), None, "x").await;
    tag(&rig.pool, "salt").await;
    tag(&rig.pool, "saltmarsh").await;

    let found = search(&rig, None, json!({ "query": "salt" })).await;
    let order = names(&found);
    // The posts are dated ahead of the registry rows (written now, in
    // 2026), so within each tier the posts lead.
    assert_eq!(
        order,
        vec![
            "Post:SALT",
            "Post:Salt",
            "Hashtag:salt",
            "Post:Coarse salt",
            "Post:Salt maps",
            "Hashtag:saltmarsh",
        ]
    );
    assert_eq!(found["totalCount"], 6);
}

/// Walking every page forward, and every page backward from the end,
/// yields the one-shot order exactly: nothing repeated, nothing skipped,
/// ties on the instant broken by id.
///
/// Search pages are stable and complete in both directions.
/// ´claim:search:pages-are-stable-and-complete´
#[sqlx::test(migrations = "../../migrations")]
async fn search_pages_are_stable_and_complete(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    for n in 0..23 {
        // Pairs share an instant, so the id must break the tie.
        post(
            &rig.pool,
            sol,
            n / 2,
            Some(&format!("Salt study {n}")),
            None,
            "x",
        )
        .await;
    }
    post(&rig.pool, sol, 40, Some("salt"), None, "x").await;

    let ids = |connection: &Value| -> Vec<String> {
        connection["edges"]
            .as_array()
            .expect("edges")
            .iter()
            .map(|e| e["node"]["id"].as_str().expect("id").to_string())
            .collect()
    };
    let whole = search(&rig, None, json!({ "query": "salt", "first": 100 })).await;
    let expected = ids(&whole);
    assert_eq!(expected.len(), 24);
    assert_eq!(names(&whole)[0], "Post:salt", "the exact match leads");

    let mut walked = Vec::new();
    let mut after = Value::Null;
    loop {
        let page = search(
            &rig,
            None,
            json!({ "query": "salt", "first": 5, "after": after }),
        )
        .await;
        walked.extend(ids(&page));
        assert_eq!(page["totalCount"], 24);
        if page["pageInfo"]["hasNextPage"] != true {
            break;
        }
        after = page["pageInfo"]["endCursor"].clone();
    }
    assert_eq!(walked, expected, "forward");

    let mut back = Vec::new();
    let mut before = Value::Null;
    loop {
        let page = search(
            &rig,
            None,
            json!({ "query": "salt", "last": 5, "before": before }),
        )
        .await;
        let mut chunk = ids(&page);
        chunk.append(&mut back);
        back = chunk;
        if page["pageInfo"]["hasPreviousPage"] != true {
            break;
        }
        before = page["pageInfo"]["startCursor"].clone();
    }
    assert_eq!(back, expected, "backward");
}

/// COMMENT is a valid kind, served only under a scope: unscoped, it
/// contributes no rows and is no error — alone or beside other kinds.
///
/// An unscoped comment search reads empty, never an error.
/// ´claim:search:an-unscoped-comment-search-reads-empty´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unscoped_comment_search_reads_empty_not_an_error(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    post(&rig.pool, sol, 1, Some("Salt"), None, "x").await;

    let alone = search(&rig, None, json!({ "query": "salt", "kinds": ["COMMENT"] })).await;
    assert_eq!(names(&alone), Vec::<String>::new());
    assert_eq!(alone["totalCount"], 0);
    let mixed = search(
        &rig,
        None,
        json!({ "query": "salt", "kinds": ["COMMENT", "POST"] }),
    )
    .await;
    assert_eq!(names(&mixed), vec!["Post:Salt"]);
}

/// The kinds whose slices have not shipped read empty, never an error.
///
/// A kind whose slice has not shipped reads empty until it does.
/// ´claim:search:an-unbuilt-kind-reads-empty´
#[sqlx::test(migrations = "../../migrations")]
async fn a_chat_kind_reads_empty_until_its_slice(pool: PgPool) {
    let rig = rig(pool);
    person(&rig.pool, "salt", None).await;
    for kind in ["CHAT", "CHAT_MESSAGE", "COLLECTIVE", "ITEM", "OFFER"] {
        let found = search(&rig, None, json!({ "query": "salt", "kinds": [kind] })).await;
        assert_eq!(names(&found), Vec::<String>::new(), "for {kind}");
    }
}

/// An empty kind list narrows nothing — it reads as null — while a
/// named kind narrows to itself.
///
/// An empty kind list means the same as no kind list.
/// ´claim:search:an-empty-kind-list-narrows-nothing´
#[sqlx::test(migrations = "../../migrations")]
async fn an_empty_kind_list_narrows_nothing(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "saltor", None).await;
    post(&rig.pool, sol, 1, Some("Salt"), None, "x").await;
    tag(&rig.pool, "saltmaps").await;

    let all = names(&search(&rig, None, json!({ "query": "salt" })).await);
    assert_eq!(all.len(), 3);
    let empty = names(&search(&rig, None, json!({ "query": "salt", "kinds": [] })).await);
    assert_eq!(empty, all);
    let users = names(&search(&rig, None, json!({ "query": "salt", "kinds": ["USER"] })).await);
    assert_eq!(users, vec!["User:saltor"]);
    let tags = names(
        &search(
            &rig,
            None,
            json!({ "query": "salt", "kinds": ["HASHTAG", "POST"] }),
        )
        .await,
    );
    assert_eq!(tags, vec!["Post:Salt", "Hashtag:saltmaps"]);
}

/// Mark `content` seen by `viewer` — what History's `markSeen` will
/// write.
async fn seen(pool: &PgPool, viewer: Uuid, content: Uuid) {
    sqlx::query("INSERT INTO user_view_log (user_id, content_id) VALUES ($1, $2)")
        .bind(viewer)
        .bind(content)
        .execute(pool)
        .await
        .expect("seen");
}

/// With a session, `includeSeen: false` drops what the viewer has seen
/// — wherever they saw it — and the default keeps it.
///
/// includeSeen false drops the nodes on the viewer's seen-list, and the default keeps them.
/// ´claim:search:include-seen-false-drops-seen-nodes´
#[sqlx::test(migrations = "../../migrations")]
async fn include_seen_false_drops_seen_nodes(pool: PgPool) {
    let rig = rig(pool);
    let (reader, _) = rig.seed_member("reader", "reader@example.test").await;
    let token = rig.log_in("reader@example.test").await;
    let sol = person(&rig.pool, "saltine", None).await;
    let read = post(&rig.pool, sol, 1, Some("Salt read"), None, "x").await;
    post(&rig.pool, sol, 2, Some("Salt fresh"), None, "x").await;
    seen(&rig.pool, reader, read).await;
    seen(&rig.pool, reader, sol).await;

    let kept = search(&rig, Some(&token), json!({ "query": "salt" })).await;
    assert_eq!(
        names(&kept),
        vec!["Post:Salt fresh", "Post:Salt read", "User:saltine"]
    );
    let dropped = search(
        &rig,
        Some(&token),
        json!({ "query": "salt", "includeSeen": false }),
    )
    .await;
    assert_eq!(names(&dropped), vec!["Post:Salt fresh"]);
    assert_eq!(dropped["totalCount"], 1);
}

/// The exclusion runs server-side, so a page still carries as many
/// results as were asked for, and the next page picks up where it ended.
///
/// The seen-list exclusion keeps page sizes whole.
/// ´claim:search:include-seen-false-keeps-page-sizes´
#[sqlx::test(migrations = "../../migrations")]
async fn include_seen_false_keeps_page_sizes(pool: PgPool) {
    let rig = rig(pool);
    let (reader, _) = rig.seed_member("reader", "reader@example.test").await;
    let token = rig.log_in("reader@example.test").await;
    let sol = person(&rig.pool, "sol", None).await;
    let mut posts = Vec::new();
    for n in 0..10 {
        posts.push(post(&rig.pool, sol, n, Some(&format!("Salt {n}")), None, "x").await);
    }
    // The three newest are seen: a client-side filter would serve a
    // first page of two.
    for id in &posts[7..] {
        seen(&rig.pool, reader, *id).await;
    }

    let first = search(
        &rig,
        Some(&token),
        json!({ "query": "salt", "includeSeen": false, "first": 5 }),
    )
    .await;
    assert_eq!(
        names(&first),
        vec![
            "Post:Salt 6",
            "Post:Salt 5",
            "Post:Salt 4",
            "Post:Salt 3",
            "Post:Salt 2"
        ]
    );
    assert_eq!(first["pageInfo"]["hasNextPage"], true);
    let second = search(
        &rig,
        Some(&token),
        json!({ "query": "salt", "includeSeen": false, "first": 5,
                "after": first["pageInfo"]["endCursor"] }),
    )
    .await;
    assert_eq!(names(&second), vec!["Post:Salt 1", "Post:Salt 0"]);
    assert_eq!(second["pageInfo"]["hasNextPage"], false);
}

/// Without a session there is no seen-list to read: `includeSeen: false`
/// is ignored rather than refused.
///
/// includeSeen is ignored without a session.
/// ´claim:search:include-seen-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn include_seen_is_ignored_without_a_session(pool: PgPool) {
    let rig = rig(pool);
    let (reader, _) = rig.seed_member("reader", "reader@example.test").await;
    let sol = person(&rig.pool, "sol", None).await;
    let read = post(&rig.pool, sol, 1, Some("Salt"), None, "x").await;
    seen(&rig.pool, reader, read).await;

    let found = search(&rig, None, json!({ "query": "salt", "includeSeen": false })).await;
    assert_eq!(names(&found), vec!["Post:Salt"]);
}

/// A blank query is the field before anything is typed: an empty
/// connection, never an error.
///
/// A blank query reads empty, never an error.
/// ´claim:search:a-blank-query-reads-empty´
#[sqlx::test(migrations = "../../migrations")]
async fn a_blank_query_reads_empty_never_an_error(pool: PgPool) {
    let rig = rig(pool);
    person(&rig.pool, "sol", None).await;
    for typed in ["", "   ", "\t\n"] {
        let found = search(&rig, None, json!({ "query": typed })).await;
        assert_eq!(names(&found), Vec::<String>::new(), "for {typed:?}");
        assert_eq!(found["totalCount"], 0);
        assert_eq!(found["pageInfo"]["hasNextPage"], false);
    }
}

/// Search is a public read: an anonymous viewer gets what a signed-in
/// one does.
///
/// Search resolves for an anonymous viewer as for a signed-in one.
/// ´claim:search:search-is-a-public-read´
#[sqlx::test(migrations = "../../migrations")]
async fn search_resolves_for_an_anonymous_viewer(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("reader", "reader@example.test").await;
    let token = rig.log_in("reader@example.test").await;
    let sol = person(&rig.pool, "sol", None).await;
    post(&rig.pool, sol, 1, Some("Salt"), None, "x").await;

    let anonymous = search(&rig, None, json!({ "query": "salt" })).await;
    let signed_in = search(&rig, Some(&token), json!({ "query": "salt" })).await;
    assert_eq!(names(&anonymous), vec!["Post:Salt"]);
    assert_eq!(anonymous, signed_in);
}

/// A cursor this matcher did not issue is a malformed argument, coded
/// BAD_INPUT at the transport.
///
/// A malformed search cursor is BAD_INPUT.
/// ´claim:search:a-malformed-cursor-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn search_with_a_malformed_cursor_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let landing_order_cursor = "MTowOjA="; // "1:0:0", a records cursor
    for cursor in ["not a cursor", landing_order_cursor] {
        for (direction, arg) in [("after", "first"), ("before", "last")] {
            let refused = rig
                .gql_raw(
                    None,
                    SEARCH,
                    json!({ "query": "salt", arg: 5, direction: cursor }),
                )
                .await;
            assert_eq!(codes(&refused), vec!["BAD_INPUT"], "{refused}");
        }
    }
}

/// Paging both ways at once, or past the page cap, is a malformed
/// argument, coded BAD_INPUT at the transport.
///
/// Conflicting or over-cap page arguments on search are BAD_INPUT.
/// ´claim:search:conflicting-page-args-are-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn search_with_conflicting_page_args_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    for variables in [
        json!({ "query": "salt", "first": 5, "last": 5 }),
        json!({ "query": "salt", "first": 101 }),
        json!({ "query": "salt", "last": -1 }),
    ] {
        let refused = rig.gql_raw(None, SEARCH, variables.clone()).await;
        assert_eq!(codes(&refused), vec!["BAD_INPUT"], "{variables}: {refused}");
    }
}

/// A query past 640 characters is refused as BAD_INPUT; one at the cap
/// is served.
///
/// A query over 640 characters is BAD_INPUT, and one at the cap is served.
/// ´claim:search:an-over-long-query-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn search_with_an_over_long_query_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let at_cap = "s".repeat(api::search::MAX_QUERY_CHARS);
    let served = rig.gql_raw(None, SEARCH, json!({ "query": at_cap })).await;
    assert!(served.get("errors").is_none(), "{served}");

    let refused = rig
        .gql_raw(None, SEARCH, json!({ "query": format!("{at_cap}s") }))
        .await;
    assert_eq!(codes(&refused), vec!["BAD_INPUT"], "{refused}");
}

/// The finder rides the matcher: a person comes up by a prefix of their
/// handle, bare or `@`-sigilled — but only a person who can be cited,
/// so a keyless account never does.
///
/// The finder offers a person by a handle prefix, and never a keyless account.
/// ´claim:search:the-finder-offers-a-person-by-handle-prefix´
#[sqlx::test(migrations = "../../migrations")]
async fn the_finder_offers_a_person_by_handle_prefix(pool: PgPool) {
    let rig = rig(pool);
    let solarium = person(&rig.pool, "solarium", None).await;
    let keyless = Uuid::new_v4();
    sqlx::query("INSERT INTO actors (id, kind, handle) VALUES ($1, 'user', 'solace')")
        .bind(keyless)
        .execute(&rig.pool)
        .await
        .expect("keyless");
    let mut conn = rig.pool.acquire().await.expect("conn");
    search_store::refresh_actors(&mut conn, &[keyless])
        .await
        .expect("refresh");
    drop(conn);
    // The keyless account is a search result: search returns what
    // `user(handle:)` resolves.
    let searched = search(&rig, None, json!({ "query": "sol" })).await;
    assert_eq!(names(&searched).len(), 2);

    for typed in ["sol", "@sol", "  @SOLAR "] {
        let found = rig
            .gql(None, REFERENCE_CANDIDATES, json!({ "query": typed }))
            .await["referenceCandidates"]
            .clone();
        assert_eq!(
            found.as_array().expect("list").len(),
            1,
            "for {typed:?}: {found}"
        );
        assert_eq!(found[0]["targetId"], json!(solarium), "for {typed:?}");
        assert_eq!(found[0]["target"]["__typename"], "User");
    }
}

/// The finder offers a post by a word of its title, and a topic carrying
/// the same word never: a topic is tagged, not referenced.
///
/// The finder offers a post by a title word and never a topic.
/// ´claim:search:the-finder-offers-a-post-by-a-title-word´
#[sqlx::test(migrations = "../../migrations")]
async fn the_finder_offers_a_post_by_a_title_word(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let id = post(
        &rig.pool,
        sol,
        1,
        Some("Salt maps of the coast road"),
        None,
        "x",
    )
    .await;
    tag(&rig.pool, "coast").await;

    let found = rig
        .gql(None, REFERENCE_CANDIDATES, json!({ "query": "coast" }))
        .await["referenceCandidates"]
        .clone();
    assert_eq!(found.as_array().expect("list").len(), 1, "{found}");
    assert_eq!(found[0]["targetId"], json!(id));
    assert_eq!(found[0]["target"]["__typename"], "Post");

    // The sigil narrows to people: the post is no longer offered.
    let people = rig
        .gql(None, REFERENCE_CANDIDATES, json!({ "query": "@coast" }))
        .await;
    assert_eq!(people["referenceCandidates"], json!([]));
    // And a query past the cap is a miss, not an error — the finder
    // never refuses what it is typed.
    let long = rig
        .gql(
            None,
            REFERENCE_CANDIDATES,
            json!({ "query": "c".repeat(api::search::MAX_QUERY_CHARS + 1) }),
        )
        .await;
    assert_eq!(long["referenceCandidates"], json!([]));
}
