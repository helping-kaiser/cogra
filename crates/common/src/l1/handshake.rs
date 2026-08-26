//! ´mod:module:handshake´
//!
//! The admission-handshake objects and the epoch package
//! (layer1-interface.md §8.2, §8.4, §11.6).
//!
//! These are the seam's data transfer shapes: what crosses the boundary
//! between CoGra and the substrate, in both directions. Bare section
//! references below are that document's.

use super::census::{Family, LegRole};
use super::encoding::Encoder;
use super::identifier::{ActId, NodeId};

/// The canonical structural body of a proposal — everything the actor
/// authors (§8.4): identity fields, incidence, the family parameter tuple,
/// public protocol references, and asserted causal parents. Payload bytes
/// and the dependency list are the two removable projections and ride
/// beside the body, never inside it.
#[derive(Debug, Clone, PartialEq)]
pub struct StructuralBody {
    /// The author's L0 address atom.
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

/// The message the pre-commitment signature covers.
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

/// The host-sealed verified act (§8.2): the exact
/// proposal plus host salts and the binding commitments, sealed by the
/// host signature. No host order fields.
#[derive(Debug, Clone, PartialEq)]
pub struct VerifiedAct {
    pub proposal: Proposal,
    pub author_pubkey: Vec<u8>,
    pub nonce: Vec<u8>,
    pub pre_signature: Vec<u8>,
    pub content_salt: Vec<u8>,
    pub deps_salt: Vec<u8>,
    pub content_commitment: Vec<u8>,
    pub deps_commitment: Vec<u8>,
    pub host_seal: Vec<u8>,
}

impl VerifiedAct {
    /// The message the host seal and the approval witness cover: the exact
    /// verified act including the host-added commitments (§8.2 — the
    /// witness signs no epoch index, position, or logical time).
    pub fn seal_msg(&self) -> Vec<u8> {
        seal_message(
            &self.proposal.body,
            &self.pre_signature,
            &self.content_commitment,
            &self.deps_commitment,
        )
    }
}

/// The seal frame from its parts — the one encoding of the message
/// `VerifiedAct::seal_msg` covers, callable where only stored columns
/// exist rather than an assembled act. Like the body, the frame closes on a
/// schema version so its shape can evolve forward.
pub fn seal_message(
    body: &StructuralBody,
    pre_signature: &[u8],
    content_commitment: &[u8],
    deps_commitment: &[u8],
) -> Vec<u8> {
    let mut e = Encoder::new();
    e.array(5);
    e.bytes(&body.canonical_bytes());
    e.bytes(pre_signature);
    e.bytes(content_commitment);
    e.bytes(deps_commitment);
    e.uint(1);
    e.finish()
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
/// final act sequence).
#[derive(Debug, Clone, PartialEq)]
pub struct EpochPackage {
    pub epoch: i64,
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

    #[test]
    fn act_id_derives_from_body() {
        assert_eq!(body().act_id().to_string(), "act:alice:3:opinion");
        assert_eq!(body().source().to_string(), "addr:alice");
    }

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
