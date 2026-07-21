# Hashtag

The **Hashtag** is CoGra's topic surface. On the substrate a
hashtag *is* an L1 **Type** node — a named semantic anchor
([substrate-map.md §2](../primitive/substrate-map.md#2-content)).
Type identity is **named**: the node is `name(s)`, compared by
byte equality, anchored vacuously
([layer1-interface.md §9.3](../primitive/layer1-interface.md#93-node-types)).
A Type is a **commons** — nobody authors it, nobody owns it, and
every L2 that references the same byte string touches the same
node. That one fact drives everything else in this doc.

Types are not only hashtags: moderation verdict categories and
role names ride the same node type
([moderation.md](moderation.md),
[network.md](../primitive/network.md)). This doc covers the
mechanism once, from the topic angle.

---

## 1. Identity and the naming service

L1 compares names by **byte equality** and nothing else —
`#BotDefense` and `#botdefense` would be two unrelated Types.
Canonicalization is therefore CoGra's job, the **L2 naming
service**:

- **Normalization.** Tag strings are normalized (lowercase, no
  `#`) before any record is submitted, so every CoGra-authored
  reference to a topic lands on the canonical Type.
- **The registry.** CoGra keys its own stores by
  `UUIDv5(HASHTAG_NAMESPACE, canonical_name)` — a deterministic
  function of the name, so the Postgres registry row and every
  cache agree with the L1 identity by construction. The
  namespace UUID and the normalization rule are load-bearing
  schema: changing either strands every previously derived key
  ([data-model.md](../implementation/data-model.md)).
- **Reserved names.** The bootstrap names (`moderator`,
  `illegal`, `sensitive`, `bot-defense`) are seeded CoGra-side
  in the registry with the same content-addressed keys — stable
  regardless of when each name first lands on L1
  ([network.md](../primitive/network.md)).

Cross-instance identity needs no reconciliation at all: the Type
is a commons on the shared graph itself. Two L2s that have never
communicated and tag `bot-defense` are already tagging *the*
`bot-defense` node — by L1's identity algebra, not by any
federation protocol.

---

## 2. Creation

There is no creation gesture. A Type is anchored **vacuously**:
it exists as soon as some accepted record references its name in
an endpoint field, and semantically every reference to a name is
a reference to the same node regardless of which record came
first. No actor authors a Type, no `θ` is paid for the Type
itself — the referencing act (a Tag, an Affinity) is the priced
record. There is nothing to approve, nothing to own, and no
author for account deletion to touch.

---

## 3. Acts around a Type

- **Tagging content** — the **Tag** hyper-edge
  (Actor → content → Type), authored by the content's author,
  at creation or later; relevance and confidence ride the act
  ([edges.md §3](../primitive/edges.md#3-hyper-edge-families-cogra-authors)).
  This is how a Post, Comment, Message, or Item declares its
  topics.
- **Following a topic** — an **Affinity** record (Actor → Type):
  relevance, not verdict — its sign is coherence, never a
  standing vouch. Affinity is the follow gesture the topic feed
  reads (§4).
- **Stances** — Opinion → Type is native: liking or rejecting a
  topic is an ordinary graph act, full vocabulary. The old
  no-actor-edges-to-Hashtag prohibition is gone — what it
  protected against is handled as feed policy, not topology
  (§4).
- **Commentary** — Reviews of a Type mint Comments like
  anywhere else and change nothing about the Type: no semantics,
  no tags, no standing, no gates
  ([comment.md](comment.md)).
- **References** — a Message or any other artifact citing a
  topic does so with a Reference targeting the Type.

---

## 4. Feed role

**Types are forward-traversal sinks — CoGra's declared traversal
policy.** A ranking path may end *at* a Type (topics are rankable
targets) but never continues *through* one — even though the L1
census gives Types outgoing legs, CoGra's path set excludes them
as transit ([feed-ranking.md](../primitive/feed-ranking.md)).
That policy is what killed the old hashtag-amplifier fear: a
popular topic aggregates reach for itself, never relays it into
somebody's content.

The **topic feed** is a named opt-in read-side feed: content
surfaced over Tag records toward the viewer's followed
(Affinity) Types, ranked by the same primitive as everything
else. The default feed stays untouched by follows
([feed-ranking.md](../primitive/feed-ranking.md)).

---

## 5. Moderation and lifecycle

A Type has no records of its own — nothing mints it, no payload
rides it — so there is **nothing to remove**. Its name is not
payload either: the byte string is a structural endpoint
identifier inside every referencing accepted record, and
accepted records are immutable. An offensive tag name therefore
**cannot be erased from the shared graph** — suppression is
read-side, CoGra's own:

- **The verdict mark** is The Moderator's **Tag `(0,0)` +
  payload** toward a named moderation Type — substrate-visible,
  newest per (target, Type)
  ([moderation.md](moderation.md)).
- **Rendering** follows the verdict: an `illegal`-marked topic
  name is not rendered on CoGra surfaces (chips, autocomplete,
  search suggestions); the registry row is tombstoned per
  [moderation.md](moderation.md).
- **`sensitive` is a passive filter on incidental exposure, not
  a block on intentional retrieval.** A viewer whose filtering
  level screens sensitive content sees no topic chip on tagged
  content; typing the exact name still resolves — direct
  retrieval is a deliberate act.

The redaction cascade does not propagate across Tag records in
either direction: marking a topic does not touch the content
tagged with it, and vice versa.

---

## What this doc is not

- **Not the naming-service schema.** The registry-row shape,
  namespace fixity, and key derivation live in
  [data-model.md](../implementation/data-model.md).
- **Not the feed-ranking spec.** How the topic feed composes,
  what "sink" means for the path set, and the opt-in feed
  taxonomy live in
  [feed-ranking.md](../primitive/feed-ranking.md).
- **Not the moderation mechanism.** Verdict flow and tombstone
  mechanics live in [moderation.md](moderation.md).
- **Not the edge catalog.** Tag, Affinity, and Reference
  semantics with census pointers live in
  [edges.md](../primitive/edges.md).
