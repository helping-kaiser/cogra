//! The ask link through the real HTTP surface (auth.md "The ask link";
//! EC-R3): the applicant's standing capability, the anonymous check that
//! names who is asking and whether this caller can take them up, the
//! deliberate stage into the caller's own queue, the approval queue across
//! both ends of the funnel, and every refusal the stage names. Several
//! members may be asked at once; one member holds at most one open
//! application of the same person. Requires a live Postgres (`make up`).

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

const REGISTER: &str = "mutation($input: RegisterInput!) {
    register(input: $input) { auth { accessToken user { id } } userErrors { code field } }
}";

const STAGE: &str = "mutation($input: StageApplicantInput!) {
    stageApplicant(input: $input) {
        application {
            id handle emailVerified keyAttached approvedAt rejectedAt
            approver { handle } inviteLink { id }
        }
        userErrors { code field message }
    }
}";

const CHECK: &str = "query($id: UUID!) {
    askLinkCheck(id: $id) { usable applicantHandle reason }
}";

const QUEUE: &str = "query { me { approvalQueue(first: 50) { edges { node {
    id handle approver { handle } inviteLink { id }
} } } } }";

const APPROVE: &str = "mutation($input: ApproveApplicantsInput!) {
    approveApplicants(input: $input) {
        writes { id family canonicalProposal }
        userErrors { code field message }
    }
}";

const REJECT: &str = "mutation($input: RejectApplicationInput!) {
    rejectApplication(input: $input) {
        application { id rejectedAt }
        userErrors { code field message }
    }
}";

const MY_APPLICATION: &str = "query { me { accountState askLink
    application { id approvedAt rejectedAt landedAt approver { handle } inviteLink { id } } } }";

/// A seeded, funded member, logged in.
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

/// A member with no burn behind their address: any priced act they
/// attempt fails the write rule.
async fn unfunded_member(rig: &WireRig, handle: &str) -> Member {
    let key = ActorKey::generate();
    let id = Uuid::new_v4();
    let email = format!("{handle}@example.com");
    let mut conn = rig.pool.acquire().await.expect("conn");
    postgres_store::genesis::insert_actor(
        &mut conn,
        id,
        "user",
        handle,
        &key.public_key_bytes(),
        &key.address(),
    )
    .await
    .expect("actor");
    drop(conn);
    postgres_store::genesis::insert_credentials(
        &rig.pool,
        id,
        &email,
        &api::auth::hash_password(rig::MEMBER_PASSWORD).expect("hash"),
    )
    .await
    .expect("credentials");
    let token = rig.log_in(&email).await;
    Member { id, key, token }
}

async fn new_link(rig: &WireRig, token: &str) -> String {
    let issued = rig
        .gql(
            Some(token),
            CREATE_INVITE_LINK,
            json!({ "input": { "expiresAt": "2027-01-01T00:00:00Z", "singleUse": false } }),
        )
        .await;
    issued["createInviteLink"]["inviteLink"]["id"]
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

/// Registers through a fresh link of `issuer`.
async fn applicant(rig: &WireRig, issuer: &Member, handle: &str) -> Applicant {
    let link = new_link(rig, &issuer.token).await;
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
    let auth = &registered["register"]["auth"];
    let token = auth["accessToken"]
        .as_str()
        .unwrap_or_else(|| panic!("registers: {registered}"))
        .to_string();
    let id = auth["user"]["id"]
        .as_str()
        .expect("id")
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

/// Both approvability proofs, the way a device runs them.
async fn prove(rig: &WireRig, who: &Applicant) -> ActorKey {
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

async fn stage(rig: &WireRig, token: &str, ask_link: &str) -> Value {
    rig.gql(
        Some(token),
        STAGE,
        json!({ "input": { "askLink": ask_link } }),
    )
    .await["stageApplicant"]
        .clone()
}

/// Stages, asserting it succeeded; the staged application's id.
async fn staged(rig: &WireRig, token: &str, ask_link: &str) -> String {
    let staged = stage(rig, token, ask_link).await;
    assert_eq!(staged["userErrors"], json!([]), "{staged}");
    staged["application"]["id"]
        .as_str()
        .expect("application")
        .to_string()
}

async fn check(rig: &WireRig, token: Option<&str>, id: &str) -> Value {
    rig.gql(token, CHECK, json!({ "id": id })).await["askLinkCheck"].clone()
}

/// The handles and ids in the caller's approval queue, in its order.
async fn queue(rig: &WireRig, token: &str) -> Vec<Value> {
    let read = rig.gql(Some(token), QUEUE, json!({})).await;
    read["me"]["approvalQueue"]["edges"]
        .as_array()
        .expect("queue")
        .iter()
        .map(|e| e["node"].clone())
        .collect()
}

fn ids(rows: &[Value]) -> Vec<String> {
    rows.iter()
        .map(|r| r["id"].as_str().expect("id").to_string())
        .collect()
}

async fn approve(rig: &WireRig, token: &str, application: &str) -> Value {
    rig.gql(
        Some(token),
        APPROVE,
        json!({ "input": { "approvals": [{
            "application": application, "pDirected": 0.5, "pInterest": 0.1,
        }]}}),
    )
    .await["approveApplicants"]
        .clone()
}

fn codes(payload: &Value) -> Vec<String> {
    payload["userErrors"]
        .as_array()
        .expect("userErrors")
        .iter()
        .map(|e| e["code"].as_str().expect("code").to_string())
        .collect()
}

async fn open_rows_with(rig: &WireRig, account: Uuid, approver: Uuid) -> i64 {
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM auth_applications
         WHERE account_id = $1 AND approver_id = $2
           AND rejected_at IS NULL AND landed_at IS NULL",
    )
    .bind(account)
    .bind(approver)
    .fetch_one(&rig.pool)
    .await
    .expect("count")
}

fn unlimited(pool: PgPool) -> WireRig {
    WireRig::new(pool, api::ratelimit::RateLimitConfig::unlimited())
}

/// Registration writes the account's ask link in the same transaction as
/// the account, and the applicant reads it as their own.
///
/// Registration writes the account's ask link, which the applicant reads as their own.
/// ´claim:onboarding:registration-writes-the-ask-link´
#[sqlx::test(migrations = "../../migrations")]
async fn registration_writes_the_ask_link(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let stored = store::ask_link_of(&rig.pool, noa.id)
        .await
        .expect("read")
        .expect("written at registration");
    assert_eq!(noa.ask_link, stored.to_string());
}

/// The ask link is the capability itself, so it reads for its own
/// account only: another member and an anonymous reader both read null.
///
/// The ask link resolves only for the account it belongs to.
/// ´claim:onboarding:the-ask-link-reads-for-its-account-only´
#[sqlx::test(migrations = "../../migrations")]
async fn the_ask_link_reads_for_its_account_only(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let query = "query($h: String!) { user(handle: $h) { askLink } }";
    for token in [Some(mira.token.as_str()), None] {
        let read = rig.gql(token, query, json!({ "h": "noa" })).await;
        assert!(read["user"]["askLink"].is_null(), "{read}");
    }
    let own = rig.gql(Some(&noa.token), query, json!({ "h": "noa" })).await;
    assert_eq!(own["user"]["askLink"], noa.ask_link.as_str());
}

/// A genesis account never applied, so it has no ask link.
///
/// An account that never applied reads no ask link.
/// ´claim:onboarding:a-genesis-account-has-no-ask-link´
#[sqlx::test(migrations = "../../migrations")]
async fn a_genesis_account_has_no_ask_link(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let me = rig.gql(Some(&mira.token), "query { me { askLink } }", json!({})).await;
    assert!(me["me"]["askLink"].is_null(), "{me}");
}

/// An id that names no ask link reads null, never an error.
///
/// The ask-link check of an unknown id is null.
/// ´claim:onboarding:an-unknown-ask-link-checks-null´
#[sqlx::test(migrations = "../../migrations")]
async fn ask_link_check_of_an_unknown_id_is_null(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let unknown = Uuid::new_v4().to_string();
    for token in [Some(mira.token.as_str()), None] {
        assert!(check(&rig, token, &unknown).await.is_null());
    }
}

/// Landing retires the link: once the account is a member, the check
/// reads LANDED for everyone and names the person, so the profile door can
/// replace the ask, and staging refuses.
///
/// A landed account's ask link reads LANDED for every caller and stages nobody.
/// ´claim:onboarding:landing-retires-the-ask-link´
#[sqlx::test(migrations = "../../migrations")]
async fn ask_link_of_a_landed_member_reads_landed(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let path: Uuid = noa.application.parse().expect("uuid");
    assert!(store::land_path_directly(&rig.pool, path).await.expect("lands"));

    for token in [Some(kel.token.as_str()), Some(mira.token.as_str()), None] {
        let read = check(&rig, token, &noa.ask_link).await;
        assert_eq!(
            read,
            json!({ "usable": false, "applicantHandle": "noa", "reason": "LANDED" })
        );
    }
    let refused = stage(&rig, &kel.token, &noa.ask_link).await;
    assert_eq!(codes(&refused), vec!["ASK_LINK_UNUSABLE"], "{refused}");
    assert!(refused["application"].is_null());
}

/// A member who already has the asker waiting in their own queue reads
/// WAITING_ON_VIEWER — the client opens that row — and only they do.
///
/// An ask link already waiting in the caller's queue reads WAITING_ON_VIEWER for that caller.
/// ´claim:onboarding:an-ask-link-in-my-queue-reads-waiting-on-viewer´
#[sqlx::test(migrations = "../../migrations")]
async fn ask_link_already_in_my_queue_reads_waiting_on_viewer(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    staged(&rig, &kel.token, &noa.ask_link).await;

    assert_eq!(
        check(&rig, Some(&kel.token), &noa.ask_link).await,
        json!({ "usable": false, "applicantHandle": "noa", "reason": "WAITING_ON_VIEWER" })
    );
    // The registration path is the issuer's own open row: mira reads it too.
    assert_eq!(
        check(&rig, Some(&mira.token), &noa.ask_link).await["reason"],
        "WAITING_ON_VIEWER"
    );
}

/// WAITING_ON_VIEWER is viewer-relative: a call without a session never
/// reads it, whoever's queue the asker waits in.
///
/// An anonymous ask-link check never reads WAITING_ON_VIEWER.
/// ´claim:onboarding:an-anonymous-check-never-reads-waiting-on-viewer´
#[sqlx::test(migrations = "../../migrations")]
async fn anonymous_check_never_reads_waiting_on_viewer(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    staged(&rig, &kel.token, &noa.ask_link).await;
    assert_eq!(
        check(&rig, None, &noa.ask_link).await,
        json!({ "usable": true, "applicantHandle": "noa", "reason": null })
    );
}

/// EC-R3: a live application in other members' queues never stops the
/// link — anonymously, and for a third member who holds no row of the
/// asker, it stays usable.
///
/// A live application in another member's queue never makes the ask link unusable.
/// ´claim:onboarding:a-live-application-elsewhere-never-blocks-the-ask-link´
#[sqlx::test(migrations = "../../migrations")]
async fn ask_link_with_a_live_application_elsewhere_stays_usable(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let sol = member(&rig, "sol").await;
    let noa = applicant(&rig, &mira, "noa").await;
    staged(&rig, &kel.token, &noa.ask_link).await;
    for token in [None, Some(sol.token.as_str())] {
        assert_eq!(
            check(&rig, token, &noa.ask_link).await,
            json!({ "usable": true, "applicantHandle": "noa", "reason": null })
        );
    }
}

/// An id that names no ask link refuses the stage, and nothing is written.
///
/// Staging through an unknown ask link is ASK_LINK_UNUSABLE.
/// ´claim:onboarding:staging-an-unknown-ask-link-is-unusable´
#[sqlx::test(migrations = "../../migrations")]
async fn stage_applicant_refuses_an_unknown_ask_link(pool: PgPool) {
    let rig = unlimited(pool);
    let kel = member(&rig, "kel").await;
    let refused = stage(&rig, &kel.token, &Uuid::new_v4().to_string()).await;
    assert_eq!(codes(&refused), vec!["ASK_LINK_UNUSABLE"], "{refused}");
    assert!(refused["application"].is_null());
    assert!(queue(&rig, &kel.token).await.is_empty());
}

/// A landed asker refuses the stage — the profile replaces the ask.
///
/// Staging a landed asker is ASK_LINK_UNUSABLE and writes nothing.
/// ´claim:onboarding:staging-a-landed-asker-is-unusable´
#[sqlx::test(migrations = "../../migrations")]
async fn stage_applicant_refuses_a_landed_asker(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let path: Uuid = noa.application.parse().expect("uuid");
    assert!(store::land_path_directly(&rig.pool, path).await.expect("lands"));
    let refused = stage(&rig, &kel.token, &noa.ask_link).await;
    assert_eq!(codes(&refused), vec!["ASK_LINK_UNUSABLE"], "{refused}");
    assert_eq!(open_rows_with(&rig, noa.id, kel.id).await, 0);
}

/// A second stage by the member who already holds the asker refuses —
/// the one waiting row stays the only one, and the client re-reads the
/// check to open it.
///
/// Staging an asker already waiting in the caller's queue is ASK_LINK_UNUSABLE and leaves one row.
/// ´claim:onboarding:staging-an-asker-already-in-my-queue-is-unusable´
#[sqlx::test(migrations = "../../migrations")]
async fn stage_applicant_refuses_an_asker_already_in_my_queue(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    staged(&rig, &kel.token, &noa.ask_link).await;
    let refused = stage(&rig, &kel.token, &noa.ask_link).await;
    assert_eq!(codes(&refused), vec!["ASK_LINK_UNUSABLE"], "{refused}");
    assert_eq!(open_rows_with(&rig, noa.id, kel.id).await, 1);
    // The registration path's issuer holds the asker already, too.
    let issuer = stage(&rig, &mira.token, &noa.ask_link).await;
    assert_eq!(codes(&issuer), vec!["ASK_LINK_UNUSABLE"], "{issuer}");
}

/// EC-R3's positive pin: an asker waiting in another member's queue is
/// taken up all the same, and both rows wait, each in its own approver's
/// queue.
///
/// An asker waiting in another member's queue can be staged, and both rows wait.
/// ´claim:onboarding:an-asker-waiting-elsewhere-can-be-staged´
#[sqlx::test(migrations = "../../migrations")]
async fn stage_applicant_takes_up_an_asker_waiting_in_another_queue(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let staged = stage(&rig, &kel.token, &noa.ask_link).await;
    assert_eq!(staged["userErrors"], json!([]), "{staged}");
    let row = &staged["application"];
    assert_eq!(row["handle"], "noa");
    assert_eq!(row["approver"]["handle"], "kel");
    assert!(row["inviteLink"].is_null(), "an ask-link row has no link");
    assert!(row["approvedAt"].is_null() && row["rejectedAt"].is_null());
    assert_eq!(ids(&queue(&rig, &mira.token).await), vec![noa.application]);
    assert_eq!(
        ids(&queue(&rig, &kel.token).await),
        vec![row["id"].as_str().expect("id").to_string()]
    );
}

/// B2: staging never requires approvability. An asker with neither proof
/// is staged — a queue entry and nothing else, nothing approved or spent —
/// and approving it refuses until both proofs are in, then succeeds.
///
/// Staging a not-yet-approvable asker writes only the queue entry; it becomes approvable once both proofs are in.
/// ´claim:onboarding:staging-never-requires-approvability´
#[sqlx::test(migrations = "../../migrations")]
async fn staging_an_unverified_or_keyless_asker_writes_the_queue_entry_only(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let staged = stage(&rig, &kel.token, &noa.ask_link).await;
    assert_eq!(staged["userErrors"], json!([]), "{staged}");
    let row = &staged["application"];
    assert_eq!(row["emailVerified"], false);
    assert_eq!(row["keyAttached"], false);
    let id = row["id"].as_str().expect("id").to_string();
    let vouches: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM auth_application_vouches")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(vouches, 0, "nothing is approved by a stage");
    let funded: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM auth_admission_fundings")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(funded, 0, "nothing is spent by a stage");

    let early = approve(&rig, &kel.token, &id).await;
    assert_eq!(codes(&early), vec!["BAD_INPUT"], "{early}");
    prove(&rig, &noa).await;
    let approved = approve(&rig, &kel.token, &id).await;
    assert_eq!(approved["userErrors"], json!([]), "{approved}");
    assert_eq!(approved["writes"].as_array().expect("writes").len(), 1);
}

/// R3: an ask-link application is the staging member's to decide. The
/// registration link's issuer and the approver of another open path both
/// read it as unknown, for approval and for rejection alike; the stager
/// approves it.
///
/// An application is approved or closed only by its own approver, whichever end of the funnel staged it.
/// ´claim:onboarding:an-application-is-decided-by-its-own-approver´
#[sqlx::test(migrations = "../../migrations")]
async fn an_ask_link_application_is_approved_by_the_member_who_staged_it(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let sol = member(&rig, "sol").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    let kels = staged(&rig, &kel.token, &noa.ask_link).await;
    staged(&rig, &sol.token, &noa.ask_link).await;

    for other in [&mira, &sol] {
        let refused = approve(&rig, &other.token, &kels).await;
        assert_eq!(codes(&refused), vec!["BAD_INPUT"], "{refused}");
        assert_eq!(refused["userErrors"][0]["message"], "unknown application");
        let closed = rig
            .gql(
                Some(&other.token),
                REJECT,
                json!({ "input": { "application": kels } }),
            )
            .await;
        assert_eq!(
            closed["rejectApplication"]["userErrors"][0]["message"],
            "unknown application"
        );
    }
    let approved = approve(&rig, &kel.token, &kels).await;
    assert_eq!(approved["userErrors"], json!([]), "{approved}");
    // And mira's own registration path stays hers alone.
    let foreign = approve(&rig, &kel.token, &noa.application).await;
    assert_eq!(foreign["userErrors"][0]["message"], "unknown application");
}

/// A member who closed their ask-link row can take the asker up again:
/// the close ends that queue entry, and the ask link opens a new one —
/// the second look is what the link is for.
///
/// A closed ask-link row leaves the ask link open to the same member.
/// ´claim:onboarding:a-closed-row-leaves-the-ask-link-open´
#[sqlx::test(migrations = "../../migrations")]
async fn a_member_who_closed_an_ask_link_row_can_take_the_asker_up_again(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let first = staged(&rig, &kel.token, &noa.ask_link).await;
    let closed = rig
        .gql(
            Some(&kel.token),
            REJECT,
            json!({ "input": { "application": first } }),
        )
        .await;
    assert_eq!(closed["rejectApplication"]["userErrors"], json!([]));
    assert!(closed["rejectApplication"]["application"]["rejectedAt"].is_string());
    assert_eq!(
        check(&rig, Some(&kel.token), &noa.ask_link).await["usable"],
        true
    );
    let second = staged(&rig, &kel.token, &noa.ask_link).await;
    assert_ne!(first, second);
    assert_eq!(ids(&queue(&rig, &kel.token).await), vec![second]);
}

/// EC-R3 at the race: two members staging the same asker at the same
/// instant both stage — each gets their own waiting row.
///
/// Two members staging the same asker at once both stage.
/// ´claim:onboarding:two-members-staging-at-once-both-stage´
#[sqlx::test(migrations = "../../migrations")]
async fn two_members_staging_the_same_asker_concurrently_both_stage(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let sol = member(&rig, "sol").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let (a, b) = tokio::join!(
        stage(&rig, &kel.token, &noa.ask_link),
        stage(&rig, &sol.token, &noa.ask_link),
    );
    assert_eq!(a["userErrors"], json!([]), "{a}");
    assert_eq!(b["userErrors"], json!([]), "{b}");
    assert_eq!(open_rows_with(&rig, noa.id, kel.id).await, 1);
    assert_eq!(open_rows_with(&rig, noa.id, sol.id).await, 1);
}

/// The surviving invariant at the race: one member firing the same stage
/// many times at once — two devices, a double tap — writes exactly one
/// row; every other call refuses ASK_LINK_UNUSABLE, the partial unique
/// index being what decides.
///
/// One member staging the same asker many times at once writes exactly one row.
/// ´claim:onboarding:one-member-staging-at-once-stages-once´
#[sqlx::test(migrations = "../../migrations")]
async fn one_member_staging_the_same_asker_twice_concurrently_stages_once(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let (a, b, c, d) = tokio::join!(
        stage(&rig, &kel.token, &noa.ask_link),
        stage(&rig, &kel.token, &noa.ask_link),
        stage(&rig, &kel.token, &noa.ask_link),
        stage(&rig, &kel.token, &noa.ask_link),
    );
    let attempts = [a, b, c, d];
    let staged = attempts
        .iter()
        .filter(|a| a["userErrors"] == json!([]))
        .count();
    let refused = attempts
        .iter()
        .filter(|a| codes(a) == vec!["ASK_LINK_UNUSABLE"])
        .count();
    assert_eq!((staged, refused), (1, 3), "{attempts:?}");
    assert_eq!(open_rows_with(&rig, noa.id, kel.id).await, 1);
}

/// The stage is a member's act: a verified applicant is FORBIDDEN, an
/// unverified one EMAIL_NOT_VERIFIED, and a call without a session
/// UNAUTHENTICATED — all at the transport tier, and nothing is written.
///
/// Staging is member-gated at the transport tier.
/// ´claim:onboarding:staging-is-member-gated´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_staging_is_forbidden(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let ivo = applicant(&rig, &mira, "ivo").await;
    let vars = json!({ "input": { "askLink": noa.ask_link } });
    let unverified = rig.gql_raw(Some(&ivo.token), STAGE, vars.clone()).await;
    assert_eq!(
        unverified["errors"][0]["extensions"]["code"], "EMAIL_NOT_VERIFIED",
        "{unverified}"
    );
    prove(&rig, &ivo).await;
    let verified = rig.gql_raw(Some(&ivo.token), STAGE, vars).await;
    assert_eq!(
        verified["errors"][0]["extensions"]["code"], "FORBIDDEN",
        "{verified}"
    );
    assert_eq!(open_rows_with(&rig, noa.id, ivo.id).await, 0);
}

/// A stage with no session is UNAUTHENTICATED.
///
/// An anonymous stage is UNAUTHENTICATED.
/// ´claim:onboarding:an-anonymous-stage-is-unauthenticated´
#[sqlx::test(migrations = "../../migrations")]
async fn an_anonymous_stage_is_unauthenticated(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let refused = rig
        .gql_raw(None, STAGE, json!({ "input": { "askLink": noa.ask_link } }))
        .await;
    assert_eq!(
        refused["errors"][0]["extensions"]["code"], "UNAUTHENTICATED",
        "{refused}"
    );
}

/// One queue across both ends of the funnel: a row through the member's
/// invite link and a row taken up from an ask link stand together,
/// waiting only, oldest first — an approved or a closed row leaves it, and
/// the link row names its link to its issuer while the ask-link row has
/// none.
///
/// The approval queue spans both ends of the funnel, waiting rows only, oldest first.
/// ´claim:onboarding:the-queue-spans-both-ends-of-the-funnel´
#[sqlx::test(migrations = "../../migrations")]
async fn the_queue_spans_both_ends_of_the_funnel(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let ivo = applicant(&rig, &kel, "ivo").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let ada = applicant(&rig, &mira, "ada").await;
    let eli = applicant(&rig, &mira, "eli").await;
    prove(&rig, &ada).await;
    let noas = staged(&rig, &kel.token, &noa.ask_link).await;
    let adas = staged(&rig, &kel.token, &ada.ask_link).await;
    let elis = staged(&rig, &kel.token, &eli.ask_link).await;

    let approved = approve(&rig, &kel.token, &adas).await;
    assert_eq!(approved["userErrors"], json!([]), "{approved}");
    let closed = rig
        .gql(
            Some(&kel.token),
            REJECT,
            json!({ "input": { "application": elis } }),
        )
        .await;
    assert_eq!(closed["rejectApplication"]["userErrors"], json!([]));

    let rows = queue(&rig, &kel.token).await;
    assert_eq!(ids(&rows), vec![ivo.application.clone(), noas]);
    assert!(rows.iter().all(|r| r["approver"]["handle"] == "kel"));
    assert!(rows[0]["inviteLink"]["id"].is_string(), "the link row names its link");
    assert!(rows[1]["inviteLink"].is_null(), "the ask-link row has none");
}

/// The queue is its approver's alone: another member reading the same
/// account's queue gets null, and each member's own read holds only their
/// own rows.
///
/// The approval queue resolves only for its approver.
/// ´claim:onboarding:the-queue-reads-for-its-approver-only´
#[sqlx::test(migrations = "../../migrations")]
async fn the_queue_reads_for_its_approver_only(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    applicant(&rig, &kel, "ivo").await;
    let read = rig
        .gql(
            Some(&mira.token),
            "query { user(handle: \"kel\") { approvalQueue(first: 5) { edges { node { id } } } } }",
            json!({}),
        )
        .await;
    assert!(read["user"]["approvalQueue"].is_null(), "{read}");
    assert!(queue(&rig, &mira.token).await.is_empty());
}

/// EC-R3: one asker waits in several members' queues at once, standing
/// in each, and each member acts on their own row only.
///
/// An asker waiting in two queues stands in both.
/// ´claim:onboarding:an-asker-waiting-in-two-queues-stands-in-both´
#[sqlx::test(migrations = "../../migrations")]
async fn an_asker_waiting_in_two_queues_stands_in_both(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let kels = staged(&rig, &kel.token, &noa.ask_link).await;
    assert_eq!(ids(&queue(&rig, &mira.token).await), vec![noa.application]);
    assert_eq!(ids(&queue(&rig, &kel.token).await), vec![kels]);
}

/// Seam 099 ruling 67: a waiting row whose applicant landed through
/// another member's vouch leaves the queue at that landing — filtered on
/// read, nothing written on it — and approving it refuses.
///
/// A row whose applicant landed through another path leaves the queue, writes nothing, and refuses approval.
/// ´claim:onboarding:a-row-landed-elsewhere-leaves-the-queue´
#[sqlx::test(migrations = "../../migrations")]
async fn a_row_whose_applicant_landed_elsewhere_leaves_the_queue(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    let kels = staged(&rig, &kel.token, &noa.ask_link).await;
    let path: Uuid = noa.application.parse().expect("uuid");
    assert!(store::land_path_directly(&rig.pool, path).await.expect("lands"));

    assert!(queue(&rig, &kel.token).await.is_empty());
    let row = store::application(&rig.pool, kels.parse().expect("uuid"))
        .await
        .expect("read")
        .expect("the row stays");
    assert!(row.approved_at.is_none() && row.rejected_at.is_none() && row.landed_at.is_none());

    let refused = approve(&rig, &kel.token, &kels).await;
    assert_eq!(codes(&refused), vec!["BAD_INPUT"], "{refused}");
    assert_eq!(
        refused["userErrors"][0]["message"],
        "the applicant has already landed"
    );
}

/// The applicant reads who their application waits on: the issuer while
/// only the registration path is open, and — once the issuer closed it
/// and another member took them up — that member.
///
/// An application names its own approver to the applicant.
/// ´claim:onboarding:an-application-names-its-approver´
#[sqlx::test(migrations = "../../migrations")]
async fn an_application_names_its_approver_to_the_applicant(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let me = rig.gql(Some(&noa.token), MY_APPLICATION, json!({})).await;
    assert_eq!(me["me"]["application"]["approver"]["handle"], "mira");

    let closed = rig
        .gql(
            Some(&mira.token),
            REJECT,
            json!({ "input": { "application": noa.application } }),
        )
        .await;
    assert_eq!(closed["rejectApplication"]["userErrors"], json!([]));
    let kels = staged(&rig, &kel.token, &noa.ask_link).await;
    let me = rig.gql(Some(&noa.token), MY_APPLICATION, json!({})).await;
    assert_eq!(me["me"]["application"]["id"], kels.as_str());
    assert_eq!(me["me"]["application"]["approver"]["handle"], "kel");
    assert!(me["me"]["application"]["rejectedAt"].is_null());
}

/// The application's link is the link capability: it resolves for the
/// link's issuer and for nobody else — the applicant reading their own
/// application reads null.
///
/// An application's invite link resolves only for the link's issuer.
/// ´claim:onboarding:the-application-link-resolves-for-its-issuer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn the_application_link_resolves_for_its_issuer_only(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let own = rig.gql(Some(&noa.token), MY_APPLICATION, json!({})).await;
    assert!(own["me"]["application"]["inviteLink"].is_null(), "{own}");
    let issuers = queue(&rig, &mira.token).await;
    assert!(issuers[0]["inviteLink"]["id"].is_string(), "{issuers:?}");
}

/// A vouch in flight on a member's own path counts as that member holding
/// the asker: the check reads WAITING_ON_VIEWER and a stage refuses, so no
/// second row of theirs can stand beside it. When the vouch lapses, the
/// path returns to waiting as the one row it always was.
///
/// A member's own vouch in flight holds the asker, and its lapse returns the one path to waiting without a second row.
/// ´claim:onboarding:a-vouch-in-flight-holds-the-asker´
#[sqlx::test(migrations = "../../migrations")]
async fn a_vouch_in_flight_holds_the_asker_and_its_lapse_keeps_one_row(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    let approved = approve(&rig, &mira.token, &noa.application).await;
    assert_eq!(approved["userErrors"], json!([]), "{approved}");

    assert_eq!(
        check(&rig, Some(&mira.token), &noa.ask_link).await["reason"],
        "WAITING_ON_VIEWER"
    );
    let refused = stage(&rig, &mira.token, &noa.ask_link).await;
    assert_eq!(codes(&refused), vec!["ASK_LINK_UNUSABLE"], "{refused}");

    sqlx::query("UPDATE auth_application_vouches SET lapsed_at = NOW()")
        .execute(&rig.pool)
        .await
        .expect("lapse");
    let mut tx = rig.pool.begin().await.expect("tx");
    assert!(store::lock_account(&mut tx, noa.id).await.expect("lock"));
    assert_eq!(
        store::heal_unvouched_marks(&mut tx, noa.id)
            .await
            .expect("heals"),
        1
    );
    tx.commit().await.expect("commit");

    assert_eq!(ids(&queue(&rig, &mira.token).await), vec![noa.application]);
    assert_eq!(open_rows_with(&rig, noa.id, mira.id).await, 1);
    let again = stage(&rig, &mira.token, &noa.ask_link).await;
    assert_eq!(codes(&again), vec!["ASK_LINK_UNUSABLE"], "{again}");
}

/// R11 at the wire: an applicant taken up from their ask link and vouched
/// in by that member names that member as `invitedBy` once the ceremony
/// lands — not the issuer of the link they registered through, who stays
/// the lender of their borrowed view.
///
/// After an ask-link landing, invitedBy names the member who took the applicant up, while the borrowed view stays the issuer's.
/// ´claim:onboarding:invited-by-names-the-ask-link-approver´
#[sqlx::test(migrations = "../../migrations")]
async fn invited_by_names_the_ask_link_approver_after_landing(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let kel = member(&rig, "kel").await;
    let noa = applicant(&rig, &mira, "noa").await;
    let noa_key = prove(&rig, &noa).await;
    let kels = staged(&rig, &kel.token, &noa.ask_link).await;

    let borrowed = "query { borrowedView { ... on User { handle } } }";
    let lender = rig.gql(Some(&noa.token), borrowed, json!({})).await;
    assert_eq!(
        lender["borrowedView"]["handle"], "mira",
        "the lender stays the issuer after an ask-link take-up"
    );

    let approved = approve(&rig, &kel.token, &kels).await;
    assert_eq!(approved["userErrors"], json!([]), "{approved}");
    rig.sign_prepared(&kel.token, &kel.key, &approved["writes"])
        .await;
    let view = rig
        .gql(
            Some(&noa.token),
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
    rig.sign_prepared(&noa.token, &noa_key, &json!([registration]))
        .await;
    rig.close_and_ingest().await;

    let me = rig
        .gql(
            Some(&noa.token),
            "query { me { accountState invitedBy { handle }
                 application { id landedAt approver { handle } } } }",
            json!({}),
        )
        .await;
    assert_eq!(me["me"]["accountState"], "MEMBER", "{me}");
    assert_eq!(me["me"]["invitedBy"]["handle"], "kel");
    assert_eq!(me["me"]["application"]["id"], kels.as_str());
    assert_eq!(me["me"]["application"]["approver"]["handle"], "kel");
    let lender = rig.gql(Some(&noa.token), borrowed, json!({})).await;
    assert_eq!(lender["borrowedView"]["handle"], "mira");
    let _ = mira.id;
}

/// An approval on an ask-link row is priced like any other: a member
/// whose balance cannot carry the vouch is refused WRITE_RULE_FAILED. The
/// staged row is left as it was — still waiting in their queue (what the
/// pad shows for that residue waits on gap G5).
///
/// An approval of an ask-link application is priced: an approver who cannot afford it is refused by the write rule.
/// ´claim:onboarding:an-ask-link-approval-is-priced´
#[sqlx::test(migrations = "../../migrations")]
async fn an_ask_link_approval_the_approver_cannot_afford_is_write_rule_failed(pool: PgPool) {
    let rig = unlimited(pool);
    let mira = member(&rig, "mira").await;
    let pia = unfunded_member(&rig, "pia").await;
    let noa = applicant(&rig, &mira, "noa").await;
    prove(&rig, &noa).await;
    let pias = staged(&rig, &pia.token, &noa.ask_link).await;
    let refused = approve(&rig, &pia.token, &pias).await;
    assert_eq!(codes(&refused), vec!["WRITE_RULE_FAILED"], "{refused}");
    assert!(refused["writes"].is_null());
    assert_eq!(ids(&queue(&rig, &pia.token).await), vec![pias]);
    let _ = (pia.id, pia.key);
}
