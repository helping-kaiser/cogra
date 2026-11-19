//! ´mod:module:client´
//!
//! The actor key, the signing side of the admission handshake:
//! client-signed, backend-relayed (layer1-interface.md §8.2; substrate.md
//! §6). The handshake steps the key performs are in
//! [`crate::l1::proposal`].

use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;

use super::crypto;

/// What the client can find wrong with what the host returned.
///
/// Every check the device performs is an authentication question — the
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

    pub(crate) fn sign_digest(&self, digest: &[u8; 32]) -> Vec<u8> {
        crypto::sign_digest(&self.key, digest)
    }

    pub(crate) fn verifying_key(&self) -> ed25519_dalek::VerifyingKey {
        self.key.verifying_key()
    }
}
