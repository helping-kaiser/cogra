//! The per-account signing budget (api-spec.md "Conventions" — the
//! signing budget), end to end through the real HTTP surface: every
//! class's window trips as a `WRITE_RULE_FAILED` userError, a batch is
//! priced whole and a refused one stages and spends nothing, the daily
//! backstop counts across classes, and the handshake legs that follow a
//! prepare are never budgeted. Requires a live Postgres (`make up`).
//!
//! Each test lowers the window it exercises through the config, leaving
//! every other window unlimited, except where the shipped threshold is
//! itself the subject.

use api::ratelimit::{RateLimitConfig, SigningBudget, Window};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::client::ActorKey;
use postgres_store::PgPool;
use serde_json::{Value, json};

mod rig;
use rig::WireRig;

const HOUR: f64 = 3600.0;

/// A config whose only finite limits are the signing windows given.
fn budget(set: impl FnOnce(&mut SigningBudget)) -> RateLimitConfig {
    let mut limits = RateLimitConfig::unlimited();
    set(&mut limits.signing);
    limits
}

fn window(limit: i32) -> Window {
    Window {
        limit,
        window_secs: HOUR,
    }
}

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) {
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

const PREPARE_POST_EDIT: &str = r#"mutation($input: PreparePostEditInput!) {
  preparePostEdit(input: $input) {
    writes { id canonicalProposal }
    userErrors { code message field }
  }
}"#;

const PREPARE_COMMENT_EDIT: &str = r#"mutation($input: PrepareCommentEditInput!) {
  prepareCommentEdit(input: $input) {
    writes { id canonicalProposal }
    userErrors { code message field }
  }
}"#;

const PREPARE_STANCE: &str = r#"mutation($input: PrepareStanceInput!) {
  prepareStance(input: $input) {
    writes { id canonicalProposal }
    userErrors { code message field }
  }
}"#;

const PREPARE_SEVERANCE: &str = r#"mutation($input: PrepareSeveranceInput!) {
  prepareSeverance(input: $input) {
    writes { id canonicalProposal }
    userErrors { code message field }
  }
}"#;

const APPROVE_APPLICANTS: &str = r#"mutation($input: ApproveApplicantsInput!) {
  approveApplicants(input: $input) {
    writes { id canonicalProposal }
    userErrors { code message field }
  }
}"#;

const STAGED_WRITES: &str =
    "query { me { stagedWrites(first: 50) { edges { node { id state } } } } }";

fn post(content: &str) -> Value {
    json!({ "input": {
        "content": content,
        "license": { "attribution": 0.0, "provenance": 0.0 },
    }})
}

fn tagged_post(content: &str, tags: &[&str]) -> Value {
    let tags: Vec<Value> = tags.iter().map(|t| json!({ "name": t })).collect();
    json!({ "input": {
        "content": content,
        "license": { "attribution": 0.0, "provenance": 0.0 },
        "tags": tags,
    }})
}

fn comment(target: &str, content: &str) -> Value {
    json!({ "input": {
        "target": target,
        "content": content,
        "license": { "attribution": 0.0, "provenance": 0.0 },
    }})
}

fn stance(target: &str) -> Value {
    json!({ "input": { "target": target, "pDirected": 1.0, "pInterest": 1.0 }})
}

/// The prepare's refusal codes, in order.
fn refusals(data: &Value, operation: &str) -> Vec<String> {
    data[operation]["userErrors"]
        .as_array()
        .expect("userErrors")
        .iter()
        .map(|e| e["code"].as_str().expect("code").to_string())
        .collect()
}

/// Asserts a prepare succeeded and returns its writes.
fn accepted<'a>(data: &'a Value, operation: &str) -> &'a Value {
    assert_eq!(
        refusals(data, operation),
        Vec::<String>::new(),
        "{operation} refused: {data}"
    );
    &data[operation]["writes"]
}

fn assert_budget_refusal(data: &Value, operation: &str) {
    assert_eq!(
        refusals(data, operation),
        vec!["WRITE_RULE_FAILED".to_string()],
        "{operation} should be refused by the signing budget: {data}"
    );
}

/// A member logged in, ready to act.
struct Member {
    key: ActorKey,
    token: String,
}

async fn member(rig: &WireRig, handle: &str) -> Member {
    let email = format!("{handle}@example.com");
    let (_, key) = rig.seed_member(handle, &email).await;
    let token = rig.log_in(&email).await;
    Member { key, token }
}

/// A post the member prepared, signed, and landed; returns its node id.
async fn landed_post(rig: &WireRig, author: &Member, content: &str) -> String {
    let data = rig
        .gql(Some(&author.token), PREPARE_POST, post(content))
        .await;
    let writes = accepted(&data, "preparePost").clone();
    rig.sign_prepared(&author.token, &author.key, &writes).await;
    rig.close_and_ingest().await;
    data["preparePost"]["node"]
        .as_str()
        .expect("node")
        .to_string()
}

/// The shipped post window is ten an hour — jakob's own example figure —
/// so ten posts prepare and the eleventh is refused.
///
/// A member's eleventh post inside an hour is refused as a write-rule failure, the shipped post budget being ten.
/// ´claim:ratelimit:the-shipped-post-budget-is-ten-an-hour´
#[sqlx::test(migrations = "../../migrations")]
async fn the_eleventh_post_in_an_hour_is_write_rule_failed(pool: PgPool) {
    let rig = WireRig::new(pool, budget(|b| b.post = SigningBudget::default().post));
    let author = member(&rig, "prolific").await;

    for n in 0..10 {
        let data = rig
            .gql(
                Some(&author.token),
                PREPARE_POST,
                post(&format!("post {n}")),
            )
            .await;
        accepted(&data, "preparePost");
    }
    let data = rig
        .gql(Some(&author.token), PREPARE_POST, post("one too many"))
        .await;
    assert_budget_refusal(&data, "preparePost");
}

/// The budget tiers as a write-rule refusal: no transport fault, the one
/// `WRITE_RULE_FAILED` code with no field to pin it to, no writes, and
/// nothing staged behind it — never the auth endpoints' `RATE_LIMITED`.
///
/// A signing-budget refusal is a whole-operation write-rule userError that stages nothing, never a transport fault.
/// ´claim:ratelimit:a-budget-refusal-is-a-write-rule-user-error´
#[sqlx::test(migrations = "../../migrations")]
async fn a_signing_budget_refusal_is_a_user_error_never_a_transport_fault(pool: PgPool) {
    let rig = WireRig::new(pool, budget(|b| b.post = window(0)));
    let author = member(&rig, "spent").await;

    let json = rig
        .gql_raw(Some(&author.token), PREPARE_POST, post("anything"))
        .await;
    assert!(json.get("errors").is_none(), "no transport fault: {json}");
    let error = &json["data"]["preparePost"]["userErrors"][0];
    assert_eq!(error["code"], "WRITE_RULE_FAILED", "{json}");
    assert_eq!(error["field"], Value::Null, "a whole-operation refusal");
    assert_eq!(json["data"]["preparePost"]["writes"], Value::Null);

    let staged = rig.gql(Some(&author.token), STAGED_WRITES, json!({})).await;
    assert_eq!(staged["me"]["stagedWrites"]["edges"], json!([]));
}

/// Comments spend their own window, independent of posts.
///
/// Comments spend a window of their own, and the one past it is refused as a write-rule failure.
/// ´claim:ratelimit:comments-spend-their-own-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn comment_budget_trips_as_write_rule_failed(pool: PgPool) {
    let rig = WireRig::new(pool, budget(|b| b.comment = window(2)));
    let author = member(&rig, "chatty").await;
    let target = landed_post(&rig, &author, "a thread to talk under").await;

    for n in 0..2 {
        let data = rig
            .gql(
                Some(&author.token),
                PREPARE_COMMENT,
                comment(&target, &format!("reply {n}")),
            )
            .await;
        accepted(&data, "prepareComment");
    }
    let data = rig
        .gql(
            Some(&author.token),
            PREPARE_COMMENT,
            comment(&target, "one reply too many"),
        )
        .await;
    assert_budget_refusal(&data, "prepareComment");
}

/// Post and Comment edits draw on one shared edit window.
///
/// Every edit, whatever it edits, draws on one shared edit budget.
/// ´claim:ratelimit:edits-share-one-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn edit_budget_trips_as_write_rule_failed(pool: PgPool) {
    let rig = WireRig::new(pool, budget(|b| b.edit = window(1)));
    let author = member(&rig, "reviser").await;
    let post_id = landed_post(&rig, &author, "first draft").await;
    let data = rig
        .gql(
            Some(&author.token),
            PREPARE_COMMENT,
            comment(&post_id, "an aside"),
        )
        .await;
    let comment_id = data["prepareComment"]["node"]
        .as_str()
        .expect("comment")
        .to_string();
    let writes = accepted(&data, "prepareComment").clone();
    rig.sign_prepared(&author.token, &author.key, &writes).await;
    rig.close_and_ingest().await;

    let data = rig
        .gql(
            Some(&author.token),
            PREPARE_POST_EDIT,
            json!({ "input": { "id": post_id, "content": "second draft" }}),
        )
        .await;
    accepted(&data, "preparePostEdit");
    let data = rig
        .gql(
            Some(&author.token),
            PREPARE_COMMENT_EDIT,
            json!({ "input": { "id": comment_id, "content": "a better aside" }}),
        )
        .await;
    assert_budget_refusal(&data, "prepareCommentEdit");
}

/// Severance is priced per counter-record. Two landed `(1, 1)` stances
/// spend two of three; netting them takes two counter-records, which the
/// third slot cannot carry, so the gesture is refused — and refused
/// whole, since a single further stance still fits.
///
/// Severance spends the stance budget once per counter-record, and a severance the budget cannot carry is refused whole without spending.
/// ´claim:ratelimit:severance-spends-per-counter-record´
#[sqlx::test(migrations = "../../migrations")]
async fn stance_budget_counts_severance_counter_records(pool: PgPool) {
    let rig = WireRig::new(pool, budget(|b| b.stance = window(3)));
    let author = member(&rig, "opinionated").await;
    let target = landed_post(&rig, &author, "something to hold a view on").await;

    for _ in 0..2 {
        let data = rig
            .gql(Some(&author.token), PREPARE_STANCE, stance(&target))
            .await;
        let writes = accepted(&data, "prepareStance").clone();
        rig.sign_prepared(&author.token, &author.key, &writes).await;
        rig.close_and_ingest().await;
    }

    let data = rig
        .gql(
            Some(&author.token),
            PREPARE_SEVERANCE,
            json!({ "input": { "target": target }}),
        )
        .await;
    assert_budget_refusal(&data, "prepareSeverance");

    let data = rig
        .gql(Some(&author.token), PREPARE_STANCE, stance(&target))
        .await;
    accepted(&data, "prepareStance");
}

/// A creation batch's topics spend the claim window, priced with the
/// minting post as one gesture. Four tags against a claim window of three
/// refuse the whole batch — no post staged, and the post window of one
/// left untouched, so a three-tag post then fits both.
///
/// A creation batch the claim budget cannot carry is refused entire, staging nothing and spending nothing of any window.
/// ´claim:ratelimit:a-batch-is-budgeted-whole´
#[sqlx::test(migrations = "../../migrations")]
async fn a_creation_batch_over_the_claim_budget_is_refused_whole_and_stages_nothing(pool: PgPool) {
    let rig = WireRig::new(
        pool,
        budget(|b| {
            b.post = window(1);
            b.claim = window(3);
        }),
    );
    let author = member(&rig, "tagger").await;

    let data = rig
        .gql(
            Some(&author.token),
            PREPARE_POST,
            tagged_post("four topics", &["one", "two", "three", "four"]),
        )
        .await;
    assert_budget_refusal(&data, "preparePost");
    let staged = rig.gql(Some(&author.token), STAGED_WRITES, json!({})).await;
    assert_eq!(
        staged["me"]["stagedWrites"]["edges"],
        json!([]),
        "a refused batch stages nothing"
    );

    let data = rig
        .gql(
            Some(&author.token),
            PREPARE_POST,
            tagged_post("three topics", &["one", "two", "three"]),
        )
        .await;
    let writes = accepted(&data, "preparePost");
    assert_eq!(writes.as_array().expect("writes").len(), 4);
}

/// The daily backstop counts every staged act whatever its class: a post,
/// then a post with one topic, fill a backstop of three, and a stance —
/// a class with room of its own — is refused.
///
/// The daily backstop counts every staged act across classes, refusing even a class whose own window has room.
/// ´claim:ratelimit:the-backstop-counts-across-classes´
#[sqlx::test(migrations = "../../migrations")]
async fn the_daily_backstop_trips_across_families(pool: PgPool) {
    let rig = WireRig::new(pool, budget(|b| b.any = window(3)));
    let author = member(&rig, "busy").await;
    let target = landed_post(&rig, &author, "act one").await;

    let data = rig
        .gql(
            Some(&author.token),
            PREPARE_POST,
            tagged_post("acts two and three", &["topic"]),
        )
        .await;
    accepted(&data, "preparePost");
    let data = rig
        .gql(Some(&author.token), PREPARE_STANCE, stance(&target))
        .await;
    assert_budget_refusal(&data, "prepareStance");
}

/// The handshake legs never consult the budget: a post that spends the
/// whole of it still seals, is approved, and lands, while the next
/// prepare is refused.
///
/// Only prepare spends the signing budget, so a write that spent the last of it still completes both signing legs and lands.
/// ´claim:ratelimit:the-handshake-is-never-budgeted´
#[sqlx::test(migrations = "../../migrations")]
async fn submit_and_approve_are_never_budgeted(pool: PgPool) {
    let rig = WireRig::new(
        pool,
        budget(|b| {
            b.post = window(1);
            b.any = window(1);
        }),
    );
    let author = member(&rig, "lastone").await;

    let data = rig
        .gql(Some(&author.token), PREPARE_POST, post("the last allowed"))
        .await;
    let writes = accepted(&data, "preparePost").clone();
    rig.sign_prepared(&author.token, &author.key, &writes).await;
    rig.close_and_ingest().await;

    let data = rig
        .gql(Some(&author.token), PREPARE_POST, post("over budget"))
        .await;
    assert_budget_refusal(&data, "preparePost");
}

/// An application ready for approval: registered through a fresh link of
/// the inviter's, email proven, key attached. Returns its id.
async fn approvable_application(rig: &WireRig, inviter: &Member, handle: &str) -> String {
    let link = rig
        .gql(
            Some(&inviter.token),
            "mutation($input: CreateInviteLinkInput!) {
               createInviteLink(input: $input) { inviteLink { id } userErrors { code } }
             }",
            json!({ "input": { "expiresAt": "2099-01-01T00:00:00Z" }}),
        )
        .await;
    let link = link["createInviteLink"]["inviteLink"]["id"]
        .as_str()
        .expect("link")
        .to_string();
    let email = format!("{handle}@example.com");
    let registered = rig
        .gql(
            None,
            "mutation($input: RegisterInput!) {
               register(input: $input) { auth { accessToken } userErrors { code } }
             }",
            json!({ "input": {
                "inviteLink": link,
                "handle": handle,
                "email": email,
                "password": "an applicant's password",
            }}),
        )
        .await;
    let token = registered["register"]["auth"]["accessToken"]
        .as_str()
        .expect("session")
        .to_string();
    let verification = rig.mailer.latest_token_for(&email);
    rig.gql(
        None,
        "mutation($input: VerifyEmailInput!) { verifyEmail(input: $input) { ok } }",
        json!({ "input": { "verificationToken": verification }}),
    )
    .await;
    let key = ActorKey::generate();
    let attached = rig
        .gql(
            Some(&token),
            "mutation($input: AttachActorKeyInput!) {
               attachActorKey(input: $input) {
                 user { application { id keyAttached } } userErrors { code }
               }
             }",
            json!({ "input": {
                "actorPubkey": B64.encode(key.public_key_bytes()),
                "realizationAddress": key.address(),
            }}),
        )
        .await;
    let application = &attached["attachActorKey"]["user"]["application"];
    assert_eq!(application["keyAttached"], true, "{attached}");
    application["id"].as_str().expect("application").to_string()
}

fn approvals(ids: &[&str]) -> Value {
    let approvals: Vec<Value> = ids
        .iter()
        .map(|id| json!({ "application": id, "pDirected": 0.1, "pInterest": 0.1 }))
        .collect();
    json!({ "input": { "approvals": approvals }})
}

/// Approvals spend their own window, per vouch: a batch of two against a
/// window of one is refused before either applicant is approved, and one
/// of them then fits.
///
/// Approvals spend a budget of their own per vouch, and a batch it cannot carry is refused before anyone is approved.
/// ´claim:ratelimit:approvals-spend-their-own-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn approval_budget_trips_as_write_rule_failed(pool: PgPool) {
    let rig = WireRig::new(
        pool,
        budget(|b| {
            b.approval = Window {
                limit: 1,
                window_secs: 86_400.0,
            }
        }),
    );
    let inviter = member(&rig, "sponsor").await;
    let first = approvable_application(&rig, &inviter, "joiner_one").await;
    let second = approvable_application(&rig, &inviter, "joiner_two").await;

    let data = rig
        .gql(
            Some(&inviter.token),
            APPROVE_APPLICANTS,
            approvals(&[&first, &second]),
        )
        .await;
    assert_budget_refusal(&data, "approveApplicants");

    let data = rig
        .gql(
            Some(&inviter.token),
            APPROVE_APPLICANTS,
            approvals(&[&first]),
        )
        .await;
    let writes = accepted(&data, "approveApplicants");
    assert_eq!(writes.as_array().expect("writes").len(), 1);
}
