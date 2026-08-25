# Adoption data — rationale, rulings, findings

Companion to `corpus-adoption.toml`. Drafted 2026-08-20 against the
repository at branch `jakob/docs/linter-adoption-draft` (read-only);
ruled 2026-08-21.

Labels are written in ``double backticks`` throughout, which the label
calculus declares displayed and nonparticipating — so this note can be
moved into the corpus later without minting or citing anything by
accident.

Discharges the third bullet of ``gate:linter:architecture-review``: *"a
first draft of the adoption data exists — Σ, Ω under
``conv:linter:owner-partition``, Π, K, scanned regions per language,
banned-token sets"*. The data exist and every value in them is a
recorded decision.

**One amendment travels with the ruling.**
``conv:linter:owner-partition`` names "the Layer 1 interface document"
among the major documents, and R2 puts that file outside the carrier
entirely — it has no owner and no prefix. The same gate provides the
route: its first bullet confirms the partition convention "as stated or
amended". The amendment is recorded here and is a pending edit to
`crates/cogra-linter/docs/architecture.md`, which still names the
document.

## What is fixed, and on what authority

Every value in the TOML traces to one of three things, and the TOML
says which:

1. **A discipline speaks.** Copied, not decided. (Example: the five
   data every profile must fix; the fact that Π ⊆ K; that working
   notes are their own owner.)
2. **The repository speaks.** Measured, cited with the number.
   (Example: 284 test-attributed functions; 0 test-name collisions;
   `mod rig;` declared nine times for one definition.)
3. **Neither speaks.** Then it was ruled on 2026-08-21, and the
   **Rulings** section below records what stands and why. No fourth
   category was allowed, and nothing in the file is left proposed.

---

## Section by section

### `[carrier]` — Ω's domain, stated

``sig:labels:owners`` requires Ω to be **total on the carrier**, and
``judg:labels:minting`` defines the carrier by exclusion — VCS
internals, build and dependency directories, archived and vendored
trees, generated artifacts. A partition cannot be checked total against
an unstated domain, so the exclusions are adoption data. They live in
their own section rather than inside Ω, where they could only appear as
owner-less path rules pretending to be a partition.

Four sub-lists, because the calculus treats the four differently:
`exclude_trees` leaves the carrier entirely; `generated_files` stay in
the carrier in full — under ``inv:labels:generated-compliance`` their
occurrences mint and cite like any others, excluded only from what the
region presents, and their bytes stay exactness-checked, which is what
``rule:linter:register-freshness`` needs; `vendored_trees` is reserved
for the generated Kotlin parser of ``dec:linter:kotlin-tree-sitter``;
`vendored_files` holds `docs/primitive/layer1-interface.md` (R2).

The per-owner label registers of the test profile are generated files
of the first sort — committed, in the carrier, byte-compared — and join
`generated_files` as the generator creates them.

### `[signature]` — Σ

The five prefixes from the architecture preamble — `LBL`, `KND`, `IDN`,
`ICX`, `ARCH` — are kept **verbatim**. Two are load-bearing already:
`ICX` appears in 65 imported citations from the interchange crate's
docs plus 4 from the architecture document itself, and `ARCH` in 16.
Renaming either is a same-commit rewrite of ~85 citations.

**The package family and its derivation rule.** ``sig:labels:owners``
requires Σ to be *closed under its registered families*, a family
admitting prefixes "by its derivation rule" — so a new crate must not
need a decision. Rule **R-PKG′**: uppercase the package's directory
basename, delete every hyphen, then delete a leading `COGRA` when what
remains is nonempty and unique. Deleting hyphens is forced, not
stylistic: `PREFIX ::= [A-Z][A-Z0-9]*` admits no punctuation, so
`L1-STANDIN` is not a legal prefix and `L1STANDIN` is. The `COGRA`
strip is the one special case, and it is a closed one — a total
function of the name, with its two provisos deciding the two ways it
could fail (an empty remainder, a collision). It buys legibility at
every imported citation: `INTERCHANGE` and `LINTER` rather than
`COGRAINTERCHANGE` and `COGRALINTER`, in a corpus where every crate but
two already omits the vendor stem. Uniqueness is otherwise inherited
from uniqueness of directory names, a filesystem guarantee rather than
a convention; no derived prefix collides with a hand-registered one.

**Doc and tree owners get hand-registered prefixes**, not a family.
That mirrors the calculus's own illustration, where `SPEC`, `GUIDE` and
`NOTES` are individual registrations and only the numbered-record and
package rows are families. The numbered-record family is recorded as
*not registered*, with the reason (no `records/NNN-*.md` tree exists),
so a later reader knows it was considered.

### `[partition]` — Ω

Twenty ordered literal path prefixes, first-match-wins, per
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
collisions** between them, both in area `xchg`; and `design.md` cites
`req:xchg:determinism` — a mint of `concept.md` — in the **unprefixed**
form. Under ``inf:labels:same-owner-citation`` an unprefixed citation
"never resolves into another owner", so that citation resolves *only
if* the two files are one owner. Meanwhile both files cite `ARCH` and
`ICX` with brackets. The corpus has already answered where this
boundary sits; the TOML records the answer rather than deciding it.

**Package trees are single owners.**
``inf:labels:derivation-warrant`` fixes this for code: "The owner is
the asset's package, never the module — so movement within the package
changes nothing, and movement across packages changes the owner."

**Working notes are one owner over two roots.**
``conv:linter:owner-partition`` says working notes remain their own
owner (singular), and the repo has two note trees (`tmp_dev/`,
`tmp_research_files/`), so two rules point at one owner id. Both rules
carry `optional = true` (R6). Worth stressing that when present they
are *checked*: ``ansatz:labels:unchecked-locals`` expressly rejects
exempting the working notes from resolution.

### `[profiles]` — Π

Two profiles, both Rust, both named by ``conv:linter:rust-frontend``
("a test profile recognizing test-attributed functions, a module
profile recognizing `mod` items"). Nothing for Markdown, TypeScript or
Kotlin: their frontends are later slices, and a profile whose frontend
does not exist cannot compute a census — ``inv:labels:two-pass``
requires every census computed before any resolution runs, so a
half-available Π is not a smaller Π, it is a broken one.

Each profile fixes exactly the five data ``sig:labels:profiles``
demands. Three of the five were genuinely hard:

**Census must count definitions, not declarations.** The calculus says
the census may cover "a container such as a module or namespace
**definition**", and the repository proves the word matters: `mod rig;`
is declared in nine separate integration-test binaries under
`crates/api/tests/`, all naming the single definition at
`crates/api/tests/rig/`. A declaration-census derives `mod:*:rig` nine
times in one owner and fails ``inv:labels:inventory`` on day one; a
definition-census sees one asset. This is the clearest case in the file
of measurement resolving a reading of the discipline.

**Injectivity is already satisfied for tests, and for modules only
after the exclusion.** Measured per owner: `api` 160 distinct test
names of 160, `common` 81/81, `l1-standin` 15/15, `postgres-store`
26/26 — **no renaming needed anywhere**. ``inv:labels:inventory`` calls
a collision "a naming defect of the assets", and this corpus has none.
The module profile would fail immediately on 13 `#[cfg(test)] mod
tests` definitions; excluding them (R12) leaves every owner clean.

**The standard place is one choice per profile — and the two profiles
choose differently, because their costs differ by an order of
magnitude.** Tests take a **generated register of the owner** (R11):
284 assets, zero source edits, one generator. Modules keep the **inner
documentation comment**: the label sits at the asset, and the ~42
definitions are a bounded pending task rather than a blocker at the
scale of the test census. The inner form is the only one a file-backed
and an inline module can both carry.

The register deserves one line of justification beyond cost.
``inv:labels:generated-compliance`` makes a generated mint stand on its
warrant exactly as an authored one does, and says a derivation "is
attested wherever the profile's standard place lies, a generated
register included". The invariant's one safety exclusion — a generated
region participates in nothing it presents — is not even engaged: these
rows are generated from the **census**, an AST fact, never from an
occurrence set, so no row can feed a set it was generated from and
``metathm:labels:no-self-support`` stays a theorem. The register file
sits inside the tree of the owner it presents, because the mint occurs
where the label is carried and a mint must lie in the owner that owns
the label.

### `[reserved-kinds]` — K

The calculus defines K's *effect* precisely and its *membership* not at
all: "A corpus that also adopts a registry of kinds populates K from it
by its own recorded decision; this calculus consumes the set and asks
nothing of its provenance." So the reasoning had to come from the
registry, and the registry supplies it in one sentence.
``conv:kinds:assets`` characterises its family by exactly the property
that makes a kind derivable rather than authored:

> The family's mark is that the name is the code's own: an asset is
> headed by the identifier it already bears, where every other family's
> head is a heading an author composes.

A kind whose name is the code's own is a kind no author should be
minting by hand. Hence **K := the distinct kind tokens of
``conv:kinds:assets``**, 36 of them, of which 2 are governed by Π
today.

Two consequences worth stating plainly. First, the cost right now is
**zero**: no live mint anywhere in the carrier uses an Assets-family
kind (checked across all seven label-carrying files). Second, the
benefit is avoiding the expensive case the calculus describes — when a
later decision extends Π and *claims* a kind, "in the same commit,
every authored mint of that kind is renamed to an authored kind or
retired ... and every citation follows", and a claimed kind with
surviving authored mints "is a hard failure of the deciding commit".
Reserving the whole family converts that future migration into a
non-event.

Kinds deliberately left **outside** K although they sound code-shaped:
`listing`, `impl`, `alg`, `model`, `data`. These sit in
``conv:kinds:computation``, are headed by an authored heading, and are
in live authored use — `design.md` legitimately mints `impl:xchg:*` and
`model:xchg:*`. Reserving them would break the corpus today.

### `[typed-data]` and `[citation-indexes]` — empty, said out loud

Both are present and empty, with the reason recorded, because omitting
them would read as an oversight rather than a finding. Empty is a
**staging** state in both, and each carries its own revisit condition.

**Typed data.** Designating a class is a hard commitment:
``inv:labels:total-resolution`` makes every designated string a
citation that must resolve. Every candidate is missing the same half —
there is no mint to cite. The interchange namespace labels are
additionally disqualified by their own source, which states they "are
unrelated to the documentation labels of any corpus labeling
discipline; only the word is shared." The condition that reopens the
section is exact: an inventory profile that derives mints for one of
those asset classes — a migrations profile, an endpoint profile (R15).

**Citation indexes.** The one anchor-set-shaped file in the tree sits
outside the carrier, and the owner its names belong to is not in this
corpus. Designation waits on that owner becoming citable (R4).

### `[scanned-regions]`

Straight from the architecture's frontend rulings: Rust = documentation
comments only; Markdown = prose; web and Kotlin = comments. Two things
were added because participation needs them:

- a **region unit** per language, since ``gram:labels:well-formed``
  makes a span logical rather than a run of bytes ("a run of
  consecutive `///` lines is ONE logical region" is the practical
  consequence for Rust);
- an explicit **languages with no frontend** entry, so that SQL,
  GraphQL, TOML, shell, JSON and `.kts` having no scanned regions is a
  recorded decision rather than a gap. Those files stay in the carrier
  and stay owned; ``judg:labels:minting`` makes a file with no
  occurrences "vacuously in good standing".

### `[banned-tokens]`

Two rules, both ruled: Rust's plain `//` and Rust's plain `/* */`. They
are separate rules because they are separate token classes for the
pre-tokenizer and separate diagnostics for a reader, but they stand on
one decision — Rust sources of this corpus carry documentation comments
only.

The migration costs are measured rather than estimated, and they are
not alike: **~1210 plain `//` occurrences across 73 `.rs` files**, and
**zero `/*` occurrences** anywhere under `crates/`. The architecture
already accepted the line-comment sweep ("the existing Rust crates
contain plain comments today, so adopting the ban implies a one-time
migration sweep — a separate task; the linter only reports"); the block
comment ban costs nothing to adopt and closes the gap before one opens.

Detection is lexical, not textual — a `//` inside a string or raw
string is not a comment — which is the whole reason
``dec:linter:pretokenizer`` exists. (The zero above is from a raw-text
sweep, which can only over-count; zero raw hits means zero lexical
hits.)

### `[kinds]` — the kind registry's adoption data

A second discipline with parameters of its own. ``sig:kinds:acceptee``
names exactly one acceptee owning five things — X_A, E_A, σ_A, G_A,
Ê_A — and ``gate:kinds:adoption`` blocks adoption until the decision
names them. Nothing validates a head without them, since head
validation reads the effective relation C_A = C ∪ X_A.

The registry answers the question in its own closing sentence: *"For
the corpus in which this registry itself travels, the registry
authority is the acceptee, and the edition evidence base is E_A
entire."* `environment-kinds.md` lives in this corpus, so the default
fits exactly and the ruling adopts it rather than composing something
new. What the record adds is that it is a record: a default nobody
wrote down is not a recorded decision, and the gate asks for a
decision. The acceptee is named rather than described because
``sig:kinds:acceptee`` requires an authority, and the corpus's
no-personal-names rule governs the L1 team — an external party — not
this corpus's own acceptee.

Three consequences, plainly. **X_A is empty**, so C_A = C and every
head validates against the published relation — a claim the linter
checks rather than one this file asserts. **Nothing is strengthened**,
so σ_A is the edition's statuses unchanged and the corpus clause of
``inv:kinds:attestation-coverage`` holds trivially; the daggered rows
and the single candidate are recorded so that clause has something to
be checked against. And **one generator serves every generated
register**, because ``rule:linter:register-freshness`` already fixes
regeneration plus exact byte compare as the mechanism, and a second
generator would be a second source of truth.

The headline counts need one distinction. ``tab:kinds:headline-counts``
is a generated *region* inside an authored file, not a generated file:
`environment-kinds.md` stays out of `[carrier]` `generated_files`, and
what is regenerated and compared is that one table — the registry
document's only generated region, as its gate says.

---

## Findings that are not questions

**F1. `docs/primitive/layer1-interface.md` does not use this corpus's
mint syntax.** Its ~364 label spans occur almost exclusively in
parenthesized form — which ``lang:labels:label-language`` reads as a
*same-owner citation* — with essentially no bare occurrence anywhere in
the file. Adopting the calculus over the file unchanged produces
roughly 360 unresolved citations, each a hard failure under
``inv:labels:total-resolution``. Worse, the handful of bare spans (for
instance `tbl:symbols:boundary` inside a table cell at line 69) would
be read as **mints** — accidental conceptual homes for upstream names.
This finding is the ground of R2.

**F2. That file's kind tokens are not in the registry.** It uses `post`
(55), `subsec` (40), `tbl` (15), `edge` (12), `node` (9). The registry
classifies Table as `tab`, not `tbl`; treats iterated `sub-` prefixes
as *presentation*, so `subsec` reduces to `sec`
(``def:kinds:presentation-reduction``); and catalogues neither `post`,
`edge` nor `node` at all. Under ``inv:kinds:catalogued-pairs`` these
would need recorded local extensions X_A — and they cannot be renamed
instead, because the file states that renaming any pinned label is a
breaking change on the L1 team's side. With R2 the question does not
arise: the file is outside the label graph, and the extensions are not
owed.

**F3. `ICX` the prefix names the conventions document; the crate's
docs use the area `xchg`.** `ICX` is registered to the interchange
**conventions** document; the interchange **crate's** docs — a
different owner — mint in area `xchg` (ruled 2026-08-21, renamed from
a lookalike while the rename was still cheap); and R-PKG′ gives that
crate the prefix `INTERCHANGE`. Prefixes and areas are separate
namespaces, the three tokens are distinct, and no pair now invites the
assumption that it names one thing.

---

## Rulings

Ruled 2026-08-21 through R17, and 2026-08-25 from R18 — the concept
review's rulings, whose adoption-data half lands here. Each entry says
what stands and why.

**R1 — The `[carrier]` section is adoption data.** Ω cannot be shown
total without a stated domain, and ``sig:linter:adoption-data`` reads
"plus this corpus's own additions" as an open list. Stating the
exclusions in their own section keeps them out of Ω, where they could
only masquerade as rules with no owner.

**R2 — `docs/primitive/layer1-interface.md` is outside the carrier**, a
vendored/derived third-party reference: a derived extraction of a
third-party specification, under its own licence, whose ~364 names are
frozen upstream and cannot be migrated by this corpus (F1, F2). It has
no owner, no prefix, no scanned region — it is outside the label graph
entirely, so nothing in it can resolve or fail. When the L1 repository
becomes public, the upstream specification joins as a citable owner and
imported citations point there; registering that owner is what ends the
exclusion.

**R3 — Package prefixes derive by R-PKG′**: uppercase the directory
basename, delete hyphens, then delete a leading `COGRA` when the
remainder is nonempty and unique. `LINTER` and `INTERCHANGE` are worth
one bounded special case in a rule that stays closed and total.

**R4 — `layer1-interface.md` is not a citation index.** It follows from
R2: an index harvests citations of the carrier into an owner with
mints, and the file is neither in the carrier nor is its upstream in
this corpus. Same future path as R2 — the designation becomes available
when the upstream owner does, and the hash's function, role separation
and identifier remain owed to the identity discipline.

**R5 — Major documents are exactly the label-bearing ones.** Owner
granularity is free for a document that carries no labels, and
promotion is one recorded decision taken when a document takes labels.
The residual doc-tree owners `PRIM`, `INST`, `IMPL`, `DOCS` stand;
`api-spec.md` and `data-model.md` are promoted the day they take
labels, not before.

**R6 — The two working-notes roots are `optional = true`.** They are
gitignored junctions and may simply not exist on a machine; an absent
configured root is legal and silent. A root that exists and cannot be
read stays a loud diagnostic — ``cav:labels:coexistence`` is about
failure, not absence, and `optional` does not touch it.

**R7 — `architecture.md` is its own owner with the `ARCH` prefix.** It
is a corpus-generic document of the same rank as the four disciplines
beside it, not the linter crate's internal prose; 16 live citations
already use the prefix.

**R8 — `android/` is one owner.** Nothing is scanned there until the
Kotlin frontend of slice 3, so a 12-way split would buy 12 prefixes and
12 rules over an empty occurrence set. The split is revisited when the
Kotlin frontend lands and the modules begin carrying labels.

**R9 — The test profile registers two areas, `unit` and
`integration`.** Cargo recognizes two test target kinds; `interunit`
appears in the calculus's illustration but has no recognizer here, and
an area nothing can populate is a registration with nothing behind it.

**R10 — "Which Cargo target contains it" is a legitimate
classification.** Target membership is a **build-system class** of the
asset — the same species of fact as "the harness recognizes this as a
test", which is what makes it an asset at all — not a path fact, even
though Cargo locates integration targets by directory. The derivation
reads the target, never the path, so ``judg:labels:derivation`` and
``ansatz:labels:path-derivation`` are honored. This reading is the
recorded one.

**R11 — The test profile's standard place is a generated register per
owner.** ``sig:labels:profiles`` admits it since calculus v2, and
``inv:labels:generated-compliance`` makes the generated mint stand on
its warrant like any other. It costs one generator and zero source
edits where the alternative costs a 284-function migration, and it is
not circular: the rows derive from the census, never from an occurrence
set. The register's name and location — `<owner tree
root>/label-register.md` — are implementation-defined and marked as
such; what is fixed is that the place is a generated register *of the
owner*, hence a file inside that owner's tree. The module profile keeps
the `//!` inner doc comment, whose ~42-definition migration is a
recorded pending task. The ~1210 plain-comment sweep remains a separate
task.

**R12 — `#[cfg(test)]` modules stay out of the module census.** They
are test scaffolding, and their contents are the test profile's
business; including them would derive `mod:*:tests` thirteen times and
fail injectivity in two owners on day one. The consequence is accepted:
an inline test module carries no label.

**R13 — Module labels take one constant area: `mod:module:<name>`.** A
visibility-derived area would make visibility a citation-visible facet
— turning a module `pub` would change its label and dangle every
citation of it (``metathm:labels:warrant-lapse``), so an ordinary
refactor would break prose that never mentioned visibility. A constant
carries no information and cannot be wrong; injectivity is decided by
the name alone and is unaffected.

**R14 — K is wide: all 36 kind tokens of ``conv:kinds:assets``.** It
costs nothing today (no live mint uses one) and prevents the
same-commit retirement the calculus describes when a later profile
claims a kind. A narrow K would leave `func`, `class`, `endpoint` and
`migr` authorable and pay at exactly that moment.

**R15 — `[typed-data]` stays empty, as staging.** Not an acceptance of
permanent mintlessness: every candidate lacks a mint to cite, and
designations follow once inventory profiles derive mints for those
asset classes — a migrations profile, an endpoint profile. Adopting
such a profile is the revisit condition; nothing else reopens it.

**R16 — Rust's plain block comment `/* */` is banned.** Rust carries
documentation comments only, and both bans stand on that one decision.
Measured cost to adopt: zero occurrences under `crates/`.

**R17 — `.kts` files are not scanned in v1.** They are build
infrastructure rather than app source, and the zero-error precondition
of ``dec:linter:kotlin-tree-sitter`` was measured over the 138 `.kt`
files only. Revisited at the Kotlin slice, when the grammar that would
parse them arrives.

**R18 — The kind registry's adoption takes the registry's own
defaults.** jakob is the acceptee, owning X_A, E_A, σ_A, G_A and Ê_A;
X_A is empty; E_A is the edition evidence base entire, by reference;
σ_A strengthens nothing. This is what ``sig:kinds:acceptee`` prescribes
for the corpus a registry travels in, and this is that corpus. The
linter's regeneration mode is G_A for every generated register,
Ê_A and the headline counts included, since
``rule:linter:register-freshness`` already owns the regenerate-and-
compare mechanism. A register that has never been generated reports as
**staged**, not stale: it has no committed bytes to compare against,
and the first generation run commits it and arms exact comparison
thereafter.

---

## Measurements

Taken 2026-08-20 unless noted, on the branch as checked out.

| Fact | Value |
|---|---|
| Cargo packages | 4 built (`api`, `common`, `l1-standin`, `postgres-store`) + 2 pending (`cogra-linter`, `cogra-interchange`, docs-only) |
| Rust sources | 73 `.rs` files |
| Test-attributed functions | 284 (98 `#[test]`, 171 `#[sqlx::test]`, 15 `#[tokio::test]`) |
| Test-name collisions per owner | 0 (160/160, 81/81, 15/15, 26/26) |
| `mod` declarations | 63, of which 13 `mod tests` and 9 `mod rig;` for one definition |
| Module definitions needing a `//!` label | ~42 |
| Plain `//` comment occurrences | ~1210 |
| Plain `/*` occurrences under `crates/` (2026-08-21) | 0 |
| Files in `docs/primitive/` (2026-08-21) | 18, of which 1 (`layer1-interface.md`) is outside the carrier |
| Kotlin sources | 138 `.kt`, 16 `.kts`, 12 Gradle modules |
| TypeScript sources | 162 `.ts`/`.tsx` |
| Markdown in carrier | 58 files (4 more in the working-note trees) |
| Files carrying labels today | 7, all in the carrier |
| Live imported citations | `ICX` 65, `LBL` 21, `ARCH` 16, `IDN` 6, `KND` 5 |
| Label spans in `layer1-interface.md` | ~364, across 15 areas, 14 kind tokens (outside the carrier) |
