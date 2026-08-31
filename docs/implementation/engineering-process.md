# The Standard Engineering Process · `spec:implementation:engineering-process`

Every substantial build in this repo — a new crate, a new
subsystem, a major feature — runs through six phases. Each phase
closes on an explicit artifact, reviewed by the human; the next
phase does not start until the previous one closes. Small
well-bounded changes (a bug fix, a doc tightening pass, a
one-file feature) do not carry this ceremony — the ordinary
commit + PR workflow covers them; what counts as "substantial"
is a judgment call made at task start and named in the task's
first artifact.

The process was established with the interchange crate
([crates/cogra-interchange/docs/concept.md](../../crates/cogra-interchange/docs/concept.md)),
deliberately run on a small, fully specified target first so the
process itself could be debugged before larger builds use it.
Lessons from each run feed back into this document.

## The phases

| Phase | Produces | Closed by |
|---|---|---|
| 1. Concept | `concept.md`: purpose, consumers, traced requirements, scope boundary, verification frame | review ruling |
| 2. Design candidate | `design.md`: public API surface, module map, error taxonomy, dependency justifications, sized test plan | review ruling |
| 3. Review | rulings recorded *into* the artifacts; open questions emptied | the human |
| 4. Implementation | the code, tests green, `make ci` green | the design's gate |
| 5. Audit | adversarial review + property/fuzz results; findings dispositioned | audit report |
| 6. Commissioning | first real consumer uses it; CI lane and time budget recorded | commissioning note |

## Phase rules

- **Concept.** States why the thing should exist, for whom, and
  what it must do. Every requirement traces to a source — a spec
  document, a ruling, a measured need; an untraceable requirement
  is a defect. The scope boundary (what it will *not* do) is as
  load-bearing as the requirements. Where the governing spec
  proves properties, the concept names them as future test
  obligations.
- **Design candidate.** The API surface is written before the
  code: types, function signatures, error taxonomy, module map.
  Every dependency is individually justified against the
  documented official way of doing it. The test plan is sized
  here — what gets unit tests, property tests, fuzzing, and what
  the budgets are. Ends with a gate: a checklist implementation
  must not start before.
- **Review.** The human rules on every open question. Rulings are
  recorded into the artifact as decisions — current state, not
  change history. A phase artifact with open questions cannot
  close its phase.
- **Implementation.** Follows the design; deviations from it are
  named at the moment they become necessary, never discovered in
  review. Tests are written alongside the code, never after.
  Commits are atomic; work is dispatched to workers per the
  session's dispatch policy, with the orchestrator auditing.
- **Audit.** A fresh adversarial pass over the finished work by
  someone (or some agent) who did not write it: correctness
  against the spec, the metatheorem-derived properties exercised,
  decoder/parser boundaries fuzzed where input crosses a trust
  boundary. Findings are dispositioned one by one — fixed, or
  recorded with a reason.
- **Commissioning.** The thing is used in anger by its first real
  consumer, its CI lane exists, and its runtime budget is
  measured and recorded (time discipline: every recurring action
  gets an expected duration and a tolerance). Only then is the
  build done.

## Where artifacts live

Phase artifacts live with the thing they describe: a crate's
`concept.md`, `design.md`, audit and commissioning notes go in
that crate's `docs/` folder, committed and PR'd like any other
docs. Working notes that produced them stay in the gitignored
working folders as usual.

## Lessons (fed back from each run)

From the `cogra-interchange` build — the process's first full run:

- **Read-back gating earns its round-trip.** A worker's first
  output restating the brief caught real misreads before they
  became mis-built work, more than once.
- **Every implementation lane runs in its own git worktree**, off
  current `origin/main`, with a per-lane `CARGO_TARGET_DIR`. Two
  lanes sharing one checkout collided once and cost a recovery —
  worktree isolation is non-negotiable, not a nicety.
- **Verify every Critical/Major finding by your own reproduction**
  before trusting a lane's report and before dispositioning it in
  an audit. The interchange audit's two stack-overflow findings
  and the parser DoS were each reproduced by the orchestrator.
- **The audit phase is where deferred hazards come due.** A
  design that writes "a candidate for the audit phase's
  attention" is scheduling a real finding — the interchange audit
  found two safe-API stack overflows exactly at such a note. Plan
  the phase; never skip it.
- **A worker that dies mid-run may still have written its
  deliverable.** Check the output file before assuming loss — the
  spec-conformance audit report was intact despite a missing
  completion signal.
- **Fuzz the trust boundaries.** cargo-fuzz (nightly) over the
  decoder and parser found the robustness holes that unit tests
  and properties did not; keep it a manual lane, out of `make ci`.
- Operational: `WebFetch` cannot reach deep sections of very
  large spec pages — `curl` the raw text and grep locally; and
  re-sync a PR body when its branch outgrows it.
