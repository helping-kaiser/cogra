# The Interchange Crate — Commissioning

_Phase 6 of the standard engineering process: commissioning. The point at which the crate is a workspace member other code may depend on, with its checks in the pipeline and its cost measured._

`cogra-interchange` closed its feature surface at slice 4 and its audit at phase 5. This note commissions it: it states what the crate is ready for, how it is checked, what it costs, and the two owner decisions that remain open against it.

## Readiness

The crate implements the interchange conventions end to end — the deterministic CBOR data language, the envelope, namespace labels, versions, the CDDL description language with the ruled evaluable operator subset, satisfaction, the registry, and acceptance. The audit confirmed the canonical core sound under 6-million-input decode fuzzing and exhaustive half-precision-float checking, and its correctness findings are fixed. It is ready to be depended upon by a first consumer — the corpus linter's envelope validation (`[ARCH-formul:linter:charter]`), or any backend crate carrying interchange documents — with two caveats a consumer should read: the memory-amplification disclosure (M3) and the parser DoS on hostile theory text (F1), both in [audit.md](audit.md).

No real consumer exists yet; the crate is commissioned as ready, not as consumed. When the linter's interchange slice opens, that consumption is the commissioning's confirmation, and any integration friction it surfaces returns here.

## Checks

The crate is a member of the workspace, so `make ci` — `cargo fmt`, `clippy -D warnings`, the test suite — covers it on every run with no separate configuration; its 668 tests run inside that lane. The one check outside `make ci` is fuzzing: `make fuzz-interchange` runs the three targets under a bounded time budget, and it is deliberately kept out of the PR gate because its runtime is open-ended and it requires a nightly toolchain plus cargo-fuzz. It is run at audit boundaries and before releases, not per PR.

## Budget

Measured 2026-08-21 in the `claude-cogra` toolbox (debug build): the full `cargo test -p cogra-interchange` suite runs in **~5 s warm** (~15 s cold, the difference being doc-test compilation), of which the property lane is under a second. This is the recurring-action budget for the crate's test lane; a regression beyond it — a property case-count raised without notice, a new expensive test — is a finding, not a cost to absorb. The fuzz lane's budget is its `-max_total_time` (60 s per target as run in the audit), set by the invoker.

## Open against the crate (owner decisions, non-blocking)

- **M3** — the ~48× memory amplification inherent to the no-nesting-bound policy: documented-as-is or capped, a change to (`dec:xchg:nesting-policy`).
- **F1** — the exponential-backtracking parser DoS: a reviewed refactor slice (lookahead instead of rewind-and-reparse).
- The **open-companion cut** change is implemented and awaiting the conventions owner's review of its wording.

## Process note

This crate was the engineering process's first full run — concept, design candidate, review, implementation across five slices, audit, commissioning. What it taught, fed back into [the process doc](../../../docs/implementation/engineering-process.md): read-back gating catches misreads before they become mis-built work; worker lanes editing one repo need isolated worktrees, not a shared checkout; a design's deferred hazards ("a candidate for the audit phase's attention") are exactly what the audit phase is for; and a fix wave verifies every finding by reproduction before trusting the report. The larger linter build runs the same process next.
