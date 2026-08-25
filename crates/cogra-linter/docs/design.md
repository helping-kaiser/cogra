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
