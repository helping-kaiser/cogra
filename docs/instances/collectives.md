# Collectives

A **Collective** is any group of people that needs a single graph
identity to act through — a household, a band, a co-op, a studio,
a partnership, an NGO, a company. On the substrate a Collective is
**one L1 Actor + Profile** — an ordinary grounded pair, with its
keypair and L0 address in backend custody
([substrate-map.md §1](../primitive/substrate-map.md#1-actors-and-identity)).
**L1 sees one ordinary actor.** Its members, roles, stakes, and
internal governance are CoGra state; no membership edge, junction,
or mark of any kind exists on the shared graph.

Outbound, a Collective looks exactly like a User: it publishes,
comments, holds stances, owns items (title in its own actor's
name), and is ranked like any other actor. There is no asymmetry
between Collective and User as record endpoints, and no
preferential treatment anywhere (§9).

**Guilds are the same construct.** A community running its own
social contract — CoGra itself is guild #1 — is structurally a
Collective: one L1 actor, own L2 rules
([governance.md](../primitive/governance.md)).

---

## 1. Founding

Founding is a backend-mediated bootstrap, initiated by one
founding User:

1. The founder writes the social contract (§6) — at minimum the
   act-as rules and the initial decision rules.
2. The backend creates the Collective's **keypair and L0
   address** (custody: §2).
3. The admission debit is **treasury-funded** — Collectives draw
   on the CoGra community treasury for their L0 burns
   ([economics.md](../primitive/economics.md)).
4. The Collective's own **Registration** record anchors its
   Actor + Profile pair; profile content (name, description,
   avatar digests) rides the Registration payload, display rows
   in Postgres.
5. The **founder's Opinions toward the collective's Profile**
   lift its standing — ordinary vouch-positive person stances.
   The burn is the ignition; endorsement amplifies it.

**Collectives are never invited.** The CoGra-join mutual-pair
relation ([invitations.md](../primitive/invitations.md)) is a
person relation; a Collective enters by founding, and its
`network_role` is `'collective'` — automatically, permanently, a
class label conferring nothing: no ballots at Network scope, no
activity count, no moderator eligibility
([network.md](../primitive/network.md)).

A Collective founding another Collective (a subsidiary, a label's
imprint) is the same flow, initiated through the parent's own
act-as machinery (§4).

---

## 2. Custody

The Collective's key lives in **backend custody** — members
authenticate to CoGra, and the backend signs the Collective's
records ([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)).
What custody protects is graver here than in a rewritable
system: a compromise means **signed L1 records** — permanent,
publicly attributed acts of the Collective — not database rows
anyone can fix. Threshold signatures and member-held key shares
are the decentralized-phase roadmap answer
([roadmap.md](../implementation/roadmap.md)); until then, custody
discipline is the control.

---

## 3. Four authorities, kept apart

Four independent questions govern what a Collective can do. They
have four different homes, and conflating them is the classic
design error:

| Authority | Question | Home |
|---|---|---|
| **Protocol standing** | May its actor write to the shared graph at all? | L1's alone — the write rule over its balance and stamps, its standing from real endorsement. Membership never enters it. |
| **Membership** | Who is in the Collective, with what role and stake? | CoGra's alone — overlay + Postgres (§5). L1 never sees it. |
| **Subsidy** | Who pays its θ-debits? | Governed policy — Collectives draw on the community treasury, within the governed generosity and caps ([economics.md](../primitive/economics.md)). |
| **Self-funding** | Can it stand on its own? | Always open — an L0 burn to the collective's address is funder-unconstrained; a self-funded Collective is indistinguishable from a subsidized one at the comparator. |

A Collective the community defunds (severance netting its
inbound stances to `(0,0)`) loses standing regardless of its
internal health; a thriving internal membership buys no protocol
standing by itself. Each authority is earned and lost on its own
terms.

---

## 4. Acting through the Collective

A Collective takes no gestures by itself: every record attributed
to it is initiated by an authorized member — a User, or a
sub-Collective acting recursively through its own authorized
members. On the shared graph the Collective's actor signs; **no
per-edge record of the acting member exists, deliberately.**
Accountability for who may trigger the key lives in the social
contract, not in per-record attribution — and internally holding
members accountable is likewise the contract's business.

Two coarse gesture classes, with opposite defaults:

- **Content-acts** — publishing, commenting, stances, tags.
  **Default: any active member** may produce one. A Collective
  that wants "only the press officer posts" declares an act-as
  override.
- **Governance-acts** — proposing or voting anywhere as the
  Collective, settlement signatures (Accept/Ratify), founding
  sub-Collectives, joining other Collectives. **Default: deny** —
  an explicit act-as rule is required. A stray post is answerable
  with another post; a stray Ratify binds the Collective
  externally and permanently.

**Act-as rules carry eligibility only** — an eligible member's
gesture executes immediately. There is no multi-signer threshold
on an outgoing gesture; where the Collective wants concurrence
before acting outward (e.g. selling an item), it routes the
gesture through a `decision:*` rule, and the cascade performs the
gesture only after the internal vote passes (§6). When the acting
member is itself a sub-Collective, its own contract authorizes
its end first, recursively.

---

## 5. Membership — pure L2

Membership is a CoGra-side object with **no shared-graph
counterpart**: a **CollectiveMember overlay junction** per member
in CoGra's Memgraph overlay, plus Postgres display content
([nodes.md §3](../primitive/nodes.md#3-overlay-node-types-cogras-graph)).
Its layered overlay properties carry the internal structure:

- **`role`** — open vocabulary, collective-specific (`founder`,
  `shareholder`, `worker`, `subsidiary`, …); the vocabulary is
  implicit — the strings used in the governance map plus those
  assigned to active members.
- **`ownership_pct`** — where a role implies a stake; changes
  that move the 100% total ride composite decisions (§6).
- **`voting_weight`** — optional per-member override read
  directly at tally time.

Members can be Users or Collectives — sub-collective membership
is the same junction shape.

**Joining, leaving, removal** are internal decisions under the
social contract, executed as overlay/Postgres state changes:
admission per the contract's `decision:add_member` rule, leave at
the member's own request (never a vote), removal by the
contract's removal rule. History is preserved — junctions are
never deleted, state transitions are layered.

**What does reach the shared graph** is stance, not membership:
mutual member ↔ collective-Profile **Opinions** are ordinary
interpersonal fabric — they route in the feed and, when
vouch-positive, lift the collective's (or member's) standing.
They are organic signals with real weights, never membership
markers, and their absence breaks nothing.

---

## 6. The social contract

The contract is the Collective's `governance` map — per-decision
eligibility, weighting, threshold, and a per-entry `amend` triple
(governance of governance, scoped per rule). It lives as layered
overlay state on the Collective's CoGra-side carrier; the
machinery it parameterizes is the house governance pattern
([governance.md](../primitive/governance.md),
[proposal.md](proposal.md)).

**Decisions run at collective scope on L1**: the proposer authors
a Content anchor plus a `(0,0)` Reference to the subject (a
member decision points at the member's Profile, scope in the
anchor payload); voters — the members themselves, each with their
**own** actor — cast payload-marked ballot Opinions toward the
anchor; the tally is the contract's formula (role weights,
`ownership_pct` weighting, overrides) over the individual ballot
records, snapshot at the anchor's landing epoch; the
**finalization is authored by the Collective's own actor** —
Opinion `(0,0)` + payload (outcome, tally digest) toward the
anchor. Every internal vote is a priced public act; what the
overlay adds is the role and weight state the tally reads.

### Action keys and dispatch

Keys are constructed from the gesture, never invented ad hoc:
`decision:<operation>[:<role>]` for proposal-routed decisions
(member operations, `set:<field>` property changes, composite
operations like `admit_shareholder` / `transfer_shares` with
handler-validated `_from`/`_to` bundles, and gated outward
gestures like `decision:transfer:Item`); `actas:<gesture>` for
outgoing-gesture eligibility, with `actas:content_default` and
`actas:governance_default` as class-level fallbacks. Dispatch
walks most-specific → class-general → the in-prose defaults of
§4. A Collective declares only what it wants to override.

### No primitive defaults

Unlike chats, Collectives ship with no default map: creating a
Collective *is* writing its social contract. And hierarchy is
just a parameter choice — a contract giving the CEO sole
eligibility and threshold 1 on `decision:remove_member:worker`
expresses CEO-unilateral authority; the substrate doesn't pick a
power structure, the Collective does.

### Example configurations

Role vocabularies below are collective-specific; tables show
`exec` only.

**Corporate hierarchy** — founders, CEO, board, workers:

| `action_key` | `exec.eligibility` | `exec.threshold` |
|---|---|---|
| `decision:add_member:worker` | `role = CEO` | 1 vote |
| `decision:remove_member:worker` | `role = CEO` | 1 vote |
| `decision:add_member:board_member` | `role = founder`, weighted by `ownership_pct` | > 50% |
| `decision:remove_member:board_member` | `role IN (founder, board_member)`, `exclude_subject` | ≥ 2/3 |
| `decision:remove_member:CEO` | `role = board_member` | ≥ 2/3 |
| `decision:admit_shareholder` *(composite)* | `role IN (founder, shareholder)`, weighted by stake | ≥ 75% |
| `decision:transfer_shares` *(composite)* | `role = shareholder`, weighted by `ownership_pct` | ≥ 75% |
| `actas:author:Post` | `role = press_officer` *(overrides any-member default)* | — |
| `actas:vote:Proposal` | `role IN (CEO, board_member)` | — |
| `decision:transfer:Item` | `role IN (founder, board_member)` | ≥ 2/3 |

Amendment cost calibrates per rule: the CEO-can-hire entry might
amend at board majority while `transfer_shares` amends at ≥ 90%
of shareholders — each rule self-describes its mutability.

**Household (5 people)** — equal voice, consensus dominates:

| `action_key` | `exec.eligibility` | `exec.threshold` |
|---|---|---|
| `decision:add_member` | all active members | 100% cast, 100% quorum |
| `decision:remove_member` | all members, `exclude_subject` | ≥ 90% cast, 100% remaining quorum |
| `decision:transfer:Item` | all active members | 100% cast, 100% quorum |
| `actas:vote:Proposal` | all active members | — |

The two outward governance-acts split on how binding one
member's gesture is: a ballot the household casts in someone
else's tally is revisable while that tally is live, so voting is
delegated on trust; a settlement signature is consumed by the
transfer it enables ([items.md §4](items.md#4-transfer-the-settlement-handshake)),
so it routes through a unanimous decision.

**Worker co-op** — equal stake, officers for routine business:

| `action_key` | `exec.eligibility` | `exec.threshold` |
|---|---|---|
| `decision:add_member` | all active members | ≥ 2/3 |
| `decision:remove_member` | all members, `exclude_subject` | ≥ 2/3 |
| `decision:routine_operations` | `role = officer` | > 50% |
| `decision:change_capital_structure` | all active members | ≥ 75% |
| `decision:transfer:Item` | all active members | ≥ 2/3 |
| `actas:vote:Proposal` | all active members | — |

---

## 7. Items and shared ownership

The Collective's actor holds title like any actor —
`owner^(k)` names it, and its Accept/Ratify signatures run the
ordinary settlement flow ([items.md](items.md)). This is how
**shared ownership** works at all: the substrate has no
co-ownership, so the couple's car and the co-op's tools are
titled to a Collective, and the sharing *is* the membership.
Internal disputes resolve by the contract, never on the thread.

---

## 8. Lifecycle

- **Dissolution is a membership fact, not a graph one.** A
  Collective whose last member leaves has no one who can trigger
  its key — acting capacity is gone; the actor, its standing,
  its titles, and its history persist. Members can never *not*
  have existed: founding creates the founder's junction with the
  Collective, and the overlay history is append-only.
- **Deletion is the husk**, same as any account
  ([account-deletion.md](account-deletion.md)): identity
  association forgotten, Postgres tombstoned, payloads removed
  to the reduced projection; standing, title, and trust edges
  persist on L1.
- **Moderation** on a collective's profile content is payload
  removal + the verdict Tag, per
  [moderation.md](moderation.md); profile fields update via
  parallel Registration like any account
  ([user.md](../primitive/user.md)).

---

## 9. Economic role — no preferential treatment

Revenue follows graph topology, not actor type. A Collective
acts as an advertiser by authoring a campaign anchor, can be the
anchor a campaign targets, and earns as a contributor only
through records on live paths — the same attribution every actor
gets, under the same eligibility filter
([economics.md](../primitive/economics.md)). Commercial
collectives buy no placement; non-commercial ones lose nothing
by not buying.

---

## What this doc is not

- **Not the governance machinery.** Anchors, ballots, tallies,
  snapshots, and composite handlers live in
  [governance.md](../primitive/governance.md) and
  [proposal.md](proposal.md).
- **Not the account model.** The Actor + Profile pair, identity
  association, and the husk live in
  [user.md](../primitive/user.md) and
  [account-deletion.md](account-deletion.md).
- **Not the settlement flow.** [items.md](items.md).
- **Not the store schemas.** Overlay junction shapes and
  Postgres rows live in
  [graph-data-model.md](../implementation/graph-data-model.md)
  and [data-model.md](../implementation/data-model.md).
- **Not the auth path.** How a member's session authenticates a
  gesture that the Collective's key signs lives in
  [auth.md](../implementation/auth.md).
