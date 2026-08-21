//! First-party CBOR + CDDL library implementing the interchange
//! conventions: the deterministic data language, the envelope,
//! namespace labels, versions, theories, and acceptance.
//!
//! Governing documents: [`docs/concept.md`](../docs/concept.md)
//! (requirements, traced to the conventions) and
//! [`docs/design.md`](../docs/design.md) (ratified design, including
//! the implementation gate and slice sequencing). The normative spec
//! is the interchange-conventions document adopted with the corpus
//! disciplines.
//!
//! Slices land in design order: the CBOR core (`value`, `encode`,
//! `decode`), the envelope, the description language, then registry
//! and acceptance.
//!
//! # The data language
//!
//! A name is a byte sequence that is a single CBOR data item encoded
//! under RFC 8949 §4.2, and [`Value`] denotes every structure such a
//! name denotes. Membership is exact: bytes outside the language are
//! refused, never repaired, so there is no canonicalizing decode, no
//! lenient mode, and no constructor that takes bytes and returns a
//! repaired value.
//!
//! ```
//! use cogra_interchange::{Map, Text, Value};
//!
//! let m = Map::new([
//!     (Value::Text(Text::from("b".to_owned())), Value::Unsigned(2)),
//!     (Value::Text(Text::from("a".to_owned())), Value::Unsigned(1)),
//! ])
//! .expect("distinct keys");
//! let value = Value::Map(m);
//! let bytes = value.to_canonical_bytes();
//!
//! // Construction sorted the entries, so the name is the canonical one.
//! assert_eq!(bytes, [0xa2, 0x61, 0x61, 0x01, 0x61, 0x62, 0x02]);
//! assert_eq!(Value::from_canonical_bytes(&bytes).expect("canonical"), value);
//! ```

#![warn(missing_docs, missing_debug_implementations)]

mod cddl;
mod decode;
mod encode;
mod envelope;
mod error;
mod label;
mod value;
mod version;

pub use envelope::{Content, ContentKey, Document, Envelope, MAX_ENVELOPE_PREFIX};
pub use error::{DecodeError, EnvelopeError, LabelError, ValueError};
pub use label::NamespaceLabel;
pub use value::{Array, Bytes, Float, FloatWidth, Map, Negative, Simple, Tag, Text, Value};
pub use version::{Coordinate, Version};
