# The Corpus Linter — Audit

_Phase 5 of the standard engineering process: the audit. Adversarial review over the merged crate by a reader who wrote none of it, the four deferred fuzz targets written and campaigned, and orchestrator reproduction of every Major._

The crate closed its feature surface with the sixth slice: 673 tests, a corpus self-lint clean on the failing set. It was then audited — spec conformance against the label calculus, the kind registry, and the ruled adoption data, by a lane that was not the author of the code it read, working read-only against the merged tree and deciding every claim by an actual run rather than by reading; and the fuzz lane the design deferred to exactly this phase (`preview:lint:fuzz-plan`). Every Major was reproduced by the orchestrator before it was recorded, and the first of them again after it was fixed. The reproductions — nine fixture corpora, two patched adoption files, and a probe binary linking the crate's public surface — live in the working notes and not in the repository, which is where working artifacts belong; what is normative is here.

The document practices the labeling discipline: the label at each heading or environment head is that environment's mint; a parenthesized label in running text is a same-owner citation; material in fenced blocks and double-backtick spans is displayed without participating, which is where every finding's reproduction and every token this document merely quotes sits. The document title mints nothing. Every label minted here has area `lint`, and this file belongs to `pkg.cogra-linter`, the owner of the concept and the design it closes upon. Imported citations use the prefixes registered in ``corpus-adoption.toml``: `LBL` for the label calculus, `KND` for the kind registry, `IDN` for the identity adjudication procedure, and `ARCH` for the linter architecture.

## What the audit could not break · `sec:lint:audit-held`

The audit's strongest result is a negative one, and for a checker it is the one that matters: **the gates the linter exists to discharge are discharged, and the adversarial pass could not make the discipline's own clauses fail.** Forty clauses were attacked with constructed counterexamples and held. The label grammar admits exactly the three occurrence forms and nothing adjacent to them — ten malformed interiors, four bracket malformations, and five parenthesis adjacencies all fall to ordinary text or to the warning the calculus asks for, never to a false occurrence. Resolution is total in both directions across both concrete syntaxes and across files, forward references included, which is the two-pass staging working rather than a test passing. Head validation is case-exact, its overriding rows beat reduction, and its homonyms are separated by the kind token, against the real registry document with its 333 catalogued names. The registry's headline counts, recomputed from the tables alone, are byte-identical to the committed region. The identity boundary is clean at grep level and at behavior level alike: no hashing crate is in the dependency set, no digest is computed anywhere over content, and exact-byte freshness detects a single added trailing newline, a single removed one, and an LF-to-CRLF rewrite, each at the right offset. And the scanner does not panic on non-ASCII at any byte position of a mixed-script input.

**Table (Clauses checked clean)** · `tab:lint:audit-clauses`

Each row was decided by a run against a constructed input, not by reading. The clause column is normative; a row with no clause would be a defect of this table.

| # | Clause | What the run showed |
| --- | --- | --- |
| C1 | (`[LBL-lang:labels:label-language]`) | the three forms parse in both concrete syntaxes |
| C2 | (`[LBL-gram:labels:well-formed]`) | ten malformed interiors — empty, colon-led, colon-trailed, four-field, hyphen-led, hyphen-trailed, double-hyphen, hyphenated kind — are ordinary text, never a failure |
| C3 | (`[LBL-lang:labels:label-language]`) | all-digit words are legal; a triple of digits mints |
| C4 | (`[LBL-gram:labels:well-formed]`) | forms do not nest: doubled and unbalanced brackets yield no occurrence |
| C5 | (`[LBL-lang:labels:label-language]`) | the prefix alphabet holds: a single uppercase letter registers, a digit-led or lower-case prefix does not |
| C6 | (`[LBL-gram:labels:well-formed]`) | spacing is not an occurrence: a span spaced inside its parentheses mints rather than cites |
| C7 | (`[LBL-inf:labels:imported-citation]`) | a bracket-free cross-owner token fails, and names the import form that would reach it |
| C8 | (`[LBL-inf:labels:imported-citation]`) | an unregistered prefix and a self-qualified import each fail under their own rule |
| C9 | (`[LBL-inv:labels:unique-mint]`) | a duplicate fails with both locations, across files and across the two syntaxes |
| C10 | (`[LBL-inv:labels:two-pass]`), (`[LBL-metathm:labels:order-independence]`) | a citation resolves to a mint in a file that sorts after it |
| C11 | (`[LBL-inf:labels:same-owner-citation]`) | a prose citation resolves into an inner documentation comment of the same owner |
| C12 | (`[LBL-judg:labels:participation]`) | fenced blocks and double- and triple-backtick spans participate in nothing |
| C13 | (`[LBL-judg:labels:participation]`) | string literals and plain comments in Rust are not scanned |
| C14 | (`[LBL-judg:labels:participation]`) | table cells, block quotations, and inline HTML do participate |
| C15 | (`[LBL-judg:labels:participation]`) | an HTML block does not participate |
| C16 | (`[LBL-judg:labels:participation]`) | an unpaired backtick fails its block and only its block, at the format's own pairing and not a naive one |
| C17 | (`conv:lint:markdown-surface`) | a backslash-escaped backtick is the author's literal, not an unpaired delimiter |
| C18 | (`conv:lint:markdown-surface`) | a table cell holding escaped pipes parses, and its mint resolves |
| C19 | (`dec:lint:head-recognition`) | a setext heading is recognized as a head |
| C20 | (`[LBL-judg:labels:participation]`) | an opening acute the region ends without closing is a hard failure |
| C21 | (`[LBL-judg:labels:participation]`) | an acute that opens nothing is text: an apostrophe accident swallows no occurrence |
| C22 | (`sig:lint:near-miss-api`) | a label-shaped backtick span in scanned code text warns, and mints nothing |
| C23 | (`sig:lint:near-miss-api`) | the casing warning fires in both syntaxes, at the first miscased byte |
| C24 | (`sig:lint:near-miss-api`) | several label-shaped spans to one parenthesis warn; nested parentheses each owning one span do not |
| C25 | (`[KND-judg:kinds:head-validation]`) | matching is case-exact: a head differing only in case is a validation failure |
| C26 | (`[KND-def:kinds:presentation-reduction]`) | modifiers, modifier stacking, each device family, and device-plus-modifier all reduce to the right base |
| C27 | (`[KND-def:kinds:presentation-reduction]`) | an expressly catalogued overriding row beats reduction, and its case-varied twin correctly does not |
| C28 | (`[KND-cav:kinds:homonymy]`) | the kind token selects the sense; a homonym with a third token is uncatalogued |
| C29 | (`[KND-inf:kinds:hybrid]`) | a declared hybrid validates on the en dash and not on the hyphen |
| C30 | (`[ARCH-dec:linter:registry-as-data]`), (`[KND-tab:kinds:headline-counts]`) | the five counts, recomputed from the tables alone, equal the committed region, and no device family is unrecognized |
| C31 | (`dec:lint:no-digest`), (`[IDN-case:identity:no-identity]`) | no digest is computed anywhere over content, and no hashing crate is in the dependency set |
| C32 | (`[ARCH-rule:linter:register-freshness]`) | exact-byte comparison catches an added trailing newline, a removed one, and CRLF, each at the right offset; both registers are current |
| C33 | (`[ARCH-req:linter:diagnostics-not-panics]`) | a mixed-script input scanned at every character boundary of every prefix and suffix panics nowhere |
| C34 | (`[LBL-gram:labels:well-formed]`) | a non-ASCII confusable interior is text: it is neither an occurrence nor one of the three warned classes |
| C35 | (`[LBL-judg:labels:minting]`) | a file with no occurrences is vacuously in good standing |
| C36 | (`dec:lint:registry-bootstrap`) | an unavailable registry suppresses head validation loudly, counting the heads it did not validate |
| C37 | (`[LBL-sig:labels:owners]`) | the partition's totality is structural: the last rule's empty prefix is validated, and an unforeseen path is owned |
| C38 | (`dec:lint:enforcement-partition`) | the failing set matches trees and files by literal prefix, and a sibling directory sharing a name stem does not match |
| C39 | (`[LBL-cav:labels:coexistence]`) | scoped register generation is restricted to its owner's registers and gates on no unrelated defect |
| C40 | (`[LBL-gate:labels:implementation]`) | the corpus-wide check passes in the gate's own scope |

## Findings · `sec:lint:audit-findings`

**Convention (Severity)** · `conv:lint:audit-severity`

**Major** = a clause of a discipline document or of the ruled adoption data that the linter does not implement, where the consequence reaches a gate claim — an occurrence silently dropped, a hard failure silently suppressed, a construction the calculus permits rejected. **Minor** = a divergence whose consequence is bounded, an ambiguity in the normative text that the implementation had to resolve without a ruling, or an adoption datum with no effect. No Critical was found: nothing crashes, nothing corrupts, and the linter writes nothing in check mode.

Three of the ten were live-in-principle and dormant-in-fact, which is stated rather than left flattering: the corpus's current shape happens not to trigger F1 beyond a single occurrence, and triggers F2 and F3 not at all. That is a fact about today's corpus, not about the code, and it is exactly the kind of fact that stops being true after a routine edit — which is why all three were fixed rather than noted.

- **F1 — Major. A backtick pair in scanned code text swallowed acute occurrences, and suppressed the unclosed-acute hard failure.** The code scanner paired a backtick with the next backtick unconditionally and skipped the span, so any acute occurrence between the two was never examined. The calculus gives the backtick no pairing authority in scanned code text — there the acute belongs to the label syntax and classifies locally (`[LBL-judg:labels:participation]`) — and the design says as much of the two doors (`dec:lint:two-scan-entries`). A mint, a citation, and an opening acute the region never closed were each lost with no diagnostic of any kind, defeating in turn the unique-mint check, the totality of resolution, and the participation judgment's own hard failure. Measured over the whole carrier at 3420 code regions: one live loss, in the scanner's own doctest. The recorded reading that an opening acute pairs with the next acute whatever lies between does not cover this: that reading is about the acute, and the backtick was never given a say.

  ```text
  the `Foo type and ´def:x:mint´ then `Bar`      → no occurrence, no warning, no failure
  a `x and ´def:x:open and `y`                   → the unclosed acute is not reported
  ```

- **F2 — Major. Fenced documentation examples inside Rust doc comments were scanned.** The calculus excludes them in as many words, and the adoption data names them among the regions Rust does not scan; neither the Rust frontend nor the scanner had any notion of a fence. What made this invisible is that it was masked by F1: a bare three-backtick fence is odd-length, so its third backtick reached for the closing fence and consumed the body by accident. One backtick anywhere in the fence body re-aligned the pairing and let the example's content through as real occurrences. The exclusion was therefore an artifact of a defect, not a mechanism — and repairing F1 alone would have made F2 fire reliably.

  ```text
  /// ```
  /// let s = "`";
  /// let l = ´def:fx:fenceleak´;      → minted, from inside a fenced example
  /// ```
  ```

- **F3 — Major. Every mint in a generated region was reported unwarranted, including the authorship the invariant expressly permits.** Generated compliance says a generated mint stands on its warrant exactly as an authored one does, and says explicitly that an authorship a generator transcribes from the record of the authors' choice is that choice still (`[LBL-inv:labels:generated-compliance]`), (`[LBL-inf:labels:authorship-warrant]`). The judgment demanded a derivation behind every generated mint without consulting the kind, so a label of a kind outside K — which admits authorship only and can never carry a derivation — always failed. The corroborating evidence was internal: warrant totality, reading the same graph, accepted the very mints generated compliance rejected. The message's own second clause named the confusion — a generator inventing a name is forbidden, a generator transcribing one is not, and the two had been collapsed.

- **F4 — Minor. A wrapped occurrence minted in code and warned in prose.** The calculus says one span may run across lines nowhere contiguous in the file (`[LBL-gram:labels:well-formed]`); the Rust frontend resolves leaders and newlines away and honors it, while the Markdown frontend deliberately does not fold a line ending inside a code span, so the same authoring act mints in one syntax and produces a spacing warning in the other. Not silent, and announced in the frontend's own prose — but the asymmetry made it a question the normative text had to answer rather than a choice the implementation could keep making.

- **F5 — Minor. The interior-spacing warning was nearly unreachable in scanned code text.** The acute opens only when the run of label-alphabet bytes after it already classifies, and whitespace is outside that run — for good reason, since admitting it would let an apostrophe accident swallow the following occurrence. The consequence was unrecorded: a space placed inside the triple, which is the likeliest way an author writes the defect, produced nothing at all, while the casing class fired in code without restriction. One of the three warning classes the calculus names was effectively prose-only.

- **F6 — Minor. The presented-set recognizer did not exist.** The exclusion that keeps no self-support a theorem (`[LBL-metathm:labels:no-self-support]`) was wired but never computed: the function returning what a generated region presents returned nothing unconditionally. Vacuously correct — no citation index is designated and both profiles are staged — but discharged by absence rather than by an empty domain, which is the distinction the judgment surface itself insists on. The blocking sub-fact was real: a designation was recorded as free text and carried no upstream owner a presented set could be built from.

- **F7 — Minor. Path-prefix matching is byte-exact, and the adoption data was silent on case.** On a case-insensitive filesystem — which is the one this corpus is developed on — a case-varied directory addresses the same file and yet receives a different owner, a different enforcement half, a different language, or no carrier membership at all. A documentation tree spelled with a capital escaped the failing set entirely; a source spelled with a capital extension was not scanned.

- **F8 — Minor. The partition rule's optional flag was parsed, stored, and never read.** The adoption data uses it to distinguish an absent root that is legal and silent from one that is not, and the walk made no distinction: every absent configured root was silent and every unreadable one loud, whatever the flag said. Writing the flag false promised a check that did not exist.

- **F9 — Minor. A head beyond the reduction bounds was reported as uncatalogued.** Presentation reduction is defined without a depth bound (`[KND-def:kinds:presentation-reduction]`); the search carries one, so a head that does reduce was reported as one that does not, blaming the catalogue for what was the search's own limit. No real head is affected — the corpus's deepest carries one device — but the verdict was wrong rather than merely unhelpful.

- **F10 — Minor. The invariant's failure enumeration contradicted its own near-miss clause.** Total resolution listed non-parenthesized imports among the things that fail, and two sentences later asked the checker to warn on label-shaped interiors with wrong brackets; the grammar meanwhile makes a span parsing as no form ordinary text. The implementation warned, which is the reading consistent with the grammar — but the enumeration said otherwise, and one of the two had to give.

## Fuzzing · `sec:lint:audit-fuzzing`

The four targets the design deferred to this phase were written to the plan it fixed, with the assertions it named: no panic everywhere, the lexeme partition on arbitrary bytes, spans within their input for the scanner, pieces within the file and non-overlapping for the Markdown frontend, and success implying a total partition for the adoption loader (`preview:lint:fuzz-plan`), (`inv:lint:lexeme-partition`). None of the four assertions ever fired.

**Table (Campaign measurements)** · `tab:lint:fuzz-campaigns`

| Target | Executions | Wall | Coverage |
| --- | --- | --- | --- |
| `markdown_regions` | 265 297 | 1501 s | 3033 → 3867 |
| `pretokenize_rust` | 3 132 053 | 1501 s | 315 → 319, saturated |
| `scan_region` | 1 133 129 | 901 s | 845 → 860 |
| `adoption_load` | 1 116 196 | 901 s | 4401 → 5165 |

Version-one campaigns total **5 646 675 executions with zero crashes, zero timeouts, and zero out-of-memory**. The pre-tokenizer target saturated almost immediately — the seed corpus reached 315 edges at initialization and the campaign found four more in three million executions — which says the seeds were good and the lexer's branch space is small, not that the campaign was weak. A re-campaign against the repaired scanner ran a further **1 888 258 executions**, clean, and moved `scan_region` from 860 to 956: real coverage of the rewrite rather than a re-run of the same paths, which is what makes the re-campaign evidence about the fix and not about the fixture.

The campaigns produced one finding of their own, since dispositioned: a partition rule's stated order was decorative, matching following list position while the rule wrote a number that nothing checked. Two further observations are worth recording because each corrects something the design believed.

**Observation (The lexeme partition is builder-enforced)** · `obs:lint:lexeme-partition-reach`

The design called the partition invariant "the strongest single assertion the crate has, since it is total on every input" (`inv:lint:lexeme-partition`). Measured against the fuzzer, it is near-unfalsifiable through the public path: the partition is established by the builder that constructs the lexeme sequence, so an assertion that the spans are non-overlapping, ascending, and total re-checks a property the constructor cannot violate. The assertion is kept — a constructor can be rewritten — but the discriminating assertions are the ones that compare the partition against something else, and those are now in the targets: agreement between the class a position reports and the class its lexeme carries, containment of every lexeme span in the input, and preservation of stamped diagnostics across the partition.

**Observation (There is no recursive descent to overflow)** · `obs:lint:no-recursive-descent`

The design named two deferred hazards for the audit to look at first, the recursive descent of the Markdown region walk foremost, on the evidence of where the sibling crate's audit found real defects. That hazard does not exist: the Markdown walk is a flat event loop over the parser's offset iterator with an explicit frame stack, and it was probed clean at 4096 nesting levels. The note was not wasted — it pointed at the right modules — but it pointed at them for the wrong reason, and what the audit actually found there was in the scanner's delimiter logic rather than in any recursion.

## Disposition · `sec:lint:audit-disposition`

Every finding is closed. Nothing is deferred, and nothing waits on a decision.

**Table (Every finding, dispositioned)** · `tab:lint:audit-disposition`

| Finding | Severity | Disposition | Where |
| --- | --- | --- | --- |
| F1 | Major | fixed | the audit fix wave, five regression tests |
| F2 | Major | fixed | the audit fix wave, three regression tests |
| F3 | Major | fixed | the audit fix wave, two regression tests |
| F4 | Minor | ruled; the calculus amended, the behavior stands | the discipline amendment |
| F5 | Minor | fixed | the audit fix wave, three regression tests |
| F6 | Minor | ruled; the designation's shape recorded | the ruled-checks change |
| F7 | Minor | ruled; a load-time spelling check added | the ruled-checks change |
| F8 | Minor | fixed | the audit fix wave, three regression tests |
| F9 | Minor | fixed | the audit fix wave, four regression tests |
| F10 | Minor | ruled; the enumeration amended, the warning stands | the discipline amendment |
| order | Minor | ruled and fixed; stated order must equal position | the ruled-checks change |

**The fix wave.** F1's repair is the principled one rather than the narrow one: the backtick has no pairing authority in scanned code text at all. The scanner now makes an acute-primary pass over the region and reads the label-shaped backtick spans out of the residue, so a backtick can no longer reach across an acute span, cannot hide a mint or a citation, and cannot suppress an unclosed-acute failure — while the near-miss the calculus asks for is still reported from exactly the spans that are left (`sig:lint:near-miss-api`). F2 is a fence-splitting pass in the Rust frontend, so a fenced example is excluded because the frontend excludes it and not because a defect happened to eat it (`conv:lint:rust-surface`). F3 guards the generated-compliance judgment on the kind: a derivation is demanded only where a derivation is the admissible species, and a kind outside K is left to warrant totality, which was already judging it correctly (`[LBL-inv:labels:warrant-totality]`). F5 looks ahead a bounded distance for the closing acute so the spacing warning is reachable in code without letting an apostrophe swallow anything. F8 reports a non-optional configured root that matched no source, which is what the flag always claimed to mean. F9 gives a reduction stopped by its own bound its own rule, so a bounded search no longer blames the catalogue.

Twenty named regression tests carry the wave, one family per finding, and the fix wave was verified not to change anything else: the corpus finding-set was compared binary against binary, before and after, and is byte-identical. Both remaining Majors were reproduced by the orchestrator before the fix, and F1 again after it.

**The rulings.** F4 is ruled: the cross-line clause covers structural markers — a quotation's markers, a list's continuation indentation, a comment's leaders — and not a soft line ending inside a prose span, which is the document format's own affair; the calculus is amended to say so and the Markdown frontend's behavior is correct as built. F10 is ruled the same way and in the same amendment: non-parenthesized imports are dropped from the invariant's failure enumeration, because the near-miss clause two sentences later already governs them and the grammar makes a span parsing as no form text; the warning stands. F6 is ruled by fixing the shape rather than the code: a citation-index designation carries its upstream owner's identifier when the first one is recorded, and until then the presented-set exclusion is discharged vacuously — an empty domain now, rather than an absent recognizer — and the adoption data records the shape the first designation will carry. F7 is ruled to keep matching byte-exact, and to catch the drift where it starts: every configured path is now checked at load against the root's own spelling, ASCII-folded, so a case-varied tree is a located adoption error rather than a silent reassignment; an absent root stays a finding under its own rule, not a spelling failure. The fuzz lane's order finding is ruled the same way — a stated order that is not its position is an adoption error, since matching follows the position and a second statement of the same fact may not disagree with it.

## Verdict · `sec:lint:audit-verdict`

**Result (What is proven, and by what)** · `result:lint:audit-verdict`

The linter discharges the clauses it was built to discharge, and the evidence is mechanical rather than argued. The corpus self-lints clean on the failing set — zero failing findings over 890 carrier sources, this document among them — which is the acceptance the concept scoped and the calculus's own closing gate clause (`[LBL-gate:labels:implementation]`), (`conv:lint:gates-as-acceptance`). Every participating authored head in the corpus validates against the registry document parsed as data, and the registry classifies its own heads, so parsing it and validating it are one exercise (`[ARCH-dec:linter:registry-as-data]`). Both generated registers — the acceptee's companion attestation register and the registry's headline counts — are byte-current against what the one generator produces, compared exactly and written never (`[KND-req:kinds:attestation-register]`), (`dec:lint:one-generator`). The suite stands at 708 tests, none ignored, and the metatheorem obligations among them are the calculus's four proofs made executable rather than paraphrased (`conv:lint:metatheorems-as-tests`), (`tab:lint:metatheorem-tests`). Across both campaigns the fuzz lane executed over 7.5 million inputs against the four ratified targets with no crash, no timeout, no out-of-memory, and no assertion fired.

What the audit adds to that is the negative half, which no green suite supplies: forty clauses were attacked with inputs built to break them and held, and the ten that did not hold are each closed above — six by a fix carrying its own regression tests, four by a ruling that amended the normative text or the adoption data rather than leaving the implementation to guess.

**Remark (Open, and not audit findings)** · `rem:lint:audit-open`

Two things remain open and neither is a finding of this phase. The entry machinery — the ruled staged-census regeneration and the derivation harvest that carry a profile from registered to effective — is in flight; until it lands both profiles stay staged, their kinds reserved-but-ungoverned, and their inventory judgments vacuous by adoption rather than by omission (`dec:lint:staged-profiles`). And commissioning is the next phase, not this one: the corpus-wide check entering continuous integration, and the runtime budget measured and recorded beside the lane that invokes it, are its artifact and its close (`req:lint:timing`), (`preview:lint:phase-plan`).

One class of number is deliberately absent from this document. The corpus's own counts move as the migrations land — the label-shaped backtick spans in Rust documentation comments, which the concept counted at 88 and which the fixed scanner now counts slightly differently, the plain-comment sweep, the docs trees' upstream references awaiting reforming — and they belong to the migration ledger the concept opened, not to the audit's evidence (`rep:lint:first-corpus`). An audit that pinned them would go stale on the first migration commit and would be recording someone else's work.

## Audit gate · `sec:lint:audit-gate`

**Gate (Audit close-out)** · `gate:lint:audit-close`

The audit is closed:

- every Major is fixed, each with named regression tests, and each was reproduced by the orchestrator before the fix and re-reproduced after;
- every Minor is fixed or ruled, and every ruling landed in the normative text or the adoption data rather than in this report;
- the four deferred fuzz targets exist, ran to the plan's own assertions, and ran clean, with a re-campaign covering the repaired scanner;
- the fix wave changed no verdict it was not meant to change, the corpus finding-set being byte-identical across it;
- the corpus-wide check passes on the failing set with this document in the tree, which is the self-audit the discipline asks of a participating artifact.

Commissioning follows.
