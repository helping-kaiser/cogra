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

/// How many characters a code's display form carries: 16 bytes is 128
/// bits, and Crockford packs five bits per character.
pub const DISPLAY_LEN: usize = 26;

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

/// Why a typed recovery code is not one.
///
/// The length case is separated because it is the only refusal a reader
/// can act on: characters are missing or spare. Every other rejection of
/// a full-length input is a code that will not open, which is what the
/// GCM tag would have said a moment later.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum RecoveryCodeError {
    #[error("a recovery code has {DISPLAY_LEN} characters")]
    Length,
    #[error("invalid recovery-code character `{0}`")]
    Character(char),
    #[error("invalid recovery code")]
    PadBits,
}

/// Whether a character is transcription noise rather than part of the
/// code: the display's own grouping hyphen, anything Unicode gives the
/// `White_Space` property, and the byte-order mark a paste out of a
/// document carries.
///
/// ENUMERATED, NOT DELEGATED. No two of the three languages that read a
/// typed code spell "whitespace" the same way: Rust's
/// [`char::is_whitespace`] is exactly `White_Space`; Kotlin's
/// `Char.isWhitespace` adds U+001C–U+001F and drops U+0085; JavaScript's
/// `\s` drops U+0085 and adds U+FEFF. Left to each language's built-in
/// predicate, the three parsers agree only over the characters anyone has
/// happened to type. The reference picks `White_Space` ∪ {U+FEFF}, the
/// clients spell that set out, and `recoveryCodeInputs` pins it.
fn is_separator(c: char) -> bool {
    c == '-' || c == '\u{feff}' || c.is_whitespace()
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
        debug_assert_eq!(
            chars.len(),
            DISPLAY_LEN,
            "16 code bytes encode to 26 characters"
        );
        [
            &chars[0..5],
            &chars[5..10],
            &chars[10..15],
            &chars[15..20],
            &chars[20..26],
        ]
        .join("-")
    }

    /// The reading rule for anything a person typed or pasted: separators
    /// dropped, case folded up, and the three characters Crockford leaves
    /// out of its alphabet mapped to the digits they are mistaken for.
    ///
    /// Applies to a fragment as much as to a whole code, which is what
    /// lets a write-it-down confirmation compare a partial entry against
    /// the code on screen.
    pub fn normalize(input: &str) -> String {
        input
            .chars()
            .filter(|c| !is_separator(*c))
            .flat_map(char::to_uppercase)
            .map(|c| match c {
                'I' | 'L' => '1',
                'O' => '0',
                other => other,
            })
            .collect()
    }

    /// Parses user input under [`normalize`]. No check digit — AES-GCM's
    /// tag is what detects a mistyped code, at unlock.
    ///
    /// The trailing pad bits are checked because 26 characters carry 130
    /// bits and the code is 128: a code whose last two bits are set is
    /// one no encoder could have produced, so refusing it here names the
    /// typo instead of letting it read as a wrong code.
    ///
    /// [`normalize`]: RecoveryCode::normalize
    pub fn from_input(input: &str) -> Result<Self, RecoveryCodeError> {
        let normalized = Self::normalize(input);
        if normalized.chars().count() != DISPLAY_LEN {
            return Err(RecoveryCodeError::Length);
        }
        let mut bits: u64 = 0;
        let mut nbits: u32 = 0;
        let mut out = [0u8; CODE_LEN];
        let mut at = 0;
        for c in normalized.chars() {
            let value = CROCKFORD
                .iter()
                .position(|a| char::from(*a) == c)
                .ok_or(RecoveryCodeError::Character(c))? as u64;
            bits = (bits << 5) | value;
            nbits += 5;
            if nbits >= 8 {
                nbits -= 8;
                out[at] = ((bits >> nbits) & 0xFF) as u8;
                at += 1;
            }
        }
        if bits & ((1 << nbits) - 1) != 0 {
            return Err(RecoveryCodeError::PadBits);
        }
        Ok(Self(out))
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

    /// A code read off a screen and typed back comes back as itself,
    /// whatever a reader did to the spacing or the case.
    ///
    /// A displayed recovery code parses back to its own bytes however it was transcribed.
    /// ´claim:backup:a-displayed-code-parses-back-to-its-bytes´
    #[test]
    fn a_typed_code_round_trips_through_normalization() {
        let code = RecoveryCode::from_bytes([0x5Au8; CODE_LEN]);
        let display = code.display();
        for transcription in [
            display.clone(),
            display.to_lowercase(),
            display.replace('-', ""),
            display.replace('-', " "),
            display.replace('-', "\u{a0}"),
            display.replace('-', "\u{2003}"),
            display.replace('-', "\u{85}"),
            display.replace('-', "\t\n"),
            format!("\u{feff}{display}"),
        ] {
            assert_eq!(
                RecoveryCode::from_input(&transcription)
                    .unwrap_or_else(|e| panic!("{transcription:?}: {e}"))
                    .bytes(),
                code.bytes(),
                "{transcription:?}"
            );
        }
    }

    /// The substitutions Crockford's alphabet exists for: `I`, `L` and `O`
    /// are not in it precisely because a reader confuses them with `1` and
    /// `0`, so a code typed with them reads as the digits.
    ///
    /// A code typed with the letters Crockford omits reads as the digits they are mistaken for.
    /// ´claim:backup:the-omitted-letters-read-as-their-digits´
    #[test]
    fn the_crockford_substitutions_apply() {
        assert_eq!(RecoveryCode::normalize("iIlLoO"), "111100");
        assert_eq!(RecoveryCode::normalize("a-b c\u{a0}d"), "ABCD");
    }

    /// A separator class delegated to each language's built-in predicate
    /// would agree only over the characters anyone had typed. U+001C is
    /// the concrete divergence: Kotlin calls it whitespace and Unicode
    /// does not, so the reference has to say which answer is the contract.
    ///
    /// The separator class is the one the reference states, not whatever a language calls whitespace.
    /// ´claim:backup:the-separator-class-is-the-reference-s´
    #[test]
    fn the_separator_class_is_stated_rather_than_inherited() {
        let squashed = RecoveryCode::from_bytes([0x5Au8; CODE_LEN])
            .display()
            .replace('-', "");
        assert_eq!(
            RecoveryCode::from_input(&format!("{}\u{1c}", &squashed[..squashed.len() - 1])).err(),
            Some(RecoveryCodeError::Character('\u{1c}')),
            "a unit separator is not white space, so it reaches the alphabet"
        );
        assert!(is_separator('\u{feff}'), "a pasted byte-order mark is");
    }

    /// The two refusals a full-length input can carry, told apart from the
    /// one a reader can act on.
    ///
    /// A recovery code refuses a wrong length, an unusable character, and set pad bits, each by name.
    /// ´claim:backup:a-recovery-code-refuses-by-name´
    #[test]
    fn a_malformed_code_refuses_by_name() {
        let squashed = RecoveryCode::from_bytes([0u8; CODE_LEN])
            .display()
            .replace('-', "");
        let refusal = |input: &str| RecoveryCode::from_input(input).err();
        assert_eq!(refusal(""), Some(RecoveryCodeError::Length));
        assert_eq!(
            refusal(&squashed[..squashed.len() - 1]),
            Some(RecoveryCodeError::Length)
        );
        assert_eq!(
            refusal(&format!("{squashed}0")),
            Some(RecoveryCodeError::Length)
        );
        assert_eq!(
            refusal(&squashed.replace('0', "U")),
            Some(RecoveryCodeError::Character('U')),
            "U is deliberately outside Crockford's alphabet"
        );
        assert_eq!(
            refusal(&format!("{}1", &squashed[..squashed.len() - 1])),
            Some(RecoveryCodeError::PadBits),
            "26 characters carry 130 bits and the code is 128"
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
