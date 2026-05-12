# Items

An **Item** is a content node representing a physical or digital good
— something that can be owned, transferred, and talked about. Items
are interactable content: they can be liked, disliked, commented on,
and tagged with hashtags.

Items are a **future** concern in the sense that the first iterations
of CoGra focus on posts and chats; marketplace-like item flows will
build on top of the graph model once the base is running. The model
below is committed to regardless.

This doc is the per-node catalog for two related nodes: the **Item**
content node and the **ItemOwnership** junction node, plus the
convention for shared ownership through a Collective. Mechanics
those topics depend on stay in their topical docs — this doc links
rather than duplicates.

---

## 1. Creation

An Item is created by a single compound gesture from one actor —
either a User or a Collective. Unlike a Post, Item creation is
**compound**: it brings the Item AND the creator's first
ItemOwnership into existence in one atomic step, with the creator
as the initial owner. There is no separate "list" then "claim
ownership" flow.

The gesture writes the following records atomically:

- A new `:Item` node on the graph.
- The Postgres `items` row carrying the name and description (see
  [data-model.md](../implementation/data-model.md)).
- `item_attachments` rows for each piece of attached media (zero
  or more).
- An actor edge from the creator toward the Item — the
  **authorship edge** (§5). Its `(dim1, dim2)` values are the
  creator's initial opinion of their own item, typically high
  positive sentiment and relevance.
- A new `:ItemOwnership` junction node for the creator.
- The `ItemOwnership → Item` claim edge.
- The `Item → ItemOwnership` approval edge with positive top
  layer (`dim1 > 0`).

Because there is no prior owner to approve the creator — the Item
did not exist a moment ago — the
[two-edge approval pattern](../primitive/graph-model.md#5-junction-node-flows)
collapses to its 1-of-1 special case: the creator's gesture acts
as both the claim and the approval. This is the same bootstrap
pattern used for the founder's `CollectiveMember` in
[collectives.md "Creation"](collectives.md#1-creation). Every
subsequent ItemOwnership transfer is a regular two-edge approval
(§6), not a bootstrap.

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

- **`moderation_status`** — `'normal'` / `'sensitive'` /
  `'illegal'`, default `'normal'`, layered. Universal across all
  user-input-bearing nodes; per-node mechanics — set by a passing
  `'sensitive'` Proposal, auto-flipped to `'illegal'` by the
  redaction cascade — are described in
  [nodes.md "Universal: moderation_status"](../primitive/nodes.md#universal-moderation_status)
  and §8 below.

The cached `author_id` on the node is a derived value rebuilt
from the earliest incoming actor edge (§5) — it is not an
authored property and does not layer. The current owner is **not**
stored as a property on the Item; it is derived from the single
ItemOwnership whose `Item → ItemOwnership` approval edge has a
positive top layer (§7). Concrete property types and indexes live
in [graph-data-model.md](../implementation/graph-data-model.md).

### ItemOwnership

ItemOwnership carries no per-instance properties beyond its
`id` — transfer state lives entirely in the surrounding edges
(claim, approval, and supersession layers per §§6-7). Concrete
types and indexes live in
[graph-data-model.md](../implementation/graph-data-model.md).

---

## 3. Postgres-side content

### Item

An Item's display content lives in Postgres, linked to the graph
node by UUID. Edits are append-only per
[layers.md §4](../primitive/layers.md#4-layers-on-postgres-side-display-content):
a new version row, no overwrite.

- **`name`** — required. The handle the Item is listed under.
  Stored on the `items` row.
- **`description`** — optional body text. Stored on the `items`
  row.
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

This doc covers two nodes: the **Item** content node and the
**ItemOwnership** junction. Each gets its own subsection.
Dimension labels, sub-category labels, and traversal semantics
are not duplicated here — see
[edges.md](../primitive/edges.md).

### 4.1 Item

#### As source (outgoing)

An Item is not an actor and authors no actor edges. It carries
two outgoing structural edge types, both system-created:

- **`Item → ItemOwnership` (`:APPROVAL`)** — the approval side
  of the two-edge approval pattern. Created when the current
  owner's `(dim1 > 0)` actor edge toward a new `ItemOwnership`
  satisfies the approval policy (§6). **State transitions on
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
  Item for each viewer. The earliest of these is the
  authorship edge (§5).
- **`Comment → Item` (`:CONTAINMENT`)** when a Comment is
  written on the Item. See
  [edges.md §2 "Containment / belonging"](../primitive/edges.md#containment--belonging).
- **`ItemOwnership → Item` (`:CLAIM`)** — the claim side of the
  two-edge approval pattern, paired with the outgoing
  `Item → ItemOwnership` above.
- **`ChatMessage / Post / Comment → Item` (`:REFERENCES`)** when
  another content node embeds the Item — a message sharing it
  into a chat, a Post recommending or citing it, a Comment
  pointing at it. See
  [edges.md §2 "Reference"](../primitive/edges.md#reference).
- **`Proposal → Item` (`:TARGETS`)** when a moderation Proposal
  targets a property on the Item — `'sensitive'` against
  `moderation_status`, or `'illegal'` against `name`,
  `description`, or `attachments` (§8). See
  [edges.md §2 "Subject targeting"](../primitive/edges.md#subject-targeting).

### 4.2 ItemOwnership

#### As source (outgoing)

ItemOwnership is a junction, not an actor. It carries one
outgoing structural edge type, system-created:

- **`ItemOwnership → Item` (`:CLAIM`)** — the claim side of the
  two-edge approval pattern, closed by the item's
  `Item → ItemOwnership` approval edge (§4.1) once the current
  owner signs off (§6). At Item creation the claim and the
  approval are written in the same atomic gesture (§1
  bootstrap). See
  [edges.md §2 "Containment / belonging"](../primitive/edges.md#containment--belonging).

#### As target (incoming)

An ItemOwnership receives:

- **Actor edges** from Users and Collectives per
  [edges.md §1](../primitive/edges.md#1-actor-edges) — the
  approve/reject sentiment plus importance on the transfer.
  The acquirer's edge initiates the claim; the current owner's
  `(dim1 > 0)` edge closes the transfer (§6).
- **`Item → ItemOwnership` (`:APPROVAL`)** — the approval side
  of the two-edge pattern, paired with the outgoing
  `ItemOwnership → Item` claim above. Supersession layers per
  §7 ride on this edge — see §4.1 for the carve-out.
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
Item node and the bootstrap ItemOwnership (§1); the author's edge
is the earliest incoming actor edge by construction.

**Authorship and ownership are distinct.** The author is the
**creator** — the actor who minted, listed, or registered the
Item; this is immutable and derived from the earliest actor edge.
The **current owner** is whoever holds the active ItemOwnership
(§7) and changes with each transfer. An Item authored by one User
and currently owned by a different User or by a Collective is the
typical case after one or more transfers.

ItemOwnership is a junction node and has no authorship in the
[authorship.md](../primitive/authorship.md) sense — it represents
a transfer relationship, not an authored piece of content.

---

## 6. Transfer flow

ItemOwnership uses the **two-edge approval pattern** described in
[graph-model.md §5](../primitive/graph-model.md#5-junction-node-flows):

1. **Acquirer** (User or Collective) creates an actor edge toward
   a new **ItemOwnership** node.
2. System creates `ItemOwnership → Item` (claim, pending).
3. **Current owner** creates an actor edge toward the same
   ItemOwnership node with positive sentiment (approval).
4. Approval policy is satisfied; system creates
   `Item → ItemOwnership` (approval).
5. Transfer is complete; the new ItemOwnership is now the active
   one (§7).

No one can take ownership without the current owner's explicit
approval — there is no "take" operation in the graph. Bootstrap
ItemOwnership at Item creation is the one exception, and it is
not a transfer: there is no prior owner to skip past (§1).

---

## 7. Supersession: exactly one active ItemOwnership per item

When a transfer completes and the new `Item → ItemOwnership`
approval edge is created, the system **automatically** adds a new
layer on the **previous** ItemOwnership's `Item → ItemOwnership`
approval edge with `dim1 < 0` — marking it revoked/superseded.
This uses the general state-transition mechanism on structural
edges described in
[graph-model.md §5](../primitive/graph-model.md#5-junction-node-flows).

The invariant is: **at most one ItemOwnership per item has a
positive top layer on its approval edge at any time.** Identifying
the current owner is therefore a single-edge query — "find the
ItemOwnership whose `Item → ItemOwnership` top layer has
`dim1 > 0`" — with no timestamp comparisons required.

The cascade is why this works under append-only: the old approval
edge isn't removed, it just has a newer layer that flips its
state to revoked. Together the chain of ItemOwnership nodes forms
an **append-only history of the item's ownership** — every past
owner remains visible, only the active one changes.

---

## 8. Lifecycle

### Item

Item nodes are **never deleted**. Per
[layers.md §5](../primitive/layers.md#5-deletion-policy), the only
permitted "removal" is in-place layer redaction on graph
properties or a tombstone version row on Postgres-side display
content; both preserve a visible record that the change occurred.

Two redaction triggers apply to an Item today:

- **Moderation: `'sensitive'` classification.** A passing
  `'sensitive'` Proposal flips the top layer of `moderation_status`
  to `'sensitive'`. No redaction; display content stays. Each
  viewer's `content_filtering_severity_level` (see
  [data-model.md](../implementation/data-model.md) "User
  preferences") decides how aggressively the frontend filters
  the Item. Reversible by a counter-Proposal back to `'normal'`.
  See [moderation.md §1](moderation.md#1-the-two-classification-paths).
- **Moderation: `'illegal'` classification.** A passing
  `'illegal'` Proposal targets one of the Item's user-input
  fields — `name`, `description`, `attachments` (every attached
  media), or the literal `'full'` shorthand for all of the above
  per the per-node field list in
  [moderation.md §5](moderation.md#5-scope) —
  and fires the redaction cascade per
  [moderation.md §1](moderation.md#1-the-two-classification-paths):
  the affected Postgres rows are tombstoned with version markers,
  affected `media_attachments` rows are tombstoned and assets
  removed from object storage, the redacted originals are written
  to the [retention archive](../primitive/retention-archive.md)
  under per-row legal hold, and the Item node's `moderation_status`
  is auto-flipped to `'illegal'`. The cascade does **not**
  propagate to descendants — an Item classified illegal does not
  redact its Comments, any ChatMessage or Post that references
  it, or its ItemOwnership chain. Each requires its own
  classification.

**Account deletion of the Item's author** does not affect the
Item's name, description, attachments, or graph node. Identity-
level deletion redacts the User's PII; the User node's UUID is
stable and the Item's authorship edge keeps pointing at it.
Content-level deletion does **not** sweep up Items: Items are
goods, not first-person expression, and
[account-deletion.md §1](account-deletion.md#1-two-redaction-levels)
scopes content-level redaction to Posts, Comments, and
ChatMessages only.

**Account deletion of an owner** is the same shape: the User node
persists with redacted PII, the ItemOwnership chain UUIDs remain
valid, and ownership continues to resolve. If the deleted owner
is the current owner, the Item continues to be owned by that
(now-anonymous) User node. A subsequent transfer follows the
regular two-edge approval (§6) — the graph mechanics are
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

The single-owner invariant (§7) is deliberate. There is **no
direct co-ownership** of an Item by multiple parallel
ItemOwnership junctions. When several actors want to share an
item, the established pattern is to make the owner a **Collective**
that the sharing actors are CollectiveMembers of (see
[collectives.md](collectives.md)).

A married couple co-owning a car, three roommates sharing a coffee
machine, a band co-owning equipment, a co-op holding tools — all
of these are modeled as: a Collective node, the sharing actors as
its CollectiveMembers, the Collective as the holder of the
ItemOwnership. Internal disputes about the shared item are
resolved by the Collective's own social contract — its own
governance instances — not by parallel-ItemOwnership voting on the
graph.

This keeps the Item-side query model simple (one active owner per
item) and uses the existing Collective primitive for collective
ownership rather than inventing a parallel mechanism.

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
