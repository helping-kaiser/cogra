//! The crate's error taxonomy.
//!
//! Every enum here is `#[non_exhaustive]`, derives [`std::error::Error`]
//! through `thiserror`, and is `Send + Sync + 'static`. Every `Display`
//! message is lowercase and unpunctuated.
//!
//! A failure lands here only when the input is not the kind of thing the
//! operation takes. An operation that was handed what it asked for and
//! answers negatively returns that answer as a value, never as an `Err`.
//!
//! Slice 1 carries the two enums the deterministic CBOR core needs;
//! the remaining five arrive with the slices that raise them.

/// A `Value` invariant refused at construction.
///
/// ```
/// use cogra_interchange::{Simple, ValueError};
///
/// let err = Simple::new(21).expect_err("21 is `true`, which has its own variant");
/// assert!(matches!(err, ValueError::ReservedSimpleValue { value: 21 }));
/// ```
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum ValueError {
    /// Two entries of a map carry the same key.
    ///
    /// `index` is the position, in canonical key order, of the second of
    /// the two equal keys.
    #[error("duplicate map key at entry {index}")]
    DuplicateMapKey {
        /// Position in canonical key order of the second equal key.
        index: usize,
    },
    /// A byte sequence offered as text is not valid UTF-8.
    #[error("byte string is not valid UTF-8 at byte {offset}")]
    InvalidUtf8 {
        /// The first byte not part of a valid UTF-8 sequence.
        offset: usize,
    },
    /// An integer outside `[-2^64, 2^64)`, which no CBOR integer denotes.
    #[error("integer {value} lies outside the CBOR integer range")]
    IntegerOutOfRange {
        /// The integer offered.
        value: i128,
    },
    /// A simple value that has its own variant, or that no well-formed
    /// encoding produces.
    #[error("simple value {value} is not constructible here")]
    ReservedSimpleValue {
        /// The simple value offered.
        value: u8,
    },
    /// A floating-point value outside the admitted canonical forms — a NaN
    /// other than the one the data language names.
    #[error("floating-point value is not in the admitted canonical form")]
    NonCanonicalFloat,
}

/// Bytes refused as a name of the data language.
///
/// Every variant carries the byte offset at which the failure was
/// detected, so that a consumer can locate it in the input.
///
/// ```
/// use cogra_interchange::{DecodeError, Value};
///
/// // 0x18 0x00 spells 0 with a uint8 argument; 0 belongs in the head.
/// let err = Value::from_canonical_bytes(&[0x18, 0x00])
///     .expect_err("non-preferred head");
/// assert!(matches!(err, DecodeError::NonPreferredHead { offset: 0 }));
/// ```
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum DecodeError {
    /// The input ended before the item did.
    #[error("input ends inside an item at byte {offset}")]
    Truncated {
        /// Where the input ended.
        offset: usize,
    },
    /// One item was decoded and bytes remain.
    #[error("{count} bytes remain after the item at byte {offset}")]
    TrailingBytes {
        /// Where the item ended.
        offset: usize,
        /// How many bytes follow it.
        count: usize,
    },
    /// A head spells its argument in a wider form than the argument needs.
    #[error("head at byte {offset} is not the shortest form for its argument")]
    NonPreferredHead {
        /// Where the head begins.
        offset: usize,
    },
    /// An indefinite-length string, array, or map.
    #[error("indefinite-length item at byte {offset}")]
    IndefiniteLength {
        /// Where the head begins.
        offset: usize,
    },
    /// A map key sorts before its predecessor.
    #[error("map keys out of canonical order at byte {offset}")]
    UnsortedMapKeys {
        /// Where the offending key begins.
        offset: usize,
    },
    /// A map key repeats its predecessor.
    #[error("duplicate map key at byte {offset}")]
    DuplicateMapKey {
        /// Where the offending key begins.
        offset: usize,
    },
    /// A floating-point value spelled other than in the shortest form that
    /// preserves it — a NaN other than the canonical one included.
    #[error("floating-point value at byte {offset} is not in shortest form")]
    NonShortestFloat {
        /// Where the head begins.
        offset: usize,
    },
    /// A head no well-formed encoding produces.
    #[error("ill-formed head at byte {offset}")]
    IllFormed {
        /// Where the head begins.
        offset: usize,
    },
    /// A text string whose payload is not valid UTF-8.
    #[error("text string at byte {offset} is not valid UTF-8")]
    InvalidUtf8 {
        /// The first byte not part of a valid UTF-8 sequence.
        offset: usize,
    },
}
