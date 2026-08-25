# The Corpus Linter — Design

_Phase 2 of the standard engineering process: the design. The review of 2026-08-25 ratified it; implementation follows behind the Gate at the end._

This document is the ratified design for `crates/cogra-linter`, the corpus linter whose concept closed in phase 1. It fixes the crate's module map, the two weight enums of the corpus graph, the public API surface of every slice at rustdoc level, the error taxonomy and its boundary against findings, the dependencies with individual arguments verified against their own current documentation, and a sized test plan; and it ends with the gate implementation must discharge. It decides nothing the architecture has already decided: the pipeline, the single-`StableDiGraph` corpus-graph model, the judgments-as-queries formulation, the frontend conventions, and the three fixed constraints are ratified there and cited here. What it settles is what the architecture left to this phase — the concrete module map against the boundaries that document drew, the node and edge weight enums behind its vocabulary sketch, the error taxonomy, the public shape of the slices, and the test plan's sizing. Where a ratified document could be read two ways, the reading is a Decision of this document; where the ratified documents settled nothing, the review ruled, and the ruling stands here as a Decision recorded where its topic lives.

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
  scan.rs           the label grammar: Label, Prefix, occurrence forms, near-misses
  pretokenize/
    mod.rs          the pre-tokenizer contract: comment regions and ban findings
    rust.rs         Rust's lexical structure: strings, raw strings, chars, comments
  bans.rs           banned-token classes as data; findings over pre-tokenizer output
  frontend.rs       the shared frontend contract: Region, Head, Asset, Table, Parsed
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
  migrate.rs        the migrations report: each staged profile's distance
  diag.rs           ByteSpan, Diagnostic, Severity, Location, RuleId, the total order
  render.rs         diagnostic rendering and the run summary
  error.rs          the thiserror taxonomy
  timing.rs         per-phase wall clock, the report of (`[ARCH-req:linter:timing]`)
tests/              acceptance suites and the vector corpora
fuzz/               audit-phase targets; absent from the version-1 tree
```

**Remark (What this adds to the ruled module list)** · `rem:lint:module-additions`

The architecture rules the module set `pretokenize`, `frontend_md`, `frontend_rust`, `frontend_web`, `frontend_kotlin`, `scan`, `bans`, `graph`, `judge`, `render`, and a thin binary (`[ARCH-dec:linter:crate-layout]`). Every one of those names survives here unchanged; `pretokenize` and `judge` gain children, which leaves them the modules they were. Eight modules are added, and each is named rather than slipped in, because a module map that quietly grows past its ruling is the first way a ratified boundary erodes. `adopt` holds the subsystem the architecture gives a Signature but no module (`[ARCH-sig:linter:adoption-data]`), and it is the whole of the first slice. `carrier` holds the walk and the owner assignment — R17 and R18 of (`tab:lint:functional`) — which run before any frontend and belong to neither. `frontend` holds the data contract the four frontends produce, which is the line a frontend would leave along. `registers` holds the generator side of register freshness, kept apart from `judge::freshness`, which only compares: one generator serving both the check and the regeneration mode is what (`req:lint:register-generator`) means by one generator, and separating production from comparison is what stops the check from acquiring a second one. `diag` holds the diagnostic type and its total order, `render` only formats what `diag` has already ordered. `error` holds the taxonomy, per the repository's error rule. `timing` holds the per-phase clock of (`req:lint:timing`). `migrate` holds the measurement of (`dec:lint:migrations-subcommand`), which is outside `judge` because it judges nothing: it computes a staged profile's census, which no check may do, and returns distances rather than diagnostics.

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
    /// For a generated region, the set it presents. A region participates in
    /// nothing it presents (`[LBL-inv:labels:generated-compliance]`). Empty
    /// domain in version 1: no citation index is designated.
    pub presents: Option<PresentedSet>,
}

/// What a generated region displays, and therefore what it may not feed.
pub enum PresentedSet { CitationIndex { upstream: OwnerId }, LabelRegister { profile: ProfileId } }

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

`RegionKind` lives in `frontend.rs`, the frontend contract's vocabulary (`sig:lint:frontend-api`), and `CommentForm` in `pretokenize`, the lexer's (`sig:lint:pretokenizer-api`). `graph` imports the first and reaches the second through it: a region's vocabulary belongs to whoever produced the region, and the node weight only records it.

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

Every generated register orders its rows bytewise by label, and the diagnostic order is likewise total and byte-decided (`[ARCH-req:linter:determinism]`), so `Ord` on `Label` must be exactly the bytewise order of ``kind:area:name``. It is not the order a derived `Ord` over three separate word fields gives, and the difference is not academic: the colon is `0x3A` and the digits are `0x30` through `0x39`, so a digit sorts *below* the separator. Compare ``a1:x:y`` against ``a:x:y`` — field-wise, `a` precedes `a1`; bytewise, `1` precedes `:` and ``a1:x:y`` comes first. The two orders disagree, and a register generated under one and compared under the other is stale on the day it is written.

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
    /// Which participating regions are heads, per format, and the
    /// case-exact matching rule (`dec:lint:head-recognition`).
    pub head_recognition: HeadRecognition,
    /// The failing set, as literal path prefixes
    /// (`dec:lint:enforcement-partition`).
    pub enforcement: EnforcementPartition,
}

impl Adoption {
    /// Load and validate. The one operation of the crate whose failure is an
    /// error and not a finding (`crit:lint:error-or-finding`).
    pub fn load(path: &Path) -> Result<Adoption, AdoptionError>;
    pub fn from_str(source: &str, origin: &Path) -> Result<Adoption, AdoptionError>;
    /// The registry document, from `[kinds.evidence]`: the file the
    /// classification relation is read out of (`dec:lint:registry-bootstrap`).
    pub fn registry_document(&self) -> PathBuf;
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

`registry_document` recovers a path from prose: `[kinds.evidence]`'s `adopted` names the edition's evidence base in a sentence, and the file the relation is read out of is the Markdown path that sentence carries. Trimming is by the characters a path is spelled with rather than by a pattern, so a path followed by a comma survives and no dialect enters (`[ARCH-dec:linter:no-regex]`). The alternative — a second key naming the same file — would let the two disagree about which document the acceptance rests on.

`Prefix` is the scanner's (`sig:lint:scanner-api`): the PREFIX production belongs to the label grammar, so Σ is validated against it at load rather than against a second spelling of the alphabet. Every hand-registered row and every family derivation passes through `Prefix::parse`, so every prefix Σ holds is one an imported citation could name — a registration the grammar refuses is `AdoptionError::MalformedPrefix` at its row (`sig:lint:error-taxonomy`), and a derivation it refuses admits nothing, leaving the owner registered by a hand-written row or not at all.

**Decision (TOML by the `toml` crate, deserialized with serde)** · `dec:lint:toml-parsing`

The adoption file is parsed by the `toml` crate through `serde`'s derived `Deserialize`, into the types above. The question is worth answering explicitly because the corpus's no-regex rule is easy to over-read: it forbids a regular-expression engine *on the analysis path* — recognition of the corpus's own text — and names configuration only to say that the path prefixes there are literal rather than patterned (`[ARCH-dec:linter:no-regex]`), (`[ARCH-sig:linter:adoption-data]`). A real TOML parser is the opposite of what that rule refuses: it is a parser where a pattern dialect would otherwise sit, which is the same argument (`[ARCH-dec:linter:ast-frontends]`) makes for the frontends. Hand-rolling a TOML reader would put a second, weaker parser of a standardized format in a crate whose whole thesis is that recognition belongs to real parsers. `toml::Spanned` is taken where a diagnostic wants to point at the row it complains about — a partition rule that names an unregistered owner, a profile whose standard place contradicts its census — so that an adoption defect is located in the adoption file rather than described.

The one duty this decision creates is discharged at the gate: `cargo tree -e normal` over the crate must show no regular-expression engine on the runtime edges, direct or transitive (`gate:lint:implementation`). The rule's words are "not as a direct dependency, not transitively relied upon for recognition", and a dependency check over the edges recognition runs on is the only way to hold it.

**Convention (Owner assignment)** · `conv:lint:owner-assignment`

Every carrier source and every covered asset takes its owner from the ordered rules of Ω by first match, and prefixes are admitted either from the hand-registered table or by a family's derivation rule (`[LBL-sig:labels:owners]`), (`[ARCH-conv:linter:owner-partition]`). Two consequences are structural rather than checked. Totality is a property of the last rule's empty prefix, so there is no "unowned source" state to represent and no diagnostic for one — R18 of (`tab:lint:functional`) reads "treat the partition's totality as structural" and this is what that means in the types: `owner_for` returns `OwnerId`, not `Option<OwnerId>`. And an asset's owner is its package and never its module (`[LBL-inf:labels:derivation-warrant]`), so the asset takes the owner of its source and refactoring inside a package moves nothing.

```rust
/// The carrier walk, over one corpus root under one adoption: the root is
/// `new`'s and the walk holds it, so `sources` takes no argument.
pub struct Walk<'a> { adoption: &'a Adoption, root: PathBuf }

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

Computing a staged profile's census inside the check — to report the migration's distance along the way — is refused for a reason of staging rather than of effort: the census is the input to the inventory judgment, and a computed-but-unjudged census inside the judging run is a half-computed pass, which is what (`[LBL-inv:labels:two-pass]`) exists to forbid. What the migration's distance wants is a measurement, and a measurement is not a lint; it has its own run and its own subcommand (`dec:lint:migrations-subcommand`).

Two mechanisms carry a profile into Π, and staging is what makes them necessary: a profile whose entry condition names its own registers cannot meet it out of a run that computes nothing for it.

The first is register generation for a staged profile. The regeneration mode, asked for a profile by name, computes that profile's census by the same machinery the measurement uses (`dec:lint:migrations-subcommand`) and emits its per-owner label registers from it, so the registers are generated and committed while the profile is still staged and `enters_when` is discharged by the thing it names. What staging forbids is a half-computed pass inside the *judging* run (`[LBL-inv:labels:two-pass]`), and a regeneration is not that run: it judges nothing, emits, and exits. The profile is named rather than swept up, because generating a staged profile's registers is a step in a migration and not something a whole-corpus regeneration does in passing. Exact byte comparison over those registers arms when the profile enters Π, the check emitting a register only for a profile in force (`sig:lint:register-api`).

The second is the derivation warrant's edge. Once a profile is effective, the harvest lays one `Derives` edge from each covered asset to the mint at the profile's standard place — asset to mint and never to label, for the reason (`sig:lint:edge-weights`) fixes — which is the input the inventory and warrant-totality queries read (`tab:lint:judgment-implementation`). Entering Π stays a commit that flips two fields: what these mechanisms remove is the impossibility, not the deliberateness.

## The span scanner · `sec:lint:scanner`

**Signature (Occurrences and the scanner)** · `sig:lint:scanner-api`

`scan.rs` implements the label language and nothing else. It reads region text and returns occurrences, near-misses, and at most one delimiter failure; it knows nothing of files, owners, or the graph.

```rust
/// A registered owner prefix: an uppercase letter followed by uppercase
/// letters and digits (`[LBL-lang:labels:label-language]`). `None` means the
/// text is not prefix-shaped, which is never a failure of the parse — the
/// prefix alphabet lies outside `Expectation`, so a prefix defect surfaces as
/// `NearMissKind::MisplacedBracket` and carries no position.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Prefix(Box<str>);

impl Prefix {
    pub fn parse(s: &str) -> Option<Prefix>;
    pub fn as_str(&self) -> &str;
}
impl fmt::Display for Prefix {}

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

/// Which delimiter a region's one delimiter failure belongs to.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Delimiter { Backtick, Acute }

/// A region's one delimiter failure: an opening acute the region ends without
/// closing (`[LBL-judg:labels:participation]`).
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub struct DelimiterFailure { pub at: usize, pub delimiter: Delimiter }

pub struct RegionScan {
    pub occurrences: Vec<Occurrence>,
    pub near_misses: Vec<NearMiss>,
    /// At most one, and only from `scan_code`: a delimiter failure ends the
    /// region's spans (`dec:lint:two-scan-entries`).
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

`scan_prose` fills no `delimiter_failure`. The unpaired backtick is the prose frontend's finding, because the frontend alone sees what it did not pair, and the `DelimitedSpan` contract is how "fails its block, and only its block" reaches the scanner: for the stretch whose spans the format leaves undefined the frontend supplies no span, so the scanner is structurally unable to read an occurrence out of it.

In code text pairing is settled before any span is parsed: an opening acute closes at the next acute in the region, whatever lies between, and the span so delimited parses as no form and is ordinary text. The consequence is recorded rather than worked around: an occurrence whose own opening acute is consumed as that closer is lost silently, and no failure is reported (`[LBL-judg:labels:participation]`).

Both take a `base` offset, which shifts a contiguous region's spans into file coordinates by addition. A logical region is not contiguous in general (`[LBL-gram:labels:well-formed]`) — a run of `///` lines with its leaders resolved away, a block quotation with its markers removed — and one offset cannot describe a piecewise mapping, so the mapping is `Region::locate` (`sig:lint:frontend-api`) and the caller applies it: the harvest scans with `base` zero and locates every span the scan reports. `scan.rs` therefore carries no notion of a piece, which is what keeps it a self-contained implementation of the label language (`rem:lint:split-lines`).

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
    /// A literal, in the form the language gives it.
    Literal(LiteralForm),
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum CommentForm {
    LineOuterDoc, LineInnerDoc, LinePlain,
    BlockOuterDoc, BlockInnerDoc, BlockPlain,
}

/// Rust's eight: a `//` inside a `c"…"` or a `b'…'` is no more a comment
/// than one inside a `"…"`, and a class the lexer does not know is a class
/// the ban would fire inside.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum LiteralForm {
    Str, RawStr, ByteStr, RawByteStr,
    CStr, RawCStr, Char, Byte,
}

pub struct PreTokenized {
    /// Every byte of the file, in order, classified exactly once.
    pub lexemes: Vec<Lexeme>,
    /// Text the lexer could not carry to its close: a hard diagnostic,
    /// never a guess.
    pub unclassified: Vec<Diagnostic>,
}

impl PreTokenized {
    /// Whether the lexemes partition `len` bytes: the predicate of
    /// (`inv:lint:lexeme-partition`), stated once so that every fixture, the
    /// property obligation, and the audit's fuzz target assert one thing.
    pub fn partitions(&self, len: usize) -> bool;
    /// Fill in what no byte-level lexer can know — which file the bytes came
    /// from, and whether findings there fail the lane.
    pub fn stamp(&mut self, path: &Path, source: &[u8], enforcement: Enforcement);
}

pub fn pretokenize(language: Option<&Language>, bytes: &[u8]) -> PreTokenized;
```

The language is an `Option` and the answer is total: a source with no language, and a language with no lexer, yield one `Code` lexeme over the whole input and no diagnostics. That is the partition's own answer to "nothing is known about this file's lexical structure", and it is why (`inv:lint:lexeme-partition`) is stated over the input rather than over the languages — the carrier holds files no frontend reads (`sig:lint:node-weights`), and every one of them still partitions.

`pretokenize` takes bytes and no file, which is what lets the fuzz target and the partition property feed it arbitrary input, and it never requires UTF-8: a Rust source that is not UTF-8 still pre-tokenizes, because a ban is a lexical fact and holds whether or not `syn` can read the file. The two fields of a `Diagnostic` the lexer cannot know are therefore filled afterwards, by the caller that holds the source — `stamp` for a caller that owns the pre-tokenizing, `stamped` for a frontend that borrows it.

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
pub fn findings(
    banned: &BannedTokens,
    src: &SourceFile,
    pre: &PreTokenized,
    enforcement: Enforcement,
) -> Vec<Diagnostic>;
```

The enforcement is an argument rather than a lookup, because a ban finding is produced where the source is in hand and the partition of (`dec:lint:enforcement-partition`) is the adoption's to decide, not the ban subsystem's: `findings` reports what the lexer saw, and which half of the corpus it lands in is settled by the caller that already matched the path.

That `BanRule::forbids` is a `LexClass` and not a string is the design's whole claim to the architecture's "never by pattern match": the rule names a class the lexer already decides, so a `//` inside a raw string is not a comment and cannot be a finding, and the two ruled entries — plain line comments and plain block comments — are `LexClass::Comment(CommentForm::LinePlain)` and `CommentForm::BlockPlain`. A ban that cannot be phrased as a lexeme class needs a lexer change, which is the correct place for it to become visible.

## Frontends · `sec:lint:frontends`

**Signature (The frontend contract)** · `sig:lint:frontend-api`

Every frontend produces the same things, and `frontend.rs` holds their types and nothing else.

```rust
/// One logical region: the unit the span scanner receives
/// (`[ARCH-def:linter:logical-region]`).
pub struct Region {
    pub kind: RegionKind,
    /// The region's own logical text, structure resolved away.
    pub text: String,
    /// The file ranges the logical text was assembled from, in order. Their
    /// lengths sum to the length of `text`: a piece is copied verbatim,
    /// never transformed, which is what makes `locate` exact.
    pub pieces: Vec<ByteSpan>,
    pub syntax: Syntax,
    pub participates: bool,
    pub generated: bool,
    /// For prose regions: the format's own delimited spans, already paired.
    /// Both offsets of each span index `text`.
    pub spans: Vec<DelimitedSpan>,
}

impl Region {
    /// The file span enclosing a region-local span. A logical span may cross
    /// a piece boundary, and the file range between its ends then covers the
    /// structure the logical text does not hold — which is what a diagnostic
    /// points at: the whole of what the author wrote, markers included.
    pub fn locate(&self, local: ByteSpan) -> ByteSpan;
    /// The file span enclosing the whole region.
    pub fn span(&self) -> ByteSpan;
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum RegionKind { Prose, Heading, Comment(CommentForm), Attribute, TableRow }

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

/// One table of a document, as its cells' regions spell it. The cell texts
/// are the regions' own logical text, so a cell holding a code span holds it
/// with its delimiters: reading a kind token out of one is the registry
/// parser's affair (`sig:lint:kind-registry-api`).
pub struct Table { pub headers: Vec<String>, pub rows: Vec<Vec<String>>, pub span: ByteSpan }

pub struct Parsed {
    /// The source this came from, relative to the corpus root.
    pub path: PathBuf,
    pub regions: Vec<Region>,
    pub heads: Vec<Head>,
    pub assets: Vec<Asset>,
    /// Its tables, in document order. Empty for a format with no tables.
    pub tables: Vec<Table>,
    /// What the frontend found wrong, each bounded as its discipline bounds it.
    pub diagnostics: Vec<Diagnostic>,
}

/// Parse one source with the frontend its language names. A language with no
/// frontend yields an empty `Parsed`: its files stay in the carrier and stay
/// owned, carrying no occurrences (`[LBL-judg:labels:minting]`).
pub fn parse(src: &SourceFile, pre: &PreTokenized, a: &Adoption)
    -> Result<Parsed, Vec<Diagnostic>>;
```

`Parsed` carries its own path, its tables, and its findings. The findings travel *beside* the regions and are never traded for them, which is what "fails its block and only its block" requires of the contract: an unpaired backtick is one diagnostic in `Parsed::diagnostics` and the rest of the file resolves normally (`[LBL-judg:labels:participation]`) — the same shape `WalkOutcome` gives a traversal failure (`conv:lint:owner-assignment`). `Err` is therefore reserved for a source that cannot be parsed at all, a Markdown file that is not UTF-8 being the case that arises. The tables are the registry-as-data path's input and belong to the shared contract rather than to `frontend_md`, because what a table *is* — header cells and body cells, each the logical text of its own region — is a fact about regions and not about pulldown-cmark (`[ARCH-dec:linter:registry-as-data]`).

`RegionKind::Attribute` is documentation written as an attribute rather than as a comment: the fifth documentation form `[scanned-regions]` names for Rust, a `#[doc = "…"]` whose region is the string literal's interior. It is not a `Comment`, because no comment form describes it and saying it was written `///` would be false about the bytes a diagnostic points at.

`pre` is the source's own pre-tokenizing, and the two frontends use it by their languages' shapes: Markdown has no lexical pre-pass and ignores it, while the Rust frontend reads a doc attribute's comment form out of it rather than re-deciding one `syn` already dropped (`conv:lint:rust-surface`).

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

The test profile's recognizer is "any attribute path whose final segment is `test`", which is the open rule `[profiles]` states so that a fourth harness needs no code change; the module profile's census counts module *definitions* — an inline `mod name { ... }` or the file backing a `mod name;` — once per definition and never per declaration, excluding `#[cfg(test)]` modules. Both are `[profiles]` data read by one walk, and both are inert while their profiles are staged (`dec:lint:staged-profiles`): the two censuses are computed and tested, and `Parsed::assets` carries neither, so entering Π flips fields rather than writing code. A `mod name;` declaration is neither a definition nor an asset, and the frontend reports it separately — the definition backing it is another file, and pairing the two is a cross-source step no frontend can take with one source in hand.

The classification rule of the test profile is the Cargo target containing the function, which `syn` cannot see: the item tree of one file says nothing about targets. The frontend therefore takes the target from the walk that produced the source — a `lib` or `bin` target's tree gives `unit`, a `tests/` target's tree gives `integration` — and the reading is the recorded one: target membership is a build-system class of the asset, the same species of fact as "the harness recognizes it as a test", and the derivation reads the target and never the path. That the two are computed from the same directory tree is a fact about Cargo's layout, not a path derivation (`[LBL-ansatz:labels:path-derivation]`).

**Decision (Byte offsets from syn spans need `span-locations`)** · `dec:lint:syn-spans`

`syn` reports spans as `proc_macro2::Span`, and the byte range of one is `Span::byte_range`, which is gated behind proc-macro2's `span-locations` feature. Its documentation states the caveat that decides the design: inside a procedural macro the range is accurate only on nightly, but "when executing in contexts like main.rs or build.rs, the byte range is always accurate regardless of toolchain" (docs.rs, proc-macro2 1.0.107, verified 2026-08-25). The linter is such a context — it is a binary parsing files, never a macro expanding — so the ranges are accurate on stable, and the crate depends on `proc-macro2` directly with `features = ["span-locations"]` to turn them on.

Two consequences are named here rather than found in implementation. The feature is additive across a build, so enabling it is a decision about the whole dependency graph rather than about this crate alone; the linter is a binary and its graph is its own, so nothing else in the workspace is affected. And every located Rust diagnostic in the crate rests on this one API — a doc-comment region, an item's span, a census entry's place — so a failure to enable the feature does not produce wrong offsets loudly but zero-width ones quietly. The gate therefore requires a test asserting a known byte range on a fixture before any Rust-frontend code is written (`gate:lint:implementation`).

## The judgments · `sec:lint:judgments`

**Signature (The run)** · `sig:lint:run-api`

The run entry is `lib.rs`'s, where the module map puts it (`model:lint:module-map`), and it loads nothing: the adoption data reach it as a value, already validated, so a run can never acquire a second way of learning about this corpus (`req:lint:adoption-data-only`).

```rust
/// What one complete run produced.
pub struct Run {
    /// Every finding, in the diagnostic order (`conv:lint:diagnostic-order`).
    pub findings: Vec<Diagnostic>,
    /// What each phase took (`req:lint:timing`).
    pub timing: Timing,
    /// The corpus graph, both passes complete.
    pub graph: Corpus,
    /// The registries the harvest completed.
    pub registries: Registries,
    /// The classification relation, or `None` where the registry document
    /// would not parse (`dec:lint:registry-bootstrap`).
    pub kinds: Option<KindRegistry>,
    /// Every carrier source's bytes, by path, as the harvest read them.
    pub sources: BTreeMap<PathBuf, Vec<u8>>,
}

impl Run {
    pub fn failing(&self) -> impl Iterator<Item = &Diagnostic>;
    pub fn advisory(&self) -> impl Iterator<Item = &Diagnostic>;
    /// Whether the failing set is clean, which is what the exit code reads.
    pub fn is_clean(&self) -> bool;
}

/// Check one corpus root under one adoption.
pub fn check(a: &Adoption, root: &Path) -> Result<Run, RunError>;

/// The same run with the walk done elsewhere.
pub fn check_sources(a: &Adoption, sources: Vec<SourceFile>) -> Run;

/// The five phases of (`[ARCH-req:linter:timing]`), and the clock over them.
/// A phase with no measurement is one this run did not perform, which a
/// report must not spell `0`.
pub enum Phase { Pretokenize, Harvest, Resolve, Judge, Render }
pub struct Timing { /* private */ }
```

The graph, the registries, the relation, and the bytes travel out with the findings because the generator consumes exactly them — `regenerate_all(g, r, a, k)` compared against what the run read (`sig:lint:register-api`) — and reaching them by a second harvest would be two passes of pass 1, which is the thing the staging exists to forbid (`[LBL-inv:labels:two-pass]`).

`check_sources` is the entry with the walk lifted out, and it is what makes the order-independence obligation statable at all (`tab:lint:metatheorem-tests`): it sorts the sources by path itself, so a shuffled traversal order reaches an identical harvest rather than one sorted back into shape afterwards. `check` is that plus the walk, and it returns `Err` for exactly one thing — a root that is not a directory. An unreadable tree inside a root that exists is a diagnostic beside a shorter source list (`[LBL-cav:labels:coexistence]`).

**Signature (Judgment surface)** · `sig:lint:judgment-api`

Every invariant is one free function over the graph, named for the clause it discharges, returning the diagnostics that clause produces and nothing else. A judgment never mutates the graph and never consults a later stage's output (`[ARCH-rule:linter:two-pass]`).

```rust
/// Run every judgment the adoption data puts in force, in a fixed order.
/// The order affects nothing but the collection sequence, which `diag`
/// re-sorts (`conv:lint:diagnostic-order`).
pub fn judge_all(
    g: &Corpus,
    r: &Registries,
    a: &Adoption,
    kinds: Option<&KindRegistry>,
) -> Vec<Diagnostic>;

pub mod labels {
    pub fn unique_mint(g: &Corpus, r: &Registries) -> Vec<Diagnostic>;
    pub fn total_resolution(g: &Corpus, r: &Registries) -> Vec<Diagnostic>;
    pub fn warrant_totality(g: &Corpus, r: &Registries, a: &Adoption) -> Vec<Diagnostic>;
    pub fn inventory(g: &Corpus, r: &Registries) -> Vec<Diagnostic>;
    pub fn generated_compliance(g: &Corpus, r: &Registries) -> Vec<Diagnostic>;
    pub fn anchor_harvest(g: &Corpus, a: &Adoption) -> Vec<Diagnostic>;
    pub fn synthetic_citation(g: &Corpus, a: &Adoption) -> Vec<Diagnostic>;
}

pub mod kinds {
    pub fn head_validation(g: &Corpus, k: &KindRegistry) -> Vec<Diagnostic>;
}

pub mod freshness {
    /// `sources` maps each carrier path to the bytes the run read.
    pub fn registers(
        g: &Corpus,
        r: &Registries,
        a: &Adoption,
        kinds: Option<&KindRegistry>,
        sources: &BTreeMap<PathBuf, Vec<u8>>,
    ) -> Vec<Diagnostic>;
}

/// Fill in what a judgment cannot know: enforcement, line, and column.
pub fn stamp(findings: &mut [Diagnostic], sources: &BTreeMap<PathBuf, Vec<u8>>, a: &Adoption);
```

Two shapes follow from the ruled signatures rather than bending them. A judgment takes the graph, the registries, and the adoption data, and none of those carries a file's bytes or the enforcement partition — so a judgment produces a finding with its span and its path and *zeros* for line, column, and enforcement, and one stamping pass fills all three at the end of the run. Computing them inside each judgment would mean handing every judgment the corpus's bytes for the sake of two integers, and a finding about the adoption data rather than about a source keeps its zeros, which is exactly what "no source holds this" should look like.

And `freshness::registers` is not called by `judge_all`: it needs the committed bytes and the generator's own inputs, which the ruled judgment signature does not carry, so the run calls it beside `judge_all` and the two lists are stamped together (`sig:lint:run-api`). Comparing against the bytes the run read, rather than against a second read of the tree, is what keeps the answer about the corpus that was linted (`dec:lint:one-generator`).

**Table (Each judgment as a query)** · `tab:lint:judgment-implementation`

The architecture states each invariant as a graph query (`[ARCH-tab:linter:judgments-as-queries]`); this table fixes the query against the weights of (`sig:lint:node-weights`) and (`sig:lint:edge-weights`), so that implementation has nothing left to invent.

| Clause | Query |
| --- | --- |
| (`[LBL-inv:labels:unique-mint]`) | every `Label` node with in-degree two or more over `Mints`; `Registries::mints` names the first, every other is reported against it, and neither node is dropped |
| (`[LBL-inv:labels:total-resolution]`) | every `Citation` node has out-degree exactly one over `ResolvesTo`; zero is unresolved, and a `labels` hit with a `mints` miss elsewhere adds the import-form suggestion |
| (`[LBL-inf:labels:imported-citation]`) side conditions | every `Citation` with a prefix has out-degree exactly one over `Cites`; zero is an unregistered prefix; a `Cites` target equal to the citing owner is a self-qualified import — checked in the same traversal as the row above, both being degree checks over the one node |
| (`[LBL-inv:labels:warrant-totality]`) | for each `Mint`: its label's kind lies in K exactly when the mint has an incoming `Derives` edge; a K-kind with no governing effective `Profile` is a hard failure with neither warrant available |
| (`[LBL-inv:labels:inventory]`) | for each effective `Profile`: the `Covers`→`Derives` composition is a bijection onto the labels carried at the profile's standard place, checked per owner under `owner_view`; non-injectivity names both assets |
| (`[LBL-inv:labels:generated-compliance]`) | every occurrence in a `generated` region is a `Mint` with an incoming `Derives` or a `Citation` with a `ResolvesTo`; a region's `presents` set is excluded from the harvest it feeds |
| (`[LBL-inf:labels:anchor-harvest]`) | `EdgeFiltered` view over `Anchors` from a designated document's body regions into the designated upstream owner; empty domain today |
| (`[LBL-inf:labels:synthetic-citation]`) | designated typed-data strings become `Citation` nodes like any other; empty domain today |
| (`[KND-judg:kinds:head-validation]`) | every `Head` node has out-degree exactly one over `ValidatesAs`; zero is an uncatalogued pair, two is an ambiguous reduction |
| (`[IDN-rule:identity:well-founded-graph]`) | `petgraph::algo::is_cyclic_directed` over the relevant view, when identity checking lands; no subject in version 1 |

Two rows are worth their own sentence. Unique minting is a degree check that consults the registry for one thing only — which mint came first — because the registry is where the two met and the loser was handed back (`sig:lint:index-maps`); the graph holds both, so the diagnostic names the duplicate and points at the earlier one, and no information the insertion had is lost by reading it back. And the empty-domain rows are implemented, not skipped: a check whose domain is empty passes vacuously and a check that does not exist passes by absence, and the difference shows up on the day a designation is recorded.

**Convention (Findings are values, errors are the linter's own failure)** · `conv:lint:finding-or-error`

No judgment returns `Result`. A judgment's subject is the corpus, its answer is a list of diagnostics, and an empty list is the positive answer — the same shape the sibling crate gives its verdicts, for the same reason (`[ICX-def:interchange:acceptance]`). What travels in `Err` is only the linter's own inability to proceed, which (`crit:lint:error-or-finding`) fixes and which the taxonomy of (`sig:lint:error-taxonomy`) turns out to be very small.

**Decision (A registry-as-data failure suppresses kind validation loudly)** · `dec:lint:registry-bootstrap`

Parsing the classification relation out of the registry document is a bootstrap dependency: a defect there degrades kind validation corpus-wide (`[ARCH-dec:linter:registry-as-data]`). The design handles it in one place and never silently. `KindRegistry::from_markdown` returns `Result<KindRegistry, Vec<Diagnostic>>`, whose `Err` is a list of located findings on the registry document itself; `judge_all` then takes `kinds: None`, runs every label judgment normally — the registry document is linted first by the rules that need no kinds, exactly as the architecture's mitigation says — and emits one further diagnostic naming kind validation as suppressed and the count of heads not validated. The alternative, treating an unvalidatable head as valid, would make a broken registry look like a clean corpus, which is the failure mode the whole bootstrap must not have.

**Signature (Kind registry surface)** · `sig:lint:kind-registry-api`

```rust
/// The effective classification relation C_A = C ∪ X_A
/// (`[KND-sig:kinds:registry-data]`).
pub struct KindRegistry { /* private */ }

impl KindRegistry {
    /// Read C from the registry document's own Convention tables, derive the
    /// hybrid rows from the declared triples, and check their side
    /// conditions (`[KND-inf:kinds:hybrid]`).
    pub fn from_markdown(doc: &Parsed, src: &str, a: &Adoption)
        -> Result<KindRegistry, Vec<Diagnostic>>;
    /// Add the acceptee's recorded extensions. Empty in version 1.
    pub fn with_extensions(self, x: &KindExtensions) -> KindRegistry;
    /// The kinds an exact catalogue name carries; several, for a homonym.
    pub fn classify<'a>(&'a self, name: &str) -> impl Iterator<Item = &'a Kind> + 'a;
    /// `base_A(h)`: the exact catalogue name after device removal
    /// (`[KND-def:kinds:presentation-reduction]`).
    pub fn reduce(&self, head: &str) -> Reduced;
    /// `C_A ⊢ h ✓ k`, by an exact pair or one reduction through one base pair.
    pub fn validate(&self, head: &str, declared: &Kind) -> HeadVerdict;
    /// `Hom(C_A)`, derived and never declared (`[KND-def:kinds:homonymy]`).
    pub fn homonyms(&self) -> impl Iterator<Item = (&str, &Kind)> + '_;
    /// The five counts of (`[KND-tab:kinds:headline-counts]`), derived from
    /// the tables alone.
    pub fn headline_counts(&self) -> HeadlineCounts;
    /// Every pair of C_A with the status the registry attests it at: the
    /// companion register's rows (`[KND-req:kinds:attestation-register]`).
    pub fn rows(&self) -> impl Iterator<Item = (&str, &Kind, Attestation)>;
    /// Where the registry document's headline table sits, for the generated
    /// region that is spliced back into it.
    pub fn headline_region(&self) -> Option<ByteSpan>;
}

/// How firmly the registry attests one pair.
pub enum Attestation { Firm, Borderline }

/// One route from a head to an exact catalogue name, and the devices removed
/// on the way (`[KND-def:kinds:presentation-reduction]`).
pub struct Reduction { pub base: Box<str>, pub devices: Vec<Device> }

pub enum Device { Family(DeviceFamily), Modifier(Box<str>) }

/// The spelling rules the registry may admit. A family is a rule and not a
/// name, and an undeclared family strips nothing
/// (`dec:lint:reduction-vocabulary`).
pub enum DeviceFamily {
    AttachedName, Containment, Continuation, Lettering, Numbering,
    Overriding, Placement, Restatement, Starred, SubPrefix,
}

/// `base_A(h)`: usually one route, often none.
pub struct Reduced { pub routes: Vec<Reduction> }

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HeadVerdict {
    /// An exact catalogue name carrying the declared kind.
    Exact,
    /// Reduced through exactly one base pair.
    Reduced { base: Box<str> },
    /// The head reduces to a name the relation does not carry with this kind.
    Uncatalogued { base: Box<str> },
    /// More than one base pair applies: the reduction is ambiguous.
    Ambiguous { bases: Vec<Box<str>> },
}
```

`KindRegistry` lives in `judge/kinds.rs`, with the judgment it exists for: reading the relation and validating heads against it are one subject, and splitting them would put the parser and its only consumer in different modules.

`homonyms`, `headline_counts`, `rows`, and `headline_region` are public because they are the generator's inputs (`req:lint:register-generator`): the companion register presents `Hom(C_A)` and every attested pair, and the registry document's headline table is a generated region derived from the tables alone — which is why the span it occupies is part of the surface and not an internal detail of the parse. Deriving all of them from the same parsed relation the validation uses is what makes the register a view of the classification rather than a second copy of it.

`from_markdown` takes the adoption data because a diagnostic about the registry document carries an enforcement, and enforcement is computed from `[enforcement]` (`dec:lint:enforcement-partition`) rather than invented by the parser that happens to produce the finding. `with_extensions` takes the adoption's own `KindExtensions` — X_A is adoption data like everything else about this corpus (`req:lint:adoption-data-only`), and it is empty in version 1.

**Decision (The reduction vocabulary is registry data)** · `dec:lint:reduction-vocabulary`

The devices presentation reduction removes are the device rows of (`[KND-conv:kinds:hybrids]`), and `KindRegistry::reduce` reads them from the registry document by the same path that yields the classification relation itself (`[ARCH-dec:linter:registry-as-data]`). Nothing of the vocabulary is transcribed into `corpus-adoption.toml` and nothing of it is compiled in as a list, which is what keeps one vocabulary in one place: the registry defines the environments and the devices alike, and a corpus that copied the devices would hold a second copy to drift.

The division of labor inside the vocabulary is stated rather than blurred, because the two halves are not the same kind of thing. The **device families** — numbering, lettering, attached names, stars and unnumbering, restatement, continuation, iterated `sub-` prefixes, placement, containment — are spelling rules, and a spelling rule is code: no table row can say "strip a trailing star". What the rows carry is which families the registry *admits*, so `reduce` runs exactly the routines the registry declares and an undeclared family is not stripped. The **modifiers** are single names, and they are wholly data: a modifier is one row, and the twelve the registry carries reach `reduce` as strings it never spells out. That is the half (`[ARCH-conv:linter:markdown-frontend]`) had in view in calling the modifier list adoption data, and it is satisfied by the registry being the datum.

The overriding rows need no separate datum. `HeadVerdict::Exact` is tried before reduction, so a head that is itself an exact catalogue name is never reduced — which is what an overriding row *is*, and why (`[KND-judg:kinds:head-validation]`) writes its second disjunct as "h is not an overriding row". Working hypothesis and Standing hypothesis carry `assum` as ordinary rows of (`[KND-conv:kinds:setup]`), and the device table declares the family so a reader can find it; the linter derives the behavior from the ordering of the two disjuncts and consults no list.

**Decision (Head recognition is adoption data)** · `dec:lint:head-recognition`

`[head-recognition]` of the adoption data fixes which participating regions are heads, and `frontend_md` reads it rather than knowing it: the two Markdown forms this corpus writes — a bold `Kind (Title)` run opening a block, and a heading, each closed by the separator and the mint — the separator itself, and the languages that have no head form at all. A code comment is a scanned region that carries occurrences and heads nothing, which is why `frontend_rust` produces no `Head` values.

Two details are load-bearing and are fixed here. For the bold form the head is the text up to the opening parenthesis: the Title names this instance and the head names the genre, and handing the Title to the registry would ask it to classify a proper noun. For a heading the head is the rung the format supplies and not the heading's own text, exactly as (`[KND-def:kinds:presentation-reduction]`) rules for named divisions — Markdown's rung is Section, which the registry classifies `sec`, and every heading anchor in the corpus carries `sec` accordingly.

Matching is case-exact, ruled, and the consequence is named rather than discovered: `HeadVerdict::Uncatalogued` fires on a head whose only defect is capitalization, and its diagnostic names the catalogue spelling, so the finding reads as the correction it is. Folding case would be the cheaper-looking road and the wrong one — it would make Table and table one name and widen N by a rule no row of the registry authorizes.

## Registers · `sec:lint:registers`

**Signature (Register surface)** · `sig:lint:register-api`

One generator produces every generated register the disciplines call for, and the check and the regeneration mode consume the same output (`req:lint:register-generator`), (`[ARCH-rule:linter:register-freshness]`).

```rust
/// A register as the generator produces it: a path and the exact bytes.
pub struct Register { pub path: PathBuf, pub bytes: Vec<u8>, pub scope: RegisterScope }

pub enum RegisterScope {
    /// One per owner with covered assets, for one inventory profile.
    LabelRegister { owner: OwnerId, profile: ProfileId },
    /// The companion attestation register (`[KND-req:kinds:attestation-register]`).
    Attestation,
    /// A generated region inside an authored file, not a whole file
    /// (`[KND-tab:kinds:headline-counts]`).
    Region { host: PathBuf, span: ByteSpan },
}

/// Regenerate in memory. Total: it reads the completed registries and
/// writes nothing.
pub fn regenerate_all(g: &Corpus, r: &Registries, a: &Adoption, k: Option<&KindRegistry>)
    -> Vec<Register>;

/// Compare one register against what is committed. `committed` is the bytes
/// the run read, never a second read of the tree.
pub fn compare(reg: &Register, committed: Option<&[u8]>) -> Freshness;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Freshness {
    /// Byte-identical.
    Current,
    /// Differs, with the offset of the first differing byte.
    Stale { at: usize },
    /// Never generated: no committed bytes exist to compare against
    /// (`req:lint:register-generator`).
    Staged,
}

/// Write, in the regeneration mode only, never from a check. Every register
/// path is corpus-relative, so the root the run was given is what turns one
/// into a file.
pub fn write_all(regs: &[Register], scope: &Scope, root: &Path)
    -> Result<Written, GenerateError>;

/// Which owners a regeneration touches. A scoped regeneration ignores
/// unrelated owners' defects (`[LBL-cav:labels:coexistence]`).
pub enum Scope { WholeCorpus, Owner(OwnerId) }
```

**Decision (Exact bytes, and no digest anywhere)** · `dec:lint:no-digest`

`compare` is `Vec<u8>` against `&[u8]` and there is no hash in the crate — not of a register, not of a file, not as an internal optimization that could later persist. This is the linter's whole share of the identity discipline, taken as its charter states it: the freshness comparison is exact bytes, and the affirmative no-identity outcome is the recorded stop (`[IDN-case:identity:artifact]`), (`[IDN-case:identity:no-identity]`), (`[IDN-crit:identity:benefit]`), (`req:lint:determinism`). A digest here would fail the benefit criterion — it would buy nothing over comparing two byte strings that are both already in memory — and would owe a walked adjudication and an admission record it could not discharge (`[IDN-req:identity:admission-record]`). The design records the stop rather than the absence, which is what (`[IDN-req:identity:stop-record]`) asks, and the gate turns it into a check: the crate's dependency graph carries no content-digest library and its source names no digest (`gate:lint:implementation`). The hash-table machinery under the index maps (`sig:lint:index-maps`) and inside petgraph is the transient internal hashing R15 of (`tab:lint:functional`) permits — it decides a bucket and never leaves the process, which is the whole distinction between an optimization and an identity.

`Stale` carries the offset of the first difference and not a diff, because a diff is a rendering concern and `render` has the two byte strings.

**Decision (Regeneration is idempotent and its output is the check's input)** · `dec:lint:one-generator`

`regenerate_all` is called by both modes and its result is the only description of what a register should contain. The check compares that result against disk; the regeneration mode writes it. Nothing generates a register twice by two routes, which is the concrete content of "one generator" (`req:lint:register-generator`), (`[KND-req:kinds:attestation-register]`). Two properties follow and are obligations rather than remarks: regeneration is idempotent, and a check run immediately after a write reports `Current` for every register it wrote (`tab:lint:metatheorem-tests`).

The headline counts are a generated *region* inside an authored file rather than a generated file, so `RegisterScope::Region` carries its host and span and `write_all` splices rather than replaces — the one place the generator edits a file it does not own end to end, and the reason `environment-kinds.md` is not in `[carrier]` `generated_files`.

Two of the three scopes have subjects. The companion attestation register is committed and compared byte-exact on every run, as `[kinds.register]` records, and so is the headline region it stands beside; between them they arm the comparison for the corpus that exists. `RegisterScope::LabelRegister` has none: its profile is staged, so the check derives no owner's register, and the named regeneration that generates them is the migration's own step (`dec:lint:staged-profiles`). `Freshness::Staged` is what that state reports — a register with no committed bytes is not out of date, and saying "stale" of a file that does not exist names the wrong repair.

## Diagnostics and the command line · `sec:lint:output`

**Signature (Diagnostic)** · `sig:lint:diagnostic-api`

```rust
/// A half-open byte range of a source, in whole-file coordinates. The crate's
/// one span type: `scan` and every frontend import it from here, because a
/// span exists to be pointed at in a diagnostic.
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ByteSpan { pub start: usize, pub end: usize }

impl ByteSpan {
    pub const fn new(start: usize, end: usize) -> ByteSpan;
    /// Saturating, so a malformed span from a frontend cannot panic a scan.
    pub const fn len(&self) -> usize;
    pub const fn is_empty(&self) -> bool;
}

/// One finding about the corpus.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Diagnostic {
    pub rule: RuleId,
    pub severity: Severity,
    pub enforcement: Enforcement,
    pub primary: Location,
    /// Further locations the finding needs — the other mint of a duplicate,
    /// the second asset of a collision — each with its own note.
    pub related: Vec<Related>,
    pub message: String,
}

/// A stable rule identifier. Deliberately a plain token and never a label:
/// `lint` is a reserved kind no profile governs, so a label-shaped rule id
/// would be a hard failure of the linter's own sources
/// (`[LBL-sig:labels:reserved-kinds]`), `[reserved-kinds]` of the adoption data.
#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct RuleId(&'static str);

impl RuleId {
    pub const fn new(token: &'static str) -> RuleId;
    /// The rule a `[banned-tokens]` row identifies, whose token has no
    /// static home: leaked once, the first time it is seen.
    pub fn interned(token: &str) -> RuleId;
}

#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Severity { Error, Warning }

/// Whether this finding fails the build or is reported only. Computed
/// from the finding's path against `[enforcement]` of the adoption data
/// (`dec:lint:enforcement-partition`), never from its severity.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Enforcement { Failing, Advisory }

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Location {
    pub path: PathBuf,
    pub span: ByteSpan,
    /// One-based, computed once at render time from the source bytes.
    pub line: u32,
    pub column: u32,
}

pub struct Related { pub at: Location, pub note: String }
```

Every rule the crate reports is a `const RuleId` in the module that reports it, which is what makes `RuleId` a `&'static str` and keeps it `Copy`. `[banned-tokens]` breaks that shape deliberately — a future ban is a new row and not new code (`sig:lint:bans-api`) — so a row's identifier arrives owned and with no static home, and `interned` is the smallest resolution: the token is leaked once and every later call answers with the same pointer, so the leak is bounded by the distinct identifiers of one adoption file rather than by the number of findings. Making `RuleId` owned instead would cost it `Copy`, which every `const` in the crate rests on.

**Convention (The diagnostic order)** · `conv:lint:diagnostic-order`

`Ord` on `Diagnostic` is implemented, not derived, and is exactly path, then the primary span's start offset, then the rule identifier — the three keys (`[ARCH-req:linter:determinism]`) fixes and in that order. A derived `Ord` would compare the fields in declaration order, putting the rule first, and would then have to be kept honest by field order forever. Two runs over one tree emit one output because the walk sorts its sources by path, every judgment collects deterministically, and the whole list is sorted by this comparator before rendering. The comparator is total on the corpus — two diagnostics with the same path, offset, and rule are the same finding — which is a property obligation rather than a claim (`tab:lint:metatheorem-tests`).

**Decision (Enforcement comes from the adoption data)** · `dec:lint:enforcement-partition`

`Diagnostic::enforcement` is computed by matching the finding's path against the `failing` prefixes of `[enforcement]`, under `[carrier]`'s own literal-prefix semantics and with `advisory` as the default. The failing set is the two documentation trees written under the discipline — the linter's own docs, which hold the four disciplines and the architecture beside its phase artifacts, and the interchange crate's; everything else is reported without failing the lane, and each completed migration adds a prefix (`rep:lint:first-corpus`), `[enforcement]` of the adoption data.

Two properties of the shape are deliberate. Enforcement is orthogonal to severity: an error is an error wherever it is found and the diagnostic says so, with only the exit code differing — so an advisory tree's defects stay visible in full rather than being demoted into warnings a reader learns to skim. And the partition is adoption data rather than a lane flag, because growing it is a claim that a migration has completed, and this repository makes that kind of claim by a reviewed edit to a committed file, not by an argument list.

`check --advisory` lists the advisory half; without it, advisory findings are counted in the summary and not listed, so a run that is clean on the failing set reads as clean.

**Decision (One diagnostic form, fixed and machine-parseable)** · `dec:lint:diagnostic-format`

Version 1 renders one diagnostic form and no second one, and the form is part of the crate's contract rather than an incidental of `render`:

```text
path:line:col: severity rule: message
    path:line:col: note
```

One line per finding; the related locations of (`sig:lint:diagnostic-api`) follow it, indented four spaces, each in the same `path:line:col:` shape. `severity` is `error` or `warning`, `rule` is the `RuleId` token, and the message is a single line — a diagnostic that wants a paragraph wants a related location instead.

The choice is not human-readable *against* machine-readable: this form is both. It is the shape a GitHub Actions problem matcher consumes with no translator in front of it, which is the only machine consumer the linter's consumer set actually has (`sig:lint:consumers`), and it is the shape a compiler-trained reader already parses by eye. A JSON form is not refused, only unbuilt: if one is ever wanted it touches `render` and nothing else, because no judgment, register, or error site knows how output is spelled. Being a contract, the form is stable — changing it is a breaking change to whatever consumes it, and the rustdoc on `render` says so.

**Decision (Migration distance is its own subcommand)** · `dec:lint:migrations-subcommand`

`cogra-lint migrations` computes the censuses of the staged profiles and reports, per profile, how far its entry condition still has to travel: for `rust-test`, the covered assets counted against the registers not yet generated; for `rust-module`, the definitions counted against those still lacking the inner documentation comment, each located. It is delivered with slice 6, where the register generator it reports against lands.

```rust
/// One staged profile's distance from its entry condition.
pub struct Migration {
    pub profile: ProfileId,
    pub kind: Kind,
    pub enters_when: Box<str>,
    /// The assets its census covers today.
    pub covered: usize,
    /// What its entry condition still wants, one located line each.
    pub remaining: Vec<Remaining>,
}

impl Migration {
    /// Whether the entry condition holds as measured.
    pub fn arrived(&self) -> bool;
}

/// One thing a migration still has to do, where it has to be done.
pub struct Remaining { pub at: Location, pub note: String }

pub fn distances(a: &Adoption, root: &Path, only: Option<&ProfileId>)
    -> Result<Vec<Migration>, RunError>;
```

The measurement takes the cross-source step a frontend cannot: the module profile's distance pairs each `mod name;` declaration with the definition backing it in another file, which is why `migrate` walks the corpus itself rather than reading one `Parsed`. What it looks at, it says: a definition counts as arrived when its own source carries a mint of the derived label inside an inner documentation comment, and that the comment opens the module's body is not checked.

It is never part of `check`, and the separation is the whole of why it is safe. `check` runs the judgments the adoption data puts in force, and a staged profile is not in force (`dec:lint:staged-profiles`); a census computed inside that run would be a half-computed pass of exactly the kind (`[LBL-inv:labels:two-pass]`) exists to forbid. `migrations` is its own run with its own pass 1, it judges nothing, it emits no diagnostic and no verdict, and it always exits `0` on a corpus it could read. What it produces is a measurement, and a measurement reported as a measurement costs the staging nothing.

**Signature (Command line)** · `sig:lint:cli-api`

Three modes: a check that writes nothing, an explicit mode that regenerates in place (`[ARCH-rule:linter:register-freshness]`), and the measurement of (`dec:lint:migrations-subcommand`).

```rust
#[derive(clap::Parser)]
#[command(name = "cogra-lint")]
struct Cli {
    /// The corpus root. Defaults to the working directory.
    #[arg(long, default_value = ".")]
    root: PathBuf,
    /// The adoption data. Defaults to `<root>/corpus-adoption.toml`.
    #[arg(long)]
    adoption: Option<PathBuf>,
    #[command(subcommand)]
    command: Command,
}

#[derive(clap::Subcommand)]
enum Command {
    /// Check the corpus. Writes nothing, ever.
    Check {
        /// Report advisory findings too. Off by default.
        #[arg(long)]
        advisory: bool,
    },
    /// Regenerate every generated register in place.
    Regenerate {
        /// Restrict to one owner (`[LBL-cav:labels:coexistence]`).
        #[arg(long)]
        owner: Option<String>,
        /// Report what would change and write nothing.
        #[arg(long)]
        dry_run: bool,
    },
    /// Report how far each staged profile's migration still has to travel.
    /// Judges nothing and writes nothing (`dec:lint:migrations-subcommand`).
    Migrations {
        /// Restrict to one staged profile.
        #[arg(long)]
        profile: Option<String>,
    },
}
```

Exit codes are the machine-readable half of (`[ARCH-req:linter:diagnostics-not-panics]`): `0` is a clean corpus, `1` is findings on the failing set (`dec:lint:enforcement-partition`), `2` is the linter's own failure — a malformed adoption file, an unusable root, a write that failed. That findings and crashes are different codes is what lets a CI lane tell "the corpus is wrong" from "the linter is broken", and the concept names that distinction as a consumer requirement (`sig:lint:consumers`). `regenerate` and `migrations` exit `1` only on findings of their own scope, and `migrations` has none.

`clap` with its `derive` feature is the technical answer to a technical question, and it is taken rather than debated: it is the argument parser the Rust ecosystem documents, the derive API is the one its own documentation leads with, and the alternative — hand-rolling three subcommands — buys nothing and loses the help output CI operators read. Version and features are in (`tab:lint:dependencies`).

## Errors · `sec:lint:errors`

**Criterion (Error against finding)** · `crit:lint:error-or-finding`

One test decides which surface a failure belongs to. If the input is exactly the kind of thing the operation takes and the answer is negative, it is a **finding** and travels as a `Diagnostic`. If the linter cannot do its job at all, it is an **error** and travels in `Err`.

The criterion cuts unusually far toward findings here, and deliberately: (`req:lint:diagnostics`) and (`[ARCH-req:linter:diagnostics-not-panics]`) put an unreadable tree, an unpaired backtick, a frontend parse error, and a defective foreign owner all on the finding side, each scoped exactly as the discipline scopes it. A file that will not parse is a fact about the corpus, which is what the linter reports. What remains on the error side is small enough to enumerate: the adoption data will not load, the corpus root is not a directory, or a write in the regeneration mode failed. Everything else is a diagnostic, and a taxonomy this small is the design working rather than the design being thin.

**Signature (Error taxonomy)** · `sig:lint:error-taxonomy`

Three leaf enums and one aggregate, all in `error.rs`, all derived with `thiserror`, each `#[non_exhaustive]`, each `Send + Sync + 'static`, each `Display` message lowercase and unpunctuated per the Rust API Guidelines' error conventions.

```rust
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum AdoptionError {
    #[error("cannot read the adoption data at {path}")]
    Unreadable { path: PathBuf, #[source] source: io::Error },
    #[error("adoption data is not well-formed TOML")]
    Syntax(#[source] toml::de::Error),
    #[error("partition rule {order} names owner {owner}, which no prefix registers")]
    UnknownOwner { at: Location, order: u32, owner: String },
    #[error("prefix {prefix} is not an uppercase letter followed by uppercase letters and digits")]
    MalformedPrefix { at: Location, prefix: String },
    #[error("prefix {prefix} is registered twice")]
    DuplicatePrefix { at: Location, prefix: String },
    #[error("the last partition rule does not carry the empty prefix, so Ω is not total")]
    PartitionNotTotal { at: Location },
    #[error("profile {id} is missing its {datum}")]
    ProfileIncomplete { at: Location, id: String, datum: &'static str },
    #[error("profile {id} governs kind {kind}, which is not reserved in K")]
    UngovernedKindNotReserved { at: Location, id: String, kind: String },
    #[error("the effective profile count {stated} disagrees with the {found} profiles not staged")]
    EffectiveCountMismatch { at: Location, stated: usize, found: usize },
}

impl AdoptionError {
    /// The row this defect sits in, where the defect has one.
    pub fn at(&self) -> Option<&Location>;
}

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum WalkError {
    #[error("corpus root {path} is not a directory")]
    NotADirectory { path: PathBuf },
}

#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum GenerateError {
    #[error("cannot write the register at {path}")]
    Write { path: PathBuf, #[source] source: io::Error },
    #[error("the generated region at {path} has no host span to splice into")]
    MissingHostRegion { path: PathBuf },
}

/// One error type for a consumer that wants one.
#[derive(Debug, thiserror::Error)]
#[non_exhaustive]
pub enum RunError {
    #[error(transparent)] Adoption(#[from] AdoptionError),
    #[error(transparent)] Walk(#[from] WalkError),
    #[error(transparent)] Generate(#[from] GenerateError),
}
```

Every variant that can be located is located, which is the linter's own version of the rule it imposes on its dependency (`[ICX-def:interchange:acceptance]`): an adoption defect names the row it sits in, taken from `toml::Spanned` (`dec:lint:toml-parsing`), because an unlocated complaint about a thousand-line configuration file is a worse diagnostic than the linter would accept from anything else. `AdoptionError::at` is where a consumer reads the row, and the two variants that have none — a file the filesystem would not yield and one the TOML parser rejects, the latter located by its own parser's message — answer `None`.

`AdoptionError::UngovernedKindNotReserved` and `EffectiveCountMismatch` are load-bearing rather than defensive. The first holds `[reserved-kinds]`'s own rule — every kind governed by Π lies in K (`[LBL-sig:labels:profiles]`) — at load time, where a violation is one line in one file rather than a corpus-wide misclassification. The second holds the staged-profile bookkeeping honest: `effective = 0` beside two `status = "staged"` profiles is a consistent file, and `effective = 1` beside two staged ones is not, and R19's "entering is a commit that flips two fields" is only safe if something checks that both were flipped.

`LabelSyntax` (`sig:lint:near-miss-api`) is not in the taxonomy, and its absence is the point: it is the one `Err` the crate routinely discards, because a delimited span that parses as no form is ordinary text and never a failure (`[LBL-gram:labels:well-formed]`). It is public so that a near-miss can say how far the parse got, and its rustdoc says in as many words that surfacing it as a diagnostic is a defect.

`anyhow` appears in `main.rs` and nowhere else — the repository's rule names both crates, and the division is the documented one: `thiserror` for a library's typed surface, `anyhow` for a binary that only wants to print what went wrong and exit `2`.

## Dependencies · `sec:lint:dependencies`

**Table (Dependencies)** · `tab:lint:dependencies`

Every version was verified against the crate's own docs.rs page on 2026-08-25, not against the architecture's table and not by recall, per the build-from-official-sources rule and (`req:lint:workspace-discipline`). Re-verification at the moment implementation starts is a gate clause (`gate:lint:implementation`).

| Crate | Version verified | Date | Source | Kind | Role |
| --- | --- | --- | --- | --- | --- |
| petgraph | 0.8.3 | 2026-08-25 | docs.rs/petgraph | runtime | the corpus graph and every judgment over it |
| pulldown-cmark | 0.13.4 | 2026-08-25 | docs.rs/pulldown-cmark | runtime | the Markdown frontend |
| syn | 3.0.4 | 2026-08-25 | docs.rs/syn | runtime | the Rust frontend: item census, doc attributes |
| proc-macro2 | 1.0.107 | 2026-08-25 | docs.rs/proc-macro2 | runtime | `span-locations`, for byte ranges out of syn spans |
| toml | 1.1.4+spec-1.1.0 | 2026-08-25 | docs.rs/toml | runtime | the adoption data, with `Spanned` for located defects |
| serde | workspace `1` | 2026-08-25 | workspace `Cargo.toml` | runtime | the derived `Deserialize` the `toml` crate consumes |
| thiserror | 2.0.20 | 2026-08-25 | docs.rs/thiserror | runtime | the taxonomy of (`sig:lint:error-taxonomy`) |
| anyhow | workspace `1` | 2026-08-25 | workspace `Cargo.toml` | runtime | `main.rs` only |
| clap | 4.6.6 | 2026-08-25 | docs.rs/clap | runtime | the two modes of (`sig:lint:cli-api`), `derive` feature |
| proptest | 1.11.0 | 2026-08-25 | docs.rs/proptest | dev | the obligations of (`tab:lint:metatheorem-tests`) |
| swc_ecma_parser | slice 7 | — | — | runtime | the web frontend (`[ARCH-conv:linter:web-frontend]`) |
| tree-sitter + first-party grammar | slice 8 | — | — | runtime | the Kotlin frontend (`[ARCH-dec:linter:kotlin-tree-sitter]`) |
| cogra-interchange | when envelope validation opens | — | — | runtime | R19 of (`tab:lint:functional`); nothing reimplemented linter-side |
| cargo-fuzz, libfuzzer-sys, arbitrary | audit phase | — | — | dev | the targets of (`preview:lint:fuzz-plan`), absent from the version-1 tree |

Two versions have moved since the architecture's table of 2026-08-20 and the movement is recorded rather than absorbed. syn stands at 3.0.4 where the architecture pinned 3.0.3; the pin is a floor and Cargo's caret resolves upward, so nothing is owed but the note. `toml` stands at 1.1.4, a crate the architecture's table does not carry at all, because the adoption-data parser is this document's decision (`dec:lint:toml-parsing`). swc and tree-sitter are deliberately unverified here: they belong to slices 7 and 8, their verification is owed at those slices' own starts, and swc's aggressive major cadence makes a version verified now worthless by then.

**Justification (Each first-slice dependency)** · `just:lint:dependency-argument`

*petgraph.* Ruled rather than chosen (`[ARCH-dec:linter:petgraph-first-class]`); the argument is that the ruling holds up against the crate as it stands. `stable_graph::StableDiGraph<N, E, Ix = DefaultIx>` exists as the alias the corpus-graph model names, and it is the type whose documented purpose is index stability across mutation — which is exactly why pass 2 can add edges to indices pass 1 handed out. `visit::NodeFiltered` and `visit::EdgeFiltered` both exist as documented graph adaptors, which is what makes (`[ARCH-rem:linter:views-not-wrappers]`) implementable rather than aspirational: a restricted graph is an adaptor over a borrow, with no wrapping on our side. The `visit` module also carries `IntoNodeReferences`, `IntoEdgeReferences`, `EdgeRef`, `NodeIndexable`, and `Visitable`, which are the traits the generic algorithms take, so a free function over `&Corpus` and the same function over a filtered view are one function. All four facts read off docs.rs on 2026-08-25.

*pulldown-cmark.* `Parser::into_offset_iter(self) -> OffsetIter<'input, F>` exists and yields `(Event, Range)` pairs mapping each event to its position in the source, which is the whole of what the Markdown frontend needs and the reason the architecture named this driver (`[ARCH-conv:linter:markdown-frontend]`). Its three constructors are `new`, `new_ext`, and `new_with_broken_link_callback`; the frontend uses `new_ext`, because the tables the registry-as-data path parses are a GitHub extension and `Options::empty()` is CommonMark only. `Options::ENABLE_TABLES` is a documented flag and is the only one enabled — every other extension would change what a region is, corpus-wide, for no discipline's benefit.

*syn.* The architecture flags syn's 3.x major boundary as owing verification before the first line depends on it (`[ARCH-tab:linter:dependencies]`), and it is discharged here. At 3.0.4 the four items the Rust frontend names all exist: the function `parse_file`, the type `File`, the type `Attribute`, the module `visit` with its `Visit` trait, and `spanned::Spanned`. The feature set matters and is recorded: `derive`, `parsing`, `printing`, `clone-impls`, and `proc-macro` are default, while `full` and `visit` are optional — so a linter parsing whole files needs `features = ["full", "visit", "extra-traits"]` and gets `parsing` from the defaults. One gap is named rather than papered over: docs.rs surfaces no 2.x-to-3.x migration note, so what changed at the major boundary was not verifiable from the crate's own documentation page, and the verification above is a positive check that the named items exist at 3.0.4 rather than a survey of what moved. Anything the frontend reaches for beyond those five items is verified at the slice.

*proc-macro2.* Not a choice but a consequence: syn's spans are `proc_macro2::Span`, and the byte range of one is `Span::byte_range(&self) -> Range<usize>`, gated behind the `span-locations` feature. Its documentation is explicit about when the range is meaningful — inaccurate inside a procedural macro on stable, and "always accurate regardless of toolchain" outside one — and the linter is outside one (`dec:lint:syn-spans`). The dependency is direct rather than transitive precisely so the feature is switched on where a reader can see it.

*toml and serde.* `toml::from_str` deserializes into a `#[derive(Deserialize)]` type, and `toml::Spanned` is documented as "a spanned value, indicating the range at which it is defined in the source", which is what turns an adoption defect into a located diagnostic rather than a sentence. serde arrives with it and is already a workspace dependency, so the crate adds no new supply-chain surface for it. The case for a real parser over a hand-rolled reader is (`dec:lint:toml-parsing`).

*thiserror.* Mandated by the repository's error rule and carried into this crate by (`req:lint:workspace-discipline`). The argument for it as a dependency is its own: it "deliberately does not appear in your public API. You get the same thing as if you had written an implementation of std::error::Error by hand, and switching from handwritten impls to thiserror or vice versa is not a breaking change" (docs.rs, thiserror 2.0.20, 2026-08-25). Adopting it costs consumers nothing and abandoning it would cost them nothing.

*clap.* The derive API — `#[derive(Parser)]`, `Subcommand`, `Args` — is enabled by the `derive` feature and is the API clap's own documentation leads with. Two subcommands and four flags is under the threshold where hand-rolling is defensible, and the help output is what a CI operator reads when the lane fails.

*proptest.* The concept makes the calculus's metatheorems executable obligations (`conv:lint:metatheorems-as-tests`), and each is universally quantified over generated corpora, which is what a property framework is for and what a vector table cannot express. proptest carries the `Strategy` trait, the `proptest!` macro, and the `collection` module supplying the `vec` and `hash_map` strategies a generated corpus needs; its default case count is 256, "which can be overridden by setting the `PROPTEST_CASES` environment variable" (docs.rs, proptest 1.11.0, 2026-08-25) — the number the property lane's budget in (`tab:lint:budgets`) is stated against. It is also the framework the sibling crate already uses, so the repository carries one property framework and not two.

*cogra-interchange.* Named now, depended on later. R19 of (`tab:lint:functional`) makes delegation total — envelope, encoding, and acceptance validation are wholly the sibling crate's, reimplementing nothing linter-side (`[ARCH-dec:linter:interchange-first-party]`) — and the crate's audit and commissioning phases have closed, so the slice that opens this dependency inherits a finished library rather than a parallel build.

**Decision (Refused dependencies)** · `dec:lint:refused-dependencies`

Six a reader might expect, refused with reasons, so no later contributor re-derives them.

*Any regular-expression engine.* The fixed constraint, and the one place this crate has no discretion at all (`[ARCH-dec:linter:no-regex]`). The signed exception lives inside the interchange crate and reaches nothing here (`[ARCH-dec:linter:cddl-regexp-library]`).

*`walkdir` or `ignore`.* The carrier is defined by literal path prefixes in the adoption data — a prefix ending in `/` matches a tree, a prefix naming a file matches that file, and there is no pattern dialect (`[ARCH-sig:linter:adoption-data]`). `ignore` would bring glob semantics and `.gitignore` resolution to a walk whose whole specification says neither applies, which is a pattern dialect entering by the back door; `walkdir` brings ordering and symlink policy the design must fix itself anyway, since the walk sorts by path for determinism. A recursive `std::fs::read_dir` with sorted entries is some dozens of lines and is the thing the specification describes.

*A diagnostic-rendering crate.* `codespan-reporting` and its kin render source excerpts with carets and colors. The output is one fixed line per finding plus its related locations (`dec:lint:diagnostic-format`), chosen so a problem matcher reads it without a translator; a renderer that draws source excerpts would produce something no matcher parses, for a reader who is usually a CI log.

*Any content-digest crate.* (`dec:lint:no-digest`). The absence is a checkable gate clause, not a preference.

*`rayon`.* The slice-1 carrier is 58 Markdown files and 73 Rust files, measured; parallelism buys nothing at that size and costs the thing the design is built to guarantee, since a parallel harvest makes completion order observable in exactly the place (`[ARCH-req:linter:determinism]`) forbids it. If the corpus ever grows to where this matters, the two-pass staging is what makes parallelism safe to add — pass 1 is embarrassingly parallel per file — and the decision is taken then, with a measurement in front of it.

*`serde_json`.* Nothing in version 1 is serialized: the diagnostic form is fixed and it is text (`dec:lint:diagnostic-format`). A JSON form would bring this crate with it and touch `render` alone, which is why nothing else in the design knows how output is spelled.

## Test plan · `sec:lint:tests`

**Strategy (Test plan)** · `strat:lint:test-strategy`

Four bodies of tests, differing in what they are evidence for. **Clause tests** are evidence that the linter discharges the gates it is accepted against: one test per clause of (`[LBL-gate:labels:implementation]`), of the mechanical part of (`[KND-gate:kinds:adoption]`), of the two duties (`conv:lint:non-mechanical`) leaves from (`[IDN-gate:identity:implementation]`), and of (`[ARCH-gate:linter:architecture-review]`) — each naming its clause, over this corpus's ruled adoption data, consulting no third document, which is the shape every gate fixes for itself (`conv:lint:gates-as-acceptance`). **Vector tests** are evidence that the parsers agree with the grammars on cases someone chose. **Properties** are evidence that the calculus's metatheorems hold of the code, one per metatheorem so that a failure names the theorem it broke (`conv:lint:metatheorems-as-tests`). **Fuzzing** is evidence about inputs nobody chose, and it belongs to the audit phase by the concept's ruling. Alongside all four, every public item carries a rustdoc example that `cargo test` compiles and runs.

One acceptance suite stands apart and is the milestone: *the linter lints its own four discipline documents*, then the architecture, then the interchange and linter phase artifacts (`rep:lint:first-corpus`). It runs over the real tree rather than a fixture, and it is the test that says the thing works.

**Table (Sized test plan)** · `tab:lint:test-sizing`

Counts are the design's estimate of scope, to be met or explained, not a ceiling.

| Body | Source | Rough count | Shape |
| --- | --- | --- | --- |
| Label grammar | (`[LBL-lang:labels:label-language]`) productions | ~70 | accept and reject over `kind`, `area`, `name`: digits, hyphens at edges, empty words, uppercase, three colons, one colon, non-ASCII |
| Occurrence forms | (`[LBL-gram:labels:well-formed]`) | ~40 | the three forms in both syntaxes; nesting refused; a span parsing as no form is text; the near-miss classes of (`sig:lint:near-miss-api`) |
| Delimiter regimes | (`[LBL-judg:labels:participation]`) | ~25 | prose: unpaired backtick fails its block and only its block; code: unclosed opening acute fails, an acute opening nothing is text |
| Markdown regions | (`conv:lint:markdown-surface`) | ~45 | block elements, list continuation, quote markers, wrapped spans, fenced blocks non-participating, single versus double backtick at the offset, headings and their mints, table cells |
| Pre-tokenizer | (`[ARCH-dec:linter:pretokenizer]`) | ~55 | `//` inside a string, a raw string, a raw string with hashes, a byte string, a char literal, an apostrophe in a lifetime; nested block comments; unterminated forms; the partition invariant on every fixture |
| Banned tokens | `[banned-tokens]` | ~12 | both ruled classes, each found where it is a comment and not found where it is not |
| Rust frontend | (`conv:lint:rust-surface`) | ~35 | the five doc-comment forms of `[scanned-regions]`; a `///` run as one region; the test census over the three attribute paths and the open rule; the module census over definitions, not declarations, with `#[cfg(test)]` excluded |
| Adoption loader | `corpus-adoption.toml` | ~25 | every section round-trips; each `AdoptionError` variant, each located at its row |
| Registry as data | (`[ARCH-dec:linter:registry-as-data]`) | ~30 | the registry document is the fixture: its own tables parsed, its hybrid triples derived and side-conditioned, its headline counts recomputed and compared, `Hom(C_A)` derived |
| Judgments | the four gates, clause by clause | ~55 | one test per clause, named for it |
| Registers | (`sig:lint:register-api`) | ~18 | `Current`, `Stale` with the first differing offset, `Staged`; scoped regeneration ignoring another owner's defects; the spliced generated region |
| Diagnostics | (`conv:lint:diagnostic-order`) | ~12 | the three sort keys; totality on the corpus; the exit-code mapping |
| Properties | (`tab:lint:metatheorem-tests`) | 10 | proptest, default 256 cases, budgeted separately |
| Corpus acceptance | (`rep:lint:first-corpus`) | ~8 | the four disciplines, the architecture, the interchange artifacts, the linter's own concept and design |
| Doc tests | the public API | ~45 | compiled by `cargo test` |

**Table (Metatheorem and design obligations)** · `tab:lint:metatheorem-tests`

The first four rows are the calculus's metatheory made executable, one property per metatheorem, named after it (`conv:lint:metatheorems-as-tests`). The last six are properties of this design rather than of the calculus, and each is here because it is a claim this document makes that would otherwise go unchecked.

| Obligation | Property |
| --- | --- |
| (`[LBL-metathm:labels:order-independence]`) | over generated corpora and shuffled traversal orders: the rendered output is byte-identical |
| (`[LBL-metathm:labels:no-self-support]`) | over generated corpora with a designated index: an index row never sustains its own membership, and removing a document's last body citation of a label stales the committed index |
| (`[LBL-metathm:labels:warrant-lapse]`) | over generated transitions of a covered asset: renaming its identifier, changing its classification, or removing it from the census dangles exactly the citations of the facet that moved; moving it across packages dangles exactly the imports under the old prefix; moving it within its package dangles nothing |
| (`[LBL-metathm:labels:presentation-invariance]`) | over generated corpora and re-formings that preserve every label value: every registry, every harvested set, and every generated register is unchanged |
| (`prop:lint:label-order`) | `a.cmp(b)` agrees with the bytewise comparison of `a.as_str()` and `b.as_str()` on generated pairs |
| (`inv:lint:lexeme-partition`) | over arbitrary byte strings: the lexeme spans are ascending, non-overlapping, and cover the input exactly once |
| (`conv:lint:diagnostic-order`) | the comparator is a total order, and two runs over one generated corpus emit the same sequence |
| (`dec:lint:one-generator`) | regeneration is idempotent, and a check run immediately after a write reports `Current` for every register written |
| (`dec:lint:ownership-by-edge`) | `owner_of` agrees with the partition's first-match rule for every node of a generated corpus |
| (`sig:lint:index-maps`) | every key of `mints` is a key of `labels`, and every `ResolvesTo` target is a node `labels` holds |

**Table (Budgets)** · `tab:lint:budgets`

(`req:lint:timing`) and (`[ARCH-req:linter:timing]`) require a budget beside every recurring action; a recurring action with no budget is itself a defect. The numbers below are the design's proposals, sized against the measured slice-1 carrier of 58 Markdown files and 73 Rust files, and the first measured run replaces each with a measurement. Exceeding a budget thereafter is a finding, not a cost to absorb.

| Action | Proposed budget | Tolerance | Replaced by |
| --- | --- | --- | --- |
| full-corpus `check`, warm | 3 s | +50% | the first green full run |
| per-phase report | every phase named and timed | — | (`[ARCH-req:linter:timing]`) fixes the five phases |
| vector and clause lane (`cargo test`) | 60 s | +50% | the first green lane |
| property lane at 256 cases | 120 s | +50% | the first green lane |
| the linter's addition to `make ci` | 90 s | +50% | commissioning |

The property lane is timed separately from the vector lane, because the two grow for different reasons and a case count raised without noticing is exactly the regression the rule exists to catch.

**Preview (Fuzzing, deferred to audit)** · `preview:lint:fuzz-plan`

Four targets, written at the audit phase and not before, each with its seed corpus named now so the audit does not start from nothing. `pretokenize_rust`: arbitrary bytes into `pretokenize`, asserting no panic and that (`inv:lint:lexeme-partition`) holds — the strongest single assertion the crate has, since it is total on every input. `scan_region`: arbitrary text into `scan_prose` and `scan_code`, asserting no panic and that every reported span lies within the input. `markdown_regions`: arbitrary text into `frontend_md::parse`, asserting no panic and that every region's pieces lie within the file and do not overlap. `adoption_load`: arbitrary text into `Adoption::from_str`, asserting no panic and that success implies a total partition. Seed corpora: the corpus's own Markdown and Rust files, the vector fixtures of (`tab:lint:test-sizing`), and `corpus-adoption.toml`.

Two notes the audit must not discover late. `cargo-fuzz` needs the nightly toolchain for its sanitizer flags, so the fuzz lane is a separate toolchain from the one `make ci` runs and stays a manual lane — the sibling crate's audit established both facts on this machine. And the deferred hazards this document names are exactly where the audit found real defects last time: the recursive descent of the Markdown region walk and the pre-tokenizer's unterminated-form handling are the two places to look first.

## Sequencing · `sec:lint:sequencing`

**Decision (Slice sequencing)** · `dec:lint:slice-sequencing`

Six slices to version 1, in this order, then the two later frontends. The decomposition is the ratified one, confirmed here with each slice's public surface attached, and the slice boundaries are the commit boundaries: each leaves `make ci` green and none lands half-built.

| Slice | Delivers | Public surface |
| --- | --- | --- |
| 1 | adoption loader and the graph skeleton | (`sig:lint:adoption-api`), (`conv:lint:owner-assignment`), (`sig:lint:node-weights`), (`sig:lint:edge-weights`), (`sig:lint:index-maps`), (`dec:lint:graph-free-functions`), (`sig:lint:diagnostic-api`), (`conv:lint:diagnostic-order`) |
| 2 | the span scanner | (`prop:lint:label-order`), (`sig:lint:scanner-api`), (`sig:lint:near-miss-api`) |
| 3 | the Markdown frontend | (`sig:lint:frontend-api`), (`conv:lint:markdown-surface`), (`sig:lint:kind-registry-api`) |
| 4 | the Rust frontend, the pre-tokenizer, the bans | (`sig:lint:pretokenizer-api`), (`inv:lint:lexeme-partition`), (`sig:lint:bans-api`), (`conv:lint:rust-surface`) |
| 5 | the judgments and the run entry | (`sig:lint:judgment-api`), (`tab:lint:judgment-implementation`), (`sig:lint:run-api`) |
| 6 | register freshness, generated compliance, the migrations report | (`sig:lint:register-api`), (`dec:lint:one-generator`), (`sig:lint:cli-api`), (`dec:lint:migrations-subcommand`) |
| 7 | the web frontend | `frontend_web`, verified against swc's own documentation at the slice |
| 8 | the Kotlin frontend | `frontend_kotlin`, behind the zero-error precondition (`[ARCH-dec:linter:kotlin-tree-sitter]`) |

Slice 2 is independent of slice 1 and may be worked in parallel: `scan.rs` takes region text and returns occurrences, and it names no type from `adopt`, `carrier`, or `graph` — a claim the module map makes checkable rather than hopeful (`rem:lint:split-lines`). Nothing else parallelizes: 3 needs 1 and 2, 4 needs 3's contract, 5 needs 4's census, and 6 needs 5's registries.

Slice 6 is where the corpus changes as well as the code: the first register generation commits the companion attestation register and the headline region it stands beside, and arms exact byte comparison over both from then on (`req:lint:register-generator`), `[kinds.register]` of the adoption data. The per-owner label registers are the test profile's, and a named regeneration generates them while it is still staged, which is what its entry condition asks for (`dec:lint:staged-profiles`); entering Π is a separate commit that flips two fields. The migrations report (`dec:lint:migrations-subcommand`) lands in the same slice for the same reason: it reports each staged profile's distance against the generator that closes one of the two migrations, so before slice 6 half of what it would say has no referent.

## Rejected Ansätze · `sec:lint:rejected`

**Ansatz (The owner in every weight)** · `ansatz:lint:owner-in-weights`

Copy an owner index into every node weight, so no judgment has to walk for it. Then the graph carries the partition twice — once in `Owns` edges and once in fields — and after any mutation nothing says which copy is right. The failure is silent by construction: a judgment reading the field and a judgment reading the edge disagree, and both look correct. Rejected in favor of (`dec:lint:ownership-by-edge`), with the index maps carrying the one lookup where the walk would actually cost something.

**Ansatz (A derived ordering on a three-field label)** · `ansatz:lint:derived-label-order`

Hold `Label` as three word fields and derive `Ord`. Then the order is field-wise, the registers are written in it, and the bytewise comparison every register is checked under disagrees the first time a kind is a prefix of another kind followed by a digit — `a` against `a1`, because the digits sit below the colon in ASCII. A register generated in one order and compared in another is stale on the day it is written, and the diagnostic says the file is out of date rather than that the comparator is wrong. Rejected in favor of (`prop:lint:label-order`).

**Ansatz (A frontend trait)** · `ansatz:lint:frontend-trait`

Define `trait Frontend` and implement it four times. Then the return types carry an object-safety constraint they have no other reason to satisfy, the dispatcher gains a `dyn` boundary for a `match` over four known arms, and the contract lives in two places — the trait and the shared data types — with only one of them enforced. Rejected in favor of (`dec:lint:frontend-dispatch`); a trait admits implementations its author does not know, and there are none.

**Ansatz (Findings folded into the error type)** · `ansatz:lint:findings-as-errors`

Make every judgment return `Result<(), Error>` and let the `?` operator carry findings out. Then the first finding ends the run — where a linter's whole value is reporting all of them — and the difference between "the corpus has a defect" and "the linter cannot read the adoption file" collapses into one type, which is the exact distinction the exit codes exist to preserve. Rejected in favor of (`conv:lint:finding-or-error`) and (`crit:lint:error-or-finding`).

**Ansatz (A parallel harvest)** · `ansatz:lint:parallel-harvest`

Harvest files in parallel, since pass 1 is per-file and independent. Then completion order enters the collection order, and determinism becomes something to restore by sorting rather than something the staging already guarantees (`[ARCH-req:linter:determinism]`). The measured carrier does not need it, and adopting it before a measurement demands it is paying the determinism risk for nothing. Rejected for version 1, and recorded as the shape a later measurement would license.

**Ansatz (Judging a staged profile partially)** · `ansatz:lint:partial-inventory`

Compute a staged profile's census and judge inventory over the assets that already carry their labels, reporting the rest as progress. Then inventory — which admits nothing partial by its own words (`[LBL-inv:labels:inventory]`) — is enforced in a weakened form nothing recorded, a profile is half in force with no fact in the adoption data saying so, and the migration completes into a check that was already passing. Rejected in favor of (`dec:lint:staged-profiles`). Reporting the distance *without* judging it is a different proposal, and it has its own run (`dec:lint:migrations-subcommand`).

## Implementation gate · `sec:lint:implementation-gate`

**Gate (Implementation)** · `gate:lint:implementation`

The design phase closed at the review of 2026-08-25, whose rulings stand as the Decisions of this document and whose confirmations discharge the clauses below that name them. The implementation phase closes, and the audit phase opens, only when all of the following hold — the four outstanding clauses owed before the code they govern is written, not after.

Discharged at the review:

- the module map (`model:lint:module-map`) stands as stated, the seven additions to the architecture's ruled list included (`rem:lint:module-additions`);
- the two weight enums (`sig:lint:node-weights`), (`sig:lint:edge-weights`) stand with their endpoints, and the two additions to the architecture's vocabulary sketch — the `Pair` node and the `Covers` edge — are accepted;
- the error taxonomy (`sig:lint:error-taxonomy`) and its boundary against findings (`crit:lint:error-or-finding`) stand;
- the test plan's sizing (`tab:lint:test-sizing`) and the obligations of (`tab:lint:metatheorem-tests`) stand as the acceptance suite's scope;
- the slice sequencing (`dec:lint:slice-sequencing`) stands, with slice 2's independence from slice 1 accepted as the only parallelism claimed.

Outstanding:

- the workspace entry exists and `crates/cogra-linter` is a member, with the CI lane and the budgets of (`tab:lint:budgets`) recorded beside it;
- every dependency version of (`tab:lint:dependencies`) is re-verified against docs.rs at the moment implementation starts, rather than against this document;
- a fixture test asserts a known byte range out of a `syn` span with `span-locations` enabled, before any Rust-frontend code depends on it (`dec:lint:syn-spans`);
- `cargo tree -e normal` over the crate shows no regular-expression engine on the runtime edges, direct or transitive — the rule forbids what recognition relies upon, and dev-only test tooling recognizes nothing of the corpus (`[ARCH-dec:linter:no-regex]`) — and no content-digest library, the hash-table machinery the index maps and petgraph carry being the transient internal hashing R15 of (`tab:lint:functional`) permits (`dec:lint:no-digest`);
- every citation in this document resolves — a check the finished linter runs on the document that designed it.
