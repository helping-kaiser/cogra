//! The slice-1 hand test, automated end to end through the real HTTP
//! surface: an invite link taken all the way to a landed, funded actor,
//! and a write signed "from the phone" (roadmap.md Slice 1) — every
//! GraphQL call through the router with real bearer tokens, every
//! signature by the device-side `ActorKey`.

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
    /// The token on the last line-of-interest of the newest message to
    /// `to` — mails carry "…token…: <secret>".
    fn latest_token_for(&self, to: &str) -> String {
        let mails = self.0.lock().expect("mailbox");
        let mail = mails
            .iter()
            .rev()
            .find(|m| m.to == to)
            .unwrap_or_else(|| panic!("no mail for {to}"));
        mail.body
            .lines()
            .find_map(|l| l.split(": ").nth(1))
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
            onboarding: api::onboarding::OnboardingConfig::default(),
        });
        Self {
            app: api::app(schema, auth),
            pool,
            standin,
            mailer,
        }
    }

    /// Executes one GraphQL request through the router, with an optional
    /// bearer token, asserting no transport-tier errors.
    async fn gql(&self, token: Option<&str>, query: &str, variables: Value) -> Value {
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
        let json: Value = serde_json::from_slice(&bytes).expect("json");
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
        sqlx::query(
            "INSERT INTO user_credentials (actor_id, email, password_hash) VALUES ($1, $2, $3)",
        )
        .bind(id)
        .bind(email)
        .bind(api::auth::hash_password(password).expect("hash"))
        .execute(&self.pool)
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
    /// mutations.
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

    // The applicant's key ceremony happens on the device, then the
    // application is submitted with only the public outputs.
    let joiner_key = ActorKey::generate();
    let submitted = rig
        .gql(
            None,
            r#"mutation($input: SubmitApplicationInput!) {
                 submitApplication(input: $input) {
                   applicantToken userErrors { code message }
                 }
               }"#,
            json!({ "input": {
                "inviteLink": link_id,
                "handle": "Joiner",
                "email": "joiner@example.com",
                "password": "another strong one",
                "actorPubkey": B64.encode(joiner_key.public_key_bytes()),
                "l0Address": joiner_key.address(),
            }}),
        )
        .await;
    let applicant_token = submitted["submitApplication"]["applicantToken"]
        .as_str()
        .expect("token")
        .to_string();

    // Email verification, token read "from the inbox".
    let verification = rig.mailer.latest_token_for("joiner@example.com");
    let verified = rig
        .gql(
            None,
            r#"mutation($input: VerifyApplicantEmailInput!) {
                 verifyApplicantEmail(input: $input) { ok userErrors { code } }
               }"#,
            json!({ "input": { "verificationToken": verification }}),
        )
        .await;
    assert_eq!(verified["verifyApplicantEmail"]["ok"], true);

    // The inviter sees the applicant in the approval queue and approves,
    // adjusting the pre-filled stance.
    let queue = rig
        .gql(
            Some(&inviter_token),
            r#"query { me { inviteLinks(first: 10) { edges { node {
                 applicants(first: 10) { edges { node { id handle emailVerified } } }
               } } } } }"#,
            json!({}),
        )
        .await;
    let applicant_node =
        &queue["me"]["inviteLinks"]["edges"][0]["node"]["applicants"]["edges"][0]["node"];
    assert_eq!(applicant_node["handle"], "joiner");
    assert_eq!(applicant_node["emailVerified"], true);
    let applicant_id = applicant_node["id"].as_str().expect("id").to_string();

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
                "applicant": applicant_id,
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

    // The applicant's device signs the staged Registration on next open —
    // pre-commitment, then approval over the host-sealed act.
    let view = rig
        .gql(
            None,
            r#"query($token: String!) {
                 application(applicantToken: $token) {
                   applicant { approvedAt landedAt }
                   stagedRegistration { id state canonicalProposal }
                 }
               }"#,
            json!({ "token": applicant_token }),
        )
        .await;
    let staged = &view["application"]["stagedRegistration"];
    assert_eq!(staged["state"], "AWAITING_PRE_SIGN");
    let registration = wire::decode_proposal(
        &B64.decode(staged["canonicalProposal"].as_str().expect("proposal"))
            .expect("b64"),
    )
    .expect("decodes");
    assert_eq!(registration.body.author, joiner_key.address());
    let pre = joiner_key.pre_sign(registration);
    let sealed = rig
        .gql(
            None,
            r#"mutation($input: SubmitApplicantRegistrationInput!) {
                 submitApplicantRegistration(input: $input) {
                   stagedWrite { state verifiedAct } userErrors { code message }
                 }
               }"#,
            json!({ "input": {
                "applicantToken": applicant_token,
                "signature": B64.encode(wire::encode_pre_commitment_of(&pre)),
            }}),
        )
        .await;
    let sealed_write = &sealed["submitApplicantRegistration"]["stagedWrite"];
    assert_eq!(sealed_write["state"], "AWAITING_APPROVAL");
    let act = wire::decode_verified_act(
        &B64.decode(sealed_write["verifiedAct"].as_str().expect("act"))
            .expect("b64"),
    )
    .expect("decodes");
    let host_key = rig.standin.host_public_key().await.expect("host key");
    let witness = joiner_key.approve(&pre, &act, &host_key).expect("approves");
    let relayed = rig
        .gql(
            None,
            r#"mutation($input: ApproveApplicantRegistrationInput!) {
                 approveApplicantRegistration(input: $input) {
                   stagedWrite { state } userErrors { code message }
                 }
               }"#,
            json!({ "input": {
                "applicantToken": applicant_token,
                "signature": B64.encode(witness.approval_signature),
            }}),
        )
        .await;
    assert_eq!(
        relayed["approveApplicantRegistration"]["stagedWrite"]["state"],
        "RELAYING"
    );

    // Before the epoch closes, the claim reports not-landed.
    let early = rig
        .gql(
            None,
            r#"mutation($input: ClaimLandedSessionInput!) {
                 claimLandedSession(input: $input) { auth { accessToken } userErrors { code } }
               }"#,
            json!({ "input": { "applicantToken": applicant_token }}),
        )
        .await;
    assert_eq!(
        early["claimLandedSession"]["userErrors"][0]["code"],
        "BAD_INPUT"
    );

    // Confirm: the epoch closes, ingestion lands the Registration and the
    // vouch, and landing creates the account.
    rig.close_and_ingest().await;

    let landed_view = rig
        .gql(
            None,
            r#"query($token: String!) {
                 application(applicantToken: $token) { applicant { landedAt } }
               }"#,
            json!({ "token": applicant_token }),
        )
        .await;
    assert!(landed_view["application"]["applicant"]["landedAt"].is_string());

    // First session, then the viewer reads their own account.
    let claimed = rig
        .gql(
            None,
            r#"mutation($input: ClaimLandedSessionInput!) {
                 claimLandedSession(input: $input) {
                   auth { accessToken user { id handle displayName } }
                   userErrors { code }
                 }
               }"#,
            json!({ "input": { "applicantToken": applicant_token, "deviceLabel": "test phone" }}),
        )
        .await;
    let auth = &claimed["claimLandedSession"]["auth"];
    assert_eq!(auth["user"]["handle"], "joiner");
    assert_eq!(auth["user"]["displayName"], "joiner");
    let joiner_token = auth["accessToken"].as_str().expect("token").to_string();

    // Reciprocation — the joiner's own act, completing the mutual pair.
    let reciprocation = rig
        .gql(
            Some(&joiner_token),
            r#"mutation($input: PrepareStanceInput!) {
                 prepareStance(input: $input) {
                   writes { id family canonicalProposal } userErrors { code message }
                 }
               }"#,
            json!({ "input": {
                "target": inviter_id,
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
    rig.close_and_ingest().await;

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

    // The landed account's rows exist and the session list shows the
    // claimed device.
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
    assert_eq!(
        store::actor_identity(&rig.pool, credentials.actor_id)
            .await
            .expect("query")
            .expect("actor")
            .l0_address,
        joiner_key.address()
    );
}
