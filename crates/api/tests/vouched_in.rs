//! The people a member let in, over the wire (api-spec.md `User.vouchedIn`;
//! auth.md "Approval and landing"): every account whose admitting vouch —
//! the one its `invitedBy` names — is the viewer's, newest vouch first, on
//! the vouch record's key-of-record keyset, with the record's landing
//! instant beside it. A vouch on an account that never landed, and a later
//! vouch-Opinion on one that did, lists nothing; a walk-back and a deletion
//! since leave the admission standing; the list is the viewer's own.
//!
//! Every admission here runs through the real verbs: registration through
//! the voucher's link or a second member's take-up of the ask link, the
//! approval, both devices' signatures, and the epochs that land them.

mod rig;

use api::deletion;
use api::l1::StandInBoundary;
use api::media::MediaAreas;
use api::onboarding::{self, Approval, OnboardingConfig};
use api::prepare::Prepared;
use api::ratelimit::{RateLimitConfig, SigningBudget};
use common::l1::census::Family;
use common::l1::client::ActorKey;
use postgres_store::staged::{self, PreSignedParts, StagedState};
use postgres_store::{PgPool, auth as store};
use rig::{MEMBER_PASSWORD, WireRig};
use serde_json::{Value, json};
use uuid::Uuid;

const VOUCHED_IN: &str = r#"query($first: Int, $after: String, $last: Int, $before: String) {
  me {
    vouchedIn(first: $first, after: $after, last: $last, before: $before) {
      edges { cursor vouchedAt node { id ... on User { handle displayName { value status } } } }
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    }
  }
}"#;

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

/// A member with a device key and a session.
struct Member {
    id: Uuid,
    key: ActorKey,
    token: String,
}

/// A registered account: its device key, its session, its address.
struct Person {
    id: Uuid,
    key: ActorKey,
    token: String,
    email: String,
}

async fn member(rig: &WireRig, handle: &str) -> Member {
    let email = format!("{handle}@example.com");
    let (id, key) = rig.seed_member(handle, &email).await;
    let token = rig.log_in(&email).await;
    Member { id, key, token }
}

/// Registers through `inviter`'s link, verifies the address and attaches a
/// device key: an applicant on the registration path, nothing staged yet.
async fn applicant(rig: &WireRig, inviter: &Member, handle: &str) -> Person {
    let link = rig
        .gql(
            Some(&inviter.token),
            "mutation($input: CreateInviteLinkInput!) {
               createInviteLink(input: $input) { inviteLink { id } userErrors { code } }
             }",
            json!({ "input": { "expiresAt": "2099-01-01T00:00:00Z", "singleUse": false }}),
        )
        .await["createInviteLink"]["inviteLink"]["id"]
        .as_str()
        .expect("link")
        .to_string();
    let email = format!("{handle}@example.com");
    let registered = rig
        .gql(
            None,
            "mutation($input: RegisterInput!) {
               register(input: $input) { auth { accessToken } userErrors { code field } }
             }",
            json!({ "input": {
                "inviteLink": link, "handle": handle,
                "email": email, "password": MEMBER_PASSWORD,
            }}),
        )
        .await;
    let token = registered["register"]["auth"]["accessToken"]
        .as_str()
        .unwrap_or_else(|| panic!("registers: {registered}"))
        .to_string();
    let id: Uuid = sqlx::query_scalar("SELECT actor_id FROM user_credentials WHERE email = $1")
        .bind(&email)
        .fetch_one(&rig.pool)
        .await
        .expect("account");
    sqlx::query("UPDATE user_credentials SET email_verified_at = NOW() WHERE actor_id = $1")
        .bind(id)
        .execute(&rig.pool)
        .await
        .expect("verifies");
    let key = ActorKey::generate();
    onboarding::attach_actor_key(&rig.pool, id, key.public_key_bytes(), key.address())
        .await
        .expect("attaches");
    Person {
        id,
        key,
        token,
        email,
    }
}

async fn registration_path(rig: &WireRig, account: Uuid) -> Uuid {
    sqlx::query_scalar(
        "SELECT id FROM auth_applications WHERE account_id = $1 ORDER BY created_at LIMIT 1",
    )
    .bind(account)
    .fetch_one(&rig.pool)
    .await
    .expect("path")
}

/// A second path of `account`, in `owner`'s queue: `owner` takes the
/// account up from its ask link.
async fn ask_link_path(rig: &WireRig, account: Uuid, owner: &Member) -> Uuid {
    let ask_link = store::ask_link_of(&rig.pool, account)
        .await
        .expect("ask link read")
        .expect("an applicant has an ask link");
    onboarding::stage_applicant(&rig.pool, owner.id, ask_link)
        .await
        .expect("stages")
        .id
}

/// The voucher's decision on one path: the staged vouch-Opinion.
async fn vouch(rig: &WireRig, voucher: &Member, path: Uuid) -> Prepared {
    onboarding::approve_applicants(
        &rig.pool,
        &StandInBoundary(rig.standin.clone()),
        &OnboardingConfig::default(),
        &SigningBudget::UNLIMITED,
        voucher.id,
        &[Approval {
            application: path,
            p_d: 0.4,
            p_i: 0.2,
        }],
    )
    .await
    .unwrap_or_else(|e| panic!("approves: {e:?}"))
    .remove(0)
}

/// The device's two signing legs over one staged write.
async fn sign(rig: &WireRig, key: &ActorKey, staged_id: Uuid) {
    let boundary = StandInBoundary(rig.standin.clone());
    let write = staged::load(&rig.pool, staged_id).await.expect("loads");
    let pre = common::l1::proposal::PreSigned::sign(key, write.proposal.clone());
    let sealed =
        api::relay::submit_pre_signed(&boundary, &rig.pool, staged_id, PreSignedParts::from(&pre))
            .await
            .expect("seals");
    let host_key = rig.standin.host_public_key().await.expect("host key");
    let witness = pre.approve(key, &sealed, &host_key).expect("approves");
    api::relay::submit_approval(&boundary, &rig.pool, staged_id, witness.approval_signature)
        .await
        .expect("relays");
}

/// The applicant's device signs its admission Registration, and the epoch
/// lands it.
async fn land_registration(rig: &WireRig, person: &Person) {
    let registration = staged::list_for_actor(&rig.pool, person.id)
        .await
        .expect("lists")
        .into_iter()
        .find(|w| {
            w.proposal.body.family == Family::Registration
                && w.proposal.body.asserted_parents.is_empty()
                && w.state != StagedState::Expired
        })
        .expect("a staged admission Registration");
    sign(rig, &person.key, registration.id).await;
    rig.close_and_ingest().await;
}

/// The voucher's device signs the vouch, and the epoch lands it.
async fn land_vouch(rig: &WireRig, voucher: &Member, vouch: &Prepared) {
    sign(rig, &voucher.key, vouch.id).await;
    rig.close_and_ingest().await;
}

/// One admission end to end through `voucher`'s link: the account lands as
/// a member, vouched in by `voucher`.
async fn admit(rig: &WireRig, voucher: &Member, handle: &str) -> Person {
    let person = applicant(rig, voucher, handle).await;
    let decided = vouch(rig, voucher, registration_path(rig, person.id).await).await;
    land_registration(rig, &person).await;
    land_vouch(rig, voucher, &decided).await;
    let state: String =
        sqlx::query_scalar("SELECT account_state FROM user_credentials WHERE actor_id = $1")
            .bind(person.id)
            .fetch_one(&rig.pool)
            .await
            .expect("state");
    assert_eq!(state, "member", "{handle} landed");
    person
}

async fn page(rig: &WireRig, token: &str, variables: Value) -> Value {
    rig.gql(Some(token), VOUCHED_IN, variables).await["me"]["vouchedIn"].clone()
}

fn handles(page: &Value) -> Vec<String> {
    page["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .map(|e| e["node"]["handle"].as_str().expect("handle").to_string())
        .collect()
}

/// The landing instant of the record behind a staged vouch — what its
/// `Record.landedAt` reads.
async fn landed_at_of(rig: &WireRig, vouch: &Prepared) -> chrono::DateTime<chrono::Utc> {
    sqlx::query_scalar(
        "SELECT e.asserted_at FROM mirror_records m
         JOIN mirror_epochs e ON e.epoch = m.epoch WHERE m.record_id = $1",
    )
    .bind(vouch.proposal.body.act_id().to_string())
    .fetch_one(&rig.pool)
    .await
    .expect("landed vouch")
}

fn first_error_code(response: &Value) -> Option<&str> {
    response["errors"][0]["extensions"]["code"].as_str()
}

/// Two vouchers, three admitted people: each voucher lists exactly the
/// people their own vouch landed, newest vouch first, each with that vouch
/// record's landing instant. The person both members approved lists only
/// under the member whose vouch landed first; the later vouch is an
/// ordinary Opinion. An approved applicant whose admission has not landed
/// lists under no one.
///
/// Each voucher lists the people their own landing vouch let in, newest first, with the vouch's landing instant.
/// ´claim:onboarding:vouched-in-lists-the-people-the-viewer-let-in´
#[sqlx::test(migrations = "../../migrations")]
async fn vouched_in_lists_the_people_the_viewer_let_in_newest_first(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let ana = applicant(&rig, &mira, "ana").await;
    let ana_vouch = vouch(&rig, &mira, registration_path(&rig, ana.id).await).await;
    land_registration(&rig, &ana).await;
    land_vouch(&rig, &mira, &ana_vouch).await;
    let cy = applicant(&rig, &kel, "cyra").await;
    let kel_on_cy = vouch(&rig, &kel, registration_path(&rig, cy.id).await).await;
    let mira_on_cy = vouch(&rig, &mira, ask_link_path(&rig, cy.id, &mira).await).await;
    land_registration(&rig, &cy).await;
    land_vouch(&rig, &kel, &kel_on_cy).await;
    land_vouch(&rig, &mira, &mira_on_cy).await;
    let ben = applicant(&rig, &mira, "ben").await;
    let ben_vouch = vouch(&rig, &mira, registration_path(&rig, ben.id).await).await;
    land_registration(&rig, &ben).await;
    land_vouch(&rig, &mira, &ben_vouch).await;
    let dee = applicant(&rig, &mira, "dee").await;
    vouch(&rig, &mira, registration_path(&rig, dee.id).await).await;

    let mine = page(&rig, &mira.token, json!({})).await;
    assert_eq!(handles(&mine), ["ben", "ana"], "{mine}");
    for (edge, decided) in mine["edges"]
        .as_array()
        .expect("edges")
        .iter()
        .zip([&ben_vouch, &ana_vouch])
    {
        let read: chrono::DateTime<chrono::Utc> = edge["vouchedAt"]
            .as_str()
            .expect("vouchedAt")
            .parse()
            .expect("instant");
        assert_eq!(read, landed_at_of(&rig, decided).await);
    }
    assert_eq!(mine["pageInfo"]["hasNextPage"], false);
    assert_eq!(handles(&page(&rig, &kel.token, json!({})).await), ["cyra"]);
    let cy_reads = rig
        .gql(
            Some(&cy.token),
            "{ me { invitedBy { ... on User { handle } } } }",
            json!({}),
        )
        .await;
    assert_eq!(cy_reads["me"]["invitedBy"]["handle"], "kel");
}

/// The list pages on its keyset: forward one at a time to the end, and back
/// from the end to the start, in the same newest-first order.
///
/// The vouched-in list pages forward and backward in newest-first order.
/// ´claim:onboarding:vouched-in-pages-on-its-keyset´
#[sqlx::test(migrations = "../../migrations")]
async fn vouched_in_pages_forward_and_backward(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    for handle in ["ana", "ben", "cyra"] {
        admit(&rig, &mira, handle).await;
    }

    let mut walked = Vec::new();
    let mut after = Value::Null;
    loop {
        let one = page(&rig, &mira.token, json!({ "first": 1, "after": after })).await;
        walked.extend(handles(&one));
        after = one["pageInfo"]["endCursor"].clone();
        if one["pageInfo"]["hasNextPage"] == false {
            break;
        }
    }
    assert_eq!(walked, ["cyra", "ben", "ana"]);

    let oldest = after;
    let tail = page(&rig, &mira.token, json!({ "first": 1, "after": oldest })).await;
    assert_eq!(handles(&tail), Vec::<String>::new(), "past the oldest");
    let back = page(&rig, &mira.token, json!({ "last": 2, "before": oldest })).await;
    assert_eq!(handles(&back), ["cyra", "ben"], "{back}");
    assert_eq!(back["pageInfo"]["hasPreviousPage"], false);
    assert_eq!(back["pageInfo"]["hasNextPage"], true);
}

/// Another account's list, and the anonymous reader's, is null field-level —
/// never an error — although each vouch is a public record.
///
/// The vouched-in list is viewer-only.
/// ´claim:onboarding:vouched-in-is-viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn vouched_in_is_viewer_only(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    admit(&rig, &mira, "ana").await;
    let query = r#"query { user(handle: "mira") { handle vouchedIn { edges { cursor } } } }"#;

    let as_kel = rig.gql_raw(Some(&kel.token), query, json!({})).await;
    assert!(as_kel["errors"].is_null(), "{as_kel}");
    assert!(as_kel["data"]["user"]["vouchedIn"].is_null());
    let anonymous = rig.gql_raw(None, query, json!({})).await;
    assert!(anonymous["errors"].is_null(), "{anonymous}");
    assert!(anonymous["data"]["user"]["vouchedIn"].is_null());
    let as_mira = rig.gql_raw(Some(&mira.token), query, json!({})).await;
    assert_eq!(
        as_mira["data"]["user"]["vouchedIn"]["edges"]
            .as_array()
            .map(Vec::len),
        Some(1)
    );
}

/// A person who deleted their account since still stands in the list, and
/// reads as every deleted account reads today: the handle's storage form
/// and a redacted display name.
///
/// A person deleted since stays listed and reads as a deleted account.
/// ´claim:onboarding:vouched-in-keeps-a-deleted-person´
#[sqlx::test(migrations = "../../migrations")]
async fn vouched_in_keeps_a_person_deleted_since(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let ana = admit(&rig, &mira, "ana").await;
    let requested = rig
        .gql(
            Some(&ana.token),
            "mutation($input: RequestAccountDeletionInput!) {
               requestAccountDeletion(input: $input) { userErrors { code } }
             }",
            json!({ "input": { "includeContent": false } }),
        )
        .await;
    assert_eq!(
        requested["requestAccountDeletion"]["userErrors"],
        json!([]),
        "{requested}"
    );
    let link = rig.mailer.latest_token_for(&ana.email);
    let confirmed = rig
        .gql(
            None,
            "mutation($input: ConfirmAccountDeletionInput!) {
               confirmAccountDeletion(input: $input) { userErrors { code } }
             }",
            json!({ "input": { "deletionToken": link } }),
        )
        .await;
    assert_eq!(
        confirmed["confirmAccountDeletion"]["userErrors"],
        json!([]),
        "{confirmed}"
    );
    sqlx::query(
        "UPDATE auth_account_deletions SET scheduled_for = NOW() - INTERVAL '1 second'
         WHERE user_id = $1 AND scheduled_for IS NOT NULL",
    )
    .bind(ana.id)
    .execute(&rig.pool)
    .await
    .expect("backdates");
    let done = deletion::tick(
        &StandInBoundary(rig.standin.clone()),
        &rig.pool,
        &MediaAreas::in_memory(),
    )
    .await
    .expect("ticks");
    assert_eq!(done.executed, vec![ana.id]);

    let mine = page(&rig, &mira.token, json!({})).await;
    let row = &mine["edges"][0]["node"];
    assert_eq!(row["id"], ana.id.to_string(), "{mine}");
    assert_eq!(row["handle"], format!("redacted-user-{}", ana.id));
    assert_eq!(row["displayName"]["value"], Value::Null);
    assert_eq!(row["displayName"]["status"], "REDACTED");
}

/// Walking the stance toward the person back to nothing leaves the
/// admission standing: the vouch record landed, and the walk-back is a
/// later record beside it.
///
/// A walked-back vouch keeps the person listed.
/// ´claim:onboarding:vouched-in-survives-a-walk-back´
#[sqlx::test(migrations = "../../migrations")]
async fn vouched_in_survives_a_walk_back(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let ana = admit(&rig, &mira, "ana").await;
    let severance = rig
        .gql(
            Some(&mira.token),
            r#"mutation($input: PrepareSeveranceInput!) {
                 prepareSeverance(input: $input) {
                   writes { id canonicalProposal } userErrors { code message }
                 }
               }"#,
            json!({ "input": { "target": ana.id.to_string() } }),
        )
        .await;
    assert_eq!(
        severance["prepareSeverance"]["userErrors"],
        json!([]),
        "{severance}"
    );
    rig.sign_prepared(
        &mira.token,
        &mira.key,
        &severance["prepareSeverance"]["writes"],
    )
    .await;
    rig.close_and_ingest().await;
    let bundle = rig
        .gql(
            Some(&mira.token),
            r#"query($id: UUID!) { user(id: $id) { viewerStance { severed } } }"#,
            json!({ "id": ana.id }),
        )
        .await;
    assert_eq!(bundle["user"]["viewerStance"]["severed"], true, "{bundle}");

    assert_eq!(handles(&page(&rig, &mira.token, json!({})).await), ["ana"]);
}

/// A page past the cap, or a cursor the list did not issue, is a malformed
/// argument with its code.
///
/// The vouched-in list past the page cap or on a foreign cursor is BAD_INPUT.
/// ´claim:onboarding:vouched-in-over-the-cap-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn vouched_in_over_the_page_cap_is_bad_input(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    for variables in [json!({ "first": 101 }), json!({ "after": "not a cursor" })] {
        let response = rig
            .gql_raw(Some(&mira.token), VOUCHED_IN, variables.clone())
            .await;
        assert_eq!(
            first_error_code(&response),
            Some("BAD_INPUT"),
            "for {variables}: {response}"
        );
    }
}
