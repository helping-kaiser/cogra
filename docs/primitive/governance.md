# Governance

CoGra uses **weighted role-based voting** as a recurring primitive.
Every governance decision — admitting a collective member,
disavowing a message, classifying content, amending a network
parameter — follows the same shape: eligible actors cast weighted
ballots; a threshold policy decides the outcome; the outcome is
recorded and, where it must bind, materialized on the shared graph.

Governance is CoGra's own machinery. PeerNetworks Layer 1 knows
nothing of votes, quorums, or roles — it prices and records the
acts. Under the guild reimplementation grant
([layer1-interface.md §4](layer1-interface.md#4-the-reimplementation-grant)),
the eligibility rules, weight functions, thresholds, and tally
formulas below are CoGra policy, and CoGra publishes them in full
(the formula-completeness obligation,
[substrate.md §2](substrate.md#2-the-boundary-consume-vs-reimplement)).
What rides Layer 1 is the public structure every decision leaves
behind: the proposal anchor, the ballots, and the finalization —
priced, witnessed, replayable acts
([substrate-map.md §5](substrate-map.md#5-governance-and-moderation)).

This doc defines the primitive. The Proposal carrier is specified
in [proposal.md](../instances/proposal.md); specific applications
(chat moderation, collective contracts, Network-scope governance)
parameterize the primitive for their context.

---

## 1. Why a shared primitive

Voting recurs across the project. Instead of inventing a mechanism
per context, CoGra commits to one conceptual shape every governance
decision reuses:

- **One mental model.** Every governance flow is an instance of
  the same primitive.
- **One public structure.** Every decision, at every scope, is a
  Proposal on the same L1-anchored pattern (§2.1). An auditor
  replays any decision from public records plus CoGra's published
  tally formula.
- **No per-case re-invention.** A new governance need specifies
  the components in §2 and slots in. The full list of current
  applications is in §8.

---

## 2. The five components

Every vote-based decision specifies the components below.

A single subject can host **multiple coexisting governance
instances**, each scoped to a specific decision-type and
parameterized independently. A Collective may have one instance
for "fire worker" (1-of-1 from CEO) and a different one for
"remove board member" (2/3 of the board) — same subject, different
instances, routed by the action key. See
[collectives.md](../instances/collectives.md) for the worked-out
social-contract patterns.

### 2.1 Subject

What's being decided. Every subject is addressed the same way: a
**Proposal** ([proposal.md](../instances/proposal.md)) whose
public face is a proposer-authored **Content anchor** — the
proposal text and machine-readable terms ride it as witnessed
payload — plus a **`(0,0)` Reference from the anchor to the
subject node**. The zero-parameter Reference is routing-inert and
never vouches (`rem:graph:zero-parameter-degeneracy`); its only
job is to name the subject as replayable public structure. Ballots
point at the anchor — never at the subject itself.

The subject named by the Reference is always an L1 node:

- **A node's governed state** — a Chat whose rule entry is being
  amended, the network charter anchor for a parameter change, a
  content node being classified. The Reference points at that
  node; the action key and proposed value ride the anchor payload.
- **A person within a scope** — membership and role decisions
  (a chat kick, a collective hire, a `network_role` change) point
  the Reference at the member's **Profile**; the scope and meaning
  are L2, carried in the anchor payload
  ([nodes.md §3](nodes.md#3-overlay-node-types-cogras-graph)).
- **Overlay-only state** — where the governed object has no L1
  home (a collective's internal rule entry), the Reference points
  at the owning entity's L1 node (the collective's Profile) and
  the payload names the overlay target.

**What governance does NOT cover — actor sovereignty.** An
actor's own records and their own profile payload are sovereign:
the actor authors them themselves, with no vote and no
eligibility check. Governance applies to **shared** state — scoped
memberships and roles, governed rule entries, moderation
classifications, network parameters. The illegal-content path in
[moderation.md](../instances/moderation.md) is the only route by
which anyone but the author reduces the author's own content, and
it leaves the visible mark
([layers.md §5](layers.md#5-deletion-policy)).

Multiple Proposals naming the same subject coexist; each passes or
fails on its own ballots. Reverting a passed change requires a
**counter-Proposal** — defined in
[§3 "Counter-Proposals"](#counter-proposals) — never re-voting the
original.

### 2.2 Eligibility

Who can vote. Always expressed as a condition on existing state —
L1 records, overlay junctions, or both:

- "Members of Chat Y" — the canonical membership fold over the
  member's own Participant / Leave chain
  ([substrate-map.md §4](substrate-map.md#4-conversations-and-membership)).
- "CollectiveMembers of Collective Z with role `shareholder`" —
  overlay junction state
  ([collectives.md](../instances/collectives.md)).
- "Active Network members" — every account, filtered by the
  governed activity window
  ([network.md §8](network.md#8-membership-and-roles)).

Eligibility is evaluated at **tally time**, not ballot time. A
ballot from someone who becomes ineligible afterward drops out of
every later tally; a ballot from someone who becomes eligible
later counts once their status flips. No neutralizing write is
needed — the ballot record stands on L1 as history, and the tally
formula simply excludes it while its caster is ineligible. This
replaces any notion of revoking or blanking votes: L1 records are
never unwritten, and the tally is a read-side computation.

### 2.3 Weight function

How each ballot's contribution is scaled. An instance picks one of
three **weight modes**: **equal** — every eligible voter counts
`1` (one-member-one-vote); **role** — a flat per-role multiplier;
or **property** — the weight is read from a property on the
voter's overlay junction (e.g. `ownership_pct`), so this mode
enfranchises only roles that carry that property. An explicit
per-junction `voting_weight` overrides the mode where set.

**Role-derived defaults by scope:**

| Scope | Default source | Out-of-the-box roles → weights |
|---|---|---|
| Chat | Per-action role weights inside each chat's `governance` entry (`exec.weighting`) — see [chats.md §10](../instances/chats.md#6-moderation-inside-the-chat) | `admin = 5`, `chat_mod = 3`, `member = 1` in the default-vocabulary entries (`decision:add_member` is count-based); per-action amendable |
| Collective | Composite of `role` and `ownership_pct` per the collective's social contract — see [collectives.md](../instances/collectives.md) | Defined per collective; e.g. `role = founder` weighted by `ownership_pct`, or one-member-one-vote with role multipliers |
| Network | none — every active member's weight is `1` | no `voting_weight` override; Network membership has no junction to carry one |

The chat-scope `chat_mod` role is deliberately distinct from the
Network-scope `network_role = 'moderator'`; do not confuse them
([§7](#7-the-mod-gate)).

**`voting_weight` override.** Any overlay junction may carry an
optional, **nullable** `voting_weight` property. When set
(non-null), it is read directly as the voter's weight and the
role-derived default is ignored. When null (the default), the
role-derived rule applies. The override is the escape hatch for
instances whose intended weight does not fall out naturally from
role + ownership — e.g. a small collective with per-member
negotiated weights.

Roles, junction properties, and the governed rule entries all
live in CoGra's overlay and Postgres — never on L1
([substrate-map.md §5](substrate-map.md#5-governance-and-moderation)).
The ballots are public; the weighting applied to them is CoGra's
published policy over CoGra's own state.

### 2.4 Threshold policy

What tally triggers the outcome. Possible shapes:

- Simple count (N or more affirmative ballots).
- Percentage of eligible voting weight.
- Supermajority for irreversible decisions.
- Quorum + percentage (M% of eligible weight participates, N% of
  cast weight agrees).
- **Petition with dual quorum** — positive-ballot-only tally; pass
  on the lower of (fraction × eligible) or absolute count. Used at
  Network scope where unbounded membership and bot inflation make
  a single percentage or single fixed count insufficient. See
  [§3 "Petition-style tally and dual quorum"](#petition-style-tally-and-dual-quorum-network-scope-only).
- **Multi-gate** — two or more independent eligibility groups
  voting on the same subject; each gate has its own threshold, and
  the outcome triggers only when **all** gates cross.

**Mirror failure (bidirectional tallies).** A tally that counts
negative ballots fails terminally — `status = 'failed'`
([proposal.md §6](../instances/proposal.md#6-lifecycle)) — when
the negative side satisfies the same threshold shape required of
the positive side: same quorum, same fraction or count, computed
over negative weight. While neither side crosses, the Proposal
stays open and members may ballot again. Petition-style tallies
count no negatives, so they have no failure path — an unloved
petition simply stays `'open'`.

Percentages scale with the voter pool; fixed counts don't. An
instance that picks fixed numbers has to defend why it won't need
re-tuning as the pool grows. Dual quorum bounds both ends: the
fractional bar dominates while the network is small, the absolute
bar dominates once membership scales past the crossover point.

**Multi-gate decisions are a separation of powers.** When a single
subject is gated by two or more distinct eligibility groups —
neither alone can pass it — the structure is intentional: each
gate counters a failure mode the others cannot. The canonical
instance is Network moderator role changes
([network.md §9](network.md#9-mod-role-changes)): a moderator gate
(the critical-tier mod-gate, a fraction of active moderators — §7)
prevents community-only purges by bot floods or coordinated
targeting; a community gate (quorum + supermajority of active
members) prevents mod-only coups in which sitting moderators strip
honest peers. Either gate alone leaves a hole; both gates together
close it. Future decisions adopt the multi-gate shape when the
trust model demands more than one veto-bearing group.

**All numeric parameters are tunable via this same primitive.**
Role weights, quorum fractions, threshold counts — every number is
governed state (a `:Network` parameter or a rule entry), amendable
through a Proposal under its own amendment rule. Defaults exist to
bootstrap; they are not fixed rules.

### 2.5 Outcome

What happens when the threshold is crossed. The outcome has one
**public record** and zero or more **materializations**:

- **The finalization record** — the scope's executing authority
  authors an **Opinion `(0,0)` + payload (outcome, tally digest)
  toward the proposal anchor**. At Network scope the executor is a
  system actor ([substrate.md §8](substrate.md#8-system-actors));
  at chat scope it is the chat-authority member whose per-chat
  role authorizes execution
  ([chats.md §10](../instances/chats.md#6-moderation-inside-the-chat)); at
  collective scope it is the collective actor itself. The
  finalization is the on-graph outcome record of every Proposal —
  the tally digest makes the pass auditable against the published
  formula and the public ballots.
- **Materializations**, per outcome type:
  - an **L1 gesture** where the outcome must bind or be readable
    on the shared graph — the De-invite executing a chat kick
    ([substrate-map.md §4](substrate-map.md#4-conversations-and-membership)),
    The Moderator's Tag verdict, an illegal classification's
    payload removal
    ([moderation.md](../instances/moderation.md)), The Publisher's
    role Tag on a passed `network_role` change
    ([network.md §9](network.md#9-mod-role-changes));
  - a **payload on the finalization itself** where the outcome is
    a governed value — a network parameter change rides the
    finalization Opinion toward the charter anchor, making the
    parameter schedule replayable
    ([network.md §3](network.md#3-the-charter-anchor-and-the-parameter-schedule));
  - **overlay and Postgres writes** — junction admissions,
    display-content versions, rule-entry amendments, mirror
    updates of L1-materialized state — CoGra-side state following
    CoGra's own append-only discipline ([layers.md](layers.md)).

Nothing is ever deleted: L1 records are permanent by construction,
and every CoGra-side carrier is append-only. The only reduction
anywhere is the moderation payload-removal path with its visible
mark ([layers.md §5](layers.md#5-deletion-policy)).

### 2.6 Packaging rules on a node — the `governance` map convention

A governed entity may need to host **many decision-type rules**
("who admits a new member", "who renames the entity", "who
disavows content"). Spreading these across one
quorum/threshold/eligibility property per decision-type fans out
the schema and forces a change every time a new decision-type is
added.

**The pattern: one layered map, keyed by `action_key`, each entry
a `Rule` of paired `exec` + `amend` triples:**

```
governance: Map<String, Rule>
  where Rule = {
    exec:  { eligibility, weighting, threshold, exclude_subject? },
    amend: { eligibility, weighting, threshold }
  }
```

`exec` is the per-instance configuration per §§2.1–2.5 that
governs **executing** the action. `amend` is the same shape
without `exclude_subject` (the subject of an amendment is the rule
entry itself, not a member) and governs **amending** that entry.

**The `amend` triple is self-applying.** Amending the `amend` half
of a rule uses that same `amend` triple. Tightening the amendment
process requires using the current amendment process — no separate
meta-meta-rule, no infinite regress.

**The map is overlay state; its host is an L1 node.** The
`governance` map lives as a layered overlay property keyed to the
governed entity ([substrate-map.md §5](substrate-map.md#5-governance-and-moderation)).
A Proposal amending an entry names the host with its anchor's
Reference and carries `action_key` and the new `Rule` in the
anchor payload ([proposal.md §2](../instances/proposal.md#2-terms)).
Entries are never removed: a rule is always rewritable through its
own `amend` gate, so disabling an action is an amendment of its
`exec` gate, not a deletion.

**Rule snapshot.** Tally and execution read the host's rule state
**as-of the Proposal anchor's landing epoch** and index by
`action_key` to recover the frozen Rule. See
[§5 "Rule snapshot at author time"](#rule-snapshot-at-author-time).

**Per-instance specifics live in the instance docs.** The
`action_key` vocabulary, dispatch conventions, and whether a
default map is installed at host creation are per-instance
choices. Consumers:

- [Collective governance](../instances/collectives.md#6-the-social-contract)
  — no primitive defaults; founders write the social contract at
  creation.
- [Chat governance](../instances/chats.md#6-moderation-inside-the-chat) — default
  map installed at chat founding (chats default to community-vote
  moderation because it fits informal communities).

---

## 3. The ballot

A vote is an **L1 ballot**: a **payload-marked Opinion toward the
proposal anchor**, direction carried by the stance sign. One shape
at every scope — chat, collective, Network — replacing any notion
of scope-specific vote carriers.

- **Carrier.** An ordinary Opinion record
  ([layer1-interface.md §9](layer1-interface.md#9-node-and-edge-type-inventory))
  from the voter's own actor toward the anchor. The **ballot
  marker** — a guild-key field in the payload envelope — is what
  makes it a ballot; an unmarked Opinion toward the same anchor is
  organic sentiment and never enters any tally. The two share one
  `(author, target, type)` bundle on L1; the tally reads the
  **individual payload-marked records, never the netted bundle**,
  so organic stance and ballot cannot contaminate each other.
- **Direction.** The sign of the ballot's valence: positive =
  support, negative = oppose, zero = withdrawal. The tally reads
  only the sign; magnitude and the connection axis are the voter's
  free stance vocabulary, informational for ranking and frontends,
  never governance arithmetic.
- **Changing a vote** = authoring a new marked ballot; the tally
  reads each eligible voter's **latest** ballot record. Every
  prior ballot stays on the graph as history.
- **Public, priced, permanent.** Ballots are ordinary L1 acts:
  write-rule-gated (an insolvent or below-wall member cannot vote
  — accepted; funding flows per
  [economics.md](economics.md)), epoch-quantized in their landing,
  and visible to everyone forever. There is no secret ballot
  (§12).
- **Weighting is read-side.** Role weights, junction properties,
  and eligibility conditions are applied by CoGra's published
  tally formula over its overlay state (§2.2–2.3); the ballot
  record itself carries no weight.
- **Authoring is never a vote.** The proposal anchor's genesis is
  a **Publish** record, and Publish and Opinion never share a
  bundle — so creating a Proposal contains no ballot. The client
  flow bakes the proposer's explicit `+1` ballot immediately after
  creation: one more priced act, consistent with proposer-pays
  ([proposal.md §1](../instances/proposal.md#1-creation)).

Because ballots are ordinary stance records, proposals **rank
natively** as stance-carrying content in the feed — no special
hop, no vote-specific ranking rule
([feed-ranking.md](feed-ranking.md)).

### Petition-style tally and dual quorum (Network-scope only)

Network-scope governance — moderator role changes, content
moderation classifications, and `:Network` parameter amendments
([network.md §10](network.md#10-network-wide-governance)) — uses
**petition-style tally**: only positive ballots contribute. The
mechanism applies at Network scope only. Chat-internal and
collective-internal voting retain bidirectional tally (positive
and negative ballots both count); bounded membership in those
contexts means bot-driven denominator inflation is not the
dominant threat.

**Per-ballot arithmetic.** Each marked ballot from an active
member contributes:

- `contribution = max(sign(direction), 0) × voter_weight` — that
  is, `+1 × voter_weight` for a positive ballot, `0` otherwise.
- Negative and zero ballots are valid public records encoding the
  voter's position; they simply do not enter the petition tally.
- `voter_weight` is the §2.3 value; at Network scope every
  member's weight is `1`.

The Network-scope positive total is the sum of these contributions
over each active member's latest ballot:

```
positive_count = Σᵥ  max(sign(direction(v)), 0) × voter_weight(v)
                (over the latest marked ballot of each active member)
```

**Dual-quorum pass condition.** A Network-scope Proposal passes
when its positive total is at least the lower of two bars,
evaluated at tally time:

```
positive_count ≥ min( quorum_fraction × |active_members| , quorum_count )
```

- `quorum_fraction` and `quorum_count` are the proposal-type's
  governed pair on the `:Network` singleton
  ([network.md §3](network.md#3-the-charter-anchor-and-the-parameter-schedule)).
- `|active_members|` is the count of members active inside the
  governed activity window (`active_threshold_epochs`), read at
  each evaluation. Activity gates the **bar**, never the ballots:
  a cast ballot counts in every future evaluation regardless of
  whether its voter has since fallen outside the activity window.
  (Eligibility per §2.2 — a revoked membership dropping its
  ballots — is a separate mechanism and unaffected.) The count is
  a **maintained aggregate** — one counter per scope, kept current
  on an operational cadence — never a per-ballot rescan of the
  member set; the bar it feeds moves slowly, so a
  refresh-cadence-stale read is acceptable by design.

In addition, the mod-gate of §7 must be satisfied — every
Network-scope Proposal also requires moderator consent in the
tally, at the gate's baseline or critical tier depending on the
action's stakes. The mod-gate and the dual-quorum bar are
independent checks evaluated on the same ballot set.

**Why two bars.** A fractional bar alone becomes unreachable as
membership scales; an absolute bar alone could let a tiny faction
pass things over a silent majority in a small network. The pair is
bounded on both ends: the fractional bar dominates while
`quorum_fraction × |active_members| < quorum_count` (small
membership, real majority required); the absolute bar dominates
once the product crosses `quorum_count` (large membership, fixed
real-ballot count sufficient). Both parameters are governed and
amendable through this same primitive, so the operative bar
self-corrects as conditions shift.

**Why petition (positive-only).** A counted "no" ballot operates
as a perpetual veto: bot accounts that cast it never expire,
holding a Proposal blocked indefinitely against any later turnout.
Restricting tally contributions to positive ballots removes the
passive-veto vector. Opposition retains an explicit structural
path — author a **counter-Proposal** (below). Negative ballots are
still recorded as the voter's position; the tally simply does not
aggregate them.

**Denominator inflation is bounded, not eliminated.** Accounts can
still inflate the fractional-bar denominator by existing as active
members — though at L1 every act that sustains "active" is a
priced, θ-debited record, so inflation now carries a standing
cost. It remains a *liveness* pressure, not a takeover vector: a
petition tally counts only positive ballots, so an inflated
denominator can make a Proposal *harder* to pass, never force a
bad outcome through. The absolute bar `quorum_count` is the floor
that survives any inflation, and meta-governance over both bars
lets the network re-calibrate. The distinct, catastrophic vector —
a single compromised moderator passing a destructive action over a
community bot-flood — is closed separately by the critical-tier
mod-gate ([§7](#7-the-mod-gate)).

### Co-signed acts: threshold > 1

When a change requires more than one party to concur — N parties
whose ballots each contribute to the same tally — the structure is
**uniformly governance with threshold > 1**. No additional
mechanism is introduced; the result is a **co-signed act**:

- The would-be change is materialized as a pending subject (a
  Proposal, a pending collective junction) so co-signers have
  something to ballot on.
- Co-signers cast ballots until the threshold is reached.
- On threshold-cross, the outcome takes effect per §6.

"N parties concur" and "governance with threshold N" are the same
primitive — there is no separate "co-signature" concept. The
current consumer is **collective membership admission**: the
candidate junction stays pending until the required approver
ballots arrive; the finalization then activates it
([collectives.md](../instances/collectives.md)).

Chat membership is deliberately **not** a consumer: the landed L1
flow makes joining unilateral — an Invitation or Join Request is a
proposal-shaped gesture, and membership materializes only from the
invitee's own Participant edge
([substrate-map.md §4](substrate-map.md#4-conversations-and-membership)).
Collective act-as gestures are not a consumer either: the graph is
public, so an outgoing act held pending co-signatures would
already be visible. An authorized member's act-as gesture executes
immediately; the act-as rule gates *who* may act, never how many
must concur
([collectives.md §2](../instances/collectives.md#4-acting-through-the-collective)).
Multi-party collective decisions exist only as `decision:*`
entries of the social contract, the Proposal being the pending
subject.

### Counter-Proposals

Reversing a passed Proposal is done with a **counter-Proposal**:
an ordinary Proposal — its own anchor, its own `(0,0)` Reference
to the same subject, its own ballots — whose terms carry the
inverse change (or the prior value, where the governed state is
multi-valued). No new node type, no new mechanism. Tally
arithmetic, the petition-vs-bidirectional choice, and the outcome
rules apply identically.

A counter-Proposal is the structural opposition path under
petition-style tally, where opposition cannot register inside the
original Proposal's tally. It is also the only reversal path under
bidirectional tally: outcomes are sticky (§6), so a passed change
does not flip back when later ballots shift sentiment; a new
Proposal must explicitly carry the reverse.

**Reversal re-materializes, symmetrically.** A counter-Proposal
that passes runs the same finalization-and-materialization
machinery with the reversed value. The resulting state will
typically mirror the pre-original state, but exact mirror is not
guaranteed — and one class of outcomes is structurally one-way:
an illegal classification's payload removal is monotone
([layers.md §5](layers.md#5-deletion-policy)), so no
counter-Proposal restores removed content. Where exact mirror
matters, the application designs its materialization so forward
and reverse compose to identity.

---

## 4. Append-only throughout

- Ballots are L1 records. Never deleted, never rewritten.
- Changing your vote = a new ballot record; the latest governs.
- Withdrawing = a new ballot with direction zero.
- History is always visible. An observer can replay how the ballot
  distribution evolved, epoch by epoch, from public records alone.

---

## 5. Weight at tally time

When weights come from mutable state (e.g. an admin demoted to
member), the question arises: does a past ballot retain its old
weight or take the current one?

**CoGra's default: current weight at tally time.** Reasons:

- Consistent with "current state is the latest record" everywhere
  else.
- An ex-admin's past admin-weighted ballots shouldn't retain
  leverage after demotion.
- Avoids snapshotting weights into each ballot (duplicates data).

Specific applications can override this if they need ballot-time
snapshot weights, but they carry the burden of explaining why.

### Rule snapshot at author time

The "current at tally time" default above governs **per-voter
data** — a voter's role, `ownership_pct`, junction properties. It
does **not** extend to **the rule itself** — the eligibility
predicate, weight function, and threshold the tally evaluates
against. When rule parameters are amendable via this same
primitive (governance of governance), in-flight Proposals would
otherwise face an ambiguity: do amendments retro-apply to
already-open Proposals or only to the next Proposal authored?

**The pattern: snapshot at author time, on every Proposal.** The
ruler is the **proposal anchor's landing epoch** — a public,
replayable timestamp no clock can dispute. Tally and execution
read every rule input as of that epoch:

- **Rule-entry rules** — the host's `governance` map state as-of
  the anchor's landing epoch, indexed by `action_key` (§2.6).
- **Network rules** — the charter parameter schedule as-of the
  anchor's landing epoch: the newest finalization payload per
  parameter at or before that epoch
  ([network.md §3](network.md#3-the-charter-anchor-and-the-parameter-schedule)).

Rules-of-the-game stable through a vote; one anchor, one epoch,
the whole rule frozen. Per-voter applicability stays live per §2.2
and the rest of §5 — the rule is frozen, but who currently
satisfies it (and with what current weight) is not.

---

## 6. When outcomes take effect

Tallies are **epoch-quantized**. Ballots land on Layer 1 in
epochs; the tally is a deterministic function of the accepted
ballot set at each epoch boundary — CoGra's published formula over
public records and published overlay state. Nothing tallies on a
clock or mid-epoch, and no per-Proposal locking discipline exists:
epoch order serializes every race by construction. Two ballots in
the same epoch land as one accepted set; the tally is computed
over the set, not the arrival order.

- Members cast ballots at any time; the records land at the next
  epoch boundary.
- At each epoch, the tally over currently-eligible voters' latest
  ballots either crosses the threshold or doesn't. The first epoch
  at which it crosses is the Proposal's **crossing epoch**.
- The executing authority then submits the finalization (§2.5) and
  the materializations follow. Composite terms are re-validated
  against the crossing epoch's state before execution
  ([proposal.md §2 "Composite proposals"](../instances/proposal.md#composite-proposals));
  a mismatch refuses execution and terminates the Proposal as
  `passed_but_invariant_rejected` — the crossing is real and the
  ballots stand; only the materialization is refused.
- Eligibility changes alone (members leaving, roles changing)
  never trigger re-tallying. Past outcomes stand. Current
  eligibility applies at the next epoch's tally.

Frontends may show live provisional counts as ballots are
submitted; the provisional view is a courtesy, never the tally.
The authoritative sequence is: landed ballots → epoch tally →
finalization record. An auditor recomputes every step from the
epoch certificates and CoGra's published formulas.

CoGra-side materializations (overlay, Postgres) run inside one
service-layer transaction per Proposal outcome, with the
archive-first ordering where redaction is involved
([retention-archive.md](retention-archive.md)); an infrastructure
failure rolls the CoGra-side writes back and retries — the
crossing itself is a fact about public records and cannot be
rolled back. L1 gestures (a De-invite, a Tag verdict) are
submitted by their executing authority and land in a later epoch;
the finalization payload is what makes the pending outcome
publicly legible in the meantime.

### Why outcomes are sticky, not continuously rendered

Consider a member who balloted on 1000 past disavowals and then
leaves the chat. Under a naive "always match the current tally"
model, their exit could flip every past decision they were pivotal
to — and each of those thousand subjects would then need fresh
ballots from remaining members to re-cross quorum. Governance
would be dominated by background churn, not by intent.

CoGra's model instead: **once an outcome takes effect, the subject
stays in that state until a deliberate new act moves it.**
Eligibility shifts and sentiment drift never revert it on their
own. Governance is an act, not a background computation.

Reversal is itself a governed act, never a side effect. A Proposal
is terminal once it crosses — its finalization is final and later
ballots change nothing
([proposal.md §6](../instances/proposal.md#6-lifecycle)) — so
undoing it means authoring a **counter-Proposal**
([§3](#counter-proposals)) that must clear its own threshold.

### No time-boxing

Ballots stand until changed; there is no "voting ends at T". A
specific application that genuinely needs a time window is a new
design discussion (§12).

---

## 7. The mod-gate

A recurring component of Network-scope governance is the
**mod-gate**: before a Proposal's outcome can take effect, a
threshold of positive ballots from members with
`network_role = 'moderator'` must be present in the tally. The
mod-gate is a procedural validator, not a weighting.

The threshold has **two tiers**, keyed to the same
baseline/critical stakes split that buckets every Network-scope
action ([network.md §11](network.md#11-amending-network-parameters)):

- **Baseline tier** — low-stakes actions (`sensitive`
  classification and un-classification, baseline `:Network`
  amendments): **at least one** positive moderator ballot.
- **Critical tier** — destructive or irreversible actions
  (moderator role changes, `illegal` classification, guidelines
  amendments, critical `:Network` amendments): positive moderator
  ballots `≥ ⌈critical_mod_gate_fraction · |active_mods|⌉`, where
  `|active_mods|` is the moderators active inside the governed
  activity window.

`critical_mod_gate_fraction ≤ 1`, so the bar never exceeds the
active-mod count: the gate is always satisfiable and needs no
absolute floor. It self-strengthens as the moderator set grows —
with one or two active mods the bar rounds to one, a real majority
is required once three or more are active. Because
`critical_mod_gate_fraction` itself sits in the critical bucket,
loosening it is a critical act subject to the critical tier — the
recursion is closed.

**Invariant: mod weight = member weight = 1; mod is a gate, not a
weight.** A moderator's positive ballot contributes once to (a)
mod-gate satisfaction and once to (b) the member-tally arithmetic
— two independent checks on the same ballot record. The mod-gate
sits *alongside* the member-weighted tally, never on top of it.

The gate applies symmetrically in both directions of any
classification — setting `sensitive` and un-setting back to
`normal`, and the one-way `illegal` — and across every
Network-scope Proposal kind. Reasons each direction needs the
gate:

- Without a mod gate on `sensitive`, a small coordinated group
  could flood-flag legitimate content, forcing endless
  re-moderation.
- Without a mod gate on `illegal`, bot networks could mass-ballot
  removal of legitimate content.
- Without a mod gate on un-classification, bots could strip
  moderation flags from legitimately-classified content.
- Without a mod gate on **moderator role changes**, the community
  alone could strip moderators — a coordinated push removes honest
  mods at will.

The mod-gate is the specific instance of the §2.4 multi-gate
pattern that pairs a moderator gate with a community-tally gate.
Either gate alone leaves a hole: **mods alone** can purge each
other — sitting-mod coup; **community alone** can be coordinated
against honest mods — flooded removal.

The full list of Network-scope instances that share the mod-gate
component is in §8. Substantive arithmetic (quorums, the exact
pairs per instance) lives with each instance, not here.

**Bot resistance.** The critical tier is the mod-side defense
against takeover. A single compromised moderator key cannot pass a
destructive action; an attacker needs
`⌈critical_mod_gate_fraction · |active_mods|⌉` distinct moderator
keys balloting in concert. And because minting a moderator is
itself a critical action, the moderator set grows only under that
same fraction — the denominator is Sybil-resistant by
construction. The activity window keeps the bar from deadlocking
on moderators who have gone dark.

### External demands enter as Proposals

A direct corollary of the mod-gate and the broader governance-only
authorization model: **there is no admin escape-hatch.** Any
external pressure on the platform — court orders, regulator
demands, law-enforcement notices, next-of-kin requests, copyright
takedown letters — enters through the same Proposal mechanism any
member would use. Typically a moderator files the Proposal
(because they received the demand and understand the
classification), but the Proposal itself is an ordinary moderation
Proposal ([moderation.md](../instances/moderation.md)); the
mod-gate and the community-tally gate both still apply.

The platform commits to this *because* it is the property that
makes the transparency story load-bearing: every removal is
auditable from public records, no party can edit silently, and a
pathologically captured moderation corps still requires community
participation. On the L1 substrate the commitment is structural,
not just procedural: the anchor, the ballots, and the finalization
are records CoGra cannot forge or erase.

---

## 8. Instances

### Existing

- **Collective governance (full social contract)** —
  [collectives.md](../instances/collectives.md). Membership
  changes (hire / fire / promote), rule and property changes, and
  any other decision-type the collective defines. A Collective
  hosts as many instances as its social contract specifies;
  admission is the co-signed-act consumer (§3).
- **Chat moderation and kick** —
  [chats.md §10](../instances/chats.md#6-moderation-inside-the-chat). Message
  disavowal (Level 1) and member disavowal (Level 2) as
  bidirectional-tally Proposals under the chat's `governance`
  entries; a passed `decision:disavow_member` is executed by the
  chat-authority actor authoring the L1 De-invite whose payload
  cites the authorizing anchor
  ([substrate-map.md §4](substrate-map.md#4-conversations-and-membership)).
- **Chat property and rule changes** —
  [chats.md §10](../instances/chats.md#6-moderation-inside-the-chat). Name,
  description, key-rotation, role changes, and `governance` map
  amendments (governance of governance), each under its entry's
  `exec` / `amend` triples.
- **Network moderator role changes** —
  [network.md §9](network.md#9-mod-role-changes). Multi-gate: the
  critical-tier mod-gate plus the community dual-quorum bar. Two
  dispatch exceptions — the **moderator floor** of 1 and the
  **undemotable bootstrap moderator** — refuse the outcome even on
  a passed tally.
- **Content moderation classifications** —
  [moderation.md](../instances/moderation.md). Mod-gate on every
  classification change (`sensitive` / `illegal` and
  un-classification back to `normal`); reports *are* Proposals.
- **Platform-guidelines amendments** —
  [platform-guidelines.md](../instances/platform-guidelines.md).
  Critical-tier mod-gate plus the `guidelines_change_*` pair.
- **`:Network` parameter amendments** —
  [network.md §11](network.md#11-amending-network-parameters).
  Baseline and critical amendment-rule pairs on the charter;
  mod-gate at the matching tier.

Future cases get added here as they're designed.

---

## 9. Coexistence: multiple governance instances on a shared subject

A single node can be the subject of several governance instances
at once — each with its own eligibility, weight function,
threshold policy, and outcome.

The principle: **scope determines what the outcome writes.** A
chat-scope instance writes chat-side state (the chat's stance is
the passed disavowal Proposal; a kick materializes as a
De-invite). A Network-scope instance writes the platform verdict
(the Tag mark; for `illegal`, the payload removal). The outcomes
land on different carriers even when the *subject* is the same
node, so the writes never collide.

The canonical worked example is **chat-internal disavowal
alongside platform moderation**, both applicable to a single
Message:

- **Platform moderation** — Network-scope. Eligibility = every
  active member; mod-gate (§7) required. An `illegal` outcome
  removes the Message's payload with the visible mark
  ([layers.md §5](layers.md#5-deletion-policy)); the structural
  record stays. See [moderation.md](../instances/moderation.md).
- **Chat-internal disavowal** — chat-scope. Eligibility = members
  of the hosting chat by the membership fold; weight by role; no
  mod-gate. Outcome is the chat's stance — the chat moves away
  from the message; the message stays.

Both can pass independently, neither overrides the other; the two
can also both pass — the message is then reduced at the platform
level *and* disavowed at the chat level. No collision; the writes
go to different places.

The shape generalizes: any future instance operating on a subject
already governed by another scope writes to its own scope's
carriers, so instances at different scopes never compete for the
same write.

---

## 10. Multi-candidate decisions

Decisions that pick from several candidates — council seats,
multiple values to choose between — are expressed as **N parallel
binary Proposals**, one per candidate. Each is balloted
independently under the same governance instance (same
eligibility, weighting, threshold). Every Proposal that crosses
threshold passes; that candidate takes office or that value is
set.

Removal later (recall, term-end) is another Proposal targeting the
same role or value to revert it. No special lifecycle machinery.

This pattern loses ranked-ballot information ("B over A"). Ranked
and multi-seat semantics aren't part of the primitive (§12). A use
case that genuinely needs them deserves its own design pass.

---

## 11. Honor

Alongside the ballot machinery, CoGra runs an **honor system**: a
non-monetary integrity signal, adopted from the L1 ecosystem's
honor-ledger semantics and operated per community.

- **What it measures.** Honor is a disinterest-and-judgment
  measure — earned through acts a community deems honorable,
  spent by nothing. It is off the token rail entirely: CGT is the
  harvest, honor the pantry. Complements, not substitutes.
- **Community-scoped from day one.** Every honor ledger is keyed
  by its issuing community; CoGra itself is guild #1, architected
  for many. Balances are incomparable across issuers. Guild and
  Collective are conceptually distinct but structurally the same
  construct — one L1 actor, own L2 social contract.
- **Home: a per-community append-only Postgres ledger with
  membership-gated reads.** Never on a chain (public
  verifiability would contradict its unverifiable-private-state
  semantics), never among the graph's record tables — the ranker
  and the miner slice consume only L1 records, so they
  **structurally cannot** consume it. The single sanctioned read into any feed is
  a community's own named opt-in feed
  ([feed-ranking.md §10](feed-ranking.md#10-the-default-feed-and-named-feeds)).
- **Honor never confers vote weight.** The ballot machinery above
  is the voice channel. Honor is a pure gate input: adjudicator
  eligibility uses the **dual-signal gate** — standing as the
  coarse objective filter, honor as the fine integrity test — with
  sortition and rotation against conflicts of interest
  ([moderation.md](../instances/moderation.md)).
- **Revocation: uniform freeze.** Expulsion from the community
  freezes the ledger — no void, not even for-cause. Honor is
  membership-contingent, so a frozen ledger is functionally inert;
  voiding would add only symbolic erasure. The expulsion record is
  the visible integrity mark.
- **Knobs are governed.** Issuance rules, adjudicator gate
  parameters, and the rest are ordinary governed parameters —
  operator-set at genesis, migrating to community governance
  ([roadmap.md](../implementation/roadmap.md)). The fiat-backed
  goods program is a staged roadmap item starting near-zero-fiat.

---

## 12. Out of scope

- **Secret ballots.** All ballots are public L1 records — public
  and permanent is the accepted cost of replayable governance.
  Privacy is achieved through content encryption elsewhere, never
  through hiding vote topology. A future case that genuinely needs
  secret voting is a new design discussion.
- **Time-boxed voting periods.** Ballots today are open-ended;
  once cast they stand until changed. "Voting ends at T" is a new
  design.
- **Delegation / proxies.** No "proxy voter" mechanism. Adds a
  layer to eligibility rules and needs its own design.
- **Ranked, multi-seat, or budget-allocation ballots.** All
  ballots are binary (support / oppose on a single subject).
  Ranked preferences, multi-seat allocations beyond parallel
  binary Proposals (§10), and proportional budget splits aren't
  expressible in the current primitive. Use cases that genuinely
  need any of these deserve their own design pass.

These aren't refused — they're just not addressed by the current
primitive. Any of them would extend governance.md rather than
replace it.

---

## What this doc is not

- **Not a list of specific thresholds or weights.** Per-application.
- **Not the Proposal carrier spec.** Anchor, terms, ballots,
  statuses, lifecycle — [proposal.md](../instances/proposal.md).
- **Not an aggregation / caching spec.** How the system
  efficiently evaluates tallies is an implementation concern.
- **Not a roadmap.** When each governance feature ships is
  separate.
