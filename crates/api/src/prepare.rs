//! ´mod:module:prepare´
//!
//! Prepare — step 1 of the write path (substrate.md §6; architecture.md
//! "The write path"): validate the gesture, pre-check L1's write rule,
//! assemble the canonical proposal, and store it as a staged write for
//! the device to sign.
//!
//! This is L2 orchestration in front of the seam: nothing here touches
//! the substrate except the reads the pre-check estimates from.

use common::l1::census::Family;
use common::l1::handshake::{Proposal, StructuralBody};
use common::l1::identifier::{ActId, NodeId};
use postgres_store::staged;
use postgres_store::{PgPool, hashtag as hashtag_store, mirror};
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
    /// The same rule, priced over a whole batch before any of it is
    /// staged (D19).
    #[error(
        "write rule: balance {balance} cannot carry this batch — {acts} acts at the act price {theta}"
    )]
    BatchWriteRule {
        balance: f64,
        theta: f64,
        acts: usize,
    },
    #[error(transparent)]
    Boundary(#[from] BoundaryError),
    #[error(transparent)]
    Staged(#[from] staged::StagedError),
    #[error(transparent)]
    Mirror(#[from] mirror::MirrorError),
    #[error(transparent)]
    Storage(#[from] sqlx::Error),
}

/// A gesture's target: a named node, or the mint of the gesture's own
/// act — the genesis shape (nodes.md §1: an act of a mint-capable
/// family whose target equals the mint of its own identifier is the
/// genesis act). Own-mint targets resolve after prepare allocates the
/// sequence value, because the act identifier contains it.
#[derive(Debug, Clone)]
pub enum Target {
    Node(NodeId),
    OwnMint,
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
    pub target: Target,
    pub p_d: f64,
    pub p_i: f64,
    pub settlement_ref: Option<ActId>,
    pub license: Option<String>,
    pub asserted_parents: Vec<ActId>,
    pub deps: Vec<ActId>,
    /// Payload bytes — canonical empty is the zero-length string.
    pub payload: Vec<u8>,
    /// The L2 node this gesture mints or edits, when it carries one.
    /// Recorded on the staged row so the write owns its pending display
    /// rows: expiry discards them, confirm lands them.
    pub node: Option<Uuid>,
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

/// Prices a whole batch against the author's balance before a single act
/// of it is staged (D19, closing open-questions.md Q43).
///
/// Staging reserves nothing and every act commits its own transaction, so
/// without this a batch of `1 + tags + references` acts can stage part of
/// itself and refuse the rest — leaving the author with some of the
/// gesture they authored and no way to tell which half. The author reads a
/// creation batch as one gesture, so it is priced as one: either the
/// balance carries the whole thing or nothing is staged.
///
/// **Best-effort, never a reservation** — exactly like the per-act W1
/// check it generalizes. The balance is read once here from the last
/// published values, and nothing holds it: a balance can still move
/// between this check and the acts landing, and a batch that passes here
/// can still take a per-act refusal later. What this buys is that the
/// *common* failure — an author who plainly cannot afford 21 acts — is
/// refused whole and up front rather than discovered halfway through.
pub async fn check_batch_solvency<B: L1Boundary>(
    boundary: &B,
    author: &str,
    acts: usize,
) -> Result<(), PrepareError> {
    if acts == 0 {
        return Ok(());
    }
    let theta = boundary.current_theta().await?;
    let balance = boundary.balance(author).await?;
    if affordable(balance.balance, theta, acts) {
        Ok(())
    } else {
        Err(PrepareError::BatchWriteRule {
            balance: balance.balance,
            theta,
            acts,
        })
    }
}

/// The write rule itself (architecture.md "Write eligibility"): a
/// balance carries `acts` acts when it is at least their price.
///
/// One act is the same question with `acts = 1`, so the per-act
/// pre-check and the batch pre-check cannot disagree about the
/// boundary case — a balance exactly equal to the price writes.
fn affordable(balance: f64, theta: f64, acts: usize) -> bool {
    balance >= theta * acts as f64
}

/// Prepares one gesture: formation checks, the write-rule pre-check, seq
/// allocation, and the staged insert — the staged write comes back in
/// `awaiting_pre_sign` for the device to sign.
///
/// Everything checkable is checked here rather than left to the seal,
/// because a gesture the host refuses has already left a staged row
/// behind for the GC. Formation runs against the same census surface the
/// host enforces (`common::l1::census`), and the payload against the
/// published envelope bound (architecture.md "The write path" step 1).
/// The endpoint check is the one exception to that order: it runs after
/// the target resolves, since an own-mint target needs the allocated
/// sequence value first — a value the counter yields from zero upward, so
/// the clamp before the unsigned cast is a formality.
///
/// The two-gate write rule is an L2 estimate from the last published
/// values (substrate.md §6). W1 — solvency — is real under the stand-in's
/// number-honoring money; W2a and W2b pass trivially until the real
/// substrate brings real stamps, and this is their call site (roadmap.md
/// "The stand-in and the swap").
///
/// A gesture that points at a `name(s)` also writes the naming-service
/// row, in the same transaction that stages the act: a Type exists as
/// soon as an accepted record references its name (hashtag.md §2; D5).
/// That write is family-blind on purpose — a Tag's terminal leg, an
/// Affinity's follow, whichever record names it puts the name into
/// CoGra's index. Reads never write, which is what keeps a vacuously
/// anchored Type resolvable without a row at all.
pub async fn prepare<B: L1Boundary>(
    boundary: &B,
    pool: &PgPool,
    gc_after_epochs: i64,
    actor_id: Uuid,
    gesture: Gesture,
) -> Result<Prepared, PrepareError> {
    gesture
        .family
        .params_check(gesture.p_d, gesture.p_i)
        .map_err(PrepareError::Formation)?;
    let max_payload = boundary.max_payload_bytes().await?;
    if gesture.payload.len() > max_payload {
        return Err(PrepareError::Formation(format!(
            "payload exceeds M_payload ({} > {max_payload})",
            gesture.payload.len(),
        )));
    }

    let theta = boundary.current_theta().await?;
    let balance = boundary.balance(&gesture.author).await?;
    if !affordable(balance.balance, theta, 1) {
        return Err(PrepareError::WriteRule {
            balance: balance.balance,
            theta,
        });
    }

    let prepared_epoch = mirror::last_ingested_epoch(pool).await?;
    let mut tx = pool.begin().await?;
    let seq = staged::allocate_seq(&mut tx, &gesture.author).await?;
    let seq = seq.max(0) as u64;
    let target = match gesture.target {
        Target::Node(node) => node,
        Target::OwnMint => NodeId::Mint(ActId {
            author: gesture.author.clone(),
            seq,
            family: gesture.family,
        }),
    };
    gesture
        .family
        .endpoint_check(
            &gesture.author,
            &NodeId::Addr(gesture.author.clone()),
            gesture.middle.as_ref(),
            &target,
        )
        .map_err(PrepareError::Formation)?;
    if let NodeId::Name(name) = &target {
        hashtag_store::upsert(&mut tx, name).await?;
    }
    let proposal = Proposal {
        body: StructuralBody {
            author: gesture.author,
            seq,
            family: gesture.family,
            middle: gesture.middle,
            target,
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
    staged::insert(
        &mut tx,
        id,
        actor_id,
        &proposal,
        prepared_epoch,
        gesture.node,
    )
    .await?;
    tx.commit().await?;
    Ok(Prepared {
        id,
        proposal,
        gc_after_epochs,
    })
}

#[cfg(test)]
mod tests {
    use super::affordable;

    /// A batch is priced as the sum of its acts, and a balance exactly equal to that price writes.
    /// ´claim:prepare:a-batch-is-priced-as-the-sum-of-its-acts´
    #[test]
    fn a_batch_is_priced_as_the_sum_of_its_acts() {
        assert!(affordable(0.25, 0.05, 5), "five acts at 0.05 cost 0.25");
        assert!(affordable(0.05, 0.05, 1), "the boundary case writes");
        assert!(
            !affordable(0.2, 0.05, 5),
            "four acts' worth cannot carry five"
        );
    }

    /// One act priced as a batch is the same answer the per-act write rule gives.
    /// ´claim:prepare:one-act-prices-like-the-per-act-rule´
    #[test]
    fn one_act_prices_like_the_per_act_rule() {
        for (balance, theta) in [(1.0, 0.5), (0.5, 0.5), (0.49, 0.5), (0.0, 0.1)] {
            assert_eq!(
                affordable(balance, theta, 1),
                balance >= theta,
                "balance {balance} against theta {theta}"
            );
        }
    }
}
