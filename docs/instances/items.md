# Items

An **Item** is a physical or digital good — something that can be
owned, transferred, and talked about. On the substrate an Item
*is* an L1 **Item** node, and ownership is **L1's settlement
machinery adopted wholesale**
([substrate-map.md §6](../primitive/substrate-map.md#6-items-and-ownership)):
the ownership thread of Owner / Bid / Accept / Ratify records,
folded at every epoch boundary into the published title
certificate `owner^(k)`. **CoGra never authors title — it reads
it.** No ownership junction, no transfer proposal, no CoGra-side
ownership state exists.

Marketplace flows aren't the focus of the first CoGra iterations
(posts and chats are), but the ownership model and the money seam
below are committed; the rail build is sequenced in
[roadmap.md](../implementation/roadmap.md).

---

## 1. Creation (listing)

Listing a good is the author's **genesis Owner** record
(Actor → Item): its act identifier mints the Item and roots the
ownership thread
(`def:graph:item-genesis-act`,
[layer1-interface.md §7.2](../primitive/layer1-interface.md#72-settlement-recognition)).
Like Publish, Owner is a single-parameter family — `p_d` = the
attachment `a`, `p_i` fixed at `1` — and **title is
sentiment-blind**: an `a = 0` Owner still anchors the thread,
routing-inert but title-bearing.

Item **identity is declarative**: the Item *is* its genesis
record. Two actors listing "the same" real-world good create two
Items with two independent threads — title at L1 is title over a
**registered claim**, never custody of a referent; the mapping
from claim to physical object is a social fact, deterred from
abuse by accountability cost.

Name, description, and media digests ride the payload envelope;
license qualifiers are declared at authoring time; Postgres
display rows and the mirror are derived surfaces — all exactly as
for a Post ([post.md §1](post.md#1-creation)). A Collective lists
through its own actor ([collectives.md](collectives.md)).

---

## 2. Items as content

An Item is a full content surface, independent of its
marketplace role: **Opinion** stances (like/dislike, full
vocabulary), **Review** commentary
([comment.md](comment.md)), **Tag** topics — the lister's own or
third-party ([hashtag.md](hashtag.md)), and **Reference** quotes/embeds from
other artifacts — all native, all feed-visible
([feed-ranking.md](../primitive/feed-ranking.md)).

---

## 3. Ownership and title

The **ownership thread** is the boundary-indexed chain rooted at
the genesis Owner record, extended at each epoch boundary by the
title fold; the **title certificate** `owner^(k)` maps each Item
to the thread's terminal actor and is published by L1 alongside
the epoch certificate.

**Invariant:** CoGra's posture toward title is strictly
**consume-only**:

- The current owner of any Item is a certificate lookup, never a
  graph traversal and never a CoGra-stored fact.
- Authorship and ownership are distinct: the lister (`creator`
  of the genesis record) is immutable; `owner^(k)` changes with
  each settled transfer.
- An Owner record not reachable from genesis through boundary
  transfers is *orphaned* — it persists (append-only) but
  carries no title force. Nobody can write themselves into a
  thread.
- Title never lapses. A deleted account's husk still holds its
  titles ([erasure.md](erasure.md)); transfer
  out of a husk follows the same settlement flow as any other,
  requiring the key holder's records.

---

## 4. Transfer: the settlement handshake

The `Bid → Accept → Ratify` sequence **is** the transfer flow —
three authored, priced records, plus two cancel families. No
state changes through inaction, counting, or timeout; cleanup is
an authored choice.

1. **Bid** (Actor → Item → Offer) — the buyer's offer; the
   terminal leg mints the **Offer** node. Signed generosity and
   urgency ride the act; a predatory Bid is stance-visible per
   leg.
2. **Accept** (seller → buyer) — the owner's consent, carrying a
   settlement reference to the Bid act's identifier. Not binding
   alone.
3. **Ratify** (buyer → seller) — the buyer's commit, its
   settlement reference matching the Accept's, plus a reference to
   the exact Accept act it confirms.
4. **Withdraw** (buyer → Offer) / **Rescind** (seller → Offer) —
   the cancel records; control records, no sentiment.

**Title moves at the epoch certificate, not at the Ratify.** At
each boundary, a candidate triple is recognized iff the six
clauses of settlement recognition hold — completeness, pointer
binding, authorization (the Accept's author is the certified
owner at the prior boundary — the straddler that reads title back
into admission), buyer consent, seller consent, well-formedness
([layer1-interface.md §7.2](../primitive/layer1-interface.md#72-settlement-recognition)).
The consequences CoGra's UX must surface honestly:

- **The regret window.** Consent is epoch-quantized: a Withdraw
  or Rescind co-epochal with (or earlier than) the Ratify defeats
  the sale; one in a strictly later epoch is inert. Until the
  boundary certificate, either side can still walk.
- **Ties consume.** Conflicting co-epochal commits from one owner
  consume *all* candidates without transfer — the incumbent
  retains title, and the Item stays fully transferable at later
  boundaries. Mutual invalidation, not permanence.
- **Consumption is permanent.** A consumed candidate can never
  found recognition again; retrying a failed purchase requires
  fresh records, each a priced act.
- **First epoch wins.** A Ratify landing one boundary after a
  competitor's transfer fails the authorization clause — the
  owner changed under it.

There is no "take" operation anywhere: every transfer runs
through the owner's own Accept.

---

## 5. Commercial reputation

CoGra **adopts L1's terminal default** as its published read
rule: positive commercial reputation on a settled trade holds iff
all three stance marginals are positive — buyer generosity
(Bid), seller comfort (Accept), buyer confirmation (Ratify) — a
conjunction over stances, never the parity product (which would
reward predatory-meets-coerced)
(`rem:graph:settlement-reputation`).

Commerce also leaves ordinary interpersonal fabric: Accept and
Ratify are actor-directed records, and stance-positive ones are
person-vouch acts like any other — good-faith trade is part of
how standing grows
([layer1-interface.md §11.3](../primitive/layer1-interface.md#113-stance-aggregation-and-the-person-vouch-relation-layer)).

---

## 6. The money seam

L1 holds no value, locks nothing, adjudicates nothing — it
records Offers and ownership changes. The money side is CoGra's,
on the CGT rail, and it never becomes a graph object — a
transfer is purely rail-side:

- **The asking price is a field of the Item** — it rides the
  payload like name and description, updated through the edit
  fold under the current certified owner's authorship (§7):
  witnessed, public, newest-wins, and portable — any L2 reading
  the records sees the listing. The **offered price is a term on
  the Bid payload** — witnessed, public, part of the offer the
  seller accepts. Both are numbers the records pin; money never
  appears on the graph.
- **Fund-at-Bid.** The buyer's escrow is locked on the rail
  before the Bid lands, and the Bid payload carries the escrow
  pointer — an offer is funded, willing capital, never a free
  option. Cancelling is the ordinary Withdraw — the offer dies
  instantly on L1 — and the refund follows on the platform's
  next attestation sweep.
- **Payment releases against the epoch certificate** in which
  the settlement is recognized and title-transferring — the
  deterministic commit anchor — never against the Ratify, which
  is inside the regret window. The escrow is a fixed-destination
  two-branch covenant: each party can move money only away from
  itself, and the platform only attests which legitimate outcome
  occurred — shape, oracle role, and the liveness-not-safety
  residual live in
  [ledger.md](../implementation/ledger.md#the-marketplace-rail).
- **No per-sale fee.** Protocol income realizes at the CGT gate —
  the ladder's spread — never inside the flow
  ([economics.md §7](../primitive/economics.md#7-the-conservation-equation)).

Ownership rides L1 settlement regardless — a barter or gift
transfer needs no rail at all. Items are also deliberately
**outside the tipping surface**: a tip resolves to an author,
and for a good the certified owner and the genesis author can
diverge ([ledger.md](../implementation/ledger.md#tipping)).

---

## 7. Editing

The node-value update rule
([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates)),
instantiated for Items:

- **Carrier:** Opinion `(0,0)` + payload toward the Item.
- **Eligible author:** the **current certified owner** —
  `owner^(k)` as of the edit record's landing epoch (the lister,
  initially). Ownership changes hands; the editing right follows
  the certificate, and a superseded owner's later edit records
  are written but never win the fold.
- **Granularity:** per field — name, description, media
  manifest, asking price (§6).

The genesis record, the thread, and the license qualifiers never
edit; every edit is a priced act with public history.

---

## 8. Shared ownership routes through a Collective

**Invariant: single owner.** `owner^(k)` maps each Item to
**one** actor — the substrate has no co-ownership. Sharing routes through a **Collective**: the
collective's single actor holds title, and the sharing — a
couple's car, a co-op's tools, a band's equipment — is the
collective's own membership and social contract
([collectives.md](collectives.md)). Internal disputes are
resolved by collective governance, never by parallel claims on
the thread.

---

## 9. Lifecycle

Item nodes and every settlement record are permanent. Content
removal is payload removal to the reduced projection — triggered
by moderation verdicts only; goods are not first-person
expression, so self-service erasure never reaches Items — neither
per-content removal nor content-level account deletion
([moderation.md](moderation.md),
[erasure.md](erasure.md)). Identity, pointer
resolution, and **title survive every payload state** — a
fully-reduced Item still has an owner, a thread, and a
tradeable claim.

---

## What this doc is not

- **Not the settlement spec.** The recognition predicate, the
  title fold, order-freeness, and the frontier caveats live in
  [layer1-interface.md §7.2](../primitive/layer1-interface.md#72-settlement-recognition).
- **Not the marketplace rail.** Escrow shapes, the covenant, and
  transaction mechanics live in
  [ledger.md](../implementation/ledger.md#the-marketplace-rail).
- **Not the update rule.** Fold semantics live in
  [substrate.md §9](../primitive/substrate.md#9-node-values-and-updates).
- **Not the edge catalog.** Family semantics and census pointers
  live in [edges.md](../primitive/edges.md).
- **Not the store schemas.**
  [data-model.md](../implementation/data-model.md).
