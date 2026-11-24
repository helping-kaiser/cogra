//! ´mod:module:reserved´
//!
//! CoGra's reserved names (copy-voice.md "Field errors" → "Reserved
//! names", the lists' one home): the handles and display names no
//! account can pick, so nobody can wear the name of CoGra's own accounts.
//!
//! The reserve is checked at the request doors that let a person choose a
//! name — `register` and `changeHandle` for a handle, `prepareProfileUpdate`
//! for a display name. The genesis bootstrap seeds the system accounts
//! through its own one-shot store writes, which no request reaches, and
//! that is the one way a reserved name comes to stand on an account.

/// The reserved handles, in the normalized form ([`crate::auth::normalize_handle`])
/// uniqueness compares.
pub const RESERVED_HANDLES: [&str; 10] = [
    "cogra",
    "cogra_dev",
    "genesis",
    "genesis_mod",
    "moderator",
    "publisher",
    "treasury",
    "deleted_account",
    "deleted",
    "this_account",
];

/// The reserved display names, as the design writes them.
pub const RESERVED_DISPLAY_NAMES: [&str; 9] = [
    "CoGra",
    "CoGra Dev",
    "Genesis Moderator",
    "The Publisher",
    "The Moderator",
    "The Treasury",
    "Deleted account",
    "A deleted account",
    "This account",
];

/// Whether a handle, already normalized, is one CoGra keeps.
///
/// The handle is compared in the form uniqueness compares it, so no
/// spelling the normalization folds together can slip past the reserve.
pub fn is_reserved_handle(normalized: &str) -> bool {
    RESERVED_HANDLES.contains(&normalized)
}

/// A display name with its case and spacing folded (copy-voice.md
/// "Reserved names": the whole name is compared after folding both):
/// trimmed, every run of whitespace one space, lowercased.
///
/// Whitespace is Unicode `White_Space` ([`char::is_whitespace`]), so a
/// no-break space folds like a space. Characters that only look like
/// others are not folded.
pub fn fold_display_name(name: &str) -> String {
    name.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

/// Whether a display name is, as a whole and once folded, one CoGra keeps.
/// A reserved word inside a longer name is never refused.
pub fn is_reserved_display_name(name: &str) -> bool {
    let folded = fold_display_name(name);
    RESERVED_DISPLAY_NAMES
        .iter()
        .any(|reserved| fold_display_name(reserved) == folded)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every reserved handle is already in normalized form, or the reserve would hold a spelling no registration can reach.
    /// ´claim:auth:the-reserved-handles-are-normalized´
    #[test]
    fn the_reserved_handles_are_normalized() {
        for handle in RESERVED_HANDLES {
            assert_eq!(
                crate::auth::normalize_handle(handle).as_deref(),
                Ok(handle),
                "{handle} is not in the normalized form"
            );
        }
    }

    /// A display name folds its case, its surrounding spacing and its inner whitespace runs, and nothing else.
    /// ´claim:auth:a-display-name-folds-case-and-spacing´
    #[test]
    fn a_display_name_folds_case_and_spacing() {
        assert_eq!(fold_display_name("  The \t MODERATOR \n"), "the moderator");
        assert_eq!(fold_display_name("The\u{a0}Moderator"), "the moderator");
        assert_eq!(fold_display_name("TheModerator"), "themoderator");
    }

    /// Only the whole name is reserved: a reserved name inside a longer one, or with its spaces dropped, stays free.
    /// ´claim:auth:only-the-whole-display-name-is-reserved´
    #[test]
    fn only_the_whole_display_name_is_reserved() {
        assert!(is_reserved_display_name("cogra dev"));
        assert!(is_reserved_display_name(" a  DELETED account "));
        assert!(!is_reserved_display_name("CoGra fan"));
        assert!(!is_reserved_display_name("Not The Moderator"));
        assert!(!is_reserved_display_name("TheModerator"));
    }
}
