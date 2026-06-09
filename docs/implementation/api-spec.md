# API Specification

The API is a single GraphQL endpoint served by Axum +
async-graphql.

- **Endpoint**: `POST /graphql`
- **GraphQL IDE**: `GET /playground` (dev mode only)
- **Health check**: `GET /health`

The schema is specified in sections: the **type system** and
**queries** (the read surface) here, the **mutation surface**
(the write gestures) in a following pass. The governing
principles below bind both.

---

## Why GraphQL

The data is deeply relational and every view wants a different
slice of it — a feed entry needs the content node, its author,
the viewer's edge to it, and inbound-attention counts all at
once; a profile wants none of that but a paginated authored-
content list instead. GraphQL lets a client request exactly the
fields it needs in one round trip, and lets the server resolve
each field lazily — a Memgraph traversal or a Postgres lookup
only runs when its field is actually selected. That laziness is
load-bearing here, because the read path crosses two stores and
the graph traversals are the expensive part.

---

## Governing principles

These are decisions, not defaults — every type, field, and
operation in the rest of the spec is shaped by them.

### Self-documenting through introspection

The schema is the documentation. Names and structure are part of
the contract, not an implementation detail: every type, field,
argument, and enum value carries a description, and the naming is
chosen so the schema reads as prose under introspection. The
target consumer is a human exploring through a GraphQL IDE **with
no frontend in front of them** — the schema must be navigable and
self-explaining on its own. When a name and a shorter name both
fit, the clearer one wins.

### Idiomatic GraphQL, not REST with selectable fields

GraphQL's value here is a typed, composable object graph and
exact-shape responses — not a REST surface where the only feature
is omitting result fields. Concretely:

- **Entities are object types.** Each field is either a scalar
  **leaf** or a nested **object-type field** that resolves to a
  related type (or a connection). A relationship is a field
  returning the related *type* — `post.author` yields a `User`,
  not an `authorId` string the client must re-fetch.
- **Interfaces and unions** model genuine polymorphism — `Actor`
  spanning `User` and `Collective`, target unions for fields that
  legitimately return one of several types — so a single field
  can carry a typed heterogeneous result.
- **Precise scalars.** Custom scalars carry the invariants the
  domain has — `UUID`, `DateTime`, and a bounded `[-1, +1]`
  dimension scalar — instead of loose strings and floats.
- **Connections** carry every list (see Pagination).

The litmus test: the schema is exact and composable because it is
a graph of types, not because a REST payload made its fields
optional.

### Everything on the graph is public; privacy is cryptographic

Per [graph-model.md §1](../primitive/graph-model.md#1-core-principles),
**every node, every edge, and every content body is readable
without an account.** An unauthenticated request can compute any
actor's view for any reader; accounts gate *participation*
(writing), never *viewing*.

Privacy of content is achieved by **encryption, not access
control**. An encrypted `ChatMessage` returns its ciphertext to
*every* requester exactly like any other field — the server gates
nothing — and only a holder of the chat key can decrypt it
client-side. Plaintext messages read like any other content, and
chat topology (the chat, its membership, who-talks-to-whom) is
public regardless. So there is no public/private *shape* split in
the schema: edges and content are ordinary public fields, queried
the same way for everyone.

The one server-gated set is small and entirely **off-graph
operational state** (per [data-model.md](data-model.md)): a
viewer's personal frontend state (bookmarks, seen-list, hidden-
actors, chat read pointers), preferences
(`content_filtering_severity_level`), and auth/session state
(sessions, tokens). It is gated by field-level authorization, not
a separate query namespace — see below.

Moderation adds no hidden set either: `'sensitive'` content is
returned with its status and the viewer's severity preference so
the **frontend** applies the filter (per
[nodes.md](../primitive/nodes.md)); redacted (`'illegal'`)
content returns a visible redaction marker in place of the body —
the one case where the API returns something other than the
authored content, and never a silent disappearance.

### Private data is field-level authorization, never a parallel namespace

There is no `me`-prefixed subtree shadowing the public schema —
no `myBookmarks`, `mySessions`. Private data hangs off the same
ordinary types as everything else: `User.bookmarks`,
`User.sessions`, `User.preferences` are fields on the `User`
type, and their resolver returns the data **only when the
authenticated viewer is the eligible owner**, resolving to null
otherwise. One schema; eligibility decides what a field yields,
not which query you call.

The single non-generic entry is `me`: identity discovery —
resolving the request's auth token to the viewer's own node. A
generic query cannot express it because the client does not yet
know its own `id`. `me` returns the ordinary `User`/`Actor` type;
it is an entry point, not a parallel tree.

### State is append-only; reads expose current-and-history

The graph never overwrites and never deletes
([graph-model.md §8](../primitive/graph-model.md#8-append-only-history-edges),
[layers.md](../primitive/layers.md)). Edges and node properties
are layer stacks; the current state is the top layer. A field
returns its current (top-layer) value by default, with the full
layer history reachable as an explicit selection for the audit,
opinion-shift, and "revised N times" surfaces. There is no
destructive read or write — the absence of any
`delete`/`unlike`/`unfollow` operation follows from the
primitive, not from an oversight.

### Viewer context rides the request, not the arguments

Reads need no authentication. When a request *does* carry an auth
token, the resolved viewer lives in the GraphQL execution context
— never passed as a field argument. Its only two jobs are the
field-level authorization above and `me` resolution; it never
scopes an ordinary read. The same query is valid authenticated or
anonymous — authentication only changes what the gated fields
yield. The auth model (invitation registration, JWT access +
rotating refresh tokens, sessions) is specified in
[auth.md](auth.md); this spec consumes it.

### Pagination is Relay cursor connections

Every list, feed, and edge set paginates as a Relay-style
connection (`edges { cursor node }`, `pageInfo`, optional
`totalCount`). The append-only graph makes offset pagination
quietly incorrect — items inserted at the head during a scroll
would shift offsets and cause skips or repeats — so cursors,
which point at a fixed position, are the correct primitive. A
consumer fetches the first page with `first:` alone and follows
`pageInfo.endCursor` into `after:` for the next.

> **Naming note.** Relay names its pagination wrapper `edges` /
> `node`. The graph's own central concept is also an edge — the
> 2D tensor, surfaced as the `Edge` type below. The collision is
> deliberate-but-bounded: `edges` inside a `*Connection` is the
> pagination wrapper; the `Edge` type is the tensor. They never
> appear in the same position, and the Relay convention is
> well-known enough that consumers won't conflate them.

**Feed ranking and cursors.** A ranked feed paginates over a
*frozen* ranking: the order is computed once when the viewer
refreshes the feed, and the cursor indexes into that snapshot.
Re-ranking happens on refresh, never per page fetch — so paging
through a feed never reshuffles under the reader. The feed query
section specifies the snapshot handle.

### The write surface is a principled hybrid

Specified in full in the mutation pass; the shape is fixed here
so the read types anticipate it. Setting an actor edge toward any
node is **one** generic mutation parameterized by target, target
type, and the `(dim1, dim2)` tensor — mirroring the uniform edge
model rather than minting a verb per interaction. Gestures that
are genuinely their own thing (authoring a chat, casting a
governance vote, opening a campaign) are standalone mutations.
Operations are combined only where they are the same gesture —
never merged for the sake of a smaller mutation count, and never
split for the sake of a larger one.

---

## Type system — foundations

The cross-cutting building blocks: scalars, the shared
interfaces, the `Edge` tensor type, per-field moderation, and the
pagination wrappers. The concrete node object types build on
these in the sections that follow.

### Scalars

```graphql
"A v4 UUID — the shared key across the graph (Memgraph) and
 display-content (Postgres) stores."
scalar UUID

"An RFC 3339 / ISO 8601 timestamp."
scalar DateTime

"A signed edge-tensor dimension: a float constrained to the closed
 range [-1.0, +1.0]. The range invariant lives in the type rather
 than in a plain Float."
scalar Dimension
```

### Shared enums

```graphql
"A node's moderation state. On a content node, the cached max
 severity across that node's per-field statuses; on a single field
 (see FieldStatus), ILLEGAL means that field is redacted."
enum ModerationStatus { NORMAL SENSITIVE ILLEGAL }

"The graph-layer label on an edge — every edge carries exactly
 one. ACTOR / AUTHOR / INVITE are actor edges; the rest are
 structural."
enum EdgeLabel {
  ACTOR AUTHOR INVITE
  CONTAINMENT CLAIM APPROVAL BEARER TAGGING TARGETS REFERENCES
  ANCHOR PROMOTES ENTITLES CLAIMS TRANSFERS PAYS_TO
}

"The kind of a node — used to filter edge endpoints by the type of
 node on the far end (e.g. only a User's edges that point at Posts)."
enum NodeKind {
  USER COLLECTIVE
  POST COMMENT CHAT CHAT_MESSAGE ITEM HASHTAG
  PROPOSAL CAMPAIGN SETTLEMENT WALLET NETWORK
  CHAT_MEMBER COLLECTIVE_MEMBER ITEM_OWNERSHIP
}
```

### Identity and actor interfaces

```graphql
"Anything with a graph identity — implemented by every node type.
 It exists so heterogeneous endpoints (an edge's ends, a reference
 target, a comment's parent) are typed without a sprawling union.
 It is a type-modeling device, not a navigation mandate: typed
 entry points are free to exist and nothing is forced through a
 single node(id) accessor."
interface Node {
  id: UUID!
  "Edges originating at this node — the generic way to read any
   relationship before named convenience views exist. Filter by
   graph label and/or by the kind of node on the far end."
  outgoingEdges(
    label: EdgeLabel
    toKind: NodeKind
    first: Int, after: String, last: Int, before: String
  ): EdgeConnection!
  "Edges pointing at this node. Exposed as public topology / an
   inbound-attention surface only — per the feed-ranking model,
   inbound edges never shape this node's own feed."
  incomingEdges(
    label: EdgeLabel
    fromKind: NodeKind
    first: Int, after: String, last: Int, before: String
  ): EdgeConnection!
}

"An entity that takes actions and authors content: a User or a
 Collective. Both expose the same outgoing-edge catalog, so the
 graph refers to actors through this interface wherever the
 User-vs-Collective distinction is not load-bearing."
interface Actor implements Node {
  id: UUID!
  "The unique mention handle — a User's username or a Collective's
   name."
  handle: String!
  displayName: String!
  avatar: MediaAttachment
  websiteUrl: String
  moderationStatus: ModerationStatus!
  createdAt: DateTime!
}
```

### The edge tensor

```graphql
"A single directed edge: the uniform 2D tensor that carries every
 relationship and opinion in the graph. The top layer is the
 current state; `history` is the full append-only stack."
type Edge {
  "Source — the actor or system that wrote the edge."
  from: Node!
  "Target the edge points at."
  to: Node!
  label: EdgeLabel!
  "Top-layer dimension 1 — signed valence (sentiment / approval /
   affirmation). The user-facing label varies by edge type; the
   math role does not."
  dim1: Dimension!
  "Top-layer dimension 2 — signed connection-weight (interest /
   relevance / importance)."
  dim2: Dimension!
  "Index of the current (top) layer; 1 is the first interaction."
  layer: Int!
  "When the top layer was written."
  timestamp: DateTime!
  "The full append-only layer stack, oldest first; the last entry
   equals the current (dim1, dim2). Audit and history only —
   ranking reads the top layer."
  history: [EdgeLayer!]!
}

"One immutable layer of an Edge."
type EdgeLayer {
  dim1: Dimension!
  dim2: Dimension!
  layer: Int!
  timestamp: DateTime!
}

"A page of edges. (The wrapper is `EdgeEdge` because the element
 type is itself named `Edge` — the accepted cost of the bare Relay
 spelling.)"
type EdgeConnection {
  edges: [EdgeEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}

type EdgeEdge {
  cursor: String!
  node: Edge!
}
```

The **system-dimension slot** (typed, optional, per-label edge
metadata — e.g. the on-chain transaction reference a `:TRANSFERS`
edge carries) is deferred to the edge contexts that populate it,
as the docs themselves defer its schema
([edges.md §2](../primitive/edges.md#2-structural-edges)). It
never enters ranking.

### Per-field moderation

```graphql
"One user-filled field's current moderation status. `field` is the
 property name (\"content\", \"bio\", \"name\", …); a status of
 ILLEGAL means the value is redacted and the field itself resolves
 to null."
type FieldStatus {
  field: String!
  status: ModerationStatus!
}
```

Every content-bearing node exposes `moderationStatus` (the
node-level cache) and `fieldStatuses: [FieldStatus!]!` (the
per-field detail), per [nodes.md](../primitive/nodes.md). A
redacted field's own value resolves to null while its
`FieldStatus` carries ILLEGAL — the visible mark, never a silent
disappearance.

### Pagination

```graphql
"Relay cursor-pagination metadata."
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

Every list is a Relay connection: a `<Element>Connection` with
`edges: [<Element>Edge!]!`, `pageInfo: PageInfo!`, and an optional
`totalCount: Int`; each `<Element>Edge` has `cursor: String!` and
`node: <Element>!`. The wrapper keeps the bare Relay `<Element>Edge`
spelling throughout — so the tensor `Edge` type's own connection
wrapper is `EdgeEdge`, accepted for idiom-consistency rather than
special-cased. Connections are materialized per element type in
the sections that use them.
