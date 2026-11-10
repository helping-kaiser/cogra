//! ´mod:module:handshake´
//!
//! The admission-handshake objects and the epoch package
//! (layer1-interface.md §8.2, §8.4, §11.6).
//!
//! These are the seam's data transfer shapes: what crosses the boundary
//! between CoGra and the substrate, in both directions. Bare section
//! references below are that document's.

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

/// A proposal before signing: body plus the two removable projections.
#[derive(Debug, Clone, PartialEq)]
pub struct Proposal {
    pub body: StructuralBody,
    /// Payload bytes — canonical empty is the zero-length string (§8.4).
    pub payload: Vec<u8>,
    /// Declared dependencies (each naming a whole act).
    pub deps: Vec<ActId>,
}

/// The actor's signed pre-commitment over the canonical structural body
/// plus both pre-digests (§8.2).
#[derive(Debug, Clone, PartialEq)]
pub struct PreSignedProposal {
    pub proposal: Proposal,
    /// The actor's public key (32 bytes, Ed25519 interim realization).
    pub author_pubkey: Vec<u8>,
    /// The private nonce under the pre-digests. Travels with the proposal
    /// to the host in the centralized phase so the host can validate the
    /// pre-commitment against the exact bytes it will carry.
    pub nonce: Vec<u8>,
    pub pre_signature: Vec<u8>,
}

impl PreSignedProposal {
    /// The pre-commitment the pre-signature covers, recomputed from the
    /// proposal and the nonce it was formed under.
    pub fn pre_commitment(&self) -> [u8; 32] {
        pre_commitment(&self.proposal, &self.nonce)
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

/// The proposal pre-commitment (§8.2, "Proposal pre-commitment"): the
/// tagged hash of the canonical body and both pre-digests, each pre-digest
/// formed over the act identifier, the private nonce, and the projection's
/// bytes. The pre-signature is the author's Ed25519 signature over exactly
/// these 32 bytes, and both commitments bind them, so the value is named,
/// carried in the verified act, and kept with the structural record.
pub fn pre_commitment(proposal: &Proposal, nonce: &[u8]) -> [u8; 32] {
    let act_id = proposal.body.act_id().to_string();
    let digest_content = crypto::pre_digest(
        tags::PRE_DIGEST_CONTENT,
        act_id.as_bytes(),
        nonce,
        &proposal.payload,
    );
    let digest_deps = crypto::pre_digest(
        tags::PRE_DIGEST_DEPS,
        act_id.as_bytes(),
        nonce,
        &canonical_deps(&proposal.deps),
    );
    crypto::sha256_tagged(
        tags::PRE_COMMITMENT,
        &[&pre_commitment_msg(
            &proposal.body,
            &digest_content,
            &digest_deps,
        )],
    )
}

/// The content commitment of an act — the payload witness — over the act
/// identifier, the pre-commitment, the host's content salt, and the
/// payload (§8.2, "Verified act").
pub fn content_commitment(
    act_id: &ActId,
    pre_commitment: &[u8],
    salt: &[u8],
    payload: &[u8],
) -> [u8; 32] {
    crypto::commitment(
        tags::COMMIT_CONTENT,
        act_id.to_string().as_bytes(),
        pre_commitment,
        salt,
        payload,
    )
}

/// The dependency commitment of an act, over the act identifier, the
/// pre-commitment, the host's dependency salt, and the canonical
/// dependency list — the opening an ordering fraud proof re-derives
/// (§8.2, "Ordering fraud proof").
pub fn deps_commitment(
    act_id: &ActId,
    pre_commitment: &[u8],
    salt: &[u8],
    deps: &[ActId],
) -> [u8; 32] {
    crypto::commitment(
        tags::COMMIT_DEPS,
        act_id.to_string().as_bytes(),
        pre_commitment,
        salt,
        &canonical_deps(deps),
    )
}

/// The edition tags the stand-in seals under, for the content and the
/// dependency projection alike. A device refuses a verified act carrying
/// any other edition (§8.2, "Approval witness": correct editions).
pub const EDITION: u64 = 1;

/// The host-sealed verified act (§8.2): the exact proposal plus the named
/// pre-commitment, host salts, the binding commitments and the edition
/// tags, sealed by the host signature. No host order fields.
#[derive(Debug, Clone, PartialEq)]
pub struct VerifiedAct {
    pub proposal: Proposal,
    pub author_pubkey: Vec<u8>,
    pub nonce: Vec<u8>,
    pub pre_signature: Vec<u8>,
    pub pre_commitment: Vec<u8>,
    pub content_salt: Vec<u8>,
    pub deps_salt: Vec<u8>,
    pub content_commitment: Vec<u8>,
    pub deps_commitment: Vec<u8>,
    pub content_edition: u64,
    pub deps_edition: u64,
    pub host_seal: Vec<u8>,
}

impl VerifiedAct {
    /// The encoded verified act — the message the host seal covers, and
    /// with the seal the message the approval witness covers (§8.2 — no
    /// epoch index, position, or logical time).
    pub fn seal_msg(&self) -> Vec<u8> {
        seal_message(&SealFrame {
            body: &self.proposal.body,
            pre_commitment: &self.pre_commitment,
            pre_signature: &self.pre_signature,
            content_commitment: &self.content_commitment,
            deps_commitment: &self.deps_commitment,
            content_edition: self.content_edition,
            deps_edition: self.deps_edition,
        })
    }

    /// The digest the author's approval witness signs: the encoded verified
    /// act and its host seal, together.
    pub fn approval_digest(&self) -> [u8; 32] {
        approval_digest(&self.seal_msg(), &self.host_seal)
    }
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
/// "The record mirror").
#[derive(Debug, Clone, PartialEq)]
pub struct PublishedRecord {
    pub act_id: ActId,
    pub author: String,
    pub family: Family,
    /// Landing epoch, numbered from [`FIRST_EPOCH`].
    pub epoch: i64,
    /// Authoritative causal key (§8.3).
    pub act_time: i64,
    /// The act's place in its epoch, numbered from [`FIRST_POSITION`].
    pub position: i64,
    /// Non-empty payload committed under the witness.
    pub payload_marked: bool,
    /// The content commitment — the payload witness.
    pub payload_witness: Vec<u8>,
    pub legs: Vec<PublishedLeg>,
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
/// final act sequence), with the boundary's attested timestamp and the
/// closure outputs the host computed for it.
#[derive(Debug, Clone, PartialEq)]
pub struct EpochPackage {
    /// The epoch, numbered from [`FIRST_EPOCH`].
    pub epoch: i64,
    /// The attested boundary timestamp (the Host Contract's accepted-records
    /// package): when the epoch closed, so when its records landed.
    pub attested_at: chrono::DateTime<chrono::Utc>,
    /// 𝒬_k in its published order; its length is the realized size.
    pub records: Vec<PublishedRecord>,
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
        self.checked_add(Ratio::from_wide(-(other.numerator as i128), other.denominator as i128)?)
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

/// Why the epoch closed (§11.6, `post:epoch:final-act-sequence-closure`):
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

/// One step of the wall controller (§11.8, `def:epoch:wall-controller`):
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

/// The closure outputs of one epoch beyond its records (§5 host contract
/// (i), (ii) and (vi)): the dependent-set partition and closure cause, the
/// final ledger with the debit vintage, the wall controller's step, and the
/// marker policy. The deployment's fixed declarations — numéraire, floor,
/// controller edition and constants — are published once per deployment,
/// not here.
///
/// `Default` is the empty value, for fixtures of consumers that read the
/// records alone; no host publishes it.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EpochClosure {
    pub cause: ClosureCause,
    /// The dependent-set partition of 𝒬_k (`def:graph:dependent-act-set`),
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

/// The B_i surface as the stand-in honors it: numbers
/// (roadmap.md "The stand-in and the swap").
#[derive(Debug, Clone, PartialEq)]
pub struct AccountBalance {
    pub address: String,
    /// Committed burn total B_i (monotone).
    pub burned_total: f64,
    /// Residual balance b_i after θ-debits.
    pub balance: f64,
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

    fn package(epoch: i64, positions: &[i64]) -> EpochPackage {
        EpochPackage {
            epoch,
            attested_at: chrono::DateTime::from_timestamp(1_800_000_000, 0).expect("instant"),
            records: positions
                .iter()
                .enumerate()
                .map(|(seq, position)| PublishedRecord {
                    act_id: ActId::new("alice", seq as u64, Family::Opinion).expect("valid"),
                    author: "alice".into(),
                    family: Family::Opinion,
                    epoch,
                    act_time: 1,
                    position: *position,
                    payload_marked: false,
                    payload_witness: vec![],
                    legs: vec![],
                })
                .collect(),
        }
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
