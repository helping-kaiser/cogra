//! The account-deletion lifecycle through the real HTTP surface (auth.md
//! "Self-service deletion"; erasure.md §5): the member's mailed request,
//! the session-free confirm and its 7-day grace, supersede, cancel, the
//! dead links' one code, the deletion mail budget, the viewer-only read,
//! and the applicant's immediate whole-account delete with its
//! funded-window refusal (design item 69). Execution — the husk — is the
//! erasure engine's and not here. Requires a live Postgres (`make up`).
//!
//! The deletion verbs' error codes (charter API rule 3), each provoked
//! here: UNAUTHENTICATED on the three session verbs, FORBIDDEN on both
//! paths, RATE_LIMITED on the request, and DELETION_TOKEN_INVALID for
//! the unknown, superseded, cancelled and expired link (the executed one
//! arrives with the engine); the confirm's RATE_LIMITED is
//! `rate_limits.rs`'s shared per-IP budget. EMAIL_NOT_VERIFIED is not
//! provocable on these verbs: the mailed path's accounts are verified by
//! construction, and the applicant verb does not gate on the proof (seam
//! 049.1).

use api::l1::StandInBoundary;
use api::onboarding::{self, Approval, OnboardingConfig};
use api::ratelimit::{RateLimitConfig, SigningBudget, Window};
use chrono::{DateTime, Duration, Utc};
use common::l1::census::Family;
use common::l1::client::ActorKey;
use postgres_store::staged::{self, PreSignedParts, StagedState};
use postgres_store::{PgPool, auth as store};
use serde_json::{Value, json};
use uuid::Uuid;

mod rig;
use rig::{MEMBER_PASSWORD, WireRig};

const REQUEST: &str = "mutation($input: RequestAccountDeletionInput!) {
    requestAccountDeletion(input: $input) {
        accountDeletion { scheduledFor includesContent } userErrors { code field }
    }
}";
const CONFIRM: &str = "mutation($input: ConfirmAccountDeletionInput!) {
    confirmAccountDeletion(input: $input) {
        accountDeletion { scheduledFor includesContent } userErrors { code field }
    }
}";
const CANCEL: &str = "mutation {
    cancelAccountDeletion {
        accountDeletion { scheduledFor includesContent } userErrors { code field }
    }
}";
const DELETE_APPLICANT: &str = "mutation {
    deleteApplicantAccount { ok userErrors { code field } }
}";
const ME: &str = "query { me { id accountDeletion { scheduledFor includesContent } } }";
const LOG_IN: &str = "mutation($input: LogInInput!) {
    logIn(input: $input) { auth { accessToken refreshToken } userErrors { code } }
}";
const REFRESH: &str = "mutation($input: RefreshSessionInput!) {
    refreshSession(input: $input) { auth { refreshToken } userErrors { code } }
}";
const PREPARE_STANCE: &str = "mutation($input: PrepareStanceInput!) {
    prepareStance(input: $input) { writes { id carried } userErrors { code message } }
}";
const PREPARE_POST: &str = "mutation($input: PreparePostInput!) {
    preparePost(input: $input) { writes { id carried } userErrors { code message } }
}";

/// The 7-day grace (erasure.md §5) and the unopened link's lifetime
/// (auth.md), as the tests measure them.
const SEVEN_DAYS_SECS: i64 = 7 * 86_400;

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

/// The transport-tier code of a refused request.
fn transport_code(response: &Value) -> Option<&str> {
    response["errors"][0]["extensions"]["code"].as_str()
}

fn codes<'a>(data: &'a Value, operation: &str) -> Vec<&'a str> {
    data[operation]["userErrors"]
        .as_array()
        .expect("userErrors")
        .iter()
        .map(|e| e["code"].as_str().expect("code"))
        .collect()
}

fn deadline(payload: &Value) -> DateTime<Utc> {
    payload["accountDeletion"]["scheduledFor"]
        .as_str()
        .expect("scheduledFor")
        .parse()
        .expect("RFC 3339")
}

/// A member with a session, keyed by handle (`<handle>@example.com`).
struct Member {
    id: Uuid,
    key: ActorKey,
    email: String,
    token: String,
}

async fn member(rig: &WireRig, handle: &str) -> Member {
    let email = format!("{handle}@example.com");
    let (id, key) = rig.seed_member(handle, &email).await;
    let token = rig.log_in(&email).await;
    Member {
        id,
        key,
        email,
        token,
    }
}

/// An applicant registered through `inviter`'s link — verified, keyed,
/// signed in with the member password, holding the register session.
struct Applicant {
    id: Uuid,
    key: ActorKey,
    email: String,
    token: String,
    link: Uuid,
}

async fn invite_link(rig: &WireRig, inviter: &Member, single_use: bool) -> Uuid {
    let data = rig
        .gql(
            Some(&inviter.token),
            "mutation($input: CreateInviteLinkInput!) {
               createInviteLink(input: $input) { inviteLink { id } userErrors { code } }
             }",
            json!({ "input": { "expiresAt": "2099-01-01T00:00:00Z", "singleUse": single_use }}),
        )
        .await;
    data["createInviteLink"]["inviteLink"]["id"]
        .as_str()
        .expect("link")
        .parse()
        .expect("uuid")
}

async fn register(rig: &WireRig, link: Uuid, handle: &str) -> Value {
    rig.gql_raw(
        None,
        "mutation($input: RegisterInput!) {
           register(input: $input) { auth { accessToken } userErrors { code field } }
         }",
        json!({ "input": {
            "inviteLink": link, "handle": handle,
            "email": format!("{handle}@example.com"), "password": MEMBER_PASSWORD,
        }}),
    )
    .await
}

async fn applicant(rig: &WireRig, inviter: &Member, handle: &str) -> Applicant {
    let link = invite_link(rig, inviter, false).await;
    applicant_through(rig, link, handle).await
}

async fn applicant_through(rig: &WireRig, link: Uuid, handle: &str) -> Applicant {
    let email = format!("{handle}@example.com");
    let registered = register(rig, link, handle).await;
    let token = registered["data"]["register"]["auth"]["accessToken"]
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
    Applicant {
        id,
        key,
        email,
        token,
        link,
    }
}

async fn request(rig: &WireRig, token: &str, include_content: Option<bool>) -> Value {
    rig.gql(
        Some(token),
        REQUEST,
        json!({ "input": { "includeContent": include_content } }),
    )
    .await["requestAccountDeletion"]
        .clone()
}

async fn confirm(rig: &WireRig, link: &str, include_content: Option<bool>) -> Value {
    rig.gql(
        None,
        CONFIRM,
        json!({ "input": { "deletionToken": link, "includeContent": include_content } }),
    )
    .await
}

async fn cancel(rig: &WireRig, token: &str) -> Value {
    rig.gql(Some(token), CANCEL, json!({})).await["cancelAccountDeletion"].clone()
}

async fn me(rig: &WireRig, token: &str) -> Value {
    rig.gql(Some(token), ME, json!({})).await["me"].clone()
}

/// Requests a deletion as `who` and returns the mailed link's token.
async fn requested_link(rig: &WireRig, who: &Member, include_content: Option<bool>) -> String {
    let payload = request(rig, &who.token, include_content).await;
    assert_eq!(payload["userErrors"], json!([]), "{payload}");
    rig.mailer.latest_token_for(&who.email)
}

async fn count(rig: &WireRig, sql: &str, id: Uuid) -> i64 {
    sqlx::query_scalar(sql)
        .bind(id)
        .fetch_one(&rig.pool)
        .await
        .unwrap_or_else(|e| panic!("{sql}: {e}"))
}

/// The device's two signing legs over one staged write.
async fn sign(rig: &WireRig, key: &ActorKey, staged_id: Uuid) {
    let boundary = StandInBoundary(rig.standin.clone());
    let write = staged::load(&rig.pool, staged_id).await.expect("loads");
    let pre = key.pre_sign(write.proposal.clone());
    let sealed = api::relay::submit_pre_signed(
        &boundary,
        &rig.pool,
        staged_id,
        PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        },
    )
    .await
    .expect("seals");
    let host_key = rig.standin.host_public_key().await.expect("host key");
    let witness = key.approve(&pre, &sealed, &host_key).expect("approves");
    api::relay::submit_approval(&boundary, &rig.pool, staged_id, witness.approval_signature)
        .await
        .expect("relays");
}

/// The voucher decides the applicant's registration path: the approval
/// funds the address and stages the Registration. Returns the vouch's
/// staged id.
async fn approve(rig: &WireRig, voucher: &Member, who: &Applicant) -> Uuid {
    let path: Uuid = sqlx::query_scalar(
        "SELECT id FROM auth_applications WHERE account_id = $1 ORDER BY created_at LIMIT 1",
    )
    .bind(who.id)
    .fetch_one(&rig.pool)
    .await
    .expect("path");
    let mut prepared = onboarding::approve_applicants(
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
    .unwrap_or_else(|e| panic!("approves: {e:?}"));
    prepared.remove(0).id
}

/// The applicant signs its staged admission Registration.
async fn sign_registration(rig: &WireRig, who: &Applicant) {
    let registration = staged::list_for_actor(&rig.pool, who.id)
        .await
        .expect("lists")
        .into_iter()
        .find(|w| {
            w.proposal.body.family == Family::Registration
                && w.proposal.body.asserted_parents.is_empty()
                && w.state != StagedState::Expired
        })
        .expect("a staged admission Registration");
    sign(rig, &who.key, registration.id).await;
}

async fn account_state(rig: &WireRig, id: Uuid) -> String {
    sqlx::query_scalar("SELECT account_state FROM user_credentials WHERE actor_id = $1")
        .bind(id)
        .fetch_one(&rig.pool)
        .await
        .expect("state")
}

/// Carries one act through an ordinary mutation as the applicant.
async fn carry(rig: &WireRig, who: &Applicant, mutation: &str, input: Value) {
    let data = rig
        .gql(Some(&who.token), mutation, json!({ "input": input }))
        .await;
    let payload = data
        .as_object()
        .and_then(|d| d.values().next())
        .expect("payload");
    assert_eq!(payload["userErrors"], json!([]), "{payload}");
    for write in payload["writes"].as_array().expect("writes") {
        assert_eq!(write["carried"], true, "{write}");
    }
}

/// The member path needs a session: without one the request is refused
/// at the transport tier and nothing is mailed.
///
/// A deletion request without a session is unauthenticated and mails nothing.
/// ´claim:deletion:a-request-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn requesting_deletion_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = rig(pool);
    let answer = rig
        .gql_raw(
            None,
            REQUEST,
            json!({ "input": { "includeContent": false } }),
        )
        .await;
    assert_eq!(transport_code(&answer), Some("UNAUTHENTICATED"), "{answer}");
    assert_eq!(rig.mailer.count(), 0);
}

/// An applicant whose Registration has not landed has nothing on the
/// graph to leave a husk of: the mailed path refuses FORBIDDEN, records
/// and mails nothing, and the applicant verb is the way.
///
/// An applicant before its Registration lands is refused the mailed member path.
/// ´claim:deletion:an-applicant-cannot-request-the-member-path´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_cannot_request_the_member_path(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;

    let answer = rig
        .gql_raw(Some(&noa.token), REQUEST, json!({ "input": {} }))
        .await;
    assert_eq!(transport_code(&answer), Some("FORBIDDEN"), "{answer}");
    assert_eq!(
        rig.mailer.subjects_for(&noa.email).len(),
        1,
        "only the verification mail"
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM auth_account_deletions WHERE user_id = $1",
            noa.id
        )
        .await,
        0
    );
}

/// The deletion mail budget answers visibly: past it the request is a
/// transport-tier RATE_LIMITED, and nothing is recorded, mailed or
/// superseded — the request standing before the refusal still confirms.
///
/// A spent deletion mail budget refuses visibly, recording, mailing and superseding nothing.
/// ´claim:deletion:requests-trip-the-account-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn deletion_requests_trip_the_account_budget(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.deletion_request_account = Window {
        limit: 2,
        window_secs: 3600.0,
    };
    let rig = WireRig::new(pool, limits);
    let alice = member(&rig, "alice").await;
    requested_link(&rig, &alice, None).await;
    let standing = requested_link(&rig, &alice, None).await;

    let refused = rig
        .gql_raw(Some(&alice.token), REQUEST, json!({ "input": {} }))
        .await;
    assert_eq!(transport_code(&refused), Some("RATE_LIMITED"), "{refused}");
    assert_eq!(rig.mailer.subjects_for(&alice.email).len(), 2);
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM auth_account_deletions WHERE user_id = $1",
            alice.id
        )
        .await,
        2
    );
    let confirmed = confirm(&rig, &standing, None).await;
    assert_eq!(
        codes(&confirmed, "confirmAccountDeletion"),
        Vec::<&str>::new()
    );
}

/// A request records the choice and mails the link URL to the verified
/// address — and schedules nothing: the payload and the viewer's read are
/// both null until the link is opened.
///
/// A request mails the deletion link URL and schedules nothing.
/// ´claim:deletion:a-request-mails-the-link-and-schedules-nothing´
#[sqlx::test(migrations = "../../migrations")]
async fn a_request_mails_the_link_and_schedules_nothing(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;

    let payload = request(&rig, &alice.token, Some(true)).await;
    assert_eq!(payload["userErrors"], json!([]));
    assert!(payload["accountDeletion"].is_null(), "{payload}");
    assert!(me(&rig, &alice.token).await["accountDeletion"].is_null());

    let link = rig.mailer.latest_token_for(&alice.email);
    assert_eq!(
        rig.mailer.subjects_for(&alice.email),
        vec!["Confirm the deletion of your CoGra account"]
    );
    let (include_content, scheduled): (bool, Option<DateTime<Utc>>) = sqlx::query_as(
        "SELECT include_content, scheduled_for FROM auth_account_deletions WHERE user_id = $1",
    )
    .bind(alice.id)
    .fetch_one(&rig.pool)
    .await
    .expect("row");
    assert!(include_content, "the choice is recorded");
    assert!(scheduled.is_none(), "nothing is scheduled");
    let stored: Vec<u8> = sqlx::query_scalar(
        "SELECT deletion_token_hash FROM auth_account_deletions WHERE user_id = $1",
    )
    .bind(alice.id)
    .fetch_one(&rig.pool)
    .await
    .expect("hash");
    assert_eq!(
        stored,
        api::auth::hash_of(&link).to_vec(),
        "only the hash is stored"
    );
}

/// The mail carries the deletion link on the web origin's
/// `/delete-account` path, with the bare token beside it (auth.md "Link
/// URLs").
///
/// The deletion mail carries the delete-account link URL and the bare token.
/// ´claim:deletion:the-mail-carries-the-link-url´
#[sqlx::test(migrations = "../../migrations")]
async fn the_deletion_mail_carries_the_link_url(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    request(&rig, &alice.token, None).await;
    let token = rig.mailer.latest_token_for(&alice.email);

    let body = rig.mailer.latest_body_for(&alice.email);
    assert!(
        body.contains(&format!(
            "http://localhost:3000/delete-account?token={token}\n"
        )),
        "the link URL is on the web origin's /delete-account path: {body}"
    );
    assert!(body.contains(&format!("Or paste the token in the app: {token}")));
    let confirmed = confirm(&rig, &token, None).await;
    assert_eq!(
        codes(&confirmed, "confirmAccountDeletion"),
        Vec::<&str>::new()
    );
}

/// A second request supersedes the first (053.2): the earlier link dies
/// and the new request carries its own content choice.
///
/// A second request supersedes the first; the earlier link dies and the new choice stands.
/// ´claim:deletion:a-second-request-supersedes-the-first´
#[sqlx::test(migrations = "../../migrations")]
async fn a_second_request_supersedes_the_first_with_its_own_choice(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let first = requested_link(&rig, &alice, Some(true)).await;
    let second = requested_link(&rig, &alice, Some(false)).await;
    assert_ne!(first, second);

    let dead = confirm(&rig, &first, None).await;
    assert_eq!(
        codes(&dead, "confirmAccountDeletion"),
        vec!["DELETION_TOKEN_INVALID"]
    );
    let live = confirm(&rig, &second, None).await;
    assert_eq!(
        live["confirmAccountDeletion"]["accountDeletion"]["includesContent"], false,
        "the new request's own choice, not the superseded one's"
    );
}

/// Two requests racing each other leave exactly one standing: the
/// account lock serializes them, the later supersedes the earlier, and
/// of the two links mailed exactly one confirms.
///
/// Racing requests serialize: one standing request, exactly one live link.
/// ´claim:deletion:racing-requests-leave-one-standing´
#[sqlx::test(migrations = "../../migrations")]
async fn racing_requests_leave_one_standing(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let (a, b) = tokio::join!(
        request(&rig, &alice.token, None),
        request(&rig, &alice.token, None)
    );
    assert_eq!(a["userErrors"], json!([]));
    assert_eq!(b["userErrors"], json!([]));
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM auth_account_deletions
             WHERE user_id = $1 AND cancelled_at IS NULL AND superseded_at IS NULL",
            alice.id
        )
        .await,
        1
    );
    let tokens = rig.mailer.tokens_for(&alice.email);
    assert_eq!(tokens.len(), 2);
    let mut live = 0;
    for token in &tokens {
        if codes(&confirm(&rig, token, None).await, "confirmAccountDeletion").is_empty() {
            live += 1;
        }
    }
    assert_eq!(live, 1);
}

/// A request while a confirmed deletion is in its grace (C-2) changes
/// nothing: it answers the standing deletion, mails nothing, spends no
/// budget, keeps the deadline, and the opened link stays valid.
///
/// A request during the grace returns the standing deletion and changes, mails and spends nothing.
/// ´claim:deletion:a-request-during-the-grace-changes-nothing´
#[sqlx::test(migrations = "../../migrations")]
async fn a_request_during_the_grace_changes_nothing(pool: PgPool) {
    let mut limits = RateLimitConfig::unlimited();
    limits.deletion_request_account = Window {
        limit: 1,
        window_secs: 3600.0,
    };
    let rig = WireRig::new(pool, limits);
    let alice = member(&rig, "alice").await;
    let link = requested_link(&rig, &alice, None).await;
    let confirmed = confirm(&rig, &link, None).await;
    let fixed = deadline(&confirmed["confirmAccountDeletion"]);

    for _ in 0..2 {
        let again = request(&rig, &alice.token, Some(true)).await;
        assert_eq!(again["userErrors"], json!([]), "{again}");
        assert_eq!(deadline(&again), fixed);
        assert_eq!(again["accountDeletion"]["includesContent"], false);
    }
    assert_eq!(rig.mailer.subjects_for(&alice.email).len(), 1);
    let reopened = confirm(&rig, &link, None).await;
    assert_eq!(
        codes(&reopened, "confirmAccountDeletion"),
        Vec::<&str>::new()
    );
    assert_eq!(deadline(&reopened["confirmAccountDeletion"]), fixed);
}

/// Opening the link fixes the deadline at the confirm plus seven days,
/// and the viewer's read now carries it.
///
/// Confirming opens the 7-day grace and the viewer reads the deadline.
/// ´claim:deletion:confirming-opens-a-seven-day-grace´
#[sqlx::test(migrations = "../../migrations")]
async fn confirming_opens_a_seven_day_grace(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let link = requested_link(&rig, &alice, None).await;

    let before = Utc::now();
    let confirmed = confirm(&rig, &link, None).await;
    let after = Utc::now();
    let scheduled = deadline(&confirmed["confirmAccountDeletion"]);
    let grace = Duration::seconds(SEVEN_DAYS_SECS);
    assert!(
        scheduled >= before + grace - Duration::seconds(5)
            && scheduled <= after + grace + Duration::seconds(5),
        "{scheduled} is not seven days on"
    );
    let read = me(&rig, &alice.token).await;
    assert_eq!(
        read["accountDeletion"]["scheduledFor"],
        confirmed["confirmAccountDeletion"]["accountDeletion"]["scheduledFor"]
    );
    assert_eq!(read["accountDeletion"]["includesContent"], false);
}

/// Re-opening the link inside the grace is idempotent (046.7): the
/// deadline does not move.
///
/// Re-opening the link inside the grace never moves the deadline.
/// ´claim:deletion:reopening-keeps-the-deadline´
#[sqlx::test(migrations = "../../migrations")]
async fn reopening_the_link_inside_the_grace_keeps_the_deadline(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let link = requested_link(&rig, &alice, None).await;
    let first = deadline(&confirm(&rig, &link, None).await["confirmAccountDeletion"]);
    sqlx::query(
        "UPDATE auth_account_deletions
         SET confirmed_at = confirmed_at - INTERVAL '2 days',
             scheduled_for = scheduled_for - INTERVAL '2 days'
         WHERE user_id = $1",
    )
    .bind(alice.id)
    .execute(&rig.pool)
    .await
    .expect("two days into the grace");

    let again = deadline(&confirm(&rig, &link, None).await["confirmAccountDeletion"]);
    assert_eq!(
        again,
        first - Duration::days(2),
        "the deadline stays where it was"
    );
}

/// Once opened, the link outlives its unopened lifetime: through the
/// whole grace it still answers, D2's expiry reading only an unopened
/// link.
///
/// An opened deletion link stays valid through the grace, past its unopened lifetime.
/// ´claim:deletion:a-confirmed-link-stays-valid-through-the-grace´
#[sqlx::test(migrations = "../../migrations")]
async fn a_confirmed_deletion_link_stays_valid_through_the_grace(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let link = requested_link(&rig, &alice, None).await;
    confirm(&rig, &link, None).await;
    sqlx::query(
        "UPDATE auth_account_deletions SET token_expires_at = NOW() - INTERVAL '1 day'
         WHERE user_id = $1",
    )
    .bind(alice.id)
    .execute(&rig.pool)
    .await
    .expect("past the unopened lifetime");

    let reopened = confirm(&rig, &link, None).await;
    assert_eq!(
        codes(&reopened, "confirmAccountDeletion"),
        Vec::<&str>::new()
    );
}

/// A re-call with includeContent true upgrades an identity-only
/// deletion to the content sweep, inside the grace, without moving the
/// deadline.
///
/// A re-confirm with the content sweep upgrades the deletion.
/// ´claim:deletion:a-reconfirm-upgrades´
#[sqlx::test(migrations = "../../migrations")]
async fn a_reconfirm_with_include_content_upgrades(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let link = requested_link(&rig, &alice, Some(false)).await;
    let first = confirm(&rig, &link, None).await;
    assert_eq!(
        first["confirmAccountDeletion"]["accountDeletion"]["includesContent"],
        false
    );

    let upgraded = confirm(&rig, &link, Some(true)).await;
    assert_eq!(
        upgraded["confirmAccountDeletion"]["accountDeletion"]["includesContent"],
        true
    );
    assert_eq!(
        deadline(&upgraded["confirmAccountDeletion"]),
        deadline(&first["confirmAccountDeletion"])
    );
    assert_eq!(
        me(&rig, &alice.token).await["accountDeletion"]["includesContent"],
        true
    );
}

/// The election is opt-in only: neither false nor null takes the content
/// sweep back once chosen — at the request or at a confirm.
///
/// A re-confirm never downgrades the content sweep.
/// ´claim:deletion:a-reconfirm-never-downgrades´
#[sqlx::test(migrations = "../../migrations")]
async fn a_reconfirm_never_downgrades(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let link = requested_link(&rig, &alice, Some(true)).await;
    for choice in [Some(false), None, Some(false)] {
        let again = confirm(&rig, &link, choice).await;
        assert_eq!(
            again["confirmAccountDeletion"]["accountDeletion"]["includesContent"], true,
            "{choice:?} downgraded"
        );
    }
}

/// The link is the capability: it confirms with no session at all.
///
/// The deletion link confirms signed out.
/// ´claim:deletion:the-link-confirms-signed-out´
#[sqlx::test(migrations = "../../migrations")]
async fn the_link_confirms_signed_out(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let link = requested_link(&rig, &alice, None).await;
    let answer = rig
        .gql_raw(None, CONFIRM, json!({ "input": { "deletionToken": link } }))
        .await;
    assert!(answer.get("errors").is_none(), "{answer}");
    assert!(
        answer["data"]["confirmAccountDeletion"]["accountDeletion"]["scheduledFor"].is_string()
    );
}

/// A token nothing ever minted is DELETION_TOKEN_INVALID at the token.
///
/// An unknown deletion token is refused at the token.
/// ´claim:deletion:an-unknown-token-is-token-invalid´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unknown_deletion_token_is_token_invalid(pool: PgPool) {
    let rig = rig(pool);
    let answer = confirm(&rig, "never-minted", Some(true)).await;
    assert_eq!(
        answer["confirmAccountDeletion"]["userErrors"],
        json!([{ "code": "DELETION_TOKEN_INVALID", "field": ["deletionToken"] }])
    );
    assert!(answer["confirmAccountDeletion"]["accountDeletion"].is_null());
}

/// A superseded link answers the same code as an unknown one, and
/// confirms nothing.
///
/// A superseded deletion link is refused at the token.
/// ´claim:deletion:a-superseded-link-is-token-invalid´
#[sqlx::test(migrations = "../../migrations")]
async fn a_superseded_deletion_link_is_token_invalid(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let first = requested_link(&rig, &alice, None).await;
    requested_link(&rig, &alice, None).await;

    let answer = confirm(&rig, &first, None).await;
    assert_eq!(
        codes(&answer, "confirmAccountDeletion"),
        vec!["DELETION_TOKEN_INVALID"]
    );
    assert!(me(&rig, &alice.token).await["accountDeletion"].is_null());
}

/// A link whose request was cancelled before it was opened is dead.
///
/// A cancelled deletion link is refused at the token.
/// ´claim:deletion:a-cancelled-link-is-token-invalid´
#[sqlx::test(migrations = "../../migrations")]
async fn a_cancelled_deletion_link_is_token_invalid(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let link = requested_link(&rig, &alice, None).await;
    cancel(&rig, &alice.token).await;

    let answer = confirm(&rig, &link, None).await;
    assert_eq!(
        codes(&answer, "confirmAccountDeletion"),
        vec!["DELETION_TOKEN_INVALID"]
    );
    assert!(me(&rig, &alice.token).await["accountDeletion"].is_null());
}

/// An unopened link dies seven days after its request (D2): past that it
/// is the same dead-link code, and nothing is scheduled.
///
/// An unopened deletion link dies after its 7-day lifetime.
/// ´claim:deletion:an-unopened-link-dies-after-its-ttl´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unopened_deletion_link_dies_after_its_ttl(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let link = requested_link(&rig, &alice, None).await;
    let lifetime: f64 = sqlx::query_scalar(
        "SELECT EXTRACT(EPOCH FROM token_expires_at - requested_at)::float8
         FROM auth_account_deletions WHERE user_id = $1",
    )
    .bind(alice.id)
    .fetch_one(&rig.pool)
    .await
    .expect("lifetime");
    assert!(
        (lifetime - SEVEN_DAYS_SECS as f64).abs() < 5.0,
        "the link lives seven days, not {lifetime} s"
    );
    sqlx::query(
        "UPDATE auth_account_deletions
         SET requested_at = requested_at - INTERVAL '7 days 1 second',
             token_expires_at = token_expires_at - INTERVAL '7 days 1 second'
         WHERE user_id = $1",
    )
    .bind(alice.id)
    .execute(&rig.pool)
    .await
    .expect("the clock passes seven days");

    let answer = confirm(&rig, &link, None).await;
    assert_eq!(
        codes(&answer, "confirmAccountDeletion"),
        vec!["DELETION_TOKEN_INVALID"]
    );
    let scheduled: Option<DateTime<Utc>> =
        sqlx::query_scalar("SELECT scheduled_for FROM auth_account_deletions WHERE user_id = $1")
            .bind(alice.id)
            .fetch_one(&rig.pool)
            .await
            .expect("row");
    assert!(scheduled.is_none());
}

/// Cancel needs a session.
///
/// Cancelling a deletion without a session is unauthenticated.
/// ´claim:deletion:cancel-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn cancelling_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = rig(pool);
    let answer = rig.gql_raw(None, CANCEL, json!({})).await;
    assert_eq!(transport_code(&answer), Some("UNAUTHENTICATED"), "{answer}");
}

/// Cancel ends a confirmed deletion in its grace (C-1): the read goes
/// null, and the link that confirmed it is dead from then on.
///
/// Cancel ends a confirmed deletion and kills its link.
/// ´claim:deletion:cancel-ends-a-confirmed-deletion´
#[sqlx::test(migrations = "../../migrations")]
async fn cancel_ends_a_confirmed_deletion_and_kills_its_link(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let link = requested_link(&rig, &alice, None).await;
    confirm(&rig, &link, None).await;
    assert!(me(&rig, &alice.token).await["accountDeletion"].is_object());

    let canceled = cancel(&rig, &alice.token).await;
    assert_eq!(canceled["userErrors"], json!([]));
    assert!(canceled["accountDeletion"].is_null());
    assert!(me(&rig, &alice.token).await["accountDeletion"].is_null());
    let dead = confirm(&rig, &link, None).await;
    assert_eq!(
        codes(&dead, "confirmAccountDeletion"),
        vec!["DELETION_TOKEN_INVALID"]
    );

    let fresh = requested_link(&rig, &alice, None).await;
    let reconfirmed = confirm(&rig, &fresh, None).await;
    assert_eq!(
        codes(&reconfirmed, "confirmAccountDeletion"),
        Vec::<&str>::new()
    );
}

/// With nothing standing, cancel is a no-op answering null and no error —
/// a second device's cancel, and an applicant's, alike.
///
/// Cancel with nothing standing answers null and no error.
/// ´claim:deletion:cancel-with-nothing-standing-is-a-no-op´
#[sqlx::test(migrations = "../../migrations")]
async fn cancel_with_nothing_standing_is_a_no_op(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let second_device = rig.log_in(&alice.email).await;
    let link = requested_link(&rig, &alice, None).await;
    confirm(&rig, &link, None).await;
    let (a, b) = tokio::join!(cancel(&rig, &alice.token), cancel(&rig, &second_device));
    for answer in [a, b] {
        assert_eq!(answer["userErrors"], json!([]));
        assert!(answer["accountDeletion"].is_null());
    }
    let again = cancel(&rig, &alice.token).await;
    assert_eq!(again["userErrors"], json!([]));

    let noa = applicant(&rig, &alice, "noa").await;
    let applicant_cancel = cancel(&rig, &noa.token).await;
    assert_eq!(applicant_cancel["userErrors"], json!([]));
    assert!(applicant_cancel["accountDeletion"].is_null());
}

/// The read is the account's own: another signed-in member and an
/// anonymous reader both read null for an account in its grace.
///
/// The confirmed deletion is readable by its own account alone.
/// ´claim:deletion:account-deletion-is-viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn account_deletion_is_viewer_only(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let bob = member(&rig, "bob").await;
    let link = requested_link(&rig, &alice, None).await;
    confirm(&rig, &link, None).await;

    let query = "query { user(handle: \"alice\") { accountDeletion { scheduledFor } } }";
    assert!(rig.gql(Some(&bob.token), query, json!({})).await["user"]["accountDeletion"].is_null());
    assert!(rig.gql(None, query, json!({})).await["user"]["accountDeletion"].is_null());
    assert!(
        rig.gql(Some(&alice.token), query, json!({})).await["user"]["accountDeletion"]
            ["scheduledFor"]
            .is_string()
    );
}

/// A requested-not-confirmed deletion has no status: the read stays null
/// until the link is opened.
///
/// The deletion reads null before the link is opened.
/// ´claim:deletion:account-deletion-reads-null-before-confirmation´
#[sqlx::test(migrations = "../../migrations")]
async fn account_deletion_reads_null_before_confirmation(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    assert!(me(&rig, &alice.token).await["accountDeletion"].is_null());
    let link = requested_link(&rig, &alice, Some(true)).await;
    assert!(me(&rig, &alice.token).await["accountDeletion"].is_null());
    confirm(&rig, &link, None).await;
    assert_eq!(
        me(&rig, &alice.token).await["accountDeletion"]["includesContent"],
        true
    );
}

/// The applicant verb needs a session.
///
/// Deleting an applicant without a session is unauthenticated.
/// ´claim:deletion:the-applicant-verb-needs-a-session´
#[sqlx::test(migrations = "../../migrations")]
async fn deleting_an_applicant_without_a_session_is_unauthenticated(pool: PgPool) {
    let rig = rig(pool);
    let answer = rig.gql_raw(None, DELETE_APPLICANT, json!({})).await;
    assert_eq!(transport_code(&answer), Some("UNAUTHENTICATED"), "{answer}");
}

/// A member is refused the immediate path — FORBIDDEN, and the account
/// stands untouched.
///
/// A member is refused the applicant's immediate delete.
/// ´claim:deletion:a-member-cannot-take-the-applicant-path´
#[sqlx::test(migrations = "../../migrations")]
async fn a_member_cannot_take_the_applicant_path(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let answer = rig
        .gql_raw(Some(&alice.token), DELETE_APPLICANT, json!({}))
        .await;
    assert_eq!(transport_code(&answer), Some("FORBIDDEN"), "{answer}");
    assert_eq!(
        count(&rig, "SELECT COUNT(*) FROM actors WHERE id = $1", alice.id).await,
        1
    );
    assert_eq!(me(&rig, &alice.token).await["id"], alice.id.to_string());
}

/// An applicant whose address approval funded cannot delete (B10, keyed
/// "funded and not member" by design item 69): the burn is spent and the
/// Registration staged. FORBIDDEN, and nothing is deleted.
///
/// A funded applicant that has not landed is refused the immediate delete, and nothing goes.
/// ´claim:deletion:a-funded-applicant-cannot-delete´
#[sqlx::test(migrations = "../../migrations")]
async fn an_approved_not_landed_applicant_cannot_delete(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    approve(&rig, &mira, &noa).await;
    let staged_before = count(
        &rig,
        "SELECT COUNT(*) FROM staged_writes WHERE actor_id = $1",
        noa.id,
    )
    .await;
    assert!(staged_before > 0, "approval staged the Registration");

    let answer = rig
        .gql_raw(Some(&noa.token), DELETE_APPLICANT, json!({}))
        .await;
    assert_eq!(transport_code(&answer), Some("FORBIDDEN"), "{answer}");
    assert_eq!(
        count(&rig, "SELECT COUNT(*) FROM actors WHERE id = $1", noa.id).await,
        1
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM staged_writes WHERE actor_id = $1",
            noa.id
        )
        .await,
        staged_before
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM auth_applications WHERE account_id = $1",
            noa.id
        )
        .await,
        1
    );
}

/// The window's far edge (design item 69): an applicant whose
/// Registration landed but whom no vouch has landed has a node on the
/// graph, so it takes the mailed member path — the immediate delete
/// stays refused.
///
/// A registered, un-vouched applicant deletes through the mailed member path.
/// ´claim:deletion:a-registered-applicant-takes-the-member-path´
#[sqlx::test(migrations = "../../migrations")]
async fn a_registered_unvouched_applicant_takes_the_member_path(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    approve(&rig, &mira, &noa).await;
    sign_registration(&rig, &noa).await;
    rig.close_and_ingest().await;
    assert_eq!(account_state(&rig, noa.id).await, "applicant");

    let immediate = rig
        .gql_raw(Some(&noa.token), DELETE_APPLICANT, json!({}))
        .await;
    assert_eq!(transport_code(&immediate), Some("FORBIDDEN"), "{immediate}");
    let mailed = request(&rig, &noa.token, None).await;
    assert_eq!(mailed["userErrors"], json!([]), "{mailed}");
    let link = rig.mailer.latest_token_for(&noa.email);
    let confirmed = confirm(&rig, &link, None).await;
    assert_eq!(
        codes(&confirmed, "confirmAccountDeletion"),
        Vec::<&str>::new()
    );
}

/// An applicant deletes at once and whole: account, credentials,
/// application, ask link, staged writes, key backup and challenge, device
/// lock and preferences are gone, every session with them — a refresh is
/// refused and the access token reads no account. No mail is sent.
///
/// An applicant deletes at once and whole, and every session dies.
/// ´claim:deletion:an-applicant-deletes-at-once´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_deletes_at_once_and_every_session_dies(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let login = rig
        .gql(
            None,
            LOG_IN,
            json!({ "input": { "email": noa.email, "password": MEMBER_PASSWORD } }),
        )
        .await;
    let refresh = login["logIn"]["auth"]["refreshToken"]
        .as_str()
        .expect("refresh")
        .to_string();
    store::upload_key_backup(&rig.pool, noa.id, b"backup")
        .await
        .expect("backup");
    store::issue_key_backup_challenge(
        &rig.pool,
        noa.id,
        b"challenge",
        Utc::now() + Duration::minutes(5),
    )
    .await
    .expect("challenge");
    let lock = rig
        .gql(
            Some(&noa.token),
            "mutation { issueDeviceLock { lock { id } userErrors { code } } }",
            json!({}),
        )
        .await;
    assert!(lock["issueDeviceLock"]["lock"]["id"].is_string(), "{lock}");
    rig.gql(
        Some(&noa.token),
        "mutation($input: SetPreferencesInput!) {
           setPreferences(input: $input) { userErrors { code } }
         }",
        json!({ "input": { "hasSeenOnboarding": true } }),
    )
    .await;
    carry(
        &rig,
        &noa,
        PREPARE_STANCE,
        json!({ "target": mira.id, "pDirected": 0.3, "pInterest": 0.2 }),
    )
    .await;
    let mails_before = rig.mailer.count();

    let deleted = rig.gql(Some(&noa.token), DELETE_APPLICANT, json!({})).await;
    assert_eq!(deleted["deleteApplicantAccount"]["ok"], true, "{deleted}");
    assert_eq!(deleted["deleteApplicantAccount"]["userErrors"], json!([]));

    for (table, column) in [
        ("actors", "id"),
        ("user_credentials", "actor_id"),
        ("actor_profile_versions", "actor_id"),
        ("staged_writes", "actor_id"),
        ("auth_refresh_tokens", "user_id"),
        ("auth_applications", "account_id"),
        ("auth_ask_links", "account_id"),
        ("auth_key_backups", "user_id"),
        ("auth_key_backup_challenges", "user_id"),
        ("auth_device_locks", "user_id"),
        ("user_preferences", "user_id"),
        ("media_attachments", "author_id"),
        ("media_upload_sessions", "author_id"),
    ] {
        let sql = format!("SELECT COUNT(*) FROM {table} WHERE {column} = $1");
        assert_eq!(count(&rig, &sql, noa.id).await, 0, "{table} kept a row");
    }
    let refreshed = rig
        .gql(
            None,
            REFRESH,
            json!({ "input": { "refreshToken": refresh } }),
        )
        .await;
    assert_eq!(
        codes(&refreshed, "refreshSession"),
        vec!["REFRESH_TOKEN_INVALID"]
    );
    assert!(
        me(&rig, &noa.token).await.is_null(),
        "the access token reads no account"
    );
    let again = rig
        .gql_raw(Some(&noa.token), DELETE_APPLICANT, json!({}))
        .await;
    assert_eq!(transport_code(&again), Some("UNAUTHENTICATED"), "{again}");
    assert_eq!(rig.mailer.count(), mails_before, "no mail is sent");
    assert_eq!(
        count(&rig, "SELECT COUNT(*) FROM actors WHERE id = $1", mira.id).await,
        1
    );
}

/// The acts carried with the application (case (a2)) go with the account
/// — the carried post with the Tag it declares, the Opinion, the
/// Affinity — and the graph gains nothing: none of it was ever on L1.
///
/// An applicant's deletion takes its carried acts, and nothing reaches the graph.
/// ´claim:deletion:an-applicant-deletion-takes-its-carried-acts´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_deletion_takes_its_carried_acts(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    carry(
        &rig,
        &noa,
        PREPARE_STANCE,
        json!({ "target": mira.id, "pDirected": 0.3, "pInterest": 0.2 }),
    )
    .await;
    carry(
        &rig,
        &noa,
        PREPARE_STANCE,
        json!({ "topicName": "gardening", "pDirected": 0.5, "pInterest": 0.5 }),
    )
    .await;
    carry(
        &rig,
        &noa,
        PREPARE_POST,
        json!({
            "content": "a first word",
            "license": { "attribution": 0.0, "provenance": 0.0 },
            "tags": [{ "name": "gardening" }],
        }),
    )
    .await;
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM staged_writes WHERE actor_id = $1 AND state = 'carried'",
            noa.id
        )
        .await,
        4,
        "the post, its Tag, the Opinion and the Affinity"
    );
    let address = noa.key.address();
    let mirrored = |rig: &WireRig| {
        let address = address.clone();
        let pool = rig.pool.clone();
        async move {
            sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM mirror_records WHERE author = $1")
                .bind(address)
                .fetch_one(&pool)
                .await
                .expect("mirror count")
        }
    };
    let before = mirrored(&rig).await;

    let deleted = rig.gql(Some(&noa.token), DELETE_APPLICANT, json!({})).await;
    assert_eq!(deleted["deleteApplicantAccount"]["ok"], true, "{deleted}");
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM staged_writes WHERE actor_id = $1",
            noa.id
        )
        .await,
        0
    );
    rig.close_and_ingest().await;
    assert_eq!(
        mirrored(&rig).await,
        before,
        "nothing of the applicant reached the graph"
    );
}

/// The device locks go with the applicant — by the actor row's cascade,
/// which the whole-account delete fires.
///
/// An applicant's deletion takes its device locks.
/// ´claim:deletion:an-applicant-deletion-takes-its-device-locks´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_deletion_takes_its_device_locks(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    for _ in 0..2 {
        rig.gql(
            Some(&noa.token),
            "mutation { issueDeviceLock { lock { id } userErrors { code } } }",
            json!({}),
        )
        .await;
    }
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM auth_device_locks WHERE user_id = $1",
            noa.id
        )
        .await,
        2
    );
    let mira_lock = rig
        .gql(
            Some(&mira.token),
            "mutation { issueDeviceLock { lock { id } userErrors { code } } }",
            json!({}),
        )
        .await;
    assert!(mira_lock["issueDeviceLock"]["lock"]["id"].is_string());

    rig.gql(Some(&noa.token), DELETE_APPLICANT, json!({})).await;
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM auth_device_locks WHERE user_id = $1",
            noa.id
        )
        .await,
        0
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM auth_device_locks WHERE user_id = $1",
            mira.id
        )
        .await,
        1,
        "another account's lock stays"
    );
}

/// The deleted applicant's email and handle are free again: the same
/// person can register anew. Deliberately silent on the single-use invite
/// slot — consumed for good at account creation (round-3 ruling), which
/// the link's used-at stamp will enforce for this path and the reaper's
/// alike.
///
/// An applicant's deletion frees its email and handle for a fresh registration.
/// ´claim:deletion:an-applicant-deletion-frees-its-email-and-handle´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_deletion_frees_its_email_and_handle(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let taken = register(&rig, noa.link, "noa").await;
    assert_eq!(
        taken["data"]["register"]["userErrors"][0]["code"], "HANDLE_TAKEN",
        "{taken}"
    );

    rig.gql(Some(&noa.token), DELETE_APPLICANT, json!({})).await;
    let again = applicant_through(&rig, noa.link, "noa").await;
    assert_ne!(again.id, noa.id, "a new account, not the old one");
    assert_eq!(again.email, noa.email);
}

/// Once the account lands it is a member: the immediate path is refused,
/// and the mailed path opens.
///
/// After the landing the applicant's immediate delete closes and the mailed path opens.
/// ´claim:deletion:after-landing-the-member-path-opens´
#[sqlx::test(migrations = "../../migrations")]
async fn after_landing_the_member_path_opens(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let vouch = approve(&rig, &mira, &noa).await;
    sign(&rig, &mira.key, vouch).await;
    sign_registration(&rig, &noa).await;
    rig.close_and_ingest().await;
    assert_eq!(account_state(&rig, noa.id).await, "member");

    let immediate = rig
        .gql_raw(Some(&noa.token), DELETE_APPLICANT, json!({}))
        .await;
    assert_eq!(transport_code(&immediate), Some("FORBIDDEN"), "{immediate}");
    let mailed = request(&rig, &noa.token, None).await;
    assert_eq!(mailed["userErrors"], json!([]), "{mailed}");
    assert_eq!(
        rig.mailer
            .subjects_for(&noa.email)
            .last()
            .map(String::as_str),
        Some("Confirm the deletion of your CoGra account")
    );
}

/// The spent-secret sweep takes deletions that ended unexecuted past the
/// retention window — cancelled, superseded, unopened past their
/// lifetime — and leaves the standing one and anything inside the
/// window. A swept link answers what any dead link does.
///
/// The secret sweep takes ended deletions past retention and keeps the standing one.
/// ´claim:deletion:the-sweep-takes-ended-deletions´
#[sqlx::test(migrations = "../../migrations")]
async fn the_secret_sweep_takes_ended_deletions_and_keeps_the_standing_one(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let bob = member(&rig, "bob").await;
    let carol = member(&rig, "carol").await;
    let superseded = requested_link(&rig, &alice, None).await;
    let standing = requested_link(&rig, &alice, None).await;
    requested_link(&rig, &bob, None).await;
    cancel(&rig, &bob.token).await;
    requested_link(&rig, &carol, None).await;
    sqlx::query(
        "UPDATE auth_account_deletions
         SET superseded_at = superseded_at - INTERVAL '2 days',
             cancelled_at = cancelled_at - INTERVAL '2 days'",
    )
    .execute(&rig.pool)
    .await
    .expect("ages the ends");
    sqlx::query(
        "UPDATE auth_account_deletions SET token_expires_at = NOW() - INTERVAL '2 days'
         WHERE user_id = $1",
    )
    .bind(carol.id)
    .execute(&rig.pool)
    .await
    .expect("carol's link expired long ago");

    let swept = store::sweep_spent_secrets(&rig.pool, 86_400.0, 86_400.0)
        .await
        .expect("sweep");
    assert_eq!(swept.account_deletions, 3);
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM auth_account_deletions WHERE user_id = $1",
            alice.id
        )
        .await,
        1
    );
    assert_eq!(
        codes(
            &confirm(&rig, &superseded, None).await,
            "confirmAccountDeletion"
        ),
        vec!["DELETION_TOKEN_INVALID"]
    );
    assert_eq!(
        codes(
            &confirm(&rig, &standing, None).await,
            "confirmAccountDeletion"
        ),
        Vec::<&str>::new()
    );
}

const PATH: &str = "query { me { deletionPath } }";

/// The viewer's own deletion path, as the server computes it (OS-15).
async fn deletion_path(rig: &WireRig, token: &str) -> String {
    let data = rig.gql(Some(token), PATH, json!({})).await;
    data["me"]["deletionPath"]
        .as_str()
        .unwrap_or_else(|| panic!("deletionPath: {data}"))
        .to_string()
}

/// Ends the vouch's staged write unsigned and runs the real lapse over
/// it: the path's approval mark clears (`approvedAt` null) while the
/// funding row stays.
async fn lapse_vouch(rig: &WireRig, vouch: Uuid, who: &Applicant) {
    sqlx::query("UPDATE staged_writes SET state = 'expired' WHERE id = $1")
        .bind(vouch)
        .execute(&rig.pool)
        .await
        .expect("expires the vouch's write");
    let due = store::vouches_to_lapse(&rig.pool).await.expect("due");
    let ids: Vec<Uuid> = due
        .into_iter()
        .filter(|(_, account)| *account == who.id)
        .map(|(id, _)| id)
        .collect();
    assert_eq!(ids.len(), 1, "the vouch is due to lapse");
    store::lapse_vouches(&rig.pool, who.id, &ids)
        .await
        .expect("lapses");
}

async fn approved_at(rig: &WireRig, token: &str) -> Value {
    rig.gql(
        Some(token),
        "query { me { application { approvedAt } } }",
        json!({}),
    )
    .await["me"]["application"]["approvedAt"]
        .clone()
}

/// A member deletes through the mailed link, whatever else is true of
/// them: the path reads BY_LINK.
///
/// A member reads the by-link deletion path.
/// ´claim:deletion:a-member-reads-the-by-link-path´
#[sqlx::test(migrations = "../../migrations")]
async fn a_member_reads_the_by_link_path(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    assert_eq!(deletion_path(&rig, &alice.token).await, "BY_LINK");
}

/// An applicant whose Registration is in the mirror has a node on the
/// graph, so item 69 gives it the member path: BY_LINK, though it is not
/// yet a member and its address is funded.
///
/// A registered applicant reads the by-link deletion path.
/// ´claim:deletion:a-registered-applicant-reads-the-by-link-path´
#[sqlx::test(migrations = "../../migrations")]
async fn a_registered_applicant_reads_the_by_link_path(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    approve(&rig, &mira, &noa).await;
    sign_registration(&rig, &noa).await;
    rig.close_and_ingest().await;
    assert_eq!(account_state(&rig, noa.id).await, "applicant");
    assert_eq!(deletion_path(&rig, &noa.token).await, "BY_LINK");
}

/// An applicant whose address is funded but whose Registration has not
/// landed is LOCKED, whatever state its funding row is in (ER-G17,
/// option (a)). The suite's rig settles a burn at once, so the row is put
/// back to requested, then failed, to read the states a settlement delay
/// would show.
///
/// A funded applicant whose Registration is not in the mirror reads locked, in any funding state.
/// ´claim:deletion:a-funded-unregistered-applicant-reads-locked´
#[sqlx::test(migrations = "../../migrations")]
async fn a_funded_unregistered_applicant_reads_locked(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    assert_eq!(deletion_path(&rig, &noa.token).await, "IMMEDIATE");
    approve(&rig, &mira, &noa).await;
    assert_eq!(deletion_path(&rig, &noa.token).await, "LOCKED", "settled");

    sqlx::query("UPDATE auth_admission_fundings SET settled_at = NULL WHERE account_id = $1")
        .bind(noa.id)
        .execute(&rig.pool)
        .await
        .expect("back to requested");
    assert_eq!(deletion_path(&rig, &noa.token).await, "LOCKED", "requested");

    assert!(
        store::mark_funding_failed(&rig.pool, &noa.key.address())
            .await
            .expect("fails the funding")
    );
    assert_eq!(deletion_path(&rig, &noa.token).await, "LOCKED", "failed");
}

/// An applicant whose address was never funded deletes at once: the path
/// reads IMMEDIATE.
///
/// An unfunded applicant reads the immediate deletion path.
/// ´claim:deletion:an-unfunded-applicant-reads-the-immediate-path´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unfunded_applicant_reads_the_immediate_path(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    assert_eq!(deletion_path(&rig, &noa.token).await, "IMMEDIATE");
}

/// The trap: a lapsed vouch clears `approvedAt`, but the funding row
/// stays, so the path never falls back to IMMEDIATE. A lapsed, funded
/// applicant whose Registration has not landed reads LOCKED and the
/// immediate verb is refused with nothing deleted; one whose Registration
/// landed reads BY_LINK.
///
/// A lapsed vouch never unlocks the deletion row, whatever approvedAt reads.
/// ´claim:deletion:a-lapsed-vouch-never-unlocks-the-deletion-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_lapsed_vouch_never_unlocks_the_deletion_row(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;

    let noa = applicant(&rig, &mira, "noa").await;
    let vouch = approve(&rig, &mira, &noa).await;
    assert!(!approved_at(&rig, &noa.token).await.is_null());
    lapse_vouch(&rig, vouch, &noa).await;
    assert!(approved_at(&rig, &noa.token).await.is_null(), "lapsed");
    assert_eq!(deletion_path(&rig, &noa.token).await, "LOCKED");
    let answer = rig
        .gql_raw(Some(&noa.token), DELETE_APPLICANT, json!({}))
        .await;
    assert_eq!(transport_code(&answer), Some("FORBIDDEN"), "{answer}");
    assert_eq!(
        count(&rig, "SELECT COUNT(*) FROM actors WHERE id = $1", noa.id).await,
        1
    );

    let ana = applicant(&rig, &mira, "ana").await;
    let vouch = approve(&rig, &mira, &ana).await;
    sign_registration(&rig, &ana).await;
    rig.close_and_ingest().await;
    lapse_vouch(&rig, vouch, &ana).await;
    assert!(approved_at(&rig, &ana.token).await.is_null(), "lapsed");
    assert_eq!(deletion_path(&rig, &ana.token).await, "BY_LINK");
    let answer = rig
        .gql_raw(Some(&ana.token), DELETE_APPLICANT, json!({}))
        .await;
    assert_eq!(transport_code(&answer), Some("FORBIDDEN"), "{answer}");
}

/// In every state exactly the named verb opens and the other is
/// FORBIDDEN: BY_LINK takes the mailed request, IMMEDIATE the applicant
/// delete, LOCKED neither.
///
/// The deletion path names the one verb that answers; the other is forbidden.
/// ´claim:deletion:the-deletion-path-names-the-one-verb-that-answers´
#[sqlx::test(migrations = "../../migrations")]
async fn the_deletion_path_names_the_one_verb_that_answers(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;

    assert_eq!(deletion_path(&rig, &mira.token).await, "BY_LINK");
    let refused = rig
        .gql_raw(Some(&mira.token), DELETE_APPLICANT, json!({}))
        .await;
    assert_eq!(transport_code(&refused), Some("FORBIDDEN"), "{refused}");
    let opened = request(&rig, &mira.token, None).await;
    assert_eq!(opened["userErrors"], json!([]), "{opened}");

    let locked = applicant(&rig, &mira, "noa").await;
    approve(&rig, &mira, &locked).await;
    assert_eq!(deletion_path(&rig, &locked.token).await, "LOCKED");
    let refused = rig
        .gql_raw(Some(&locked.token), DELETE_APPLICANT, json!({}))
        .await;
    assert_eq!(transport_code(&refused), Some("FORBIDDEN"), "{refused}");
    let refused = rig
        .gql_raw(
            Some(&locked.token),
            REQUEST,
            json!({ "input": { "includeContent": null } }),
        )
        .await;
    assert_eq!(transport_code(&refused), Some("FORBIDDEN"), "{refused}");

    let immediate = applicant(&rig, &mira, "ana").await;
    assert_eq!(deletion_path(&rig, &immediate.token).await, "IMMEDIATE");
    let refused = rig
        .gql_raw(
            Some(&immediate.token),
            REQUEST,
            json!({ "input": { "includeContent": null } }),
        )
        .await;
    assert_eq!(transport_code(&refused), Some("FORBIDDEN"), "{refused}");
    let deleted = rig
        .gql_raw(Some(&immediate.token), DELETE_APPLICANT, json!({}))
        .await;
    assert_eq!(deleted["data"]["deleteApplicantAccount"]["ok"], true);
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM actors WHERE id = $1",
            immediate.id
        )
        .await,
        0
    );
}

/// A verb re-derives the path under the account lock: an approval that
/// funds the address after the path was read, while the verb waits on the
/// lock, is seen by the verb, which is then refused and deletes nothing.
///
/// A deletion verb re-checks the path under the account lock, so a funding between read and verb refuses it.
/// ´claim:deletion:a-deletion-verb-rechecks-the-path-under-the-lock´
#[sqlx::test(migrations = "../../migrations")]
async fn a_deletion_verb_rechecks_the_path_under_the_account_lock(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    assert_eq!(deletion_path(&rig, &noa.token).await, "IMMEDIATE");

    let mut tx = rig.pool.begin().await.expect("begins");
    assert!(
        store::lock_account(&mut tx, noa.id)
            .await
            .expect("locks the account")
    );
    let verb = rig.gql_raw(Some(&noa.token), DELETE_APPLICANT, json!({}));
    let address = noa.key.address();
    let account = noa.id;
    let funder = async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        sqlx::query(
            "INSERT INTO auth_admission_fundings (address, account_id, amount_micro, request_key)
             VALUES ($1, $2, 1, gen_random_uuid())",
        )
        .bind(address)
        .bind(account)
        .execute(&mut *tx)
        .await
        .expect("the approval funds the address");
        tx.commit().await.expect("commits");
    };
    let (answer, ()) = tokio::join!(verb, funder);
    assert_eq!(transport_code(&answer), Some("FORBIDDEN"), "{answer}");
    assert_eq!(
        count(&rig, "SELECT COUNT(*) FROM actors WHERE id = $1", noa.id).await,
        1
    );
    assert_eq!(deletion_path(&rig, &noa.token).await, "LOCKED");
}

/// The read is the account's own: another signed-in member and an
/// anonymous reader both read null for someone else's account.
///
/// The deletion path is readable by its own account alone.
/// ´claim:deletion:the-deletion-path-is-viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn the_deletion_path_is_viewer_only(pool: PgPool) {
    let rig = rig(pool);
    let alice = member(&rig, "alice").await;
    let bob = member(&rig, "bob").await;

    let query = "query { user(handle: \"alice\") { deletionPath } }";
    assert!(rig.gql(Some(&bob.token), query, json!({})).await["user"]["deletionPath"].is_null());
    assert!(rig.gql(None, query, json!({})).await["user"]["deletionPath"].is_null());
    assert_eq!(
        rig.gql(Some(&alice.token), query, json!({})).await["user"]["deletionPath"],
        "BY_LINK"
    );
}
