# Corpus Linter — Implementation Kickoff

Starting point for the linter build. A fresh session reads `CLAUDE.md`,
then this. It is a map and a plan, not a spec: the specs are the
documents it points to, all ratified. Written 2026-08-25, at the close
of the interchange-crate build that proved the process this one follows.

This is planning state, not a discipline artifact. Any label-shaped
reference here is written in ``double backticks``, which the label
calculus declares displayed and nonparticipating — so this document
mints and cites nothing, and stays outside the corpus's label graph
until it is retired.

## Mission

Build `crates/cogra-linter`: one Rust binary that walks the corpus —
Markdown prose and compiled-platform source — and mechanically discharges
the checkable obligations of the four discipline documents (the label
calculus, the kind registry, the identity adjudication procedure, and the
interchange conventions). It is a checker, not a fixer, in v1: it reports;
humans and later tooling repair.

## What is ratified (read in this order)

Everything the build needs is decided and committed. Read:

1. **`architecture.md`** — the ratified design. The three fixed
   decisions (petgraph first-class and unwrapped for every in-memory
   graph; tokenizing with no regex on the analysis path; AST frontends
   only), the pipeline, the single-`StableDiGraph` corpus-graph model
   with every discipline invariant restated as a graph query, the
   frontend conventions, and the review gate (discharged). Its only open
   question is the LaTeX frontend, deferred.
2. **The four disciplines** — `label-calculus.md` (v2, with
   ``inv:labels:generated-compliance``), `environment-kinds.md`,
   `identity-adjudication.md`, `interchange-conventions.md`. These are
   the normative specs; the linter's job is to enforce them. Each carries
   its own implementation/adoption gate — those gates are the linter's
   real acceptance criteria.
3. **`corpus-adoption.toml`** (repo root) + **`adoption-notes.md`** —
   the seven calculus parameters (Σ, Ω, Π, K, typed-data, citation
   indexes, scanned regions) plus carrier and banned tokens, all
   instantiated for this repo and ruled. Every value is a recorded
   decision; the notes carry the reasoning and the measurements.
4. **`docs/implementation/engineering-process.md`** — the six-phase
   process this build runs, with the interchange build's lessons folded
   in.

## What is decided

- **Crate**: `crates/cogra-linter`, one crate (modules pre-drawn where a
  later crate split would fall), home in this workspace.
- **Frontends**: pulldown-cmark (Markdown), syn 3.x (Rust; verify its API
  against docs.rs before depending on it), swc (web), a **first-party
  from-scratch tree-sitter grammar** for Kotlin (deferred behind a
  zero-error precondition on the Android corpus), LaTeX deferred.
- **No regex** on the analysis path, one exception only inside the
  interchange crate's `.regexp` seam — which is already built.
- **Banned tokens** via a hand-written pre-tokenizer; first entry is
  Rust's plain `//` comment.
- **Registry-as-data**: the kind registry's classification tables are
  parsed from `environment-kinds.md` itself, not hardcoded.
- **Owner partition**: one owner per package, one per major document;
  `layer1-interface.md` is vendored-excluded until the L1 repo is public.

## What is still open (carry into review, do not silently decide)

- **LaTeX frontend** — deferred; `\label`/`\zcite` participate but no
  frontend yet.
- The disciplines' own residual open items (e.g. the label calculus and
  kind registry each end in a gate whose clauses are the checklist).
- Anything the concept/design phase surfaces that the architecture left
  implicit — treat a gap as a question for the human, per the process.

## Build plan (slice sequencing, ratified)

Markdown + Rust first, then web, then Kotlin (behind its grammar
precondition), LaTeX deferred. The interchange crate is **done** — it is
available both as a dependency (envelope validation, a later slice) and as
the worked example of the process.

A sensible first decomposition, to be confirmed in the concept/design
phase:

1. **Adoption-data loader + corpus graph skeleton** — load the TOML,
   build the `StableDiGraph<NodeW, EdgeW>` and the index maps. Petgraph
   used directly, no wrapper (this is the decision most easily eroded —
   guard it).
2. **The span scanner** — the label grammar tokenizer (colon-joined
   triple, the three occurrence forms), near-miss warnings as scanner
   error positions.
3. **Markdown frontend** — pulldown-cmark offset iterator, regions,
   participation (fenced/double-backtick displayed), heading mints, kind
   validation via registry-as-data.
4. **Rust frontend** — syn item census (test + module profiles per the
   adoption data), doc-comment scanned regions, the pre-tokenizer for the
   `//` ban.
5. **The judgments** — unique mint, total resolution, warrant totality,
   inventory, head validation — each a petgraph query (see
   ``tab:linter:judgments-as-queries`` in the architecture).
6. **Register freshness + generated compliance** — exact byte compare;
   the calculus v2 generated-compliance rules.

The first honest milestone: **the linter lints its own four discipline
documents** — they practice the discipline they define, so they are the
truest acceptance test.

## How to run it (proven on the interchange build)

Follow the engineering process, and use the orchestration patterns that
worked:

- **Fable orchestrates, never works a lane.** Dispatch opus lanes for
  design-and-judgment work; each brief states model, reasoning depth, and
  a read-back requirement.
- **Every implementation lane runs in its own git worktree**, off current
  `origin/main`, with a per-lane `CARGO_TARGET_DIR=$HOME/targets/cogra-<lane>`
  in `claude-cogra`. Never point two lanes at one checkout — that
  collision happened once on the interchange build and cost a recovery;
  worktrees are non-negotiable.
- **Commit early and small on the lane branch; the orchestrator pushes
  after audit.** Verify every Critical/Major finding by your own
  reproduction before trusting a lane's report.
- **Toolchain**: host has no compilers. Everything runs
  `MSYS_NO_PATHCONV=1 wsl -d claude-cogra --cd '<path>' -- bash -lc '...'`.
  For a worktree, use host `git -C <path>` for git (WSL git cannot follow
  the worktree's Windows-path `.git` pointer) and cargo via wsl. gh runs
  in the toolbox: `wsl -d claude-cogra -- gh ...`.
- **The 5-minute heartbeat** watches lanes and merges; keep it armed while
  anything is in flight.
- **Ping the human** via ntfy (topic in memory `ping-jakob-ntfy`) when a
  ruling is needed or a milestone lands, not per PR.

## Lessons carried from the interchange build

- The design's deferred hazards ("a candidate for the audit phase") are
  exactly what the audit phase is for — the interchange audit found two
  real stack-overflow vulnerabilities exactly there. Plan the audit
  phase; do not skip it.
- A worker that dies mid-run may still have written its deliverable —
  check the output file before assuming loss (the interchange spec-audit
  report was intact despite a missing completion signal).
- Read-back gating catches misreads before they become mis-built work; it
  earned its round-trip more than once.
- `WebFetch` cannot reach deep sections of very large spec pages — `curl`
  the raw text and grep locally.
- When a lane branch outgrows its PR, re-sync the PR body; a stale body
  reads as a smaller change than it is.

## First steps for the fresh session

1. Session hygiene: pull `dev-state`, read `CLAUDE.md` and this file, skim
   the architecture and adoption data.
2. Write the linter's **concept** (phase 1) — purpose, consumers,
   requirements each traced to a discipline label, the verification frame
   (the disciplines' gates are the obligations; the four documents are the
   first corpus). Land it as `crates/cogra-linter/docs/concept.md`, review
   it with the human, then proceed to the design candidate.
3. Because the architecture already carries most design-level decisions,
   the concept can be lean and the design candidate can lean on
   `architecture.md` rather than re-deriving it — but the module map, the
   node/edge weight enums, and the first slice's public shape still want a
   design pass before code.
