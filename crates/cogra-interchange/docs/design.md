# The Interchange Crate — Design

_Phase 2 of the standard engineering process: the design. The review of 2026-08-21 ratified it; implementation follows behind the Gate at the end._

This document is the ratified design for `crates/cogra-interchange`, the first-party CBOR and CDDL library whose concept closed in phase 1. It fixes the crate's module map, its complete public API surface at rustdoc level, its error taxonomy, its handling of the description language, the confinement of the one signed regex exception, the acceptance and dispatch surface, its dependencies with individual arguments, and a sized test plan; and it ends with the gate that implementation must discharge. It decides nothing the conventions decide: every design element traces to a label of the interchange conventions, and where the conventions could be read two ways, the reading is a Decision of this document, ruled at the review and recorded where its topic lives.

The document practices the labeling discipline: the label at each heading or environment head is that environment's mint; a parenthesized label in running text is a same-owner citation; material in fenced blocks and double-backtick spans is displayed without participating. Every label minted here has area `xchg`; the document title mints nothing. Same-owner citations reach the concept document's labels unprefixed, both documents being one owner. Imported citations use the provisional prefixes of the architecture document: `ICX` for the interchange conventions, `ARCH` for the linter architecture.

**Caveat (The process template rides a pending branch)** · `cav:xchg:process-template`

The repository-wide template at `docs/implementation/engineering-process.md` exists on a branch awaiting review ([PR #392](https://github.com/helping-kaiser/cogra/pull/392)) and is not yet on the mainline this document's branch stacks on. This document was therefore authored against the concept's phase plan (`preview:xchg:phase-plan`) — public API surface, module map, error taxonomy, dependency justifications, test plan sized — which the pending template row-for-row agrees with. If the template changes before it lands, this document reconciles to it then, not silently.

## Crate layout · `sec:xchg:layout`

**Decision (Home and layout)** · `dec:xchg:crate-layout`

The crate is `crates/cogra-interchange` in this workspace, library name `cogra_interchange`, one library target and no binary. It is a workspace member and a sibling of the linter (`[ARCH-dec:linter:crate-layout]`), not a child of it: it serves the whole project (`formul:xchg:purpose`), and the linter is one consumer among several (`sig:xchg:consumers`). Edition and toolchain follow the workspace; no crate features exist in version 1, which is what (`req:xchg:std-only`) buys — no `no_std` feature, no serde feature, no optional dependency, so there is exactly one build configuration to test.

**Model (Module map)** · `model:xchg:module-map`

```text
src/
  lib.rs        crate root: re-exports, crate-level rustdoc, the conventions trace
  value.rs      Value, Negative, Float, Simple, Bytes, Text, Array, Map;
                canonical ordering; validating constructors; iterative teardown
  encode.rs     the canonical encoder — total, no failure mode
  decode.rs     the validating decoder — refuses everything outside the data language
  label.rs      NamespaceLabel and its ABNF scanner (hand-written, no regex)
  version.rs    Version, Coordinate, the ordering
  envelope.rs   Envelope, Document, Content, ContentKey, MAX_ENVELOPE_PREFIX, peek
  cddl/
    mod.rs      Theory, OpenTheory, the public description-language surface
    lex.rs      tokenizer over the ABNF of RFC 8610 Appendix B
    ast.rs      the CDDL syntax tree
    parse.rs    recursive-descent parser onto ast
    resolve.rs  rule table, reference resolution, generics, sockets and plugs
    fragment.rs assignable-fragment membership
    eval.rs     satisfaction: a Value matched against a resolved type
    control.rs  control-operator dispatch; unevaluable operators refuse
    companion.rs open-companion derivation
    inclusion.rs minor inclusion, key by key
    restraint.rs the restraint report over an assigned theory
    print.rs    normalized CDDL printing, for diagnostics and companion display
  regexp.rs     the only module that names the regex library
  registry.rs   Registry, acquisition, ceilings, holding, refusal
  accept.rs     dispatch, Instrument, Verdict, accept
  error.rs      the whole thiserror taxonomy
tests/          integration tests and the vector corpora
fuzz/           audit-phase targets; absent from the version-1 tree
```

**Remark (Where a crate split would fall)** · `rem:xchg:split-lines`

The module boundaries are drawn where a future crate split would fall, on the principle the linter's layout already adopts (`[ARCH-dec:linter:crate-layout]`). Three cuts are pre-drawn: `value` + `encode` + `decode` is a self-contained deterministic CBOR core with no knowledge of envelopes; `cddl/` is a self-contained description-language implementation whose only dependency on the core is the `Value` type it matches against; and `label` + `version` + `envelope` + `registry` + `accept` is the conventions layer that binds the two. The `regexp` seam is a leaf of `cddl/`. Nothing in the core knows what a namespace label is, and nothing in `cddl/` knows what a registry is — which is why either could leave without dragging the rest.

## The data language · `sec:xchg:data-language`

**Signature (Value model)** · `sig:xchg:value-model`

One type denotes every structure of the admitted data model (`[ICX-lang:interchange:data-language]`). Its invariant is that every inhabitant is a member of the data language: there is no non-canonical `Value`.

```rust
/// A structure of the data language.
///
/// Every inhabitant has exactly one name ([`Value::to_canonical_bytes`]),
/// and byte equality of names decides equality of structures.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub enum Value {
    /// Major type 0: an integer in `[0, 2^64)`.
    Unsigned(u64),
    /// Major type 1: an integer in `[-2^64, -1]`.
    Negative(Negative),
    /// Major type 2.
    Bytes(Bytes),
    /// Major type 3, valid UTF-8 by construction.
    Text(Text),
    /// Major type 4.
    Array(Array),
    /// Major type 5, canonically ordered and duplicate-free by construction.
    Map(Map),
    /// Major type 6.
    Tag(Tag),
    /// Major type 7, simple values `false` and `true`.
    Bool(bool),
    /// Major type 7, simple value `null`.
    Null,
    /// Major type 7, every other simple value — restrained.
    Simple(Simple),
    /// Major type 7, floating point — restrained.
    Float(Float),
}

impl Value {
    /// Build an integer, choosing major type 0 or 1 by sign.
    pub fn integer(v: i128) -> Result<Value, ValueError>;
    /// The value's canonical name. Total.
    pub fn to_canonical_bytes(&self) -> Vec<u8>;
    /// Append the canonical name to `out`. Total.
    pub fn write_canonical(&self, out: &mut Vec<u8>);
    /// The length of the canonical name, without producing it.
    pub fn canonical_len(&self) -> usize;
    /// Decode one canonical name; trailing bytes are an error.
    pub fn from_canonical_bytes(bytes: &[u8]) -> Result<Value, DecodeError>;
    /// Decode one canonical name from the head, returning the bytes consumed.
    pub fn from_canonical_prefix(bytes: &[u8]) -> Result<(Value, usize), DecodeError>;
}
```

The four newtypes exist exactly where an invariant lives, and nowhere else — `Array` is a plain sequence with no invariant of its own beyond its elements, and carries a newtype only for the teardown duty of (`impl:xchg:iterative-teardown`).

```rust
/// A major-type-1 integer, held as its encoded argument `n`, denoting `-1 - n`.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub struct Negative(u64);
impl Negative {
    pub const fn from_argument(n: u64) -> Negative;
    pub fn from_i128(v: i128) -> Result<Negative, ValueError>;
    pub const fn argument(self) -> u64;
    pub const fn get(self) -> i128;
}

/// A byte string.
#[derive(Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Default)]
pub struct Bytes(Box<[u8]>);
impl Bytes { pub fn as_slice(&self) -> &[u8]; pub fn into_vec(self) -> Vec<u8>; }
impl From<Vec<u8>> for Bytes {}
impl AsRef<[u8]> for Bytes {}

/// A text string, valid UTF-8 by construction.
#[derive(Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Default)]
pub struct Text(Box<str>);
impl Text { pub fn as_str(&self) -> &str; pub fn into_string(self) -> String; }
impl From<String> for Text {}
impl TryFrom<Vec<u8>> for Text { type Error = ValueError; }

/// A sequence.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Default)]
pub struct Array(Vec<Value>);
impl Array {
    pub fn new(items: impl IntoIterator<Item = Value>) -> Array;
    pub fn as_slice(&self) -> &[Value];
    pub fn into_vec(self) -> Vec<Value>;
    pub fn len(&self) -> usize;
    pub fn is_empty(&self) -> bool;
}
impl FromIterator<Value> for Array {}

/// A map whose entries stand in the bytewise-lexicographic order of their
/// encoded keys, keys pairwise distinct.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Default)]
pub struct Map(Vec<(Value, Value)>);
impl Map {
    /// Sort into canonical order and refuse duplicate keys.
    pub fn new(entries: impl IntoIterator<Item = (Value, Value)>) -> Result<Map, ValueError>;
    pub fn get(&self, key: &Value) -> Option<&Value>;
    pub fn iter(&self) -> impl Iterator<Item = (&Value, &Value)> + '_;
    pub fn into_entries(self) -> Vec<(Value, Value)>;
    pub fn len(&self) -> usize;
    pub fn is_empty(&self) -> bool;
}

/// A tagged item — restrained.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Tag { number: u64, item: Box<Value> }
impl Tag {
    pub fn new(number: u64, item: Value) -> Tag;
    pub const fn number(&self) -> u64;
    pub fn item(&self) -> &Value;
    pub fn into_item(self) -> Value;
}

/// A simple value other than `false`, `true`, and `null` — restrained.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Simple(u8);
impl Simple {
    pub const UNDEFINED: Simple = Simple(23);
    /// Refuses 20, 21, and 22, which have their own variants, and refuses
    /// 24 through 31, which no well-formed encoding produces.
    pub fn new(value: u8) -> Result<Simple, ValueError>;
    pub const fn get(self) -> u8;
}
```

**Decision (`Value` is exhaustive)** · `dec:xchg:value-exhaustive`

`Value` carries no `#[non_exhaustive]`. Its eleven variants are the closed set CBOR's major types define, and a consumer's `match` over the value model is meant to handle them completely — where the attribute would force a wildcard arm on every downstream match (verified against the Rust Reference, 2026-08-20), paid against a future variant the format makes unlikely. The attribute stays on every error enum and every verdict enum (`sig:xchg:error-taxonomy`), where new variants genuinely are expected.

**Decision (Floats are carried as canonical bits)** · `dec:xchg:float-bits`

A float is held as the width and bit pattern of its shortest §4.2 form, never as a bare `f64`.

```rust
/// A floating-point value in the canonical form §4.2 fixes for it — restrained.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Float { width: FloatWidth, bits: u64 }

#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum FloatWidth { Half, Single, Double }

impl Float {
    pub const CANONICAL_NAN: Float;
    /// Reduces to the shortest form preserving the value.
    pub fn from_f64(v: f64) -> Result<Float, ValueError>;
    pub fn to_f64(self) -> f64;
    pub const fn width(self) -> FloatWidth;
}
```

Three consequences, each load-bearing. First, `Value` derives `Eq` and `Hash`, which a bare `f64` field forbids, and the derivation is honest: two floats are equal exactly when their names are equal, which is what (`[ICX-metathm:interchange:unique-names]`) asserts of structures generally. Second, the canonical reduction happens once, at construction, so encoding stays total. Third, the ordering falls out: `FloatWidth` in the order Half, Single, Double is the order of the heads `0xf9`, `0xfa`, `0xfb`, and within a width the right-aligned bits compare as the big-endian argument does, so the derived `Ord` on `Float` already is the bytewise order of names. Which bit patterns `from_f64` accepts is (`dec:xchg:nan-policy`).

**Decision (One canonical NaN)** · `dec:xchg:nan-policy`

`Float::CANONICAL_NAN` is the single NaN of the data language: `from_f64` accepts it and refuses every other NaN bit pattern with `ValueError::NonCanonicalFloat`. §4.2 leaves the choice to the protocol — one with no intent to support NaN payloads or signaling NaNs "needs to pick a single representation, typically `0xf97e00`" — and this is the pick. Nothing is normalized silently on the way in: quiet normalization would mean `from_f64(x).to_f64() != x`, a determinism trap of exactly the kind (`req:xchg:determinism`) exists to close, and it would hide from the caller that the value it handed over is not the value the crate holds. Preserving payloads, each its own structure, is refused for the opposite reason — it multiplies names for structures nothing in this project needs. Two neighbouring questions are settled by (`[ICX-metathm:interchange:unique-names]`) rather than here: an integer and a float of equal magnitude are distinct structures, and negative zero is distinct from zero.

**Invariant (Canonical by construction)** · `inv:xchg:canonical-by-construction`

Every `Value` is a member of the data language. The invariant is carried by three validating constructors and nothing else: `Map::new` sorts and refuses duplicates, `Text` refuses invalid UTF-8, and `Float::from_f64` reduces to the shortest form. Every other variant is canonical for every inhabitant of its payload type. This is the whole of (`req:xchg:determinism`) on the encoding side: the encoder has no canonicity decision left to make, because none survived construction, and so `to_canonical_bytes` has no failure mode and no `Result`. Non-determinism is unrepresentable rather than checked for, exactly as the concept requires.

**Proposition (Canonical order is major-type order)** · `prop:xchg:canonical-order`

`Ord` on `Value` is defined to be the bytewise-lexicographic order of canonical names, and is implemented directly rather than derived. The reason it can be implemented directly, without encoding, is that the byte order decomposes: each major type occupies its own thirty-two-byte block of initial bytes, the argument classes 24 through 27 sit at `0x18` through `0x1b` inside that block, and within one class the arguments are big-endian of equal length — the same three facts the demonstration of (`[ICX-metathm:interchange:bounded-determination]`) uses for unsigned integers, applied to every major type. So the comparator is: major type first, then argument class, then argument, then payload, recursing into elements and entries. Major type 1 compares by its argument `n`, which is why `Negative` holds `n` and not the value it denotes. The implementation is not trusted on the strength of this paragraph: it is the subject of a property obligation in (`tab:xchg:metatheorem-tests`), asserting that `a.cmp(b)` and `a.to_canonical_bytes().cmp(&b.to_canonical_bytes())` agree on generated pairs.

**Signature (Encoding and decoding)** · `sig:xchg:codec`

Encoding is a method on `Value` (`sig:xchg:value-model`) and has no free-function form; there is one encoder and no options to pass it. Decoding is likewise a constructor. The asymmetry in their signatures is the design: `to_canonical_bytes` returns `Vec<u8>`, `from_canonical_bytes` returns `Result<Value, DecodeError>`.

The decoder validates, in one pass, everything membership requires: preferred serialization at every head, no indefinite-length item of any major type, map keys sorted bytewise-lexicographically on their encoded forms and pairwise distinct, floating-point values in shortest form, text strings valid UTF-8, and no trailing bytes after the single item. Each failure carries the byte offset at which it was detected (`conv:xchg:located-errors`). Sortedness and distinctness are checked without re-encoding: the decoder retains the byte range of each encoded key as it goes and compares adjacent ranges, so an *n*-entry map costs *n* comparisons, not *n* encodings.

**Convention (Decoding refuses, never repairs)** · `conv:xchg:refuse-never-repair`

There is no canonicalizing decode, no lenient mode, no feature flag, and no constructor that takes bytes and returns a repaired value. The conventions are explicit that this is not an ergonomic choice: bytes outside the data language "denote no structure", and a non-canonical input "is not a defective document to be repaired ... but no document at all, at any ceiling" (`[ICX-def:interchange:acceptance]`). The crate has no vocabulary for the repaired thing because the conventions have none. Consumers that hold non-canonical bytes hold bytes, and the crate's only answer about them is a `DecodeError`.

**Decision (Text strings are valid UTF-8)** · `dec:xchg:utf8-policy`

The decoder refuses a major-type-3 item whose payload is not valid UTF-8, with `DecodeError::InvalidUtf8` located at the offending byte. `Text` holding `Box<str>` is what lets `NamespaceLabel` be a string type at all (`sig:xchg:label-api`), and admitting invalid UTF-8 would put a second text representation in the value model beside it, with the encoder having to choose between them. The caveat rides with the decision rather than waiting to be discovered: RFC 8949 makes UTF-8 validity a validity question and not a well-formedness one, and §4.2 says nothing about it, so this is the one place the crate is deliberately stricter than the letter of the document the data language is defined against.

**Implementation remark (Iterative teardown)** · `impl:xchg:iterative-teardown`

`Value` is a recursive type, so the compiler's derived drop glue recurses to the nesting depth of the value, and a deeply nested value produced by a hostile input would overflow the stack while being freed — after decoding succeeded, in code that never asked to touch it. The remedy is an iterative teardown: `Drop` implemented on `Array`, `Map`, and `Tag` — every variant that owns a `Value` — dismantling with an explicit worklist rather than by recursion, with `into_vec`, `into_entries`, and `into_item` as the escape hatches `Drop` otherwise closes. `Value` itself implements no `Drop`, so destructuring it in a pattern stays legal. Every walk over a value is iterative for the same reason — the decoder, `Drop`, `Ord` (`prop:xchg:canonical-order`), and, since the audit closed the hazard the remark once named, `Clone`, `PartialEq`, and `Hash` (explicit-stack post-order rebuild for the clone, worklists for the comparisons): a recursive walk would reopen the overflow on hostile depth that the iterative discipline exists to close (`dec:xchg:nesting-policy`). The evaluator's descent into a value and the CDDL parser's recursion are bounded by explicit depth limits rather than made iterative, each returning a verdict or a located error instead of overflowing.

**Decision (No nesting bound)** · `dec:xchg:nesting-policy`

The decoder bounds nesting depth nowhere: depth is bounded by the length of the input and by nothing else, and membership stays exact. A bound, however generous, would refuse a legal name — and unlike a theory the crate cannot evaluate, for which the conventions supply a refusal clause and a truncation rule, the data language offers none: membership is exact. The price is paid in the implementation rather than in the specification: every recursive walk in the crate, teardown included, is written iteratively (`impl:xchg:iterative-teardown`), and the one-million-deep property of (`tab:xchg:metatheorem-tests`) is what keeps that honest instead of aspirational.

## The envelope · `sec:xchg:envelope`

**Signature (Namespace labels)** · `sig:xchg:label-api`

```rust
/// A namespace label: two or more dot-separated atoms over `a`–`z` and `0`–`9`,
/// hyphens interior only, at most 255 bytes.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct NamespaceLabel(Box<str>);

impl NamespaceLabel {
    pub fn parse(s: &str) -> Result<NamespaceLabel, LabelError>;
    pub fn as_str(&self) -> &str;
    /// The atoms, left to right: the descent of the rooted tree.
    pub fn atoms(&self) -> impl Iterator<Item = &str> + '_;
    /// The label with its last atom removed, when two or more remain.
    pub fn parent(&self) -> Option<NamespaceLabel>;
    /// Whether authority over `self` confers authority over `other`.
    pub fn is_prefix_of(&self, other: &NamespaceLabel) -> bool;
}
impl FromStr for NamespaceLabel { type Err = LabelError; }
impl fmt::Display for NamespaceLabel {}
impl AsRef<str> for NamespaceLabel {}
impl TryFrom<&str> for NamespaceLabel { type Error = LabelError; }
```

`parse` is a hand-written character scanner over the ABNF of (`[ICX-gram:interchange:label-grammar]`), some dozens of lines, with no regular-expression engine anywhere near it — the signed exception is scoped to the `.regexp` operator (`[ARCH-dec:linter:cddl-regexp-library]`), not to the crate, so everywhere else in it the tokenizing rule stands unamended (`[ARCH-dec:linter:no-regex]`). The grammar is normative for shape and the ABNF is what is implemented; the length bound of 255 bytes comes from that Grammar's own sentence, not from the schema's `.size`. `is_prefix_of` is atom-wise, not byte-wise: `com.exa` is not a prefix of `com.example`, and the accessor exists because the Grammar makes the tree's prefix authority a real relation rather than a metaphor.

**Convention (Two recognizers, one language)** · `conv:xchg:two-recognizers`

The crate recognizes namespace labels twice by two independent routes, and this is deliberate rather than redundant. `NamespaceLabel::parse` implements the ABNF. The base theory (`[ICX-schema:interchange:global]`) recognizes the same shape through `namespace-form`, a `.regexp` pattern evaluated by the seam of (`sec:xchg:regexp`), and that route runs whenever the base theory is applied to a document. The conventions themselves say which governs — "the `.regexp` operationalizes the shape fixed by the ABNF ..., which is normative for shape where the two could be read to differ" — so the ABNF scanner is the authority and the pattern is the operationalization. The two agreeing is a checkable fact, and (`verif:xchg:label-pattern-crosscheck`) checks it.

**Signature (Versions and coordinates)** · `sig:xchg:version-api`

```rust
/// A version triple, ordered lexicographically by major, then minor, then patch.
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Version { major: u64, minor: u64, patch: u64 }

impl Version {
    pub const fn new(major: u64, minor: u64, patch: u64) -> Version;
    pub const fn major(self) -> u64;
    pub const fn minor(self) -> u64;
    pub const fn patch(self) -> u64;
    pub fn to_value(self) -> Value;
    pub fn from_value(v: &Value) -> Result<Version, EnvelopeError>;
}

/// An assignable coordinate: a label, a major, a minor. Patch does not occur.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Coordinate { label: NamespaceLabel, major: u64, minor: u64 }

impl Coordinate {
    pub fn new(label: NamespaceLabel, major: u64, minor: u64) -> Coordinate;
    pub fn label(&self) -> &NamespaceLabel;
    pub const fn major(&self) -> u64;
    pub const fn minor(&self) -> u64;
}
```

The field declaration order of `Version` is load-bearing: Rust's derived `Ord` compares struct fields in declaration order, so major-then-minor-then-patch *is* the lexicographic order (`[ICX-def:interchange:versions]`) fixes, and no hand-written comparator is needed. That `Coordinate` has no patch field is the API-level form of (`[ICX-inv:interchange:patch-identity]`): patch is not part of any coordinate, so there is no place in the registry's key for it to be mistakenly consulted.

**Signature (Documents and content)** · `sig:xchg:document-api`

```rust
/// A content key: an unsigned integer strictly greater than 1.
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ContentKey(u64);
impl ContentKey {
    pub fn new(key: u64) -> Result<ContentKey, EnvelopeError>;
    pub const fn get(self) -> u64;
}

/// The content of a document: its restriction to the keys above 1.
#[derive(Clone, Debug, PartialEq, Eq, Hash, Default)]
pub struct Content(BTreeMap<u64, Value>);
impl Content {
    pub fn new() -> Content;
    pub fn insert(&mut self, key: ContentKey, value: Value) -> Option<Value>;
    pub fn get(&self, key: u64) -> Option<&Value>;
    pub fn keys(&self) -> impl Iterator<Item = u64> + '_;
    pub fn iter(&self) -> impl Iterator<Item = (u64, &Value)> + '_;
    pub fn len(&self) -> usize;
    pub fn is_empty(&self) -> bool;
}

/// The envelope: the namespace label at key 0 and the version at key 1.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Envelope { label: NamespaceLabel, version: Version }
impl Envelope {
    pub fn new(label: NamespaceLabel, version: Version) -> Envelope;
    pub fn label(&self) -> &NamespaceLabel;
    pub const fn version(&self) -> Version;
    pub fn peek(prefix: &[u8]) -> Result<(Envelope, usize), EnvelopeError>;
}

/// A document of the data language.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct Document { envelope: Envelope, content: Content }
impl Document {
    /// Total: every argument is already validated.
    pub fn new(envelope: Envelope, content: Content) -> Document;
    pub fn from_canonical_bytes(bytes: &[u8]) -> Result<Document, EnvelopeError>;
    pub fn to_canonical_bytes(&self) -> Vec<u8>;
    pub fn envelope(&self) -> &Envelope;
    pub fn content(&self) -> &Content;
    pub fn to_value(&self) -> Value;
    pub fn try_from_value(v: &Value) -> Result<Document, EnvelopeError>;
}
```

`Content` is `BTreeMap<u64, Value>` and not a `Map`, for a reason the conventions supply: content keys are unsigned integers, and bytewise-lexicographic order on the canonical names of unsigned integers coincides with numeric order — proved in the demonstration of (`[ICX-metathm:interchange:bounded-determination]`) — so `BTreeMap`'s iteration order already *is* canonical map order, and the encoder can walk it straight out. That `Content` is keyed by `ContentKey` on the way in and by `u64` on the way out is deliberate: the invariant is enforced where values enter, and lookups by a literal are ergonomic.

`Document::new` is total, which is the envelope's share of (`req:xchg:determinism`): a document assembled through the API is in the data language by the types of its parts, with no assembly-time check to forget. The prose definition of a document — a map, unsigned-integer keys throughout, key 0 a namespace label, key 1 a version (`[ICX-lang:interchange:data-language]`) — is exactly the shape of the struct, so the struct is the definition and `try_from_value` is the only place the definition is checked.

`to_value` materializes the map view that satisfaction consumes. The cost is one allocation per check; avoiding it means teaching the evaluator to walk a `Document` directly, which is a deferred optimization, not a version-1 concern.

**Bound (The 296-byte prefix)** · `bound:xchg:prefix-bound`

```rust
/// The greatest number of bytes `Envelope::peek` reads.
pub const MAX_ENVELOPE_PREFIX: usize = 296;
```

The constant is the bound (`[ICX-metathm:interchange:bounded-determination]`) derives — a map head of at most 9, key 0 at 1, a label at 2 + 255, key 1 at 1, and a version of a 1-byte array head plus three uint heads of at most 9 — and the crate makes it an API guarantee rather than an incidental property. `Envelope::peek` reads the map head, key 0 and its label, key 1 and its version, and stops, returning the bytes consumed; the return value is what the obligation in (`tab:xchg:metatheorem-tests`) asserts against the constant. `peek` validates preferred serialization on every head it reads and requires the first two keys to be 0 and 1 in that order, which is what makes its answer agree with a full decode's whenever a full decode succeeds. A prefix too short to carry the envelope is `EnvelopeError::Truncated { needed_at_least }`, not a rejection.

**Caveat (Prefix dispatch certifies no membership)** · `cav:xchg:prefix-caveat`

`Envelope::peek` and `dispatch_prefix` (`sig:xchg:verdict-api`) answer which instrument governs a document; they do not answer whether the bytes are a document. A byte sequence with a well-formed envelope and a non-canonical tail is not in the data language at all, and the crate's verdict on it is a `DecodeError` reached through `Document::from_canonical_bytes` — never a `Verdict`. The prefix path exists because the conventions single out this exact coexistence — "nothing beyond the envelope need be examined before the document's governing instrument is known" — and it is the routing decision that is early, never the acceptance. Every rustdoc paragraph on the prefix path says so.

## Theories and the description language · `sec:xchg:theories`

**Decision (Full parse, documented evaluation)** · `dec:xchg:cddl-coverage`

The parser implements the CDDL grammar of RFC 8610 entire, as the ABNF of that document's Appendix B gives it; the evaluator implements a documented subset of the control-operator vocabulary, and a theory using anything outside it is refused rather than approximated.

The asymmetry is forced by the conventions, read closely. The description language is "CDDL (RFC 8610) entire", narrowing the operator vocabulary "nowhere" (`[ICX-lang:interchange:description-language]`), and the assignable fragment is "structural, not lexical" — it constrains the top-level map rule and nothing below a content key, where "the type at a content key is any type of the description language, control operators of the registry included" (`[ICX-gram:interchange:assignable-fragment]`). So fragment membership is a question about the whole parsed theory, and the key-by-key identity comparison of (`[ICX-inv:interchange:minor-inclusion]`) compares "the expression together with every rule it references" — neither is answerable over a theory the crate could not parse. Parsing must therefore be complete.

Evaluation need not be, and the conventions say so in the same Grammar: "Whether a host processes a given theory's CDDL is the host's policy, not the fragment's: a reader that will not process an assigned theory holds neither it nor anything above it in that major — refusal truncates, preserving downward-closed holding". A gap in the evaluator is thus a first-class, specified outcome and not a shortcut, provided it surfaces as refusal at acquisition and never as a silent pass. Which operators the version-1 evaluator covers is (`dec:xchg:evaluable-subset`).

**Decision (The evaluable subset)** · `dec:xchg:evaluable-subset`

The version-1 evaluator implements ten control operators of RFC 8610 §3.8: `.size` and `.regexp`; the numeric comparisons `.gt`, `.ge`, `.lt`, and `.le`; the equalities `.eq` and `.ne`; and `.default` and `.bits`. The four that remain — `.cbor`, `.cborseq`, `.within`, and `.and` — refuse with `TheoryError::Unevaluable`, named in the message, at `Theory::parse`.

The ten cover what a plausible envelope theory writes, and each is individually small; the three the conventions themselves employ are among them. `.cbor` and `.cborseq` are held back for a reason of substance rather than of budget: they nest the data language inside itself, and whether the nested item must itself be canonical is a question the conventions do not answer — one that wants a ruling of its own before an evaluator answers it by accident. Refusal is the specified outcome and not a shortcut: a reader that will not process an assigned theory holds neither it nor anything above it in that major (`[ICX-gram:interchange:assignable-fragment]`), which `Registry::refuse` (`sig:xchg:registry-api`) is the API form of.

**Signature (Theory surface)** · `sig:xchg:theory-api`

```rust
/// An assigned theory: a sentence of the assignable fragment, parsed,
/// resolved, and evaluable. Immutable.
#[derive(Clone, Debug)]
pub struct Theory { /* private */ }

impl Theory {
    /// Parse, check fragment membership, resolve every reference, compile
    /// every `.regexp` pattern, and verify every control operator is one
    /// this crate evaluates. Every failure mode is a `TheoryError`.
    pub fn parse(source: &str) -> Result<Theory, TheoryError>;
    /// The source as given, byte for byte.
    pub fn source(&self) -> &str;
    /// The label pinned at key 0.
    pub fn label(&self) -> &NamespaceLabel;
    /// The major and minor pinned at key 1; patch is free.
    pub fn coordinate(&self) -> (u64, u64);
    /// The content keys the theory enumerates, in ascending key order.
    pub fn slots(&self) -> impl Iterator<Item = KeySlot<'_>> + '_;
    pub fn slot(&self, key: u64) -> Option<KeySlot<'_>>;
    /// The open companion. Derived, total, and of a different type.
    pub fn open_companion(&self) -> OpenTheory;
    /// Which positions of this theory reach a restrained value, and how.
    pub fn restraint(&self) -> RestraintReport;
    /// Normalized CDDL, for diagnostics and for structural comparison.
    pub fn to_cddl(&self) -> String;
}

/// One enumerated content key of an assigned theory.
#[derive(Copy, Clone, Debug)]
pub struct KeySlot<'a> { /* private */ }
impl<'a> KeySlot<'a> {
    pub fn key(&self) -> ContentKey;
    pub fn required(&self) -> bool;
    pub fn type_source(&self) -> &'a str;
}

/// The open companion of an assigned theory: the minor position freed to
/// `uint`, the closure replaced by the base theory's wildcard, nothing else
/// moved. Derived, never assigned — no registry accepts this type.
#[derive(Clone, Debug)]
pub struct OpenTheory { /* private */ }
impl OpenTheory {
    pub fn floor(&self) -> (u64, u64);
    pub fn label(&self) -> &NamespaceLabel;
    pub fn to_cddl(&self) -> String;
}

/// The base theory, satisfied by every document before any assignment is
/// consulted. Constitutionally prior: reached without dispatch.
pub fn global() -> &'static BaseTheory;

#[derive(Debug)]
pub struct BaseTheory { /* private */ }
```

That `OpenTheory` is a type distinct from `Theory`, and that `Registry::acquire` takes a `Theory`, is how the crate enforces "Open(S) is derived, never assigned — it enters no registry" (`[ICX-def:interchange:open-companion]`). The clause is not a runtime check that could be forgotten; it is a signature that does not typecheck.

**Decision (The CDDL printers are public)** · `dec:xchg:public-printer`

`Theory::to_cddl` and `OpenTheory::to_cddl` are public. They exist internally for diagnostics and for the companion comparison of (`alg:xchg:companion`), and a diagnostic that cannot show the theory a document failed against is a poor diagnostic; a consumer telling a reader which instrument governed wants the same text. The cost is a committed output, and the rustdoc bounds it: what these print is normalized CDDL rather than the source, and its exact shape is not stable across versions, so a consumer diffing it against a stored string relies on something the crate does not promise. `Theory::source` is what that consumer wants instead, and it returns the source byte for byte.

**Judgment (Satisfaction, total after acquisition)** · `judg:xchg:satisfaction-total`

```rust
/// The outcome of `d ⊨ S`. Structural only: it inspects the shape and values
/// of `d` against `S` and nothing else.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Satisfaction { Holds, Fails(Vec<Mismatch>) }

impl Satisfaction { pub fn holds(&self) -> bool; }

/// One way a document failed a theory, located by content key where the
/// failure has one.
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub struct Mismatch { /* key, expected type source, what was found */ }

pub fn satisfies(d: &Document, s: &Theory) -> Satisfaction;
pub fn satisfies_open(d: &Document, s: &OpenTheory) -> Satisfaction;
pub fn satisfies_global(d: &Document) -> Satisfaction;
```

No `Result` appears, and the absence is the design. Every way satisfaction could fail to *compute* — unparseable source, a theory outside the fragment, a `.regexp` pattern that will not compile, a control operator the evaluator does not implement — is caught by `Theory::parse` and surfaces as a `TheoryError` there. By the time a `Theory` exists, evaluation is total: the document is finite, the theory is finite, and every pattern in it was compiled — not executed — at parse time (`dec:xchg:regexp-seam`). Two boundedness facts carry the claim past its naive reading, both measured during implementation. A non-productive rule cycle — `a = b`, `b = a` — parses, resolves, and sits in the fragment, and finiteness of the theory alone does not stop a walk through it; the evaluator carries a visited set, under which such a rule denotes no value. And a `.regexp` match runs under the seam's deterministic operation budget, whose exhaustion is the judgment's one runtime refusal, rendered as a located mismatch and never as an answer (`req:xchg:regexp-guard`). Failing to satisfy is then never an error but a negative judgment, which is what (`[ICX-judg:interchange:satisfaction]`) says it is.

One evaluation detail is settled by the fragment rather than by us. In general CDDL, matching a map against a group carrying both explicit entries and a wildcard is a search; here the assignable fragment pins every content key to a literal unsigned integer, so each map entry has at most one explicit entry it can match and the remainder falls to the wildcard — matching is deterministic, and the fragment's structural restriction is what buys it. The precise matching rules to implement are RFC 8610 Appendix C together with the cut semantics of its §3.5.4, verified against that document at implementation rather than inferred here.

**Algorithm (Assignable-fragment membership)** · `alg:xchg:fragment-check`

Run over the parsed and resolved theory, refusing with a located `TheoryError` at the first failure. The clauses are exactly the fragment's own (`[ICX-gram:interchange:assignable-fragment]`) together with the extension conditions of (`[ICX-sig:interchange:theory-assignment]`):

1. Exactly one top-level map rule is the theory's root.
2. Key 0 is present, pinned to a text-string literal, and that literal parses as a namespace label by `NamespaceLabel::parse`.
3. Key 1 is present, pinned to a three-element array whose first two elements are literal unsigned integers and whose third is `uint` — the patch position free, and free in that exact shape.
4. Every remaining entry has a literal unsigned-integer key strictly greater than 1, with optionality marked or not; keys are pairwise distinct.
5. The map is closed: no wildcard, no `* key => value` entry, no unwrapped group extending it.
6. The type at each content key is any type of the description language, and is not constrained further.

Clause 6 is the one that must be written down as a *non*-check: the fragment restricts the constructor vocabulary nowhere, so a membership checker that rejects an exotic type at a content key is wrong, not strict. The evaluator may refuse such a theory (`dec:xchg:cddl-coverage`), and that refusal is a different verdict at a different place, reported as `TheoryError::Unevaluable` and never as `TheoryError::NotInFragment`.

**Algorithm (Minor inclusion, key by key)** · `alg:xchg:inclusion-check`

```rust
/// The outcome of the additive-minor check between two assigned theories.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Inclusion { Holds, Violated(Vec<InclusionBreach>) }

#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum InclusionBreach {
    /// A content key of the earlier theory is absent from the later one.
    KeyDropped { key: ContentKey },
    /// A shared key's type is not identical.
    TypeChanged { key: ContentKey, earlier: String, later: String },
    /// A shared key's requiredness is not identical.
    RequirednessChanged { key: ContentKey, earlier: bool, later: bool },
    /// A key new at the later minor is not optional.
    NewKeyRequired { key: ContentKey },
}

/// Check that `later` extends `earlier` additively. Both must be assigned
/// theories of the same label and major, with `earlier`'s minor the lesser.
pub fn check_inclusion(earlier: &Theory, later: &Theory) -> Result<Inclusion, TheoryError>;
```

The check is exactly the invariant's (`[ICX-inv:interchange:minor-inclusion]`): every content key of the earlier theory appears in the later one with its type and its requiredness verbatim, and every key new at the later minor is optional. `Inclusion::Violated` is a verdict, not an error; the `Result` wrapper carries only the mismatched-coordinate case, where the two theories are not comparable at all.

Two design facts, one of them a flag. The first: the registry checks only against the greatest held theory below the acquired minor, not against every lower one, and this is sound because "verbatim" composes — a key carried verbatim from *m* to *m′* and verbatim from *m′* to *m″* is carried verbatim from *m* to *m″*, and a key optional when new stays optional wherever it later appears, which is what (`[ICX-metathm:interchange:conservativity]`) records. The transitivity is a property obligation, not an assertion (`tab:xchg:metatheorem-tests`).

The second is an ambiguity in the conventions, ruled rather than papered over: "identity of type — the expression together with every rule it references" admits a literal reading and a reading about the type rather than its spelling. The reading is fixed by (`dec:xchg:type-identity`), and the checker cannot be written without it.

**Decision (Identity of type is literal)** · `dec:xchg:type-identity`

The comparison is over expression trees, with rule references matched by name and same-named rules required to be identical. A theory writing `2 => colour` where its predecessor wrote `2 => color`, with identical definitions standing behind both names, is therefore no additive minor: a pure rule rename between minors is a major boundary (`[ICX-law:interchange:major-boundary]`).

It is what the sentence says; it is cheap and obviously decidable, where comparison up to renaming is a bisimulation over two rule graphs; and its failure mode is the conservative one — it calls a rename major, and major "permits breakage; it does not invite it" (`[ICX-warn:interchange:lower-bound]`), where the looser reading risks admitting as a minor something the invariant meant to exclude. The cost is real and belongs in the rustdoc of `check_inclusion` rather than only here: an owner who renames a rule between minors is told to bump major, which is stricter than the invariant's intent, and the rustdoc says so in those words rather than leaving the owner to infer it from a failure.

**Algorithm (Open-companion derivation)** · `alg:xchg:companion`

`Theory::open_companion` is a pure, total rewrite of the parsed theory with exactly two edits and no third: the second element of the array pinned at key 1 becomes `uint`, and the base theory's wildcard `* (uint .gt 1) => any` is added to the map, the enumerated content keys staying exactly as they stand with their types and their requiredness (`[ICX-def:interchange:open-companion]`). Because the derivation is a rewrite of an already-parsed tree, "nothing else moves" is checkable by comparison rather than by inspection: the obligation in (`tab:xchg:test-sizing`) re-prints both theories and asserts that the companion's printed form differs from the assigned theory's in exactly those two places. The companion is derived once per acquisition and memoized on the major line for the current ceiling, which keeps `dispatch` allocation-free; the memo is not the registry R, which is a map from coordinates to assigned theories and into which no companion is ever placed.

One semantic fact of the derivation is flagged for the conventions' owner rather than decided here, found by the evaluator's tests: because S's enumerated entries use the non-cut `=>`, an *optional* key whose value fails the enumerated type falls through to the companion's wildcard under RFC 8610 §3.5.4 — `? 2 => tstr` under Open(S) admits an integer at key 2 — while a required key still binds, since a required entry that finds no member fails its group outright. If tolerant validation is meant to bind optional keys' types too, the derivation must add a cut to the enumerated keys, which is a change to (`[ICX-def:interchange:open-companion]`)'s two-edit contract, not to the evaluator.

**Signature (Restraint report)** · `sig:xchg:restraint-api`

```rust
/// Where an assigned theory reaches a floating-point value, a tag, or a
/// simple value other than `false`, `true`, and `null`.
#[derive(Clone, Debug, PartialEq, Eq, Default)]
pub struct RestraintReport { /* private */ }

impl RestraintReport {
    pub fn is_restrained(&self) -> bool;
    pub fn provisions(&self) -> impl Iterator<Item = &Provision> + '_;
    pub fn implicit_reaches(&self) -> impl Iterator<Item = &ImplicitReach> + '_;
}

/// An explicit provision, and whether it fixes the canonical form of what
/// it admits.
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub struct Provision { /* key, kind admitted, canonical form fixed or not */ }

/// A position admitting a restrained value without naming it — through
/// `any`, through an unrestricted major-type reference, or through a
/// prelude type that reaches one.
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub struct ImplicitReach { /* key, the path by which it reaches */ }
```

The report is where (`[ICX-inv:interchange:restraint]`) becomes machine-visible: the invariant governs what an *assigned theory* admits, not what the data language contains, so the enforcement point is a theory and not a `Value`. The type system carries the invariant's other half — every restrained kind is reachable in `Value` only through a variant that names it, `Float`, `Tag`, or `Simple`, with `Simple::new` refusing the three trivially admitted values so that they cannot arrive by that door — which makes "restrained" a visible property of a match arm rather than a fact to remember. A theory with a non-empty `implicit_reaches` is refused at acquisition (`dec:xchg:restraint-enforcement`); the report is computed either way.

**Decision (Restraint is enforced at acquisition)** · `dec:xchg:restraint-enforcement`

`Registry::acquire` refuses a theory whose `RestraintReport` carries any implicit reach, with `AcquireError::ImplicitReach` carrying the findings. Acquisition is the one place the invariant (`[ICX-inv:interchange:restraint]`) has a checkable subject — an assigned theory, whole and resolved — and refusing there keeps a position that admits a float through `any` out of the held state entirely, rather than discovering it document by document.

A reader consuming a registry it does not own builds it through `Registry::lenient` (`sig:xchg:registry-api`), which computes the same report and admits: such a reader did not write the theories and cannot fix them, and refusing there would leave it unable to route documents it is obliged to route. For it the invariant sits where allocation and meaning preservation already sit, with the owner (`[ICX-cav:interchange:governance-obligations]`).

Enforcement at satisfaction time — failing a float that arrives at a key typed `any` — is refused outright, and this is the load-bearing half of the decision: it would change L(S) relative to plain CDDL and so contradict the conventions' own "CDDL entire" (`[ICX-lang:interchange:description-language]`), making the crate's satisfaction judgment a different relation from the one the conventions define.

One question rides along unruled, and the implementer raises it rather than answering it in passing: what "fixes the canonical form of what it admits" requires of an explicit provision. §4.2.2 makes the choices concrete — whether tags are required or forbidden, how negative zero and subnormals are handled, whether integral-valued floats may be written as integers — and `Provision` carries the flag whichever way it is settled.

## The `.regexp` seam · `sec:xchg:regexp`

**Decision (One module names the engine)** · `dec:xchg:regexp-seam`

`src/regexp.rs` is the only module in the crate that names the regular-expression library, and the only file in the repository outside which the signed exception (`[ARCH-dec:linter:cddl-regexp-library]`) does not reach. It stays one file, so that replacing the engine behind it is a one-file change (`dec:xchg:regexp-engine`). Its whole surface is crate-internal:

```rust
/// A compiled XSD regular expression, as `.regexp` means it.
pub(crate) struct XsdPattern { /* private */ }

impl XsdPattern {
    /// Compile a pattern under XML Schema rules. The pattern is compiled
    /// here and executed nowhere, so a pattern this crate cannot use is
    /// refused at `Theory::parse` rather than at match time.
    pub(crate) fn compile(pattern: &str) -> Result<XsdPattern, RegexpError>;

    /// Whether the pattern matches the whole of `text`, within the seam's
    /// deterministic operation budget. XSD regular expressions are
    /// implicitly anchored at head and tail, so there is no partial-match
    /// method here and never will be; exhaustion of the budget is
    /// `RegexpError::BudgetExhausted`, a refusal and never an answer.
    pub(crate) fn is_match(&self, text: &str) -> Result<bool, RegexpError>;

    /// The pattern as given, for diagnostics.
    pub(crate) fn source(&self) -> &str;
}
```

Three methods and nothing wider is what confines the exception. Two properties are required of whatever stands behind them, and they are requirements on the seam rather than descriptions of one crate: the engine compiles a pattern without executing it, and it implements the XSD flavor itself, so that this crate holds a wrapper and never a translator. What follows from the second is that `is_match` has no partial-match sibling and no anchoring parameter — whole-string matching is not something the seam does to the engine's answer (`conv:xchg:regexp-anchoring`).

**Decision (The engine is regexml)** · `dec:xchg:regexp-engine`

The engine is `regexml` 0.2.2 (verified on crates.io 2026-08-20), a pure-Rust port of the regular-expression engine of Saxon, entered through its `Regex::xsd(pattern)` constructor — and never through `Regex::xpath`, whose XPath `fn:matches` semantics are a substring search and would accept subjects `.regexp` rejects, silently and by construction. The seam's `compile` is that constructor and nothing else.

`.regexp` is defined against the XSD flavor, and this engine implements that flavor natively, under the XML Schema 1.1 Appendix G rules, tested against W3C's own `qt3tests`. Whole-string matching, `^` and `$` as ordinary characters, character-class subtraction, and the multi-character escapes `\i`, `\I`, `\c`, and `\C` are the engine's own semantics rather than this crate's rewrites. So the crate carries no translation layer and carves out no XSD subset: a pattern arriving inside a published theory is compiled as the standard defines it, or refused, with nothing between the two. Conformance is standard-conformance from the first commit rather than a subset that grows when a published theory demands it.

The alternative shape — a linear-time mainstream engine with a translator in front of it — is refused because the translator would be first-party code standing between two standards, and every divergence of (`rep:xchg:xsd-divergences`) is a place where it could quietly match a different language than either. What the choice costs is the engine's runtime guarantee, and that cost is carried explicitly by (`req:xchg:regexp-guard`) rather than absorbed.

Measured against the shipped engine (0.2.2, verified in code 2026-08-21), two of this decision's premises needed repair, and both are repaired by the pinned fork the crate depends on — ruled 2026-08-21, the upstream exposure filed as Paligo/regexml#15, the dependency repointing at crates.io when it merges and releases. First, anchoring: the engine's published matcher is a substring search even in XSD mode, the anchored whole-string matcher existing inside it unexported; no in-dialect rewrite can supply anchoring (XSD has no anchor characters to write) and the span check stays refused (`ansatz:xchg:span-checked-regex`), so the fork exposes the internal anchored matcher as `is_full_match`. Second, the runtime: under correct anchored matching the exponential shapes are real — `(a+)+b` against thirty characters measured 761 seconds, where the unanchored search's early exits had masked it at microseconds — so the guard's pre-authorized remedy stands as the fork's second patch: a deterministic operation-count budget threaded through the one choke point every backtracking step crosses (empirically ×16 operations per four subject characters on the exponential shape — the counter sees the blowup where it happens). The budget counts operations and never time, so a verdict is machine-independent; the seam calls `is_full_match_bounded` with a calibrated constant (measured: the conventions' own pattern costs 253 operations to accept a 56-character label, 1017 to reject one; the constant leaves two orders of magnitude of headroom and refuses the exponential shapes in milliseconds), and exhaustion surfaces as its own refusal — `RegexpError::BudgetExhausted`, which the evaluator renders as a located mismatch, never as a silent answer. Two lesser qualifications, recorded: compilation runs one probe match against the empty string, so "compiles without executing" holds only up to that probe; and the engine's conformance suite is the XPath superset's, its own source noting the XSD mode is less tested — one more reason the guard requirement and the crosscheck property exist.

**Requirement (Characterize the engine's runtime)** · `req:xchg:regexp-guard`

A Saxon-derived engine backtracks, so no linear-time bound in the length of the subject is available by construction, and the implementation phase owes a characterization rather than an assumption: measure `regexml`'s behavior on the pathological shapes — nested quantifiers over an alternation, `(a+)+b` and its relatives — against subjects sized to expose blowup, and record the finding in the crate's own documentation beside (`rep:xchg:xsd-divergences`). Should the measurements show unbounded behavior, a match budget stands at the seam (`dec:xchg:regexp-seam`) before the crate ships; how exhaustion of that budget surfaces — which `RegexpError` variant, and what becomes of `is_match`'s signature — is settled together with the budget and is not guessed at here.

The exposure this bounds is narrow, and stating it exactly is what keeps the duty proportionate: patterns execute only out of theories a reader deliberately acquired, so acquisition is the trust boundary (`sig:xchg:registry-api`), and every pattern reaching the engine was taken into the held state by the reader's own act. This is not an unauthenticated-input surface, which is why a budget is contingent on the measurement rather than mandatory ahead of it.

**Report (XSD divergences)** · `rep:xchg:xsd-divergences`

RFC 8610 §3.8.3 defines `.regexp` against the XSD flavor — verified against the RFC on 2026-08-20: "a text string given as a target needs to match the XML Schema Definition (XSD) regular expression given as a value in the control type", chosen over PCRE because "there is no normative reference for PCREs that could be used in the present document". XSD regular expressions differ from the Perl-descended dialect every mainstream engine implements, in ways that are not stylistic. The architecture recorded the duty to verify and record rather than absorb; this is the finding it asked for, and it is larger than the phrase "anchoring behavior being the classic divergence" suggests.

*Anchoring.* XSD implicitly anchors at head and tail — the W3C text states that unlike Perl and the standard Unix utilities, "the regular expression language defined here implicitly anchors all regular expressions at the head and tail, as the most common use of regular expressions in pattern is to match entire literals." Mainstream engines search unanchored by default.

*`^` and `$`.* Because anchoring is implicit, XSD does not make `^` and `$` metacharacters at all: outside a character class they are ordinary characters matching themselves. In the Perl-descended dialect they are anchors. A pattern containing a literal dollar sign therefore means two different things in the two dialects.

*Character-class subtraction.* XSD has `[a-z-[aeiou]]`; the Perl-descended dialect has no such construct and would read it as a class containing a `[`.

*Multi-character escapes.* XSD defines `\i`, `\I`, `\c`, and `\C` for the XML name-start and name characters. No mainstream engine has them, and one meeting them reads four ordinary escapes or refuses.

*Absent constructs.* XSD has no backreferences, no lookaround, and no lazy quantifiers. The first two are alignments rather than gaps against an engine that also lacks them. The third is a divergence in the dangerous direction: `a*?` is not a lazy quantifier in XSD, so an engine that reads it as one accepts a pattern XSD would reject and matches a different language.

These divergences are the argument for an XSD-native engine (`dec:xchg:regexp-engine`): each is a place where a Perl-descended engine reads a valid XSD pattern as a different language, and the last runs in the dangerous direction, accepting what XSD rejects. The four claims are verified verbatim against the W3C primary text — XSD 1.0 Appendix F and XSD 1.1 Appendix G both — on 2026-08-20, the absence of lazy quantifiers resting on the closed grammar productions rather than on a prohibition sentence, which is the evidence the specification offers. This report ships in the crate's own documentation, which is where the architecture's recording duty puts it (`[ARCH-dec:linter:cddl-regexp-library]`).

**Convention (Whole-string matching is the engine's, never a span check)** · `conv:xchg:regexp-anchoring`

XSD anchors implicitly at head and tail, and that is the engine's own semantics under `Regex::xsd`: no pattern is rewritten on the way in, and the seam has no anchoring code to get wrong. What must never be introduced is the alternative — running an engine unanchored, finding a match, and comparing its span against the subject's length. The span check is wrong, and the reason is recorded here so that no later reader reaches for it: leftmost-first engines return the first alternative that matches at the leftmost position, so the pattern `a|ab` against the subject `ab` yields a match of span 0 to 1, and a span check rejects a subject that XSD accepts through the second alternative.

**Verification (The conventions' own pattern)** · `verif:xchg:label-pattern-crosscheck`

The conventions ship exactly one `.regexp` pattern, `namespace-form` in the base theory (`[ICX-schema:interchange:global]`), and it is the crate's standing cross-check. It uses only character classes, `?`, `*`, `+`, an escaped dot, and grouping — every one of which means the same thing in both dialects, so the crate's own base theory reads identically whatever engine stands behind the seam. The obligation: for generated strings over the label alphabet together with the dot and a selection of near-miss characters, `NamespaceLabel::parse` succeeds exactly when the base theory's `namespace-form` matches. This discharges the architecture's verification duty concretely, "for the patterns the corpus's schemas actually use", on the only pattern the corpus's schemas currently contain — and it will discharge it for the next pattern too, because the check is written over the theory rather than over a hard-coded string.

## Registry and acceptance · `sec:xchg:acceptance`

**Signature (Registry)** · `sig:xchg:registry-api`

```rust
/// A reader's registry state: assigned coordinates with their immutable
/// theory objects, holding downward-closed within each major.
#[derive(Clone, Debug, Default)]
pub struct Registry { /* private */ }

impl Registry {
    pub fn new() -> Registry;

    /// A registry that admits a theory reaching a restrained value
    /// implicitly, rather than refusing it, for a reader consuming a
    /// registry it does not own. Every other refusal stands.
    pub fn lenient() -> Registry;

    /// Take a published theory into the held state. Refuses out-of-order
    /// acquisition, a theory whose pins disagree with the coordinate, a
    /// theory not extending the base theory, a re-acquisition that would
    /// change an already-held theory object, a minor-inclusion breach
    /// against the greatest held theory below, and — outside a lenient
    /// registry — an implicit reach to a restrained value.
    pub fn acquire(&mut self, coord: Coordinate, theory: Theory) -> Result<(), AcquireError>;

    /// Acquire an ordered sequence, one coordinate at a time, stopping at
    /// the first refusal and reporting it. Coordinates taken before the
    /// refusal stay held. A convenience over `acquire` with no semantics of
    /// its own.
    pub fn acquire_all(
        &mut self,
        theories: impl IntoIterator<Item = (Coordinate, Theory)>,
    ) -> Result<(), AcquireError>;

    /// Decline a major from a minor upward. Refusal truncates: nothing at or
    /// above `from_minor` is held thereafter, and the ceiling falls.
    pub fn refuse(&mut self, label: &NamespaceLabel, major: u64, from_minor: u64);

    /// The greatest minor held of this major, if any is held.
    pub fn ceiling(&self, label: &NamespaceLabel, major: u64) -> Option<u64>;
    pub fn holds(&self, coord: &Coordinate) -> bool;
    pub fn holds_major(&self, label: &NamespaceLabel, major: u64) -> bool;
    pub fn theory(&self, coord: &Coordinate) -> Option<&Theory>;
    pub fn minors(&self, label: &NamespaceLabel, major: u64) -> impl Iterator<Item = u64> + '_;

    /// The greatest held coordinate of this label: what an emitter targets.
    pub fn target(&self, label: &NamespaceLabel) -> Option<Coordinate>;

    /// The least held minor of this major whose theory this content
    /// satisfies: what an emitter stamps.
    pub fn stamp(&self, label: &NamespaceLabel, major: u64, content: &Content) -> Option<u64>;
}
```

`refuse` is the API form of the host-policy clause (`[ICX-gram:interchange:assignable-fragment]`): a reader that will not process an assigned theory holds neither it nor anything above it, and truncation is what preserves downward-closed holding. The natural caller is a consumer whose `Theory::parse` returned `TheoryError::Unevaluable`, and the rustdoc says so.

Absence below the ceiling is knowledge and not ignorance (`[ICX-def:interchange:acceptance]`), so the representation must not conflate the two: a major line is a strictly increasing vector of held minors, complete for that major below its ceiling, and `holds` is a binary search over it. A minor missing below the ceiling was never assigned. Gaps are possible and permanent, because assignment proceeds in increasing minor order and "a gap below an assigned minor is never filled" (`[ICX-sig:interchange:theory-assignment]`).

**Decision (Acquisition takes a sequence)** · `dec:xchg:registry-loading`

`Registry::acquire_all` takes an ordered sequence of coordinate-and-theory pairs and acquires them one at a time, stopping at the first refusal and reporting it — the loop every real consumer would otherwise write, carrying no semantics `acquire` does not already have. It is expressly not a file format, a manifest, or a fetch: how a consumer comes by published theory material is governance, and governance is outside this crate (`conv:xchg:out-of-scope`).

**Decision (The registry owns its theories)** · `dec:xchg:theory-sharing`

`Registry` owns its `Theory` objects and hands out `&Theory`; a consumer wanting a registry on another thread clones the registry. No known consumer (`sig:xchg:consumers`) shares one across threads, and the move to `Arc<Theory>` — which permanence makes the natural shape whenever one does (`[ICX-inv:interchange:permanence]`) — is source-compatible for every accessor that returns `&Theory`, so it is recorded future work rather than a version-1 cost.

**Algorithm (Stamping)** · `alg:xchg:stamping`

`Registry::stamp` returns the least held minor of the major whose theory the content satisfies, where satisfaction is tested against the content class **L₂** rather than the whole document — the notion (`[ICX-ntn:interchange:ground-terms]`) exists for exactly this, since the whole document's key 1 pins the very minor being sought. The set of satisfying minors is upward closed, because L₂(R(ℓ, M, m)) ⊆ L₂(R(ℓ, M, m′)) for m < m′ (`[ICX-inv:interchange:minor-inclusion]`), so the least element is found by binary search over the held minors rather than by a linear scan. The optimization rests on an invariant rather than on an assumption, and the obligation in (`tab:xchg:metatheorem-tests`) checks the binary search against a linear scan over generated registry states, which is the cheap way to notice if it ever stops resting on it.

**Signature (Dispatch and verdict)** · `sig:xchg:verdict-api`

Acceptance is two acts, because the conventions make it two: choosing the governing instrument from the envelope and the held state, and applying it.

```rust
/// The instrument governing a document, chosen from its envelope and the
/// held state alone.
#[derive(Debug)]
pub enum Instrument<'r> {
    /// The stamp is held: the strict verdict is `d ⊨ R(ℓ, M, m)`.
    Strict { minor: u64, theory: &'r Theory },
    /// The stamp outruns the ceiling: the tolerant verdict is
    /// `d ⊨ Open(R(ℓ, M, m₁))`.
    Tolerant { floor: u64, companion: &'r OpenTheory },
    /// No instrument: the document is rejected whole.
    Refused(RejectionCause),
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum RejectionCause {
    /// No minor of this major is held.
    UnheldMajor,
    /// The stamp lies at or below the ceiling and was never assigned:
    /// a checkably false claim.
    UnassignedStamp { ceiling: u64 },
}

/// Choose the governing instrument.
pub fn dispatch<'r>(reg: &'r Registry, env: &Envelope) -> Instrument<'r>;

/// Choose the governing instrument from at most `MAX_ENVELOPE_PREFIX` bytes.
/// Certifies nothing about data-language membership.
pub fn dispatch_prefix<'r>(reg: &'r Registry, prefix: &[u8])
    -> Result<Instrument<'r>, EnvelopeError>;

/// The disposition of a document at a reader.
#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum Verdict {
    AcceptedStrictly { minor: u64 },
    AcceptedTolerantly { floor: u64 },
    Rejected(Rejection),
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum Rejection {
    UnheldMajor { major: u64 },
    UnassignedStamp { minor: u64, ceiling: u64 },
    Unsatisfied { under: Under, mismatches: Vec<Mismatch> },
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Under { Strict { minor: u64 }, Tolerant { floor: u64 } }

impl Verdict { pub fn is_accepted(&self) -> bool; }

/// The verdict on a document at a reader's state.
pub fn accept(reg: &Registry, d: &Document) -> Verdict;
```

`accept` takes a `&Document` and not bytes, which is the type system carrying (`conv:xchg:refuse-never-repair`): a `Document` exists only downstream of a successful decode, so there is no signature through which non-canonical bytes reach a verdict at all. The two-act split gives the bounded-prefix property a home of its own: `dispatch_prefix` is R10's "decidable from the bounded envelope prefix" made into a callable thing rather than a fact about the implementation, and the obligation in (`tab:xchg:metatheorem-tests`) asserts that it agrees with `dispatch` on the full envelope.

**Decision (`dispatch_prefix` is public)** · `dec:xchg:prefix-public`

`dispatch_prefix` is part of the public surface. It is R10's bounded-envelope clause made callable, and the metatheorem behind it exists to be relied on in transit: a property whose subject is crate-private is testable but not usable, and a consumer routing a document before reading its tail is exactly the consumer the clause was written for. It is also the one API through which a routing answer can be mistaken for an acceptance, so its rustdoc carries the caveat (`cav:xchg:prefix-caveat`) in full rather than pointing at it.

**Convention (Rejection is a verdict)** · `conv:xchg:rejection-is-a-verdict`

`accept` returns a `Verdict` and never an `Err`. A rejected document is not an error condition: it is an answer, and the conventions treat it as one — "rejection for an unheld major is a fact about the state, not about the document" (`[ICX-def:interchange:acceptance]`), and a state that grows turns rejections into acceptances (`[ICX-metathm:interchange:acceptance-monotonicity]`). An API that returned `Err` for a rejection would invite the `?` operator to discard the distinction between "this reader does not hold that major yet" and "these bytes are not a document", which are the two most different answers the crate gives. The same convention governs `Satisfaction` and `Inclusion`: each is an enum with a negative arm carrying located detail, never a `Result` (`crit:xchg:error-or-verdict`).

## Errors · `sec:xchg:errors`

**Criterion (Error against verdict)** · `crit:xchg:error-or-verdict`

One test decides which surface a failure belongs to. If the input is not the kind of thing the operation takes, it is an **error** and travels in `Err`. If the input is exactly the kind of thing the operation takes and the answer is negative, it is a **verdict** and travels as a value.

Errors, therefore: bytes that are not a name of the data language; a string that is not a namespace label; a value that is not a document; CDDL that does not parse, does not lie in the assignable fragment, or the crate cannot evaluate; a registry mutation that would break downward-closed holding or permanence; a prefix too short to carry an envelope; a construction violating a `Value` invariant. Verdicts, therefore: `Verdict::Rejected`, `Satisfaction::Fails`, `Inclusion::Violated`, and the findings of a `RestraintReport`.

**Signature (Error taxonomy)** · `sig:xchg:error-taxonomy`

Seven leaf enums and one aggregate over the six a consumer meets directly — `RegexpError` arrives inside `TheoryError` — all in `error.rs`, all derived with `thiserror`. Each is `#[non_exhaustive]`, so a later variant is not a breaking change; each implements `std::error::Error` and is `Send + Sync + 'static`, which is what makes them usable as trait objects and what the API guidelines call the most useful signature (verified against the Rust API Guidelines, C-GOOD-ERR, 2026-08-20); each `Display` message is lowercase and unpunctuated, per the same guideline.

```rust
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum ValueError {
    #[error("duplicate map key at entry {index}")]
    DuplicateMapKey { index: usize },
    #[error("byte string is not valid UTF-8 at byte {offset}")]
    InvalidUtf8 { offset: usize },
    #[error("integer {value} lies outside the CBOR integer range")]
    IntegerOutOfRange { value: i128 },
    #[error("simple value {value} is not constructible here")]
    ReservedSimpleValue { value: u8 },
    #[error("floating-point value is not in the admitted canonical form")]
    NonCanonicalFloat,
}

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum DecodeError {
    #[error("input ends inside an item at byte {offset}")]
    Truncated { offset: usize },
    #[error("{count} bytes remain after the item at byte {offset}")]
    TrailingBytes { offset: usize, count: usize },
    #[error("head at byte {offset} is not the shortest form for its argument")]
    NonPreferredHead { offset: usize },
    #[error("indefinite-length item at byte {offset}")]
    IndefiniteLength { offset: usize },
    #[error("map keys out of canonical order at byte {offset}")]
    UnsortedMapKeys { offset: usize },
    #[error("duplicate map key at byte {offset}")]
    DuplicateMapKey { offset: usize },
    #[error("floating-point value at byte {offset} is not in shortest form")]
    NonShortestFloat { offset: usize },
    #[error("ill-formed head at byte {offset}")]
    IllFormed { offset: usize },
    #[error("text string at byte {offset} is not valid UTF-8")]
    InvalidUtf8 { offset: usize },
}

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum LabelError {
    #[error("namespace label needs at least two atoms")]
    TooFewAtoms,
    #[error("empty atom at character {position}")]
    EmptyAtom { position: usize },
    #[error("character {found:?} at position {position} is outside the label alphabet")]
    BadCharacter { position: usize, found: char },
    #[error("atom at position {position} begins or ends with a hyphen")]
    HyphenAtEdge { position: usize },
    #[error("namespace label is {length} bytes, over the limit of 255")]
    TooLong { length: usize },
}

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum EnvelopeError {
    #[error("prefix of {given} bytes is too short to carry an envelope")]
    Truncated { given: usize, needed_at_least: usize },
    #[error("document is not a map")]
    NotAMap,
    #[error("key {key} is not an unsigned integer")]
    NonIntegerKey { key: String },
    #[error("key {key} is missing")]
    MissingKey { key: u64 },
    #[error("key 0 does not hold a namespace label")]
    BadLabel(#[source] LabelError),
    #[error("key 0 does not hold a text string")]
    BadLabelType,
    #[error("key 1 does not hold a version triple")]
    BadVersion,
    #[error("content key {key} is not greater than 1")]
    ReservedContentKey { key: u64 },
    #[error("envelope prefix is not canonically encoded at byte {offset}")]
    NonCanonicalPrefix { offset: usize },
    #[error("bytes are not a name of the data language")]
    NotCanonical(#[source] DecodeError),
}

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum TheoryError {
    #[error("CDDL syntax error at line {line}, column {column}: {detail}")]
    Syntax { line: u32, column: u32, detail: String },
    #[error("unresolved rule reference {name:?} at line {line}")]
    UnresolvedRule { name: String, line: u32 },
    #[error("theory is not in the assignable fragment: {detail}")]
    NotInFragment { detail: String },
    #[error("theory uses {operator}, which this implementation does not evaluate")]
    Unevaluable { operator: String },
    #[error("`.regexp` pattern is not usable")]
    Regexp(#[from] RegexpError),
    #[error("theories differ in label or major and are not comparable")]
    Incomparable,
}

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum RegexpError {
    #[error("pattern is not a well-formed XSD regular expression: {detail}")]
    Malformed { detail: String },
    #[error("engine refused the pattern: {detail}")]
    EngineRefused { detail: String },
}

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum AcquireError {
    #[error("minor {minor} is not above the ceiling {ceiling}")]
    OutOfOrder { minor: u64, ceiling: u64 },
    #[error("theory pins {found}, not the acquired coordinate")]
    PinMismatch { found: String },
    #[error("coordinate is already held under a different theory")]
    Immutable,
    #[error("theory does not extend the base theory: {detail}")]
    NotExtendingBase { detail: String },
    #[error("minor inclusion fails against minor {against}")]
    InclusionViolated { against: u64, breaches: Vec<InclusionBreach> },
    #[error("theory reaches a restrained value without naming it")]
    ImplicitReach { reaches: Vec<ImplicitReach> },
}

/// One error type for consumers that want one.
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum Error {
    #[error(transparent)] Value(#[from] ValueError),
    #[error(transparent)] Decode(#[from] DecodeError),
    #[error(transparent)] Label(#[from] LabelError),
    #[error(transparent)] Envelope(#[from] EnvelopeError),
    #[error(transparent)] Theory(#[from] TheoryError),
    #[error(transparent)] Acquire(#[from] AcquireError),
}
```

`Registry` derives `Clone`, which is what the ruled sharing model (`dec:xchg:theory-sharing`) asks of it: a consumer wanting a registry on another thread clones it. `Instrument` and `Under` are exhaustive as sketched — they are the dispatch's instruments, not verdicts, and their arms are the acceptance definition's own closed set; `#[non_exhaustive]` stays on the verdict and error enums, where growth is genuinely expected.

The composite operations compose the taxonomy rather than flattening it: `Document::from_canonical_bytes` surfaces `EnvelopeError`, with `NotCanonical` carrying the decoder's located refusal as its source — bytes outside the data language and a canonical value that is not a document are different answers, and the arm keeps them distinguishable. `BadLabel` carries the scanner's refusal of an offered string; `BadLabelType` covers a key-0 value that offers no string at all. `ReservedContentKey` is raised by `ContentKey::new` — inside `try_from_value` keys 0 and 1 are consumed as the envelope before content is read, so no content key at or below 1 can reach it there.

`AcquireError::InclusionViolated` carries a `Vec<InclusionBreach>` — a verdict's payload riding inside an error — and that is not a violation of (`crit:xchg:error-or-verdict`) but its consequence: a theory that breaks the invariant is not the kind of thing `acquire` takes, and the verdict explaining why is the error's detail. `AcquireError::ImplicitReach` carries the restraint report's findings for the same reason (`dec:xchg:restraint-enforcement`). The standalone `check_inclusion` (`alg:xchg:inclusion-check`) returns the verdict as a verdict, for the owner's tooling, which is the surface that wants to look at a breach without failing, and `Theory::restraint` does the same for the report.

`RegexpError` has two arms and no third. `Malformed` is the pattern the engine reports as not well-formed under XML Schema rules, located where the engine locates it; `EngineRefused` is a well-formed pattern the engine declines for a reason of its own. There is no translation arm because there is no translator (`dec:xchg:regexp-engine`), and a budget arm arrives with the budget, if the measurement demands one (`req:xchg:regexp-guard`).

**Convention (Every error is located)** · `conv:xchg:located-errors`

Every `DecodeError` carries a byte offset into the input; every `TheoryError::Syntax` carries a line and column into the CDDL source; every `LabelError` carries a character position; every `Mismatch` and `InclusionBreach` carries the content key it concerns. The consumer that makes this non-negotiable is the linter (`sig:xchg:consumers`), whose own requirement is that a parse error is "a hard, located diagnostic — never a silently skipped region" (`[ARCH-req:linter:diagnostics-not-panics]`); an unlocated error from this crate would become an unlocatable diagnostic there. `anyhow` appears nowhere: it is the right tool for a binary and the wrong one for a library, and the repository's error rule names both for that reason.

## Dependencies · `sec:xchg:dependencies`

**Table (Dependencies)** · `tab:xchg:dependencies`

Versions verified against docs.rs on 2026-08-20 and to be re-verified at implementation start, per the build-from-official-sources rule.

| Crate | Version | Kind | Role |
| --- | --- | --- | --- |
| thiserror | 2.0.20 | runtime | the derive behind every enum of (`sig:xchg:error-taxonomy`) |
| regexml | 0.2.2 | runtime | the XSD-flavor engine of (`dec:xchg:regexp-engine`), behind the seam of (`dec:xchg:regexp-seam`) and nowhere else |
| proptest | 1.11.0 | dev | the property obligations of (`tab:xchg:metatheorem-tests`) |
| cargo-fuzz, libfuzzer-sys, arbitrary | audit phase | dev | the fuzz targets of (`preview:xchg:fuzz-plan`), absent from the version-1 tree |

**Justification (Each dependency)** · `just:xchg:dependency-argument`

*thiserror.* Mandated rather than chosen: the repository's error discipline names it, and (`req:xchg:workspace-discipline`) carries the rule into this crate. The argument for it as a dependency is that it is a derive macro over `std::error::Error` with no runtime component and no presence in the public API — its own documentation states that it is "deliberately absent from public APIs, allowing seamless switching between handwritten and derived implementations without breaking changes" (docs.rs, 2026-08-20), so adopting it costs the crate's consumers nothing and abandoning it later would cost them nothing either.

*regexml.* That there is an engine at all is the one signed exception (`[ARCH-dec:linter:cddl-regexp-library]`), justified there rather than here: `.regexp` is real regular expression matching by standard, and a bespoke recognizer for a language that arrives inside other owners' published theories is the wrong thing to hand-write. That it is this engine is justified by the standard the operator names — it implements the XSD flavor natively through `Regex::xsd`, which is what removes the translator a mainstream engine would need in front of it (`dec:xchg:regexp-engine`). It is a pure-Rust port of Saxon's engine tested against W3C's own `qt3tests`, its public surface reaching the crate only through the three methods of (`dec:xchg:regexp-seam`), and its price is the runtime characterization of (`req:xchg:regexp-guard`).

*proptest.* The concept makes the metatheorems executable obligations (`conv:xchg:metatheorems-as-tests`), and every one of them is a universally quantified statement over generated structures — which is what a property-testing framework is for, and what a table of hand-written vectors cannot express. proptest over quickcheck for two documented reasons rather than by preference. First, shrinking: proptest describes itself as "Hypothesis-like property-based testing and shrinking" and derives shrinkers from the `Strategy` that generated a value, where quickcheck requires a hand-written `Arbitrary::shrink` per type — and a failing `Value` counterexample is worthless unshrunk, since the interesting ones are deep. Second, recursion: `Value` is a recursive type, and `Strategy::prop_recursive(depth, desired_size, expected_branch_size, recurse)` is the documented tool for "generate a recursive structure with `self` items as leaves" (docs.rs, 2026-08-20), with `proptest::collection` supplying the `vec` and `btree_map` strategies the `Array`, `Map`, and `Content` generators need. Both facts were read off the crate's own documentation rather than recalled.

*The fuzz trio.* Deferred to the audit phase by the concept itself, and named here only so the gate can require the CI question to be settled: `cargo-fuzz` "requires the nightly compiler since it uses the `-Z` compiler flag to provide address sanitization" (the Rust Fuzz Book, verified 2026-08-20), which means the fuzz lane is a separate toolchain from the one `make ci` runs. That is a CI-shape question, not a design question, but it is one the audit phase must not discover late.

**Decision (Refused dependencies)** · `dec:xchg:refused-dependencies`

Four candidates a reader might expect, refused with reasons, so that no later contributor has to re-derive them.

*serde.* The API guidelines encourage it (C-SERDE) and it is refused anyway. serde's data model is not CBOR's — it has no notion of a tag, no distinction between the two integer major types, and no canonical form — so a `Serialize` implementation would be a second, weaker encoder standing beside the canonical one, and (`req:xchg:determinism`) is precisely the requirement that there be exactly one way to turn a value into bytes. The deviation from C-SERDE is named rather than silent.

*A half-precision float crate.* The conversions §4.2 needs are the binary16 narrowing and widening used by `Float::from_f64`, some tens of lines of exact bit manipulation whose correctness is a test obligation either way. Writing them first-party keeps the shortest-form rule visible in the crate that depends on it.

*indexmap or hashbrown.* `BTreeMap<u64, Value>` iterates in an order that already coincides with canonical map order for unsigned-integer keys (`sig:xchg:document-api`), and the general `Map` holds a sorted vector because the invariant it carries is sortedness. Neither crate adds anything the design wants.

*A hex crate for the test vectors.* RFC 8949's examples are written in hex, and decoding them is a dozen lines in the test support module. A development dependency to avoid twelve lines is not worth the supply-chain surface on a crate whose entire point is that byte-exactness has no third party in it.

The target — zero runtime dependencies beyond `thiserror` and `regexml` — is met.

## Test plan · `sec:xchg:tests`

**Strategy (Test plan)** · `strat:xchg:test-strategy`

Three bodies of tests, differing in what they are evidence for. Vectors from the normative documents are evidence that the implementation agrees with the standards on the cases the standards chose. Properties are evidence that the metatheorems the conventions prove on paper hold of the code, and they are written one per metatheorem so that a failure names the theorem it broke (`conv:xchg:metatheorems-as-tests`). Fuzzing is evidence about inputs nobody chose, and it belongs to the audit phase by the concept's own ruling. Alongside all three, every public item carries a rustdoc example, which `cargo test` compiles and runs — roughly forty doc tests that keep the documented API and the real one from parting.

**Table (Sized test plan)** · `tab:xchg:test-sizing`

Counts are the design's estimate of scope, to be met or explained, not a ceiling. The first corpus row is already seeded: a 93-vector set (67 canonical, 26 refusals) was assembled from RFC 8949's own text during this design phase, mechanically re-verified with a scratch decoder, and waits in the design-phase working notes for transcription into `tests/` when implementation opens.

| Body | Source | Rough count | Shape |
| --- | --- | --- | --- |
| CBOR examples | RFC 8949 Appendix A, transcribed | ~90 | table-driven; canonical rows roundtrip and re-encode identically, non-canonical rows name the exact `DecodeError` variant |
| §4.2 negatives | hand-built from the four core requirements | ~60 | non-preferred heads across major types and argument classes, indefinite lengths for types 2–5, unsorted and duplicate map keys, non-shortest floats, trailing bytes, truncation at every offset of a fixture |
| Label vectors | the ABNF of (`[ICX-gram:interchange:label-grammar]`) | ~40 | accept and reject, including single-character atoms, the 255-byte edge, edge hyphens, one atom, uppercase, underscore, non-ASCII, leading and trailing dots |
| CDDL parser vectors | RFC 8610 Appendix B productions and Appendix H examples | ~60 accept, ~30 reject | one accept per production of the ABNF; rejects for each syntax-error class |
| Fragment membership | (`alg:xchg:fragment-check`) clauses 1–6 | ~25 | half in-fragment, half out, one per clause plus the clause-6 non-check |
| Minor inclusion | (`alg:xchg:inclusion-check`) | ~20 | legal additions, illegal widening, relaxed requiredness, changed type, dropped key, required new key, the rule-rename case that (`dec:xchg:type-identity`) makes a major boundary |
| Open companion | (`alg:xchg:companion`) | ~10 | printed-form comparison asserting exactly two edits |
| Restraint | (`sig:xchg:restraint-api`) | ~12 | implicit reach through `any`, through a major-type reference, through a prelude type; explicit provisions with and without a fixed canonical form |
| `.regexp` seam | (`rep:xchg:xsd-divergences`) | ~30 | one per divergence, each asserted to carry XSD's reading and not the Perl-descended one; anchoring cases including `a\|ab` against `ab`; the conventions' own pattern |
| Registry and acceptance | (`[ICX-def:interchange:acceptance]`) | ~25 | each verdict arm; gaps below the ceiling; refusal truncating; permanence refusing a changed theory object; `target` and `stamp` |
| Properties | (`tab:xchg:metatheorem-tests`) | 10 | proptest, default case count, budgeted |
| Doc tests | the public API | ~40 | compiled by `cargo test` |

**Table (Metatheorem obligations)** · `tab:xchg:metatheorem-tests`

The first six rows are the conventions' metatheory made executable, one property per metatheorem, named after it. The last four are properties of this design rather than of the conventions, and are here because each one is a claim this document makes that would otherwise go unchecked.

| Obligation | Property |
| --- | --- |
| (`[ICX-metathm:interchange:unique-names]`) | over generated values: `decode(encode(v)) == v`; `encode(decode(encode(v))) == encode(v)`; and `v1 == v2` exactly when `encode(v1) == encode(v2)` |
| (`[ICX-metathm:interchange:one-spelling]`) | over generated labels: parse, encode, and byte equality coincide; every label's bytes are ASCII, hence fixed points of NFC and NFD, checked without a normalization dependency |
| (`[ICX-metathm:interchange:bounded-determination]`) | over generated documents and states: `dispatch_prefix(reg, &bytes[..min(296, n)])` equals `dispatch(reg, env)`, and `Envelope::peek` reports at most `MAX_ENVELOPE_PREFIX` bytes consumed |
| (`[ICX-metathm:interchange:conservativity]`) | over generated minor chains: a content key absent from some earlier assigned minor is optional in every later minor's theory |
| (`[ICX-metathm:interchange:forward-compatibility]`) | over generated minor chains and conforming documents: `d ⊨ R(ℓ, M, m)` implies `d ⊨ Open(R(ℓ, M, m₀))` for every assigned `m₀ ≤ m` |
| (`[ICX-metathm:interchange:acceptance-monotonicity]`) | over growing states: a strict acceptance never changes; a tolerant acceptance converges to strict, to rejection, or stays tolerant; an unheld-major rejection turns only toward acceptance |
| (`prop:xchg:canonical-order`) | `a.cmp(b)` agrees with the bytewise comparison of the two canonical names |
| (`alg:xchg:inclusion-check`) | consecutive-pair inclusion over a chain implies all-pairs inclusion |
| (`alg:xchg:stamping`) | the binary search agrees with a linear scan over every generated state |
| (`impl:xchg:iterative-teardown`) | a value nested one million deep decodes, encodes, and drops without overflowing the stack |

**Preview (Fuzzing, deferred to audit)** · `preview:xchg:fuzz-plan`

Three targets, written at the audit phase and not before, each with the seed corpus named now so the audit does not start from nothing. `decode_canonical`: arbitrary bytes into `Document::from_canonical_bytes`, asserting no panic and, on success, that re-encoding reproduces the input exactly — the strongest single invariant the crate has, since it says the decoder accepts nothing it cannot reproduce. `cddl_parse`: arbitrary text into `Theory::parse`, asserting no panic and that success implies fragment membership. `accept_document`: arbitrary bytes against a fixed registry state, asserting no panic and that a `Verdict` is only ever reached through a successful decode. Seed corpora: the RFC 8949 Appendix A encodings, the RFC 8610 Appendix H examples, and every vector from (`tab:xchg:test-sizing`). The budget and the toolchain lane are set at the audit, informed by the nightly requirement recorded in (`just:xchg:dependency-argument`).

**Requirement (Timing)** · `req:xchg:timing`

Every test lane reports wall time, and the first green full run sets the budget, recorded beside the CI lane that invokes it; exceeding it thereafter is a finding, not a cost to absorb. The property lane is timed separately from the vector lane, because the two grow for different reasons and a property case count raised without noticing is exactly the regression this rule exists to catch. The same discipline the linter adopts (`[ARCH-req:linter:timing]`), for the same reason.

## Rejected Ansätze · `sec:xchg:rejected`

**Ansatz (A serde-backed value model)** · `ansatz:xchg:serde-model`

Model values as serde's data model and derive the codec. Then the crate has two encoders — the canonical one and whatever `Serialize` produces — the tag and the two integer major types have no home, and the property that byte equality decides structure equality holds of one of them and not the other. Rejected; see (`dec:xchg:refused-dependencies`).

**Ansatz (A canonicalizing decoder)** · `ansatz:xchg:canonicalizing-decoder`

Accept non-canonical bytes and re-encode them canonically, on the ground that the result is a perfectly good document. Then the crate's own API contradicts the conventions, which say in as many words that such bytes are "no document at all, at any ceiling" (`[ICX-def:interchange:acceptance]`), and everything built on byte equality — content addressing, signatures, deduplication — acquires a second, silent notion of what a document is. Rejected.

**Ansatz (A CDDL subset parser)** · `ansatz:xchg:cddl-subset-parser`

Parse only the constructs the evaluator handles, treating the rest as opaque text. Then fragment membership cannot be decided over a theory containing an unparsed region, and the identity-of-type comparison of (`alg:xchg:inclusion-check`) can return "identical" for two opaque regions that differ — a false negative on a major boundary, which is the worst error the crate could make. Rejected in favor of (`dec:xchg:cddl-coverage`).

**Ansatz (Span-checked regular expression matching)** · `ansatz:xchg:span-checked-regex`

Run an engine unanchored and accept when the match spans the whole subject. Then leftmost-first alternation rejects subjects XSD accepts, as `a|ab` against `ab` shows. Rejected in favor of an engine whose whole-string semantics are its own (`conv:xchg:regexp-anchoring`).

**Ansatz (One error enum, verdicts included)** · `ansatz:xchg:errors-swallow-verdicts`

Fold rejection into the error type so that `accept` returns `Result<(), Error>`. Then the `?` operator erases the difference between a document this reader cannot yet judge and bytes that are not a document, and (`[ICX-metathm:interchange:acceptance-monotonicity]`) — whose whole content is that some negative answers turn positive as a state grows — has no type to be true of. Rejected; see (`conv:xchg:rejection-is-a-verdict`).

**Ansatz (Bytes cached in every node)** · `ansatz:xchg:cached-bytes`

Store each value's canonical encoding beside it, making equality and ordering trivial. Then every value costs its own size again in memory, every constructor allocates, and the invariant is carried twice — once by the constructors and once by the cache — with nothing keeping the two honest. Sortedness and distinctness are checked in the decoder from the byte ranges it already has, and elsewhere from the structure; neither needs a cache. Rejected.

## Sequencing · `sec:xchg:sequencing`

**Decision (Slice sequencing)** · `dec:xchg:slice-sequencing`

The crate is built in four slices, in this order, the whole of it being more than one sitting:

1. the CBOR core — `value`, `encode`, `decode`, with the RFC 8949 vectors and the unique-names property: a self-contained deliverable that depends on nothing else in the crate;
2. the envelope — `label`, `version`, `envelope`, with the bounded-determination property, at which point the crate is already useful to a consumer that only routes;
3. the description language — `cddl/` and `regexp`, the largest slice by far;
4. registry and acceptance, with the remaining four metatheorem properties.

The slice boundaries are the commit boundaries, since each slice leaves `make ci` green and none of them lands half-built. Slices 1 and 2 may be worked in parallel with slice 3, which touches no file they touch — a claim the module map (`model:xchg:module-map`) makes checkable rather than hopeful, and the pre-drawn split lines of (`rem:xchg:split-lines`) are why it holds: the description language knows the `Value` type and nothing else about the core.

## Implementation gate · `sec:xchg:implementation-gate`

**Gate (Implementation)** · `gate:xchg:implementation`

The design phase closed at the review of 2026-08-21, whose rulings stand as the Decisions of this document. The implementation phase closes, and the audit phase opens, only when all of the following hold — the first three owed before the code they govern is written, not after:

- the workspace entry and the CI lane exist, with a named time budget (`req:xchg:timing`) recorded beside the lane;
- RFC 8949 Appendix A and RFC 8610 Appendix B are transcribed into `tests/` before the code they test, the 93-vector set already assembled (`tab:xchg:test-sizing`) transcribed first;
- every dependency version of (`tab:xchg:dependencies`) is re-verified against docs.rs at the moment implementation starts, rather than against this document;
- the guard duty (`req:xchg:regexp-guard`) is discharged: `regexml`'s runtime on pathological patterns is characterized and the finding recorded in the crate's documentation, with a match budget standing at the seam if the finding demands one;
- every citation in this document resolves — a check the finished linter will run on the crate that its own sibling specifies.
