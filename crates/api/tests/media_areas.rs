//! The media areas (data-model.md "Media areas"), end to end against the
//! stand-in with in-process stores: a deleted asset's bytes leave the
//! world-readable store for the operator-only one once nothing live shows
//! them, and a carried post's media reaches the live store — verified —
//! before the predicate the carried batch's sign gate reads ever holds,
//! which `submitProposals` requires of a released carried write.

use std::pin::Pin;
use std::sync::Arc;

use api::auth::Viewer;
use api::content::{self, License, PostDraft};
use api::l1::StandInBoundary;
use api::media::areas::{self, Held, MoveError};
use api::media::{AttachmentDraft, BlobError, BlobStore, MediaAreas};
use api::redaction::{self, Redaction};
use api::schema::types::{ErrorCode, TERMINAL_WRITE_REFUSALS};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use common::l1::client::ActorKey;
use common::l1::handshake::PreSignedProposal;
use common::l1::wire;
use l1_standin::{StandIn, StandInConfig};
use postgres_store::staged::{self, PreSignedParts, StagedState};
use postgres_store::{genesis, media as media_store};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

mod rig;

const GC: i64 = 8;
const STAGING: api::prepare::Staging = api::prepare::Staging::unbudgeted(GC);

struct Rig {
    pool: PgPool,
    standin: StandIn,
    boundary: StandInBoundary,
    areas: MediaAreas,
}

/// One asset: its row id, its object key and the bytes it names.
struct Asset {
    id: Uuid,
    key: String,
    bytes: Vec<u8>,
}

impl Rig {
    async fn new(pool: PgPool) -> Self {
        let standin = StandIn::new(pool.clone(), StandInConfig::default());
        let boundary = StandInBoundary(standin.clone());
        Self {
            pool,
            standin,
            boundary,
            areas: MediaAreas::in_memory(),
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
        self.standin
            .credit_burn(&key.address(), 10_000_000)
            .await
            .expect("burn");
        (id, key)
    }

    /// An asset of this author's whose bytes sit in `area`'s store, its
    /// row digest the SHA-256 of those bytes — what a move verifies
    /// against.
    async fn asset_in(&self, author: Uuid, area: &str, fill: u8) -> Asset {
        let id = Uuid::new_v4();
        let key = format!("{id}.webp");
        let bytes = vec![fill; 2048];
        let digest: [u8; 32] = Sha256::digest(&bytes).into();
        media_store::insert(
            &self.pool,
            id,
            author,
            &digest,
            "sha256",
            &key,
            "image/webp",
            bytes.len() as i64,
            &serde_json::json!({ "v": 1, "aspect_ratio": "4:5" }),
            media_store::MediaScale::Post,
        )
        .await
        .expect("asset row");
        let store = match area {
            "live" => &self.areas.live,
            "carried" => &self.areas.carried,
            other => panic!("no fixture for area {other}"),
        };
        store
            .put(&key, bytes.clone(), "image/webp")
            .await
            .expect("bytes stored");
        sqlx::query("UPDATE media_attachments SET area = $2 WHERE id = $1")
            .bind(id)
            .bind(area)
            .execute(&self.pool)
            .await
            .expect("area");
        Asset { id, key, bytes }
    }

    async fn area(&self, id: Uuid) -> String {
        sqlx::query_scalar("SELECT area FROM media_attachments WHERE id = $1")
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .expect("asset")
    }

    async fn prepare_post(&self, actor: Uuid, body: &str, media: &[Uuid]) -> (Uuid, String) {
        let prepared = content::prepare_post(
            &self.pool,
            &self.boundary,
            STAGING,
            actor,
            PostDraft {
                title: Some("Title".into()),
                description: (!media.is_empty()).then(|| body.into()),
                content: media.is_empty().then(|| body.into()),
                license: License {
                    attribution: 1.0,
                    provenance: 0.0,
                },
                p_directed: 0.1,
                tags: vec![],
                references: vec![],
                attachments: media
                    .iter()
                    .enumerate()
                    .map(|(i, id)| AttachmentDraft {
                        media_id: *id,
                        display_order: i as i32,
                        is_cover: Some(i == 0),
                        alt_text: Some(format!("picture {}", i + 1)),
                        cover_media_id: None,
                        cover_taken: false,
                    })
                    .collect(),
                sensitive: Default::default(),
            },
        )
        .await
        .expect("prepares post");
        let write = &prepared.writes[0];
        (write.id, write.proposal.body.act_id().to_string())
    }

    /// A post landed end to end, returning its act id.
    async fn landed_post(&self, actor: Uuid, key: &ActorKey, body: &str, media: &[Uuid]) -> String {
        let (id, act_id) = self.prepare_post(actor, body, media).await;
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
        let host_key = api::l1::L1Boundary::host_public_key(&self.boundary)
            .await
            .expect("host key");
        let witness = key.approve(&pre, &sealed, &host_key).expect("approves");
        api::relay::submit_approval(&self.boundary, &self.pool, id, witness.approval_signature)
            .await
            .expect("relays");
        self.standin.close_epoch().await.expect("closes");
        let outcome = api::ingest::ingest_pending(&self.boundary, &self.pool, GC)
            .await
            .expect("ingests");
        assert!(outcome.promotion_failures.is_empty());
        act_id
    }

    async fn redact(&self, actor: Uuid, act_id: &str) -> redaction::Redacted {
        redaction::redact(
            &self.boundary,
            &self.pool,
            &self.areas,
            &[Redaction {
                actor_id: actor,
                act_id,
                reason: "user-account-deletion",
                redacted_by: &actor.to_string(),
            }],
        )
        .await
        .expect("redacts")
        .remove(0)
    }

    /// A post an applicant carries with their application, naming `media`.
    async fn carried_post(&self, actor: Uuid, media: &[Uuid]) -> Uuid {
        let (id, _) = self.prepare_post(actor, "Waits.", media).await;
        staged::carry(&self.pool, &[id]).await.expect("carries");
        id
    }

    /// What the landing does to a carried write (`auth::land`): back to
    /// `awaiting_pre_sign`, still marked carried, for the device to sign.
    async fn release(&self, staged_id: Uuid) {
        let released = sqlx::query(
            "UPDATE staged_writes SET state = 'awaiting_pre_sign'
             WHERE id = $1 AND state = 'carried' AND carried",
        )
        .bind(staged_id)
        .execute(&self.pool)
        .await
        .expect("releases");
        assert_eq!(released.rows_affected(), 1);
    }

    /// The device's seal leg through `submitProposals`, as `actor`, over
    /// the schema built on this rig's stand-in and media areas.
    async fn submit(&self, actor: Uuid, staged_id: Uuid, pre: &PreSignedProposal) -> Value {
        let (mut ctx, _) = rig::api_context(
            self.pool.clone(),
            Arc::new(api::mailer::DevMailer::new(None)),
            api::ratelimit::RateLimitConfig::unlimited(),
        );
        ctx.boundary = self.boundary.clone();
        ctx.areas = self.areas.clone();
        let schema = api::schema::build_with(ctx, api::schema::QueryBudgets::release());
        let response = schema
            .execute(
                async_graphql::Request::new(
                    "mutation($input: SubmitProposalsInput!) {
                       submitProposals(input: $input) {
                         stagedWrites { id state } userErrors { code message }
                       }
                     }",
                )
                .variables(async_graphql::Variables::from_json(json!({ "input": {
                    "proposals": [{
                        "stagedWriteId": staged_id,
                        "signature": B64.encode(wire::encode_pre_commitment_of(pre)),
                    }]
                }})))
                .data(Some(Viewer {
                    user_id: actor,
                    session_id: Uuid::new_v4(),
                })),
            )
            .await;
        assert!(response.errors.is_empty(), "{:?}", response.errors);
        response.data.into_json().expect("json")["submitProposals"].clone()
    }
}

async fn holds(store: &dyn BlobStore, asset: &Asset) -> bool {
    match store.get(&asset.key).await {
        Ok(bytes) => bytes == asset.bytes,
        Err(e) if e.is_not_found() => false,
        Err(e) => panic!("store fault: {e}"),
    }
}

/// How a test store misbehaves on `put`.
#[derive(Clone, Copy)]
enum Fault {
    /// Stores bytes other than the ones it was handed.
    Corrupts,
    /// Refuses the write.
    Refuses,
}

/// A store that misbehaves on `put` and is otherwise the store it wraps.
struct Faulty(Arc<dyn BlobStore>, Fault);

type Fut<'a, T> = Pin<Box<dyn Future<Output = Result<T, BlobError>> + Send + 'a>>;

impl BlobStore for Faulty {
    fn put<'a>(&'a self, key: &'a str, mut bytes: Vec<u8>, mime: &'a str) -> Fut<'a, ()> {
        match self.1 {
            Fault::Corrupts => {
                if let Some(first) = bytes.first_mut() {
                    *first ^= 0xFF;
                }
                self.0.put(key, bytes, mime)
            }
            Fault::Refuses => {
                Box::pin(async { Err(BlobError::Config("the store is down".into())) })
            }
        }
    }
    fn get<'a>(&'a self, key: &'a str) -> Fut<'a, Vec<u8>> {
        self.0.get(key)
    }
    fn exists<'a>(&'a self, key: &'a str) -> Fut<'a, bool> {
        self.0.exists(key)
    }
    fn delete<'a>(&'a self, key: &'a str) -> Fut<'a, ()> {
        self.0.delete(key)
    }
    fn create_multipart<'a>(&'a self, key: &'a str) -> Fut<'a, String> {
        self.0.create_multipart(key)
    }
    fn put_part<'a>(
        &'a self,
        key: &'a str,
        upload_id: &'a str,
        part_idx: usize,
        bytes: Vec<u8>,
    ) -> Fut<'a, String> {
        self.0.put_part(key, upload_id, part_idx, bytes)
    }
    fn complete_multipart<'a>(
        &'a self,
        key: &'a str,
        upload_id: &'a str,
        content_ids: Vec<String>,
    ) -> Fut<'a, ()> {
        self.0.complete_multipart(key, upload_id, content_ids)
    }
    fn abort_multipart<'a>(&'a self, key: &'a str, upload_id: &'a str) -> Fut<'a, ()> {
        self.0.abort_multipart(key, upload_id)
    }
}

/// Once its last live placement is redacted, an asset's bytes are gone
/// from the world-readable store — the only store any minted URL points
/// into — and sit, verified, in the operator store alone. No old link and
/// no guessed key reaches them through the live store.
///
/// A held asset's bytes leave the live store and sit only in the operator store.
/// ´claim:media:a-held-asset-leaves-the-live-store´
#[sqlx::test(migrations = "../../migrations")]
async fn a_redacted_assets_bytes_leave_the_live_store_for_the_operator_area(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let picture = rig.asset_in(actor, "live", 0x11).await;
    let act_id = rig
        .landed_post(actor, &key, "Deleted.", &[picture.id])
        .await;

    let done = rig.redact(actor, &act_id).await;
    assert_eq!(done.held_media, vec![picture.id]);
    assert_eq!(done.held_moved, vec![picture.id]);
    assert!(
        !holds(rig.areas.live.as_ref(), &picture).await,
        "no public copy remains"
    );
    assert!(holds(rig.areas.held.as_ref(), &picture).await);
    assert_eq!(rig.area(picture.id).await, "held");
}

/// One asset in two posts keeps its bytes in the live store while the
/// second post still shows it, and leaves only with its last placement.
///
/// A shared asset's bytes stay live until its last placement is redacted.
/// ´claim:media:a-shared-assets-bytes-stay-live-until-the-last-placement´
#[sqlx::test(migrations = "../../migrations")]
async fn a_shared_asset_keeps_its_bytes_live_until_its_last_placement_goes(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let shared = rig.asset_in(actor, "live", 0x22).await;
    let first = rig.landed_post(actor, &key, "First.", &[shared.id]).await;
    let second = rig.landed_post(actor, &key, "Second.", &[shared.id]).await;

    let done = rig.redact(actor, &first).await;
    assert!(done.held_moved.is_empty());
    assert!(holds(rig.areas.live.as_ref(), &shared).await);
    assert_eq!(rig.area(shared.id).await, "live");

    let done = rig.redact(actor, &second).await;
    assert_eq!(done.held_moved, vec![shared.id]);
    assert!(!holds(rig.areas.live.as_ref(), &shared).await);
}

/// The hold flag can go stale between the redaction that set it and the
/// move: a placement written since shows the asset again. The move
/// re-checks under the row lock and leaves the bytes where that placement
/// reads them.
///
/// A held asset a live placement shows again is never moved.
/// ´claim:media:a-stale-hold-never-moves-a-placed-asset´
#[sqlx::test(migrations = "../../migrations")]
async fn a_stale_hold_never_moves_bytes_a_placement_still_shows(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let picture = rig.asset_in(actor, "live", 0x33).await;
    rig.landed_post(actor, &key, "Still showing.", &[picture.id])
        .await;
    sqlx::query("UPDATE media_attachments SET held_at = NOW() WHERE id = $1")
        .bind(picture.id)
        .execute(&rig.pool)
        .await
        .expect("a stale hold");

    let outcome = areas::hold(&rig.pool, &rig.areas, picture.id)
        .await
        .expect("checks");
    assert_eq!(outcome, Held::StillPlaced);
    assert!(areas::settle_held(&rig.pool, &rig.areas).await.is_empty());
    assert!(holds(rig.areas.live.as_ref(), &picture).await);
    assert!(!holds(rig.areas.held.as_ref(), &picture).await);
    assert_eq!(rig.area(picture.id).await, "live");
}

/// A copy that does not read back as the asset's digest is not a move:
/// the copy is removed, the bytes stay in the live store and the row in
/// the live area, and the reconciler's next pass with a sound store moves
/// them.
///
/// An unverified held copy leaves the asset where it was, and the reconciler retries.
/// ´claim:media:an-unverified-held-copy-is-not-a-move´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unverified_held_copy_leaves_the_asset_live_for_the_retry(pool: PgPool) {
    let mut rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let picture = rig.asset_in(actor, "live", 0x44).await;
    let act_id = rig
        .landed_post(actor, &key, "Deleted.", &[picture.id])
        .await;
    let sound = rig.areas.held.clone();
    rig.areas.held = Arc::new(Faulty(sound.clone(), Fault::Corrupts));

    let done = rig.redact(actor, &act_id).await;
    assert_eq!(done.held_media, vec![picture.id], "the hold committed");
    assert!(done.held_moved.is_empty());
    assert!(holds(rig.areas.live.as_ref(), &picture).await);
    assert!(!sound.exists(&picture.key).await.expect("probe"));
    assert_eq!(rig.area(picture.id).await, "live");

    rig.areas.held = sound;
    assert_eq!(
        areas::settle_held(&rig.pool, &rig.areas).await,
        vec![picture.id]
    );
    assert!(!holds(rig.areas.live.as_ref(), &picture).await);
    assert!(holds(rig.areas.held.as_ref(), &picture).await);
    assert_eq!(rig.area(picture.id).await, "held");
}

/// A move a crash cut off after the live copy went — the bytes verified in
/// the operator store, the row still reading live — completes on the next
/// pass from the operator copy.
///
/// A held move interrupted after the live copy went completes on the next pass.
/// ´claim:media:an-interrupted-held-move-resumes´
#[sqlx::test(migrations = "../../migrations")]
async fn an_interrupted_held_move_resumes_from_the_operator_copy(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, _) = rig.funded_actor("ada").await;
    let picture = rig.asset_in(actor, "live", 0x55).await;
    rig.areas
        .held
        .put(&picture.key, picture.bytes.clone(), "image/webp")
        .await
        .expect("the copy the crash left");
    rig.areas.live.delete(&picture.key).await.expect("gone");
    sqlx::query("UPDATE media_attachments SET held_at = NOW() WHERE id = $1")
        .bind(picture.id)
        .execute(&rig.pool)
        .await
        .expect("held");

    assert_eq!(
        areas::settle_held(&rig.pool, &rig.areas).await,
        vec![picture.id]
    );
    assert_eq!(rig.area(picture.id).await, "held");
    assert!(holds(rig.areas.held.as_ref(), &picture).await);
}

/// The orphan sweep deletes from the live store, so it takes only assets
/// whose bytes are there: carried media, which has no placement until its
/// landing writes one, is never an orphan to it.
///
/// The orphan sweep takes only assets whose bytes are in the live store.
/// ´claim:media:the-sweep-takes-only-live-area-assets´
#[sqlx::test(migrations = "../../migrations")]
async fn the_orphan_sweep_never_takes_carried_media(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, _) = rig.funded_actor("ada").await;
    let carried = rig.asset_in(actor, "carried", 0x66).await;
    let orphan = rig.asset_in(actor, "live", 0x67).await;

    let swept = media_store::sweep_orphans(&rig.pool, 0.0, 100)
        .await
        .expect("sweeps");
    let ids: Vec<Uuid> = swept.iter().map(|s| s.id).collect();
    assert!(ids.contains(&orphan.id), "the control is swept");
    assert!(!ids.contains(&carried.id), "{ids:?}");
}

/// A carried post's media waits in the carried store and the sign gate's
/// predicate reads false; publishing moves it to the live store, verified,
/// and only then does the predicate hold. The carried copy goes.
///
/// A carried post's media is in the live store, verified, before its sign gate holds.
/// ´claim:media:carried-media-is-published-before-the-sign-gate-holds´
#[sqlx::test(migrations = "../../migrations")]
async fn a_carried_posts_media_is_published_verified_before_its_gate_holds(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, _) = rig.funded_actor("ada").await;
    let picture = rig.asset_in(actor, "carried", 0x77).await;
    let staged_id = rig.carried_post(actor, &[picture.id]).await;

    assert!(
        !areas::carried_media_published(&rig.pool, staged_id)
            .await
            .expect("reads"),
        "nothing is public yet"
    );
    assert!(!holds(rig.areas.live.as_ref(), &picture).await);

    assert!(
        areas::ensure_carried_published(&rig.pool, &rig.areas, staged_id)
            .await
            .expect("publishes")
    );
    assert!(holds(rig.areas.live.as_ref(), &picture).await);
    assert!(!holds(rig.areas.carried.as_ref(), &picture).await);
    assert_eq!(rig.area(picture.id).await, "live");
}

/// A move that fails refuses the gate rather than letting a broken post
/// sign: the predicate stays false, the carried copy stays, and a retry
/// against a sound store publishes.
///
/// A failed carried move keeps the sign gate closed, and a retry opens it.
/// ´claim:media:a-failed-carried-move-keeps-the-gate-closed´
#[sqlx::test(migrations = "../../migrations")]
async fn a_failed_carried_move_keeps_the_gate_closed_until_a_retry(pool: PgPool) {
    let mut rig = Rig::new(pool).await;
    let (actor, _) = rig.funded_actor("ada").await;
    let picture = rig.asset_in(actor, "carried", 0x88).await;
    let staged_id = rig.carried_post(actor, &[picture.id]).await;
    let sound = rig.areas.live.clone();

    for fault in [Fault::Refuses, Fault::Corrupts] {
        rig.areas.live = Arc::new(Faulty(sound.clone(), fault));
        let refused = areas::ensure_carried_published(&rig.pool, &rig.areas, staged_id).await;
        assert!(refused.is_err(), "the move must fail");
        assert!(
            !areas::carried_media_published(&rig.pool, staged_id)
                .await
                .expect("reads")
        );
        assert!(holds(rig.areas.carried.as_ref(), &picture).await);
        assert!(!sound.exists(&picture.key).await.expect("probe"));
        assert_eq!(rig.area(picture.id).await, "carried");
    }

    rig.areas.live = sound;
    assert!(
        areas::ensure_carried_published(&rig.pool, &rig.areas, staged_id)
            .await
            .expect("the retry publishes")
    );
}

/// Bytes in the carried store that do not hash to the digest the envelope
/// commits are never published: a post would land naming bytes nobody
/// can fetch.
///
/// Carried bytes that do not match their rendition digest never publish.
/// ´claim:media:corrupt-carried-bytes-never-publish´
#[sqlx::test(migrations = "../../migrations")]
async fn carried_bytes_that_do_not_match_their_digest_never_publish(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, _) = rig.funded_actor("ada").await;
    let picture = rig.asset_in(actor, "carried", 0x99).await;
    let staged_id = rig.carried_post(actor, &[picture.id]).await;
    rig.areas
        .carried
        .put(&picture.key, b"other bytes".to_vec(), "image/webp")
        .await
        .expect("corrupted");

    let refused = areas::publish_carried(&rig.pool, &rig.areas, staged_id).await;
    assert!(
        matches!(refused, Err(MoveError::Corrupt(id)) if id == picture.id),
        "{refused:?}"
    );
    assert!(
        !areas::carried_media_published(&rig.pool, staged_id)
            .await
            .expect("reads")
    );
    assert_eq!(rig.area(picture.id).await, "carried");
}

/// A name in the carried manifest that resolves to no ready asset of its
/// author's fails closed; a carried write naming no media holds at once.
///
/// The sign gate fails closed on a name that resolves to no asset, and holds for a write naming none.
/// ´claim:media:the-carried-gate-fails-closed-on-an-unresolved-name´
#[sqlx::test(migrations = "../../migrations")]
async fn the_carried_gate_fails_closed_on_a_name_no_asset_answers(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, _) = rig.funded_actor("ada").await;
    let picture = rig.asset_in(actor, "live", 0xAA).await;
    let staged_id = rig.carried_post(actor, &[picture.id]).await;
    assert!(
        areas::carried_media_published(&rig.pool, staged_id)
            .await
            .expect("reads"),
        "live media needs no move"
    );
    sqlx::query("UPDATE media_attachments SET digest = $2 WHERE id = $1")
        .bind(picture.id)
        .bind(vec![0u8; 32])
        .execute(&rig.pool)
        .await
        .expect("the name now answers nothing");
    assert!(
        !areas::carried_media_published(&rig.pool, staged_id)
            .await
            .expect("reads")
    );

    let (words, _) = rig.prepare_post(actor, "Only words.", &[]).await;
    assert!(
        areas::ensure_carried_published(&rig.pool, &rig.areas, words)
            .await
            .expect("nothing to move")
    );
}

/// The gate at the seal leg: a released carried post whose media cannot
/// move yet — its bytes have not reached the carried store — is refused
/// with a code the clients do not treat as terminal, and nothing is
/// recorded. Once the bytes are there, the device's same material, sent
/// again, moves them to the live store and signs.
///
/// A released carried write signs only once its media is live, and is refused retryably until then.
/// ´claim:media:a-released-carried-write-signs-only-once-its-media-is-live´
#[sqlx::test(migrations = "../../migrations")]
async fn a_released_carried_post_signs_only_once_its_media_is_live(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let picture = rig.asset_in(actor, "carried", 0xB1).await;
    rig.areas
        .carried
        .delete(&picture.key)
        .await
        .expect("the bytes have not arrived");
    let staged_id = rig.carried_post(actor, &[picture.id]).await;
    rig.release(staged_id).await;
    let write = staged::load(&rig.pool, staged_id).await.expect("loads");
    let pre = key.pre_sign(write.proposal);

    let refused = rig.submit(actor, staged_id, &pre).await;
    assert_eq!(
        refused["userErrors"][0]["code"], "CARRIED_MEDIA_UNPUBLISHED",
        "{refused}"
    );
    assert!(refused["stagedWrites"].is_null(), "{refused}");
    assert!(
        !TERMINAL_WRITE_REFUSALS.contains(&ErrorCode::CarriedMediaUnpublished),
        "the clients must keep the material and re-send"
    );
    let waiting = staged::load(&rig.pool, staged_id).await.expect("loads");
    assert_eq!(waiting.state, StagedState::AwaitingPreSign);
    assert!(waiting.pre_signed.is_none(), "nothing was recorded");
    assert_eq!(rig.area(picture.id).await, "carried");

    rig.areas
        .carried
        .put(&picture.key, picture.bytes.clone(), "image/webp")
        .await
        .expect("the bytes arrive");
    let sealed = rig.submit(actor, staged_id, &pre).await;
    assert_eq!(sealed["userErrors"], json!([]), "{sealed}");
    assert_eq!(sealed["stagedWrites"][0]["state"], "AWAITING_APPROVAL");
    assert_eq!(rig.area(picture.id).await, "live");
    assert!(holds(rig.areas.live.as_ref(), &picture).await);
}

/// A released carried write naming no media has nothing to move and
/// signs at once.
///
/// A released carried write naming no media passes the gate at once.
/// ´claim:media:a-carried-write-naming-no-media-passes-the-gate´
#[sqlx::test(migrations = "../../migrations")]
async fn a_released_carried_write_naming_no_media_signs_at_once(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let staged_id = rig.carried_post(actor, &[]).await;
    rig.release(staged_id).await;
    let write = staged::load(&rig.pool, staged_id).await.expect("loads");
    let pre = key.pre_sign(write.proposal);

    let sealed = rig.submit(actor, staged_id, &pre).await;
    assert_eq!(sealed["userErrors"], json!([]), "{sealed}");
    assert_eq!(sealed["stagedWrites"][0]["state"], "AWAITING_APPROVAL");
}

/// Before the landing releases it, a carried write is not the device's to
/// sign, and the seal leg moves nothing: the media stays in the carried
/// store until the landing.
///
/// An unreleased carried write's media never moves at the seal leg.
/// ´claim:media:an-unreleased-carried-writes-media-never-moves´
#[sqlx::test(migrations = "../../migrations")]
async fn an_unreleased_carried_writes_media_stays_carried(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let picture = rig.asset_in(actor, "carried", 0xB2).await;
    let staged_id = rig.carried_post(actor, &[picture.id]).await;
    let write = staged::load(&rig.pool, staged_id).await.expect("loads");
    let pre = key.pre_sign(write.proposal);

    let refused = rig.submit(actor, staged_id, &pre).await;
    assert_eq!(refused["userErrors"][0]["code"], "BAD_INPUT", "{refused}");
    assert_eq!(rig.area(picture.id).await, "carried");
    assert!(!holds(rig.areas.live.as_ref(), &picture).await);
    assert!(holds(rig.areas.carried.as_ref(), &picture).await);
}
