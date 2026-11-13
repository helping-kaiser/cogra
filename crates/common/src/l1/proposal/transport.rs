//! ´mod:module:transport´
//!
//! Transport encodings of the handshake objects that cross the API: the
//! pre-commitment blob the device submits as the opaque `signature` input,
//! and the sealed verified act it approves. The proposal itself travels as
//! [`crate::l1::wire::encode_proposal`] has it; nothing about it changes.
//!
//! Each envelope opens with its version before its arity is judged, so a
//! frame of another version is refused as that version rather than as a
//! malformed frame. The sealed act carries no payload and no nonce: the
//! device holds those itself.

use super::{SealedAct, VerifiedAct};
use crate::l1::encoding::{Decoder, Encoder};
use crate::l1::wire::{WireError, decode_body};

const WIRE_VERSION: u64 = 2;

fn open(d: &mut Decoder, arity: u64, what: &'static str) -> Result<(), WireError> {
    let n = d.array()?;
    let version = d.uint()?;
    if version != WIRE_VERSION {
        return Err(WireError::Version(version));
    }
    if n != arity {
        return Err(WireError::Shape(what));
    }
    Ok(())
}

/// The device's pre-commitment leg, as `ProposalSignatureInput.signature`
/// carries it: `[2, content nonce, dependency nonce, pre-signature]`. The
/// author's key never rides it — the backend binds the key from the
/// account's identity association.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PreCommitmentBlob {
    pub content_nonce: Vec<u8>,
    pub dependency_nonce: Vec<u8>,
    pub pre_signature: Vec<u8>,
}

impl PreCommitmentBlob {
    pub fn encode(&self) -> Vec<u8> {
        let mut e = Encoder::new();
        e.array(4);
        e.uint(WIRE_VERSION);
        e.bytes(&self.content_nonce);
        e.bytes(&self.dependency_nonce);
        e.bytes(&self.pre_signature);
        e.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, WireError> {
        let mut d = Decoder::new(bytes);
        open(&mut d, 4, "pre-commitment")?;
        let blob = Self {
            content_nonce: d.bytes()?,
            dependency_nonce: d.bytes()?,
            pre_signature: d.bytes()?,
        };
        d.finish()?;
        Ok(blob)
    }
}

impl super::PreSigned {
    pub fn pre_commitment_blob(&self) -> PreCommitmentBlob {
        PreCommitmentBlob {
            content_nonce: self.content_nonce.clone(),
            dependency_nonce: self.dependency_nonce.clone(),
            pre_signature: self.pre_signature.clone(),
        }
    }
}

impl SealedAct {
    /// The sealed act, as `StagedWrite.verifiedAct` carries it — every
    /// host-added field visible to the device before approval (realization
    /// transparency, §8.2): `[2, body, P, pre-signature, C_c, C_d, content
    /// edition, dependency edition, content salt, dependency salt, seal]`.
    pub fn encode(&self) -> Vec<u8> {
        let act = &self.act;
        let mut e = Encoder::new();
        e.array(11);
        e.uint(WIRE_VERSION);
        e.bytes(&act.body.canonical_bytes());
        e.bytes(&act.pre_commitment);
        e.bytes(&act.pre_signature);
        e.bytes(&act.content_commitment);
        e.bytes(&act.dependency_commitment);
        e.uint(act.content_edition);
        e.uint(act.dependency_edition);
        e.bytes(&self.content_salt);
        e.bytes(&self.dependency_salt);
        e.bytes(&self.host_seal);
        e.finish()
    }

    pub fn decode(bytes: &[u8]) -> Result<Self, WireError> {
        let mut d = Decoder::new(bytes);
        open(&mut d, 11, "verified act")?;
        let sealed = Self {
            act: VerifiedAct {
                body: decode_body(&d.bytes()?)?,
                pre_commitment: d.bytes()?,
                pre_signature: d.bytes()?,
                content_commitment: d.bytes()?,
                dependency_commitment: d.bytes()?,
                content_edition: d.uint()?,
                dependency_edition: d.uint()?,
            },
            content_salt: d.bytes()?,
            dependency_salt: d.bytes()?,
            host_seal: d.bytes()?,
        };
        d.finish()?;
        Ok(sealed)
    }
}
