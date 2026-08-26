//! ´mod:module:hashtag´
//!
//! Hashtag identity — content-addressed UUIDs.
//!
//! Hashtags are "identity is a canonical string" nodes
//! (docs/implementation/data-model.md §Node identity strategies): the same
//! canonical name must derive the same UUID on every instance and fork, so
//! the UUID is `UUIDv5(HASHTAG_NAMESPACE, canonical_name)` rather than
//! random.

use uuid::Uuid;

use crate::l1::identifier::{MAX_ATOM_BYTES, NodeId};

/// The project-scoped UUIDv5 namespace for hashtag ids.
///
/// Fixed forever: changing it would invalidate every previously minted
/// hashtag UUID. The same literal appears in the `hashtags` table's CHECK
/// constraint (migrations/20260724000001_foundation_schema.sql); a
/// postgres-store test asserts the two derivations agree.
pub const HASHTAG_NAMESPACE: Uuid = uuid::uuid!("7c844aef-fe5c-4849-90c2-196cbd8d47c6");

/// Derives the content-addressed UUID for a canonical hashtag name.
///
/// The caller must pass the canonical form — lowercase, no leading `#`.
/// [`canonicalize`] produces it.
pub fn hashtag_uuid(canonical_name: &str) -> Uuid {
    Uuid::new_v5(&HASHTAG_NAMESPACE, canonical_name.as_bytes())
}

/// Why a tag string names no Type.
///
/// The variants exist to sharpen the field-level refusal a client sees;
/// the verdict itself is always the identifier atom's, never this enum's.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum HashtagNameError {
    #[error("a topic name cannot be empty")]
    Empty,
    #[error("a topic name is at most {MAX_ATOM_BYTES} bytes, got {0}")]
    TooLong(usize),
    #[error("`{0}` is not a legal topic name: ASCII letters, digits, `.`, `-`, `_` only")]
    Charset(String),
}

/// Canonicalizes a tag string into the Type name L1 compares by byte
/// equality: lowercase, no leading `#` (hashtag.md §1).
///
/// Legality is decided by *constructing the Type identifier itself*, so the
/// naming service and the identifier algebra cannot drift apart: a name is
/// legal exactly when `name(s)` is (layer1-interface.md §8.1 — ASCII
/// `[A-Za-z0-9._-]`, 1..=128 bytes). Nothing else is transformed — a name
/// that is not an atom is refused rather than encoded, because encoding it
/// would change what the name *means* while leaving it looking the same.
///
/// Only one leading `#` is the sigil; a second is an ordinary character, and
/// not one the atom admits.
///
/// Idempotent: canonical input is returned unchanged.
pub fn canonicalize(input: &str) -> Result<String, HashtagNameError> {
    let name = input
        .strip_prefix('#')
        .unwrap_or(input)
        .to_ascii_lowercase();
    match NodeId::name(&name) {
        Ok(_) => Ok(name),
        Err(_) if name.is_empty() => Err(HashtagNameError::Empty),
        Err(_) if name.len() > MAX_ATOM_BYTES => Err(HashtagNameError::TooLong(name.len())),
        Err(_) => Err(HashtagNameError::Charset(name)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_name_same_uuid() {
        assert_eq!(hashtag_uuid("bot-defense"), hashtag_uuid("bot-defense"));
    }

    #[test]
    fn different_names_differ() {
        assert_ne!(hashtag_uuid("bot-defense"), hashtag_uuid("botdefense"));
    }

    /// The v5 hash is taken over the raw bytes, so a non-canonical casing
    /// derives a different id — canonicalization is the caller's job.
    #[test]
    fn derivation_is_case_sensitive() {
        assert_ne!(hashtag_uuid("Bot-Defense"), hashtag_uuid("bot-defense"));
    }

    #[test]
    fn canonicalizes_casing_and_the_sigil() {
        for input in ["rust", "Rust", "RUST", "#rust", "#Rust", "#RUST"] {
            assert_eq!(canonicalize(input).expect("legal"), "rust", "from {input}");
        }
    }

    #[test]
    fn canonicalization_is_idempotent() {
        for input in ["#Bot-Defense", "rust", "a.b_c-1"] {
            let once = canonicalize(input).expect("legal");
            assert_eq!(canonicalize(&once).expect("legal"), once);
        }
    }

    #[test]
    fn canonical_names_are_atoms() {
        for input in ["a", "a.b", "a-b", "a_b", "0", "bot-defense"] {
            let name = canonicalize(input).expect("legal");
            assert!(NodeId::name(&name).is_ok(), "{name} must be an atom");
        }
    }

    /// A bare sigil is empty too, once the sigil is stripped.
    #[test]
    fn empty_is_refused() {
        assert_eq!(
            canonicalize("").expect_err("refused"),
            HashtagNameError::Empty
        );
        assert_eq!(
            canonicalize("#").expect_err("refused"),
            HashtagNameError::Empty
        );
    }

    /// The sigil is not part of the name, so it consumes none of the budget:
    /// a name at the bound is still legal with a `#` in front of it.
    #[test]
    fn the_length_bound_is_the_atom_bound() {
        let at_bound = "a".repeat(MAX_ATOM_BYTES);
        assert_eq!(canonicalize(&at_bound).expect("legal"), at_bound);

        let over = "a".repeat(MAX_ATOM_BYTES + 1);
        assert_eq!(
            canonicalize(&over).expect_err("refused"),
            HashtagNameError::TooLong(MAX_ATOM_BYTES + 1)
        );
        assert!(canonicalize(&format!("#{at_bound}")).is_ok());
    }

    /// D3: non-ASCII is unrepresentable on the substrate, so it is refused
    /// outright — never punycoded or percent-encoded into something that
    /// looks like a different name.
    #[test]
    fn non_atoms_are_refused_never_encoded() {
        for input in [
            "münchen",
            "#münchen",
            "日本語",
            "has space",
            "colon:inside",
            "a#b",
            "##rust",
            "emoji🎉",
        ] {
            assert!(
                canonicalize(input).is_err(),
                "{input} must be refused as a name"
            );
        }
    }

    /// ASCII lowercasing leaves `Ü` alone and the atom check then refuses
    /// it: the refusal must not come to depend on Unicode case folding.
    #[test]
    fn non_ascii_case_is_not_folded() {
        assert_eq!(
            canonicalize("MÜNCHEN").expect_err("refused"),
            HashtagNameError::Charset("mÜnchen".to_string())
        );
    }

    /// The reserved Types are seeded by name, so canonicalizing the same
    /// strings must land on the same content-addressed keys.
    #[test]
    fn canonical_names_derive_the_seeded_reserved_ids() {
        assert_eq!(
            hashtag_uuid(&canonicalize("#Bot-Defense").expect("legal")),
            hashtag_uuid("bot-defense")
        );
    }

    /// A golden value locking both the namespace constant and the v5
    /// derivation. A failure here means previously minted hashtag ids are at
    /// risk; the expectation is never the thing to update.
    #[test]
    fn derivation_is_pinned() {
        assert_eq!(
            hashtag_uuid("bot-defense").to_string(),
            "a7ebddb3-343f-583f-9c93-51093ada07ae"
        );
    }
}
