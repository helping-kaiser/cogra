// The client (device) side of the admission handshake
// (layer1-interface.md §8.2; substrate.md §6 — client-signed,
// backend-relayed). Used by the dev CLI, the bootstrap's custodied system
// actors, and tests. The Android client re-implements the same steps
// on-device from slice 1 on.

use ed25519_dalek::SigningKey;
use rand::RngCore;
use rand::rngs::OsRng;

use super::crypto::{self, tags};
use super::handshake::{
    ApprovalWitness, PreSignedProposal, Proposal, VerifiedAct, pre_commitment_msg,
};
use super::{L1Error, handshake::canonical_deps};

/// An actor keypair under the interim realization. The signing side of a
/// write is always this object — the backend relays, never signs
/// (substrate.md §6; custody exceptions hold the same object in backend
/// custody).
pub struct ActorKey {
    key: SigningKey,
}

impl ActorKey {
    pub fn generate() -> Self {
        Self {
            key: SigningKey::generate(&mut OsRng),
        }
    }

    pub fn from_seed(seed: [u8; 32]) -> Self {
        Self {
            key: SigningKey::from_bytes(&seed),
        }
    }

    pub fn seed(&self) -> [u8; 32] {
        self.key.to_bytes()
    }

    pub fn public_key_bytes(&self) -> Vec<u8> {
        self.key.verifying_key().as_bytes().to_vec()
    }

    /// The actor's L0 address atom (stand-in convention).
    pub fn address(&self) -> String {
        crypto::address_of(&self.key.verifying_key())
    }

    /// Step 2 of the write — pre-sign: bind the exact proposal under a
    /// fresh private nonce (`def:graph:proposal-pre-commitment`).
    pub fn pre_sign(&self, proposal: Proposal) -> PreSignedProposal {
        let mut nonce = vec![0u8; crypto::SALT_LEN];
        OsRng.fill_bytes(&mut nonce);
        let digest_content =
            crypto::pre_digest(tags::PRE_DIGEST_CONTENT, &nonce, &proposal.payload);
        let digest_deps = crypto::pre_digest(
            tags::PRE_DIGEST_DEPS,
            &nonce,
            &canonical_deps(&proposal.deps),
        );
        let msg = pre_commitment_msg(&proposal.body, &digest_content, &digest_deps);
        let pre_signature = crypto::sign(&self.key, tags::PRE_COMMITMENT, &msg);
        PreSignedProposal {
            proposal,
            author_pubkey: self.public_key_bytes(),
            nonce,
            pre_signature,
        }
    }

    /// Step 4 of the write — approve: verify the host seal, the exact
    /// returned body, and both commitment openings, then sign the approval
    /// witness (`def:graph:approval-witness`). `sent` is the proposal the
    /// client pre-signed; the check is exact equality against what the
    /// host returned.
    pub fn approve(
        &self,
        sent: &PreSignedProposal,
        sealed: &VerifiedAct,
        host_pubkey: &[u8],
    ) -> Result<ApprovalWitness, L1Error> {
        if sealed.proposal != sent.proposal
            || sealed.pre_signature != sent.pre_signature
            || sealed.nonce != sent.nonce
        {
            return Err(L1Error::Authentication(
                "host returned a different act than was pre-signed".into(),
            ));
        }
        let host_key = crypto::verifying_key_from_bytes(host_pubkey)
            .ok_or_else(|| L1Error::Authentication("malformed host key".into()))?;
        if !crypto::verify(
            &host_key,
            tags::HOST_SEAL,
            &sealed.seal_msg(),
            &sealed.host_seal,
        ) {
            return Err(L1Error::Authentication("invalid host seal".into()));
        }
        // Both commitment openings: recompute from the returned salts and
        // the bytes the client itself holds.
        let content = crypto::commitment(
            tags::COMMIT_CONTENT,
            &sealed.content_salt,
            &sent.proposal.payload,
        );
        if content.as_slice() != sealed.content_commitment.as_slice() {
            return Err(L1Error::Authentication(
                "content commitment does not open over the sent payload".into(),
            ));
        }
        let deps = crypto::commitment(
            tags::COMMIT_DEPS,
            &sealed.deps_salt,
            &canonical_deps(&sent.proposal.deps),
        );
        if deps.as_slice() != sealed.deps_commitment.as_slice() {
            return Err(L1Error::Authentication(
                "dependency commitment does not open over the sent list".into(),
            ));
        }
        let approval_signature = crypto::sign(&self.key, tags::APPROVAL, &sealed.seal_msg());
        Ok(ApprovalWitness {
            act_id: sent.proposal.body.act_id(),
            approval_signature,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::l1::census::Family;
    use crate::l1::handshake::StructuralBody;
    use crate::l1::identifier::NodeId;

    fn proposal(author: &str) -> Proposal {
        Proposal {
            body: StructuralBody {
                author: author.into(),
                seq: 1,
                family: Family::Opinion,
                middle: None,
                target: NodeId::parse("prof:bob").expect("ok"),
                p_d: 1.0,
                p_i: 1.0,
                settlement_ref: None,
                license: None,
                asserted_parents: vec![],
            },
            payload: b"hello".to_vec(),
            deps: vec![],
        }
    }

    /// A minimal in-test host: verifies nothing (host checks are the
    /// stand-in's job, tested there), just salts, commits, and seals —
    /// enough to exercise the client-side verification branches.
    fn seal(pre: &PreSignedProposal, host: &SigningKey) -> VerifiedAct {
        let content_salt = vec![1u8; crypto::SALT_LEN];
        let deps_salt = vec![2u8; crypto::SALT_LEN];
        let content_commitment =
            crypto::commitment(tags::COMMIT_CONTENT, &content_salt, &pre.proposal.payload).to_vec();
        let deps_commitment = crypto::commitment(
            tags::COMMIT_DEPS,
            &deps_salt,
            &canonical_deps(&pre.proposal.deps),
        )
        .to_vec();
        let mut act = VerifiedAct {
            proposal: pre.proposal.clone(),
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
            content_salt,
            deps_salt,
            content_commitment,
            deps_commitment,
            host_seal: vec![],
        };
        act.host_seal = crypto::sign(host, tags::HOST_SEAL, &act.seal_msg());
        act
    }

    #[test]
    fn approve_happy_path() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let sealed = seal(&pre, &host);
        let witness = actor
            .approve(&pre, &sealed, host.verifying_key().as_bytes())
            .expect("approves");
        assert_eq!(witness.act_id, pre.proposal.body.act_id());
    }

    #[test]
    fn approve_rejects_altered_body() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let mut sealed = seal(&pre, &host);
        sealed.proposal.body.p_d = -1.0;
        assert!(
            actor
                .approve(&pre, &sealed, host.verifying_key().as_bytes())
                .is_err()
        );
    }

    #[test]
    fn approve_rejects_bad_seal() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let impostor = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let sealed = seal(&pre, &impostor);
        assert!(
            actor
                .approve(&pre, &sealed, host.verifying_key().as_bytes())
                .is_err()
        );
    }

    #[test]
    fn approve_rejects_wrong_commitment_opening() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let mut sealed = seal(&pre, &host);
        // Host swaps the salt after sealing: opening no longer matches.
        sealed.content_salt = vec![9u8; crypto::SALT_LEN];
        assert!(
            actor
                .approve(&pre, &sealed, host.verifying_key().as_bytes())
                .is_err()
        );
    }
}
