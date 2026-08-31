---
name: implement-feature
description: >
  Doc-grounded implementation procedure for CoGra coding tasks on
  any platform — Rust backend, Android app, or web app. Use for
  every task that implements or changes product behavior:
  implement a feature, build a screen, add an API, wire a flow.
  Extracts a cited spec from the docs before coding, turns doc
  gaps into explicit decisions, verifies idiom against official
  sources, and ships with tests, the contract step, and CI.
argument-hint: "[feature or task]"
---

# Implement a feature, grounded in the docs · `guide:skills:implement-feature`

This skill is a procedure, not a rulebook. The rules it applies
live in the root [CLAUDE.md](../../../CLAUDE.md) and the platform
files ([android/CLAUDE.md](../../../android/CLAUDE.md),
[web/CLAUDE.md](../../../web/CLAUDE.md)) — this file fixes the
order they run in and adds nothing they don't say. If this file
ever disagrees with CLAUDE.md, CLAUDE.md wins; flag the
disagreement.

The task: $ARGUMENTS

**Quality bar.** Getting it right beats getting there fast. No
hacks: no placeholder TODOs, no commented-out code, no suppressed
lints without a named reason, no "works for now" shortcuts left
for later. If the clean way is unclear, that is a phase-3 gap,
not a license to improvise.

## 1. Scope and ground

Name the platforms the task touches (backend / Android / web).
Re-read the root CLAUDE.md and each touched platform's CLAUDE.md.
Then find every doc section that specifies the feature — start
from [docs/README.md](../../../docs/README.md) and work primitive
→ instances → implementation, plus the roadmap slice it belongs
to. For reading that spans more than a few files, use a subagent
and keep the summary.

## 2. Extract the spec

Before writing any code, write the spec: a numbered list of every
claim the implementation depends on, each with its citation
(file + section). Math-shaped claims — ranking, weights,
parameters — must trace to the actual math in the docs. A claim
that cannot be cited is not part of the spec; it is a gap.

## 3. Turn gaps into decisions

Anything the docs miss, contradict each other on, or get wrong
becomes an explicit decision item: options, trade-offs, and a
recommendation — the human decides. Never guess, never silently
work around a doc defect. Every decision made here is written
back into the docs (or parked in
[docs/open-questions.md](../../../docs/open-questions.md)) and
rides the same PR as the code, so the docs stay authoritative for
the next task.

## 4. Brief, then green light

Present the spec, the gap decisions, and a short implementation
plan — files and modules touched, tests to write, whether the
GraphQL contract changes — as one plain-text brief, and end the
turn. Code is written only after an explicit go. (Root CLAUDE.md:
discussion gates writing; design briefs are plain text.)

## 5. Build

- Tests land with the code, never after — every branch, not just
  the happy path.
- Verify idiom at write time, not from recall: the platform files
  name the official sources (root CLAUDE.md for Rust and its
  crates, android/CLAUDE.md for Compose/Material 3,
  web/CLAUDE.md + web/AGENTS.md for Next.js). Any API you are not
  certain of, open its docs before using it.
- If the API surface changes, run the contract step: `make
  schema` to re-export `schema.graphql`, then regenerate and fix
  every affected client (Apollo Kotlin via the Android build,
  `npm run codegen` for web) in the same change.
- Accessibility is part of the change, not a follow-up — per the
  platform docs
  ([android](../../../docs/implementation/android.md#accessibility),
  [web](../../../docs/implementation/web.md#accessibility)).

## 6. Verify

Run the checks for every touched platform: `make ci`,
`make android-ci`, `make web-ci`. For a user-visible change, also
run the thing — emulator or dev server — and confirm the actual
behavior, not just green tests. Report results faithfully:
failures with their output, skipped steps by name.

## 7. Ship

Run the commit + push + PR cycle per root CLAUDE.md — atomic
commits, short bodies, rationale in the PR description. The doc
edits from phase 3 ride the same PR as the code they unblocked.

## Definition of done

- Every spec claim implemented and citable; none silently
  dropped.
- No undecided gaps; every decision recorded in the docs.
- Tests cover every branch of the new code; lints clean.
- Accessibility landed with the UI, where there is UI.
- Platform checks green locally; user-visible changes verified
  by running them.
- No hacks — nothing you would not want to explain in review.
