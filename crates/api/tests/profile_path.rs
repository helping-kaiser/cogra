//! Slice 2.1 — profile editing end to end against the stand-in
//! (roadmap "Slice 2.1"): the parallel Registration through the
//! five-step write path, the copy-forward merge into
//! actor_profile_versions, the edit chain, and every refusal branch
//! the prepare surface owns — empty updates, the display-name clear,
//! serialization, and the missing anchor.

use api::l1::{L1Boundary, StandInBoundary};
use api::prepare::{Gesture, Target};
use api::profile::{self, ProfileError, ProfileUpdateDraft};
use common::l1::census::Family;
use common::l1::client::ActorKey;
use common::l1::identifier::NodeId;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::staged::{self, PreSignedParts};
use postgres_store::{genesis, mirror, profile as profile_store};
use sqlx::PgPool;
use uuid::Uuid;

const GC: i64 = 8;

struct Rig {
    pool: PgPool,
    standin: StandIn,
    boundary: StandInBoundary,
}

impl Rig {
    async fn new(pool: PgPool) -> Self {
        let standin = StandIn::new(pool.clone(), StandInConfig::default());
        let boundary = StandInBoundary(standin.clone());
        Self {
            pool,
            standin,
            boundary,
        }
    }

    async fn funded_actor(&self, handle: &str) -> (Uuid, ActorKey) {
        let key = ActorKey::generate();
        let id = Uuid::new_v4();
        let mut conn = self.pool.acquire().await.expect("conn");
        genesis::insert_actor(
            &mut conn,
            id,
            "user",
            handle,
            &key.public_key_bytes(),
            &key.address(),
        )
        .await
        .expect("actor row");
        genesis::insert_profile_version(&mut conn, id, handle, None)
            .await
            .expect("seed profile");
        self.standin
            .credit_burn(&key.address(), 10_000_000)
            .await
            .expect("burn");
        (id, key)
    }

    /// A funded actor whose anchoring Registration has landed — the
    /// member shape every profile update chains from. The anchor
    /// carries the admission's pre-PCE payload shape (empty here), so
    /// the profile promotion must skip it.
    async fn registered_actor(&self, handle: &str) -> (Uuid, ActorKey) {
        let (id, key) = self.funded_actor(handle).await;
        let prepared = api::prepare::prepare(
            &self.boundary,
            &self.pool,
            GC,
            id,
            Gesture {
                author: key.address(),
                family: Family::Registration,
                middle: None,
                target: Target::Node(NodeId::Prof(key.address())),
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
        .expect("prepares anchor");
        self.sign_and_relay(prepared.id, &key).await;
        self.close_and_ingest().await;
        (id, key)
    }

    async fn sign_and_relay(&self, id: Uuid, key: &ActorKey) {
        let write = staged::load(&self.pool, id).await.expect("loads");
        let pre = key.pre_sign(write.proposal);
        let parts = PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        };
        let sealed = api::relay::submit_pre_signed(&self.boundary, &self.pool, id, parts)
            .await
            .expect("seals");
        let host_key = self.boundary.host_public_key().await.expect("host key");
        let witness = key.approve(&pre, &sealed, &host_key).expect("approves");
        api::relay::submit_approval(&self.boundary, &self.pool, id, witness.approval_signature)
            .await
            .expect("relays");
    }

    async fn close_and_ingest(&self) {
        let outcome = self.close_and_ingest_raw().await;
        assert!(
            outcome.promotion_failures.is_empty(),
            "confirm-side promotion failed: {:?}",
            outcome.promotion_failures
        );
    }

    async fn close_and_ingest_raw(&self) -> api::ingest::IngestOutcome {
        self.standin.close_epoch().await.expect("closes");
        api::ingest::ingest_pending(&self.boundary, &self.pool, GC)
            .await
            .expect("ingests")
    }

    async fn update(
        &self,
        actor: Uuid,
        draft: ProfileUpdateDraft,
    ) -> Result<api::prepare::Prepared, ProfileError> {
        profile::prepare_profile_update(&self.pool, &self.boundary, GC, actor, draft).await
    }

    /// Drives one profile update through signatures and confirm.
    async fn land_update(&self, actor: Uuid, key: &ActorKey, draft: ProfileUpdateDraft) {
        let prepared = self.update(actor, draft).await.expect("prepares update");
        self.sign_and_relay(prepared.id, key).await;
        self.close_and_ingest().await;
    }

    async fn version_count(&self, actor: Uuid) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM actor_profile_versions WHERE actor_id = $1")
            .bind(actor)
            .fetch_one(&self.pool)
            .await
            .expect("counts")
    }

    async fn payload_count(&self) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM act_payloads")
            .fetch_one(&self.pool)
            .await
            .expect("counts")
    }
}

fn draft(
    display_name: Option<&str>,
    bio: Option<&str>,
    website_url: Option<&str>,
) -> ProfileUpdateDraft {
    ProfileUpdateDraft {
        display_name: display_name.map(Into::into),
        bio: bio.map(Into::into),
        website_url: website_url.map(Into::into),
        avatar_media_id: None,
    }
}

/// A landed update appends a merged version row and puts its envelope
/// into permanent carriage. The payload counts bracket that: the anchor's
/// own empty payload never reaches carriage, so the count moves from zero
/// to one across the update.
///
/// A landed update appends a merged version row and puts its envelope into permanent carriage, the anchor's own empty payload never reaching carriage at all.
/// ´claim:profile:an-update-lands-a-merged-version-and-its-envelope´
#[sqlx::test(migrations = "../../migrations")]
async fn profile_update_lands_a_merged_version_row(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.registered_actor("ada").await;
    assert_eq!(rig.version_count(actor).await, 1);
    assert_eq!(rig.payload_count().await, 0);

    rig.land_update(actor, &key, draft(Some("Ada L"), Some("Curious."), None))
        .await;

    let current = profile_store::current_profile(&rig.pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(current.display_name, "Ada L");
    assert_eq!(current.bio.as_deref(), Some("Curious."));
    assert_eq!(current.website_url, None);
    assert_eq!(rig.version_count(actor).await, 2);
    assert_eq!(rig.payload_count().await, 1);
}

/// A second update asserts the current chain head as its causal parent,
/// and its merge is per-field: clearing the bio leaves everything the
/// first update set untouched.
///
/// A second update asserts the current chain head as its parent and merges per field, so clearing one field leaves the rest as the first update set them.
/// ´claim:profile:updates-chain-and-merge-per-field´
#[sqlx::test(migrations = "../../migrations")]
async fn second_update_chains_behind_the_head_and_merges(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.registered_actor("ada").await;
    rig.land_update(
        actor,
        &key,
        draft(None, Some("First bio"), Some("https://ada.example")),
    )
    .await;

    let address = key.address();
    let prof = NodeId::Prof(address.clone()).to_string();
    let head = mirror::chain_head(&rig.pool, &address, Family::Registration, &prof)
        .await
        .expect("reads head")
        .expect("has head");
    let prepared = rig
        .update(actor, draft(None, Some(""), None))
        .await
        .expect("prepares");
    assert_eq!(
        prepared
            .proposal
            .body
            .asserted_parents
            .iter()
            .map(|p| p.to_string())
            .collect::<Vec<_>>(),
        vec![head]
    );
    rig.sign_and_relay(prepared.id, &key).await;
    rig.close_and_ingest().await;

    let current = profile_store::current_profile(&rig.pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(current.display_name, "ada");
    assert_eq!(current.bio, None);
    assert_eq!(current.website_url.as_deref(), Some("https://ada.example"));
    assert_eq!(rig.version_count(actor).await, 3);
}

/// A promotion that cannot complete names itself in the ingestion
/// outcome rather than leaving the caller with a version row that
/// silently never appeared. The failure is forced by removing the current
/// version: the merge copies unchanged fields forward from it, so without
/// one the promotion cannot build the new row.
///
/// A promotion that cannot complete names itself in the ingestion outcome rather than leaving the caller with a version row that silently never appeared.
/// ´claim:profile:a-failed-promotion-names-itself´
#[sqlx::test(migrations = "../../migrations")]
async fn a_failed_promotion_rides_the_ingestion_outcome(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.registered_actor("ada").await;
    let prepared = rig
        .update(actor, draft(Some("Ada L"), None, None))
        .await
        .expect("prepares update");
    rig.sign_and_relay(prepared.id, &key).await;
    sqlx::query("DELETE FROM actor_profile_versions WHERE actor_id = $1")
        .bind(actor)
        .execute(&rig.pool)
        .await
        .expect("clears versions");

    let outcome = rig.close_and_ingest_raw().await;

    let failure = match outcome.promotion_failures.as_slice() {
        [only] => only,
        other => panic!("expected one reported failure, got {other:?}"),
    };
    assert_eq!(failure.stage, "profile");
    assert_eq!(failure.staged, prepared.id);
    assert!(
        failure.error.contains("seeded profile version"),
        "unexpected: {}",
        failure.error
    );
    assert_eq!(rig.version_count(actor).await, 0);
}

/// An update carrying no change is refused as the empty gesture it is.
/// ´claim:profile:an-empty-update-is-refused´
#[sqlx::test(migrations = "../../migrations")]
async fn refuses_an_empty_update(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, _key) = rig.registered_actor("ada").await;
    match rig.update(actor, draft(None, None, None)).await {
        Err(ProfileError::BadInput { field, .. }) => assert_eq!(field, "input"),
        other => panic!("expected BadInput, got {other:?}"),
    }
}

/// A display name cannot be cleared, an actor always having one.
/// ´claim:profile:a-display-name-cannot-be-cleared´
#[sqlx::test(migrations = "../../migrations")]
async fn refuses_the_display_name_clear(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, _key) = rig.registered_actor("ada").await;
    match rig.update(actor, draft(Some(""), None, None)).await {
        Err(ProfileError::BadInput { field, .. }) => assert_eq!(field, "displayName"),
        other => panic!("expected BadInput, got {other:?}"),
    }
}

/// Only one update may be in flight per profile, so a second prepare is
/// refused while the first is unlanded. Landing the first frees the chain
/// for the next.
///
/// One update at a time per profile: a second prepare is refused while the first is unlanded, and landing the first frees the chain.
/// ´claim:profile:updates-are-serialized-per-profile´
#[sqlx::test(migrations = "../../migrations")]
async fn refuses_a_second_in_flight_update(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.registered_actor("ada").await;
    let first = rig
        .update(actor, draft(None, Some("bio"), None))
        .await
        .expect("prepares");
    match rig.update(actor, draft(None, Some("again"), None)).await {
        Err(ProfileError::BadInput { field, .. }) => assert_eq!(field, "input"),
        other => panic!("expected BadInput, got {other:?}"),
    }
    rig.sign_and_relay(first.id, &key).await;
    rig.close_and_ingest().await;
    rig.update(actor, draft(None, Some("again"), None))
        .await
        .expect("prepares after landing");
}

/// An update needs the anchoring Registration to chain behind.
/// ´claim:profile:an-update-needs-its-anchor´
#[sqlx::test(migrations = "../../migrations")]
async fn refuses_an_update_without_the_anchoring_registration(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, _key) = rig.funded_actor("ada").await;
    match rig.update(actor, draft(None, Some("bio"), None)).await {
        Err(ProfileError::Internal(message)) => {
            assert!(message.contains("chain head"), "unexpected: {message}");
        }
        other => panic!("expected Internal, got {other:?}"),
    }
}

mod pictures {
    //! ´mod:module:pictures´
    //!
    //! The avatar slot — the profile's one image — whose three values
    //! differ from every other profile field's two.

    use super::*;
    use postgres_store::media as media_store;

    async fn asset(pool: &PgPool, author: Uuid, fill: u8) -> Uuid {
        let id = Uuid::new_v4();
        media_store::insert(
            pool,
            id,
            author,
            &[fill; 32],
            "sha256",
            &format!("{id}.webp"),
            "image/webp",
            1024,
            Some("a face"),
            &serde_json::json!({ "v": 1, "aspect_ratio": "1:1" }),
        )
        .await
        .expect("asset row");
        id
    }

    fn with_picture(avatar: Option<Option<Uuid>>) -> ProfileUpdateDraft {
        ProfileUpdateDraft {
            avatar_media_id: avatar,
            ..draft(None, None, None)
        }
    }

    async fn current(pool: &PgPool, actor: Uuid) -> Option<Uuid> {
        profile_store::current_profile(pool, actor)
            .await
            .expect("reads")
            .expect("profile")
            .avatar_id
    }

    /// All three values, in the one order that tells them apart: set,
    /// then leave alone, then clear. A two-valued field could not express
    /// the middle step — which is why the slot is nested rather than
    /// borrowing the text fields' empty-string clear.
    ///
    /// A picture slot carries three states and not two, which is why it is nested rather than borrowing the text fields' empty-string clear.
    /// ´claim:profile:a-picture-slot-carries-three-states´
    #[sqlx::test(migrations = "../../migrations")]
    async fn a_picture_slot_is_set_then_untouched_then_cleared(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, key) = rig.registered_actor("ada").await;
        let face = asset(&rig.pool, actor, 1).await;

        rig.land_update(actor, &key, with_picture(Some(Some(face))))
            .await;
        assert_eq!(current(&rig.pool, actor).await, Some(face));

        rig.land_update(actor, &key, draft(None, Some("a new bio"), None))
            .await;
        assert_eq!(
            current(&rig.pool, actor).await,
            Some(face),
            "an update that says nothing about the picture leaves it"
        );

        rig.land_update(actor, &key, with_picture(Some(None))).await;
        assert_eq!(
            current(&rig.pool, actor).await,
            None,
            "an explicit clear takes the avatar back to the monogram"
        );
    }

    /// The anti-hijack rule reaches a profile picture too: an avatar must
    /// be an asset this account uploaded.
    ///
    /// An avatar must be an asset this account uploaded, the anti-hijack rule reaching the profile picture too.
    /// ´claim:profile:an-avatar-must-be-the-accounts-own-asset´
    #[sqlx::test(migrations = "../../migrations")]
    async fn a_picture_slot_refuses_someone_elses_asset(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, _key) = rig.registered_actor("ada").await;
        let (stranger, _stranger_key) = rig.registered_actor("mallory").await;
        let theirs = asset(&rig.pool, stranger, 3).await;

        match rig.update(actor, with_picture(Some(Some(theirs)))).await {
            Err(ProfileError::Media(e)) => {
                assert_eq!(e.path, vec!["avatarMediaId".to_string()]);
            }
            other => panic!("expected a media refusal, got {other:?}"),
        }

        match rig
            .update(actor, with_picture(Some(Some(Uuid::new_v4()))))
            .await
        {
            Err(ProfileError::Media(e)) => {
                assert_eq!(e.path, vec!["avatarMediaId".to_string()]);
            }
            other => panic!("expected a media refusal, got {other:?}"),
        }
    }

    /// A picture on its own is a change, so an update carrying only one
    /// is not the empty update the surface refuses.
    ///
    /// (´claim:profile:an-empty-update-is-refused´)
    #[sqlx::test(migrations = "../../migrations")]
    async fn a_picture_alone_is_enough_to_be_an_update(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, _key) = rig.registered_actor("ada").await;
        let face = asset(&rig.pool, actor, 1).await;
        rig.update(actor, with_picture(Some(Some(face))))
            .await
            .expect("prepares");
    }
}
