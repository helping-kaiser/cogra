# The Interchange Crate — Concept

_Phase 1 of the standard engineering process: concept. Review closes this phase; the design candidate follows._

This document is the concept for the first-party CBOR and CDDL library ruled into existence by the linter architecture (`[ARCH-dec:linter:interchange-first-party]`): one crate implementing the interchange conventions, serving every CBOR and CDDL use in the entire project. It states why the crate exists, who consumes it, what it must do — with every requirement traced to the conventions document that defines it — what it will not do, how it will be verified, and what the phases ahead look like. It is deliberately the first target of the engineering process: small, fully specified by an adopted discipline document, and therefore the right vehicle for establishing the repository's Rust development practices before the larger linter is built. The crate is `crates/cogra-interchange`. This document decides nothing the architecture has not already decided; the concept review's rulings are recorded in place.

The document practices the labeling discipline: the label at each heading or environment head is that environment's mint; a parenthesized label in running text is a same-owner citation; material in fenced blocks and double-backtick spans is displayed without participating. Every label minted here has area `xchg`; the document title mints nothing. Imported citations use the provisional prefixes of the architecture document: `ICX` for the interchange conventions, `ARCH` for the linter architecture.

## Purpose · `sec:xchg:purpose`

**Formulation (Purpose)** · `formul:xchg:purpose`

The project needs exactly one implementation of the interchange conventions — the deterministic CBOR data language, the envelope, namespace labels, versions, theories, and acceptance — so that every producer and consumer of interchange documents in the repository shares one notion of canonical bytes and one verdict function. The conventions are a small, constrained domain, fully specified in one adopted document with its metatheory already proved on paper; implementing them first-party removes a third-party dependency surface from a layer where byte-exactness is the entire point, and the crate's size makes it the process shakedown: concept, design, review, implementation, audit, and commissioning are exercised end to end here before the linter project runs them at scale.

**Signature (Consumers)** · `sig:xchg:consumers`

Known consumers, present and planned: the corpus linter, which consumes the crate for envelope validation when that slice opens (`[ARCH-formul:linter:charter]`); the backend crates, wherever interchange documents travel on the L1 seam or between services; and the crate's own test suite, which is a consumer by design — the metatheorems of the conventions become executable obligations (`conv:xchg:metatheorems-as-tests`). No consumer outside this repository exists or is planned; the crate is workspace-internal until a recorded decision says otherwise.

## Requirements · `sec:xchg:requirements`

**Table (Functional requirements)** · `tab:xchg:functional`

Each requirement is the conventions' own; the trace column is normative — a requirement with no trace is a defect of this table.

| # | Requirement | Trace |
| --- | --- | --- |
| R1 | Encode and decode the canonical data language: preferred serialization, no indefinite lengths, sorted distinct map keys; membership exact — non-canonical bytes are refused as no document at all, never repaired | (`[ICX-lang:interchange:data-language]`) |
| R2 | Model the document envelope: unsigned-integer keys, key 0 namespace label, key 1 version, open content above key 1 | (`[ICX-lang:interchange:data-language]`) |
| R3 | Validate namespace labels by the ABNF — atoms over `a`–`z`, `0`–`9`, interior hyphens, n ≥ 2, at most 255 bytes | (`[ICX-gram:interchange:label-grammar]`) |
| R4 | Represent versions as ordered triples with the targeting/stamping distinction available to emitters | (`[ICX-def:interchange:versions]`) |
| R5 | Provide the base theory and satisfaction against it | (`[ICX-schema:interchange:global]`), (`[ICX-judg:interchange:satisfaction]`) |
| R6 | Parse CDDL and check membership in the assignable fragment: envelope pinned, content keys literal uints greater than 1, closed | (`[ICX-gram:interchange:assignable-fragment]`) |
| R7 | Check the minor-inclusion regime key by key: shared keys identical in type and requiredness, new keys optional | (`[ICX-inv:interchange:minor-inclusion]`) |
| R8 | Derive the open companion of any assigned theory — freed minor, wildcard closure, nothing else moved | (`[ICX-def:interchange:open-companion]`) |
| R9 | Model the registry: partial map from (label, major, minor) to immutable theory objects, minors assigned in order, downward-closed holding | (`[ICX-sig:interchange:theory-assignment]`), (`[ICX-inv:interchange:permanence]`) |
| R10 | Implement acceptance: strict verdict at held stamps, rejection for checkably false stamps, tolerant verdict above the ceiling, rejection whole for unheld majors — decidable from the bounded envelope prefix | (`[ICX-def:interchange:acceptance]`), (`[ICX-metathm:interchange:bounded-determination]`) |
| R11 | Implement the `.regexp` control operator with the chosen regex library, per the signed exception, with the XSD-flavor verification duty discharged and documented | (`[ARCH-dec:linter:cddl-regexp-library]`) |
| R12 | Enforce restraint: floats, tags, and non-trivial simple values admitted only by explicit theory provision | (`[ICX-inv:interchange:restraint]`) |

**Requirement (Workspace discipline)** · `req:xchg:workspace-discipline`

The crate obeys every standing repository rule: `cargo fmt`, `clippy -D warnings`, no `unwrap` in library code, `thiserror` for the error surface, no SQL, and — trivially, since the domain has no graphs — nothing that would touch the petgraph rule (`[ARCH-dec:linter:petgraph-first-class]`). Dependencies are minimal and individually justified in the design candidate: the CBOR core and the CDDL parser are written first-party per the ruling (`[ARCH-dec:linter:interchange-first-party]`), tokenizing without regex (`[ARCH-dec:linter:no-regex]`); the regex library of R11 is the one signed exception; and anything beyond the error crate and that library needs its own argument.

**Requirement (std only)** · `req:xchg:std-only`

Version 1 targets std only; no `no_std` engineering. The known consumers are workspace services and the linter. If interchange documents ever travel to constrained targets — on-device via UniFFI, as the ranker plans — `no_std` support becomes a recorded revision with its own design pass, cheaper then than speculative generality now.

**Requirement (Determinism as an API property)** · `req:xchg:determinism`

The API makes non-determinism unrepresentable rather than checked-for: encoding takes typed values and can only emit canonical bytes; decoding refuses non-canonical input at the door, so downstream code never holds a non-canonical document. Byte equality of encodings is equality of structures, and the crate's public surface preserves that property everywhere (`[ICX-metathm:interchange:unique-names]`).

## Scope boundary · `sec:xchg:scope`

**Convention (Out of scope)** · `conv:xchg:out-of-scope`

The crate implements the conventions and nothing around them: no transport, no storage, no signing or key handling, no schema-authoring tooling, and no governance — allocation of namespaces and the maintenance of published registry material are the owner's obligations, outside the logic (`[ICX-cav:interchange:governance-obligations]`); the crate only models the registry state it is given. Digests appear nowhere in v1: any future content-addressing proposal walks the identity discipline's adjudication first (`[ARCH-formul:linter:charter]`).

## Verification · `sec:xchg:verification`

**Convention (Metatheorems as test obligations)** · `conv:xchg:metatheorems-as-tests`

The conventions ship their own metatheory, and the crate treats each metatheorem as an executable obligation: unique names becomes an encode–decode–encode roundtrip property over generated structures; one spelling, one encoding becomes a label-encoding property; bounded determination becomes a test that acceptance verdicts are computed from at most the 296-byte prefix and the held state, with the tail unread; conservativity and forward compatibility become properties over generated minor chains — documents conforming at a later minor validated tolerantly at every earlier floor; acceptance monotonicity becomes a property over growing registry states. RFC 8949 §4.2 and RFC 8610 supply concrete vectors for the encoders and the CDDL parser. Property testing and fuzzing of the decoder boundary are audit-phase obligations, sized in the design candidate.

## Phases · `sec:xchg:phases`

**Roadmap (Phase plan)** · `preview:xchg:phase-plan`

The standard engineering process, instantiated for this crate — each phase closes on an explicit artifact, and the next does not start until the previous closes:

| Phase | Artifact that closes it | Closed by |
| --- | --- | --- |
| Concept | this document | review ruling |
| Design candidate | design.md: public API surface, module map, error taxonomy, dependency justifications, test plan sized | review ruling |
| Review | rulings recorded into design.md; open questions emptied | the human |
| Implementation | the crate, tests green, `make ci` green | gate of the design |
| Audit | adversarial review + fuzz/property results, findings dispositioned | audit report |
| Commissioning | consumed in anger by its first real consumer; CI lane and budget recorded | commissioning note |

The process itself is a deliverable: the repository-wide template lives at [docs/implementation/engineering-process.md](../../../docs/implementation/engineering-process.md), and what these phases teach — artifact shapes, review cadence, worker-dispatch patterns — feeds back into it before the linter project runs the process at scale.

## Concept gate · `sec:xchg:gate`

**Gate (Concept review)** · `gate:xchg:concept-review`

The design-candidate phase is blocked until all of the following hold:

- the purpose and consumer set (`formul:xchg:purpose`), (`sig:xchg:consumers`) are confirmed;
- the requirements (`tab:xchg:functional`), (`req:xchg:workspace-discipline`), (`req:xchg:std-only`), (`req:xchg:determinism`) are confirmed complete against the conventions document, or amended;
- the scope boundary (`conv:xchg:out-of-scope`) is confirmed;
- the verification approach (`conv:xchg:metatheorems-as-tests`) is confirmed as the test plan's frame.
