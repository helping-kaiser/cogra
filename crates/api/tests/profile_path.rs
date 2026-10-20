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
const STAGING: api::prepare::Staging = api::prepare::Staging::unbudgeted(GC);

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
        profile::prepare_profile_update(&self.pool, &self.boundary, STAGING, actor, draft).await
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

/// The current profile, read the way every viewer's profile read takes it.
async fn current(pool: &PgPool, actor: Uuid) -> profile_store::ProfileVersion {
    profile_store::current_profile(pool, actor)
        .await
        .expect("reads")
        .expect("has profile")
}

/// A signed update is the author's content from the signature on: its
/// merged version row is written at the pre-commitment, marked pending,
/// and the current-profile read — the one every viewer's profile goes
/// through, with no viewer in it — serves it at once, dated by the
/// authoring instant. Landing then drops the mark on that same row rather
/// than appending another, so the date and the content never jump.
///
/// A signed profile update is served to every reader from its pre-commitment, marked pending, and its landing flips that same row rather than appending another.
/// ´claim:profile:a-signed-update-is-served-pending-until-it-lands´
#[sqlx::test(migrations = "../../migrations")]
async fn a_signed_update_is_served_pending_until_it_lands(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.registered_actor("ada").await;
    rig.land_update(actor, &key, draft(None, None, Some("https://ada.example")))
        .await;

    let prepared = rig
        .update(actor, draft(Some("Ada L"), Some("Curious."), None))
        .await
        .expect("prepares update");
    rig.sign_and_relay(prepared.id, &key).await;
    let authored = staged::load(&rig.pool, prepared.id)
        .await
        .expect("loads")
        .pre_signed_at
        .expect("signed");

    let pending = current(&rig.pool, actor).await;
    assert!(pending.pending, "an unlanded update is marked pending");
    assert_eq!(pending.display_name, "Ada L");
    assert_eq!(pending.bio.as_deref(), Some("Curious."));
    assert_eq!(
        pending.website_url.as_deref(),
        Some("https://ada.example"),
        "the pending row is the merged copy-forward version"
    );
    assert_eq!(pending.created_at, authored);
    let landed = profile_store::landed_profile(&rig.pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(landed.display_name, "ada", "the landed profile is untouched");
    assert_eq!(rig.version_count(actor).await, 3);

    rig.close_and_ingest().await;

    let after = current(&rig.pool, actor).await;
    assert!(!after.pending, "landing drops the mark");
    assert_eq!(after.display_name, "Ada L");
    assert_eq!(after.created_at, authored, "the date never jumps");
    assert_eq!(
        rig.version_count(actor).await,
        3,
        "landing flips the pending row rather than appending another"
    );
}

/// The pre-sign leg accepts a retry, and staging is idempotent with it:
/// the retry merges onto the same landed base and its row collides with
/// the one already written.
///
/// A retried pre-signature stages no second profile version.
/// ´claim:profile:a-retried-pre-sign-stages-one-row´
#[sqlx::test(migrations = "../../migrations")]
async fn a_retried_pre_sign_stages_one_row(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.registered_actor("ada").await;
    let prepared = rig
        .update(actor, draft(Some("Ada L"), None, None))
        .await
        .expect("prepares update");
    rig.sign_and_relay(prepared.id, &key).await;
    let write = staged::load(&rig.pool, prepared.id).await.expect("loads");
    api::content::stage_pending(&rig.pool, &write, write.pre_signed_at.expect("signed"))
        .await
        .expect("restages");
    assert_eq!(rig.version_count(actor).await, 2);
    assert_eq!(current(&rig.pool, actor).await.display_name, "Ada L");
}

/// An update that expires unlanded takes its pending row with it, in the
/// same transaction, and the previous version renders again — on the
/// graph nothing was ever written, so nothing is left behind.
///
/// An expired profile update leaves no row behind, and the previous version renders again.
/// ´claim:profile:an-expired-update-falls-back-to-the-previous-version´
#[sqlx::test(migrations = "../../migrations")]
async fn an_expired_update_falls_back_to_the_previous_version(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.registered_actor("ada").await;
    rig.land_update(actor, &key, draft(None, Some("Landed bio"), None))
        .await;
    let prepared = rig
        .update(actor, draft(None, Some("Pending bio"), None))
        .await
        .expect("prepares update");
    rig.sign_and_relay(prepared.id, &key).await;
    assert_eq!(
        current(&rig.pool, actor).await.bio.as_deref(),
        Some("Pending bio")
    );

    staged::expire_one(&rig.pool, prepared.id, 999)
        .await
        .expect("expires");

    let after = current(&rig.pool, actor).await;
    assert!(!after.pending);
    assert_eq!(after.bio.as_deref(), Some("Landed bio"), "the bio rolls back");
    assert_eq!(rig.version_count(actor).await, 2);
}

/// A record that lands after its write expired still promotes — the
/// mirror governs — and with its pending row gone, landing appends the
/// merged version under the record's own coordinates instead.
///
/// A profile update landing after its pending row expired still lands its version.
/// ´claim:profile:an-update-landing-after-expiry-still-lands´
#[sqlx::test(migrations = "../../migrations")]
async fn an_update_landing_after_expiry_still_lands(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.registered_actor("ada").await;
    let prepared = rig
        .update(actor, draft(Some("Ada L"), None, None))
        .await
        .expect("prepares update");
    rig.sign_and_relay(prepared.id, &key).await;
    let authored = staged::load(&rig.pool, prepared.id)
        .await
        .expect("loads")
        .pre_signed_at;
    staged::expire_one(&rig.pool, prepared.id, 0)
        .await
        .expect("expires");
    assert_eq!(current(&rig.pool, actor).await.display_name, "ada");

    rig.close_and_ingest().await;

    let after = current(&rig.pool, actor).await;
    assert!(!after.pending);
    assert_eq!(after.display_name, "Ada L");
    assert_eq!(Some(after.created_at), authored);
    assert_eq!(rig.version_count(actor).await, 2);
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

/// Each of the three text fields answers to its own cap, Unicode scalar
/// values like every character cap on this surface. `None` (untouched)
/// and `Some("")` (the clear sentinel, where clearing is allowed) both
/// pass through unchecked — the cap bounds what an author writes, not
/// the absence of a write.
///
/// The at-cap case lands (rather than just prepares) between fields:
/// only one update may be in flight per profile, so a landed success is
/// what frees the chain for the next field's own cap check.
///
/// A profile's display name, bio, and website URL are each capped at their own length, in Unicode scalar values.
/// ´claim:profile:the-text-fields-answer-to-their-own-caps´
#[sqlx::test(migrations = "../../migrations")]
async fn the_text_fields_are_capped_at_their_own_lengths(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.registered_actor("ada").await;

    let at_cap = "é".repeat(profile::MAX_DISPLAY_NAME_CHARS);
    rig.land_update(actor, &key, draft(Some(&at_cap), None, None))
        .await;
    let over = "x".repeat(profile::MAX_DISPLAY_NAME_CHARS + 1);
    match rig.update(actor, draft(Some(&over), None, None)).await {
        Err(ProfileError::BadInput { field, .. }) => assert_eq!(field, "displayName"),
        other => panic!("expected BadInput, got {other:?}"),
    }

    let at_cap = "é".repeat(profile::MAX_BIO_CHARS);
    rig.land_update(actor, &key, draft(None, Some(&at_cap), None))
        .await;
    let over = "x".repeat(profile::MAX_BIO_CHARS + 1);
    match rig.update(actor, draft(None, Some(&over), None)).await {
        Err(ProfileError::BadInput { field, .. }) => assert_eq!(field, "bio"),
        other => panic!("expected BadInput, got {other:?}"),
    }

    let at_cap = "é".repeat(profile::MAX_WEBSITE_URL_CHARS);
    rig.land_update(actor, &key, draft(None, None, Some(&at_cap)))
        .await;
    let over = "x".repeat(profile::MAX_WEBSITE_URL_CHARS + 1);
    match rig.update(actor, draft(None, None, Some(&over))).await {
        Err(ProfileError::BadInput { field, .. }) => assert_eq!(field, "websiteUrl"),
        other => panic!("expected BadInput, got {other:?}"),
    }
}

/// Only one update may be in flight per profile, so a second prepare is
/// refused while the first is signed and unlanded. Landing the first frees
/// the chain for the next.
///
/// One update at a time per profile: a second prepare is refused while the first is signed and unlanded, and landing the first frees the chain.
/// ´claim:profile:updates-are-serialized-per-profile´
#[sqlx::test(migrations = "../../migrations")]
async fn refuses_a_second_in_flight_update(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.registered_actor("ada").await;
    let first = rig
        .update(actor, draft(None, Some("bio"), None))
        .await
        .expect("prepares");
    rig.sign_and_relay(first.id, &key).await;
    match rig.update(actor, draft(None, Some("again"), None)).await {
        Err(ProfileError::BadInput { field, .. }) => assert_eq!(field, "input"),
        other => panic!("expected BadInput, got {other:?}"),
    }
    rig.close_and_ingest().await;
    rig.update(actor, draft(None, Some("again"), None))
        .await
        .expect("prepares after landing");
}

/// A prepared update nobody signed — the device refused it, or the
/// response never arrived — is superseded by the next prepare rather than
/// holding the profile until GC, and can no longer be signed, so the chain
/// still never branches. The successor lands as any update does.
///
/// An unsigned prepared update is superseded by the next prepare and can no longer be signed, so the next update lands without waiting for GC.
/// ´claim:profile:an-unsigned-update-is-superseded´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unsigned_update_is_superseded_by_the_next(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.registered_actor("ada").await;
    let abandoned = rig
        .update(actor, draft(None, Some(""), Some("")))
        .await
        .expect("prepares");
    let next = rig
        .update(actor, draft(None, Some("Curious."), None))
        .await
        .expect("an unsigned update holds nothing");
    assert_eq!(
        next.proposal.body.asserted_parents, abandoned.proposal.body.asserted_parents,
        "the successor chains behind the same head"
    );
    let write = staged::load(&rig.pool, abandoned.id).await.expect("loads");
    assert_eq!(write.state, staged::StagedState::Expired);
    let pre = key.pre_sign(write.proposal);
    let refused = api::relay::submit_pre_signed(
        &rig.boundary,
        &rig.pool,
        abandoned.id,
        PreSignedParts {
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
        },
    )
    .await;
    assert!(refused.is_err(), "a superseded update can never be signed");

    rig.sign_and_relay(next.id, &key).await;
    rig.close_and_ingest().await;
    let current = profile_store::current_profile(&rig.pool, actor)
        .await
        .expect("reads")
        .expect("has profile");
    assert_eq!(current.bio.as_deref(), Some("Curious."));
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
            &serde_json::json!({ "v": 1, "aspect_ratio": "1:1" }),
            media_store::MediaScale::Post,
        )
        .await
        .expect("asset row");
        id
    }

    async fn video_asset(pool: &PgPool, author: Uuid, fill: u8) -> Uuid {
        let id = Uuid::new_v4();
        media_store::insert(
            pool,
            id,
            author,
            &[fill; 32],
            "sha256",
            &format!("{id}.mp4"),
            "video/mp4",
            1024,
            &serde_json::json!({ "v": 1, "aspect_ratio": "1:1" }),
            media_store::MediaScale::Post,
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

    /// The avatar slot is a manifest entry like any gallery's, so it rides
    /// with both digests: the rendition it serves and the bytes the device
    /// uploaded, equal for a still stored as it arrived.
    ///
    /// The avatar slot carries both the rendition digest and the upload digest.
    /// ´claim:profile:the-avatar-slot-carries-both-digests´
    #[sqlx::test(migrations = "../../migrations")]
    async fn the_avatar_slot_carries_both_digests(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, _key) = rig.registered_actor("ada").await;
        let face = asset(&rig.pool, actor, 5).await;
        let prepared = rig
            .update(actor, with_picture(Some(Some(face))))
            .await
            .expect("prepares update");
        let update = common::envelope::CograProfile::decode_payload(&prepared.proposal.payload)
            .expect("decodes");
        let Some(Some(avatar)) = update.avatar else {
            panic!("the slot is set");
        };
        assert_eq!(avatar.digest, [5; 32]);
        assert_eq!(avatar.upload_digest, Some([5; 32]));
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

    /// The slot takes the picture cap and nothing wider: a video would
    /// otherwise reach an avatar through a cap ten times a picture's, and
    /// no profile surface plays one.
    ///
    /// An avatar is a still, so the slot answers to the picture cap rather than the wider video one.
    /// ´claim:profile:an-avatar-is-a-still´
    #[sqlx::test(migrations = "../../migrations")]
    async fn a_picture_slot_refuses_a_video(pool: PgPool) {
        let rig = Rig::new(pool).await;
        let (actor, _key) = rig.registered_actor("ada").await;
        let clip = video_asset(&rig.pool, actor, 4).await;

        match rig.update(actor, with_picture(Some(Some(clip)))).await {
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
