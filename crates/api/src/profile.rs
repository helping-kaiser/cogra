//! ´mod:module:profile´
//!
//! Profile authoring and promotion — slice 2.1 (api-spec.md "Content
//! authoring" `prepareProfileUpdate`; substrate.md §9; user.md §4).
//!
//! Prepare-side: build the parallel-Registration gesture — L1's own
//! profile-update idiom, payload only, never identity — chained behind
//! the current head and staged through the ordinary write path.
//!
//! Pre-commitment: the update's merged `actor_profile_versions` row is
//! written the moment the author signs, marked pending, and every reader
//! is served it from then on — an update is its author's content from the
//! signature, not from the landing (substrate.md §6).
//!
//! Confirm-side: promote landed profile updates into carriage and drop
//! the pending row's mark, stamping the record's landing coordinates.

use common::envelope::CograProfile;
use common::l1::census::Family;
use common::l1::identifier::{ActId, NodeId};
use postgres_store::content::LandingOrder;
use postgres_store::{PgPool, content as content_store, mirror, profile, staged};
use uuid::Uuid;

use crate::ingest::PromotionFailure;
use crate::l1::L1Boundary;
use crate::prepare::{self, Gesture, PrepareError, Staging, Target};
use crate::ratelimit::SigningClass;

/// The longest a display name may run (user.md §4), Unicode scalar
/// values like every character cap on this surface.
pub const MAX_DISPLAY_NAME_CHARS: usize = 50;

/// The longest a bio may run (user.md §4), Unicode scalar values.
pub const MAX_BIO_CHARS: usize = 500;

/// The longest a website URL may run (user.md §4), Unicode scalar
/// values — wide enough for the URLs the field actually carries
/// (RFC 3986 sets no practical ceiling of its own).
pub const MAX_WEBSITE_URL_CHARS: usize = 2048;

#[derive(Debug, thiserror::Error)]
pub enum ProfileError {
    #[error("{message}")]
    BadInput {
        field: &'static str,
        message: String,
    },
    /// A profile picture was refused; the path names the offending field.
    #[error(transparent)]
    Media(#[from] crate::media::GalleryError),
    #[error(transparent)]
    Prepare(#[from] PrepareError),
    #[error("internal: {0}")]
    Internal(String),
}

impl From<crate::media::GalleryPlanError> for ProfileError {
    fn from(e: crate::media::GalleryPlanError) -> Self {
        match e {
            crate::media::GalleryPlanError::BadInput(e) => Self::Media(e),
            crate::media::GalleryPlanError::Internal(m) => Self::Internal(m),
        }
    }
}

impl From<sqlx::Error> for ProfileError {
    fn from(e: sqlx::Error) -> Self {
        Self::Internal(e.to_string())
    }
}

impl From<staged::StagedError> for ProfileError {
    fn from(e: staged::StagedError) -> Self {
        Self::Internal(e.to_string())
    }
}

impl From<mirror::MirrorError> for ProfileError {
    fn from(e: mirror::MirrorError) -> Self {
        Self::Internal(e.to_string())
    }
}

impl From<content_store::ContentError> for ProfileError {
    fn from(e: content_store::ContentError) -> Self {
        Self::Internal(e.to_string())
    }
}

/// A profile update's field set: `None` = untouched; `Some("")` =
/// cleared (api-spec.md — the wire form of the per-field newest-wins
/// fold). The display name refuses the clear — a profile always shows
/// a name.
pub struct ProfileUpdateDraft {
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub website_url: Option<String>,
    /// The avatar — the profile's one image — three-valued: `None`
    /// untouched, `Some(None)` cleared back to the monogram,
    /// `Some(Some(id))` replaced. The text fields above are two-valued and
    /// encode their clear as the empty string; a picture has no empty
    /// string, so the two shapes stay apart rather than one pretending to
    /// be the other.
    pub avatar_media_id: Option<Option<Uuid>>,
}

/// A profile text field's length against its own cap. `None` (untouched)
/// and `Some("")` (the clear sentinel) both pass through unchecked — the
/// cap bounds what an author writes, not the absence of a write.
fn checked_profile_len(
    field: &'static str,
    label: &str,
    value: Option<String>,
    max: usize,
) -> Result<Option<String>, ProfileError> {
    match &value {
        Some(text) if !text.is_empty() && text.chars().count() > max => {
            Err(ProfileError::BadInput {
                field,
                message: format!("the {label} is longer than {max} characters"),
            })
        }
        _ => Ok(value),
    }
}

/// Prepares a profile update: a parallel Registration toward the
/// author's own Profile at the census-fixed `(1, 1)` (edges.md §2),
/// chained behind the current head — the backend populates the causal
/// parent and serializes updates per (node, author), so CoGra's own
/// clients never author a branch (substrate.md §9). An earlier update the
/// author never signed is superseded rather than serialized behind: it can
/// no longer be signed, so the chain stays unbranched without it holding
/// the profile until GC.
///
/// That chain roots in the anchoring admission Registration, which landed
/// before the account became a member — so a missing head is not an empty
/// profile history but a diverged mirror, and is refused as an internal
/// fault.
pub async fn prepare_profile_update<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    staging: Staging,
    viewer: Uuid,
    draft: ProfileUpdateDraft,
) -> Result<prepare::Prepared, ProfileError> {
    if draft.display_name.is_none()
        && draft.bio.is_none()
        && draft.website_url.is_none()
        && draft.avatar_media_id.is_none()
    {
        return Err(ProfileError::BadInput {
            field: "input",
            message: "an update must change at least one field".into(),
        });
    }
    if draft.display_name.as_deref() == Some("") {
        return Err(ProfileError::BadInput {
            field: "displayName",
            message: "the display name cannot be cleared".into(),
        });
    }
    let display_name = checked_profile_len(
        "displayName",
        "display name",
        draft.display_name,
        MAX_DISPLAY_NAME_CHARS,
    )?;
    let bio = checked_profile_len("bio", "bio", draft.bio, MAX_BIO_CHARS)?;
    let website_url = checked_profile_len(
        "websiteUrl",
        "website URL",
        draft.website_url,
        MAX_WEBSITE_URL_CHARS,
    )?;
    let address = crate::nodes::required_address(pool, viewer)
        .await
        .map_err(|e| ProfileError::Internal(e.to_string()))?;
    let prof = NodeId::Prof(address.clone());
    let prof_string = prof.to_string();
    let current_epoch = mirror::last_ingested_epoch(pool).await?;
    staged::supersede_unsigned_targeting(
        pool,
        viewer,
        Family::Registration,
        &prof_string,
        current_epoch,
    )
    .await?;
    if staged::has_pending_targeting(pool, viewer, Family::Registration, &prof_string).await? {
        return Err(ProfileError::BadInput {
            field: "input",
            message: "a profile update is already in flight".into(),
        });
    }
    let head = mirror::chain_head(pool, &address, Family::Registration, &prof_string)
        .await?
        .ok_or_else(|| {
            ProfileError::Internal("profile chain head missing from the mirror".into())
        })?;
    let parent = ActId::parse(&head)
        .map_err(|e| ProfileError::Internal(format!("chain head unparseable: {e}")))?;
    let avatar =
        crate::media::plan_profile_image(pool, viewer, "avatarMediaId", draft.avatar_media_id)
            .await?;
    let payload = CograProfile {
        node: viewer,
        display_name,
        bio,
        website_url,
        avatar,
    }
    .encode_for_prepare()
    .map_err(|e| ProfileError::Internal(format!("payload not admissible: {e}")))?;
    prepare::check_write_rule(
        boundary,
        pool,
        &staging,
        viewer,
        &address,
        &[(SigningClass::Edit, 1)],
    )
    .await?;
    let prepared = prepare::prepare(
        boundary,
        pool,
        staging.gc_after_epochs,
        viewer,
        Gesture {
            author: address,
            family: Family::Registration,
            middle: None,
            target: Target::Node(prof),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![parent],
            deps: vec![],
            payload,
            node: Some(viewer),
        },
    )
    .await?;
    Ok(prepared)
}

/// Pre-commitment materialization of a profile update (substrate.md §6;
/// architecture.md "The write path"): from the moment the author signs,
/// the merged version row exists and every reader is served it, marked
/// pending — the profile-side branch of `content::stage_pending`.
///
/// The row is the update merged onto the **landed** profile: an update is
/// a delta, and the graph has accepted only what landed. The one update
/// that could be pending beside it is this write's own — the backend
/// serializes profile updates per author ([`prepare_profile_update`]) —
/// so a retried pre-sign merges onto the same base, and its row collides
/// with the one already written rather than adding a second.
///
/// An unchained Registration is the admission (or a genesis cast): its
/// payload is not a profile update and onboarding owns it, so there is
/// nothing to stage. A chained one is always prepared with its actor as
/// the staged node — the key expiry discards the row by — and one
/// without it is a fault, not a quiet success, for the reason
/// `content::stage_pending` gives.
pub async fn stage_pending(
    pool: &PgPool,
    write: &staged::StagedWrite,
    created_at: chrono::DateTime<chrono::Utc>,
) -> Result<(), ProfileError> {
    if write.proposal.body.asserted_parents.is_empty() {
        return Ok(());
    }
    if write.node_id != Some(write.actor_id) {
        return Err(ProfileError::Internal(
            "a profile update is staged without its actor as node".into(),
        ));
    }
    let update = CograProfile::decode_payload(&write.proposal.payload)
        .map_err(|e| ProfileError::Internal(format!("staged payload not admissible: {e}")))?;
    let merged = merge_update(pool, write.actor_id, update).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| ProfileError::Internal(e.to_string()))?;
    profile::insert_profile_version(
        &mut tx,
        write.actor_id,
        &merged.display_name,
        merged.bio.as_deref(),
        merged.avatar_id,
        merged.website_url.as_deref(),
        None,
        created_at,
    )
    .await?;
    tx.commit()
        .await
        .map_err(|e| ProfileError::Internal(e.to_string()))?;
    Ok(())
}

/// Confirm-side promotion: for every landed profile update, move the
/// payload into permanent carriage and land its version row. The
/// admission Registration (and the genesis casts) are unchained and
/// handled by onboarding; their payloads still move into carriage here.
/// A failure leaves the record un-promoted — the mirror governs, and a
/// later rebuild can re-run promotion — and is returned rather than
/// swallowed, so the ingestion pass reports what did not follow.
pub async fn land_promoted(
    pool: &PgPool,
    promoted: &[staged::PromotedWrite],
) -> Vec<PromotionFailure> {
    let mut failures = Vec::new();
    for write in promoted {
        if write.family != Family::Registration.as_str() {
            continue;
        }
        if let Err(e) = land_one(pool, write).await {
            failures.push(PromotionFailure {
                stage: "profile",
                staged: write.id,
                act_id: write.act_id.clone(),
                error: e.to_string(),
            });
        }
    }
    failures
}

/// Promotes one landed profile update.
///
/// The version row is normally already on screen from the pre-commitment
/// ([`stage_pending`]), so landing writes the record's coordinates onto it
/// and drops its pending mark; the coordinates are what order it against
/// the other versions, so two updates by one actor are ordered by their
/// records rather than by which promotion happened to run first. The
/// insert branch is the uncommon path: an update that landed without a
/// pending row of its own — a mirror rebuild, a write staged before
/// pending profile rows existed, or one landing after its pending row
/// expired.
///
/// The merge is copy-forward (data-model.md "Display-content
/// versioning"): the newest version row alone renders the profile, so a
/// present-but-empty field clears and an absent one keeps what stands. An
/// empty display name never leaves prepare, and one arriving here is
/// therefore a fault rather than a clear.
///
/// Not every landed `Family::Registration` is a profile update: the
/// admission and genesis payloads share the family. A profile update
/// always asserts its chain parent (substrate.md §9) and those are
/// unchained, so that structural fact is the discriminator — the same one
/// `onboarding::ensure_admission_staged` uses for the mirror-image
/// decision. Sniffing the payload's leading bytes instead would
/// re-assert `common::envelope`'s wire framing here, and a change to that
/// framing would silently reclassify every profile update as an admission
/// payload and return `Ok(())` for all of them.
///
/// An unchained Registration writes no profile version, but its payload —
/// the admission Registration carries the handle — still moves into
/// carriage like any landed payload: the staged row is not a payload's
/// permanent home, and a redaction reaps it.
///
/// A Registration whose staged payload a redaction reaped before the
/// record arrived lands reduced: a carriage row holding nothing, and no
/// version row, since there is no update left to apply — the pending row
/// built from the removed bytes goes with them. A redaction that reduced
/// the act while it was being promoted has the last word the same way: no
/// version row stands on bytes it removed.
///
/// The authoring instant, like `sealed`, is set by the pre-sign leg, so a
/// landed update missing it is the same internal fault its sibling is.
///
/// The update is read under the read/ingest admission
/// ([`CograProfile::read_payload`]), as content's landing reads its payload.
async fn land_one(pool: &PgPool, write: &staged::PromotedWrite) -> Result<(), ProfileError> {
    let staged_row = match staged::load_promotable(pool, write.id).await? {
        staged::Promotable::Full(row) => *row,
        staged::Promotable::Reaped(reaped) => {
            let mut tx = pool
                .begin()
                .await
                .map_err(|e| ProfileError::Internal(e.to_string()))?;
            content_store::insert_reduced_act_payload(&mut tx, &write.act_id, reaped.reaped_at)
                .await?;
            if !reaped.body.asserted_parents.is_empty()
                && let Some(created_at) = reaped.pre_signed_at
            {
                content_store::discard_pending(&mut tx, write.actor_id, created_at).await?;
            }
            tx.commit()
                .await
                .map_err(|e| ProfileError::Internal(e.to_string()))?;
            return Ok(());
        }
    };
    let payload = &staged_row.proposal.payload;
    let sealed = staged_row
        .sealed
        .as_ref()
        .ok_or_else(|| ProfileError::Internal("landed write without sealed parts".into()))?;
    if staged_row.proposal.body.asserted_parents.is_empty() {
        if payload.is_empty() {
            return Ok(());
        }
        let mut tx = pool
            .begin()
            .await
            .map_err(|e| ProfileError::Internal(e.to_string()))?;
        content_store::insert_act_payload(&mut tx, &write.act_id, payload, &sealed.content_salt)
            .await?;
        tx.commit()
            .await
            .map_err(|e| ProfileError::Internal(e.to_string()))?;
        return Ok(());
    }
    let update = CograProfile::read_payload(payload)
        .map_err(|e| ProfileError::Internal(format!("landed payload not admissible: {e}")))?
        .fields;
    let created_at = staged_row.pre_signed_at.ok_or_else(|| {
        ProfileError::Internal("landed update without an authoring instant".into())
    })?;
    let meta = mirror::record_meta(pool, &write.act_id)
        .await?
        .ok_or_else(|| ProfileError::Internal("promoted record missing from mirror".into()))?;
    let order = LandingOrder {
        landed_epoch: meta.epoch,
        act_time: meta.act_time,
        position: meta.position,
    };
    let merged = merge_update(pool, write.actor_id, update).await?;
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| ProfileError::Internal(e.to_string()))?;
    content_store::insert_act_payload(&mut tx, &write.act_id, payload, &sealed.content_salt)
        .await?;
    if content_store::lock_act_payload(&mut tx, &write.act_id)
        .await?
        .is_some_and(|carriage| carriage.reduced)
    {
        content_store::discard_pending(&mut tx, write.actor_id, created_at).await?;
        tx.commit()
            .await
            .map_err(|e| ProfileError::Internal(e.to_string()))?;
        return Ok(());
    }
    if !profile::land_profile_version(&mut tx, write.actor_id, created_at, order).await? {
        profile::insert_profile_version(
            &mut tx,
            write.actor_id,
            &merged.display_name,
            merged.bio.as_deref(),
            merged.avatar_id,
            merged.website_url.as_deref(),
            Some(order),
            created_at,
        )
        .await?;
    }
    tx.commit()
        .await
        .map_err(|e| ProfileError::Internal(e.to_string()))?;
    Ok(())
}

/// A profile update merged onto the actor's landed profile — the full
/// field set its version row carries.
struct MergedProfile {
    display_name: String,
    bio: Option<String>,
    avatar_id: Option<Uuid>,
    website_url: Option<String>,
}

/// Merges an update onto the actor's landed profile
/// ([`profile::landed_profile`]), copy-forward: what the update leaves
/// absent keeps the landed value.
///
/// The update must name its own actor: the payload's node is the binding,
/// and a version row written under another actor would put one person's
/// words on another's profile.
async fn merge_update(
    pool: &PgPool,
    actor_id: Uuid,
    update: CograProfile,
) -> Result<MergedProfile, ProfileError> {
    if update.node != actor_id {
        return Err(ProfileError::Internal(
            "profile payload names a different actor".into(),
        ));
    }
    let base = profile::landed_profile(pool, actor_id)
        .await?
        .ok_or_else(|| ProfileError::Internal("actor without a seeded profile version".into()))?;
    let display_name = match update.display_name {
        None => base.display_name,
        Some(name) if name.is_empty() => {
            return Err(ProfileError::Internal(
                "a profile update clears the display name".into(),
            ));
        }
        Some(name) => name,
    };
    let avatar_id = merge_image(
        crate::media::resolve_profile_image(pool, actor_id, &update.avatar).await?,
        base.avatar_id,
    );
    Ok(MergedProfile {
        display_name,
        bio: merge_optional(&update.bio, &base.bio),
        avatar_id,
        website_url: merge_optional(&update.website_url, &base.website_url),
    })
}

/// An update's optional display field against the current version:
/// absent keeps, empty clears to NULL, text replaces.
fn merge_optional(update: &Option<String>, current: &Option<String>) -> Option<String> {
    match update {
        None => current.clone(),
        Some(s) if s.is_empty() => None,
        Some(s) => Some(s.clone()),
    }
}

/// An update's image slot against the current version: absent keeps,
/// cleared writes NULL, an asset replaces.
///
/// A slot the payload set but whose asset CoGra no longer holds resolves
/// to `Some(None)` and therefore clears — the honest answer, since the
/// picture the record named is not there to show. The record stands
/// either way; what CoGra can render is a carriage question.
fn merge_image(update: Option<Option<Uuid>>, current: Option<Uuid>) -> Option<Uuid> {
    match update {
        None => current,
        Some(chosen) => chosen,
    }
}
