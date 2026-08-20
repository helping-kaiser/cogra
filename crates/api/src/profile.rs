// Profile authoring and promotion — slice 2.1 (api-spec.md "Content
// authoring" `prepareProfileUpdate`; substrate.md §9; user.md §4).
// Prepare-side: build the parallel-Registration gesture — L1's own
// profile-update idiom, payload only, never identity — chained behind
// the current head and staged through the ordinary write path.
// Confirm-side: promote landed profile updates into carriage and a new
// actor_profile_versions row, the flow that makes the display row
// appear alongside the record witnessing it.

use common::envelope::CograProfile;
use common::l1::census::Family;
use common::l1::identifier::{ActId, NodeId};
use postgres_store::{PgPool, auth as store, content as content_store, mirror, profile, staged};
use uuid::Uuid;

use crate::ingest::PromotionFailure;
use crate::l1::L1Boundary;
use crate::prepare::{self, Gesture, PrepareError, Target};

#[derive(Debug, thiserror::Error)]
pub enum ProfileError {
    #[error("{message}")]
    BadInput {
        field: &'static str,
        message: String,
    },
    #[error(transparent)]
    Prepare(#[from] PrepareError),
    #[error("internal: {0}")]
    Internal(String),
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
}

/// Prepares a profile update: a parallel Registration toward the
/// author's own Profile at the census-fixed `(1, 1)` (edges.md §2),
/// chained behind the current head — the backend populates the causal
/// parent and serializes updates per (node, author), so CoGra's own
/// clients never author a branch (substrate.md §9).
pub async fn prepare_profile_update<B: L1Boundary>(
    pool: &PgPool,
    boundary: &B,
    gc_after_epochs: i64,
    viewer: Uuid,
    draft: ProfileUpdateDraft,
) -> Result<prepare::Prepared, ProfileError> {
    if draft.display_name.is_none() && draft.bio.is_none() && draft.website_url.is_none() {
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
    let address = store::actor_identity(pool, viewer)
        .await?
        .and_then(|identity| identity.l0_address)
        .ok_or_else(|| ProfileError::Internal("viewer without an attached address".into()))?;
    let prof = NodeId::Prof(address.clone());
    let prof_string = prof.to_string();
    if staged::has_pending_targeting(pool, viewer, Family::Registration, &prof_string).await? {
        return Err(ProfileError::BadInput {
            field: "input",
            message: "a profile update is already in flight".into(),
        });
    }
    // The chain root is the anchoring admission Registration
    // (substrate.md §9), landed before the account became a member —
    // a missing head means the mirror diverged.
    let head = mirror::chain_head(pool, &address, Family::Registration, &prof_string)
        .await?
        .ok_or_else(|| {
            ProfileError::Internal("profile chain head missing from the mirror".into())
        })?;
    let parent = ActId::parse(&head)
        .map_err(|e| ProfileError::Internal(format!("chain head unparseable: {e}")))?;
    let payload = CograProfile {
        node: viewer,
        display_name: draft.display_name,
        bio: draft.bio,
        website_url: draft.website_url,
    }
    .encode_payload();
    let prepared = prepare::prepare(
        boundary,
        pool,
        gc_after_epochs,
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
            node: None,
        },
    )
    .await?;
    Ok(prepared)
}

/// Confirm-side promotion: for every landed profile update, move the
/// payload into permanent carriage and append the merged
/// actor_profile_versions row. The admission Registration (and the
/// genesis casts) carry pre-PCE payloads — anything without the
/// envelope magic is theirs, handled by onboarding, and skipped here.
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

async fn land_one(pool: &PgPool, write: &staged::PromotedWrite) -> Result<(), ProfileError> {
    let staged_row = staged::load(pool, write.id).await?;
    let payload = &staged_row.proposal.payload;
    if !payload.starts_with(&[0xD9, 0xD9, 0xF7]) {
        // The admission Registration's interim pre-PCE payload
        // (onboarding.rs) — not a profile update.
        return Ok(());
    }
    let sealed = staged_row
        .sealed
        .as_ref()
        .ok_or_else(|| ProfileError::Internal("landed write without sealed parts".into()))?;
    let update = CograProfile::decode_payload(payload)
        .map_err(|e| ProfileError::Internal(format!("landed payload not admissible: {e}")))?;
    if update.node != write.actor_id {
        return Err(ProfileError::Internal(
            "profile payload names a different actor".into(),
        ));
    }
    let current = profile::current_profile(pool, write.actor_id)
        .await?
        .ok_or_else(|| ProfileError::Internal("actor without a seeded profile version".into()))?;
    // Copy-forward merge (data-model.md "Display-content versioning"):
    // the newest version row alone renders the profile; present-and-empty
    // clears, absent keeps. An empty display name never leaves prepare.
    let display_name = match update.display_name {
        None => current.display_name,
        Some(name) if name.is_empty() => {
            return Err(ProfileError::Internal(
                "landed profile update clears the display name".into(),
            ));
        }
        Some(name) => name,
    };
    let bio = merge_optional(&update.bio, &current.bio);
    let website_url = merge_optional(&update.website_url, &current.website_url);
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| ProfileError::Internal(e.to_string()))?;
    content_store::insert_act_payload(&mut tx, &write.act_id, payload, &sealed.content_salt)
        .await?;
    profile::insert_profile_version(
        &mut tx,
        write.actor_id,
        &display_name,
        bio.as_deref(),
        current.avatar_id,
        current.cover_id,
        website_url.as_deref(),
    )
    .await?;
    tx.commit()
        .await
        .map_err(|e| ProfileError::Internal(e.to_string()))?;
    Ok(())
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
