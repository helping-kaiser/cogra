//! Honest deletion's substrate, end to end against the stand-in
//! (data-model.md "The retention archive", "Act payload carriage"): one
//! act redacted as one archived unit, its carriage reduced, every other
//! copy of the payload reaped, its media held only once nothing live
//! shows them, and the records that land over a reaped write landing
//! reduced.

use api::content::{self, License, PostDraft};
use api::l1::{L1Boundary, StandInBoundary};
use api::media::AttachmentDraft;
use api::prepare::{Gesture, Target};
use api::redaction::{self, Redaction, RedactionError};
use common::envelope::CograContent;
use common::l1::census::Family;
use common::l1::client::ActorKey;
use common::l1::encoding::Encoder;
use common::l1::handshake::{Proposal, content_commitment, pre_commitment};
use common::l1::identifier::{ActId, NodeId};
use l1_standin::{StandIn, StandInConfig};
use postgres_store::staged::{self, PreSignedParts};
use postgres_store::{content as content_store, genesis, media as media_store, mirror, retention};
use sqlx::PgPool;
use uuid::Uuid;

const GC: i64 = 8;
const STAGING: api::prepare::Staging = api::prepare::Staging::unbudgeted(GC);
const REASON: &str = "user-account-deletion";

struct Rig {
    pool: PgPool,
    standin: StandIn,
    boundary: StandInBoundary,
}

/// Every place a payload, its content salt or its nonce can sit, for one
/// act: carriage, the staged row, the stand-in's row. `true` means the
/// value is there.
#[derive(Debug, PartialEq, Eq)]
struct Copies {
    carriage: Option<(bool, bool, String)>,
    staged: Option<(bool, bool, bool)>,
    l1: Option<(bool, bool, bool)>,
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
        self.standin
            .credit_burn(&key.address(), 10_000_000)
            .await
            .expect("burn");
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
        self.standin.close_epoch().await.expect("closes");
        let outcome = api::ingest::ingest_pending(&self.boundary, &self.pool, GC)
            .await
            .expect("ingests");
        assert!(
            outcome.promotion_failures.is_empty(),
            "confirm-side promotion failed: {:?}",
            outcome.promotion_failures
        );
    }

    /// An image asset row of this author's, without the byte pipeline:
    /// what binds it to a manifest is its digest.
    async fn asset(&self, author: Uuid, fill: u8) -> Uuid {
        let id = Uuid::new_v4();
        media_store::insert(
            &self.pool,
            id,
            author,
            &[fill; 32],
            "sha256",
            &format!("{id}.webp"),
            "image/webp",
            1024,
            &serde_json::json!({ "v": 1, "aspect_ratio": "4:5" }),
            media_store::MediaScale::Post,
        )
        .await
        .expect("asset row");
        id
    }

    /// Prepares a post with the gallery, returning its staged write id
    /// and its act id. Nothing is signed.
    async fn prepare_post(&self, actor: Uuid, body: &str, media: &[Uuid]) -> (Uuid, String) {
        let prepared = content::prepare_post(
            &self.pool,
            &self.boundary,
            STAGING,
            actor,
            // A post's body is words or media: beside media the words go
            // in the description.
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

    /// A post landed end to end, returning its staged write id and act id.
    async fn landed_post(
        &self,
        actor: Uuid,
        key: &ActorKey,
        body: &str,
        media: &[Uuid],
    ) -> (Uuid, String) {
        let (staged_id, act_id) = self.prepare_post(actor, body, media).await;
        self.sign_and_relay(staged_id, key).await;
        self.close_and_ingest().await;
        (staged_id, act_id)
    }

    async fn redact(&self, actor: Uuid, act_id: &str) -> redaction::Redacted {
        let done = redaction::redact(
            &self.boundary,
            &self.pool,
            &[Redaction {
                actor_id: actor,
                act_id,
                reason: REASON,
                redacted_by: &actor.to_string(),
            }],
        )
        .await
        .expect("redacts");
        done.into_iter().next().expect("one act")
    }

    async fn copies(&self, act_id: &str) -> Copies {
        let carriage: Option<(bool, bool, String)> = sqlx::query_as(
            "SELECT payload IS NOT NULL, content_salt IS NOT NULL, payload_state
             FROM act_payloads WHERE act_id = $1",
        )
        .bind(act_id)
        .fetch_optional(&self.pool)
        .await
        .expect("carriage");
        let staged: Option<(bool, bool, bool)> = sqlx::query_as(
            "SELECT payload IS NOT NULL, content_salt IS NOT NULL, nonce IS NOT NULL
             FROM staged_writes WHERE act_id = $1",
        )
        .bind(act_id)
        .fetch_optional(&self.pool)
        .await
        .expect("staged");
        let l1: Option<(bool, bool, bool)> = sqlx::query_as(
            "SELECT payload IS NOT NULL, content_salt IS NOT NULL, nonce IS NOT NULL
             FROM l1_acts WHERE act_id = $1",
        )
        .bind(act_id)
        .fetch_optional(&self.pool)
        .await
        .expect("l1");
        Copies {
            carriage,
            staged,
            l1,
        }
    }

    async fn units(&self, act_id: &str) -> Vec<retention::Unit> {
        let mut conn = self.pool.acquire().await.expect("conn");
        retention::units_of(&mut conn, act_id).await.expect("units")
    }

    async fn held(&self, media_id: Uuid) -> bool {
        sqlx::query_scalar("SELECT held_at IS NOT NULL FROM media_attachments WHERE id = $1")
            .bind(media_id)
            .fetch_one(&self.pool)
            .await
            .expect("asset")
    }
}

fn unhex(v: &serde_json::Value) -> Vec<u8> {
    hex::decode(v.as_str().expect("a hex string")).expect("hex")
}

/// After a redaction, carriage holds NULL in `reduced`, and neither the
/// staged row nor the stand-in's row holds the payload, its salt or its
/// nonce. NULL is checked as NULL: an emptied row would read as a payload
/// of zero bytes, which is a different, honest act.
///
/// After a redaction no copy of the payload, its content salt or its nonce remains anywhere CoGra holds one.
/// ´claim:redaction:no-copy-of-a-reduced-payload-remains´
#[sqlx::test(migrations = "../../migrations")]
async fn after_redaction_no_copy_of_a_reduced_payload_remains_anywhere(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let (_, act_id) = rig.landed_post(actor, &key, "Gone soon.", &[]).await;
    assert_eq!(
        rig.copies(&act_id).await,
        Copies {
            carriage: Some((true, true, "full".into())),
            staged: Some((true, true, true)),
            l1: Some((false, false, false)),
        },
        "before: carriage full, the landed staged row still holding all three"
    );

    let done = rig.redact(actor, &act_id).await;
    assert!(done.archived.is_some() && done.reduced && done.staged_reaped);
    assert_eq!(
        rig.copies(&act_id).await,
        Copies {
            carriage: Some((false, false, "reduced".into())),
            staged: Some((false, false, false)),
            l1: Some((false, false, false)),
        }
    );
    let empty: i64 = sqlx::query_scalar(
        "SELECT (SELECT COUNT(*) FROM act_payloads WHERE length(payload) = 0)
              + (SELECT COUNT(*) FROM staged_writes WHERE length(payload) = 0)",
    )
    .fetch_one(&rig.pool)
    .await
    .expect("counts");
    assert_eq!(empty, 0, "a reduction never writes a zero-length payload");
    let carriage = content_store::act_payload(&rig.pool, &act_id)
        .await
        .expect("reads")
        .expect("row kept");
    assert!(carriage.reduced && carriage.reduced_at.is_some());
}

/// The unit alone, with the permanent structural record, reproduces the
/// record's witness: its salt and envelope open the content commitment,
/// and its nonce reproduces the pre-commitment both commitments bind.
/// That is what keeping the salt in the archive buys — without it the
/// proof that the archive holds exactly what was removed ends at the
/// redaction.
///
/// An archived unit reproduces its record's witness from its own salt, envelope and nonce.
/// ´claim:redaction:an-archived-unit-reproduces-its-witness´
#[sqlx::test(migrations = "../../migrations")]
async fn an_archived_unit_reproduces_its_records_witness(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let (_, act_id) = rig
        .landed_post(actor, &key, "Kept for the record.", &[])
        .await;
    rig.redact(actor, &act_id).await;

    let units = rig.units(&act_id).await;
    assert_eq!(units.len(), 1, "one unit per redacted act");
    let unit = &units[0];
    assert_eq!(unit.original_type, retention::ACT_PAYLOAD);
    assert_eq!(unit.redaction_reason, REASON);
    assert_eq!(unit.redacted_by, actor.to_string());
    assert_eq!(unit.legal_hold_until, None);
    let data = &unit.original_data;
    let envelope = unhex(&data["envelope"]);
    let salt = unhex(&data["content_salt"]);
    let nonce = unhex(&data["nonce"]);
    assert_eq!(
        CograContent::decode_payload(&envelope)
            .expect("the envelope")
            .body
            .as_deref(),
        Some("Kept for the record.")
    );

    let id = ActId::parse(&act_id).expect("act id");
    let stored = rig
        .standin
        .sealed_act(&id)
        .await
        .expect("reads")
        .expect("stored");
    let record = mirror::record_full(&rig.pool, &act_id)
        .await
        .expect("reads")
        .expect("landed");
    let proposal = Proposal {
        body: stored.body.clone(),
        payload: envelope.clone(),
        deps: stored.deps.clone(),
    };
    assert_eq!(
        pre_commitment(&proposal, &nonce).to_vec(),
        stored.pre_commitment,
        "the archived nonce reproduces the pre-commitment"
    );
    let opened = content_commitment(&id, &stored.pre_commitment, &salt, &envelope);
    assert_eq!(
        opened.to_vec(),
        record.payload_witness,
        "salt + envelope open the witness"
    );
    assert_eq!(unhex(&data["witness"]), record.payload_witness);
}

/// Each archived media entry carries the rendition digest and the upload
/// digest the manifest witnessed, and names the asset row and object key
/// holding those bytes — a reference, never a copy of them.
///
/// An archived unit names each asset by both manifest digests and references its object rather than copying it.
/// ´claim:redaction:an-archived-unit-references-its-media-by-both-digests´
#[sqlx::test(migrations = "../../migrations")]
async fn an_archived_unit_verifies_its_media_against_both_digests(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let a = rig.asset(actor, 0x11).await;
    let b = rig.asset(actor, 0x22).await;
    let (_, act_id) = rig.landed_post(actor, &key, "Two pictures.", &[a, b]).await;
    rig.redact(actor, &act_id).await;

    let unit = rig.units(&act_id).await.remove(0);
    assert_eq!(unit.media, {
        let mut ids = vec![a, b];
        ids.sort();
        ids
    });
    let envelope = unhex(&unit.original_data["envelope"]);
    let manifest = CograContent::decode_payload(&envelope)
        .expect("envelope")
        .media;
    let listed = unit.original_data["media"].as_array().expect("a list");
    assert_eq!(listed.len(), 2);
    let rows = media_store::assets_by_ids(&rig.pool, &[a, b])
        .await
        .expect("rows");
    for (entry, named) in listed.iter().zip(&manifest) {
        assert_eq!(unhex(&entry["rendition_digest"]), named.digest.to_vec());
        assert_eq!(
            Some(unhex(&entry["upload_digest"])),
            named.upload_digest.map(|u| u.to_vec())
        );
        let row = rows
            .iter()
            .find(|r| r.id.to_string() == entry["media_id"].as_str().expect("id"))
            .expect("the named asset");
        assert_eq!(
            row.digest,
            unhex(&entry["rendition_digest"]),
            "R is the bytes served"
        );
        assert_eq!(
            row.upload_digest,
            unhex(&entry["upload_digest"]),
            "U is the upload echo"
        );
        assert_eq!(entry["storage_key"], row.storage_key.as_str());
    }
}

/// The archive unit, the reduction and the reap commit together or not at
/// all. A failure injected at the last write — the staged reap, after the
/// unit is inserted and the carriage reduced — leaves no unit behind and
/// the carriage full: there is no committed state with one and not the
/// other.
///
/// The archive unit and the reduction commit together: a failure after both leaves neither.
/// ´claim:redaction:the-unit-and-the-reduction-commit-together´
#[sqlx::test(migrations = "../../migrations")]
async fn the_archive_unit_and_the_reduction_commit_together_or_not_at_all(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let (_, act_id) = rig.landed_post(actor, &key, "Not yet.", &[]).await;
    sqlx::raw_sql(
        "CREATE FUNCTION refuse_reap() RETURNS trigger LANGUAGE plpgsql AS $$
         BEGIN RAISE EXCEPTION 'injected: the reap fails'; END $$;
         CREATE TRIGGER refuse_reap BEFORE UPDATE ON staged_writes
             FOR EACH ROW WHEN (NEW.payload IS NULL) EXECUTE FUNCTION refuse_reap();",
    )
    .execute(&rig.pool)
    .await
    .expect("injects");

    let redacted_by = actor.to_string();
    let r = Redaction {
        actor_id: actor,
        act_id: &act_id,
        reason: REASON,
        redacted_by: &redacted_by,
    };
    let refused = redaction::redact_act(&rig.pool, &r).await;
    assert!(
        matches!(refused, Err(RedactionError::Storage(ref m)) if m.contains("injected")),
        "{refused:?}"
    );
    assert!(
        rig.units(&act_id).await.is_empty(),
        "no unit without the reduction"
    );
    assert_eq!(
        rig.copies(&act_id).await.carriage,
        Some((true, true, "full".into())),
        "no reduction without the unit"
    );

    sqlx::raw_sql("DROP TRIGGER refuse_reap ON staged_writes")
        .execute(&rig.pool)
        .await
        .expect("lifts");
    let done = redaction::redact_act(&rig.pool, &r).await.expect("retries");
    assert!(done.archived.is_some() && done.reduced && done.staged_reaped);
    assert_eq!(rig.units(&act_id).await.len(), 1);
}

/// A redaction run again finds nothing left to do: no second unit, no
/// second reduction, the first reap's moment kept — and the substrate's
/// drop is a no-op on an accepted act, which holds no carriage already.
///
/// A repeated redaction changes nothing, and the substrate drop is a no-op on accepted acts.
/// ´claim:redaction:redaction-is-idempotent´
#[sqlx::test(migrations = "../../migrations")]
async fn the_reap_is_idempotent_on_accepted_acts(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let (_, act_id) = rig.landed_post(actor, &key, "Once.", &[]).await;
    rig.redact(actor, &act_id).await;
    let reaped_at: chrono::DateTime<chrono::Utc> =
        sqlx::query_scalar("SELECT payload_reaped_at FROM staged_writes WHERE act_id = $1")
            .bind(&act_id)
            .fetch_one(&rig.pool)
            .await
            .expect("reaped");

    let again = rig.redact(actor, &act_id).await;
    assert_eq!(again, redaction::Redacted::default());
    assert_eq!(rig.units(&act_id).await.len(), 1);
    let still: chrono::DateTime<chrono::Utc> =
        sqlx::query_scalar("SELECT payload_reaped_at FROM staged_writes WHERE act_id = $1")
            .bind(&act_id)
            .fetch_one(&rig.pool)
            .await
            .expect("reaped");
    assert_eq!(still, reaped_at);
    assert_eq!(
        rig.boundary
            .drop_carriage(std::slice::from_ref(&act_id))
            .await
            .expect("drops"),
        0,
        "an accepted act holds nothing to drop"
    );
}

/// A write redacted after its approval but before its record landed: the
/// unit is archived from the staged copy (sealed, so it has a witness),
/// the staged copy and the stand-in's custody are dropped — the stand-in
/// recording the drop on a row that never reached acceptance — and when
/// the record lands after all, it lands reduced instead of failing on a
/// payload that is no longer there.
///
/// A record landing over a reaped write lands reduced, and the stand-in drops a never-accepted act's custody on the way.
/// ´claim:redaction:a-reaped-write-lands-reduced´
#[sqlx::test(migrations = "../../migrations")]
async fn a_write_promoting_after_its_payload_was_reaped_lands_reduced_rather_than_failing(
    pool: PgPool,
) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let (staged_id, act_id) = rig.prepare_post(actor, "In flight.", &[]).await;
    rig.sign_and_relay(staged_id, &key).await;
    assert_eq!(rig.copies(&act_id).await.l1, Some((true, true, true)));

    let done = rig.redact(actor, &act_id).await;
    assert!(
        done.archived.is_some(),
        "a sealed copy has a witness to archive against"
    );
    assert!(!done.reduced, "no carriage before the landing");
    assert!(done.staged_reaped);
    let (status, dropped): (String, bool) = sqlx::query_as(
        "SELECT status, carriage_dropped_at IS NOT NULL FROM l1_acts WHERE act_id = $1",
    )
    .bind(&act_id)
    .fetch_one(&rig.pool)
    .await
    .expect("l1 row");
    assert_eq!((status.as_str(), dropped), ("approved", true));
    assert_eq!(rig.copies(&act_id).await.l1, Some((false, false, false)));
    assert!(matches!(
        staged::load(&rig.pool, staged_id).await,
        Err(staged::StagedError::Reaped(_))
    ));

    rig.close_and_ingest().await;
    assert_eq!(
        rig.copies(&act_id).await.carriage,
        Some((false, false, "reduced".into())),
        "the late landing lands reduced"
    );
    let record = mirror::record_full(&rig.pool, &act_id)
        .await
        .expect("reads")
        .expect("landed");
    assert!(record.payload_marked, "the record still commits a payload");
}

fn handle_payload(handle: &str) -> Vec<u8> {
    let mut e = Encoder::new();
    e.array(2);
    e.uint(1);
    e.text(handle);
    e.finish()
}

/// Lands an unchained Registration carrying a handle payload, as the
/// admission does, returning its act id.
async fn land_admission_shaped_registration(rig: &Rig, actor: Uuid, key: &ActorKey) -> String {
    let prepared = api::prepare::prepare(
        &rig.boundary,
        &rig.pool,
        GC,
        actor,
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
            payload: handle_payload("ada"),
            node: None,
        },
    )
    .await
    .expect("prepares the Registration");
    rig.sign_and_relay(prepared.id, key).await;
    rig.close_and_ingest().await;
    prepared.proposal.body.act_id().to_string()
}

/// The admission Registration's handle reaches carriage at its landing
/// like any landed payload, instead of living on only in its staged row.
///
/// A landed admission Registration's handle payload moves into carriage.
/// ´claim:redaction:the-admission-handle-reaches-carriage´
#[sqlx::test(migrations = "../../migrations")]
async fn an_admission_registration_lands_its_handle_into_carriage(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let act_id = land_admission_shaped_registration(&rig, actor, &key).await;
    let carriage = content_store::act_payload(&rig.pool, &act_id)
        .await
        .expect("reads")
        .expect("carried");
    assert_eq!(carriage.payload, Some(handle_payload("ada")));
}

/// A landed write whose staged row is still the payload's only copy — the
/// admission handle as it landed before its promotion existed — is
/// promoted into carriage first, so the unit archives it and the reap
/// erases nothing silently.
///
/// A payload left only on its landed staged row is promoted before anything is reaped, and archived.
/// ´claim:redaction:a-staged-only-payload-is-promoted-before-the-reap´
#[sqlx::test(migrations = "../../migrations")]
async fn a_handle_left_only_on_its_staged_row_is_promoted_before_the_reap(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let act_id = land_admission_shaped_registration(&rig, actor, &key).await;
    sqlx::query("DELETE FROM act_payloads WHERE act_id = $1")
        .bind(&act_id)
        .execute(&rig.pool)
        .await
        .expect("rewinds to a world without the promotion");

    let done = rig.redact(actor, &act_id).await;
    assert!(done.promoted_first && done.reduced && done.staged_reaped);
    let unit = rig.units(&act_id).await.remove(0);
    assert_eq!(
        unhex(&unit.original_data["envelope"]),
        handle_payload("ada")
    );
    assert_eq!(
        rig.copies(&act_id).await,
        Copies {
            carriage: Some((false, false, "reduced".into())),
            staged: Some((false, false, false)),
            l1: Some((false, false, false)),
        }
    );
}

/// One asset in two posts: redacting the first leaves it live and serving
/// the second, with the first unit referencing it; redacting the second
/// — its last live placement — holds it.
///
/// A shared asset stays live until its last placement is redacted, and is held then.
/// ´claim:redaction:a-shared-asset-is-held-only-at-its-last-placement´
#[sqlx::test(migrations = "../../migrations")]
async fn a_shared_asset_stays_live_until_its_last_placement_is_redacted(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let shared = rig.asset(actor, 0x33).await;
    let own = rig.asset(actor, 0x44).await;
    let (_, first) = rig.landed_post(actor, &key, "First.", &[shared, own]).await;
    let (_, second) = rig.landed_post(actor, &key, "Second.", &[shared]).await;

    let done = rig.redact(actor, &first).await;
    assert_eq!(
        done.held_media,
        vec![own],
        "only the asset nothing else shows"
    );
    assert!(!rig.held(shared).await, "the second post still shows it");
    assert!(rig.units(&first).await[0].media.contains(&shared));

    let done = rig.redact(actor, &second).await;
    assert_eq!(done.held_media, vec![shared]);
    assert!(rig.held(shared).await);
}

/// A manual hard delete removes the unit and names, for deletion with it,
/// only the objects no other held unit references: deleting the first of
/// two units sharing an asset frees nothing of it; deleting the second
/// frees it.
///
/// A manual hard delete releases only the objects no other held unit references.
/// ´claim:redaction:a-hard-delete-releases-only-last-references´
#[sqlx::test(migrations = "../../migrations")]
async fn a_manual_hard_delete_removes_only_media_no_other_held_unit_references(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let shared = rig.asset(actor, 0x55).await;
    let own = rig.asset(actor, 0x66).await;
    let (_, first) = rig.landed_post(actor, &key, "First.", &[shared, own]).await;
    let (_, second) = rig.landed_post(actor, &key, "Second.", &[shared]).await;
    rig.redact(actor, &first).await;
    rig.redact(actor, &second).await;
    let first_unit = rig.units(&first).await.remove(0).id;
    let second_unit = rig.units(&second).await.remove(0).id;

    let mut tx = rig.pool.begin().await.expect("tx");
    let gone = retention::hard_delete_unit(&mut tx, first_unit)
        .await
        .expect("deletes")
        .expect("a unit");
    tx.commit().await.expect("commits");
    assert_eq!(gone.original_id, first);
    assert_eq!(
        gone.last_references
            .iter()
            .map(|r| r.media_id)
            .collect::<Vec<_>>(),
        vec![own],
        "the shared asset is still held under the second unit"
    );
    assert!(rig.units(&first).await.is_empty());

    let mut tx = rig.pool.begin().await.expect("tx");
    let gone = retention::hard_delete_unit(&mut tx, second_unit)
        .await
        .expect("deletes")
        .expect("a unit");
    tx.commit().await.expect("commits");
    assert_eq!(
        gone.last_references
            .iter()
            .map(|r| r.media_id)
            .collect::<Vec<_>>(),
        vec![shared]
    );
}

/// A unit carries no hold expiry — the MVP holds until a manual act — and
/// the orphan sweep never takes an asset that is held or that a unit
/// references, even once nothing places it and it is old enough to sweep.
///
/// An archive unit has no hold expiry, and no sweep removes media it holds.
/// ´claim:redaction:no-job-deletes-a-held-unit´
#[sqlx::test(migrations = "../../migrations")]
async fn an_integrity_unit_has_no_hold_expiry_and_no_job_deletes_it(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let picture = rig.asset(actor, 0x77).await;
    let (_, act_id) = rig.landed_post(actor, &key, "Held.", &[picture]).await;
    rig.redact(actor, &act_id).await;
    assert_eq!(rig.units(&act_id).await[0].legal_hold_until, None);
    sqlx::query("DELETE FROM post_attachments WHERE attachment_id = $1")
        .bind(picture)
        .execute(&rig.pool)
        .await
        .expect("leaves the archive as the only reference");

    let swept = media_store::sweep_orphans(&rig.pool, 0.0, 100)
        .await
        .expect("sweeps");
    assert!(swept.iter().all(|s| s.id != picture), "{swept:?}");
    assert!(rig.held(picture).await);
}

/// A carriage row already reduced stays reduced when promotion runs over
/// it again, as a mirror rebuild does: promotion keeps the first row.
///
/// A reduced carriage row stays reduced through a re-promotion.
/// ´claim:redaction:a-reduced-row-survives-a-rebuild´
#[sqlx::test(migrations = "../../migrations")]
async fn a_reduced_row_stays_reduced_through_a_mirror_rebuild(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let (_, act_id) = rig.landed_post(actor, &key, "Rebuilt.", &[]).await;
    rig.redact(actor, &act_id).await;

    let mut tx = rig.pool.begin().await.expect("tx");
    content_store::insert_act_payload(&mut tx, &act_id, b"the old bytes", b"the old salt")
        .await
        .expect("promotes");
    tx.commit().await.expect("commits");
    assert_eq!(
        rig.copies(&act_id).await.carriage,
        Some((false, false, "reduced".into()))
    );
}

/// A carried act is never redacted: it never reached Layer 1 or a reader,
/// and is deleted outright with its account instead.
///
/// A carried act is refused by the redaction and left untouched.
/// ´claim:redaction:a-carried-act-is-not-redacted´
#[sqlx::test(migrations = "../../migrations")]
async fn a_carried_act_is_refused_rather_than_redacted(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, _) = rig.funded_actor("ada").await;
    let (staged_id, act_id) = rig.prepare_post(actor, "Carried.", &[]).await;
    staged::carry(&rig.pool, &[staged_id])
        .await
        .expect("carries");

    let redacted_by = actor.to_string();
    let refused = redaction::redact_act(
        &rig.pool,
        &Redaction {
            actor_id: actor,
            act_id: &act_id,
            reason: REASON,
            redacted_by: &redacted_by,
        },
    )
    .await;
    assert!(
        matches!(refused, Err(RedactionError::Carried(_))),
        "{refused:?}"
    );
    assert_eq!(rig.copies(&act_id).await.staged.map(|s| s.0), Some(true));
}

/// A redaction whose Postgres half committed but whose substrate drop
/// never ran — a crash between the two — completes on the retry: the drop
/// happens, and nothing on the Postgres side is archived or reaped twice.
///
/// A redaction interrupted before the substrate drop completes on its retry without repeating any step.
/// ´claim:redaction:an-interrupted-redaction-completes-on-retry´
#[sqlx::test(migrations = "../../migrations")]
async fn a_redaction_interrupted_before_the_substrate_drop_completes_on_retry(pool: PgPool) {
    let rig = Rig::new(pool).await;
    let (actor, key) = rig.funded_actor("ada").await;
    let (staged_id, act_id) = rig.prepare_post(actor, "Interrupted.", &[]).await;
    rig.sign_and_relay(staged_id, &key).await;
    let redacted_by = actor.to_string();
    redaction::redact_act(
        &rig.pool,
        &Redaction {
            actor_id: actor,
            act_id: &act_id,
            reason: REASON,
            redacted_by: &redacted_by,
        },
    )
    .await
    .expect("the Postgres half");
    assert_eq!(
        rig.copies(&act_id).await.l1,
        Some((true, true, true)),
        "the crash left the substrate's residue"
    );

    let retry = rig.redact(actor, &act_id).await;
    assert_eq!(retry, redaction::Redacted::default());
    assert_eq!(rig.copies(&act_id).await.l1, Some((false, false, false)));
    assert_eq!(rig.units(&act_id).await.len(), 1);
}
