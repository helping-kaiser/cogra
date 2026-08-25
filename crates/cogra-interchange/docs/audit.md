# The Interchange Crate — Audit

_Phase 5 of the standard engineering process: the audit. Three adversarial review lanes over the merged crate, each a fresh reader, plus orchestrator reproduction of every Critical and Major._

The crate closed its feature surface at slice 4. Three independent lanes then audited it — L1 spec conformance against RFC 8949, RFC 8610, and the interchange conventions; L2 hostile input and API misuse; L3 design fidelity, doc truthfulness, and code quality — none of them the author of the code they read. Every Critical and Major below was reproduced by the orchestrator before it was recorded; the reproductions live in the working notes (`tmp_dev/2026-08-21-interchange-audit/`).

## What held

The audit's strongest result is a negative one, and it is where a canonical encoder most needs to be sound. The **canonical CBOR core is correct under hard testing**: a 6-million-input decode fuzz accepted zero non-canonical byte sequences; float shortest-form was checked **exhaustively over all 65 536 half-precision patterns** and over 8 million random doubles with zero round-trip drift and correct NaN canonicalization; every crafted non-canonical vector was refused. Map-key ordering, the §3.8 control operators other than the one bug below, the full Appendix B CDDL grammar, fragment membership, minor inclusion, and acceptance sentence-by-sentence all held. The **label-integrity check on the crate's own documents is clean** — 76 design mints and 16 concept mints, no duplicates, every same-owner citation resolving — an independent confirmation that the labeling discipline the linter will one day enforce already holds here. All ten metatheorem property tests are non-vacuous. The `.regexp` operation budget works through the real `accept()` path: the 761-second pathological pattern is refused in milliseconds and cannot hang a consumer.

## Findings

Severity: **Critical** = a wrong result or a crash reachable from safe public API on untrusted input; **Major** = a conformance gap or a robustness hole in a corner; **Minor** = imprecision, a weaker-than-claimed test, or a stale comment.

### Critical

- **C1 — Recursive `Value` derives overflow the stack on hostile input.** `Value`'s derived `Clone`, `PartialEq`, and `Hash` recurse to nesting depth; only `Drop` and `Ord` were made iterative. A ~20 KB byte string of nested single-element arrays decodes fine (the decoder is iterative) and then aborts the process when cloned, hashed, or compared — and `Document::from_canonical_bytes` clones content internally, so the crash is reachable from one safe public call on untrusted bytes. Reproduced: SIGABRT at depth 20 000. (L2 #1, orchestrator-verified.)
- **C2 — The evaluator and `Document::to_value` recurse over value depth.** The same root cause on a second path: `accept()`/`satisfies*()` walk a deep document recursively. Resolved by the same iterative treatment as C1, extended to the evaluator's own walk. (L2 #2.)

### Major

- **M1 — `uint .size N` rejects every unsigned integer for N ≥ 9.** `cddl/control.rs` caps its probe at `MAX_UINT_SIZE = 8`, so a theory writing `uint .size 9` (or larger) refuses all uints, though RFC 8610 §3.8.1 defines `uint .size N ≡ 0…256**N` — every uint conforms. Under-acceptance of conforming documents; never a false accept, never wrong bytes, which is why it is Major and not Critical. The `MAX_UINT_SIZE` "vacuous" docstring is the mistaken reasoning. (L1 M1, orchestrator-verified.)
- **M2 — The CDDL recursive-descent parser has no depth guard.** Deeply-nested bracket/paren theory text overflows the stack in `Theory::parse`. Reachable via the public parse entry on untrusted theory text. Reproduced: SIGABRT at parenthesis depth 100 000. (L2, orchestrator-verified.)
- **M3 — Memory amplification under the no-nesting-bound policy.** An *n*-byte input forces ~48 *n* bytes of decoder state, linear and uncapped — a design consequence of `dec:xchg:nesting-policy`'s deliberate choice of no bound, quantified here at ~48× (the design estimated ~100×, same order). Not a crash; a resource-use fact a consumer of untrusted bytes must know. (L2.)
- **M4 — Post-budget public surface is unreconciled in the design.** The op-budget feature added `RegexpError::BudgetExhausted`, `MismatchKind`, and `Mismatch::kind()` to the public API; the design's error-taxonomy sketch still shows the old arms, and the `Restrained` enum with the `Provision`/`ImplicitReach` accessors is public but undocumented in the design. The design preamble promises it fixes "the complete public API surface," so these are genuine unrecorded deviations. (L3 M1–M3.)

### Minor

- **m1 — Stale test doc comments actively mislead.** `regexp.rs::xsd_whole_string_matching` and `cddl/mod.rs::the_two_label_recognizers_agree` claim in prose to be ignored placeholders the engine "answers wrongly"; both run and pass against the anchored fork (0 ignored suite-wide). Several `.regexp` module comments still describe the pre-fork unanchored behavior. (L1, L3 C1–C2 — Critical as *doc lies* in L3's rubric, Minor in impact: the code is correct, only the prose is false.)
- **m2 — The float property asserts idempotence, not minimality.** `from_f64(x).to_f64() == x` is a weaker obligation than "the stored form is the shortest"; the exhaustive binary16 vector test covers minimality, but the property is a shadow of its metatheorem.
- **m3 — `REFERENCE_DEPTH`/`PATTERN_DEPTH` = 16 can silently under-match** deeply-aliased bounds in restraint analysis and pattern resolution — a cap that fails toward refusal, not toward a wrong accept.
- **m4 — `Registry::stamp` clones content once per binary-search probe**, and the arbitrary-bytes proptest is thin. Both accepted-cost or test-depth notes, not defects.

## Triage

Fixes the orchestrator lands without a ruling, all design-consistent:

- **C1 + C2** — make `Clone`, `PartialEq`, and `Hash` iterative, and the evaluator/`to_value` walks iterative or depth-guarded. This *completes* the pattern `impl:xchg:iterative-teardown` established for `Drop`/`Ord` and which the design already named as a candidate for this phase; it does **not** touch the ratified no-bound nesting policy. Fuzzing follows the fix.
- **M1** — remove the `MAX_UINT_SIZE = 8` cap; probe the full uint range per §3.8.1.
- **M2** — a generous documented recursion-depth bound in the parser, returning a located `TheoryError`; standard hand-written-parser practice, distinct from data-language membership.
- **M4, m1, m2** — reconcile the design's API sketches to the shipped surface, sweep the stale comments, strengthen the float property to minimality.

Ruled already and landing in the same wave: the **open-companion cut** (`[ICX-def:interchange:open-companion]` gains a cut on the enumerated keys, per the conventions owner's decision).

Deferred to the audit's own tooling: the three **fuzz targets** (`decode_canonical`, `cddl_parse`, `accept_document`) and a `make fuzz-interchange` lane, run after C1/C2/M2 so the fuzzer explores past the known overflow.

Wants the conventions/design owner's ruling (non-blocking; not fixed here):

- **M3** — the memory-amplification factor is inherent to the no-bound policy. Accepting it (documented) or introducing a size/depth cap is a change to `dec:xchg:nesting-policy`, the owner's to make. The orchestrator's C1/C2 fix removes the *crash* without capping *depth*, so M3 stands as a resource-use disclosure either way.

## Disposition (close-out)

Landed and verified 2026-08-21:

- **C1, C2, M1, M2 — fixed.** `Value`'s `Clone`/`PartialEq`/`Hash` are iterative (the overflow is gone — a 20 000-deep hostile value clones, hashes, and compares, re-confirmed by reproduction); the evaluator and CDDL parser carry explicit depth bounds returning a verdict or a located error; `uint .size N ≥ 9` admits every uint. The nesting policy is untouched — the walks are iterative, no cap on data depth.
- **m1, m2, M4 — fixed** in the companion-cut change, held for the conventions owner's review: stale comments corrected, the float property strengthened to minimality, the design API sketches reconciled to the shipped surface.
- **Open-companion cut — implemented**, held for the owner's review of the conventions wording.

Fuzzing (the audit's own tooling, run past the fixed overflow): `decode_canonical` clean over 218 737 runs, `accept_document` clean over 269 047 runs — zero crash artifacts on the two targets where a crash would be a finding. `cddl_parse` timed out exactly on the parser DoS below, as expected; no other timeout or crash.

**New finding — F1 (Major, DoS): exponential-time backtracking in the CDDL parser.** The member key-vs-value double-parse (rewind-and-reparse) is 2^depth on nested arrays, maps, and inline groups: measured 1.8 s at nesting depth 20, a timeout past ~26, a hang at ~40. Reachable from `Theory::parse` on hostile theory text — which is *acquired* (a reader's deliberate choice), not arbitrary untrusted input, so the exposure is narrower than the decoder's, hence Major not Critical. The depth guard (128) does not help; the blowup is below it. **Fixed** (ruled and landed 2026-08-21): the parser now parses each member's leading `type1` once and decides key-versus-value by a single token of lookahead (`memberkey` deleted; `ty_from_first` resumes the value's `/`-choices from the already-parsed type), so no span is ever reparsed. Behavior is unchanged — the print∘parse fixed-point tests confirm the syntax tree is identical — and the exponential is gone: arrays, maps, and inline groups at nesting depth 30 and 40 parse in microseconds (was ~1 hour at depth 30), reproduced by the orchestrator against the fixed crate. One adjacent reparse survives in `grpent_body` (the inline-group fallback), but with `member` now failing fast it is not exponential in practice (depth-40 groups: ~100 µs); recorded as an observation, not a live finding.

Wants the owner's ruling (non-blocking): **M3** — the ~48× memory amplification, **documented as an accepted bound** in the design and the decoder rustdoc per the owner's ruling; a cap remains available if a deployment needs one. Remaining open: **m3** (Minor) — rule-reference following stops at depth 16, so a bound reached through 17+ single-alias hops silently under-matches; it fails toward refusal, not toward a wrong accept, and awaits either a raised limit or a documented conformance-trade note.

## Gate

The audit is closed: every Critical and Major is fixed or recorded as an owner decision, the fuzz lane ran clean past the fixed overflow on its two crash-relevant targets, and each finding's disposition is named above. Commissioning — [commissioning.md](commissioning.md) — follows.
