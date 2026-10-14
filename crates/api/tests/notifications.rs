//! The notification list over the wire (notifications.md; api-spec.md
//! `User.notifications`, `User.hasUnreadNotifications`,
//! `markNotificationsSeen`, `markNotificationRead`): what mints a row and
//! what never does, one row per act, the idempotent ingestion writer, the
//! account-state transitions, the hidden-actor exclusion, the two levels of
//! read state, the keyset, the viewer-only read, and the seven refusals.
//!
//! Every act runs through the real HTTP surface and the stand-in, so a row
//! here is a row a device would read. One state has no verb yet and is
//! seeded by raw SQL: a hidden actor (`hideActor` is the hidden-actors
//! packet's) is a raw `user_hidden_actors` row, and a removal (the
//! moderation slice writes it) is a raw tombstone version. Requires a live
//! Postgres (`make up`).

mod rig;

use api::l1::L1Boundary;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::client::ActorKey;
use postgres_store::{PgPool, auth as store, mirror, notifications as notification_store};
use rig::WireRig;
use serde_json::{Value, json};
use uuid::Uuid;

fn unlimited(pool: PgPool) -> WireRig {
    WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited())
}

/// A seeded, funded member with a device key, logged in.
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

/// Signs every write of a prepare payload and lands them in one epoch.
async fn land(rig: &WireRig, who: &Member, writes: &Value) {
    rig.sign_prepared(&who.token, &who.key, writes).await;
    rig.close_and_ingest().await;
}

fn refused(payload: &Value) -> Vec<Value> {
    payload["userErrors"]
        .as_array()
        .cloned()
        .unwrap_or_default()
}

const LICENSE: &str = r#"{ "attribution": 1.0, "provenance": 0.0 }"#;

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) { node writes { id canonicalProposal } userErrors { code message } }
}"#;

const PREPARE_COMMENT: &str = r#"mutation($input: PrepareCommentInput!) {
  prepareComment(input: $input) { node writes { id canonicalProposal } userErrors { code message } }
}"#;

const PREPARE_COMMENT_EDIT: &str = r#"mutation($input: PrepareCommentEditInput!) {
  prepareCommentEdit(input: $input) { node writes { id canonicalProposal } userErrors { code message } }
}"#;

const PREPARE_REFERENCE: &str = r#"mutation($input: PrepareReferenceInput!) {
  prepareReference(input: $input) { writes { id canonicalProposal } userErrors { code message } }
}"#;

const WITHDRAW_REFERENCE: &str = r#"mutation($input: PrepareReferenceWithdrawalInput!) {
  prepareReferenceWithdrawal(input: $input) { writes { id canonicalProposal } userErrors { code message } }
}"#;

const PREPARE_STANCE: &str = r#"mutation($input: PrepareStanceInput!) {
  prepareStance(input: $input) { writes { id canonicalProposal } userErrors { code message } }
}"#;

const PREPARE_SEVERANCE: &str = r#"mutation($input: PrepareSeveranceInput!) {
  prepareSeverance(input: $input) { writes { id canonicalProposal } userErrors { code message } }
}"#;

const PREPARE_TAG: &str = r#"mutation($input: PrepareTagInput!) {
  prepareTag(input: $input) { writes { id canonicalProposal } userErrors { code message } }
}"#;

fn license() -> Value {
    serde_json::from_str(LICENSE).expect("license")
}

fn references(targets: &[&str]) -> Value {
    Value::Array(targets.iter().map(|t| json!({ "target": t })).collect())
}

/// A post by `who`, carrying `refs`, landed. Returns its id.
async fn post(rig: &WireRig, who: &Member, title: &str, refs: Value) -> String {
    let prepared = rig
        .gql(
            Some(&who.token),
            PREPARE_POST,
            json!({ "input": {
                "title": title, "content": "a body", "license": license(), "references": refs,
            }}),
        )
        .await;
    let payload = &prepared["preparePost"];
    assert_eq!(refused(payload), Vec::<Value>::new(), "{prepared}");
    land(rig, who, &payload["writes"]).await;
    payload["node"].as_str().expect("node").to_string()
}

/// A comment by `who` on `target`, carrying `refs`, landed. Returns its id.
async fn comment(rig: &WireRig, who: &Member, target: &str, refs: Value) -> String {
    let prepared = rig
        .gql(
            Some(&who.token),
            PREPARE_COMMENT,
            json!({ "input": {
                "target": target, "content": "some words", "license": license(),
                "references": refs,
            }}),
        )
        .await;
    let payload = &prepared["prepareComment"];
    assert_eq!(refused(payload), Vec::<Value>::new(), "{prepared}");
    land(rig, who, &payload["writes"]).await;
    payload["node"].as_str().expect("node").to_string()
}

/// One standalone citation by `who` from `artifact` toward `target`, landed.
async fn cite(rig: &WireRig, who: &Member, artifact: &str, target: &str, support: f64) {
    let prepared = rig
        .gql(
            Some(&who.token),
            PREPARE_REFERENCE,
            json!({ "input": {
                "artifact": artifact, "target": target, "relevance": 0.5, "support": support,
            }}),
        )
        .await;
    let payload = &prepared["prepareReference"];
    assert_eq!(refused(payload), Vec::<Value>::new(), "{prepared}");
    land(rig, who, &payload["writes"]).await;
}

/// `who` withdraws their citation of `target` from `artifact`, landed.
async fn withdraw(rig: &WireRig, who: &Member, artifact: &str, target: &str) {
    let prepared = rig
        .gql(
            Some(&who.token),
            WITHDRAW_REFERENCE,
            json!({ "input": { "artifact": artifact, "target": target } }),
        )
        .await;
    let payload = &prepared["prepareReferenceWithdrawal"];
    assert_eq!(refused(payload), Vec::<Value>::new(), "{prepared}");
    land(rig, who, &payload["writes"]).await;
}

/// One stance record by `who` toward `target`, landed.
async fn opine(rig: &WireRig, who: &Member, target: Uuid, p_d: f64, p_i: f64) {
    let prepared = rig
        .gql(
            Some(&who.token),
            PREPARE_STANCE,
            json!({ "input": { "target": target, "pDirected": p_d, "pInterest": p_i } }),
        )
        .await;
    let payload = &prepared["prepareStance"];
    assert_eq!(refused(payload), Vec::<Value>::new(), "{prepared}");
    land(rig, who, &payload["writes"]).await;
}

/// `who` severs their bundle toward `target`, landed.
async fn sever(rig: &WireRig, who: &Member, target: Uuid) {
    let prepared = rig
        .gql(
            Some(&who.token),
            PREPARE_SEVERANCE,
            json!({ "input": { "target": target } }),
        )
        .await;
    let payload = &prepared["prepareSeverance"];
    assert_eq!(refused(payload), Vec::<Value>::new(), "{prepared}");
    land(rig, who, &payload["writes"]).await;
}

const READ: &str = r#"query($first: Int, $after: String) {
  me {
    id
    hasUnreadNotifications
    notifications(first: $first, after: $after) {
      totalCount
      pageInfo { hasNextPage endCursor }
      edges { cursor node {
        id kind createdAt readAt
        actor { handle }
        subject { __typename ... on Post { id } ... on Comment { id } ... on User { id } }
        context { __typename ... on Post { id } ... on Comment { id } ... on User { id } }
        record { id family pDirected pInterest }
        application { id }
      } }
    }
  }
}"#;

const MARK_SEEN: &str = r#"mutation($input: MarkNotificationsSeenInput!) {
  markNotificationsSeen(input: $input) { hasUnreadNotifications userErrors { code } }
}"#;

const MARK_READ: &str = r#"mutation($input: MarkNotificationReadInput!) {
  markNotificationRead(input: $input) { notification { id readAt } userErrors { code } }
}"#;

/// The viewer's `me` with its first page of 50.
async fn read(rig: &WireRig, token: &str) -> Value {
    read_page(rig, token, 50, None).await
}

async fn read_page(rig: &WireRig, token: &str, first: i64, after: Option<&str>) -> Value {
    rig.gql(Some(token), READ, json!({ "first": first, "after": after }))
        .await["me"]
        .clone()
}

fn rows(me: &Value) -> Vec<Value> {
    me["notifications"]["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|e| e["node"].clone())
        .collect()
}

fn kinds(me: &Value) -> Vec<String> {
    rows(me)
        .iter()
        .map(|r| r["kind"].as_str().expect("kind").to_string())
        .collect()
}

fn ids(me: &Value) -> Vec<String> {
    rows(me)
        .iter()
        .map(|r| r["id"].as_str().expect("id").to_string())
        .collect()
}

async fn kinds_of(rig: &WireRig, token: &str) -> Vec<String> {
    kinds(&read(rig, token).await)
}

/// The transport error code a raw response carries, if any.
fn transport_code(json: &Value) -> Option<String> {
    json["errors"][0]["extensions"]["code"]
        .as_str()
        .map(str::to_string)
}

async fn mark_seen(rig: &WireRig, token: &str, through: &str) -> Value {
    rig.gql(
        Some(token),
        MARK_SEEN,
        json!({ "input": { "through": through } }),
    )
    .await["markNotificationsSeen"]
        .clone()
}

async fn hide(pool: &PgPool, viewer: Uuid, hidden: Uuid) {
    sqlx::query("INSERT INTO user_hidden_actors (viewer_id, hidden_id) VALUES ($1, $2)")
        .bind(viewer)
        .bind(hidden)
        .execute(pool)
        .await
        .expect("hide");
}

async fn unhide(pool: &PgPool, viewer: Uuid, hidden: Uuid) {
    sqlx::query("DELETE FROM user_hidden_actors WHERE viewer_id = $1 AND hidden_id = $2")
        .bind(viewer)
        .bind(hidden)
        .execute(pool)
        .await
        .expect("unhide");
}

const CREATE_INVITE_LINK: &str = "mutation($input: CreateInviteLinkInput!) {
    createInviteLink(input: $input) { inviteLink { id } userErrors { code } }
}";

const REGISTER: &str = "mutation($input: RegisterInput!) {
    register(input: $input) { auth { accessToken user { id } } userErrors { code field } }
}";

const MY_APPLICATION: &str =
    "query { me { accountState askLink application { id approver { handle } } } }";

const APPROVE: &str = "mutation($input: ApproveApplicantsInput!) {
    approveApplicants(input: $input) { writes { id family canonicalProposal } userErrors { code field message } }
}";

const STAGE: &str = "mutation($input: StageApplicantInput!) {
    stageApplicant(input: $input) { application { id } userErrors { code field message } }
}";

async fn new_link(rig: &WireRig, token: &str) -> String {
    rig.gql(
        Some(token),
        CREATE_INVITE_LINK,
        json!({ "input": { "expiresAt": "2099-01-01T00:00:00Z", "singleUse": false } }),
    )
    .await["createInviteLink"]["inviteLink"]["id"]
        .as_str()
        .expect("link")
        .to_string()
}

/// One registered applicant: its account, session, registration
/// application and ask link.
struct Applicant {
    id: Uuid,
    handle: String,
    token: String,
    application: String,
    ask_link: String,
}

async fn applicant_through(rig: &WireRig, link: &str, handle: &str) -> Applicant {
    let registered = rig
        .gql(
            None,
            REGISTER,
            json!({ "input": {
                "inviteLink": link,
                "handle": handle,
                "email": format!("{handle}@example.com"),
                "password": "an applicant password",
            }}),
        )
        .await;
    let token = registered["register"]["auth"]["accessToken"]
        .as_str()
        .unwrap_or_else(|| panic!("registers: {registered}"))
        .to_string();
    let id = registered["register"]["auth"]["user"]["id"]
        .as_str()
        .expect("user")
        .parse()
        .expect("uuid");
    let me = rig.gql(Some(&token), MY_APPLICATION, json!({})).await;
    Applicant {
        id,
        handle: handle.to_string(),
        token,
        application: me["me"]["application"]["id"]
            .as_str()
            .expect("application")
            .to_string(),
        ask_link: me["me"]["askLink"].as_str().expect("ask link").to_string(),
    }
}

async fn applicant(rig: &WireRig, issuer: &Member, handle: &str) -> Applicant {
    let link = new_link(rig, &issuer.token).await;
    applicant_through(rig, &link, handle).await
}

async fn verify(rig: &WireRig, who: &Applicant) {
    let token = rig
        .mailer
        .latest_token_for(&format!("{}@example.com", who.handle));
    let verified = rig
        .gql(
            None,
            "mutation($input: VerifyEmailInput!) { verifyEmail(input: $input) { ok } }",
            json!({ "input": { "verificationToken": token } }),
        )
        .await;
    assert_eq!(verified["verifyEmail"]["ok"], true, "{verified}");
}

async fn attach(rig: &WireRig, who: &Applicant) -> ActorKey {
    let key = ActorKey::generate();
    let attached = rig
        .gql(
            Some(&who.token),
            "mutation($input: AttachActorKeyInput!) {
               attachActorKey(input: $input) { userErrors { code } }
             }",
            json!({ "input": {
                "actorPubkey": B64.encode(key.public_key_bytes()),
                "realizationAddress": key.address(),
            }}),
        )
        .await;
    assert_eq!(
        attached["attachActorKey"]["userErrors"],
        json!([]),
        "{attached}"
    );
    key
}

/// Both approvability proofs; the attached key.
async fn prove(rig: &WireRig, who: &Applicant) -> ActorKey {
    verify(rig, who).await;
    attach(rig, who).await
}

/// The approver's decision on one application; the payload.
async fn decide(rig: &WireRig, approver: &Member, application: &str) -> Value {
    let approved = rig
        .gql(
            Some(&approver.token),
            APPROVE,
            json!({ "input": { "approvals": [{
                "application": application, "pDirected": 0.5, "pInterest": 0.1,
            }]}}),
        )
        .await["approveApplicants"]
        .clone();
    assert_eq!(approved["userErrors"], json!([]), "{approved}");
    approved
}

/// The decision and the voucher's signing of the vouch Opinion.
async fn vouch(rig: &WireRig, approver: &Member, application: &str) {
    let approved = decide(rig, approver, application).await;
    rig.sign_prepared(&approver.token, &approver.key, &approved["writes"])
        .await;
}

/// The applicant signs its admission Registration, and the epoch lands.
async fn sign_registration_and_land(rig: &WireRig, who: &Applicant, key: &ActorKey) {
    let view = rig
        .gql(
            Some(&who.token),
            "query { me { stagedWrites(first: 5) { edges { node {
                 id family canonicalProposal } } } } }",
            json!({}),
        )
        .await;
    let registration = view["me"]["stagedWrites"]["edges"]
        .as_array()
        .expect("staged")
        .iter()
        .map(|e| e["node"].clone())
        .find(|n| n["family"] == "REGISTRATION")
        .expect("the admission Registration is staged");
    rig.sign_prepared(&who.token, key, &json!([registration]))
        .await;
    rig.close_and_ingest().await;
}

async fn stage(rig: &WireRig, approver: &Member, ask_link: &str) -> String {
    let staged = rig
        .gql(
            Some(&approver.token),
            STAGE,
            json!({ "input": { "askLink": ask_link } }),
        )
        .await["stageApplicant"]
        .clone();
    assert_eq!(staged["userErrors"], json!([]), "{staged}");
    staged["application"]["id"]
        .as_str()
        .expect("application")
        .to_string()
}

fn of_kind(me: &Value, kind: &str) -> Vec<Value> {
    rows(me).into_iter().filter(|r| r["kind"] == kind).collect()
}

/// Marking the list seen without a session is a transport-tier UNAUTHENTICATED.
/// ´claim:notifications:marking-seen-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn marking_seen_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = unlimited(pool);
    let raw = rig
        .gql_raw(
            None,
            MARK_SEEN,
            json!({ "input": { "through": "2026-01-01T00:00:00Z" } }),
        )
        .await;
    assert_eq!(transport_code(&raw).as_deref(), Some("UNAUTHENTICATED"));
}

/// Marking a row read without a session is a transport-tier UNAUTHENTICATED.
/// ´claim:notifications:marking-read-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn marking_read_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = unlimited(pool);
    let raw = rig
        .gql_raw(
            None,
            MARK_READ,
            json!({ "input": { "notification": Uuid::new_v4() } }),
        )
        .await;
    assert_eq!(transport_code(&raw).as_deref(), Some("UNAUTHENTICATED"));
}

/// Marking an id that names no row read is NOT_FOUND.
/// ´claim:notifications:an-unknown-row-is-not-found´
#[sqlx::test(migrations = "../../migrations")]
async fn marking_an_unknown_row_read_is_not_found(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let raw = rig
        .gql_raw(
            Some(&ada.token),
            MARK_READ,
            json!({ "input": { "notification": Uuid::new_v4() } }),
        )
        .await;
    assert_eq!(transport_code(&raw).as_deref(), Some("NOT_FOUND"));
}

/// Another account's row reads as unknown, and the mark leaves it unread.
/// ´claim:notifications:a-foreign-row-is-not-found´
#[sqlx::test(migrations = "../../migrations")]
async fn marking_another_accounts_row_read_is_not_found(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, json!([])).await;
    let adas = ids(&read(&rig, &ada.token).await);
    assert_eq!(adas.len(), 1);

    let raw = rig
        .gql_raw(
            Some(&bo.token),
            MARK_READ,
            json!({ "input": { "notification": adas[0] } }),
        )
        .await;
    assert_eq!(transport_code(&raw).as_deref(), Some("NOT_FOUND"));
    assert_eq!(
        rows(&read(&rig, &ada.token).await)[0]["readAt"],
        Value::Null
    );
}

/// A page over the budget's cap is BAD_INPUT.
/// ´claim:notifications:a-page-over-the-cap-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn notifications_over_the_page_cap_is_bad_input(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let raw = rig
        .gql_raw(Some(&ada.token), READ, json!({ "first": 101 }))
        .await;
    assert_eq!(transport_code(&raw).as_deref(), Some("BAD_INPUT"), "{raw}");
}

/// A cursor the list never issued is BAD_INPUT.
/// ´claim:notifications:a-malformed-cursor-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn notifications_with_a_malformed_cursor_is_bad_input(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let raw = rig
        .gql_raw(
            Some(&ada.token),
            READ,
            json!({ "first": 5, "after": "garbage" }),
        )
        .await;
    assert_eq!(transport_code(&raw).as_deref(), Some("BAD_INPUT"), "{raw}");
}

/// A seen pointer moved past every moment the list could hold is BAD_INPUT, and moves nothing.
/// ´claim:notifications:a-future-through-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn marking_seen_through_a_future_moment_is_bad_input(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let future = (chrono::Utc::now() + chrono::Duration::days(1)).to_rfc3339();
    let raw = rig
        .gql_raw(
            Some(&ada.token),
            MARK_SEEN,
            json!({ "input": { "through": future } }),
        )
        .await;
    assert_eq!(transport_code(&raw).as_deref(), Some("BAD_INPUT"), "{raw}");
    assert_eq!(
        notification_store::seen_at(&rig.pool, ada.id)
            .await
            .expect("seen"),
        None
    );
}

/// A comment on the viewer's post reports the comment, on the post, from its Review.
/// ´claim:notifications:a-comment-on-my-post-notifies-me´
#[sqlx::test(migrations = "../../migrations")]
async fn a_comment_on_my_post_notifies_me(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    let c = comment(&rig, &bo, &p, json!([])).await;

    let me = read(&rig, &ada.token).await;
    assert_eq!(kinds(&me), vec!["COMMENT"]);
    let row = &rows(&me)[0];
    assert_eq!(row["actor"]["handle"], "bo");
    assert_eq!(row["subject"]["__typename"], "Comment");
    assert_eq!(row["subject"]["id"], c.as_str());
    assert_eq!(row["context"]["id"], p.as_str());
    assert_eq!(row["record"]["family"], "REVIEW");
    assert_eq!(row["application"], Value::Null);
    assert_eq!(row["readAt"], Value::Null);
    assert_eq!(me["hasUnreadNotifications"], true);
}

/// A reply to the viewer's comment reports the reply, on that comment.
/// ´claim:notifications:a-reply-to-my-comment-notifies-me´
#[sqlx::test(migrations = "../../migrations")]
async fn a_reply_to_my_comment_notifies_me(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let cy = member(&rig, "cy").await;
    let p = post(&rig, &ada, "Thread", json!([])).await;
    let bos = comment(&rig, &bo, &p, json!([])).await;
    let reply = comment(&rig, &cy, &bos, json!([])).await;

    let me = read(&rig, &bo.token).await;
    assert_eq!(kinds(&me), vec!["REPLY"]);
    let row = &rows(&me)[0];
    assert_eq!(row["actor"]["handle"], "cy");
    assert_eq!(row["subject"]["id"], reply.as_str());
    assert_eq!(row["context"]["__typename"], "Comment");
    assert_eq!(row["context"]["id"], bos.as_str());
}

/// A reply deep in a thread reaches the replied-to comment's author only, never the post's author.
/// ´claim:notifications:a-reply-never-notifies-the-post-author´
#[sqlx::test(migrations = "../../migrations")]
async fn a_reply_never_notifies_the_post_author_as_a_comment(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let cy = member(&rig, "cy").await;
    let p = post(&rig, &ada, "Thread", json!([])).await;
    let bos = comment(&rig, &bo, &p, json!([])).await;
    comment(&rig, &cy, &bos, json!([])).await;

    let me = read(&rig, &ada.token).await;
    assert_eq!(kinds(&me), vec!["COMMENT"]);
    assert_eq!(rows(&me)[0]["actor"]["handle"], "bo");
}

/// A Reference toward a person's Profile is a mention, reported to that person on the citing post.
/// ´claim:notifications:a-mention-notifies-the-profile-owner´
#[sqlx::test(migrations = "../../migrations")]
async fn a_mention_notifies_the_profile_owner(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let q = post(&rig, &bo, "Hi Ada", references(&[&ada.id.to_string()])).await;

    let me = read(&rig, &ada.token).await;
    assert_eq!(kinds(&me), vec!["MENTION"]);
    let row = &rows(&me)[0];
    assert_eq!(row["actor"]["handle"], "bo");
    assert_eq!(row["subject"]["id"], q.as_str());
    assert_eq!(row["context"]["__typename"], "User");
    assert_eq!(row["context"]["id"], ada.id.to_string());
    assert_eq!(row["record"]["family"], "REFERENCE");
}

/// The decision funds and stages the Registration while the vouch stays
/// unsigned, so the Profile lands and the account stays an applicant.
///
/// An applicant is an addressee: a mention of its registered profile reaches it.
/// ´claim:notifications:an-applicant-is-mentioned´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_is_mentioned_and_notified(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let key = prove(&rig, &noa).await;
    decide(&rig, &mira, &noa.application).await;
    sign_registration_and_land(&rig, &noa, &key).await;
    let state = rig.gql(Some(&noa.token), MY_APPLICATION, json!({})).await;
    assert_eq!(state["me"]["accountState"], "APPLICANT");
    post(&rig, &mira, "Welcome", references(&[&noa.id.to_string()])).await;

    assert_eq!(kinds_of(&rig, &noa.token).await, vec!["MENTION"]);
}

/// A citation of the viewer's post reports the citing post, on the cited one.
/// ´claim:notifications:a-citation-of-my-post-notifies-me´
#[sqlx::test(migrations = "../../migrations")]
async fn a_citation_of_my_post_notifies_me(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Cited", json!([])).await;
    let q = post(&rig, &bo, "Citing", references(&[&p])).await;

    let me = read(&rig, &ada.token).await;
    assert_eq!(kinds(&me), vec!["CITATION"]);
    let row = &rows(&me)[0];
    assert_eq!(row["subject"]["id"], q.as_str());
    assert_eq!(row["context"]["id"], p.as_str());
}

/// A citation of the viewer's comment reports the citing artifact, on the cited comment.
/// ´claim:notifications:a-citation-of-my-comment-notifies-me´
#[sqlx::test(migrations = "../../migrations")]
async fn a_citation_of_my_comment_notifies_me(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &bo, "Host", json!([])).await;
    let adas = comment(&rig, &ada, &p, json!([])).await;
    let q = post(&rig, &bo, "Quoting", json!([])).await;
    cite(&rig, &bo, &q, &adas, 0.5).await;

    let me = read(&rig, &ada.token).await;
    assert_eq!(kinds(&me), vec!["CITATION"]);
    let row = &rows(&me)[0];
    assert_eq!(row["subject"]["id"], q.as_str());
    assert_eq!(row["context"]["__typename"], "Comment");
    assert_eq!(row["context"]["id"], adas.as_str());
}

/// An opinion on the viewer's profile reports its author, with the pair on its record.
/// ´claim:notifications:an-opinion-on-my-profile-notifies-me´
#[sqlx::test(migrations = "../../migrations")]
async fn an_opinion_on_my_profile_notifies_me(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    opine(&rig, &bo, ada.id, 0.5, 0.25).await;

    let me = read(&rig, &ada.token).await;
    assert_eq!(kinds(&me), vec!["PROFILE_OPINION"]);
    let row = &rows(&me)[0];
    assert_eq!(row["subject"]["__typename"], "User");
    assert_eq!(row["subject"]["id"], bo.id.to_string());
    assert_eq!(row["context"], Value::Null);
    assert_eq!(row["record"]["family"], "OPINION");
    assert_eq!(row["record"]["pDirected"], 0.5);
    assert_eq!(row["record"]["pInterest"], 0.25);
}

/// An opinion on the viewer's content is a reading, never a row.
/// ´claim:notifications:an-opinion-on-my-post-never-notifies´
#[sqlx::test(migrations = "../../migrations")]
async fn an_opinion_on_my_post_never_notifies(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    opine(&rig, &bo, p.parse().expect("uuid"), 0.5, 0.5).await;
    assert!(kinds_of(&rig, &ada.token).await.is_empty());
}

/// An edit of a comment is a Review that mints nothing, so it reports nothing.
/// ´claim:notifications:a-comment-edit-never-notifies´
#[sqlx::test(migrations = "../../migrations")]
async fn a_comment_edit_never_notifies(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    let c = comment(&rig, &bo, &p, json!([])).await;
    let edited = rig
        .gql(
            Some(&bo.token),
            PREPARE_COMMENT_EDIT,
            json!({ "input": { "id": c, "content": "better words" } }),
        )
        .await;
    let payload = &edited["prepareCommentEdit"];
    assert_eq!(refused(payload), Vec::<Value>::new(), "{edited}");
    land(&rig, &bo, &payload["writes"]).await;

    assert_eq!(kinds_of(&rig, &ada.token).await, vec!["COMMENT"]);
}

/// The closing ceremony's Registration reports nothing to anyone; the
/// voucher's one landing row is the transition's.
///
/// Tags, affinities, the author's own publishes and an admission Registration write no row.
/// ´claim:notifications:tags-affinities-publishes-and-registrations-never-notify´
#[sqlx::test(migrations = "../../migrations")]
async fn tags_affinities_publishes_and_registrations_never_notify(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    let tagged = rig
        .gql(
            Some(&bo.token),
            PREPARE_TAG,
            json!({ "input": { "target": p, "name": "gardening" } }),
        )
        .await;
    assert_eq!(
        refused(&tagged["prepareTag"]),
        Vec::<Value>::new(),
        "{tagged}"
    );
    land(&rig, &bo, &tagged["prepareTag"]["writes"]).await;
    let followed = rig
        .gql(
            Some(&bo.token),
            PREPARE_STANCE,
            json!({ "input": { "topicName": "gardening", "pDirected": 0.5, "pInterest": 0.5 } }),
        )
        .await;
    assert_eq!(
        refused(&followed["prepareStance"]),
        Vec::<Value>::new(),
        "{followed}"
    );
    land(&rig, &bo, &followed["prepareStance"]["writes"]).await;
    assert!(kinds_of(&rig, &ada.token).await.is_empty());
    assert!(kinds_of(&rig, &bo.token).await.is_empty());

    let noa = applicant(&rig, &ada, "noa").await;
    let key = prove(&rig, &noa).await;
    vouch(&rig, &ada, &noa.application).await;
    sign_registration_and_land(&rig, &noa, &key).await;
    assert_eq!(
        kinds_of(&rig, &ada.token).await,
        vec!["INVITE_LANDED", "APPLICATION_APPROVABLE"]
    );
}

/// Self-comment, self-opinion and its walk-back are ordinary acts that report nothing, and the table refuses a self row.
/// ´claim:notifications:my-own-acts-never-notify-me´
#[sqlx::test(migrations = "../../migrations")]
async fn my_own_acts_never_notify_me(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &ada, &p, references(&[&ada.id.to_string()])).await;
    opine(&rig, &ada, ada.id, 0.5, 0.5).await;
    sever(&rig, &ada, ada.id).await;
    assert!(kinds_of(&rig, &ada.token).await.is_empty());

    let self_row = sqlx::query(
        "INSERT INTO user_notifications (user_id, kind, actor_id, dedup_key)
         VALUES ($1, 'comment', $1, 'self')",
    )
    .bind(ada.id)
    .execute(&rig.pool)
    .await;
    assert!(self_row.is_err(), "the CHECK refuses a self row");
}

/// A comment that also mentions the post's author reports once, as the comment.
/// ´claim:notifications:a-comment-that-mentions-me-writes-one-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_comment_that_mentions_me_writes_one_comment_row(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, references(&[&ada.id.to_string()])).await;
    assert_eq!(kinds_of(&rig, &ada.token).await, vec!["COMMENT"]);
}

/// A post that mentions the viewer and cites their post reports once, as the citation.
/// ´claim:notifications:mention-and-citation-in-one-act-write-one-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_post_that_mentions_me_and_cites_my_post_writes_one_row(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    post(&rig, &bo, "Both", references(&[&ada.id.to_string(), &p])).await;
    assert_eq!(kinds_of(&rig, &ada.token).await, vec!["CITATION"]);
}

/// A citation hung off existing content later is its own act, and its own row.
/// ´claim:notifications:a-later-standalone-citation-is-its-own-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_later_standalone_citation_is_its_own_row(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    let q = post(&rig, &bo, "Hi Ada", references(&[&ada.id.to_string()])).await;
    cite(&rig, &bo, &q, &p, 0.5).await;
    assert_eq!(
        kinds_of(&rig, &ada.token).await,
        vec!["CITATION", "MENTION"]
    );
}

/// A revised opinion on the viewer's profile is a new act and a new row, wearing the new pair.
/// ´claim:notifications:a-revised-opinion-is-a-new-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_revised_opinion_is_a_new_row(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    opine(&rig, &bo, ada.id, 0.5, 0.5).await;
    opine(&rig, &bo, ada.id, -0.25, 0.75).await;

    let me = read(&rig, &ada.token).await;
    assert_eq!(kinds(&me), vec!["PROFILE_OPINION", "PROFILE_OPINION"]);
    assert_eq!(rows(&me)[0]["record"]["pDirected"], -0.25);
    assert_eq!(rows(&me)[0]["record"]["pInterest"], 0.75);
}

/// A revised citation of the viewer's post is a new act and a new row.
/// ´claim:notifications:a-revised-citation-is-a-new-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_revised_citation_is_a_new_row(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    let q = post(&rig, &bo, "Citing", references(&[&p])).await;
    cite(&rig, &bo, &q, &p, -0.5).await;
    assert_eq!(
        kinds_of(&rig, &ada.token).await,
        vec!["CITATION", "CITATION"]
    );
}

/// Withdrawing a citation nets its bundle to (0,0): the withdrawal row is the profile opinion's alone, so no row, and the earlier row stands.
/// ´claim:notifications:a-citation-withdrawal-never-notifies´
#[sqlx::test(migrations = "../../migrations")]
async fn a_citation_withdrawal_never_notifies(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    let q = post(&rig, &bo, "Citing", references(&[&p])).await;
    withdraw(&rig, &bo, &q, &p).await;
    assert_eq!(kinds_of(&rig, &ada.token).await, vec!["CITATION"]);
}

/// Severing an opinion on the viewer's profile reports the walk-back as its own row opening on the author's profile, and the earlier row stands.
/// ´claim:notifications:an-opinion-withdrawal-on-my-profile-notifies-me´
#[sqlx::test(migrations = "../../migrations")]
async fn an_opinion_withdrawal_on_my_profile_notifies_me(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    opine(&rig, &bo, ada.id, 0.5, 0.25).await;
    sever(&rig, &bo, ada.id).await;

    let me = read(&rig, &ada.token).await;
    assert_eq!(
        kinds(&me),
        vec!["PROFILE_OPINION_WITHDRAWN", "PROFILE_OPINION"]
    );
    let row = &rows(&me)[0];
    assert_eq!(row["actor"]["handle"], "bo");
    assert_eq!(row["subject"]["__typename"], "User");
    assert_eq!(row["subject"]["id"], bo.id.to_string());
    assert_eq!(row["context"], Value::Null);
    assert_eq!(row["application"], Value::Null);
    assert_eq!(row["record"]["family"], "OPINION");
    assert_eq!(row["record"]["pDirected"], -0.5);
    assert_eq!(row["record"]["pInterest"], -0.25);
    assert_eq!(rows(&me)[1]["record"]["pDirected"], 0.5);
    assert_eq!(me["hasUnreadNotifications"], true);
}

/// A walk-back signed as several counter-records that land together is one act and one row.
/// ´claim:notifications:a-multi-record-walk-back-writes-one-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_walk_back_of_several_counter_records_writes_one_row(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    opine(&rig, &bo, ada.id, 0.75, 0.75).await;
    opine(&rig, &bo, ada.id, 0.75, 0.75).await;
    sever(&rig, &bo, ada.id).await;
    assert_eq!(
        kinds_of(&rig, &ada.token).await,
        vec![
            "PROFILE_OPINION_WITHDRAWN",
            "PROFILE_OPINION",
            "PROFILE_OPINION"
        ]
    );
}

/// A walk-back of an opinion on the viewer's post is a reading walked back, never a row.
/// ´claim:notifications:an-opinion-withdrawal-on-my-post-never-notifies´
#[sqlx::test(migrations = "../../migrations")]
async fn an_opinion_withdrawal_on_my_post_never_notifies(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p: Uuid = post(&rig, &ada, "Mine", json!([]))
        .await
        .parse()
        .expect("uuid");
    opine(&rig, &bo, p, 0.5, 0.5).await;
    sever(&rig, &bo, p).await;
    assert!(kinds_of(&rig, &ada.token).await.is_empty());
}

/// An opinion given again after a walk-back is a new pointing: three acts, three rows, newest first.
/// ´claim:notifications:an-opinion-given-again-after-a-walk-back-is-a-new-row´
#[sqlx::test(migrations = "../../migrations")]
async fn an_opinion_given_again_after_a_walk_back_is_a_new_row(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    opine(&rig, &bo, ada.id, 0.5, 0.5).await;
    sever(&rig, &bo, ada.id).await;
    opine(&rig, &bo, ada.id, 0.25, 0.5).await;
    assert_eq!(
        kinds_of(&rig, &ada.token).await,
        vec![
            "PROFILE_OPINION",
            "PROFILE_OPINION_WITHDRAWN",
            "PROFILE_OPINION"
        ]
    );
}

/// A mirror rebuild re-ingests every epoch and writes nothing twice; rows keep their ids, times and read marks.
/// ´claim:notifications:a-rebuild-writes-no-duplicate-rows´
#[sqlx::test(migrations = "../../migrations")]
async fn rebuilding_the_mirror_writes_no_duplicate_rows(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, references(&[&ada.id.to_string()])).await;
    opine(&rig, &bo, ada.id, 0.5, 0.5).await;
    sever(&rig, &bo, ada.id).await;
    let before = read(&rig, &ada.token).await;
    let first = ids(&before)[0].clone();
    rig.gql(
        Some(&ada.token),
        MARK_READ,
        json!({ "input": { "notification": first } }),
    )
    .await;
    let before = notification_store::all_for(&rig.pool, ada.id)
        .await
        .expect("rows");

    mirror::reset(&rig.pool).await.expect("reset");
    api::ingest::ingest_pending(
        &api::l1::StandInBoundary(rig.standin.clone()),
        &rig.pool,
        api::ingest::DEFAULT_GC_AFTER_EPOCHS,
    )
    .await
    .expect("re-ingests");

    let after = notification_store::all_for(&rig.pool, ada.id)
        .await
        .expect("rows");
    assert_eq!(after, before);
    assert_eq!(after.len(), 3);
    assert!(after.iter().any(|r| r.read_at.is_some()));
}

/// Two epochs are published and the pass stops after the first; the next
/// pass resumes from the cursor.
///
/// Ingestion resumes from the cursor after a stop between epochs, and no epoch's rows are skipped or doubled.
/// ´claim:notifications:a-crash-between-epochs-skips-no-rows´
#[sqlx::test(migrations = "../../migrations")]
async fn a_crash_between_epochs_skips_no_rows(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    let first = rig
        .gql(
            Some(&bo.token),
            PREPARE_COMMENT,
            json!({ "input": { "target": p, "content": "one", "license": license() } }),
        )
        .await;
    rig.sign_prepared(&bo.token, &bo.key, &first["prepareComment"]["writes"])
        .await;
    rig.standin.close_epoch().await.expect("closes");
    let second = rig
        .gql(
            Some(&bo.token),
            PREPARE_STANCE,
            json!({ "input": { "target": ada.id, "pDirected": 0.5, "pInterest": 0.5 } }),
        )
        .await;
    rig.sign_prepared(&bo.token, &bo.key, &second["prepareStance"]["writes"])
        .await;
    rig.standin.close_epoch().await.expect("closes");
    let boundary = api::l1::StandInBoundary(rig.standin.clone());
    let cursor = mirror::last_ingested_epoch(&rig.pool)
        .await
        .expect("cursor");
    let packages = boundary.epochs_since(cursor).await.expect("packages");
    assert_eq!(packages.len(), 2);
    mirror::ingest_epoch(&rig.pool, &packages[0])
        .await
        .expect("first epoch");
    assert_eq!(kinds_of(&rig, &ada.token).await, vec!["COMMENT"]);

    api::ingest::ingest_pending(&boundary, &rig.pool, api::ingest::DEFAULT_GC_AFTER_EPOCHS)
        .await
        .expect("resumes");
    assert_eq!(
        kinds_of(&rig, &ada.token).await,
        vec!["PROFILE_OPINION", "COMMENT"]
    );
}

/// The second approvability proof notifies the path's approver, whichever proof comes second.
/// ´claim:notifications:approvability-notifies-the-approver´
#[sqlx::test(migrations = "../../migrations")]
async fn an_application_becoming_approvable_notifies_its_approver(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    verify(&rig, &noa).await;
    assert!(kinds_of(&rig, &mira.token).await.is_empty());
    attach(&rig, &noa).await;

    let me = read(&rig, &mira.token).await;
    assert_eq!(kinds(&me), vec!["APPLICATION_APPROVABLE"]);
    let row = &rows(&me)[0];
    assert_eq!(row["actor"]["handle"], "noa");
    assert_eq!(row["subject"], Value::Null);
    assert_eq!(row["record"], Value::Null);
    assert_eq!(row["application"]["id"], noa.application.as_str());

    let kel = member(&rig, "kel").await;
    let ivy = applicant(&rig, &kel, "ivy").await;
    attach(&rig, &ivy).await;
    assert!(kinds_of(&rig, &kel.token).await.is_empty());
    verify(&rig, &ivy).await;
    assert_eq!(
        kinds_of(&rig, &kel.token).await,
        vec!["APPLICATION_APPROVABLE"]
    );
}

/// Verifying and attaching at the same moment serialize on the account lock and notify exactly once.
/// ´claim:notifications:concurrent-proofs-notify-once´
#[sqlx::test(migrations = "../../migrations")]
async fn verifying_and_attaching_at_once_notify_once(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    tokio::join!(verify(&rig, &noa), attach(&rig, &noa));
    assert_eq!(
        kinds_of(&rig, &mira.token).await,
        vec!["APPLICATION_APPROVABLE"]
    );
}

/// Replacing an attached key never re-fires: the account was already approvable.
/// ´claim:notifications:a-key-replacement-never-renotifies´
#[sqlx::test(migrations = "../../migrations")]
async fn replacing_the_key_never_notifies_again(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    attach(&rig, &noa).await;
    assert_eq!(
        kinds_of(&rig, &mira.token).await,
        vec!["APPLICATION_APPROVABLE"]
    );
}

/// A member who stages an already-approvable account staged it knowingly: no row, even across a key replacement.
/// ´claim:notifications:a-later-path-is-never-notified´
#[sqlx::test(migrations = "../../migrations")]
async fn a_path_staged_after_approvability_never_notifies(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    stage(&rig, &kel, &noa.ask_link).await;
    attach(&rig, &noa).await;
    assert!(kinds_of(&rig, &kel.token).await.is_empty());
}

/// Every path waiting at approvability notifies its own approver.
/// ´claim:notifications:each-waiting-path-is-notified´
#[sqlx::test(migrations = "../../migrations")]
async fn each_waiting_path_s_approver_is_notified(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let kels = stage(&rig, &kel, &noa.ask_link).await;
    prove(&rig, &noa).await;

    let at_kel = read(&rig, &kel.token).await;
    assert_eq!(kinds(&at_kel), vec!["APPLICATION_APPROVABLE"]);
    assert_eq!(rows(&at_kel)[0]["application"]["id"], kels.as_str());
    let at_mira = read(&rig, &mira.token).await;
    assert_eq!(
        rows(&at_mira)[0]["application"]["id"],
        noa.application.as_str()
    );
}

/// The voucher's taken signing tells the applicant — at the relay, before anything lands.
/// ´claim:notifications:the-taken-signing-notifies-the-applicant´
#[sqlx::test(migrations = "../../migrations")]
async fn the_taken_signing_notifies_the_applicant(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    vouch(&rig, &mira, &noa.application).await;

    let me = read(&rig, &noa.token).await;
    assert_eq!(kinds(&me), vec!["APPLICATION_APPROVED"]);
    let row = &rows(&me)[0];
    assert_eq!(row["actor"]["handle"], "mira");
    assert_eq!(row["subject"]["id"], mira.id.to_string());
    assert_eq!(row["record"], Value::Null);
    assert_eq!(row["application"]["id"], noa.application.as_str());
}

/// A decision whose Opinion is never signed tells the applicant nothing.
/// ´claim:notifications:an-unsigned-decision-never-notifies´
#[sqlx::test(migrations = "../../migrations")]
async fn a_decision_never_signed_never_notifies(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    decide(&rig, &mira, &noa.application).await;
    assert!(kinds_of(&rig, &noa.token).await.is_empty());
}

/// The vouch Opinion is an ordinary opinion: its landing adds the ordinary profile-opinion row beside the approval (PR-60).
/// ´claim:notifications:the-vouch-opinion-is-an-ordinary-row´
#[sqlx::test(migrations = "../../migrations")]
async fn the_vouch_opinion_landing_writes_the_ordinary_opinion_row(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let key = prove(&rig, &noa).await;
    vouch(&rig, &mira, &noa.application).await;
    sign_registration_and_land(&rig, &noa, &key).await;

    let me = read(&rig, &noa.token).await;
    assert_eq!(kinds(&me), vec!["PROFILE_OPINION", "APPLICATION_APPROVED"]);
    let opinion = &of_kind(&me, "PROFILE_OPINION")[0];
    assert_eq!(opinion["actor"]["handle"], "mira");
    assert_eq!(opinion["record"]["pDirected"], 0.5);
}

/// A path re-vouched after a lapse reports the second vouch as its own row.
/// ´claim:notifications:a-re-vouch-is-a-new-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_re_vouch_after_a_lapse_is_a_new_row(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    vouch(&rig, &mira, &noa.application).await;

    sqlx::query("UPDATE auth_application_vouches SET lapsed_at = NOW()")
        .execute(&rig.pool)
        .await
        .expect("lapse");
    let mut tx = rig.pool.begin().await.expect("tx");
    assert!(store::lock_account(&mut tx, noa.id).await.expect("lock"));
    store::heal_unvouched_marks(&mut tx, noa.id)
        .await
        .expect("heals");
    tx.commit().await.expect("commit");
    vouch(&rig, &mira, &noa.application).await;

    assert_eq!(
        kinds_of(&rig, &noa.token).await,
        vec!["APPLICATION_APPROVED", "APPLICATION_APPROVED"]
    );
}

/// The landing tells the approver whose vouch landed it, with the admission Registration as its record.
/// ´claim:notifications:a-landing-notifies-its-approver´
#[sqlx::test(migrations = "../../migrations")]
async fn a_landing_notifies_the_approver_whose_vouch_landed_it(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let key = prove(&rig, &noa).await;
    vouch(&rig, &mira, &noa.application).await;
    sign_registration_and_land(&rig, &noa, &key).await;

    let me = read(&rig, &mira.token).await;
    let landed = of_kind(&me, "INVITE_LANDED");
    assert_eq!(landed.len(), 1, "{me}");
    let row = &landed[0];
    assert_eq!(row["actor"]["handle"], "noa");
    assert_eq!(row["subject"]["id"], noa.id.to_string());
    assert_eq!(row["record"]["family"], "REGISTRATION");
    assert_eq!(row["application"]["id"], noa.application.as_str());
}

/// With two vouches in play, only the approver whose edge completed the landing gets the landed row.
/// ´claim:notifications:only-the-winning-approver-gets-the-landed-row´
#[sqlx::test(migrations = "../../migrations")]
async fn only_the_winning_approver_gets_the_landed_row(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let key = prove(&rig, &noa).await;
    let kels = stage(&rig, &kel, &noa.ask_link).await;
    vouch(&rig, &mira, &noa.application).await;
    vouch(&rig, &kel, &kels).await;
    sign_registration_and_land(&rig, &noa, &key).await;

    let me = rig.gql(Some(&noa.token), MY_APPLICATION, json!({})).await;
    let winner = me["me"]["application"]["approver"]["handle"]
        .as_str()
        .expect("landed through someone")
        .to_string();
    let (won, lost) = if winner == "mira" {
        (&mira, &kel)
    } else {
        (&kel, &mira)
    };
    assert_eq!(
        of_kind(&read(&rig, &won.token).await, "INVITE_LANDED").len(),
        1
    );
    assert!(of_kind(&read(&rig, &lost.token).await, "INVITE_LANDED").is_empty());
    assert_eq!(
        of_kind(&read(&rig, &noa.token).await, "APPLICATION_APPROVED").len(),
        2,
        "both vouches were true acts"
    );
}

/// An ask-link landing tells the member who took the applicant up, not the link issuer.
/// ´claim:notifications:an-ask-link-landing-notifies-its-approver´
#[sqlx::test(migrations = "../../migrations")]
async fn an_ask_link_landing_notifies_its_approver(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let key = prove(&rig, &noa).await;
    let kels = stage(&rig, &kel, &noa.ask_link).await;
    vouch(&rig, &kel, &kels).await;
    sign_registration_and_land(&rig, &noa, &key).await;

    let at_kel = of_kind(&read(&rig, &kel.token).await, "INVITE_LANDED");
    assert_eq!(at_kel.len(), 1);
    assert_eq!(at_kel[0]["application"]["id"], kels.as_str());
    assert!(of_kind(&read(&rig, &mira.token).await, "INVITE_LANDED").is_empty());
}

/// A rejection tells the applicant who closed which application.
/// ´claim:notifications:a-rejection-notifies-the-applicant´
#[sqlx::test(migrations = "../../migrations")]
async fn a_rejection_notifies_the_applicant(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    let rejected = rig
        .gql(
            Some(&mira.token),
            "mutation($input: RejectApplicationInput!) {
               rejectApplication(input: $input) { userErrors { code } } }",
            json!({ "input": { "application": noa.application } }),
        )
        .await;
    assert_eq!(rejected["rejectApplication"]["userErrors"], json!([]));

    let me = read(&rig, &noa.token).await;
    assert_eq!(kinds(&me), vec!["APPLICATION_REJECTED"]);
    let row = &rows(&me)[0];
    assert_eq!(row["actor"]["handle"], "mira");
    assert_eq!(row["subject"], Value::Null);
    assert_eq!(row["application"]["id"], noa.application.as_str());
}

/// Closing a link's waiting queue is that many closes, each telling its own applicant.
/// ´claim:notifications:closing-a-queue-notifies-each-applicant´
#[sqlx::test(migrations = "../../migrations")]
async fn closing_a_links_queue_notifies_each_applicant(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let link = new_link(&rig, &mira.token).await;
    let noa = applicant_through(&rig, &link, "noa").await;
    let ivy = applicant_through(&rig, &link, "ivy").await;
    let swept = rig
        .gql(
            Some(&mira.token),
            "mutation($input: RejectLinkApplicationsInput!) {
               rejectLinkApplications(input: $input) { rejectedCount userErrors { code } } }",
            json!({ "input": { "inviteLink": link } }),
        )
        .await;
    assert_eq!(swept["rejectLinkApplications"]["rejectedCount"], 2);
    assert_eq!(
        kinds_of(&rig, &noa.token).await,
        vec!["APPLICATION_REJECTED"]
    );
    assert_eq!(
        kinds_of(&rig, &ivy.token).await,
        vec!["APPLICATION_REJECTED"]
    );
}

/// An applicant reads its own list and its bell like a member does.
/// ´claim:notifications:an-applicant-reads-its-notifications´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_reads_its_notifications(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    vouch(&rig, &mira, &noa.application).await;
    let me = read(&rig, &noa.token).await;
    assert_eq!(kinds(&me), vec!["APPLICATION_APPROVED"]);
    assert_eq!(me["hasUnreadNotifications"], true);
    assert_eq!(me["notifications"]["totalCount"], 1);
}

/// Reading notifications is not acting: an unverified applicant reads its closed application's row.
/// ´claim:notifications:an-unverified-applicant-reads-its-row´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unverified_applicant_reads_its_closed_application_row(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    rig.gql(
        Some(&mira.token),
        "mutation($input: RejectApplicationInput!) {
           rejectApplication(input: $input) { userErrors { code } } }",
        json!({ "input": { "application": noa.application } }),
    )
    .await;
    let me = read(&rig, &noa.token).await;
    assert_eq!(kinds(&me), vec!["APPLICATION_REJECTED"]);
    let first = ids(&me)[0].clone();
    let marked = rig
        .gql(
            Some(&noa.token),
            MARK_READ,
            json!({ "input": { "notification": first } }),
        )
        .await;
    assert_ne!(
        marked["markNotificationRead"]["notification"]["readAt"],
        Value::Null
    );
}

/// A hidden actor's rows leave the list, its count and the bell at once.
/// ´claim:notifications:a-hidden-actors-rows-leave-the-list-and-the-bell´
#[sqlx::test(migrations = "../../migrations")]
async fn a_hidden_actors_rows_leave_the_list_and_the_bell(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, json!([])).await;
    assert_eq!(read(&rig, &ada.token).await["hasUnreadNotifications"], true);

    hide(&rig.pool, ada.id, bo.id).await;
    let me = read(&rig, &ada.token).await;
    assert!(rows(&me).is_empty());
    assert_eq!(me["notifications"]["totalCount"], 0);
    assert_eq!(me["hasUnreadNotifications"], false);
}

/// Unhiding brings a hidden actor's rows back in their place.
/// ´claim:notifications:an-unhidden-actors-rows-return-in-place´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unhidden_actors_rows_return_in_their_place(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let cy = member(&rig, "cy").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, json!([])).await;
    comment(&rig, &cy, &p, json!([])).await;
    let all = ids(&read(&rig, &ada.token).await);

    hide(&rig.pool, ada.id, bo.id).await;
    assert_eq!(ids(&read(&rig, &ada.token).await), vec![all[0].clone()]);
    unhide(&rig.pool, ada.id, bo.id).await;
    assert_eq!(ids(&read(&rig, &ada.token).await), all);
}

/// Opening clears the bell and leaves every row's own unread emphasis.
/// ´claim:notifications:opening-clears-the-bell-not-the-rows´
#[sqlx::test(migrations = "../../migrations")]
async fn opening_clears_the_bell_but_not_the_rows(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, json!([])).await;
    let me = read(&rig, &ada.token).await;
    let newest = rows(&me)[0]["createdAt"].as_str().expect("at").to_string();

    let seen = mark_seen(&rig, &ada.token, &newest).await;
    assert_eq!(seen["hasUnreadNotifications"], false);
    let me = read(&rig, &ada.token).await;
    assert_eq!(me["hasUnreadNotifications"], false);
    assert_eq!(rows(&me)[0]["readAt"], Value::Null);
}

/// A row that arrives after the list was read stays unseen through the mark and lights the bell.
/// ´claim:notifications:a-row-after-the-read-still-lights-the-bell´
#[sqlx::test(migrations = "../../migrations")]
async fn a_row_arriving_after_the_list_was_read_still_lights_the_bell(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, json!([])).await;
    let held = read(&rig, &ada.token).await;
    let newest = rows(&held)[0]["createdAt"]
        .as_str()
        .expect("at")
        .to_string();
    opine(&rig, &bo, ada.id, 0.5, 0.5).await;

    let seen = mark_seen(&rig, &ada.token, &newest).await;
    assert_eq!(seen["hasUnreadNotifications"], true);
    assert_eq!(read(&rig, &ada.token).await["hasUnreadNotifications"], true);
}

/// The seen pointer only moves forward.
/// ´claim:notifications:marking-seen-never-moves-backwards´
#[sqlx::test(migrations = "../../migrations")]
async fn marking_seen_never_moves_backwards(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, json!([])).await;
    opine(&rig, &bo, ada.id, 0.5, 0.5).await;
    let me = read(&rig, &ada.token).await;
    let newest = rows(&me)[0]["createdAt"].as_str().expect("at").to_string();
    let oldest = rows(&me)[1]["createdAt"].as_str().expect("at").to_string();

    mark_seen(&rig, &ada.token, &newest).await;
    let after_newest = notification_store::seen_at(&rig.pool, ada.id)
        .await
        .expect("seen");
    let seen = mark_seen(&rig, &ada.token, &oldest).await;
    assert_eq!(seen["hasUnreadNotifications"], false);
    assert_eq!(
        notification_store::seen_at(&rig.pool, ada.id)
            .await
            .expect("seen"),
        after_newest
    );
}

/// A read row keeps its first readAt however often it is marked.
/// ´claim:notifications:marking-read-is-idempotent´
#[sqlx::test(migrations = "../../migrations")]
async fn marking_a_row_read_is_idempotent(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, json!([])).await;
    let id = ids(&read(&rig, &ada.token).await)[0].clone();
    let mark = || async {
        rig.gql(
            Some(&ada.token),
            MARK_READ,
            json!({ "input": { "notification": id } }),
        )
        .await["markNotificationRead"]["notification"]["readAt"]
            .clone()
    };
    let first = mark().await;
    assert_ne!(first, Value::Null);
    assert_eq!(mark().await, first);
    assert_eq!(rows(&read(&rig, &ada.token).await)[0]["readAt"], first);
}

/// The marks are private viewer state: neither stages a write nor reaches the mirror.
/// ´claim:notifications:marking-touches-no-graph´
#[sqlx::test(migrations = "../../migrations")]
async fn marking_writes_no_staged_write_and_no_record(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, json!([])).await;
    let count = |table: &'static str| {
        let pool = rig.pool.clone();
        async move {
            sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {table}"))
                .fetch_one(&pool)
                .await
                .expect("count")
        }
    };
    let (staged, records) = (count("staged_writes").await, count("mirror_records").await);
    let me = read(&rig, &ada.token).await;
    let newest = rows(&me)[0]["createdAt"].as_str().expect("at").to_string();
    mark_seen(&rig, &ada.token, &newest).await;
    rig.gql(
        Some(&ada.token),
        MARK_READ,
        json!({ "input": { "notification": ids(&me)[0] } }),
    )
    .await;
    assert_eq!(count("staged_writes").await, staged);
    assert_eq!(count("mirror_records").await, records);
}

/// The list reads newest first, one flat sequence.
/// ´claim:notifications:the-list-reads-newest-first´
#[sqlx::test(migrations = "../../migrations")]
async fn notifications_read_newest_first(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, json!([])).await;
    opine(&rig, &bo, ada.id, 0.5, 0.5).await;
    post(&rig, &bo, "Hi", references(&[&ada.id.to_string()])).await;

    let me = read(&rig, &ada.token).await;
    assert_eq!(kinds(&me), vec!["MENTION", "PROFILE_OPINION", "COMMENT"]);
    let times: Vec<chrono::DateTime<chrono::Utc>> = rows(&me)
        .iter()
        .map(|r| {
            r["createdAt"]
                .as_str()
                .expect("at")
                .parse()
                .expect("instant")
        })
        .collect();
    let mut sorted = times.clone();
    sorted.sort_unstable_by(|a, b| b.cmp(a));
    assert_eq!(times, sorted);
}

/// A row arriving while the reader scrolls sorts above the open page and never shifts the next one.
/// ´claim:notifications:a-mid-scroll-arrival-never-shifts-the-next-page´
#[sqlx::test(migrations = "../../migrations")]
async fn a_row_arriving_mid_scroll_never_shifts_the_next_page(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, json!([])).await;
    opine(&rig, &bo, ada.id, 0.5, 0.5).await;
    post(&rig, &bo, "Hi", references(&[&ada.id.to_string()])).await;
    let all = ids(&read(&rig, &ada.token).await);

    let first = read_page(&rig, &ada.token, 2, None).await;
    assert_eq!(ids(&first), all[..2].to_vec());
    let cursor = first["notifications"]["pageInfo"]["endCursor"]
        .as_str()
        .expect("cursor")
        .to_string();
    comment(&rig, &bo, &p, json!([])).await;

    let next = read_page(&rig, &ada.token, 2, Some(&cursor)).await;
    assert_eq!(ids(&next), all[2..].to_vec());
    assert_eq!(next["notifications"]["pageInfo"]["hasNextPage"], false);
}

/// Another reader and an anonymous one read a null list and a quiet bell.
/// ´claim:notifications:notifications-are-viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn notifications_are_viewer_only(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    comment(&rig, &bo, &p, json!([])).await;
    let query = r#"query { user(handle: "ada") {
        hasUnreadNotifications notifications(first: 5) { totalCount } } }"#;
    for token in [Some(bo.token.as_str()), None] {
        let read = rig.gql(token, query, json!({})).await;
        assert_eq!(read["user"]["notifications"], Value::Null, "{read}");
        assert_eq!(read["user"]["hasUnreadNotifications"], false);
    }
}

/// The reaper's twin is a never-verified applicant whose close told it.
///
/// An applicant deleting itself, or reaped unverified, takes the rows naming it — no FK wedges either.
/// ´claim:notifications:an-applicants-deletion-takes-its-rows´
#[sqlx::test(migrations = "../../migrations")]
async fn deleting_an_applicant_takes_their_approvable_row_with_them(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    assert_eq!(
        kinds_of(&rig, &mira.token).await,
        vec!["APPLICATION_APPROVABLE"]
    );
    let deleted = rig
        .gql(
            Some(&noa.token),
            "mutation { deleteApplicantAccount { ok userErrors { code } } }",
            json!({}),
        )
        .await;
    assert_eq!(deleted["deleteApplicantAccount"]["ok"], true, "{deleted}");
    assert!(kinds_of(&rig, &mira.token).await.is_empty());

    let ivy = applicant(&rig, &mira, "ivy").await;
    rig.gql(
        Some(&mira.token),
        "mutation($input: RejectApplicationInput!) {
           rejectApplication(input: $input) { userErrors { code } } }",
        json!({ "input": { "application": ivy.application } }),
    )
    .await;
    assert_eq!(
        notification_store::all_for(&rig.pool, ivy.id)
            .await
            .expect("rows")
            .len(),
        1
    );
    let reaped =
        store::reap_unverified_accounts(&rig.pool, chrono::Utc::now() + chrono::Duration::days(30))
            .await
            .expect("reaps");
    assert_eq!(reaped, 1);
    assert!(
        notification_store::all_for(&rig.pool, ivy.id)
            .await
            .expect("rows")
            .is_empty()
    );
}

/// A removed subject keeps its row, and reads its removal mark through the ordinary read path.
/// ´claim:notifications:a-removed-subject-keeps-its-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_removed_subject_keeps_its_row_and_reads_its_mark(pool: PgPool) {
    let rig = unlimited(pool);
    let ada = member(&rig, "ada").await;
    let bo = member(&rig, "bo").await;
    let p = post(&rig, &ada, "Mine", json!([])).await;
    let q = post(&rig, &bo, "Citing", references(&[&p])).await;
    sqlx::query(
        "INSERT INTO post_versions
             (post_id, title, content, redaction_reason, pending, created_at,
              landed_epoch, act_time, position)
         VALUES ($1, '[removed]', '[removed]', 'policy', FALSE, NOW() + INTERVAL '1 day',
                 999, 999, 0)",
    )
    .bind(Uuid::parse_str(&q).expect("uuid"))
    .execute(&rig.pool)
    .await
    .expect("tombstone");

    let me = rig
        .gql(
            Some(&ada.token),
            "query { me { notifications(first: 5) { edges { node {
                 kind subject { ... on Post { id title { status } } } } } } } }",
            json!({}),
        )
        .await;
    let node = &me["me"]["notifications"]["edges"][0]["node"];
    assert_eq!(node["kind"], "CITATION");
    assert_eq!(node["subject"]["id"], q.as_str());
    assert_eq!(node["subject"]["title"]["status"], "REDACTED");
}
