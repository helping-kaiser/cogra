//! Wallet identity helpers.
//!
//! Every account gets a `:Wallet` node bound by `:PAYS_TO` at creation —
//! genesis and every registrant alike
//! ([ledger.md "The Wallet node and the :PAYS_TO binding"](../implementation/ledger.md)).
//! The node's `address` is the account's **counterfactual self-custody**
//! on-chain address, derived from the user-held signing key.
//!
//! That derivation — key generation client-side, the smart-account scheme,
//! the chain itself — is the economics surface, deferred to slice 5 of the
//! [roadmap](../implementation/roadmap.md). Until it lands there is no key
//! to derive from, so the node carries an honest, clearly-unfunded sentinel
//! rather than an address-shaped value that would read as real. "No wallet"
//! is the deliberate starting state: an account needs no funded wallet to
//! participate (ledger.md "Self-custody from signup").

use uuid::Uuid;

/// The placeholder `Wallet.address` for an account whose counterfactual
/// address has not been derived yet. Written identically for the genesis
/// User and every registrant; replaced by the real derivation when the
/// chain lands (slice 5). The embedded wallet UUID keeps it unique per node.
pub fn placeholder_address(wallet_id: Uuid) -> String {
    format!("unfunded:{wallet_id}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn placeholder_is_clearly_not_an_onchain_address() {
        let addr = placeholder_address(Uuid::nil());
        assert!(addr.starts_with("unfunded:"));
        // Not the 0x… shape a real EVM address would take — the sentinel
        // must never be mistaken for a fundable address.
        assert!(!addr.starts_with("0x"));
    }
}
