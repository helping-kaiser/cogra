//! The composer's already-published marker over the wire (api-spec.md
//! `Query.ownPublishedPlacement`): the viewer's earliest published post
//! whose current gallery carries any of the named uploads — matched by
//! the asset an id resolves to, the re-encode merge included — and never
//! another author's placement.
//!
//! The ErrorCode the read emits, provoked here: BAD_INPUT for more ids
//! than a post's gallery holds, at the transport. No other refusal
//! exists — an id naming nothing, or naming someone else's asset, is a
//! miss, and a reader with no session reads null.

mod rig;

use api::ratelimit::RateLimitConfig;
use common::l1::client::ActorKey;
use rig::WireRig;
use serde_json::{Value, json};
use sqlx::PgPool;
use uuid::Uuid;

const PLACEMENT: &str = r#"query($ids: [UUID!]!) {
  ownPublishedPlacement(mediaIds: $ids) { id createdAt }
}"#;

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) {
    node writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_POST_EDIT: &str = r#"mutation($input: PreparePostEditInput!) {
  preparePostEdit(input: $input) {
    node writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

/// A ready asset row of the author's, its digest filled with `fill`. The
/// upload path is tested on its own; what the marker reads is which
/// posts point at an asset.
async fn asset(pool: &PgPool, author: Uuid, fill: u8) -> Uuid {
    let id = Uuid::new_v4();
    postgres_store::media::insert(
        pool,
        id,
        author,
        &[fill; 32],
        "sha256",
        &format!("{id}.webp"),
        "image/webp",
        1024,
        &json!({ "v": 1, "aspect_ratio": "1:1" }),
        postgres_store::media::MediaScale::Post,
    )
    .await
    .expect("asset row");
    id
}

/// An upload settled `merged`: its re-encode came out as `into`'s bytes,
/// so every read by its id answers with that asset — the row a composer
/// stage holds when it re-picked a clip the author already posted.
async fn merged_upload(pool: &PgPool, author: Uuid, fill: u8, into: Uuid) -> Uuid {
    let id = asset(pool, author, fill).await;
    sqlx::query("UPDATE media_attachments SET state = 'merged', merged_into = $2 WHERE id = $1")
        .bind(id)
        .bind(into)
        .execute(pool)
        .await
        .expect("merged");
    id
}

/// Stages a post whose gallery is `media`, signed on the device; it lands
/// at the next epoch.
async fn signed_post(rig: &WireRig, token: &str, key: &ActorKey, media: &[Uuid]) -> String {
    let attachments: Vec<Value> = media
        .iter()
        .enumerate()
        .map(|(order, id)| json!({ "mediaId": id, "displayOrder": order }))
        .collect();
    let data = rig
        .gql(
            Some(token),
            PREPARE_POST,
            json!({ "input": {
                "title": "Look",
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "pDirected": 0.1,
                "attachments": attachments,
            }}),
        )
        .await;
    let prepared = &data["preparePost"];
    assert_eq!(prepared["userErrors"], json!([]), "{prepared}");
    rig.sign_prepared(token, key, &prepared["writes"]).await;
    prepared["node"].as_str().expect("node").to_string()
}

/// A post carrying `media`, landed.
async fn landed_post(rig: &WireRig, token: &str, key: &ActorKey, media: &[Uuid]) -> String {
    let post = signed_post(rig, token, key, media).await;
    rig.close_and_ingest().await;
    post
}

/// The marker's answer for `ids`: the post's id, or null.
async fn placement(rig: &WireRig, token: Option<&str>, ids: &[Uuid]) -> Value {
    rig.gql(token, PLACEMENT, json!({ "ids": ids })).await["ownPublishedPlacement"]["id"].clone()
}

/// Two posts carry one picture and the marker names the earlier — the
/// origin, which a later repost never repoints; any of the stage's media
/// matching is enough.
///
/// The marker names the viewer's earliest published post carrying any of the named media.
/// ´claim:media:the-marker-names-the-earliest-own-post´
#[sqlx::test(migrations = "../../migrations")]
async fn the_marker_names_the_earliest_post_carrying_any_named_media(pool: PgPool) {
    let rig = WireRig::new(pool, RateLimitConfig::unlimited());
    let (author, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let picture = asset(&rig.pool, author, 1).await;
    let fresh = asset(&rig.pool, author, 2).await;

    let first = landed_post(&rig, &token, &key, &[picture]).await;
    landed_post(&rig, &token, &key, &[picture]).await;

    assert_eq!(placement(&rig, Some(&token), &[picture]).await, json!(first));
    assert_eq!(
        placement(&rig, Some(&token), &[fresh, picture]).await,
        json!(first)
    );
    assert_eq!(placement(&rig, Some(&token), &[fresh]).await, Value::Null);
}

/// The re-encode merge: the stage holds an upload whose rendition is a
/// clip the author already posted. The upload's own id is on no post —
/// the post carries the held asset — and the marker still finds it, by
/// the asset the id resolves to.
///
/// An upload merged into a held asset finds the post carrying that asset.
/// ´claim:media:a-merged-upload-finds-its-assets-post´
#[sqlx::test(migrations = "../../migrations")]
async fn a_merged_upload_finds_the_post_carrying_the_asset_it_became(pool: PgPool) {
    let rig = WireRig::new(pool, RateLimitConfig::unlimited());
    let (author, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let clip = asset(&rig.pool, author, 1).await;
    let post = landed_post(&rig, &token, &key, &[clip]).await;

    let upload = merged_upload(&rig.pool, author, 9, clip).await;
    assert_eq!(placement(&rig, Some(&token), &[upload]).await, json!(post));
}

/// Published is landed, and carried is the current version: a post still
/// in flight is not yet the marker's answer, and an edit that takes the
/// picture out takes the post off it.
///
/// Only a landed post whose current version carries the media answers the marker.
/// ´claim:media:the-marker-reads-landed-current-galleries´
#[sqlx::test(migrations = "../../migrations")]
async fn only_a_landed_post_whose_current_version_carries_it_answers(pool: PgPool) {
    let rig = WireRig::new(pool, RateLimitConfig::unlimited());
    let (author, key) = rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let picture = asset(&rig.pool, author, 1).await;

    let first = signed_post(&rig, &token, &key, &[picture]).await;
    assert_eq!(
        placement(&rig, Some(&token), &[picture]).await,
        Value::Null,
        "in flight is not yet published"
    );
    rig.close_and_ingest().await;
    assert_eq!(placement(&rig, Some(&token), &[picture]).await, json!(first));
    let second = landed_post(&rig, &token, &key, &[picture]).await;

    let replacement = asset(&rig.pool, author, 2).await;
    let edit = rig
        .gql(
            Some(&token),
            PREPARE_POST_EDIT,
            json!({ "input": {
                "id": first,
                "title": "Look",
                "attachments": [{ "mediaId": replacement, "displayOrder": 0 }],
            }}),
        )
        .await;
    assert_eq!(edit["preparePostEdit"]["userErrors"], json!([]), "{edit}");
    rig.sign_prepared(&token, &key, &edit["preparePostEdit"]["writes"])
        .await;
    rig.close_and_ingest().await;

    assert_eq!(
        placement(&rig, Some(&token), &[picture]).await,
        json!(second),
        "the edit took the picture out of the first post"
    );
    assert_eq!(
        placement(&rig, Some(&token), &[replacement]).await,
        json!(first),
        "and the picture it put in answers with it"
    );
}

/// The marker is the viewer's own: an id naming someone else's asset is a
/// miss, and identical bytes another author posted under their own asset
/// never answer — nor does anything without a session.
///
/// The marker never reveals another author's placement, by their asset's id or by identical bytes.
/// ´claim:media:the-marker-never-reads-another-authors-placement´
#[sqlx::test(migrations = "../../migrations")]
async fn the_marker_never_answers_with_another_authors_placement(pool: PgPool) {
    let rig = WireRig::new(pool, RateLimitConfig::unlimited());
    let (alice, alice_key) = rig.seed_member("alice", "alice@example.com").await;
    let (bob, _) = rig.seed_member("bob", "bob@example.com").await;
    let alice_token = rig.log_in("alice@example.com").await;
    let bob_token = rig.log_in("bob@example.com").await;
    let alices = asset(&rig.pool, alice, 1).await;
    let bobs_same_bytes = asset(&rig.pool, bob, 1).await;
    landed_post(&rig, &alice_token, &alice_key, &[alices]).await;

    assert_eq!(placement(&rig, Some(&bob_token), &[alices]).await, Value::Null);
    assert_eq!(
        placement(&rig, Some(&bob_token), &[bobs_same_bytes]).await,
        Value::Null
    );
    assert_eq!(placement(&rig, None, &[alices]).await, Value::Null);
    assert_eq!(placement(&rig, Some(&alice_token), &[]).await, Value::Null);
}

/// More ids than a post's gallery holds is a client bug the transport
/// refuses as BAD_INPUT; the gallery's cap itself is admitted.
///
/// More media ids than a post's gallery holds refuses the marker's read as bad input.
/// ´claim:media:the-marker-refuses-more-ids-than-a-gallery-holds´
#[sqlx::test(migrations = "../../migrations")]
async fn more_ids_than_a_gallery_holds_is_bad_input(pool: PgPool) {
    let rig = WireRig::new(pool, RateLimitConfig::unlimited());
    rig.seed_member("author", "author@example.com").await;
    let token = rig.log_in("author@example.com").await;
    let ids = |n: usize| (0..n).map(|_| Uuid::new_v4()).collect::<Vec<_>>();

    let at_cap = rig
        .gql_raw(
            Some(&token),
            PLACEMENT,
            json!({ "ids": ids(api::media::MAX_POST_ATTACHMENTS) }),
        )
        .await;
    assert!(at_cap.get("errors").is_none(), "{at_cap}");
    assert!(at_cap["data"]["ownPublishedPlacement"].is_null());

    let past = rig
        .gql_raw(
            Some(&token),
            PLACEMENT,
            json!({ "ids": ids(api::media::MAX_POST_ATTACHMENTS + 1) }),
        )
        .await;
    assert_eq!(past["errors"][0]["extensions"]["code"], "BAD_INPUT", "{past}");
}
