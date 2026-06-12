# Nodes

The catalog of node types in CoGra. Each row gives a one-line
description and links to the dedicated doc where the per-node
mechanics live — creation flow, graph-side and Postgres-side
properties, edges, authorship, and lifecycle.

For the conceptual framing — the six categories (actor, content,
junction, system, topic, carrier) and why they matter — see
[graph-model.md §2](graph-model.md#2-node-categories). For the
edges that connect nodes, see [edges.md](edges.md). For concrete
property types, constraints, and indexes, see
[graph-data-model.md](../implementation/graph-data-model.md). For
Postgres-side display-content shapes, see
[data-model.md](../implementation/data-model.md).

The one cross-cutting topic that lives in this doc rather than in
any single per-node doc is the universal per-field
moderation-status property scheme — same shape and same mechanism
across every node type that carries user-authored content.

---

## Universal: per-field moderation status

Every node type that carries open user-authored content carries
**one graph property per user-filled field**, holding that field's
current moderation status. Vocabulary: `'normal'` (default),
`'sensitive'`, or a redaction marker per
[layers.md §5](layers.md#5-deletion-policy). All such properties
are layered, so the full status history per field is preserved.
The Network-wide governance instance in
[moderation.md](../instances/moderation.md) is what sets them.

### Property naming

For a user-filled field with **no graph-side data sibling** (the
field's content lives only in Postgres or object storage — `bio`,
`avatar`, `cover`, `display_name`, `website_url`, `content`,
`attachments`, `description`, `image`), the moderation-status
property is named
after the field itself. Its value IS the moderation status: e.g.
`User.bio = 'normal'`, flipped to `'sensitive'` or a redaction
marker by the cascade. There is no separate "data slot" for the
field on the graph — the content lives elsewhere; the graph
property exists purely as the moderation-targeting surface.

For a user-filled field that **already has a graph-side data
property** for uniqueness, lookup, or content-addressing
(`User.username`, `Collective.name`, `Chat.name`,
`Hashtag.name`), the existing data property keeps its name and
a companion `<field>_status` property carries the moderation
status. E.g. `User.username = 'alice'` (data) and
`User.username_status = 'normal'` (status). The two properties
layer independently. On illegal classification the cascade
writes to both: the data property's top layer becomes a
redaction marker, and the status property's top layer carries
the matching marker for consistency.

The exact set of per-field properties for each node type
follows the targetable-fields catalog in
[moderation.md §5](../instances/moderation.md#5-scope) and is
restated in each node's per-doc properties section.

### The three values

Meanings and behavioural consequences are fixed at the primitive
level; the *examples of what falls in each* are platform policy
and live in
[platform-guidelines.md §1](../instances/platform-guidelines.md#1-the-three-buckets).

- **`'normal'`** — default. No filter, no redaction.
- **`'sensitive'`** — lawful content that warrants a viewer-side
  filter (graphic, mature, disturbing). Content stays;
  frontends respect each viewing user's
  `content_filtering_severity_level`
  ([data-model.md](../implementation/data-model.md)) when
  rendering. Set by a passing `'sensitive'` Proposal on the
  per-field property. Reversible via a
  [counter-Proposal](governance.md#counter-proposals).
- **Redaction marker** — the field's content has been ruled
  unlawful and was redacted. The per-field property's top
  layer holds the marker; the corresponding Postgres-side
  content (or object-storage asset) is tombstoned in the same
  cascade. Set by a passing `'illegal'` Proposal. Not
  reversible — redaction markers are append-only per
  [layers.md §5](layers.md#5-deletion-policy).

### Node-level cache: `moderation_status`

Every content-bearing node also carries a single
`moderation_status` property — `'normal'` / `'sensitive'` /
`'illegal'` — caching the max severity across that node's
per-field statuses. The per-field properties are the source of
truth and what the cascade writes; the cache is what the read
path consumes. Feed filtering ("posts that are not `'sensitive'`
or `'illegal'`") reads one property per candidate node instead
of all of its per-field statuses, keeping ranking traversals
narrow.

The cache is not layered (per
[layers.md §3 "Derived caches"](layers.md#derived-caches-do-not-layer)):
the per-field properties carry the layered history; the cache
holds the current max. The cascade in
[moderation.md §1](../instances/moderation.md#1-the-two-classification-paths)
writes both atomically — the targeted per-field status (as a new
layer or redaction marker) and the cache (overwritten with the
new max).

Severity is monotone: once any field carries a redaction marker,
`moderation_status = 'illegal'` and stays there — a later
`'sensitive'` Proposal on a different field cannot downgrade it,
and `'illegal'` is itself unreachable from `'normal'` except via
a redaction marker that is append-only per
[layers.md §5](layers.md#5-deletion-policy).

### Scope

Per-field moderation-status properties and the `moderation_status`
cache appear on every user-input-bearing node: **User, Collective,
Post, Comment, ChatMessage, Chat, Item, Hashtag** — and, for its
single user-bearing field, **Proposal**: `proposed_value` may
embed user-authored content (a proposed description or name) and
carries a `proposed_value_status` companion
([proposal.md §2](../instances/proposal.md#2-graph-side-properties)).

Junction nodes (`ChatMember`, `CollectiveMember`, `ItemOwnership`)
carry no user-input fields and so carry neither per-field
properties nor the cache. **`Campaign` and `Settlement`**
are in the same position — pure record nodes whose substance is graph
properties plus pointers to the chain, with nothing user-authored to
redact. The **`:Network` singleton** is similarly pure configuration
state. See [network.md §3](network.md#3-graph-side-properties).

**Distinct from chat-internal disavowal.** Per-field moderation
status is the Network-scope value system described above;
chat-internal disavowal is a **separate value system** with its
own value set (`'normal'` / `'disavowed'`), scope (Chat, not
Network), and graph location (`:APPROVAL` edges at Level 2;
existence of a passed disavowal Proposal at Level 1). The two
share no values, no scope, and no graph property — see
[moderation.md §"Vocabulary: moderation vs disavowal"](../instances/moderation.md#vocabulary-moderation-vs-disavowal)
for the boundary.

---

## Whole-node targeting: the `'node'` sentinel

A Proposal's `target_property` normally carries the name of one
graph property on the target node — `'name'`, `'role'`,
`'network_role'`, a per-field moderation-status property like
`'bio'` or `'username_status'`, and so on. The sentinel
value `'node'` reserves `target_property` for a whole-node
operation rather than a single property: the Proposal targets the
node itself, and the cascade interpreter dispatches on the
target's node type instead of writing a layer on a named property.

The sentinel exists because the value space of `target_property`
is the graph-property names on the target node, and there is no
graph-property name that means "the whole node." A reserved value
extends that space without overloading any real property name.

The cascade dispatch — what the interpreter actually writes when
a `'node'` Proposal passes threshold — is specific to the
mechanism that uses the sentinel. The primitive registers the
sentinel and its meaning; the per-cascade behaviour lives with
the instance:

- **Illegal-content classification** — see
  [moderation.md §1](../instances/moderation.md#1-the-two-classification-paths).
  `proposed_value` is `'illegal'`. The cascade interprets the
  sentinel as "every user-input field plus every attached media"
  on the target — see
  [moderation.md §5](../instances/moderation.md#5-scope) for the
  per-node field coverage.
- **Chat-internal disavowal** — see
  [chats.md §10](../instances/chats.md#10-moderation).
  `proposed_value` is `'disavowed'` (or `'normal'` on
  counter-Proposal); dispatch differs for `ChatMessage` and
  `ChatMember` targets.

A future mechanism that needs whole-node operations on a
different node type can register its own cascade against the
same `'node'` sentinel rather than inventing parallel scaffolding.

---

## 1. Actor nodes

Entities that take actions and create edges.

| Node type | Description |
|-----------|-------------|
| **User** | A person on the platform — off-graph credentials authenticate the API requests that originate their edges. See [user.md](user.md). |
| **Collective** | A group acting through a single graph identity (household, band, co-op, studio, partnership, NGO, company). Created by one founding User; every subsequent gesture is initiated by an authorized CollectiveMember per the Collective's social contract. Same outgoing-edge catalog as a User. See [collectives.md](../instances/collectives.md). |

---

## 2. Content nodes

Entities that are acted upon by actors.

| Node type | Description |
|-----------|-------------|
| **Post** | Content (text and/or media) authored by an actor (User or Collective). The primary public-content surface and the canonical [feed-ranking](feed-ranking.md) target. See [post.md](../instances/post.md). |
| **Comment** | A response authored on another content node — Post, Comment (reply), Chat, ChatMessage, or Item. The platform's universal threading primitive. See [comment.md](../instances/comment.md); per-target containment list in [edges.md §2](edges.md#containment--belonging). |
| **Chat** | A conversation container (1:1 or group) — a first-class interactable node visible on the graph, not a private hidden space. Topology (membership, who-talks-to-whom) is public by design; only message bodies are private, and only when encrypted. See [chats.md](../instances/chats.md). |
| **ChatMessage** | A single message within a Chat, itself a first-class node — likeable, commentable, embed-able. Carries a `content_privacy` flag (`plaintext` / `encrypted`) per message; a single chat can mix both freely. See [chats.md](../instances/chats.md). |
| **Item** | A physical or digital good — ownable (via ItemOwnership), transferable, and talked about. See [items.md](../instances/items.md). |

---

## 3. Junction nodes

Junction nodes represent relationships that have **roles**, need
**approval flows** (multi-sig), and can themselves be interacted
with (liked, voted on, etc.). They eliminate the need for parallel
edges between the same two nodes — see
[graph-model.md §2](graph-model.md#2-node-categories) for the
framing and §5 for the approval flow. Each junction is authored by
its bearer via the bearer's `:AUTHOR` edge to it, written at
self-claim — see
[authorship.md "Junction authorship"](authorship.md#junction-authorship).

| Node type | Connects | Description |
|-----------|----------|-------------|
| **ChatMember** | Chat ↔ User/Collective | Membership in a Chat with role (default vocabulary: admin/chat_mod/member). Entry can require multi-sig approval per the chat's `governance['decision:add_member']` entry; can itself be voted on (kick, promote). See [chats.md](../instances/chats.md). |
| **CollectiveMember** | Collective ↔ User/Collective | Membership in a Collective with role and role-attached quantities (e.g. `ownership_pct`). Collectives can themselves be CollectiveMembers — nesting is unlimited. See [collectives.md](../instances/collectives.md). |
| **ItemOwnership** | Item ↔ User/Collective | A specific ownership claim. Each transfer creates a new ItemOwnership; together they form the item's append-only ownership history. See [items.md](../instances/items.md). |

---

## 4. System nodes

A small fourth category for **singleton, instance-level
configuration** that doesn't fit actor / content / junction.

| Node type | Description |
|-----------|-------------|
| **Network** | Singleton per instance. Carries Network-level configuration (moderation thresholds, role-change quorums, eligibility definitions). Targeted by Proposals when those parameters are changed. See [network.md](network.md). |

---

## 5. Topic nodes

Shared, content-addressed labels that content attaches to for
discovery. Acted upon like content, but — lacking an author and a
mutable body — they sit in their own category. See
[graph-model.md §2](graph-model.md#2-node-categories).

| Node type | Description |
|-----------|-------------|
| **Hashtag** | A topic tag whose identity is content-addressed (UUIDv5 of the canonical name), brought into existence implicitly by the first `:TAGGING` edge. Also covers concepts like places (e.g. `#berlin`). Authorless — exempt from [authorship.md](authorship.md)'s earliest-incoming-edge rule. See [hashtag.md](../instances/hashtag.md). |

---

## 6. Carrier nodes

Process and record carriers: no user-input fields, no
Postgres-side display content. Acted upon only through the
narrow edge sets their own docs define.

| Node type | Description |
|-----------|-------------|
| **Proposal** | The subject carrier for property-level governance votes — targets one graph property on another node via `:TARGETS`. The one carrier with a user-bearing field: `proposed_value` may embed user-authored content and is moderatable via its status companion ([proposal.md §2](../instances/proposal.md#2-graph-side-properties)). See [proposal.md](../instances/proposal.md); the primitive itself is in [governance.md §2.1](governance.md#21-subject). |
| **Campaign** | A pull-marketing campaign — a funded, public request to raise a target node's reach into an anchor's cluster. Authored by the advertiser; carries the campaign terms as graph properties (deposit pointer, `g`, goal, window) and reaches its anchor and target through `:ANCHOR` / `:PROMOTES` edges. See [economics.md §2](economics.md#2-the-campaign-node). |
| **Settlement** | The terminal record of a settled `Campaign`, created once at settlement — carries the distributor address, the payout Merkle root, and the public results (`settled_P`, `achieved_h_gain`) as properties. Claimants reach it via `:ENTITLES` / `:CLAIMS` edges. See [economics.md §7](economics.md#7-settlement-on-the-graph--the-claim-flow). |
| **Wallet** | An account's payout wallet — created at signup holding the account's counterfactual self-custody on-chain address as a layered property. Bound to its account by a single `:PAYS_TO` edge; `:ENTITLES` / `:CLAIMS` and `:TRANSFERS` edges point at it. Survives account deletion (the durable handle is the off-platform key). See [ledger.md](../implementation/ledger.md#the-wallet-node-and-the-pays_to-binding). |

