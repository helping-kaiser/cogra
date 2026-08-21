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
//!
//! # Acceptance
//!
//! A [`Document`] carries a [`NamespaceLabel`] at key 0 and a [`Version`]
//! at key 1; a reader holds a [`Registry`] of assigned coordinates with
//! their immutable theories; and [`accept`] answers what that reader makes
//! of that document. The answer is a [`Verdict`] and never an `Err` —
//! rejection is an answer, and a reader's state grows only over what the
//! owner assigned, so today's rejection can be tomorrow's acceptance.
//!
//! ```
//! use cogra_interchange::{
//!     accept, Content, ContentKey, Coordinate, Document, Envelope, NamespaceLabel, Registry,
//!     Theory, Value, Verdict, Version,
//! };
//!
//! let label = NamespaceLabel::parse("com.example").expect("a label");
//! let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
//!     .expect("an assignable theory");
//!
//! let mut registry = Registry::new();
//! registry
//!     .acquire(Coordinate::new(label.clone(), 1, 0), theory)
//!     .expect("the first minor of the major");
//!
//! let mut content = Content::new();
//! content.insert(
//!     ContentKey::new(2).expect("a content key"),
//!     Value::Text("hello".to_owned().into()),
//! );
//!
//! // Stamped at a held minor: the strict verdict.
//! let here = Document::new(Envelope::new(label.clone(), Version::new(1, 0, 0)), content.clone());
//! assert_eq!(accept(&registry, &here), Verdict::AcceptedStrictly { minor: 0 });
//!
//! // Stamped past this reader: judged against the companion of its floor.
//! let ahead = Document::new(Envelope::new(label, Version::new(1, 4, 0)), content);
//! assert_eq!(accept(&registry, &ahead), Verdict::AcceptedTolerantly { floor: 0 });
//! ```

#![warn(missing_docs, missing_debug_implementations)]

mod accept;
mod cddl;
mod decode;
mod encode;
mod envelope;
mod error;
mod label;
mod regexp;
mod registry;
mod value;
mod version;

pub use accept::{
    Instrument, Rejection, RejectionCause, Under, Verdict, accept, dispatch, dispatch_prefix,
};
pub use cddl::{
    BaseTheory, ImplicitReach, Inclusion, InclusionBreach, KeySlot, Mismatch, MismatchKind,
    OpenTheory, Provision, Restrained, RestraintReport, Satisfaction, Theory, check_inclusion,
    global, satisfies, satisfies_global, satisfies_open,
};
pub use envelope::{Content, ContentKey, Document, Envelope, MAX_ENVELOPE_PREFIX};
pub use error::{
    AcquireError, DecodeError, EnvelopeError, Error, LabelError, RegexpError, TheoryError,
    ValueError,
};
pub use label::NamespaceLabel;
pub use registry::Registry;
pub use value::{Array, Bytes, Float, FloatWidth, Map, Negative, Simple, Tag, Text, Value};
pub use version::{Coordinate, Version};
