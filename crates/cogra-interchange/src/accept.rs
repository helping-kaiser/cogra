//! ´mod:module:accept´
//!
//! Acceptance: choosing the instrument that governs a document, and
//! applying it.
//!
//! Acceptance is two acts, because the conventions make it two. The first
//! is routing — which instrument governs, decided from the envelope and
//! the held state alone ([`dispatch`], [`dispatch_prefix`]). The second is
//! the judgment itself ([`accept`]), which consults the document entire.
//!
//! # The four dispositions
//!
//! For a document stamped `(ℓ, [M, m, p])` at a reader whose ceiling of
//! `(ℓ, M)` is `m₁`:
//!
//! - `m` is held — the **strict** verdict, `d ⊨ R(ℓ, M, m)`.
//! - `m ≤ m₁` and `m` is not held — the stamp names a coordinate never
//!   assigned, a checkably false claim, and the document is **rejected
//!   whole**. Absence below the ceiling is knowledge, not ignorance.
//! - `m > m₁` — the **tolerant** verdict, `d ⊨ Open(R(ℓ, M, m₁))`, the
//!   floor being `m₁`. Tolerance lives at the theory layer alone, and only
//!   above the reader's knowledge.
//! - No minor of `(ℓ, M)` is held — **rejected whole**, a fact about the
//!   state rather than about the document.
//!
//! The patch position does not occur in any of these conditions.
//!
//! # Rejection is a verdict
//!
//! [`accept`] returns a [`Verdict`] and never an `Err`. A rejected
//! document is not an error condition but an answer, and a state that
//! grows turns rejections into acceptances: an `Err` would invite `?` to
//! discard the difference between "this reader does not hold that major
//! yet" and "these bytes are not a document", which are the two most
//! different answers the crate gives.

use crate::error::EnvelopeError;
use crate::registry::Registry;
use crate::{
    Document, Envelope, Mismatch, OpenTheory, Satisfaction, Theory, satisfies, satisfies_open,
};

/// The instrument governing a document, chosen from its envelope and the
/// held state alone.
///
/// ```
/// use cogra_interchange::{
///     dispatch, Coordinate, Envelope, Instrument, NamespaceLabel, Registry, Theory, Version,
/// };
///
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
///     .expect("an assignable theory");
/// let mut registry = Registry::new();
/// registry
///     .acquire(Coordinate::new(label.clone(), 1, 0), theory)
///     .expect("the first minor");
///
/// let envelope = Envelope::new(label, Version::new(1, 0, 3));
/// assert!(matches!(
///     dispatch(&registry, &envelope),
///     Instrument::Strict { minor: 0, .. }
/// ));
/// ```
#[derive(Debug)]
pub enum Instrument<'r> {
    /// The stamp is held: the strict verdict is `d ⊨ R(ℓ, M, m)`.
    Strict {
        /// The stamped minor, which is the held minor governing.
        minor: u64,
        /// The theory held there.
        theory: &'r Theory,
    },
    /// The stamp outruns the ceiling: the tolerant verdict is
    /// `d ⊨ Open(R(ℓ, M, m₁))`.
    Tolerant {
        /// The reader's floor: the ceiling of that major.
        floor: u64,
        /// The companion of the theory held at the floor.
        companion: &'r OpenTheory,
    },
    /// No instrument: the document is rejected whole.
    Refused(RejectionCause),
}

/// Why no instrument governs.
///
/// ```
/// use cogra_interchange::{
///     dispatch, Envelope, Instrument, NamespaceLabel, RejectionCause, Registry, Version,
/// };
///
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// let envelope = Envelope::new(label, Version::new(4, 0, 0));
/// assert!(matches!(
///     dispatch(&Registry::new(), &envelope),
///     Instrument::Refused(RejectionCause::UnheldMajor)
/// ));
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum RejectionCause {
    /// No minor of this major is held.
    UnheldMajor,
    /// The stamp lies at or below the ceiling and was never assigned: a
    /// checkably false claim.
    UnassignedStamp {
        /// The reader's ceiling of that major.
        ceiling: u64,
    },
}

/// Choose the governing instrument.
///
/// Reads the envelope and the held state and nothing else — no content is
/// consulted, and no judgment is made. One descent into the held state
/// answers it, and nothing is allocated on the way.
///
/// ```
/// use cogra_interchange::{
///     dispatch, Coordinate, Envelope, Instrument, NamespaceLabel, Registry, Theory, Version,
/// };
///
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
///     .expect("an assignable theory");
/// let mut registry = Registry::new();
/// registry
///     .acquire(Coordinate::new(label.clone(), 1, 0), theory)
///     .expect("the first minor");
///
/// // A stamp above the ceiling is routed to the companion of the floor.
/// let ahead = Envelope::new(label, Version::new(1, 9, 0));
/// assert!(matches!(
///     dispatch(&registry, &ahead),
///     Instrument::Tolerant { floor: 0, .. }
/// ));
/// ```
pub fn dispatch<'r>(reg: &'r Registry, env: &Envelope) -> Instrument<'r> {
    let version = env.version();
    let (major, minor) = (version.major(), version.minor());

    let Some(holding) = reg.holding(env.label(), major) else {
        return Instrument::Refused(RejectionCause::UnheldMajor);
    };
    if let Some(theory) = holding.theory(minor) {
        return Instrument::Strict { minor, theory };
    }
    if minor <= holding.ceiling {
        return Instrument::Refused(RejectionCause::UnassignedStamp {
            ceiling: holding.ceiling,
        });
    }
    Instrument::Tolerant {
        floor: holding.ceiling,
        companion: holding.companion,
    }
}

/// Choose the governing instrument from at most
/// [`crate::MAX_ENVELOPE_PREFIX`] bytes.
///
/// The bounded-envelope clause made callable: the disposition of a
/// document is determined by at most a 296-byte prefix of its name
/// together with the held state, so a consumer routing a document in
/// transit need not hold its tail.
///
/// # This certifies no membership
///
/// It answers which instrument governs a document, not whether the bytes
/// are one. Everything past the envelope is unread, so a byte sequence
/// with a well-formed envelope and a non-canonical tail is routed here and
/// is no document at all: such bytes denote no structure, and the crate's
/// answer about them is the [`crate::DecodeError`] that
/// [`Document::from_canonical_bytes`] returns — never a [`Verdict`]. It is
/// the routing that is early, never the acceptance. A prefix too short to
/// carry the envelope is [`EnvelopeError::Truncated`], which is a request
/// for more bytes and not a rejection.
///
/// ```
/// use cogra_interchange::{
///     dispatch, dispatch_prefix, Content, Coordinate, Document, Envelope, NamespaceLabel,
///     Registry, Theory, Version, MAX_ENVELOPE_PREFIX,
/// };
///
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], ? 2 => tstr}"#)
///     .expect("an assignable theory");
/// let mut registry = Registry::new();
/// registry
///     .acquire(Coordinate::new(label.clone(), 1, 0), theory)
///     .expect("the first minor");
///
/// let document = Document::new(Envelope::new(label, Version::new(1, 0, 0)), Content::new());
/// let bytes = document.to_canonical_bytes();
/// let head = &bytes[..bytes.len().min(MAX_ENVELOPE_PREFIX)];
///
/// let early = dispatch_prefix(&registry, head).expect("the envelope lies inside the bound");
/// let full = dispatch(&registry, document.envelope());
/// assert_eq!(format!("{early:?}"), format!("{full:?}"));
/// ```
pub fn dispatch_prefix<'r>(
    reg: &'r Registry,
    prefix: &[u8],
) -> Result<Instrument<'r>, EnvelopeError> {
    let (envelope, _) = Envelope::peek(prefix)?;
    Ok(dispatch(reg, &envelope))
}

/// The disposition of a document at a reader.
///
/// ```
/// use cogra_interchange::{NamespaceLabel, Rejection, Registry, Verdict};
///
/// let verdict = Verdict::AcceptedStrictly { minor: 2 };
/// assert!(verdict.is_accepted());
/// assert!(!Verdict::Rejected(Rejection::UnheldMajor { major: 1 }).is_accepted());
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum Verdict {
    /// The document satisfies the theory held at its stamp.
    AcceptedStrictly {
        /// The stamped minor, which the reader holds.
        minor: u64,
    },
    /// The stamp outruns the reader, and the document satisfies the
    /// companion of the reader's floor.
    AcceptedTolerantly {
        /// The reader's floor: its ceiling of that major.
        floor: u64,
    },
    /// The document is rejected, and here is why.
    Rejected(Rejection),
}

impl Verdict {
    /// Whether the document was accepted, strictly or tolerantly.
    ///
    /// ```
    /// use cogra_interchange::Verdict;
    ///
    /// assert!(Verdict::AcceptedTolerantly { floor: 0 }.is_accepted());
    /// ```
    pub fn is_accepted(&self) -> bool {
        matches!(
            self,
            Verdict::AcceptedStrictly { .. } | Verdict::AcceptedTolerantly { .. }
        )
    }
}

/// Why a document was rejected.
///
/// The first two arms are facts about the reader's state rather than about
/// the document: a state that grows over what the owner assigned turns
/// them toward acceptance. The third is a fact about the document, under
/// the instrument named.
///
/// ```
/// use cogra_interchange::{Rejection, Under};
///
/// let rejection = Rejection::UnassignedStamp { minor: 3, ceiling: 5 };
/// assert!(matches!(rejection, Rejection::UnassignedStamp { minor: 3, .. }));
/// assert_eq!(Under::Strict { minor: 1 }, Under::Strict { minor: 1 });
/// ```
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum Rejection {
    /// The reader holds no minor of this major.
    UnheldMajor {
        /// The major the document stamps.
        major: u64,
    },
    /// The stamp lies at or below the ceiling and was never assigned.
    UnassignedStamp {
        /// The minor the document stamps.
        minor: u64,
        /// The reader's ceiling of that major, which the stamp does not
        /// outrun.
        ceiling: u64,
    },
    /// The instrument governed, and the document did not satisfy it.
    Unsatisfied {
        /// Which instrument judged.
        under: Under,
        /// Every way the document failed it, in ascending key order.
        mismatches: Vec<Mismatch>,
    },
}

/// Which instrument a judgment ran under.
///
/// ```
/// use cogra_interchange::Under;
///
/// assert_ne!(Under::Strict { minor: 1 }, Under::Tolerant { floor: 1 });
/// ```
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Under {
    /// The theory held at the document's stamp.
    Strict {
        /// The stamped minor.
        minor: u64,
    },
    /// The open companion of the reader's floor.
    Tolerant {
        /// The floor whose companion judged.
        floor: u64,
    },
}

/// The verdict on a document at a reader's state.
///
/// Takes a [`Document`] and never bytes: a document exists only downstream
/// of a successful decode, so there is no signature through which
/// non-canonical bytes reach a verdict at all.
///
/// ```
/// use cogra_interchange::{
///     accept, Content, ContentKey, Coordinate, Document, Envelope, NamespaceLabel, Registry,
///     Theory, Value, Verdict, Version,
/// };
///
/// let label = NamespaceLabel::parse("com.example").expect("a label");
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 0, uint], 2 => tstr}"#)
///     .expect("an assignable theory");
/// let mut registry = Registry::new();
/// registry
///     .acquire(Coordinate::new(label.clone(), 1, 0), theory)
///     .expect("the first minor");
///
/// let mut content = Content::new();
/// content.insert(
///     ContentKey::new(2).expect("a content key"),
///     Value::Text("hello".to_owned().into()),
/// );
/// let document = Document::new(Envelope::new(label, Version::new(1, 0, 7)), content);
///
/// assert_eq!(accept(&registry, &document), Verdict::AcceptedStrictly { minor: 0 });
/// ```
pub fn accept(reg: &Registry, d: &Document) -> Verdict {
    match dispatch(reg, d.envelope()) {
        Instrument::Strict { minor, theory } => {
            settle(satisfies(d, theory), Under::Strict { minor }, || {
                Verdict::AcceptedStrictly { minor }
            })
        }
        Instrument::Tolerant { floor, companion } => settle(
            satisfies_open(d, companion),
            Under::Tolerant { floor },
            || Verdict::AcceptedTolerantly { floor },
        ),
        Instrument::Refused(RejectionCause::UnheldMajor) => {
            Verdict::Rejected(Rejection::UnheldMajor {
                major: d.envelope().version().major(),
            })
        }
        Instrument::Refused(RejectionCause::UnassignedStamp { ceiling }) => {
            Verdict::Rejected(Rejection::UnassignedStamp {
                minor: d.envelope().version().minor(),
                ceiling,
            })
        }
    }
}

/// Turn one judgment into the verdict its instrument gives it.
fn settle(judgment: Satisfaction, under: Under, accepted: impl FnOnce() -> Verdict) -> Verdict {
    match judgment {
        Satisfaction::Holds => accepted(),
        Satisfaction::Fails(mismatches) => {
            Verdict::Rejected(Rejection::Unsatisfied { under, mismatches })
        }
    }
}
