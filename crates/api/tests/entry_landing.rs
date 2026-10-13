//! The entry ceremony's landing (auth.md "Approval and landing"; EC-R1 to
//! EC-R3): an account lands when its own admission Registration and the
//! first vouch-Opinion on any of its paths have both confirmed in the
//! mirror; a vouch that never lands lapses and its path waits again; any
//! member may vouch anew; the landing closes the other paths; and the two
//! provenance reads split — the link issuer lends the borrowed view, the
//! admitting voucher is `invitedBy`.
//!
//! Paths beyond the registration path are staged the way they come to
//! exist: another member takes the account up from its ask link
//! (`stageApplicant`), so each is a real queue entry in that member's
//! queue, approvable and rejectable through the real verbs.

use std::sync::{Arc, Mutex};

use chrono::{Duration, Utc};
use common::l1::census::Family;
use common::l1::client::ActorKey;
use common::l1::encoding::Encoder;
use common::l1::handshake::{Proposal, StructuralBody};
use common::l1::identifier::NodeId;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::staged::{self, PreSignedParts, StagedState};
use postgres_store::{PgPool, auth as store, mirror};
use serde_json::Value;
use uuid::Uuid;

use api::auth::{AuthConfig, Viewer};
use api::l1::StandInBoundary;
use api::onboarding::{self, Approval, OnboardingConfig, OnboardingError, RegistrationInput};
use api::prepare::Prepared;
use api::ratelimit::SigningBudget;
use api::schema::{ApiSchema, QueryBudgets, build_with};

mod rig;

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

struct Member {
    id: Uuid,
    key: ActorKey,
}

struct Applicant {
    account: Uuid,
    key: ActorKey,
}

struct Rig {
    pool: PgPool,
    standin: StandIn,
    boundary: StandInBoundary,
    mailer: SilentMailer,
    cfg: OnboardingConfig,
    auth_cfg: AuthConfig,
    schema: ApiSchema,
}

impl Rig {
    async fn settling_after(pool: PgPool, delay: i64) -> Self {
        let standin = StandIn::new(
            pool.clone(),
            StandInConfig::default()
                .settling_after(delay)
                .expect("config"),
        );
        let (ctx, _) = rig::api_context(
            pool.clone(),
            Arc::new(api::mailer::DevMailer::new(None)),
            api::ratelimit::RateLimitConfig::unlimited(),
        );
        Self {
            boundary: StandInBoundary(standin.clone()),
            standin,
            pool,
            mailer: SilentMailer::default(),
            cfg: OnboardingConfig::default(),
            auth_cfg: AuthConfig::ephemeral().expect("cfg"),
            schema: build_with(ctx, QueryBudgets::release()),
        }
    }

    async fn new(pool: PgPool) -> Self {
        Self::settling_after(pool, 0).await
    }

    async fn member(&self, handle: &str) -> Member {
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
        Member { id, key }
    }

    async fn link(&self, issuer: Uuid) -> Uuid {
        store::create_invite_link(
            &self.pool,
            Uuid::new_v4(),
            issuer,
            false,
            Utc::now() + Duration::days(1),
        )
        .await
        .expect("link")
        .id
    }

    /// Registers through `issuer`'s link, verifies, attaches a key.
    async fn applicant(&self, issuer: Uuid, handle: &str) -> Applicant {
        let link = self.link(issuer).await;
        let key = ActorKey::generate();
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
        Applicant { account, key }
    }

    /// Another path of `account`, in `owner`'s queue: `owner` takes the
    /// account up from its ask link (module docs).
    async fn path(&self, account: Uuid, owner: Uuid) -> Uuid {
        let ask_link = store::ask_link_of(&self.pool, account)
            .await
            .expect("ask link read")
            .expect("an applicant has an ask link");
        onboarding::stage_applicant(&self.pool, owner, ask_link)
            .await
            .expect("stages")
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

    async fn try_vouch(
        &self,
        voucher: &Member,
        path: Uuid,
    ) -> Result<Prepared, Vec<onboarding::ApprovalFault>> {
        onboarding::approve_applicants(
            &self.pool,
            &self.boundary,
            &self.cfg,
            &SigningBudget::UNLIMITED,
            voucher.id,
            &[Approval {
                application: path,
                p_d: 0.4,
                p_i: 0.2,
            }],
        )
        .await
        .map(|mut prepared| prepared.remove(0))
    }

    async fn vouch(&self, voucher: &Member, path: Uuid) -> Prepared {
        self.try_vouch(voucher, path).await.expect("vouches")
    }

    /// The device's two signing legs over one staged write.
    async fn sign(&self, key: &ActorKey, staged_id: Uuid) {
        let write = staged::load(&self.pool, staged_id).await.expect("loads");
        let pre = key.pre_sign(write.proposal.clone());
        let sealed = api::relay::submit_pre_signed(
            &self.boundary,
            &self.pool,
            staged_id,
            PreSignedParts {
                author_pubkey: pre.author_pubkey.clone(),
                nonce: pre.nonce.clone(),
                pre_signature: pre.pre_signature.clone(),
            },
        )
        .await
        .expect("seals");
        let host_key = self.standin.host_public_key().await.expect("host key");
        let witness = key.approve(&pre, &sealed, &host_key).expect("approves");
        api::relay::submit_approval(
            &self.boundary,
            &self.pool,
            staged_id,
            witness.approval_signature,
        )
        .await
        .expect("relays");
    }

    /// The applicant's live admission Registration.
    async fn registration(&self, account: Uuid) -> staged::StagedWrite {
        staged::list_for_actor(&self.pool, account)
            .await
            .expect("lists")
            .into_iter()
            .find(|w| {
                w.proposal.body.family == Family::Registration
                    && w.proposal.body.asserted_parents.is_empty()
                    && w.state != StagedState::Expired
            })
            .expect("a live admission Registration")
    }

    async fn sign_registration(&self, applicant: &Applicant) -> staged::StagedWrite {
        let registration = self.registration(applicant.account).await;
        self.sign(&applicant.key, registration.id).await;
        registration
    }

    async fn ingest_under(&self, gc_after_epochs: i64) -> api::ingest::IngestOutcome {
        let outcome = api::ingest::ingest_pending(&self.boundary, &self.pool, gc_after_epochs)
            .await
            .expect("ingests");
        assert!(
            outcome.promotion_failures.is_empty(),
            "promotion failed: {:?}",
            outcome.promotion_failures
        );
        outcome
    }

    async fn ingest(&self) -> api::ingest::IngestOutcome {
        self.ingest_under(self.cfg.gc_after_epochs).await
    }

    /// Closes an epoch (something must be orderable) and ingests it.
    async fn close(&self) -> api::ingest::IngestOutcome {
        self.standin
            .close_epoch()
            .await
            .expect("closes")
            .expect("an epoch publishes");
        self.ingest().await
    }

    /// One published epoch carried by a throwaway funded actor — the
    /// substrate's clock — ingested under `gc_after_epochs`.
    async fn tick_under(&self, gc_after_epochs: i64) -> api::ingest::IngestOutcome {
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
            .expect("the ticker publishes");
        self.ingest_under(gc_after_epochs).await
    }

    async fn state(&self, account: Uuid) -> String {
        sqlx::query_scalar("SELECT account_state FROM user_credentials WHERE actor_id = $1")
            .bind(account)
            .fetch_one(&self.pool)
            .await
            .expect("state")
    }

    async fn application(&self, path: Uuid) -> store::Application {
        store::application(&self.pool, path)
            .await
            .expect("query")
            .expect("path")
    }

    async fn landed_paths(&self, account: Uuid) -> Vec<Uuid> {
        sqlx::query_scalar(
            "SELECT id FROM auth_applications WHERE account_id = $1 AND landed_at IS NOT NULL",
        )
        .bind(account)
        .fetch_all(&self.pool)
        .await
        .expect("query")
    }

    async fn vouch_row(
        &self,
        act_id: &str,
    ) -> (Option<chrono::DateTime<Utc>>, Option<chrono::DateTime<Utc>>) {
        sqlx::query_as(
            "SELECT lapsed_at, landed_at FROM auth_application_vouches WHERE act_id = $1",
        )
        .bind(act_id)
        .fetch_one(&self.pool)
        .await
        .expect("vouch row")
    }

    async fn count(&self, sql: &str, account: Uuid) -> i64 {
        sqlx::query_scalar(sql)
            .bind(account)
            .fetch_one(&self.pool)
            .await
            .expect("count")
    }

    /// One GraphQL read as the account itself.
    async fn me(&self, account: Uuid, selection: &str) -> Value {
        let viewer = Some(Viewer {
            user_id: account,
            session_id: Uuid::new_v4(),
        });
        let response = self
            .schema
            .execute(async_graphql::Request::new(format!("{{ {selection} }}")).data(viewer))
            .await;
        assert!(response.errors.is_empty(), "{:?}", response.errors);
        response.data.into_json().expect("json")
    }

    /// One GraphQL request as `account` (None: anonymous), returned whole.
    async fn exec(&self, account: Option<Uuid>, query: &str, variables: Value) -> Value {
        let viewer = account.map(|user_id| Viewer {
            user_id,
            session_id: Uuid::new_v4(),
        });
        let response = self
            .schema
            .execute(
                async_graphql::Request::new(query)
                    .variables(async_graphql::Variables::from_json(variables))
                    .data(viewer),
            )
            .await;
        serde_json::to_value(&response).expect("json")
    }

    /// Whether the path stands in its member's view of the queue: a link
    /// path in its link's share (every status), an ask-link path in the
    /// approver's waiting queue.
    async fn queue_holds(&self, path: Uuid) -> bool {
        let row = store::application(&self.pool, path)
            .await
            .expect("read")
            .expect("path");
        let rows = match row.invite_link_id {
            Some(link) => store::applications_for_link(&self.pool, link).await,
            None => store::approval_queue(&self.pool, row.approver_id).await,
        };
        rows.expect("queue").iter().any(|a| a.id == path)
    }
}

async fn read(rig: &Rig, account: Uuid) -> (String, String) {
    let me = rig
        .me(
            account,
            "me { application { id approver { ... on User { handle } } } }",
        )
        .await;
    (
        me["me"]["application"]["id"]
            .as_str()
            .expect("id")
            .to_string(),
        me["me"]["application"]["approver"]["handle"]
            .as_str()
            .expect("handle")
            .to_string(),
    )
}

async fn provenance(rig: &Rig, account: Uuid) -> (Option<String>, Option<String>, bool) {
    let me = rig
        .me(
            account,
            "me { invitedBy { handle } hasReciprocated } borrowedView { ... on User { handle } }",
        )
        .await;
    (
        me["borrowedView"]["handle"].as_str().map(str::to_owned),
        me["me"]["invitedBy"]["handle"].as_str().map(str::to_owned),
        me["me"]["hasReciprocated"].as_bool().expect("bool"),
    )
}

fn act(prepared: &Prepared) -> String {
    prepared.proposal.body.act_id().to_string()
}

/// The voucher decides and the applicant signs, but the voucher never
/// signs their edge: the Registration lands — the node exists (EC-R1) —
/// and the account does not, because no vouch-Opinion confirmed (EC-R2).
/// The C8 hole: landing on the Registration alone made a member no
/// member's edge reaches.
///
/// A Registration without a landed vouch does not land the account.
/// ´claim:onboarding:a-registration-alone-does-not-land-the-account´
#[sqlx::test(migrations = "../../migrations")]
async fn a_registration_without_a_landed_vouch_does_not_land_the_account(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let vouch = rig
        .vouch(&mira, rig.registration_path(noa.account).await)
        .await;
    let registration = rig.sign_registration(&noa).await;
    rig.close().await;

    assert_eq!(
        staged::load(&rig.pool, registration.id)
            .await
            .expect("loads")
            .state,
        StagedState::Landed
    );
    assert_eq!(rig.state(noa.account).await, "applicant");
    assert_eq!(rig.vouch_row(&act(&vouch)).await, (None, None));
    assert!(rig.landed_paths(noa.account).await.is_empty());
}

/// Both facts, in either order of epochs: the Registration in one epoch
/// and the vouch in the next, or both in one close. The account lands
/// on the second fact, through the vouch's path.
///
/// The account lands when its Registration and a vouch have both confirmed, across epochs or within one.
/// ´claim:onboarding:the-account-lands-on-both-facts´
#[sqlx::test(migrations = "../../migrations")]
async fn the_account_lands_when_the_registration_and_a_vouch_both_confirm(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;

    let apart = rig.applicant(mira.id, "apart").await;
    let apart_path = rig.registration_path(apart.account).await;
    let vouch = rig.vouch(&mira, apart_path).await;
    rig.sign_registration(&apart).await;
    rig.close().await;
    assert_eq!(rig.state(apart.account).await, "applicant");
    rig.sign(&mira.key, vouch.id).await;
    rig.close().await;
    assert_eq!(rig.state(apart.account).await, "member");
    assert_eq!(rig.landed_paths(apart.account).await, vec![apart_path]);

    let together = rig.applicant(mira.id, "together").await;
    let together_path = rig.registration_path(together.account).await;
    let vouch = rig.vouch(&mira, together_path).await;
    rig.sign(&mira.key, vouch.id).await;
    rig.sign_registration(&together).await;
    rig.close().await;
    assert_eq!(rig.state(together.account).await, "member");
    assert_eq!(
        rig.landed_paths(together.account).await,
        vec![together_path]
    );
}

/// The applicant's own Registration is what creates the node: the record
/// is authored by their address, and nothing of the Profile existed
/// before it landed (EC-R1).
///
/// The applicant's own signed Registration creates their node.
/// ´claim:onboarding:the-applicants-own-registration-creates-the-node´
#[sqlx::test(migrations = "../../migrations")]
async fn the_applicants_own_registration_creates_the_node(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    rig.vouch(&mira, rig.registration_path(noa.account).await)
        .await;
    let prof = NodeId::Prof(noa.key.address()).to_string();
    let before: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM mirror_record_legs WHERE target = $1")
            .bind(&prof)
            .fetch_one(&rig.pool)
            .await
            .expect("count");
    assert_eq!(before, 0);

    let registration = rig.sign_registration(&noa).await;
    rig.close().await;
    let author: String =
        sqlx::query_scalar("SELECT author FROM mirror_records WHERE record_id = $1")
            .bind(registration.proposal.body.act_id().to_string())
            .fetch_one(&rig.pool)
            .await
            .expect("the Registration is in the mirror");
    assert_eq!(author, noa.key.address());
}

/// A vouch whose Opinion is collected unlanded lapses: the path reads
/// waiting again (`approvedAt` null), while the node — the landed
/// Registration — and the funding stay.
///
/// A lapsed vouch returns its path to waiting, keeping the node and the funding.
/// ´claim:onboarding:a-lapsed-vouch-returns-the-path-to-waiting´
#[sqlx::test(migrations = "../../migrations")]
async fn a_lapsed_vouch_returns_the_path_to_waiting(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let path = rig.registration_path(noa.account).await;
    let vouch = rig.vouch(&mira, path).await;
    rig.sign_registration(&noa).await;
    rig.close().await;
    assert!(rig.application(path).await.approved_at.is_some());

    let mut lapsed = 0;
    for _ in 0..3 {
        lapsed += rig.tick_under(1).await.lapsed;
    }
    assert_eq!(lapsed, 1);
    assert!(rig.vouch_row(&act(&vouch)).await.0.is_some());
    assert!(rig.application(path).await.approved_at.is_none());
    assert_eq!(rig.state(noa.account).await, "applicant");
    assert!(
        store::admission_funding(&rig.pool, &noa.key.address())
            .await
            .expect("query")
            .is_some()
    );
    let me = rig
        .me(noa.account, "me { application { approvedAt } }")
        .await;
    assert!(me["me"]["application"]["approvedAt"].is_null());
}

/// After a fall-through any member may vouch again, through any path,
/// and the ceremony completes with no second burn and no second
/// Registration: the landed one is reused and the new edge depends on it.
///
/// A fallen ritual is completed by another member's vouch, with one funding and one Registration.
/// ´claim:onboarding:a-fallen-ritual-is-revouched-by-another-member´
#[sqlx::test(migrations = "../../migrations")]
async fn a_fallen_ritual_is_revouched_by_another_member(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let kel = rig.member("kel").await;
    let noa = rig.applicant(mira.id, "noa").await;
    rig.vouch(&mira, rig.registration_path(noa.account).await)
        .await;
    let registration = rig.sign_registration(&noa).await;
    rig.close().await;
    for _ in 0..3 {
        rig.tick_under(1).await;
    }

    let kel_path = rig.path(noa.account, kel.id).await;
    let vouch = rig.vouch(&kel, kel_path).await;
    assert_eq!(
        vouch.proposal.deps,
        vec![registration.proposal.body.act_id()],
        "the landed Registration is reused"
    );
    rig.sign(&kel.key, vouch.id).await;
    rig.close().await;
    assert_eq!(rig.state(noa.account).await, "member");
    assert_eq!(rig.landed_paths(noa.account).await, vec![kel_path]);
    assert_eq!(
        rig.count(
            "SELECT COUNT(*) FROM auth_admission_fundings WHERE account_id = $1",
            noa.account
        )
        .await,
        1
    );
    assert_eq!(
        rig.count(
            "SELECT COUNT(*) FROM staged_writes
             WHERE actor_id = $1 AND family = 'registration' AND cardinality(asserted_parents) = 0",
            noa.account
        )
        .await,
        1
    );
    let me = rig.me(noa.account, "me { invitedBy { handle } }").await;
    assert_eq!(me["me"]["invitedBy"]["handle"], "kel");
}

/// The poll's repair re-stages the Registration alone when its row was
/// collected unlanded while a vouch is live — under a new act id — and
/// prepares nobody's Opinion: the old vouch, bound to the old id, can
/// never land and lapses at its own GC (EC-R2 "never conjures a voucher
/// signature").
///
/// The repair re-stages only the Registration, never an Opinion.
/// ´claim:onboarding:the-repair-restages-only-the-registration´
#[sqlx::test(migrations = "../../migrations")]
async fn the_repair_restages_only_the_registration(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    rig.vouch(&mira, rig.registration_path(noa.account).await)
        .await;
    let stale = rig.registration(noa.account).await;
    staged::expire_one(&rig.pool, stale.id, 0)
        .await
        .expect("expires");
    let opinions = "SELECT COUNT(*) FROM staged_writes
         WHERE family = 'opinion'
           AND target = 'prof:' || (SELECT realization_address FROM actors WHERE id = $1)";
    let before = rig.count(opinions, noa.account).await;

    rig.me(noa.account, "me { application { id } }").await;
    let fresh = rig.registration(noa.account).await;
    assert_ne!(fresh.proposal.body.act_id(), stale.proposal.body.act_id());
    assert_eq!(
        rig.count(opinions, noa.account).await,
        before,
        "no Opinion was prepared for anyone"
    );
}

/// The newest path is open and waiting, an older one holds the live
/// vouch: the repair keys on the account, not on the row the read shows,
/// and the live vouch's path is also the one the read shows (ruling 66).
///
/// The repair runs when an older path holds the live vouch and a newer one is open.
/// ´claim:onboarding:the-repair-runs-for-any-live-path´
#[sqlx::test(migrations = "../../migrations")]
async fn the_repair_runs_when_an_older_path_holds_the_live_vouch(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let kel = rig.member("kel").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let older = rig.registration_path(noa.account).await;
    rig.vouch(&mira, older).await;
    rig.path(noa.account, kel.id).await;
    let stale = rig.registration(noa.account).await;
    staged::expire_one(&rig.pool, stale.id, 0)
        .await
        .expect("expires");

    let me = rig
        .me(
            noa.account,
            "me { application { id approver { ... on User { handle } } } }",
        )
        .await;
    assert_eq!(me["me"]["application"]["id"], older.to_string());
    assert_eq!(me["me"]["application"]["approver"]["handle"], "mira");
    assert_ne!(rig.registration(noa.account).await.id, stale.id);
}

/// The GC is not final: a vouch whose staged row was collected — lapsed,
/// its path waiting — still completes the ceremony if its Opinion lands
/// after all. The landing books the path it was decided on.
///
/// The staged rows here are collected by hand, Opinion first: the case is
/// "collected, then lands anyway", which the stand-in's own clock would
/// reach only through a burn slower than the GC bound.
///
/// A lapsed vouch that lands late still completes the ceremony.
/// ´claim:onboarding:a-lapsed-vouch-that-lands-late-still-counts´
#[sqlx::test(migrations = "../../migrations")]
async fn a_lapsed_vouch_that_lands_late_still_completes_the_ceremony(pool: PgPool) {
    let rig = Rig::settling_after(pool, 2).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let path = rig.registration_path(noa.account).await;
    let vouch = rig.vouch(&mira, path).await;
    rig.sign(&mira.key, vouch.id).await;
    rig.sign_registration(&noa).await;
    staged::expire_one(&rig.pool, vouch.id, 0)
        .await
        .expect("expires");
    assert_eq!(rig.ingest().await.lapsed, 1);
    assert!(rig.application(path).await.approved_at.is_none());

    rig.tick_under(rig.cfg.gc_after_epochs).await;
    rig.tick_under(rig.cfg.gc_after_epochs).await;
    rig.close().await;
    assert_eq!(rig.state(noa.account).await, "member");
    assert_eq!(rig.landed_paths(noa.account).await, vec![path]);
    let (lapsed_at, landed_at) = rig.vouch_row(&act(&vouch)).await;
    assert!(lapsed_at.is_some() && landed_at.is_some());
    assert!(rig.application(path).await.approved_at.is_some());
}

/// Only an Opinion a vouch decision prepared counts — by its recorded act
/// id (seam 099 ruling 71; EC-G2). A member's ordinary stance toward a
/// registered applicant is an Opinion like any other and lands nobody.
///
/// An ordinary Opinion toward a registered applicant does not land them.
/// ´claim:onboarding:an-ordinary-opinion-lands-nobody´
#[sqlx::test(migrations = "../../migrations")]
async fn an_ordinary_opinion_on_a_registered_applicant_does_not_land_them(pool: PgPool) {
    use api::prepare::{Gesture, Target};
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let sol = rig.member("sol").await;
    let noa = rig.applicant(mira.id, "noa").await;
    rig.vouch(&mira, rig.registration_path(noa.account).await)
        .await;
    rig.sign_registration(&noa).await;
    rig.close().await;

    let stance = api::prepare::prepare(
        &rig.boundary,
        &rig.pool,
        rig.cfg.gc_after_epochs,
        sol.id,
        Gesture {
            author: sol.key.address(),
            family: Family::Opinion,
            middle: None,
            target: Target::Node(NodeId::Prof(noa.key.address())),
            p_d: 0.5,
            p_i: 0.5,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
            deps: vec![],
            payload: vec![],
            node: None,
        },
    )
    .await
    .expect("prepares");
    rig.sign(&sol.key, stance.id).await;
    rig.close().await;
    assert!(
        rig.count(
            "SELECT COUNT(*) FROM mirror_records WHERE author = (SELECT realization_address FROM actors WHERE id = $1) AND family = 'opinion'",
            sol.id
        )
        .await
            == 1
    );
    assert_eq!(rig.state(noa.account).await, "applicant");
}

/// Several paths may be open at once (EC-R3), each a queue entry of its
/// own member, each approvable — and two decisions on them share one
/// funding and one Registration, each recording its own vouch.
///
/// Several paths of one account may be open and vouched at once.
/// ´claim:onboarding:several-paths-may-be-open-at-once´
#[sqlx::test(migrations = "../../migrations")]
async fn several_paths_may_be_open_at_once(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let kel = rig.member("kel").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let first = rig.registration_path(noa.account).await;
    let second = rig.path(noa.account, kel.id).await;
    assert!(rig.queue_holds(first).await && rig.queue_holds(second).await);

    let a = rig.vouch(&mira, first).await;
    let b = rig.vouch(&kel, second).await;
    assert_eq!(a.proposal.deps, b.proposal.deps);
    assert_eq!(
        rig.count(
            "SELECT COUNT(*) FROM auth_application_vouches v JOIN auth_applications ap ON ap.id = v.application_id WHERE ap.account_id = $1 AND v.lapsed_at IS NULL",
            noa.account
        )
        .await,
        2
    );
}

/// Two vouches on two paths, the one on the second-created path landing
/// first: the landing books that path, `invitedBy` names its voucher, and
/// the other path leaves its member's queue. Before the multi-path
/// landing, two approved rows never landed at all (L1).
///
/// The first vouch to land completes the ceremony, whichever path it was decided on.
/// ´claim:onboarding:the-first-vouch-to-land-wins´
#[sqlx::test(migrations = "../../migrations")]
async fn the_first_vouch_to_land_completes_the_ceremony(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let kel = rig.member("kel").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let first = rig.registration_path(noa.account).await;
    let second = rig.path(noa.account, kel.id).await;
    rig.vouch(&mira, first).await;
    let kel_vouch = rig.vouch(&kel, second).await;
    rig.sign_registration(&noa).await;
    rig.close().await;

    rig.sign(&kel.key, kel_vouch.id).await;
    rig.close().await;
    assert_eq!(rig.state(noa.account).await, "member");
    assert_eq!(rig.landed_paths(noa.account).await, vec![second]);
    assert!(!rig.queue_holds(first).await);
    let me = rig
        .me(
            noa.account,
            "me { invitedBy { handle } application { id } }",
        )
        .await;
    assert_eq!(me["me"]["invitedBy"]["handle"], "kel");
    assert_eq!(me["me"]["application"]["id"], second.to_string());
}

/// Two vouches confirming in one epoch: the causal key decides, and the
/// earlier position wins.
///
/// Two vouches landing in one epoch pick the earlier position.
/// ´claim:onboarding:one-epoch-picks-the-earlier-position´
#[sqlx::test(migrations = "../../migrations")]
async fn two_vouches_landing_in_one_epoch_pick_the_earlier_position(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let kel = rig.member("kel").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let first = rig.registration_path(noa.account).await;
    let second = rig.path(noa.account, kel.id).await;
    let a = rig.vouch(&mira, first).await;
    let b = rig.vouch(&kel, second).await;
    rig.sign_registration(&noa).await;
    rig.close().await;
    rig.sign(&kel.key, b.id).await;
    rig.sign(&mira.key, a.id).await;
    rig.close().await;

    let keys: Vec<(String, i64, i64)> = sqlx::query_as(
        "SELECT record_id, act_time, position FROM mirror_records WHERE record_id = ANY($1)",
    )
    .bind(vec![act(&a), act(&b)])
    .fetch_all(&rig.pool)
    .await
    .expect("keys");
    assert_eq!(keys.len(), 2, "both vouches landed");
    let earliest = keys
        .iter()
        .min_by_key(|(_, time, position)| (*time, *position))
        .expect("one")
        .0
        .clone();
    let winner = if earliest == act(&a) { first } else { second };
    assert_eq!(rig.landed_paths(noa.account).await, vec![winner]);
}

/// After the landing, a later vouch-Opinion lands as an ordinary Opinion
/// (EC-R3): the mirror holds both, nothing lands twice, the account is
/// unchanged, and the vouch is only booked as landed.
///
/// A vouch landing after the account landed is an ordinary Opinion.
/// ´claim:onboarding:a-later-vouch-is-an-ordinary-opinion´
#[sqlx::test(migrations = "../../migrations")]
async fn a_later_vouch_lands_as_an_ordinary_opinion(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let kel = rig.member("kel").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let first = rig.registration_path(noa.account).await;
    let second = rig.path(noa.account, kel.id).await;
    let mira_vouch = rig.vouch(&mira, first).await;
    let kel_vouch = rig.vouch(&kel, second).await;
    rig.sign(&kel.key, kel_vouch.id).await;
    rig.sign_registration(&noa).await;
    rig.close().await;
    assert_eq!(rig.landed_paths(noa.account).await, vec![second]);

    rig.sign(&mira.key, mira_vouch.id).await;
    rig.close().await;
    assert_eq!(rig.landed_paths(noa.account).await, vec![second]);
    assert_eq!(rig.state(noa.account).await, "member");
    assert!(rig.vouch_row(&act(&mira_vouch)).await.1.is_some());
    let me = rig.me(noa.account, "me { invitedBy { handle } }").await;
    assert_eq!(me["me"]["invitedBy"]["handle"], "kel");
}

/// The landing closes every other path (seam 099 ruling 67): a waiting
/// path and one holding a live vouch both leave their members' queues by
/// the read-side filter, and approving or rejecting either refuses — the
/// applicant has landed. Nothing is written on them.
///
/// Landing closes the other paths: they leave the queue and refuse decisions.
/// ´claim:onboarding:landing-closes-the-other-paths´
#[sqlx::test(migrations = "../../migrations")]
async fn landing_closes_the_other_open_paths(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let kel = rig.member("kel").await;
    let sol = rig.member("sol").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let vouched = rig.registration_path(noa.account).await;
    let landing = rig.path(noa.account, kel.id).await;
    let waiting = rig.path(noa.account, sol.id).await;
    rig.vouch(&mira, vouched).await;
    let kel_vouch = rig.vouch(&kel, landing).await;
    rig.sign(&kel.key, kel_vouch.id).await;
    rig.sign_registration(&noa).await;
    rig.close().await;

    assert_eq!(
        rig.landed_paths(noa.account).await,
        vec![landing],
        "the landed path stays as the record"
    );
    assert!(!rig.queue_holds(vouched).await);
    assert!(!rig.queue_holds(waiting).await);
    let refused = rig.try_vouch(&sol, waiting).await.expect_err("refused");
    assert!(matches!(
        &refused[0].1,
        OnboardingError::BadInput { message, .. } if message == "the applicant has already landed"
    ));
    assert!(
        onboarding::reject_application(&rig.pool, sol.id, waiting)
            .await
            .is_err()
    );
    let waiting_row = rig.application(waiting).await;
    assert!(waiting_row.approved_at.is_none() && waiting_row.rejected_at.is_none());
}

/// Concurrent landing evaluations over the same mirror facts book one
/// landing: the account lock serializes them, the second finds the member,
/// and the one-landed-path index is the backstop.
///
/// The landing evaluation is idempotent under concurrent ingestion.
/// ´claim:onboarding:the-evaluation-is-idempotent-under-concurrency´
#[sqlx::test(migrations = "../../migrations")]
async fn the_landing_evaluation_is_idempotent_under_concurrent_ingest(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let kel = rig.member("kel").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let first = rig.registration_path(noa.account).await;
    let second = rig.path(noa.account, kel.id).await;
    let a = rig.vouch(&mira, first).await;
    let b = rig.vouch(&kel, second).await;
    rig.sign(&mira.key, a.id).await;
    rig.sign(&kel.key, b.id).await;
    rig.sign_registration(&noa).await;
    rig.standin
        .close_epoch()
        .await
        .expect("closes")
        .expect("publishes");

    let (x, y) = tokio::join!(
        api::ingest::ingest_pending(&rig.boundary, &rig.pool, rig.cfg.gc_after_epochs),
        onboarding::land_ready_accounts(&rig.pool),
    );
    x.expect("ingests");
    assert!(y.is_empty(), "{y:?}");
    let (p, q) = tokio::join!(
        onboarding::land_ready_accounts(&rig.pool),
        onboarding::land_ready_accounts(&rig.pool),
    );
    assert!(p.is_empty() && q.is_empty());
    assert_eq!(rig.landed_paths(noa.account).await.len(), 1);
    assert_eq!(rig.state(noa.account).await, "member");
}

/// The predicate reads only mirror facts and recorded act ids, so a
/// rebuild — the mirror reset and re-ingested, the L2 landing state
/// cleared — reproduces the same winning path and the same `invitedBy`.
///
/// The landing rebuilds from the mirror to the same winner.
/// ´claim:onboarding:the-landing-rebuilds-from-the-mirror´
#[sqlx::test(migrations = "../../migrations")]
async fn the_landing_rebuilds_from_the_mirror(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let kel = rig.member("kel").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let first = rig.registration_path(noa.account).await;
    let second = rig.path(noa.account, kel.id).await;
    let a = rig.vouch(&mira, first).await;
    let b = rig.vouch(&kel, second).await;
    rig.sign_registration(&noa).await;
    rig.sign(&kel.key, b.id).await;
    rig.close().await;
    rig.sign(&mira.key, a.id).await;
    rig.close().await;
    let winner = rig.landed_paths(noa.account).await;
    assert_eq!(winner, vec![second]);

    mirror::reset(&rig.pool).await.expect("reset");
    sqlx::query("UPDATE auth_applications SET landed_at = NULL WHERE account_id = $1")
        .bind(noa.account)
        .execute(&rig.pool)
        .await
        .expect("clear paths");
    sqlx::query(
        "UPDATE auth_application_vouches SET landed_at = NULL
         WHERE application_id IN (SELECT id FROM auth_applications WHERE account_id = $1)",
    )
    .bind(noa.account)
    .execute(&rig.pool)
    .await
    .expect("clear vouches");
    sqlx::query("UPDATE user_credentials SET account_state = 'applicant' WHERE actor_id = $1")
        .bind(noa.account)
        .execute(&rig.pool)
        .await
        .expect("clear state");
    rig.ingest().await;
    assert_eq!(rig.landed_paths(noa.account).await, winner);
    let me = rig.me(noa.account, "me { invitedBy { handle } }").await;
    assert_eq!(me["me"]["invitedBy"]["handle"], "kel");
}

/// `approved_at` is "this path has a live vouch since": null while
/// waiting, set with the vouch, cleared when it lapses, set again with a
/// new vouch — and a mark left with no vouch behind it (an approval that
/// died between the two) is cleared by the next holder of the account
/// lock, here the poll.
///
/// A path's approval mark mirrors its live vouch through decision, lapse, re-vouch and a dead approval.
/// ´claim:onboarding:approved-at-mirrors-the-live-vouch´
#[sqlx::test(migrations = "../../migrations")]
async fn approved_at_mirrors_the_live_vouch(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let path = rig.registration_path(noa.account).await;
    let live = || store::live_vouch(&rig.pool, path);
    assert!(rig.application(path).await.approved_at.is_none());
    assert!(live().await.expect("query").is_none());

    rig.vouch(&mira, path).await;
    assert!(rig.application(path).await.approved_at.is_some());
    assert!(live().await.expect("query").is_some());

    for _ in 0..3 {
        rig.tick_under(1).await;
    }
    assert!(rig.application(path).await.approved_at.is_none());
    assert!(live().await.expect("query").is_none());

    rig.vouch(&mira, path).await;
    assert!(rig.application(path).await.approved_at.is_some());
    assert!(live().await.expect("query").is_some());

    let dead = rig.applicant(mira.id, "dead").await;
    let dead_path = rig.registration_path(dead.account).await;
    store::approve_application(&rig.pool, dead_path)
        .await
        .expect("query")
        .expect("marks");
    rig.me(dead.account, "me { application { id } }").await;
    assert!(rig.application(dead_path).await.approved_at.is_none());
}

/// The account's application read (seam 099 ruling 66): the landed path;
/// else the approved-not-landed path with the earliest vouch; else the
/// newest waiting path; else the newest closed one — and the read names
/// that row's approver.
///
/// The application read prefers landed, then the earliest live vouch, then the newest open, then the newest closed.
/// ´claim:onboarding:the-application-read-precedence´
#[sqlx::test(migrations = "../../migrations")]
async fn the_application_read_prefers_landed_then_live_vouch_then_open(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let kel = rig.member("kel").await;
    let sol = rig.member("sol").await;
    let noa = rig.applicant(mira.id, "noa").await;

    let registration = rig.registration_path(noa.account).await;
    onboarding::reject_application(&rig.pool, mira.id, registration)
        .await
        .expect("closes");
    assert_eq!(
        read(&rig, noa.account).await,
        (registration.to_string(), "mira".into()),
        "only a closed path"
    );

    let older = rig.path(noa.account, kel.id).await;
    let newer = rig.path(noa.account, sol.id).await;
    assert_eq!(
        read(&rig, noa.account).await,
        (newer.to_string(), "sol".into()),
        "the newest waiting path"
    );

    rig.vouch(&kel, older).await;
    let sol_vouch = rig.vouch(&sol, newer).await;
    assert_eq!(
        read(&rig, noa.account).await,
        (older.to_string(), "kel".into()),
        "the earliest live vouch"
    );

    rig.sign(&sol.key, sol_vouch.id).await;
    rig.sign_registration(&noa).await;
    rig.close().await;
    assert_eq!(
        read(&rig, noa.account).await,
        (newer.to_string(), "sol".into()),
        "the landed path"
    );
}

/// The two provenance reads split (G2, R11). The applicant registered
/// through mira's link and is vouched in by kel on another path: the
/// borrowed view is mira's from the account's first moment through
/// landing until a first Opinion, while `invitedBy` is null before the
/// landing and kel after — and the reciprocation question asks about kel.
///
/// An applicant borrows their link issuer's view, while invitedBy names the voucher who landed them, and only from landing on.
/// ´claim:onboarding:the-issuer-lends-the-voucher-admits´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_borrows_the_issuer_not_the_voucher(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let kel = rig.member("kel").await;
    let noa = rig.applicant(mira.id, "noa").await;
    assert_eq!(
        provenance(&rig, noa.account).await,
        (Some("mira".into()), None, true)
    );

    let kel_path = rig.path(noa.account, kel.id).await;
    let vouch = rig.vouch(&kel, kel_path).await;
    assert_eq!(
        provenance(&rig, noa.account).await,
        (Some("mira".into()), None, true),
        "null before landing"
    );
    rig.sign(&kel.key, vouch.id).await;
    rig.sign_registration(&noa).await;
    rig.close().await;
    assert_eq!(rig.state(noa.account).await, "member");
    assert_eq!(
        provenance(&rig, noa.account).await,
        (Some("mira".into()), Some("kel".into()), false)
    );
}

/// invitedBy is the admitting voucher, so before any landing — whatever
/// was decided and signed — there is none to name.
///
/// invitedBy is null before landing.
/// ´claim:onboarding:invited-by-is-null-before-landing´
#[sqlx::test(migrations = "../../migrations")]
async fn invited_by_is_null_before_landing(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let vouch = rig
        .vouch(&mira, rig.registration_path(noa.account).await)
        .await;
    rig.sign(&mira.key, vouch.id).await;
    let me = rig.me(noa.account, "me { invitedBy { handle } }").await;
    assert!(me["me"]["invitedBy"].is_null());
    rig.sign_registration(&noa).await;
    rig.close().await;
    let me = rig.me(noa.account, "me { invitedBy { handle } }").await;
    assert_eq!(me["me"]["invitedBy"]["handle"], "mira");
}

const PREPARE_STANCE: &str = r#"mutation($input: PrepareStanceInput!) {
  prepareStance(input: $input) {
    writes { id family carried } userErrors { code message }
  }
}"#;

const PREPARE_POST: &str = r#"mutation($input: PreparePostInput!) {
  preparePost(input: $input) {
    node writes { id family carried } userErrors { code message }
  }
}"#;

/// The applicant carries an act through the ordinary mutation; returns
/// the staged ids, every one of them carried.
async fn carry(rig: &Rig, account: Uuid, mutation: &str, input: Value) -> Vec<Uuid> {
    let answer = rig
        .exec(
            Some(account),
            mutation,
            serde_json::json!({ "input": input }),
        )
        .await;
    assert!(
        answer["errors"].as_array().is_none_or(|e| e.is_empty()),
        "{answer}"
    );
    let payload = answer["data"]
        .as_object()
        .and_then(|data| data.values().next())
        .expect("payload");
    assert_eq!(payload["userErrors"], serde_json::json!([]), "{payload}");
    payload["writes"]
        .as_array()
        .expect("writes")
        .iter()
        .map(|w| {
            assert_eq!(w["carried"], true, "{w}");
            w["id"].as_str().expect("id").parse().expect("uuid")
        })
        .collect()
}

fn post_input(text: &str) -> Value {
    serde_json::json!({
        "content": text,
        "license": { "attribution": 0.0, "provenance": 0.0 },
        "tags": [{ "name": "gardening" }],
    })
}

async fn deps_of(rig: &Rig, id: Uuid) -> Vec<String> {
    staged::load(&rig.pool, id)
        .await
        .expect("loads")
        .proposal
        .deps
        .iter()
        .map(ToString::to_string)
        .collect()
}

/// Lands `noa` through mira's vouch: the vouch decided, both signed, one
/// close. Returns the Registration's and the vouch's act ids.
async fn land_through_mira(rig: &Rig, mira: &Member, noa: &Applicant) -> (String, String) {
    let vouch = rig
        .vouch(mira, rig.registration_path(noa.account).await)
        .await;
    rig.sign(&mira.key, vouch.id).await;
    let registration = rig.sign_registration(noa).await;
    rig.close().await;
    assert_eq!(rig.state(noa.account).await, "member");
    (registration.proposal.body.act_id().to_string(), act(&vouch))
}

/// An applicant carries one act of each kind — a post with the topics it
/// declares, an Opinion, an Affinity — through the ordinary mutations:
/// each comes back carried, held as CARRIED, and a second of a kind is
/// refused. The device cannot sign a carried write before the landing.
///
/// An applicant carries one post, one Opinion and one Affinity, each held and unsignable before the landing.
/// ´claim:onboarding:an-applicant-carries-each-kind-once´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_carries_each_kind_once(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;

    let opinion = carry(
        &rig,
        noa.account,
        PREPARE_STANCE,
        serde_json::json!({
            "target": mira.id, "pDirected": 0.3, "pInterest": 0.2,
        }),
    )
    .await;
    let affinity = carry(
        &rig,
        noa.account,
        PREPARE_STANCE,
        serde_json::json!({
            "topicName": "gardening", "pDirected": 0.5, "pInterest": 0.5,
        }),
    )
    .await;
    let post = carry(&rig, noa.account, PREPARE_POST, post_input("a first word")).await;
    assert_eq!(post.len(), 2, "the Publish and the Tag it declares");
    for id in opinion.iter().chain(&affinity).chain(&post) {
        assert_eq!(
            staged::load(&rig.pool, *id).await.expect("loads").state,
            StagedState::Carried
        );
    }

    for (mutation, input) in [
        (
            PREPARE_STANCE,
            serde_json::json!({ "target": mira.id, "pDirected": 0.1, "pInterest": 0.1 }),
        ),
        (PREPARE_POST, post_input("a second word")),
    ] {
        let answer = rig
            .exec(
                Some(noa.account),
                mutation,
                serde_json::json!({ "input": input }),
            )
            .await;
        let payload = answer["data"]
            .as_object()
            .and_then(|data| data.values().next())
            .expect("payload");
        assert_eq!(payload["userErrors"][0]["code"], "BAD_INPUT", "{payload}");
    }

    let write = staged::load(&rig.pool, opinion[0]).await.expect("loads");
    let pre = noa.key.pre_sign(write.proposal.clone());
    assert!(
        api::relay::submit_pre_signed(
            &rig.boundary,
            &rig.pool,
            opinion[0],
            PreSignedParts {
                author_pubkey: pre.author_pubkey.clone(),
                nonce: pre.nonce.clone(),
                pre_signature: pre.pre_signature.clone(),
            },
        )
        .await
        .is_err(),
        "a carried write is not the device's to sign before the landing"
    );
}

/// A carried act is its author's alone until the landing (seam 099 ruling
/// 70): the carried post is no content anyone — the author included — can
/// read as a node, it is listed only in its author's own staged writes,
/// and the carried Opinion counts only in its author's own pending stance.
///
/// A carried act is seen by its author alone until the landing.
/// ´claim:onboarding:a-carried-act-is-author-only´
#[sqlx::test(migrations = "../../migrations")]
async fn a_carried_act_is_seen_by_its_author_alone(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    carry(
        &rig,
        noa.account,
        PREPARE_STANCE,
        serde_json::json!({
            "target": mira.id, "pDirected": 0.3, "pInterest": 0.2,
        }),
    )
    .await;
    let answer = rig
        .exec(
            Some(noa.account),
            PREPARE_POST,
            serde_json::json!({ "input": post_input("for my eyes") }),
        )
        .await;
    let node = answer["data"]["preparePost"]["node"]
        .as_str()
        .expect("node")
        .to_string();

    for viewer in [Some(mira.id), Some(noa.account), None] {
        let read = rig
            .exec(
                viewer,
                "query($id: UUID!) { post(id: $id) { id } }",
                serde_json::json!({ "id": node }),
            )
            .await;
        assert!(read["data"]["post"].is_null(), "{viewer:?}: {read}");
    }
    let own = rig
        .me(
            noa.account,
            "me { stagedWrites(first: 10) { edges { node { state carried } } } }",
        )
        .await;
    assert_eq!(
        own["me"]["stagedWrites"]["edges"]
            .as_array()
            .expect("edges")
            .len(),
        3
    );
    let theirs = rig
        .exec(
            Some(mira.id),
            "query($id: UUID!) { user(id: $id) { stagedWrites(first: 10) { edges { node { id } } } } }",
            serde_json::json!({ "id": noa.account }),
        )
        .await;
    assert!(theirs["data"]["user"]["stagedWrites"].is_null(), "{theirs}");

    let mine = api::stance::bundle(&rig.pool, noa.account, mira.id, true)
        .await
        .expect("bundle");
    assert!(
        (mine.p_d - 0.3).abs() < 1e-9,
        "the face wears the carried pick"
    );
}

/// At the landing the carried acts become one batch (seam 099 ruling 73):
/// every write gains the dependencies `[admission Registration, winning
/// vouch]`, moves to AWAITING_PRE_SIGN still marked carried, and — signed
/// by the device without a prompt — lands at the first close after the
/// landing. Nothing of it reached the graph before.
///
/// The carried acts sign at the landing as one batch depending on the Registration and the winning vouch.
/// ´claim:onboarding:the-carried-batch-signs-at-the-landing´
#[sqlx::test(migrations = "../../migrations")]
async fn the_carried_batch_signs_at_the_landing(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let mut batch = carry(
        &rig,
        noa.account,
        PREPARE_STANCE,
        serde_json::json!({
            "target": mira.id, "pDirected": 0.3, "pInterest": 0.2,
        }),
    )
    .await;
    batch.extend(
        carry(
            &rig,
            noa.account,
            PREPARE_STANCE,
            serde_json::json!({
                "topicName": "gardening", "pDirected": 0.5, "pInterest": 0.5,
            }),
        )
        .await,
    );
    batch.extend(carry(&rig, noa.account, PREPARE_POST, post_input("hello")).await);
    let before: Vec<Vec<String>> = {
        let mut all = Vec::new();
        for id in &batch {
            all.push(deps_of(&rig, *id).await);
        }
        all
    };

    let (registration, vouch) = land_through_mira(&rig, &mira, &noa).await;
    for (id, old) in batch.iter().zip(before) {
        let write = staged::load(&rig.pool, *id).await.expect("loads");
        assert_eq!(write.state, StagedState::AwaitingPreSign);
        assert!(write.carried);
        let mut expected = old;
        expected.extend([registration.clone(), vouch.clone()]);
        assert_eq!(deps_of(&rig, *id).await, expected);
    }
    let on_graph: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mirror_records WHERE author = $1")
        .bind(noa.key.address())
        .fetch_one(&rig.pool)
        .await
        .expect("count");
    assert_eq!(on_graph, 1, "only the Registration so far");

    for id in &batch {
        rig.sign(&noa.key, *id).await;
    }
    rig.close().await;
    for id in &batch {
        assert_eq!(
            staged::load(&rig.pool, *id).await.expect("loads").state,
            StagedState::Landed,
            "the batch lands at the first close after the landing"
        );
    }
}

/// Custody is the server's (seam 099 ruling 68): carried acts wait out any
/// number of epochs uncollected, and the device that staged them is not
/// needed — the author, on a new device with their key restored from its
/// backup and no handshake material at all, signs the batch at the landing.
///
/// A carried act survives the GC and the loss of the device that staged it.
/// ´claim:onboarding:a-carried-act-survives-the-loss-of-its-device´
#[sqlx::test(migrations = "../../migrations")]
async fn a_carried_act_survives_the_loss_of_its_device(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let carried = carry(
        &rig,
        noa.account,
        PREPARE_STANCE,
        serde_json::json!({
            "target": mira.id, "pDirected": 0.3, "pInterest": 0.2,
        }),
    )
    .await;
    for _ in 0..4 {
        rig.tick_under(1).await;
    }
    assert_eq!(
        staged::load(&rig.pool, carried[0])
            .await
            .expect("loads")
            .state,
        StagedState::Carried,
        "never collected while it waits"
    );

    let restored = Applicant {
        account: noa.account,
        key: ActorKey::from_seed(noa.key.seed()),
    };
    drop(noa);
    land_through_mira(&rig, &mira, &restored).await;
    rig.sign(&restored.key, carried[0]).await;
    rig.close().await;
    assert_eq!(
        staged::load(&rig.pool, carried[0])
            .await
            .expect("loads")
            .state,
        StagedState::Landed
    );
}

/// A carried Opinion toward content that is itself still in flight
/// declares that content's minting act as a dependency, like any stance
/// on pending content; released at the landing with its two landing
/// dependencies added, it signs and then waits on L1 for a target that
/// never lands — the deps machinery defers it, nothing is forced.
///
/// A carried act toward a target that never lands defers on L1.
/// ´claim:onboarding:a-carried-act-toward-an-unlanded-target-defers´
#[sqlx::test(migrations = "../../migrations")]
async fn a_carried_act_toward_a_target_that_never_lands_defers(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let sol = rig.member("sol").await;
    let noa = rig.applicant(mira.id, "noa").await;

    let pending = crate_post(&rig, &sol).await;
    let carried = carry(
        &rig,
        noa.account,
        PREPARE_STANCE,
        serde_json::json!({
            "target": pending.node, "pDirected": 0.4, "pInterest": 0.4,
        }),
    )
    .await;
    let publish = pending.writes[0].proposal.body.act_id().to_string();
    assert!(deps_of(&rig, carried[0]).await.contains(&publish));

    land_through_mira(&rig, &mira, &noa).await;
    rig.sign(&noa.key, carried[0]).await;
    rig.tick_under(rig.cfg.gc_after_epochs).await;
    let act_id = staged::load(&rig.pool, carried[0])
        .await
        .expect("loads")
        .proposal
        .body
        .act_id()
        .to_string();
    let status: String = sqlx::query_scalar("SELECT status FROM l1_acts WHERE act_id = $1")
        .bind(&act_id)
        .fetch_one(&rig.pool)
        .await
        .expect("status");
    assert_eq!(
        status, "approved",
        "signed, and deferred on its unlanded target"
    );
}

/// A post by `author`, pre-committed and sealed but never approved: its
/// content is pending on screen and its record will never land.
async fn crate_post(rig: &Rig, author: &Member) -> api::content::PreparedContent {
    let prepared = api::content::prepare_post(
        &rig.pool,
        &rig.boundary,
        api::prepare::Staging::unbudgeted(rig.cfg.gc_after_epochs),
        author.id,
        api::content::PostDraft {
            title: None,
            description: None,
            content: Some("a draft that never lands".into()),
            license: api::content::License::PUBLIC_DOMAIN,
            p_directed: None,
            tags: vec![],
            references: vec![],
            attachments: vec![],
            sensitive: api::content::SelfMarkDraft::default(),
        },
    )
    .await
    .expect("prepares");
    let write = staged::load(&rig.pool, prepared.writes[0].id)
        .await
        .expect("loads");
    let pre = author.key.pre_sign(write.proposal.clone());
    api::relay::submit_pre_signed(
        &rig.boundary,
        &rig.pool,
        write.id,
        PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        },
    )
    .await
    .expect("seals");
    prepared
}

/// The batch is released by the landing that completes the ceremony and
/// by nothing else: evaluations racing over the same mirror facts, and
/// evaluations after it, add the landing dependencies exactly once.
///
/// The carried batch is released once however often the landing is evaluated.
/// ´claim:onboarding:the-carried-batch-is-released-once´
#[sqlx::test(migrations = "../../migrations")]
async fn the_carried_batch_is_released_once(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    let carried = carry(
        &rig,
        noa.account,
        PREPARE_STANCE,
        serde_json::json!({
            "topicName": "gardening", "pDirected": 0.5, "pInterest": 0.5,
        }),
    )
    .await;
    let before = deps_of(&rig, carried[0]).await.len();
    let vouch = rig
        .vouch(&mira, rig.registration_path(noa.account).await)
        .await;
    rig.sign(&mira.key, vouch.id).await;
    rig.sign_registration(&noa).await;
    rig.standin
        .close_epoch()
        .await
        .expect("closes")
        .expect("publishes");

    let (ingested, raced) = tokio::join!(
        api::ingest::ingest_pending(&rig.boundary, &rig.pool, rig.cfg.gc_after_epochs),
        onboarding::land_ready_accounts(&rig.pool),
    );
    ingested.expect("ingests");
    assert!(raced.is_empty(), "{raced:?}");
    let (a, b) = tokio::join!(
        onboarding::land_ready_accounts(&rig.pool),
        onboarding::land_ready_accounts(&rig.pool),
    );
    assert!(a.is_empty() && b.is_empty());
    rig.ingest().await;
    assert_eq!(rig.state(noa.account).await, "member");
    assert_eq!(deps_of(&rig, carried[0]).await.len(), before + 2);
}

/// An applicant who carried nothing lands as before: an empty batch,
/// nothing released, no failure.
///
/// An applicant who staged nothing lands with an empty batch.
/// ´claim:onboarding:an-empty-batch-lands-cleanly´
#[sqlx::test(migrations = "../../migrations")]
async fn an_applicant_who_staged_nothing_lands_with_an_empty_batch(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let mira = rig.member("mira").await;
    let noa = rig.applicant(mira.id, "noa").await;
    land_through_mira(&rig, &mira, &noa).await;
    let carried: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM staged_writes WHERE actor_id = $1 AND carried")
            .bind(noa.account)
            .fetch_one(&rig.pool)
            .await
            .expect("count");
    assert_eq!(carried, 0);
}
