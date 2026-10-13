//! ´mod:module:device-lock´
//!
//! The device lock, format v1: one locked custody record sealed under a
//! key derived from a server-held secret (auth.md "Device lock").
//!
//! The derivation and sealing mirror the key-backup blob's ("Blob format
//! (v1)"): HKDF-SHA-256 then AES-256-GCM, with only the input key material
//! and the info string differing. The one addition is the binding: every
//! record's associated data names the account, the record's kind and its
//! key, so a locked record cannot be moved into another account's slot or
//! swapped for another record. The variable-length binding fields are
//! length-framed exactly as [`super::crypto::sha256_tagged`] frames its
//! parts, so no two bindings share an associated-data string.
//!
//! This module is the reference the golden vectors pin; the clients lock
//! and unlock, and the server only mints and releases the secret.

use aes_gcm::aead::{Aead, Payload};
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use hkdf::Hkdf;
use rand::RngCore;
use rand::rngs::OsRng;
use sha2::Sha256;
use uuid::Uuid;

/// The server-held secret's length.
pub const SECRET_LEN: usize = 32;
pub const HKDF_SALT_LEN: usize = 16;
pub const AES_NONCE_LEN: usize = 12;
pub const HKDF_INFO: &[u8] = b"cogra:device-lock:v1";
const VERSION: u8 = 0x01;
/// The record's header — version, salt, nonce — which leads its
/// associated data.
pub const HEADER_LEN: usize = 1 + HKDF_SALT_LEN + AES_NONCE_LEN;

/// A record that will not open, or a malformed container.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum DeviceLockError {
    #[error("the record does not open under this lock and binding")]
    DoesNotOpen,
    #[error("unsupported device-lock version {0}")]
    Version(u8),
    #[error("malformed device-lock record")]
    Malformed,
}

/// Where a locked record belongs: its account, what kind of custody it
/// holds, and its name within that kind.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Binding<'a> {
    pub account: Uuid,
    pub kind: &'a str,
    pub key: &'a str,
}

/// A fresh server-side secret — the server's half of a lock.
pub fn generate_secret() -> [u8; SECRET_LEN] {
    let mut secret = [0u8; SECRET_LEN];
    OsRng.fill_bytes(&mut secret);
    secret
}

/// The lock key one lock event seals under: HKDF-SHA-256 over the secret
/// with the event's random salt.
pub fn lock_key(secret: &[u8; SECRET_LEN], salt: &[u8; HKDF_SALT_LEN]) -> [u8; 32] {
    let mut key = [0u8; 32];
    Hkdf::<Sha256>::new(Some(salt), secret)
        .expand(HKDF_INFO, &mut key)
        .expect("32 bytes is a valid HKDF-SHA-256 output length");
    key
}

/// The associated data a record seals under: its own header, then the
/// account's 16 bytes, then the kind and the key, each framed by its
/// big-endian u64 length.
pub fn associated_data(header: &[u8], binding: &Binding<'_>) -> Vec<u8> {
    let mut aad = header.to_vec();
    aad.extend_from_slice(binding.account.as_bytes());
    for part in [binding.kind.as_bytes(), binding.key.as_bytes()] {
        aad.extend_from_slice(&(part.len() as u64).to_be_bytes());
        aad.extend_from_slice(part);
    }
    aad
}

/// Seals one record with the given salt and nonce — the deterministic form
/// the golden vectors pin. The record is `version 0x01 ‖ salt ‖ nonce ‖
/// ciphertext`.
pub fn seal_with(
    secret: &[u8; SECRET_LEN],
    salt: &[u8; HKDF_SALT_LEN],
    nonce: &[u8; AES_NONCE_LEN],
    binding: &Binding<'_>,
    plaintext: &[u8],
) -> Vec<u8> {
    let mut record = vec![VERSION];
    record.extend_from_slice(salt);
    record.extend_from_slice(nonce);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&lock_key(secret, salt)));
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(nonce),
            Payload {
                msg: plaintext,
                aad: &associated_data(&record, binding),
            },
        )
        .expect("AES-GCM encrypts");
    record.extend_from_slice(&ciphertext);
    record
}

/// Opens one record under its lock and binding. A failing GCM tag — wrong
/// secret, wrong binding, or a tampered record — refuses.
pub fn open(
    secret: &[u8; SECRET_LEN],
    record: &[u8],
    binding: &Binding<'_>,
) -> Result<Vec<u8>, DeviceLockError> {
    if record.len() <= HEADER_LEN {
        return Err(DeviceLockError::Malformed);
    }
    if record[0] != VERSION {
        return Err(DeviceLockError::Version(record[0]));
    }
    let salt: &[u8; HKDF_SALT_LEN] = record[1..1 + HKDF_SALT_LEN]
        .try_into()
        .expect("the header holds a salt");
    let nonce = &record[1 + HKDF_SALT_LEN..HEADER_LEN];
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&lock_key(secret, salt)));
    cipher
        .decrypt(
            Nonce::from_slice(nonce),
            Payload {
                msg: &record[HEADER_LEN..],
                aad: &associated_data(&record[..HEADER_LEN], binding),
            },
        )
        .map_err(|_| DeviceLockError::DoesNotOpen)
}

#[cfg(test)]
mod tests {
    use super::*;

    const ACCOUNT: Uuid = Uuid::from_bytes([0x11; 16]);

    fn binding<'a>(kind: &'a str, key: &'a str) -> Binding<'a> {
        Binding {
            account: ACCOUNT,
            kind,
            key,
        }
    }

    fn sealed(secret: &[u8; SECRET_LEN]) -> Vec<u8> {
        seal_with(
            secret,
            &[5u8; HKDF_SALT_LEN],
            &[6u8; AES_NONCE_LEN],
            &binding("identity", "actor"),
            b"seed bytes",
        )
    }

    /// A record locked under a secret opens back to itself under that secret and the same binding.
    /// ´claim:custody:a-locked-record-opens-under-its-own-lock´
    #[test]
    fn device_lock_round_trips() {
        let secret = generate_secret();
        let record = sealed(&secret);
        assert_eq!(
            open(&secret, &record, &binding("identity", "actor")).expect("opens"),
            b"seed bytes"
        );
    }

    /// Without the server's secret the record is ciphertext only: another
    /// secret refuses exactly as a tampered tag does.
    ///
    /// A locked record does not open under any other secret.
    /// ´claim:custody:another-secret-does-not-open-a-record´
    #[test]
    fn another_secret_does_not_open() {
        let record = sealed(&generate_secret());
        assert_eq!(
            open(&generate_secret(), &record, &binding("identity", "actor")),
            Err(DeviceLockError::DoesNotOpen)
        );
    }

    /// The binding rides as associated data: the same bytes under another
    /// account, another kind, or another key refuse — including the
    /// split a bare concatenation would have confused.
    ///
    /// A locked record opens only in its own account's slot, as its own kind and key.
    /// ´claim:custody:a-record-is-bound-to-its-account-and-record´
    #[test]
    fn lock_ciphertext_is_bound_to_its_account_and_record() {
        let secret = generate_secret();
        let record = sealed(&secret);
        let other_account = Binding {
            account: Uuid::from_bytes([0x22; 16]),
            kind: "identity",
            key: "actor",
        };
        for wrong in [
            other_account,
            binding("draft", "actor"),
            binding("identity", "draft"),
            binding("identityac", "tor"),
        ] {
            assert_eq!(
                open(&secret, &record, &wrong),
                Err(DeviceLockError::DoesNotOpen),
                "{wrong:?}"
            );
        }
    }

    /// The header rides as associated data and the ciphertext is sealed,
    /// so a flipped bit anywhere refuses; an unsupported version and a
    /// truncation are told apart from that refusal.
    ///
    /// A flipped bit anywhere in a locked record refuses to open, and a bad version or a truncation is told apart from that refusal.
    /// ´claim:custody:a-flipped-bit-anywhere-refuses-to-open´
    #[test]
    fn a_tampered_lock_record_refuses() {
        let secret = generate_secret();
        let record = sealed(&secret);
        let at = binding("identity", "actor");
        for index in [2usize, 20, record.len() - 1] {
            let mut tampered = record.clone();
            tampered[index] ^= 1;
            assert_eq!(
                open(&secret, &tampered, &at),
                Err(DeviceLockError::DoesNotOpen)
            );
        }
        let mut wrong_version = record.clone();
        wrong_version[0] = 0x02;
        assert_eq!(
            open(&secret, &wrong_version, &at),
            Err(DeviceLockError::Version(0x02))
        );
        assert_eq!(
            open(&secret, &record[..HEADER_LEN], &at),
            Err(DeviceLockError::Malformed)
        );
    }

    /// The lock key is the device lock's own: the same input key material
    /// under the key backup's info string derives a different key, so
    /// neither format's ciphertext can stand in for the other's.
    ///
    /// The device lock derives under its own info string, apart from the key backup's.
    /// ´claim:custody:the-lock-key-is-domain-separated´
    #[test]
    fn the_lock_key_is_domain_separated_from_the_key_backup() {
        let secret = [9u8; SECRET_LEN];
        let salt = [5u8; HKDF_SALT_LEN];
        let mut backup_key = [0u8; 32];
        Hkdf::<Sha256>::new(Some(&salt), &secret)
            .expand(super::super::key_backup::HKDF_INFO, &mut backup_key)
            .expect("32 bytes");
        assert_ne!(lock_key(&secret, &salt), backup_key);
    }
}
