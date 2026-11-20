//! ´mod:module:handshake´
//!
//! The admission-handshake objects and the epoch package
//! (layer1-interface.md §8.2, §8.4, §11.6).
//!
//! These are the seam's data transfer shapes: what crosses the boundary
//! between CoGra and the substrate, in both directions. Bare section
//! references below are that document's.

use std::fmt;

use super::census::{Family, LegRole};
use super::crypto::{self, tags};
use super::encoding::Encoder;
use super::identifier::{ActId, NodeId};

/// The canonical structural body of a proposal — everything the actor
/// authors (§8.4): identity fields, incidence, the family parameter tuple,
/// public protocol references, and asserted causal parents. Payload bytes
/// and the dependency list are the two removable projections and ride
/// beside the body, never inside it.
#[derive(Debug, Clone, PartialEq)]
pub struct StructuralBody {
    /// The author's address atom.
    pub author: String,
    /// The author-local sequence value s_q.
    pub seq: u64,
    pub family: Family,
    /// Middle node for hyper-edge families; None for binary.
    pub middle: Option<NodeId>,
    /// Semantic target: the binary target, or the hyper T-leg terminal.
    pub target: NodeId,
    /// The act's family parameter tuple; leg renderings are census-derived.
    pub p_d: f64,
    pub p_i: f64,
    /// Public protocol references (§8.2).
    pub settlement_ref: Option<ActId>,
    pub license: Option<String>,
    /// Asserted causal parents (§8.2).
    pub asserted_parents: Vec<ActId>,
}

impl StructuralBody {
    pub fn act_id(&self) -> ActId {
        ActId {
            author: self.author.clone(),
            seq: self.seq,
            family: self.family,
        }
    }

    /// The act's initiating source — always the author's Actor node.
    pub fn source(&self) -> NodeId {
        NodeId::Addr(self.author.clone())
    }

    /// Canonical bytes: the signing base of the pre-commitment and, with
    /// the host additions, of the seal and approval. The encoding closes on
    /// a schema version, so the body shape can evolve forward.
    pub fn canonical_bytes(&self) -> Vec<u8> {
        let mut e = Encoder::new();
        e.array(9);
        e.text(&self.act_id().to_string());
        match &self.middle {
            Some(m) => e.text(&m.to_string()),
            None => e.null(),
        };
        e.text(&self.target.to_string());
        e.float(self.p_d);
        e.float(self.p_i);
        match &self.settlement_ref {
            Some(r) => e.text(&r.to_string()),
            None => e.null(),
        };
        match &self.license {
            Some(l) => e.text(l),
            None => e.null(),
        };
        e.array(self.asserted_parents.len() as u64);
        for p in &self.asserted_parents {
            e.text(&p.to_string());
        }
        e.uint(1);
        e.finish()
    }
}

/// Canonical encoding of the dependency list — the dependency projection's
/// bytes (§8.2).
pub fn canonical_deps(deps: &[ActId]) -> Vec<u8> {
    let mut e = Encoder::new();
    e.array(deps.len() as u64);
    for d in deps {
        e.text(&d.to_string());
    }
    e.finish()
}

/// The order of a canonical dependency list. The Layer 1 specification
/// (its definition "Act Dependency Projection") has the list strictly
/// increasing by act identifier, duplicate-free and self-free, and Layer 1
/// orders identifiers componentwise: the author's address atom by bytes,
/// then the author-local sequence as a number, then the family name by
/// bytes. Sequence 9 therefore precedes sequence 10, which the
/// identifiers' text forms would not.
pub fn dependency_order(a: &ActId, b: &ActId) -> std::cmp::Ordering {
    a.author
        .as_bytes()
        .cmp(b.author.as_bytes())
        .then(a.seq.cmp(&b.seq))
        .then_with(|| a.family.as_str().cmp(b.family.as_str()))
}

/// A dependency list in canonical order with every duplicate collapsed —
/// the one way CoGra forms the list a device pre-signs.
pub fn canonical_dep_list(deps: impl IntoIterator<Item = ActId>) -> Vec<ActId> {
    let mut deps: Vec<ActId> = deps.into_iter().collect();
    deps.sort_by(dependency_order);
    deps.dedup();
    deps
}

/// Whether a dependency list is strictly ascending under
/// [`dependency_order`]: sorted and duplicate-free at once. The empty list
/// is canonical.
pub fn is_canonical_dep_list(deps: &[ActId]) -> bool {
    deps.windows(2)
        .all(|pair| dependency_order(&pair[0], &pair[1]).is_lt())
}

/// A proposal before signing: body plus the two removable projections.
#[derive(Clone, PartialEq)]
pub struct Proposal {
    pub body: StructuralBody,
    /// Payload bytes — canonical empty is the zero-length string (§8.4).
    pub payload: Vec<u8>,
    /// Declared dependencies (each naming a whole act).
    pub deps: Vec<ActId>,
}

/// The payload is what the content nonce conceals, so `Debug` shows its
/// length and never its bytes.
impl fmt::Debug for Proposal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Proposal")
            .field("body", &self.body)
            .field("payload", &format_args!("<{} bytes>", self.payload.len()))
            .field("deps", &self.deps)
            .finish()
    }
}

/// The message the pre-commitment hashes: the canonical body and both
/// pre-digests.
pub fn pre_commitment_msg(
    body: &StructuralBody,
    digest_content: &[u8; 32],
    digest_deps: &[u8; 32],
) -> Vec<u8> {
    let mut e = Encoder::new();
    e.array(3);
    e.bytes(&body.canonical_bytes());
    e.bytes(digest_content);
    e.bytes(digest_deps);
    e.finish()
}

/// The parts of a verified act its encoding is formed from
/// (§8.2, "Verified act": body, pre-commitment, pre-signature, both
/// commitments, both edition tags), borrowed from wherever they are held.
pub struct SealFrame<'a> {
    pub body: &'a StructuralBody,
    pub pre_commitment: &'a [u8],
    pub pre_signature: &'a [u8],
    pub content_commitment: &'a [u8],
    pub deps_commitment: &'a [u8],
    pub content_edition: u64,
    pub deps_edition: u64,
}

/// The encoded verified act from its parts — the one encoding the seal and
/// the approval cover, callable where only stored columns exist rather than
/// an assembled act. Like the body, the frame closes on a schema version so
/// its shape can evolve forward.
pub fn seal_message(frame: &SealFrame<'_>) -> Vec<u8> {
    let mut e = Encoder::new();
    e.array(8);
    e.bytes(&frame.body.canonical_bytes());
    e.bytes(frame.pre_commitment);
    e.bytes(frame.pre_signature);
    e.bytes(frame.content_commitment);
    e.bytes(frame.deps_commitment);
    e.uint(frame.content_edition);
    e.uint(frame.deps_edition);
    e.uint(1);
    e.finish()
}

/// The approval witness's digest: the tagged hash of the encoded verified
/// act followed by its host seal (§8.2, "Approval witness"), so the
/// author signs the seal itself along with what it seals.
pub fn approval_digest(seal_msg: &[u8], host_seal: &[u8]) -> [u8; 32] {
    crypto::sha256_tagged(tags::APPROVAL, &[seal_msg, host_seal])
}

/// The client's approval: the act identifier plus the approval-witness
/// signature over the exact verified act.
#[derive(Debug, Clone, PartialEq)]
pub struct ApprovalWitness {
    pub act_id: ActId,
    pub approval_signature: Vec<u8>,
}

/// One published record of an epoch package — the self-sufficient edge
/// record of §13, in the §8.4 field set the mirror stores (data-model.md
/// "The record mirror"): the act envelope of §8.4, "Act envelope", with
/// the edge projections the host derived from it.
#[derive(Debug, Clone, PartialEq)]
pub struct PublishedRecord {
    pub act_id: ActId,
    pub author: String,
    pub family: Family,
    /// Landing epoch, numbered from [`FIRST_EPOCH`].
    pub epoch: i64,
    /// Act time 𝕋^act (§8.3): a recomputable summary of the order of
    /// record; it decides no precedence.
    pub act_time: i64,
    /// The act's place in its epoch, numbered from [`FIRST_POSITION`].
    pub position: i64,
    /// The content commitment — the payload witness.
    pub payload_witness: Vec<u8>,
    pub legs: Vec<PublishedLeg>,
    pub authentication: ActAuthentication,
}

/// What an accepted act's record carries so that its authorship and its
/// formation verify from the record alone, with no hidden opening (§8.2,
/// "Proposal pre-commitment", "Verified act" and "Approval witness"; §8.4,
/// "Act envelope"): the approved body, the signed pre-commitment, the
/// dependency commitment beside the record's content commitment, the
/// formation edition each commitment names, the host seal, and the
/// author's approval witness. The openings — the content pair, both
/// salts, the dependency list and its nonce — are never part of it.
#[derive(Debug, Clone, PartialEq)]
pub struct ActAuthentication {
    /// The approved structural body the pre-commitment, the seal and the
    /// approval all cover.
    pub body: StructuralBody,
    /// The key the author's address derives from, which every author
    /// signature verifies under.
    pub author_pubkey: Vec<u8>,
    /// P, the proposal pre-commitment.
    pub pre_commitment: Vec<u8>,
    /// The author's signature over P.
    pub pre_signature: Vec<u8>,
    /// The dependency commitment C_d.
    pub dependency_commitment: Vec<u8>,
    /// The formation edition the content commitment names.
    pub content_edition: u64,
    /// The formation edition the dependency commitment names.
    pub dependency_edition: u64,
    /// The host verification seal over the encoded verified act.
    pub host_seal: Vec<u8>,
    /// The author's approval witness over the verified act and its seal.
    pub approval_signature: Vec<u8>,
}

impl ActAuthentication {
    /// An authentication no host publishes: the body of `act_id` toward
    /// its author's own Actor node, with every signature and commitment
    /// empty. For fixtures of consumers that read records without
    /// verifying them, as [`EpochClosure::default`] is for consumers that
    /// read no closure.
    pub fn unverified(act_id: &ActId) -> Self {
        ActAuthentication {
            body: StructuralBody {
                author: act_id.author.clone(),
                seq: act_id.seq,
                family: act_id.family,
                middle: None,
                target: NodeId::Addr(act_id.author.clone()),
                p_d: 0.0,
                p_i: 0.0,
                settlement_ref: None,
                license: None,
                asserted_parents: Vec::new(),
            },
            author_pubkey: Vec::new(),
            pre_commitment: Vec::new(),
            pre_signature: Vec::new(),
            dependency_commitment: Vec::new(),
            content_edition: 0,
            dependency_edition: 0,
            host_seal: Vec::new(),
            approval_signature: Vec::new(),
        }
    }
}

impl PublishedRecord {
    /// The verified act this record publishes, as the parts its encoding
    /// is formed from: the seal and the approval witness verify over
    /// [`seal_message`] of this frame.
    pub fn seal_frame(&self) -> SealFrame<'_> {
        let auth = &self.authentication;
        SealFrame {
            body: &auth.body,
            pre_commitment: &auth.pre_commitment,
            pre_signature: &auth.pre_signature,
            content_commitment: &self.payload_witness,
            deps_commitment: &auth.dependency_commitment,
            content_edition: auth.content_edition,
            deps_edition: auth.dependency_edition,
        }
    }
}

/// One edge projection of a published record.
#[derive(Debug, Clone, PartialEq)]
pub struct PublishedLeg {
    pub role: LegRole,
    pub source: NodeId,
    pub target: NodeId,
    /// The leg's rendering of the act parameter tuple.
    pub p_d: f64,
    pub p_i: f64,
    /// Host-cached edge-projection maturity (§8.3).
    pub tau: f64,
}

/// One closed epoch as published through the seam: the ordered accepted
/// act sequence 𝒬_k as records (§11.6 — the record projection of the
/// final act sequence), with the boundary's asserted timestamp and the
/// closure outputs the host computed for it.
#[derive(Debug, Clone, PartialEq)]
pub struct EpochPackage {
    /// The epoch, numbered from [`FIRST_EPOCH`].
    pub epoch: i64,
    /// The host's asserted boundary timestamp (the Host Contract's
    /// accepted-records package), checkable only for consistency with the
    /// published duration bounds: when the epoch closed, so when its
    /// records landed.
    pub asserted_at: chrono::DateTime<chrono::Utc>,
    /// 𝒬_k in its published order; its length is the realized size.
    pub records: Vec<PublishedRecord>,
    pub closure: EpochClosure,
}

/// An exact rational, in lowest terms with a positive denominator — how a
/// package carries the reduced-axis values of the wall controller (§11.8),
/// none of which a double holds exactly: the declarable floor 3/37 has no
/// finite binary expansion, and X8 compares against the declared floor's
/// exact defining object.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Ratio {
    numerator: i64,
    denominator: i64,
}

impl Ratio {
    pub const ZERO: Ratio = Ratio::integer(0);
    pub const ONE: Ratio = Ratio::integer(1);

    /// The ratio `numerator / denominator` in lowest terms; `None` for a
    /// zero denominator or a value whose lowest terms leave `i64`.
    pub const fn new(numerator: i64, denominator: i64) -> Option<Ratio> {
        Ratio::from_wide(numerator as i128, denominator as i128)
    }

    pub const fn integer(value: i64) -> Ratio {
        Ratio {
            numerator: value,
            denominator: 1,
        }
    }

    pub const fn numerator(&self) -> i64 {
        self.numerator
    }

    pub const fn denominator(&self) -> i64 {
        self.denominator
    }

    /// Reduction from a wide intermediate, so a sum or product is formed
    /// exactly and only its lowest terms have to fit.
    pub const fn from_wide(numerator: i128, denominator: i128) -> Option<Ratio> {
        if denominator == 0 {
            return None;
        }
        let (mut n, mut d) = if denominator < 0 {
            match (numerator.checked_neg(), denominator.checked_neg()) {
                (Some(n), Some(d)) => (n, d),
                _ => return None,
            }
        } else {
            (numerator, denominator)
        };
        let (mut a, mut b) = (n.unsigned_abs(), d.unsigned_abs());
        while b != 0 {
            let r = a % b;
            a = b;
            b = r;
        }
        if a > 1 {
            n /= a as i128;
            d /= a as i128;
        }
        if n > i64::MAX as i128 || n < i64::MIN as i128 || d > i64::MAX as i128 {
            return None;
        }
        Some(Ratio {
            numerator: n as i64,
            denominator: d as i64,
        })
    }

    /// Exact sum. Every intermediate is a product of two `i64` factors (or
    /// the sum of two), which `i128` holds; only the reduced result has to
    /// fit back.
    pub fn checked_add(self, other: Ratio) -> Option<Ratio> {
        let (a, b) = (self.wide(), other.wide());
        Ratio::from_wide(a.0 * b.1 + b.0 * a.1, a.1 * b.1)
    }

    pub fn checked_sub(self, other: Ratio) -> Option<Ratio> {
        self.checked_add(Ratio::from_wide(
            -(other.numerator as i128),
            other.denominator as i128,
        )?)
    }

    pub fn checked_mul(self, other: Ratio) -> Option<Ratio> {
        let (a, b) = (self.wide(), other.wide());
        Ratio::from_wide(a.0 * b.0, a.1 * b.1)
    }

    pub fn checked_abs(self) -> Option<Ratio> {
        Ratio::from_wide((self.numerator as i128).abs(), self.denominator as i128)
    }

    pub fn signum(self) -> i64 {
        self.numerator.signum()
    }

    fn wide(self) -> (i128, i128) {
        (self.numerator as i128, self.denominator as i128)
    }
}

impl Ord for Ratio {
    /// By value: both denominators are positive, so cross-multiplying in
    /// `i128` compares exactly and cannot overflow two `i64` factors.
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        let (a, b) = (self.wide(), other.wide());
        (a.0 * b.1).cmp(&(b.0 * a.1))
    }
}

impl PartialOrd for Ratio {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl std::fmt::Display for Ratio {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}/{}", self.numerator, self.denominator)
    }
}

/// Why the epoch closed (§11.6, "Final-set closure"):
/// its write set filled the target act budget, or the epoch's duration ran
/// out first.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ClosureCause {
    /// |𝒬_k| reached N_epoch — the binding regime.
    TargetFilled,
    /// The duration elapsed with the write set below the target — the
    /// slack regime.
    #[default]
    DurationElapsed,
}

impl ClosureCause {
    pub fn as_str(self) -> &'static str {
        match self {
            ClosureCause::TargetFilled => "target",
            ClosureCause::DurationElapsed => "duration",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "target" => Some(ClosureCause::TargetFilled),
            "duration" => Some(ClosureCause::DurationElapsed),
            _ => None,
        }
    }
}

/// The marker policy an epoch package binds, by identity and fixed
/// edition (§11.6, the published epoch package).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MarkerPolicy {
    pub identity: String,
    pub edition: i32,
}

/// One verification-case declaration an epoch package binds, by identity
/// and edition (§11.6, the published epoch package). Every declaration in
/// force for the epoch is bound, and the empty set is bound when none is,
/// so the package itself shows which declared cases apply to the epoch.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct CaseDeclaration {
    pub identity: String,
    pub edition: i32,
}

/// One author's line of the epoch's final ledger (§5 host contract (ii)):
/// the accepted-act increment ΔN_i, the action count N_i and the residual
/// balance b_i after this epoch's debits.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LedgerLine {
    pub address: String,
    pub accepted_acts: i64,
    pub action_count: i64,
    /// `None` for an epoch closed before the host recorded residual
    /// balances: the balance at that boundary was never kept, and a later
    /// reading cannot recover it.
    pub residual_balance_micro: Option<i64>,
}

/// One step of the wall controller (§11.8, "Wall controller"):
/// its inputs, its proposal and the led wall it delivers, with that wall's
/// burn image — the price the next epoch charges.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WallStep {
    /// ρ_θ^(k), the wall in force — the reduced image of the charged price.
    pub wall_in_force: Ratio,
    /// W_loc^(k), the completed epoch's contributing width.
    pub width: Ratio,
    /// t_k, the accepted rung.
    pub accepted_rung: Ratio,
    /// q(W), the target proposal, floored.
    pub proposal: Ratio,
    /// ρ_θ^(k+1) = C_Γ(ρ_θ^(k), W, t_k), after deadband and step cap.
    pub delivered: Ratio,
    /// θ^(k+1) = ν·ρ_θ^(k+1) in micro-units, charged by epoch k + 1.
    pub theta_next_micro: i64,
}

/// The published boundary triple an epoch closed under (§5 host contract
/// (vi); §11.6, "Final-set closure"): an epoch closes at the earliest
/// moment its write set fills the target with the minimum duration
/// elapsed, or the maximum duration has elapsed.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct BoundaryPolicy {
    /// N_epoch, the target size in acts.
    pub target_acts: i64,
    /// The minimum duration, in seconds.
    pub min_duration_secs: i64,
    /// The maximum duration, in seconds — the host's epoch clock. `None`
    /// where the host published no maximum: no clock was running, so the
    /// epoch closed when the host was asked to close it, or the epoch
    /// closed before the host published its triple.
    pub max_duration_secs: Option<i64>,
}

/// The closure outputs of one epoch beyond its records (§5 host contract
/// (i), (ii) and (vi)): the dependent-set partition and closure cause, the
/// boundary triple it closed under, the final ledger with the debit
/// vintage, the wall controller's step, the marker policy, and the
/// verification-case declarations in force. The
/// deployment's fixed declarations — numéraire, floor, controller edition
/// and constants — are published once per deployment, not here.
///
/// `Default` is the empty value, for fixtures of consumers that read the
/// records alone; no host publishes it.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EpochClosure {
    pub cause: ClosureCause,
    pub boundary: BoundaryPolicy,
    /// The dependent-set partition of 𝒬_k (§8.2, "Dependent act set"),
    /// each block as the positions of its acts in ascending order, blocks
    /// ordered by their first position.
    pub dependent_sets: Vec<Vec<i64>>,
    /// One line per author with an act in 𝒬_k, ordered by address.
    pub ledger: Vec<LedgerLine>,
    /// θ^(k) in micro-units — the debit vintage every act of this epoch
    /// was charged, never re-calculated (§11.7).
    pub theta_charged_micro: i64,
    /// `None` for an epoch closed before the host ran the controller.
    pub wall: Option<WallStep>,
    pub marker: MarkerPolicy,
    /// Every verification-case declaration in force for the epoch, ordered
    /// by identity — empty when none is.
    pub case_declarations: Vec<CaseDeclaration>,
}

/// Boundary 0: the empty state before epoch 1 (§7.2, "Title Certificate").
/// No epoch carries this number; a reader that has seen no epoch stands
/// here, so it is what "the last epoch" reads before the first close.
pub const EMPTY_BOUNDARY: i64 = 0;

/// The first epoch: epochs number certificates from 1 (§11.6, the epoch
/// history).
pub const FIRST_EPOCH: i64 = 1;

/// The first position: the acts of one epoch are numbered from 1 to
/// |𝒬_k| (§8.3, "Authoritative act order").
pub const FIRST_POSITION: i64 = 1;

/// Why an epoch package has no order of record (§7.2, "Title
/// Certificate"): such a certificate is malformed and refused before any
/// replay. A missing position needs no variant of its own — n records at
/// positions inside 1..=n with none repeated cover every position, so a
/// gap always shows up as a repeat or an out-of-range position.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum MalformedOrder {
    #[error("epoch {0} is not numbered from {FIRST_EPOCH}")]
    EpochOutOfRange(i64),
    #[error("record {act} names epoch {named} inside epoch {epoch}")]
    MisplacedRecord { act: String, named: i64, epoch: i64 },
    #[error("record {act} sits at position {position}, outside {FIRST_POSITION}..={len}")]
    PositionOutOfRange {
        act: String,
        position: i64,
        len: i64,
    },
    #[error("position {position} of epoch {epoch} is repeated")]
    RepeatedPosition { epoch: i64, position: i64 },
}

impl EpochPackage {
    /// Whether the package has an order of record (§7.2, §8.3): an epoch
    /// numbered from 1, every record placed in it, and positions that are
    /// exactly 1..=|𝒬_k|. The host checks this before it publishes and the
    /// mirror before it ingests, so neither side can make the other hold
    /// an epoch 0, a position 0, a gap or a repeat.
    pub fn check_order_of_record(&self) -> Result<(), MalformedOrder> {
        if self.epoch < FIRST_EPOCH {
            return Err(MalformedOrder::EpochOutOfRange(self.epoch));
        }
        let len = i64::try_from(self.records.len()).unwrap_or(i64::MAX);
        let mut seen = std::collections::HashSet::with_capacity(self.records.len());
        for record in &self.records {
            if record.epoch != self.epoch {
                return Err(MalformedOrder::MisplacedRecord {
                    act: record.act_id.to_string(),
                    named: record.epoch,
                    epoch: self.epoch,
                });
            }
            if !(FIRST_POSITION..=len).contains(&record.position) {
                return Err(MalformedOrder::PositionOutOfRange {
                    act: record.act_id.to_string(),
                    position: record.position,
                    len,
                });
            }
            if !seen.insert(record.position) {
                return Err(MalformedOrder::RepeatedPosition {
                    epoch: self.epoch,
                    position: record.position,
                });
            }
        }
        Ok(())
    }
}

/// An amount of the substrate's money in micro-units (10⁻⁶ of a unit) —
/// the exact integers the ledger holds. Comparisons of these amounts are
/// decided on the integers, never on a floating-point image of them
/// (layer1-interface.md §13.2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Micro(pub i64);

impl Micro {
    pub const ZERO: Micro = Micro(0);
    /// The largest amount the ledger's integers can hold.
    pub const MAX: Micro = Micro(i64::MAX);

    /// The price of `count` acts at this per-act price, or `None` when it
    /// is not representable — a price beyond every balance the ledger can
    /// hold.
    pub fn times(self, count: usize) -> Option<Micro> {
        i64::try_from(count)
            .ok()
            .and_then(|n| self.0.checked_mul(n))
            .map(Micro)
    }
}

/// Whole units with the fraction trimmed of trailing zeros — `50186`
/// micro-units shows as `0.050186`, `10_000_000` as `10`.
impl std::fmt::Display for Micro {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        const PER_UNIT: u64 = 1_000_000;
        let sign = if self.0 < 0 { "-" } else { "" };
        let magnitude = self.0.unsigned_abs();
        let (whole, fraction) = (magnitude / PER_UNIT, magnitude % PER_UNIT);
        if fraction == 0 {
            write!(f, "{sign}{whole}")
        } else {
            let digits = format!("{fraction:06}");
            write!(f, "{sign}{whole}.{}", digits.trim_end_matches('0'))
        }
    }
}

/// The B_i surface as the stand-in honors it: numbers
/// (roadmap.md "The stand-in and the swap"), in the ledger's exact
/// micro-units.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AccountBalance {
    pub address: String,
    /// Committed burn total B_i (monotone).
    pub burned_total: Micro,
    /// Residual balance b_i after θ-debits.
    pub balance: Micro,
    /// Accepted-act count N_i.
    pub action_count: i64,
}

/// The realization's handle on one admission burn request — what a
/// settlement read is asked about. Opaque to CoGra: stored as the
/// realization returned it and handed back unchanged.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BurnTicket(pub String);

/// Where one admission burn stands on the realization (layer1-interface.md
/// R4(e)): requested and not yet pinned, pinned at or below the published
/// settlement depth — so the B_i read now carries it — or refused for
/// good.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BurnSettlement {
    Pending,
    Settled { pinned_micro: i64 },
    Failed(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    fn body() -> StructuralBody {
        StructuralBody {
            author: "alice".into(),
            seq: 3,
            family: Family::Opinion,
            middle: None,
            target: NodeId::parse("prof:bob").expect("ok"),
            p_d: 1.0,
            p_i: 0.5,
            settlement_ref: None,
            license: None,
            asserted_parents: vec![],
        }
    }

    /// An amount shows as the decimal units it holds — the same text the
    /// double-precision image of the amount prints, so a message quoting
    /// one reads as before, now read off the exact integer.
    ///
    /// A micro-unit amount shows as its exact decimal units, trailing zeros trimmed.
    /// ´claim:handshake:an-amount-shows-as-its-exact-units´
    #[test]
    fn an_amount_shows_as_its_exact_units() {
        for micro in [
            0,
            1,
            50_186,
            150_000,
            752_789,
            1_000_000,
            10_000_000,
            100_000_001,
            -50_186,
        ] {
            assert_eq!(
                Micro(micro).to_string(),
                (micro as f64 / 1e6).to_string(),
                "{micro} micro-units"
            );
        }
        assert_eq!(Micro(i64::MIN).to_string(), "-9223372036854.775808");
        assert_eq!(Micro::MAX.to_string(), "9223372036854.775807");
    }

    /// A batch price is the exact product, and a product the integers
    /// cannot hold is no price at all rather than a wrapped one.
    ///
    /// A batch price is the exact product of the act price and the count, or none when it overflows.
    /// ´claim:handshake:a-batch-price-is-exact-or-none´
    #[test]
    fn a_batch_price_is_exact_or_none() {
        assert_eq!(Micro(50_186).times(15), Some(Micro(752_790)));
        assert_eq!(Micro(50_186).times(0), Some(Micro::ZERO));
        assert_eq!(Micro::MAX.times(1), Some(Micro::MAX));
        assert_eq!(Micro::MAX.times(2), None);
        assert_eq!(Micro(2).times(usize::MAX), None);
    }

    /// One body has one canonical encoding, and a change to any field produces another.
    /// ´claim:handshake:one-body-has-one-canonical-encoding´
    #[test]
    fn canonical_bytes_are_stable_and_field_sensitive() {
        let a = body();
        let mut b = body();
        assert_eq!(a.canonical_bytes(), b.canonical_bytes());
        b.p_i = 0.6;
        assert_ne!(a.canonical_bytes(), b.canonical_bytes());
        let mut c = body();
        c.asserted_parents = vec![ActId::parse("act:alice:1:opinion").expect("ok")];
        assert_ne!(a.canonical_bytes(), c.canonical_bytes());
    }

    /// An act identifier and its source endpoint both derive from the body, never from anything beside it.
    /// ´claim:handshake:the-act-identifier-derives-from-the-body-alone´
    #[test]
    fn act_id_derives_from_body() {
        assert_eq!(body().act_id().to_string(), "act:alice:3:opinion");
        assert_eq!(body().source().to_string(), "addr:alice");
    }

    /// The dependency encoding is order-sensitive, and an empty list has an encoding of its own.
    /// ´claim:handshake:the-dependency-encoding-is-order-sensitive´
    #[test]
    fn deps_encoding_is_order_sensitive() {
        let d1 = ActId::parse("act:a:1:opinion").expect("ok");
        let d2 = ActId::parse("act:a:2:opinion").expect("ok");
        assert_ne!(
            canonical_deps(&[d1.clone(), d2.clone()]),
            canonical_deps(&[d2, d1])
        );
        assert_eq!(canonical_deps(&[]), vec![0x80]);
    }

    /// A dependency list is canonical when it ascends strictly componentwise, the sequence compared as a number, and forming one sorts and collapses duplicates.
    /// ´claim:handshake:a-canonical-dependency-list-ascends-componentwise´
    #[test]
    fn a_canonical_dependency_list_ascends_componentwise() {
        let id = |s: &str| ActId::parse(s).expect("ok");
        let (nine, ten, bob) = (
            id("act:a:9:opinion"),
            id("act:a:10:opinion"),
            id("act:b:0:opinion"),
        );
        assert!(is_canonical_dep_list(&[]));
        assert!(is_canonical_dep_list(std::slice::from_ref(&nine)));
        assert!(
            is_canonical_dep_list(&[nine.clone(), ten.clone(), bob.clone()]),
            "the sequence value orders the list, not its text"
        );
        assert!(!is_canonical_dep_list(&[ten.clone(), nine.clone()]));
        assert!(!is_canonical_dep_list(&[ten.clone(), ten.clone()]));
        assert_eq!(
            canonical_dep_list([bob.clone(), ten.clone(), nine.clone(), ten.clone()]),
            vec![nine, ten, bob]
        );
        assert!(canonical_dep_list([]).is_empty());
    }

    /// Three identifiers on which the text bytes, the encoded bytes and the componentwise order all disagree: the canonical list takes the componentwise one.
    /// ´claim:handshake:the-dependency-order-is-neither-text-nor-encoding-order´
    #[test]
    fn the_dependency_order_is_neither_text_nor_encoding_order() {
        let id = |s: &str| ActId::parse(s).expect("ok");
        let (nine, ten, other) = (
            id("act:a:9:opinion"),
            id("act:a:10:accept"),
            id("act:b:0:ratify"),
        );
        let all = [other.clone(), ten.clone(), nine.clone()];
        let componentwise = vec![nine, ten, other];

        let mut by_text = all.to_vec();
        by_text.sort_by_key(ActId::to_string);
        let mut by_encoding = all.to_vec();
        by_encoding.sort_by_key(|d| canonical_deps(std::slice::from_ref(d)));
        assert_ne!(by_text, componentwise);
        assert_ne!(by_encoding, componentwise);
        assert_ne!(by_text, by_encoding);

        assert_eq!(canonical_dep_list(all), componentwise);
        assert!(is_canonical_dep_list(&componentwise));
        assert!(!is_canonical_dep_list(&by_text));
        assert!(!is_canonical_dep_list(&by_encoding));
    }

    fn package(epoch: i64, positions: &[i64]) -> EpochPackage {
        EpochPackage {
            epoch,
            asserted_at: chrono::DateTime::from_timestamp(1_800_000_000, 0).expect("instant"),
            records: positions
                .iter()
                .enumerate()
                .map(|(seq, position)| {
                    let act_id = ActId::new("alice", seq as u64, Family::Opinion).expect("valid");
                    PublishedRecord {
                        authentication: ActAuthentication::unverified(&act_id),
                        act_id,
                        author: "alice".into(),
                        family: Family::Opinion,
                        epoch,
                        act_time: 1,
                        position: *position,
                        payload_witness: vec![],
                        legs: vec![],
                    }
                })
                .collect(),
            closure: EpochClosure::default(),
        }
    }

    /// The package carries the replay floor and the Host Contract's inputs,
    /// and nothing else — no verdict, certificate or diagnostic. Every
    /// pattern below is exhaustive, so a field added to any part of the
    /// package fails to compile here until it is named and classed; each
    /// binding is named for what it is in the package:
    ///
    /// - the order of record and its asserted timestamp (epoch, positions,
    ///   act times, boundary instant);
    /// - per accepted act, the act envelope at the floor: act identifier,
    ///   author and family, the approved body, both commitments with the
    ///   formation edition each names, the signed pre-commitment, the host
    ///   seal, the approval witness, and the author key they verify under;
    ///   with the host-derived edge projections and maturities;
    /// - the closure's Host Contract inputs: cause and boundary triple, the
    ///   dependent-set partition, the final ledger and debit vintage, the
    ///   wall controller's step, the marker policy and the verification-case
    ///   declarations, both by identity and edition.
    ///
    /// The package's field set is exactly the replay floor's plus the Host Contract inputs.
    /// ´claim:handshake:the-package-carries-the-floor-and-the-host-contract-inputs-only´
    #[test]
    fn the_package_carries_the_floor_and_the_host_contract_inputs_only() {
        let mut package = package(1, &[1]);
        package.closure.case_declarations = vec![CaseDeclaration {
            identity: "case".into(),
            edition: 1,
        }];
        package.closure.wall = Some(WallStep {
            wall_in_force: Ratio::ONE,
            width: Ratio::ONE,
            accepted_rung: Ratio::ZERO,
            proposal: Ratio::ONE,
            delivered: Ratio::ONE,
            theta_next_micro: 1,
        });
        let EpochPackage {
            epoch: _order_epoch,
            asserted_at: _boundary_instant,
            records,
            closure,
        } = &package;
        for record in records {
            let PublishedRecord {
                act_id: _envelope_act_id,
                author: _envelope_author,
                family: _envelope_family,
                epoch: _finalization_epoch,
                act_time: _act_time,
                position: _order_position,
                payload_witness: _content_commitment,
                legs,
                authentication,
            } = record;
            for leg in legs {
                let PublishedLeg {
                    role: _projection_role,
                    source: _projection_source,
                    target: _projection_target,
                    p_d: _rendered_p_d,
                    p_i: _rendered_p_i,
                    tau: _host_cached_maturity,
                } = leg;
            }
            let ActAuthentication {
                body: _approved_body,
                author_pubkey: _author_key,
                pre_commitment: _pre_commitment,
                pre_signature: _author_signature_over_it,
                dependency_commitment: _dependency_commitment,
                content_edition: _content_formation_edition,
                dependency_edition: _dependency_formation_edition,
                host_seal: _verification_seal,
                approval_signature: _approval_witness,
            } = authentication;
        }
        let EpochClosure {
            cause: _closure_cause,
            boundary,
            dependent_sets: _dependent_set_partition,
            ledger,
            theta_charged_micro: _debit_vintage,
            wall,
            marker,
            case_declarations,
        } = closure;
        let BoundaryPolicy {
            target_acts: _target,
            min_duration_secs: _minimum,
            max_duration_secs: _maximum,
        } = boundary;
        for line in ledger {
            let LedgerLine {
                address: _ledger_author,
                accepted_acts: _accepted_increment,
                action_count: _action_count,
                residual_balance_micro: _residual_balance,
            } = line;
        }
        if let Some(WallStep {
            wall_in_force: _wall_in_force,
            width: _contributing_width,
            accepted_rung: _accepted_rung,
            proposal: _target_proposal,
            delivered: _delivered_wall,
            theta_next_micro: _next_price,
        }) = wall
        {}
        let MarkerPolicy {
            identity: _marker_identity,
            edition: _marker_edition,
        } = marker;
        for case in case_declarations {
            let CaseDeclaration {
                identity: _case_identity,
                edition: _case_edition,
            } = case;
        }
    }

    /// The default closure — what a consumer's fixture uses — binds the
    /// empty set of verification-case declarations explicitly, and the
    /// verified act a record publishes is formed from the record's own
    /// commitments: its content commitment is the payload witness.
    ///
    /// A record's verified act is formed from its own fields, the payload witness as its content commitment.
    /// ´claim:handshake:a-records-verified-act-is-formed-from-its-own-fields´
    #[test]
    fn a_records_verified_act_is_formed_from_its_own_fields() {
        assert_eq!(EpochClosure::default().case_declarations, vec![]);
        let mut record = package(1, &[1]).records.remove(0);
        record.payload_witness = vec![7; 32];
        record.authentication.dependency_commitment = vec![8; 32];
        record.authentication.content_edition = 2;
        record.authentication.dependency_edition = 3;
        let frame = record.seal_frame();
        assert_eq!(frame.content_commitment, &[7; 32]);
        assert_eq!(frame.deps_commitment, &[8; 32]);
        assert_eq!((frame.content_edition, frame.deps_edition), (2, 3));
        assert_eq!(frame.body, &record.authentication.body);
        let mut other = record.clone();
        other.payload_witness = vec![9; 32];
        assert_ne!(
            seal_message(&record.seal_frame()),
            seal_message(&other.seal_frame())
        );
    }

    /// A ratio is held in lowest terms with a positive denominator, so
    /// equal values compare equal however they were written, and the order
    /// is the order of the values — 3/37 sits between the grid walls
    /// 8_108/100_000 and 8_109/100_000.
    ///
    /// A ratio is exact: one value has one representation, and the order is the order of the values.
    /// ´claim:handshake:a-ratio-is-exact´
    #[test]
    fn a_ratio_is_exact() {
        let floor = Ratio::new(3, 37).expect("ratio");
        assert_eq!(Ratio::new(6, 74), Some(floor));
        assert_eq!(Ratio::new(-3, -37), Some(floor));
        assert_eq!(Ratio::new(3, -37).map(|r| r.denominator()), Some(37));
        assert_eq!(Ratio::new(1, 0), None);
        let below = Ratio::new(8_108, 100_000).expect("ratio");
        let above = Ratio::new(8_109, 100_000).expect("ratio");
        assert!(below < floor && floor < above);
        assert_eq!(above.numerator(), 8_109);
        assert_eq!(
            Ratio::new(1, 4).and_then(|q| q.checked_add(Ratio::new(1, 20)?)),
            Ratio::new(3, 10)
        );
        assert_eq!(
            Ratio::new(1, 4).and_then(|q| q.checked_sub(Ratio::ONE)),
            Ratio::new(-3, 4)
        );
        assert_eq!(
            Ratio::new(-3, 4).and_then(Ratio::checked_abs),
            Ratio::new(3, 4)
        );
        assert_eq!(
            Ratio::new(5, 4).and_then(|m| m.checked_mul(Ratio::new(15, 8)?)),
            Ratio::new(75, 32)
        );
        assert_eq!(floor.to_string(), "3/37");
        assert_eq!(Ratio::ZERO.signum(), 0);
    }

    /// A package at epoch 1 or later whose positions are 1..=n, in any
    /// listed order, has an order of record — including the empty epoch.
    ///
    /// Epochs and positions numbered from 1 with no gap or repeat form an order of record.
    /// ´claim:handshake:an-order-of-record-numbers-from-one´
    #[test]
    fn epochs_and_positions_from_one_form_an_order_of_record() {
        assert_eq!(package(1, &[1, 2, 3]).check_order_of_record(), Ok(()));
        assert_eq!(package(7, &[2, 3, 1]).check_order_of_record(), Ok(()));
        assert_eq!(package(1, &[]).check_order_of_record(), Ok(()));
    }

    /// Each fault §7.2 names — an epoch 0, a position outside 1..=|𝒬_k|, a
    /// repeated or a missing position — leaves the package with no order
    /// of record, as does a record that names another epoch than its own.
    ///
    /// Epoch 0, a position outside 1..=n, a repeat, a gap or a misplaced record has no order of record.
    /// ´claim:handshake:a-malformed-numbering-has-no-order-of-record´
    #[test]
    fn every_numbering_fault_is_refused() {
        assert_eq!(
            package(0, &[1]).check_order_of_record(),
            Err(MalformedOrder::EpochOutOfRange(0))
        );
        assert_eq!(
            package(-1, &[]).check_order_of_record(),
            Err(MalformedOrder::EpochOutOfRange(-1))
        );
        assert!(matches!(
            package(1, &[0, 1]).check_order_of_record(),
            Err(MalformedOrder::PositionOutOfRange {
                position: 0,
                len: 2,
                ..
            })
        ));
        assert!(
            matches!(
                package(1, &[1, 2, 4]).check_order_of_record(),
                Err(MalformedOrder::PositionOutOfRange {
                    position: 4,
                    len: 3,
                    ..
                })
            ),
            "a gap: position 3 is missing, so 4 lies outside 1..=3"
        );
        assert_eq!(
            package(2, &[1, 1]).check_order_of_record(),
            Err(MalformedOrder::RepeatedPosition {
                epoch: 2,
                position: 1
            })
        );
        let mut misplaced = package(3, &[1, 2]);
        misplaced.records[1].epoch = 2;
        assert!(matches!(
            misplaced.check_order_of_record(),
            Err(MalformedOrder::MisplacedRecord {
                named: 2,
                epoch: 3,
                ..
            })
        ));
    }
}
