# Proposal

The **Proposal** is the carrier of a governance decision. Its
public face lives on PeerNetworks Layer 1 as three kinds of
records — the **anchor**, the **ballots**, and the
**finalization** — and its operational state lives in CoGra's
overlay
([substrate-map.md §5](../primitive/substrate-map.md#5-governance-and-moderation)):

- **Anchor** — a proposer-authored Content node whose witnessed
  payload carries the proposal text and machine-readable terms,
  plus a `(0,0)` Reference from the anchor to the subject node.
- **Ballots** — payload-marked Opinions toward the anchor
  ([governance.md §3](../primitive/governance.md#3-the-ballot)).
- **Finalization** — the executing authority's Opinion `(0,0)` +
  payload (outcome, tally digest) toward the anchor.

Everything a decision binds is therefore replayable from public
records plus CoGra's published tally formula. The **governance
mechanics** — eligibility, weight functions, threshold policies,
outcome semantics — live in
[governance.md](../primitive/governance.md); this doc describes
the carrier.

---

## 1. Creation

Any actor eligible for the governance instance the Proposal serves
can author one
([governance.md §2.2](../primitive/governance.md#22-eligibility)).
There is no second-party approval flow: the proposer's own acts
bring the Proposal into being, priced like every L1 act
(proposer-pays).

The opening gesture comprises:

- **The anchor** — the proposer publishes a Content node; the
  Publish record's genesis fixes the proposer as `creator`
  ([nodes.md](../primitive/nodes.md)). The proposal text and terms
  (§2) ride the anchor as witnessed payload in the Peer Content
  Envelope ([substrate.md §7](../primitive/substrate.md#7-payload-carriage)).
- **The subject Reference** — a `(0,0)` Reference from the anchor
  to the subject node. Undefined parity, `w̃ = 0`, never vouches
  (`rem:graph:zero-parameter-degeneracy`) — pure public naming.
  Subjects within a scope (a chat member, a collective member)
  are named by the member's **Profile**, with the scope in the
  payload; overlay-only targets are named through their owning
  entity's L1 node
  ([governance.md §2.1](../primitive/governance.md#21-subject)).
- **The proposer's ballot** — the anchor's genesis is a Publish
  record, and Publish and Opinion never share a bundle, so
  **authoring is never read as a vote**. The client flow bakes the
  proposer's explicit `+1` ballot immediately after creation — one
  more priced act.
- **The overlay Proposal node** — written by the backend in the
  same flow: CoGra's operational carrier for tally state and
  dispatch (§3).

A Proposal cannot be re-targeted and its terms cannot be revised:
both folds read only the opening gesture's records (§2). A
revised change is a new Proposal.

---

## 2. Terms

The anchor payload carries the proposal's full substance —
human-readable text plus the machine-readable terms CoGra's
dispatcher executes. The term fields, in the envelope's guild
keyspace:

- **`action_key`** — which governance instance this Proposal runs
  under; selects the frozen Rule at the rule host
  ([governance.md §2.6](../primitive/governance.md#26-packaging-rules-on-a-node--the-governance-map-convention)).
- **Target designation** — the subject is named publicly by the
  anchor's Reference; where the governed state is finer than a
  node (a named parameter, a rule entry, an overlay property), the
  payload names it.
- **`proposed_value`** — the value to set if the Proposal passes.
- **`value_kind`** — discriminator on the shape of
  `proposed_value`, consumed by frontends to render the right
  editor without out-of-band knowledge:
  - `'scalar:string'` — role strings, classifications, names.
  - `'scalar:float'` — quorum fractions, `ownership_pct`, shares.
  - `'scalar:integer'` — absolute counts, epoch windows.
  - `'rule'` — a `Rule` object (paired `exec` + `amend` triples)
    for a `governance[action_key]` entry.
  - `'composite:<action_key>'` — a handler-specific structured
    bundle covering multiple values, applied atomically
    (below).

**The terms are the genesis Publish payload.** The payload is
committed at the anchor's landing, and the terms fold reads the
genesis record alone: a later Publish toward the anchor — legal,
and elsewhere the ordinary revise gesture
([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates))
— is fold-ignored here. The proposal anchor is that rule's one
named exception, because people voted on that exact text; an L2
rendering "the anchor's newest Publish payload" would show its
voters an amendment nobody voted on. The subject reads the same
way: the anchor's subject Reference is the opening gesture's
`(0,0)` Reference (§1), and later References from the anchor are
fold-ignored. The **rule snapshot** shares the same ruler —
tally and execution read the governing Rule as-of the anchor's
landing epoch
([governance.md §5](../primitive/governance.md#rule-snapshot-at-author-time)).

### Composite proposals

A composite Proposal carries a structured `proposed_value` bundle
that atomically changes several values — usually across several
carriers that together encode one invariant. The canonical case is
shareholder admission: creating the new collective-membership
junction with N% stake and reducing existing shareholders'
`ownership_pct` so the 100% total holds; either change passing
alone would break the invariant.

Three conventions hold across every composite kind:

1. **The anchor's Reference points at the owning entity** — for
   collective-internal composites, the collective's Profile; the
   bundle inside `proposed_value` carries the per-target
   specifics.
2. **Bundle entries carry `_from` and `_to` for every value being
   changed.** At the crossing epoch the dispatcher re-validates by
   checking each affected value's state as-of that epoch equals
   the entry's `_from`. Any mismatch — typically drift between
   author time and crossing — refuses execution; the Proposal
   records a terminal `passed_but_invariant_rejected` outcome and
   a fresh Proposal with refreshed numbers is needed.
   Straightforward compare-and-swap; voters see exactly what's
   being asserted about current state.
3. **Per-`action_key` handlers own bundle shape, author-time
   validation, and the execution transaction.** The primitive
   doesn't enumerate composite shapes — each application doc
   declares its own action keys
   ([collectives.md §8](collectives.md#6-the-social-contract)).

### Moderation of proposal content

The proposal text is user-authored content and reportable like any
other: a moderation Proposal names this Proposal's **anchor** as
its subject and runs the Network-scope flow in
[moderation.md](moderation.md). A passing `'illegal'`
classification removes the anchor's payload — the standard
whole-record reduction with its visible mark
([layers.md §5](../primitive/layers.md#5-deletion-policy)). A
still-`'open'` Proposal thereby transitions terminally to
`'redacted'` (§6): its terms are gone, so it can never execute.
The ballots already cast remain on record.

---

## 3. Overlay and Postgres state

The overlay Proposal node is CoGra's operational carrier: the
`status` cache, per-epoch tally state, and dispatch bookkeeping
the backend and frontends read without recomputing from the
mirror. It is a cache over public records plus published policy —
nothing on it is authoritative
([substrate.md §3](../primitive/substrate.md#3-cogras-stores)).

Postgres holds what CoGra **carries**, not a second substance:
the anchor payload's bytes — proposal text and terms — live in
CoGra's stores under the carriage model (payload + salt,
[substrate.md §7](../primitive/substrate.md#7-payload-carriage)),
and where a proposed value concerns display content (a chat
description, a profile field), the value is Postgres-side data
with no graph home at all. Layer 1 holds only the **witness**;
where the bytes sit — Postgres, blob, overlay — is invisible to
it, and nothing CoGra-side is authoritative over the witnessed
bytes. The platform-guidelines amendment
([platform-guidelines.md §3](platform-guidelines.md#3-amendment-procedure))
is the one application where understanding the change requires
off-graph text (the new guidelines version, published in the
repo); even there, only the version number and SHA-256 hash ride
in the terms.

---

## 4. Ballots and references

**Ballots** are payload-marked Opinions toward the anchor —
mechanics, direction semantics, latest-ballot rule, and the
petition arithmetic all in
[governance.md §3](../primitive/governance.md#3-the-ballot). The
ballot marker keeps them distinct from **organic stances**: an
unmarked Opinion toward the anchor is ordinary sentiment about the
proposal and never enters any tally, even though both live in the
same author bundle on L1.

**References** to the anchor are ordinary graph fabric: a Post
campaigning for support, a Comment citing the proposal in debate,
a Message surfacing it for a chat — each an L1 Reference whose
legs traverse at their real `w̃`
([feed-ranking.md](../primitive/feed-ranking.md)).

**Feed-rankable, natively.** Ballots and organic stances are
stance-carrying records, so proposals rank like any other content
in viewer-rooted traversal — no special hop, no vote-specific
rule. A member's feed surfaces the proposals their outgoing paths
actually reach.

---

## 5. Authorship

The proposer authors the anchor: author binding is intrinsic to
the Publish record that mints it
([authorship.md](../primitive/authorship.md)), publicly fixing who
brought the Proposal and who paid for it. Authorship carries no
governance arithmetic — the proposer's voice in the tally is their
explicit ballot like everyone else's (§1), and the finalization is
authored by the executing authority, never the proposer
([governance.md §2.5](../primitive/governance.md#25-outcome)).

---

## 6. Lifecycle

The governance mechanics that drive each transition stay in
[governance.md](../primitive/governance.md); what follows is the
carrier-level progression. `status` on the overlay node caches it;
the public records carry it.

- **Open** — default from creation. Eligible members ballot at any
  time; a member's latest ballot governs; ballots land
  epoch-quantized. **No time-boxing**: the Proposal stays open
  indefinitely
  ([governance.md §6](../primitive/governance.md#no-time-boxing)).
- **Tally** — a deterministic function of each epoch's accepted
  ballot set; nothing tallies mid-epoch or on a clock
  ([governance.md §6](../primitive/governance.md#6-when-outcomes-take-effect)).
- **Crossing and finalization** — the first epoch whose tally
  crosses the threshold is the crossing epoch. The executing
  authority submits the finalization Opinion `(0,0)` with the
  outcome and tally digest; materializations follow
  ([governance.md §2.5](../primitive/governance.md#25-outcome)).
  Terminal statuses:
  - `'passed'` — crossed, executed.
  - `'passed_but_invariant_rejected'` — crossed, but a composite's
    `_from` re-validation failed against the crossing epoch's
    state (§2); the ballots stand, only execution was refused.
  - `'failed'` — bidirectional tallies only: the negative side
    satisfied the mirror bar
    ([governance.md §2.4](../primitive/governance.md#24-threshold-policy)).
  - `'redacted'` — the anchor's payload was removed by a passing
    `'illegal'` classification while the Proposal was open (§2);
    with its terms gone it can never execute.
- **Terminal is final.** A Proposal stops tallying once terminal;
  later ballots toward its anchor are recorded but change nothing.
  Petition-style tallies have no failure path — a petition that
  never crosses simply stays `'open'`; a bidirectional Proposal
  neither side crosses stays `'open'` the same way. Changing a
  terminal outcome is done with a **counter-Proposal**
  ([governance.md §3](../primitive/governance.md#counter-proposals)),
  never by re-voting the terminated one.
- **Outcome stickiness** — after execution, the subject stays in
  its new state until a deliberate new act moves it
  ([governance.md §6](../primitive/governance.md#why-outcomes-are-sticky-not-continuously-rendered)).
  Multiple Proposals can coexist against the same subject, each
  passing or failing on its own ballots.
- **No deletion** — the anchor, the Reference, every ballot, and
  the finalization are permanent L1 records. The one reduction
  path is the anchor-payload removal above, which removes no
  structure and leaves the visible mark.

---

## What this doc is not

- **Not the governance primitive.** Eligibility, weights,
  thresholds, tallies, the mod-gate, sticky outcomes —
  [governance.md](../primitive/governance.md) is canonical.
- **Not an enumeration of applications.** Application-side
  parameters live in each application doc:
  [moderation.md](moderation.md),
  [platform-guidelines.md](platform-guidelines.md),
  [network.md §§9, 11](../primitive/network.md#9-mod-role-changes),
  [chats.md §10](chats.md#6-moderation-inside-the-chat),
  [collectives.md](collectives.md).
- **Not the L1 record spec.** Publish, Opinion, and Reference
  semantics live in
  [layer1-interface.md](../primitive/layer1-interface.md) and
  [edges.md](../primitive/edges.md).
- **Not the storage schema.** The overlay Proposal state's concrete
  shape lives in
  [data-model.md](../implementation/data-model.md).
