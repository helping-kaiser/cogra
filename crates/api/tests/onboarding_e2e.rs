//! The slice-1 hand test, automated end to end through the real HTTP
//! surface: an invite link taken all the way to a landed, funded actor,
//! and a write signed "from the phone" (roadmap.md Slice 1) — every
//! GraphQL call through the router with real bearer tokens, every
//! signature by the device-side `ActorKey`. Registration creates the
//! account and the session up front; every later step is `me`-driven —
//! no applicant token exists anywhere in this file.

use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::client::ActorKey;
use common::l1::wire;
use http_body_util::BodyExt;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::{PgPool, auth as store};
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

/// Captures outbound mail so the test can read tokens like a user reads
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
    /// The token out of the newest message to `to` — read from the
    /// link's `token=` parameter (auth.md "Link URLs").
    fn latest_token_for(&self, to: &str) -> String {
        let mails = self.0.lock().expect("mailbox");
        let mail = mails
            .iter()
            .rev()
            .find(|m| m.to == to)
            .unwrap_or_else(|| panic!("no mail for {to}"));
        mail.body
            .lines()
            .find_map(|l| l.split("token=").nth(1))
            .expect("token line")
            .trim()
            .to_string()
    }
}

struct Rig {
    app: axum::Router,
    pool: PgPool,
    standin: StandIn,
    mailer: Arc<TestMailer>,
}

impl Rig {
    async fn new(pool: PgPool) -> Self {
        let standin = StandIn::new(pool.clone(), StandInConfig::default());
        let auth = api::auth::AuthConfig::ephemeral().expect("auth config");
        let mailer = Arc::new(TestMailer::default());
        let schema = api::schema::build(api::schema::ApiContext {
            pool: pool.clone(),
            boundary: api::l1::StandInBoundary(standin.clone()),
            funding: standin.clone(),
            auth: auth.clone(),
            mailer: mailer.clone() as Arc<dyn api::mailer::Mailer>,
            web_origin: api::mailer::WebOrigin("http://localhost:3000".into()),
            onboarding: api::onboarding::OnboardingConfig::default(),
        });
        Self {
            app: api::app(schema, auth),
            pool,
            standin,
            mailer,
        }
    }

    /// Executes one GraphQL request through the router, returning the
    /// whole response body — transport errors included.
    async fn gql_raw(&self, token: Option<&str>, query: &str, variables: Value) -> Value {
        let mut builder = Request::builder()
            .method("POST")
            .uri("/graphql")
            .header("content-type", "application/json");
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

    /// A funded member with credentials — the inviter's starting state.
    async fn seed_member(&self, handle: &str, email: &str, password: &str) -> (Uuid, ActorKey) {
        let key = ActorKey::generate();
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
        postgres_store::genesis::insert_credentials(
            &self.pool,
            id,
            email,
            &api::auth::hash_password(password).expect("hash"),
        )
        .await
        .expect("credentials");
        self.standin
            .credit_burn(&key.address(), 10_000_000)
            .await
            .expect("burn");
        (id, key)
    }

    async fn close_and_ingest(&self) {
        self.standin.close_epoch().await.expect("closes");
        api::ingest::ingest_pending(
            &api::l1::StandInBoundary(self.standin.clone()),
            &self.pool,
            8,
        )
        .await
        .expect("ingests");
    }

    /// The device's two signing steps over the writes of a
    /// `PreparePayload`, submitted through the session-authorized relay
    /// mutations — one surface for members and applicants alike.
    async fn sign_prepared(&self, token: &str, key: &ActorKey, writes: &Value) {
        let host_key = self.standin.host_public_key().await.expect("host key");
        for write in writes.as_array().expect("writes") {
            let id = write["id"].as_str().expect("id");
            let proposal = wire::decode_proposal(
                &B64.decode(write["canonicalProposal"].as_str().expect("proposal"))
                    .expect("b64"),
            )
            .expect("decodes");
            let pre = key.pre_sign(proposal);
            let sealed = self
                .gql(
                    Some(token),
                    "mutation($input: SubmitProposalsInput!) {
                       submitProposals(input: $input) {
                         stagedWrites { id verifiedAct } userErrors { code message }
                       }
                     }",
                    json!({ "input": { "proposals": [{
                        "stagedWriteId": id,
                        "signature": B64.encode(wire::encode_pre_commitment_of(&pre)),
                    }]}}),
                )
                .await;
            let staged = &sealed["submitProposals"]["stagedWrites"][0];
            let act = wire::decode_verified_act(
                &B64.decode(staged["verifiedAct"].as_str().expect("sealed"))
                    .expect("b64"),
            )
            .expect("decodes");
            let witness = key.approve(&pre, &act, &host_key).expect("approves");
            let approved = self
                .gql(
                    Some(token),
                    "mutation($input: ApproveActsInput!) {
                       approveActs(input: $input) {
                         stagedWrites { state } userErrors { code message }
                       }
                     }",
                    json!({ "input": { "approvals": [{
                        "stagedWriteId": id,
                        "signature": B64.encode(witness.approval_signature),
                    }]}}),
                )
                .await;
            assert_eq!(
                approved["approveActs"]["stagedWrites"][0]["state"],
                "RELAYING"
            );
        }
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn an_invite_link_becomes_a_landed_funded_reciprocated_member(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (inviter_id, inviter_key) = rig
        .seed_member("inviter", "inviter@example.com", "a strong password")
        .await;

    // The inviter logs in and issues a link.
    let login = rig
        .gql(
            None,
            r#"mutation($input: LogInInput!) {
                 logIn(input: $input) { auth { accessToken } userErrors { code } }
               }"#,
            json!({ "input": { "email": "inviter@example.com", "password": "a strong password" }}),
        )
        .await;
    let inviter_token = login["logIn"]["auth"]["accessToken"]
        .as_str()
        .expect("session")
        .to_string();
    let link = rig
        .gql(
            Some(&inviter_token),
            r#"mutation($input: CreateInviteLinkInput!) {
                 createInviteLink(input: $input) {
                   inviteLink { id } userErrors { code }
                 }
               }"#,
            json!({ "input": {
                "expiresAt": "2027-01-01T00:00:00Z",
                "prefillPDirected": 0.1,
                "prefillPInterest": 0.1,
            }}),
        )
        .await;
    let link_id = link["createInviteLink"]["inviteLink"]["id"]
        .as_str()
        .expect("link")
        .to_string();

    // The applicant's device checks the capability anonymously before
    // the form.
    let check = rig
        .gql(
            None,
            r#"query($id: UUID!) {
                 inviteLinkCheck(id: $id) { usable inviterHandle }
               }"#,
            json!({ "id": link_id }),
        )
        .await;
    assert_eq!(check["inviteLinkCheck"]["usable"], true);
    assert_eq!(check["inviteLinkCheck"]["inviterHandle"], "inviter");

    // Registration creates the account and returns an ordinary session
    // — the person is simply logged in from here on.
    let registered = rig
        .gql(
            None,
            r#"mutation($input: RegisterInput!) {
                 register(input: $input) {
                   auth { accessToken user { id handle } }
                   expiresAt
                   userErrors { code message }
                 }
               }"#,
            json!({ "input": {
                "inviteLink": link_id,
                "handle": "Joiner",
                "email": "joiner@example.com",
                "password": "another strong one",
                "deviceLabel": "test phone",
            }}),
        )
        .await;
    let auth = &registered["register"]["auth"];
    assert_eq!(auth["user"]["handle"], "joiner");
    assert!(registered["register"]["expiresAt"].is_string());
    let joiner_token = auth["accessToken"].as_str().expect("token").to_string();
    let joiner_id: uuid::Uuid = auth["user"]["id"]
        .as_str()
        .expect("id")
        .parse()
        .expect("uuid");

    // The fresh account reads its own state: an applicant, unverified,
    // application pending both proofs.
    let me = rig
        .gql(
            Some(&joiner_token),
            r#"query { me { accountState emailVerified
                 application { emailVerified keyAttached approvedAt } } }"#,
            json!({}),
        )
        .await;
    assert_eq!(me["me"]["accountState"], "APPLICANT");
    assert_eq!(me["me"]["emailVerified"], false);
    assert_eq!(me["me"]["application"]["keyAttached"], false);

    // Acting is member-gated: an applicant preparing a stance is a
    // FORBIDDEN transport fault, not a userError.
    let refused = rig
        .gql_raw(
            Some(&joiner_token),
            r#"mutation($input: PrepareStanceInput!) {
                 prepareStance(input: $input) { userErrors { code } }
               }"#,
            json!({ "input": {
                "target": inviter_id.to_string(),
                "pDirected": 0.5,
                "pInterest": 0.1,
            }}),
        )
        .await;
    assert_eq!(refused["errors"][0]["extensions"]["code"], "FORBIDDEN");

    // Email verification, token read "from the inbox".
    let verification = rig.mailer.latest_token_for("joiner@example.com");
    let verified = rig
        .gql(
            None,
            r#"mutation($input: VerifyEmailInput!) {
                 verifyEmail(input: $input) { ok userErrors { code } }
               }"#,
            json!({ "input": { "verificationToken": verification }}),
        )
        .await;
    assert_eq!(verified["verifyEmail"]["ok"], true);

    // The key ceremony, as a logged-in step: the device mints the key
    // and attaches the public halves — the other approvability proof.
    let joiner_key = ActorKey::generate();
    let attached = rig
        .gql(
            Some(&joiner_token),
            r#"mutation($input: AttachActorKeyInput!) {
                 attachActorKey(input: $input) {
                   user { application { emailVerified keyAttached } }
                   userErrors { code message }
                 }
               }"#,
            json!({ "input": {
                "actorPubkey": B64.encode(joiner_key.public_key_bytes()),
                "l0Address": joiner_key.address(),
            }}),
        )
        .await;
    let proofs = &attached["attachActorKey"]["user"]["application"];
    assert_eq!(proofs["emailVerified"], true);
    assert_eq!(proofs["keyAttached"], true);

    // The inviter sees the application in the approval queue and
    // approves, adjusting the pre-filled stance.
    let queue = rig
        .gql(
            Some(&inviter_token),
            r#"query { me { inviteLinks(first: 10) { edges { node {
                 applications(first: 10) { edges { node {
                   id handle emailVerified keyAttached } } }
               } } } } }"#,
            json!({}),
        )
        .await;
    let application_node =
        &queue["me"]["inviteLinks"]["edges"][0]["node"]["applications"]["edges"][0]["node"];
    assert_eq!(application_node["handle"], "joiner");
    assert_eq!(application_node["emailVerified"], true);
    assert_eq!(application_node["keyAttached"], true);
    let application_id = application_node["id"].as_str().expect("id").to_string();

    let approved = rig
        .gql(
            Some(&inviter_token),
            r#"mutation($input: ApproveApplicantsInput!) {
                 approveApplicants(input: $input) {
                   writes { id family canonicalProposal }
                   userErrors { code message field }
                 }
               }"#,
            json!({ "input": { "approvals": [{
                "application": application_id,
                "pDirected": 0.5,
                "pInterest": 0.2,
            }]}}),
        )
        .await;
    let opinion_writes = &approved["approveApplicants"]["writes"];
    assert_eq!(opinion_writes.as_array().expect("writes").len(), 1);
    assert_eq!(opinion_writes[0]["family"], "OPINION");

    // The funding burn landed on the applicant's own address.
    let funded = rig
        .standin
        .balance(&joiner_key.address())
        .await
        .expect("balance");
    assert!(funded.burned_total > 0.0);

    // The inviter signs their vouch through the generic relay legs.
    rig.sign_prepared(&inviter_token, &inviter_key, opinion_writes)
        .await;

    // The applicant's device signs the staged Registration on next open.
    // The poll is `me`-driven: the application shows approved, and the
    // staged write rides the ordinary staged-write surface.
    let view = rig
        .gql(
            Some(&joiner_token),
            r#"query { me {
                 application { approvedAt landedAt }
                 stagedWrites(first: 5) { edges { node {
                   id state family canonicalProposal } } }
               } }"#,
            json!({}),
        )
        .await;
    assert!(view["me"]["application"]["approvedAt"].is_string());
    assert!(view["me"]["application"]["landedAt"].is_null());
    let staged = &view["me"]["stagedWrites"]["edges"][0]["node"];
    assert_eq!(staged["family"], "REGISTRATION");
    assert_eq!(staged["state"], "AWAITING_PRE_SIGN");
    let registration = wire::decode_proposal(
        &B64.decode(staged["canonicalProposal"].as_str().expect("proposal"))
            .expect("b64"),
    )
    .expect("decodes");
    assert_eq!(registration.body.author, joiner_key.address());
    let registration_writes = json!([{
        "id": staged["id"],
        "canonicalProposal": staged["canonicalProposal"],
    }]);
    rig.sign_prepared(&joiner_token, &joiner_key, &registration_writes)
        .await;

    // Before the epoch closes, the account is still an applicant.
    let early = rig
        .gql(
            Some(&joiner_token),
            r#"query { me { accountState } }"#,
            json!({}),
        )
        .await;
    assert_eq!(early["me"]["accountState"], "APPLICANT");

    // Confirm: the epoch closes, ingestion lands the Registration and
    // the vouch, and landing flips the account to member — nothing
    // moves, nothing is claimed; the session never stopped being an
    // ordinary session.
    rig.close_and_ingest().await;

    let landed = rig
        .gql(
            Some(&joiner_token),
            r#"query { me { accountState handle displayName
                 application { landedAt } } }"#,
            json!({}),
        )
        .await;
    assert_eq!(landed["me"]["accountState"], "MEMBER");
    assert_eq!(landed["me"]["handle"], "joiner");
    assert_eq!(landed["me"]["displayName"], "joiner");
    assert!(landed["me"]["application"]["landedAt"].is_string());

    // Reciprocation — the joiner's own act toward the account that
    // vouched them in, discovered through the viewer's provenance read.
    // The genesis-seeded inviter carries no such trace.
    let provenance = rig
        .gql(
            Some(&joiner_token),
            r#"query { me { invitedBy { id handle } hasReciprocated } }"#,
            json!({}),
        )
        .await;
    assert_eq!(provenance["me"]["invitedBy"]["handle"], "inviter");
    assert_eq!(provenance["me"]["invitedBy"]["id"], inviter_id.to_string());
    // No gesture yet: the prompt-driving field reads false.
    assert_eq!(provenance["me"]["hasReciprocated"], false);
    let inviter_provenance = rig
        .gql(
            Some(&inviter_token),
            r#"query { me { invitedBy { id } hasReciprocated } }"#,
            json!({}),
        )
        .await;
    assert!(inviter_provenance["me"]["invitedBy"].is_null());
    // Vacuously true without an invitedBy trace.
    assert_eq!(inviter_provenance["me"]["hasReciprocated"], true);

    let reciprocation = rig
        .gql(
            Some(&joiner_token),
            r#"mutation($input: PrepareStanceInput!) {
                 prepareStance(input: $input) {
                   writes { id family canonicalProposal } userErrors { code message }
                 }
               }"#,
            json!({ "input": {
                "target": provenance["me"]["invitedBy"]["id"],
                "pDirected": 0.5,
                "pInterest": 0.1,
            }}),
        )
        .await;
    rig.sign_prepared(
        &joiner_token,
        &joiner_key,
        &reciprocation["prepareStance"]["writes"],
    )
    .await;

    // In flight: the staged write answers true, but the latch — the
    // mirror-confirmed cache — is not set yet.
    let in_flight = rig
        .gql(
            Some(&joiner_token),
            r#"query { me { hasReciprocated } }"#,
            json!({}),
        )
        .await;
    assert_eq!(in_flight["me"]["hasReciprocated"], true);
    let unlatched: Option<chrono::DateTime<chrono::Utc>> =
        sqlx::query_scalar("SELECT reciprocated_at FROM auth_applications WHERE account_id = $1")
            .bind(joiner_id)
            .fetch_one(&rig.pool)
            .await
            .expect("latch read");
    assert!(unlatched.is_none());

    rig.close_and_ingest().await;

    // Confirmed: the mirror shows the Opinion, the read latches it on
    // the landed application row, and stays true from the latch alone.
    for _ in 0..2 {
        let confirmed = rig
            .gql(
                Some(&joiner_token),
                r#"query { me { hasReciprocated } }"#,
                json!({}),
            )
            .await;
        assert_eq!(confirmed["me"]["hasReciprocated"], true);
        let latched: Option<chrono::DateTime<chrono::Utc>> = sqlx::query_scalar(
            "SELECT reciprocated_at FROM auth_applications WHERE account_id = $1",
        )
        .bind(joiner_id)
        .fetch_one(&rig.pool)
        .await
        .expect("latch read");
        assert!(latched.is_some());
    }

    // The shared graph now carries the Registration and the mutual
    // Opinion pair; the joiner's act debited their own funded balance.
    let records: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mirror_records")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(records, 3);
    let joiner_balance = rig
        .standin
        .balance(&joiner_key.address())
        .await
        .expect("balance");
    assert_eq!(joiner_balance.action_count, 2);

    // The account's rows are the ones registration created, and the
    // session list shows the registration device.
    let me = rig
        .gql(
            Some(&joiner_token),
            r#"query { me { sessions { deviceLabel isCurrent } stagedWrites(first: 5) {
                 edges { node { state family } } } } }"#,
            json!({}),
        )
        .await;
    assert_eq!(me["me"]["sessions"][0]["deviceLabel"], "test phone");
    assert_eq!(
        me["me"]["stagedWrites"]["edges"][0]["node"]["state"],
        "LANDED"
    );
    let credentials = store::credentials_by_email(&rig.pool, "joiner@example.com")
        .await
        .expect("query")
        .expect("credentials");
    assert_eq!(credentials.account_state, store::AccountState::Member);
    assert_eq!(
        store::actor_identity(&rig.pool, credentials.actor_id)
            .await
            .expect("query")
            .expect("actor")
            .l0_address
            .expect("attached"),
        joiner_key.address()
    );
}
