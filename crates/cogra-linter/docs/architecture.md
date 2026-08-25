# A Corpus Linter over petgraph

_Architecture, third draft — incorporates the review rulings of 2026-08-20 on the second draft's open questions; implementation remains blocked by the gate_

This document lays out, for architectural review, a linter written in Rust whose job is to mechanically discharge the checkable obligations of the four discipline documents — the label calculus, the kind registry, the identity adjudication procedure, and the interchange conventions — over a corpus of Markdown prose and compiled-platform source. The second draft's rulings stand: plain `//` comments are banned from Rust sources; the web frontend is swc; CBOR and CDDL are a first-party sibling crate; the first owner-partition convention is one owner per package and one per major document. This draft resolves what remained open: the banned-token mechanism is a hand-written pre-tokenizer; the Kotlin frontend is un-deferred and adopted on tree-sitter with a first-party grammar, written from scratch and vendored; the CDDL `.regexp` operator is implemented with a real regex library inside the interchange crate, as a signed exception; and the linter lives at `crates/cogra-linter`. The LaTeX frontend remains deferred. Three constraints stand from the first draft as recorded decisions: petgraph first-class and unwrapped, tokenizing without regex on the analysis path, and AST frontends only. The Gate at the end blocks implementation until its remaining items are discharged.

The document practices the discipline it describes: the label at each heading or environment head is that environment's mint; a parenthesized label in running text is a same-owner citation; material in fenced blocks and double-backtick spans is displayed without participating. Every label minted here has area `linter`. The document title is publication metadata and mints nothing. Imported citations use four provisional owner prefixes, proposed for the corpus's Signature Σ and pending its recorded adoption: `LBL` for the label calculus, `KND` for the kind registry, `IDN` for the identity adjudication procedure, and `ICX` for the interchange conventions; this document's own proposed prefix is `ARCH`.

## Charter · `sec:linter:charter`

**Formulation (Charter)** · `formul:linter:charter`

One binary walks the corpus and answers: does every source conform to the adopted disciplines? Concretely, the linter discharges (`[LBL-gate:labels:implementation]`) in full — parsing the three occurrence forms, enforcing unique minting, resolving every citation, checking warrants, validating inventory profiles, and verifying generated registers — and the mechanically checkable clauses of (`[KND-gate:kinds:adoption]`) — head validation, kind-token distinctness, catalogued pairs, register regeneration. From the identity discipline it takes one standing duty and one prohibition: generated publications are checked by exact byte comparison (`[IDN-case:identity:artifact]`), and the linter itself admits no digest anywhere without a walked adjudication (`[IDN-crit:identity:benefit]`). The interchange conventions are implemented by a first-party sibling crate built as a parallel task (`dec:linter:interchange-first-party`); the linter consumes that crate when envelope validation enters its scope. The linter also polices token bans (`rule:linter:banned-tokens`). It is a checker, never a fixer in its first version: it reports; humans and future tooling repair.

**Table (Gate coverage)** · `tab:linter:gate-coverage`

| Obligation | Source discipline | Subsystem here |
| --- | --- | --- |
| Occurrence parsing, minting, resolution | label calculus | span scanner + corpus graph (`model:linter:corpus-graph`) |
| Warrants, profiles, inventory | label calculus | census frontends + graph judgments (`tab:linter:judgments-as-queries`) |
| Head validation against kinds | kind registry | registry-as-data (`dec:linter:registry-as-data`) + reduction (`conv:linter:markdown-frontend`) |
| Register freshness, headline counts | label calculus, kind registry, identity | regeneration + exact byte compare (`rule:linter:register-freshness`) |
| Digest restraint | identity | policy: no digests minted by the linter at all in v1 |
| Token bans | this corpus's own rules | pre-tokenizer + banned-token scan (`dec:linter:pretokenizer`) |
| Envelope and encoding validation | interchange | the first-party interchange crate (`dec:linter:interchange-first-party`), consumed by the linter in a later slice |

## Fixed constraints · `sec:linter:constraints`

**Decision (petgraph, first-class and unwrapped)** · `dec:linter:petgraph-first-class`

Every in-memory graph-shaped data structure in the repository is a petgraph type, used directly. No newtype, trait facade, or wrapper struct stands between the linter's code and petgraph's API — module boundaries expose `StableDiGraph<NodeW, EdgeW>` and friends as themselves, and shared logic over graphs is free functions taking petgraph types, not methods on a wrapper. Graph databases and other persistent storage are outside the rule: it governs in-memory structures only. The rule has teeth because petgraph is designed for it — its algorithms are generic over visitor traits, and its `NodeFiltered` and `EdgeFiltered` adaptors give projected views of a graph without any wrapping on our side (`rem:linter:views-not-wrappers`). Pinned at 0.8.3, the newest stable release (verified against crates.io, 2026-08-20).

**Decision (Tokenizing, never regex)** · `dec:linter:no-regex`

No regular-expression engine appears on the linter's analysis path — not as a direct dependency, not transitively relied upon for recognition. Every recognition the disciplines require is span-local and structural: the label grammar (`[LBL-lang:labels:label-language]`) is a colon-joined triple over `[a-z0-9]` words, decidable by a character-level scanner of a few dozen lines; delimiter classification is byte counting at a span boundary; participation (`[LBL-judg:labels:participation]`) is a property of the AST, which no byte-level pattern can see; and banned tokens are found by the hand-written pre-tokenizer (`dec:linter:pretokenizer`), not by patterns. The near-miss warnings the calculus asks for (`[LBL-inv:labels:total-resolution]`) are produced by the same scanner reporting how far a span got before failing to parse. The rule carries exactly one signed exception, scoped to the interchange crate and to nothing else: the CDDL `.regexp` control operator is real regex by standard, and is implemented there with a proper library (`dec:linter:cddl-regexp-library`).

**Decision (AST frontends)** · `dec:linter:ast-frontends`

Analysis runs over syntax trees, never raw text. Markdown is parsed by pulldown-cmark; Rust by syn; TypeScript and TSX by swc's ECMAScript parser (`conv:linter:web-frontend`); Kotlin by tree-sitter (`dec:linter:kotlin-tree-sitter`), adopted on the evidence of (`rep:linter:kotlin-parser-study`). A LaTeX frontend is deferred (`open:linter:latex-frontend`). Raw bytes are consulted only where the AST hands back a span and the discipline needs the span's delimiter form — counting the backticks that opened a code span — and in the pre-tokenizer pass (`dec:linter:pretokenizer`), which is itself a tokenizer over the file, not a pattern search.

**Table (Dependencies)** · `tab:linter:dependencies`

Versions verified against crates.io on 2026-08-20. syn crossed a major boundary since its long 2.x line; its 3.x API is to be verified against its own docs.rs during implementation, per the build-from-official-sources rule; the same verification duty applies to swc's crate family, which versions aggressively.

| Crate | Version | Role |
| --- | --- | --- |
| petgraph | 0.8.3 | every in-memory graph; judgments as graph algorithms |
| pulldown-cmark | 0.13.4 | Markdown frontend: events with byte offsets |
| syn | 3.0.3 | Rust frontend: item census, doc-comment attributes |
| swc_ecma_parser | 45.0.0 | web frontend: TS/TSX ASTs, comments collected out of band |
| tree-sitter | 0.25 line | Kotlin frontend runtime |
| first-party Kotlin grammar | vendored in-repo | written from scratch against the official Kotlin grammar (`dec:linter:kotlin-tree-sitter`) |
| thiserror / anyhow | workspace-pinned | error discipline, per the repo's existing rules |

**Requirement (Determinism and order independence)** · `req:linter:determinism`

The linter's verdicts are independent of file traversal order, mirroring (`[LBL-metathm:labels:order-independence]`), and its output is byte-deterministic: diagnostics sort by path, then byte offset, then rule identifier. Two runs over one tree emit one output. This is what makes the linter's own generated registers comparable by exact bytes (`rule:linter:register-freshness`).

**Requirement (Failures are diagnostics)** · `req:linter:diagnostics-not-panics`

Malformed input never panics the linter. An unreadable file, an unpaired backtick, a defective foreign owner — each surfaces as a diagnostic scoped exactly as the calculus scopes it: the unpaired backtick fails its block while the rest of the file resolves (`[LBL-judg:labels:participation]`), and an unreadable tree is a reported traversal failure, never an empty carrier (`[LBL-cav:labels:coexistence]`). The same policy governs frontend error nodes: a parse error in any frontend is a hard, located diagnostic — never a silently skipped region — which is what makes grammar gaps in third-party parsers visible instead of dangerous (`rep:linter:kotlin-parser-study`). Exit code 0 means a clean corpus; nonzero means findings, machine-readably distinguished from crashes.

**Requirement (Timing)** · `req:linter:timing`

Every run reports wall time, per phase (pre-tokenize, harvest, resolve, judge, render). The first measured full-corpus run sets the budget, recorded beside the CI lane that invokes the linter; exceeding it thereafter is a finding.

## The pipeline · `sec:linter:pipeline`

**Model (Pipeline)** · `model:linter:pipeline`

```text
                 files on disk (carrier per adoption data)
                        │
              pre-tokenizer per language   ── comment extraction where the
                        │                     AST drops comments; token bans
      ┌─────────────┬───┴────────┬─────────────┐
   Markdown        Rust         web (TS/TSX)  Kotlin        [deferred: LaTeX]
 (pulldown-cmark)  (syn)        (swc)         (tree-sitter)
      │             │            │             │
      └──── logical regions + census ──────────┘
                        │
                  span scanner            ── tokenizes each region;
                        │                    emits occurrences + near-misses
              PASS 1 · harvest            ── all mints, all assets, all
                        │                    profiles: registries completed
              PASS 2 · resolve            ── citation edges into the graph
                        │
              judgments as queries        ── invariants run as petgraph
                        │                    algorithms and view traversals
        ┌───────────────┴───────────────┐
   diagnostics                  regenerated registers
 (deterministic order)        (exact byte compare vs committed)
```

**Definition (Logical region)** · `def:linter:logical-region`

The unit the span scanner receives. In Markdown, a region is one block-level element with its formatting structure resolved away — pulldown-cmark already strips list markers, quote markers, and continuation indentation, so a span running across wrapped lines arrives contiguous, exactly as (`[LBL-gram:labels:well-formed]`) demands. In code, a region is one comment with its leaders resolved. Delimiter pairing is settled per region before any span in it is parsed, and no span crosses a region boundary.

**Rule (Two passes, then judgments)** · `rule:linter:two-pass`

Execution is staged as (`[LBL-inv:labels:two-pass]`) prescribes: adoption data loads first; then every carrier source is harvested and every census computed, completing all registries; only then does resolution run, against completed registries; and only after resolution do the judgment queries run. No stage reads a later stage's output, which is what makes order independence (`req:linter:determinism`) a property of the design rather than a test target.

## The corpus graph · `sec:linter:graph`

**Model (The corpus graph)** · `model:linter:corpus-graph`

One `StableDiGraph<NodeW, EdgeW>` holds the entire analysis: owners, sources, regions, occurrences, labels, assets, and profiles are node weights of one enum, and containment, minting, citation, resolution, derivation, and ownership are edge weights of another. `StableDiGraph` rather than `DiGraph` because pass 2 adds edges (and diagnostics may mark nodes) after pass 1's indices have been handed out — index stability across mutation is the documented reason that type exists. Beside the graph live plain index maps — `HashMap<(OwnerIx, Label), NodeIndex>` for the minting registries — which are lookup tables, not graph structures, and thus outside the petgraph rule by its own terms.

**Table (Node and edge vocabulary)** · `tab:linter:node-edge-vocabulary`

| Weight | Variants (sketch) | Meaning |
| --- | --- | --- |
| NodeW | Owner, Source, Region, Mint, Citation, Label, Asset, Profile, Head | one entity of the calculus per node |
| EdgeW | Contains, Mints, Cites, ResolvesTo, Owns, Derives, ValidatesAs, Anchors | one judgment-relevant relation per edge |

**Table (Judgments as graph queries)** · `tab:linter:judgments-as-queries`

Every invariant of the disciplines becomes a query over the one graph — most are degree checks and filtered traversals; none needs machinery petgraph lacks.

| Invariant | Graph formulation |
| --- | --- |
| unique mint (`[LBL-inv:labels:unique-mint]`) | at most one incoming Mints edge per Label node per owner; a second reports both source locations |
| total resolution (`[LBL-inv:labels:total-resolution]`) | every Citation node has out-degree exactly one over ResolvesTo edges |
| warrant totality (`[LBL-inv:labels:warrant-totality]`) | every Mint node reaches exactly one warrant witness: its Owner's authorship or a Derives edge from an Asset |
| inventory discipline (`[LBL-inv:labels:inventory]`) | per Profile node: Derives edges form a bijection between census Assets and carried Labels |
| anchor harvest (`[LBL-inf:labels:anchor-harvest]`) | projection of Cites edges from a document's body Regions into a designated upstream owner, via an `EdgeFiltered` view |
| head validation (`[KND-judg:kinds:head-validation]`) | every Head node carries exactly one ValidatesAs edge into a catalogued pair |
| well-founded identity graphs (`[IDN-rule:identity:well-founded-graph]`) | `petgraph::algo::is_cyclic_directed` over the relevant subgraph, when identity checking lands |

**Remark (Views, not wrappers)** · `rem:linter:views-not-wrappers`

The temptation a first-class-graph rule must survive is the "convenience layer": a CorpusGraph struct with bespoke methods that slowly re-derives an API petgraph already documents. The design refuses it structurally. Where a judgment needs a restricted graph — body regions only, one owner only, one edge kind only — it constructs a `NodeFiltered` or `EdgeFiltered` view and hands that to a generic algorithm; where it needs a domain operation, it is a free function over `&StableDiGraph<NodeW, EdgeW>`. The graph stays petgraph's; the domain lives in the weights and the functions.

## Frontends · `sec:linter:frontends`

**Convention (Markdown frontend)** · `conv:linter:markdown-frontend`

pulldown-cmark is driven through `into_offset_iter`, so every event carries its byte range in the source. Fenced code blocks arrive as their own events and are marked nonparticipating wholesale. Inline code spans arrive as code events; whether a span is single- or double-backtick — participating versus displayed (`[LBL-judg:labels:participation]`) — is decided by reading the delimiter run length at the span's own offset, a bounded byte count at a known position. Headings are scanned for the trailing mint form; heading text before the separator is the environment head handed to kind validation, with presentation reduction — the modifier and device vocabulary of (`[KND-def:kinds:presentation-reduction]`) — applied to the tokenized head words, the modifier list being adoption data, not code. Unpaired delimiters fail their block and only their block (`req:linter:diagnostics-not-panics`).

**Convention (Rust frontend)** · `conv:linter:rust-frontend`

`syn::parse_file` yields the item tree that feeds both duties: the census — inventory profiles (`[LBL-sig:labels:profiles]`) read items and attributes to enumerate covered assets, a test profile recognizing test-attributed functions, a module profile recognizing `mod` items — and the scanned regions, which for Rust are exactly the documentation comments, surviving parsing as doc attributes with spans. Plain `//` comments are not scanned regions, because they are banned outright (`dec:linter:rust-comment-ban`). The name transformation and classification of each profile read the item's own identifier and attributes, never its file path, keeping the derivation exactly as location-free as (`[LBL-judg:labels:derivation]`) requires.

**Decision (Plain `//` comments are banned in Rust)** · `dec:linter:rust-comment-ban`

Ruled in review: Rust sources of this corpus carry documentation comments only; the plain line comment is a banned token, found by the pre-tokenizer (`dec:linter:pretokenizer`) and reported by the banned-token scan (`rule:linter:banned-tokens`). syn's view of the file is then complete for everything that is *allowed* to exist. One consequence is named rather than hidden: the existing Rust crates contain plain comments today, so adopting the ban implies a one-time migration sweep — a separate task; the linter only reports.

**Rule (Banned tokens)** · `rule:linter:banned-tokens`

The linter carries a banned-token subsystem: per language, the adoption data (`sig:linter:adoption-data`) lists token classes that must not occur in carrier sources, and every occurrence is a hard, located diagnostic. The first entry is Rust's plain `//` comment (`dec:linter:rust-comment-ban`). The subsystem is generic — future bans (a forbidden macro, a deprecated attribute, a disallowed import form) are new data rows, not new code — and its detection is the pre-tokenizer's (`dec:linter:pretokenizer`), never a pattern match (`dec:linter:no-regex`).

**Decision (A hand-written pre-tokenizer)** · `dec:linter:pretokenizer`

Ruled in review: where a frontend's AST drops what the linter must see — syn discarding plain comments being the first case — the mechanism is a hand-written pre-tokenizer, written properly for exactly these edge cases, and a second pass over the file is accepted as its cost. Per language it recognizes the lexical structure that determines what is and is not a comment or a banned token — string literals, raw and multi-dollar strings, character literals, nested block comments, escape sequences — and emits located comment regions and ban findings. It is a lexer with a small, testable contract, held to the same standard as any frontend: its edge cases are enumerated in its test corpus, and text it cannot classify is a hard diagnostic, not a guess. The pre-tokenizer also renders the regex exception unnecessary on the analysis path: the exception that survives review is the interchange crate's alone (`dec:linter:cddl-regexp-library`).

**Convention (Web frontend)** · `conv:linter:web-frontend`

Ruled in review: swc. Its ECMAScript parser is compiler-grade, native Rust, parses TypeScript and TSX, and — unlike syn — retains comments, collected out of band into a comments store keyed by byte position, which maps directly onto this design's region model (`def:linter:logical-region`): comments become scanned regions, the AST feeds the census profiles for the web package. The exact crate surface (parser plus the comments infrastructure) is verified against swc's own docs during implementation; swc's aggressive major-version cadence is noted in (`tab:linter:dependencies`). Sequencing: the web frontend is its own slice after Markdown and Rust.

**Report (Kotlin parser study)** · `rep:linter:kotlin-parser-study`

Recorded so the adopted frontend (`dec:linter:kotlin-tree-sitter`) stands on evidence rather than impressions. Findings as of 2026-08-20, the corpus at Kotlin 2.3.21:

*The field.* The living grammar is fwcd/tree-sitter-kotlin: grammar and scanner fixes merged through August 2026, an open PR for context parameters, and a cross-validation harness against JetBrains PSI test fixtures reporting 96 of 122 clean parses structurally matching the reference parser (78.7%), with 184 known-mismatching files tracked and categorized — including comment-tokenization edge cases. Its crates.io release lags two years behind git (0.3.8, 2024); the measurement below consumed it as a path dependency on the repo's own Rust binding, which builds cleanly. The alternatives orbit it: tree-sitter-kotlin-ng, despite the successor name and the official-looking tree-sitter-grammars home, is a fourteen-commit import stale since January 2025; tree-sitter-kotlin-sg is ast-grep's packaging fork of fwcd; arborium-kotlin bundles a grammar for syntax highlighting; and the tree-sitter organization's kotlin-tree-sitter repository, easily mistaken for a grammar, is the opposite artifact — Kotlin-language bindings that let Kotlin programs drive tree-sitter, of no use to a Rust linter parsing Kotlin. The only pure-Rust attempt, kotlin-parser, is an abandoned work-in-progress at 0.0.2. The one non-tree-sitter road is a JVM sidecar — JetBrains' Analysis API standalone mode, or the embedded-compiler PSI parse that ktlint and detekt use — which would read the corpus with the exact compiler version the app builds with, at the price of a JVM in the lint path and a second implementation language in the linter.

*Measurement on this corpus.* The fwcd grammar at HEAD, built as a Cargo path dependency and run over all 138 Kotlin files of the Android app (release build, in the claude-cogra toolbox): 8 files — 5.8% — produce 17 error nodes; 964 line comments and 441 block comments, all 441 of them KDoc, arrive as named tree nodes; the full parse takes under two seconds warm. Every one of the 8 failures reduces to a single grammar bug, confirmed by minimal repro: a function-type parameter with a lambda default followed by a trailing comma — `x: () -> Unit = {},` — which is the standard formatting of every Compose slot API, enforced by common Kotlin style tooling. The failure class is mainstream, not exotic.

**Decision (Kotlin frontend: tree-sitter, first-party grammar)** · `dec:linter:kotlin-tree-sitter`

Ruled in review: the deferral is removed, tree-sitter is adopted as the Kotlin frontend runtime, and the grammar is first-party — written from scratch against the official Kotlin grammar reference and language specification, vendored in this repository, building on no community grammar. The study (`rep:linter:kotlin-parser-study`) stands as the survey that motivated the ruling: the existing grammars fail on the corpus's most idiomatic pattern and carry years of accreted structure this project would otherwise inherit. A first-party grammar makes comment nodes, census-relevant declarations, and the corpus's actual syntax correct by construction, with the official specification as the build source. The grammar ships with its own test corpus, derived from the specification and from this repository's own files; its authoring-time toolchain (the tree-sitter CLI generating the parser from the grammar definition) is a development dependency only — the generated parser is vendored, so building the linter needs no grammar toolchain. Precondition before the frontend is wired: the grammar parses the full Android corpus to zero error nodes (`req:linter:diagnostics-not-panics`), measured the way the study measured. Error nodes remain hard diagnostics forever after: a future syntax gap surfaces loudly, never as a silently skipped region. The scope is named rather than hidden: Kotlin's lexical structure — string templates, multi-dollar interpolation, semicolon inference — demands an external scanner, which is where every community grammar concentrated its bugs; that scanner is where this grammar's test discipline concentrates too. Sequencing: the Kotlin slice follows the web slice.

## The interchange crate · `sec:linter:interchange`

**Decision (CBOR and CDDL are first-party)** · `dec:linter:interchange-first-party`

Ruled in review: the interchange conventions are a small, constrained domain, and the project implements them itself — one new library crate, built as a parallel task, serving every CBOR and CDDL use in the entire project. Its duties are the conventions' own: the deterministic data language — canonical encode and decode with membership exact, non-canonical bytes refused as no document at all (`[ICX-lang:interchange:data-language]`); the envelope and base theory (`[ICX-schema:interchange:global]`); the assignable fragment and its machine-checkable minor-inclusion regime (`[ICX-gram:interchange:assignable-fragment]`); and registry-driven acceptance with strict and tolerant verdicts (`[ICX-def:interchange:acceptance]`). The linter consumes this crate as a library once envelope validation enters scope; nothing of it is reimplemented linter-side. The crate's name is chosen when the parallel task starts.

**Decision (`.regexp` by a real regex library)** · `dec:linter:cddl-regexp-library`

Ruled in review: the CDDL `.regexp` control operator is real regex, and the interchange crate implements it with a popular, well-maintained library rather than a bespoke recognizer — the one signed exception to (`dec:linter:no-regex`), confined to that crate. One nuance is recorded for the implementer rather than discovered later: RFC 8610 defines `.regexp` against the XSD flavor of regular expressions, not PCRE and not any particular library's native dialect, so the chosen library's semantics are verified against the operator's definition for the patterns the corpus's schemas actually use — anchoring behavior being the classic divergence — and any deviation is recorded in the crate's docs, not silently absorbed.

## Adoption data · `sec:linter:adoption`

**Signature (Adoption data)** · `sig:linter:adoption-data`

The calculus is parametric in seven data (`[LBL-sec:labels:syntax]`), and the linter takes all of them — plus this corpus's own additions — as one checked-in configuration file, proposed as TOML beside the corpus root: the prefix Signature Σ; the owner partition Ω, written as explicit path-prefix rules — literal prefixes, no patterns, honoring (`dec:linter:no-regex`) even in configuration — under the convention of (`conv:linter:owner-partition`); the profile signature Π; the reserved kinds K; the designated typed-data classes; the citation-index designations; the scanned-region recognition per language; and the banned-token sets of (`rule:linter:banned-tokens`). Nothing about the corpus's shape is compiled into the binary: the linter is generic, the configuration is the corpus's adoption, and changing an adoption datum is a reviewed edit to a committed file.

**Convention (Owner partition, first convention)** · `conv:linter:owner-partition`

Ruled in review as the partition's starting shape: one owner per package — each Rust crate, the Android app, the web app — and one owner per major document: each of the four discipline documents and peers of that rank; working notes remain their own owner. The Layer 1 interface document stands outside the carrier as a vendored derived reference — its names are the L1 team's, frozen upstream — until the upstream repository is public and citable as an owner of its own. Refinement — whether Android modules split, how the docs trees group beneath major documents — happens in the adoption data this convention seeds, not here.

**Decision (Registry as data)** · `dec:linter:registry-as-data`

Ruled in review: the classification relation C of the kind registry is not hardcoded. The linter parses the registry document's own Convention tables — with its own Markdown frontend — to obtain the name-to-kind rows, exactly as the registry says an adopting corpus consumes it. One source of truth, no transcription drift, and the frontend gets exercised on the gnarliest real document in the corpus. The cost is a bootstrap dependency: the linter must parse that document before it can validate any head, so a defect there degrades kind validation corpus-wide — mitigated by the registry document itself being linted first, in the same run, by the label rules that need no kinds.

## Diagnostics and registers · `sec:linter:output`

**Rule (Register freshness)** · `rule:linter:register-freshness`

Every generated register the disciplines call for — citation indexes (`[LBL-inf:labels:anchor-harvest]`), the attestation register (`[KND-req:kinds:attestation-register]`), the headline counts (`[KND-tab:kinds:headline-counts]`) — is regenerated in memory on every run and compared against the committed bytes exactly. Inequality is a staleness diagnostic naming the file; the linter never writes the register itself in check mode, and a separate explicit mode regenerates in place. No digest mediates the comparison: this is the freshness sub-branch of (`[IDN-case:identity:artifact]`), where exact bytes decide and a persistent hash would fail the benefit criterion (`[IDN-crit:identity:benefit]`) — the affirmative no-digest outcome, recorded here as (`[IDN-req:identity:stop-record]`) asks.

## Crate layout · `sec:linter:layout`

**Decision (Home and layout)** · `dec:linter:crate-layout`

Ruled in review: the linter lives in this repository's workspace as **`crates/cogra-linter`** — one crate, with modules `pretokenize`, `frontend_md`, `frontend_rust`, `frontend_web`, `frontend_kotlin`, `scan`, `bans`, `graph`, `judge`, `render`, and a thin binary target. The module boundaries are drawn where a future crate split would fall, so extracting a core or a frontend later is mechanical; the disciplines are corpus-generic, and if the linter ever serves a second corpus, extraction to its own repository is routine. The interchange library (`dec:linter:interchange-first-party`) is its own sibling crate under `crates/` — it serves the whole project, not the linter. The linter touches no SQL and no store, so the repo's SQL-placement rule is untouched.

## Rejected Ansätze · `sec:linter:rejected`

**Ansatz (A wrapped graph)** · `ansatz:linter:wrapped-graph`

Wrap petgraph in a CorpusGraph type owning bespoke methods. Then every algorithm call unwraps, the wrapper accretes a shadow API that petgraph already documents and tests, and the first-class-dependency decision (`dec:linter:petgraph-first-class`) is honored in the Cargo.toml and violated in the code. Rejected.

**Ansatz (Regex scanning)** · `ansatz:linter:regex-scanning`

Scan raw file bytes for label-shaped patterns. Then participation is decided by guesswork — a pattern cannot see that its match sits inside a fenced block, a string literal, or a generated region — and the entire judgment structure of (`[LBL-judg:labels:participation]`) is re-derived, badly, inside a pattern dialect. The AST already knows. Rejected.

**Ansatz (Many small graphs)** · `ansatz:linter:many-small-graphs`

One graph per concern — a mint graph, a citation graph, a census graph. Then every judgment spanning concerns (warrant totality reaches owners, assets, and mints at once) joins across structures by hand, re-implementing exactly the traversals one typed graph gives for free, and the graphs drift apart under mutation. One graph, filtered views (`rem:linter:views-not-wrappers`). Rejected.

**Ansatz (Single-pass streaming)** · `ansatz:linter:single-pass`

Resolve citations while still harvesting, streaming file by file. Then forward references fail by accident of traversal order, violating (`[LBL-metathm:labels:order-independence]`), and determinism (`req:linter:determinism`) becomes a property to chase instead of a consequence of staging (`rule:linter:two-pass`). Rejected.

## Open questions · `sec:linter:questions`

**Open Question (LaTeX frontend)** · `open:linter:latex-frontend`

The corpus contains LaTeX sources whose `\label` and `\zcite` commands participate in the reference graph, so a LaTeX frontend is required eventually — deferred by ruling, and remaining so. When taken up, the same standards apply: a structure-aware tokenizer (TeX's category-code lexing for the macro family in scope, not a pattern match), regions and participation defined before scanning, and the frontend study written before the frontend.

## Implementation gate · `sec:linter:gate`

**Gate (Architecture review)** · `gate:linter:architecture-review`

Implementation is blocked until all of the following hold:

- the recorded decisions (`dec:linter:petgraph-first-class`), (`dec:linter:no-regex`), (`dec:linter:ast-frontends`), (`dec:linter:rust-comment-ban`), (`dec:linter:pretokenizer`), (`dec:linter:kotlin-tree-sitter`), (`dec:linter:interchange-first-party`), (`dec:linter:cddl-regexp-library`), (`dec:linter:crate-layout`) and the partition convention (`conv:linter:owner-partition`) are confirmed as stated or amended in this document;
- the registry-as-data proposal is accepted or replaced (`dec:linter:registry-as-data`);
- a first draft of the adoption data exists — Σ, Ω under (`conv:linter:owner-partition`), Π, K, scanned regions per language, banned-token sets (`sig:linter:adoption-data`);
- slice sequencing is confirmed: Markdown + Rust first, web (`conv:linter:web-frontend`) second, Kotlin third behind its zero-error precondition (`dec:linter:kotlin-tree-sitter`), LaTeX deferred (`open:linter:latex-frontend`), the interchange crate in parallel (`dec:linter:interchange-first-party`);
- the syn 3.x and swc API surfaces used by the frontends (`conv:linter:rust-frontend`), (`conv:linter:web-frontend`) are verified against their docs.rs before the first line depends on them;
- every citation in this document resolves — a check the finished linter will run on the document that specified it.
