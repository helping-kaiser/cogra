//! Wallet identity helpers for the pre-rebase account subgraph.
//!
//! The code still mints a `:Wallet` node with a placeholder address at
//! account creation. The rebased design has no Wallet node: the rail key
//! is a device-held Liquid key and the payout address is a Registration
//! field ([ledger.md "Keys"](../../../docs/implementation/ledger.md#keys)).
//! This module lives until the slices that rebuild onboarding and the
//! rail replace it
//! ([roadmap.md "Where the code stands"](../../../docs/implementation/roadmap.md#where-the-code-stands)).
//! Until then the node carries an honest, clearly-unfunded sentinel
//! rather than an address-shaped value that would read as real.

use uuid::Uuid;

/// The placeholder `Wallet.address` for an account with no rail address
/// yet. Written identically for the genesis User and every registrant;
/// retired with this module when the CGT rail lands (roadmap slice 6).
/// The embedded wallet UUID keeps it unique per node.
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
        // Not shaped like a real on-chain address — the sentinel must
        // never be mistaken for a fundable address.
        assert!(!addr.starts_with("0x"));
    }
}
