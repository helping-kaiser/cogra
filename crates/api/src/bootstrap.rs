//! ´mod:module:bootstrap´
//!
//! Genesis bootstrap — the one-shot instance creation (architecture.md
//! "Genesis bootstrap"; network.md §2).
//!
//! Out-of-graph authority is confined to this bootstrap; there is no
//! runtime genesis flow.

use common::l1::Family;
use common::l1::client::ActorKey;
use common::l1::handshake::{Proposal, StructuralBody};
use common::l1::identifier::{ActId, NodeId};
use l1_standin::StandIn;
use postgres_store::PgPool;
use postgres_store::genesis::{
    self, MODERATOR_HANDLE, PUBLISHER_HANDLE, RESERVED_TYPES, TREASURY_HANDLE,
};
use postgres_store::mirror;
use uuid::Uuid;

use crate::l1::StandInBoundary;

/// Operator input, supplied at run time (network.md §2 — the central
/// instance picks the project owner; a fork sets its own genesis).
pub struct GenesisInput {
    pub handle: String,
    pub display_name: String,
    /// The pinned platform-guidelines version + hash carried in the
    /// Charter payload (network.md §3 "Platform guidelines").
    pub guidelines_version: String,
    pub guidelines_hash: String,
    /// The genesis L0 burn per cast address, micro-units (the stand-in's
    /// L0 surface honors it as numbers).
    pub burn_per_account_micro: i64,
}

#[derive(Debug, PartialEq, Eq)]
pub enum BootstrapOutcome {
    /// Nothing existed; both halves were created.
    Fresh,
    /// The L2 half stood and the L1 half was completed from it.
    Repaired,
    /// Both halves stood; nothing was written.
    AlreadyComplete,
}

#[derive(Debug, thiserror::Error)]
pub enum BootstrapError {
    /// The instance cannot be brought to a consistent state, for the
    /// reason the string names.
    ///
    /// This is a one-shot operator tool, so the message *is* the
    /// diagnostic: a fixed sentence describing one of the several
    /// situations that reach here would be actively wrong for the
    /// others — a mis-sized custodied seed is not "the keys are gone".
    #[error("unrepairable: {0}")]
    Unrepairable(String),
    #[error("genesis diverged: {0}")]
    Diverged(String),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
    #[error(transparent)]
    Mirror(#[from] mirror::MirrorError),
    #[error(transparent)]
    Ingest(#[from] crate::ingest::IngestError),
    #[error("genesis promotion failed: {0}")]
    PromotionFailed(String),
    #[error("L1 relay: {0}")]
    Relay(String),
    #[error("operator login: {0}")]
    OperatorLogin(String),
    #[error("the platform-guidelines document could not be read from {path}: {source}")]
    Guidelines {
        path: String,
        source: std::io::Error,
    },
}

/// The canonical platform-guidelines document, located relative to this
/// crate at compile time.
const GUIDELINES_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../docs/instances/platform-guidelines.md"
);

/// SHA-256 hex digest of the canonical version-1 platform-guidelines
/// document, pinned into the Charter payload (network.md §3).
///
/// A read failure is fatal, on the posture `DATABASE_URL` already takes
/// and `ingest_or_refuse` already states. The digest goes into an L1
/// record that is never deletable, and the value substituted when the
/// file is missing — the digest of the empty input — is a pin that is
/// simply wrong, committed permanently, with nothing afterwards to
/// verify it. A deployment running the binary without the source tree at
/// this path should get an error, not an instance whose Charter pins
/// nothing.
pub fn guidelines_hash() -> Result<String, BootstrapError> {
    digest_of(std::path::Path::new(GUIDELINES_PATH))
}

/// The hex SHA-256 of a file, or the reason it could not be read. Split
/// out from [`guidelines_hash`] so the failure path is reachable from a
/// test: the compile-time path exists whenever the tests run.
pub fn digest_of(path: &std::path::Path) -> Result<String, BootstrapError> {
    use sha2::{Digest, Sha256};
    let bytes = std::fs::read(path).map_err(|source| BootstrapError::Guidelines {
        path: path.display().to_string(),
        source,
    })?;
    Ok(format!("{:x}", Sha256::digest(&bytes)))
}

impl From<l1_standin::StandInError> for BootstrapError {
    fn from(e: l1_standin::StandInError) -> Self {
        BootstrapError::Relay(e.to_string())
    }
}

impl From<common::l1::L1Error> for BootstrapError {
    fn from(e: common::l1::L1Error) -> Self {
        BootstrapError::Relay(e.to_string())
    }
}

/// The genesis values of every governed parameter (network.md §3 catalog).
/// These are the operator's genesis choices — the docs deliberately pin
/// only a few ("defaults bootstrap; they are not fixed"); every value is
/// readable and governable from the schedule afterwards.
fn genesis_parameters(input: &GenesisInput) -> Vec<(&'static str, serde_json::Value)> {
    use serde_json::json;
    vec![
        ("active_threshold_epochs", json!(30)),
        ("mod_role_change_quorum_fraction", json!(0.5)),
        ("mod_role_change_quorum_count", json!(3)),
        ("moderation_sensitive_quorum_fraction", json!(0.5)),
        ("moderation_sensitive_quorum_count", json!(3)),
        ("moderation_illegal_quorum_fraction", json!(0.6)),
        ("moderation_illegal_quorum_count", json!(5)),
        ("guidelines_change_quorum_fraction", json!(0.6)),
        ("guidelines_change_quorum_count", json!(5)),
        ("guidelines_version", json!(input.guidelines_version)),
        ("guidelines_hash", json!(input.guidelines_hash)),
        ("k", json!(8)),
        ("gamma", json!(1.0)),
        ("dust_floor", json!(0.0)),
        ("recency_half_life_epochs", json!(30)),
        ("recency_shape", json!("exponential")),
        (
            "tie_breaker_composition",
            json!(["recency", "global_engagement"]),
        ),
        ("reserve_share", json!(0.01)),
        ("n_eval_epochs", json!(10)),
        ("subsidy_generosity", json!(0.5)),
        ("subsidy_cap_per_member", json!(100)),
        ("support_transform", json!("identity")),
        ("critical_mod_gate_fraction", json!(0.5)),
        ("property_change_quorum_fraction", json!(0.5)),
        ("property_change_quorum_count", json!(3)),
        ("critical_property_change_quorum_fraction", json!(0.6)),
        ("critical_property_change_quorum_count", json!(5)),
    ]
}

struct CastMember {
    key: ActorKey,
}

/// The author-local sequence each genesis act occupies. Named because
/// the numbers are hand-maintained across two actors and eighty lines,
/// and a collision between two of them is a runtime seal `Conflict`
/// routed through `resume_act` rather than anything a compiler sees.
const SEQ_REGISTRATION: u64 = 0;
const SEQ_GM_ENDORSES_PUBLISHER: u64 = 1;
const SEQ_GM_ENDORSES_MODERATOR: u64 = 2;
const SEQ_PUBLISHER_CHARTER: u64 = 1;
const SEQ_PUBLISHER_ROLE_TAG: u64 = 2;

/// Whether an address has never been credited (the funding-idempotency
/// guard, shared by the bootstrap's genesis burn and the onboarding
/// flow's admission burn).
///
/// `burned_total` is an integer micro count divided by 1e6, so the
/// comparison against zero is exact rather than approximate — but the
/// two callers were writing that reasoning out separately, and a guard
/// that must agree in two places is one predicate.
pub fn never_burned(burned_total: f64) -> bool {
    burned_total == 0.0
}

/// The bootstrap's ingestion step. Ordinary ingestion treats a
/// confirm-side promotion failure as survivable — the record landed, the
/// mirror governs, and a later rebuild re-runs the promotion — but the
/// bootstrap is the one-shot step that decides whether an instance
/// exists, so it refuses to complete on any failure rather than leaving
/// a half-promoted genesis behind a success message.
async fn ingest_or_refuse(boundary: &StandInBoundary, pool: &PgPool) -> Result<(), BootstrapError> {
    let outcome =
        crate::ingest::ingest_pending(boundary, pool, crate::ingest::DEFAULT_GC_AFTER_EPOCHS)
            .await?;
    if outcome.promotion_failures.is_empty() {
        return Ok(());
    }
    Err(BootstrapError::PromotionFailed(
        outcome
            .promotion_failures
            .iter()
            .map(|failure| failure.to_string())
            .collect::<Vec<_>>()
            .join("; "),
    ))
}

/// Runs the bootstrap. Takes the stand-in directly: the L0 genesis burn
/// and the genesis epoch close are substrate-side operations the seam
/// deliberately does not carry (with the real Layer 1 both happen on the
/// substrate's side of the boundary).
///
/// Re-running is safe. The mirror is caught up first, so the two-sided
/// gate reads current state; when no service rows exist to key the L1
/// check on, any ingested record at all means an L1 history exists that
/// those rows should have described. The CoGra-side half is skipped when
/// it already stands, and the genesis burn is credited at most once
/// across re-runs by the same zero-burn funding-idempotency guard the
/// onboarding flow uses (`ensure_admission_staged`).
///
/// The L1-side half puts money first and the genesis sequence second, so
/// every record's preconditions already stand (network.md §2):
///
/// 1. The Genesis Moderator registers — the instance's first record.
/// 2. The system actors register, each signed by its own custodied key.
/// 3. The Genesis Moderator endorses The Publisher and The Moderator:
///    external positive-rate vouches clearing their wall. The Treasury
///    needs none, because it never writes again.
/// 4. The Publisher publishes The Charter, whose witnessed payload carries
///    the pinned guidelines and the genesis value of every governed
///    parameter — the parameter fold's base case.
/// 5. The Publisher tags the Genesis Moderator's Profile at the reserved
///    `moderator` role Type — a Tag at `(0, 0)` with a payload, and the
///    first record referencing that Type, anchored vacuously.
pub async fn run(
    standin: &StandIn,
    pool: &PgPool,
    input: GenesisInput,
) -> Result<BootstrapOutcome, BootstrapError> {
    let boundary = StandInBoundary(standin.clone());
    ingest_or_refuse(&boundary, pool).await?;

    let l2_half = genesis::system_actors_present(pool).await?;
    let publisher_address = genesis::actor_by_handle(pool, PUBLISHER_HANDLE)
        .await?
        .and_then(|publisher| publisher.l0_address);
    let l1_half = match publisher_address {
        Some(address) => mirror::has_record_by(pool, &address, Family::Publish).await?,
        None => mirror::last_ingested_epoch(pool).await? >= 0,
    };

    match (l2_half, l1_half) {
        (true, true) => return Ok(BootstrapOutcome::AlreadyComplete),
        (false, true) => {
            return Err(BootstrapError::Unrepairable(
                "the L1 genesis records exist but the operator's service rows do not; \
                 the custodied keys are gone"
                    .into(),
            ));
        }
        _ => {}
    }

    let cast = if l2_half {
        refuse_diverged_input(pool, &input).await?;
        load_cast(pool, &input).await?
    } else {
        seed_l2(pool, &input).await?
    };
    let outcome = if l2_half {
        BootstrapOutcome::Repaired
    } else {
        BootstrapOutcome::Fresh
    };

    let [gm, publisher, moderator, treasury] = &cast;
    for member in &cast {
        let address = member.key.address();
        if never_burned(standin.balance(&address).await?.burned_total) {
            standin
                .credit_burn(&address, input.burn_per_account_micro)
                .await?;
        }
    }

    let host_key = standin.host_public_key().await?;
    let submit = |actor: &ActorKey, proposal: Proposal| {
        let actor = ActorKey::from_seed(actor.seed());
        let host_key = host_key.clone();
        async move {
            let pre = actor.pre_sign(proposal);
            let sealed = match standin.seal(pre.clone()).await {
                Ok(sealed) => sealed,
                Err(l1_standin::StandInError::Conflict(_)) => {
                    return resume_act(standin, &actor, &pre.proposal, &host_key).await;
                }
                Err(e) => return Err(e.into()),
            };
            let witness = actor.approve(&pre, &sealed, &host_key)?;
            standin.approve(witness).await?;
            Ok::<(), BootstrapError>(())
        }
    };

    let gm_registration = registration(&gm.key);
    let gm_reg_id = gm_registration.body.act_id();
    submit(&gm.key, gm_registration).await?;

    let pub_registration = registration(&publisher.key);
    let pub_reg_id = pub_registration.body.act_id();
    submit(&publisher.key, pub_registration).await?;
    let mod_registration = registration(&moderator.key);
    let mod_reg_id = mod_registration.body.act_id();
    submit(&moderator.key, mod_registration).await?;
    submit(&treasury.key, registration(&treasury.key)).await?;

    submit(
        &gm.key,
        opinion(
            &gm.key,
            SEQ_GM_ENDORSES_PUBLISHER,
            &publisher.key.address(),
            vec![pub_reg_id.clone()],
        ),
    )
    .await?;
    submit(
        &gm.key,
        opinion(
            &gm.key,
            SEQ_GM_ENDORSES_MODERATOR,
            &moderator.key.address(),
            vec![mod_reg_id],
        ),
    )
    .await?;

    let charter_payload = serde_json::json!({
        "charter": {
            "guidelines_version": input.guidelines_version,
            "guidelines_hash": input.guidelines_hash,
        },
        "parameters": serde_json::Map::from_iter(
            genesis_parameters(&input)
                .into_iter()
                .map(|(k, v)| (k.to_string(), v)),
        ),
    });
    let charter = own_mint(
        &publisher.key.address(),
        SEQ_PUBLISHER_CHARTER,
        Family::Publish,
        serde_json::to_vec(&charter_payload).map_err(|e| BootstrapError::Relay(e.to_string()))?,
        vec![pub_reg_id],
    )?;
    let charter_id = charter.body.act_id();
    submit(&publisher.key, charter).await?;

    let role_tag = Proposal {
        body: StructuralBody {
            author: publisher.key.address(),
            seq: SEQ_PUBLISHER_ROLE_TAG,
            family: Family::Tag,
            middle: Some(NodeId::Prof(gm.key.address())),
            target: NodeId::name("moderator").map_err(|e| BootstrapError::Relay(e.to_string()))?,
            p_d: 0.0,
            p_i: 0.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![gm_reg_id, charter_id],
        },
        payload: serde_json::to_vec(&serde_json::json!({ "role": "moderator" }))
            .map_err(|e| BootstrapError::Relay(e.to_string()))?,
        deps: vec![],
    };
    submit(&publisher.key, role_tag).await?;

    if standin.close_epoch().await?.is_none() {
        return Err(BootstrapError::Relay(
            "no epoch was closed; the genesis acts were not orderable".into(),
        ));
    }
    ingest_or_refuse(&boundary, pool).await?;

    let landed = mirror::has_record_by(pool, &publisher.key.address(), Family::Publish).await?;
    if !landed {
        return Err(BootstrapError::Relay(
            "genesis records did not land in the mirror".into(),
        ));
    }
    Ok(outcome)
}

/// Refuses a repair run whose input disagrees with what the first run
/// already committed.
///
/// The repair branch reloads keys only: the `network_parameter_versions`
/// rows the first run wrote keep their original values, while the
/// Charter about to be sealed is built wholly from the *current* input.
/// Without this check a re-run with a changed guidelines hash — which is
/// recomputed from a file on every invocation — seals an immutable L1
/// record that permanently contradicts the L2 rows, on the path the
/// module doc advertises as safe to re-run.
///
/// `resume_act` catches the same divergence *only where the act was
/// already sealed*. The window this closes is the one where it was not:
/// a wiped substrate, or a crash before the Charter's seal.
async fn refuse_diverged_input(pool: &PgPool, input: &GenesisInput) -> Result<(), BootstrapError> {
    let stored: std::collections::HashMap<String, serde_json::Value> =
        genesis::seeded_parameters(pool)
            .await?
            .into_iter()
            .collect();
    if stored.is_empty() {
        return Ok(());
    }
    for (parameter, value) in genesis_parameters(input) {
        match stored.get(parameter) {
            Some(committed) if *committed == value => {}
            Some(committed) => {
                return Err(BootstrapError::Diverged(format!(
                    "the stored genesis value of `{parameter}` is {committed}, \
                     but this run supplies {value}"
                )));
            }
            None => {
                return Err(BootstrapError::Diverged(format!(
                    "this run declares `{parameter}`, which the seeded instance does not carry"
                )));
            }
        }
    }
    Ok(())
}

/// Resumes one genesis act past a seal Conflict. An identical act sealed
/// by an interrupted earlier run is skipped when its approval stands, or
/// completed by recovering the approval from the custodied key; anything
/// else on the substrate is divergence — a different act occupying the
/// author sequence, or the same identifier with different content (e.g. a
/// re-run with changed genesis input) — and is refused truthfully rather
/// than replayed into the same Conflict forever.
async fn resume_act(
    standin: &StandIn,
    actor: &ActorKey,
    proposal: &Proposal,
    host_key: &[u8],
) -> Result<(), BootstrapError> {
    let act_id = proposal.body.act_id();
    let stored = standin.sealed_act(&act_id).await?.ok_or_else(|| {
        BootstrapError::Diverged(format!(
            "the author sequence of {act_id} is occupied by a different act"
        ))
    })?;
    if stored.act.proposal != *proposal {
        return Err(BootstrapError::Diverged(format!(
            "the act stored at {act_id} does not match the genesis input"
        )));
    }
    if !stored.approved {
        let witness = actor.approve_recovered(&stored.act, host_key)?;
        standin.approve(witness).await?;
    }
    Ok(())
}

/// A genesis act targeting the mint of its own identifier — the genesis
/// shape (nodes.md §1).
///
/// Author, sequence and family are stated once and the target derived
/// from them, because a body that declares one triple and targets
/// another is a silently mis-targeted mint that nothing enforces.
fn own_mint(
    author: &str,
    seq: u64,
    family: Family,
    payload: Vec<u8>,
    asserted_parents: Vec<ActId>,
) -> Result<Proposal, BootstrapError> {
    Ok(Proposal {
        body: StructuralBody {
            author: author.to_string(),
            seq,
            family,
            middle: None,
            target: NodeId::Mint(
                ActId::new(author, seq, family)
                    .map_err(|e| BootstrapError::Relay(e.to_string()))?,
            ),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents,
        },
        payload,
        deps: vec![],
    })
}

fn registration(actor: &ActorKey) -> Proposal {
    Proposal {
        body: StructuralBody {
            author: actor.address(),
            seq: SEQ_REGISTRATION,
            family: Family::Registration,
            middle: None,
            target: NodeId::Prof(actor.address()),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        },
        payload: vec![],
        deps: vec![],
    }
}

fn opinion(actor: &ActorKey, seq: u64, target_addr: &str, parents: Vec<ActId>) -> Proposal {
    Proposal {
        body: StructuralBody {
            author: actor.address(),
            seq,
            family: Family::Opinion,
            middle: None,
            target: NodeId::Prof(target_addr.to_string()),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: parents,
        },
        payload: vec![],
        deps: vec![],
    }
}

/// Creates the whole L2 half in one transaction: cast keys and rows, the
/// reserved Types, and the parameter carrier.
async fn seed_l2(pool: &PgPool, input: &GenesisInput) -> Result<[CastMember; 4], BootstrapError> {
    let mut tx = pool.begin().await?;
    let cast = [
        seed_member(&mut tx, "user", &input.handle, &input.display_name).await?,
        seed_member(&mut tx, "system", PUBLISHER_HANDLE, "The Publisher").await?,
        seed_member(&mut tx, "system", MODERATOR_HANDLE, "The Moderator").await?,
        seed_member(&mut tx, "system", TREASURY_HANDLE, "The Treasury").await?,
    ];
    for name in RESERVED_TYPES {
        genesis::seed_reserved_type(&mut tx, name).await?;
    }
    for (parameter, value) in genesis_parameters(input) {
        genesis::seed_parameter(&mut tx, parameter, &value).await?;
    }
    tx.commit().await?;
    Ok(cast)
}

/// One cast member's actor row, profile version and custodied key.
async fn seed_member(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    kind: &str,
    handle: &str,
    display_name: &str,
) -> Result<CastMember, BootstrapError> {
    let key = ActorKey::generate();
    let actor_id = Uuid::new_v4();
    genesis::insert_actor(
        tx,
        actor_id,
        kind,
        handle,
        &key.public_key_bytes(),
        &key.address(),
    )
    .await?;
    genesis::insert_profile_version(tx, actor_id, display_name, None).await?;
    genesis::insert_system_key(tx, actor_id, &key.seed()).await?;
    Ok(CastMember { key })
}

/// Reloads the cast from the stored service rows and custodied keys.
///
/// Written out as four calls rather than a loop collecting into a `Vec`
/// so the fixed-size array is built directly: the `try_into` a loop needs
/// carries a failure case the construction cannot produce, and defending
/// it with a panic in library code is the shape this crate avoids.
async fn load_cast(pool: &PgPool, input: &GenesisInput) -> Result<[CastMember; 4], BootstrapError> {
    Ok([
        load_member(pool, &input.handle).await?,
        load_member(pool, PUBLISHER_HANDLE).await?,
        load_member(pool, MODERATOR_HANDLE).await?,
        load_member(pool, TREASURY_HANDLE).await?,
    ])
}

/// One cast member reloaded from its actor row and custodied seed.
///
/// The three ways this fails are three different situations for an
/// operator — a handle no actor row answers to (a re-run with a changed
/// `GENESIS_HANDLE` reaches here), a row with no custodied key, and a
/// key of the wrong length — so each says which it was.
async fn load_member(pool: &PgPool, handle: &str) -> Result<CastMember, BootstrapError> {
    Ok(CastMember {
        key: ActorKey::from_seed(custodied_seed(pool, handle).await?),
    })
}

/// The custodied seed behind a genesis handle.
async fn custodied_seed(pool: &PgPool, handle: &str) -> Result<[u8; 32], BootstrapError> {
    let row = genesis::actor_by_handle(pool, handle)
        .await?
        .ok_or_else(|| {
            BootstrapError::Unrepairable(format!("no actor row carries the handle `{handle}`"))
        })?;
    let seed = genesis::system_key(pool, row.id).await?.ok_or_else(|| {
        BootstrapError::Unrepairable(format!("`{handle}` has no custodied key row"))
    })?;
    let len = seed.len();
    seed.as_slice().try_into().map_err(|_| {
        BootstrapError::Unrepairable(format!(
            "`{handle}`'s custodied key is {len} bytes, not the 32 a seed is"
        ))
    })
}

#[cfg(test)]
mod tests {
    use super::{BootstrapError, digest_of, guidelines_hash};

    /// The pin is the digest of the document itself, and an unreadable
    /// document is an error rather than the empty-input digest — which
    /// would be a wrong pin, committed permanently, with nothing
    /// afterwards to verify it.
    ///
    /// The guidelines pin is the document's own digest, and an unreadable document refuses instead of pinning the empty digest.
    /// ´claim:bootstrap:the-guidelines-pin-is-read-or-refused´
    #[test]
    fn the_guidelines_pin_is_read_or_refused() {
        let hash = guidelines_hash().expect("the document ships with the crate");
        assert_eq!(hash.len(), 64, "a hex SHA-256");
        assert_ne!(
            hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            "never the empty-input digest"
        );
        assert!(matches!(
            digest_of(std::path::Path::new("no/such/guidelines.md")),
            Err(BootstrapError::Guidelines { .. })
        ));
    }
}

/// The Genesis Moderator's identity, for display after a fresh bootstrap.
pub async fn genesis_identity(
    pool: &PgPool,
    handle: &str,
) -> Result<Option<(Uuid, String)>, BootstrapError> {
    Ok(genesis::actor_by_handle(pool, handle)
        .await?
        .and_then(|row| row.l0_address.map(|address| (row.id, address))))
}

/// What the operator-login step created on this run.
#[derive(Debug, PartialEq, Eq)]
pub struct OperatorLogin {
    pub credentials_created: bool,
    /// The fresh recovery code's display form — printed exactly once,
    /// when the backup blob was newly sealed; None when one stood.
    pub recovery_code: Option<String>,
}

/// The Genesis Moderator is a person's account (network.md §2 — the
/// operator; they alone carry global moderation until a second moderator
/// is added), but it never passes the applicant flow — so the bootstrap
/// finishes it: login credentials, and the actor seed sealed into a
/// standard key-backup blob under a fresh recovery code. The operator
/// then reaches the key through the ordinary product path — sign in,
/// restore with the code (auth.md "Key recovery"). Idempotent: existing
/// credentials and an existing blob are left untouched.
pub async fn ensure_operator_login(
    pool: &PgPool,
    handle: &str,
    email: &str,
    password: &str,
) -> Result<OperatorLogin, BootstrapError> {
    let row = genesis::actor_by_handle(pool, handle)
        .await?
        .ok_or_else(|| {
            BootstrapError::Unrepairable(format!("no actor row carries the handle `{handle}`"))
        })?;
    let hash = crate::auth::hash_password(password)
        .map_err(|e| BootstrapError::OperatorLogin(e.to_string()))?;
    let credentials_created = genesis::insert_credentials(pool, row.id, email, &hash).await?;

    let recovery_code = if postgres_store::auth::latest_key_backup(pool, row.id)
        .await?
        .is_none()
    {
        let seed = custodied_seed(pool, handle).await?;
        let code = common::l1::key_backup::RecoveryCode::generate();
        let blob = common::l1::key_backup::seal(&seed, &code);
        postgres_store::auth::upload_key_backup(pool, row.id, &blob).await?;
        Some(code.display())
    } else {
        None
    };

    Ok(OperatorLogin {
        credentials_created,
        recovery_code,
    })
}
