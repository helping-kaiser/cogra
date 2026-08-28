# CLAUDE.md

This file is loaded into every Claude Code conversation on this
repo. **The rules below are operative, not background reading.**
Re-read this file at the start of every task.

**Audience split.** CLAUDE.md is AI-facing;
[CONTRIBUTING.md](CONTRIBUTING.md) is human-facing. Shared rules
(hard design rules, workflow basics) live in both; the mission
and core principles live in CONTRIBUTING.md; audience-specific
rules (session hygiene, the Commit + Push + PR cycle,
autonomous-decision guardrails) live in just one. Drift is
caught by author vigilance, not tooling.

---

## Critical reminders

If you only remember a handful of things from this file, remember
these — these are the rules most often violated:

1. **Never make design decisions autonomously.** Suggest options,
   explain trade-offs, let the human decide.
2. **Atomic commits.** One commit = one logical task. Never mix
   unrelated changes.
3. **Short commits, long PRs.** Commit body ≤ 2-3 lines. Full
   rationale goes in the PR description, never the commit body.
4. **Verify claims against the docs, not recall.** Open the
   relevant section before claiming how the system works — but
   don't re-read what's already in conversation context.
5. **Flag contradictions inline.** If a doc contradicts another or
   the user's framing, raise it in the same response. Don't paper
   over it.
6. **Fabric boundaries mean compaction, not endings.** When the
   task fabric ends — not mechanically at every PR — a superloop
   session prepares compaction and the human runs `/compact`;
   superloops run indefinitely. An ordinary one-task session
   suggests a fresh session instead. Externalized state is what
   makes either cheap.
7. **Never deviate silently.** If you have reason to break a rule
   here, name the rule and the reason — let the human accept or
   reject. The rule is not "never deviate," it's "never deviate
   silently." Silent deviations look identical to violations from
   the outside; announced ones can be evaluated.

---

## Architecture (one-screen reference)

The graph lives on PeerNetworks **Layer 1** — every binding fact
is an L1 record, and nothing CoGra stores is authoritative about
it. One store: **PostgreSQL**, partitioned by truth relationship —
the L1 record mirror (cached, rebuildable from the published
ordered sequence), overlay caches of published fold rules, and
authoritative L2 state (display content, identity association).
Money lives on the rails — L0 admission money and the **CGT
rail** (balances, transfers, payouts); the graph carries
pointers, never amounts. See
[docs/implementation/architecture.md](docs/implementation/architecture.md)
and, for the rail, [docs/implementation/ledger.md](docs/implementation/ledger.md).

The repo is a monorepo: `crates/` (Rust backend) + `android/`
(Kotlin + Jetpack Compose app —
[docs/implementation/android.md](docs/implementation/android.md))
+ `web/` (Next.js + TypeScript app —
[docs/implementation/web.md](docs/implementation/web.md))
+ `docs/`. This file holds the shared and backend rules;
`android/CLAUDE.md` and `web/CLAUDE.md` hold the
platform-specific ones. The frontend/backend contract is the
exported `schema.graphql` (checked in, CI-diffed; Apollo Kotlin
and GraphQL Code Generator both generate from it).

Crates:

| Crate | Role |
|---|---|
| `api` | Axum HTTP server, async-graphql schema; owns the L1 boundary trait, ingestion, and the bootstrap |
| `l1-standin` | the L1 stand-in behind the seam — formation, admission handshake, ordering, θ-ledger, epoch publication; replaced wholesale when the real Layer 1 ships |
| `postgres-store` | SQLx queries, migrations, the record mirror, display-content CRUD |
| `common` | Shared domain types, error types, the L1 seam data model (`common::l1`) |
| `ranker` | planned, not yet in `crates/` — pure feed-ranking math; one implementation for backend, miner container, and on-device (UniFFI) |

Docs are layered:

- **`docs/primitive/`** — what the graph IS and how it BEHAVES.
- **`docs/instances/`** — concrete applications of the primitive.
- **`docs/implementation/`** — system and code-level concerns.

See [docs/README.md](docs/README.md) for the full index.
Cross-cutting design questions live in
[docs/open-questions.md](docs/open-questions.md).

---

## Hard rules — design

### Never

- **Never introduce AI into ranking, recommendations, or
  economics.** No AI in any feed, named or default. The default
  feed and
  [ad-revenue distribution](docs/primitive/economics.md) are
  driven only by the graph and its weights; named opt-in feeds
  may consume declared L2 signals — always labeled, never
  presented as the neutral rank. AI as a frontend/UI helper is
  open — that boundary is intentionally permissive — but it must
  not touch the graph's signal or the economics computation.
- **Never delete graph structure.** Nodes, edges, and layer stacks
  are never removed. State transitions are always layered, never
  destructive. The only permitted "deletion" on the graph is
  redaction — payload removal per
  [docs/primitive/layers.md §5](docs/primitive/layers.md#5-deletion-policy). The
  same spirit applies to Postgres-side display content.
- **Never erase silently.** Any redaction — graph-side or
  Postgres-side — must leave a visible mark.
- **Never let inbound edges affect a user's feed.** Only
  viewer-rooted forward paths — walks starting from the viewing
  user's own outgoing edges — shape their feed.
- **Never break the uniform two-parameter grammar.** Every record
  carries the same two user parameters `(p_d, p_i)`; domain,
  mask, and tier are family-fixed by the census, never per-edge
  choices.
- **Never treat CoGra's stores as authoritative about the
  graph.** Every binding fact is an L1 record; the record mirror
  is a rebuildable cache — it may lag, it must never diverge.
  Money lives on the CGT rail — the graph carries relationships
  and pointers to it, never amounts
  ([docs/implementation/ledger.md](docs/implementation/ledger.md)).
- **Never make design decisions autonomously.** Always ask.
  Suggest options, explain trade-offs, but let the human decide.
  Design reasoning often exists that isn't visible in the code.
- **Never deviate silently.** If you have reason to break a rule
  in this file, name the rule and the reason — let the human
  accept or reject. Silent deviations look identical to violations
  from the outside; announced ones can be evaluated.
- **Never skip tests.** Linting, unit tests, and integration tests
  are created alongside the code, not after.

### Always

- **Explain why.** This is a learning project as much as a
  building project. Explain the reasoning behind choices, not just
  the implementation.
- **Fix what you find.** When a task surfaces an adjacent defect —
  a bug, a stale doc, a broken pattern — fix it in the same effort
  after notifying. Notifying is required; asking permission is not.
  Only genuine design decisions stop for the human.
- **Technical how-questions answer themselves.** "Never make
  design decisions autonomously" covers product and design
  choices. For purely technical questions — how a pattern is
  built, where code lives, which API shape — the documented
  industry standard *is* the decision: follow it and name the
  source. The human should almost never field a "how should this
  be done technically" question.
- **Move slowly and correctly.** Quality over speed. No
  rushing, no shortcuts.
- **Build from official sources.** Implement the way the
  language, framework, or tool officially documents it — verify
  against the current official docs before building, not by
  recall or improvisation. When the official sources don't cover
  a problem, research it properly before settling on an approach.
  If a prior decision or request would have us do something other
  than the documented, idiomatic way, name it and get agreement —
  don't silently ship the non-standard thing.
- **Document decisions in the repo.** Any rule, principle, or
  agreement reached during discussion belongs in this file,
  [CONTRIBUTING.md](CONTRIBUTING.md), or a design doc — not in
  private notes, assistant memory, or anyone's head.

---

## Hard rules — workflow

### Branches

`user/type/topic`. Examples: `jakob/primitive/network-node`,
`jakob/docs/extract-graph-schema`. Common types: `primitive`,
`instances`, `implementation`, `docs`, `cleanup`, `process`. Use
a sensible new type segment when none of the existing ones fits.

### Commits

**Atomic** — one commit = one logical task; never mix unrelated
changes. **Short** — subject + at most 2-3 body lines, imperative
mood, describe the *why* not just the *what*. Section-by-section
change lists, option comparisons, and full design rationale
belong in the PR description, not the commit body.

### PR body scaffold

- `## Summary` — 1-3 sentences.
- `## Reasoning` — the *why* behind major decisions.
  **2-4 sentences per point.** Tradeoffs and what was rejected,
  not a re-derivation of the doc.
- `## Commits` — compact list, one line per commit.
- `## Scope discipline` (optional) — only when there's a real
  scope question to flag.

No test-plan checklist. No filler subsections. No per-commit prose
that duplicates the commit body.

### Commit + Push + PR

When writing is done and no questions remain open in the
conversation — every unresolved item either decided or parked in
[docs/open-questions.md](docs/open-questions.md) — run the full
**commit + push + PR cycle in one motion, uninterrupted**. Don't
ask "want me to commit?", "should I push?", or propose a draft
commit message and wait for sign-off. The file edits were
reviewed one-by-one as they were proposed; that is the only
sign-off the workflow needs.

Task-completion framing — "resolve", "ship", "finalize", "let's
do X then resolve", or any phrasing that says the writing phase
is over — authorizes the whole cycle, commit step included. The
only legitimate stop is a genuine surprise in the diff (sensitive
files, an accidental edit), not a routine re-confirmation.

Stop and ask only **before** writing — to align on approach, pick
between options, or surface contradictions. Once the writing is
done, the workflow runs straight through to the PR.

### Hand test and session hand-off

The final hand test of an Android or web change — on the physical
device, by hand — belongs to the human, not Claude. Claude still
verifies its own work along the way, but only through means that
need no human involvement: unit/UI tests, CI, and emulator or
adb-driven checks. Then it hands off: every session that changed
`android/` or `web/` ends by deploying the newest build to the
human's phone (Android: install the debug build; web: make the
dev build reachable from the phone's browser) and writing short
hand-test notes — what's new, and how to test it, step by step.

---

## Hard rules — research and session hygiene

### Verify claims against the docs, not recall

The docs are the source of truth and grow long; recall is worse
than the file. Before making a claim about how the system works,
open the relevant section. The exception is files already in
conversation context — if a doc is loaded and hasn't been
edited, don't re-read it. Open what you need, skip what you
have. When making math-shaped claims (about ranking, weights,
dimensions), trace them back to the math in the docs — if you
can't, the claim is suspect.

### Flag contradictions inline

If a doc contradicts another, conflicts with the user's framing,
or seems out of place — flag it in the same response. Don't paper
over it; don't file it as a separate later task.

### Use a subagent for broad investigation

For investigations spanning more than a few files, spawn a
subagent. It does the heavy reading inside its own context,
returns a summary, and keeps the main thread lean — the cheapest
way to investigate without bloating the session.

### Fabric boundaries: superloops compact, one-task sessions end

A **task fabric** ends when the threads in flight stop feeding
each other — not mechanically at every PR merge. A day where
environment work, a live demo, and the bug reports it produced
genuinely interleave is one fabric: cutting it per-PR re-derives
the shared context every hour for nothing.

What happens at the boundary depends on the session kind. A
**superloop session is meant to run indefinitely** — it is never
ended deliberately, only lost to genuine breakage. At each fabric
boundary it prepares compaction (externalize everything, refresh
the post-compaction anchor) and the human runs `/compact`; the
same session then continues into the next fabric, lean again. An
**ordinary one-task session** instead suggests a fresh session
before the next task: long sessions accumulate context that
doesn't help (redundant doc re-reads, resolved discussions, stale
hypotheses), and fresh sessions reload this file and start lean.

What makes both cheap is externalization, and that duty is the
rule's real content: every decision, ruling, and piece of working
state lands in a durable artifact (docs, open-questions, the
backlog, PR bodies, tmp_dev notes) **as it happens**, never only
in conversation. That duty is also what makes routine compaction
safe — a compacted session cannot audit what its own summary
dropped, so never rely on the summary to carry state a file
should hold.

### One Edit per response during active design iteration

When the user is reviewing design choices in real time and each
Edit carries content they may push back on, send **one Edit per
response and wait**. A rejection of the first Edit doesn't stop
later Edits in the same response from applying, and the user
can't course-correct a fan-out mid-flight. Once a decision is
settled and you're mechanically applying it across N files,
parallel batches are fine again — the distinction is iteration
vs. application.

### Discussion gates writing

While a design discussion has any open thread, don't edit files —
not even for sub-points that seem settled. An open thread can
invalidate the "settled" part, and a fan-out of edits can't be
course-corrected mid-flight. Writing resumes only when the human
explicitly closes the discussion.

- **Deliver design briefs as plain text.** When asked for
  background + options + a recommendation, write the complete
  brief as a normal message — background, all options, founded
  recommendation, then the questions in prose — and end the
  turn. No question dialogs on top: they interrupt reading and
  force nuanced answers into preset choices.
- **Answer questions before acting.** A rejection that contains a
  question ("why X?") is a request to stop and explain, not a
  speed bump. Reply with the explanation only and end the turn;
  retry the edit only after an explicit green-light. Re-attempting
  the action alongside the answer reads as steamrolling, even when
  the answer is correct.

### Working artifacts go to `tmp_research_files/` or `tmp_dev/`

Two gitignored folders at the repo root hold working notes — never
committed; the repo holds decisions and docs, not the notes that
produced them. The split is by artifact kind:
`tmp_research_files/` holds research on documentation and design
decisions (best-practices reviews, PR-prompt files);
`tmp_dev/` holds dev audits and dev working state (code audits,
hand-test notes, dev-account state). Use a dated subfolder (e.g.
`tmp_research_files/2026-06-19-best-practices-audit/`). For an
audit, write a README (overview + decisions table grounded in
official sources) plus one self-contained `pr-*.md` prompt per
bundled change. `tmp_research_files/README.md` indexes the
decision records worth keeping.

### Refer to "the L1 team", never a name

External Layer-1 collaborators appear as "the L1 team" or "the L1
author" in docs, commits, and PRs — never a personal name.

### Tightening passes: write current state, not change history

When fixing wrong, stale, or imprecise text in a docs pass:

- **Prefer deletion to rewriting.** If a sentence's only job was
  a comparison or restatement that turns out to be wrong, delete
  it. Don't replace a wrong sentence with a longer correct one
  whose only purpose is to explain the cut.
- **Never leave markers of what was removed.** No "previously X,
  now Y", no "the rule used to be Z", no "no longer stored" — the
  doc describes the current state; the change history lives in
  git.
- **Overly verbose is bad.** A reader wants the current rule in
  the fewest words that carry it. Trim, don't pad.
- **Decisions are facts, not recommendations.** Once a design
  decision is settled, write it as the decision —
  "the pattern: X", "every Proposal carries Z" — not
  "recommended pattern: X" or "applications can opt into Y".
  Softening framing contradicts the agreement and reads as a
  half-decision.

---

## Development commands

```bash
make run    # first-time: init + start DBs + migrate + start API
make dev    # returning: start DBs + migrate + start API
make api    # just the API (if DBs already running)
make ci     # lint + sqlx check + test + docs link check (run before pushing)
```

Full make-target list, env vars, and other dev guidance:
[docs/implementation/development.md](docs/implementation/development.md).

### Follow Rust's official guidance

The backend is built the way Rust officially documents, not by
improvisation. The canonical sources for idiom: the
[Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
for API design (naming, trait impls, error types, ergonomics),
[The Book](https://doc.rust-lang.org/book/) and the
[Reference](https://doc.rust-lang.org/reference/) for language
semantics, and the [`std` docs](https://doc.rust-lang.org/std/).
For a dependency, its own [docs.rs](https://docs.rs) page is the
source of truth — async-graphql, axum, sqlx, and tokio each
document the intended pattern; follow it rather than inferring one
from a stray example. `clippy` encodes much of this guidance: a
lint is a documented opinion, so fix the code rather than `allow`
it without a named reason.

### Code style

- `cargo fmt` enforced.
- `clippy -D warnings` enforced.
- No `unwrap()` in library code — use `thiserror` / `anyhow`.
- SQL only in `postgres-store` — except `l1-standin`, which owns its
  own `l1_*` tables (it plays the substrate, not CoGra's store; the
  whole set is dropped at the swap).
- No comments on obvious code. Comments explain *why*, not *what*.
