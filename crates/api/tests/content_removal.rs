//! Per-content removal, end to end against the stand-in (erasure.md §1,
//! api-spec.md `removeContent`): an author removes a post or a comment,
//! every version of it leaves every reader's view behind a visible mark,
//! and the record keeps its place, its routing and its replies. Every
//! request goes through the real router. Requires a live Postgres
//! (`make up`).

use std::time::Duration;

use api::l1::StandInBoundary;
use api::media::MediaAreas;
use api::ratelimit::RateLimitConfig;
use api::redaction::{self, Redaction};
use common::l1::client::ActorKey;
use postgres_store::PgPool;
use serde_json::{Value, json};
use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
use uuid::Uuid;

mod rig;
use rig::WireRig;

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) {
    node writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_COMMENT: &str = r#"mutation($input: PrepareCommentInput!) {
  prepareComment(input: $input) {
    node writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_POST_EDIT: &str = r#"mutation($input: PreparePostEditInput!) {
  preparePostEdit(input: $input) {
    node writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_COMMENT_EDIT: &str = r#"mutation($input: PrepareCommentEditInput!) {
  prepareCommentEdit(input: $input) {
    node writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

const PREPARE_STANCE: &str = r#"mutation($input: PrepareStanceInput!) {
  prepareStance(input: $input) {
    writes { id canonicalProposal } userErrors { code message field }
  }
}"#;

const REMOVE: &str = r#"mutation($input: RemoveContentInput!) {
  removeContent(input: $input) {
    records { id payloadState redactedAt }
    userErrors { code message field }
  }
}"#;

const READ_POST: &str = r#"query($id: UUID!) { post(id: $id) {
  id genesisRecordId createdAt updatedAt
  landing { state }
  title { value status }
  description { value status }
  content { value status }
  sensitiveReason
  attachments { id }
  attachmentsStatus
  removal { at by }
  author { handle }
} }"#;

const READ_COMMENT: &str = r#"query($id: UUID!) { comment(id: $id) {
  id genesisRecordId updatedAt
  content { value status }
  attachments { id }
  removal { at by }
  author { handle }
  replies(first: 10) { edges { node { id content { value status } removal { by } } } }
} }"#;

/// A seeded member, signed in.
struct Member {
    id: Uuid,
    key: ActorKey,
    token: String,
}

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
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

/// An image asset row of this author's, without the byte pipeline: what
/// binds it to a manifest is its digest.
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
        &json!({ "v": 1, "aspect_ratio": "4:5" }),
        postgres_store::media::MediaScale::Post,
    )
    .await
    .expect("asset row");
    id
}

/// A post prepared and signed, not yet landed — its node id. Words go in
/// the body; beside media they go in the description.
async fn signed_post(rig: &WireRig, m: &Member, title: &str, body: &str, media: &[Uuid]) -> String {
    let attachments: Vec<Value> = media
        .iter()
        .enumerate()
        .map(|(i, id)| {
            json!({
                "mediaId": id.to_string(),
                "displayOrder": i,
                "isCover": i == 0,
                "altText": format!("picture {}", i + 1),
            })
        })
        .collect();
    let mut input = json!({
        "title": title,
        "license": { "attribution": 1.0, "provenance": 0.0 },
        "pDirected": 0.1,
        "attachments": attachments,
    });
    if media.is_empty() {
        input["content"] = json!(body);
    } else {
        input["description"] = json!(body);
    }
    let prepared = rig
        .gql(Some(&m.token), PREPARE_POST, json!({ "input": input }))
        .await;
    let payload = &prepared["preparePost"];
    no_errors(payload);
    rig.sign_prepared(&m.token, &m.key, &payload["writes"])
        .await;
    payload["node"].as_str().expect("node").to_string()
}

/// A post landed end to end — its node id.
async fn post(rig: &WireRig, m: &Member, title: &str, body: &str, media: &[Uuid]) -> String {
    let id = signed_post(rig, m, title, body, media).await;
    rig.close_and_ingest().await;
    id
}

/// A comment (or reply) landed end to end — its node id.
async fn comment(rig: &WireRig, m: &Member, target: &str, body: &str) -> String {
    let prepared = rig
        .gql(
            Some(&m.token),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": target,
                "content": body,
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
    rig.close_and_ingest().await;
    payload["node"].as_str().expect("node").to_string()
}

async fn prepare_post_edit(rig: &WireRig, m: &Member, id: &str, body: &str) -> Value {
    rig.gql(
        Some(&m.token),
        PREPARE_POST_EDIT,
        json!({ "input": { "id": id, "title": "Edited", "content": body }}),
    )
    .await["preparePostEdit"]
        .clone()
}

/// An edit prepared and signed, not yet landed.
async fn signed_edit(rig: &WireRig, m: &Member, id: &str, body: &str) {
    let payload = prepare_post_edit(rig, m, id, body).await;
    no_errors(&payload);
    rig.sign_prepared(&m.token, &m.key, &payload["writes"])
        .await;
}

async fn read_post(rig: &WireRig, id: &str) -> Value {
    rig.gql(None, READ_POST, json!({ "id": id })).await["post"].clone()
}

async fn read_comment(rig: &WireRig, id: &str) -> Value {
    rig.gql(None, READ_COMMENT, json!({ "id": id })).await["comment"].clone()
}

async fn remove(rig: &WireRig, token: &str, record: &str, include_revisions: bool) -> Value {
    rig.gql(
        Some(token),
        REMOVE,
        json!({ "input": { "record": record, "includeRevisions": include_revisions }}),
    )
    .await["removeContent"]
        .clone()
}

/// What the product's Remove sends for a post: its genesis record, every
/// revision with it.
async fn remove_post(rig: &WireRig, m: &Member, id: &str) -> Value {
    let record = read_post(rig, id).await["genesisRecordId"]
        .as_str()
        .expect("genesis record")
        .to_string();
    let removed = remove(rig, &m.token, &record, true).await;
    no_errors(&removed);
    removed
}

async fn remove_comment(rig: &WireRig, m: &Member, id: &str) -> Value {
    let record = read_comment(rig, id).await["genesisRecordId"]
        .as_str()
        .expect("genesis record")
        .to_string();
    let removed = remove(rig, &m.token, &record, true).await;
    no_errors(&removed);
    removed
}

fn first_error(payload: &Value) -> Value {
    payload["userErrors"][0].clone()
}

async fn count(pool: &PgPool, sql: &str) -> i64 {
    sqlx::query_scalar(sql).fetch_one(pool).await.expect(sql)
}

/// Every act id of the author's, oldest first.
async fn acts_of(pool: &PgPool, author: Uuid) -> Vec<String> {
    sqlx::query_scalar("SELECT act_id FROM staged_writes WHERE actor_id = $1 ORDER BY seq")
        .bind(author)
        .fetch_all(pool)
        .await
        .expect("acts")
}

async fn archive_units(pool: &PgPool) -> i64 {
    count(pool, "SELECT COUNT(*) FROM retention_archive").await
}

// ---------------------------------------------------------------------
// Error codes (api-spec.md `removeContent`): each one provoked.
// ---------------------------------------------------------------------

/// Removal needs a session: without one the request is refused at the
/// transport, before anything is read.
///
/// Removing without a session is refused UNAUTHENTICATED at the transport.
/// ´claim:removal:removing-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn removing_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "Mine", "Words.", &[]).await;
    let record = read_post(&rig, &id).await["genesisRecordId"].clone();

    let json = rig
        .gql_raw(
            None,
            REMOVE,
            json!({ "input": { "record": record, "includeRevisions": true }}),
        )
        .await;
    assert_eq!(
        json["errors"][0]["extensions"]["code"], "UNAUTHENTICATED",
        "{json}"
    );
    assert_eq!(read_post(&rig, &id).await["removal"], Value::Null);
}

/// A record nothing answers to — malformed, or well-formed and unknown —
/// is NOT_FOUND at the record.
///
/// Removing a record nothing answers to is NOT_FOUND at the record.
/// ´claim:removal:an-unknown-record-is-not-found´
#[sqlx::test(migrations = "../../migrations")]
async fn removing_an_unknown_record_is_not_found(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    for record in ["not-an-act", "act:nobody:7:publish"] {
        let refused = remove(&rig, &ada.token, record, true).await;
        let error = first_error(&refused);
        assert_eq!(error["code"], "NOT_FOUND", "{refused}");
        assert_eq!(error["field"], json!(["record"]));
        assert_eq!(refused["records"], json!([]));
    }
}

/// Only the author removes: anyone else's attempt is FORBIDDEN, and
/// nothing is archived, reduced or tombstoned.
///
/// Removing someone else's record is FORBIDDEN and changes nothing.
/// ´claim:removal:only-the-author-removes´
#[sqlx::test(migrations = "../../migrations")]
async fn removing_someone_elses_post_is_forbidden(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let id = post(&rig, &ada, "Ada's", "Not yours.", &[]).await;
    let record = read_post(&rig, &id).await["genesisRecordId"]
        .as_str()
        .expect("record")
        .to_string();

    let refused = remove(&rig, &bo.token, &record, true).await;
    let error = first_error(&refused);
    assert_eq!(error["code"], "FORBIDDEN", "{refused}");
    assert_eq!(error["field"], json!(["record"]));
    assert_eq!(archive_units(&rig.pool).await, 0, "nothing archived");
    assert_eq!(
        count(
            &rig.pool,
            "SELECT COUNT(*) FROM act_payloads WHERE payload_state = 'reduced'"
        )
        .await,
        0,
        "nothing reduced"
    );
    let read = read_post(&rig, &id).await;
    assert_eq!(read["content"]["value"], "Not yours.");
    assert_eq!(read["removal"], Value::Null);
}

/// A stance is no content this verb removes: BAD_INPUT at the record,
/// and the stance keeps its payload.
///
/// Removing a stance record is BAD_INPUT at the record.
/// ´claim:removal:a-stance-is-not-removable´
#[sqlx::test(migrations = "../../migrations")]
async fn removing_a_stance_record_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let id = post(&rig, &bo, "Bo's", "Words.", &[]).await;
    let stance = rig
        .gql(
            Some(&ada.token),
            PREPARE_STANCE,
            json!({ "input": { "target": id, "pDirected": 0.5, "pInterest": 0.5 }}),
        )
        .await;
    no_errors(&stance["prepareStance"]);
    rig.sign_prepared(&ada.token, &ada.key, &stance["prepareStance"]["writes"])
        .await;
    rig.close_and_ingest().await;
    let opinion: String = sqlx::query_scalar(
        "SELECT act_id FROM staged_writes WHERE actor_id = $1 AND family = 'opinion'",
    )
    .bind(ada.id)
    .fetch_one(&rig.pool)
    .await
    .expect("the opinion");

    let refused = remove(&rig, &ada.token, &opinion, true).await;
    let error = first_error(&refused);
    assert_eq!(error["code"], "BAD_INPUT", "{refused}");
    assert_eq!(error["field"], json!(["record"]));
    assert_eq!(archive_units(&rig.pool).await, 0);
}

/// An act carried with an application never reached a reader; it is
/// deleted with its account, never removed — BAD_INPUT, untouched.
///
/// Removing a carried act is BAD_INPUT and leaves it carried.
/// ´claim:removal:a-carried-act-is-not-removed´
#[sqlx::test(migrations = "../../migrations")]
async fn removing_a_carried_act_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let prepared = rig
        .gql(
            Some(&ada.token),
            PREPARE_POST,
            json!({ "input": {
                "title": "Carried",
                "content": "Waits with the application.",
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "pDirected": 0.1,
            }}),
        )
        .await;
    no_errors(&prepared["preparePost"]);
    let staged_id: Uuid = prepared["preparePost"]["writes"][0]["id"]
        .as_str()
        .expect("staged id")
        .parse()
        .expect("uuid");
    postgres_store::staged::carry(&rig.pool, &[staged_id])
        .await
        .expect("carries");
    let act: String = sqlx::query_scalar("SELECT act_id FROM staged_writes WHERE id = $1")
        .bind(staged_id)
        .fetch_one(&rig.pool)
        .await
        .expect("act");

    let refused = remove(&rig, &ada.token, &act, true).await;
    let error = first_error(&refused);
    assert_eq!(error["code"], "BAD_INPUT", "{refused}");
    assert_eq!(error["field"], json!(["record"]));
    let kept: bool = sqlx::query_scalar(
        "SELECT payload IS NOT NULL FROM staged_writes WHERE id = $1 AND state = 'carried'",
    )
    .bind(staged_id)
    .fetch_one(&rig.pool)
    .await
    .expect("still carried");
    assert!(kept);
}

/// An edit on a removed post would become its newest version and put
/// words back where the author took them away: refused at the id.
///
/// An edit on a removed post is BAD_INPUT at the id.
/// ´claim:removal:a-removed-post-takes-no-edit´
#[sqlx::test(migrations = "../../migrations")]
async fn editing_a_removed_post_is_refused(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "Gone", "Soon gone.", &[]).await;
    remove_post(&rig, &ada, &id).await;

    let refused = prepare_post_edit(&rig, &ada, &id, "Back again?").await;
    let error = first_error(&refused);
    assert_eq!(error["code"], "BAD_INPUT", "{refused}");
    assert_eq!(error["field"], json!(["id"]));
    assert!(refused["writes"].is_null());
}

/// The same refusal on a removed comment.
///
/// An edit on a removed comment is BAD_INPUT at the id.
/// ´claim:removal:a-removed-comment-takes-no-edit´
#[sqlx::test(migrations = "../../migrations")]
async fn editing_a_removed_comment_is_refused(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Thread", "Talk.", &[]).await;
    let c = comment(&rig, &bo, &p, "Bo's words.").await;
    remove_comment(&rig, &bo, &c).await;

    let refused = rig
        .gql(
            Some(&bo.token),
            PREPARE_COMMENT_EDIT,
            json!({ "input": { "id": c, "content": "Back again?" }}),
        )
        .await["prepareCommentEdit"]
        .clone();
    let error = first_error(&refused);
    assert_eq!(error["code"], "BAD_INPUT", "{refused}");
    assert_eq!(error["field"], json!(["id"]));
}

// ---------------------------------------------------------------------
// The chain, the mark, and what stays.
// ---------------------------------------------------------------------

/// Removing "the post" sweeps its whole chain: the genesis act and both
/// edits are each archived as one unit, reduced, and their staged copies
/// reaped — and the payload answers all three records REDUCED.
///
/// Removing a post reduces and archives every revision of it.
/// ´claim:removal:the-whole-chain-goes´
#[sqlx::test(migrations = "../../migrations")]
async fn removing_a_post_reduces_every_revision_and_archives_each_unit(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "First", "One.", &[]).await;
    signed_edit(&rig, &ada, &id, "Two.").await;
    rig.close_and_ingest().await;
    signed_edit(&rig, &ada, &id, "Three.").await;
    rig.close_and_ingest().await;
    let acts = acts_of(&rig.pool, ada.id).await;
    assert_eq!(acts.len(), 3);

    let removed = remove_post(&rig, &ada, &id).await;
    let records = removed["records"].as_array().expect("records");
    assert_eq!(
        records.iter().map(|r| r["id"].clone()).collect::<Vec<_>>(),
        acts.iter().map(|a| json!(a)).collect::<Vec<_>>(),
        "every revision, oldest first"
    );
    for record in records {
        assert_eq!(record["payloadState"], "REDUCED");
        assert!(record["redactedAt"].is_string());
    }
    for act in &acts {
        let units: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM retention_archive
             WHERE original_id = $1 AND redaction_reason = 'user-content-removal'
               AND redacted_by = $2",
        )
        .bind(act)
        .bind(ada.id.to_string())
        .fetch_one(&rig.pool)
        .await
        .expect("units");
        assert_eq!(units, 1, "one unit per act: {act}");
        let (carriage, staged): (bool, bool) = sqlx::query_as(
            "SELECT (SELECT payload IS NULL AND payload_state = 'reduced'
                     FROM act_payloads WHERE act_id = $1),
                    (SELECT payload IS NULL AND nonce IS NULL AND content_salt IS NULL
                     FROM staged_writes WHERE act_id = $1)",
        )
        .bind(act)
        .fetch_one(&rig.pool)
        .await
        .expect("copies");
        assert!(carriage && staged, "{act}: reduced and reaped");
    }
}

/// A removed comment's replies keep their parent and stay readable; the
/// comment itself keeps its author and its place, and wears the mark.
///
/// A removed comment keeps its replies readable under it.
/// ´claim:removal:a-removed-comment-keeps-its-replies´
#[sqlx::test(migrations = "../../migrations")]
async fn removing_a_comment_keeps_its_replies_readable(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let cy = member(&rig, "cy").await;
    let p = post(&rig, &ada, "Thread", "Talk.", &[]).await;
    let c = comment(&rig, &bo, &p, "Bo's words.").await;
    let reply = comment(&rig, &cy, &c, "Cy answers.").await;

    remove_comment(&rig, &bo, &c).await;

    let read = read_comment(&rig, &c).await;
    assert_eq!(read["content"]["status"], "REDACTED");
    assert_eq!(read["content"]["value"], Value::Null);
    assert_eq!(read["author"]["handle"], "bo");
    assert_eq!(read["removal"]["by"], "AUTHOR");
    let replies = read["replies"]["edges"].as_array().expect("replies");
    assert_eq!(replies.len(), 1);
    assert_eq!(replies[0]["node"]["id"], reply.as_str());
    assert_eq!(replies[0]["node"]["content"]["value"], "Cy answers.");
    assert_eq!(replies[0]["node"]["removal"], Value::Null);
}

/// The mark reads off the node: AUTHOR, at the removal's own moment — the
/// moment the head record's payload went REDUCED.
///
/// A removed post reads its removal by its author at the removal's moment.
/// ´claim:removal:a-removed-post-reads-its-mark´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removed_post_reads_removal_by_author_with_its_moment(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "Mine", "Words.", &[]).await;
    let before = chrono::Utc::now();
    let removed = remove_post(&rig, &ada, &id).await;
    let after = chrono::Utc::now();

    let read = read_post(&rig, &id).await;
    assert_eq!(read["removal"]["by"], "AUTHOR");
    let at: chrono::DateTime<chrono::Utc> = read["removal"]["at"]
        .as_str()
        .expect("at")
        .parse()
        .expect("a timestamp");
    assert!(before <= at && at <= after, "{at} within the request");
    assert_eq!(
        read["removal"]["at"], removed["records"][0]["redactedAt"],
        "the mark's moment is the head record's reduction"
    );
}

/// The same mark on a comment.
///
/// A removed comment reads its removal by its author.
/// ´claim:removal:a-removed-comment-reads-its-mark´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removed_comment_reads_removal_by_author(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Thread", "Talk.", &[]).await;
    let c = comment(&rig, &bo, &p, "Bo's words.").await;
    let removed = remove_comment(&rig, &bo, &c).await;

    let read = read_comment(&rig, &c).await;
    assert_eq!(read["removal"]["by"], "AUTHOR");
    assert_eq!(read["removal"]["at"], removed["records"][0]["redactedAt"]);
}

/// `Record.redactedAt` is null while the payload is carried and the
/// reduction's moment after.
///
/// A record's redactedAt is null while full and set on reduction.
/// ´claim:removal:redacted-at-is-the-reduction-moment´
#[sqlx::test(migrations = "../../migrations")]
async fn record_redacted_at_is_set_on_reduction(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "Mine", "Words.", &[]).await;
    let record = read_post(&rig, &id).await["genesisRecordId"].clone();
    const READ_RECORD: &str = r#"query($id: RecordId!) {
      record(id: $id) { id payloadState redactedAt }
    }"#;
    let full = rig.gql(None, READ_RECORD, json!({ "id": record })).await;
    assert_eq!(full["record"]["payloadState"], "FULL", "{full}");
    assert_eq!(full["record"]["redactedAt"], Value::Null);

    remove_post(&rig, &ada, &id).await;
    let reduced = rig.gql(None, READ_RECORD, json!({ "id": record })).await;
    assert_eq!(reduced["record"]["payloadState"], "REDUCED");
    let stored: chrono::DateTime<chrono::Utc> =
        sqlx::query_scalar("SELECT reduced_at FROM act_payloads WHERE act_id = $1")
            .bind(record.as_str().expect("id"))
            .fetch_one(&rig.pool)
            .await
            .expect("reduced_at");
    let served: chrono::DateTime<chrono::Utc> = reduced["record"]["redactedAt"]
        .as_str()
        .expect("redactedAt")
        .parse()
        .expect("timestamp");
    assert_eq!(served, stored);
}

/// Redaction is record-granular: title, description, body and the
/// sensitive reason all read REDACTED at once, and the gallery is empty.
///
/// A removed post serves every field REDACTED and no gallery.
/// ´claim:removal:every-field-goes-at-once´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removed_post_serves_every_field_redacted_and_no_gallery(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let a = asset(&rig.pool, ada.id, 0x11).await;
    let id = post(&rig, &ada, "Pictures", "Two of them.", &[a]).await;
    assert_eq!(
        read_post(&rig, &id).await["attachments"]
            .as_array()
            .expect("gallery")
            .len(),
        1
    );

    remove_post(&rig, &ada, &id).await;
    let read = read_post(&rig, &id).await;
    for field in ["title", "description", "content"] {
        assert_eq!(read[field]["status"], "REDACTED", "{field}: {read}");
        assert_eq!(read[field]["value"], Value::Null, "{field}");
    }
    assert_eq!(read["sensitiveReason"], Value::Null);
    assert_eq!(read["attachments"], json!([]));
    assert_eq!(read["attachmentsStatus"], "REDACTED");
    assert_eq!(read["author"]["handle"], "ada", "the author chip stays");
}

/// Graph law: removal deletes nothing. Every node, entity, version,
/// junction, asset and mirror row is still there; the tombstone is one
/// version row more.
///
/// A removal deletes no node, no entity and no version row.
/// ´claim:removal:nothing-is-deleted´
#[sqlx::test(migrations = "../../migrations")]
async fn removal_deletes_no_node_no_entity_and_no_version_row(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let a = asset(&rig.pool, ada.id, 0x21).await;
    let id = post(&rig, &ada, "Kept", "Structure stays.", &[a]).await;
    signed_edit(&rig, &ada, &id, "Edited once.").await;
    rig.close_and_ingest().await;
    comment(&rig, &bo, &id, "A reply stays.").await;
    const TABLES: [&str; 7] = [
        "SELECT COUNT(*) FROM posts",
        "SELECT COUNT(*) FROM comments",
        "SELECT COUNT(*) FROM post_versions",
        "SELECT COUNT(*) FROM post_attachments",
        "SELECT COUNT(*) FROM media_attachments",
        "SELECT COUNT(*) FROM mirror_records",
        "SELECT COUNT(*) FROM staged_writes",
    ];
    let mut before = Vec::new();
    for sql in TABLES {
        before.push(count(&rig.pool, sql).await);
    }

    remove_post(&rig, &ada, &id).await;
    for (sql, was) in TABLES.iter().zip(before) {
        let now = count(&rig.pool, sql).await;
        let expected = if sql.ends_with("post_versions") {
            was + 1
        } else {
            was
        };
        assert_eq!(now, expected, "{sql}");
    }
}

/// No copy of the removed words is left anywhere CoGra holds one: not in
/// carriage, not in a staged row, not in the stand-in, not in any version
/// row of the node, and not in the search index.
///
/// After a removal no copy of the removed words remains anywhere CoGra holds one.
/// ´claim:removal:no-copy-of-the-words-remains´
#[sqlx::test(migrations = "../../migrations")]
async fn after_removal_no_copy_of_the_words_remains_anywhere(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "Plumtitle", "Plumbody first.", &[]).await;
    signed_edit(&rig, &ada, &id, "Plumbody second.").await;
    rig.close_and_ingest().await;
    let node: Uuid = id.parse().expect("uuid");
    assert!(
        count(
            &rig.pool,
            "SELECT COUNT(*) FROM search_index WHERE folded LIKE '%plum%'"
        )
        .await
            > 0,
        "the index held the words before"
    );

    remove_post(&rig, &ada, &id).await;
    let display: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM post_versions
         WHERE post_id = $1
           AND (content LIKE '%Plum%' OR title LIKE '%Plum%'
                OR description LIKE '%Plum%' OR redaction_reason IS NULL)",
    )
    .bind(node)
    .fetch_one(&rig.pool)
    .await
    .expect("display rows");
    assert_eq!(display, 0, "every version row of the post is a tombstone");
    for act in acts_of(&rig.pool, ada.id).await {
        let copies: i64 = sqlx::query_scalar(
            "SELECT (SELECT COUNT(*) FROM act_payloads WHERE act_id = $1 AND payload IS NOT NULL)
                  + (SELECT COUNT(*) FROM staged_writes WHERE act_id = $1 AND payload IS NOT NULL)
                  + (SELECT COUNT(*) FROM l1_acts WHERE act_id = $1 AND payload IS NOT NULL)",
        )
        .bind(&act)
        .fetch_one(&rig.pool)
        .await
        .expect("copies");
        assert_eq!(copies, 0, "{act}");
    }
    let indexed = count(
        &rig.pool,
        "SELECT COUNT(*) FROM search_index WHERE folded LIKE '%plum%'",
    )
    .await;
    assert_eq!(indexed, 0, "the search index holds no word of it");
}

/// The archive unit, the reduction, the reap and the tombstone commit
/// together: a failure injected at the tombstone leaves the act full,
/// unarchived and unreaped, and the post unmarked. The retry completes.
///
/// A removal's reduction and its tombstone commit together or not at all.
/// ´claim:removal:the-reduction-and-the-tombstone-commit-together´
#[sqlx::test(migrations = "../../migrations")]
async fn a_crash_between_reduction_and_tombstone_is_impossible(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "Atomic", "All or nothing.", &[]).await;
    let record = read_post(&rig, &id).await["genesisRecordId"]
        .as_str()
        .expect("record")
        .to_string();
    sqlx::raw_sql(
        "CREATE FUNCTION refuse_tombstone() RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN RAISE EXCEPTION 'injected: the tombstone fails'; END $$;
         CREATE TRIGGER refuse_tombstone BEFORE UPDATE ON post_versions
             FOR EACH ROW WHEN (NEW.redaction_reason IS NOT NULL)
             EXECUTE FUNCTION refuse_tombstone();",
    )
    .execute(&rig.pool)
    .await
    .expect("injects");

    let refused = remove(&rig, &ada.token, &record, true).await;
    assert_eq!(first_error(&refused)["code"], "INTERNAL", "{refused}");
    assert_eq!(
        archive_units(&rig.pool).await,
        0,
        "no unit without its tombstone"
    );
    let state: String =
        sqlx::query_scalar("SELECT payload_state FROM act_payloads WHERE act_id = $1")
            .bind(&record)
            .fetch_one(&rig.pool)
            .await
            .expect("carriage");
    assert_eq!(state, "full", "no reduction without its tombstone");
    let read = read_post(&rig, &id).await;
    assert_eq!(read["content"]["value"], "All or nothing.");
    assert_eq!(read["removal"], Value::Null);

    sqlx::raw_sql("DROP TRIGGER refuse_tombstone ON post_versions")
        .execute(&rig.pool)
        .await
        .expect("lifts");
    let removed = remove(&rig, &ada.token, &record, true).await;
    no_errors(&removed);
    assert_eq!(archive_units(&rig.pool).await, 1);
    assert_eq!(read_post(&rig, &id).await["removal"]["by"], "AUTHOR");
}

/// An edit in flight when the post is removed goes with it: the post
/// reads removed at once, and when the edit's record lands it lands
/// REDUCED onto a row that shows nothing — the words never come back.
///
/// A removal sweeps an edit in flight, which lands reduced.
/// ´claim:removal:an-edit-in-flight-lands-reduced´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removal_during_a_pending_edit_stays_removed_when_the_edit_lands(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "Settled", "Landed words.", &[]).await;
    signed_edit(&rig, &ada, &id, "Words in flight.").await;
    let pending = read_post(&rig, &id).await;
    assert_eq!(pending["content"]["value"], "Words in flight.");
    let updated_at = pending["updatedAt"].clone();

    let removed = remove_post(&rig, &ada, &id).await;
    assert_eq!(
        removed["records"].as_array().expect("records").len(),
        1,
        "the edit in flight has no record yet"
    );
    let read = read_post(&rig, &id).await;
    assert_eq!(read["content"]["status"], "REDACTED", "{read}");
    assert_eq!(read["removal"]["by"], "AUTHOR");

    rig.close_and_ingest().await;
    let landed = read_post(&rig, &id).await;
    assert_eq!(landed["content"]["status"], "REDACTED", "{landed}");
    assert_eq!(landed["content"]["value"], Value::Null);
    assert_eq!(landed["removal"]["at"], read["removal"]["at"]);
    assert_eq!(landed["updatedAt"], updated_at, "the removal is no edit");
    let edit = acts_of(&rig.pool, ada.id).await.pop().expect("the edit");
    let state: String =
        sqlx::query_scalar("SELECT payload_state FROM act_payloads WHERE act_id = $1")
            .bind(&edit)
            .fetch_one(&rig.pool)
            .await
            .expect("the edit landed");
    assert_eq!(state, "reduced");
}

/// A post still settling is removed like a landed one: it wears the mark
/// at once, and its record lands REDUCED behind it.
///
/// A still-settling post is marked at once and lands reduced.
/// ´claim:removal:a-settling-post-lands-reduced´
#[sqlx::test(migrations = "../../migrations")]
async fn removing_a_still_settling_post_marks_it_and_it_lands_reduced(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = signed_post(&rig, &ada, "Settling", "Not landed yet.", &[]).await;
    assert_eq!(read_post(&rig, &id).await["landing"]["state"], "PENDING");

    let removed = remove_post(&rig, &ada, &id).await;
    assert_eq!(removed["records"], json!([]), "no record has landed yet");
    let read = read_post(&rig, &id).await;
    assert_eq!(read["content"]["status"], "REDACTED", "{read}");
    assert_eq!(read["removal"]["by"], "AUTHOR");

    rig.close_and_ingest().await;
    let landed = read_post(&rig, &id).await;
    assert_ne!(landed["landing"]["state"], "PENDING", "{landed}");
    assert_eq!(landed["content"]["status"], "REDACTED");
    assert_eq!(landed["removal"]["at"], read["removal"]["at"]);
    assert_eq!(landed["updatedAt"], landed["createdAt"]);
    let record = landed["genesisRecordId"].as_str().expect("record");
    let state: String =
        sqlx::query_scalar("SELECT payload_state FROM act_payloads WHERE act_id = $1")
            .bind(record)
            .fetch_one(&rig.pool)
            .await
            .expect("landed");
    assert_eq!(state, "reduced");
}

/// A removal is no edit: `updatedAt` keeps the last version's instant.
///
/// A removal never moves updatedAt.
/// ´claim:removal:updated-at-never-moves´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removal_never_moves_updated_at(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "Edited", "Once.", &[]).await;
    signed_edit(&rig, &ada, &id, "Twice.").await;
    rig.close_and_ingest().await;
    let before = read_post(&rig, &id).await;
    assert_ne!(
        before["updatedAt"], before["createdAt"],
        "the edit moved it"
    );

    remove_post(&rig, &ada, &id).await;
    assert_eq!(read_post(&rig, &id).await["updatedAt"], before["updatedAt"]);
}

/// Removing a removed post answers the same records, still REDUCED, and
/// archives nothing new; the mark keeps its first moment.
///
/// Removal is idempotent: a second removal archives nothing and keeps the mark's moment.
/// ´claim:removal:removal-is-idempotent´
#[sqlx::test(migrations = "../../migrations")]
async fn removing_twice_answers_the_same_and_archives_once(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "Once", "Only once.", &[]).await;
    let first = remove_post(&rig, &ada, &id).await;
    let mark = read_post(&rig, &id).await["removal"].clone();
    let units = archive_units(&rig.pool).await;
    let versions = count(&rig.pool, "SELECT COUNT(*) FROM post_versions").await;

    let second = remove_post(&rig, &ada, &id).await;
    assert_eq!(second["records"], first["records"]);
    assert_eq!(archive_units(&rig.pool).await, units);
    assert_eq!(
        count(&rig.pool, "SELECT COUNT(*) FROM post_versions").await,
        versions,
        "no second tombstone"
    );
    assert_eq!(read_post(&rig, &id).await["removal"], mark);
}

/// A removed post's pictures are held — they belong to the archive —
/// unless another live placement still shows them.
///
/// A removed post's pictures are held unless another placement still shows them.
/// ´claim:removal:pictures-held-unless-placed-elsewhere´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removed_posts_pictures_are_held_unless_another_placement_shows_them(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let only_here = asset(&rig.pool, ada.id, 0x31).await;
    let shared = asset(&rig.pool, ada.id, 0x32).await;
    let id = post(&rig, &ada, "Two", "Two pictures.", &[only_here, shared]).await;
    let other = post(&rig, &ada, "Again", "One of them again.", &[shared]).await;

    remove_post(&rig, &ada, &id).await;
    let held = |media: Uuid| {
        let pool = rig.pool.clone();
        async move {
            sqlx::query_scalar::<_, bool>(
                "SELECT held_at IS NOT NULL FROM media_attachments WHERE id = $1",
            )
            .bind(media)
            .fetch_one(&pool)
            .await
            .expect("asset")
        }
    };
    assert!(held(only_here).await, "its last placement is gone");
    assert!(!held(shared).await, "another post still shows it");
    assert_eq!(
        read_post(&rig, &other).await["attachments"][0]["id"],
        shared.to_string()
    );
}

/// The author still holds the file: uploading it again after the removal
/// mints a fresh live asset rather than resolving to the held one, whose
/// bytes no reader can be served — and the held one's id can no longer be
/// attached.
///
/// Re-uploading a removed picture mints a fresh live asset.
/// ´claim:removal:a-re-upload-mints-fresh´
#[sqlx::test(migrations = "../../migrations")]
async fn re_uploading_a_removed_picture_mints_a_fresh_live_asset(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let uploaded = rig
        .upload_media_raw(&ada.token, &rig::photo_with_location())
        .await;
    let first: Uuid = uploaded["data"]["uploadMedia"]["media"]["id"]
        .as_str()
        .expect("uploaded")
        .parse()
        .expect("uuid");
    let id = post(&rig, &ada, "Photo", "A photo.", &[first]).await;
    remove_post(&rig, &ada, &id).await;
    let (held, area): (bool, String) =
        sqlx::query_as("SELECT held_at IS NOT NULL, area FROM media_attachments WHERE id = $1")
            .bind(first)
            .fetch_one(&rig.pool)
            .await
            .expect("asset");
    assert!(held);
    assert_eq!(area, "held", "its bytes left the live store");

    let again = rig
        .upload_media_raw(&ada.token, &rig::photo_with_location())
        .await;
    let second: Uuid = again["data"]["uploadMedia"]["media"]["id"]
        .as_str()
        .expect("uploaded again")
        .parse()
        .expect("uuid");
    assert_ne!(second, first, "a fresh asset, not the held one");
    let fresh_area: String = sqlx::query_scalar("SELECT area FROM media_attachments WHERE id = $1")
        .bind(second)
        .fetch_one(&rig.pool)
        .await
        .expect("fresh");
    assert_eq!(fresh_area, "live");
    let reposted = post(&rig, &ada, "Photo again", "The same photo.", &[second]).await;
    assert_eq!(
        read_post(&rig, &reposted).await["attachments"][0]["id"],
        second.to_string()
    );

    let refused = rig
        .gql(
            Some(&ada.token),
            PREPARE_POST,
            json!({ "input": {
                "title": "Held",
                "description": "The held one.",
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "pDirected": 0.1,
                "attachments": [{ "mediaId": first.to_string(), "displayOrder": 0 }],
            }}),
        )
        .await;
    assert_eq!(
        refused["preparePost"]["userErrors"][0]["code"], "BAD_INPUT",
        "{refused}"
    );
}

/// A removed post never matches search.
///
/// A removed post leaves search.
/// ´claim:removal:a-removed-post-leaves-search´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removed_post_leaves_search(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "Quincefield notes", "About quinces.", &[]).await;
    const SEARCH: &str = r#"query($query: String!) {
      search(query: $query, kinds: [POST]) { edges { node { ... on Post { id } } } }
    }"#;
    let hits = |found: Value| {
        found["search"]["edges"]
            .as_array()
            .expect("edges")
            .iter()
            .map(|e| e["node"]["id"].clone())
            .collect::<Vec<_>>()
    };
    let before = rig
        .gql(None, SEARCH, json!({ "query": "quincefield" }))
        .await;
    assert_eq!(hits(before), vec![json!(id)]);

    remove_post(&rig, &ada, &id).await;
    let after = rig
        .gql(None, SEARCH, json!({ "query": "quincefield" }))
        .await;
    assert_eq!(hits(after), Vec::<Value>::new());
}

/// A removed comment is still structure: a stance still lands on it, and
/// a reply to it is still accepted.
///
/// A stance and a reply still land on a removed comment.
/// ´claim:removal:a-removed-comment-is-still-structure´
#[sqlx::test(migrations = "../../migrations")]
async fn a_stance_still_lands_on_a_removed_comment(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Thread", "Talk.", &[]).await;
    let c = comment(&rig, &bo, &p, "Bo's words.").await;
    remove_comment(&rig, &bo, &c).await;

    let stance = rig
        .gql(
            Some(&ada.token),
            PREPARE_STANCE,
            json!({ "input": { "target": c, "pDirected": 0.5, "pInterest": 0.5 }}),
        )
        .await;
    no_errors(&stance["prepareStance"]);
    rig.sign_prepared(&ada.token, &ada.key, &stance["prepareStance"]["writes"])
        .await;
    rig.close_and_ingest().await;
    let landed: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM staged_writes WHERE actor_id = $1 AND family = 'opinion'
           AND state = 'landed'",
    )
    .bind(ada.id)
    .fetch_one(&rig.pool)
    .await
    .expect("the stance");
    assert_eq!(landed, 1);
}

/// The reply half: a reply to a removed comment is accepted and reads
/// under it.
///
/// A reply to a removed comment is accepted.
/// ´claim:removal:a-reply-to-a-removed-comment-is-accepted´
#[sqlx::test(migrations = "../../migrations")]
async fn a_reply_to_a_removed_comment_is_accepted(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Thread", "Talk.", &[]).await;
    let c = comment(&rig, &bo, &p, "Bo's words.").await;
    remove_comment(&rig, &bo, &c).await;

    let reply = comment(&rig, &ada, &c, "Still answering.").await;
    let read = read_comment(&rig, &c).await;
    assert_eq!(read["replies"]["edges"][0]["node"]["id"], reply.as_str());
}

/// An account sweep reaching a post its author already removed archives
/// nothing new, and the mark keeps saying the author removed it.
///
/// An account sweep over a removed post keeps it removed by its author.
/// ´claim:removal:an-account-sweep-keeps-by-author´
#[sqlx::test(migrations = "../../migrations")]
async fn an_account_sweep_over_a_removed_post_keeps_by_author(pool: PgPool) {
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let id = post(&rig, &ada, "Mine", "Words.", &[]).await;
    remove_post(&rig, &ada, &id).await;
    let units = archive_units(&rig.pool).await;

    let boundary = StandInBoundary(rig.standin.clone());
    let areas = MediaAreas::in_memory();
    let by = ada.id.to_string();
    let acts = acts_of(&rig.pool, ada.id).await;
    let sweep: Vec<Redaction<'_>> = acts
        .iter()
        .map(|act| Redaction {
            actor_id: ada.id,
            act_id: act,
            reason: "user-account-deletion",
            redacted_by: &by,
        })
        .collect();
    let done = redaction::redact(&boundary, &rig.pool, &areas, &sweep)
        .await
        .expect("sweeps");
    assert!(done.iter().all(|d| d.archived.is_none()));
    assert_eq!(archive_units(&rig.pool).await, units);
    assert_eq!(read_post(&rig, &id).await["removal"]["by"], "AUTHOR");
}

/// The slice-8 rider: a redaction holds one pooled connection per act. On
/// a pool of one, the engine's reads run on its own transaction — the
/// reads that went to the pool waited on the connection the transaction
/// held until the pool timed out — and two removals at once both finish.
///
/// A redaction holds one pooled connection per act.
/// ´claim:removal:one-connection-per-act´
#[sqlx::test(migrations = "../../migrations")]
async fn redaction_holds_one_connection_per_act(options: PgPoolOptions, connect: PgConnectOptions) {
    let pool = options.connect_with(connect.clone()).await.expect("pool");
    let rig = rig(pool);
    let ada = member(&rig, "ada").await;
    let a = asset(&rig.pool, ada.id, 0x41).await;
    let first = post(&rig, &ada, "One", "First.", &[a]).await;
    let second = post(&rig, &ada, "Two", "Second.", &[]).await;
    let third = post(&rig, &ada, "Three", "Third.", &[]).await;
    let genesis = |id: String| {
        let rig = &rig;
        async move {
            read_post(rig, &id).await["genesisRecordId"]
                .as_str()
                .expect("record")
                .to_string()
        }
    };
    let (first, second, third) = (
        genesis(first).await,
        genesis(second).await,
        genesis(third).await,
    );

    let one = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(5))
        .connect_with(connect)
        .await
        .expect("a pool of one");
    let by = ada.id.to_string();
    redaction::redact_act(
        &one,
        &Redaction {
            actor_id: ada.id,
            act_id: &first,
            reason: "user-content-removal",
            redacted_by: &by,
        },
    )
    .await
    .expect("the engine finishes on one connection");

    // The stand-in is a separate system behind the seam with its own
    // connections; the rider is about CoGra's engine, so only the engine
    // runs on the pool of one.
    let boundary = StandInBoundary(rig.standin.clone());
    let areas = MediaAreas::in_memory();
    let (left, right) = tokio::join!(
        api::removal::remove_content(&boundary, &one, &areas, ada.id, &second, true),
        api::removal::remove_content(&boundary, &one, &areas, ada.id, &third, true),
    );
    left.expect("the first removal finishes");
    right.expect("the second removal finishes");
}
