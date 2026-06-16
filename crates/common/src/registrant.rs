//! Registrant identity — the `:User` and `:Wallet` UUIDs a verifying
//! registration brings into existence.
//!
//! These ids are derived deterministically from the `auth_pending_registrations`
//! row id (`UUIDv5`) rather than minted randomly, so a `verifyEmail` that is
//! retried after the graph committed but Postgres did not produces the **same**
//! ids on the retry. The graph write `MERGE`s on these ids, so the retry adopts
//! the orphaned nodes instead of creating duplicates — the idempotent-first-commit
//! discipline from
//! [architecture.md "Partial-failure handling"](../implementation/architecture.md).
//!
//! Unlike [`hashtag`](crate::hashtag) ids, these need no cross-instance
//! stability: the pending-row id is per-instance and random, so the derived ids
//! are too. The only property that matters is that the *same* pending row always
//! derives the *same* pair, which makes the registration write safe to retry.

use uuid::Uuid;

/// The project-scoped `UUIDv5` namespace for registrant-derived ids. Distinct
/// from [`crate::HASHTAG_NAMESPACE`] so the two derivations can never collide.
const REGISTRANT_NAMESPACE: Uuid = uuid::uuid!("0a7c5e2b-9d34-4c61-8f0a-1b2c3d4e5f60");

/// The `:User` and `:Wallet` ids a registrant's account subgraph is keyed on.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RegistrantIds {
    pub user_id: Uuid,
    pub wallet_id: Uuid,
}

/// Derives the `(user_id, wallet_id)` pair for a pending registration. Stable
/// across retries of the same pending row; the two ids differ because each is
/// salted with a distinct role suffix.
pub fn registrant_ids(pending_id: Uuid) -> RegistrantIds {
    RegistrantIds {
        user_id: derive(pending_id, b":user"),
        wallet_id: derive(pending_id, b":wallet"),
    }
}

fn derive(pending_id: Uuid, role: &[u8]) -> Uuid {
    let mut name = pending_id.as_bytes().to_vec();
    name.extend_from_slice(role);
    Uuid::new_v5(&REGISTRANT_NAMESPACE, &name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_pending_row_derives_the_same_pair() {
        let pending = Uuid::new_v4();
        assert_eq!(
            registrant_ids(pending),
            registrant_ids(pending),
            "a retried verifyEmail must reuse the ids so its MERGE adopts the orphan"
        );
    }

    #[test]
    fn user_and_wallet_ids_differ() {
        let ids = registrant_ids(Uuid::new_v4());
        assert_ne!(
            ids.user_id, ids.wallet_id,
            "the role suffix must separate the two nodes"
        );
    }

    #[test]
    fn distinct_pending_rows_derive_distinct_ids() {
        let a = registrant_ids(Uuid::new_v4());
        let b = registrant_ids(Uuid::new_v4());
        assert_ne!(a.user_id, b.user_id);
        assert_ne!(a.wallet_id, b.wallet_id);
    }

    #[test]
    fn derivation_does_not_collide_with_the_hashtag_namespace() {
        // A pending id and a hashtag name could coincide as byte strings; the
        // distinct namespaces keep their derived ids apart regardless.
        let pending = Uuid::new_v4();
        assert_ne!(
            registrant_ids(pending).user_id,
            crate::hashtag_uuid(&pending.to_string())
        );
    }
}
