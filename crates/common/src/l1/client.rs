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

use super::crypto;
use super::handshake::{
    ApprovalWitness, EDITION, PreSignedProposal, Proposal, VerifiedAct, content_commitment,
    deps_commitment, pre_commitment,
};

/// What the client can find wrong with what the host returned.
///
/// Every check this module performs is an authentication question — the
/// returned act is the one that was pre-signed, the host seal verifies, both
/// commitments open — so the error carries the one variant those checks
/// produce. The substrate's own failure vocabulary belongs to the substrate
/// and its boundary, not here.
#[derive(Debug, thiserror::Error)]
pub enum ClientError {
    #[error("authentication failure: {0}")]
    Authentication(String),
}

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

    /// The actor's address atom (stand-in convention).
    pub fn address(&self) -> String {
        crypto::address_of(&self.key.verifying_key())
    }

    /// Step 2 of the write — pre-sign: bind the exact proposal under a fresh
    /// private nonce, forming the proposal pre-commitment of
    /// layer1-interface.md §8.2, and sign those 32 bytes.
    pub fn pre_sign(&self, proposal: Proposal) -> PreSignedProposal {
        let mut nonce = vec![0u8; crypto::SALT_LEN];
        OsRng.fill_bytes(&mut nonce);
        let pre_signature = crypto::sign_digest(&self.key, &pre_commitment(&proposal, &nonce));
        PreSignedProposal {
            proposal,
            author_pubkey: self.public_key_bytes(),
            nonce,
            pre_signature,
        }
    }

    /// Step 4 of the write — approve: verify the exact returned act, the
    /// pre-commitment and the editions, the host seal, and both commitment
    /// openings, then sign the approval witness over the verified act and
    /// its seal (layer1-interface.md §8.2, "Approval witness").
    /// `sent` is the proposal the client pre-signed; the check is exact
    /// equality against what the host returned.
    ///
    /// The equality check comes first for a reason: it is what lets both
    /// commitment openings recompute from the returned salts and the bytes
    /// the client itself holds, those bytes being the sealed act's own.
    pub fn approve(
        &self,
        sent: &PreSignedProposal,
        sealed: &VerifiedAct,
        host_pubkey: &[u8],
    ) -> Result<ApprovalWitness, ClientError> {
        if sealed.proposal != sent.proposal
            || sealed.pre_signature != sent.pre_signature
            || sealed.nonce != sent.nonce
        {
            return Err(ClientError::Authentication(
                "host returned a different act than was pre-signed".into(),
            ));
        }
        if sealed.pre_commitment.as_slice() != sent.pre_commitment().as_slice() {
            return Err(ClientError::Authentication(
                "host returned a different pre-commitment than was formed".into(),
            ));
        }
        self.verify_host_additions(sealed, host_pubkey)?;
        Ok(self.sign_approval(sealed))
    }

    /// Crash-recovery approve, for custody-held keys (the genesis
    /// bootstrap): step 4 over an act this key sealed in an earlier run,
    /// whose in-memory pre-signed proposal is gone. Authorship is proven
    /// instead of matched — the pre-commitment recomputed from the act's
    /// own bytes and nonce must equal the stored one, and the stored
    /// pre-signature must verify under this very key over it — then the
    /// editions, the host seal and both commitment openings are checked as
    /// in `approve`. The caller confirms the act is the one it means to
    /// approve; this method proves it is authentically this key's own
    /// sealed act.
    pub fn approve_recovered(
        &self,
        sealed: &VerifiedAct,
        host_pubkey: &[u8],
    ) -> Result<ApprovalWitness, ClientError> {
        if sealed.proposal.body.author != self.address() {
            return Err(ClientError::Authentication(
                "the sealed act is not this actor's".into(),
            ));
        }
        let formed = pre_commitment(&sealed.proposal, &sealed.nonce);
        if sealed.pre_commitment.as_slice() != formed.as_slice()
            || !crypto::verify_digest(&self.key.verifying_key(), &formed, &sealed.pre_signature)
        {
            return Err(ClientError::Authentication(
                "the stored pre-commitment is not this key's signature over the act".into(),
            ));
        }
        self.verify_host_additions(sealed, host_pubkey)?;
        Ok(self.sign_approval(sealed))
    }

    /// The host-added parts of a sealed act: the editions, the host seal
    /// over the encoded verified act, and both commitment openings against
    /// the act's payload and dependency bytes.
    fn verify_host_additions(
        &self,
        sealed: &VerifiedAct,
        host_pubkey: &[u8],
    ) -> Result<(), ClientError> {
        if sealed.content_edition != EDITION || sealed.deps_edition != EDITION {
            return Err(ClientError::Authentication(format!(
                "unexpected editions (content {}, dependencies {}); this device signs edition {EDITION}",
                sealed.content_edition, sealed.deps_edition
            )));
        }
        let host_key = crypto::verifying_key_from_bytes(host_pubkey)
            .ok_or_else(|| ClientError::Authentication("malformed host key".into()))?;
        if !crypto::verify(
            &host_key,
            crypto::tags::HOST_SEAL,
            &sealed.seal_msg(),
            &sealed.host_seal,
        ) {
            return Err(ClientError::Authentication("invalid host seal".into()));
        }
        let act_id = sealed.proposal.body.act_id();
        let content = content_commitment(
            &act_id,
            &sealed.pre_commitment,
            &sealed.content_salt,
            &sealed.proposal.payload,
        );
        if content.as_slice() != sealed.content_commitment.as_slice() {
            return Err(ClientError::Authentication(
                "content commitment does not open over the payload".into(),
            ));
        }
        let deps = deps_commitment(
            &act_id,
            &sealed.pre_commitment,
            &sealed.deps_salt,
            &sealed.proposal.deps,
        );
        if deps.as_slice() != sealed.deps_commitment.as_slice() {
            return Err(ClientError::Authentication(
                "dependency commitment does not open over the dependency list".into(),
            ));
        }
        Ok(())
    }

    fn sign_approval(&self, sealed: &VerifiedAct) -> ApprovalWitness {
        ApprovalWitness {
            act_id: sealed.proposal.body.act_id(),
            approval_signature: crypto::sign_digest(&self.key, &sealed.approval_digest()),
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
        seal_as(pre, host, pre.pre_commitment().to_vec(), EDITION)
    }

    /// The same host, sealing under a pre-commitment and an edition of the
    /// caller's choosing — every part consistent with them and the seal
    /// valid, so only the device's own pre-commitment and edition checks
    /// can refuse it.
    fn seal_as(
        pre: &PreSignedProposal,
        host: &SigningKey,
        pre_commitment: Vec<u8>,
        edition: u64,
    ) -> VerifiedAct {
        let act_id = pre.proposal.body.act_id();
        let content_salt = vec![1u8; crypto::SALT_LEN];
        let deps_salt = vec![2u8; crypto::SALT_LEN];
        let content_commitment = content_commitment(
            &act_id,
            &pre_commitment,
            &content_salt,
            &pre.proposal.payload,
        )
        .to_vec();
        let deps_commitment =
            deps_commitment(&act_id, &pre_commitment, &deps_salt, &pre.proposal.deps).to_vec();
        let mut act = VerifiedAct {
            proposal: pre.proposal.clone(),
            author_pubkey: pre.author_pubkey.clone(),
            nonce: pre.nonce.clone(),
            pre_signature: pre.pre_signature.clone(),
            pre_commitment,
            content_salt,
            deps_salt,
            content_commitment,
            deps_commitment,
            content_edition: edition,
            deps_edition: edition,
            host_seal: vec![],
        };
        act.host_seal = crypto::sign(host, crypto::tags::HOST_SEAL, &act.seal_msg());
        act
    }

    /// The pre-signature is the author's signature over the named 32-byte pre-commitment, and over nothing else.
    /// ´claim:client:the-pre-signature-verifies-over-the-named-pre-commitment´
    #[test]
    fn the_pre_signature_verifies_over_the_named_pre_commitment() {
        let actor = ActorKey::generate();
        let pre = actor.pre_sign(proposal(&actor.address()));
        let key = crypto::verifying_key_from_bytes(&pre.author_pubkey).expect("key");
        assert!(crypto::verify_digest(
            &key,
            &pre.pre_commitment(),
            &pre.pre_signature
        ));
        let mut other = pre.proposal.clone();
        other.payload = b"another payload".to_vec();
        assert!(!crypto::verify_digest(
            &key,
            &pre_commitment(&other, &pre.nonce),
            &pre.pre_signature
        ));
    }

    /// A verified act sealed over a pre-commitment the device did not form is refused before any approval is signed, even when the host's seal and both openings hold.
    /// ´claim:client:a-foreign-pre-commitment-is-refused-before-approval´
    #[test]
    fn a_verified_act_whose_pre_commitment_differs_from_the_devices_is_refused_before_approval() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let sealed = seal_as(&pre, &host, vec![5u8; 32], EDITION);
        assert!(
            actor
                .approve(&pre, &sealed, host.verifying_key().as_bytes())
                .is_err()
        );
        assert!(
            actor
                .approve_recovered(&sealed, host.verifying_key().as_bytes())
                .is_err()
        );
    }

    /// A verified act under any edition but the expected one is refused before approval.
    /// ´claim:client:an-unexpected-edition-is-refused-before-approval´
    #[test]
    fn a_verified_act_with_an_unexpected_edition_is_refused_before_approval() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let sealed = seal_as(&pre, &host, pre.pre_commitment().to_vec(), EDITION + 1);
        assert!(
            actor
                .approve(&pre, &sealed, host.verifying_key().as_bytes())
                .is_err()
        );
        assert!(
            actor
                .approve_recovered(&sealed, host.verifying_key().as_bytes())
                .is_err()
        );
    }

    /// The approval witness signs the encoded verified act and its host seal together, so it verifies over that pair and over neither half alone.
    /// ´claim:client:the-approval-signs-the-verified-act-and-its-seal-together´
    #[test]
    fn the_approval_witness_signs_the_verified_act_and_its_host_seal_together() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let sealed = seal(&pre, &host);
        let witness = actor
            .approve(&pre, &sealed, host.verifying_key().as_bytes())
            .expect("approves");
        let key = crypto::verifying_key_from_bytes(&pre.author_pubkey).expect("key");
        assert!(crypto::verify_digest(
            &key,
            &crate::l1::handshake::approval_digest(&sealed.seal_msg(), &sealed.host_seal),
            &witness.approval_signature
        ));
        let mut reseal = sealed.clone();
        reseal.host_seal = crypto::sign(&host, b"another seal", &sealed.seal_msg());
        assert!(!crypto::verify_digest(
            &key,
            &reseal.approval_digest(),
            &witness.approval_signature
        ));
    }

    /// An approval over the verified act alone, without its seal, is not the witness.
    ///
    /// (´claim:client:the-approval-signs-the-verified-act-and-its-seal-together´)
    #[test]
    fn an_approval_over_the_verified_act_without_its_seal_does_not_verify() {
        let actor = ActorKey::generate();
        let host = SigningKey::generate(&mut OsRng);
        let pre = actor.pre_sign(proposal(&actor.address()));
        let sealed = seal(&pre, &host);
        let key = crypto::verifying_key_from_bytes(&pre.author_pubkey).expect("key");
        let seed = actor.seed();
        let signing = SigningKey::from_bytes(&seed);
        let unsealed = crypto::sign(&signing, crypto::tags::APPROVAL, &sealed.seal_msg());
        assert!(!crypto::verify_digest(
            &key,
            &sealed.approval_digest(),
            &unsealed
        ));
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
