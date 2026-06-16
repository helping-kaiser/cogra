// Shared domain types, error definitions, and primitive wrappers.
// No database or HTTP dependencies — safe to import from any crate.

pub mod hashtag;
pub mod user;
pub mod wallet;

pub use hashtag::{HASHTAG_NAMESPACE, hashtag_uuid};
pub use user::{NetworkRole, UnknownNetworkRole};
