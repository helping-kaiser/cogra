//! ´mod:module:client´
//!
//! The client (device) side of the admission handshake: client-signed,
//! backend-relayed (layer1-interface.md §8.2; substrate.md §6).
//!
//! Used by the dev CLI, the bootstrap's custodied system actors, and tests.
//! The Android client re-implements the same steps on-device from slice 1
//! on.

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

    /// Step 2 of the write — pre-sign: bind the exact proposal under a fresh
    /// private nonce, forming the proposal pre-commitment of
    /// layer1-interface.md §8.2.
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
    /// witness (layer1-interface.md §8.2). `sent` is the proposal the client
    /// pre-signed; the check is exact equality against what the host
    /// returned.
    ///
    /// The equality check comes first for a reason: it is what lets both
    /// commitment openings recompute from the returned salts and the bytes
    /// the client itself holds, those bytes being the sealed act's own.
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
        self.verify_host_additions(sealed, host_pubkey)?;
        Ok(self.sign_approval(sealed))
    }

    /// Crash-recovery approve, for custody-held keys (the genesis
    /// bootstrap): step 4 over an act this key sealed in an earlier run,
    /// whose in-memory pre-signed proposal is gone. Authorship is proven
    /// instead of matched — the stored pre-commitment must verify under
    /// this very key over the act's own bytes and nonce — then the host
    /// seal and both commitment openings are checked as in `approve`. The
    /// caller confirms the act is the one it means to approve; this
    /// method proves it is authentically this key's own sealed act.
    pub fn approve_recovered(
        &self,
        sealed: &VerifiedAct,
        host_pubkey: &[u8],
    ) -> Result<ApprovalWitness, L1Error> {
        let body = &sealed.proposal.body;
        if body.author != self.address() {
            return Err(L1Error::Authentication(
                "the sealed act is not this actor's".into(),
            ));
        }
        let digest_content = crypto::pre_digest(
            tags::PRE_DIGEST_CONTENT,
            &sealed.nonce,
            &sealed.proposal.payload,
        );
        let digest_deps = crypto::pre_digest(
            tags::PRE_DIGEST_DEPS,
            &sealed.nonce,
            &canonical_deps(&sealed.proposal.deps),
        );
        let msg = pre_commitment_msg(body, &digest_content, &digest_deps);
        if !crypto::verify(
            &self.key.verifying_key(),
            tags::PRE_COMMITMENT,
            &msg,
            &sealed.pre_signature,
        ) {
            return Err(L1Error::Authentication(
                "the stored pre-commitment is not this key's signature over the act".into(),
            ));
        }
        self.verify_host_additions(sealed, host_pubkey)?;
        Ok(self.sign_approval(sealed))
    }

    /// The host-added parts of a sealed act: the host seal over the exact
    /// sealed message, and both commitment openings against the act's
    /// payload and dependency bytes.
    fn verify_host_additions(
        &self,
        sealed: &VerifiedAct,
        host_pubkey: &[u8],
    ) -> Result<(), L1Error> {
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
        let content = crypto::commitment(
            tags::COMMIT_CONTENT,
            &sealed.content_salt,
            &sealed.proposal.payload,
        );
        if content.as_slice() != sealed.content_commitment.as_slice() {
            return Err(L1Error::Authentication(
                "content commitment does not open over the payload".into(),
            ));
        }
        let deps = crypto::commitment(
            tags::COMMIT_DEPS,
            &sealed.deps_salt,
            &canonical_deps(&sealed.proposal.deps),
        );
        if deps.as_slice() != sealed.deps_commitment.as_slice() {
            return Err(L1Error::Authentication(
                "dependency commitment does not open over the dependency list".into(),
            ));
        }
        Ok(())
    }

    fn sign_approval(&self, sealed: &VerifiedAct) -> ApprovalWitness {
        ApprovalWitness {
            act_id: sealed.proposal.body.act_id(),
            approval_signature: crypto::sign(&self.key, tags::APPROVAL, &sealed.seal_msg()),
        }
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

    /// An approval names the act it was made for, and the witness carries that name.
    /// ´claim:client:an-approval-names-the-act-it-was-made-for´
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

    /// A body altered after pre-signing fails approval.
    /// ´claim:client:a-body-altered-after-pre-signing-fails-approval´
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

    /// A seal made by a key that is not the host's fails approval.
    /// ´claim:client:a-seal-from-the-wrong-key-fails-approval´
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

    /// A host that swaps a salt after sealing leaves an opening the client
    /// can no longer recompute.
    ///
    /// An opening the client cannot recompute fails approval.
    /// ´claim:client:an-opening-the-client-cannot-recompute-fails-approval´
    #[test]
    fn approve_rejects_wrong_commitment_opening() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let mut sealed = seal(&pre, &host);
        sealed.content_salt = vec![9u8; crypto::SALT_LEN];
        assert!(
            actor
                .approve(&pre, &sealed, host.verifying_key().as_bytes())
                .is_err()
        );
    }

    /// Recovery works from the sealed act alone, without the pre-signed
    /// proposal, and signs the very same message the ordinary step 4 does.
    ///
    /// Recovery signs the very message the ordinary step signs, from the sealed act alone.
    /// ´claim:client:recovery-signs-the-same-message-from-the-sealed-act-alone´
    #[test]
    fn approve_recovered_happy_path() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let sealed = seal(&pre, &host);
        let witness = actor
            .approve_recovered(&sealed, host.verifying_key().as_bytes())
            .expect("approves");
        assert_eq!(witness.act_id, sealed.proposal.body.act_id());
        let ordinary = actor
            .approve(&pre, &sealed, host.verifying_key().as_bytes())
            .expect("approves");
        assert_eq!(witness.approval_signature, ordinary.approval_signature);
    }

    /// Recovery proves authorship rather than matching it, so nothing this key did not author can be recovered.
    /// ´claim:client:recovery-proves-authorship-rather-than-matching-it´
    #[test]
    fn approve_recovered_rejects_a_foreign_act() {
        let actor = ActorKey::generate();
        let other = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = other.pre_sign(proposal(&other.address()));
        let sealed = seal(&pre, &host);
        assert!(
            actor
                .approve_recovered(&sealed, host.verifying_key().as_bytes())
                .is_err()
        );
    }

    /// Recovery proves authorship instead of matching it, so a payload this
    /// key never pre-signed fails the proof.
    ///
    /// (´claim:client:recovery-proves-authorship-rather-than-matching-it´)
    #[test]
    fn approve_recovered_rejects_a_tampered_payload() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let mut sealed = seal(&pre, &host);
        sealed.proposal.payload = b"tampered".to_vec();
        assert!(
            actor
                .approve_recovered(&sealed, host.verifying_key().as_bytes())
                .is_err()
        );
    }

    /// The same on the recovery path, which reads the host key no differently.
    ///
    /// (´claim:client:a-seal-from-the-wrong-key-fails-approval´)
    #[test]
    fn approve_recovered_rejects_a_bad_seal() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let impostor = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let sealed = seal(&pre, &impostor);
        assert!(
            actor
                .approve_recovered(&sealed, host.verifying_key().as_bytes())
                .is_err()
        );
    }

    /// And the same opening, which recovery must recompute just as approval does.
    ///
    /// (´claim:client:an-opening-the-client-cannot-recompute-fails-approval´)
    #[test]
    fn approve_recovered_rejects_a_wrong_commitment_opening() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let mut sealed = seal(&pre, &host);
        sealed.content_salt = vec![9u8; crypto::SALT_LEN];
        assert!(
            actor
                .approve_recovered(&sealed, host.verifying_key().as_bytes())
                .is_err()
        );
    }
}
