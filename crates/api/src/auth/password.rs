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

/// Hashes a plaintext password for storage. Rejects passwords below the
/// length floor before hashing.
pub fn hash_password(plaintext: &str) -> Result<String, PasswordError> {
    if plaintext.len() < MIN_PASSWORD_LEN {
        return Err(PasswordError::TooShort);
    }
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(plaintext.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| PasswordError::Hash)
}

/// Runs a verification against a fixed dummy hash and discards the result.
/// Called on the "no such account" login path so response timing is the same
/// whether or not the email exists — closing the account-enumeration channel
/// that a fast no-account rejection would open. The dummy hash is computed
/// once on first use.
pub fn dummy_verify(plaintext: &str) {
    static DUMMY_HASH: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    let hash = DUMMY_HASH
        .get_or_init(|| hash_password("timing-uniformity-dummy").expect("dummy password hashes"));
    let _ = verify_password(hash, plaintext);
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
    fn verify_is_false_on_garbage_hash() {
        assert!(!verify_password(
            "not-a-valid-phc-string",
            "anything at all"
        ));
    }
}
