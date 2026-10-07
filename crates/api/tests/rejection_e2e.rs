//! Rejection through the real HTTP surface (auth.md "Rejection",
//! "Invite-link generation"): the approver closing one application or a
//! link's whole waiting queue, what a close keeps — the account, and the
//! single-use link it used up — and every refusal the two verbs and the
//! approval name. Requires a live Postgres (`make up`).

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::client::ActorKey;
use postgres_store::{PgPool, auth as store};
use serde_json::{Value, json};
use uuid::Uuid;

mod rig;
use rig::WireRig;

const CREATE_INVITE_LINK: &str = "mutation($input: CreateInviteLinkInput!) {
    createInviteLink(input: $input) { inviteLink { id } userErrors { code } }
}";

const REVOKE_INVITE_LINK: &str = "mutation($input: RevokeInviteLinkInput!) {
    revokeInviteLink(input: $input) { inviteLink { id } userErrors { code } }
}";

const REGISTER: &str = "mutation($input: RegisterInput!) {
    register(input: $input) { auth { accessToken } userErrors { code field } }
}";

const REJECT_APPLICATION: &str = "mutation($input: RejectApplicationInput!) {
    rejectApplication(input: $input) {
        application { id approvedAt rejectedAt }
        userErrors { code field message }
    }
}";

const REJECT_LINK_APPLICATIONS: &str = "mutation($input: RejectLinkApplicationsInput!) {
    rejectLinkApplications(input: $input) {
        rejectedCount
        inviteLink { id usable }
        userErrors { code field message }
    }
}";

const APPROVE_APPLICANTS: &str = "mutation($input: ApproveApplicantsInput!) {
    approveApplicants(input: $input) { writes { id } userErrors { code field message } }
}";

const INVITE_LINK_CHECK: &str = "query($id: UUID!) { inviteLinkCheck(id: $id) { usable } }";

const INVITE_LINKS: &str = "query { me { inviteLinks(first: 50) { edges { node {
    id usable
    applications(first: 50) { edges { node { id handle approvedAt rejectedAt } } }
} } } } }";

const MY_APPLICATION: &str = "query { me { accountState
    application { id emailVerified keyAttached approvedAt rejectedAt } } }";

/// A seeded member, logged in — the inviter of each test.
async fn logged_in_member(rig: &WireRig, handle: &str) -> (Uuid, String) {
    let email = format!("{handle}@example.com");
    let (id, _) = rig.seed_member(handle, &email).await;
    (id, rig.log_in(&email).await)
}

async fn new_link(rig: &WireRig, token: &str, single_use: bool) -> String {
    let issued = rig
        .gql(
            Some(token),
            CREATE_INVITE_LINK,
            json!({ "input": { "expiresAt": "2027-01-01T00:00:00Z", "singleUse": single_use } }),
        )
        .await;
    issued["createInviteLink"]["inviteLink"]["id"]
        .as_str()
        .expect("link")
        .to_string()
}

fn register_vars(link: &str, handle: &str) -> Value {
    json!({ "input": {
        "inviteLink": link,
        "handle": handle,
        "email": format!("{handle}@example.com"),
        "password": "an applicant password",
    }})
}

/// One registered applicant: its session and its application's id.
struct Applicant {
    token: String,
    application: String,
}

/// Registers through `link`, asserting the registration succeeded.
async fn applicant(rig: &WireRig, link: &str, handle: &str) -> Applicant {
    let registered = rig.gql(None, REGISTER, register_vars(link, handle)).await;
    let token = registered["register"]["auth"]["accessToken"]
        .as_str()
        .unwrap_or_else(|| panic!("registers: {registered}"))
        .to_string();
    let me = rig.gql(Some(&token), MY_APPLICATION, json!({})).await;
    let application = me["me"]["application"]["id"]
        .as_str()
        .expect("application")
        .to_string();
    Applicant { token, application }
}

/// Both approvability proofs, the way a device runs them: the
/// verification token read from the inbox, then the key ceremony's attach.
async fn prove(rig: &WireRig, who: &Applicant, handle: &str) {
    let token = rig
        .mailer
        .latest_token_for(&format!("{handle}@example.com"));
    let verified = rig
        .gql(
            None,
            "mutation($input: VerifyEmailInput!) { verifyEmail(input: $input) { ok } }",
            json!({ "input": { "verificationToken": token } }),
        )
        .await;
    assert_eq!(verified["verifyEmail"]["ok"], true, "{verified}");
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
}

async fn reject(rig: &WireRig, token: &str, application: &str) -> Value {
    rig.gql(
        Some(token),
        REJECT_APPLICATION,
        json!({ "input": { "application": application } }),
    )
    .await["rejectApplication"]
        .clone()
}

async fn sweep(rig: &WireRig, token: &str, link: &str) -> Value {
    rig.gql(
        Some(token),
        REJECT_LINK_APPLICATIONS,
        json!({ "input": { "inviteLink": link } }),
    )
    .await["rejectLinkApplications"]
        .clone()
}

async fn approve(rig: &WireRig, token: &str, application: &str) -> Value {
    rig.gql(
        Some(token),
        APPROVE_APPLICANTS,
        json!({ "input": { "approvals": [{
            "application": application, "pDirected": 0.5, "pInterest": 0.1,
        }]}}),
    )
    .await["approveApplicants"]
        .clone()
}

/// The anonymous check's answer for a link.
async fn check_usable(rig: &WireRig, link: &str) -> bool {
    rig.gql(None, INVITE_LINK_CHECK, json!({ "id": link }))
        .await["inviteLinkCheck"]["usable"]
        .as_bool()
        .expect("usable")
}

/// The issuer's own read of one of their links.
async fn issuer_link(rig: &WireRig, token: &str, link: &str) -> Value {
    let links = rig.gql(Some(token), INVITE_LINKS, json!({})).await;
    links["me"]["inviteLinks"]["edges"]
        .as_array()
        .expect("links")
        .iter()
        .map(|e| e["node"].clone())
        .find(|n| n["id"] == link)
        .expect("the issuer reads the link")
}

/// The applicant's own read of their application.
async fn own_application(rig: &WireRig, who: &Applicant) -> Value {
    rig.gql(Some(&who.token), MY_APPLICATION, json!({})).await["me"]["application"].clone()
}

fn rejected_at_of(application: &Value) -> Option<String> {
    application["rejectedAt"].as_str().map(str::to_string)
}

/// The ruled slot rule at the wire (seam 093): account creation uses a
/// single-use link up, and a rejection does not give it back — the issuer
/// mints a new link instead. Before and after the close, a second
/// registrant meets INVITE_UNUSABLE, and the anonymous check and the
/// issuer's own `InviteLink.usable` agree, both read from the one
/// server-side reckoning. The closed application stays on the link's
/// queue.
///
/// A single-use link stays used up after its application is rejected: it still refuses a new registrant, and the anonymous check and the issuer's usable read agree on it.
/// ´claim:onboarding:a-rejection-leaves-a-single-use-link-used´
#[sqlx::test(migrations = "../../migrations")]
async fn a_rejected_application_leaves_its_single_use_link_used(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let link = new_link(&rig, &inviter, true).await;
    assert!(check_usable(&rig, &link).await);
    assert_eq!(issuer_link(&rig, &inviter, &link).await["usable"], true);
    let first = applicant(&rig, &link, "first").await;
    assert!(!check_usable(&rig, &link).await);
    assert_eq!(issuer_link(&rig, &inviter, &link).await["usable"], false);

    let closed = reject(&rig, &inviter, &first.application).await;
    assert_eq!(closed["userErrors"], json!([]), "{closed}");
    assert!(rejected_at_of(&closed["application"]).is_some());

    assert!(
        !check_usable(&rig, &link).await,
        "a rejection does not give the slot back"
    );
    let queue = issuer_link(&rig, &inviter, &link).await;
    assert_eq!(queue["usable"], false);
    assert_eq!(
        queue["applications"]["edges"]
            .as_array()
            .expect("queue")
            .len(),
        1,
        "the rejected application stays on the link's queue, closed: {queue}"
    );
    let refused = rig
        .gql(None, REGISTER, register_vars(&link, "second"))
        .await;
    assert_eq!(
        refused["register"]["userErrors"][0]["code"], "INVITE_UNUSABLE",
        "{refused}"
    );

    let swept = sweep(&rig, &inviter, &link).await;
    assert_eq!(swept["rejectedCount"], 0);
    assert_eq!(
        swept["inviteLink"]["usable"], false,
        "nor does the sweep: {swept}"
    );
}

/// A rejection closes the queue entry, not the person (auth.md
/// "Rejection"): the applicant's session keeps working, they still log
/// in, their account state and attached key are unchanged, and their own
/// application reads closed. Nothing is deleted — the row stays on the
/// inviter's queue with its close stamped.
///
/// Rejecting an application closes the queue entry only: the account keeps its session, its login and its attached key, reads its own application closed, and no row is deleted.
/// ´claim:onboarding:a-rejection-keeps-the-account´
#[sqlx::test(migrations = "../../migrations")]
async fn rejecting_an_application_closes_the_entry_and_keeps_the_account(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let link = new_link(&rig, &inviter, false).await;
    let joiner = applicant(&rig, &link, "joiner").await;
    prove(&rig, &joiner, "joiner").await;

    let closed = reject(&rig, &inviter, &joiner.application).await;
    assert_eq!(closed["userErrors"], json!([]), "{closed}");
    assert_eq!(closed["application"]["id"], joiner.application.as_str());
    assert!(closed["application"]["approvedAt"].is_null());

    let me = rig
        .gql(Some(&joiner.token), MY_APPLICATION, json!({}))
        .await;
    assert_eq!(me["me"]["accountState"], "APPLICANT");
    let own = &me["me"]["application"];
    assert_eq!(own["id"], joiner.application.as_str());
    assert_eq!(
        rejected_at_of(own),
        rejected_at_of(&closed["application"]),
        "the applicant reads the close on their own application"
    );
    assert_eq!(own["emailVerified"], true);
    assert_eq!(own["keyAttached"], true, "the attached key stays");

    let login = rig
        .gql(
            None,
            "mutation($input: LogInInput!) {
               logIn(input: $input) { auth { accessToken } userErrors { code } }
             }",
            json!({ "input": { "email": "joiner@example.com", "password": "an applicant password" } }),
        )
        .await;
    assert!(
        login["logIn"]["auth"]["accessToken"].is_string(),
        "the login stays: {login}"
    );

    let queue = issuer_link(&rig, &inviter, &link).await;
    let row = &queue["applications"]["edges"][0]["node"];
    assert_eq!(row["handle"], "joiner");
    assert_eq!(rejected_at_of(row), rejected_at_of(&closed["application"]));
}

/// An approved application is no longer the approver's to close.
///
/// Rejecting an approved application refuses with BAD_INPUT pinned to the application.
/// ´claim:onboarding:an-approved-application-cannot-be-rejected´
#[sqlx::test(migrations = "../../migrations")]
async fn rejecting_an_approved_application_is_bad_input(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let link = new_link(&rig, &inviter, false).await;
    let joiner = applicant(&rig, &link, "joiner").await;
    prove(&rig, &joiner, "joiner").await;
    let approved = approve(&rig, &inviter, &joiner.application).await;
    assert_eq!(approved["userErrors"], json!([]), "{approved}");

    let refused = reject(&rig, &inviter, &joiner.application).await;
    assert!(refused["application"].is_null());
    assert_eq!(refused["userErrors"][0]["code"], "BAD_INPUT");
    assert_eq!(refused["userErrors"][0]["field"], json!(["application"]));
    assert_eq!(refused["userErrors"][0]["message"], "already approved");
    let own = rig
        .gql(Some(&joiner.token), MY_APPLICATION, json!({}))
        .await;
    assert!(own["me"]["application"]["rejectedAt"].is_null());
}

/// A close is answered once: the second rejection names the first.
///
/// Rejecting an application already rejected refuses with BAD_INPUT, leaving the first close's stamp as it was.
/// ´claim:onboarding:a-rejection-is-answered-once´
#[sqlx::test(migrations = "../../migrations")]
async fn rejecting_twice_is_bad_input(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let link = new_link(&rig, &inviter, false).await;
    let joiner = applicant(&rig, &link, "joiner").await;
    let first = reject(&rig, &inviter, &joiner.application).await;
    let stamp = rejected_at_of(&first["application"]).expect("closed");

    let again = reject(&rig, &inviter, &joiner.application).await;
    assert!(again["application"].is_null());
    assert_eq!(again["userErrors"][0]["code"], "BAD_INPUT");
    assert_eq!(again["userErrors"][0]["field"], json!(["application"]));
    assert_eq!(again["userErrors"][0]["message"], "already rejected");
    let own = rig
        .gql(Some(&joiner.token), MY_APPLICATION, json!({}))
        .await;
    assert_eq!(rejected_at_of(&own["me"]["application"]), Some(stamp));
}

/// The queue is its approver's only: another member's rejection reads
/// exactly as an unknown id does, and leaves the row waiting.
///
/// Rejecting another member's application reads as an unknown application, BAD_INPUT alike, and closes nothing.
/// ´claim:onboarding:a-foreign-rejection-reads-as-unknown´
#[sqlx::test(migrations = "../../migrations")]
async fn rejecting_another_members_application_reads_as_unknown(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let (_, stranger) = logged_in_member(&rig, "stranger").await;
    let link = new_link(&rig, &inviter, false).await;
    let joiner = applicant(&rig, &link, "joiner").await;

    let foreign = reject(&rig, &stranger, &joiner.application).await;
    let unknown = reject(&rig, &stranger, &Uuid::new_v4().to_string()).await;
    for refused in [&foreign, &unknown] {
        assert!(refused["application"].is_null());
        assert_eq!(refused["userErrors"][0]["code"], "BAD_INPUT");
        assert_eq!(refused["userErrors"][0]["field"], json!(["application"]));
    }
    assert_eq!(
        foreign["userErrors"], unknown["userErrors"],
        "a foreign application and an unknown one are indistinguishable"
    );
    let own = rig
        .gql(Some(&joiner.token), MY_APPLICATION, json!({}))
        .await;
    assert!(own["me"]["application"]["rejectedAt"].is_null());
}

/// A closed application is not approvable (R4): the approval refuses it
/// at its entry, and nothing is staged or burned for it.
///
/// Approving a rejected application refuses with BAD_INPUT pinned to its entry, and stages nothing.
/// ´claim:onboarding:a-rejected-application-cannot-be-approved´
#[sqlx::test(migrations = "../../migrations")]
async fn approving_a_rejected_application_is_bad_input(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let link = new_link(&rig, &inviter, false).await;
    let joiner = applicant(&rig, &link, "joiner").await;
    prove(&rig, &joiner, "joiner").await;
    reject(&rig, &inviter, &joiner.application).await;

    let refused = approve(&rig, &inviter, &joiner.application).await;
    assert!(refused["writes"].is_null());
    assert_eq!(refused["userErrors"][0]["code"], "BAD_INPUT");
    assert_eq!(
        refused["userErrors"][0]["field"],
        json!(["approvals", "0", "application"])
    );
    assert_eq!(refused["userErrors"][0]["message"], "already rejected");
    let own = rig
        .gql(Some(&joiner.token), MY_APPLICATION, json!({}))
        .await;
    assert!(own["me"]["application"]["approvedAt"].is_null());
    let staged: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM staged_writes")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(staged, 0, "nothing staged for a closed application");
}

/// The sweep closes what is waiting and passes over the rest: on a link
/// carrying an approved application, an already-rejected one and two
/// waiting ones — one approvable, one not yet verified — exactly the two
/// waiting ones close, the count says two, and the other rows keep their
/// state and their stamps.
///
/// A link sweep closes only the applications still waiting, approvable or not, counts exactly those, and leaves approved and already-rejected rows as they were.
/// ´claim:onboarding:a-link-sweep-closes-only-what-waits´
#[sqlx::test(migrations = "../../migrations")]
async fn the_link_sweep_closes_only_waiting_applications_and_counts_them(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let link = new_link(&rig, &inviter, false).await;

    let approved = applicant(&rig, &link, "approved").await;
    prove(&rig, &approved, "approved").await;
    approve(&rig, &inviter, &approved.application).await;
    let closed = applicant(&rig, &link, "closed").await;
    let first_close =
        rejected_at_of(&reject(&rig, &inviter, &closed.application).await["application"])
            .expect("closed");
    let ready = applicant(&rig, &link, "ready").await;
    prove(&rig, &ready, "ready").await;
    let fresh = applicant(&rig, &link, "fresh").await;

    let swept = sweep(&rig, &inviter, &link).await;
    assert_eq!(swept["userErrors"], json!([]), "{swept}");
    assert_eq!(swept["rejectedCount"], 2);
    assert_eq!(swept["inviteLink"]["id"], link.as_str());

    let approved_row = own_application(&rig, &approved).await;
    assert!(approved_row["approvedAt"].is_string());
    assert!(
        approved_row["rejectedAt"].is_null(),
        "approved is passed over"
    );
    assert_eq!(
        rejected_at_of(&own_application(&rig, &closed).await),
        Some(first_close),
        "an already-closed application is never closed again"
    );
    assert!(rejected_at_of(&own_application(&rig, &ready).await).is_some());
    assert!(rejected_at_of(&own_application(&rig, &fresh).await).is_some());

    let again = sweep(&rig, &inviter, &link).await;
    assert_eq!(again["rejectedCount"], 0, "nothing is left waiting");
}

/// Revocation stops new staging and leaves the queue standing, so a
/// revoked link's waiting applications still close by the link.
///
/// A revoked link's waiting queue still closes by the link sweep.
/// ´claim:onboarding:a-revoked-link-still-sweeps´
#[sqlx::test(migrations = "../../migrations")]
async fn a_revoked_links_queue_still_sweeps(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let link = new_link(&rig, &inviter, false).await;
    let joiner = applicant(&rig, &link, "joiner").await;
    let revoked = rig
        .gql(
            Some(&inviter),
            REVOKE_INVITE_LINK,
            json!({ "input": { "inviteLink": link } }),
        )
        .await;
    assert_eq!(revoked["revokeInviteLink"]["userErrors"], json!([]));

    let swept = sweep(&rig, &inviter, &link).await;
    assert_eq!(swept["userErrors"], json!([]), "{swept}");
    assert_eq!(swept["rejectedCount"], 1);
    assert_eq!(
        swept["inviteLink"]["usable"], false,
        "a sweep never revives a revoked link"
    );
    let own = rig
        .gql(Some(&joiner.token), MY_APPLICATION, json!({}))
        .await;
    assert!(rejected_at_of(&own["me"]["application"]).is_some());
}

/// A link with nothing waiting is not a refusal: the sweep succeeds with
/// a zero count and hands the link back.
///
/// Sweeping a link with nothing waiting succeeds with a zero count.
/// ´claim:onboarding:an-empty-sweep-counts-zero´
#[sqlx::test(migrations = "../../migrations")]
async fn a_link_with_nothing_waiting_sweeps_zero(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let link = new_link(&rig, &inviter, true).await;

    let swept = sweep(&rig, &inviter, &link).await;
    assert_eq!(swept["userErrors"], json!([]), "{swept}");
    assert_eq!(swept["rejectedCount"], 0);
    assert_eq!(swept["inviteLink"]["id"], link.as_str());
    assert_eq!(swept["inviteLink"]["usable"], true);
}

/// An unknown link and another member's link answer alike: the NOT_FOUND
/// userError revokeInviteLink names, pinned to inviteLink — and the
/// foreign link's queue is untouched.
///
/// Sweeping an unknown or another member's link refuses with a NOT_FOUND userError at inviteLink, the two indistinguishable, and closes nothing.
/// ´claim:onboarding:a-foreign-sweep-is-not-found´
#[sqlx::test(migrations = "../../migrations")]
async fn sweeping_an_unknown_or_foreign_link_is_not_found(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let (_, stranger) = logged_in_member(&rig, "stranger").await;
    let link = new_link(&rig, &inviter, false).await;
    let joiner = applicant(&rig, &link, "joiner").await;

    let foreign = sweep(&rig, &stranger, &link).await;
    let unknown = sweep(&rig, &stranger, &Uuid::new_v4().to_string()).await;
    for refused in [&foreign, &unknown] {
        assert!(refused["rejectedCount"].is_null());
        assert!(refused["inviteLink"].is_null());
        assert_eq!(refused["userErrors"][0]["code"], "NOT_FOUND");
        assert_eq!(refused["userErrors"][0]["field"], json!(["inviteLink"]));
    }
    assert_eq!(foreign["userErrors"], unknown["userErrors"]);
    let own = rig
        .gql(Some(&joiner.token), MY_APPLICATION, json!({}))
        .await;
    assert!(own["me"]["application"]["rejectedAt"].is_null());
}

/// The two queue writes are member-gated like every other gesture: an
/// anonymous call is UNAUTHENTICATED, an unverified applicant's is
/// EMAIL_NOT_VERIFIED, and a verified applicant's is FORBIDDEN — all at
/// the transport tier, since none is an expected outcome of the verb.
///
/// Rejecting is a member's act: anonymous, unverified and applicant callers are refused at the transport tier by the member gate.
/// ´claim:onboarding:rejecting-is-member-gated´
#[sqlx::test(migrations = "../../migrations")]
async fn the_rejection_verbs_are_member_gated(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let link = new_link(&rig, &inviter, false).await;
    let unverified = applicant(&rig, &link, "unverified").await;
    let verified = applicant(&rig, &link, "verified").await;
    prove(&rig, &verified, "verified").await;

    for (token, code) in [
        (None, "UNAUTHENTICATED"),
        (Some(unverified.token.as_str()), "EMAIL_NOT_VERIFIED"),
        (Some(verified.token.as_str()), "FORBIDDEN"),
    ] {
        let one = rig
            .gql_raw(
                token,
                REJECT_APPLICATION,
                json!({ "input": { "application": unverified.application } }),
            )
            .await;
        assert_eq!(one["errors"][0]["extensions"]["code"], code, "{one}");
        let all = rig
            .gql_raw(
                token,
                REJECT_LINK_APPLICATIONS,
                json!({ "input": { "inviteLink": link } }),
            )
            .await;
        assert_eq!(all["errors"][0]["extensions"]["code"], code, "{all}");
    }
}

/// The B1 ruling (E1): a rejected applicant's account persists, so a
/// verified one handed a fresh invite link meets the address they already
/// hold — EMAIL_IN_USE at the form, as drawn (Join.md, SignIn.md). Their
/// way back is the ask link, never a second account.
///
/// A rejected, verified applicant registering again through a fresh link meets EMAIL_IN_USE at email, because the rejected account still holds its address.
/// ´claim:onboarding:a-rejected-account-keeps-its-email´
#[sqlx::test(migrations = "../../migrations")]
async fn a_rejected_verified_applicant_registering_again_is_email_in_use(pool: PgPool) {
    let rig = WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited());
    let (_, inviter) = logged_in_member(&rig, "inviter").await;
    let link = new_link(&rig, &inviter, true).await;
    let joiner = applicant(&rig, &link, "joiner").await;
    prove(&rig, &joiner, "joiner").await;
    reject(&rig, &inviter, &joiner.application).await;

    let fresh = new_link(&rig, &inviter, true).await;
    let again = rig
        .gql(
            None,
            REGISTER,
            json!({ "input": {
                "inviteLink": fresh,
                "handle": "joiner_again",
                "email": "joiner@example.com",
                "password": "an applicant password",
            }}),
        )
        .await;
    assert!(again["register"]["auth"].is_null());
    assert_eq!(again["register"]["userErrors"][0]["code"], "EMAIL_IN_USE");
    assert_eq!(
        again["register"]["userErrors"][0]["field"],
        json!(["email"])
    );
    assert!(
        check_usable(&rig, &fresh).await,
        "a refused registration takes no slot"
    );
    assert!(
        store::credentials_by_email(&rig.pool, "joiner@example.com")
            .await
            .expect("query")
            .is_some(),
        "the rejected account is still there"
    );
}
