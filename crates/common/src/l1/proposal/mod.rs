//! ´mod:module:proposal´
//!
//! The act-proposal handshake with one private nonce per removable
//! projection (layer1-interface.md §8.2, "The admission handshake").
//!
//! The actor binds its proposal under a content nonce and a dependency
//! nonce drawn independently, so a verifier holding the dependency opening
//! holds nothing that tests a content guess. The host receives the body,
//! the dependency list with its nonce, and the opaque content pre-digest —
//! never the payload or the content nonce — and every check it makes for
//! the act is computable from those alone.
//!
//! Reused unchanged from [`super::handshake`]: the structural body and its
//! canonical bytes, the canonical dependency encoding, the proposal the
//! device signs (body, payload, dependencies), the encoded verified act the
//! host seal covers, and the approval witness over it. Bare section
//! references below are layer1-interface.md's.

use ed25519_dalek::SigningKey;

use super::crypto;
use super::handshake::{self, ApprovalWitness, Proposal, SealFrame, StructuralBody};
use super::identifier::ActId;

mod device;
mod transport;

pub use transport::PreCommitmentBlob;

pub mod domain_tags {
    //! ´mod:module:domain-tags´
    //!
    //! Domain-separation tags of the formulas this module owns. The rule of
    //! [`crate::l1::crypto::tags`] holds: a tag's version names its formula,
    //! so no artifact formed under one nonce shared by both projections
    //! verifies here. The host seal and the approval cover the encoded
    //! verified act of [`crate::l1::handshake::seal_message`], whose shape
    //! these formulas leave alone, so they keep
    //! [`crate::l1::crypto::tags::HOST_SEAL`] and
    //! [`crate::l1::crypto::tags::APPROVAL`].
    pub const PRE_DIGEST_CONTENT: &[u8] = b"cogra-l1:pre-digest:content:v3";
    pub const PRE_DIGEST_DEPS: &[u8] = b"cogra-l1:pre-digest:deps:v3";
    pub const PRE_COMMITMENT: &[u8] = b"cogra-l1:pre-commitment:v2";
    pub const COMMIT_CONTENT: &[u8] = b"cogra-l1:commitment:content:v3";
    pub const COMMIT_DEPS: &[u8] = b"cogra-l1:commitment:deps:v3";
}

/// The content edition a verified act is sealed under: the content
/// commitment is formed over the content pre-digest. A device refuses any
/// other (§8.2, "Approval witness": correct editions).
pub const CONTENT_EDITION: u64 = 2;

/// The dependency edition a verified act is sealed under.
pub const DEPENDENCY_EDITION: u64 = 1;

/// The content pre-digest h_c: the act identifier, the content nonce and
/// the payload, under its own tag (§8.2, "Proposal pre-commitment").
/// Without the content nonce it confirms no payload guess.
pub fn content_pre_digest(act_id: &ActId, content_nonce: &[u8], payload: &[u8]) -> [u8; 32] {
    crypto::pre_digest(
        domain_tags::PRE_DIGEST_CONTENT,
        act_id.to_string().as_bytes(),
        content_nonce,
        payload,
    )
}

/// The dependency pre-digest h_d: the act identifier, the dependency nonce
/// and the canonical dependency encoding. The host recomputes it from what
/// it receives.
pub fn dependency_pre_digest(act_id: &ActId, dependency_nonce: &[u8], deps: &[ActId]) -> [u8; 32] {
    crypto::pre_digest(
        domain_tags::PRE_DIGEST_DEPS,
        act_id.to_string().as_bytes(),
        dependency_nonce,
        &handshake::canonical_deps(deps),
    )
}

/// The proposal pre-commitment P over the canonical body and both
/// pre-digests — the form the host calls, which takes no payload and no
/// content nonce (§8.2, "Verified act": the act checks never require
/// either).
pub fn pre_commitment(
    body: &StructuralBody,
    content_pre_digest: &[u8; 32],
    dependency_pre_digest: &[u8; 32],
) -> [u8; 32] {
    crypto::sha256_tagged(
        domain_tags::PRE_COMMITMENT,
        &[&handshake::pre_commitment_msg(
            body,
            content_pre_digest,
            dependency_pre_digest,
        )],
    )
}

/// The content commitment C_c over the act identifier, P, the host's
/// content salt and the content pre-digest. It binds the payload through
/// the pre-digest and inherits its concealment, by one formula whether or
/// not the host holds the content pair. The pre-digest parameter is a
/// digest by type, so payload bytes cannot be passed in its place.
pub fn content_commitment(
    act_id: &ActId,
    pre_commitment: &[u8],
    salt: &[u8],
    content_pre_digest: &[u8; 32],
) -> [u8; 32] {
    crypto::commitment(
        domain_tags::COMMIT_CONTENT,
        act_id.to_string().as_bytes(),
        pre_commitment,
        salt,
        content_pre_digest,
    )
}

/// The dependency commitment C_d over the act identifier, P, the host's
/// dependency salt and the canonical dependency encoding — the opening an
/// ordering fraud proof re-derives, which needs no nonce.
pub fn dependency_commitment(
    act_id: &ActId,
    pre_commitment: &[u8],
    salt: &[u8],
    deps: &[ActId],
) -> [u8; 32] {
    crypto::commitment(
        domain_tags::COMMIT_DEPS,
        act_id.to_string().as_bytes(),
        pre_commitment,
        salt,
        &handshake::canonical_deps(deps),
    )
}

/// The content pair (payload, content nonce), optional as a unit: bytes
/// without their nonce cannot be verified against the content pre-digest
/// (§8.2, "Verified act"). Its custodian removes both members together.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ContentPair {
    pub payload: Vec<u8>,
    pub nonce: Vec<u8>,
}

impl ContentPair {
    pub fn pre_digest(&self, act_id: &ActId) -> [u8; 32] {
        content_pre_digest(act_id, &self.nonce, &self.payload)
    }
}

/// The actor's pre-signed proposal: the proposal it signed, both nonces it
/// drew, and its signature over P. Held by the device until approval and by
/// the carriage layer, which turns it into the host-facing [`Submission`].
#[derive(Debug, Clone, PartialEq)]
pub struct PreSigned {
    pub proposal: Proposal,
    /// The actor's public key (32 bytes, Ed25519 interim realization).
    pub author_pubkey: Vec<u8>,
    pub content_nonce: Vec<u8>,
    pub dependency_nonce: Vec<u8>,
    pub pre_signature: Vec<u8>,
}

impl PreSigned {
    pub fn act_id(&self) -> ActId {
        self.proposal.body.act_id()
    }

    pub fn content_pre_digest(&self) -> [u8; 32] {
        content_pre_digest(&self.act_id(), &self.content_nonce, &self.proposal.payload)
    }

    pub fn dependency_pre_digest(&self) -> [u8; 32] {
        dependency_pre_digest(&self.act_id(), &self.dependency_nonce, &self.proposal.deps)
    }

    /// P, recomputed from the proposal and both nonces.
    pub fn pre_commitment(&self) -> [u8; 32] {
        pre_commitment(
            &self.proposal.body,
            &self.content_pre_digest(),
            &self.dependency_pre_digest(),
        )
    }

    pub fn content_pair(&self) -> ContentPair {
        ContentPair {
            payload: self.proposal.payload.clone(),
            nonce: self.content_nonce.clone(),
        }
    }

    /// What the host receives: the pair is left behind and only its
    /// pre-digest travels.
    pub fn submission(&self) -> Submission {
        Submission {
            body: self.proposal.body.clone(),
            deps: self.proposal.deps.clone(),
            dependency_nonce: self.dependency_nonce.clone(),
            content_pre_digest: self.content_pre_digest(),
            pre_commitment: self.pre_commitment(),
            pre_signature: self.pre_signature.clone(),
            author_pubkey: self.author_pubkey.clone(),
        }
    }
}

/// Why the host refuses a submission's authentication — the act checks of
/// §8.2 this module can make. Formation, identifier uniqueness, references
/// and dependency bounds are the host's own.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum SubmissionError {
    /// The author key does not parse, or is not the body author's.
    #[error("malformed author key, or a key that is not the author's")]
    AuthorKey,
    #[error("the pre-commitment does not recompute from the body and both pre-digests")]
    PreCommitment,
    #[error("the pre-signature does not verify over the pre-commitment")]
    PreSignature,
}

/// The host-facing proposal (§8.2, "Verified act"): body, dependency list,
/// dependency nonce, content pre-digest, P and the pre-signature, plus the
/// author's key the stand-in verifies it under. The content pair is absent.
///
/// Non-exhaustive so a deployment whose host accepts carriage can add the
/// optional pair without breaking a caller (Rust Reference, "The
/// `non_exhaustive` attribute"; API Guidelines C-STRUCT-PRIVATE): other
/// crates build one with [`PreSigned::submission`] or [`Submission::new`].
#[derive(Debug, Clone, PartialEq)]
#[non_exhaustive]
pub struct Submission {
    pub body: StructuralBody,
    pub deps: Vec<ActId>,
    pub dependency_nonce: Vec<u8>,
    pub content_pre_digest: [u8; 32],
    pub pre_commitment: [u8; 32],
    pub pre_signature: Vec<u8>,
    pub author_pubkey: Vec<u8>,
}

impl Submission {
    pub fn new(
        body: StructuralBody,
        deps: Vec<ActId>,
        dependency_nonce: Vec<u8>,
        content_pre_digest: [u8; 32],
        pre_commitment: [u8; 32],
        pre_signature: Vec<u8>,
        author_pubkey: Vec<u8>,
    ) -> Self {
        Self {
            body,
            deps,
            dependency_nonce,
            content_pre_digest,
            pre_commitment,
            pre_signature,
            author_pubkey,
        }
    }

    pub fn act_id(&self) -> ActId {
        self.body.act_id()
    }

    pub fn dependency_pre_digest(&self) -> [u8; 32] {
        dependency_pre_digest(&self.act_id(), &self.dependency_nonce, &self.deps)
    }

    /// The submission's authentication: P recomputed from the body, the
    /// received content pre-digest and the dependency pre-digest formed
    /// here, equal to the received P, and the pre-signature strictly valid
    /// over it under the author's key. The key must parse and must be the
    /// body's author's, so a signature under any other actor's key is
    /// refused.
    pub fn verify_pre_commitment(&self) -> Result<(), SubmissionError> {
        let key = crypto::verifying_key_from_bytes(&self.author_pubkey)
            .ok_or(SubmissionError::AuthorKey)?;
        if crypto::address_of(&key) != self.body.author {
            return Err(SubmissionError::AuthorKey);
        }
        let formed = pre_commitment(
            &self.body,
            &self.content_pre_digest,
            &self.dependency_pre_digest(),
        );
        if formed != self.pre_commitment {
            return Err(SubmissionError::PreCommitment);
        }
        if !crypto::verify_digest(&key, &formed, &self.pre_signature) {
            return Err(SubmissionError::PreSignature);
        }
        Ok(())
    }

    /// The reference host step after its own act checks: verify the
    /// submission's authentication, form both commitments under the salts
    /// the host drew, and seal the header. A submission that does not
    /// authenticate yields no verified act.
    pub fn seal(
        &self,
        host: &SigningKey,
        content_salt: Vec<u8>,
        dependency_salt: Vec<u8>,
    ) -> Result<SealedAct, SubmissionError> {
        self.verify_pre_commitment()?;
        let act_id = self.act_id();
        let act = VerifiedAct {
            body: self.body.clone(),
            pre_commitment: self.pre_commitment.to_vec(),
            pre_signature: self.pre_signature.clone(),
            content_commitment: content_commitment(
                &act_id,
                &self.pre_commitment,
                &content_salt,
                &self.content_pre_digest,
            )
            .to_vec(),
            dependency_commitment: dependency_commitment(
                &act_id,
                &self.pre_commitment,
                &dependency_salt,
                &self.deps,
            )
            .to_vec(),
            content_edition: CONTENT_EDITION,
            dependency_edition: DEPENDENCY_EDITION,
        };
        let host_seal = crypto::sign(host, crypto::tags::HOST_SEAL, &act.seal_message());
        Ok(SealedAct {
            act,
            content_salt,
            dependency_salt,
            host_seal,
        })
    }
}

/// The verified act: the header the host seals (§8.2, "Verified act") —
/// body, P, pre-signature, both commitments and both edition tags. No
/// payload, no nonce, no host order field.
#[derive(Debug, Clone, PartialEq)]
pub struct VerifiedAct {
    pub body: StructuralBody,
    pub pre_commitment: Vec<u8>,
    pub pre_signature: Vec<u8>,
    pub content_commitment: Vec<u8>,
    pub dependency_commitment: Vec<u8>,
    pub content_edition: u64,
    pub dependency_edition: u64,
}

impl VerifiedAct {
    pub fn act_id(&self) -> ActId {
        self.body.act_id()
    }

    /// The encoded verified act the host seal covers.
    pub fn seal_message(&self) -> Vec<u8> {
        handshake::seal_message(&SealFrame {
            body: &self.body,
            pre_commitment: &self.pre_commitment,
            pre_signature: &self.pre_signature,
            content_commitment: &self.content_commitment,
            deps_commitment: &self.dependency_commitment,
            content_edition: self.content_edition,
            deps_edition: self.dependency_edition,
        })
    }
}

/// What the host returns: the verified act, both salts and the host seal
/// over the encoded verified act. The seal attests no carriage of the
/// content pair.
#[derive(Debug, Clone, PartialEq)]
pub struct SealedAct {
    pub act: VerifiedAct,
    pub content_salt: Vec<u8>,
    pub dependency_salt: Vec<u8>,
    pub host_seal: Vec<u8>,
}

impl SealedAct {
    /// Whether the host seal verifies, strictly, under `host_pubkey`.
    pub fn verify_seal(&self, host_pubkey: &[u8]) -> bool {
        crypto::verifying_key_from_bytes(host_pubkey).is_some_and(|key| {
            crypto::verify(
                &key,
                crypto::tags::HOST_SEAL,
                &self.act.seal_message(),
                &self.host_seal,
            )
        })
    }

    /// The digest the author's approval witness signs: the encoded verified
    /// act together with its host seal.
    pub fn approval_digest(&self) -> [u8; 32] {
        handshake::approval_digest(&self.act.seal_message(), &self.host_seal)
    }

    /// Whether `witness` is the author's approval of this exact sealed act.
    pub fn verify_approval(&self, author_pubkey: &[u8], witness: &ApprovalWitness) -> bool {
        witness.act_id == self.act.act_id()
            && crypto::verifying_key_from_bytes(author_pubkey).is_some_and(|key| {
                crypto::verify_digest(&key, &self.approval_digest(), &witness.approval_signature)
            })
    }
}

#[cfg(test)]
mod tests;
