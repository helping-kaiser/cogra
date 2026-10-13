//! CoGra's feed ranking — the complete computation of `S(u,c)` that
//! feed-ranking.md publishes, as a pure library.
//!
//! One implementation for every runner: the server's ranker pod, a delegated
//! miner, and the viewer's own device all link this crate, so a ranking
//! claim made by one is reproducible bit for bit by another
//! (miner-api.md "Result integrity"). It never runs inside the backend
//! process (architecture.md "crates/ranker").
//!
//! The crate does no I/O and holds no state: no async, no database, no
//! GraphQL, no clock, no randomness. Its inputs are the four of
//! feed-ranking.md §2 and nothing else — no standing, no honor, no money, no
//! payload bodies, no session events, and no AI in any role.
//!
//! Determinism is a tested property, not a hope (ranker-core §3.0):
//!
//! - **D-a** every transcendental is libm's, never std's platform math —
//!   enforced by this crate's clippy.toml;
//! - **D-b** no hash-order iteration — BTree collections and sorted vectors
//!   only, also enforced by clippy.toml;
//! - **D-c** every sum runs in a stated order, a bundle's in ≺;
//! - **D-d** input order is irrelevant — inputs are sorted canonically first.

mod bundle;
mod census;
mod error;
mod recency;
mod weight;

pub use bundle::{CausalKey, Folded, Member, fold_members};
pub use census::{Family, LegRole};
pub use error::RankError;
pub use recency::{RecencyShape, epoch_age, recency_factor};
pub use weight::{
    BETA, ETA, PathView, damped_weight, maturity_gain, path_view, temporal_entropy,
};
