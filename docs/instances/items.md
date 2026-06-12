# Items

An **Item** is a content node representing a physical or digital good
— something that can be owned, transferred, and talked about. Items
are interactable content: they can be liked, disliked, commented on,
and tagged with hashtags.

Marketplace-like Item flows aren't the focus of the first CoGra
iterations (posts and chats are), but the Item and ItemOwnership
model below is committed: shipping order is sequenced, the design
is not deferred.

This doc covers two related nodes — the **Item** content node and
the **ItemOwnership** junction node — plus the convention for
shared ownership through a Collective.

---

## 1. Creation

An Item is created by a single compound gesture from one actor —
either a User or a Collective. Unlike a Post, Item creation is
**compound**: it brings the Item AND the author's first
ItemOwnership into existence in one atomic step, with the author
as the initial owner. There is no separate "list" then "claim
ownership" flow.

The gesture writes the following records atomically:

- A new `:Item` node on the graph.
- The Postgres `items` entity row plus the first `item_versions`
  row carrying the name and description
  (see [data-model.md](../implementation/data-model.md)).
- `item_attachments` rows for each piece of attached media (zero
  or more).
- An actor edge from the author toward the Item — the
  **authorship edge** (§5). Its `(dim1, dim2)` values are the
  author's initial opinion of their own item, typically high
  positive sentiment and relevance.
- A new `:ItemOwnership` junction node for the author.
- The `ItemOwnership → User/Collective` `:BEARER` structural
  edge, binding the junction to the author.
- The `ItemOwnership → Item` claim edge.
- The `Item → ItemOwnership` approval edge with positive top
  layer (`dim1 > 0`).
- The author's `bearer → ItemOwnership` `:AUTHOR` edge, which
  authors the junction (§5).

With no prior owner to cast a Shape B vote, the
[junction lifecycle](../primitive/graph-model.md#5-junction-node-flows)
collapses to its `N = 0` special case: the author's Shape A
self-claim is the only required vote, no admit-Proposal node is
materialized, and the system writes both structural edges
atomically alongside it. Same bootstrap shape as the founder's
`CollectiveMember` in
[collectives.md "Creation"](collectives.md#1-creation) and the
founder of a Chat in
[chats.md §2.1](chats.md#21-chat). Subsequent transfers run
through a transfer-Proposal (§6).

A Collective creating an Item is the same gesture: the graph
records the Item as the Collective's, and the off-graph
authentication that produced it traces — possibly through nested
CollectiveMember chains — back to one or more Users with active
sessions per
[user.md §1](../primitive/user.md#1-user-vs-collective) and
[auth.md](../implementation/auth.md). Whether member consent is
required is determined by the Collective's social-contract
treatment of content-acts per
[collectives.md "Acting through the Collective"](collectives.md#2-acting-through-the-collective).

---

## 2. Graph-side properties

### Item

An Item node carries only what the graph needs to traverse,
filter, and rank. Substance lives in Postgres (§3).

The Item carries per-field moderation-status properties on
**`name`**, **`description`**, and **`attachments`** (every
attached media under one status — see
[moderation.md §5](moderation.md#5-scope) on per-attachment
targeting), plus the node-level `moderation_status` cache. The
Item's `name` has no graph-side uniqueness or content-addressing
requirement (unlike `User.username` or `Hashtag.name`), so the
per-field property uses the field name directly with no separate
data sibling — the actual name string lives in Postgres (§3).
Universal mechanics in
[nodes.md](../primitive/nodes.md#universal-per-field-moderation-status);
Item-specific cascade in §8.

The current owner is **not** stored as a property on the Item;
it is derived from the single ItemOwnership whose
`Item → ItemOwnership` approval edge has a positive top layer
(§7). Concrete property types and indexes live in
[graph-data-model.md](../implementation/graph-data-model.md).

### ItemOwnership

ItemOwnership carries no per-instance properties beyond its
`id` — transfer state lives entirely in the surrounding edges
(claim, approval, and supersession layers per §§6-7). Bearer
identity rides on the `ItemOwnership → User/Collective`
`:BEARER` edge written at creation; see §1 and
[edges.md §2 "Bearer binding"](../primitive/edges.md#bearer-binding).
Concrete types and indexes live in
[graph-data-model.md](../implementation/graph-data-model.md).

---

## 3. Postgres-side content

### Item

An Item's display content lives in Postgres, linked to the graph
node by UUID. Edits are append-only per
[layers.md §4](../primitive/layers.md#4-layers-on-postgres-side-display-content):
a new version row, no overwrite.

- **`name`** — required. The handle the Item is listed under.
  Stored on `item_versions` rows.
- **`description`** — optional body text. Stored on
  `item_versions` rows.
- **Attachments** — images and other media via the
  `item_attachments` junction table, which carries per-attachment
  `display_order` and an optional `is_cover` flag analogous to
  `post_attachments`. Each row references one `media_attachments`
  asset, owned by the same author as the Item (anti-hijack rule
  per
  [data-model.md "Why parents point at attachments"](../implementation/data-model.md#why-parents-point-at-attachments)).

Concrete schema lives in
[data-model.md](../implementation/data-model.md).

### ItemOwnership

None. ItemOwnership is a pure graph-side junction node — no
Postgres-side display content, no author-bearing row.

---

## 4. Edges

Dimension labels, sub-category labels, and traversal semantics
live in [edges.md](../primitive/edges.md).

### 4.1 Item

#### As source (outgoing)

An Item is not an actor and authors no actor edges. It carries
two outgoing structural edge types, both system-created:

- **`Item → ItemOwnership` (`:APPROVAL`)** — the approval side
  of the two-edge state pair. Written by the transfer-Proposal's
  cascade when the current owner's approval satisfies the policy
  (§6). **State transitions on
  this edge are the supersession mechanism described in §7**:
  when a subsequent transfer completes, the previous
  `ItemOwnership`'s `Item → ItemOwnership` top layer flips to
  `dim1 < 0` automatically. This Edges section catalogues only
  the edge type and direction; the layer mechanics live in §7.
  See
  [edges.md §2 "Approval completion"](../primitive/edges.md#approval-completion).
- **`Item → Hashtag` (`:TAGGING`)** — one edge per hashtag the
  Item is tagged with. See
  [edges.md §2 "Tagging"](../primitive/edges.md#tagging). The
  Hashtag node is content-addressed by canonical name (per
  [data-model.md "Node identity strategies"](../implementation/data-model.md#node-identity-strategies)),
  so the same hashtag across instances resolves to the same
  node.

#### As target (incoming)

An Item receives:

- **Actor edges** from Users and Collectives per
  [edges.md §1](../primitive/edges.md#1-actor-edges) — the
  like/dislike surface plus per-viewer relevance, used by
  [feed-ranking](../primitive/feed-ranking.md) to weight the
  Item for each viewing user. The earliest of these is the
  authorship edge (§5).
- **`Comment → Item` (`:CONTAINMENT`)** when a Comment is
  written on the Item. See
  [edges.md §2 "Containment / belonging"](../primitive/edges.md#containment--belonging).
- **`ItemOwnership → Item` (`:CLAIM`)** — the claim side of the
  two-edge state pair, paired with the outgoing
  `Item → ItemOwnership` above.
- **`ChatMessage / Post / Comment → Item` (`:REFERENCES`)** when
  another content node embeds the Item — a message sharing it
  into a chat, a Post recommending or citing it, a Comment
  pointing at it. See
  [edges.md §2 "Reference"](../primitive/edges.md#reference).
- **`Proposal → Item` (`:TARGETS`)** when a moderation Proposal
  targets one of the Item's per-field moderation-status
  properties (§3). See
  [edges.md §2 "Subject targeting"](../primitive/edges.md#subject-targeting);
  cascade in §8.

### 4.2 ItemOwnership

#### As source (outgoing)

ItemOwnership is a junction, not an actor. It carries:

- **`ItemOwnership → Item` (`:CLAIM`)** — the claim side of the
  two-edge state pair, closed by the item's
  `Item → ItemOwnership` approval edge (§4.1) once the
  transfer-Proposal passes (§6). At Item creation the
  claim and approval are written in the same atomic gesture
  (§1 bootstrap). See
  [edges.md §2 "Containment / belonging"](../primitive/edges.md#containment--belonging).
- **`ItemOwnership → User/Collective` (`:BEARER`)** — identity-
  binding edge written at junction creation, pointing at the
  actor the ownership represents. Never re-pointed; the Shape A
  self-claim — the bearer's vote on the transfer-Proposal —
  must originate from this actor (§§1, 6). See
  [edges.md §2 "Bearer binding"](../primitive/edges.md#bearer-binding).
- **`ItemOwnership → Proposal` (Shape B vote)** — the current
  owner's approval vote on a transfer-Proposal moving the Item
  to a new ItemOwnership (§6). `dim1 > 0` approves the transfer.
  This is the sole vote edge an ItemOwnership casts. See
  [edges.md §2 "Voting (Shape B)"](../primitive/edges.md#voting-shape-b).

#### As target (incoming)

An ItemOwnership receives:

- **Actor edges** from Users and Collectives per
  [edges.md §1](../primitive/edges.md#1-actor-edges) — personal
  sentiment about the ownership record. The acquirer's own
  **Shape A self-claim** is not among these: it is their
  `User/Collective → Proposal` vote on the transfer-Proposal
  (§6), not an edge on the ItemOwnership.
- **`Item → ItemOwnership` (`:APPROVAL`)** — the approval side
  of the two-edge state pair, paired with the outgoing
  `ItemOwnership → Item` claim above. Written by the
  transfer-Proposal's cascade; supersession layers per §7 ride
  on this edge — see §4.1 for the carve-out.
- **`ChatMessage / Post / Comment → ItemOwnership`
  (`:REFERENCES`)** when a content node embeds an ownership
  record — e.g. a Post citing a provenance chain. See
  [edges.md §2 "Reference"](../primitive/edges.md#reference).

---

## 5. Authorship

An Item's author is the actor whose incoming actor edge has the
earliest layer-1 timestamp — the same earliest-incoming-edge rule
that derives authorship for every node type
([authorship.md](../primitive/authorship.md)). At creation, the
author's actor edge is written in the same compound gesture as the
Item node and the bootstrap ItemOwnership (§1) and carries the
`:AUTHOR` sub-label; the author's edge is the earliest incoming
actor edge by construction.

**Authorship and ownership are distinct.** The author is the
**author** — the actor who minted, listed, or registered the
Item; this is immutable and derived from the earliest actor edge.
The **current owner** is whoever holds the active ItemOwnership
(§7) and changes with each transfer. An Item authored by one User
and currently owned by a different User or by a Collective is the
typical case after one or more transfers.

Each ItemOwnership is authored by its **bearer** — the owner it
represents — via the bearer's `:AUTHOR` edge to the junction,
written in the self-claim gesture that accepts the ownership (§6).
Authorship is fixed by that label, not the earliest-incoming
timestamp, since third-party `:ACTOR` sentiment can land on a
pending junction first. See
[authorship.md "Junction authorship"](../primitive/authorship.md#junction-authorship).
This is distinct from the Item's author above: the Item is
authored once by its minter; each successive owner authors their
own ItemOwnership.

---

## 6. Transfer flow

ItemOwnership runs the **junction lifecycle** described in
[graph-model.md §5](../primitive/graph-model.md#5-junction-node-flows):
a transfer is a fresh terminal **transfer-Proposal** that
`:TARGETS` the new ItemOwnership. It needs two signatures — the
acquirer's **Shape A self-claim** (they have no ItemOwnership for
this item yet, so it is necessarily Shape A) and the current
owner's **Shape B approval** (`ItemOwnership_current → Proposal`,
`dim1 > 0`). Either party can open the Proposal:

- **Owner-first (offer / sale).** The current owner opens the
  transfer-Proposal — casting their Shape B approval and writing
  their `User/Collective → Proposal` `:AUTHOR` actor edge in the
  same gesture
  ([authorship.md "Proposal authorship"](../primitive/authorship.md#proposal-authorship)).
  The system creates the new ItemOwnership junction, binding it
  by `:BEARER` to the named acquirer, plus the
  `ItemOwnership → Item` claim edge. The transfer is pending
  until the acquirer self-claims on the Proposal — writing their
  `bearer → ItemOwnership` `:AUTHOR` edge, which authors the
  junction (§5).
- **Buyer-first (bid / request).** An interested acquirer authors
  the transfer-Proposal — their `User/Collective → Proposal`
  Shape A self-claim. The system creates the new ItemOwnership
  junction with its claim and `:BEARER` edges, and the acquirer
  writes their `bearer → ItemOwnership` `:AUTHOR` edge. The
  transfer is pending until the current owner signs with their
  Shape B
  approval. Handy for a marketplace where buyers approach sellers.

When both signatures are present the approval policy is satisfied
(single-approver: just the current owner), and the Proposal's
cascade:

1. creates the `Item → ItemOwnership` approval edge — the new
   ItemOwnership is now active; and
2. writes the supersession layer on the previous
   `Item → ItemOwnership_current` edge with `dim1 < 0`, marking
   the old ownership revoked (§7).

No one can take ownership without the current owner's Shape B
vote — there is no "take" operation in the graph. The Item-
creation bootstrap (§1) is the one exception. The Shape B vote
flows from the very ownership record that's about to be revoked
— fitting, since approving the transfer is the same act that
ends the voter's own ownership.

---

## 7. Supersession: exactly one active ItemOwnership per item

When a transfer completes and the new `Item → ItemOwnership`
approval edge is created, the system **automatically** adds a new
layer on the **previous** ItemOwnership's `Item → ItemOwnership`
approval edge with `dim1 < 0` — marking it revoked.
This uses the general state-transition mechanism on structural
edges described in
[graph-model.md §5](../primitive/graph-model.md#5-junction-node-flows).

**Invariant — single active ownership:** At most one
ItemOwnership per Item has a positive top layer on its
`Item → ItemOwnership` approval edge at any time. Identifying the
current owner is therefore a single-edge query — "find the
ItemOwnership whose `Item → ItemOwnership` top layer has
`dim1 > 0`" — with no timestamp comparisons required.

Concurrent transfer attempts are prevented at the transaction
level rather than by a separate lock. Only the current owner can
cast the Shape B approval vote (§6); the same service-layer
transaction that writes that vote also writes the new
`Item → ItemOwnership` approval edge and the supersession layer
on the previous one. Once the transaction commits, the casting
ItemOwnership is no longer the active one and so can no longer
cast a second Shape B vote — the authority required to initiate
a transfer is consumed by the transfer it initiates. A
concurrent second transfer attempt by the same owner is
serialized behind the first by the transaction and fails the
current-owner check when it runs.

**Invariant — append-only ownership chain:** ItemOwnership nodes
and the layers on their approval edges are never deleted. The
old approval edge isn't removed on transfer, just superseded by
a newer layer that flips its state to revoked. Every past owner
of an Item remains visible on the graph as a revoked
ItemOwnership; only the active one changes.

---

## 8. Lifecycle

### Item

Item nodes are **never deleted**. Per
[layers.md §5](../primitive/layers.md#5-deletion-policy), the only
permitted "removal" is in-place layer redaction on graph
properties or a tombstone version row on Postgres-side display
content; both preserve a visible record that the change occurred.

Moderation is the only redaction trigger on an Item
([moderation.md §1](moderation.md#1-the-two-classification-paths)) —
content-level account deletion does not sweep up Items per
[account-deletion.md §1](account-deletion.md#1-two-redaction-levels)
(Items are goods, not first-person expression).

**Account deletion of an owner.** The User node
persists with redacted PII, the ItemOwnership chain UUIDs remain
valid, and ownership continues to resolve. If the deleted owner
is the current owner, the Item continues to be owned by that
(now-anonymous) User node. A subsequent transfer follows the
regular transfer-Proposal flow (§6) — the graph mechanics are
unchanged by PII redaction.

The Item's UUID is stable across every redaction. Authorship
caches, the ItemOwnership chain, comments, references, and
tagging edges all remain valid pointers.

### ItemOwnership

ItemOwnership nodes are also **never deleted**. A transfer
supersedes the previous ItemOwnership via the supersession layer
(§7); the old node and its edges remain in the graph as part of
the item's ownership history.

An item with **no** active ItemOwnership — no positive top layer
on any `Item → ItemOwnership` edge — is considered **abandoned**.
The history of all previous owners remains visible in the layer
stacks. Whether and how an abandoned item can be re-acquired is
a marketplace-layer concern not yet specified by the graph
model.

---

## 9. Shared ownership routes through a Collective

**Invariant — no parallel co-ownership:** An Item has at most one
active ItemOwnership at any time (§7); the graph does not support
parallel ItemOwnership junctions for the same Item by different
actors. Shared ownership must route through a Collective: the
Collective holds the single ItemOwnership, and internal sharing
is the Collective's social contract, not a graph-level mechanism.

A married couple co-owning a car, three roommates sharing a coffee
machine, a band co-owning equipment, a co-op holding tools — all
of these are modeled as: a Collective node, the sharing actors as
its CollectiveMembers (see [collectives.md](collectives.md)), the
Collective as the holder of the ItemOwnership. Internal disputes
are resolved by the Collective's own governance, not by
parallel-ItemOwnership voting on the graph.

---

## What this doc is not

- **Not the edge catalog.** Per-target-type edges with dimension
  labels live in [edges.md](../primitive/edges.md).
- **Not the moderation primitive.** The Proposal mechanism, the
  mod gate, eligibility, thresholds, and the redaction cascade
  live in [moderation.md](moderation.md).
- **Not the deletion mechanism.** The redaction primitive lives
  in [layers.md §5](../primitive/layers.md#5-deletion-policy);
  the per-row legal hold and archive disposition live in
  [retention-archive.md](../primitive/retention-archive.md);
  the account-deletion flow lives in
  [account-deletion.md](account-deletion.md).
- **Not the Memgraph or Postgres schema.** Concrete property
  types, columns, indexes, and the `item_attachments` /
  `media_attachments` shapes live in
  [graph-data-model.md](../implementation/graph-data-model.md)
  and [data-model.md](../implementation/data-model.md).
- **Not the marketplace UX or transaction shape.** Listing,
  pricing, escrow, transfer-confirmation UX, and any economic
  records that accrue around ownership transfers are future
  work. The graph model committed to above is the substrate they
  will build on.
