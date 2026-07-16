# Platform guidelines

The normative document the Network references when classifying
content via the [moderation](moderation.md) primitive. Three
buckets — `illegal`, `sensitive`, `normal` — backed by the same
Proposal mechanism that powers the rest of the platform: the
guidelines themselves are amendable by the Network at any time.

This doc is the **canonical text**. Its current version is pinned
by two governed `:Network` properties (version number + content
hash), and each ratified version's text is anchored on L1 as a
platform document — a publisher-authored Content node carrying
the document as witnessed payload
([substrate.md §8](../primitive/substrate.md#8-system-actors)).
The working copy lives here, in the repo.

## 1. The three buckets

The classification a Network member assigns when authoring or
voting on a moderation Proposal is one of `illegal`, `sensitive`,
or `normal`. Bucket meanings and behavioural consequences
(redaction cascade, viewer filter, reversibility) live with the
moderation machinery — see
[moderation.md §1](moderation.md#1-the-two-classification-paths).
What follows is the platform policy: which content the Network
puts in each bucket. The Network amends these lists via §3.

### `illegal`

Starter list — adapted from the conventions of established
public platforms:

- **Child sexual abuse material (CSAM).** Always, everywhere.
  The archive copy enters on the standard placeholder hold;
  `legal_admin` reports to authorities and schedules immediate
  hard-delete at case review — the legal hold is "report and
  destroy", not "retain for prosecution" (per
  [retention-archive.md](../primitive/retention-archive.md)).
- **Credible threats of violence** against a person, group, or
  identifiable target.
- **Incitement to violence** — calls to commit violent acts,
  glorification of mass-casualty events tied to designated
  terrorist organizations, recruitment for the same.
- **Non-consensual intimate imagery** (NCII / "revenge porn") —
  sexual or nude imagery shared without the subject's consent.
- **Doxxing** — unauthorized publication of private personal
  information (home address, phone, government ID, financial
  account numbers) outing an identifiable individual.
- **Trafficking** — content offering, soliciting, or coordinating
  trafficking in humans, controlled substances at scale,
  weapons-of-war, or trafficked wildlife.
- **Fraud and scams** — phishing, account-takeover marketplaces,
  fraudulent financial schemes, sale of stolen credentials.
- **Sale of strictly-controlled goods** — schedule-I narcotics,
  unregistered firearms, regulated chemicals outside legal
  channels. (Legal grey-zone goods — e.g. firearms in
  jurisdictions where private sale is permitted — are out of
  scope for `illegal` and may or may not be `sensitive`
  depending on context.)
- **Copyright infringement at scale** — wholesale republication
  of copyrighted works against an explicit removal request.

### `sensitive`

Starter list:

- **Graphic violence** — real-world injury, gore, accident
  footage, war footage with visible casualties.
- **Adult nudity and sexual content** that is consensual, lawful,
  and clearly intended for adult audiences.
- **Self-harm and suicide** — depictions, methods, in-progress
  imagery; non-supportive discussion.
- **Disturbing medical imagery** — surgery, severe injury,
  pathology.
- **Animal cruelty depictions** — including hunting and
  slaughter imagery that is not itself illegal.
- **Drug use depictions** — recreational use of legal or illegal
  substances depicted approvingly.
- **Strongly disturbing material** that doesn't fit a category
  above but a reasonable Network member would expect a viewing user
  filter to apply (e.g. detailed descriptions of torture).

### `normal`

Not a list. The default state for content that hasn't been
classified into either of the above buckets.

## 2. Jurisdiction

CoGra is one Network per instance. Each instance's Network sets
its own normative line via the amendment procedure (§3), and
will arrive at different rest-points depending on its
jurisdiction and community.

The list above is a starting point for the central instance. A
fork operating under a different legal regime is expected to
amend in either direction — adding categories required locally
(e.g. specific political speech restrictions) or removing
categories not applicable.

The `illegal` bucket is **not** a literal application of any
single jurisdiction's law. It is a community standard. A piece
of content can be lawful in some jurisdictions and still
classified `illegal` by the Network if the Network's normative
judgment lands there; conversely, content that is unlawful in
some jurisdictions may remain `normal` if the Network has not
classified it.

The legal-hold disposition for `illegal` content
([retention-archive.md](../primitive/retention-archive.md))
*does* track jurisdictional law — that is a per-row decision
made by `legal_admin` at case review, separate from the
classification decision.

## 3. Amendment procedure

The guidelines are amendable via the same Proposal primitive that
governs everything else on the platform.

**Subject.** Two governed `:Network` properties move together as
the canonical pointer to a guidelines version:

- `Network.guidelines_version` — monotonic integer, incremented
  by 1 on each amendment.
- `Network.guidelines_hash` — SHA-256 hex digest of the canonical
  document bytes at that version.

A guidelines amendment is a single Proposal that sets both
properties to the new version's values atomically — one vote
covers the pair, since a version without its hash (or vice versa)
is meaningless. Like every `:Network` parameter change, the passed
amendment is finalized onto the network charter's L1 anchor, so
the version schedule is replayable from public records
([network.md](../primitive/network.md)); the ratified text itself
is anchored as a platform document (witnessed payload).

**Eligibility.** All active Network members
([network.md](../primitive/network.md)).

**Vote shape.** L1 ballots — payload-marked Opinions toward the
Proposal's anchor — same as moderation Proposals
([governance.md](../primitive/governance.md)).

**Tally.** Petition-style — only positive votes contribute. See
[governance.md §3 "Petition-style tally and dual quorum"](../primitive/governance.md#petition-style-tally-and-dual-quorum-network-scope-only).

**Dual-quorum bars.** A guidelines-amendment Proposal passes when
`positive_count ≥ min(P × |active members|, K)`:

| Action | `P` (`*_quorum_fraction`) | `K` (`*_quorum_count`) | Mod gate |
|---|---|---|---|
| Amend guidelines | `Network.guidelines_change_quorum_fraction` (default `0.50`) | `Network.guidelines_change_quorum_count` (default `10000`) | critical tier: ⌈`critical_mod_gate_fraction` · \|active mods\|⌉ |

The defaults are tuned higher than single-content classification
because guideline changes shift the normative frame for *all
future* moderation, not a single piece of content. The
`guidelines_change_*` parameters themselves fall in the critical
bucket of
[network.md §11](../primitive/network.md#11-amending-network-parameters)
— amending them requires the higher fractional / absolute pair
that protects platform-wide governance.

**Mod gate.** Guidelines amendments shift the normative frame for
all future moderation, so they sit at the **critical tier** of the
mod-gate: positive moderator votes `≥ ⌈Network.critical_mod_gate_fraction
· |active mods|⌉`, not a single vote. Same bot-defense reasoning as
[governance.md §7](../primitive/governance.md#7-the-mod-gate).

**Drafting and discussion.** The Proposal carries the new version
number and hash. The actual text — the diff against the previous
version — is published (e.g. the repo's pull request) prior to
the vote so members can review what they are voting on. Voters
who cast `+1` without reviewing operate on the same normative
honor system as moderators voting on encrypted Messages
([moderation.md "Encrypted message classification"](moderation.md#encrypted-message-classification)),
addressable through the same Proposal mechanism applied to that
user's role.

## 4. URL handling

The platform deliberately does **not** pin a URL pointing at this
document. Different instances serve under different domains; each
instance's frontend constructs the canonical URL from its own
domain configuration
(`https://<instance-domain>/guidelines` or whatever the
instance's deployment chooses).

The hash is the integrity anchor: a client can verify the served
document matches the version the Network ratified, regardless of
how the URL is composed — and the ratified bytes themselves are
witnessed on the shared graph via the platform-document anchor.

## 5. License and provenance obligations

Every content node carries license qualifiers, set by the
creating actor when the node enters the graph and immutable
thereafter: **attribution** `a ∈ {0, 1}` (credit requirement) and
**oversight** `o ∈ {0, 0.5, 1}` (AI provenance). They are
content-governance metadata of the Publish record
(`def:content:license-qualifiers`); no L1 formula consumes
them — enforcement is explicitly CoGra's responsibility
([layer1-interface.md §10](../primitive/layer1-interface.md#10-content-governance-metadata-pn-full-9-seccontent--full-paper-only)).
CoGra enforces them through four planks:

1. **Declaration is mandatory at authoring time.** Every
   content-creation flow requires the qualifiers before the
   record is submitted — an L2 write-validation rule, same class
   as envelope conformance
   ([substrate.md §7](../primitive/substrate.md#7-payload-carriage)).
2. **Render obligations.** `a = 1` ⇒ the creator is credited on
   every display, quote, and reference surface. `o ≥ 0.5` ⇒ an
   AI-involvement badge on every render; `o = 0.5` ⇒ generation
   details are disclosed on query; `o = 1` ⇒ the full provenance
   chain is published alongside the record.
3. **Violations are a guidelines category.** Uncredited reuse of
   `a = 1` content and undisclosed AI generation ride the
   ordinary report → Proposal → moderation path (§1,
   [moderation.md §2](moderation.md#2-reports--proposals-on-the-graph))
   — classified and marked like any other guidelines violation.
4. **The provenance-chain format is a versioned, reserved field**
   in CoGra's published payload-format spec. The full chain
   format is deferred until the AI-provenance workstream needs
   it; the reservation keeps old records forward-readable.

## What this doc is not

- **Not the moderation mechanism.** Reports, voting, the mod
  gate, the cascade — all in
  [moderation.md](moderation.md).
- **Not the legal-hold disposition.** Per-row legal hold for
  `illegal` originals is in
  [retention-archive.md](../primitive/retention-archive.md).
- **Not a substitute for jurisdictional legal review.** The
  Network's classification is a community standard; `legal_admin`
  still reviews legal-hold disposition per row.
- **Not exhaustive.** The starter lists in §1 are seed text. The
  Network amends them via §3 as the platform evolves.
