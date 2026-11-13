//! ´mod:module:proposal´
//!
//! The act-proposal handshake with one private nonce per removable
//! projection (layer1-interface.md §8.2, "The admission handshake").
//!
//! The actor binds its proposal under a content nonce and a dependency
//! nonce drawn independently, so a verifier holding the dependency opening
//! holds nothing that tests a content guess. The host receives the body,
//! the dependency list with its nonce, and the opaque content pre-digest —
//! never the payload or the content nonce — and every check it makes for
//! the act is computable from those alone.

pub mod tags {
    //! ´mod:module:proposal-tags´
    //!
    //! Domain-separation tags of the formulas this module owns. The rule of
    //! [`crate::l1::crypto::tags`] holds: a tag's version names its formula,
    //! so no artifact formed under one nonce shared by both projections
    //! verifies here. The host seal and the approval are formed over the
    //! same encoded verified act as before and keep their tags.
    pub const PRE_DIGEST_CONTENT: &[u8] = b"cogra-l1:pre-digest:content:v3";
    pub const PRE_DIGEST_DEPS: &[u8] = b"cogra-l1:pre-digest:deps:v3";
    pub const PRE_COMMITMENT: &[u8] = b"cogra-l1:pre-commitment:v2";
    pub const COMMIT_CONTENT: &[u8] = b"cogra-l1:commitment:content:v3";
    pub const COMMIT_DEPS: &[u8] = b"cogra-l1:commitment:deps:v3";
}
