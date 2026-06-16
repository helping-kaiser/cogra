//! Format validation and normalization for the registration input fields the
//! resolver accepts as bare strings — `handle` and `email`. The rules are
//! fixed in [auth.md](../../../../docs/implementation/auth.md) "Handle and email
//! format"; the bounds are policy constants in [`policy`](super::policy).
//!
//! Validation runs in the resolver rather than a GraphQL scalar, so a bad value
//! surfaces as a per-field `userError` (`BAD_INPUT`) pinned to the offending
//! field, not a tier-1 transport fault — consistent with the tiered error model
//! ([errors.rs](crate::schema::errors)).

use crate::auth::policy::{EMAIL_MAX_LEN, HANDLE_MAX_LEN, HANDLE_MIN_LEN};

#[derive(Debug, thiserror::Error)]
pub enum HandleError {
    #[error("handle must be between {HANDLE_MIN_LEN} and {HANDLE_MAX_LEN} characters")]
    Length,
    #[error("handle may contain only lowercase letters, digits, and underscores")]
    Charset,
}

#[derive(Debug, thiserror::Error)]
pub enum EmailError {
    #[error("enter a valid email address")]
    Malformed,
    #[error("email address is too long")]
    TooLong,
}

/// Validate and normalize a handle to its canonical stored form. Case is folded
/// to lowercase first, then the length window and `[a-z0-9_]` charset are
/// enforced — so an entered `Alice` is accepted and stored as `alice`. Folding
/// is what makes handle uniqueness case-insensitive despite the case-sensitive
/// `users.username` UNIQUE constraint: a mention or search for `@alice` must
/// resolve one account, not `Alice` and `alice` both.
pub fn normalize_handle(raw: &str) -> Result<String, HandleError> {
    let handle = raw.trim().to_lowercase();
    let len = handle.chars().count();
    if !(HANDLE_MIN_LEN..=HANDLE_MAX_LEN).contains(&len) {
        return Err(HandleError::Length);
    }
    if !handle
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return Err(HandleError::Charset);
    }
    Ok(handle)
}

/// Trim and lowercase an email to its canonical form. Both registration (which
/// stores it) and login (which looks it up) fold the same way, so the
/// case-sensitive `users.email` UNIQUE constraint behaves case-insensitively.
/// Login uses this folding directly — never the validation below — so a
/// malformed login email simply misses the lookup and the constant-time
/// dummy-verify path still runs.
pub fn fold_email(raw: &str) -> String {
    raw.trim().to_lowercase()
}

/// Validate and normalize an email to its canonical stored form. A lenient,
/// deliberately-not-RFC-5322 shape check: under the length cap, exactly one
/// `@`, a non-empty local part, and a dotted domain with non-empty labels. The
/// authoritative proof an address is real is the verification email; this only
/// rejects obvious junk before a pending row is written.
pub fn normalize_email(raw: &str) -> Result<String, EmailError> {
    let email = fold_email(raw);
    if email.chars().count() > EMAIL_MAX_LEN {
        return Err(EmailError::TooLong);
    }
    let (local, domain) = email.split_once('@').ok_or(EmailError::Malformed)?;
    if local.is_empty() || domain.contains('@') {
        return Err(EmailError::Malformed);
    }
    let labels: Vec<&str> = domain.split('.').collect();
    if labels.len() < 2 || labels.iter().any(|label| label.is_empty()) {
        return Err(EmailError::Malformed);
    }
    Ok(email)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handle_folds_case_and_trims() {
        assert_eq!(normalize_handle("  Alice_01 ").expect("valid"), "alice_01");
    }

    #[test]
    fn handle_accepts_the_full_charset() {
        assert_eq!(normalize_handle("a_9zz").expect("valid"), "a_9zz");
    }

    #[test]
    fn handle_enforces_the_length_window() {
        // Two chars is under the floor; folding a 31-char handle is over the cap.
        assert!(matches!(normalize_handle("ab"), Err(HandleError::Length)));
        let over = "a".repeat(HANDLE_MAX_LEN + 1);
        assert!(matches!(normalize_handle(&over), Err(HandleError::Length)));
        // Both bounds inclusive.
        assert!(normalize_handle(&"a".repeat(HANDLE_MIN_LEN)).is_ok());
        assert!(normalize_handle(&"a".repeat(HANDLE_MAX_LEN)).is_ok());
    }

    #[test]
    fn handle_length_counts_characters_not_bytes() {
        // Three accented characters: 6 bytes but 3 scalar values — exactly the
        // floor. A byte-length check would wrongly accept them as 6; the charset
        // check then rejects the non-ASCII letters.
        assert!(matches!(normalize_handle("ééé"), Err(HandleError::Charset)));
    }

    #[test]
    fn handle_rejects_disallowed_characters() {
        for bad in ["has space", "dash-no", "dot.no", "bang!", "слово"] {
            assert!(
                matches!(normalize_handle(bad), Err(HandleError::Charset)),
                "{bad} must be rejected on charset"
            );
        }
    }

    #[test]
    fn handle_cannot_reach_the_redaction_sentinel_prefix() {
        // The `redacted-user-{uuid}` sentinel carries hyphens, which the charset
        // forbids — so no real registration can squat a redacted user's handle.
        assert!(matches!(
            normalize_handle("redacted-user-x"),
            Err(HandleError::Charset)
        ));
    }

    #[test]
    fn email_folds_case_and_trims() {
        assert_eq!(
            normalize_email("  Alice@Example.COM ").expect("valid"),
            "alice@example.com"
        );
    }

    #[test]
    fn email_accepts_lenient_shapes() {
        for ok in [
            "a@b.co",
            "first.last@sub.domain.org",
            "u+tag@mail.example.com",
        ] {
            assert!(normalize_email(ok).is_ok(), "{ok} must be accepted");
        }
    }

    #[test]
    fn email_rejects_malformed_shapes() {
        for bad in [
            "no-at-sign.com",
            "@nolocal.com",
            "two@@at.com",
            "user@nodot",
            "user@.leading",
            "user@trailing.",
            "a@b@c.com",
        ] {
            assert!(
                matches!(normalize_email(bad), Err(EmailError::Malformed)),
                "{bad} must be rejected"
            );
        }
    }

    #[test]
    fn email_rejects_over_the_length_cap() {
        let long = format!("{}@example.com", "a".repeat(EMAIL_MAX_LEN));
        assert!(matches!(normalize_email(&long), Err(EmailError::TooLong)));
    }
}
