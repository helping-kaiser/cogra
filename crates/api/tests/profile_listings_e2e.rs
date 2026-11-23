//! A profile's Posts and Comments views and its `Posts` figure, end to end
//! through the HTTP surface (api-spec.md "Pagination"; design
//! `ProfilePosts.md`, `ProfileComments.md`, `ProfileHeader`): every post or
//! comment the person signed is listed on every profile — a still-settling
//! one ahead of the landed ones, marked by its own landing state — and the
//! figure counts exactly what the Posts view lists, a removed post and a
//! still-settling one included, never an edit.

use common::l1::client::ActorKey;
use postgres_store::PgPool;
use serde_json::{Value, json};
use uuid::Uuid;

mod rig;
use rig::WireRig;

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) {
    node
    writes { id canonicalProposal }
    userErrors { code message field }
  }
}"#;

const PREPARE_POST_EDIT: &str = r#"mutation($input: PreparePostEditInput!) {
  preparePostEdit(input: $input) {
    node
    writes { id canonicalProposal }
    userErrors { code message field }
  }
}"#;

const PREPARE_COMMENT: &str = r#"mutation($input: PrepareCommentInput!) {
  prepareComment(input: $input) {
    node
    writes { id canonicalProposal }
    userErrors { code message field }
  }
}"#;

const REMOVE: &str = r#"mutation($input: RemoveContentInput!) {
  removeContent(input: $input) {
    records { id }
    userErrors { code message field }
  }
}"#;

const PROFILE_POSTS: &str = r#"query($id: UUID!) { user(id: $id) {
  posts(first: 10) {
    totalCount
    edges { node { id title { value } landing { state } removal { at } } }
  }
  settled: posts(first: 10, includePending: false) {
    totalCount
    edges { node { id } }
  }
} }"#;

const PROFILE_COMMENTS: &str = r#"query($id: UUID!) { user(id: $id) {
  comments(first: 10) {
    totalCount
    edges { node { id landing { state } post { id } } }
  }
  settled: comments(first: 10, includePending: false) {
    totalCount
    edges { node { id } }
  }
} }"#;

/// A seeded member, signed in.
struct Member {
    id: Uuid,
    key: ActorKey,
    token: String,
}

async fn member(rig: &WireRig, handle: &str) -> Member {
    let email = format!("{handle}@example.com");
    let (id, key) = rig.seed_member(handle, &email).await;
    let token = rig.log_in(&email).await;
    Member { id, key, token }
}

fn no_errors(payload: &Value) {
    assert_eq!(payload["userErrors"], json!([]), "refused: {payload}");
}

/// A post signed through both device legs but not yet ordered: it stays
/// still settling until the next epoch closes. Its node id.
async fn settling_post(rig: &WireRig, m: &Member, title: &str) -> String {
    let prepared = rig
        .gql(
            Some(&m.token),
            PREPARE_POST,
            json!({ "input": {
                "title": title,
                "content": "body",
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "pDirected": 0.1,
            }}),
        )
        .await;
    let payload = &prepared["preparePost"];
    no_errors(payload);
    rig.sign_prepared(&m.token, &m.key, &payload["writes"])
        .await;
    payload["node"].as_str().expect("node").to_string()
}

/// A post landed end to end. Its node id.
async fn landed_post(rig: &WireRig, m: &Member, title: &str) -> String {
    let id = settling_post(rig, m, title).await;
    rig.close_and_ingest().await;
    id
}

/// A comment signed but not yet ordered. Its node id.
async fn settling_comment(rig: &WireRig, m: &Member, target: &str) -> String {
    let prepared = rig
        .gql(
            Some(&m.token),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": target,
                "content": "a comment",
                "license": { "attribution": 0.0, "provenance": 0.0 },
                "pDirected": 0.1,
                "pInterest": 0.5,
            }}),
        )
        .await;
    let payload = &prepared["prepareComment"];
    no_errors(payload);
    rig.sign_prepared(&m.token, &m.key, &payload["writes"])
        .await;
    payload["node"].as_str().expect("node").to_string()
}

/// A comment landed end to end. Its node id.
async fn landed_comment(rig: &WireRig, m: &Member, target: &str) -> String {
    let id = settling_comment(rig, m, target).await;
    rig.close_and_ingest().await;
    id
}

/// What the product's Remove sends for a post: its genesis record, every
/// revision with it.
async fn remove_post(rig: &WireRig, m: &Member, id: &str) {
    let read = rig
        .gql(
            None,
            r#"query($id: UUID!) { post(id: $id) { genesisRecordId } }"#,
            json!({ "id": id }),
        )
        .await;
    let record = read["post"]["genesisRecordId"]
        .as_str()
        .expect("genesis record");
    let removed = rig
        .gql(
            Some(&m.token),
            REMOVE,
            json!({ "input": { "record": record, "includeRevisions": true }}),
        )
        .await;
    no_errors(&removed["removeContent"]);
}

/// A post edit signed but not yet ordered.
async fn settling_edit(rig: &WireRig, m: &Member, id: &str) {
    let prepared = rig
        .gql(
            Some(&m.token),
            PREPARE_POST_EDIT,
            json!({ "input": { "id": id, "title": "Edited", "content": "edited" }}),
        )
        .await;
    let payload = &prepared["preparePostEdit"];
    no_errors(payload);
    rig.sign_prepared(&m.token, &m.key, &payload["writes"])
        .await;
}

fn ids(connection: &Value) -> Vec<String> {
    connection["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|e| e["node"]["id"].as_str().expect("id").to_string())
        .collect()
}

fn states(connection: &Value) -> Vec<String> {
    connection["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|e| {
            e["node"]["landing"]["state"]
                .as_str()
                .expect("state")
                .to_string()
        })
        .collect()
}

/// The person's still-settling post stands in their Posts view ahead of
/// the landed ones, marked PENDING, the same to a guest, to another member
/// and to the person — and nobody else's post is in it.
///
/// A profile's Posts view lists the person's still-settling post ahead of their landed ones, marked pending, to every viewer.
/// ´claim:profile:a-settling-post-stands-on-every-profiles-posts-view´
#[sqlx::test(migrations = "../../migrations")]
async fn a_settling_post_stands_on_every_profiles_posts_view(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let author = member(&rig, "author").await;
    let other = member(&rig, "other").await;
    let older = landed_post(&rig, &author, "older").await;
    let newer = landed_post(&rig, &author, "newer").await;
    landed_post(&rig, &other, "not hers").await;
    settling_post(&rig, &other, "not hers either").await;
    let settling = settling_post(&rig, &author, "settling").await;

    for viewer in [None, Some(other.token.as_str()), Some(author.token.as_str())] {
        let read = rig
            .gql(viewer, PROFILE_POSTS, json!({ "id": author.id }))
            .await;
        let posts = &read["user"]["posts"];
        assert_eq!(
            ids(posts),
            vec![settling.clone(), newer.clone(), older.clone()],
            "the settling post leads, then landing order: {posts}"
        );
        assert_eq!(states(posts), vec!["PENDING", "LANDED", "LANDED"]);
        assert_eq!(
            ids(&read["user"]["settled"]),
            vec![newer.clone(), older.clone()],
            "the opt-out serves only what landed"
        );
    }
}

/// The figure counts every post the person published — a removed one and
/// a still-settling one included — and never an edit, so it equals the
/// rows the Posts view lists; the opt-out counts what it lists too.
///
/// The Posts figure counts every post the person published, removed and still-settling included, never an edit, so it equals the Posts view's rows.
/// ´claim:profile:the-posts-figure-counts-what-the-posts-view-lists´
#[sqlx::test(migrations = "../../migrations")]
async fn the_posts_figure_counts_what_the_posts_view_lists(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let author = member(&rig, "author").await;
    let edited = landed_post(&rig, &author, "edited").await;
    let removed = landed_post(&rig, &author, "removed").await;
    remove_post(&rig, &author, &removed).await;
    rig.close_and_ingest().await;
    settling_edit(&rig, &author, &edited).await;
    let settling = settling_post(&rig, &author, "settling").await;

    let read = rig
        .gql(None, PROFILE_POSTS, json!({ "id": author.id }))
        .await;
    let posts = &read["user"]["posts"];
    assert_eq!(
        ids(posts),
        vec![settling, removed.clone(), edited.clone()],
        "one row per post, the edit adding none: {posts}"
    );
    assert!(
        posts["edges"][1]["node"]["removal"]["at"].is_string(),
        "the removed post is listed with its mark: {posts}"
    );
    assert_eq!(posts["totalCount"], 3, "the figure counts every row");
    assert_eq!(read["user"]["settled"]["totalCount"], 2);
    assert_eq!(ids(&read["user"]["settled"]), vec![removed, edited]);
}

/// The person's still-settling comment stands in their Comments view ahead
/// of the landed ones, marked PENDING — a reply as well as a comment on a
/// post, on anyone's post — to every viewer, and only theirs.
///
/// A profile's Comments view lists the person's still-settling comment ahead of their landed ones, marked pending, to every viewer.
/// ´claim:profile:a-settling-comment-stands-on-every-profiles-comments-view´
#[sqlx::test(migrations = "../../migrations")]
async fn a_settling_comment_stands_on_every_profiles_comments_view(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let author = member(&rig, "author").await;
    let other = member(&rig, "other").await;
    let host = landed_post(&rig, &other, "host").await;
    let landed = landed_comment(&rig, &author, &host).await;
    landed_comment(&rig, &other, &host).await;
    let reply = settling_comment(&rig, &author, &landed).await;
    settling_comment(&rig, &other, &host).await;

    for viewer in [None, Some(other.token.as_str()), Some(author.token.as_str())] {
        let read = rig
            .gql(viewer, PROFILE_COMMENTS, json!({ "id": author.id }))
            .await;
        let comments = &read["user"]["comments"];
        assert_eq!(
            ids(comments),
            vec![reply.clone(), landed.clone()],
            "the settling reply leads, then landing order: {comments}"
        );
        assert_eq!(states(comments), vec!["PENDING", "LANDED"]);
        assert_eq!(comments["edges"][0]["node"]["post"]["id"], host.as_str());
        assert_eq!(comments["totalCount"], 2);
        assert_eq!(ids(&read["user"]["settled"]), vec![landed.clone()]);
        assert_eq!(read["user"]["settled"]["totalCount"], 1);
    }
}
