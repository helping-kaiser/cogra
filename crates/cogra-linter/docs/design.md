# The Corpus Linter — Design

_Phase 2 of the standard engineering process: the design candidate. The review closes this phase; implementation follows behind the Gate at the end._

This document is the design candidate for `crates/cogra-linter`, the corpus linter whose concept closed in phase 1. It fixes the crate's module map, the two weight enums of the corpus graph, the public API surface of every slice at rustdoc level, the error taxonomy and its boundary against findings, the dependencies with individual arguments verified against their own current documentation, and a sized test plan; and it ends with the gate implementation must discharge. It decides nothing the architecture has already decided: the pipeline, the single-`StableDiGraph` corpus-graph model, the judgments-as-queries formulation, the frontend conventions, and the three fixed constraints are ratified there and cited here. What it settles is what the architecture left to this phase — the concrete module map against the boundaries that document drew, the node and edge weight enums behind its vocabulary sketch, the error taxonomy, the public shape of the slices, and the test plan's sizing. Where a ratified document could be read two ways, the reading is a Decision of this document, and where the ratified documents settle nothing, the question is an Open Question for the review rather than a decision taken in passing.

The document practices the labeling discipline: the label at each heading or environment head is that environment's mint; a parenthesized label in running text is a same-owner citation; material in fenced blocks and double-backtick spans is displayed without participating, which is where every Rust identifier and every token this document merely quotes sits. Every label minted here has area `lint`; the document title mints nothing. Same-owner citations reach the concept document's labels unprefixed, both files lying under `pkg.cogra-linter` in the partition. Imported citations use the prefixes registered in `corpus-adoption.toml`: `LBL` for the label calculus, `KND` for the kind registry, `IDN` for the identity adjudication procedure, `ICX` for the interchange conventions, and `ARCH` for the linter architecture.

## Crate layout · `sec:lint:layout`

**Decision (Home and layout)** · `dec:lint:crate-layout`

The crate is `crates/cogra-linter` in this workspace, library name `cogra_linter`, one library target and one binary target named `cogra-lint`. Splitting the work across a library and a thin binary is what the architecture's "thin binary target" asks for (`[ARCH-dec:linter:crate-layout]`), and it is what makes the acceptance suite possible at all: the corpus-wide checks of (`conv:lint:gates-as-acceptance`) are integration tests that call the library over the real tree, and a run whose only entry point is `main` cannot be asserted against. Edition and toolchain follow the workspace. No crate features exist in version 1: the frontends arrive by slice and not by feature, so there is exactly one build configuration to test, and a language whose frontend has not landed is absent from the dispatcher rather than absent from a build.

**Model (Module map)** · `model:lint:module-map`

```text
src/
  lib.rs            crate root: re-exports, the run entry, the disciplines trace
  main.rs           the binary: argument parsing, exit codes, the timing report
  adopt.rs          the adoption data: Adoption and its parts, loaded from TOML
  carrier.rs        the walk: which files are in the carrier, and who owns each
  scan.rs           the label grammar: Label, occurrence forms, near-misses
  pretokenize/
    mod.rs          the pre-tokenizer contract: comment regions and ban findings
    rust.rs         Rust's lexical structure: strings, raw strings, chars, comments
  bans.rs           banned-token classes as data; findings over pre-tokenizer output
  frontend.rs       the shared frontend contract: Region, Head, Asset, Parsed
  frontend_md.rs    pulldown-cmark: blocks, code spans, headings, registry tables
  frontend_rust.rs  syn: doc-comment regions, the two profiles' censuses
  frontend_web.rs   swc                                             [slice 7]
  frontend_kotlin.rs tree-sitter                                    [slice 8]
  graph.rs          NodeW, EdgeW, the index maps, the free functions over them
  judge/
    mod.rs          the judgment surface: run every judgment, collect findings
    labels.rs       unique mint, total resolution, warrant totality, inventory
    kinds.rs        registry-as-data, presentation reduction, head validation
    freshness.rs    exact byte comparison of every generated register
  registers.rs      the generators: label registers, headline counts, attestation
  diag.rs           Diagnostic, Severity, Location, RuleId, the total order
  render.rs         diagnostic rendering and the run summary
  error.rs          the thiserror taxonomy
  timing.rs         per-phase wall clock, the report of (`[ARCH-req:linter:timing]`)
tests/              acceptance suites and the vector corpora
fuzz/               audit-phase targets; absent from the version-1 tree
```

**Remark (What this adds to the ruled module list)** · `rem:lint:module-additions`

The architecture rules the module set `pretokenize`, `frontend_md`, `frontend_rust`, `frontend_web`, `frontend_kotlin`, `scan`, `bans`, `graph`, `judge`, `render`, and a thin binary (`[ARCH-dec:linter:crate-layout]`). Every one of those names survives here unchanged; `pretokenize` and `judge` gain children, which leaves them the modules they were. Seven modules are added, and each is named rather than slipped in, because a module map that quietly grows past its ruling is the first way a ratified boundary erodes. `adopt` holds the subsystem the architecture gives a Signature but no module (`[ARCH-sig:linter:adoption-data]`), and it is the whole of the first slice. `carrier` holds the walk and the owner assignment — R17 and R18 of (`tab:lint:functional`) — which run before any frontend and belong to neither. `frontend` holds the data contract the four frontends produce, which is the line a frontend would leave along. `registers` holds the generator side of register freshness, kept apart from `judge::freshness`, which only compares: one generator serving both the check and the regeneration mode is what (`req:lint:register-generator`) means by one generator, and separating production from comparison is what stops the check from acquiring a second one. `diag` holds the diagnostic type and its total order, `render` only formats what `diag` has already ordered. `error` holds the taxonomy, per the repository's error rule. `timing` holds the per-phase clock of (`req:lint:timing`).

**Remark (Where a crate split would fall)** · `rem:lint:split-lines`

The boundaries are drawn where a future crate split would fall, on the architecture's own principle (`[ARCH-dec:linter:crate-layout]`). Three cuts are pre-drawn. `scan` is a self-contained implementation of the label language that knows nothing of files, graphs, or Markdown: it takes region text and returns occurrences. `graph` plus `judge` is the calculus engine, which knows the weights and the adoption data and nothing about how a region came to exist. Each `frontend_*` module knows one parser and the shared contract of `frontend`, and no frontend knows another exists. What binds them — `carrier`, `adopt`, `lib` — is the corpus-specific layer, and it is the layer a second corpus would replace while keeping the other two.

## The corpus graph · `sec:lint:graph`

**Signature (Node weights)** · `sig:lint:node-weights`

One `StableDiGraph<NodeW, EdgeW>` holds the entire analysis (`[ARCH-model:linter:corpus-graph]`). The node weight is one enum whose variants are the entities of the calculus, refining the architecture's vocabulary sketch (`[ARCH-tab:linter:node-edge-vocabulary]`).

```rust
/// One entity of the disciplines, held as a node weight of the corpus graph.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum NodeW {
    /// An owner of the partition Ω.
    Owner(OwnerNode),
    /// One carrier source: a file, its language, its generated status.
    Source(SourceNode),
    /// One logical region of a source.
    Region(RegionNode),
    /// A bare participating occurrence.
    Mint(MintNode),
    /// A participating citation occurrence, same-owner or imported.
    Citation(CitationNode),
    /// A label value, one node per owner that carries it.
    Label(LabelNode),
    /// A covered asset of some profile's census.
    Asset(AssetNode),
    /// A registered inventory profile, effective or staged.
    Profile(ProfileNode),
    /// A participating authored environment head.
    Head(HeadNode),
    /// A pair of the effective classification relation C_A.
    Pair(PairNode),
}

pub struct OwnerNode { pub id: OwnerId, pub prefixes: Vec<Prefix> }

pub struct SourceNode {
    pub path: PathBuf,
    pub language: Option<Language>,
    pub generated: bool,
}

pub struct RegionNode {
    pub kind: RegionKind,
    pub span: ByteSpan,
    pub participates: bool,
    pub generated: bool,
}

pub struct MintNode { pub label: Label, pub span: ByteSpan, pub syntax: Syntax }

pub struct CitationNode {
    pub label: Label,
    pub prefix: Option<Prefix>,
    pub span: ByteSpan,
    pub syntax: Syntax,
}

pub struct LabelNode { pub label: Label }

pub struct AssetNode {
    /// The asset's bare identifier, as the language exposes it.
    pub identifier: Box<str>,
    /// The classification the profile's rule read off the asset.
    pub area: Area,
    /// Where the profile's standard place puts the label for this asset.
    pub place: Place,
}

pub struct ProfileNode { pub id: ProfileId, pub kind: Kind, pub status: ProfileStatus }

pub struct HeadNode { pub text: Box<str>, pub declared: Kind, pub span: ByteSpan }

pub struct PairNode { pub name: Box<str>, pub kind: Kind, pub origin: PairOrigin }

/// Whether a classification pair comes from the registry document or from
/// the acceptee's recorded extensions.
pub enum PairOrigin { Base, Extension }

pub enum ProfileStatus { Effective, Staged { enters_when: Box<str> } }
```

`Pair` is new relative to the sketch and is forced by the judgment table's own formulation: head validation is "exactly one `ValidatesAs` edge into a catalogued pair" (`[ARCH-tab:linter:judgments-as-queries]`), and an edge needs a node at its far end. Making the pairs nodes rather than a side table is what puts (`[KND-inv:kinds:catalogued-pairs]`) and (`[KND-inv:kinds:totality]`) in the same query language as every other invariant: an unrecorded pair is a `ValidatesAs` edge with no target, and a head validating twice is out-degree two.

A `Label` node exists once per owner that carries the label, never once per corpus: two owners minting one label text is expressly not a collision (`[LBL-cav:labels:coexistence]`), and one shared node would make it one. The `Source` node's `language` is `Option` because the carrier contains files no frontend reads — the nine languages of `[scanned-regions]` with no frontend, and everything else — and those files are in the carrier and owned, carrying no occurrences and vacuously in good standing (`[LBL-judg:labels:minting]`). Representing them as sources without a language is what keeps R17's walk honest; dropping them would make the partition's totality unobservable.

**Signature (Edge weights)** · `sig:lint:edge-weights`

```rust
/// One judgment-relevant relation, held as an edge weight.
#[derive(Copy, Clone, Debug, PartialEq, Eq, Hash)]
pub enum EdgeW {
    /// Ω: Owner → Source, Owner → Asset, Owner → Label.
    Owns,
    /// Structure: Source → Region, Region → Mint | Citation | Head.
    Contains,
    /// The minting judgment: Mint → Label.
    Mints,
    /// The owner a citation names — its own, or Σ(P): Citation → Owner.
    Cites,
    /// The resolution judgment: Citation → Label.
    ResolvesTo,
    /// The derivation warrant: Asset → Mint.
    Derives,
    /// Census membership: Profile → Asset.
    Covers,
    /// Head validation: Head → Pair.
    ValidatesAs,
    /// A harvested body citation into a designated upstream owner:
    /// Source → Label. Empty domain in version 1.
    Anchors,
}
```

`Covers` is the second addition to the sketch, and it exists because the inventory query needs a subject: "per Profile node: `Derives` edges form a bijection between census Assets and carried Labels" (`[ARCH-tab:linter:judgments-as-queries]`) presupposes an edge saying which assets are that profile's census. Every other variant is the architecture's, with its endpoints now fixed rather than sketched — and fixing them is most of what makes the judgments degree checks.

Two endpoint choices carry weight. `Cites` points at an *owner* and not at a label, so that the import side conditions of (`[LBL-inf:labels:imported-citation]`) become structural: an unregistered prefix names no owner and leaves the citation with out-degree zero over `Cites`, and a self-qualified import is an edge back to the citing owner, each a degree or identity check rather than a special case inside the resolver. `Derives` runs from the asset to the *mint* and not to the label, because the derivation warrants a label *at an occurrence* (`[LBL-inf:labels:derivation-warrant]`); an occurrence at the standard place whose text differs from the derivation warrants nothing, and an edge into the label would have quietly asserted the agreement the invariant exists to check.

**Decision (Ownership is an edge, never a field)** · `dec:lint:ownership-by-edge`

No node weight carries the owner it belongs to. Ownership is the `Owns` edge and nothing else, and the owner of a mint is found by walking `Contains` up to its source and taking that source's single incoming `Owns` edge — a free function `owner_of` over the graph. The alternative, copying an `OwnerIx` into every weight, is the denormalization that makes a graph a database with two truths: the walk and the field can disagree after any mutation, and nothing in the type system says which wins. The cost is bounded and measured rather than assumed: the walk is two `edges_directed` calls of degree one, and the judgments that need owners in bulk take the owner-partitioned view once (`dec:lint:graph-free-functions`) instead of per-occurrence. Where the cost would be real — the minting registry, consulted once per citation — the answer is not a field but the index map of (`sig:lint:index-maps`), which is a lookup table and outside the petgraph rule by its own terms (`[ARCH-model:linter:corpus-graph]`).

**Decision (Free functions and views, no convenience layer)** · `dec:lint:graph-free-functions`

`graph.rs` exports the two weight enums, the index maps, and free functions over `&StableDiGraph<NodeW, EdgeW>`. It exports no struct that owns a graph, and no trait implemented for the graph. This is the architecture's first-class-dependency rule taken at its word (`[ARCH-dec:linter:petgraph-first-class]`), (`[ARCH-rem:linter:views-not-wrappers]`), and the design refuses the convenience layer structurally by giving it nowhere to live: a module that exports no type owning a graph cannot accrete methods on one.

```rust
pub type Corpus = StableDiGraph<NodeW, EdgeW>;

/// The owner of any node that has one, by its `Owns` and `Contains` edges.
pub fn owner_of(g: &Corpus, n: NodeIndex) -> Option<NodeIndex>;

/// The source a region, occurrence, or head lies in.
pub fn source_of(g: &Corpus, n: NodeIndex) -> Option<NodeIndex>;

/// Nodes of one variant, in index order.
pub fn nodes_of<'g>(g: &'g Corpus, k: NodeKind) -> impl Iterator<Item = NodeIndex> + 'g;

/// Successors along exactly one edge weight.
pub fn out_along<'g>(g: &'g Corpus, n: NodeIndex, w: EdgeW)
    -> impl Iterator<Item = NodeIndex> + 'g;
pub fn in_along<'g>(g: &'g Corpus, n: NodeIndex, w: EdgeW)
    -> impl Iterator<Item = NodeIndex> + 'g;
pub fn degree_along(g: &Corpus, n: NodeIndex, w: EdgeW, d: Direction) -> usize;

/// The subgraph of one owner: its sources, regions, occurrences, and assets.
pub fn owner_view<'g>(g: &'g Corpus, owner: NodeIndex)
    -> NodeFiltered<&'g Corpus, impl Fn(NodeIndex) -> bool + 'g>;

/// The subgraph reached along one edge weight, for the algorithms that want
/// a graph rather than an iterator.
pub fn edge_view<'g>(g: &'g Corpus, w: EdgeW)
    -> EdgeFiltered<&'g Corpus, impl Fn(EdgeReference<'g, EdgeW>) -> bool>;

/// `Type` is `NodeKind`, a discriminant enum with one variant per `NodeW`
/// variant, so that a filter can name a variant without cloning a weight.
pub enum NodeKind { Owner, Source, Region, Mint, Citation, Label, Asset, Profile, Head, Pair }
impl NodeW { pub fn kind(&self) -> NodeKind; }
```

`owner_view` and `edge_view` return petgraph's own adaptors, which is the whole content of (`[ARCH-rem:linter:views-not-wrappers]`): a restricted graph is a view handed to a generic algorithm, never a new type. `NodeKind` is the one concession the design makes to ergonomics, and it is a discriminant rather than a facade — it exists because a `NodeFiltered` predicate must decide membership from a `&NodeW` without cloning it, and `matches!` over ten variants written out at every call site is the alternative.

**Signature (Index maps)** · `sig:lint:index-maps`

Beside the graph live the lookup tables the two-pass staging fills in pass 1 and reads in pass 2 (`[ARCH-rule:linter:two-pass]`). They are plain maps, not graph structures, and the architecture places them outside the petgraph rule by its own terms.

```rust
/// The registries the harvest completes and the resolution consults.
pub struct Registries {
    /// The minting registry: one mint per owner and label (`[LBL-inv:labels:unique-mint]`).
    pub mints: HashMap<(NodeIndex, Label), NodeIndex>,
    /// Every owner's label node, whether minted or only cited into.
    pub labels: HashMap<(NodeIndex, Label), NodeIndex>,
    /// Σ, as node indices: registered prefix to owner.
    pub prefixes: HashMap<Prefix, NodeIndex>,
    /// Owner id to owner node, for the partition's own diagnostics.
    pub owners: HashMap<OwnerId, NodeIndex>,
    /// Every derived label of every effective profile, for the inventory query.
    pub derived: HashMap<(NodeIndex, Label), NodeIndex>,
}
```

`mints` and `labels` are separate because they answer different questions: `mints` is the existential premise of Cite and Import (`[LBL-inf:labels:same-owner-citation]`), (`[LBL-inf:labels:imported-citation]`), and a hit in `labels` with a miss in `mints` is precisely the unresolved citation R4 reports with the import form suggested. Insertion into `mints` is where duplicate minting fails, with both locations to hand.

**Proposition (Label order is the bytewise order of the rendered triple)** · `prop:lint:label-order`

Every generated register orders its rows bytewise by label, and the diagnostic order is likewise total and byte-decided (`[ARCH-req:linter:determinism]`), so `Ord` on `Label` must be exactly the bytewise order of `kind:area:name`. It is not the order a derived `Ord` over three separate word fields gives, and the difference is not academic: the colon is `0x3A` and the digits are `0x30` through `0x39`, so a digit sorts *below* the separator. Compare `a1:x:y` against `a:x:y` — field-wise, `a` precedes `a1`; bytewise, `1` precedes `:` and `a1:x:y` comes first. The two orders disagree, and a register generated under one and compared under the other is stale on the day it is written.

The design removes the possibility rather than testing for it. `Label` holds its rendered text and two offsets, so the derived `Ord` compares the text first and the offsets — functions of the text — never decide anything:

```rust
/// A label: a colon-joined triple of kind, area, and name
/// (`[LBL-lang:labels:label-language]`).
///
/// Held as its rendered text, so `Ord` is the bytewise order every generated
/// register and every diagnostic sequence is fixed to.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Label { text: Box<str>, kind_end: u32, area_end: u32 }

impl Label {
    /// Parse a label. `Err` means the text is not label-shaped, which the
    /// scanner reads as "this span is ordinary text" and never as a failure
    /// (`[LBL-gram:labels:well-formed]`).
    pub fn parse(s: &str) -> Result<Label, LabelSyntax>;
    pub fn kind(&self) -> &str;
    pub fn area(&self) -> &str;
    pub fn name(&self) -> &str;
    pub fn as_str(&self) -> &str;
}
impl FromStr for Label { type Err = LabelSyntax; }
impl fmt::Display for Label {}
```

The agreement is a property obligation and not an assertion of this paragraph: (`tab:lint:metatheorem-tests`) asserts that `a.cmp(b)` and `a.as_str().as_bytes().cmp(b.as_str().as_bytes())` agree on generated pairs, which is cheap and catches the day someone replaces the representation with three fields.

## Adoption data and the carrier · `sec:lint:adoption`

**Signature (Adoption surface)** · `sig:lint:adoption-api`

The whole of `corpus-adoption.toml` becomes one immutable value, loaded once, before anything else runs (`[LBL-inv:labels:two-pass]`), (`[ARCH-rule:linter:two-pass]`). Nothing about this corpus reaches the code by any other route (`req:lint:adoption-data-only`).

```rust
/// This corpus's adoption of the disciplines: the seven parametric data of
/// the calculus, the kind registry's adoption data, and the carrier.
#[derive(Clone, Debug)]
pub struct Adoption {
    pub meta: Meta,
    pub carrier: Carrier,
    pub signature: Signature,
    pub partition: Partition,
    pub profiles: Profiles,
    pub reserved_kinds: ReservedKinds,
    pub typed_data: TypedData,
    pub citation_indexes: CitationIndexes,
    pub scanned_regions: ScannedRegions,
    pub banned_tokens: BannedTokens,
    pub kinds: KindsAdoption,
}

impl Adoption {
    /// Load and validate. The one operation of the crate whose failure is an
    /// error and not a finding (`crit:lint:error-or-finding`).
    pub fn load(path: &Path) -> Result<Adoption, AdoptionError>;
    pub fn from_str(source: &str, origin: &Path) -> Result<Adoption, AdoptionError>;
}

/// A literal path prefix. A prefix ending in `/` matches a tree; a prefix
/// naming a file matches that file; the empty prefix matches everything.
/// There is no pattern dialect (`[ARCH-dec:linter:no-regex]`).
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct PathPrefix(Box<str>);
impl PathPrefix { pub fn matches(&self, path: &Path) -> bool; }

pub struct Signature {
    /// Hand-registered prefixes, prefix to owner.
    pub prefixes: BTreeMap<Prefix, OwnerId>,
    /// R-PKG′ and any later family: a closed derivation rule, not a list.
    pub families: Vec<PrefixFamily>,
}

pub struct Partition {
    /// Ordered, first match wins. The last rule's prefix is empty, which is
    /// what makes Ω total (`[LBL-sig:labels:owners]`).
    pub rules: Vec<PartitionRule>,
}

pub struct PartitionRule {
    pub order: u32,
    pub path: PathPrefix,
    pub owner: OwnerId,
    /// A configured root whose absence is legal and silent — never an
    /// unreadable root, which stays a diagnostic (`[LBL-cav:labels:coexistence]`).
    pub optional: bool,
}

pub struct Profiles { pub profiles: Vec<Profile>, pub effective_count: usize }

pub struct Profile {
    pub id: ProfileId,
    pub kind: Kind,
    pub status: ProfileStatus,
    pub census: Census,
    pub classification: Classification,
    pub name_transformation: NameTransformation,
    pub standard_place: Place,
}
```

**Decision (TOML by the `toml` crate, deserialized with serde)** · `dec:lint:toml-parsing`

The adoption file is parsed by the `toml` crate through `serde`'s derived `Deserialize`, into the types above. The question is worth answering explicitly because the corpus's no-regex rule is easy to over-read: it forbids a regular-expression engine *on the analysis path* — recognition of the corpus's own text — and names configuration only to say that the path prefixes there are literal rather than patterned (`[ARCH-dec:linter:no-regex]`), (`[ARCH-sig:linter:adoption-data]`). A real TOML parser is the opposite of what that rule refuses: it is a parser where a pattern dialect would otherwise sit, which is the same argument (`[ARCH-dec:linter:ast-frontends]`) makes for the frontends. Hand-rolling a TOML reader would put a second, weaker parser of a standardized format in a crate whose whole thesis is that recognition belongs to real parsers. `toml::Spanned` is taken where a diagnostic wants to point at the row it complains about — a partition rule that names an unregistered owner, a profile whose standard place contradicts its census — so that an adoption defect is located in the adoption file rather than described.

The one duty this decision creates is discharged at the gate: `cargo tree` over the crate must show no regular-expression engine anywhere in the graph, direct or transitive (`gate:lint:implementation`). The rule's words are "not as a direct dependency, not transitively relied upon for recognition", and a dependency check is the only way to hold it.

**Convention (Owner assignment)** · `conv:lint:owner-assignment`

Every carrier source and every covered asset takes its owner from the ordered rules of Ω by first match, and prefixes are admitted either from the hand-registered table or by a family's derivation rule (`[LBL-sig:labels:owners]`), (`[ARCH-conv:linter:owner-partition]`). Two consequences are structural rather than checked. Totality is a property of the last rule's empty prefix, so there is no "unowned source" state to represent and no diagnostic for one — R18 of (`tab:lint:functional`) reads "treat the partition's totality as structural" and this is what that means in the types: `owner_for` returns `OwnerId`, not `Option<OwnerId>`. And an asset's owner is its package and never its module (`[LBL-inf:labels:derivation-warrant]`), so the asset takes the owner of its source and refactoring inside a package moves nothing.

```rust
pub struct Walk<'a> { adoption: &'a Adoption }

impl<'a> Walk<'a> {
    pub fn new(adoption: &'a Adoption, root: &Path) -> Walk<'a>;
    /// Every carrier source, in a deterministic order: sorted by path,
    /// never by directory-iteration order (`[ARCH-req:linter:determinism]`).
    pub fn sources(&self) -> Result<Vec<SourceFile>, WalkOutcome>;
}

pub struct SourceFile {
    pub path: PathBuf,
    pub owner: OwnerId,
    pub language: Option<Language>,
    pub generated: bool,
    pub bytes: Vec<u8>,
}

/// What a walk produces beside its sources: never an empty carrier
/// (`[LBL-cav:labels:coexistence]`).
pub struct WalkOutcome { pub sources: Vec<SourceFile>, pub failures: Vec<Diagnostic> }
```

`Walk::sources` returns the sources *and* the traversal failures, and never trades one for the other: an unreadable tree is a reported diagnostic beside a shorter source list, which is exactly the case the caveat forbids collapsing into an empty carrier. An absent `optional` root contributes neither a source nor a diagnostic.

**Decision (Staged profiles compute nothing)** · `dec:lint:staged-profiles`

A profile whose `status` is `Staged` is registered and outside the effective profile signature: it is present in the graph as a `Profile` node so that its kind's reservation is legible, it carries no `Covers` edges, its census is not computed, and no inventory judgment runs over it. Its kind stays reserved-but-ungoverned, where a bare occurrence is a hard failure awaiting its derivation — the same outcome by a different clause (`[LBL-sig:labels:reserved-kinds]`), `[profiles]` and `[reserved-kinds]` of the adoption data. Entering Π is a commit that flips two fields, and the linter reads the fields.

The alternative — computing a staged profile's census anyway, to report the migration's distance — is refused for a reason of staging rather than of effort: the census is the input to the inventory judgment, and a computed-but-unjudged census is a half-computed pass, which is what (`[LBL-inv:labels:two-pass]`) exists to forbid. What the migration's distance wants is a measurement, and a measurement is not a lint. Whether the human wants the distance reported anyway is (`open:lint:staged-census`).

## The span scanner · `sec:lint:scanner`

**Signature (Occurrences and the scanner)** · `sig:lint:scanner-api`

`scan.rs` implements the label language and nothing else. It reads region text and returns occurrences, near-misses, and at most one delimiter failure; it knows nothing of files, owners, or the graph.

```rust
/// The three occurrence forms of (`[LBL-lang:labels:label-language]`), each
/// carrying the span of the whole occurrence — delimiters, brackets, and
/// parentheses included.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Occurrence {
    Mint { label: Label, span: ByteSpan },
    SameOwner { label: Label, span: ByteSpan },
    Imported { prefix: Prefix, label: Label, span: ByteSpan },
}

/// Which concrete syntax a region carries.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Syntax { Prose, Code }

/// A delimited span the prose frontend has already classified: the format
/// owns the backtick, so the frontend decides pairing and run length
/// (`[ARCH-conv:linter:markdown-frontend]`).
pub struct DelimitedSpan { pub outer: ByteSpan, pub interior: ByteSpan, pub displayed: bool }

pub struct RegionScan {
    pub occurrences: Vec<Occurrence>,
    pub near_misses: Vec<NearMiss>,
    /// At most one: a delimiter failure ends the region's spans.
    pub delimiter_failure: Option<DelimiterFailure>,
}

/// Prose: the frontend supplies the format's own code spans, in order.
pub fn scan_prose(text: &str, base: usize, spans: &[DelimitedSpan]) -> RegionScan;

/// Code: the acute belongs to the label syntax and classifies locally, so
/// the scanner does its own pairing (`[LBL-judg:labels:participation]`).
pub fn scan_code(text: &str, base: usize) -> RegionScan;
```

**Decision (Two entry points, because the two syntaxes differ in kind)** · `dec:lint:two-scan-entries`

The scanner takes prose and code by different doors, and the asymmetry is the calculus's own rather than an implementation convenience. In prose the backtick belongs to the document format, so no local classification is available and the format's span rules decide: an unpaired backtick leaves its block's spans undefined and is a hard failure bounded by that block. In scanned code text the acute belongs to the label syntax and classifies locally: it opens exactly when label-shaped text follows, an opening acute unclosed at the region's end is a hard failure, and an acute that opens nothing is text (`[LBL-judg:labels:participation]`). A single entry point would have to be told which of these two regimes it is in, which is the two entry points with the difference hidden inside. `scan_prose` therefore consumes the frontend's already-paired spans and never counts a backtick; `scan_code` does its own pairing and never sees a format.

Both take a `base` offset and report spans in whole-file coordinates, because a logical region is not contiguous in the file (`[LBL-gram:labels:well-formed]`) and a diagnostic must point into the file. Where a region's logical text is assembled from several file ranges — a run of `///` lines with its leaders resolved away, a block quotation with its markers removed — the frontend supplies the mapping and `scan.rs` reports through it.

**Signature (Near-misses)** · `sig:lint:near-miss-api`

The calculus asks the checker to warn on label-shaped-but-not-label spans without treating any of them as occurrences (`[LBL-inv:labels:total-resolution]`), and the architecture rules that the warnings come from the same scanner reporting how far a span got before failing to parse (`[ARCH-dec:linter:no-regex]`). The design makes that literal: `LabelSyntax` carries the failure position and the expectation, and a near-miss is that failure plus the shape of the delimiters around it.

```rust
/// Why a span is not a label. Never a diagnostic by itself: a delimited span
/// that parses as no form is ordinary text (`[LBL-gram:labels:well-formed]`).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LabelSyntax { pub at: usize, pub expected: Expectation }

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Expectation { WordChar, Colon, HyphenOrWordChar, EndOfLabel }

/// A span the author probably meant as an occurrence.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NearMiss { pub span: ByteSpan, pub why: NearMissKind }

#[derive(Clone, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum NearMissKind {
    /// A label-shaped interior whose only defect is casing.
    WrongCase { at: usize },
    /// Interior whitespace inside the delimiters.
    InteriorSpacing { at: usize },
    /// A bracketed interior outside any parenthesis, or a parenthesized
    /// bracketed interior whose bracket is malformed.
    MisplacedBracket,
    /// In scanned code text, a label-shaped backtick span where the acute
    /// was meant — 88 of these are already in the corpus.
    BacktickInCode,
    /// Several label-shaped spans inside one parenthesis, which is no
    /// citation form at all.
    SeveralToOneParenthesis { count: usize },
}
```

`SeveralToOneParenthesis` is in the enum because the corpus already contains the shape: of the 61 label-shaped spans in the docs trees, 24 are in no form at all, "bare in running text, or several to one parenthesis". Those spans are queued for reforming into displayed spans, and until they are, the warning is the linter's whole contribution to the migration (`conv:lint:out-of-scope`).

## The pre-tokenizer and token bans · `sec:lint:pretokenize`

**Signature (Pre-tokenizer)** · `sig:lint:pretokenizer-api`

The pre-tokenizer is a lexer with a small, testable contract, held to the same standard as any frontend (`[ARCH-dec:linter:pretokenizer]`). It runs per language, over the file's own lexical structure, and it produces two things: the located comment regions the AST drops, and the banned-token findings.

```rust
/// One lexical unit of a source, as the pre-tokenizer classifies it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Lexeme { pub span: ByteSpan, pub class: LexClass }

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum LexClass {
    Code,
    /// A comment, with the form the language gives it.
    Comment(CommentForm),
    /// A string, raw string, byte string, or character literal.
    Literal(LiteralForm),
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum CommentForm {
    LineOuterDoc, LineInnerDoc, LinePlain,
    BlockOuterDoc, BlockInnerDoc, BlockPlain,
}

pub struct PreTokenized {
    /// Every byte of the file, in order, classified exactly once.
    pub lexemes: Vec<Lexeme>,
    /// Text the lexer could not classify: a hard diagnostic, never a guess.
    pub unclassified: Vec<Diagnostic>,
}

pub fn pretokenize(language: Language, bytes: &[u8]) -> PreTokenized;
```

**Invariant (The lexemes partition the file)** · `inv:lint:lexeme-partition`

The spans of `PreTokenized::lexemes` are non-overlapping, ascending, and cover every byte of the input exactly once. The invariant is what makes the pre-tokenizer checkable at all: without it, "text it cannot classify is a hard diagnostic, not a guess" has no subject, because a lexer that silently skips a byte has classified nothing and reported nothing. With it, the fuzz target of (`preview:lint:fuzz-plan`) has a total assertion to make on arbitrary bytes, and the property obligation in (`tab:lint:metatheorem-tests`) states it directly. An unclassifiable stretch is still a lexeme — of class `Code`, with a diagnostic beside it — so the partition holds even in the failure case.

**Signature (Banned tokens)** · `sig:lint:bans-api`

The ban subsystem is generic and its classes are data: a future ban is a new row in `[banned-tokens]`, not new code (`[ARCH-rule:linter:banned-tokens]`).

```rust
/// One banned token class, as `[banned-tokens]` states it.
pub struct BanRule {
    pub id: RuleId,
    pub language: Language,
    /// The lexeme class this rule forbids. Detection is the lexer's, never
    /// a pattern match (`[ARCH-dec:linter:pretokenizer]`).
    pub forbids: LexClass,
    pub severity: Severity,
}

/// Every occurrence of a banned class in one source, as located diagnostics.
pub fn findings(rules: &BannedTokens, src: &SourceFile, pre: &PreTokenized) -> Vec<Diagnostic>;
```

That `BanRule::forbids` is a `LexClass` and not a string is the design's whole claim to the architecture's "never by pattern match": the rule names a class the lexer already decides, so a `//` inside a raw string is not a comment and cannot be a finding, and the two ruled entries — plain line comments and plain block comments — are `LexClass::Comment(CommentForm::LinePlain)` and `CommentForm::BlockPlain`. A ban that cannot be phrased as a lexeme class needs a lexer change, which is the correct place for it to become visible.

## Frontends · `sec:lint:frontends`

**Signature (The frontend contract)** · `sig:lint:frontend-api`

Every frontend produces the same three things, and `frontend.rs` holds their types and nothing else.

```rust
/// One logical region: the unit the span scanner receives
/// (`[ARCH-def:linter:logical-region]`).
pub struct Region {
    pub kind: RegionKind,
    /// The region's own logical text, structure resolved away.
    pub text: String,
    /// The file ranges the logical text was assembled from, in order.
    pub pieces: Vec<ByteSpan>,
    pub syntax: Syntax,
    pub participates: bool,
    pub generated: bool,
    /// For prose regions: the format's own delimited spans, already paired.
    pub spans: Vec<DelimitedSpan>,
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum RegionKind { Prose, Heading, Comment(CommentForm), TableRow }

/// A participating authored environment head, with the kind its label
/// declares (`[KND-judg:kinds:head-validation]`).
pub struct Head { pub text: String, pub declared: Kind, pub span: ByteSpan }

/// A covered asset of one profile's census, as the language exposes it.
pub struct Asset {
    pub profile: ProfileId,
    pub identifier: String,
    pub area: Area,
    pub place: Place,
    pub span: ByteSpan,
}

pub struct Parsed { pub regions: Vec<Region>, pub heads: Vec<Head>, pub assets: Vec<Asset> }

/// Parse one source with the frontend its language names. A language with no
/// frontend yields an empty `Parsed`: its files stay in the carrier and stay
/// owned, carrying no occurrences (`[LBL-judg:labels:minting]`).
pub fn parse(src: &SourceFile, pre: &PreTokenized, a: &Adoption)
    -> Result<Parsed, Vec<Diagnostic>>;
```

**Decision (Free functions and a dispatcher, not a trait)** · `dec:lint:frontend-dispatch`

`frontend::parse` matches on `Language` and calls `frontend_md::parse`, `frontend_rust::parse`, and later the other two. There is no `Frontend` trait. A trait exists to admit implementations its author does not know; the frontends are four, all in this crate, arriving by slice, and none of them is ever chosen at runtime by a consumer. What the trait would add is a `dyn` boundary, an object-safety constraint on the return types, and one more place to look when a frontend's contract changes. What it would not add is the thing traits are for. The shared *data* contract is real and lives in `frontend.rs`; the shared *behavior* contract is one `match`.

**Convention (Markdown frontend surface)** · `conv:lint:markdown-surface`

`frontend_md` drives pulldown-cmark through `Parser::into_offset_iter`, which yields `(Event, Range<usize>)` pairs, so every event carries its byte range in the source (`[ARCH-conv:linter:markdown-frontend]`). The mapping onto the contract is direct. A block-level element becomes one `Region` with `pieces` from its own ranges and its formatting structure resolved away by the parser. A fenced code block becomes a region with `participates: false`, wholesale. An inline code event becomes a `DelimitedSpan` whose `displayed` flag is decided by counting the backtick run at the span's own offset — a bounded byte count at a known position, which is the one place the design consults raw bytes on the prose path and is exactly the exception (`[ARCH-dec:linter:ast-frontends]`) names. A heading becomes a `Region` of kind `Heading`; its trailing mint form is scanned like any prose span, and the heading text before the separator becomes a `Head`.

```rust
pub fn parse(src: &SourceFile, a: &Adoption) -> Result<Parsed, Vec<Diagnostic>>;

/// The kind registry's Convention tables, read from the registry document
/// itself rather than transcribed (`[ARCH-dec:linter:registry-as-data]`).
pub fn tables(parsed: &Parsed) -> Vec<Table>;

pub struct Table { pub headers: Vec<String>, pub rows: Vec<Vec<String>>, pub span: ByteSpan }
```

Two notes ride with the surface rather than waiting to be discovered. pulldown-cmark's default option set is CommonMark, and the tables the registry-as-data path needs are a GitHub extension, so the parser is constructed with `Options::ENABLE_TABLES` — which changes what a region is for every document, not only the registry, and is therefore adoption-shaped rather than incidental. And a table cell is a region in its own right: the registry's rows carry kind tokens in plain code spans that are deliberately not label-shaped, and every one of them must be classified non-participating by the same rules as any other span, not by a special case for tables.

**Convention (Rust frontend surface)** · `conv:lint:rust-surface`

`frontend_rust` calls `syn::parse_file` and walks the item tree with `syn::visit::Visit`, feeding both duties from one parse (`[ARCH-conv:linter:rust-frontend]`). The scanned regions are exactly the documentation comments, which survive parsing as `#[doc]` attributes with spans; a run of consecutive `///` lines is one logical region, its leaders resolved away, per `[scanned-regions]`. The censuses read the item's own identifier and attributes and never its file path (`[LBL-judg:labels:derivation]`).

```rust
pub fn parse(src: &SourceFile, pre: &PreTokenized, a: &Adoption)
    -> Result<Parsed, Vec<Diagnostic>>;
```

The test profile's recognizer is "any attribute path whose final segment is `test`", which is the open rule `[profiles]` states so that a fourth harness needs no code change; the module profile's census counts module *definitions* — an inline `mod name { ... }` or the file backing a `mod name;` — once per definition and never per declaration, excluding `#[cfg(test)]` modules. Both are `[profiles]` data read by one walk, and both are inert while their profiles are staged (`dec:lint:staged-profiles`).

The classification rule of the test profile is the Cargo target containing the function, which `syn` cannot see: the item tree of one file says nothing about targets. The frontend therefore takes the target from the walk that produced the source — a `lib` or `bin` target's tree gives `unit`, a `tests/` target's tree gives `integration` — and the reading is the recorded one: target membership is a build-system class of the asset, the same species of fact as "the harness recognizes it as a test", and the derivation reads the target and never the path. That the two are computed from the same directory tree is a fact about Cargo's layout, not a path derivation (`[LBL-ansatz:labels:path-derivation]`).

**Decision (Byte offsets from syn spans need `span-locations`)** · `dec:lint:syn-spans`

`syn` reports spans as `proc_macro2::Span`, and the byte range of one is `Span::byte_range`, which is gated behind proc-macro2's `span-locations` feature. Its documentation states the caveat that decides the design: inside a procedural macro the range is accurate only on nightly, but "when executing in contexts like main.rs or build.rs, the byte range is always accurate regardless of toolchain" (docs.rs, proc-macro2 1.0.107, verified 2026-08-25). The linter is such a context — it is a binary parsing files, never a macro expanding — so the ranges are accurate on stable, and the crate depends on `proc-macro2` directly with `features = ["span-locations"]` to turn them on.

Two consequences are named here rather than found in implementation. The feature is additive across a build, so enabling it is a decision about the whole dependency graph rather than about this crate alone; the linter is a binary and its graph is its own, so nothing else in the workspace is affected. And every located Rust diagnostic in the crate rests on this one API — a doc-comment region, an item's span, a census entry's place — so a failure to enable the feature does not produce wrong offsets loudly but zero-width ones quietly. The gate therefore requires a test asserting a known byte range on a fixture before any Rust-frontend code is written (`gate:lint:implementation`).
