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
    /// Landing epoch.
    pub epoch: i64,
    /// Authoritative causal key (§8.3).
    pub act_time: i64,
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
/// final act sequence), with the boundary's attested timestamp.
#[derive(Debug, Clone, PartialEq)]
pub struct EpochPackage {
    pub epoch: i64,
    /// The attested boundary timestamp (the Host Contract's accepted-records
    /// package): when the epoch closed, so when its records landed.
    pub attested_at: chrono::DateTime<chrono::Utc>,
    pub records: Vec<PublishedRecord>,
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
}
