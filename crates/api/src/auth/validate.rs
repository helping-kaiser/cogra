//! Format validation and normalization for the registration input fields the
//! resolver accepts as bare strings — `handle` and `email`. The rules are
//! fixed in [auth.md](../../../../docs/implementation/auth.md) "Handle and email
//! format"; the bounds are policy constants in [`policy`](super::policy).
//!
//! Validation runs in the resolver rather than a GraphQL scalar, so a bad value
//! surfaces as a per-field `userError` (`BAD_INPUT`) pinned to the offending
//! field, not a tier-1 transport fault — consistent with the tiered error model
//! ([errors.rs](crate::schema::errors)).

use crate::auth::policy::{
    BIO_MAX_LEN, DISPLAY_NAME_MAX_LEN, EMAIL_MAX_LEN, HANDLE_MAX_LEN, HANDLE_MIN_LEN,
    WEBSITE_URL_MAX_LEN,
};

#[derive(Debug, thiserror::Error)]
pub enum HandleError {
    #[error("handle must be between {HANDLE_MIN_LEN} and {HANDLE_MAX_LEN} characters")]
    Length,
    #[error("handle may contain only lowercase letters, digits, and underscores")]
    Charset,
}

/// Validation failures for the free-text `editProfile` fields. Each maps to a
/// per-field `BAD_INPUT` userError in the resolver.
#[derive(Debug, thiserror::Error)]
pub enum ProfileError {
    #[error("display name cannot be empty")]
    DisplayNameEmpty,
    #[error("display name must be at most {DISPLAY_NAME_MAX_LEN} characters")]
    DisplayNameTooLong,
    #[error("bio must be at most {BIO_MAX_LEN} characters")]
    BioTooLong,
    #[error("website URL must be at most {WEBSITE_URL_MAX_LEN} characters")]
    WebsiteTooLong,
    #[error("website URL must be a valid http(s) address")]
    WebsiteInvalid,
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

/// Validates a required display name: trimmed, non-empty, within the length
/// cap. Unlike a handle it keeps its case and full Unicode — it is display
/// content, not a lookup key — so only the length is bounded.
pub fn normalize_display_name(raw: &str) -> Result<String, ProfileError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(ProfileError::DisplayNameEmpty);
    }
    if trimmed.chars().count() > DISPLAY_NAME_MAX_LEN {
        return Err(ProfileError::DisplayNameTooLong);
    }
    Ok(trimmed.to_string())
}

/// Validates an optional bio. A blank value (empty or whitespace) is the
/// "clear it" signal, returning `None`; otherwise the trimmed text under the
/// length cap.
pub fn normalize_bio(raw: &str) -> Result<Option<String>, ProfileError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if trimmed.chars().count() > BIO_MAX_LEN {
        return Err(ProfileError::BioTooLong);
    }
    Ok(Some(trimmed.to_string()))
}

/// Validates an optional website URL. A blank value clears the field
/// (`None`); otherwise the URL must be under the length cap and parse as an
/// `http`/`https` address with a non-empty host. The scheme allowlist is a
/// safety boundary, not a nicety: the value is rendered as a clickable link,
/// so a `javascript:` / `data:` URL must never reach storage.
pub fn normalize_website_url(raw: &str) -> Result<Option<String>, ProfileError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if trimmed.chars().count() > WEBSITE_URL_MAX_LEN {
        return Err(ProfileError::WebsiteTooLong);
    }
    if !is_http_url(trimmed) {
        return Err(ProfileError::WebsiteInvalid);
    }
    Ok(Some(trimmed.to_string()))
}

/// True when `s` is an `http://` or `https://` URL with a non-empty host. A
/// deliberately small parser — enough to enforce the scheme allowlist and
/// reject host-less junk, without pulling in a URL crate. The host is the run
/// up to the first `/`, `?`, or `#`, minus any `userinfo@` prefix and `:port`
/// suffix.
fn is_http_url(s: &str) -> bool {
    let lower = s.to_ascii_lowercase();
    let after_scheme = match lower
        .strip_prefix("https://")
        .or_else(|| lower.strip_prefix("http://"))
    {
        Some(rest) => rest,
        None => return false,
    };
    // Map the lowercased offset back onto the original isn't needed: we only
    // test the host for emptiness, and case doesn't change that.
    let authority = after_scheme
        .split(['/', '?', '#'])
        .next()
        .unwrap_or(after_scheme);
    let host = authority.rsplit('@').next().unwrap_or(authority);
    let host = host.split(':').next().unwrap_or(host);
    !host.is_empty()
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

    #[test]
    fn display_name_trims_and_keeps_case_and_unicode() {
        // Display content, not a lookup key: case and non-ASCII survive, only
        // surrounding whitespace is stripped.
        assert_eq!(
            normalize_display_name("  Ada Łovelace ").expect("valid"),
            "Ada Łovelace"
        );
    }

    #[test]
    fn display_name_rejects_blank() {
        for blank in ["", "   ", "\t\n"] {
            assert!(matches!(
                normalize_display_name(blank),
                Err(ProfileError::DisplayNameEmpty)
            ));
        }
    }

    #[test]
    fn display_name_enforces_the_length_cap_in_characters() {
        assert!(normalize_display_name(&"a".repeat(DISPLAY_NAME_MAX_LEN)).is_ok());
        let over = "a".repeat(DISPLAY_NAME_MAX_LEN + 1);
        assert!(matches!(
            normalize_display_name(&over),
            Err(ProfileError::DisplayNameTooLong)
        ));
        // Multibyte characters count as one each, not by byte length.
        assert!(normalize_display_name(&"é".repeat(DISPLAY_NAME_MAX_LEN)).is_ok());
    }

    #[test]
    fn bio_blank_clears_to_none() {
        for blank in ["", "   ", "\n"] {
            assert_eq!(normalize_bio(blank).expect("blank clears"), None);
        }
    }

    #[test]
    fn bio_trims_and_caps_length() {
        assert_eq!(
            normalize_bio("  hi  ").expect("valid"),
            Some("hi".to_string())
        );
        assert!(normalize_bio(&"a".repeat(BIO_MAX_LEN)).is_ok());
        assert!(matches!(
            normalize_bio(&"a".repeat(BIO_MAX_LEN + 1)),
            Err(ProfileError::BioTooLong)
        ));
    }

    #[test]
    fn website_blank_clears_to_none() {
        for blank in ["", "   "] {
            assert_eq!(normalize_website_url(blank).expect("blank clears"), None);
        }
    }

    #[test]
    fn website_accepts_http_and_https() {
        for ok in [
            "http://example.com",
            "https://example.com",
            "HTTPS://Example.com/Path?q=1#frag",
            "https://user@host.example:8443/path",
            "https://192.168.0.1/status",
        ] {
            assert_eq!(
                normalize_website_url(ok).expect("valid url"),
                Some(ok.trim().to_string()),
                "{ok} must be accepted and stored verbatim"
            );
        }
    }

    #[test]
    fn website_rejects_non_http_schemes_and_junk() {
        // The scheme allowlist is the security boundary — javascript:/data:
        // and bare/host-less strings must never reach storage.
        for bad in [
            "javascript:alert(1)",
            "data:text/html,<script>",
            "ftp://example.com",
            "example.com",
            "https://",
            "http:///path",
        ] {
            assert!(
                matches!(
                    normalize_website_url(bad),
                    Err(ProfileError::WebsiteInvalid)
                ),
                "{bad} must be rejected"
            );
        }
    }

    #[test]
    fn website_enforces_the_length_cap() {
        let long = format!("https://example.com/{}", "a".repeat(WEBSITE_URL_MAX_LEN));
        assert!(matches!(
            normalize_website_url(&long),
            Err(ProfileError::WebsiteTooLong)
        ));
    }
}
