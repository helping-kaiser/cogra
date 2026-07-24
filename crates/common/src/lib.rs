// Shared domain types, error definitions, and primitive wrappers.
// No database or HTTP logic — safe to import from any crate.

pub mod hashtag;
pub mod l1;

pub use hashtag::{HASHTAG_NAMESPACE, hashtag_uuid};
