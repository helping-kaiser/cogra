//! Account deletion's execution at the deadline (erasure.md §2, §5 step 4,
//! §6; auth.md "Self-service deletion"): the executor's claim, its
//! identity-level and content-level redaction, its close, and everything
//! that must hold around it — nothing before the deadline, nothing after a
//! cancel, a cancel racing the claim, idempotent re-runs, resumption after
//! a crash, no way back in, no landing, no late re-publication, and the
//! graph left whole. Requires a live Postgres (`make up`).
//!
//! The executor runs here by calling its tick directly, the call its
//! supervised loop makes; the deadline is reached by moving the confirmed
//! row's `scheduled_for` into the past.

use api::deletion::{self, Tick};
use api::l1::StandInBoundary;
use api::media::MediaAreas;
use api::onboarding::{self, Approval, OnboardingConfig};
use api::ratelimit::{RateLimitConfig, SigningBudget};
use common::l1::census::Family;
use common::l1::client::ActorKey;
use common::l1::identifier::NodeId;
use postgres_store::staged::{self, PreSignedParts, StagedState};
use postgres_store::{PgPool, auth as auth_store, deletion as store};
use serde_json::{Value, json};
use uuid::Uuid;

mod rig;
use rig::{MEMBER_PASSWORD, WireRig};

const REQUEST: &str = "mutation($input: RequestAccountDeletionInput!) {
    requestAccountDeletion(input: $input) {
        accountDeletion { scheduledFor } userErrors { code field }
    }
}";
const CONFIRM: &str = "mutation($input: ConfirmAccountDeletionInput!) {
    confirmAccountDeletion(input: $input) {
        accountDeletion { scheduledFor includesContent } userErrors { code field }
    }
}";
const CANCEL: &str = "mutation {
    cancelAccountDeletion { accountDeletion { scheduledFor } userErrors { code } }
}";
const LOG_IN: &str = "mutation($input: LogInInput!) {
    logIn(input: $input) { auth { accessToken refreshToken } userErrors { code } }
}";
const REFRESH: &str = "mutation($input: RefreshSessionInput!) {
    refreshSession(input: $input) { auth { refreshToken } userErrors { code } }
}";
const ME: &str = "query { me { id } }";
const PREPARE_PROFILE: &str = r#"mutation($input: PrepareProfileUpdateInput!) {
    prepareProfileUpdate(input: $input) {
        writes { id canonicalProposal } userErrors { code message }
    }
}"#;
const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
    preparePost(input: $input) {
        node writes { id canonicalProposal carried } userErrors { code message }
    }
}"#;
const PREPARE_COMMENT: &str = r#"mutation($input: PrepareCommentInput!) {
    prepareComment(input: $input) {
        node writes { id canonicalProposal } userErrors { code message }
    }
}"#;
const PREPARE_STANCE: &str = "mutation($input: PrepareStanceInput!) {
    prepareStance(input: $input) { writes { id carried } userErrors { code message } }
}";
const READ_POST: &str = r#"query($id: UUID!) { post(id: $id) {
    content { value status } removal { at by }
} }"#;
const READ_COMMENT: &str = r#"query($id: UUID!) { comment(id: $id) {
    content { value status } removal { at by }
} }"#;

fn rig(pool: PgPool) -> WireRig {
    WireRig::new(pool, RateLimitConfig::unlimited())
}

/// The executor's tick, as its loop runs it.
async fn tick(rig: &WireRig) -> Tick {
    deletion::tick(
        &StandInBoundary(rig.standin.clone()),
        &rig.pool,
        &MediaAreas::in_memory(),
    )
    .await
    .expect("ticks")
}

fn no_errors(payload: &Value) {
    assert_eq!(payload["userErrors"], json!([]), "refused: {payload}");
}

fn transport_code(response: &Value) -> Option<&str> {
    response["errors"][0]["extensions"]["code"].as_str()
}

/// A member with a session.
struct Member {
    id: Uuid,
    key: ActorKey,
    email: String,
    token: String,
}

/// A member as admission leaves one: the seeded profile row with the
/// handle as its name, and the landed admission Registration a profile
/// update chains onto.
async fn member(rig: &WireRig, handle: &str) -> Member {
    let email = format!("{handle}@example.com");
    let (id, key) = rig.seed_member(handle, &email).await;
    let mut conn = rig.pool.acquire().await.expect("conn");
    postgres_store::genesis::insert_profile_version(&mut conn, id, handle, None)
        .await
        .expect("seed profile");
    drop(conn);
    let anchor = api::prepare::prepare(
        &StandInBoundary(rig.standin.clone()),
        &rig.pool,
        api::ingest::DEFAULT_GC_AFTER_EPOCHS,
        id,
        api::prepare::Gesture {
            author: key.address(),
            family: Family::Registration,
            middle: None,
            target: api::prepare::Target::Node(NodeId::Prof(key.address())),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
            deps: vec![],
            payload: vec![],
            node: None,
        },
    )
    .await
    .expect("prepares the admission Registration");
    sign(rig, &key, anchor.id).await;
    rig.close_and_ingest().await;
    let token = rig.log_in(&email).await;
    Member {
        id,
        key,
        email,
        token,
    }
}

/// Requests and confirms a deletion through the real verbs; returns the
/// mailed link's token.
async fn confirmed(rig: &WireRig, token: &str, email: &str, include_content: bool) -> String {
    let requested = rig
        .gql(
            Some(token),
            REQUEST,
            json!({ "input": { "includeContent": include_content } }),
        )
        .await;
    no_errors(&requested["requestAccountDeletion"]);
    let link = rig.mailer.latest_token_for(email);
    let opened = confirm(rig, &link).await;
    no_errors(&opened["confirmAccountDeletion"]);
    link
}

async fn confirm(rig: &WireRig, link: &str) -> Value {
    rig.gql(None, CONFIRM, json!({ "input": { "deletionToken": link } }))
        .await
}

/// Moves the account's confirmed deadline into the past.
async fn pass_deadline(rig: &WireRig, user: Uuid) {
    sqlx::query(
        "UPDATE auth_account_deletions SET scheduled_for = NOW() - INTERVAL '1 second'
         WHERE user_id = $1 AND scheduled_for IS NOT NULL",
    )
    .bind(user)
    .execute(&rig.pool)
    .await
    .expect("backdates");
}

async fn count(rig: &WireRig, sql: &str, id: Uuid) -> i64 {
    sqlx::query_scalar(sql)
        .bind(id)
        .fetch_one(&rig.pool)
        .await
        .unwrap_or_else(|e| panic!("{sql}: {e}"))
}

async fn handle_of(rig: &WireRig, id: Uuid) -> String {
    sqlx::query_scalar("SELECT handle FROM actors WHERE id = $1")
        .bind(id)
        .fetch_one(&rig.pool)
        .await
        .expect("handle")
}

async fn mirrored_by(rig: &WireRig, address: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM mirror_records WHERE author = $1")
        .bind(address)
        .fetch_one(&rig.pool)
        .await
        .expect("mirror count")
}

/// A profile update landed end to end.
async fn landed_profile_update(rig: &WireRig, m: &Member, input: Value) {
    let prepared = rig
        .gql(Some(&m.token), PREPARE_PROFILE, json!({ "input": input }))
        .await;
    no_errors(&prepared["prepareProfileUpdate"]);
    rig.sign_prepared(
        &m.token,
        &m.key,
        &prepared["prepareProfileUpdate"]["writes"],
    )
    .await;
    rig.close_and_ingest().await;
}

/// A post landed end to end — its node id.
async fn post(rig: &WireRig, m: &Member, body: &str) -> String {
    let prepared = rig
        .gql(
            Some(&m.token),
            PREPARE_POST,
            json!({ "input": {
                "title": "A title",
                "content": body,
                "license": { "attribution": 1.0, "provenance": 0.0 },
                "pDirected": 0.1,
            }}),
        )
        .await;
    let payload = &prepared["preparePost"];
    no_errors(payload);
    rig.sign_prepared(&m.token, &m.key, &payload["writes"])
        .await;
    rig.close_and_ingest().await;
    payload["node"].as_str().expect("node").to_string()
}

/// A comment landed end to end — its node id.
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

/// An image asset row of this author's, without the byte pipeline.
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

/// A member with a landed name and bio, a confirmed deletion past its
/// deadline — executed by one tick.
async fn executed_member(rig: &WireRig, handle: &str, include_content: bool) -> Member {
    let m = member(rig, handle).await;
    landed_profile_update(
        rig,
        &m,
        json!({ "displayName": "Sol Brine", "bio": "Tides and salt." }),
    )
    .await;
    confirmed(rig, &m.token, &m.email, include_content).await;
    pass_deadline(rig, m.id).await;
    m
}

/// At the deadline the identity goes and the husk stays: the deletion row
/// reads executed, the handle takes its storage form, the credentials row
/// stays with no address and no password, every profile row is blanked
/// and the profile's current version is the account-deletion tombstone,
/// every Registration payload is reduced with its archive unit written
/// first, and the search index no longer finds the old names — while the
/// actor row, its key and address, and every record by the address stand.
///
/// Execution redacts the identity and keeps every record and the actor.
/// ´claim:deletion:execution-redacts-identity-and-keeps-every-record´
#[sqlx::test(migrations = "../../migrations")]
async fn execution_redacts_identity_and_keeps_every_record(pool: PgPool) {
    let rig = rig(pool);
    let sol = executed_member(&rig, "sol", false).await;
    let address = sol.key.address();
    let records_before = mirrored_by(&rig, &address).await;
    assert!(records_before >= 1, "the profile update landed");

    let done = tick(&rig).await;
    assert_eq!(done.executed, vec![sol.id]);

    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM auth_account_deletions WHERE user_id = $1 AND executed_at IS NOT NULL",
            sol.id
        )
        .await,
        1
    );
    assert_eq!(
        handle_of(&rig, sol.id).await,
        format!("redacted-user-{}", sol.id)
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM user_credentials
             WHERE actor_id = $1 AND email IS NULL AND password_hash IS NULL",
            sol.id
        )
        .await,
        1,
        "the credentials row stays, redacted in place"
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM actors
             WHERE id = $1 AND actor_pubkey IS NOT NULL AND realization_address IS NOT NULL",
            sol.id
        )
        .await,
        1,
        "the actor keeps its key and address"
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM actor_profile_versions
             WHERE actor_id = $1 AND (redaction_reason IS NULL OR display_name <> ''
                   OR bio IS NOT NULL OR avatar_id IS NOT NULL)",
            sol.id
        )
        .await,
        0,
        "every profile row is blanked"
    );
    let current = postgres_store::profile::current_profile(&rig.pool, sol.id)
        .await
        .expect("reads")
        .expect("a profile");
    assert_eq!(
        current.redaction_reason.as_deref(),
        Some("user-account-deletion")
    );
    assert_eq!(current.display_name, "");
    let registration_records: Vec<String> = sqlx::query_scalar(
        "SELECT record_id FROM mirror_records
         WHERE author = $1 AND family = 'registration' AND payload_marked",
    )
    .bind(&address)
    .fetch_all(&rig.pool)
    .await
    .expect("records");
    assert!(!registration_records.is_empty());
    for record in &registration_records {
        let state: String =
            sqlx::query_scalar("SELECT payload_state FROM act_payloads WHERE act_id = $1")
                .bind(record)
                .fetch_one(&rig.pool)
                .await
                .expect("carriage");
        assert_eq!(state, "reduced", "{record}");
        let units: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM retention_archive
             WHERE original_id = $1 AND redaction_reason = 'user-account-deletion'",
        )
        .bind(record)
        .fetch_one(&rig.pool)
        .await
        .expect("archive");
        assert_eq!(units, 1, "{record} is archived before it is reduced");
    }
    assert_eq!(
        mirrored_by(&rig, &address).await,
        records_before,
        "no record is removed"
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM search_index
             WHERE node_id = $1 AND (folded LIKE '%sol%' OR folded LIKE '%brine%')",
            sol.id
        )
        .await,
        0,
        "the old names are no longer findable"
    );
}

/// The identity-only default keeps the account's content: its post still
/// reads its words, with no removal mark.
///
/// An identity-only execution keeps the account's post bodies.
/// ´claim:deletion:identity-only-keeps-post-bodies´
#[sqlx::test(migrations = "../../migrations")]
async fn identity_only_keeps_post_bodies(pool: PgPool) {
    let rig = rig(pool);
    let sol = member(&rig, "sol").await;
    let node = post(&rig, &sol, "The tide came in.").await;
    confirmed(&rig, &sol.token, &sol.email, false).await;
    pass_deadline(&rig, sol.id).await;

    tick(&rig).await;

    let read = rig.gql(None, READ_POST, json!({ "id": node })).await["post"].clone();
    assert_eq!(read["content"]["value"], "The tide came in.", "{read}");
    assert!(read["removal"].is_null(), "{read}");
}

/// With the content sweep, every post and comment the account wrote goes
/// to its reduced projection behind a mark that reads `by: ACCOUNT`; the
/// nodes still resolve, another member's reply under the swept post stays
/// readable, and no record is removed.
///
/// A content-level execution removes every authored post and comment behind an ACCOUNT mark.
/// ´claim:deletion:content-level-reduces-every-authored-payload´
#[sqlx::test(migrations = "../../migrations")]
async fn content_level_reduces_every_authored_payload(pool: PgPool) {
    let rig = rig(pool);
    let sol = member(&rig, "sol").await;
    let kel = member(&rig, "kel").await;
    let node = post(&rig, &sol, "The tide came in.").await;
    let own_comment = comment(&rig, &sol, &node, "And went out.").await;
    let reply = comment(&rig, &kel, &node, "I saw it too.").await;
    let records_before = mirrored_by(&rig, &sol.key.address()).await;
    confirmed(&rig, &sol.token, &sol.email, true).await;
    pass_deadline(&rig, sol.id).await;

    tick(&rig).await;

    let read = rig.gql(None, READ_POST, json!({ "id": node })).await["post"].clone();
    assert_eq!(read["removal"]["by"], "ACCOUNT", "{read}");
    assert_eq!(read["content"]["status"], "REDACTED", "{read}");
    assert!(read["content"]["value"].is_null(), "{read}");
    let own = rig
        .gql(None, READ_COMMENT, json!({ "id": own_comment }))
        .await["comment"]
        .clone();
    assert_eq!(own["removal"]["by"], "ACCOUNT", "{own}");
    let other = rig.gql(None, READ_COMMENT, json!({ "id": reply })).await["comment"].clone();
    assert_eq!(other["content"]["value"], "I saw it too.", "{other}");
    assert!(other["removal"].is_null(), "{other}");
    assert_eq!(mirrored_by(&rig, &sol.key.address()).await, records_before);
    let units = count(
        &rig,
        "SELECT COUNT(*) FROM retention_archive
         WHERE redacted_by = $1::text AND redaction_reason = 'user-account-deletion'",
        sol.id,
    )
    .await;
    assert!(units >= 2, "each removed act is archived: {units}");
}

/// Nothing executes before the deadline, and a request never confirmed
/// has no deadline at all.
///
/// Nothing executes before the deadline or without a confirmation.
/// ´claim:deletion:nothing-executes-before-the-deadline´
#[sqlx::test(migrations = "../../migrations")]
async fn nothing_executes_before_the_deadline(pool: PgPool) {
    let rig = rig(pool);
    let sol = member(&rig, "sol").await;
    confirmed(&rig, &sol.token, &sol.email, false).await;
    let kel = member(&rig, "kel").await;
    let requested = rig
        .gql(Some(&kel.token), REQUEST, json!({ "input": {} }))
        .await;
    no_errors(&requested["requestAccountDeletion"]);
    sqlx::query("UPDATE auth_account_deletions SET requested_at = NOW() - INTERVAL '30 days' WHERE user_id = $1")
        .bind(kel.id)
        .execute(&rig.pool)
        .await
        .expect("ages the request");

    assert_eq!(tick(&rig).await, Tick::default());
    assert_eq!(handle_of(&rig, sol.id).await, "sol");
    assert_eq!(handle_of(&rig, kel.id).await, "kel");
    let me = rig.gql(Some(&sol.token), ME, json!({})).await;
    assert_eq!(
        me["me"]["id"],
        sol.id.to_string(),
        "the session still works"
    );
}

/// A cancelled deletion and a superseded request never execute, whatever
/// their deadline.
///
/// A cancelled or superseded deletion never executes.
/// ´claim:deletion:a-cancelled-deletion-never-executes´
#[sqlx::test(migrations = "../../migrations")]
async fn a_cancelled_or_superseded_deletion_never_executes(pool: PgPool) {
    let rig = rig(pool);
    let sol = member(&rig, "sol").await;
    confirmed(&rig, &sol.token, &sol.email, false).await;
    let cancelled = rig.gql(Some(&sol.token), CANCEL, json!({})).await;
    no_errors(&cancelled["cancelAccountDeletion"]);
    pass_deadline(&rig, sol.id).await;

    assert_eq!(tick(&rig).await, Tick::default());
    assert_eq!(handle_of(&rig, sol.id).await, "sol");
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM auth_account_deletions WHERE user_id = $1 AND executed_at IS NOT NULL",
            sol.id
        )
        .await,
        0
    );
}

/// A cancel and the claim serialize on the deletion row. A cancel holding
/// the row when the claim arrives wins — the claim waits, re-reads, and
/// finds nothing due. A cancel arriving after the claim committed finds
/// nothing standing, answers null, and the execution stands.
///
/// A cancel racing the claim is decided by whichever commits first on the deletion row.
/// ´claim:deletion:a-cancel-racing-the-executor-is-serialized´
#[sqlx::test(migrations = "../../migrations")]
async fn a_cancel_racing_the_executor_is_serialized(pool: PgPool) {
    let rig = rig(pool);
    let sol = member(&rig, "sol").await;
    confirmed(&rig, &sol.token, &sol.email, false).await;
    pass_deadline(&rig, sol.id).await;

    let mut cancelling = rig.pool.begin().await.expect("tx");
    sqlx::query("UPDATE auth_account_deletions SET cancelled_at = NOW() WHERE user_id = $1 AND executed_at IS NULL")
        .bind(sol.id)
        .execute(&mut *cancelling)
        .await
        .expect("cancel holds the row");
    let pool = rig.pool.clone();
    let claim = tokio::spawn(async move { store::claim(&pool, sol.id).await });
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
    assert!(
        !claim.is_finished(),
        "the claim waits on the cancel's row lock"
    );
    cancelling.commit().await.expect("cancel commits");
    assert_eq!(claim.await.expect("joins").expect("claims"), None);
    assert_eq!(handle_of(&rig, sol.id).await, "sol");

    let kel = member(&rig, "kel").await;
    confirmed(&rig, &kel.token, &kel.email, false).await;
    pass_deadline(&rig, kel.id).await;
    let claimed = store::claim(&rig.pool, kel.id)
        .await
        .expect("claims")
        .expect("due");
    let late = rig.gql_raw(Some(&kel.token), CANCEL, json!({})).await;
    assert_eq!(transport_code(&late), Some("UNAUTHENTICATED"), "{late}");
    assert!(
        !auth_store::cancel_account_deletion(&rig.pool, kel.id)
            .await
            .expect("cancels"),
        "nothing stands to cancel once the claim committed"
    );
    deletion::finish(
        &StandInBoundary(rig.standin.clone()),
        &rig.pool,
        &MediaAreas::in_memory(),
        &claimed,
    )
    .await
    .expect("finishes");
    assert_eq!(
        handle_of(&rig, kel.id).await,
        format!("redacted-user-{}", kel.id)
    );
}

/// Running the execution again changes nothing: no second tombstone, no
/// second archive unit, the same handle — and a later tick has nothing to
/// do.
///
/// Re-running an execution is idempotent.
/// ´claim:deletion:re-execution-is-idempotent´
#[sqlx::test(migrations = "../../migrations")]
async fn re_execution_is_idempotent(pool: PgPool) {
    let rig = rig(pool);
    let sol = executed_member(&rig, "sol", true).await;
    tick(&rig).await;
    let rows = "SELECT COUNT(*) FROM actor_profile_versions WHERE actor_id = $1";
    let units = "SELECT COUNT(*) FROM retention_archive WHERE redacted_by = $1::text";
    let (rows_once, units_once) = (
        count(&rig, rows, sol.id).await,
        count(&rig, units, sol.id).await,
    );

    let execution = sqlx::query_as::<_, (Uuid, bool, chrono::DateTime<chrono::Utc>)>(
        "SELECT id, include_content, executed_at FROM auth_account_deletions
         WHERE user_id = $1 AND executed_at IS NOT NULL",
    )
    .bind(sol.id)
    .fetch_one(&rig.pool)
    .await
    .expect("executed row");
    let again = deletion::finish(
        &StandInBoundary(rig.standin.clone()),
        &rig.pool,
        &MediaAreas::in_memory(),
        &store::Execution {
            deletion_id: execution.0,
            user_id: sol.id,
            address: Some(sol.key.address()),
            include_content: execution.1,
            executed_at: execution.2,
        },
    )
    .await
    .expect("re-runs");
    assert!(!again.tombstoned, "no second tombstone");
    assert_eq!(count(&rig, rows, sol.id).await, rows_once);
    assert_eq!(count(&rig, units, sol.id).await, units_once);
    assert_eq!(
        handle_of(&rig, sol.id).await,
        format!("redacted-user-{}", sol.id)
    );
    assert_eq!(tick(&rig).await, Tick::default());
}

/// An executor that stopped after the claim — before any redaction, or
/// part-way through them — leaves an executed row whose account still
/// carries its handle; the next tick finishes it, and the result is the
/// same as an uninterrupted run.
///
/// An execution interrupted after its claim is resumed and completed by the next tick.
/// ´claim:deletion:an-interrupted-execution-is-resumed´
#[sqlx::test(migrations = "../../migrations")]
async fn an_interrupted_execution_is_resumed(pool: PgPool) {
    let rig = rig(pool);
    let sol = executed_member(&rig, "sol", false).await;
    let claimed = store::claim(&rig.pool, sol.id)
        .await
        .expect("claims")
        .expect("due");
    let acts = store::registration_acts(&rig.pool, sol.id, &sol.key.address())
        .await
        .expect("acts");
    let first = &acts[0];
    api::redaction::redact_act(
        &rig.pool,
        &api::redaction::Redaction {
            actor_id: sol.id,
            act_id: &first.act_id,
            reason: "user-account-deletion",
            redacted_by: &sol.id.to_string(),
        },
    )
    .await
    .expect("one act redacted, then the executor stops");
    assert_eq!(
        handle_of(&rig, sol.id).await,
        "sol",
        "the run stopped before its close"
    );
    assert_eq!(
        store::incomplete(&rig.pool).await.expect("reads"),
        vec![claimed.clone()]
    );

    let done = tick(&rig).await;
    assert_eq!(done.resumed, vec![sol.id]);
    assert!(done.executed.is_empty(), "nothing is claimed twice");
    assert_eq!(
        handle_of(&rig, sol.id).await,
        format!("redacted-user-{}", sol.id)
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM actor_profile_versions WHERE actor_id = $1 AND redaction_reason IS NULL",
            sol.id
        )
        .await,
        0
    );
    for act in &acts {
        let units: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM retention_archive WHERE original_id = $1")
                .bind(&act.act_id)
                .fetch_one(&rig.pool)
                .await
                .expect("archive");
        assert!(units <= 1, "{} archived once", act.act_id);
    }
    assert!(
        store::incomplete(&rig.pool)
            .await
            .expect("reads")
            .is_empty()
    );
}

/// From the claim on there is no way back in: the old password signs
/// nothing in, the refresh token is refused, the still-live access token
/// reads no account and every verb answers UNAUTHENTICATED — so nothing
/// can be written, prepared or signed as the account — and the mailed link
/// is dead.
///
/// The executed account cannot sign in, refresh, act, or reuse its link.
/// ´claim:deletion:the-executed-account-cannot-sign-in-refresh-or-act´
#[sqlx::test(migrations = "../../migrations")]
async fn the_executed_account_cannot_sign_in_refresh_or_act(pool: PgPool) {
    let rig = rig(pool);
    let sol = member(&rig, "sol").await;
    let login = rig
        .gql(
            None,
            LOG_IN,
            json!({ "input": { "email": sol.email, "password": MEMBER_PASSWORD } }),
        )
        .await;
    let refresh = login["logIn"]["auth"]["refreshToken"]
        .as_str()
        .expect("refresh")
        .to_string();
    let link = confirmed(&rig, &sol.token, &sol.email, false).await;
    pass_deadline(&rig, sol.id).await;

    tick(&rig).await;

    let again = rig
        .gql(
            None,
            LOG_IN,
            json!({ "input": { "email": sol.email, "password": MEMBER_PASSWORD } }),
        )
        .await;
    assert!(again["logIn"]["auth"].is_null(), "{again}");
    assert_eq!(
        again["logIn"]["userErrors"][0]["code"], "INVALID_CREDENTIALS",
        "{again}"
    );
    let refreshed = rig
        .gql(
            None,
            REFRESH,
            json!({ "input": { "refreshToken": refresh } }),
        )
        .await;
    assert_eq!(
        refreshed["refreshSession"]["userErrors"][0]["code"], "REFRESH_TOKEN_INVALID",
        "{refreshed}"
    );
    assert!(
        rig.gql(Some(&sol.token), ME, json!({})).await["me"].is_null(),
        "the access token reads no account"
    );
    let write = rig
        .gql_raw(
            Some(&sol.token),
            PREPARE_PROFILE,
            json!({ "input": { "bio": "back again" } }),
        )
        .await;
    assert_eq!(transport_code(&write), Some("UNAUTHENTICATED"), "{write}");
    let seen = rig
        .gql_raw(
            Some(&sol.token),
            "mutation($input: SetPreferencesInput!) { setPreferences(input: $input) { userErrors { code } } }",
            json!({ "input": { "hasSeenOnboarding": true } }),
        )
        .await;
    assert_eq!(transport_code(&seen), Some("UNAUTHENTICATED"), "{seen}");
    let reopened = confirm(&rig, &link).await;
    assert_eq!(
        reopened["confirmAccountDeletion"]["userErrors"][0]["code"], "DELETION_TOKEN_INVALID",
        "{reopened}"
    );
}

/// The device locks, the key backup and its challenge go at execution —
/// explicitly, since the credentials row is redacted rather than deleted
/// and no cascade fires — and so does what the account kept for the
/// reader alone: its seen-list, bookmarks, hide list and preferences.
/// Another reader's hide of the account stands.
///
/// Execution deletes the device locks, key backup and private per-user state, and keeps others' rows.
/// ´claim:deletion:execution-deletes-the-device-locks´
#[sqlx::test(migrations = "../../migrations")]
async fn execution_deletes_the_device_locks(pool: PgPool) {
    let rig = rig(pool);
    let sol = member(&rig, "sol").await;
    let kel = member(&rig, "kel").await;
    let lock = rig
        .gql(
            Some(&sol.token),
            "mutation { issueDeviceLock { lock { id } userErrors { code } } }",
            json!({}),
        )
        .await;
    assert!(lock["issueDeviceLock"]["lock"]["id"].is_string(), "{lock}");
    auth_store::upload_key_backup(&rig.pool, sol.id, b"backup")
        .await
        .expect("backup");
    for statement in [
        "INSERT INTO user_preferences (user_id) VALUES ($1)",
        "INSERT INTO user_view_log (user_id, content_id, kind) VALUES ($1, gen_random_uuid(), 'post')",
        "INSERT INTO user_bookmarks (user_id, content_id, kind) VALUES ($1, gen_random_uuid(), 'post')",
    ] {
        sqlx::query(statement)
            .bind(sol.id)
            .execute(&rig.pool)
            .await
            .unwrap_or_else(|e| panic!("{statement}: {e}"));
    }
    sqlx::query("INSERT INTO user_hidden_actors (viewer_id, hidden_id) VALUES ($1, $2), ($2, $1)")
        .bind(sol.id)
        .bind(kel.id)
        .execute(&rig.pool)
        .await
        .expect("hides");
    confirmed(&rig, &sol.token, &sol.email, false).await;
    pass_deadline(&rig, sol.id).await;

    tick(&rig).await;

    for (table, column) in [
        ("auth_device_locks", "user_id"),
        ("auth_key_backups", "user_id"),
        ("auth_key_backup_challenges", "user_id"),
        ("user_preferences", "user_id"),
        ("user_view_log", "user_id"),
        ("user_bookmarks", "user_id"),
        ("user_hidden_actors", "viewer_id"),
    ] {
        let sql = format!("SELECT COUNT(*) FROM {table} WHERE {column} = $1");
        assert_eq!(count(&rig, &sql, sol.id).await, 0, "{table} kept a row");
    }
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM user_credentials WHERE actor_id = $1",
            sol.id
        )
        .await,
        1,
        "the credentials row is redacted, not deleted"
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM user_hidden_actors WHERE viewer_id = $1",
            kel.id
        )
        .await,
        1,
        "another reader's hide of the account stands"
    );
}

/// A profile revision the account signed before the claim and that lands
/// after the execution lands reduced: no display row shows its words.
///
/// A profile revision landing after execution lands reduced.
/// ´claim:deletion:a-profile-revision-landing-after-execution-lands-reduced´
#[sqlx::test(migrations = "../../migrations")]
async fn a_profile_revision_landing_after_execution_lands_reduced(pool: PgPool) {
    let rig = rig(pool);
    let sol = member(&rig, "sol").await;
    let prepared = rig
        .gql(
            Some(&sol.token),
            PREPARE_PROFILE,
            json!({ "input": { "displayName": "Late Name" } }),
        )
        .await;
    no_errors(&prepared["prepareProfileUpdate"]);
    rig.sign_prepared(
        &sol.token,
        &sol.key,
        &prepared["prepareProfileUpdate"]["writes"],
    )
    .await;
    confirmed(&rig, &sol.token, &sol.email, false).await;
    pass_deadline(&rig, sol.id).await;
    let registrations = || async {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM mirror_records WHERE author = $1 AND family = 'registration'",
        )
        .bind(sol.key.address())
        .fetch_one(&rig.pool)
        .await
        .expect("mirror")
    };
    let before = registrations().await;

    tick(&rig).await;
    rig.close_and_ingest().await;

    assert_eq!(
        registrations().await,
        before + 1,
        "the revision landed after the execution"
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM actor_profile_versions
             WHERE actor_id = $1 AND display_name = 'Late Name'",
            sol.id
        )
        .await,
        0,
        "no row shows the late name"
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM act_payloads p JOIN mirror_records r ON r.record_id = p.act_id
             WHERE r.author = (SELECT realization_address FROM actors WHERE id = $1)
               AND p.payload_state <> 'reduced'",
            sol.id
        )
        .await,
        0,
        "the late record's carriage holds nothing"
    );
    let current = postgres_store::profile::current_profile(&rig.pool, sol.id)
        .await
        .expect("reads")
        .expect("profile");
    assert!(current.redaction_reason.is_some(), "{current:?}");
}

/// An avatar leaves the live store with the identity: its asset is held
/// once no live placement shows it, and its archive unit references it.
///
/// Execution holds the account's avatar.
/// ´claim:deletion:execution-holds-the-avatar´
#[sqlx::test(migrations = "../../migrations")]
async fn execution_holds_the_avatar(pool: PgPool) {
    let rig = rig(pool);
    let sol = member(&rig, "sol").await;
    let avatar = asset(&rig.pool, sol.id, 7).await;
    landed_profile_update(&rig, &sol, json!({ "avatarMediaId": avatar })).await;
    confirmed(&rig, &sol.token, &sol.email, false).await;
    pass_deadline(&rig, sol.id).await;

    tick(&rig).await;

    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM media_attachments WHERE id = $1 AND held_at IS NOT NULL",
            avatar
        )
        .await,
        1,
        "the avatar is held"
    );
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM retention_archive_media WHERE media_id = $1",
            avatar
        )
        .await,
        1,
        "its archive unit references it"
    );
}

/// An applicant whose Registration landed (the husk path, design item 69)
/// executes like a member, and its carried acts go at execution, whatever
/// the content opt-in says (ruling PR-21). A vouch confirming after the
/// execution lands nothing (ruling PR-22): the account stays an applicant,
/// no path is booked, nothing is released — and the vouch's record stays
/// on the graph.
///
/// An executed applicant's carried acts are deleted and a late vouch never lands it.
/// ´claim:deletion:an-executed-applicant-never-lands´
#[sqlx::test(migrations = "../../migrations")]
async fn an_executed_applicant_never_lands(pool: PgPool) {
    let rig = rig(pool);
    let mira = member(&rig, "mira").await;
    let noa = registered_applicant(&rig, &mira, "noa").await;
    let vouch = noa.vouch;
    let carried = rig
        .gql(
            Some(&noa.token),
            PREPARE_STANCE,
            json!({ "input": { "target": mira.id, "pDirected": 0.3, "pInterest": 0.2 } }),
        )
        .await;
    no_errors(&carried["prepareStance"]);
    assert_eq!(
        carried["prepareStance"]["writes"][0]["carried"], true,
        "{carried}"
    );
    confirmed(&rig, &noa.token, &noa.email, false).await;
    pass_deadline(&rig, noa.id).await;

    let done = tick(&rig).await;
    assert_eq!(done.executed, vec![noa.id]);
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM staged_writes WHERE actor_id = $1 AND state = 'carried'",
            noa.id
        )
        .await,
        0,
        "the carried acts are deleted at execution"
    );

    sign(&rig, &mira.key, vouch).await;
    rig.close_and_ingest().await;
    let vouch_act: String = sqlx::query_scalar("SELECT act_id FROM staged_writes WHERE id = $1")
        .bind(vouch)
        .fetch_one(&rig.pool)
        .await
        .expect("vouch act");
    let on_graph: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM mirror_records WHERE record_id = $1")
            .bind(&vouch_act)
            .fetch_one(&rig.pool)
            .await
            .expect("mirror");
    assert_eq!(on_graph, 1, "the late vouch's record stands on the graph");
    let state: String =
        sqlx::query_scalar("SELECT account_state FROM user_credentials WHERE actor_id = $1")
            .bind(noa.id)
            .fetch_one(&rig.pool)
            .await
            .expect("state");
    assert_eq!(state, "applicant", "an executed account never lands");
    assert_eq!(
        count(
            &rig,
            "SELECT COUNT(*) FROM auth_application_vouches v
             JOIN auth_applications ap ON ap.id = v.application_id
             WHERE ap.account_id = $1 AND (v.landed_at IS NOT NULL OR ap.landed_at IS NOT NULL)",
            noa.id
        )
        .await,
        0,
        "nothing is booked landed"
    );
    assert_eq!(
        auth_store::evaluate_landing(&rig.pool, noa.id, Family::Registration.as_str())
            .await
            .expect("evaluates"),
        auth_store::Landing::Deleted
    );
}

/// An applicant whose admission Registration landed, its vouch staged but
/// unsigned — the husk path's account.
struct Registered {
    id: Uuid,
    email: String,
    token: String,
    vouch: Uuid,
}

async fn registered_applicant(rig: &WireRig, inviter: &Member, handle: &str) -> Registered {
    let link: Uuid = rig
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
        .parse()
        .expect("uuid");
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
    let path: Uuid = sqlx::query_scalar(
        "SELECT id FROM auth_applications WHERE account_id = $1 ORDER BY created_at LIMIT 1",
    )
    .bind(id)
    .fetch_one(&rig.pool)
    .await
    .expect("path");
    let mut prepared = onboarding::approve_applicants(
        &rig.pool,
        &StandInBoundary(rig.standin.clone()),
        &OnboardingConfig::default(),
        &SigningBudget::UNLIMITED,
        inviter.id,
        &[Approval {
            application: path,
            p_d: 0.4,
            p_i: 0.2,
        }],
    )
    .await
    .unwrap_or_else(|e| panic!("approves: {e:?}"));
    let vouch = prepared.remove(0).id;
    let registration = staged::list_for_actor(&rig.pool, id)
        .await
        .expect("lists")
        .into_iter()
        .find(|w| {
            w.proposal.body.family == Family::Registration
                && w.proposal.body.asserted_parents.is_empty()
                && w.state != StagedState::Expired
        })
        .expect("a staged admission Registration");
    sign(rig, &key, registration.id).await;
    rig.close_and_ingest().await;
    Registered {
        id,
        email,
        token,
        vouch,
    }
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
