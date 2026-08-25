# The Corpus Linter — Commissioning

_Phase 6 of the standard engineering process: commissioning. The corpus-wide check runs in continuous integration, its runtime budget is measured and recorded beside the lane that invokes it, and the six-phase build closes._

The concept named four consumers and put continuous integration second among them: the thing that runs the corpus-wide check as the calculus's gate requires, fails the build on findings, and tells findings from crashes by exit code (`sig:lint:consumers`). This note commissions that consumer. Unlike the sibling crate, which was commissioned as ready rather than as consumed, the linter arrives with its consumer built in the same phase — a checker whose only job is to be run has no readiness distinct from being run.

The document practices the labeling discipline: the label at each heading or environment head is that environment's mint; a parenthesized label in running text is a same-owner citation; material in fenced blocks and double-backtick spans is displayed without participating. The document title mints nothing. Every label minted here has area `lint`, and this file belongs to `pkg.cogra-linter`. Imported citations use the prefixes registered in ``corpus-adoption.toml``: `LBL` for the label calculus and `ARCH` for the linter architecture.

## The first consumer · `sec:lint:commissioning-consumer`

The pipeline gains one job, `Corpus lint`, which builds the binary and runs `cogra-lint check` over the repository, then runs the crate's own suite. Exit 0 is a clean corpus, 1 is findings on the failing set, 2 is the linter itself failing; the lane reds on either nonzero code, and the code says which happened, which is the distinction the concept asked a CI consumer to be able to make (`sig:lint:error-taxonomy`). The failing set is the two documentation trees written under the discipline and the advisory remainder is reported without failing the lane, so the gate that arrives is the scoped one the concept ruled rather than a red one (`dec:lint:enforcement-partition`), (`rep:lint:first-corpus`).

`make lint-corpus` is the same check as a pre-push gate, and `make ci` gains it, because that target exists to mirror the pipeline. It costs 5.1 s.

**Decision (The lane is ungated)** · `dec:lint:ci-lane-ungated`

Every other Rust job in the pipeline is gated on a paths filter that subtracts documentation and markdown. This one is gated on nothing, and the reason is the carrier: the linter's corpus is the whole repository minus the exclusions the adoption data lists, so any committed file can change the verdict. A path filter that admitted everything would be gating in name only, and one that admitted less would be wrong. The lane needs no database and finishes in seconds, which is what makes always the cheap answer as well as the correct one — the ungated lane is cheaper than the gate that would decide whether to run it.

## What the docs gate could not see · `sec:lint:commissioning-docs-gap`

Commissioning found a real defect in the pipeline rather than inheriting a sound one, and it is recorded here because the incident is the argument for the lane's shape.

**Observation (The suite reads the corpus, and the gate hid it)** · `obs:lint:corpus-reading-suites`

The Rust gate subtracts `docs/` and all markdown, so a documentation-only pull request skips the test job entirely. But the crate's tests are not fixture-bound: four of its binaries — `corpus_acceptance`, `migrations`, `registers`, `registry_as_data` — read the real tree, and three of them run their own full check over it. A documentation-only change can therefore break the suite while the pipeline that would have caught it never runs. It did: a documentation-only pull request landed a red main, which is what sent this phase looking.

The blind spot is not hypothetical for the work still queued, and that is the sharper point. The acceptance suite asserts that findings under `docs/` are non-empty and that at least one is an error, and it bounds the unresolved-citation count from below (`rep:lint:first-corpus`). The migrations the concept queued are exactly the documentation-only commits that move those numbers, so the corpus's own planned work is the traffic most likely to trip a gate that does not run on it.

The narrow fix — widening the Rust gate to admit the two documentation trees — was in place and closed only half of it, covering the trees the tests pin while leaving `docs/` and the rest of the corpus outside. Widening it the rest of the way would drag the full test job onto every documentation change: a Postgres service, an `sqlx-cli` install, and the whole workspace's tests, minutes of runner time to reach a suite that runs in seconds without a database. So the ungated corpus lane carries the suite instead, and covers every document rather than two trees. The narrow filter is removed as subsumed, which is sound only because no crate outside the linter reads those trees — the other references to them are prose in comments, and the two workspace artifacts that are read by tests, the exported schema and the client vectors, are not markdown and trip the Rust gate already.

## What it costs · `sec:lint:commissioning-budgets`

The budgets and their tolerances are the design's to hold (`tab:lint:budgets`); what follows is the evidence they were set from — what was run, where, and what it produced. Measured 2026-08-25 in the `claude-cogra` toolbox, worktree on `/mnt/c`, debug build, warm, over the 891-source carrier with this note in the tree. Each figure is the range over repeated runs rather than a best case, because a budget set from one quiet run is a budget that fails on a busy one.

| Measurement | Command | Result |
| --- | --- | --- |
| full-corpus check | `cogra-lint check` | 4.55–4.73 s · walk 4.52–4.71 s · analysis 25–26 ms |
| the crate's suite | `cargo test -p cogra-linter` | 19.9–22.6 s |
| the four corpus-reading binaries | `cargo test -p cogra-linter --test corpus_acceptance --test migrations --test registers --test registry_as_data` | 17.4–17.9 s |
| the property lane | `cargo test -p cogra-linter --test graph --test label_order --test metatheorems --test pretokenizer` | 0.85–0.88 s |
| the addition to `make ci` | `make lint-corpus` | 5.04–5.11 s |

Three of those numbers carry a consequence beyond their size.

The walk is the whole cost. Reading and parsing 891 sources is essentially the entire run, and the analysis over the finished graph — resolution and every judgment together — is 26 ms of it. The linter is an I/O and parsing problem with a graph computation attached, not the reverse, and that is why the design budgets the two apart: a resolution that turned superlinear would stay invisible inside a total the walk dominates.

The suite is dominated by the corpus, not by the properties. The property lane is under a second of a twenty-second suite, and holds there at an explicit 256 cases as at the default; the four binaries that read the real tree are some 17.5 s of it. The concern the design encoded — a case count raised without notice — is real but small, and the term that actually grows is the number of full checks the suite performs.

**Decision (The lane builds debug)** · `dec:lint:ci-lane-debug`

Both profiles were measured. On the distro's native filesystem the release binary checks the corpus in 0.30 s against debug's 2.41 s, a factor of about eight, which is the parsing being optimized. The lane still builds debug, because it compiles the crate in debug for the suite in any case: the check binary is a by-product there, where a release profile would be a second compilation of the crate and its dependencies and a second cache entry, bought for about two seconds of runtime. The measurement decides it, and it decides for debug.

The same comparison locates the budget in its environment rather than treating it as portable: the check that takes some 4.6 s on `/mnt/c` takes 2.41 s on native storage with the same binary, so roughly half the recorded budget is the filesystem crossing. A runner reading native storage should beat the budget comfortably, and the tolerance is not sized to hide a regression there.

## Commissioning gate · `sec:lint:commissioning-gate`

**Gate (Commissioning close-out)** · `gate:lint:commissioning-close`

Commissioning is closed, and with it the six-phase process for this crate (`preview:lint:phase-plan`):

- the corpus-wide check runs in continuous integration on every pull request and push, ungated (`dec:lint:ci-lane-ungated`), and fails the build on findings on the scoped failing set (`dec:lint:enforcement-partition`);
- the same check is a pre-push gate as `make lint-corpus`, and `make ci` runs it;
- every budget in (`tab:lint:budgets`) is a measurement rather than a proposal, taken at this phase, with the walk separated from the analysis and the property lane from the suite that contains it (`req:lint:timing`);
- the pipeline defect this phase found is fixed: the lane that reads the corpus runs whenever the corpus changes, documentation included (`obs:lint:corpus-reading-suites`);
- the corpus lints clean on the failing set with this note in the tree, which is the acceptance the concept scoped and the calculus's closing gate clause (`[LBL-gate:labels:implementation]`), (`conv:lint:gates-as-acceptance`).

What remains open is not this phase's to close. The entry machinery that carries a staged profile to effective is in flight, and until it lands both profiles stay staged (`dec:lint:staged-profiles`). The migrations that grow the failing set are the corpus's work rather than the crate's, and each lands as a commit that adds a prefix; when the last one has, the advisory half is empty and the gate enforces corpus-wide (`rep:lint:first-corpus`). The two later frontends are slices 7 and 8, behind their own preconditions (`[ARCH-dec:linter:kotlin-tree-sitter]`).

## Process note · `sec:lint:commissioning-process`

This was the engineering process's second full run, and what it taught is narrower than the first crate's lessons because the process itself held. One thing is worth carrying forward: the commissioning phase earned its place by finding a defect no earlier phase could have found. The audit read the crate and could not see the pipeline; the design proposed budgets and could not know which term would dominate. Both answers came from putting the thing in front of its consumer and measuring, which is what this phase is for — and the proposal it corrected was not wrong by a little. The design's proposed test-lane budgets, 60 s and 120 s, were set against a slice-1 carrier and a suite that did not yet read the corpus; the measured lane is some 20 s, dominated by a term that did not exist when the numbers were guessed. A budget carried forward unmeasured would have been generous enough to hide any regression this crate is likely to have.
