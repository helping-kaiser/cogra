//! `Query.search` and the finder over the one matcher (api-spec.md
//! "Search"; search-surface packet B1): what the index holds, how a
//! query matches it, the order and the keyset over it, the kind and
//! seen-list filters, and the three refusals.
//!
//! Content is seeded through the store's own writers, so the authoring
//! instants — the recency key — are chosen by the test; the database's
//! trigger keeps the index current behind every writer. A redaction has
//! no writer yet (the moderation slice writes it) and is seeded as a raw
//! tombstone, which the trigger follows like any other write. The
//! seen-list is written through its own verb, `markSeen`.

mod rig;

use api::ratelimit::RateLimitConfig;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::Family;
use common::l1::census::{LegRole, leg_params};
use common::l1::handshake::{EpochPackage, PublishedLeg, PublishedRecord};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::content::{self, LandingOrder};
use postgres_store::{genesis, hashtag, mirror};
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
    hasMorePeople
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

/// A person is found by their handle and by their display name by word —
/// every word, the last as a prefix — whatever the case typed. A
/// handle's words are split at its underscores. A fragment from inside a
/// word, of a handle or of a display name, finds no one: plain "enesis"
/// never finds @genesis, and `@` stays the deliberate handle cue (PR-93).
///
/// A handle and a display name match by word prefix, case-insensitively; a fragment inside a word finds no one.
/// ´claim:search:a-handle-and-a-display-name-match-by-word-prefix´
#[sqlx::test(migrations = "../../migrations")]
async fn search_matches_a_handle_and_a_display_name_by_word_prefix(pool: PgPool) {
    let rig = rig(pool);
    person(&rig.pool, "solarium", Some("Mira Coastline")).await;
    person(&rig.pool, "genesis", None).await;
    person(&rig.pool, "pixel_joiner", None).await;
    person(&rig.pool, "kel", None).await;

    for (typed, who) in [
        ("sol", "solarium"),
        ("SOL", "solarium"),
        ("Solarium", "solarium"),
        ("mira", "solarium"),
        ("COAST", "solarium"),
        ("mira coa", "solarium"),
        ("gen", "genesis"),
        ("GENESIS", "genesis"),
        ("pixel", "pixel_joiner"),
        ("joiner", "pixel_joiner"),
        ("pixel_jo", "pixel_joiner"),
        ("pixel jo", "pixel_joiner"),
    ] {
        let found = search(&rig, None, json!({ "query": typed })).await;
        assert_eq!(names(&found), vec![format!("User:{who}")], "for {typed:?}");
    }
    for missing in [
        "enesis",
        "nesis",
        "lariu",
        "um",
        "oiner",
        "xel",
        "solx",
        "line",
        "ira",
        "coast mir",
    ] {
        let found = search(&rig, None, json!({ "query": missing })).await;
        assert_eq!(names(&found), Vec::<String>::new(), "for {missing:?}");
    }
}

/// Plain text matches an author's display name by word prefix — no `@`
/// needed — and brings that person's posts, titled or untitled, after
/// the people section. A fragment inside a word finds neither.
///
/// A display-name word prefix finds the person and then every post they authored.
/// ´claim:search:a-display-name-match-brings-the-authors-posts´
#[sqlx::test(migrations = "../../migrations")]
async fn a_display_name_match_brings_the_authors_posts(pool: PgPool) {
    let rig = rig(pool);
    let genesis = person(&rig.pool, "founder", Some("Genesis Moderator")).await;
    let kel = person(&rig.pool, "kel", None).await;
    post(&rig.pool, genesis, 1, Some("Rules of the road"), None, "x").await;
    let untitled = post(&rig.pool, genesis, 2, None, None, "Welcome, all").await;
    post(&rig.pool, kel, 3, Some("Salt maps"), None, "x").await;

    let found = search(&rig, None, json!({ "query": "Mod" })).await;
    let kinds: Vec<&str> = found["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|e| e["node"]["__typename"].as_str().expect("typename"))
        .collect();
    assert_eq!(kinds, vec!["User", "Post", "Post"]);
    assert_eq!(found["edges"][0]["node"]["handle"], "founder");
    assert_eq!(found["edges"][1]["node"]["id"], json!(untitled));
    assert_eq!(
        names(&found)[2],
        "Post:Rules of the road",
        "the content section reads newest first"
    );
    assert_eq!(found["totalCount"], 3);

    let missing = search(&rig, None, json!({ "query": "enesis" })).await;
    assert_eq!(names(&missing), Vec::<String>::new());
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
/// the sentinel match, and a query for "redacted" surfaces nothing.
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

    for typed in ["salt", "removed"] {
        let found = search(&rig, None, json!({ "query": typed })).await;
        assert_eq!(names(&found), Vec::<String>::new(), "for {typed:?}");
    }
}

/// A result is sectioned — people, then topics, then content — for every
/// query, so an exact-title post follows a partial-match person. Inside
/// a section exact matches lead, newest first among them; partial
/// matches follow, newest first.
///
/// Sections lead — people, topics, content — and inside each, exact matches precede partial ones, newest first.
/// ´claim:search:sections-then-exact-then-newest´
#[sqlx::test(migrations = "../../migrations")]
async fn sections_lead_then_exact_matches_then_newest_first(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    person(&rig.pool, "saltwife", None).await;
    person(&rig.pool, "salt", None).await;
    post(&rig.pool, sol, 1, Some("Salt"), None, "x").await;
    post(&rig.pool, sol, 2, Some("Salt maps"), None, "x").await;
    post(&rig.pool, sol, 3, Some("SALT"), None, "x").await;
    post(&rig.pool, sol, 4, Some("Coarse salt"), None, "x").await;
    tag(&rig.pool, "saltmarsh").await;
    tag(&rig.pool, "salt").await;

    let found = search(&rig, None, json!({ "query": "salt" })).await;
    let order = names(&found);
    assert_eq!(
        order,
        vec![
            "User:salt",
            "User:saltwife",
            "Hashtag:salt",
            "Hashtag:saltmarsh",
            "Post:SALT",
            "Post:Salt",
            "Post:Coarse salt",
            "Post:Salt maps",
        ]
    );
    assert_eq!(found["totalCount"], 8);
}

/// Walks every page of `variables` forward, one row a page, then every
/// page backward from the end, and returns both walks' names.
async fn walk_both_ways(rig: &WireRig, variables: Value) -> (Vec<String>, Vec<String>) {
    let mut forward = Vec::new();
    let mut after = Value::Null;
    loop {
        let mut page_vars = variables.clone();
        page_vars["first"] = json!(1);
        page_vars["after"] = after;
        let page = search(rig, None, page_vars).await;
        forward.extend(names(&page));
        if page["pageInfo"]["hasNextPage"] != true {
            break;
        }
        after = page["pageInfo"]["endCursor"].clone();
    }
    let mut backward = Vec::new();
    let mut before = Value::Null;
    loop {
        let mut page_vars = variables.clone();
        page_vars["last"] = json!(1);
        page_vars["before"] = before;
        let page = search(rig, None, page_vars).await;
        let mut chunk = names(&page);
        chunk.append(&mut backward);
        backward = chunk;
        if page["pageInfo"]["hasPreviousPage"] != true {
            break;
        }
        before = page["pageInfo"]["startCursor"].clone();
    }
    (forward, backward)
}

/// While a result can stand people beside another section, the people
/// section serves the first three people by the search's own order — the
/// exact handle first, then newest — and `hasMorePeople` opens the door:
/// the same query with people alone as its kind serves every match, with
/// no door of its own. The count follows what the pages serve, the cap
/// holds page by page in both directions, and a bare person cue is
/// capped the same way. Three people or fewer need no door.
///
/// The people section serves the first three people by the search's order, and the people-only kind serves them all.
/// ´claim:search:the-people-section-serves-its-first-three´
#[sqlx::test(migrations = "../../migrations")]
async fn the_people_section_serves_its_first_three(pool: PgPool) {
    let rig = rig(pool);
    for handle in ["saltwife", "salter", "salt", "saltmarsh", "salty"] {
        person(&rig.pool, handle, None).await;
    }
    let kel = person(&rig.pool, "kel", None).await;
    post(&rig.pool, kel, 1, Some("Salt maps"), None, "x").await;
    tag(&rig.pool, "salt").await;

    let people = search(&rig, None, json!({ "query": "salt", "kinds": ["USER"] })).await;
    let all_people = names(&people);
    assert_eq!(all_people.len(), 5);
    assert_eq!(all_people[0], "User:salt", "the exact handle leads");
    assert_eq!(people["hasMorePeople"], false);
    assert_eq!(people["totalCount"], 5);

    let found = search(&rig, None, json!({ "query": "salt" })).await;
    let mut expected = all_people[..3].to_vec();
    expected.extend(["Hashtag:salt".to_string(), "Post:Salt maps".to_string()]);
    assert_eq!(names(&found), expected);
    assert_eq!(found["hasMorePeople"], true);
    assert_eq!(found["totalCount"], 5);
    let (forward, backward) = walk_both_ways(&rig, json!({ "query": "salt" })).await;
    assert_eq!(forward, expected, "forward");
    assert_eq!(backward, expected, "backward");

    let cue = search(&rig, None, json!({ "query": "@salt" })).await;
    assert_eq!(names(&cue), all_people[..3].to_vec());
    assert_eq!(cue["hasMorePeople"], true);
    assert_eq!(cue["totalCount"], 3);

    let one = search(&rig, None, json!({ "query": "saltw" })).await;
    assert_eq!(names(&one), vec!["User:saltwife"]);
    assert_eq!(one["hasMorePeople"], false);
}

/// Walking every page forward, and every page backward from the end,
/// yields the one-shot order exactly: nothing repeated, nothing skipped,
/// ties on the instant broken by id — the posts share instants in pairs.
///
/// Search pages are stable and complete in both directions.
/// ´claim:search:pages-are-stable-and-complete´
#[sqlx::test(migrations = "../../migrations")]
async fn search_pages_are_stable_and_complete(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    for n in 0..23 {
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
    assert_eq!(all, vec!["User:saltor", "Hashtag:saltmaps", "Post:Salt"]);
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
    assert_eq!(tags, vec!["Hashtag:saltmaps", "Post:Salt"]);
}

/// A kind filter subtracts sections and keeps the rest's semantics: with
/// people filtered out, a display-name match still brings the authored
/// posts; with only people, just the profiles stand.
///
/// A kind filter drops sections and keeps the authored-content semantics.
/// ´claim:search:a-kind-filter-subtracts-sections´
#[sqlx::test(migrations = "../../migrations")]
async fn a_kind_filter_subtracts_sections_and_keeps_the_rest(pool: PgPool) {
    let rig = rig(pool);
    let mira = person(&rig.pool, "mira", Some("Mira Coastline")).await;
    post(&rig.pool, mira, 1, Some("Rubbings"), None, "x").await;

    let content = search(&rig, None, json!({ "query": "coast", "kinds": ["POST"] })).await;
    assert_eq!(names(&content), vec!["Post:Rubbings"]);
    assert_eq!(content["totalCount"], 1);
    let people = search(&rig, None, json!({ "query": "coast", "kinds": ["USER"] })).await;
    assert_eq!(names(&people), vec!["User:mira"]);
    let both = search(&rig, None, json!({ "query": "coast" })).await;
    assert_eq!(names(&both), vec!["User:mira", "Post:Rubbings"]);
}

/// Mark `content` seen through History's `markSeen`, in the session
/// `token` holds.
async fn seen(rig: &WireRig, token: &str, content: Uuid) {
    let marked = rig
        .gql(
            Some(token),
            "mutation($nodes: [UUID!]!) { markSeen(input: { nodes: $nodes }) { ok } }",
            json!({ "nodes": [content] }),
        )
        .await;
    assert_eq!(marked["markSeen"]["ok"], true, "{marked}");
}

/// With a session, `includeSeen: false` drops what the viewer has seen
/// — wherever they saw it — and the default keeps it.
///
/// includeSeen false drops the nodes on the viewer's seen-list, and the default keeps them.
/// ´claim:search:include-seen-false-drops-seen-nodes´
#[sqlx::test(migrations = "../../migrations")]
async fn include_seen_false_drops_seen_nodes(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("reader", "reader@example.test").await;
    let token = rig.log_in("reader@example.test").await;
    let sol = person(&rig.pool, "saltine", None).await;
    let read = post(&rig.pool, sol, 1, Some("Salt read"), None, "x").await;
    post(&rig.pool, sol, 2, Some("Salt fresh"), None, "x").await;
    seen(&rig, &token, read).await;
    seen(&rig, &token, sol).await;

    let kept = search(&rig, Some(&token), json!({ "query": "salt" })).await;
    assert_eq!(
        names(&kept),
        vec!["User:saltine", "Post:Salt fresh", "Post:Salt read"]
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
/// The three newest are seen, so a client-side filter would serve two.
///
/// The seen-list exclusion keeps page sizes whole.
/// ´claim:search:include-seen-false-keeps-page-sizes´
#[sqlx::test(migrations = "../../migrations")]
async fn include_seen_false_keeps_page_sizes(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("reader", "reader@example.test").await;
    let token = rig.log_in("reader@example.test").await;
    let sol = person(&rig.pool, "sol", None).await;
    let mut posts = Vec::new();
    for n in 0..10 {
        posts.push(post(&rig.pool, sol, n, Some(&format!("Salt {n}")), None, "x").await);
    }
    for id in &posts[7..] {
        seen(&rig, &token, *id).await;
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
    rig.seed_member("reader", "reader@example.test").await;
    let token = rig.log_in("reader@example.test").await;
    let sol = person(&rig.pool, "sol", None).await;
    let read = post(&rig.pool, sol, 1, Some("Salt"), None, "x").await;
    seen(&rig, &token, read).await;

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

/// A cursor this matcher did not issue — garbage, or another
/// connection's landing-order cursor — is a malformed argument, coded
/// BAD_INPUT at the transport.
///
/// A malformed search cursor is BAD_INPUT.
/// ´claim:search:a-malformed-cursor-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn search_with_a_malformed_cursor_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let records_cursor = B64.encode("1:0:0");
    for cursor in ["not a cursor", records_cursor.as_str()] {
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
/// so a keyless account never does, though search itself returns it as
/// `user(handle:)` resolves it.
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
/// the same word never: a topic is tagged, not referenced. A leading `@`
/// narrows to people, and a query past the cap is a miss, never an error.
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

    let people = rig
        .gql(None, REFERENCE_CANDIDATES, json!({ "query": "@coast" }))
        .await;
    assert_eq!(people["referenceCandidates"], json!([]));
    let long = rig
        .gql(
            None,
            REFERENCE_CANDIDATES,
            json!({ "query": "c".repeat(api::search::MAX_QUERY_CHARS + 1) }),
        )
        .await;
    assert_eq!(long["referenceCandidates"], json!([]));
}

/// A person's address atom — `addr-<handle>`, the realization address
/// [`person`] gives them.
///
/// The scoped branch's fixtures (search-surface B2; design digest item
/// 21) mint content under its author's atom, as the seal mints it: a
/// topic read tells a content's own author from its identifier, and
/// "carries" is exactly that author's current claim. Claims land through
/// the mirror's own ingestion, rendered through the census as the seal
/// renders them.
fn atom(handle: &str) -> String {
    format!("addr-{handle}")
}

/// The identifier of `handle`'s `seq`th minted publish.
fn minted(handle: &str, seq: u64) -> NodeId {
    NodeId::Mint(ActId::new(&atom(handle), seq, Family::Publish).expect("act id"))
}

/// A landed post minted as `node`, authored at `secs`.
async fn post_as(
    pool: &PgPool,
    author: Uuid,
    node: &NodeId,
    secs: i64,
    title: Option<&str>,
) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_post(
        &mut tx,
        id,
        author,
        &node.to_string(),
        "a=0;o=0",
        Some(landed(secs)),
        at(secs),
        title,
        None,
        "a body about salt",
        None,
    )
    .await
    .expect("post");
    tx.commit().await.expect("commit");
    id
}

/// A landed comment minted as `node`, answering `target` (a post or a
/// comment), authored at `secs`.
async fn comment_as(
    pool: &PgPool,
    author: Uuid,
    node: &NodeId,
    target: (Uuid, &str),
    secs: i64,
) -> Uuid {
    let id = Uuid::new_v4();
    let mut tx = pool.begin().await.expect("tx");
    content::insert_comment(
        &mut tx,
        id,
        target.0,
        target.1,
        author,
        &node.to_string(),
        "a=0;o=0",
        Some(landed(secs)),
        at(secs),
        "salt words in a comment body",
        None,
    )
    .await
    .expect("comment");
    tx.commit().await.expect("commit");
    id
}

/// Lands, as epoch `epoch` — the mirror's first is 0 — `handle`'s Tag
/// claim (act `seq`) that `node` carries `name` at `relevance`: the A-leg
/// into the content and the transposed T-leg out of it, as the seal
/// renders a Tag.
async fn claim(
    pool: &PgPool,
    epoch: i64,
    handle: &str,
    seq: u64,
    node: &NodeId,
    name: &str,
    relevance: f64,
) {
    tag(pool, name).await;
    let author = atom(handle);
    let (a_pd, a_pi) = leg_params(LegRole::A, relevance, 1.0);
    let (t_pd, t_pi) = leg_params(LegRole::T, relevance, 1.0);
    let record = PublishedRecord {
        act_id: ActId::new(&author, seq, Family::Tag).expect("act id"),
        author: author.clone(),
        family: Family::Tag,
        epoch,
        act_time: epoch,
        position: 0,
        payload_marked: false,
        payload_witness: vec![0; 32],
        legs: vec![
            PublishedLeg {
                role: LegRole::A,
                source: NodeId::Addr(author.clone()),
                target: node.clone(),
                p_d: a_pd,
                p_i: a_pi,
                tau: 0.0,
            },
            PublishedLeg {
                role: LegRole::T,
                source: node.clone(),
                target: NodeId::name(name).expect("type name"),
                p_d: t_pd,
                p_i: t_pi,
                tau: 0.0,
            },
        ],
    };
    mirror::ingest_epoch(
        pool,
        &EpochPackage {
            epoch,
            attested_at: chrono::Utc::now(),
            records: vec![record],
        },
    )
    .await
    .expect("ingests");
}

const SCOPED: &str = r#"query($query: String!, $kinds: [NodeKind!], $includeSeen: Boolean,
                               $first: Int, $after: String, $last: Int, $before: String) {
  search(query: $query, kinds: $kinds, includeSeen: $includeSeen,
         first: $first, after: $after, last: $last, before: $before) {
    edges {
      node {
        __typename
        ... on Post { id title { value } }
        ... on Comment { id content { value } }
        ... on User { id handle }
        ... on Hashtag { name { value } }
      }
    }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    totalCount
  }
}"#;

async fn scoped(rig: &WireRig, token: Option<&str>, variables: Value) -> Value {
    let response = rig.gql_raw(token, SCOPED, variables.clone()).await;
    assert!(response.get("errors").is_none(), "{variables}: {response}");
    response["data"]["search"].clone()
}

/// What each edge is, in order: `Post:<title>`, `Comment:<id>`,
/// `User:<handle>`, `Hashtag:<name>`.
fn hits(connection: &Value) -> Vec<String> {
    connection["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|edge| {
            let node = &edge["node"];
            let kind = node["__typename"].as_str().expect("typename");
            let name = match kind {
                "Post" => node["title"]["value"].as_str().map(str::to_string),
                "Comment" => node["id"].as_str().map(str::to_string),
                "User" => node["handle"].as_str().map(str::to_string),
                "Hashtag" => node["name"]["value"].as_str().map(str::to_string),
                _ => None,
            }
            .unwrap_or_else(|| "?".to_string());
            format!("{kind}:{name}")
        })
        .collect()
}

fn as_comment(id: Uuid) -> String {
    format!("Comment:{id}")
}

/// `@handle <text>` searches one person's work: their posts by title,
/// and their comments through the title of the post each answers — not
/// another person's comment on the same post, and not their comment on a
/// post whose title misses.
///
/// A handle scope finds the person's posts by title and their comments through the post's title.
/// ´claim:search:a-handle-scope-finds-their-comments-through-the-post-title´
#[sqlx::test(migrations = "../../migrations")]
async fn a_handle_scoped_query_finds_their_comments_through_the_post_title(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let kel = person(&rig.pool, "kel", None).await;
    let flats = post_as(
        &rig.pool,
        kel,
        &minted("kel", 1),
        1,
        Some("Salt flats at first light"),
    )
    .await;
    let rubbing = post_as(&rig.pool, kel, &minted("kel", 2), 2, Some("A rubbing")).await;
    post_as(
        &rig.pool,
        sol,
        &minted("sol", 1),
        3,
        Some("Salt maps of the coast road"),
    )
    .await;
    let on_flats = comment_as(&rig.pool, sol, &minted("sol", 2), (flats, "post"), 4).await;
    comment_as(&rig.pool, sol, &minted("sol", 3), (rubbing, "post"), 5).await;
    comment_as(&rig.pool, kel, &minted("kel", 3), (flats, "post"), 6).await;

    let found = scoped(&rig, None, json!({ "query": "@sol salt" })).await;
    assert_eq!(
        hits(&found),
        vec![
            as_comment(on_flats),
            "Post:Salt maps of the coast road".to_string()
        ]
    );
    assert_eq!(found["totalCount"], 2);
    let typed = scoped(&rig, None, json!({ "query": "  @SOL   flats at fi " })).await;
    assert_eq!(hits(&typed), vec![as_comment(on_flats)]);
    let only_comments = scoped(
        &rig,
        None,
        json!({ "query": "@sol salt", "kinds": ["COMMENT"] }),
    )
    .await;
    assert_eq!(hits(&only_comments), vec![as_comment(on_flats)]);
    assert_eq!(only_comments["totalCount"], 1);
}

/// An untitled post holds no title word, so a comment answering it has
/// nothing to be found through — under any text, its body's included.
///
/// A comment on an untitled post is never found through it.
/// ´claim:search:a-comment-on-an-untitled-post-is-not-found-through-it´
#[sqlx::test(migrations = "../../migrations")]
async fn a_comment_on_an_untitled_post_is_not_found_through_it(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let kel = person(&rig.pool, "kel", None).await;
    let untitled = post(&rig.pool, kel, 1, None, None, "Salt flats at first light").await;
    comment_as(&rig.pool, sol, &minted("sol", 1), (untitled, "post"), 2).await;

    for typed in ["@sol salt", "@sol flats", "@sol comment", "@sol body"] {
        let found = scoped(&rig, None, json!({ "query": typed })).await;
        assert_eq!(hits(&found), Vec::<String>::new(), "for {typed:?}");
        assert_eq!(found["totalCount"], 0);
    }
}

/// `#tag <text>` reaches what carries the topic — posts and comments
/// whose own author's current claim names it — and the text narrows
/// them by title. A post that carries another topic, or carries this one
/// with a title that misses, is not reached.
///
/// A topic scope reaches the posts and comments that carry the topic.
/// ´claim:search:a-tag-scope-reaches-what-carries-the-tag´
#[sqlx::test(migrations = "../../migrations")]
async fn a_tag_scoped_query_finds_what_carries_the_tag(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let kel = person(&rig.pool, "kel", None).await;
    let carried = minted("sol", 1);
    post_as(
        &rig.pool,
        sol,
        &carried,
        1,
        Some("Salt maps of the coast road"),
    )
    .await;
    let elsewhere = minted("kel", 1);
    post_as(&rig.pool, kel, &elsewhere, 2, Some("Salt flats")).await;
    let off_title = minted("kel", 2);
    post_as(&rig.pool, kel, &off_title, 3, Some("Coast road rubbings")).await;
    post_as(&rig.pool, kel, &minted("kel", 3), 4, Some("Salt untagged")).await;
    claim(&rig.pool, 0, "sol", 10, &carried, "saltmaps", 0.8).await;
    claim(&rig.pool, 1, "kel", 10, &elsewhere, "tides", 0.8).await;
    claim(&rig.pool, 2, "kel", 11, &off_title, "saltmaps", 0.8).await;

    let found = scoped(&rig, None, json!({ "query": "#saltmaps salt" })).await;
    assert_eq!(hits(&found), vec!["Post:Salt maps of the coast road"]);
    let both = scoped(&rig, None, json!({ "query": "#SaltMaps coast" })).await;
    assert_eq!(
        hits(&both),
        vec![
            "Post:Coast road rubbings",
            "Post:Salt maps of the coast road"
        ]
    );
    assert_eq!(both["totalCount"], 2);
    let no_tags = scoped(
        &rig,
        None,
        json!({ "query": "#saltmaps salt", "kinds": ["HASHTAG", "USER"] }),
    )
    .await;
    assert_eq!(hits(&no_tags), Vec::<String>::new());
    let unknown = scoped(&rig, None, json!({ "query": "#nosuchtag salt" })).await;
    assert_eq!(hits(&unknown), Vec::<String>::new());
    let illegal = scoped(&rig, None, json!({ "query": "##saltmaps salt" })).await;
    assert_eq!(hits(&illegal), Vec::<String>::new());
}

/// A comment that carries the topic is reached through the title of the
/// post it answers — and a reply through its thread root's title.
///
/// A topic scope matches a carried comment through its thread root's title.
/// ´claim:search:a-tag-scope-matches-a-carried-comments-target-title´
#[sqlx::test(migrations = "../../migrations")]
async fn a_tag_scoped_query_matches_a_carried_comments_target_title(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let kel = person(&rig.pool, "kel", None).await;
    let flats = post_as(
        &rig.pool,
        kel,
        &minted("kel", 1),
        1,
        Some("Salt flats at first light"),
    )
    .await;
    let top = minted("sol", 1);
    let top_id = comment_as(&rig.pool, sol, &top, (flats, "post"), 2).await;
    let reply = minted("kel", 2);
    let reply_id = comment_as(&rig.pool, kel, &reply, (top_id, "comment"), 3).await;
    claim(&rig.pool, 0, "sol", 10, &top, "saltmaps", 0.5).await;
    claim(&rig.pool, 1, "kel", 10, &reply, "saltmaps", 0.5).await;

    let found = scoped(&rig, None, json!({ "query": "#saltmaps flats" })).await;
    assert_eq!(hits(&found), vec![as_comment(reply_id), as_comment(top_id)]);
    let miss = scoped(&rig, None, json!({ "query": "#saltmaps rubbing" })).await;
    assert_eq!(hits(&miss), Vec::<String>::new());
}

/// "Carries" is the content's own author's current claim. A comment on
/// a post that carries the topic does not carry it; neither does content
/// a stranger tagged, nor content whose author withdrew the claim
/// (re-tagged at relevance 0).
///
/// Only the content's own author's current claim carries a topic.
/// ´claim:search:only-the-authors-current-claim-carries´
#[sqlx::test(migrations = "../../migrations")]
async fn a_comment_on_a_tagged_post_that_does_not_carry_the_tag_is_not_reached(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let kel = person(&rig.pool, "kel", None).await;
    let tagged = minted("sol", 1);
    let tagged_id = post_as(&rig.pool, sol, &tagged, 1, Some("Salt maps")).await;
    let on_it = minted("kel", 1);
    comment_as(&rig.pool, kel, &on_it, (tagged_id, "post"), 2).await;
    let strangers = minted("kel", 2);
    post_as(&rig.pool, kel, &strangers, 3, Some("Salt study")).await;
    let withdrawn = minted("kel", 3);
    post_as(&rig.pool, kel, &withdrawn, 4, Some("Salt withdrawn")).await;
    claim(&rig.pool, 0, "sol", 10, &tagged, "saltmaps", 0.9).await;
    claim(&rig.pool, 1, "sol", 11, &strangers, "saltmaps", 0.9).await;
    claim(&rig.pool, 2, "kel", 10, &withdrawn, "saltmaps", 0.9).await;
    claim(&rig.pool, 3, "kel", 11, &withdrawn, "saltmaps", 0.0).await;

    let found = scoped(&rig, None, json!({ "query": "#saltmaps salt" })).await;
    assert_eq!(hits(&found), vec!["Post:Salt maps"]);
    assert_eq!(found["totalCount"], 1);
}

/// `@handle <text>` also returns the topics the person tagged their own
/// content with, matched by name — not a topic only a stranger tagged
/// their content with, not one they tagged a stranger's content with,
/// not one they withdrew, not one whose name misses.
///
/// A handle scope returns the topics the person tagged their own content with.
/// ´claim:search:a-handle-scope-returns-the-tags-they-tagged-with´
#[sqlx::test(migrations = "../../migrations")]
async fn a_handle_scoped_query_returns_the_tags_they_tagged_with(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let kel = person(&rig.pool, "kel", None).await;
    let own = minted("sol", 1);
    post_as(&rig.pool, sol, &own, 1, Some("Rubbings")).await;
    let strangers = minted("kel", 1);
    post_as(&rig.pool, kel, &strangers, 2, Some("Wax charts")).await;
    claim(&rig.pool, 0, "sol", 10, &own, "saltmaps", 0.7).await;
    claim(&rig.pool, 1, "sol", 11, &own, "salty", 0.7).await;
    claim(&rig.pool, 2, "sol", 12, &own, "salty", 0.0).await;
    claim(&rig.pool, 3, "kel", 10, &own, "saltpans", 0.7).await;
    claim(&rig.pool, 4, "sol", 13, &own, "tides", 0.7).await;
    claim(&rig.pool, 5, "sol", 14, &strangers, "saltflats", 0.7).await;
    tag(&rig.pool, "saltmarsh").await;

    let found = scoped(&rig, None, json!({ "query": "@sol salt" })).await;
    assert_eq!(hits(&found), vec!["Hashtag:saltmaps"]);
    let exact = scoped(
        &rig,
        None,
        json!({ "query": "@sol tides", "kinds": ["HASHTAG"] }),
    )
    .await;
    assert_eq!(hits(&exact), vec!["Hashtag:tides"]);
    let unscoped = scoped(
        &rig,
        None,
        json!({ "query": "#saltmaps salt", "kinds": ["HASHTAG"] }),
    )
    .await;
    assert_eq!(
        hits(&unscoped),
        Vec::<String>::new(),
        "a topic scope serves no topics"
    );
}

/// A bare `@x` names the people whose handle starts with what was typed
/// — by handle alone, never by a display name or a substring, and never
/// needing the full handle. The exact handle leads. A lone `@` names no
/// one; with nothing they authored, the profiles are the whole result,
/// and a filter that excludes people leaves nothing.
///
/// A bare person cue lists the profiles whose handle starts with the cue.
/// ´claim:search:a-bare-person-cue-lists-profiles-by-handle-prefix´
#[sqlx::test(migrations = "../../migrations")]
async fn a_bare_person_cue_lists_profiles_by_handle_prefix(pool: PgPool) {
    let rig = rig(pool);
    person(&rig.pool, "solarium", None).await;
    person(&rig.pool, "sol", None).await;
    person(&rig.pool, "parasol", None).await;
    person(&rig.pool, "kel", Some("Sol Brine")).await;
    let keyless = Uuid::new_v4();
    sqlx::query("INSERT INTO actors (id, kind, handle) VALUES ($1, 'user', 'solace')")
        .bind(keyless)
        .execute(&rig.pool)
        .await
        .expect("keyless");

    let found = scoped(&rig, None, json!({ "query": "@sol" })).await;
    let mut proposed = hits(&found);
    assert_eq!(proposed.remove(0), "User:sol", "the exact handle leads");
    proposed.sort();
    assert_eq!(proposed, vec!["User:solace", "User:solarium"]);
    assert_eq!(found["totalCount"], 3);
    let short = scoped(&rig, None, json!({ "query": "@S" })).await;
    assert_eq!(hits(&short).len(), 3);
    for nothing in ["@", "@solx", "@sol_", "@brine"] {
        let found = scoped(&rig, None, json!({ "query": nothing })).await;
        assert_eq!(hits(&found), Vec::<String>::new(), "for {nothing:?}");
    }
    let filtered = scoped(
        &rig,
        None,
        json!({ "query": "@sol", "kinds": ["POST", "HASHTAG"] }),
    )
    .await;
    assert_eq!(hits(&filtered), Vec::<String>::new());
    let people = scoped(&rig, None, json!({ "query": "@sol", "kinds": ["USER"] })).await;
    assert_eq!(hits(&people).len(), 3);
}

/// A bare `#x` names the topics whose name starts with what was typed —
/// by prefix only, the exact name first.
///
/// A bare topic cue lists the topics whose name starts with the cue.
/// ´claim:search:a-bare-topic-cue-lists-topics-by-name-prefix´
#[sqlx::test(migrations = "../../migrations")]
async fn a_bare_topic_cue_lists_topics_by_name_prefix(pool: PgPool) {
    let rig = rig(pool);
    tag(&rig.pool, "saltmaps").await;
    tag(&rig.pool, "salt").await;
    tag(&rig.pool, "rocksalt").await;
    tag(&rig.pool, "tides").await;

    let found = scoped(&rig, None, json!({ "query": "#SALT" })).await;
    assert_eq!(hits(&found), vec!["Hashtag:salt", "Hashtag:saltmaps"]);
    assert_eq!(found["totalCount"], 2);
    for nothing in ["#", "#altm", "#salt%", "##salt"] {
        let found = scoped(&rig, None, json!({ "query": nothing })).await;
        assert_eq!(hits(&found), Vec::<String>::new(), "for {nothing:?}");
    }
    let filtered = scoped(&rig, None, json!({ "query": "#salt", "kinds": ["USER"] })).await;
    assert_eq!(hits(&filtered), Vec::<String>::new());
}

/// A bare `@x` lists the matching profiles first, then everything the
/// matches reach — the topics they tagged their own content with, then
/// their posts (untitled ones included) and comments, newest first — no
/// second word required, and a prefix of the handle is enough. Another
/// person's content stays out. A filter that excludes people keeps the
/// authored content; one that keeps only people keeps just the profiles.
///
/// A bare person cue lists the matching profiles, then everything they authored.
/// ´claim:search:a-bare-person-cue-lists-profiles-then-their-content´
#[sqlx::test(migrations = "../../migrations")]
async fn a_bare_person_cue_lists_profiles_then_their_content(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "solarium", None).await;
    let kel = person(&rig.pool, "kel", None).await;
    let carried = minted("solarium", 1);
    let titled = post_as(&rig.pool, sol, &carried, 1, Some("Rubbings")).await;
    let comment = comment_as(&rig.pool, sol, &minted("solarium", 2), (titled, "post"), 2).await;
    let untitled = post_as(&rig.pool, sol, &minted("solarium", 3), 3, None).await;
    post_as(&rig.pool, kel, &minted("kel", 1), 4, Some("Solar charts")).await;
    claim(&rig.pool, 0, "solarium", 10, &carried, "saltmaps", 0.9).await;

    let ids = |connection: &Value| -> Vec<String> {
        connection["edges"]
            .as_array()
            .expect("edges")
            .iter()
            .map(|e| {
                let node = &e["node"];
                match node["__typename"].as_str().expect("typename") {
                    "Hashtag" => {
                        format!("Hashtag:{}", node["name"]["value"].as_str().expect("name"))
                    }
                    kind => format!("{kind}:{}", node["id"].as_str().expect("id")),
                }
            })
            .collect()
    };
    let everything = vec![
        format!("User:{sol}"),
        "Hashtag:saltmaps".to_string(),
        format!("Post:{untitled}"),
        format!("Comment:{comment}"),
        format!("Post:{titled}"),
    ];
    let found = scoped(&rig, None, json!({ "query": "@sol" })).await;
    assert_eq!(ids(&found), everything);
    assert_eq!(found["totalCount"], 5);

    let content = scoped(
        &rig,
        None,
        json!({ "query": "@so", "kinds": ["POST", "COMMENT"] }),
    )
    .await;
    assert_eq!(ids(&content), everything[2..].to_vec());
    let people = scoped(&rig, None, json!({ "query": "@SO", "kinds": ["USER"] })).await;
    assert_eq!(ids(&people), vec![format!("User:{sol}")]);
}

/// A bare `#x` lists the matching topics first, then the posts and
/// comments that carry any of them — by the content's own author's
/// current claim — newest first. Content carrying another topic stays
/// out.
///
/// A bare topic cue lists the matching topics, then what carries them.
/// ´claim:search:a-bare-topic-cue-lists-topics-then-what-carries-them´
#[sqlx::test(migrations = "../../migrations")]
async fn a_bare_topic_cue_lists_topics_then_what_carries_them(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let kel = person(&rig.pool, "kel", None).await;
    let maps = minted("sol", 1);
    post_as(&rig.pool, sol, &maps, 1, Some("Rubbings")).await;
    let pans = minted("kel", 1);
    post_as(&rig.pool, kel, &pans, 2, None).await;
    let tides = minted("kel", 2);
    post_as(&rig.pool, kel, &tides, 3, Some("Salt tides")).await;
    claim(&rig.pool, 0, "sol", 10, &maps, "saltmaps", 0.9).await;
    claim(&rig.pool, 1, "kel", 10, &pans, "saltpans", 0.9).await;
    claim(&rig.pool, 2, "kel", 11, &tides, "tides", 0.9).await;

    let found = scoped(&rig, None, json!({ "query": "#salt" })).await;
    let mut order = hits(&found);
    assert_eq!(order.len(), 4, "{order:?}");
    order[..2].sort();
    assert_eq!(order[..2], ["Hashtag:saltmaps", "Hashtag:saltpans"]);
    let content_ids: Vec<&Value> = found["edges"].as_array().expect("edges")[2..]
        .iter()
        .map(|e| &e["node"]["id"])
        .collect();
    let pans_id: Uuid = sqlx::query_scalar("SELECT id FROM posts WHERE l1_node_id = $1")
        .bind(pans.to_string())
        .fetch_one(&rig.pool)
        .await
        .expect("pans");
    assert_eq!(
        content_ids[0],
        &json!(pans_id),
        "newest first: the untitled post"
    );
    assert_eq!(order[3], "Post:Rubbings");
    assert_eq!(found["totalCount"], 4);
    let content = scoped(&rig, None, json!({ "query": "#salt", "kinds": ["POST"] })).await;
    assert_eq!(hits(&content).len(), 2);
    assert_eq!(content["totalCount"], 2);
}

/// A reply has no title and answers a comment that has none either: it
/// is found through the title of the post its thread answers, however
/// deep the reply sits.
///
/// A reply under a handle scope is found through its thread root's title.
/// ´claim:search:a-reply-is-found-through-its-thread-roots-title´
#[sqlx::test(migrations = "../../migrations")]
async fn a_reply_under_a_handle_scope_is_found_through_its_thread_roots_title(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let kel = person(&rig.pool, "kel", None).await;
    let root = post_as(
        &rig.pool,
        kel,
        &minted("kel", 1),
        1,
        Some("Salt flats at first light"),
    )
    .await;
    let top = comment_as(&rig.pool, kel, &minted("kel", 2), (root, "post"), 2).await;
    let reply = comment_as(&rig.pool, sol, &minted("sol", 1), (top, "comment"), 3).await;
    let deeper = comment_as(&rig.pool, kel, &minted("kel", 3), (reply, "comment"), 4).await;
    let deepest = comment_as(&rig.pool, sol, &minted("sol", 2), (deeper, "comment"), 5).await;

    let found = scoped(&rig, None, json!({ "query": "@sol flats" })).await;
    assert_eq!(hits(&found), vec![as_comment(deepest), as_comment(reply)]);
    let words = scoped(&rig, None, json!({ "query": "@sol comment body" })).await;
    assert_eq!(
        hits(&words),
        Vec::<String>::new(),
        "bodies are never matched"
    );
}

/// A cue that names no one — no handle starts with it, it holds a
/// character no handle can, or the only handles it would name are
/// redacted — reaches nothing: the search reads empty, never an error.
///
/// An unknown handle scope with text reads empty.
/// ´claim:search:an-unknown-handle-scope-reads-empty´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unknown_handle_scope_with_text_reads_empty(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    post_as(&rig.pool, sol, &minted("sol", 1), 1, Some("Salt maps")).await;
    sqlx::query(
        "INSERT INTO actor_profile_versions
             (actor_id, display_name, redaction_reason, landed_epoch, act_time, position)
         VALUES ($1, '[redacted]', 'policy', 99, 99, 0)",
    )
    .bind(sol)
    .execute(&rig.pool)
    .await
    .expect("tombstone");

    for typed in [
        "@nobody salt",
        "@so salt",
        "@s!l salt",
        "@sol salt",
        "@ salt",
    ] {
        let found = scoped(&rig, None, json!({ "query": typed })).await;
        assert_eq!(hits(&found), Vec::<String>::new(), "for {typed:?}");
        assert_eq!(found["totalCount"], 0);
    }
}

/// `@sol <text>` searches sol's work and never returns sol's own row —
/// even when the text is sol's handle or display name.
///
/// A handle scope with text returns no row for the person it names.
/// ´claim:search:a-handle-scope-returns-no-profile-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_handle_scope_with_text_returns_no_profile_row(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", Some("Sol Brine")).await;
    person(&rig.pool, "solarium", None).await;
    post_as(
        &rig.pool,
        sol,
        &minted("sol", 1),
        1,
        Some("Sol at the brine pans"),
    )
    .await;

    for typed in ["@sol sol", "@sol brine", "@sol solarium"] {
        let found = scoped(&rig, None, json!({ "query": typed })).await;
        assert!(
            hits(&found).iter().all(|h| !h.starts_with("User:")),
            "for {typed:?}: {found}"
        );
    }
    let post_only = scoped(&rig, None, json!({ "query": "@sol brine" })).await;
    assert_eq!(hits(&post_only), vec!["Post:Sol at the brine pans"]);
    let users = scoped(
        &rig,
        None,
        json!({ "query": "@sol sol", "kinds": ["USER"] }),
    )
    .await;
    assert_eq!(hits(&users), Vec::<String>::new());
}

/// A cue search keeps the matcher's order and keyset: the topics
/// section first, then content — exact title first, then newest first
/// across posts and comments alike; every page forward and backward
/// yields the one-shot order; the seen exclusion applies inside a cue
/// too.
///
/// Scoped pages keep the matcher's order and are stable in both directions.
/// ´claim:search:scoped-pages-are-stable-and-complete´
#[sqlx::test(migrations = "../../migrations")]
async fn scoped_pages_are_stable_and_complete(pool: PgPool) {
    let rig = rig(pool);
    rig.seed_member("reader", "reader@example.test").await;
    let token = rig.log_in("reader@example.test").await;
    let sol = person(&rig.pool, "sol", None).await;
    let kel = person(&rig.pool, "kel", None).await;
    let exact = post_as(&rig.pool, kel, &minted("kel", 1), 0, Some("Salt")).await;
    let mut seq = 1;
    let mut comments = Vec::new();
    for n in 0..7 {
        seq += 1;
        post_as(
            &rig.pool,
            sol,
            &minted("sol", seq),
            n,
            Some(&format!("Salt study {n}")),
        )
        .await;
        seq += 1;
        comments.push(comment_as(&rig.pool, sol, &minted("sol", seq), (exact, "post"), n).await);
    }
    let tagged = minted("sol", 99);
    post_as(&rig.pool, sol, &tagged, 50, Some("Rubbings")).await;
    claim(&rig.pool, 0, "sol", 200, &tagged, "saltmaps", 0.9).await;

    let whole = scoped(&rig, None, json!({ "query": "@sol salt", "first": 100 })).await;
    let expected = hits(&whole);
    assert_eq!(expected.len(), 15);
    assert_eq!(expected[0], "Hashtag:saltmaps", "the topics section leads");
    assert!(
        expected[1..8].iter().all(|h| h.starts_with("Comment:")),
        "exact-title comments lead the content: {expected:?}"
    );
    assert_eq!(whole["totalCount"], 15);

    let mut walked = Vec::new();
    let mut after = Value::Null;
    loop {
        let page = scoped(
            &rig,
            None,
            json!({ "query": "@sol salt", "first": 4, "after": after }),
        )
        .await;
        walked.extend(hits(&page));
        if page["pageInfo"]["hasNextPage"] != true {
            break;
        }
        after = page["pageInfo"]["endCursor"].clone();
    }
    assert_eq!(walked, expected, "forward");
    let mut back = Vec::new();
    let mut before = Value::Null;
    loop {
        let page = scoped(
            &rig,
            None,
            json!({ "query": "@sol salt", "last": 4, "before": before }),
        )
        .await;
        let mut chunk = hits(&page);
        chunk.append(&mut back);
        back = chunk;
        if page["pageInfo"]["hasPreviousPage"] != true {
            break;
        }
        before = page["pageInfo"]["startCursor"].clone();
    }
    assert_eq!(back, expected, "backward");

    let seen_comment = comments[3];
    seen(&rig, &token, seen_comment).await;
    let unseen = scoped(
        &rig,
        Some(&token),
        json!({ "query": "@sol salt", "first": 100, "includeSeen": false }),
    )
    .await;
    assert_eq!(unseen["totalCount"], 14);
    assert!(!hits(&unseen).contains(&as_comment(seen_comment)));
}

/// A removed comment's current version is a tombstone: it is never found
/// under a scope, though the post it answered still is.
///
/// A redacted comment is never found under a scope.
/// ´claim:search:a-removed-comment-is-never-found-under-a-scope´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removed_comment_is_never_found_under_a_scope(pool: PgPool) {
    let rig = rig(pool);
    let sol = person(&rig.pool, "sol", None).await;
    let flats = post_as(&rig.pool, sol, &minted("sol", 1), 1, Some("Salt flats")).await;
    let removed = comment_as(&rig.pool, sol, &minted("sol", 2), (flats, "post"), 2).await;
    sqlx::query(
        "INSERT INTO comment_versions
             (comment_id, content, redaction_reason, pending, created_at,
              landed_epoch, act_time, position)
         VALUES ($1, '[removed]', 'policy', FALSE, $2, 9, 9, 0)",
    )
    .bind(removed)
    .bind(at(9))
    .execute(&rig.pool)
    .await
    .expect("tombstone");

    let found = scoped(&rig, None, json!({ "query": "@sol salt" })).await;
    assert_eq!(hits(&found), vec!["Post:Salt flats"]);
}

/// A claim still in flight carries its topic for the viewer who staged
/// it, as on the tag page — and for no one else.
///
/// The viewer's own in-flight claim carries a topic for them alone.
/// ´claim:search:an-own-pending-claim-carries-for-its-author-alone´
#[sqlx::test(migrations = "../../migrations")]
async fn a_viewers_own_pending_tag_carries_for_them_alone(pool: PgPool) {
    let rig = rig(pool);
    let (reader, _) = rig.seed_member("reader", "reader@example.test").await;
    let token = rig.log_in("reader@example.test").await;
    let address: String =
        sqlx::query_scalar("SELECT realization_address FROM actors WHERE id = $1")
            .bind(reader)
            .fetch_one(&rig.pool)
            .await
            .expect("address");
    let node = NodeId::Mint(ActId::new(&address, 1, Family::Publish).expect("act id"));
    post_as(&rig.pool, reader, &node, 1, Some("Salt maps")).await;
    tag(&rig.pool, "saltmaps").await;
    sqlx::query(
        "INSERT INTO staged_writes
             (id, actor_id, act_id, author, seq, family, middle, target,
              p_d, p_i, payload, prepared_epoch, state, pre_signed_at)
         VALUES ($1, $2, $3, $4, 7, 'tag', $5, 'name:saltmaps', 0.9, 1.0, ''::bytea, 0,
                 'awaiting_approval', NOW())",
    )
    .bind(Uuid::new_v4())
    .bind(reader)
    .bind(format!("act:{address}:7:tag"))
    .bind(&address)
    .bind(node.to_string())
    .execute(&rig.pool)
    .await
    .expect("staged tag");

    let own = scoped(&rig, Some(&token), json!({ "query": "#saltmaps salt" })).await;
    assert_eq!(hits(&own), vec!["Post:Salt maps"]);
    assert_eq!(own["totalCount"], 1);
    let anonymous = scoped(&rig, None, json!({ "query": "#saltmaps salt" })).await;
    assert_eq!(hits(&anonymous), Vec::<String>::new());
}
