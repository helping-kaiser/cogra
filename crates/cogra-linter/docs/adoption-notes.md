# Adoption data, first draft — rationale and questions

Companion to `lane-d-adoption.toml`. Drafted 2026-08-20 against the
repository at branch `jakob/docs/interchange-design` (read-only).

Labels are written in ``double backticks`` throughout, which the label
calculus declares displayed and nonparticipating — so this note can be
moved into the corpus later without minting or citing anything by
accident.

Discharges the third bullet of ``gate:linter:architecture-review``: *"a
first draft of the adoption data exists — Σ, Ω under
``conv:linter:owner-partition``, Π, K, scanned regions per language,
banned-token sets"*. It does not discharge it: a draft that names
seventeen open questions is an input to the ruling, not the ruling.

## What is drafted, and on what authority

Every value in the TOML traces to one of three things, and the TOML
says which:

1. **A discipline speaks.** Copied, not decided. (Example: the five
   data every profile must fix; the fact that Π ⊆ K; that working
   notes are their own owner.)
2. **The repository speaks.** Measured today, cited with the number.
   (Example: 284 test-attributed functions; 0 test-name collisions;
   `mod rig;` declared nine times for one definition.)
3. **Neither speaks.** Then it is a QUESTION below and the TOML value
   is marked a proposal. No third category was allowed.

---

## Section by section

### `[carrier]` — a section the brief did not ask for

**Deviation, named.** The brief listed eight sections; this is a
ninth. The reason is structural: ``sig:labels:owners`` requires Ω to be
**total on the carrier**, and ``judg:labels:minting`` defines the
carrier by exclusion — VCS internals, build and dependency
directories, archived and vendored trees, generated artifacts. A
partition cannot be checked total against an unstated domain, so the
exclusions have to live somewhere in the adoption data. Putting them
in a separate section keeps them from being smuggled into Ω as
owner-less path rules.

Three sub-lists, because the calculus treats the three differently:
`exclude_trees` leaves the carrier entirely; `nonparticipating_files`
stay in the carrier **as bytes** (``judg:labels:minting``: a generated
region "remains in the carrier as bytes, checked for exactness, while
participating in nothing") — which is exactly what
``rule:linter:register-freshness`` needs; `vendored_trees` is empty
today and reserved for the generated Kotlin parser of
``dec:linter:kotlin-tree-sitter``.

### `[signature]` — Σ

The five provisional prefixes from the architecture preamble — `LBL`,
`KND`, `IDN`, `ICX`, `ARCH` — are kept **verbatim**, as instructed.
Two of them are already load-bearing in the corpus and could not be
changed cheaply: `ICX` appears in 65 imported citations from the
interchange crate's docs plus 4 from the architecture document itself,
and `ARCH` in 16. Renaming either is a same-commit rewrite of ~85
citations.

**The package family and its derivation rule.** ``sig:labels:owners``
requires Σ to be *closed under its registered families*, a family
admitting prefixes "by its derivation rule" — so a new crate must not
need a decision. Rule **R-PKG**: uppercase the package's directory
basename, delete every hyphen. Deleting hyphens is forced, not
stylistic: `PREFIX ::= [A-Z][A-Z0-9]*` admits no punctuation, so
`L1-STANDIN` is not a legal prefix and `L1STANDIN` is. Uniqueness of
prefixes is inherited from uniqueness of directory names, which is a
filesystem guarantee rather than a convention.

**Doc and tree owners get hand-registered prefixes**, not a family.
That mirrors the calculus's own illustration, where `SPEC`, `GUIDE`
and `NOTES` are individual registrations and only the numbered-record
and package rows are families. The numbered-record family is recorded
as *not registered*, with the reason (no `records/NNN-*.md` tree
exists), so a later reader knows it was considered.

### `[partition]` — Ω

Written as ordered literal path prefixes with first-match-wins, per
``sig:linter:adoption-data``. Ordering is what lets the five document
owners live *inside* `crates/cogra-linter/docs/` while the package
owner takes the rest of that tree: rules 1–5 are full file paths and
precede rule 6's tree prefix. The last rule is the empty prefix, which
matches everything — **totality is structural, not a check that can
fail**, and a new top-level directory lands in `REPO` rather than
crashing the linter.

Three choices in this section rest on measurement rather than taste:

**The interchange crate's docs belong to the crate's owner (rule 7).**
`concept.md` mints 16 labels and `design.md` mints 76, with **zero
collisions** between them, both in area `icx`; and `design.md` cites
`req:icx:determinism` — a mint of `concept.md` — in the **unprefixed**
form. Under ``inf:labels:same-owner-citation`` an unprefixed citation
"never resolves into another owner", so that citation resolves *only
if* the two files are one owner. Meanwhile both files cite `ARCH` and
`ICX` with brackets. The corpus has already answered where this
boundary sits; the TOML records the answer rather than re-deciding it.

**Package trees are single owners.**
``inf:labels:derivation-warrant`` fixes this for code: "The owner is
the asset's package, never the module — so movement within the package
changes nothing, and movement across packages changes the owner."

**Working notes are one owner over two roots.**
``conv:linter:owner-partition`` says working notes remain their own
owner (singular), and the repo has two note trees (`tmp_dev/`,
`tmp_research_files/`), so two rules point at one owner id. Worth
stressing that they are *checked*: ``ansatz:labels:unchecked-locals``
expressly rejects exempting the working notes from resolution.

### `[profiles]` — Π

Two profiles, both Rust, both named by ``conv:linter:rust-frontend``
("a test profile recognizing test-attributed functions, a module
profile recognizing `mod` items"). Nothing for Markdown, TypeScript or
Kotlin: their frontends are later slices, and a profile whose frontend
does not exist cannot compute a census — ``inv:labels:two-pass``
requires every census computed before any resolution runs, so a
half-available Π is not a smaller Π, it is a broken one.

Each profile fixes exactly the five data ``sig:labels:profiles``
demands. Two of the five were genuinely hard:

**Census must count definitions, not declarations.** The calculus
says the census may cover "a container such as a module or namespace
**definition**", and the repository proves the word matters:
`mod rig;` is declared in nine separate integration-test binaries
under `crates/api/tests/`, all naming the single definition at
`crates/api/tests/rig/`. A declaration-census derives `mod:*:rig` nine
times in one owner and fails ``inv:labels:inventory`` on day one; a
definition-census sees one asset. This is the clearest case in the
draft of measurement resolving a reading of the discipline.

**Injectivity is already satisfied for tests, and only for tests.**
Measured per owner: `api` 160 distinct test names of 160, `common`
81/81, `l1-standin` 15/15, `postgres-store` 26/26 — **no renaming
needed anywhere**. ``inv:labels:inventory`` calls a collision "a
naming defect of the assets", and this corpus currently has none. The
module profile is the opposite: it fails immediately on 13
`#[cfg(test)] mod tests` definitions unless they are excluded, which
is a proposal (QUESTION 12), not a consequence.

The **standard place** had to be one choice per profile, which drove
both selections: the documentation comment for tests (the only Rust
region that survives the plain-comment ban), and the **inner** doc
comment for modules (the only form a file-backed and an inline module
can both carry).

### `[reserved-kinds]` — K

The calculus defines K's *effect* precisely and its *membership* not
at all: "A corpus that also adopts a registry of kinds populates K
from it by its own recorded decision; this calculus consumes the set
and asks nothing of its provenance." So the reasoning had to come from
the registry, and the registry supplies it in one sentence.
``conv:kinds:assets`` characterises its family by exactly the property
that makes a kind derivable rather than authored:

> The family's mark is that the name is the code's own: an asset is
> headed by the identifier it already bears, where every other
> family's head is a heading an author composes.

A kind whose name is the code's own is a kind no author should be
minting by hand. Hence **K := the distinct kind tokens of
``conv:kinds:assets``**, 36 of them, of which 2 are governed by Π today.

Two consequences worth stating plainly. First, the cost right now is
**zero**: no live mint anywhere in the corpus uses an Assets-family
kind (checked across all seven label-carrying files). Second, the
benefit is avoiding the expensive case the calculus describes — when a
later decision extends Π and *claims* a kind, "in the same commit,
every authored mint of that kind is renamed to an authored kind or
retired ... and every citation follows", and a claimed kind with
surviving authored mints "is a hard failure of the deciding commit".
Reserving the whole family now converts that future migration into a
non-event.

Kinds deliberately left **outside** K although they sound code-shaped:
`listing`, `impl`, `alg`, `model`, `data`. These sit in
``conv:kinds:computation``, are headed by an authored heading, and are
in live authored use — `design.md` legitimately mints `impl:icx:*` and
`model:icx:*`. Reserving them would break the corpus today.

### `[typed-data]` and `[citation-indexes]` — empty, said out loud

Both are present and empty, with the reason recorded, because omitting
them would read as an oversight rather than a finding.

**Typed data.** Designating a class is a hard commitment:
``inv:labels:total-resolution`` makes every designated string a
citation that must resolve. Every candidate examined is missing the
same half — there is no mint to cite. The interchange namespace labels
are additionally disqualified by their own source, which states they
"are unrelated to the documentation labels of any corpus labeling
discipline; only the word is shared."

**Citation indexes.** One live candidate exists and is *not*
designated; see QUESTION 4.

### `[scanned-regions]`

Straight from the architecture's frontend rulings: Rust = documentation
comments only; Markdown = prose; web and Kotlin = comments. Two things
were added because participation needs them:

- a **region unit** per language, since ``gram:labels:well-formed``
  makes a span logical rather than a run of bytes ("a run of
  consecutive `///` lines is ONE logical region" is the practical
  consequence for Rust);
- an explicit **languages with no frontend** entry, so that SQL,
  GraphQL, TOML, shell and JSON having no scanned regions is a
  recorded decision rather than a gap. Those files stay in the carrier
  and stay owned; ``judg:labels:minting`` makes a file with no
  occurrences "vacuously in good standing".

### `[banned-tokens]`

One ruled entry (Rust's plain `//`) and one proposed entry (Rust's
plain `/* */`), kept as separate rules so the proposal can be struck
without touching the ruling. The migration cost is measured rather
than estimated: **~1210 plain-comment occurrences across 73 `.rs`
files**. The architecture already accepted this ("the existing Rust
crates contain plain comments today, so adopting the ban implies a
one-time migration sweep — a separate task; the linter only reports"),
but the number is worth having before the sweep is scheduled.

Detection is lexical, not textual — a `//` inside a string or raw
string is not a comment — which is the whole reason
``dec:linter:pretokenizer`` exists.

---

## Findings that are not questions

Three things surfaced that no one asked about and that the draft
cannot paper over.

**F1. `docs/primitive/layer1-interface.md` does not use this corpus's
mint syntax.** Its ~364 label spans occur almost exclusively in
parenthesized form — which ``lang:labels:label-language`` reads as a
*same-owner citation* — with essentially no bare occurrence anywhere
in the file. Adopting the calculus over the file unchanged produces
roughly 360 unresolved citations, each a hard failure under
``inv:labels:total-resolution``. Worse, the handful of bare spans (for
instance `tbl:symbols:boundary` inside a table cell at line 69) would
be read as **mints** — accidental conceptual homes for upstream names.
This is the substance of QUESTION 2.

**F2. That file's kind tokens are not in the registry.** It uses
`post` (55), `subsec` (40), `tbl` (15), `edge` (12), `node` (9). The
registry classifies Table as `tab`, not `tbl`; treats iterated `sub-`
prefixes as *presentation*, so `subsec` reduces to `sec`
(``def:kinds:presentation-reduction``); and catalogues neither `post`,
`edge` nor `node` at all. Under ``inv:kinds:catalogued-pairs`` these
would need recorded local extensions X_A — and they cannot be
renamed instead, because the file states that renaming any pinned
label is a breaking change on the Peer Team's side.

**F3. `ICX` the prefix and `icx` the area are unrelated, and look
related.** `ICX` is registered to the interchange **conventions**
document; `icx` is the area used by the interchange **crate's** docs,
which are a different owner. Nothing formally collides — prefixes and
areas are separate namespaces — but a reader will assume `ICX` and
`icx` name the same thing. Cheap to fix now (rename one), expensive
later (85 citations carry `ICX`; 183 labels carry `icx`).

---

## QUESTIONS FOR REVIEW

Seventeen judgment calls. Each says what was drafted, what else was
available, and what turns on it.

**Q1 — May the adoption data carry a `[carrier]` section?**
Drafted: yes, with tree/file/vendored exclusion lists. Ω cannot be
shown total without a stated domain. Alternative: fold the exclusions
into Ω as rules mapping to a `null` owner. *Turns on:* whether "seven
data plus this corpus's own additions" is read as an open list.

**Q2 — Is `docs/primitive/layer1-interface.md` in the carrier at all,
and if so, whose labels are those?** *The largest question in the
draft.* Three options:
(a) **Vendored** — treat the derived third-party extraction as a
vendored tree and exclude it. Cheapest; costs the ability to cite the
L1 surface from CoGra docs by label. Defensible: the file is a derived
reference under a separate licence.
(b) **Its own owner, minting** — the spans become mints in `L1IF`.
Requires migrating ~360 parenthesized spans to bare form, and requires
local extension rows for `post`, `subsec`, `tbl`, `edge`, `node`
(F2). Semantically uncomfortable: the corpus would be asserting
conceptual ownership of names the Peer Team owns.
(c) **Register the upstream spec as an owner** (say `PN`) and migrate
every span to the imported form `([PN-…])`. Honest about provenance,
but the calculus's Import rule requires the upstream owner to *have
mints in this corpus* — and the PeerNetworks specification is not in
the corpus — so this option needs a further ruling on how an
out-of-corpus owner resolves, which the calculus does not provide.
Drafted: (b)'s owner exists in the partition, with the blocker
recorded in the rule's own note. Nothing is chosen.

**Q3 — R-PKG or R-PKG′ for package prefixes?** Drafted R-PKG
(uppercase, delete hyphens) — yields `COGRAINTERCHANGE`,
`POSTGRESSTORE`. R-PKG′ additionally drops a leading `COGRA`, yielding
`INTERCHANGE`, `LINTER`. *Turns on:* legibility of imported citations
versus a derivation rule with no special cases.

**Q4 — Designate `layer1-interface.md` as a citation index?** It
already pins an anchor set (364 names, a stated sha256 over the sorted
distinct names). Designating it would make the pin a checked artifact
rather than a hand-maintained claim. Blocked on Q2, and on two further
gaps: the file materializes no index *section* (only a count and a
hash), and ``inf:labels:anchor-harvest`` leaves the hash's function,
role separation and identifier to the identity discipline. Drafted:
not designated.

**Q5 — Which documents are "major", and how do the docs trees
group?** ``conv:linter:owner-partition`` names the four disciplines
and the Layer 1 interface document "and peers of that rank", and
explicitly leaves the grouping to this draft. Drafted: promote **only
what carries labels today** (the five documents that already practise
the discipline, plus `layer1-interface.md`), and give each remaining
docs tree one residual owner — `PRIM`, `INST`, `IMPL`, `DOCS`. The
argument is that owner granularity is free for label-free documents,
and promoting a document later is one recorded decision. The
counter-argument is that `docs/implementation/api-spec.md` (3479
lines, the frontend/backend contract) and `docs/implementation/
data-model.md` (1417 lines, the store contract) are plainly of Layer-1
rank by function, and promoting them *before* they take labels avoids
a migration afterwards. Also unresolved by the same token:
`docs/primitive/governance.md` (938), `docs/implementation/auth.md`
(867), `docs/implementation/design.md` (851),
`docs/primitive/feed-ranking.md` (818),
`docs/primitive/economics.md` (761).

**Q6 — Working notes are gitignored; what happens when the tree is
absent?** `tmp_dev/` and `tmp_research_files/` are junctions into the
`dev-state` repo and may simply not exist on a given machine.
``cav:labels:coexistence`` says an unreadable tree must never become
an empty carrier — but that is about *failure*, not *absence*.
Drafted: both roots configured, behaviour on absence unspecified.
*Options:* a configured root that does not exist is (a) a diagnostic,
(b) silently empty, (c) marked `optional = true` in the rule.

**Q7 — Is `crates/cogra-linter/docs/architecture.md` its own owner?**
Drafted: yes (`ARCH`), separate from `pkg.cogra-linter`. But the
parallel case was decided the other way by evidence: the interchange
crate's design and concept docs belong to the *package* owner (rule 7).
Making the linter's architecture doc part of `pkg.cogra-linter` would
be more consistent — at the price of retiring the `ARCH` prefix, which
16 live citations use.

**Q8 — Do the Android modules split into 12 owners?**
``conv:linter:owner-partition`` parks this question for this draft.
Drafted: one owner for `android/`. Splitting means 12 prefixes and 12
rules, and makes every cross-module citation an import — which is
arguably the point, since Gradle modules are genuine package
boundaries and ``inf:labels:derivation-warrant`` ties ownership to the
package. Note the asymmetry as drafted: four Rust crates are four
owners, twelve Gradle modules are one.

**Q9 — Register the `interunit` area with no recognizer?** The
calculus's illustration uses `unit`, `interunit`, `integration`; Cargo
recognizes two test target kinds. Drafted: registered, unpopulated.
*Options:* drop it, or define a corpus recognizer for it (for instance
an attribute or a naming convention on cross-unit tests).

**Q10 — Is "which Cargo target contains it" a legitimate
classification?** ``judg:labels:derivation`` states that "File,
module, path, and position never enter" a derivation, and
``ansatz:labels:path-derivation`` rejects path-derived names. The
draft reads target membership as a *build-system class* — the same
species of fact as "the harness recognizes this as a test" — not as a
path fact, even though Cargo locates integration targets by directory.
If that reading is rejected, the fallback is one constant area for the
whole profile, which loses the unit/integration distinction entirely.
*This is the interpretive call most likely to be wrong.*

**Q11 — Is the inventory migration acceptable, and when?**
``inv:labels:inventory`` admits nothing partial: every covered asset
carries its label or the run fails. Adopting Π as drafted means
labelling **284 test functions** and **~42 module definitions** before
the linter can pass, plus the ~1210 plain-comment sweep from the ban.
*Options:* adopt Π empty in v1 and add profiles per migration; adopt
the test profile only (its injectivity is already clean); adopt both.

**Q12 — Exclude `#[cfg(test)]` modules from the module census?**
Drafted: excluded. Without the exclusion the profile fails
immediately — 13 definitions named `tests` in two owners. With it,
inline test modules carry no label at all. *Options:* exclude (as
drafted); include and rename the 13 modules; or drop the module
profile from v1 (see Q11).

**Q13 — How does a module classify into an area?** Drafted:
visibility (`pub` → `public`, everything else → `internal`). This is
the weakest value in the file. It has a real consequence: making a
module public *changes its label* and dangles every citation of it
(``metathm:labels:warrant-lapse``), so visibility becomes a
citation-visible facet of the module. *Options:* (a) one constant
area, information-free but never wrong; (b) three areas splitting
`pub` / `pub(crate)` / private; (c) visibility as drafted.

**Q14 — K = the whole Assets family, or only the governed kinds?**
Drafted: all 36 tokens of ``conv:kinds:assets``. Narrow alternative:
K = {`test`, `mod`}, leaving `func`, `class`, `endpoint`, `migr` and
the rest authorable. The wide choice costs nothing today (no live mint
uses any of them) and prevents a painful same-commit retirement when a
profile later claims one; the narrow choice leaves authors free to
write `func:…` in prose and pays for it later.

**Q15 — Anything to designate as typed data?** Drafted: nothing, with
reasons. Confirm that GraphQL schema names, migration filenames and
design-token keys are *not* intended to cite documentation mints.

**Q16 — Is Rust's plain block comment `/* */` banned too?**
``dec:linter:rust-comment-ban`` names `//` as the banned token but
also says Rust sources "carry documentation comments only", which
reads as banning both. Drafted as a separate rule marked *proposed*.
*Turns on:* whether the ruling was about the line comment specifically
or about non-doc comments generally.

**Q17 — Are `.kts` files Kotlin for the linter's purposes?** 16
Gradle script files (`build.gradle.kts`, `settings.gradle.kts`,
`build-logic/`). Drafted: not scanned — listed under "no frontend".
They are Kotlin syntactically, so a first-party grammar would likely
parse them, but they are build infrastructure rather than app source,
and ``dec:linter:kotlin-tree-sitter``'s zero-error precondition was
measured over the 138 `.kt` files only, not over `.kts`.

---

## Measurements taken for this draft

All 2026-08-20, on the branch as checked out.

| Fact | Value |
|---|---|
| Cargo packages | 4 built (`api`, `common`, `l1-standin`, `postgres-store`) + 2 pending (`cogra-linter`, `cogra-interchange`, docs-only) |
| Rust sources | 73 `.rs` files |
| Test-attributed functions | 284 (98 `#[test]`, 171 `#[sqlx::test]`, 15 `#[tokio::test]`) |
| Test-name collisions per owner | 0 (160/160, 81/81, 15/15, 26/26) |
| `mod` declarations | 63, of which 13 `mod tests` and 9 `mod rig;` for one definition |
| Plain `//` comment occurrences | ~1210 |
| Kotlin sources | 138 `.kt`, 16 `.kts`, 12 Gradle modules |
| TypeScript sources | 162 `.ts`/`.tsx` |
| Markdown in carrier | 58 files (4 more in the working-note trees) |
| Files carrying labels today | 7 |
| Live imported citations | `ICX` 65, `LBL` 21, `ARCH` 16, `IDN` 6, `KND` 5 |
| Label spans in `layer1-interface.md` | ~364, across 15 areas, 14 kind tokens |
