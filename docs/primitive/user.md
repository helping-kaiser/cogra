# User

The **User** is a person's account: one PeerNetworks Layer 1
**Actor + Profile** grounded pair, anchored by the actor's own
Registration record, plus one Layer 0 address
([substrate-map.md §1](substrate-map.md#1-actors-and-identity)).
The map from the pair to the person behind it — credentials,
email, sessions — is CoGra service state, never graph state:
identity association is terminal by the L1 contract.

This doc is the account catalog: creation, L1-side and
CoGra-side state, records, lifecycle. In prose, "actor" means the
L1 Actor node; "account" means the CoGra service identity behind
it ([nodes.md §2](nodes.md#2-accounts-user-and-collective)).

---

## 1. User vs Collective

Both account kinds resolve to the same L1 shape — one Actor +
Profile pair, one L0 address — and Layer 1 treats them
identically: same record inventory, same intrinsic authorship,
same pricing. The distinction is what stands behind each on the
CoGra side.

- A **User** is a person. They hold off-graph credentials
  (password hash, verified email, refresh-token sessions — see
  [auth.md](../implementation/auth.md)) that authenticate their
  API requests, and their L1 signing key on their own device: the
  backend prepares and relays their records
  ([substrate.md §6](substrate.md#6-authoring-path-and-admission))
  but never signs for them.
- A **Collective** is a group acting through a single graph
  identity. Its keypair is creator-held with per-member co-signing
  ([collectives.md §2](../instances/collectives.md#2-custody)); its
  actions originate from authenticated Users authorized by the
  collective's social contract
  ([collectives.md](../instances/collectives.md)). Collectives can
  nest, so the chain may be deep.

Every Collective act ultimately traces to one or more Users: the
graph records the action as the Collective's own; the
authentication that produced it belongs to a User.

---

## 2. Creation

Two paths produce an account:

- **Admission (default).** CoGra admission is an **AND gate**
  ([substrate-map.md §1](substrate-map.md#1-actors-and-identity)):
  the person clears L1's write rule — a funded L0 burn to their
  own address, community- or self-funded
  ([economics.md](economics.md)) — **and** holds an accepted CoGra
  invitation, the mutual stance pair of
  [invitations.md](invitations.md). Registration is the L1 act:
  the actor's Registration record grounds the Actor + Profile
  pair; the inviter's Opinion toward the new Profile and the
  joiner's reciprocal Opinion connect them to the graph. Email is
  authentication and recovery only — never the gate.
- **Genesis bootstrap.** A fresh instance's genesis member is
  established by the bootstrap that also creates the system
  actors and the network charter
  ([network.md §2](network.md#2-creation)). No self-registration
  path produces the first account; all subsequent accounts come in
  via invitation.

**Invariant: no User before landing.** On the graph, an actor
either exists with full standing or does not exist — no
"unverified" or "pending" partial actorhood. Pre-landing state is
held off-graph: an account in the applicant state
([auth.md "Account states"](../implementation/auth.md#account-states));
the inviter's approval stages the Registration, the applicant's
device signs it, and only the confirmed record creates the User.
The invariant is an L2 registration rule — L1 sees only the
records once CoGra submits them
([auth.md "Account lifecycle"](../implementation/auth.md#account-lifecycle)).

---

## 3. Graph-side properties

The account's graph-side state splits across the seam
([substrate.md §3](substrate.md#3-cogras-stores)):

**On L1 — the Registration payload.** Profile content rides the
actor's Registration records as witnessed payload in the guild
keyspace ([nodes.md §1](nodes.md#1-l1-node-types-the-shared-graph)):
the profile field set and media digests, and the account's **CGT
payout address** — the reward-rail destination
([economics.md](economics.md), [token.md](token.md)). The payout
address is a pointer, never money: balances and payout state live
on CoGra's rail, off-graph
([ledger.md](../implementation/ledger.md)). Updating profile
content or the payout address is a **parallel Registration** —
same grounded pair, fresh payload, newest-wins per field
(`edge:nodes:registration`); every prior state stays witnessed.
"Newest" is chain-read: the current value is the head of the
declared causal-parent chain rooted at the **anchoring
Registration**, and a parallel Registration without its chain is
fold-ignored
([substrate.md §9](substrate.md#9-node-values-and-updates)).
The payout destination is thereby a public, actor-attributed
record: it cannot be silently swapped.

The L0 address is not graph state at all — it is the Layer 0
identity the actor burns to, read by L1 only as the scalar `B_i`.
One account = one L0 address, self-custodied.

**In the overlay.**

- **`network_role`** — `member` (default) / `moderator` /
  `collective`, a layered overlay property backing platform-wide
  governance ([network.md §8](network.md#8-membership-and-roles)).
  Moderator changes run through the multi-gate Proposal and are
  materialized as The Publisher's role Tag toward the Profile —
  the overlay property mirrors that public record
  ([network.md §9](network.md#9-mod-role-changes)).
- Operational per-account state (moderation flags, service
  bookkeeping) per
  [data-model.md](../implementation/data-model.md).

Cold start: with no vouches a fresh account's standing is exactly
its own commitment rate, `α = r` (`prop:epoch:final-standing-embedding`).
Registration is an ordinary final-set act whose stamp is that
rate, so the funded burn clears the write rule through the stamp;
vouches then lift or dilute standing from that baseline
([substrate.md §6](substrate.md#6-authoring-path-and-admission)).

---

## 4. Postgres-side content

The account's display material — display name, bio, avatar, cover
image, website URL — lives in Postgres, keyed by the Profile's
identifier: what a record *shows*, never what it *is*. Edits are
append-only version rows written in the same flow as the parallel
Registration that witnesses them
([layers.md §4](layers.md#4-layers-on-postgres-side-display-content)).
Concrete schema in [data-model.md](../implementation/data-model.md).

---

## 5. Records

### As author (outgoing)

The User authors records from L1's fixed inventory through the
backend: Opinions, Affinities, Publishes, Sends, Reviews,
References, Tags, Participants, Leaves, Join Requests,
Invitations, De-invites, and the settlement family. The
per-family catalog with CoGra's authoring semantics lives in
[edges.md](edges.md).

Compound gestures defined in other docs reduce to authoring
records: publishing content ([post.md](../instances/post.md)),
joining or leaving a chat
([substrate-map.md §4](substrate-map.md#4-conversations-and-membership)),
inviting a new member ([invitations.md](invitations.md)), casting
a ballot ([governance.md §3](governance.md#3-the-ballot)).

### As target (incoming)

Inbound records land on the **Profile** — the person-facing
anchor:

- **Opinions** — the interpersonal stance carrier; vouch-positive
  stances feed the target's standing through the standing projection
  ([substrate-map.md §3](substrate-map.md#3-stances-and-revision)).
- **References** — mentions: a positive, effortful mention is a
  weak, priced vouch
  ([substrate-map.md §3](substrate-map.md#3-stances-and-revision)).
- **Invitation T-legs** — chat invitations naming the invitee
  ([chats.md](../instances/chats.md)).
- **`(0,0)` References from proposal anchors** — Proposals about
  this person within a scope (a role change, a kick) name the
  Profile publicly
  ([governance.md §2.1](governance.md#21-subject)).

For traversal, Actor and Profile are one logical node — the
grounded-pair person fold; the pair's internal records are never a
feed input ([feed-ranking.md §4](feed-ranking.md#4-the-path-set)).

---

## 6. Authorship

Author binding is intrinsic to every L1 record — the authoring
actor is part of the record itself, not a separate edge or
derivation. Caches follow it; nothing can reassign it. See
[authorship.md](authorship.md).

---

## 7. Network membership

Every admitted account is automatically a member of the
[Network](network.md) — membership is the admission AND gate
itself, with no separate gesture and no junction. The
`network_role` overlay property carries the role; ballots on
Network-scope Proposals are the member's own payload-marked
Opinions ([network.md §10](network.md#10-network-wide-governance)).

Collectives carry `network_role = 'collective'` — a class label,
not a power: no ballots, no activity-count entry, no moderator
eligibility. Verdicts and governance eligibility remain
person-accountability surfaces
([network.md §8](network.md#8-membership-and-roles)).

---

## 8. Lifecycle

L1 records are permanent; an account is never deleted from the
shared graph. CoGra's removal paths are **pure L2 policy with the
payload-removal mark** — no L1 deletion gesture exists
([substrate-map.md §1](substrate-map.md#1-actors-and-identity)):

- **Per-content removal (user-initiated).** The author of a
  record removes its payload — a single record or a whole
  revision chain, profile revisions included — immediate,
  permanent, archived under a legal hold first
  ([erasure.md §1](../instances/erasure.md#1-per-content-removal)).
- **Account deletion (user-initiated) — the husk.** Identity-level
  (default): the person ↔ actor association is forgotten, Postgres
  display content is tombstoned, and payloads on identity-bearing
  records are removed to their reduced projection.
  Content-level (opt-in) adds payload removal on authored
  records. What remains is exactly the L1 husk: standing, title,
  and trust edges persist — names and words are gone. The L0
  address is self-custodied and untouched. Grace period, email
  confirmation, archive-first write ordering, and
  mention-to-marker resolution live in
  [erasure.md](../instances/erasure.md).
- **Moderation.** A passed classification against profile content
  or authored content runs the standard verdict flow
  ([moderation.md](../instances/moderation.md)); an `illegal`
  outcome removes the targeted record's payload with the visible
  mark. Redaction of authored content never propagates to the
  profile unless a Proposal targets it separately.

Future triggers — court order, next-of-kin under applicable
inheritance law — are listed in
[erasure.md](../instances/erasure.md) as planned
reusers of the same mechanism with their own authorization rules.

The grounded pair is stable through every reduction: records keep
pointing at the same Actor and Profile; a husked account is
anonymized, not removed.

---

## What this doc is not

- **Not the invitation mechanic.** The mutual-pair join relation
  and the inviter reward live in
  [invitations.md](invitations.md).
- **Not the network spec.** The charter, mod role changes, and
  platform-wide governance live in [network.md](network.md).
- **Not the authentication spec.** Credentials, sessions,
  registration flow, and password reset live in
  [auth.md](../implementation/auth.md).
- **Not the deletion mechanism.** The payload-removal primitive
  lives in [layers.md §5](layers.md#5-deletion-policy); the
  user-initiated paths live in
  [erasure.md](../instances/erasure.md).
- **Not the record catalog.** Per-family authoring semantics live
  in [edges.md](edges.md).
- **Not the storage schema.** Concrete overlay properties,
  columns, and indexes live in
  [data-model.md](../implementation/data-model.md).
