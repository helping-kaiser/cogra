//! The email-change mutations through the real HTTP surface (auth.md
//! "Email change"): the two-sided proof end to end, the EMAIL_IN_USE
//! collision as a userError instead of a transport error, truthful
//! retries after a collision, and the viewer scoping of the new-side
//! token. Requires a live Postgres (`make up`).

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
    /// The code out of the newest message to `to` — the last word of the
    /// body, per the email-change mail format.
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
}

struct Rig {
    app: axum::Router,
    pool: PgPool,
    mailer: Arc<TestMailer>,
}

impl Rig {
    fn new(pool: PgPool) -> Self {
        let standin = StandIn::new(pool.clone(), StandInConfig::default());
        let auth = api::auth::AuthConfig::ephemeral().expect("auth config");
        let mailer = Arc::new(TestMailer::default());
        let schema = api::schema::build(api::schema::ApiContext {
            pool: pool.clone(),
            boundary: api::l1::StandInBoundary(standin.clone()),
            funding: standin,
            auth: auth.clone(),
            mailer: mailer.clone() as Arc<dyn api::mailer::Mailer>,
            web_origin: api::mailer::WebOrigin("http://localhost:3000".into()),
            onboarding: api::onboarding::OnboardingConfig::default(),
            rate_limits: api::ratelimit::RateLimitConfig::unlimited(),
            breach: Arc::new(api::breach::DisabledCorpus),
            media: api::media::MediaConfig::default(),
            blobs: Arc::new(api::media::blob::in_memory()),
        });
        Self {
            app: api::app(
                schema,
                auth,
                axum_client_ip::ClientIpSource::XRealIp,
                &api::media::MediaConfig::default(),
            ),
            pool,
            mailer,
        }
    }

    /// Executes one GraphQL request through the router, asserting no
    /// transport-tier errors.
    async fn gql(&self, token: Option<&str>, query: &str, variables: Value) -> Value {
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
        let json: Value = serde_json::from_slice(&bytes).expect("json");
        assert!(
            json.get("errors").is_none(),
            "unexpected transport errors: {json}"
        );
        json["data"].clone()
    }

    /// A credentialed account with a real Argon2 hash, ready to log in.
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

    async fn request_change(&self, token: &str, new_email: &str, password: &str) {
        let data = self
            .gql(
                Some(token),
                REQUEST_CHANGE,
                json!({ "input": { "newEmail": new_email, "currentPassword": password } }),
            )
            .await;
        assert_eq!(data["requestEmailChange"]["ok"], true);
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

    async fn stored_email(&self, user: Uuid) -> String {
        store::credentials_by_actor(&self.pool, user)
            .await
            .expect("query")
            .expect("row")
            .email
    }
}

const LOG_IN: &str = "mutation($input: LogInInput!) {
    logIn(input: $input) { auth { accessToken } userErrors { code } }
}";
const REQUEST_CHANGE: &str = "mutation($input: RequestEmailChangeInput!) {
    requestEmailChange(input: $input) { ok }
}";
const CONFIRM_CHANGE: &str = "mutation($input: ConfirmEmailChangeInput!) {
    confirmEmailChange(input: $input) {
        user { id }
        userErrors { code field }
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

/// Neither proof alone moves the stored address; the change applies on
/// the second one whichever side it arrives from. Both orders are run in
/// turn — original side first, then new side first.
///
/// Neither proof alone moves the stored address: the change applies on the second one, whichever side it arrives from.
/// ´claim:auth:an-email-change-needs-both-sides´
#[sqlx::test(migrations = "../../migrations")]
async fn the_change_applies_once_both_sides_confirm_in_either_order(pool: PgPool) {
    let rig = Rig::new(pool);
    let user = rig
        .seed_user("alice", "old@example.com", "a strong password")
        .await;
    let token = rig
        .access_token("old@example.com", "a strong password")
        .await;

    rig.request_change(&token, "first@example.com", "a strong password")
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

    rig.request_change(&token, "second@example.com", "a strong password")
        .await;
    rig.confirm(&token, &rig.mailer.latest_code_for("second@example.com"))
        .await;
    assert_eq!(rig.stored_email(user).await, "first@example.com");
    rig.confirm(&token, &rig.mailer.latest_code_for("first@example.com"))
        .await;
    assert_eq!(rig.stored_email(user).await, "second@example.com");
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
    let user = rig
        .seed_user("alice", "old@example.com", "a strong password")
        .await;
    let token = rig
        .access_token("old@example.com", "a strong password")
        .await;
    rig.request_change(&token, "wanted@example.com", "a strong password")
        .await;
    let original_code = rig.mailer.latest_code_for("old@example.com");
    let new_code = rig.mailer.latest_code_for("wanted@example.com");
    rig.confirm(&token, &original_code).await;

    let squatter = rig
        .seed_user("bob", "wanted@example.com", "a strong password")
        .await;
    let collided = rig.confirm(&token, &new_code).await;
    assert_eq!(codes(&collided), vec!["EMAIL_IN_USE"]);
    assert_eq!(rig.stored_email(user).await, "old@example.com");

    let retried = rig.confirm(&token, &new_code).await;
    assert_eq!(codes(&retried), vec!["EMAIL_IN_USE"]);

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
    rig.seed_user("alice", "a@example.com", "a strong password")
        .await;
    let token = rig.access_token("a@example.com", "a strong password").await;
    let refused = rig.confirm(&token, "no-such-code").await;
    assert_eq!(codes(&refused), vec!["VERIFICATION_TOKEN_INVALID"]);
    assert_eq!(refused["userErrors"][0]["field"], json!(["code"]));
    assert!(refused["user"].is_null());
}

/// The new-side token is scoped to its own viewer: another authenticated
/// account cannot spend it, and the attempt leaves the owner's proof
/// intact for them to complete afterwards.
///
/// The new-side proof is scoped to its own viewer, and a foreign account's attempt to spend it neither succeeds nor consumes it.
/// ´claim:auth:the-new-side-proof-is-scoped-to-its-viewer´
#[sqlx::test(migrations = "../../migrations")]
async fn another_accounts_new_side_token_is_invalid_and_not_consumed(pool: PgPool) {
    let rig = Rig::new(pool);
    let owner = rig
        .seed_user("alice", "a@example.com", "a strong password")
        .await;
    rig.seed_user("mallory", "m@example.com", "a strong password")
        .await;
    let owner_token = rig.access_token("a@example.com", "a strong password").await;
    let intruder_token = rig.access_token("m@example.com", "a strong password").await;
    rig.request_change(&owner_token, "moved@example.com", "a strong password")
        .await;
    let new_code = rig.mailer.latest_code_for("moved@example.com");

    let refused = rig.confirm(&intruder_token, &new_code).await;
    assert_eq!(codes(&refused), vec!["VERIFICATION_TOKEN_INVALID"]);
    assert_eq!(rig.stored_email(owner).await, "a@example.com");

    rig.confirm(&owner_token, &new_code).await;
    rig.confirm(&owner_token, &rig.mailer.latest_code_for("a@example.com"))
        .await;
    assert_eq!(rig.stored_email(owner).await, "moved@example.com");
}
