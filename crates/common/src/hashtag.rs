//! Hashtag identity — content-addressed UUIDs.
//!
//! Hashtags are "identity is a canonical string" nodes
//! (docs/implementation/data-model.md §Node identity strategies): the same
//! canonical name must derive the same UUID on every instance and fork, so
//! the UUID is `UUIDv5(HASHTAG_NAMESPACE, canonical_name)` rather than
//! random.

use uuid::Uuid;

/// The project-scoped UUIDv5 namespace for hashtag ids.
///
/// Fixed forever: changing it would invalidate every previously minted
/// hashtag UUID. The same literal appears in the `hashtags` table's CHECK
/// constraint (migrations/20260612201452_foundation_schema.sql); a
/// postgres-store test asserts the two derivations agree.
pub const HASHTAG_NAMESPACE: Uuid = uuid::uuid!("7c844aef-fe5c-4849-90c2-196cbd8d47c6");

/// Derives the content-addressed UUID for a canonical hashtag name.
///
/// The caller must pass the canonical form — lowercase, no leading `#`.
/// The normalization is load-bearing schema, not a UI affordance: it
/// defines what counts as "the same" hashtag.
pub fn hashtag_uuid(canonical_name: &str) -> Uuid {
    Uuid::new_v5(&HASHTAG_NAMESPACE, canonical_name.as_bytes())
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

    #[test]
    fn derivation_is_case_sensitive() {
        // The caller must pass the canonical (lowercase) form: the v5 hash is
        // over the raw bytes, so a non-canonical casing derives a *different*
        // id. This is why normalization is load-bearing schema, not cosmetics —
        // `Bot-Defense` and `bot-defense` would otherwise be distinct hashtags.
        assert_ne!(hashtag_uuid("Bot-Defense"), hashtag_uuid("bot-defense"));
    }

    #[test]
    fn derivation_is_pinned() {
        // Golden value: locks both the namespace constant and the v5
        // derivation. If this test ever fails, previously minted hashtag
        // ids are at risk — do not "fix" it by updating the expectation.
        assert_eq!(
            hashtag_uuid("bot-defense").to_string(),
            "a7ebddb3-343f-583f-9c93-51093ada07ae"
        );
    }
}
