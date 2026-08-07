//! Refusal and repair branches of the applicant-as-account flow (auth.md
//! "Account lifecycle"; api-spec "Auth and accounts"): every named
//! refusal of the registration form, dead-account replacement, link-slot
//! semantics, the key ceremony's attach guards, approval guards,
//! re-arming, and the reaper.

use std::sync::Mutex;

use chrono::{Duration, Utc};
use common::l1::client::ActorKey;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::{PgPool, auth as store};
use uuid::Uuid;

use api::auth::AuthConfig;
use api::l1::StandInBoundary;
use api::onboarding::{self, Approval, OnboardingConfig, OnboardingError, RegistrationInput};

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
    auth_cfg: AuthConfig,
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
            auth_cfg: AuthConfig::ephemeral().expect("cfg"),
        }
    }

    /// A member with a keyed actor row and burn history — an inviter.
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
        drop(conn);
        postgres_store::genesis::insert_credentials(
            &self.pool,
            id,
            &format!("{handle}@example.com"),
            "$argon2id$fake",
        )
        .await
        .expect("credentials");
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

    fn form(&self, link: Uuid, handle: &str, email: &str) -> RegistrationInput {
        RegistrationInput {
            invite_link: link,
            handle: handle.into(),
            email: email.into(),
            password: "a strong password".into(),
            device_label: None,
        }
    }

    /// Registers, returning the new account's id.
    async fn register(&self, input: RegistrationInput) -> Result<Uuid, OnboardingError> {
        onboarding::register(
            &self.pool,
            &self.auth_cfg,
            &self.mailer,
            &api::breach::DisabledCorpus,
            "http://localhost:3000",
            input,
        )
        .await
        .map(|r| r.session.user_id)
    }

    /// Marks the account's email verified through the store directly —
    /// the mail body is exercised by its own test and the e2e.
    async fn verify_directly(&self, account: Uuid) {
        sqlx::query("UPDATE user_credentials SET email_verified_at = NOW() WHERE actor_id = $1")
            .bind(account)
            .execute(&self.pool)
            .await
            .expect("verify");
    }

    /// Registers, verifies, and runs the key ceremony's attach.
    async fn ceremony_done_account(&self, link: Uuid, handle: &str, email: &str) -> Uuid {
        let account = self
            .register(self.form(link, handle, email))
            .await
            .expect("registers");
        self.verify_directly(account).await;
        let key = ActorKey::generate();
        onboarding::attach_actor_key(&self.pool, account, key.public_key_bytes(), key.address())
            .await
            .expect("attaches");
        account
    }

    async fn application_of(&self, account: Uuid) -> store::Application {
        store::latest_application_for(&self.pool, account)
            .await
            .expect("query")
            .expect("application")
    }
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_registration_form_refuses_each_named_failure(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;

    // Malformed handle, email, and password — pinned BAD_INPUT / WEAK.
    let mut input = rig.form(link, "x", "a@example.com");
    assert!(matches!(
        rig.register(input.clone()).await,
        Err(OnboardingError::BadInput {
            field: "handle",
            ..
        })
    ));
    input.handle = "fine_handle".into();
    input.email = "not-an-email".into();
    assert!(matches!(
        rig.register(input.clone()).await,
        Err(OnboardingError::BadInput { field: "email", .. })
    ));
    input.email = "a@example.com".into();
    input.password = "short".into();
    assert!(matches!(
        rig.register(input).await,
        Err(OnboardingError::WeakPassword(_))
    ));

    // A breached password refuses at the form with the reason — the
    // corpus answer, not the floor, drives the message (auth.md
    // "Password requirements").
    struct AlwaysBreached;
    impl api::breach::BreachCorpus for AlwaysBreached {
        fn is_breached<'a>(
            &'a self,
            _password: &'a str,
        ) -> std::pin::Pin<
            Box<
                dyn std::future::Future<Output = Result<bool, api::breach::BreachError>>
                    + Send
                    + 'a,
            >,
        > {
            Box::pin(async { Ok(true) })
        }
    }
    match onboarding::register(
        &rig.pool,
        &rig.auth_cfg,
        &rig.mailer,
        &AlwaysBreached,
        "http://localhost:3000",
        rig.form(link, "fine_handle", "a@example.com"),
    )
    .await
    {
        Err(OnboardingError::WeakPassword(m)) => {
            assert!(m.contains("breach"), "the reason names the breach: {m}")
        }
        Err(other) => panic!("expected WeakPassword, got {other:?}"),
        Ok(_) => panic!("a breached password must refuse"),
    }

    // Unknown, revoked, and expired links are one refusal: unusable.
    let unknown = rig.form(Uuid::new_v4(), "someone", "s@example.com");
    assert!(matches!(
        rig.register(unknown).await,
        Err(OnboardingError::InviteUnusable)
    ));
    store::revoke_invite_link(&rig.pool, link, inviter)
        .await
        .expect("revokes");
    let revoked = rig.form(link, "someone", "s@example.com");
    assert!(matches!(
        rig.register(revoked).await,
        Err(OnboardingError::InviteUnusable)
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn handles_and_emails_collide_at_the_form(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;

    // The inviter's own handle is taken (one namespace across kinds).
    let taken = rig.form(link, "Inviter", "a@example.com");
    assert!(matches!(
        rig.register(taken).await,
        Err(OnboardingError::HandleTaken)
    ));

    // A live account holds its handle and email.
    rig.register(rig.form(link, "newbie", "n@example.com"))
        .await
        .expect("registers");
    assert!(matches!(
        rig.register(rig.form(link, "newbie", "other@example.com"))
            .await,
        Err(OnboardingError::HandleTaken)
    ));
    assert!(matches!(
        rig.register(rig.form(link, "different", "n@example.com"))
            .await,
        Err(OnboardingError::EmailInUse)
    ));

    // A dead account — never verified, past its bound — is replaced in
    // place: the experience never depends on the reaper's schedule
    // (auth.md "Registration collision").
    sqlx::query("UPDATE user_credentials SET created_at = NOW() - INTERVAL '25 hours'")
        .execute(&rig.pool)
        .await
        .expect("age");
    rig.register(rig.form(link, "newbie", "n@example.com"))
        .await
        .expect("replaces the corpse");
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_single_use_link_holds_exactly_one_slot(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let single = rig.link(inviter, true).await;

    rig.register(rig.form(single, "first", "first@example.com"))
        .await
        .expect("takes the slot");
    assert!(matches!(
        rig.register(rig.form(single, "second", "second@example.com"))
            .await,
        Err(OnboardingError::InviteUnusable)
    ));

    // A multi-use link registers many.
    let multi = rig.link(inviter, false).await;
    rig.register(rig.form(multi, "aaa", "aaa@example.com"))
        .await
        .expect("registers");
    rig.register(rig.form(multi, "bbb", "bbb@example.com"))
        .await
        .expect("registers");
}

#[sqlx::test(migrations = "../../migrations")]
async fn verification_tokens_are_single_purpose(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;
    rig.register(rig.form(link, "newbie", "n@example.com"))
        .await
        .expect("registers");

    // Garbage token: invalid.
    assert!(matches!(
        onboarding::verify_email(&rig.pool, "not-a-token").await,
        Err(OnboardingError::VerificationTokenInvalid)
    ));

    // The real token verifies (read from the captured mail, whose body
    // carries the web link URL per auth.md "Link URLs").
    let token = {
        let mails = rig.mailer.0.lock().expect("mailbox");
        let body = &mails.last().expect("mail").body;
        assert!(
            body.contains("/verify?token="),
            "verification mail must carry the link URL"
        );
        body.lines()
            .find_map(|l| l.split("token=").nth(1))
            .expect("token")
            .trim()
            .to_string()
    };
    onboarding::verify_email(&rig.pool, &token)
        .await
        .expect("verifies");
    let resend_target = store::unverified_account_by_email(
        &rig.pool,
        "n@example.com",
        Utc::now() - Duration::hours(24),
    )
    .await
    .expect("query");
    assert!(resend_target.is_none(), "no longer unverified");

    // A second use of the same token: invalid.
    assert!(matches!(
        onboarding::verify_email(&rig.pool, &token).await,
        Err(OnboardingError::VerificationTokenInvalid)
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_attach_guards_hold(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;
    let account = rig
        .register(rig.form(link, "newbie", "n@example.com"))
        .await
        .expect("registers");
    rig.verify_directly(account).await;

    // The ceremony's outputs must cohere: a garbage key and a foreign
    // address both refuse before anything is stored.
    let key = ActorKey::generate();
    assert!(matches!(
        onboarding::attach_actor_key(&rig.pool, account, vec![1, 2, 3], key.address()).await,
        Err(OnboardingError::BadInput {
            field: "actorPubkey",
            ..
        })
    ));
    assert!(matches!(
        onboarding::attach_actor_key(
            &rig.pool,
            account,
            key.public_key_bytes(),
            "0000000000000000000000000000000000000000".into(),
        )
        .await,
        Err(OnboardingError::BadInput {
            field: "l0Address",
            ..
        })
    ));

    // Attach, then replace — a device lost before approval costs
    // nothing but a re-run of the ceremony.
    onboarding::attach_actor_key(&rig.pool, account, key.public_key_bytes(), key.address())
        .await
        .expect("attaches");
    let replacement = ActorKey::generate();
    onboarding::attach_actor_key(
        &rig.pool,
        account,
        replacement.public_key_bytes(),
        replacement.address(),
    )
    .await
    .expect("replaces");

    // Re-attaching the account's own current key is the crash-healing
    // repair path — never a conflict with itself.
    onboarding::attach_actor_key(
        &rig.pool,
        account,
        replacement.public_key_bytes(),
        replacement.address(),
    )
    .await
    .expect("repairs");

    // A member account cannot attach — the genesis path owns its key.
    let member_key = ActorKey::generate();
    assert!(matches!(
        onboarding::attach_actor_key(
            &rig.pool,
            inviter,
            member_key.public_key_bytes(),
            member_key.address(),
        )
        .await,
        Err(OnboardingError::Forbidden)
    ));

    // Approval binds the address: the attach is immutable from then on.
    let application = rig.application_of(account).await;
    onboarding::approve_applicants(
        &rig.pool,
        &rig.boundary,
        &rig.standin,
        &rig.cfg,
        inviter,
        &[Approval {
            application: application.id,
            p_d: 0.1,
            p_i: 0.1,
        }],
    )
    .await
    .expect("approves");
    let late = ActorKey::generate();
    assert!(matches!(
        onboarding::attach_actor_key(&rig.pool, account, late.public_key_bytes(), late.address())
            .await,
        Err(OnboardingError::Forbidden)
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_attach_refuses_a_key_bound_elsewhere(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;

    // First applicant lands their key.
    let first_key = ActorKey::generate();
    let first = rig
        .register(rig.form(link, "first", "first@example.com"))
        .await
        .expect("registers");
    rig.verify_directly(first).await;
    onboarding::attach_actor_key(
        &rig.pool,
        first,
        first_key.public_key_bytes(),
        first_key.address(),
    )
    .await
    .expect("attaches");

    // A second account attaching the same key: an address binds at most
    // one account (auth.md §Application) — refused, and refused again on
    // retry (the silent repair-attach path a shared device runs into).
    let second = rig
        .register(rig.form(link, "second", "second@example.com"))
        .await
        .expect("registers");
    rig.verify_directly(second).await;
    for _ in 0..2 {
        assert!(matches!(
            onboarding::attach_actor_key(
                &rig.pool,
                second,
                first_key.public_key_bytes(),
                first_key.address(),
            )
            .await,
            Err(OnboardingError::ActorKeyInUse)
        ));
    }

    // A member's key is just as bound as an applicant's.
    let (inviter_pubkey, inviter_address) = sqlx::query_as::<_, (Vec<u8>, String)>(
        "SELECT actor_pubkey, l0_address FROM actors WHERE id = $1",
    )
    .bind(inviter)
    .fetch_one(&rig.pool)
    .await
    .expect("inviter row");
    assert_eq!(
        store::attach_actor_key(&rig.pool, second, &inviter_pubkey, &inviter_address)
            .await
            .expect("query"),
        store::AttachOutcome::KeyInUse
    );

    // The address index holds on its own: a fresh key paired with the
    // first account's address (only reachable below the derivation
    // check) is still refused.
    let fresh = ActorKey::generate();
    assert_eq!(
        store::attach_actor_key(
            &rig.pool,
            second,
            &fresh.public_key_bytes(),
            &first_key.address(),
        )
        .await
        .expect("query"),
        store::AttachOutcome::KeyInUse
    );

    // The refusal left nothing behind; the second account's own key
    // attaches cleanly, and the first account is untouched.
    let second_key = ActorKey::generate();
    onboarding::attach_actor_key(
        &rig.pool,
        second,
        second_key.public_key_bytes(),
        second_key.address(),
    )
    .await
    .expect("attaches its own");
    let first_address =
        sqlx::query_scalar::<_, String>("SELECT l0_address FROM actors WHERE id = $1")
            .bind(first)
            .fetch_one(&rig.pool)
            .await
            .expect("first row");
    assert_eq!(first_address, first_key.address());
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_reciprocation_latch_waits_for_landing(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;
    let account = rig
        .register(rig.form(link, "newbie", "n@example.com"))
        .await
        .expect("registers");

    // No landed application: nothing latched, nothing to latch — the
    // update's landed_at guard refuses (auth.md "Reciprocation is the
    // joiner's own act": the latch lives on the landed row).
    assert!(
        !store::reciprocation_latched(&rig.pool, account)
            .await
            .expect("query")
    );
    assert!(
        !store::latch_reciprocated(&rig.pool, account)
            .await
            .expect("update")
    );

    // An account with no application trace at all behaves the same.
    assert!(
        !store::reciprocation_latched(&rig.pool, inviter)
            .await
            .expect("query")
    );
    assert!(
        !store::latch_reciprocated(&rig.pool, inviter)
            .await
            .expect("update")
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn approval_guards_hold(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let stranger = rig.inviter("stranger").await;
    let link = rig.link(inviter, false).await;
    async fn approve(
        rig: &Rig,
        who: Uuid,
        id: Uuid,
    ) -> Result<usize, Vec<(usize, OnboardingError)>> {
        onboarding::approve_applicants(
            &rig.pool,
            &rig.boundary,
            &rig.standin,
            &rig.cfg,
            who,
            &[Approval {
                application: id,
                p_d: 0.1,
                p_i: 0.1,
            }],
        )
        .await
        .map(|prepared| prepared.len())
    }

    // An unverified account cannot be approved.
    let unverified = rig
        .register(rig.form(link, "unverified", "u@example.com"))
        .await
        .expect("registers");
    let unverified_app = rig.application_of(unverified).await;
    let refused = approve(&rig, inviter, unverified_app.id)
        .await
        .expect_err("refused");
    assert!(matches!(
        &refused[0].1,
        OnboardingError::BadInput { message, .. } if message.contains("not verified")
    ));

    // Verified but keyless: the other approvability proof is missing.
    let keyless = rig
        .register(rig.form(link, "keyless", "k@example.com"))
        .await
        .expect("registers");
    rig.verify_directly(keyless).await;
    let keyless_app = rig.application_of(keyless).await;
    let refused = approve(&rig, inviter, keyless_app.id)
        .await
        .expect_err("refused");
    assert!(matches!(
        &refused[0].1,
        OnboardingError::BadInput { message, .. } if message.contains("no key attached")
    ));

    // Both proofs held — but only the issuing inviter may approve.
    let ready = rig
        .ceremony_done_account(link, "newbie", "n@example.com")
        .await;
    let application = rig.application_of(ready).await;
    let foreign = approve(&rig, stranger, application.id)
        .await
        .expect_err("refused");
    assert!(matches!(
        &foreign[0].1,
        OnboardingError::BadInput { message, .. } if message.contains("unknown application")
    ));

    let prepared = approve(&rig, inviter, application.id)
        .await
        .expect("approves");
    assert_eq!(prepared, 1);

    // A second approval is refused; the funding did not double.
    let again = approve(&rig, inviter, application.id)
        .await
        .expect_err("refused");
    assert!(matches!(
        &again[0].1,
        OnboardingError::BadInput { message, .. } if message.contains("already approved")
    ));
    let address = store::actor_identity(&rig.pool, ready)
        .await
        .expect("query")
        .expect("actor")
        .l0_address
        .expect("attached");
    let balance = rig.standin.balance(&address).await.expect("balance");
    assert_eq!(
        (balance.burned_total * 1e6).round() as i64,
        rig.cfg.admission_burn_micro
    );
}

#[sqlx::test(migrations = "../../migrations")]
async fn a_fresh_invite_rearms_an_expired_application(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;
    let account = rig
        .register(rig.form(link, "newbie", "n@example.com"))
        .await
        .expect("registers");
    rig.verify_directly(account).await;

    // While the application is live, re-arming refuses.
    assert!(matches!(
        onboarding::apply_with_invite(&rig.pool, account, link).await,
        Err(OnboardingError::BadInput { .. })
    ));

    // Expired and never approved: a fresh link re-arms with a new row,
    // without touching the account.
    sqlx::query("UPDATE auth_applications SET expires_at = NOW() - INTERVAL '1 hour'")
        .execute(&rig.pool)
        .await
        .expect("expire");
    let fresh_link = rig.link(inviter, false).await;
    let rearmed = onboarding::apply_with_invite(&rig.pool, account, fresh_link)
        .await
        .expect("re-arms");
    assert_eq!(rearmed.account_id, account);
    assert_eq!(rearmed.invite_link_id, fresh_link);

    // A member account cannot apply.
    assert!(matches!(
        onboarding::apply_with_invite(&rig.pool, inviter, fresh_link).await,
        Err(OnboardingError::Forbidden)
    ));
}

#[sqlx::test(migrations = "../../migrations")]
async fn the_reaper_deletes_only_never_verified_accounts(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let inviter = rig.inviter("inviter").await;
    let link = rig.link(inviter, false).await;

    let doomed = rig
        .register(rig.form(link, "doomed", "doomed@example.com"))
        .await
        .expect("registers");
    let survivor = rig
        .register(rig.form(link, "survivor", "s@example.com"))
        .await
        .expect("registers");
    rig.verify_directly(survivor).await;

    // Both past the bound — only the never-verified account is dead.
    sqlx::query("UPDATE user_credentials SET created_at = NOW() - INTERVAL '25 hours'")
        .execute(&rig.pool)
        .await
        .expect("age");
    let swept = store::reap_unverified_accounts(&rig.pool, Utc::now() - Duration::hours(24))
        .await
        .expect("reaps");
    assert_eq!(swept, 1);
    assert!(
        store::actor_identity(&rig.pool, doomed)
            .await
            .expect("query")
            .is_none(),
        "the dead account is gone whole — handle and email freed"
    );
    assert!(
        store::actor_identity(&rig.pool, survivor)
            .await
            .expect("query")
            .is_some(),
        "a verified account is never reaped"
    );
    assert!(
        rig.application_of(survivor).await.landed_at.is_none(),
        "the surviving application rides the account untouched"
    );
}
