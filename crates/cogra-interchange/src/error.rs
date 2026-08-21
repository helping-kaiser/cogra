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
//! Seven leaf enums: four for the CBOR core and the envelope, one for a
//! refused theory, one for a refused acquisition, and one for the
//! `.regexp` seam, which a consumer meets inside [`TheoryError`] rather
//! than on its own. [`Error`] aggregates the six a consumer meets
//! directly, for callers that want a single arm from this crate.

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

/// A string refused as a namespace label.
///
/// Every variant but [`LabelError::TooFewAtoms`], which is a fact about
/// the whole string, carries a character position into the offered string.
///
/// ```
/// use cogra_interchange::{LabelError, NamespaceLabel};
///
/// let err = NamespaceLabel::parse("com.Example").expect_err("uppercase");
/// assert!(matches!(
///     err,
///     LabelError::BadCharacter {
///         position: 4,
///         found: 'E'
///     }
/// ));
/// ```
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum LabelError {
    /// Fewer than the two atoms every label carries — a bare word claims
    /// the root, which no label may.
    #[error("namespace label needs at least two atoms")]
    TooFewAtoms,
    /// An atom with no characters in it: a leading dot, a trailing dot, a
    /// doubled dot, or the empty string.
    #[error("empty atom at character {position}")]
    EmptyAtom {
        /// Where the empty atom begins.
        position: usize,
    },
    /// A character outside the alphabet of `a`–`z`, `0`–`9`, the hyphen,
    /// and the separating dot.
    #[error("character {found:?} at position {position} is outside the label alphabet")]
    BadCharacter {
        /// Where the character stands, counted in characters.
        position: usize,
        /// The character met.
        found: char,
    },
    /// An atom whose first or last character is a hyphen, which the ABNF
    /// admits only in an atom's interior.
    #[error("atom at position {position} begins or ends with a hyphen")]
    HyphenAtEdge {
        /// Where the offending atom begins.
        position: usize,
    },
    /// A string longer than the 255 bytes the Grammar's sentence allows.
    #[error("namespace label is {length} bytes, over the limit of 255")]
    TooLong {
        /// The length of the string offered, in bytes.
        length: usize,
    },
}

/// Bytes or a value refused as a document, or a prefix too short to carry
/// an envelope.
///
/// ```
/// use cogra_interchange::{EnvelopeError, Value, Version};
///
/// let err = Version::from_value(&Value::Unsigned(3)).expect_err("not a triple");
/// assert!(matches!(err, EnvelopeError::BadVersion));
/// ```
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum EnvelopeError {
    /// The prefix ended before the envelope did.
    #[error("prefix of {given} bytes is too short to carry an envelope")]
    Truncated {
        /// How many bytes were offered.
        given: usize,
        /// The least number of bytes that would let the read that ran out
        /// complete. What follows that read may need more still.
        needed_at_least: usize,
    },
    /// The value is not a map, so it is not a document.
    #[error("document is not a map")]
    NotAMap,
    /// A key outside the unsigned integers, which the key space excludes.
    #[error("key {key} is not an unsigned integer")]
    NonIntegerKey {
        /// A rendering of the offending key: its debug form where the key
        /// was decoded whole, its major type where only a head was read.
        key: String,
    },
    /// One of the two envelope keys is absent.
    #[error("key {key} is missing")]
    MissingKey {
        /// The key that is missing: 0 or 1.
        key: u64,
    },
    /// Key 0 holds a text string that is not a namespace label.
    #[error("key 0 does not hold a namespace label")]
    BadLabel(#[source] LabelError),
    /// Key 0 holds something that is not a text string at all.
    #[error("key 0 does not hold a text string")]
    BadLabelType,
    /// Key 1 holds something other than a three-element array of unsigned
    /// integers.
    #[error("key 1 does not hold a version triple")]
    BadVersion,
    /// A content key of 0 or 1, which the envelope owns.
    #[error("content key {key} is not greater than 1")]
    ReservedContentKey {
        /// The key offered.
        key: u64,
    },
    /// A head of the envelope prefix that preferred serialization refuses,
    /// or a label whose bytes are not valid UTF-8.
    #[error("envelope prefix is not canonically encoded at byte {offset}")]
    NonCanonicalPrefix {
        /// Where the offending head or byte stands.
        offset: usize,
    },
    /// Bytes offered as a document that are not a name of the data
    /// language at all.
    #[error("bytes are not a name of the data language")]
    NotCanonical(#[source] DecodeError),
}

/// CDDL refused as an assigned theory.
///
/// Every arm refuses a *source*, never a document: a theory that does not
/// parse, references a rule nothing defines, falls outside the assignable
/// fragment, or uses a control operator this implementation does not
/// evaluate is not the kind of thing `Theory::parse` takes. Whether a
/// document satisfies a theory is a verdict and travels as a value.
///
/// [`TheoryError::Unevaluable`] is a specified outcome rather than a
/// shortcut: whether a host processes a given theory's CDDL is the host's
/// policy, and a reader that will not process an assigned theory holds
/// neither it nor anything above it in that major.
///
/// ```
/// use cogra_interchange::{Theory, TheoryError};
///
/// let err = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => missing}"#)
///     .expect_err("nothing defines `missing`");
/// assert!(matches!(err, TheoryError::UnresolvedRule { ref name, line: 1 } if name == "missing"));
/// ```
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum TheoryError {
    /// The source is not acceptable CDDL.
    ///
    /// The parser's own refusals arrive here, and so do the two defects the
    /// grammar admits but a rule table cannot: a name defined twice with
    /// different expressions, which RFC 8610 §3.1 calls an error in as many
    /// words, and a generic instantiated at an arity its rule does not
    /// take. All three are located the same way, because a consumer
    /// reporting them cannot tell which pass raised them.
    #[error("CDDL syntax error at line {line}, column {column}: {detail}")]
    Syntax {
        /// 1-based line.
        line: u32,
        /// 1-based character column.
        column: u32,
        /// What was wrong, in a sentence.
        detail: String,
    },
    /// A reference to a rule the theory does not define and the standard
    /// prelude does not supply.
    ///
    /// A socket — a name beginning with `$` or `$$` — never lands here:
    /// RFC 8610 §3.9 makes an undefined socket the empty choice rather than
    /// a missing definition.
    #[error("unresolved rule reference {name:?} at line {line}")]
    UnresolvedRule {
        /// The reference as it was written.
        name: String,
        /// 1-based line of the reference.
        line: u32,
    },
    /// The theory parses and resolves, but is not a sentence of the
    /// assignable fragment.
    ///
    /// The detail opens with the line the refusal was located at: the
    /// variant carries no structured location of its own, and a fragment
    /// refusal without one would be unlocatable in a consumer's diagnostic.
    #[error("theory is not in the assignable fragment: {detail}")]
    NotInFragment {
        /// Which clause failed, and where.
        detail: String,
    },
    /// The theory uses a control operator outside the evaluable subset.
    ///
    /// Never raised for the *type* at a content key, which the fragment
    /// leaves free: a theory refused here is in the fragment and would be
    /// evaluable by an implementation covering more of the vocabulary.
    #[error("theory uses {operator}, which this implementation does not evaluate")]
    Unevaluable {
        /// The operator as it was written, leading dot included.
        operator: String,
    },
    /// A `.regexp` pattern the crate cannot use.
    #[error("`.regexp` pattern is not usable")]
    Regexp(#[from] RegexpError),
    /// Two theories offered for comparison differ in label or major.
    #[error("theories differ in label or major and are not comparable")]
    Incomparable,
}

/// A `.regexp` pattern the crate cannot use.
///
/// Two arms and no third: a pattern the engine reports as not well formed
/// under XML Schema rules, and a well-formed pattern the engine declines
/// for a reason of its own. There is no translation arm, because there is
/// no translator — the engine implements the XSD flavor itself.
///
/// Both arms carry the engine's own account rather than a location. The
/// engine's error type offers no position into the pattern, and inventing
/// one — reporting every refusal at character zero — would be a located
/// error in name only.
///
/// A pattern is compiled at `Theory::parse` and executed nowhere else, so
/// the compile-time variants are reached only through
/// [`TheoryError::Regexp`]; [`RegexpError::BudgetExhausted`] alone can
/// arise at match time, and it is a refusal, never an answer.
///
/// ```
/// use cogra_interchange::{RegexpError, Theory, TheoryError};
///
/// let err = Theory::parse(r#"e = {0 => "com.example", 1 => [0, 0, uint], 2 => tstr .regexp "[a-"}"#)
///     .expect_err("the character class is not closed");
/// assert!(matches!(err, TheoryError::Regexp(RegexpError::Malformed { .. })));
/// ```
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum RegexpError {
    /// The pattern is not a well-formed XSD regular expression.
    #[error("pattern is not a well-formed XSD regular expression: {detail}")]
    Malformed {
        /// The engine's account of what was wrong.
        detail: String,
    },
    /// A well-formed pattern the engine declined for a reason of its own.
    #[error("engine refused the pattern: {detail}")]
    EngineRefused {
        /// The engine's account of why it declined.
        detail: String,
    },
    /// A match that did not complete within the seam's operation budget.
    ///
    /// The budget counts matching operations, never time, so the same
    /// pattern, subject, and budget give the same outcome on every
    /// machine. This is the one failure the seam can raise at match time;
    /// the evaluator surfaces it as a located mismatch, never as a silent
    /// answer.
    #[error("pattern match exhausted the {budget}-operation budget")]
    BudgetExhausted {
        /// The budget that was in force.
        budget: usize,
    },
}

/// A theory refused at acquisition.
///
/// Every arm refuses a *mutation of the held state*, never a document: an
/// acquisition that would break downward-closed holding, permanence, the
/// additive-minor regime, or the restraint invariant is not the kind of
/// thing `Registry::acquire` takes. Whether a document is accepted is a
/// verdict and travels as a value.
///
/// Two arms carry a verdict's payload inside an error, and that is the
/// criterion's consequence rather than a breach of it: a theory that
/// breaks an invariant is not the kind of thing acquisition takes, and the
/// verdict explaining why is the error's detail.
///
/// ```
/// use cogra_interchange::{AcquireError, Coordinate, NamespaceLabel, Registry, Theory};
///
/// let theory = Theory::parse(r#"e = {0 => "com.example", 1 => [1, 4, uint], 2 => tstr}"#)
///     .expect("an assignable theory");
/// let label = NamespaceLabel::parse("com.example").expect("a label");
///
/// let mut registry = Registry::new();
/// let err = registry
///     .acquire(Coordinate::new(label, 1, 3), theory)
///     .expect_err("the theory pins minor 4, not the acquired minor 3");
/// assert!(matches!(err, AcquireError::PinMismatch { .. }));
/// ```
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum AcquireError {
    /// A minor at or below the major's ceiling, offered as new.
    ///
    /// Assignment proceeds in increasing minor order and a gap below an
    /// assigned minor is never filled, so a minor the ceiling has already
    /// passed is not an acquisition the held state can take.
    #[error("minor {minor} is not above the ceiling {ceiling}")]
    OutOfOrder {
        /// The minor offered.
        minor: u64,
        /// The greatest minor of that major already held.
        ceiling: u64,
    },
    /// The theory's own pins name a coordinate other than the acquired
    /// one.
    #[error("theory pins {found}, not the acquired coordinate")]
    PinMismatch {
        /// The label, major, and minor the theory pins, as it pins them.
        found: String,
    },
    /// The coordinate is held, and the theory offered for it is not the
    /// one held.
    ///
    /// Theories are never revised and never withdrawn: once a coordinate
    /// is assigned, its theory object is immutable. Offering the held
    /// theory again is not a change and is admitted.
    #[error("coordinate is already held under a different theory")]
    Immutable,
    /// The theory's model class is not included in the base theory's.
    #[error("theory does not extend the base theory: {detail}")]
    NotExtendingBase {
        /// Which of the base theory's positions the theory fails, and how.
        detail: String,
    },
    /// The theory does not extend the greatest held theory below it
    /// additively.
    #[error("minor inclusion fails against minor {against}")]
    InclusionViolated {
        /// The minor compared against: the greatest held below the one
        /// offered.
        against: u64,
        /// Every way the additive regime was broken, in ascending key
        /// order.
        breaches: Vec<crate::InclusionBreach>,
    },
    /// The theory admits a floating-point value, a tag, or a restrained
    /// simple value at a position that never names one.
    ///
    /// Refused outside a lenient registry, where a reader consuming a
    /// registry it does not own admits the theory and keeps the report.
    #[error("theory reaches a restrained value without naming it")]
    ImplicitReach {
        /// Every position that reaches a restrained value implicitly, and
        /// the path by which it reaches.
        reaches: Vec<crate::ImplicitReach>,
    },
}

/// One error type for consumers that want one.
///
/// A sum over the six enums a consumer meets directly, for a caller whose
/// own error type wants a single arm from this crate. Nothing here returns
/// it: the taxonomy stays a taxonomy, and the aggregate is a convenience
/// on top of it rather than a flattening of it.
///
/// ```
/// use cogra_interchange::{Error, LabelError, NamespaceLabel};
///
/// let refusal: LabelError = NamespaceLabel::parse("Com.Example").expect_err("uppercase");
/// let aggregated = Error::from(refusal);
/// assert!(matches!(aggregated, Error::Label(_)));
/// ```
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    /// A `Value` invariant refused at construction.
    #[error(transparent)]
    Value(#[from] ValueError),
    /// Bytes refused as a name of the data language.
    #[error(transparent)]
    Decode(#[from] DecodeError),
    /// A string refused as a namespace label.
    #[error(transparent)]
    Label(#[from] LabelError),
    /// A value refused as a document, or a prefix refused as an envelope.
    #[error(transparent)]
    Envelope(#[from] EnvelopeError),
    /// CDDL refused as an assigned theory.
    #[error(transparent)]
    Theory(#[from] TheoryError),
    /// A theory refused at acquisition.
    #[error(transparent)]
    Acquire(#[from] AcquireError),
}
