//! Password hashing — Argon2id with the crate's OWASP-tracking defaults
//! (auth.md "Password storage"). Plaintext is never persisted, logged, or
//! returned.

use argon2::Argon2;
use argon2::password_hash::{
    PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng,
};

use crate::auth::policy::MIN_PASSWORD_LEN;

#[derive(Debug, thiserror::Error)]
pub enum PasswordError {
    #[error("password must be at least {MIN_PASSWORD_LEN} characters")]
    TooShort,
    #[error("password hashing failed")]
    Hash,
}

/// Checks a plaintext password against the length floor without hashing it.
/// Callers run this before the expensive Argon2 hash so an over-short — or
/// otherwise unacceptable — submission is rejected without paying the hash
/// cost. Counts Unicode scalar values, not bytes, so the floor is a true
/// character count.
pub fn validate_length(plaintext: &str) -> Result<(), PasswordError> {
    if plaintext.chars().count() < MIN_PASSWORD_LEN {
        return Err(PasswordError::TooShort);
    }
    Ok(())
}

/// Hashes a plaintext password for storage. Rejects passwords below the
/// length floor before hashing.
pub fn hash_password(plaintext: &str) -> Result<String, PasswordError> {
    validate_length(plaintext)?;
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(plaintext.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| PasswordError::Hash)
}

/// A precomputed Argon2id PHC hash, used only as the verification target on
/// the "no such account" login path (see [`dummy_verify`]). Embedding it as a
/// constant keeps `dummy_verify` infallible — there is no runtime hash to fail.
/// Its encoded params track `Argon2::default()`; the `dummy_hash_tracks_*`
/// tests fail if the crate's defaults drift away from it.
const DUMMY_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$oYy7096Insv9ozgmYftknw$+RcBmWNKSTDI1SmihS85B+5vbX/oZJqWOJY6LLk7UA4";

/// Runs a verification against a fixed dummy hash and discards the result.
/// Called on the "no such account" login path so response timing is the same
/// whether or not the email exists — closing the account-enumeration channel
/// that a fast no-account rejection would open.
pub fn dummy_verify(plaintext: &str) {
    let _ = verify_password(DUMMY_HASH, plaintext);
}

/// Verifies a plaintext password against a stored hash. Returns `false` on
/// mismatch or an unparseable hash — never an error that distinguishes the
/// two, so callers can't leak which accounts exist.
pub fn verify_password(stored_hash: &str, plaintext: &str) -> bool {
    match PasswordHash::new(stored_hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(plaintext.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_then_verify_roundtrips() {
        let hash = hash_password("correct horse battery").expect("hashes");
        assert!(verify_password(&hash, "correct horse battery"));
        assert!(!verify_password(&hash, "wrong password here"));
    }

    #[test]
    fn rejects_short_passwords() {
        assert!(matches!(
            hash_password("short"),
            Err(PasswordError::TooShort)
        ));
    }

    #[test]
    fn length_floor_counts_characters_not_bytes() {
        // 11 accented characters: 22 bytes, but only 11 scalar values — under
        // the 12-char floor, so a byte-length check would wrongly accept it.
        let eleven_chars = "ééééééééééé";
        assert_eq!(eleven_chars.chars().count(), 11);
        assert!(eleven_chars.len() > MIN_PASSWORD_LEN);
        assert!(matches!(
            validate_length(eleven_chars),
            Err(PasswordError::TooShort)
        ));
    }

    #[test]
    fn verify_is_false_on_garbage_hash() {
        assert!(!verify_password(
            "not-a-valid-phc-string",
            "anything at all"
        ));
    }

    #[test]
    fn dummy_hash_is_a_valid_phc_string() {
        // dummy_verify must run a real Argon2 verify for timing uniformity,
        // which requires the embedded hash to parse.
        assert!(PasswordHash::new(DUMMY_HASH).is_ok());
    }

    #[test]
    fn dummy_hash_tracks_current_argon2_params() {
        // If the argon2 crate's default params drift, the embedded constant
        // would make dummy_verify's timing diverge from a real verify. Pin it:
        // regenerate the constant when this fails.
        let fresh = hash_password("timing-uniformity-dummy").expect("hashes");
        let fresh = PasswordHash::new(&fresh).expect("fresh hash parses");
        let dummy = PasswordHash::new(DUMMY_HASH).expect("dummy hash parses");
        assert_eq!(dummy.algorithm, fresh.algorithm);
        assert_eq!(dummy.version, fresh.version);
        assert_eq!(dummy.params, fresh.params);
    }
}
