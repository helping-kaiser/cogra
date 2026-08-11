// Prepare — step 1 of the write path (substrate.md §6; architecture.md
// "The write path"): validate the gesture, pre-check L1's write rule,
// assemble the canonical proposal, and store it as a staged write for the
// device to sign. L2 orchestration in front of the seam — nothing here
// touches the substrate except the reads the pre-check estimates from.

use common::l1::census::Family;
use common::l1::handshake::{Proposal, StructuralBody};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::staged;
use postgres_store::{PgPool, mirror};
use uuid::Uuid;

use crate::l1::{BoundaryError, L1Boundary};

#[derive(Debug, thiserror::Error)]
pub enum PrepareError {
    /// The gesture is not a well-formed act of its family — the same
    /// formation surface the host would refuse, checked before anything
    /// is staged.
    #[error("formation: {0}")]
    Formation(String),
    /// The write-rule pre-check failed — a normal, visible account state,
    /// never an auth fault (architecture.md "Write eligibility").
    #[error("write rule: balance {balance} is below the act price {theta}")]
    WriteRule { balance: f64, theta: f64 },
    #[error(transparent)]
    Boundary(#[from] BoundaryError),
    #[error(transparent)]
    Staged(#[from] staged::StagedError),
    #[error(transparent)]
    Mirror(#[from] mirror::MirrorError),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

/// One gesture to prepare: the author-asserted fields of the canonical
/// proposal, minus the sequence value prepare allocates.
#[derive(Debug, Clone)]
pub struct Gesture {
    /// The author's L0 address atom.
    pub author: String,
    pub family: Family,
    /// Middle node for hyper-edge families; None for binary.
    pub middle: Option<NodeId>,
    pub target: NodeId,
    pub p_d: f64,
    pub p_i: f64,
    pub settlement_ref: Option<ActId>,
    pub license: Option<String>,
    pub asserted_parents: Vec<ActId>,
    pub deps: Vec<ActId>,
    /// Payload bytes — canonical empty is the zero-length string.
    pub payload: Vec<u8>,
}

/// A prepared staged write: the handle for the whole handshake plus the
/// exact proposal the device recomputes and pre-signs.
#[derive(Debug, Clone)]
pub struct Prepared {
    pub id: Uuid,
    pub proposal: Proposal,
    /// The GC bound the staged write lives under (api-spec.md
    /// `PreparedWrite.gcAfterEpochs`).
    pub gc_after_epochs: i64,
}

/// Prepares one gesture: formation checks, the write-rule pre-check, seq
/// allocation, and the staged insert — the staged write comes back in
/// `awaiting_pre_sign` for the device to sign.
pub async fn prepare<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    gc_after_epochs: i64,
    actor_id: Uuid,
    gesture: Gesture,
) -> Result<Prepared, PrepareError> {
    // Formation, pre-checked on the same census surface the host enforces
    // (common::l1::census) so a malformed gesture fails before staging.
    gesture
        .family
        .endpoint_check(
            &gesture.author,
            &NodeId::Addr(gesture.author.clone()),
            gesture.middle.as_ref(),
            &gesture.target,
        )
        .map_err(PrepareError::Formation)?;
    gesture
        .family
        .params_check(gesture.p_d, gesture.p_i)
        .map_err(PrepareError::Formation)?;
    // Envelope conformance (architecture.md "The write path" step 1): an
    // oversized payload would only fail at seal, leaving a staged row for
    // the GC — the whole point of prepare-side checks is failing first.
    let max_payload = boundary.max_payload_bytes().await?;
    if gesture.payload.len() > max_payload {
        return Err(PrepareError::Formation(format!(
            "payload exceeds M_payload ({} > {max_payload})",
            gesture.payload.len(),
        )));
    }

    // The two-gate write rule, as an L2 estimate from the last published
    // values (substrate.md §6). W1 — solvency — is real under the
    // stand-in's number-honoring money. W2a/W2b pass trivially until the
    // real substrate brings real stamps (roadmap.md "The stand-in and the
    // swap"); this is their call-site.
    let theta = boundary.current_theta().await?;
    let balance = boundary.balance(&gesture.author).await?;
    if balance.balance < theta {
        return Err(PrepareError::WriteRule {
            balance: balance.balance,
            theta,
        });
    }

    let prepared_epoch = mirror::last_ingested_epoch(pool).await?;
    let mut tx = pool.begin().await?;
    let seq = staged::allocate_seq(&mut tx, &gesture.author).await?;
    let proposal = Proposal {
        body: StructuralBody {
            author: gesture.author,
            // Non-negative by construction: the counter starts at zero.
            seq: seq.max(0) as u64,
            family: gesture.family,
            middle: gesture.middle,
            target: gesture.target,
            p_d: gesture.p_d,
            p_i: gesture.p_i,
            settlement_ref: gesture.settlement_ref,
            license: gesture.license,
            asserted_parents: gesture.asserted_parents,
        },
        payload: gesture.payload,
        deps: gesture.deps,
    };
    let id = Uuid::new_v4();
    staged::insert(&mut tx, id, actor_id, &proposal, prepared_epoch).await?;
    tx.commit().await?;
    Ok(Prepared {
        id,
        proposal,
        gc_after_epochs,
    })
}
