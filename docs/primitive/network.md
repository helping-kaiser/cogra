# Network

The **Network** is the global community of every member on a CoGra
instance — the body that backs platform-wide governance: content
moderation, moderator roles, and anything that affects the whole
instance rather than a specific chat or collective.

Its durable object is the **network charter**: a
publisher-authored Content node on PeerNetworks Layer 1 that
anchors the instance — proposals about the Network name it, and
every passed parameter change lands as a witnessed payload on a
finalization Opinion toward it, so the parameter schedule is
replayable from public records. The `:Network` **overlay carrier**
in Memgraph is the operational mirror of that schedule — the node
the ranker, miner slice, and backend actually read
([substrate-map.md §5](substrate-map.md#5-governance-and-moderation)).

This doc covers the charter and carrier (creation, parameter
schedule, catalog, lifecycle) and the Network-scope governance
instances (membership and roles, mod role changes, parameter
amendments). The governance primitive itself stays in
[governance.md](governance.md).

---

## 1. Distinct from Collective

A [Collective](../instances/collectives.md) is a small group with
a defined membership: a household, band, co-op, company.
Membership is explicit and approval-gated.

The Network is the opposite — the set of every member on the
instance. Membership is automatic on admission (the AND gate of
[invitations.md](invitations.md)); there is no approval vote, and
there is no "this band vs that band." It is one Network per
instance.

Federation across instances is a forward question — see
[open-questions.md Q15](../open-questions.md). Each instance has
its own Network until then.

---

## 2. Creation

The Network is brought into existence by the **instance
bootstrap** — the one-shot genesis step, and the only step that
depends on out-of-graph authority
([graph-model.md §1](graph-model.md#1-core-principles)); the
authority is confined to it. Every subsequent change runs through
governance.

Genesis begins with money: the operator burns LBTC into Layer 0,
funding the addresses the genesis actors act from
([economics.md §7.2](economics.md#72-the-l0-reserve-pool)). On that
footing the bootstrap establishes:

1. **The genesis member** — an ordinary account (Actor + Profile,
   own L0 address) carrying `network_role = 'moderator'` with the
   **undemotable** exception (§9). Identity is supplied to the
   bootstrap at run time: the central instance run by the project
   picks the project owner; a fork sets its own genesis.
2. **The three system actors** — moderation, publisher, inviter:
   ordinary L1 actors in backend custody, burn-funded from the
   community treasury and endorsed by the genesis member to clear
   the wall — the burn is not optional; endorsement alone cannot
   reach a zero-burn actor
   ([substrate.md §8](substrate.md#8-system-actors)).
3. **The network charter** — the publisher system actor publishes
   the charter anchor; its witnessed payload carries the charter
   text and the genesis value of every governed parameter (§3).
4. **The seeded Types** — the moderation verdict Types
   (`illegal`, `sensitive`) the verdict gestures target
   ([moderation.md](../instances/moderation.md)), and the reserved
   `bot-defense` Type
   ([feed-ranking.md §8.6](feed-ranking.md#86-community-evidence)),
   present from network birth so every frontend can resolve them
   through the naming service
   ([hashtag.md](../instances/hashtag.md)).
5. **The CoGra-side state** — the `:Network` overlay carrier
   seeded with the genesis parameter values, and the service-side
   bootstrap records.

The CoGra-side bootstrap is one step; the L1 genesis records land
as the instance's first accepted acts. There is no runtime genesis
flow — no "first user to register" detection, no genesis-flag
column, no special branch in registration. Subsequent members join
through invitation per [invitations.md](invitations.md).

Bitcoin analogy: someone has to mine the genesis block. From there
it is community-driven.

---

## 3. The charter anchor and the parameter schedule

The charter is an L1 Content node — node bodies are always an L2
concern, so what makes it *the charter* is CoGra's published spec
naming it, not anything L1 reads. It gives Network-scope
governance a public, priced, replayable record chain:

- **Proposals about the Network name the charter** with their
  anchor's `(0,0)` Reference
  ([proposal.md §1](../instances/proposal.md#1-creation)).
- **Passed parameter changes ride finalizations.** The executing
  system actor's finalization Opinion toward the charter carries
  the outcome payload — parameter, new value, tally digest.
  Payloads ride records, never nodes, so the schedule is exactly
  the chain of finalization payloads: **the newest finalization
  per parameter wins**, and reading the schedule as-of any epoch
  is a pure fold over public records.
- **Genesis values live in the charter's own payload** (§2) — the
  fold's base case.
- **Rule snapshots read the same schedule**: a Proposal's tally
  reads every governed parameter as-of its own anchor's landing
  epoch
  ([governance.md §5](governance.md#rule-snapshot-at-author-time)).

The catalog below names every governed parameter, its role, and
its **gating bucket** — baseline or critical — under the
amendment-rule pairs of §11. Concrete storage shape lives in
[graph-data-model.md](../implementation/graph-data-model.md).

> **Notation.** The feed parameters map to the symbols `k`, `γ`,
> `χ`, and `f(Δt)`; see [notation.md](notation.md).

### Eligibility definition

- **`active_threshold_epochs`** — the activity window that makes
  a member count as "active" for governance tallies: at least one
  accepted L1 record authored inside the last N epochs. Epochs,
  not wall-clock — fully derivable from the epoch certificates,
  no trusted clock ([feed-ranking.md §5.3](feed-ranking.md#53-recency)
  uses the same ruler). Composes with tally-time eligibility per
  §10. Bucket: baseline.

### Governance quorums

- **`mod_role_change_quorum_fraction`**,
  **`mod_role_change_quorum_count`** — dual-quorum pair for
  moderator role changes (§9). Bucket: critical.
- **`moderation_sensitive_quorum_fraction`**,
  **`moderation_sensitive_quorum_count`** — pair for `'sensitive'`
  classification Proposals. Bucket: baseline.
- **`moderation_illegal_quorum_fraction`**,
  **`moderation_illegal_quorum_count`** — pair for `'illegal'`
  classification Proposals. Bucket: critical.
- **`guidelines_change_quorum_fraction`**,
  **`guidelines_change_quorum_count`** — pair for the
  guidelines-amendment instance. Bucket: critical.

### Platform guidelines

- **`guidelines_version`**, **`guidelines_hash`** — the pinned
  version and SHA-256 of the current platform guidelines
  ([platform-guidelines.md](../instances/platform-guidelines.md)).
  Amended together by the guidelines-amendment instance, not by
  either property-change bucket.

### Feed-ranking calibration

The network defaults of the published feed computation
([feed-ranking.md §12](feed-ranking.md#12-calibration-parameters)); frontend
overrides layer view-side on top and never change the published
computation. All bucket: baseline.

- **`k`** — disjoint paths extracted per (viewer, target).
- **`gamma`** — per-hop attenuation `γ`, genesis default `1`.
- **`dust_floor`** — the dust floor `χ` bounding path extraction
  and the data-fetch slice; genesis default `0` (the early graph
  is sparse; raise as it densifies).
- **`recency_half_life_epochs`** — half-life of `f(Δt)`, in
  epochs.
- **`recency_shape`** — functional form of `f(Δt)`; the
  exponential is the genesis default.
- **`tie_breaker_composition`** — order and weights of the
  tie-breaker cascade.

### Economics

The governed knobs of the reward economy
([economics.md](economics.md)); the formulas they feed are
CoGra's published spec. All bucket: baseline — each is
loss-limited by a pinned bound or by construction, per D4.4's
"mundane knobs" framing.

- **`reserve_share`** — the campaign-pool fraction carved for the
  L0 reserve, genesis default `1%`. Hard-capped by a **pinned
  ceiling in the published spec** — the ceiling itself is not a
  parameter, so governance can never gut the contributor pool
  ([economics.md §7](economics.md#7-the-conservation-equation)).
- **`n_eval_epochs`** — the post-window evaluation delay `N_eval`
  before campaign settlement
  ([economics.md §6](economics.md#6-settlement-and-release)).
- **`subsidy_generosity`**, **`subsidy_cap_per_member`** — the two
  admission-funding knobs: how readily the community funds
  member θ-debit restoration, and the per-member subsidized-action
  cap. Caps sit fairly high — normal behavior never hits them —
  but present as loss-limiters. Numbers deliberately not pinned in
  docs (calibration phase); the values in force are always
  readable from the schedule.
- **`support_transform`** — the reserved transform slot on
  campaign support `w(u)` (targeting sharpness); identity at
  genesis ([economics.md §4](economics.md#4-the-campaign-value-v)).

### Mod-gate

- **`critical_mod_gate_fraction`** — fraction of active moderators
  whose positive ballots open the critical-tier mod-gate on a
  destructive action; the bar is
  `⌈critical_mod_gate_fraction · |active_mods|⌉`; baseline-tier
  actions need one positive moderator ballot. Full mechanism in
  [governance.md §7](governance.md#7-the-mod-gate). Bucket:
  critical — loosening it is itself a critical act.

### Amendment-rule pairs (governance of governance)

The pairs that govern changes to the parameters themselves, split
by stakes (§11). Each is itself a dual-quorum pair:

- **Baseline:** **`property_change_quorum_fraction`**,
  **`property_change_quorum_count`** — for every parameter marked
  baseline above, and the baseline pair itself.
- **Critical:** **`critical_property_change_quorum_fraction`**,
  **`critical_property_change_quorum_count`** — for every
  parameter marked critical above, and the critical pair itself.

Each pair is self-amending: a baseline-pair amendment passes under
baseline rules, a critical-pair amendment under critical rules.
Defaults bootstrap; they are not fixed.

---

## 4. The overlay carrier

The `:Network` node in the Memgraph overlay is the **operational
mirror** of the charter's parameter schedule: layered governed
properties, one per catalog entry, updated when a finalization
lands. The ranker, the miner slice, and the backend read the
carrier, never the charter directly — but the carrier is a cache
over public records; where the two could disagree, the schedule
folded from the charter governs, and any consumer can audit the
carrier against it.

Consumers pin the parameter set they computed under
(param-version pinning,
[feed-ranking.md §12](feed-ranking.md#12-calibration-parameters)); the value
in force at a Proposal's anchor epoch or a campaign's attribution
epoch is always recoverable from the schedule, so no consumer
depends on the carrier's refresh cadence for correctness.

---

## 5. Postgres-side content

None. The Network's state is the charter schedule and its overlay
mirror; there is no `network` row and no display-content table.
The platform-guidelines document pinned by
`guidelines_version` / `guidelines_hash` lives in the project
repo, not in Postgres
([platform-guidelines.md](../instances/platform-guidelines.md)).

---

## 6. Records

The charter anchor is a passive Content node. It authors nothing.
It receives:

- **`(0,0)` References from proposal anchors** — Proposals
  targeting a governed parameter
  ([proposal.md §1](../instances/proposal.md#1-creation)).
- **Finalization Opinions** from the executing system actor,
  carrying the parameter-change payloads that form the schedule
  (§3).
- **Ballots** — payload-marked Opinions toward *proposal* anchors,
  not the charter; the charter itself receives only organic
  stances.
- **Ordinary fabric** — References from content discussing
  platform governance, organic Opinions.

The overlay carrier is not an L1 node and participates in no L1
records; it is read-side state
([substrate.md §3](substrate.md#3-cogras-stores)).

---

## 7. Lifecycle

The charter is permanent — an L1 record like any other, and the
overlay carrier is never deleted. Its only state changes are
parameter amendments: passed Proposals whose finalizations extend
the schedule (§3). No other lifecycle events apply: no membership
changes on the node (eligibility lives with accounts, §8), no
transfer, merge, or archive.

Federation across instances is the forward question flagged in §1,
deferred to [open-questions.md Q15](../open-questions.md).

---

## 8. Membership and roles

Every admitted account is a Network member — membership is the
admission AND gate itself (L1 write eligibility plus an accepted
CoGra invitation, [invitations.md](invitations.md)); there is no
separate membership gesture and no junction.

Every member has a `network_role` — a layered **overlay** property
on the account ([substrate-map.md §1](substrate-map.md#1-actors-and-identity)):

- **`member`** — every admitted account, automatically. Default.
- **`moderator`** — a small set who gate platform-wide governance
  actions ([moderation.md](../instances/moderation.md) for
  content-moderation gating; §9 for mod-role-change gating).

Promotion and demotion preserve full history per the overlay's
append-only discipline ([layers.md](layers.md)). **Users only —
Collectives carry no `network_role`**: moderation verdicts and
governance eligibility are person-accountability surfaces
([user.md §7](user.md#7-network-membership)).

An **active** member is one with at least one accepted L1 record
inside the last `active_threshold_epochs` epochs (§3).

---

## 9. Mod role changes

Adding or removing a moderator uses the standard Proposal
mechanism ([governance.md §2.1](governance.md#21-subject)):

- **Subject:** the member's **Profile**, named by the proposal
  anchor's `(0,0)` Reference; the payload carries the scope
  (`network_role`) and the proposed role.
- **Eligibility:** all active members.
- **Threshold:** multi-gate — the **critical-tier mod-gate**
  (`mod_yes ≥ ⌈critical_mod_gate_fraction · |active_mods|⌉`,
  [governance.md §7](governance.md#7-the-mod-gate)) plus the
  dual-quorum bar
  `positive_count ≥ min(mod_role_change_quorum_fraction ×
  |active|, mod_role_change_quorum_count)`. Tally is
  petition-style (positive ballots only) per
  [governance.md §3](governance.md#petition-style-tally-and-dual-quorum-network-scope-only).
- **Outcome:** the finalization records it; the `network_role`
  overlay property takes the new layer. No L1 gesture is needed —
  the role is CoGra state, and the finalization is its replayable
  public record.

The two gates implement a **separation of powers**
([governance.md §2.4](governance.md#24-threshold-policy)): each
counters a distinct failure mode — sitting-mod coup vs.
coordinated community removal. Both required, both modes blocked.

Removal mirrors promotion mechanically: same Proposal shape with
`proposed_value = 'member'`, same dual-gate rule. Two structural
constraints sit on top, enforced as **execution refusals** — the
dispatcher declines the outcome even on a passed tally, the same
shape as a composite invariant refusal
([proposal.md §6](../instances/proposal.md#6-lifecycle)):

- **Moderator floor.** The active moderator count cannot drop
  below **1**. Without at least one moderator the mod-gate cannot
  open, and every Network-scope Proposal would silently stall.
- **Bootstrap mod undemotable.** The genesis member (§2) carries
  an undemotable `'moderator'` status: no Proposal can move them
  off it. The exception exists for bot-defense — if every other
  moderator is compromised or removed, the bootstrap mod remains
  as the immovable floor of the mod-gate, blocking a coordinated
  full takeover. The asymmetry is deliberate; this is the only
  mechanism in the system that exempts anything from governance
  reach.

---

## 10. Network-wide governance

The Network is the eligibility-and-voting body for any
platform-scoped governance instance:

- Adding and removing moderators (§9).
- Content moderation classifications
  ([moderation.md](../instances/moderation.md)).
- Platform-guidelines amendments
  ([platform-guidelines.md](../instances/platform-guidelines.md)).
- Tuning the governed parameters themselves (§11).

Each runs as a Network-scope governance instance. Three
consequences shared across all of them:

- **The voter is the account itself** — Network membership has no
  junction, so every ballot is the member's own payload-marked
  Opinion toward the proposal anchor
  ([governance.md §3](governance.md#3-the-ballot)); no junction
  state enters the weighting.
- **Mod weight = member weight = 1; mod is a gate, not a
  weight** — the mod-gate applies to every Network-scope Proposal
  at its baseline or critical tier
  ([governance.md §7](governance.md#7-the-mod-gate)).
- **Activity is self-placing.** The eligible set at each tally is
  members active inside `active_threshold_epochs` as of that
  epoch. A ballot is itself an accepted record, so casting it
  places the voter inside the window for the epoch that tallies
  it: the only way to be excluded is to not participate.

---

## 11. Amending `:Network` parameters

Two amendment-rule pairs gate changes to the governed parameters,
separated by stakes:

| Bucket   | Dual-quorum pair | `P` default | `K` default | Mod gate | Governs |
|----------|------------------|-------------|-------------|----------|---------|
| Baseline | `property_change_quorum_fraction`, `property_change_quorum_count` | `0.25` | `5000` | baseline tier (≥1 mod positive) | `moderation_sensitive_*`, `active_threshold_epochs`, the feed-ranking calibration set, the economics set, the baseline pair itself |
| Critical | `critical_property_change_quorum_fraction`, `critical_property_change_quorum_count` | `0.50` | `10000` | critical tier (⌈`critical_mod_gate_fraction` · \|active mods\|⌉) | `mod_role_change_*`, `moderation_illegal_*`, `guidelines_change_*`, `critical_mod_gate_fraction`, the critical pair itself |

Pass condition for either pair is the dual-quorum form from
[governance.md §3](governance.md#petition-style-tally-and-dual-quorum-network-scope-only):
`positive_count ≥ min(P × |active members|, K)`.

`guidelines_version` and `guidelines_hash` are not in either
bucket — they are amended together by the guidelines-amendment
instance (`guidelines_change_*`).

The critical bucket holds parameters whose abuse has destructive
or platform-wide reach: stripping moderators, triggering payload
removal, or shifting the normative frame for *all future*
moderation. Those earn a supermajority. Soft flags, eligibility
windows, and loss-limited economic knobs move under the lighter
baseline pair so routine tuning isn't paralyzed.

A single uniform pair would lose the stakes split; a per-parameter
pair would double the catalog without adding meaningful
differentiation. Two buckets capture the gradient that matters.

The mod gate uses the same bot-defense reasoning as content
moderation ([governance.md §7](governance.md#7-the-mod-gate)):
without it, a coordinated push could drag a baseline threshold to
trivially low values and weaponize the loosened parameter.

Both pairs are **self-amending**: each bucket's thresholds are
governed by that bucket's rule. Defaults bootstrap; they are not
fixed.

---

## What this doc is not

- **Not the governance primitive.** Eligibility, weights,
  thresholds, tallies, the ballot, and multi-gate decisions live
  in [governance.md](governance.md).
- **Not the moderation instance.** Mechanics of moderation
  Proposals, verdict gestures, and the guidelines reference live
  in [moderation.md](../instances/moderation.md).
- **Not the Proposal carrier spec.** Anchor, terms, ballots, and
  lifecycle live in [proposal.md](../instances/proposal.md).
- **Not federation.** Cross-instance reconciliation is
  Q15-deferred ([open-questions.md](../open-questions.md)).
- **Not the account spec.** See [user.md](user.md).
- **Not the storage schema.** Concrete overlay property types,
  defaults, and indexes live in
  [graph-data-model.md](../implementation/graph-data-model.md).
