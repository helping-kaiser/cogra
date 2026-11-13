//! The device side of the handshake: pre-sign under two fresh nonces, and
//! approve only what the actor can recompute from its own held material
//! (§8.2, "Proposal pre-commitment" and "Approval witness").

use rand::RngCore;
use rand::rngs::OsRng;

use super::{
    CONTENT_EDITION, DEPENDENCY_EDITION, PreSigned, SealedAct, VerifiedAct, content_commitment,
    dependency_commitment,
};
use crate::l1::client::{ActorKey, ClientError};
use crate::l1::crypto;
use crate::l1::handshake::{ApprovalWitness, Proposal};

fn fresh_nonce() -> Vec<u8> {
    let mut nonce = vec![0u8; crypto::SALT_LEN];
    OsRng.fill_bytes(&mut nonce);
    nonce
}

fn refuse(why: &str) -> ClientError {
    ClientError::Authentication(why.into())
}

impl PreSigned {
    /// Step 2 of the write — pre-sign: draw the content nonce and the
    /// dependency nonce as two independent draws of [`crypto::SALT_LEN`]
    /// bytes from the OS generator, form P, and sign it.
    pub fn sign(key: &ActorKey, proposal: Proposal) -> Self {
        Self::sign_with_nonces(key, proposal, fresh_nonce(), fresh_nonce())
    }

    /// Pre-sign under nonces the caller supplies — for fixed vectors. A
    /// write draws them with [`PreSigned::sign`].
    pub fn sign_with_nonces(
        key: &ActorKey,
        proposal: Proposal,
        content_nonce: Vec<u8>,
        dependency_nonce: Vec<u8>,
    ) -> Self {
        let mut pre = Self {
            proposal,
            author_pubkey: key.public_key_bytes(),
            content_nonce,
            dependency_nonce,
            pre_signature: vec![],
        };
        pre.pre_signature = key.sign_digest(&pre.pre_commitment());
        pre
    }

    /// Crash recovery for a custody-held key: rebuild the pre-signed
    /// proposal from the proposal and both nonces the custodian kept, and
    /// the pre-signature the verified act carries. Authorship is proven,
    /// not matched — P recomputed from the held material must equal the
    /// act's, and the act's pre-signature must verify under this key over
    /// it. The result approves through [`PreSigned::approve`] like any
    /// other.
    pub fn recover(
        key: &ActorKey,
        proposal: Proposal,
        content_nonce: Vec<u8>,
        dependency_nonce: Vec<u8>,
        act: &VerifiedAct,
    ) -> Result<Self, ClientError> {
        if proposal.body.author != key.address() {
            return Err(refuse("the proposal is not this actor's"));
        }
        let pre = Self {
            proposal,
            author_pubkey: key.public_key_bytes(),
            content_nonce,
            dependency_nonce,
            pre_signature: act.pre_signature.clone(),
        };
        let formed = pre.pre_commitment();
        if act.pre_commitment.as_slice() != formed.as_slice()
            || !crypto::verify_digest(&key.verifying_key(), &formed, &act.pre_signature)
        {
            return Err(refuse(
                "the act's pre-commitment is not this key's signature over the held proposal",
            ));
        }
        Ok(pre)
    }

    /// Step 4 of the write — approve: the actor's checks of §8.2,
    /// "Approval witness", then the witness over the encoded verified act
    /// and its seal.
    ///
    /// Exact equality of the returned body, P and pre-signature with what
    /// was pre-signed; the editions; the host seal; and both commitments
    /// recomputed from material the device holds itself — C_c over its own
    /// content pre-digest from the payload and content nonce, C_d over its
    /// own canonical dependency encoding — with the returned salts. A
    /// commitment the host formed over anything else, the payload bytes
    /// included, does not recompute. The hyper-edge legs are census
    /// renderings of the one body, so body equality is their agreement.
    pub fn approve(
        &self,
        key: &ActorKey,
        sealed: &SealedAct,
        host_pubkey: &[u8],
    ) -> Result<ApprovalWitness, ClientError> {
        let act = &sealed.act;
        if act.body != self.proposal.body || act.pre_signature != self.pre_signature {
            return Err(refuse("host returned a different act than was pre-signed"));
        }
        let pre_commitment = self.pre_commitment();
        if act.pre_commitment.as_slice() != pre_commitment.as_slice() {
            return Err(refuse(
                "host returned a different pre-commitment than was formed",
            ));
        }
        if act.content_edition != CONTENT_EDITION || act.dependency_edition != DEPENDENCY_EDITION {
            return Err(ClientError::Authentication(format!(
                "unexpected editions (content {}, dependencies {}); this device signs content \
                 edition {CONTENT_EDITION} and dependency edition {DEPENDENCY_EDITION}",
                act.content_edition, act.dependency_edition
            )));
        }
        if !sealed.verify_seal(host_pubkey) {
            return Err(refuse("invalid host seal"));
        }
        let act_id = self.act_id();
        let content = content_commitment(
            &act_id,
            &pre_commitment,
            &sealed.content_salt,
            &self.content_pre_digest(),
        );
        if content.as_slice() != act.content_commitment.as_slice() {
            return Err(refuse(
                "content commitment is not formed over this device's content pre-digest",
            ));
        }
        let dependency = dependency_commitment(
            &act_id,
            &pre_commitment,
            &sealed.dependency_salt,
            &self.proposal.deps,
        );
        if dependency.as_slice() != act.dependency_commitment.as_slice() {
            return Err(refuse(
                "dependency commitment does not open over the dependency list",
            ));
        }
        Ok(ApprovalWitness {
            act_id,
            approval_signature: key.sign_digest(&sealed.approval_digest()),
        })
    }
}
