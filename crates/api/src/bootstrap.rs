// Genesis bootstrap (architecture.md "Genesis bootstrap"; network.md §2):
// the one-shot instance creation. The CoGra-side half seeds the reserved
// Type keys, the parameter carrier (from the Charter's genesis payload),
// and the operator/system-actor service rows; the L1-side half lands the
// genesis records — the cast's Registrations, the endorsement Opinions,
// the Charter, and the genesis role Tag — as the instance's first
// accepted acts, through the ordinary admission handshake against the
// stand-in.
//
// Idempotent and gated on both sides: bootstrapped iff the Charter record
// is in the mirror AND the operator's service rows exist. The L2 half
// runs first because the signing keys live in it — a re-run after a crash
// completes the L1 half keyed on the recorded identities. Out-of-graph
// authority is confined to this bootstrap; there is no runtime genesis
// flow.
//
// Custody note: the Genesis Moderator's seed is stored beside the system
// actors' for slice 0 — the operator's own account on the operator's own
// server, needed for crash-repair re-runs. The device-held key ceremony
// arrives with slice 1's onboarding; real users never get this treatment.

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
    #[error(
        "the L1 genesis records exist but the operator's service rows do not; \
             the custodied keys are gone and the instance cannot be repaired"
    )]
    Unrepairable,
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
    #[error(transparent)]
    Mirror(#[from] mirror::MirrorError),
    #[error(transparent)]
    Ingest(#[from] crate::ingest::IngestError),
    #[error("L1 relay: {0}")]
    Relay(String),
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

/// Runs the bootstrap. Takes the stand-in directly: the L0 genesis burn
/// and the genesis epoch close are substrate-side operations the seam
/// deliberately does not carry (with the real Layer 1 both happen on the
/// substrate's side of the boundary).
pub async fn run(
    standin: &StandIn,
    pool: &PgPool,
    input: GenesisInput,
) -> Result<BootstrapOutcome, BootstrapError> {
    // Catch up the mirror first, so the gate reads current state.
    let boundary = StandInBoundary(standin.clone());
    crate::ingest::ingest_pending(&boundary, pool, crate::ingest::DEFAULT_GC_AFTER_EPOCHS).await?;

    let l2_half = genesis::system_actors_present(pool).await?;
    let l1_half = match genesis::actor_by_handle(pool, PUBLISHER_HANDLE).await? {
        Some(publisher) => {
            mirror::has_record_by(pool, &publisher.l0_address, Family::Publish).await?
        }
        // No service rows to key the check on: any ingested record at all
        // means an L1 history exists that these rows should describe.
        None => mirror::last_ingested_epoch(pool).await? >= 0,
    };

    match (l2_half, l1_half) {
        (true, true) => return Ok(BootstrapOutcome::AlreadyComplete),
        (false, true) => return Err(BootstrapError::Unrepairable),
        _ => {}
    }

    // --- The CoGra-side half (idempotent: skipped when it stands). ---
    let cast = if l2_half {
        load_cast(pool, &input).await?
    } else {
        seed_l2(pool, &input).await?
    };
    let outcome = if l2_half {
        BootstrapOutcome::Repaired
    } else {
        BootstrapOutcome::Fresh
    };

    // --- The L1-side half: money first, then the genesis sequence, so
    // every record's preconditions already stand (network.md §2). ---
    let [gm, publisher, moderator, treasury] = &cast;
    for member in &cast {
        standin
            .credit_burn(&member.key.address(), input.burn_per_account_micro)
            .await?;
    }

    let host_key = standin.host_public_key().await?;
    let submit = |actor: &ActorKey, proposal: Proposal| {
        let actor = ActorKey::from_seed(actor.seed());
        let host_key = host_key.clone();
        async move {
            let pre = actor.pre_sign(proposal);
            let sealed = standin.seal(pre.clone()).await?;
            let witness = actor.approve(&pre, &sealed, &host_key)?;
            standin.approve(witness).await?;
            Ok::<(), BootstrapError>(())
        }
    };

    // 1. The Genesis Moderator registers — the instance's first record.
    let gm_registration = registration(&gm.key);
    let gm_reg_id = gm_registration.body.act_id();
    submit(&gm.key, gm_registration).await?;

    // 2. The system actors register, each signed by its own custodied key.
    let pub_registration = registration(&publisher.key);
    let pub_reg_id = pub_registration.body.act_id();
    submit(&publisher.key, pub_registration).await?;
    let mod_registration = registration(&moderator.key);
    let mod_reg_id = mod_registration.body.act_id();
    submit(&moderator.key, mod_registration).await?;
    submit(&treasury.key, registration(&treasury.key)).await?;

    // 3. The Genesis Moderator endorses The Publisher and The Moderator —
    // external positive-rate vouches clearing their wall. The Treasury
    // needs none: it never writes again.
    submit(
        &gm.key,
        opinion(
            &gm.key,
            1,
            &publisher.key.address(),
            vec![pub_reg_id.clone()],
        ),
    )
    .await?;
    submit(
        &gm.key,
        opinion(&gm.key, 2, &moderator.key.address(), vec![mod_reg_id]),
    )
    .await?;

    // 4. The Publisher publishes The Charter: the witnessed payload
    // carries the pinned guidelines and the genesis value of every
    // governed parameter — the parameter fold's base case.
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
    let charter = Proposal {
        body: StructuralBody {
            author: publisher.key.address(),
            seq: 1,
            family: Family::Publish,
            middle: None,
            target: NodeId::Mint(
                ActId::new(&publisher.key.address(), 1, Family::Publish)
                    .map_err(|e| BootstrapError::Relay(e.to_string()))?,
            ),
            p_d: 1.0,
            p_i: 1.0,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![pub_reg_id],
        },
        payload: serde_json::to_vec(&charter_payload)
            .map_err(|e| BootstrapError::Relay(e.to_string()))?,
        deps: vec![],
    };
    let charter_id = charter.body.act_id();
    submit(&publisher.key, charter).await?;

    // 5. The genesis role Tag: Tag (0,0) + payload toward The Genesis
    // Moderator's Profile at the reserved `moderator` role Type — the
    // first record referencing that Type (anchored vacuously).
    let role_tag = Proposal {
        body: StructuralBody {
            author: publisher.key.address(),
            seq: 2,
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

    // Close the genesis epoch and land the records in the mirror.
    standin.close_epoch().await?;
    crate::ingest::ingest_pending(&boundary, pool, crate::ingest::DEFAULT_GC_AFTER_EPOCHS).await?;

    // The gate must now hold on both sides.
    let landed = mirror::has_record_by(pool, &publisher.key.address(), Family::Publish).await?;
    if !landed {
        return Err(BootstrapError::Relay(
            "genesis records did not land in the mirror".into(),
        ));
    }
    Ok(outcome)
}

fn registration(actor: &ActorKey) -> Proposal {
    Proposal {
        body: StructuralBody {
            author: actor.address(),
            seq: 0,
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
    let mut cast = Vec::with_capacity(4);
    let members: [(&str, &str, &str); 4] = [
        ("user", input.handle.as_str(), input.display_name.as_str()),
        ("system", PUBLISHER_HANDLE, "The Publisher"),
        ("system", MODERATOR_HANDLE, "The Moderator"),
        ("system", TREASURY_HANDLE, "The Treasury"),
    ];
    for (kind, handle, display_name) in members {
        let key = ActorKey::generate();
        let actor_id = Uuid::new_v4();
        genesis::insert_actor(
            &mut tx,
            actor_id,
            kind,
            handle,
            &key.public_key_bytes(),
            &key.address(),
        )
        .await?;
        genesis::insert_profile_version(&mut tx, actor_id, display_name, None).await?;
        genesis::insert_system_key(&mut tx, actor_id, &key.seed()).await?;
        cast.push(CastMember { key });
    }
    for name in RESERVED_TYPES {
        genesis::seed_reserved_type(&mut tx, name).await?;
    }
    for (parameter, value) in genesis_parameters(input) {
        genesis::seed_parameter(&mut tx, parameter, &value).await?;
    }
    tx.commit().await?;
    Ok(cast
        .try_into()
        .unwrap_or_else(|_| unreachable!("exactly four cast members are built above")))
}

/// Reloads the cast from the stored service rows and custodied keys.
async fn load_cast(pool: &PgPool, input: &GenesisInput) -> Result<[CastMember; 4], BootstrapError> {
    let mut cast = Vec::with_capacity(4);
    for handle in [
        input.handle.as_str(),
        PUBLISHER_HANDLE,
        MODERATOR_HANDLE,
        TREASURY_HANDLE,
    ] {
        let row = genesis::actor_by_handle(pool, handle)
            .await?
            .ok_or(BootstrapError::Unrepairable)?;
        let seed = genesis::system_key(pool, row.id)
            .await?
            .ok_or(BootstrapError::Unrepairable)?;
        let seed: [u8; 32] = seed
            .as_slice()
            .try_into()
            .map_err(|_| BootstrapError::Unrepairable)?;
        cast.push(CastMember {
            key: ActorKey::from_seed(seed),
        });
    }
    Ok(cast
        .try_into()
        .unwrap_or_else(|_| unreachable!("exactly four cast members are loaded above")))
}

/// The Genesis Moderator's identity, for display after a fresh bootstrap.
pub async fn genesis_identity(
    pool: &PgPool,
    handle: &str,
) -> Result<Option<(Uuid, String)>, BootstrapError> {
    Ok(genesis::actor_by_handle(pool, handle)
        .await?
        .map(|row| (row.id, row.l0_address)))
}
