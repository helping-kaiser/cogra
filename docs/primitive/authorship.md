# Authorship

Authorship in CoGra is **intrinsic to every L1 record** — never
derived, never stored as an edge, never inferred from timestamps.
Each accepted record carries its author as part of its identity:
`author(e)` is a field of the record and a component of the
identity key
([layer1-interface.md §8.3](layer1-interface.md#83-the-edge-record-and-payload-carriage)).
There is no authoring edge, no author label, and no
earliest-incoming-edge rule — the question "who authored this?"
is answered by reading the record, not by traversing anything.

**"Creator" and "author" are the same fact; "author" is
canonical.** The stance parameters on an authoring record are the
author's real stance riding the same act — attachment on a
Publish, enthusiasm and effort on a Review — separate from the
author binding itself, and defaulted low like every stance
([invitations.md §3](invitations.md#3-default-values-and-customization)).

---

## Node creators

A minted node's creator is fixed at genesis by its minting
record's author — declarative, immutable, part of the node's
identity forever:

| Node | Creator = author of |
|---|---|
| Content (Post) | its Publish record |
| Item | its genesis Owner record |
| Chat | its founding Participant record |
| Comment | its minting Review hyper-edge |
| Message | its minting Send hyper-edge |
| Offer | its minting Bid hyper-edge |

The grounded pair (Actor, Profile) is anchored by the actor's own
self-signed Registration. A **Type has no author** — it is a
named commons, anchored vacuously
([hashtag.md](../instances/hashtag.md)).

---

## Author is not owner, and not founder

- **Author ≠ owner.** An Item's creator is the actor who listed
  it, immutable; its **owner** is `owner^(k)` — the published
  title certificate, changing with each settled transfer.
  **Title is consume-only: CoGra reads the certificate and never
  authors ownership** ([items.md](../instances/items.md)).
- **Author ≠ founder.** "Founder" is a role string inside a
  Collective's social contract — CoGra-side membership state.
  The shared graph does not record who founded a Collective; the
  Collective's own records are authored by the Collective's
  actor, full stop.

---

## Collective-authored records

When a Collective authors, `author(e)` is the Collective's actor.
The gesture was initiated by some authorized member under the
act-as rules, but **no acting-member identity exists on the
record, deliberately** — accountability lives in the social
contract
([collectives.md §4](../instances/collectives.md#4-acting-through-the-collective)).
Querying authorship returns the Collective; the initiating member
is not derivable from the shared graph.

---

## What consumes authorship

- **The feed's person fold.** The ranker treats Actor + Profile
  as one logical node, and record authorship is what folds an
  author-side path onto the person
  ([feed-ranking.md](feed-ranking.md)).
- **The reference channels.** A Reference's citation leg crosses
  content-intrinsically only when the reference's author owns the
  carrier, and otherwise only through the reference's author —
  authorship is the gate on both channels
  ([feed-ranking.md §4](feed-ranking.md#4-the-path-set)).
- **Attribution.** Reward splits resolve each path's distinct
  authors from the records on it; eligibility excludes paths
  carrying an ineligible author's records
  ([economics.md](economics.md)).
- **Edit folds.** Every node-value fold reads eligibility against
  record authors — creator-only for content bodies, the certified
  owner for items, declared sets for chats
  ([substrate.md §9](substrate.md#9-node-values-and-updates)).
- **The credit obligation.** `a = 1` license qualifiers oblige
  CoGra to credit the author on every display, quote, and
  reference surface
  ([platform-guidelines.md §5](../instances/platform-guidelines.md#5-license-and-provenance-obligations)).

Authorship survives everything: payload removal and account
deletion erase names and words, never the author binding — the
husk's records remain its records
([erasure.md](../instances/erasure.md)).

---

## The Postgres author column

`author_id` on Postgres rows (`posts`, `comments`,
`chat_messages`) is ordinary denormalized display data, written
in the same flow as the record — authorship is intrinsic and
known at submission, so there is nothing to derive and no rebuild
machinery; the record remains the truth in any disagreement
([data-model.md](../implementation/data-model.md)).

**Economics never reads Postgres.** Attribution and payouts
resolve authors from the records on the paths they walk; a wrong
`author_id` could affect display ordering at most, never what
anyone is paid.
