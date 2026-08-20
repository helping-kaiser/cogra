# Collectives

A **Collective** is any group of people that needs a single graph
identity to act through — a household, a band, a co-op, a studio,
a partnership, an NGO, a company. On the substrate a Collective is
**one L1 Actor + Profile** — an ordinary grounded pair
([substrate-map.md §1](../primitive/substrate-map.md#1-actors-and-identity);
key custody: §2). **L1's math reads nothing about its internals —
but the internals are public.** Membership, roles, stakes, and the
social contract all ride payload-marked records with published
folds (§5, §6), replayable by anyone from the shared record set.
Nothing about a collective is graph-private by design: a group
that wants its structure secret keeps it off the graph entirely —
a bare collective actor — rather than trusting a half-open scheme
that publishes flows while hiding values.

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
   avatar digests) — and the social contract itself (§6) — ride
   the Registration payload, display rows in Postgres.
5. The **connectivity pair** completes founding: the founder's
   real-stance Opinion toward the collective's Profile and the
   collective's Opinion back toward the founder's Profile — the
   same mutual-pair geometry an invited person gets, so the new
   collective is reachable in viewers' feeds and its own forward
   cone is non-empty. The founder's side is a vouch-positive
   person stance: the burn funds the collective's own acts (W1
   reads only its own balance), and the founder's vouch lifts its
   standing as an external positive-rate source. This pair is
   stance fabric, **not** the
   CoGra-join relation — no referral fires (§9).

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

The Collective's key is **creator-held, with per-member
co-signing** — the backend never holds a complete key. What
custody protects is graver here than in a rewritable system: a
compromise means **signed L1 records** — permanent, publicly
attributed acts of the Collective — not database rows anyone
can fix.

**The creator holds the full key.** Founding a Collective is
taking custody of it: the key is generated on the creator's
device, never enters CoGra custody, and rides the same recovery
posture as a user key
([auth.md "Key recovery"](../implementation/auth.md#key-recovery)).
The creator can always act alone — and their key is the
Collective's escape from a backend that stops cooperating.

**Every other act-as-eligible member signs by 2-of-2
co-signing.** At onboarding, the creator's device splits the key
into two fresh random halves — one to the member's device, one
to the backend — an independent split per member. The full key
is never assembled anywhere: either half alone is noise, so
neither the backend nor the member can sign by themselves. A
member need not be a person: a Collective can be a member of a
Collective, and custody **recurses** — the member-side half is
held under the member Collective's own custody arrangement,
bottoming out at human devices.

**The backend's half is the contract gate.** A member triggers a
collective act with an instruction signed by their **own** key —
a person's user key, or a member Collective's key via the same
machinery — the client-signed authoring path applied to the trigger
([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission));
the backend contributes its half of the signature only after
checking the instruction against the governance map (§6):
action-key eligibility, and a passed decision where the contract
requires one. No member can sign around the contract; the worst
a hostile backend can do is refuse. The instruction is
operational state, not graph state — on the shared graph the
Collective's actor signs alone, per §4's
no-per-record-attribution rule.

**Membership change is share hygiene, not re-keying.** Removing
a member is one deletion — the backend discards its half for
that member, and the member's half is permanently useless. A
lost member device costs nothing: the creator issues a fresh
split. No event in the membership fold ever forces a key
rotation.

Two dependencies are open with the L1 team
([open-questions.md Q30](../open-questions.md#q30--l1-key-model-signature-scheme-and-actor-key-rotation)):
the signature scheme L1 verifies (a Schnorr-family scheme makes
the 2-of-2 a standard threshold-signing configuration), and
actor key rotation — same actor, new key — without which a
compromised creator key is unfixable. Until the splits ship,
backend custody remains the implementation stopgap.

---

## 3. Four authorities, kept apart

Four independent questions govern what a Collective can do. They
have four different homes, and conflating them is the classic
design error:

| Authority | Question | Home |
|---|---|---|
| **Protocol standing** | May its actor write to the shared graph at all? | L1's alone — the write rule over its balance and stamps, its standing from real endorsement. Membership never enters it. |
| **Membership** | Who is in the Collective, with what role and stake? | CoGra's to define — a published fold over payload-marked records (§5); public on the shared graph, read by no L1 rule. |
| **Subsidy** | Who pays its θ-debits? | Governed policy — Collectives draw on the community treasury, within the governed generosity and caps ([economics.md](../primitive/economics.md)). |
| **Self-funding** | Can it stand on its own? | Always open — an L0 burn to the collective's address is funder-unconstrained; a self-funded Collective is indistinguishable from a subsidized one at the comparator. |

A Collective the community defunds (severance netting its
inbound stances to `(0,0)`) falls back to its own commitment
rate — the standing its treasury-funded burns buy, every
relational lift gone (`prop:epoch:final-standing-embedding`) — no
matter how healthy its internal membership; a thriving internal
membership buys no protocol standing by itself. Each authority is
earned and lost on its own terms.

---

## 4. Acting through the Collective

A Collective takes no gestures by itself: every record attributed
to it is initiated by an authorized member — a User, or a
sub-Collective acting recursively through its own authorized
members. On the shared graph the Collective's actor signs;
**Invariant: no per-edge record of the acting member exists,
deliberately.**
Accountability for who may trigger the key lives in the social
contract, not in per-record attribution — and internally holding
members accountable is likewise the contract's business.

Two coarse gesture classes, with opposite defaults —
**content-acts default permissive, governance-acts default
deny** (the asymmetry reflects reversibility):

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

## 5. Membership — a public fold

Membership is **computed from public records, stored nowhere**.
The mechanism is the payload-fold pattern that ballots and edits
already use ([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates)):
payload-marked `(0,0)` Opinion records, read individually by a
published fold — routing-inert, vouch-inert, replayable by
anyone.

- **The member's side** — a payload-marked `(0,0)` Opinion toward
  the collective's **Profile**: join, and later leave, as
  newest-wins states on the member's own `≺`-chain. Leave is
  unilateral — no approval, no vote.
- **The collective's side** — a payload-marked `(0,0)` Opinion
  toward the member's Profile: acceptance, and later revocation.
  Both are **decision-backed**: the payload cites the anchor of
  the passed internal decision that authorized the record
  (`decision:add_member`, `decision:remove_member` — in whatever
  shape the contract gives those entries, from CEO-unilateral
  threshold-1 to full consensus), and **the fold recognizes only
  decision-backed records** — the same recognition discipline the
  chat fold applies to De-invites
  ([chats.md §4](chats.md#4-membership)).
- **The fold:** member iff both sides' newest membership-marked
  records agree — the member's newest is a join and the
  collective's newest is an acceptance. Order-free: either side
  may move first (application vs. invitation); membership
  materializes when the chains agree. A kick is the collective's
  decision-backed revocation; re-joining afterward requires a
  fresh agreement of both chains.

**Roles and stakes ride the collective's records.** The
acceptance and later update payloads carry the member's **role
set**, `ownership_pct`, and any `voting_weight` override —
newest-wins per member per field — so the collective's entire
internal structure is public and replayable, tallies included.

- **Multiple roles are the norm** — one member's role set can be
  `{founder, board_member, CEO}`. Eligibility predicates test
  set membership; where several of a member's roles appear in
  one entry's weighting, the **highest applicable weight**
  applies — summing would double-count the person.
- **Sub-collectives:** a member may itself be a Collective; its
  membership records are authored by its own actor, recursively.
- **Costs:** both sides' records are `θ`-priced acts — the
  member's community-funded, the collective's treasury-funded
  ([economics.md](../primitive/economics.md)).

**What is *not* membership:** real-stance Opinions between
members and the collective's Profile — including the founding
mutual pair (§1) — are ordinary stance fabric: they route, they
vouch, they lift standing. The membership records are `(0,0)` and
do none of that. Same family, distinguished by the payload mark —
read individually, never through the netted bundle.

---

## 6. The social contract

The contract is the Collective's `governance` map — per-decision
eligibility, weighting, threshold, and a per-entry `amend` triple
(governance of governance, scoped per rule). The contract itself
is **public, payload-borne state**: it rides the collective's
**Registration payload** — the profile-content idiom — with
amendments as parallel Registrations whose payloads cite the
authorizing `amend` decision anchor, newest-wins per entry.
Overlay and Postgres hold only operational mirrors and display.
The machinery the map parameterizes is the house governance
pattern ([governance.md](../primitive/governance.md),
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
anchor. Every internal vote is a priced public act, and the role
and weight state the tally reads is itself public — the
membership fold (§5) — so a collective-scope tally is
world-verifiable end to end.

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
  have existed: the membership record chains (§5) are permanent
  public history.
- **Deletion is the husk**, same as any account
  ([erasure.md](erasure.md)): identity
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

A collective has **no inviter**: the 1% inviter share tied to its
earnings falls back to burn
([economics.md §7.3](../primitive/economics.md#73-the-inviter-reward)) —
deliberately. A collective's makeup can drift arbitrarily far
from its founding cast, so no one holds a permanent claim on its
earnings; and since the share is carved from burn rather than
from the earner's payout, earning through a collective gains
nobody anything either way.

---

## What this doc is not

- **Not the governance machinery.** Anchors, ballots, tallies,
  snapshots, and composite handlers live in
  [governance.md](../primitive/governance.md) and
  [proposal.md](proposal.md).
- **Not the account model.** The Actor + Profile pair, identity
  association, and the husk live in
  [user.md](../primitive/user.md) and
  [erasure.md](erasure.md).
- **Not the settlement flow.** [items.md](items.md).
- **Not the store schemas.** Mirror shapes and Postgres display
  rows live in
  [data-model.md](../implementation/data-model.md).
- **Not the auth path.** How a member's session authenticates a
  gesture that the Collective's key signs lives in
  [auth.md](../implementation/auth.md).
