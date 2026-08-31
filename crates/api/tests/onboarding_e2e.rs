//! The slice-1 hand test, automated end to end through the real HTTP
//! surface: an invite link taken all the way to a landed, funded actor,
//! and a write signed "from the phone" (roadmap.md Slice 1) — every
//! GraphQL call through the router with real bearer tokens, every
//! signature by the device-side `ActorKey`. Registration creates the
//! account and the session up front; every later step is `me`-driven —
//! no applicant token exists anywhere in this file.

use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::client::ActorKey;
use common::l1::wire;
use http_body_util::BodyExt;
use l1_standin::StandIn;
use postgres_store::{PgPool, auth as store};
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

mod rig;
use rig::TestMailer;

struct Rig {
    app: axum::Router,
    pool: PgPool,
    standin: StandIn,
    mailer: Arc<TestMailer>,
}

impl Rig {
    async fn new(pool: PgPool) -> Self {
        let mailer = Arc::new(TestMailer::default());
        let (app, standin) = rig::connect_info_app_with_standin(
            pool.clone(),
            mailer.clone(),
            api::ratelimit::RateLimitConfig::unlimited(),
        );
        Self {
            app,
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
        serde_json::from_slice(&bytes).unwrap_or_else(|e| {
            panic!(
                "non-JSON response ({e}): {}",
                String::from_utf8_lossy(&bytes)
            )
        })
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
        let outcome = api::ingest::ingest_pending(
            &api::l1::StandInBoundary(self.standin.clone()),
            &self.pool,
            8,
        )
        .await
        .expect("ingests");
        assert!(
            outcome.promotion_failures.is_empty(),
            "confirm-side promotion failed: {:?}",
            outcome.promotion_failures
        );
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

/// The whole admission arc, through the real HTTP surface: the inviter
/// logs in and issues a link; the applicant's device checks the
/// capability anonymously before the form; registration creates the
/// account and returns an ordinary session, so the person is simply
/// logged in from there on.
///
/// The fresh account reads its own state — applicant, unverified,
/// application pending both proofs — and acting is member-gated, so an
/// applicant preparing a stance is a FORBIDDEN transport fault rather
/// than a userError. The two proofs then land: email verification with
/// the token read "from the inbox", and the key ceremony as a logged-in
/// step where the device mints the key and attaches the public halves.
///
/// The inviter approves from the queue, adjusting the pre-filled stance;
/// the funding burn lands on the applicant's own address; the inviter
/// signs their vouch through the generic relay legs, and the applicant's
/// device signs the staged Registration on next open, discovering it
/// through a `me`-driven poll and the ordinary staged-write surface.
/// Until the epoch closes the account is still an applicant. Confirmation
/// is the epoch close plus ingestion: landing flips the account to
/// member, and nothing moves and nothing is claimed — the session never
/// stopped being an ordinary session.
///
/// Reciprocation is then the joiner's own act toward the account that
/// vouched them in, discovered through the viewer's provenance read (the
/// genesis-seeded inviter carries no such trace, so the field is
/// vacuously true there). The prompt-driving field reads false before any
/// gesture, true from the staged write while the act is in flight — the
/// latch, being the mirror-confirmed cache, is not set yet — and once the
/// mirror shows the Opinion the read latches it onto the landed
/// application row and stays true from the latch alone.
///
/// At the end the shared graph carries the Registration and the mutual
/// Opinion pair, the joiner's act has debited their own funded balance,
/// and the account's rows are the ones registration created, with the
/// session list showing the registration device.
///
/// The whole admission arc holds through the real HTTP surface: a link becomes an account, two proofs, an approval, a funded burn, a landed Registration and a reciprocating act, with nothing but ordinary sessions throughout.
/// ´claim:onboarding:the-admission-arc-holds-end-to-end´
#[sqlx::test(migrations = "../../migrations")]
async fn an_invite_link_becomes_a_landed_funded_reciprocated_member(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (inviter_id, inviter_key) = rig
        .seed_member("inviter", "inviter@example.com", "a strong password")
        .await;

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

    let funded = rig
        .standin
        .balance(&joiner_key.address())
        .await
        .expect("balance");
    assert!(funded.burned_total > 0.0);

    rig.sign_prepared(&inviter_token, &inviter_key, opinion_writes)
        .await;

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

    let early = rig
        .gql(
            Some(&joiner_token),
            r#"query { me { accountState } }"#,
            json!({}),
        )
        .await;
    assert_eq!(early["me"]["accountState"], "APPLICANT");

    rig.close_and_ingest().await;

    let landed = rig
        .gql(
            Some(&joiner_token),
            r#"query { me { accountState handle displayName { value status }
                 application { landedAt } } }"#,
            json!({}),
        )
        .await;
    assert_eq!(landed["me"]["accountState"], "MEMBER");
    assert_eq!(landed["me"]["handle"], "joiner");
    assert_eq!(landed["me"]["displayName"]["value"], "joiner");
    assert_eq!(landed["me"]["displayName"]["status"], "NORMAL");
    assert!(landed["me"]["application"]["landedAt"].is_string());

    let provenance = rig
        .gql(
            Some(&joiner_token),
            r#"query { me { invitedBy { id handle } hasReciprocated } }"#,
            json!({}),
        )
        .await;
    assert_eq!(provenance["me"]["invitedBy"]["handle"], "inviter");
    assert_eq!(provenance["me"]["invitedBy"]["id"], inviter_id.to_string());
    assert_eq!(provenance["me"]["hasReciprocated"], false);
    let inviter_provenance = rig
        .gql(
            Some(&inviter_token),
            r#"query { me { invitedBy { id } hasReciprocated } }"#,
            json!({}),
        )
        .await;
    assert!(inviter_provenance["me"]["invitedBy"].is_null());
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

/// The attached-identity read (roadmap.md slice 1.1): `actorPubkey` /
/// `l0Address` carry the account's own attached key for its viewer,
/// null before the ceremony — and never resolve for anyone else, keyed
/// key or not.
///
/// An account's attached key reads for its own viewer alone, null before the ceremony and absent for everyone else.
/// ´claim:onboarding:the-attached-key-reads-for-its-viewer-only´
#[sqlx::test(migrations = "../../migrations")]
async fn the_attached_key_reads_for_its_viewer_only(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (_, inviter_key) = rig
        .seed_member("inviter", "inviter@example.com", "inviter password")
        .await;

    let login = rig
        .gql(
            None,
            "mutation($input: LogInInput!) {
                logIn(input: $input) { auth { accessToken } userErrors { code } }
            }",
            json!({ "input": { "email": "inviter@example.com", "password": "inviter password" } }),
        )
        .await;
    let inviter_token = login["logIn"]["auth"]["accessToken"]
        .as_str()
        .expect("session")
        .to_string();

    let me = rig
        .gql(
            Some(&inviter_token),
            "{ me { actorPubkey l0Address } }",
            json!({}),
        )
        .await;
    assert_eq!(
        me["me"]["actorPubkey"].as_str().expect("pubkey"),
        B64.encode(inviter_key.public_key_bytes())
    );
    assert_eq!(
        me["me"]["l0Address"].as_str().expect("address"),
        inviter_key.address()
    );

    let link = rig
        .gql(
            Some(&inviter_token),
            "mutation($input: CreateInviteLinkInput!) {
                createInviteLink(input: $input) { inviteLink { id } userErrors { code } }
            }",
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
    let registered = rig
        .gql(
            None,
            "mutation($input: RegisterInput!) {
                register(input: $input) { auth { accessToken } userErrors { code } }
            }",
            json!({ "input": {
                "inviteLink": link_id,
                "handle": "joiner",
                "email": "joiner@example.com",
                "password": "a strong password",
            }}),
        )
        .await;
    let joiner_token = registered["register"]["auth"]["accessToken"]
        .as_str()
        .expect("session")
        .to_string();
    let me = rig
        .gql(
            Some(&joiner_token),
            "{ me { actorPubkey l0Address invitedBy { ... on User { actorPubkey l0Address } } } }",
            json!({}),
        )
        .await;
    assert!(
        me["me"]["actorPubkey"].is_null(),
        "no key before the ceremony"
    );
    assert!(me["me"]["l0Address"].is_null());
    assert!(me["me"]["invitedBy"]["actorPubkey"].is_null());
    assert!(me["me"]["invitedBy"]["l0Address"].is_null());
}
