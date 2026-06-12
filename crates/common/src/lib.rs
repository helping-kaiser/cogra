// Shared domain types, error definitions, and primitive wrappers.
// No database or HTTP dependencies — safe to import from any crate.

pub mod hashtag;

pub use hashtag::{HASHTAG_NAMESPACE, hashtag_uuid};
