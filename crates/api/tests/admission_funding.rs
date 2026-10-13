//! The admission burn behind the seam (auth.md "Funding"): the address-
//! keyed funding guard, the burn requested across the seam and settling
//! asynchronously, the admission Registration's approval leg held until
//! it settles, the voucher's funding budget, and the key binding the
//! funding makes.
//!
//! Every double-fund case runs against the stand-in's own record of
//! burns (`l1_admission_burns`), so "burned once" is the realization's
//! count, not CoGra's belief. The pending-window cases run with a
//! settlement delay above zero — the window a real settling realization
//! opens and the default stand-in closes.
//!
//! Paths beyond the registration path are staged the way they come to
//! exist: a second member takes the account up from its ask link
//! (`stageApplicant`).

use std::sync::Arc;
use std::sync::Mutex;
use std::sync::atomic::{AtomicUsize, Ordering};

use chrono::{Duration, Utc};
use common::l1::census::Family;
use common::l1::client::ActorKey;
use common::l1::encoding::Encoder;
use common::l1::handshake::{
    AccountBalance, ApprovalWitness, BurnSettlement, BurnTicket, EpochPackage, PreSignedProposal,
    Proposal, StructuralBody, VerifiedAct,
};
use common::l1::identifier::NodeId;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::staged::{self, PreSignedParts, StagedState};
use postgres_store::{PgPool, auth as store};
use uuid::Uuid;

use api::auth::AuthConfig;
use api::l1::{BoundaryError, L1Boundary, StandInBoundary};
use api::onboarding::{self, Approval, OnboardingConfig, OnboardingError, RegistrationInput};
use api::ratelimit::{SigningBudget, Window};

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

/// A realization that can be told to drop burn requests or to refuse
/// burns for good — the failures the stand-in itself never produces.
#[derive(Clone)]
struct Realization {
    inner: StandInBoundary,
    /// The next this-many burn requests fail as a transport error.
    failing_requests: Arc<AtomicUsize>,
    /// Every settlement read answers Failed with this reason.
    refusal: Option<String>,
}

impl L1Boundary for Realization {
    async fn seal(&self, pre: PreSignedProposal) -> Result<VerifiedAct, BoundaryError> {
        self.inner.seal(pre).await
    }

    async fn approve(&self, witness: ApprovalWitness) -> Result<(), BoundaryError> {
        self.inner.approve(witness).await
    }

    async fn epochs_since(&self, after: i64) -> Result<Vec<EpochPackage>, BoundaryError> {
        self.inner.epochs_since(after).await
    }

    async fn balance(&self, address: &str) -> Result<AccountBalance, BoundaryError> {
        self.inner.balance(address).await
    }

    async fn host_public_key(&self) -> Result<Vec<u8>, BoundaryError> {
        self.inner.host_public_key().await
    }

    async fn current_theta(&self) -> Result<f64, BoundaryError> {
        self.inner.current_theta().await
    }

    async fn max_payload_bytes(&self) -> Result<usize, BoundaryError> {
        self.inner.max_payload_bytes().await
    }

    async fn request_admission_burn(
        &self,
        address: &str,
        amount_micro: i64,
        key: Uuid,
    ) -> Result<BurnTicket, BoundaryError> {
        if self
            .failing_requests
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |n| n.checked_sub(1))
            .is_ok()
        {
            return Err(BoundaryError::Substrate("realization unreachable".into()));
        }
        self.inner
            .request_admission_burn(address, amount_micro, key)
            .await
    }

    async fn burn_settlement(&self, ticket: &BurnTicket) -> Result<BurnSettlement, BoundaryError> {
        match &self.refusal {
            Some(reason) => Ok(BurnSettlement::Failed(reason.clone())),
            None => self.inner.burn_settlement(ticket).await,
        }
    }
}

struct Rig {
    pool: PgPool,
    standin: StandIn,
    realization: Realization,
    mailer: SilentMailer,
    cfg: OnboardingConfig,
    auth_cfg: AuthConfig,
}

/// An applicant through the key ceremony, with the device key the
/// Registration is signed with.
struct Applicant {
    account: Uuid,
    key: ActorKey,
}

impl Rig {
    /// A rig whose admission burns settle after `delay` epoch closes.
    async fn settling_after(pool: PgPool, delay: i64) -> Self {
        let standin = StandIn::new(
            pool.clone(),
            StandInConfig::default()
                .settling_after(delay)
                .expect("config"),
        );
        Self {
            realization: Realization {
                inner: StandInBoundary(standin.clone()),
                failing_requests: Arc::new(AtomicUsize::new(0)),
                refusal: None,
            },
            standin,
            pool,
            mailer: SilentMailer::default(),
            cfg: OnboardingConfig::default(),
            auth_cfg: AuthConfig::ephemeral().expect("cfg"),
        }
    }

    async fn new(pool: PgPool) -> Self {
        Self::settling_after(pool, 0).await
    }

    /// A member with a keyed actor row and burn history — an inviter.
    async fn inviter(&self, handle: &str) -> (Uuid, ActorKey) {
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
        (id, key)
    }

    async fn link(&self, inviter: Uuid) -> Uuid {
        store::create_invite_link(
            &self.pool,
            Uuid::new_v4(),
            inviter,
            false,
            Utc::now() + Duration::days(1),
        )
        .await
        .expect("link")
        .id
    }

    /// Registers through `link`, verifies, and attaches a fresh key.
    async fn applicant(&self, link: Uuid, handle: &str) -> Applicant {
        let key = ActorKey::generate();
        let account = self.applicant_with_key(link, handle, &key).await;
        Applicant { account, key }
    }

    async fn applicant_with_key(&self, link: Uuid, handle: &str, key: &ActorKey) -> Uuid {
        let account = onboarding::register(
            &self.pool,
            &self.auth_cfg,
            &self.mailer,
            &api::breach::DisabledCorpus,
            "http://localhost:3000",
            RegistrationInput {
                invite_link: link,
                handle: handle.into(),
                email: format!("{handle}@example.com"),
                password: "a strong password".into(),
                device_label: None,
            },
        )
        .await
        .expect("registers")
        .session
        .user_id;
        sqlx::query("UPDATE user_credentials SET email_verified_at = NOW() WHERE actor_id = $1")
            .bind(account)
            .execute(&self.pool)
            .await
            .expect("verify");
        onboarding::attach_actor_key(&self.pool, account, key.public_key_bytes(), key.address())
            .await
            .expect("attaches");
        account
    }

    /// A second path of `account` in `inviter`'s queue: `inviter` takes
    /// the account up from its ask link (module docs).
    async fn second_path(&self, account: Uuid, inviter: Uuid) -> Uuid {
        let ask_link = store::ask_link_of(&self.pool, account)
            .await
            .expect("ask link read")
            .expect("an applicant has an ask link");
        onboarding::stage_applicant(&self.pool, inviter, ask_link)
            .await
            .expect("second path")
            .id
    }

    async fn registration_path(&self, account: Uuid) -> Uuid {
        sqlx::query_scalar(
            "SELECT id FROM auth_applications WHERE account_id = $1 ORDER BY created_at LIMIT 1",
        )
        .bind(account)
        .fetch_one(&self.pool)
        .await
        .expect("path")
    }

    async fn approve(
        &self,
        budget: &SigningBudget,
        inviter: Uuid,
        paths: &[Uuid],
    ) -> Result<Vec<api::prepare::Prepared>, Vec<onboarding::ApprovalFault>> {
        let approvals: Vec<Approval> = paths
            .iter()
            .map(|&application| Approval {
                application,
                p_d: 0.1,
                p_i: 0.1,
            })
            .collect();
        onboarding::approve_applicants(
            &self.pool,
            &self.realization,
            &self.cfg,
            budget,
            inviter,
            &approvals,
        )
        .await
    }

    async fn approve_one(&self, inviter: Uuid, path: Uuid) -> api::prepare::Prepared {
        self.approve(&SigningBudget::UNLIMITED, inviter, &[path])
            .await
            .expect("approves")
            .remove(0)
    }

    async fn ingest(&self) -> api::ingest::IngestOutcome {
        let outcome =
            api::ingest::ingest_pending(&self.realization, &self.pool, self.cfg.gc_after_epochs)
                .await
                .expect("ingests");
        assert!(
            outcome.promotion_failures.is_empty(),
            "confirm-side promotion failed: {:?}",
            outcome.promotion_failures
        );
        outcome
    }

    /// One published epoch, carried by a throwaway funded actor's own
    /// Registration, then ingested — the substrate's clock ticking.
    async fn tick(&self) -> api::ingest::IngestOutcome {
        let ticker = ActorKey::generate();
        self.standin
            .credit_burn(&ticker.address(), 10_000_000)
            .await
            .expect("burn");
        let mut payload = Encoder::new();
        payload.array(2);
        payload.uint(1);
        payload.text("ticker");
        let pre = ticker.pre_sign(Proposal {
            body: StructuralBody {
                author: ticker.address(),
                seq: 0,
                family: Family::Registration,
                middle: None,
                target: NodeId::Prof(ticker.address()),
                p_d: 1.0,
                p_i: 1.0,
                settlement_ref: None,
                license: None,
                asserted_parents: vec![],
            },
            payload: payload.finish(),
            deps: vec![],
        });
        let sealed = self.standin.seal(pre.clone()).await.expect("seals");
        let host_key = self.standin.host_public_key().await.expect("host key");
        let witness = ticker.approve(&pre, &sealed, &host_key).expect("approves");
        self.standin.approve(witness).await.expect("approval");
        self.standin
            .close_epoch()
            .await
            .expect("closes")
            .expect("the ticker's act publishes an epoch");
        self.ingest().await
    }

    /// The device's two signing legs over one staged write, through the
    /// relay; returns the write's state after the approval leg.
    async fn sign(&self, key: &ActorKey, staged_id: Uuid) -> Result<StagedState, String> {
        let write = staged::load(&self.pool, staged_id).await.expect("loads");
        let pre = key.pre_sign(write.proposal.clone());
        let sealed = api::relay::submit_pre_signed(
            &self.realization,
            &self.pool,
            staged_id,
            PreSignedParts {
                author_pubkey: pre.author_pubkey.clone(),
                nonce: pre.nonce.clone(),
                pre_signature: pre.pre_signature.clone(),
            },
        )
        .await
        .map_err(|e| e.to_string())?;
        let host_key = self.standin.host_public_key().await.expect("host key");
        let witness = key.approve(&pre, &sealed, &host_key).expect("approves");
        api::relay::submit_approval(
            &self.realization,
            &self.pool,
            staged_id,
            witness.approval_signature,
        )
        .await
        .map_err(|e| e.to_string())?;
        Ok(staged::load(&self.pool, staged_id)
            .await
            .expect("loads")
            .state)
    }

    async fn address_of(&self, account: Uuid) -> String {
        store::actor_identity(&self.pool, account)
            .await
            .expect("query")
            .expect("actor")
            .realization_address
            .expect("attached")
    }

    /// The realization's own count of burns requested for an address.
    async fn burns_on_l1(&self, address: &str) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM l1_admission_burns WHERE address = $1")
            .bind(address)
            .fetch_one(&self.pool)
            .await
            .expect("count")
    }

    async fn burned_micro(&self, address: &str) -> i64 {
        (self
            .standin
            .balance(address)
            .await
            .expect("balance")
            .burned_total
            * 1e6)
            .round() as i64
    }

    async fn funding(&self, address: &str) -> store::AdmissionFunding {
        store::admission_funding(&self.pool, address)
            .await
            .expect("query")
            .expect("a funding row")
    }

    async fn funding_rows(&self) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM auth_admission_fundings")
            .fetch_one(&self.pool)
            .await
            .expect("count")
    }

    /// The account's live (non-expired) unchained admission Registrations.
    async fn admission_registrations(&self, account: Uuid) -> Vec<staged::StagedWrite> {
        staged::list_for_actor(&self.pool, account)
            .await
            .expect("lists")
            .into_iter()
            .filter(|w| {
                w.proposal.body.family == Family::Registration
                    && w.proposal.body.asserted_parents.is_empty()
                    && w.state != StagedState::Expired
            })
            .collect()
    }

    async fn the_registration(&self, account: Uuid) -> staged::StagedWrite {
        let mut live = self.admission_registrations(account).await;
        assert_eq!(live.len(), 1, "exactly one live admission Registration");
        live.remove(0)
    }

    async fn held_signature(&self, staged_id: Uuid) -> Option<Vec<u8>> {
        sqlx::query_scalar("SELECT held_approval_signature FROM staged_writes WHERE id = $1")
            .bind(staged_id)
            .fetch_one(&self.pool)
            .await
            .expect("query")
    }

    async fn l1_status(&self, act_id: &str) -> Option<String> {
        sqlx::query_scalar("SELECT status FROM l1_acts WHERE act_id = $1")
            .bind(act_id)
            .fetch_optional(&self.pool)
            .await
            .expect("query")
    }

    async fn account_state(&self, account: Uuid) -> String {
        sqlx::query_scalar("SELECT account_state FROM user_credentials WHERE actor_id = $1")
            .bind(account)
            .fetch_one(&self.pool)
            .await
            .expect("query")
    }
}

/// A budget with every window generous but the admission funding one.
fn funding_budget(limit: i32) -> SigningBudget {
    SigningBudget {
        admission_funding: Window {
            limit,
            window_secs: 86_400.0,
        },
        ..SigningBudget::UNLIMITED
    }
}

/// Two members vouch for two paths of one account at the same instant.
/// The decisions queue on the account, not on their paths, so the
/// account is funded once — one guard row, one burn on the realization —
/// and one admission Registration is staged, which both vouching Opinions
/// depend on; each decision records its own vouch. The second path is the
/// second member's take-up of the account's ask link. Before the account
/// lock, each path's own row lock let both
/// decisions find no Registration and no burn, and both funded and staged.
///
/// Two paths vouched at once fund the account once and stage one Registration that both vouches depend on.
/// ´claim:onboarding:two-paths-vouched-at-once-fund-and-stage-once´
#[sqlx::test(migrations = "../../migrations")]
async fn two_paths_vouched_at_once_fund_and_stage_once(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (mira, _) = rig.inviter("mira").await;
    let (kel, _) = rig.inviter("kel").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    let first = rig.registration_path(applicant.account).await;
    let second = rig.second_path(applicant.account, kel).await;

    let (first, second) = ([first], [second]);
    let (a, b) = tokio::join!(
        rig.approve(&SigningBudget::UNLIMITED, mira, &first),
        rig.approve(&SigningBudget::UNLIMITED, kel, &second),
    );
    let (a, b) = (a.expect("mira vouches"), b.expect("kel vouches"));

    let address = rig.address_of(applicant.account).await;
    assert_eq!(rig.funding_rows().await, 1);
    assert_eq!(rig.burns_on_l1(&address).await, 1);
    assert_eq!(
        rig.burned_micro(&address).await,
        rig.cfg.admission_burn_micro
    );
    let registration = rig.the_registration(applicant.account).await;
    let anchor = registration.proposal.body.act_id();
    assert_eq!(a[0].proposal.deps, vec![anchor.clone()]);
    assert_eq!(b[0].proposal.deps, vec![anchor]);
    let vouches: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM auth_application_vouches
         WHERE application_id = ANY($1) AND lapsed_at IS NULL",
    )
    .bind(vec![first[0], second[0]])
    .fetch_one(&rig.pool)
    .await
    .expect("count");
    assert_eq!(vouches, 2, "each decision records its own vouch");
}

/// With the burn pending on the realization, nothing that reaches the
/// funding again requests it again: not the settlement passes reading
/// it, not a second member's vouch on another path, and not the poll's
/// repair re-staging an expired Registration — the case the old B_i guard
/// failed, since a pending burn reads as zero burned. The burn settles
/// once, at its epoch, and B_i carries exactly one admission burn.
///
/// A pending burn is never requested twice, by passes, other vouches or the repair, and settles once.
/// ´claim:onboarding:an-unsettled-burn-is-never-requested-twice´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unsettled_burn_is_never_requested_twice(pool: PgPool) {
    let rig = Rig::settling_after(pool, 3).await;
    let (mira, _) = rig.inviter("mira").await;
    let (kel, _) = rig.inviter("kel").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    let address = rig.address_of(applicant.account).await;
    rig.approve_one(mira, rig.registration_path(applicant.account).await)
        .await;

    assert_eq!(rig.burned_micro(&address).await, 0, "the burn is pending");
    let pass = rig.ingest().await;
    assert_eq!(
        pass.funding.requested, 0,
        "a ticketed pending burn is only read"
    );
    assert!(pass.funding.settled.is_empty());

    let second = rig.second_path(applicant.account, kel).await;
    rig.approve_one(kel, second).await;

    let stale = rig.the_registration(applicant.account).await;
    staged::expire_one(&rig.pool, stale.id, 0)
        .await
        .expect("expires");
    let application = store::application(&rig.pool, rig.registration_path(applicant.account).await)
        .await
        .expect("query")
        .expect("path");
    let restaged = onboarding::ensure_admission_staged(
        &rig.pool,
        &rig.realization,
        &rig.cfg,
        application.account_id,
    )
    .await
    .expect("the repair re-stages the Registration while the burn is pending");
    assert_ne!(restaged.id, stale.id);

    assert_eq!(rig.burns_on_l1(&address).await, 1);
    assert_eq!(rig.funding(&address).await.attempts, 1);
    assert_eq!(rig.burned_micro(&address).await, 0, "still pending");

    rig.tick().await;
    rig.tick().await;
    let settling = rig.tick().await;
    assert_eq!(settling.funding.settled, vec![address.clone()]);
    assert!(rig.funding(&address).await.settled_at.is_some());
    assert_eq!(rig.burns_on_l1(&address).await, 1);
    assert_eq!(
        rig.burned_micro(&address).await,
        rig.cfg.admission_burn_micro
    );
}

/// A funding row whose burn request never got its answer recorded — the
/// process died between the claim and the request, or between the
/// request and the ticket write — heals on the next settlement pass, which
/// requests again under the row's own key: the realization answers with
/// the same burn, so it burns once.
///
/// A request lost between the claim and its record is re-requested under the same key, and burns once.
/// ´claim:onboarding:a-lost-burn-request-heals-without-a-second-burn´
#[sqlx::test(migrations = "../../migrations")]
async fn a_crash_between_request_and_record_heals_without_a_second_burn(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (mira, _) = rig.inviter("mira").await;
    let link = rig.link(mira).await;

    let answered = rig.applicant(link, "answered").await;
    let answered_address = rig.address_of(answered.account).await;
    rig.approve_one(mira, rig.registration_path(answered.account).await)
        .await;
    sqlx::query(
        "UPDATE auth_admission_fundings SET ticket = NULL, settled_at = NULL WHERE address = $1",
    )
    .bind(&answered_address)
    .execute(&rig.pool)
    .await
    .expect("the ticket write is lost");

    let never_sent = rig.applicant(link, "unsent").await;
    let unsent_address = rig.address_of(never_sent.account).await;
    store::claim_admission_funding(
        &rig.pool,
        &unsent_address,
        never_sent.account,
        Some(mira),
        rig.cfg.admission_burn_micro,
    )
    .await
    .expect("claims")
    .expect("fresh");
    assert_eq!(rig.burns_on_l1(&unsent_address).await, 0);

    let pass = rig.ingest().await;
    assert_eq!(pass.funding.requested, 2);
    for address in [&answered_address, &unsent_address] {
        assert_eq!(rig.burns_on_l1(address).await, 1, "{address}");
        assert_eq!(
            rig.burned_micro(address).await,
            rig.cfg.admission_burn_micro,
            "{address}"
        );
        assert!(rig.funding(address).await.settled_at.is_some());
    }
}

/// The guard is keyed by address and outlives its account: an applicant
/// funded and then deleted leaves the row behind, so a new account
/// attaching the same key and being vouched in requests nothing — and is
/// bound by that key from the attach on. No applicant deletion verb
/// exists yet (EC-G9), so the rows go the way the reaper deletes an
/// account, staged writes first.
///
/// An address funded once is never funded again, even after its account is deleted and the key re-registered.
/// ´claim:onboarding:a-deleted-applicants-address-is-never-funded-twice´
#[sqlx::test(migrations = "../../migrations")]
async fn a_deleted_applicants_address_is_never_funded_twice(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (mira, _) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let first = rig.applicant(link, "first").await;
    let address = first.key.address();
    rig.approve_one(mira, rig.registration_path(first.account).await)
        .await;
    assert_eq!(rig.burns_on_l1(&address).await, 1);

    for statement in [
        "DELETE FROM staged_writes WHERE actor_id = $1",
        "DELETE FROM actor_profile_versions WHERE actor_id = $1",
        "DELETE FROM user_credentials WHERE actor_id = $1",
        "DELETE FROM actors WHERE id = $1",
    ] {
        sqlx::query(statement)
            .bind(first.account)
            .execute(&rig.pool)
            .await
            .expect(statement);
    }
    assert_eq!(rig.funding(&address).await.account_id, None);

    let again = rig.applicant_with_key(link, "again", &first.key).await;
    rig.approve_one(mira, rig.registration_path(again).await)
        .await;
    assert_eq!(rig.funding_rows().await, 1);
    assert_eq!(rig.burns_on_l1(&address).await, 1);
    assert_eq!(
        rig.burned_micro(&address).await,
        rig.cfg.admission_burn_micro
    );
    rig.the_registration(again).await;

    let other = ActorKey::generate();
    assert!(matches!(
        onboarding::attach_actor_key(&rig.pool, again, other.public_key_bytes(), other.address())
            .await,
        Err(OnboardingError::Forbidden)
    ));
}

/// The applicant signs their Registration while the burn is pending. The
/// seal goes through at once and the approval reads `relaying` — the
/// backend drives it from here — but the witness is held: the substrate
/// has the act sealed, not approved, so nothing can order it before its
/// author can pay. The settlement pass relays it at the epoch the burn
/// settles, and the Registration lands — with the voucher's Opinion,
/// signed meanwhile, so the account lands too.
///
/// The admission Registration's approval leg waits for its funding to settle, then the pass relays it and it lands.
/// ´claim:onboarding:the-registration-relay-waits-for-settlement´
#[sqlx::test(migrations = "../../migrations")]
async fn the_registration_relay_waits_for_settlement(pool: PgPool) {
    let rig = Rig::settling_after(pool, 2).await;
    let (mira, mira_key) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    let vouch = rig
        .approve_one(mira, rig.registration_path(applicant.account).await)
        .await;
    assert_eq!(
        rig.sign(&mira_key, vouch.id).await,
        Ok(StagedState::Relaying)
    );

    let registration = rig.the_registration(applicant.account).await;
    let act_id = registration.proposal.body.act_id().to_string();
    assert_eq!(
        rig.sign(&applicant.key, registration.id).await,
        Ok(StagedState::Relaying)
    );
    assert!(rig.held_signature(registration.id).await.is_some());
    assert_eq!(rig.l1_status(&act_id).await.as_deref(), Some("sealed"));

    let early = rig.tick().await;
    assert!(early.funding.relayed.is_empty());
    assert_eq!(rig.l1_status(&act_id).await.as_deref(), Some("sealed"));

    let settling = rig.tick().await;
    assert_eq!(settling.funding.relayed, vec![registration.id]);
    assert!(rig.held_signature(registration.id).await.is_none());
    assert_eq!(rig.l1_status(&act_id).await.as_deref(), Some("approved"));

    rig.standin
        .close_epoch()
        .await
        .expect("closes")
        .expect("the Registration and the vouch publish");
    rig.ingest().await;
    assert_eq!(
        staged::load(&rig.pool, registration.id)
            .await
            .expect("loads")
            .state,
        StagedState::Landed
    );
    assert_eq!(rig.account_state(applicant.account).await, "member");
}

/// At the stand-in's default delay the burn settles at the request, and
/// the approval reads that settlement at once: nothing is held, the
/// applicant's approval leg relays straight through, and one close lands
/// the Registration and the vouch — the dev flow as it was before the
/// burn crossed the seam.
///
/// At the default settlement delay nothing is held, and the Registration lands at the next close.
/// ´claim:onboarding:at-the-default-delay-the-registration-relays-at-once´
#[sqlx::test(migrations = "../../migrations")]
async fn at_the_default_delay_the_registration_relays_at_once(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (mira, mira_key) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    let vouch = rig
        .approve_one(mira, rig.registration_path(applicant.account).await)
        .await;
    rig.sign(&mira_key, vouch.id)
        .await
        .expect("the vouch relays");
    assert!(
        rig.funding(&applicant.key.address())
            .await
            .settled_at
            .is_some(),
        "stamped by the approval itself, before any ingestion pass"
    );

    let registration = rig.the_registration(applicant.account).await;
    assert_eq!(
        rig.sign(&applicant.key, registration.id).await,
        Ok(StagedState::Relaying)
    );
    assert!(rig.held_signature(registration.id).await.is_none());
    rig.standin
        .close_epoch()
        .await
        .expect("closes")
        .expect("the Registration and the vouch publish");
    rig.ingest().await;
    assert_eq!(rig.account_state(applicant.account).await, "member");
}

/// The voucher's Opinion is prepared with the Registration's act id
/// fixed at prepare, so the voucher signs it at once, burn pending or
/// not: their approval leg relays without a hold — only the admission
/// Registration waits for funding — and the substrate keeps the vouch
/// approved and waiting on its dependency.
///
/// A vouch prepared while the funding is pending is signable at once and relays without a hold.
/// ´claim:onboarding:a-vouch-during-pending-funding-is-signable-at-once´
#[sqlx::test(migrations = "../../migrations")]
async fn a_vouch_during_pending_funding_is_signable_at_once(pool: PgPool) {
    let rig = Rig::settling_after(pool, 2).await;
    let (mira, mira_key) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    let vouch = rig
        .approve_one(mira, rig.registration_path(applicant.account).await)
        .await;
    let registration = rig.the_registration(applicant.account).await;
    assert_eq!(
        vouch.proposal.deps,
        vec![registration.proposal.body.act_id()]
    );

    assert_eq!(
        rig.sign(&mira_key, vouch.id).await,
        Ok(StagedState::Relaying)
    );
    assert!(rig.held_signature(vouch.id).await.is_none());
    assert_eq!(
        rig.l1_status(&vouch.proposal.body.act_id().to_string())
            .await
            .as_deref(),
        Some("approved")
    );
    assert!(
        rig.funding(&applicant.key.address())
            .await
            .settled_at
            .is_none()
    );
}

/// Under a settling realization the applicant's published balance reads
/// zero until the burn pins, so a B_i pre-check on the admission
/// Registration would refuse it — surfacing as the voucher's write-rule
/// refusal. The Registration's W1 is its funding row instead: the vouch
/// goes through and the Registration is staged while B_i still reads 0.
///
/// The admission Registration prepares against its funding row while the burn is pending, with no write-rule refusal for the voucher.
/// ´claim:onboarding:the-admission-registration-prepares-before-funding-settles´
#[sqlx::test(migrations = "../../migrations")]
async fn the_admission_registration_prepares_before_funding_settles(pool: PgPool) {
    let rig = Rig::settling_after(pool, 2).await;
    let (mira, _) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    let address = rig.address_of(applicant.account).await;

    let prepared = rig
        .approve(
            &SigningBudget::UNLIMITED,
            mira,
            &[rig.registration_path(applicant.account).await],
        )
        .await;
    assert!(prepared.is_ok(), "no write-rule refusal: {prepared:?}");
    assert_eq!(rig.burned_micro(&address).await, 0);
    assert_eq!(
        rig.the_registration(applicant.account).await.state,
        StagedState::AwaitingPreSign
    );
}

/// The realization drops the first burn request. The vouch still goes
/// through — a realization's transient trouble is never the voucher's
/// refusal — leaving the funding row unticketed, and the next settlement
/// pass requests again under the same key and settles it.
///
/// A burn request the realization dropped is retried by the settlement pass under the same key.
/// ´claim:onboarding:a-failed-burn-request-is-retried-by-the-settlement-pass´
#[sqlx::test(migrations = "../../migrations")]
async fn a_failed_burn_request_is_retried_by_the_settlement_pass(pool: PgPool) {
    let rig = Rig::new(pool).await;
    rig.realization.failing_requests.store(1, Ordering::SeqCst);
    let (mira, _) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    let address = rig.address_of(applicant.account).await;
    rig.approve_one(mira, rig.registration_path(applicant.account).await)
        .await;

    let funding = rig.funding(&address).await;
    assert_eq!((funding.ticket, funding.attempts), (None, 1));
    assert_eq!(rig.burns_on_l1(&address).await, 0);

    let pass = rig.ingest().await;
    assert_eq!(pass.funding.requested, 1);
    assert_eq!(pass.funding.settled, vec![address.clone()]);
    let funding = rig.funding(&address).await;
    assert_eq!(funding.attempts, 2);
    assert_eq!(funding.ticket, Some(funding.request_key.to_string()));
    assert_eq!(rig.burns_on_l1(&address).await, 1);
    assert_eq!(
        rig.burned_micro(&address).await,
        rig.cfg.admission_burn_micro
    );

    let idle = rig.ingest().await;
    assert_eq!(idle.funding.requested, 0);
    assert!(idle.funding.settled.is_empty());
}

/// The realization refuses the burn for good. The voucher was never
/// refused for it; the funding is stamped failed — once, and never
/// re-requested — and the applicant's Registration stays held, so the
/// account stalls rather than landing an act no one paid for. The repair
/// will not stage a fresh Registration on a failed funding either.
///
/// A failed funding stalls the applicant's Registration without ever refusing the voucher.
/// ´claim:onboarding:a-failed-funding-stalls-without-refusing-the-voucher´
#[sqlx::test(migrations = "../../migrations")]
async fn a_failed_funding_stalls_without_refusing_the_voucher(pool: PgPool) {
    let mut rig = Rig::new(pool).await;
    rig.realization.refusal = Some("the admission fund is exhausted".into());
    let (mira, _) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    let address = rig.address_of(applicant.account).await;
    let vouch = rig
        .approve_one(mira, rig.registration_path(applicant.account).await)
        .await;
    assert_eq!(vouch.proposal.body.family, Family::Opinion);

    let pass = rig.ingest().await;
    assert_eq!(pass.funding.failed, vec![address.clone()]);
    assert!(rig.funding(&address).await.failed_at.is_some());

    let registration = rig.the_registration(applicant.account).await;
    assert_eq!(
        rig.sign(&applicant.key, registration.id).await,
        Ok(StagedState::Relaying)
    );
    let later = rig.ingest().await;
    assert!(later.funding.relayed.is_empty());
    assert!(later.funding.failed.is_empty(), "stamped once");
    assert_eq!(
        later.funding.requested, 0,
        "a failed burn is not re-requested"
    );
    assert!(rig.held_signature(registration.id).await.is_some());
    assert_eq!(rig.funding(&address).await.attempts, 1);

    staged::expire_one(&rig.pool, registration.id, 0)
        .await
        .expect("expires");
    let application = store::application(&rig.pool, rig.registration_path(applicant.account).await)
        .await
        .expect("query")
        .expect("path");
    assert!(
        onboarding::ensure_admission_staged(
            &rig.pool,
            &rig.realization,
            &rig.cfg,
            application.account_id
        )
        .await
        .is_err()
    );
    assert!(
        rig.admission_registrations(applicant.account)
            .await
            .is_empty()
    );
}

/// The funding binds the address: once funded, the key cannot be swapped
/// — and stays bound even when the path's approval no longer stands (a
/// lapsed vouch), because the burn, not the approval, is what a swap
/// would strand.
///
/// The key stays bound once the address is funded, whatever becomes of the approval.
/// ´claim:onboarding:the-key-stays-bound-once-funded´
#[sqlx::test(migrations = "../../migrations")]
async fn the_key_stays_bound_once_funded(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (mira, _) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    rig.approve_one(mira, rig.registration_path(applicant.account).await)
        .await;

    let swap = ActorKey::generate();
    assert!(matches!(
        onboarding::attach_actor_key(
            &rig.pool,
            applicant.account,
            swap.public_key_bytes(),
            swap.address()
        )
        .await,
        Err(OnboardingError::Forbidden)
    ));
    sqlx::query("UPDATE auth_applications SET approved_at = NULL WHERE account_id = $1")
        .bind(applicant.account)
        .execute(&rig.pool)
        .await
        .expect("the vouch lapses");
    assert!(matches!(
        onboarding::attach_actor_key(
            &rig.pool,
            applicant.account,
            swap.public_key_bytes(),
            swap.address()
        )
        .await,
        Err(OnboardingError::Forbidden)
    ));
    assert_eq!(
        rig.address_of(applicant.account).await,
        applicant.key.address()
    );
}

/// The funding budget counts fresh fundings per voucher: two fit a
/// budget of two, and the third is a write-rule refusal of its whole
/// batch, before anything is marked, staged or burned.
///
/// Fresh fundings spend the voucher's funding budget, and the one past it is refused before anything burns.
/// ´claim:onboarding:fresh-fundings-trip-the-vouchers-funding-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn fresh_fundings_trip_the_vouchers_funding_budget(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (mira, _) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let budget = funding_budget(2);
    let mut applicants = Vec::new();
    for handle in ["one", "two", "three"] {
        applicants.push(rig.applicant(link, handle).await);
    }
    for applicant in &applicants[..2] {
        rig.approve(
            &budget,
            mira,
            &[rig.registration_path(applicant.account).await],
        )
        .await
        .expect("within the budget");
    }
    let third = &applicants[2];
    let refused = rig
        .approve(&budget, mira, &[rig.registration_path(third.account).await])
        .await
        .expect_err("past the budget");
    assert!(matches!(
        refused.as_slice(),
        [(None, OnboardingError::FundingBudget)]
    ));
    assert_eq!(rig.burns_on_l1(&third.key.address()).await, 0);
    assert_eq!(rig.funding_rows().await, 2);
    assert!(rig.admission_registrations(third.account).await.is_empty());
    assert!(
        store::application(&rig.pool, rig.registration_path(third.account).await)
            .await
            .expect("query")
            .expect("path")
            .approved_at
            .is_none()
    );
}

/// A vouch on an applicant whose address is already funded costs the
/// fund nothing, so it spends no funding budget: a voucher with none left
/// still vouches for them, and is still refused a fresh one.
///
/// A vouch on an already-funded applicant spends no funding budget.
/// ´claim:onboarding:a-vouch-on-an-already-funded-applicant-spends-no-funding-budget´
#[sqlx::test(migrations = "../../migrations")]
async fn a_vouch_on_an_already_funded_applicant_spends_no_funding_budget(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (mira, _) = rig.inviter("mira").await;
    let (kel, _) = rig.inviter("kel").await;
    let link = rig.link(mira).await;
    let funded = rig.applicant(link, "funded").await;
    rig.approve_one(mira, rig.registration_path(funded.account).await)
        .await;

    let spent = funding_budget(0);
    let second = rig.second_path(funded.account, kel).await;
    rig.approve(&spent, kel, &[second])
        .await
        .expect("no fresh funding, no budget spent");
    assert_eq!(rig.burns_on_l1(&funded.key.address()).await, 1);

    let kel_link = rig.link(kel).await;
    let fresh = rig.applicant(kel_link, "fresh").await;
    let refused = rig
        .approve(&spent, kel, &[rig.registration_path(fresh.account).await])
        .await
        .expect_err("a fresh funding needs budget");
    assert!(matches!(
        refused.as_slice(),
        [(None, OnboardingError::FundingBudget)]
    ));
}

/// A batch that would fund more fresh addresses than the budget holds is
/// refused whole: no entry is marked, nothing is staged or burned, and no
/// budget is spent — the same batch cut to size goes through after.
///
/// A batch over the funding budget is refused whole and spends nothing.
/// ´claim:onboarding:a-batch-over-the-funding-budget-is-refused-whole´
#[sqlx::test(migrations = "../../migrations")]
async fn a_batch_over_the_funding_budget_is_refused_whole(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (mira, _) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let budget = funding_budget(2);
    let mut paths = Vec::new();
    for handle in ["one", "two", "three"] {
        let applicant = rig.applicant(link, handle).await;
        paths.push(rig.registration_path(applicant.account).await);
    }

    let refused = rig
        .approve(&budget, mira, &paths)
        .await
        .expect_err("three fresh fundings, budget of two");
    assert!(matches!(
        refused.as_slice(),
        [(None, OnboardingError::FundingBudget)]
    ));
    assert_eq!(rig.funding_rows().await, 0);
    let staged: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM staged_writes")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(staged, 0);
    let approved: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM auth_applications WHERE approved_at IS NOT NULL")
            .fetch_one(&rig.pool)
            .await
            .expect("count");
    assert_eq!(approved, 0);

    rig.approve(&budget, mira, &paths[..2])
        .await
        .expect("the refusal spent nothing");
}

/// The burn funds the address and writes nothing on the graph: B_i
/// rises, and no epoch, record or act names the address — the applicant's
/// own Registration is what will create the node (EC-R1).
///
/// The admission burn funds the address and publishes no record.
/// ´claim:onboarding:the-burn-funds-the-address-and-publishes-no-record´
#[sqlx::test(migrations = "../../migrations")]
async fn the_burn_funds_the_address_and_publishes_no_record(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (mira, _) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    let address = rig.address_of(applicant.account).await;
    rig.approve_one(mira, rig.registration_path(applicant.account).await)
        .await;

    assert_eq!(
        rig.burned_micro(&address).await,
        rig.cfg.admission_burn_micro
    );
    assert!(
        rig.standin
            .epochs_since(-1)
            .await
            .expect("reads")
            .is_empty()
    );
    let acts: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM l1_acts WHERE author = $1")
        .bind(&address)
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(acts, 0);
}

/// The vouch decision is pure L2 (EC-R1): after it, nothing is on the
/// substrate for the applicant or the voucher — the applicant's
/// Registration and the voucher's Opinion are both staged, unsigned, and
/// the mirror is as it was.
///
/// A vouch decision lands nothing on L1 until the signatures arrive.
/// ´claim:onboarding:a-vouch-decision-lands-nothing-on-l1-until-signed´
#[sqlx::test(migrations = "../../migrations")]
async fn a_vouch_decision_lands_nothing_on_l1_until_signed(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (mira, mira_key) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    let vouch = rig
        .approve_one(mira, rig.registration_path(applicant.account).await)
        .await;

    let on_l1: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM l1_acts WHERE author = ANY($1)")
        .bind(vec![applicant.key.address(), mira_key.address()])
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(on_l1, 0);
    let mirrored: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mirror_records")
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(mirrored, 0);
    assert_eq!(
        rig.the_registration(applicant.account).await.state,
        StagedState::AwaitingPreSign
    );
    assert_eq!(
        staged::load(&rig.pool, vouch.id)
            .await
            .expect("loads")
            .state,
        StagedState::AwaitingPreSign
    );
}

/// A held witness is relayed later by a pass the device never hears from,
/// so the relay checks it before holding it: a witness that does not
/// verify over the sealed act is refused at once, while the device can
/// still fix it, and nothing is held.
///
/// A held approval's witness is verified before it is held, so a bad one is refused while the device can still fix it.
/// ´claim:onboarding:a-held-approval-is-verified-before-it-is-held´
#[sqlx::test(migrations = "../../migrations")]
async fn a_held_approval_is_verified_before_it_is_held(pool: PgPool) {
    let rig = Rig::settling_after(pool, 2).await;
    let (mira, _) = rig.inviter("mira").await;
    let link = rig.link(mira).await;
    let applicant = rig.applicant(link, "newbie").await;
    rig.approve_one(mira, rig.registration_path(applicant.account).await)
        .await;
    let registration = rig.the_registration(applicant.account).await;
    let pre = applicant.key.pre_sign(registration.proposal.clone());
    api::relay::submit_pre_signed(
        &rig.realization,
        &rig.pool,
        registration.id,
        PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        },
    )
    .await
    .expect("seals");

    let refused =
        api::relay::submit_approval(&rig.realization, &rig.pool, registration.id, vec![7; 64])
            .await;
    assert!(matches!(
        refused,
        Err(api::relay::RelayError::SignatureInvalid(_))
    ));
    assert_eq!(
        staged::load(&rig.pool, registration.id)
            .await
            .expect("loads")
            .state,
        StagedState::AwaitingApproval
    );
    assert!(rig.held_signature(registration.id).await.is_none());
}
