//! ´mod:module:key-backup´
//!
//! The key-backup blob, format v1: the actor seed sealed under a generated
//! recovery code (auth.md "Blob format (v1)").
//!
//! One format across every client — this module is the reference the golden
//! vectors pin, and the bootstrap's operator-account seeding seals with it.

use aes_gcm::aead::{Aead, Payload};
use aes_gcm::{Aes256Gcm, Key, KeyInit, Nonce};
use ed25519_dalek::{SigningKey, VerifyingKey};
use hkdf::Hkdf;
use rand::RngCore;
use rand::rngs::OsRng;
use sha2::Sha256;

use super::crypto;
use super::encoding::{Decoder, Encoder};

pub const CODE_LEN: usize = 16;
pub const HKDF_SALT_LEN: usize = 16;
pub const AES_NONCE_LEN: usize = 12;
pub const HKDF_INFO: &[u8] = b"cogra:key-backup:v1";
/// Server-issued challenge length, matching the stand-in's entropy floor.
pub const CHALLENGE_LEN: usize = crypto::SALT_LEN;
/// The upload proof's domain tag. Storing a blob is an L2 operation, not
/// an L1 act, so it carries this module's `cogra:key-backup:*` prefix
/// rather than one of the `cogra-l1:` act tags.
pub const UPLOAD_PROOF_TAG: &[u8] = b"cogra:key-backup-upload:v1";
const VERSION: u8 = 0x01;
const HEADER_LEN: usize = 1 + HKDF_SALT_LEN + AES_NONCE_LEN;
const CROCKFORD: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/// A blob that will not open, or a malformed container.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum KeyBackupError {
    #[error("the blob does not open under this code")]
    DoesNotOpen,
    #[error("unsupported blob version {0}")]
    Version(u8),
    #[error("malformed blob container")]
    Malformed,
}

/// A 16-byte recovery code — generated, never user-chosen (auth.md
/// "Key recovery").
pub struct RecoveryCode([u8; CODE_LEN]);

impl RecoveryCode {
    pub fn generate() -> Self {
        let mut bytes = [0u8; CODE_LEN];
        OsRng.fill_bytes(&mut bytes);
        Self(bytes)
    }

    pub fn from_bytes(bytes: [u8; CODE_LEN]) -> Self {
        Self(bytes)
    }

    pub fn bytes(&self) -> &[u8; CODE_LEN] {
        &self.0
    }

    /// The display form: 26 Crockford characters grouped 5-5-5-5-6.
    pub fn display(&self) -> String {
        let mut bits: u32 = 0;
        let mut nbits: u32 = 0;
        let mut chars = String::new();
        for &b in &self.0 {
            bits = (bits << 8) | u32::from(b);
            nbits += 8;
            while nbits >= 5 {
                nbits -= 5;
                chars.push(char::from(CROCKFORD[((bits >> nbits) & 31) as usize]));
            }
        }
        if nbits > 0 {
            chars.push(char::from(CROCKFORD[((bits << (5 - nbits)) & 31) as usize]));
        }
        debug_assert_eq!(chars.len(), 26, "16 code bytes encode to 26 characters");
        [
            &chars[0..5],
            &chars[5..10],
            &chars[10..15],
            &chars[15..20],
            &chars[20..26],
        ]
        .join("-")
    }
}

fn content_key(code: &RecoveryCode, salt: &[u8]) -> [u8; 32] {
    let mut key = [0u8; 32];
    Hkdf::<Sha256>::new(Some(salt), code.bytes())
        .expand(HKDF_INFO, &mut key)
        .expect("32 bytes is a valid HKDF-SHA-256 output length");
    key
}

/// Seals the actor seed under the code with the given salt and nonce —
/// the deterministic form the golden vectors pin.
pub fn seal_with(
    seed: &[u8; 32],
    code: &RecoveryCode,
    salt: &[u8; HKDF_SALT_LEN],
    nonce: &[u8; AES_NONCE_LEN],
) -> Vec<u8> {
    let mut e = Encoder::new();
    e.array(2).bytes(seed).uint(1);
    let plaintext = e.finish();
    let mut blob = vec![VERSION];
    blob.extend_from_slice(salt);
    blob.extend_from_slice(nonce);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&content_key(code, salt)));
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(nonce),
            Payload {
                msg: &plaintext,
                aad: &blob,
            },
        )
        .expect("AES-GCM encrypts");
    blob.extend_from_slice(&ciphertext);
    blob
}

/// Seals under fresh randomness — the production form.
pub fn seal(seed: &[u8; 32], code: &RecoveryCode) -> Vec<u8> {
    let mut salt = [0u8; HKDF_SALT_LEN];
    let mut nonce = [0u8; AES_NONCE_LEN];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);
    seal_with(seed, code, &salt, &nonce)
}

/// Opens a blob with the code, returning the actor seed. A failing GCM
/// tag — mistyped code or tampered blob — refuses.
pub fn open(blob: &[u8], code: &RecoveryCode) -> Result<[u8; 32], KeyBackupError> {
    if blob.len() <= HEADER_LEN {
        return Err(KeyBackupError::Malformed);
    }
    if blob[0] != VERSION {
        return Err(KeyBackupError::Version(blob[0]));
    }
    let salt = &blob[1..1 + HKDF_SALT_LEN];
    let nonce = &blob[1 + HKDF_SALT_LEN..HEADER_LEN];
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&content_key(code, salt)));
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(nonce),
            Payload {
                msg: &blob[HEADER_LEN..],
                aad: &blob[..HEADER_LEN],
            },
        )
        .map_err(|_| KeyBackupError::DoesNotOpen)?;
    let mut d = Decoder::new(&plaintext);
    let seed = (|| {
        if d.array().ok()? != 2 {
            return None;
        }
        let seed: [u8; 32] = d.bytes().ok()?.try_into().ok()?;
        if d.uint().ok()? != 1 {
            return None;
        }
        d.finish().ok()?;
        Some(seed)
    })()
    .ok_or(KeyBackupError::Malformed)?;
    Ok(seed)
}

/// What the actor key signs to authorize an upload: the server's
/// challenge bound to the exact blob bytes, length-framed under the
/// upload tag. Binding the blob is what stops a captured signature from
/// authorizing different ciphertext; binding the challenge is what stops
/// the whole pair from being replayed.
fn upload_proof_msg(challenge: &[u8], blob: &[u8]) -> [u8; 32] {
    crypto::sha256_tagged(UPLOAD_PROOF_TAG, &[challenge, blob])
}

pub fn sign_upload(key: &SigningKey, challenge: &[u8], blob: &[u8]) -> Vec<u8> {
    crypto::sign(key, UPLOAD_PROOF_TAG, &upload_proof_msg(challenge, blob))
}

pub fn verify_upload(key: &VerifyingKey, challenge: &[u8], blob: &[u8], signature: &[u8]) -> bool {
    crypto::verify(
        key,
        UPLOAD_PROOF_TAG,
        &upload_proof_msg(challenge, blob),
        signature,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A seed sealed under a recovery code opens back to itself under that same code.
    /// ´claim:backup:a-sealed-seed-opens-under-its-own-code´
    #[test]
    fn seal_and_open_round_trip() {
        let seed = [7u8; 32];
        let code = RecoveryCode::generate();
        let blob = seal(&seed, &code);
        assert_eq!(open(&blob, &code).expect("opens"), seed);
    }

    /// A code that is not the sealing code does not open the blob.
    /// ´claim:backup:a-wrong-code-does-not-open-the-blob´
    #[test]
    fn a_wrong_code_does_not_open() {
        let blob = seal(&[7u8; 32], &RecoveryCode::generate());
        assert_eq!(
            open(&blob, &RecoveryCode::generate()),
            Err(KeyBackupError::DoesNotOpen)
        );
    }

    /// The header rides as associated data and the ciphertext is sealed, so a
    /// flipped bit anywhere refuses to open. An unsupported version and a
    /// truncated container are told apart from that refusal.
    ///
    /// A flipped bit anywhere in the container refuses to open, and a bad version or a truncation is told apart from that refusal.
    /// ´claim:backup:a-flipped-bit-anywhere-refuses-to-open´
    #[test]
    fn tampering_anywhere_refuses() {
        let code = RecoveryCode::generate();
        let blob = seal(&[7u8; 32], &code);
        for index in [2usize, blob.len() - 1] {
            let mut tampered = blob.clone();
            tampered[index] ^= 1;
            assert_eq!(open(&tampered, &code), Err(KeyBackupError::DoesNotOpen));
        }
        let mut wrong_version = blob.clone();
        wrong_version[0] = 0x02;
        assert_eq!(
            open(&wrong_version, &code),
            Err(KeyBackupError::Version(0x02))
        );
        assert_eq!(open(&blob[..10], &code), Err(KeyBackupError::Malformed));
    }

    /// A recovery code displays as grouped Crockford, which is what makes it readable back to a person.
    /// ´claim:backup:a-recovery-code-displays-as-grouped-crockford´
    #[test]
    fn display_is_grouped_crockford() {
        let display = RecoveryCode::generate().display();
        assert_eq!(display.len(), 30);
        assert_eq!(
            display.split('-').map(str::len).collect::<Vec<_>>(),
            [5, 5, 5, 5, 6]
        );
        assert!(
            display
                .chars()
                .all(|c| c == '-' || CROCKFORD.contains(&(c as u8)))
        );
    }

    /// Both bindings carry weight: a proof replayed against another
    /// challenge, one whose blob was swapped underneath it, and one from a
    /// different actor all fail to verify. Garbage signature bytes refuse
    /// rather than panic.
    ///
    /// An upload proof binds its challenge, its blob, and its actor, and garbage refuses rather than panics.
    /// ´claim:backup:an-upload-proof-binds-its-challenge-blob-and-actor´
    #[test]
    fn an_upload_proof_binds_both_the_challenge_and_the_blob() {
        let key = SigningKey::from_bytes(&[3u8; 32]);
        let challenge = [9u8; CHALLENGE_LEN];
        let blob = seal(&[7u8; 32], &RecoveryCode::generate());
        let signature = sign_upload(&key, &challenge, &blob);
        let public = key.verifying_key();

        assert!(verify_upload(&public, &challenge, &blob, &signature));
        assert!(!verify_upload(
            &public,
            &[8u8; CHALLENGE_LEN],
            &blob,
            &signature
        ));
        let other = seal(&[6u8; 32], &RecoveryCode::generate());
        assert!(!verify_upload(&public, &challenge, &other, &signature));
        let stranger = SigningKey::from_bytes(&[4u8; 32]);
        assert!(!verify_upload(
            &stranger.verifying_key(),
            &challenge,
            &blob,
            &signature
        ));
        assert!(!verify_upload(&public, &challenge, &blob, b"xx"));
    }

    /// The upload tag is separated from the act tags, so an upload proof can never verify as an approval.
    /// ´claim:backup:the-upload-tag-is-separated-from-the-act-tags´
    #[test]
    fn the_upload_tag_is_domain_separated_from_the_l1_act_tags() {
        let key = SigningKey::from_bytes(&[3u8; 32]);
        let msg = upload_proof_msg(&[9u8; CHALLENGE_LEN], b"blob");
        let signature = sign_upload(&key, &[9u8; CHALLENGE_LEN], b"blob");
        assert!(!crypto::verify(
            &key.verifying_key(),
            crypto::tags::APPROVAL,
            &msg,
            &signature
        ));
    }
}
