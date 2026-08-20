# The Interchange Crate — Design Candidate

_Phase 2 of the standard engineering process: the design candidate. Review closes this phase; implementation follows behind the Gate at the end._

This document is the design candidate for `crates/cogra-interchange`, the first-party CBOR and CDDL library whose concept closed in phase 1. It fixes the crate's module map, its complete public API surface at rustdoc level, its error taxonomy, its handling of the description language, the confinement of the one signed regex exception, the acceptance and dispatch surface, its dependencies with individual arguments, and a sized test plan; and it ends with the open questions the review must rule and the gate that blocks implementation. It decides nothing the conventions decide: every design element traces to a label of the interchange conventions, and where the conventions could be read two ways the reading is not chosen here — it is raised in (`sec:icx:questions`).

The document practices the labeling discipline: the label at each heading or environment head is that environment's mint; a parenthesized label in running text is a same-owner citation; material in fenced blocks and double-backtick spans is displayed without participating. Every label minted here has area `icx`; the document title mints nothing. Same-owner citations reach the concept document's labels unprefixed, both documents being one owner. Imported citations use the provisional prefixes of the architecture document: `ICX` for the interchange conventions, `ARCH` for the linter architecture.

**Caveat (The process template rides a pending branch)** · `cav:icx:process-template`

The repository-wide template at `docs/implementation/engineering-process.md` exists on a branch awaiting review ([PR #392](https://github.com/helping-kaiser/cogra/pull/392)) and is not yet on the mainline this document's branch stacks on. This document was therefore authored against the concept's phase plan (`preview:icx:phase-plan`) — public API surface, module map, error taxonomy, dependency justifications, test plan sized — which the pending template row-for-row agrees with. If the template changes in review, this document reconciles to it at the design review, not silently.

## Crate layout · `sec:icx:layout`

**Decision (Home and layout)** · `dec:icx:crate-layout`

The crate is `crates/cogra-interchange` in this workspace, library name `cogra_interchange`, one library target and no binary. It is a workspace member and a sibling of the linter (`[ARCH-dec:linter:crate-layout]`), not a child of it: it serves the whole project (`formul:icx:purpose`), and the linter is one consumer among several (`sig:icx:consumers`). Edition and toolchain follow the workspace; no crate features exist in version 1, which is what (`req:icx:std-only`) buys — no `no_std` feature, no serde feature, no optional dependency, so there is exactly one build configuration to test.

**Model (Module map)** · `model:icx:module-map`

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

**Remark (Where a crate split would fall)** · `rem:icx:split-lines`

The module boundaries are drawn where a future crate split would fall, on the principle the linter's layout already adopts (`[ARCH-dec:linter:crate-layout]`). Three cuts are pre-drawn: `value` + `encode` + `decode` is a self-contained deterministic CBOR core with no knowledge of envelopes; `cddl/` is a self-contained description-language implementation whose only dependency on the core is the `Value` type it matches against; and `label` + `version` + `envelope` + `registry` + `accept` is the conventions layer that binds the two. The `regexp` seam is a leaf of `cddl/`. Nothing in the core knows what a namespace label is, and nothing in `cddl/` knows what a registry is — which is why either could leave without dragging the rest.

## The data language · `sec:icx:data-language`

**Signature (Value model)** · `sig:icx:value-model`

One type denotes every structure of the admitted data model (`[ICX-lang:interchange:data-language]`). Its invariant is that every inhabitant is a member of the data language: there is no non-canonical `Value`.

```rust
/// A structure of the data language.
///
/// Every inhabitant has exactly one name ([`Value::to_canonical_bytes`]),
/// and byte equality of names decides equality of structures.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
#[non_exhaustive]
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

The four newtypes exist exactly where an invariant lives, and nowhere else — `Array` is a plain sequence with no invariant of its own beyond its elements, and carries a newtype only for the teardown duty of (`impl:icx:iterative-teardown`).

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

**Decision (Floats are carried as canonical bits)** · `dec:icx:float-bits`

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

Three consequences, each load-bearing. First, `Value` derives `Eq` and `Hash`, which a bare `f64` field forbids, and the derivation is honest: two floats are equal exactly when their names are equal, which is what (`[ICX-metathm:interchange:unique-names]`) asserts of structures generally. Second, the canonical reduction happens once, at construction, so encoding stays total. Third, the ordering falls out: `FloatWidth` in the order Half, Single, Double is the order of the heads `0xf9`, `0xfa`, `0xfb`, and within a width the right-aligned bits compare as the big-endian argument does, so the derived `Ord` on `Float` already is the bytewise order of names. The NaN question the representation raises — which bit patterns `from_f64` accepts — is (`open:icx:nan-policy`).

**Invariant (Canonical by construction)** · `inv:icx:canonical-by-construction`

Every `Value` is a member of the data language. The invariant is carried by three validating constructors and nothing else: `Map::new` sorts and refuses duplicates, `Text` refuses invalid UTF-8, and `Float::from_f64` reduces to the shortest form. Every other variant is canonical for every inhabitant of its payload type. This is the whole of (`req:icx:determinism`) on the encoding side: the encoder has no canonicity decision left to make, because none survived construction, and so `to_canonical_bytes` has no failure mode and no `Result`. Non-determinism is unrepresentable rather than checked for, exactly as the concept requires.

**Proposition (Canonical order is major-type order)** · `prop:icx:canonical-order`

`Ord` on `Value` is defined to be the bytewise-lexicographic order of canonical names, and is implemented directly rather than derived. The reason it can be implemented directly, without encoding, is that the byte order decomposes: each major type occupies its own thirty-two-byte block of initial bytes, the argument classes 24 through 27 sit at `0x18` through `0x1b` inside that block, and within one class the arguments are big-endian of equal length — the same three facts the demonstration of (`[ICX-metathm:interchange:bounded-determination]`) uses for unsigned integers, applied to every major type. So the comparator is: major type first, then argument class, then argument, then payload, recursing into elements and entries. Major type 1 compares by its argument `n`, which is why `Negative` holds `n` and not the value it denotes. The implementation is not trusted on the strength of this paragraph: it is the subject of a property obligation in (`tab:icx:metatheorem-tests`), asserting that `a.cmp(b)` and `a.to_canonical_bytes().cmp(&b.to_canonical_bytes())` agree on generated pairs.

**Signature (Encoding and decoding)** · `sig:icx:codec`

Encoding is a method on `Value` (`sig:icx:value-model`) and has no free-function form; there is one encoder and no options to pass it. Decoding is likewise a constructor. The asymmetry in their signatures is the design: `to_canonical_bytes` returns `Vec<u8>`, `from_canonical_bytes` returns `Result<Value, DecodeError>`.

The decoder validates, in one pass, everything membership requires: preferred serialization at every head, no indefinite-length item of any major type, map keys sorted bytewise-lexicographically on their encoded forms and pairwise distinct, floating-point values in shortest form, text strings valid UTF-8, and no trailing bytes after the single item. Each failure carries the byte offset at which it was detected (`conv:icx:located-errors`). Sortedness and distinctness are checked without re-encoding: the decoder retains the byte range of each encoded key as it goes and compares adjacent ranges, so an *n*-entry map costs *n* comparisons, not *n* encodings.

**Convention (Decoding refuses, never repairs)** · `conv:icx:refuse-never-repair`

There is no canonicalizing decode, no lenient mode, no feature flag, and no constructor that takes bytes and returns a repaired value. The conventions are explicit that this is not an ergonomic choice: bytes outside the data language "denote no structure", and a non-canonical input "is not a defective document to be repaired ... but no document at all, at any ceiling" (`[ICX-def:interchange:acceptance]`). The crate has no vocabulary for the repaired thing because the conventions have none. Consumers that hold non-canonical bytes hold bytes, and the crate's only answer about them is a `DecodeError`.

**Implementation remark (Iterative teardown)** · `impl:icx:iterative-teardown`

`Value` is a recursive type, so the compiler's derived drop glue recurses to the nesting depth of the value, and a deeply nested value produced by a hostile input would overflow the stack while being freed — after decoding succeeded, in code that never asked to touch it. The remedy is an iterative teardown: `Drop` implemented on `Array` and `Map`, dismantling with an explicit worklist rather than by recursion, with `into_vec` and `into_entries` as the escape hatches `Drop` otherwise closes. `Value` itself implements no `Drop`, so destructuring it in a pattern stays legal. The decoder's own recursion is bounded by the same reasoning and is written iteratively for the same reason; the residual policy question — whether a nesting bound exists at all — is (`open:icx:nesting-policy`).

## The envelope · `sec:icx:envelope`

**Signature (Namespace labels)** · `sig:icx:label-api`

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

**Convention (Two recognizers, one language)** · `conv:icx:two-recognizers`

The crate recognizes namespace labels twice by two independent routes, and this is deliberate rather than redundant. `NamespaceLabel::parse` implements the ABNF. The base theory (`[ICX-schema:interchange:global]`) recognizes the same shape through `namespace-form`, a `.regexp` pattern evaluated by the seam of (`sec:icx:regexp`), and that route runs whenever the base theory is applied to a document. The conventions themselves say which governs — "the `.regexp` operationalizes the shape fixed by the ABNF ..., which is normative for shape where the two could be read to differ" — so the ABNF scanner is the authority and the pattern is the operationalization. The two agreeing is a checkable fact, and (`verif:icx:label-pattern-crosscheck`) checks it.

**Signature (Versions and coordinates)** · `sig:icx:version-api`

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

**Signature (Documents and content)** · `sig:icx:document-api`

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
    pub fn from_canonical_bytes(bytes: &[u8]) -> Result<Document, DecodeError>;
    pub fn to_canonical_bytes(&self) -> Vec<u8>;
    pub fn envelope(&self) -> &Envelope;
    pub fn content(&self) -> &Content;
    pub fn to_value(&self) -> Value;
    pub fn try_from_value(v: &Value) -> Result<Document, EnvelopeError>;
}
```

`Content` is `BTreeMap<u64, Value>` and not a `Map`, for a reason the conventions supply: content keys are unsigned integers, and bytewise-lexicographic order on the canonical names of unsigned integers coincides with numeric order — proved in the demonstration of (`[ICX-metathm:interchange:bounded-determination]`) — so `BTreeMap`'s iteration order already *is* canonical map order, and the encoder can walk it straight out. That `Content` is keyed by `ContentKey` on the way in and by `u64` on the way out is deliberate: the invariant is enforced where values enter, and lookups by a literal are ergonomic.

`Document::new` is total, which is the envelope's share of (`req:icx:determinism`): a document assembled through the API is in the data language by the types of its parts, with no assembly-time check to forget. The prose definition of a document — a map, unsigned-integer keys throughout, key 0 a namespace label, key 1 a version (`[ICX-lang:interchange:data-language]`) — is exactly the shape of the struct, so the struct is the definition and `try_from_value` is the only place the definition is checked.

`to_value` materializes the map view that satisfaction consumes. The cost is one allocation per check; avoiding it means teaching the evaluator to walk a `Document` directly, which is a deferred optimization, not a version-1 concern.

**Bound (The 296-byte prefix)** · `bound:icx:prefix-bound`

```rust
/// The greatest number of bytes `Envelope::peek` reads.
pub const MAX_ENVELOPE_PREFIX: usize = 296;
```

The constant is the bound (`[ICX-metathm:interchange:bounded-determination]`) derives — a map head of at most 9, key 0 at 1, a label at 2 + 255, key 1 at 1, and a version of a 1-byte array head plus three uint heads of at most 9 — and the crate makes it an API guarantee rather than an incidental property. `Envelope::peek` reads the map head, key 0 and its label, key 1 and its version, and stops, returning the bytes consumed; the return value is what the obligation in (`tab:icx:metatheorem-tests`) asserts against the constant. `peek` validates preferred serialization on every head it reads and requires the first two keys to be 0 and 1 in that order, which is what makes its answer agree with a full decode's whenever a full decode succeeds. A prefix too short to carry the envelope is `EnvelopeError::Truncated { needed_at_least }`, not a rejection.

**Caveat (Prefix dispatch certifies no membership)** · `cav:icx:prefix-caveat`

`Envelope::peek` and `dispatch_prefix` (`sig:icx:verdict-api`) answer which instrument governs a document; they do not answer whether the bytes are a document. A byte sequence with a well-formed envelope and a non-canonical tail is not in the data language at all, and the crate's verdict on it is a `DecodeError` reached through `Document::from_canonical_bytes` — never a `Verdict`. The prefix path exists because the conventions single out this exact coexistence — "nothing beyond the envelope need be examined before the document's governing instrument is known" — and it is the routing decision that is early, never the acceptance. Every rustdoc paragraph on the prefix path says so.

## Theories and the description language · `sec:icx:theories`

**Decision (Full parse, documented evaluation)** · `dec:icx:cddl-coverage`

The parser implements the CDDL grammar of RFC 8610 entire, as the ABNF of that document's Appendix B gives it; the evaluator implements a documented subset of the control-operator vocabulary, and a theory using anything outside it is refused rather than approximated.

The asymmetry is forced by the conventions, read closely. The description language is "CDDL (RFC 8610) entire", narrowing the operator vocabulary "nowhere" (`[ICX-lang:interchange:description-language]`), and the assignable fragment is "structural, not lexical" — it constrains the top-level map rule and nothing below a content key, where "the type at a content key is any type of the description language, control operators of the registry included" (`[ICX-gram:interchange:assignable-fragment]`). So fragment membership is a question about the whole parsed theory, and the key-by-key identity comparison of (`[ICX-inv:interchange:minor-inclusion]`) compares "the expression together with every rule it references" — neither is answerable over a theory the crate could not parse. Parsing must therefore be complete.

Evaluation need not be, and the conventions say so in the same Grammar: "Whether a host processes a given theory's CDDL is the host's policy, not the fragment's: a reader that will not process an assigned theory holds neither it nor anything above it in that major — refusal truncates, preserving downward-closed holding". A gap in the evaluator is thus a first-class, specified outcome and not a shortcut, provided it surfaces as refusal at acquisition and never as a silent pass. Which operators the version-1 evaluator covers is (`open:icx:evaluable-subset`).

**Signature (Theory surface)** · `sig:icx:theory-api`

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

**Judgment (Satisfaction, total after acquisition)** · `judg:icx:satisfaction-total`

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

No `Result` appears, and the absence is the design. Every way satisfaction could fail to *compute* — unparseable source, a theory outside the fragment, a `.regexp` pattern that will not compile, a control operator the evaluator does not implement — is caught by `Theory::parse` and surfaces as a `TheoryError` there. By the time a `Theory` exists, evaluation is total: the document is finite, the theory is finite, and the pattern engine is required to be one without catastrophic backtracking (`dec:icx:regexp-seam`). Failing to satisfy is then never an error but a negative judgment, which is what (`[ICX-judg:interchange:satisfaction]`) says it is.

One evaluation detail is settled by the fragment rather than by us. In general CDDL, matching a map against a group carrying both explicit entries and a wildcard is a search; here the assignable fragment pins every content key to a literal unsigned integer, so each map entry has at most one explicit entry it can match and the remainder falls to the wildcard — matching is deterministic, and the fragment's structural restriction is what buys it. The precise matching rules to implement are RFC 8610 Appendix C together with the cut semantics of its §3.5.4, verified against that document at implementation rather than inferred here.

**Algorithm (Assignable-fragment membership)** · `alg:icx:fragment-check`

Run over the parsed and resolved theory, refusing with a located `TheoryError` at the first failure. The clauses are exactly the fragment's own (`[ICX-gram:interchange:assignable-fragment]`) together with the extension conditions of (`[ICX-sig:interchange:theory-assignment]`):

1. Exactly one top-level map rule is the theory's root.
2. Key 0 is present, pinned to a text-string literal, and that literal parses as a namespace label by `NamespaceLabel::parse`.
3. Key 1 is present, pinned to a three-element array whose first two elements are literal unsigned integers and whose third is `uint` — the patch position free, and free in that exact shape.
4. Every remaining entry has a literal unsigned-integer key strictly greater than 1, with optionality marked or not; keys are pairwise distinct.
5. The map is closed: no wildcard, no `* key => value` entry, no unwrapped group extending it.
6. The type at each content key is any type of the description language, and is not constrained further.

Clause 6 is the one that must be written down as a *non*-check: the fragment restricts the constructor vocabulary nowhere, so a membership checker that rejects an exotic type at a content key is wrong, not strict. The evaluator may refuse such a theory (`dec:icx:cddl-coverage`), and that refusal is a different verdict at a different place, reported as `TheoryError::Unevaluable` and never as `TheoryError::NotInFragment`.

**Algorithm (Minor inclusion, key by key)** · `alg:icx:inclusion-check`

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

Two design facts, one of them a flag. The first: the registry checks only against the greatest held theory below the acquired minor, not against every lower one, and this is sound because "verbatim" composes — a key carried verbatim from *m* to *m′* and verbatim from *m′* to *m″* is carried verbatim from *m* to *m″*, and a key optional when new stays optional wherever it later appears, which is what (`[ICX-metathm:interchange:conservativity]`) records. The transitivity is a property obligation, not an assertion (`tab:icx:metatheorem-tests`).

The second is a genuine ambiguity in the conventions, flagged here rather than papered over. "Identity of type — the expression together with every rule it references" admits two readings. Literally, the expressions must be identical, so a theory writing `2 => colour` where its predecessor wrote `2 => color`, with identical definitions behind both names, fails — a pure rename is then a major boundary by (`[ICX-law:interchange:major-boundary]`). Read as being about the type rather than its spelling, the two are identical and the rename is not even a minor. This document does not choose; see (`open:icx:type-identity`).

**Algorithm (Open-companion derivation)** · `alg:icx:companion`

`Theory::open_companion` is a pure, total rewrite of the parsed theory with exactly two edits and no third: the second element of the array pinned at key 1 becomes `uint`, and the base theory's wildcard `* (uint .gt 1) => any` is added to the map, the enumerated content keys staying exactly as they stand with their types and their requiredness (`[ICX-def:interchange:open-companion]`). Because the derivation is a rewrite of an already-parsed tree, "nothing else moves" is checkable by comparison rather than by inspection: the obligation in (`tab:icx:test-sizing`) re-prints both theories and asserts that the companion's printed form differs from the assigned theory's in exactly those two places. The companion is derived once per acquisition and memoized on the major line for the current ceiling, which keeps `dispatch` allocation-free; the memo is not the registry R, which is a map from coordinates to assigned theories and into which no companion is ever placed.

**Signature (Restraint report)** · `sig:icx:restraint-api`

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

The report is where (`[ICX-inv:interchange:restraint]`) becomes machine-visible: the invariant governs what an *assigned theory* admits, not what the data language contains, so the enforcement point is a theory and not a `Value`. The type system carries the invariant's other half — every restrained kind is reachable in `Value` only through a variant that names it, `Float`, `Tag`, or `Simple`, with `Simple::new` refusing the three trivially admitted values so that they cannot arrive by that door — which makes "restrained" a visible property of a match arm rather than a fact to remember. Whether a theory with a non-empty `implicit_reaches` may be acquired at all is (`open:icx:restraint-enforcement`); the report is computed either way.

## The `.regexp` seam · `sec:icx:regexp`

**Decision (One module names the engine)** · `dec:icx:regexp-seam`

`src/regexp.rs` is the only module in the crate that names the regular-expression library, and the only file in the repository outside which the signed exception (`[ARCH-dec:linter:cddl-regexp-library]`) does not reach. Its whole surface is crate-internal:

```rust
/// A compiled XSD regular expression, as `.regexp` means it.
pub(crate) struct XsdPattern { /* private */ }

impl XsdPattern {
    /// Translate an XSD pattern into the engine's dialect and compile it.
    /// Every construct on which the two dialects diverge is either
    /// translated exactly or refused; nothing is absorbed silently.
    pub(crate) fn compile(pattern: &str) -> Result<XsdPattern, RegexpError>;

    /// Whether the pattern matches the whole of `text`. XSD regular
    /// expressions are implicitly anchored at head and tail, so there is no
    /// partial-match method here and never will be.
    pub(crate) fn is_match(&self, text: &str) -> bool;

    /// The pattern as given, for diagnostics.
    pub(crate) fn source(&self) -> &str;
}
```

Two engine requirements are stated as requirements on any candidate, not as properties of a particular crate: patterns arrive inside published theories written by other owners, so the engine must have no catastrophic backtracking — a linear-time guarantee in the length of the subject — and must compile a pattern without executing it. The engine is otherwise the study lane's to choose; the seam is written against this signature and nothing wider, so the choice is a one-file change. `regex` 1.13.1 is the obvious candidate and was inspected for this design — verified on docs.rs on 2026-08-20: worst-case `O(m·n)` search by construction, no backreferences and no lookaround, Unicode classes supported — but the ruling is (`open:icx:regexp-library`) and this document does not make it.

**Report (XSD divergences)** · `rep:icx:xsd-divergences`

RFC 8610 §3.8.3 defines `.regexp` against the XSD flavor — verified against the RFC on 2026-08-20: "a text string given as a target needs to match the XML Schema Definition (XSD) regular expression given as a value in the control type", chosen over PCRE because "there is no normative reference for PCREs that could be used in the present document". XSD regular expressions differ from the Perl-descended dialect every mainstream engine implements, in ways that are not stylistic. The architecture recorded the duty to verify and record rather than absorb; this is the finding it asked for, and it is larger than the phrase "anchoring behavior being the classic divergence" suggests.

*Anchoring.* XSD implicitly anchors at head and tail — the W3C text states that unlike Perl and the standard Unix utilities, "the regular expression language defined here implicitly anchors all regular expressions at the head and tail, as the most common use of regular expressions in pattern is to match entire literals." Mainstream engines search unanchored by default.

*`^` and `$`.* Because anchoring is implicit, XSD does not make `^` and `$` metacharacters at all: outside a character class they are ordinary characters matching themselves. In the Perl-descended dialect they are anchors. A pattern containing a literal dollar sign therefore means two different things in the two dialects, and translation must escape them.

*Character-class subtraction.* XSD has `[a-z-[aeiou]]`; the Perl-descended dialect has no such construct and would read it as a class containing a `[`.

*Multi-character escapes.* XSD defines `\i`, `\I`, `\c`, and `\C` for the XML name-start and name characters. No mainstream engine has them, and they must be expanded into explicit classes.

*Absent constructs.* XSD has no backreferences, no lookaround, and no lazy quantifiers. The first two are alignments rather than gaps against an engine that also lacks them. The third is a divergence in the dangerous direction: `a*?` is not a lazy quantifier in XSD, so an engine that reads it as one accepts a pattern XSD would reject and matches a different language.

The consequence for the design is that the seam is a translator with an engine behind it, not a wrapper around an engine. How much of the translation version 1 performs, and what it refuses, is (`open:icx:regexp-scope`).

**Convention (Anchoring by rewriting, not by span checking)** · `conv:icx:regexp-anchoring`

Full-string matching is imposed by rewriting the pattern into `\A(?:P)\z`, never by finding a match and comparing its span against the subject's length. The span check is wrong, and the reason it is wrong is worth recording so that no later reader restores it: leftmost-first engines return the first alternative that matches at the leftmost position, so the pattern `a|ab` against the subject `ab` yields a match of span 0 to 1, and a span check rejects a subject that XSD accepts through the second alternative. The non-capturing group is likewise not decoration: `\Aa|ab\z` parses as an alternation of two anchored branches and is a different language again.

**Verification (The conventions' own pattern)** · `verif:icx:label-pattern-crosscheck`

The conventions ship exactly one `.regexp` pattern, `namespace-form` in the base theory (`[ICX-schema:interchange:global]`), and it is the crate's standing cross-check. It uses only character classes, `?`, `*`, `+`, an escaped dot, and grouping — every one of which means the same thing in both dialects, so the pattern lies inside any subset version 1 might adopt, and the crate's own base theory is never hostage to the seam's scope. The obligation: for generated strings over the label alphabet together with the dot and a selection of near-miss characters, `NamespaceLabel::parse` succeeds exactly when the base theory's `namespace-form` matches. This discharges the architecture's verification duty concretely, "for the patterns the corpus's schemas actually use", on the only pattern the corpus's schemas currently contain — and it will discharge it for the next pattern too, because the check is written over the theory rather than over a hard-coded string.

## Registry and acceptance · `sec:icx:acceptance`

**Signature (Registry)** · `sig:icx:registry-api`

```rust
/// A reader's registry state: assigned coordinates with their immutable
/// theory objects, holding downward-closed within each major.
#[derive(Debug, Default)]
pub struct Registry { /* private */ }

impl Registry {
    pub fn new() -> Registry;

    /// Take a published theory into the held state. Refuses out-of-order
    /// acquisition, a theory whose pins disagree with the coordinate, a
    /// theory not extending the base theory, a re-acquisition that would
    /// change an already-held theory object, and a minor-inclusion breach
    /// against the greatest held theory below.
    pub fn acquire(&mut self, coord: Coordinate, theory: Theory) -> Result<(), AcquireError>;

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

**Algorithm (Stamping)** · `alg:icx:stamping`

`Registry::stamp` returns the least held minor of the major whose theory the content satisfies, where satisfaction is tested against the content class **L₂** rather than the whole document — the notion (`[ICX-ntn:interchange:ground-terms]`) exists for exactly this, since the whole document's key 1 pins the very minor being sought. The set of satisfying minors is upward closed, because L₂(R(ℓ, M, m)) ⊆ L₂(R(ℓ, M, m′)) for m < m′ (`[ICX-inv:interchange:minor-inclusion]`), so the least element is found by binary search over the held minors rather than by a linear scan. The optimization rests on an invariant rather than on an assumption, and the obligation in (`tab:icx:metatheorem-tests`) checks the binary search against a linear scan over generated registry states, which is the cheap way to notice if it ever stops resting on it.

**Signature (Dispatch and verdict)** · `sig:icx:verdict-api`

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

`accept` takes a `&Document` and not bytes, which is the type system carrying (`conv:icx:refuse-never-repair`): a `Document` exists only downstream of a successful decode, so there is no signature through which non-canonical bytes reach a verdict at all. The two-act split gives the bounded-prefix property a home of its own: `dispatch_prefix` is R10's "decidable from the bounded envelope prefix" made into a callable thing rather than a fact about the implementation, and the obligation in (`tab:icx:metatheorem-tests`) asserts that it agrees with `dispatch` on the full envelope.

**Convention (Rejection is a verdict)** · `conv:icx:rejection-is-a-verdict`

`accept` returns a `Verdict` and never an `Err`. A rejected document is not an error condition: it is an answer, and the conventions treat it as one — "rejection for an unheld major is a fact about the state, not about the document" (`[ICX-def:interchange:acceptance]`), and a state that grows turns rejections into acceptances (`[ICX-metathm:interchange:acceptance-monotonicity]`). An API that returned `Err` for a rejection would invite the `?` operator to discard the distinction between "this reader does not hold that major yet" and "these bytes are not a document", which are the two most different answers the crate gives. The same convention governs `Satisfaction` and `Inclusion`: each is an enum with a negative arm carrying located detail, never a `Result` (`crit:icx:error-or-verdict`).

## Errors · `sec:icx:errors`

**Criterion (Error against verdict)** · `crit:icx:error-or-verdict`

One test decides which surface a failure belongs to. If the input is not the kind of thing the operation takes, it is an **error** and travels in `Err`. If the input is exactly the kind of thing the operation takes and the answer is negative, it is a **verdict** and travels as a value.

Errors, therefore: bytes that are not a name of the data language; a string that is not a namespace label; a value that is not a document; CDDL that does not parse, does not lie in the assignable fragment, or the crate cannot evaluate; a registry mutation that would break downward-closed holding or permanence; a prefix too short to carry an envelope; a construction violating a `Value` invariant. Verdicts, therefore: `Verdict::Rejected`, `Satisfaction::Fails`, `Inclusion::Violated`, and the findings of a `RestraintReport`.

**Signature (Error taxonomy)** · `sig:icx:error-taxonomy`

Six leaf enums, one aggregate, all in `error.rs`, all derived with `thiserror`. Each is `#[non_exhaustive]`, so a later variant is not a breaking change; each implements `std::error::Error` and is `Send + Sync + 'static`, which is what makes them usable as trait objects and what the API guidelines call the most useful signature (verified against the Rust API Guidelines, C-GOOD-ERR, 2026-08-20); each `Display` message is lowercase and unpunctuated, per the same guideline.

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
    #[error("key 1 does not hold a version triple")]
    BadVersion,
    #[error("content key {key} is not greater than 1")]
    ReservedContentKey { key: u64 },
    #[error("envelope prefix is not canonically encoded at byte {offset}")]
    NonCanonicalPrefix { offset: usize },
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
    #[error("XSD construct {construct} at position {position} is not translatable")]
    Untranslatable { construct: String, position: usize },
    #[error("pattern is not a well-formed XSD regular expression at position {position}")]
    Malformed { position: usize },
    #[error("engine refused the translated pattern: {detail}")]
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

`AcquireError::InclusionViolated` carries a `Vec<InclusionBreach>` — a verdict's payload riding inside an error — and that is not a violation of (`crit:icx:error-or-verdict`) but its consequence: a theory that breaks the invariant is not the kind of thing `acquire` takes, and the verdict explaining why is the error's detail. The standalone `check_inclusion` (`alg:icx:inclusion-check`) returns the verdict as a verdict, for the owner's tooling, which is the surface that wants to look at a breach without failing.

**Convention (Every error is located)** · `conv:icx:located-errors`

Every `DecodeError` carries a byte offset into the input; every `TheoryError::Syntax` carries a line and column into the CDDL source; every `LabelError` carries a character position; every `Mismatch` and `InclusionBreach` carries the content key it concerns. The consumer that makes this non-negotiable is the linter (`sig:icx:consumers`), whose own requirement is that a parse error is "a hard, located diagnostic — never a silently skipped region" (`[ARCH-req:linter:diagnostics-not-panics]`); an unlocated error from this crate would become an unlocatable diagnostic there. `anyhow` appears nowhere: it is the right tool for a binary and the wrong one for a library, and the repository's error rule names both for that reason.

## Dependencies · `sec:icx:dependencies`

**Table (Dependencies)** · `tab:icx:dependencies`

Versions verified against docs.rs on 2026-08-20 and to be re-verified at implementation start, per the build-from-official-sources rule.

| Crate | Version | Kind | Role |
| --- | --- | --- | --- |
| thiserror | 2.0.20 | runtime | the derive behind every enum of (`sig:icx:error-taxonomy`) |
| the `.regexp` engine | per study | runtime | behind the seam of (`dec:icx:regexp-seam`), and nowhere else |
| proptest | 1.11.0 | dev | the property obligations of (`tab:icx:metatheorem-tests`) |
| cargo-fuzz, libfuzzer-sys, arbitrary | audit phase | dev | the fuzz targets of (`preview:icx:fuzz-plan`), absent from the version-1 tree |

**Justification (Each dependency)** · `just:icx:dependency-argument`

*thiserror.* Mandated rather than chosen: the repository's error discipline names it, and (`req:icx:workspace-discipline`) carries the rule into this crate. The argument for it as a dependency is that it is a derive macro over `std::error::Error` with no runtime component and no presence in the public API — its own documentation states that it is "deliberately absent from public APIs, allowing seamless switching between handwritten and derived implementations without breaking changes" (docs.rs, 2026-08-20), so adopting it costs the crate's consumers nothing and abandoning it later would cost them nothing either.

*The `.regexp` engine.* The one signed exception (`[ARCH-dec:linter:cddl-regexp-library]`), justified there rather than here: `.regexp` is real regular expression matching by standard, and a bespoke recognizer for a language that arrives inside other owners' published theories is the wrong thing to hand-write. The requirements the seam imposes on the choice are in (`dec:icx:regexp-seam`); the choice itself is (`open:icx:regexp-library`).

*proptest.* The concept makes the metatheorems executable obligations (`conv:icx:metatheorems-as-tests`), and every one of them is a universally quantified statement over generated structures — which is what a property-testing framework is for, and what a table of hand-written vectors cannot express. proptest over quickcheck for two documented reasons rather than by preference. First, shrinking: proptest describes itself as "Hypothesis-like property-based testing and shrinking" and derives shrinkers from the `Strategy` that generated a value, where quickcheck requires a hand-written `Arbitrary::shrink` per type — and a failing `Value` counterexample is worthless unshrunk, since the interesting ones are deep. Second, recursion: `Value` is a recursive type, and `Strategy::prop_recursive(depth, desired_size, expected_branch_size, recurse)` is the documented tool for "generate a recursive structure with `self` items as leaves" (docs.rs, 2026-08-20), with `proptest::collection` supplying the `vec` and `btree_map` strategies the `Array`, `Map`, and `Content` generators need. Both facts were read off the crate's own documentation rather than recalled.

*The fuzz trio.* Deferred to the audit phase by the concept itself, and named here only so the gate can require the CI question to be settled: `cargo-fuzz` "requires the nightly compiler since it uses the `-Z` compiler flag to provide address sanitization" (the Rust Fuzz Book, verified 2026-08-20), which means the fuzz lane is a separate toolchain from the one `make ci` runs. That is a CI-shape question, not a design question, but it is one the audit phase must not discover late.

**Decision (Refused dependencies)** · `dec:icx:refused-dependencies`

Four candidates a reader might expect, refused with reasons, so that no later contributor has to re-derive them.

*serde.* The API guidelines encourage it (C-SERDE) and it is refused anyway. serde's data model is not CBOR's — it has no notion of a tag, no distinction between the two integer major types, and no canonical form — so a `Serialize` implementation would be a second, weaker encoder standing beside the canonical one, and (`req:icx:determinism`) is precisely the requirement that there be exactly one way to turn a value into bytes. The deviation from C-SERDE is named rather than silent.

*A half-precision float crate.* The conversions §4.2 needs are the binary16 narrowing and widening used by `Float::from_f64`, some tens of lines of exact bit manipulation whose correctness is a test obligation either way. Writing them first-party keeps the shortest-form rule visible in the crate that depends on it.

*indexmap or hashbrown.* `BTreeMap<u64, Value>` iterates in an order that already coincides with canonical map order for unsigned-integer keys (`sig:icx:document-api`), and the general `Map` holds a sorted vector because the invariant it carries is sortedness. Neither crate adds anything the design wants.

*A hex crate for the test vectors.* RFC 8949's examples are written in hex, and decoding them is a dozen lines in the test support module. A development dependency to avoid twelve lines is not worth the supply-chain surface on a crate whose entire point is that byte-exactness has no third party in it.

The target — zero runtime dependencies beyond `thiserror` and the `.regexp` engine — is met.

## Test plan · `sec:icx:tests`

**Strategy (Test plan)** · `strat:icx:test-strategy`

Three bodies of tests, differing in what they are evidence for. Vectors from the normative documents are evidence that the implementation agrees with the standards on the cases the standards chose. Properties are evidence that the metatheorems the conventions prove on paper hold of the code, and they are written one per metatheorem so that a failure names the theorem it broke (`conv:icx:metatheorems-as-tests`). Fuzzing is evidence about inputs nobody chose, and it belongs to the audit phase by the concept's own ruling. Alongside all three, every public item carries a rustdoc example, which `cargo test` compiles and runs — roughly forty doc tests that keep the documented API and the real one from parting.

**Table (Sized test plan)** · `tab:icx:test-sizing`

Counts are the design's estimate of scope, to be met or explained, not a ceiling. The first corpus row is already seeded: a 93-vector set (67 canonical, 26 refusals) was assembled from RFC 8949's own text during this design phase, mechanically re-verified with a scratch decoder, and waits in the design-phase working notes for transcription into `tests/` when implementation opens.

| Body | Source | Rough count | Shape |
| --- | --- | --- | --- |
| CBOR examples | RFC 8949 Appendix A, transcribed | ~90 | table-driven; canonical rows roundtrip and re-encode identically, non-canonical rows name the exact `DecodeError` variant |
| §4.2 negatives | hand-built from the four core requirements | ~60 | non-preferred heads across major types and argument classes, indefinite lengths for types 2–5, unsorted and duplicate map keys, non-shortest floats, trailing bytes, truncation at every offset of a fixture |
| Label vectors | the ABNF of (`[ICX-gram:interchange:label-grammar]`) | ~40 | accept and reject, including single-character atoms, the 255-byte edge, edge hyphens, one atom, uppercase, underscore, non-ASCII, leading and trailing dots |
| CDDL parser vectors | RFC 8610 Appendix B productions and Appendix H examples | ~60 accept, ~30 reject | one accept per production of the ABNF; rejects for each syntax-error class |
| Fragment membership | (`alg:icx:fragment-check`) clauses 1–6 | ~25 | half in-fragment, half out, one per clause plus the clause-6 non-check |
| Minor inclusion | (`alg:icx:inclusion-check`) | ~20 | legal additions, illegal widening, relaxed requiredness, changed type, dropped key, required new key, the rule-rename case documenting whichever reading (`open:icx:type-identity`) fixes |
| Open companion | (`alg:icx:companion`) | ~10 | printed-form comparison asserting exactly two edits |
| Restraint | (`sig:icx:restraint-api`) | ~12 | implicit reach through `any`, through a major-type reference, through a prelude type; explicit provisions with and without a fixed canonical form |
| `.regexp` seam | (`rep:icx:xsd-divergences`) | ~30 | one per divergence, each asserted to translate exactly or to refuse; anchoring cases including `a\|ab` against `ab`; the conventions' own pattern |
| Registry and acceptance | (`[ICX-def:interchange:acceptance]`) | ~25 | each verdict arm; gaps below the ceiling; refusal truncating; permanence refusing a changed theory object; `target` and `stamp` |
| Properties | (`tab:icx:metatheorem-tests`) | 10 | proptest, default case count, budgeted |
| Doc tests | the public API | ~40 | compiled by `cargo test` |

**Table (Metatheorem obligations)** · `tab:icx:metatheorem-tests`

The first six rows are the conventions' metatheory made executable, one property per metatheorem, named after it. The last four are properties of this design rather than of the conventions, and are here because each one is a claim this document makes that would otherwise go unchecked.

| Obligation | Property |
| --- | --- |
| (`[ICX-metathm:interchange:unique-names]`) | over generated values: `decode(encode(v)) == v`; `encode(decode(encode(v))) == encode(v)`; and `v1 == v2` exactly when `encode(v1) == encode(v2)` |
| (`[ICX-metathm:interchange:one-spelling]`) | over generated labels: parse, encode, and byte equality coincide; every label's bytes are ASCII, hence fixed points of NFC and NFD, checked without a normalization dependency |
| (`[ICX-metathm:interchange:bounded-determination]`) | over generated documents and states: `dispatch_prefix(reg, &bytes[..min(296, n)])` equals `dispatch(reg, env)`, and `Envelope::peek` reports at most `MAX_ENVELOPE_PREFIX` bytes consumed |
| (`[ICX-metathm:interchange:conservativity]`) | over generated minor chains: a content key absent from some earlier assigned minor is optional in every later minor's theory |
| (`[ICX-metathm:interchange:forward-compatibility]`) | over generated minor chains and conforming documents: `d ⊨ R(ℓ, M, m)` implies `d ⊨ Open(R(ℓ, M, m₀))` for every assigned `m₀ ≤ m` |
| (`[ICX-metathm:interchange:acceptance-monotonicity]`) | over growing states: a strict acceptance never changes; a tolerant acceptance converges to strict, to rejection, or stays tolerant; an unheld-major rejection turns only toward acceptance |
| (`prop:icx:canonical-order`) | `a.cmp(b)` agrees with the bytewise comparison of the two canonical names |
| (`alg:icx:inclusion-check`) | consecutive-pair inclusion over a chain implies all-pairs inclusion |
| (`alg:icx:stamping`) | the binary search agrees with a linear scan over every generated state |
| (`impl:icx:iterative-teardown`) | a value nested one million deep decodes, encodes, and drops without overflowing the stack |

**Preview (Fuzzing, deferred to audit)** · `preview:icx:fuzz-plan`

Three targets, written at the audit phase and not before, each with the seed corpus named now so the audit does not start from nothing. `decode_canonical`: arbitrary bytes into `Document::from_canonical_bytes`, asserting no panic and, on success, that re-encoding reproduces the input exactly — the strongest single invariant the crate has, since it says the decoder accepts nothing it cannot reproduce. `cddl_parse`: arbitrary text into `Theory::parse`, asserting no panic and that success implies fragment membership. `accept_document`: arbitrary bytes against a fixed registry state, asserting no panic and that a `Verdict` is only ever reached through a successful decode. Seed corpora: the RFC 8949 Appendix A encodings, the RFC 8610 Appendix H examples, and every vector from (`tab:icx:test-sizing`). The budget and the toolchain lane are set at the audit, informed by the nightly requirement recorded in (`just:icx:dependency-argument`).

**Requirement (Timing)** · `req:icx:timing`

Every test lane reports wall time, and the first green full run sets the budget, recorded beside the CI lane that invokes it; exceeding it thereafter is a finding, not a cost to absorb. The property lane is timed separately from the vector lane, because the two grow for different reasons and a property case count raised without noticing is exactly the regression this rule exists to catch. The same discipline the linter adopts (`[ARCH-req:linter:timing]`), for the same reason.

## Rejected Ansätze · `sec:icx:rejected`

**Ansatz (A serde-backed value model)** · `ansatz:icx:serde-model`

Model values as serde's data model and derive the codec. Then the crate has two encoders — the canonical one and whatever `Serialize` produces — the tag and the two integer major types have no home, and the property that byte equality decides structure equality holds of one of them and not the other. Rejected; see (`dec:icx:refused-dependencies`).

**Ansatz (A canonicalizing decoder)** · `ansatz:icx:canonicalizing-decoder`

Accept non-canonical bytes and re-encode them canonically, on the ground that the result is a perfectly good document. Then the crate's own API contradicts the conventions, which say in as many words that such bytes are "no document at all, at any ceiling" (`[ICX-def:interchange:acceptance]`), and everything built on byte equality — content addressing, signatures, deduplication — acquires a second, silent notion of what a document is. Rejected.

**Ansatz (A CDDL subset parser)** · `ansatz:icx:cddl-subset-parser`

Parse only the constructs the evaluator handles, treating the rest as opaque text. Then fragment membership cannot be decided over a theory containing an unparsed region, and the identity-of-type comparison of (`alg:icx:inclusion-check`) can return "identical" for two opaque regions that differ — a false negative on a major boundary, which is the worst error the crate could make. Rejected in favor of (`dec:icx:cddl-coverage`).

**Ansatz (Span-checked regular expression matching)** · `ansatz:icx:span-checked-regex`

Run the engine unanchored and accept when the match spans the whole subject. Then leftmost-first alternation rejects subjects XSD accepts, as `a|ab` against `ab` shows. Rejected in favor of (`conv:icx:regexp-anchoring`).

**Ansatz (One error enum, verdicts included)** · `ansatz:icx:errors-swallow-verdicts`

Fold rejection into the error type so that `accept` returns `Result<(), Error>`. Then the `?` operator erases the difference between a document this reader cannot yet judge and bytes that are not a document, and (`[ICX-metathm:interchange:acceptance-monotonicity]`) — whose whole content is that some negative answers turn positive as a state grows — has no type to be true of. Rejected; see (`conv:icx:rejection-is-a-verdict`).

**Ansatz (Bytes cached in every node)** · `ansatz:icx:cached-bytes`

Store each value's canonical encoding beside it, making equality and ordering trivial. Then every value costs its own size again in memory, every constructor allocates, and the invariant is carried twice — once by the constructors and once by the cache — with nothing keeping the two honest. Sortedness and distinctness are checked in the decoder from the byte ranges it already has, and elsewhere from the structure; neither needs a cache. Rejected.

## Open questions · `sec:icx:questions`

Each of these is a design decision with a trade-off worth the human's ruling. None is decided here, and the recommendation attached to each is a recommendation.

**Open question (The evaluable subset)** · `open:icx:evaluable-subset`

Which control operators of RFC 8610 §3.8 the version-1 evaluator implements, everything else refusing with `TheoryError::Unevaluable` (`dec:icx:cddl-coverage`). Options: (a) the three the conventions themselves employ — `.size`, `.regexp`, `.gt`; (b) those three plus the rest of the numeric comparisons and equalities — `.lt`, `.le`, `.ge`, `.eq`, `.ne`, `.default`, `.bits`; (c) all of §3.8, including `.cbor`, `.cborseq`, `.within`, and `.and`. Recommendation: (b). It covers everything a plausible envelope theory writes, the operators are individually small, and `.cbor` and `.cborseq` in particular deserve their own thought — they nest the data language inside itself, and whether the nested item must also be canonical is a question the conventions do not answer.

**Open question (Identity of type across minors)** · `open:icx:type-identity`

Whether the key-by-key comparison of (`alg:icx:inclusion-check`) reads "identity of type — the expression together with every rule it references" literally, so that a rule rename is a difference, or as being about the type rather than its spelling, so that it is not. Options: (a) strict, comparing the expression trees with rule references matched by name and same-named rules required identical; (b) up to renaming, comparing the two rule graphs by bisimulation with a visited-pair memo, which also handles recursive rules. Recommendation: (a) for version 1. It is what the sentence says; it is cheap and obviously decidable; and its failure mode is conservative — it calls a rename major, and major "permits breakage; it does not invite it" (`[ICX-warn:interchange:lower-bound]`), where (b) risks accepting as a minor something the invariant meant to exclude. The cost is real and should be stated in the rustdoc: an owner who renames a rule between minors is told to bump major, which is stricter than the invariant's intent.

**Open question (Where restraint is enforced)** · `open:icx:restraint-enforcement`

R12 says "enforce restraint", and the conventions state the invariant without saying it is machine-checkable — unlike minor inclusion, which they expressly call machine-checkable. Options: (a) `Registry::acquire` refuses a theory whose `RestraintReport` has any implicit reach; (b) `acquire` reports but admits, leaving the obligation to governance beside allocation and meaning preservation (`[ICX-cav:interchange:governance-obligations]`); (c) enforcement at satisfaction time, so a float arriving at a key typed `any` fails. Recommendation: (a), with (b) available through a distinct constructor for readers consuming a registry they do not own. (c) is refused outright: it would change L(S) relative to plain CDDL and contradict "the description language is CDDL entire". A sub-question rides along: what "fixes the canonical form of what it admits" requires of a provision, which §4.2.2 makes concrete — whether tags are required or forbidden, how negative zero and subnormals are handled, whether integral-valued floats may be written as integers.

**Open question (The `.regexp` library)** · `open:icx:regexp-library`

The engine behind the seam. The seam's requirements are fixed (`dec:icx:regexp-seam`); the parallel study has returned, and its finding sharpens the choice into a genuine trade-off between the seam's two requirements. Candidate (i): `regexml` (0.2.2, Saxon-derived, actively maintained, ~95K downloads, verified on crates.io 2026-08-20) implements the XSD flavor natively — `Regex::xsd(pattern)` with whole-string semantics built in — which collapses most of the translation layer of (`open:icx:regexp-scope`) to nothing: anchoring, `^`/`$` literals, class subtraction, and the `\i \c` escapes are the engine's own semantics, not our rewrite. But its Saxon lineage implies a backtracking engine, so the no-catastrophic-backtracking requirement of (`dec:icx:regexp-seam`) is unverified for it and must be established (or bounded by a match budget) before hostile-input patterns are safe. Candidate (ii): `regex` (1.13.1) guarantees worst-case linear time by construction but speaks the wrong dialect, so the seam carries the documented-subset translator of (`open:icx:regexp-scope`) option (a). The ruling is which requirement bends: (i) trades a verification burden on the engine for a trivial seam; (ii) trades a translation burden in the seam for a proven engine. The study's working note (regexp-xsd-study.md, 2026-08-20 folder) carries the full survey, including its own flagged sourcing gap: the W3C primary text was corroborated through secondary sources and RFC 8610's own words, and must be pulled directly before implementation sign-off.

**Open question (How much XSD the seam translates)** · `open:icx:regexp-scope`

Given (`rep:icx:xsd-divergences`). Options: (a) a documented XSD subset — the constructs on which the dialects agree, plus the cheap unavoidable translations (full anchoring, `^` and `$` escaped to literals, `\i\I\c\C` expanded) — with everything else refused as `RegexpError::Untranslatable`; (b) a full XSD-to-target translator including character-class subtraction and the quantifier divergences; (c) a first-party XSD engine. Recommendation: (a) for version 1, with (b) as a recorded revision when a published theory needs it. The conventions' own pattern lies inside the subset (`verif:icx:label-pattern-crosscheck`), so nothing the corpus contains is blocked, and a refusal is loud. (c) would need the architecture's ruling re-opened, since it decided against a bespoke recognizer.

**Open question (Nesting policy)** · `open:icx:nesting-policy`

Whether the decoder bounds nesting depth. Options: (a) no bound — depth is bounded by input length, decode and teardown are iterative (`impl:icx:iterative-teardown`), and membership stays exact; (b) a configurable bound with a generous default, refusing deeper inputs as a host policy. Recommendation: (a). A bound would refuse a legal name, and unlike a theory the crate cannot evaluate, the conventions offer no refusal clause for the data language — "membership is exact". The cost is that every recursive walk in the crate, teardown included, must be written iteratively, and the property in (`tab:icx:metatheorem-tests`) is what keeps that honest.

**Open question (NaN policy)** · `open:icx:nan-policy`

Which NaN bit patterns `Float::from_f64` accepts. §4.2 says that a protocol with no intent to support NaN payloads or signaling NaNs "needs to pick a single representation, typically `0xf97e00`"; the conventions do not pick. Options: (a) one canonical NaN, everything else `ValueError::NonCanonicalFloat`; (b) one canonical NaN by silent normalization; (c) payloads preserved, each its own structure. Recommendation: (a). It keeps the constructor honest — silent normalization would mean `from_f64(x).to_f64() != x`, which is a determinism trap of exactly the kind (`req:icx:determinism`) exists to close — and (c) multiplies names for structures nobody in this project needs. Note that two neighbouring questions are *not* open, being settled by (`[ICX-metathm:interchange:unique-names]`): an integer and a float of equal magnitude are distinct structures, and negative zero is distinct from zero.

**Open question (Text-string validity)** · `open:icx:utf8-policy`

Whether the decoder refuses a major-type-3 item whose payload is not valid UTF-8. §4.2 is silent — invalid UTF-8 is a validity question in RFC 8949, not a well-formedness one — while the data language is defined as "a single CBOR data item encoded under §4.2". Options: (a) refuse, `DecodeError::InvalidUtf8`; (b) admit, with `Text` holding bytes. Recommendation: (a). `Text` holding `Box<str>` is what lets `NamespaceLabel` be a string type at all, and admitting invalid UTF-8 would put a second text representation in the value model. The recommendation is flagged because it is the one place this design is arguably stricter than the letter of the conventions, and the human should see that rather than find it.

**Open question (Exhaustiveness of `Value`)** · `open:icx:value-exhaustive`

Whether `Value` carries `#[non_exhaustive]`. The attribute forces every downstream `match` to carry a wildcard arm — verified against the Rust Reference, 2026-08-20 — which for a value model consumers must handle completely is a real ergonomic cost, paid against a future variant that CBOR's major types make unlikely. Options: (a) non-exhaustive, as sketched; (b) exhaustive, treating the eleven variants as the closed set the format defines. Recommendation: (b), with `#[non_exhaustive]` kept on every error enum and every verdict enum where new variants genuinely are expected. Naming this reverses the sketch in (`sig:icx:value-model`) if the review agrees.

**Open question (Theory sharing)** · `open:icx:theory-sharing`

Whether `Registry` owns its theories or holds `Arc<Theory>`. Options: (a) owned, with `&Theory` handed out, and a consumer wanting to share a theory across threads cloning the registry; (b) `Arc<Theory>`, so many readers share one immutable object — which is what permanence makes them (`[ICX-inv:interchange:permanence]`). Recommendation: (a) for version 1, since no known consumer (`sig:icx:consumers`) shares registries across threads, and the change to (b) is source-compatible for every accessor that returns `&Theory`.

**Open question (Public prefix dispatch)** · `open:icx:prefix-public`

Whether `dispatch_prefix` is public in version 1. It is R10's bounded-envelope clause made callable, and it is the API through which a consumer can mis-route by treating a routing answer as an acceptance (`cav:icx:prefix-caveat`). Options: (a) public, documented with the caveat; (b) crate-internal, exercised only by the property obligation, promoted when a consumer asks. Recommendation: (a). The property is the concept's own verification frame, and a property whose subject is private is testable but not usable — the metatheorem exists to be relied on in transit.

**Open question (A CDDL printer in the public surface)** · `open:icx:public-printer`

`Theory::to_cddl` and `OpenTheory::to_cddl` (`sig:icx:theory-api`) print normalized CDDL. They are needed internally for diagnostics and for the companion comparison, and exposing them lets a consumer show a reader what instrument governed a document. The cost is a committed output format. Options: (a) public, format documented as normalized and not stable across versions; (b) crate-internal. Recommendation: (a) with the instability documented; a diagnostic that cannot show the theory it failed against is a poor diagnostic.

**Open question (Registry construction from published material)** · `open:icx:registry-loading`

The crate models the registry state it is given (`conv:icx:out-of-scope`), which leaves open how a consumer gets one: today, `Registry::acquire` called in a loop with theories the consumer parsed itself. Options: (a) leave it there — no loading surface at all in version 1; (b) add a `Registry::acquire_all` taking an ordered sequence and reporting the first refusal, which is the shape every real consumer will otherwise write itself. Recommendation: (b), as a convenience over `acquire` with no new semantics — and explicitly *not* a file format, a manifest, or a fetch, all of which are governance and outside scope.

**Open question (Slice sequencing)** · `open:icx:slice-sequencing`

The order in which the crate is built, since the whole of it is not one sitting. Proposed: slice 1, the CBOR core — `value`, `encode`, `decode`, with the RFC 8949 vectors and the unique-names property, a self-contained deliverable; slice 2, the envelope — `label`, `version`, `envelope`, with the bounded-determination property, at which point the crate is useful to a consumer that only routes; slice 3, the description language — `cddl/` and `regexp`, the largest slice by far; slice 4, registry and acceptance, with the remaining four metatheorem properties. Recommendation: as proposed, with the slice boundaries also being the commit boundaries, since each slice leaves `make ci` green. The review should confirm the order and say whether slices 1 and 2 may be worked in parallel with slice 3, which touches no file they touch.

## Implementation gate · `sec:icx:design-gate`

**Gate (Design review)** · `gate:icx:design-review`

Implementation is blocked until all of the following hold:

- every open question of (`sec:icx:questions`) is ruled, and the ruling is recorded in place in this document rather than in the conversation that produced it, as the phase plan requires (`preview:icx:phase-plan`);
- the module map (`model:icx:module-map`) and the layout decision (`dec:icx:crate-layout`) are confirmed as stated or amended, and the split lines of (`rem:icx:split-lines`) are confirmed as the boundaries they claim to be;
- the public API surface — (`sig:icx:value-model`), (`sig:icx:codec`), (`sig:icx:label-api`), (`sig:icx:version-api`), (`sig:icx:document-api`), (`sig:icx:theory-api`), (`sig:icx:registry-api`), (`sig:icx:verdict-api`), (`sig:icx:restraint-api`) — is confirmed, with (`open:icx:value-exhaustive`) resolved into (`sig:icx:value-model`);
- the error taxonomy (`sig:icx:error-taxonomy`) is confirmed, and the error-against-verdict criterion (`crit:icx:error-or-verdict`) is confirmed as the line it draws;
- the `.regexp` study lane has returned, (`open:icx:regexp-library`) and (`open:icx:regexp-scope`) are ruled, and the divergence report (`rep:icx:xsd-divergences`) is confirmed as the text that will ship in the crate's own documentation, per the architecture's recording duty (`[ARCH-dec:linter:cddl-regexp-library]`);
- the type-identity reading (`open:icx:type-identity`) is ruled, since the minor-inclusion checker cannot be written without it;
- the dependency set (`tab:icx:dependencies`) is confirmed, with every version re-verified against docs.rs at the moment implementation starts rather than against this document;
- the test plan (`tab:icx:test-sizing`) and the metatheorem obligations (`tab:icx:metatheorem-tests`) are confirmed as the verification frame the concept's own convention (`conv:icx:metatheorems-as-tests`) asked for, with the fuzz deferral (`preview:icx:fuzz-plan`) confirmed as a deferral and not a drop;
- RFC 8949 Appendix A and RFC 8610 Appendix B are transcribed into the test corpora before the code they test is written, not after;
- the workspace entry and the CI lane exist, with a named budget (`req:icx:timing`) recorded beside the lane;
- slice sequencing (`open:icx:slice-sequencing`) is confirmed;
- every citation in this document resolves — a check the finished linter will run on the crate that its own sibling specifies.
