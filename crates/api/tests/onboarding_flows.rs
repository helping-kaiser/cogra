//! Refusal and repair branches of the staged-applicant flow (auth.md
//! "Account lifecycle"; api-spec "Auth and accounts"): every named
//! refusal of the application submit, link-slot semantics, approval
//! guards, the claim gate, and the reaper.

use std::sync::Mutex;

use chrono::{Duration, Utc};
use common::l1::client::ActorKey;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::{PgPool, auth as store};
use uuid::Uuid;

use api::l1::StandInBoundary;
use api::onboarding::{self, ApplicationInput, Approval, OnboardingConfig, OnboardingError};

#[derive(Default)]
struct SilentMailer(Mutex<Vec<api::mailer::Mail>>);

impl api::mailer::Mailer for SilentMailer {
    fn send(
        &self,
        mail: api::mailer::Mail,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>> {
        Box::pin(async move {
            self.0.lock().expect("mailbox").push(mail);
        })
    }
}

struct Rig {
    pool: PgPool,
    standin: StandIn,
    boundary: StandInBoundary,
    mailer: SilentMailer,
    cfg: OnboardingConfig,
}

impl Rig {
    async fn new(pool: PgPool) -> Self {
        let standin = StandIn::new(pool.clone(), StandInConfig::default());
        Self {
            boundary: StandInBoundary(standin.clone()),
            standin,
            pool,
            mailer: SilentMailer::default(),
            cfg: OnboardingConfig::default(),
        }
    }

    async fn inviter(&self, handle: &str) -> Uuid {
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
        self.standin
            .credit_burn(&key.address(), 10_000_000)
            .await
            .expect("burn");
        id
    }

    async fn link(&self, inviter: Uuid, single_use: bool) -> Uuid {
        store::create_invite_link(
            &self.pool,
            Uuid::new_v4(),
            inviter,
            0.1,
            0.1,
            single_use,
            Utc::now() + Duration::days(1),
        )
        .await
        .expect("link")
        .id
    }

    fn application(&self, link: Uuid, handle: &str, email: &str) -> (ActorKey, ApplicationInput) {
        let key = ActorKey::generate();
        let input = ApplicationInput {
            invite_link: link,
            handle: handle.into(),
            email: email.into(),
            password: "a strong password".into(),
            actor_pubkey: key.public_key_bytes(),
            l0_address: key.address(),
        };
        (key, input)
    }

    async fn submit(&self, input: ApplicationInput) -> Result<String, OnboardingError> {
        onboarding::submit_application(&self.pool, &self.mailer, input)
            .await
            .map(|s| s.applicant_token)
    }

    /// Submits and verifies in one step, returning the applicant token.
    async fn verified_applicant(&self, link: Uuid, handle: &str, email: &str) -> String {
        let (_, input) = self.application(link, handle, email);
        let token = self.submit(input).await.expect("submits");
        let applicant = onboarding::applicant_by_token(&self.pool, &token)
            .await
            .expect("applicant");
        // Verify through the store directly — the mail body is exercised
        // by the e2e test.
        sqlx::query("UPDATE auth_applicants SET email_verified_at = NOW() WHERE id = $1")
            .bind(applicant.id)
            .execute(&self.pool)
            .await
            .expect("verify");
        token
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_application_submit_refuses_each_named_failure(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;

    // Malformed handle, email, and password — pinned BAD_INPUT / WEAK.
    let (_, mut input) = rig.application(link, "x", "a@example.com");
    assert!(matches!(
        rig.submit(input.clone()).await,
        Err(OnboardingError::BadInput {
            field: "handle",
            ..
        })
    ));
    input.handle = "fine_handle".into();
    input.email = "not-an-email".into();
    assert!(matches!(
        rig.submit(input.clone()).await,
        Err(OnboardingError::BadInput { field: "email", .. })
    ));
    input.email = "a@example.com".into();
    input.password = "short".into();
    assert!(matches!(
        rig.submit(input.clone()).await,
        Err(OnboardingError::WeakPassword(_))
    ));

    // A key/address mismatch would fund an address the key cannot spend
    // from — refused before anything is stored.
    input.password = "a strong password".into();
    input.l0_address = "0000000000000000000000000000000000000000".into();
    assert!(matches!(
        rig.submit(input.clone()).await,
        Err(OnboardingError::BadInput {
            field: "l0Address",
            ..
        })
    ));
    input.actor_pubkey = vec![1, 2, 3];
    assert!(matches!(
        rig.submit(input).await,
        Err(OnboardingError::BadInput {
            field: "actorPubkey",
            ..
        })
    ));

    // Unknown, revoked, and expired links are one refusal: unusable.
    let (_, unknown) = rig.application(Uuid::new_v4(), "someone", "s@example.com");
    assert!(matches!(
        rig.submit(unknown).await,
        Err(OnboardingError::InviteUnusable)
    ));
    store::revoke_invite_link(&rig.pool, link, inviter)
        .await
        .expect("revokes");
    let (_, revoked) = rig.application(link, "someone", "s@example.com");
    assert!(matches!(
        rig.submit(revoked).await,
        Err(OnboardingError::InviteUnusable)
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn handles_and_emails_collide_correctly(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;

    // The inviter's own handle is taken (one namespace across kinds).
    let (_, taken) = rig.application(link, "Inviter", "a@example.com");
    assert!(matches!(
        rig.submit(taken).await,
        Err(OnboardingError::HandleTaken)
    ));

    // A live applicant holds their handle and email.
    let (_, first) = rig.application(link, "newbie", "n@example.com");
    rig.submit(first).await.expect("submits");
    let (_, same_handle) = rig.application(link, "newbie", "other@example.com");
    assert!(matches!(
        rig.submit(same_handle).await,
        Err(OnboardingError::HandleTaken)
    ));
    let (_, same_email) = rig.application(link, "different", "n@example.com");
    assert!(matches!(
        rig.submit(same_email).await,
        Err(OnboardingError::ApplicationInProgress)
    ));

    // An expired-but-unswept row is overwritten — the experience never
    // depends on the reaper's schedule.
    sqlx::query("UPDATE auth_applicants SET expires_at = NOW() - INTERVAL '1 hour'")
        .execute(&rig.pool)
        .await
        .expect("expire");
    let (_, resubmit) = rig.application(link, "newbie", "n@example.com");
    rig.submit(resubmit).await.expect("overwrites the corpse");
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_single_use_link_holds_exactly_one_slot(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let single = rig.link(inviter, true).await;

    let (_, first) = rig.application(single, "first", "first@example.com");
    rig.submit(first).await.expect("takes the slot");
    let (_, second) = rig.application(single, "second", "second@example.com");
    assert!(matches!(
        rig.submit(second).await,
        Err(OnboardingError::InviteUnusable)
    ));

    // A multi-use link stages many.
    let multi = rig.link(inviter, false).await;
    let (_, a) = rig.application(multi, "aaa", "aaa@example.com");
    let (_, b) = rig.application(multi, "bbb", "bbb@example.com");
    rig.submit(a).await.expect("stages");
    rig.submit(b).await.expect("stages");
}

#[sqlx::test(migrations = "../../migrations")]
async fn verification_tokens_are_single_purpose_and_expiring(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;
    let (_, input) = rig.application(link, "newbie", "n@example.com");
    rig.submit(input).await.expect("submits");

    // Garbage token: invalid.
    assert!(matches!(
        onboarding::verify_email(&rig.pool, "not-a-token").await,
        Err(OnboardingError::VerificationTokenInvalid)
    ));

    // The real token verifies (read from the captured mail) and extends
    // the application's life to the link's expiry (decision D8).
    let token = {
        let mails = rig.mailer.0.lock().expect("mailbox");
        mails
            .last()
            .expect("mail")
            .body
            .lines()
            .find_map(|l| l.split(": ").nth(1))
            .expect("token")
            .trim()
            .to_string()
    };
    onboarding::verify_email(&rig.pool, &token)
        .await
        .expect("verifies");
    let applicant = store::unverified_applicant_by_email(&rig.pool, "n@example.com")
        .await
        .expect("query");
    assert!(applicant.is_none(), "no longer unverified");
    let link_expiry = store::invite_link(&rig.pool, link)
        .await
        .expect("query")
        .expect("link")
        .expires_at;
    let expires_at: chrono::DateTime<Utc> =
        sqlx::query_scalar("SELECT expires_at FROM auth_applicants WHERE email = 'n@example.com'")
            .fetch_one(&rig.pool)
            .await
            .expect("row");
    assert_eq!(expires_at, link_expiry);

    // A second use of the same token: invalid.
    assert!(matches!(
        onboarding::verify_email(&rig.pool, &token).await,
        Err(OnboardingError::VerificationTokenInvalid)
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn approval_guards_hold(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let stranger = rig.inviter("stranger").await;
    let link = rig.link(inviter, false).await;

    // Unverified applicants cannot be approved.
    let (_, unverified) = rig.application(link, "unverified", "u@example.com");
    let unverified_token = rig.submit(unverified).await.expect("submits");
    let unverified_id = onboarding::applicant_by_token(&rig.pool, &unverified_token)
        .await
        .expect("applicant")
        .id;
    let approval = |id| Approval {
        applicant: id,
        p_d: 0.1,
        p_i: 0.1,
    };
    let refused = onboarding::approve_applicants(
        &rig.pool,
        &rig.boundary,
        &rig.standin,
        &rig.cfg,
        inviter,
        &[approval(unverified_id)],
    )
    .await
    .expect_err("refused");
    assert!(matches!(
        &refused[0].1,
        OnboardingError::BadInput { message, .. } if message.contains("not verified")
    ));

    // A verified applicant approves — but only through their own inviter.
    let token = rig
        .verified_applicant(link, "newbie", "n@example.com")
        .await;
    let applicant_id = onboarding::applicant_by_token(&rig.pool, &token)
        .await
        .expect("applicant")
        .id;
    let foreign = onboarding::approve_applicants(
        &rig.pool,
        &rig.boundary,
        &rig.standin,
        &rig.cfg,
        stranger,
        &[approval(applicant_id)],
    )
    .await
    .expect_err("refused");
    assert!(matches!(
        &foreign[0].1,
        OnboardingError::BadInput { message, .. } if message.contains("unknown applicant")
    ));

    let prepared = onboarding::approve_applicants(
        &rig.pool,
        &rig.boundary,
        &rig.standin,
        &rig.cfg,
        inviter,
        &[approval(applicant_id)],
    )
    .await
    .expect("approves");
    assert_eq!(prepared.len(), 1);

    // A second approval is refused; the funding did not double.
    let again = onboarding::approve_applicants(
        &rig.pool,
        &rig.boundary,
        &rig.standin,
        &rig.cfg,
        inviter,
        &[approval(applicant_id)],
    )
    .await
    .expect_err("refused");
    assert!(matches!(
        &again[0].1,
        OnboardingError::BadInput { message, .. } if message.contains("already approved")
    ));
    let applicant = store::applicant(&rig.pool, applicant_id)
        .await
        .expect("query")
        .expect("row");
    let balance = rig
        .standin
        .balance(&applicant.l0_address)
        .await
        .expect("balance");
    assert_eq!(
        (balance.burned_total * 1e6).round() as i64,
        rig.cfg.admission_burn_micro
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_claim_gate_and_the_reaper_hold(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let auth_cfg = api::auth::AuthConfig::ephemeral().expect("cfg");
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;

    // An unknown applicant token authorizes nothing.
    assert!(matches!(
        onboarding::claim_landed_session(&rig.pool, &auth_cfg, "bogus", None).await,
        Err(OnboardingError::Unauthenticated)
    ));

    // A not-yet-landed application cannot claim a session.
    let token = rig
        .verified_applicant(link, "newbie", "n@example.com")
        .await;
    assert!(matches!(
        onboarding::claim_landed_session(&rig.pool, &auth_cfg, &token, None).await,
        Err(OnboardingError::BadInput { .. })
    ));

    // The reaper sweeps expired never-approved applications and leaves
    // live ones alone.
    let (_, doomed) = rig.application(link, "doomed", "doomed@example.com");
    rig.submit(doomed).await.expect("submits");
    sqlx::query(
        "UPDATE auth_applicants SET expires_at = NOW() - INTERVAL '1 hour'
         WHERE email = 'doomed@example.com'",
    )
    .execute(&rig.pool)
    .await
    .expect("expire");
    assert_eq!(store::reap_applicants(&rig.pool).await.expect("reaps"), 1);
    assert!(
        store::applicant_by_token_hash(&rig.pool, &api::auth::hash_of(&token))
            .await
            .expect("query")
            .is_some(),
        "the live application survives the sweep"
    );
}
