//! The email-change lifecycle through the real HTTP surface (auth.md
//! "Email change"): the two-sided proof end to end, the 6-digit code and
//! its wrong-try cap, resend of the owed sides, cancel, the answers a
//! link gives once its change ended, the unverified carve-out, the
//! account mail budget, and the viewer-only reads. Requires a live
//! Postgres (`make up`).

use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::http::Request;
use http_body_util::BodyExt;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::{PgPool, auth as store};
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

/// Captures outbound mail so the test can read codes like a user reads
/// their inbox.
#[derive(Default)]
struct TestMailer(Mutex<Vec<api::mailer::Mail>>);

impl api::mailer::Mailer for TestMailer {
    fn send(
        &self,
        mail: api::mailer::Mail,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            self.0.lock().expect("mailbox").push(mail);
        })
    }
}

impl TestMailer {
    /// The code or token out of the newest message to `to` — the last
    /// word of the body, per the email-change mail format.
    fn latest_code_for(&self, to: &str) -> String {
        let mails = self.0.lock().expect("mailbox");
        let mail = mails
            .iter()
            .rev()
            .find(|m| m.to == to)
            .unwrap_or_else(|| panic!("no mail for {to}"));
        mail.body
            .rsplit(": ")
            .next()
            .expect("code line")
            .trim()
            .to_string()
    }

    /// The newest message to `to`, whole.
    fn latest_for(&self, to: &str) -> api::mailer::Mail {
        let mails = self.0.lock().expect("mailbox");
        let mail = mails
            .iter()
            .rev()
            .find(|m| m.to == to)
            .unwrap_or_else(|| panic!("no mail for {to}"));
        api::mailer::Mail {
            to: mail.to.clone(),
            subject: mail.subject.clone(),
            body: mail.body.clone(),
        }
    }

    fn count_for(&self, to: &str) -> usize {
        self.0
            .lock()
            .expect("mailbox")
            .iter()
            .filter(|m| m.to == to)
            .count()
    }

    fn total(&self) -> usize {
        self.0.lock().expect("mailbox").len()
    }
}

struct Rig {
    app: axum::Router,
    pool: PgPool,
    mailer: Arc<TestMailer>,
}

impl Rig {
    fn new(pool: PgPool) -> Self {
        Self::with_limits(pool, api::ratelimit::RateLimitConfig::unlimited())
    }

    fn with_limits(pool: PgPool, rate_limits: api::ratelimit::RateLimitConfig) -> Self {
        let standin = StandIn::new(pool.clone(), StandInConfig::default());
        let auth = api::auth::AuthConfig::ephemeral().expect("auth config");
        let mailer = Arc::new(TestMailer::default());
        let ctx = api::schema::ApiContext {
            pool: pool.clone(),
            boundary: api::l1::StandInBoundary(standin.clone()),
            funding: standin,
            auth: auth.clone(),
            mailer: mailer.clone() as Arc<dyn api::mailer::Mailer>,
            web_origin: api::mailer::WebOrigin("http://localhost:3000".into()),
            onboarding: api::onboarding::OnboardingConfig::default(),
            rate_limits,
            breach: Arc::new(api::breach::DisabledCorpus),
            media: api::media::MediaConfig::default(),
            blobs: Arc::new(api::media::blob::in_memory()),
        };
        let uploads = api::UploadRouting {
            pool: ctx.pool.clone(),
            blobs: ctx.blobs.clone(),
            media: ctx.media.clone(),
        };
        let schema = api::schema::build(ctx);
        Self {
            app: api::app(
                schema,
                auth,
                axum_client_ip::ClientIpSource::XRealIp,
                uploads,
            ),
            pool,
            mailer,
        }
    }

    /// Executes one GraphQL request through the router, returning the
    /// whole response — data and transport errors both.
    async fn gql_raw(&self, token: Option<&str>, query: &str, variables: Value) -> Value {
        let mut builder = Request::builder()
            .method("POST")
            .uri("/graphql")
            .header("content-type", "application/json")
            .header("x-real-ip", "203.0.113.1");
        if let Some(token) = token {
            builder = builder.header("authorization", format!("Bearer {token}"));
        }
        let body = json!({ "query": query, "variables": variables }).to_string();
        let response = self
            .app
            .clone()
            .oneshot(builder.body(Body::from(body)).expect("request"))
            .await
            .expect("response");
        let bytes = response
            .into_body()
            .collect()
            .await
            .expect("body")
            .to_bytes();
        serde_json::from_slice(&bytes).expect("json")
    }

    /// Executes one GraphQL request, asserting no transport-tier errors.
    async fn gql(&self, token: Option<&str>, query: &str, variables: Value) -> Value {
        let json = self.gql_raw(token, query, variables).await;
        assert!(
            json.get("errors").is_none(),
            "unexpected transport errors: {json}"
        );
        json["data"].clone()
    }

    /// A credentialed, verified account with a real Argon2 hash, ready to
    /// log in.
    async fn seed_user(&self, handle: &str, email: &str, password: &str) -> Uuid {
        let key = common::l1::client::ActorKey::generate();
        let id = Uuid::new_v4();
        let mut conn = self.pool.acquire().await.expect("conn");
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
        let hash = api::auth::hash_password(password).expect("hash");
        postgres_store::genesis::insert_credentials(&self.pool, id, email, &hash)
            .await
            .expect("credentials");
        id
    }

    /// An applicant who never verified, holding the returned live
    /// verification token — the registration mail's link.
    async fn seed_unverified(&self, handle: &str, email: &str, password: &str) -> (Uuid, String) {
        let id = self.seed_user(handle, email, password).await;
        let verification = api::auth::new_secret();
        sqlx::query(
            "UPDATE user_credentials
             SET email_verified_at = NULL, account_state = 'applicant',
                 email_verification_token_hash = $2
             WHERE actor_id = $1",
        )
        .bind(id)
        .bind(verification.hash.as_slice())
        .execute(&self.pool)
        .await
        .expect("unverifies");
        (id, verification.token)
    }

    async fn access_token(&self, email: &str, password: &str) -> String {
        let data = self
            .gql(
                None,
                LOG_IN,
                json!({ "input": { "email": email, "password": password } }),
            )
            .await;
        data["logIn"]["auth"]["accessToken"]
            .as_str()
            .expect("access token")
            .to_string()
    }

    async fn request(&self, token: &str, new_email: &str, password: &str) -> Value {
        let data = self
            .gql(
                Some(token),
                REQUEST_CHANGE,
                json!({ "input": { "newEmail": new_email, "currentPassword": password } }),
            )
            .await;
        data["requestEmailChange"].clone()
    }

    async fn request_change(&self, token: &str, new_email: &str, password: &str) {
        let payload = self.request(token, new_email, password).await;
        assert_eq!(codes(&payload), Vec::<&str>::new());
        assert_eq!(payload["pendingEmailChange"]["newEmail"], new_email);
    }

    async fn confirm(&self, token: &str, code: &str) -> Value {
        let data = self
            .gql(
                Some(token),
                CONFIRM_CHANGE,
                json!({ "input": { "code": code } }),
            )
            .await;
        data["confirmEmailChange"].clone()
    }

    async fn resend(&self, token: &str) -> Value {
        self.gql(Some(token), RESEND_CHANGE, json!({})).await["resendEmailChange"].clone()
    }

    async fn cancel(&self, token: &str) -> Value {
        self.gql(Some(token), CANCEL_CHANGE, json!({})).await["cancelEmailChange"].clone()
    }

    async fn verify(&self, verification_token: &str) -> Value {
        self.gql(
            None,
            VERIFY_EMAIL,
            json!({ "input": { "verificationToken": verification_token } }),
        )
        .await["verifyEmail"]
            .clone()
    }

    async fn me(&self, token: &str) -> Value {
        self.gql(Some(token), ME, json!({})).await["me"].clone()
    }

    async fn stored_email(&self, user: Uuid) -> String {
        store::credentials_by_actor(&self.pool, user)
            .await
            .expect("query")
            .expect("row")
            .email
    }

    async fn verified(&self, user: Uuid) -> bool {
        store::credentials_by_actor(&self.pool, user)
            .await
            .expect("query")
            .expect("row")
            .email_verified_at
            .is_some()
    }

    /// Runs the account's pending change past its window.
    async fn run_out(&self, user: Uuid) {
        sqlx::query(
            "UPDATE auth_email_changes SET expires_at = NOW() - INTERVAL '1 second'
             WHERE user_id = $1 AND cancelled_at IS NULL AND applied_at IS NULL",
        )
        .bind(user)
        .execute(&self.pool)
        .await
        .expect("runs out");
    }
}

const LOG_IN: &str = "mutation($input: LogInInput!) {
    logIn(input: $input) { auth { accessToken } userErrors { code } }
}";
const PENDING: &str = "pendingEmailChange {
    newEmail requiresCode codeConfirmed linkConfirmed expiresAt
}";
const REQUEST_CHANGE: &str = "mutation($input: RequestEmailChangeInput!) {
    requestEmailChange(input: $input) {
        pendingEmailChange { newEmail requiresCode codeConfirmed linkConfirmed expiresAt }
        userErrors { code field }
    }
}";
const CONFIRM_CHANGE: &str = "mutation($input: ConfirmEmailChangeInput!) {
    confirmEmailChange(input: $input) {
        user {
            id email
            pendingEmailChange { newEmail requiresCode codeConfirmed linkConfirmed expiresAt }
        }
        userErrors { code field }
    }
}";
const RESEND_CHANGE: &str = "mutation {
    resendEmailChange {
        pendingEmailChange { newEmail requiresCode codeConfirmed linkConfirmed expiresAt }
        userErrors { code field }
    }
}";
const CANCEL_CHANGE: &str = "mutation {
    cancelEmailChange {
        user { id email pendingEmailChange { newEmail } }
        userErrors { code field }
    }
}";
const VERIFY_EMAIL: &str = "mutation($input: VerifyEmailInput!) {
    verifyEmail(input: $input) { ok userErrors { code field } }
}";
const ME: &str = "query {
    me {
        email emailVerified
        pendingEmailChange { newEmail requiresCode codeConfirmed linkConfirmed expiresAt }
    }
}";

fn codes(payload: &Value) -> Vec<&str> {
    payload["userErrors"]
        .as_array()
        .expect("userErrors")
        .iter()
        .map(|e| e["code"].as_str().expect("code"))
        .collect()
}

/// The transport-tier code of a refused request.
fn transport_code(response: &Value) -> Option<&str> {
    response["errors"][0]["extensions"]["code"].as_str()
}

/// A wrong code distinct from `right` — the same shape as a real one.
fn wrong_code_for(right: &str) -> String {
    if right == "000000" {
        "111111".into()
    } else {
        "000000".into()
    }
}

const PASSWORD: &str = "a strong password";

/// Neither proof alone moves the stored address; the change applies on
/// the second one whichever side it arrives from. Both orders are run in
/// turn — original side first, then new side first.
///
/// Neither proof alone moves the stored address: the change applies on the second one, whichever side it arrives from.
/// ´claim:auth:an-email-change-needs-both-sides´
#[sqlx::test(migrations = "../../migrations")]
async fn the_change_applies_once_both_sides_confirm_in_either_order(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "old@example.com", PASSWORD).await;
    let token = rig.access_token("old@example.com", PASSWORD).await;

    rig.request_change(&token, "first@example.com", PASSWORD)
        .await;
    let partial = rig
        .confirm(&token, &rig.mailer.latest_code_for("old@example.com"))
        .await;
    assert_eq!(codes(&partial), Vec::<&str>::new());
    assert_eq!(rig.stored_email(user).await, "old@example.com");
    let done = rig
        .confirm(&token, &rig.mailer.latest_code_for("first@example.com"))
        .await;
    assert_eq!(codes(&done), Vec::<&str>::new());
    assert_eq!(rig.stored_email(user).await, "first@example.com");
    assert_eq!(done["user"]["email"], "first@example.com");
    assert!(done["user"]["pendingEmailChange"].is_null());

    rig.request_change(&token, "second@example.com", PASSWORD)
        .await;
    rig.confirm(&token, &rig.mailer.latest_code_for("second@example.com"))
        .await;
    assert_eq!(rig.stored_email(user).await, "first@example.com");
    rig.confirm(&token, &rig.mailer.latest_code_for("first@example.com"))
        .await;
    assert_eq!(rig.stored_email(user).await, "second@example.com");
}

/// A wrong current password refuses the request on the password field,
/// and no mail goes to either address.
///
/// A wrong current password is refused as invalid credentials and mails nothing.
/// ´claim:auth:a-wrong-password-refuses-the-change-request´
#[sqlx::test(migrations = "../../migrations")]
async fn request_with_a_wrong_password_is_invalid_credentials_and_mails_nothing(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_user("alice", "old@example.com", PASSWORD).await;
    let token = rig.access_token("old@example.com", PASSWORD).await;

    let refused = rig
        .request(&token, "new@example.com", "not the password")
        .await;
    assert_eq!(codes(&refused), vec!["INVALID_CREDENTIALS"]);
    assert_eq!(
        refused["userErrors"][0]["field"],
        json!(["currentPassword"])
    );
    assert!(refused["pendingEmailChange"].is_null());
    assert_eq!(rig.mailer.total(), 0);
    assert!(rig.me(&token).await["pendingEmailChange"].is_null());
}

/// A malformed new address refuses on the address field.
///
/// A malformed new address is refused as bad input on that field.
/// ´claim:auth:a-malformed-new-address-is-bad-input´
#[sqlx::test(migrations = "../../migrations")]
async fn request_with_a_malformed_address_is_bad_input(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_user("alice", "old@example.com", PASSWORD).await;
    let token = rig.access_token("old@example.com", PASSWORD).await;

    let refused = rig.request(&token, "not-an-address", PASSWORD).await;
    assert_eq!(codes(&refused), vec!["BAD_INPUT"]);
    assert_eq!(refused["userErrors"][0]["field"], json!(["newEmail"]));
    assert_eq!(rig.mailer.total(), 0);
}

/// Asking for an address another account holds reads exactly like any
/// other request: the change opens and both mails go out, so the verb
/// never tells the caller who is registered.
///
/// A request to an address another account holds reads exactly as success.
/// ´claim:auth:a-taken-address-stays-indistinguishable´
#[sqlx::test(migrations = "../../migrations")]
async fn request_to_a_taken_address_reads_as_success(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_user("alice", "old@example.com", PASSWORD).await;
    rig.seed_user("bob", "taken@example.com", PASSWORD).await;
    let token = rig.access_token("old@example.com", PASSWORD).await;

    let taken = rig.request(&token, "taken@example.com", PASSWORD).await;
    let free = rig.request(&token, "free@example.com", PASSWORD).await;
    assert_eq!(codes(&taken), Vec::<&str>::new());
    assert_eq!(codes(&free), Vec::<&str>::new());
    assert_eq!(
        taken["pendingEmailChange"]["requiresCode"],
        free["pendingEmailChange"]["requiresCode"]
    );
    assert_eq!(rig.mailer.count_for("taken@example.com"), 1);
    assert_eq!(rig.mailer.count_for("free@example.com"), 1);
}

/// The current address receives a 6-digit numeric code; the new address
/// receives the change link.
///
/// The current-side code is six digits and the new side gets the change link.
/// ´claim:auth:the-current-side-code-is-six-digits´
#[sqlx::test(migrations = "../../migrations")]
async fn the_current_side_code_is_six_digits(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_user("alice", "old@example.com", PASSWORD).await;
    let token = rig.access_token("old@example.com", PASSWORD).await;
    rig.request_change(&token, "new@example.com", PASSWORD)
        .await;

    let code = rig.mailer.latest_code_for("old@example.com");
    assert_eq!(code.len(), 6, "code {code:?}");
    assert!(code.chars().all(|c| c.is_ascii_digit()), "code {code:?}");
    let link = rig.mailer.latest_for("new@example.com");
    assert!(
        link.body.contains("/email-change?token="),
        "body {:?}",
        link.body
    );
}

/// Someone else registers the wanted address between the two proofs, so
/// the final confirm reports the collision as a userError rather than a
/// transport error. The change's row stays alive: a retry re-submitting
/// the consumed code still gets the real reason instead of a token error,
/// and once the address frees up within the TTL that same retry applies
/// the fully-proven change.
///
/// An address taken between the two proofs reports as in use rather than as a transport fault, and the change row stays live so a retry inside the window still says why and still applies once the address frees.
/// ´claim:auth:a-collision-is-reported-and-the-change-survives-it´
#[sqlx::test(migrations = "../../migrations")]
async fn a_collision_surfaces_email_in_use_and_retries_stay_truthful(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "old@example.com", PASSWORD).await;
    let token = rig.access_token("old@example.com", PASSWORD).await;
    rig.request_change(&token, "wanted@example.com", PASSWORD)
        .await;
    let original_code = rig.mailer.latest_code_for("old@example.com");
    let new_code = rig.mailer.latest_code_for("wanted@example.com");
    rig.confirm(&token, &original_code).await;

    let squatter = rig.seed_user("bob", "wanted@example.com", PASSWORD).await;
    let collided = rig.confirm(&token, &new_code).await;
    assert_eq!(codes(&collided), vec!["EMAIL_IN_USE"]);
    assert_eq!(rig.stored_email(user).await, "old@example.com");

    let retried = rig.confirm(&token, &new_code).await;
    assert_eq!(codes(&retried), vec!["EMAIL_IN_USE"]);
    let retried_code = rig.confirm(&token, &original_code).await;
    assert_eq!(codes(&retried_code), vec!["EMAIL_IN_USE"]);

    sqlx::query("UPDATE user_credentials SET email = 'elsewhere@example.com' WHERE actor_id = $1")
        .bind(squatter)
        .execute(&rig.pool)
        .await
        .expect("frees");
    let applied = rig.confirm(&token, &new_code).await;
    assert_eq!(codes(&applied), Vec::<&str>::new());
    assert_eq!(rig.stored_email(user).await, "wanted@example.com");
}

/// A confirmation code with no pending change behind it is a token error.
/// ´claim:auth:a-code-without-a-change-is-a-token-error´
#[sqlx::test(migrations = "../../migrations")]
async fn a_garbage_code_with_no_pending_change_is_a_token_error(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    let refused = rig.confirm(&token, "123456").await;
    assert_eq!(codes(&refused), vec!["VERIFICATION_TOKEN_INVALID"]);
    assert_eq!(refused["userErrors"][0]["field"], json!(["code"]));
    assert!(refused["user"].is_null());
}

/// A wrong code against a live change is a token error on the code field,
/// and the change stays pending with its code side still owed.
///
/// A wrong code against a pending change is a token error on the code field and moves nothing.
/// ´claim:auth:a-wrong-code-is-a-token-error´
#[sqlx::test(migrations = "../../migrations")]
async fn a_wrong_code_against_a_pending_change_is_token_invalid(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    let right = rig.mailer.latest_code_for("a@example.com");

    let refused = rig.confirm(&token, &wrong_code_for(&right)).await;
    assert_eq!(codes(&refused), vec!["VERIFICATION_TOKEN_INVALID"]);
    assert_eq!(refused["userErrors"][0]["field"], json!(["code"]));
    assert_eq!(rig.stored_email(user).await, "a@example.com");
    assert_eq!(
        rig.me(&token).await["pendingEmailChange"]["codeConfirmed"],
        false
    );
}

/// Past its window a change answers that it ran out — to its code and
/// to its link alike — and no longer reads as pending.
///
/// A change past its window answers that it expired, by code and by link, and reads as no longer pending.
/// ´claim:auth:a-change-past-its-window-is-expired´
#[sqlx::test(migrations = "../../migrations")]
async fn confirming_after_the_window_is_email_change_expired(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    let code = rig.mailer.latest_code_for("a@example.com");
    let link = rig.mailer.latest_code_for("b@example.com");
    rig.run_out(user).await;

    assert_eq!(
        codes(&rig.confirm(&token, &code).await),
        vec!["EMAIL_CHANGE_EXPIRED"]
    );
    assert_eq!(
        codes(&rig.confirm(&token, &link).await),
        vec!["EMAIL_CHANGE_EXPIRED"]
    );
    assert_eq!(rig.stored_email(user).await, "a@example.com");
    assert!(rig.me(&token).await["pendingEmailChange"].is_null());
}

/// Four wrong codes are token errors; the fifth disables the code and
/// already says so, and from then on even the right code answers the
/// same — while the change and its link side stay live.
///
/// The fifth wrong code disables the code at once, and the right code answers the same until a fresh one is sent.
/// ´claim:auth:five-wrong-codes-disable-the-code´
#[sqlx::test(migrations = "../../migrations")]
async fn five_wrong_codes_disable_the_code(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    let right = rig.mailer.latest_code_for("a@example.com");
    let wrong = wrong_code_for(&right);

    for _ in 0..4 {
        assert_eq!(
            codes(&rig.confirm(&token, &wrong).await),
            vec!["VERIFICATION_TOKEN_INVALID"]
        );
    }
    let fifth = rig.confirm(&token, &wrong).await;
    assert_eq!(codes(&fifth), vec!["EMAIL_CHANGE_CODE_DISABLED"]);
    assert_eq!(fifth["userErrors"][0]["field"], json!(["code"]));
    let right_after = rig.confirm(&token, &right).await;
    assert_eq!(codes(&right_after), vec!["EMAIL_CHANGE_CODE_DISABLED"]);

    let link = rig.mailer.latest_code_for("b@example.com");
    assert_eq!(codes(&rig.confirm(&token, &link).await), Vec::<&str>::new());
    let pending = &rig.me(&token).await["pendingEmailChange"];
    assert_eq!(pending["linkConfirmed"], true);
    assert_eq!(pending["codeConfirmed"], false);
    assert_eq!(rig.stored_email(user).await, "a@example.com");
}

/// A resend after the code was disabled mints a fresh code with a fresh
/// count of tries; the fresh code proves the side and the change applies.
///
/// A resend after the code was disabled re-arms it with a fresh code and a fresh count.
/// ´claim:auth:a-resend-rearms-a-disabled-code´
#[sqlx::test(migrations = "../../migrations")]
async fn a_resend_after_disabling_rearms_the_code(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    let first = rig.mailer.latest_code_for("a@example.com");
    let wrong = wrong_code_for(&first);
    for _ in 0..5 {
        rig.confirm(&token, &wrong).await;
    }

    assert_eq!(codes(&rig.resend(&token).await), Vec::<&str>::new());
    let fresh = rig.mailer.latest_code_for("a@example.com");
    let wrong = wrong_code_for(&fresh);
    assert_eq!(
        codes(&rig.confirm(&token, &wrong).await),
        vec!["VERIFICATION_TOKEN_INVALID"],
        "the fresh code starts a fresh count"
    );
    assert_eq!(
        codes(&rig.confirm(&token, &fresh).await),
        Vec::<&str>::new()
    );
    rig.confirm(&token, &rig.mailer.latest_code_for("b@example.com"))
        .await;
    assert_eq!(rig.stored_email(user).await, "b@example.com");
}

/// After a cancel the change's link names the cancel instead of applying,
/// and its code is dead with it.
///
/// A canceled change's link answers that the change was canceled and moves nothing.
/// ´claim:auth:a-canceled-changes-link-names-the-cancel´
#[sqlx::test(migrations = "../../migrations")]
async fn a_canceled_changes_link_is_email_change_canceled_and_moves_nothing(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    rig.confirm(&token, &rig.mailer.latest_code_for("a@example.com"))
        .await;
    rig.cancel(&token).await;

    let refused = rig
        .confirm(&token, &rig.mailer.latest_code_for("b@example.com"))
        .await;
    assert_eq!(codes(&refused), vec!["EMAIL_CHANGE_CANCELED"]);
    assert!(refused["user"].is_null());
    assert_eq!(rig.stored_email(user).await, "a@example.com");
}

/// Once applied, re-opening the change's link names the application and
/// never applies a second time — not even after the account moved on.
///
/// Re-opening an applied change's link answers that it already applied and applies nothing.
/// ´claim:auth:an-applied-changes-link-names-the-application´
#[sqlx::test(migrations = "../../migrations")]
async fn reopening_an_applied_changes_link_is_already_applied_and_applies_nothing(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    let link = rig.mailer.latest_code_for("b@example.com");
    rig.confirm(&token, &rig.mailer.latest_code_for("a@example.com"))
        .await;
    rig.confirm(&token, &link).await;
    assert_eq!(rig.stored_email(user).await, "b@example.com");

    rig.request_change(&token, "c@example.com", PASSWORD).await;
    rig.confirm(&token, &rig.mailer.latest_code_for("b@example.com"))
        .await;
    rig.confirm(&token, &rig.mailer.latest_code_for("c@example.com"))
        .await;
    assert_eq!(rig.stored_email(user).await, "c@example.com");

    let reopened = rig.confirm(&token, &link).await;
    assert_eq!(codes(&reopened), vec!["EMAIL_CHANGE_ALREADY_APPLIED"]);
    assert_eq!(rig.stored_email(user).await, "c@example.com");
}

/// Requests spend the account's mail budget; once it is spent the next
/// request refuses visibly, mails nothing and opens nothing.
///
/// Once the account's request budget is spent a request is rate limited and mails nothing.
/// ´claim:auth:email-change-requests-spend-the-account-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn email_change_requests_trip_the_account_budget(pool: PgPool) {
    let mut limits = api::ratelimit::RateLimitConfig::unlimited();
    limits.email_change_request_account = api::ratelimit::Window {
        limit: 2,
        window_secs: 3600.0,
    };
    let rig = Rig::with_limits(pool, limits);
    rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    rig.request_change(&token, "c@example.com", PASSWORD).await;
    let mailed = rig.mailer.total();

    let refused = rig
        .gql_raw(
            Some(&token),
            REQUEST_CHANGE,
            json!({ "input": { "newEmail": "d@example.com", "currentPassword": PASSWORD } }),
        )
        .await;
    assert_eq!(transport_code(&refused), Some("RATE_LIMITED"));
    assert_eq!(rig.mailer.total(), mailed);
    assert_eq!(
        rig.me(&token).await["pendingEmailChange"]["newEmail"],
        "c@example.com"
    );
}

/// Resends spend the account's other mail budget; once it is spent the
/// next resend refuses visibly and mails nothing.
///
/// Once the account's resend budget is spent a resend is rate limited and mails nothing.
/// ´claim:auth:email-change-resends-spend-the-account-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn email_change_resends_trip_the_account_budget(pool: PgPool) {
    let mut limits = api::ratelimit::RateLimitConfig::unlimited();
    limits.email_change_resend_account = api::ratelimit::Window {
        limit: 1,
        window_secs: 3600.0,
    };
    let rig = Rig::with_limits(pool, limits);
    rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    assert_eq!(codes(&rig.resend(&token).await), Vec::<&str>::new());
    let mailed = rig.mailer.total();

    let refused = rig.gql_raw(Some(&token), RESEND_CHANGE, json!({})).await;
    assert_eq!(transport_code(&refused), Some("RATE_LIMITED"));
    assert_eq!(rig.mailer.total(), mailed);
}

/// With the link's side landed, a resend mails only a fresh code, to the
/// current address.
///
/// With the link landed a resend mails only the code, to the current address.
/// ´claim:auth:a-resend-with-the-link-landed-mails-only-the-code´
#[sqlx::test(migrations = "../../migrations")]
async fn resend_with_the_link_confirmed_mails_only_the_code(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    rig.confirm(&token, &rig.mailer.latest_code_for("b@example.com"))
        .await;

    let resent = rig.resend(&token).await;
    assert_eq!(codes(&resent), Vec::<&str>::new());
    assert_eq!(rig.mailer.count_for("a@example.com"), 2);
    assert_eq!(rig.mailer.count_for("b@example.com"), 1);
    assert_eq!(resent["pendingEmailChange"]["linkConfirmed"], true);
}

/// With the code's side landed, a resend mails only a fresh link, to the
/// new address.
///
/// With the code landed a resend mails only the link, to the new address.
/// ´claim:auth:a-resend-with-the-code-landed-mails-only-the-link´
#[sqlx::test(migrations = "../../migrations")]
async fn resend_with_the_code_confirmed_mails_only_the_link(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    rig.confirm(&token, &rig.mailer.latest_code_for("a@example.com"))
        .await;

    let resent = rig.resend(&token).await;
    assert_eq!(codes(&resent), Vec::<&str>::new());
    assert_eq!(rig.mailer.count_for("a@example.com"), 1);
    assert_eq!(rig.mailer.count_for("b@example.com"), 2);
    assert_eq!(resent["pendingEmailChange"]["codeConfirmed"], true);
}

/// A resend leaves a proven side proven: the code confirmed before the
/// resend still counts, and the one fresh link completes the change.
///
/// A resend never resets a side that already landed.
/// ´claim:auth:a-resend-never-resets-a-landed-side´
#[sqlx::test(migrations = "../../migrations")]
async fn resend_never_resets_a_confirmed_side(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    let code = rig.mailer.latest_code_for("a@example.com");
    rig.confirm(&token, &code).await;
    rig.resend(&token).await;
    rig.resend(&token).await;

    assert_eq!(
        rig.me(&token).await["pendingEmailChange"]["codeConfirmed"],
        true
    );
    rig.confirm(&token, &rig.mailer.latest_code_for("b@example.com"))
        .await;
    assert_eq!(rig.stored_email(user).await, "b@example.com");
}

/// A resend with both sides owed replaces both secrets: the old code and
/// the old link die, the fresh pair completes the change.
///
/// A resend rotates the owed secrets, so the previous code and link stop working.
/// ´claim:auth:a-resend-rotates-the-owed-secrets´
#[sqlx::test(migrations = "../../migrations")]
async fn resend_rotates_the_owed_secrets(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    let old_code = rig.mailer.latest_code_for("a@example.com");
    let old_link = rig.mailer.latest_code_for("b@example.com");

    rig.resend(&token).await;
    let new_code = rig.mailer.latest_code_for("a@example.com");
    let new_link = rig.mailer.latest_code_for("b@example.com");
    assert_ne!(old_link, new_link);
    if old_code != new_code {
        assert_eq!(
            codes(&rig.confirm(&token, &old_code).await),
            vec!["VERIFICATION_TOKEN_INVALID"]
        );
    }
    assert_eq!(
        codes(&rig.confirm(&token, &old_link).await),
        vec!["VERIFICATION_TOKEN_INVALID"]
    );
    rig.confirm(&token, &new_code).await;
    rig.confirm(&token, &new_link).await;
    assert_eq!(rig.stored_email(user).await, "b@example.com");
}

/// A cancel kills the code and the link together; the address stays and
/// nothing reads as pending.
///
/// A cancel kills both secrets and leaves the address where it was.
/// ´claim:auth:a-cancel-kills-both-secrets´
#[sqlx::test(migrations = "../../migrations")]
async fn cancel_kills_both_secrets(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "b@example.com", PASSWORD).await;
    let code = rig.mailer.latest_code_for("a@example.com");
    let link = rig.mailer.latest_code_for("b@example.com");

    let canceled = rig.cancel(&token).await;
    assert_eq!(codes(&canceled), Vec::<&str>::new());
    assert_eq!(canceled["user"]["email"], "a@example.com");
    assert!(canceled["user"]["pendingEmailChange"].is_null());
    assert_eq!(
        codes(&rig.confirm(&token, &code).await),
        vec!["VERIFICATION_TOKEN_INVALID"]
    );
    assert_eq!(
        codes(&rig.confirm(&token, &link).await),
        vec!["EMAIL_CHANGE_CANCELED"]
    );
    assert_eq!(
        codes(&rig.resend(&token).await),
        vec!["NOT_FOUND"],
        "nothing is pending to resend"
    );
    assert_eq!(rig.stored_email(user).await, "a@example.com");
}

/// A second request supersedes the first: the first change's link names
/// a cancel, its code is dead, and only the second change is pending.
///
/// A second request supersedes the first, whose secrets die as canceled.
/// ´claim:auth:a-second-request-supersedes-the-first´
#[sqlx::test(migrations = "../../migrations")]
async fn a_second_request_supersedes_the_first(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    rig.request_change(&token, "first@example.com", PASSWORD)
        .await;
    let first_code = rig.mailer.latest_code_for("a@example.com");
    let first_link = rig.mailer.latest_code_for("first@example.com");
    rig.request_change(&token, "second@example.com", PASSWORD)
        .await;
    let second_code = rig.mailer.latest_code_for("a@example.com");

    assert_eq!(
        codes(&rig.confirm(&token, &first_link).await),
        vec!["EMAIL_CHANGE_CANCELED"]
    );
    if first_code != second_code {
        assert_eq!(
            codes(&rig.confirm(&token, &first_code).await),
            vec!["VERIFICATION_TOKEN_INVALID"]
        );
    }
    assert_eq!(
        rig.me(&token).await["pendingEmailChange"]["newEmail"],
        "second@example.com"
    );
    rig.confirm(&token, &second_code).await;
    rig.confirm(&token, &rig.mailer.latest_code_for("second@example.com"))
        .await;
    assert_eq!(rig.stored_email(user).await, "second@example.com");
}

/// The viewer's own read names the account's address and the pending
/// change, side by side, as each side lands.
///
/// The pending change reads which side landed, beside the account's own address.
/// ´claim:auth:the-pending-change-reads-which-side-landed´
#[sqlx::test(migrations = "../../migrations")]
async fn pending_change_reads_which_side_landed(pool: PgPool) {
    let rig = Rig::new(pool);
    rig.seed_user("alice", "a@example.com", PASSWORD).await;
    let token = rig.access_token("a@example.com", PASSWORD).await;
    assert!(rig.me(&token).await["pendingEmailChange"].is_null());

    rig.request_change(&token, "b@example.com", PASSWORD).await;
    let me = rig.me(&token).await;
    assert_eq!(me["email"], "a@example.com");
    let pending = &me["pendingEmailChange"];
    assert_eq!(pending["newEmail"], "b@example.com");
    assert_eq!(pending["requiresCode"], true);
    assert_eq!(pending["codeConfirmed"], false);
    assert_eq!(pending["linkConfirmed"], false);
    assert!(pending["expiresAt"].is_string());

    let linked = rig
        .confirm(&token, &rig.mailer.latest_code_for("b@example.com"))
        .await;
    let pending = &linked["user"]["pendingEmailChange"];
    assert_eq!(pending["linkConfirmed"], true);
    assert_eq!(pending["codeConfirmed"], false);
}

/// Another account — and an anonymous reader — sees neither the address
/// nor the pending change.
///
/// The account's address and pending change resolve for its own viewer only.
/// ´claim:auth:email-and-pending-change-are-viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn email_and_pending_change_are_viewer_only(pool: PgPool) {
    let rig = Rig::new(pool);
    let alice = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    rig.seed_user("mallory", "m@example.com", PASSWORD).await;
    let owner = rig.access_token("a@example.com", PASSWORD).await;
    let other = rig.access_token("m@example.com", PASSWORD).await;
    rig.request_change(&owner, "b@example.com", PASSWORD).await;

    let query = format!("query($id: UUID!) {{ user(id: $id) {{ email {PENDING} }} }}");
    for token in [Some(other.as_str()), None] {
        let seen = rig.gql(token, &query, json!({ "id": alice })).await;
        assert!(seen["user"]["email"].is_null(), "{seen}");
        assert!(seen["user"]["pendingEmailChange"].is_null(), "{seen}");
    }
    let own = rig.gql(Some(&owner), &query, json!({ "id": alice })).await;
    assert_eq!(own["user"]["email"], "a@example.com");
    assert_eq!(
        own["user"]["pendingEmailChange"]["newEmail"],
        "b@example.com"
    );
}

/// The new-side token names its owner first: another signed-in account
/// presenting it is told the link is for another account, and the
/// attempt leaves the owner's proof intact for them to complete.
///
/// The new-side proof is scoped to its own viewer, and a foreign account's attempt to spend it neither succeeds nor consumes it.
/// ´claim:auth:the-new-side-proof-is-scoped-to-its-viewer´
#[sqlx::test(migrations = "../../migrations")]
async fn another_accounts_new_side_token_is_other_account_and_not_consumed(pool: PgPool) {
    let rig = Rig::new(pool);
    let owner = rig.seed_user("alice", "a@example.com", PASSWORD).await;
    rig.seed_user("mallory", "m@example.com", PASSWORD).await;
    let owner_token = rig.access_token("a@example.com", PASSWORD).await;
    let intruder_token = rig.access_token("m@example.com", PASSWORD).await;
    rig.request_change(&owner_token, "moved@example.com", PASSWORD)
        .await;
    let new_code = rig.mailer.latest_code_for("moved@example.com");

    let refused = rig.confirm(&intruder_token, &new_code).await;
    assert_eq!(codes(&refused), vec!["EMAIL_CHANGE_OTHER_ACCOUNT"]);
    assert_eq!(rig.stored_email(owner).await, "a@example.com");
    assert_eq!(
        rig.me(&owner_token).await["pendingEmailChange"]["linkConfirmed"],
        false
    );

    rig.confirm(&owner_token, &new_code).await;
    rig.confirm(&owner_token, &rig.mailer.latest_code_for("a@example.com"))
        .await;
    assert_eq!(rig.stored_email(owner).await, "moved@example.com");
}

/// An unverified account's change needs no code: the new address gets
/// the account's verification link, and opening it moves the address and
/// verifies the account in one step.
///
/// An unverified account changes its address by the new address's verification link alone, which also verifies it.
/// ´claim:auth:the-unverified-carve-out-needs-only-the-new-link´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unverified_account_changes_email_by_the_new_link_alone(pool: PgPool) {
    let rig = Rig::new(pool);
    let (user, _) = rig
        .seed_unverified("alice", "typo@example.com", PASSWORD)
        .await;
    let token = rig.access_token("typo@example.com", PASSWORD).await;

    let requested = rig.request(&token, "right@example.com", PASSWORD).await;
    assert_eq!(codes(&requested), Vec::<&str>::new());
    assert_eq!(requested["pendingEmailChange"]["requiresCode"], false);
    assert_eq!(rig.mailer.count_for("typo@example.com"), 0, "no code");
    let link = rig.mailer.latest_for("right@example.com");
    assert!(link.body.contains("/verify?token="), "body {:?}", link.body);

    let verified = rig
        .verify(&rig.mailer.latest_code_for("right@example.com"))
        .await;
    assert_eq!(verified["ok"], true);
    assert_eq!(rig.stored_email(user).await, "right@example.com");
    assert!(rig.verified(user).await);
    assert!(rig.me(&token).await["pendingEmailChange"].is_null());
}

/// The registration link sent to the replaced address dies with the
/// request, and a verification resend sends nothing there while the
/// change is live.
///
/// The link sent to the replaced address stops working, and no fresh one goes there.
/// ´claim:auth:the-replaced-addresss-link-dies´
#[sqlx::test(migrations = "../../migrations")]
async fn the_replaced_addresss_link_dies(pool: PgPool) {
    let rig = Rig::new(pool);
    let (user, registration_link) = rig
        .seed_unverified("alice", "typo@example.com", PASSWORD)
        .await;
    let token = rig.access_token("typo@example.com", PASSWORD).await;
    rig.request_change(&token, "right@example.com", PASSWORD)
        .await;

    let dead = rig.verify(&registration_link).await;
    assert_eq!(dead["ok"], false);
    assert_eq!(codes(&dead), vec!["VERIFICATION_TOKEN_INVALID"]);
    assert!(!rig.verified(user).await);

    rig.gql(
        None,
        "mutation { resendVerificationEmail(input: { email: \"typo@example.com\" }) { ok } }",
        json!({}),
    )
    .await;
    assert_eq!(rig.mailer.count_for("typo@example.com"), 0);
    assert_eq!(rig.stored_email(user).await, "typo@example.com");
}

/// While the carve-out is pending, the account's verification link lives
/// at the new address: a verification resend rotates it and mails the
/// new address, the previous link dies, and the fresh one applies the
/// change.
///
/// A verification resend during a pending carve-out mails a fresh link to the new address.
/// ´claim:auth:a-verification-resend-follows-the-carve-out´
#[sqlx::test(migrations = "../../migrations")]
async fn resend_during_a_pending_carve_out_mails_the_new_address(pool: PgPool) {
    let rig = Rig::new(pool);
    let (user, _) = rig
        .seed_unverified("alice", "typo@example.com", PASSWORD)
        .await;
    let token = rig.access_token("typo@example.com", PASSWORD).await;
    rig.request_change(&token, "right@example.com", PASSWORD)
        .await;
    let first = rig.mailer.latest_code_for("right@example.com");

    rig.gql(
        None,
        "mutation { resendVerificationEmail(input: { email: \"typo@example.com\" }) { ok } }",
        json!({}),
    )
    .await;
    assert_eq!(rig.mailer.count_for("typo@example.com"), 0);
    assert_eq!(rig.mailer.count_for("right@example.com"), 2);
    let fresh = rig.mailer.latest_for("right@example.com");
    assert!(
        fresh.body.contains("/verify?token="),
        "body {:?}",
        fresh.body
    );

    assert_eq!(
        codes(&rig.verify(&first).await),
        vec!["VERIFICATION_TOKEN_INVALID"]
    );
    let verified = rig
        .verify(&rig.mailer.latest_code_for("right@example.com"))
        .await;
    assert_eq!(verified["ok"], true);
    assert_eq!(rig.stored_email(user).await, "right@example.com");
    assert!(rig.verified(user).await);
}

/// A carve-out link a resend replaced answers as an invalid verification
/// token — the landing never says which way a link died.
///
/// A carve-out link replaced by a fresh one is an invalid verification token.
/// ´claim:auth:a-replaced-carve-out-link-is-an-invalid-token´
#[sqlx::test(migrations = "../../migrations")]
async fn the_replaced_addresss_link_is_verification_token_invalid(pool: PgPool) {
    let rig = Rig::new(pool);
    let (user, _) = rig
        .seed_unverified("alice", "typo@example.com", PASSWORD)
        .await;
    let token = rig.access_token("typo@example.com", PASSWORD).await;
    rig.request_change(&token, "right@example.com", PASSWORD)
        .await;
    let replaced = rig.mailer.latest_code_for("right@example.com");
    rig.resend(&token).await;

    let refused = rig.verify(&replaced).await;
    assert_eq!(refused["ok"], false);
    assert_eq!(codes(&refused), vec!["VERIFICATION_TOKEN_INVALID"]);
    assert!(!rig.verified(user).await);

    let fresh = rig
        .verify(&rig.mailer.latest_code_for("right@example.com"))
        .await;
    assert_eq!(fresh["ok"], true);
    assert_eq!(rig.stored_email(user).await, "right@example.com");
}

/// A carve-out link to an address another account took meanwhile answers
/// that the address is in use, and moves nothing.
///
/// The carve-out link to an address taken meanwhile answers in use and moves nothing.
/// ´claim:auth:a-carve-out-collision-is-email-in-use´
#[sqlx::test(migrations = "../../migrations")]
async fn the_carve_out_link_to_a_taken_address_is_email_in_use(pool: PgPool) {
    let rig = Rig::new(pool);
    let (user, _) = rig
        .seed_unverified("alice", "typo@example.com", PASSWORD)
        .await;
    let token = rig.access_token("typo@example.com", PASSWORD).await;
    rig.request_change(&token, "right@example.com", PASSWORD)
        .await;
    rig.seed_user("bob", "right@example.com", PASSWORD).await;

    let collided = rig
        .verify(&rig.mailer.latest_code_for("right@example.com"))
        .await;
    assert_eq!(collided["ok"], false);
    assert_eq!(codes(&collided), vec!["EMAIL_IN_USE"]);
    assert_eq!(rig.stored_email(user).await, "typo@example.com");
    assert!(!rig.verified(user).await);
}

/// The change does not restart the account's 7-day window: its clock
/// keeps the registration's start, and an account past that window can
/// no longer complete the carve-out.
///
/// An email change does not restart the unverified account's reap window.
/// ´claim:auth:an-email-change-keeps-the-reap-window´
#[sqlx::test(migrations = "../../migrations")]
async fn the_reap_window_does_not_restart(pool: PgPool) {
    let rig = Rig::new(pool);
    let (user, _) = rig
        .seed_unverified("alice", "typo@example.com", PASSWORD)
        .await;
    let token = rig.access_token("typo@example.com", PASSWORD).await;
    let registered: chrono::DateTime<chrono::Utc> =
        sqlx::query_scalar("SELECT created_at FROM user_credentials WHERE actor_id = $1")
            .bind(user)
            .fetch_one(&rig.pool)
            .await
            .expect("created_at");
    rig.request_change(&token, "right@example.com", PASSWORD)
        .await;
    let after: chrono::DateTime<chrono::Utc> =
        sqlx::query_scalar("SELECT created_at FROM user_credentials WHERE actor_id = $1")
            .bind(user)
            .fetch_one(&rig.pool)
            .await
            .expect("created_at");
    assert_eq!(registered, after);

    sqlx::query(
        "UPDATE user_credentials SET created_at = NOW() - INTERVAL '8 days' WHERE actor_id = $1",
    )
    .bind(user)
    .execute(&rig.pool)
    .await
    .expect("ages");
    let refused = rig
        .verify(&rig.mailer.latest_code_for("right@example.com"))
        .await;
    assert_eq!(refused["ok"], false);
    assert_eq!(codes(&refused), vec!["VERIFICATION_TOKEN_INVALID"]);
    assert_eq!(rig.stored_email(user).await, "typo@example.com");
}
