# API Specification

The API is a single GraphQL endpoint served by Axum +
async-graphql.

- **Endpoint**: `POST /graphql`
- **GraphQL IDE**: `GET /playground` (dev mode only)
- **Health check**: `GET /health`

The schema is specified in sections: the **type system** and
**queries** (the read surface), then the **mutation surface**
(the write gestures). The governing principles below bind both.

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

**Feed ranking and cursors.** The backend does not rank
([feed-ranking.md §9](../primitive/feed-ranking.md)): it serves the
viewer's weight-bounded subgraph slice, a ranker (device or delegated
miner) orders it off the hot path, and the resulting id list is hydrated
back into a cursor-paginated feed. The frozen snapshot lives with the
ranker; the cursor indexes into the order it produced, never a per-page
re-rank. The feed surface below splits the slice from the hydration.

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
"A UUID — the shared key across the graph (Memgraph) and
 display-content (Postgres) stores. Random v4 for most node types;
 content-addressed v5 for Hashtags."
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
"A node's moderation state — the cached max severity across its
 per-field statuses. (Per-field status uses FieldModerationStatus.)"
enum ModerationStatus { NORMAL SENSITIVE ILLEGAL }

"The graph-layer label on an edge — every edge carries exactly one.
 ACTOR and STRUCTURAL are the two base labels; the rest are
 sub-labels that replace their base where one fits (AUTHOR / INVITE
 replace ACTOR; the others replace STRUCTURAL). A generic actor edge
 stays ACTOR; a structural edge with no sub-label (junction Shape-B
 votes, Campaign → Settlement) stays STRUCTURAL."
enum EdgeLabel {
  ACTOR AUTHOR INVITE
  STRUCTURAL CONTAINMENT CLAIM APPROVAL BEARER TAGGING TARGETS
  REFERENCES ANCHOR PROMOTES ENTITLES CLAIMS TRANSFERS PAYS_TO
}

"The kind of a node — used to filter edge endpoints by the type of
 node on the far end (e.g. only a User's edges that point at Posts)."
enum NodeKind {
  USER COLLECTIVE
  POST COMMENT CHAT CHAT_MESSAGE ITEM HASHTAG
  PROPOSAL CAMPAIGN SETTLEMENT WALLET NETWORK
  CHAT_MEMBER COLLECTIVE_MEMBER ITEM_OWNERSHIP
}

"The sign of an edge's top-layer dimension, for filtering edges by valence
 or by the neutral (0) state. POSITIVE: > 0. NEGATIVE: < 0. ZERO: exactly 0."
enum Sign { POSITIVE NEGATIVE ZERO }
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
  "When this node was created."
  createdAt: DateTime!
  "When this node last changed — its most recent layer or
   display-content version; equals createdAt if never changed."
  updatedAt: DateTime!
  "Edges originating at this node — the generic way to read any
   relationship before named convenience views exist. Filter by graph
   label, by the kind of node on the far end, by the sign of a top-layer
   dimension (e.g. only positive :APPROVAL, or the (0,0) severance state),
   and/or by a top-layer-timestamp window."
  outgoingEdges(
    label: EdgeLabel
    toKind: NodeKind
    dim1Sign: Sign
    dim2Sign: Sign
    since: DateTime
    until: DateTime
    first: Int, after: String, last: Int, before: String
  ): EdgeConnection!
  "Edges pointing at this node. Exposed as public topology / an
   inbound-attention surface only — per the feed-ranking model,
   inbound edges never shape this node's own feed. Same dimension-sign
   and timestamp filters as outgoingEdges; fromKind selects the near-end
   source kind."
  incomingEdges(
    label: EdgeLabel
    fromKind: NodeKind
    dim1Sign: Sign
    dim2Sign: Sign
    since: DateTime
    until: DateTime
    first: Int, after: String, last: Int, before: String
  ): EdgeConnection!
}

"An entity that takes actions and authors content: a User or a
 Collective. Both expose the same outgoing-edge catalog, so the
 graph refers to actors through this interface wherever the
 User-vs-Collective distinction is not load-bearing."
interface Actor implements Node {
  # + Node fields (id, createdAt, updatedAt, outgoingEdges, incomingEdges)
  "The unique mention handle — a User's username or a Collective's
   name."
  handle: ModeratedText!
  displayName: ModeratedText!
  avatar: ModeratedMedia!
  websiteUrl: ModeratedText!
  "Node-level cache: max moderation severity across this actor's fields."
  moderationStatus: ModerationStatus!
  "Outstanding invite links this actor has issued — pending onboarding
   gestures, not the public who-invited-whom (that lives on the :INVITE
   edges, read via incomingEdges). Field-level: each link's id is the link
   capability, so this resolves only for the issuing actor (or, for a
   Collective, its authorized members); null otherwise."
  inviteLinks(first: Int, after: String, last: Int, before: String): InviteLinkConnection
}
```

### The edge tensor

```graphql
"A single directed edge: the uniform 2D tensor that carries every
 relationship and opinion in the graph. The top layer is the current
 state; the full append-only stack is read via the `edgeHistory` query."
type Edge {
  "Source — the node the edge originates at. Who wrote the edge
   follows from the label: the source actor for an actor edge, the
   system for a structural one."
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
  "The top layer's system-dimension slot — typed, optional, per-label
   metadata, surfaced but never read by ranking. Null on labels that
   don't use it."
  systemDimension: SystemDimension
}

"One immutable layer of an Edge."
type EdgeLayer {
  dim1: Dimension!
  dim2: Dimension!
  layer: Int!
  timestamp: DateTime!
  "This layer's system-dimension slot — the per-label metadata the
   layer was written with (e.g. a :TRANSFERS layer's on-chain
   transaction reference). Null on labels that don't use it."
  systemDimension: SystemDimension
}

"One immutable layer of a node property — a graph property or a Postgres
 display-content version. `value` is serialized as a string (shaped by the
 property); null when the layer is a redaction."
type PropertyLayer {
  value: String
  "Why the value was redacted; non-null exactly when this layer is a
   redaction. On a Postgres display-content field the redaction is an
   appended tombstone row and `timestamp` is the removed-at instant;
   on a graph property the redaction is in place
   (layers.md §5) — the layer keeps its original write `timestamp`,
   and the removed-at instant travels here, with the reason."
  redactionReason: String
  layer: Int!
  timestamp: DateTime!
}

"A page of edge layers — the paginated edgeHistory stack."
type EdgeLayerConnection {
  edges: [EdgeLayerEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type EdgeLayerEdge {
  cursor: String!
  node: EdgeLayer!
}

"A page of property layers — the paginated propertyHistory stack."
type PropertyLayerConnection {
  edges: [PropertyLayerEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type PropertyLayerEdge {
  cursor: String!
  node: PropertyLayer!
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

"Per-label, never-ranked edge metadata. Each populated label uses
 its own field(s); all null on labels that don't. Today only
 :TRANSFERS populates it."
type SystemDimension {
  "On-chain transaction reference for a :TRANSFERS edge; null otherwise."
  transactionRef: String
}
```

The **system-dimension slot** is the `systemDimension` field above:
typed, optional, per-label edge metadata, surfaced by the API but
never read by ranking
([edges.md §2](../primitive/edges.md#2-structural-edges)). The slot
is per-layer: `Edge.systemDimension` is the top layer's slot, and
`edgeHistory` serves each past layer's own. Repeated transfers
between one wallet pair re-layer the single `:TRANSFERS` edge (one
label per endpoint pair), so every layer's on-chain transaction
reference stays readable — past money flows remain auditable. Today
only `:TRANSFERS` populates the slot (the on-chain transaction
reference); other labels leave it null.

### Per-field moderation

Each user-authored field carries its moderation status co-located
with its value, so a redacted field is never confused with an empty
one. Scalar fields use a wrapper type; `value` is null when the field is
redacted (or unset, where optional), and `status` says which.

```graphql
"Text carrying its own moderation status. `value` is null when the
 field is redacted, or unset where the field is optional — `status`
 disambiguates."
type ModeratedText {
  value: String
  status: FieldModerationStatus!
}

"A single media asset carrying its own moderation status."
type ModeratedMedia {
  value: MediaAttachment
  status: FieldModerationStatus!
}

"Per-field moderation state. REDACTED is the field-level form of
 the node-level ILLEGAL — the value is gone, the mark remains."
enum FieldModerationStatus { NORMAL SENSITIVE REDACTED }
```

A media *gallery* (a list) can't wrap generically, so those fields
keep their list and carry a sibling
`attachmentsStatus: FieldModerationStatus!`. Every content-bearing
node also keeps the node-level `moderationStatus: ModerationStatus!`
cache — the cheap "is anything wrong here" check — per
[nodes.md](../primitive/nodes.md).

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

---

## Type system — actors and content

The actor nodes and the public content nodes. To keep the listings
readable, interface fields are **implied and omitted** from each
body: the `Node` fields (`id`, `createdAt`, `updatedAt`,
`outgoingEdges`, `incomingEdges`) on every type, and the `Actor`
fields (`handle`, `displayName`, `avatar`, `websiteUrl`,
`moderationStatus`, `inviteLinks`) on the actor types. Only fields beyond
the implemented interfaces are shown.

Two consequences of earlier principles show up throughout:

- **Moderated fields co-locate value and status** — each is a
  `ModeratedText` / `ModeratedMedia` whose `value` is null when
  redacted (or unset, where the field is optional), with `status`
  telling the two apart. A gallery keeps its list plus a sibling
  `attachmentsStatus`.
- **Relationships stay generic** except the few fundamental
  containment links pulled forward as named views: `author` on
  every authored node, `target` on a Comment, and `chat` on a
  ChatMessage. Everything else (comments, tags, members, owner) is
  reached through `outgoingEdges` / `incomingEdges` until a named
  view earns its place.

### Supporting display type

```graphql
"A media asset (image / video / audio). Not a graph node — parents
 point at it and it never points back — so it carries no edges."
type MediaAttachment {
  id: UUID!
  url: String!
  mimeType: String!
  sizeBytes: Int
  altText: String
  "Layout hints the frontend reads to reserve space before load."
  options: MediaOptions!
  "The actor that uploaded the asset."
  author: Actor!
  createdAt: DateTime!
}

type MediaOptions {
  "Container aspect ratio as \"W:H\", so layout reserves space pre-load."
  aspectRatio: String
  "Duration in milliseconds, for video / audio."
  durationMs: Int
}
```

### Actors

```graphql
"A person on the platform. Off-graph credentials authenticate the
 API requests that originate its edges."
type User implements Node & Actor {
  "Free-text profile bio."
  bio: ModeratedText!
  "Profile cover image. User-only — Collectives carry no cover."
  cover: ModeratedMedia!
  "Network-scope role. Only Users carry one."
  networkRole: NetworkRole!

  # Private viewer state — each field resolves only when the authenticated
  # viewer is this User; null otherwise (see "Private viewer state" below).
  "Saved-for-later nodes, most recent first."
  bookmarks(first: Int, after: String, last: Int, before: String): BookmarkConnection
  "Nodes this user has seen — the view history behind feed de-duplication."
  viewHistory(first: Int, after: String, last: Int, before: String): ViewHistoryConnection
  "Actors this user has hidden from their own feed."
  hiddenActors(first: Int, after: String, last: Int, before: String): HiddenActorConnection
  "Active authentication sessions, one per refresh token."
  sessions: [Session!]
  "Cross-device preferences."
  preferences: UserPreferences
}

"A group acting through one graph identity (household, band, co-op,
 company, …). Same outgoing-edge catalog as a User; it acts through
 its authorized members per its social contract."
type Collective implements Node & Actor {
  "Profile description."
  description: ModeratedText!
  "The social contract — per-action governance rules. Typed in the
   governance section."
  governance: Governance!
}

"Network-scope role for a User."
enum NetworkRole { MEMBER MODERATOR }
```

### Content nodes

```graphql
"Text and/or media authored by an actor — the primary public
 surface and the canonical feed-ranking target."
type Post implements Node {
  "Optional title / headline."
  title: ModeratedText!
  "Optional short summary or subtitle."
  description: ModeratedText!
  "The body."
  content: ModeratedText!
  author: Actor!
  attachments(first: Int, after: String, last: Int, before: String): PostAttachmentConnection!
  "Moderation status for the attachment gallery as a whole."
  attachmentsStatus: FieldModerationStatus!
  moderationStatus: ModerationStatus!
}

"A threaded response on a Post, Comment, Chat, ChatMessage, or Item
 — the universal threading primitive."
type Comment implements Node {
  "The body."
  content: ModeratedText!
  author: Actor!
  "The node this comment is on."
  target: CommentTarget!
  attachments(first: Int, after: String, last: Int, before: String): CommentAttachmentConnection!
  "Moderation status for the attachment gallery as a whole."
  attachmentsStatus: FieldModerationStatus!
  moderationStatus: ModerationStatus!
}

"What a Comment can be posted on."
union CommentTarget = Post | Comment | Chat | ChatMessage | Item

"A conversation container — a first-class public node. Membership
 and who-talks-to-whom are public; only encrypted message bodies
 are opaque."
type Chat implements Node {
  "Optional display name — any chat may set one, 1:1 or group."
  name: ModeratedText!
  description: ModeratedText!
  image: ModeratedMedia!
  "The founding actor (per authorship.md)."
  author: Actor!
  "Per-action governance (member admission, disavowal, key rotation,
   role and property changes). Typed in the governance section."
  governance: Governance!
  "Current chat-key epoch; advances on membership change and on a
   passed key-rotation Proposal."
  epoch: Int!
  "The requesting user's last-read timestamp in this chat; null when
   anonymous or never read. Field-level, viewer-scoped."
  lastReadAt: DateTime
  "Count of messages newer than the viewer's lastReadAt; null when anonymous."
  unreadCount: Int
  moderationStatus: ModerationStatus!
}

"A single message in a Chat — itself a first-class node: likeable,
 commentable, referenceable."
type ChatMessage implements Node {
  "The body. `value` is plaintext when contentPrivacy is PLAINTEXT,
   ciphertext when ENCRYPTED — returned to everyone, decryptable
   only by a holder of the chat key; null when redacted."
  content: ModeratedText!
  contentPrivacy: ContentPrivacy!
  "The chat-key epoch the ciphertext is under; null for plaintext."
  epoch: Int
  author: Actor!
  "The chat this message belongs to."
  chat: Chat!
  attachments(first: Int, after: String, last: Int, before: String): ChatMessageAttachmentConnection!
  "Moderation status for the attachment gallery as a whole."
  attachmentsStatus: FieldModerationStatus!
  moderationStatus: ModerationStatus!
}

"Per-message body privacy. A single chat may mix both freely."
enum ContentPrivacy { PLAINTEXT ENCRYPTED }

"A physical or digital good — ownable via ItemOwnership,
 transferable, and talked about."
type Item implements Node {
  name: ModeratedText!
  description: ModeratedText!
  author: Actor!
  attachments(first: Int, after: String, last: Int, before: String): ItemAttachmentConnection!
  "Moderation status for the attachment gallery as a whole."
  attachmentsStatus: FieldModerationStatus!
  moderationStatus: ModerationStatus!
}

"A content-addressed topic tag — its identity is its canonical
 name. Authorless and terminal: it has no outgoing edges; content
 reaches it through incoming :TAGGING edges (Post, Comment, Item)
 and ChatMessage → Hashtag :REFERENCES — the one inbound edge that
 carries a tensor and accrues reference-borne ranking signal."
type Hashtag implements Node {
  "Canonical tag, lowercase and without '#'."
  name: ModeratedText!
  moderationStatus: ModerationStatus!
}
```

### Attachment connections

Per-parent media lists. Relationship facts (`displayOrder`,
`isCover`) ride the connection edge, the idiomatic place for
edge metadata.

```graphql
type PostAttachmentConnection {
  edges: [PostAttachmentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type PostAttachmentEdge {
  cursor: String!
  node: MediaAttachment!
  "Order within the gallery."
  displayOrder: Int!
  "Whether this asset leads the gallery."
  isCover: Boolean!
}

type CommentAttachmentConnection {
  edges: [CommentAttachmentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type CommentAttachmentEdge {
  cursor: String!
  node: MediaAttachment!
  displayOrder: Int!
}

type ChatMessageAttachmentConnection {
  edges: [ChatMessageAttachmentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type ChatMessageAttachmentEdge {
  cursor: String!
  node: MediaAttachment!
  displayOrder: Int!
}

type ItemAttachmentConnection {
  edges: [ItemAttachmentEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type ItemAttachmentEdge {
  cursor: String!
  node: MediaAttachment!
  displayOrder: Int!
  isCover: Boolean!
}
```

### Private viewer state

Per-viewer operational state (per [data-model.md](data-model.md)), hung
off the ordinary `User` / `Actor` types as field-level authorization: each
field resolves only when the authenticated viewer is the eligible owner,
and is null otherwise. No `me`-prefixed parallel namespace.

```graphql
"An active authentication session — one per refresh token."
type Session {
  id: UUID!
  "Client-supplied device label, if any."
  deviceLabel: String
  createdAt: DateTime!
  "When the session was last refreshed; null if unused since issue."
  lastUsedAt: DateTime
  expiresAt: DateTime!
  "Whether this is the session that issued the current request."
  isCurrent: Boolean!
}

"A User's cross-device preferences."
type UserPreferences {
  "Sensitive-content filter aggressiveness: 0 (show everything) to 10
   (strictest); null when unset, so the frontend default applies."
  contentFilteringSeverityLevel: Int
}

"An outstanding invite link issued by an actor — a pre-committed onboarding
 gesture. Time-gated and, at the issuer's choice, single-use or multi-use.
 Its id is the link capability, so it is issuer-visible only."
type InviteLink {
  id: UUID!
  "The issuing actor (User or Collective)."
  inviter: Actor!
  "Pre-committed dim1 for the inviter→invitee edge written on acceptance."
  inviterDim1: Dimension!
  "Pre-committed dim2 for that edge."
  inviterDim2: Dimension!
  "Whether the link is consumed by its first accepted registration
   (single-use) or admits many invitees (multi-use)."
  singleUse: Boolean!
  createdAt: DateTime!
  expiresAt: DateTime!
  "When the link was revoked; null if still live."
  revokedAt: DateTime
  "When a single-use link was consumed by its accepted registration;
   always null on a multi-use link."
  consumedAt: DateTime
}

type BookmarkConnection {
  edges: [BookmarkEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type BookmarkEdge {
  cursor: String!
  node: Node!
  bookmarkedAt: DateTime!
}

type ViewHistoryConnection {
  edges: [ViewHistoryEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type ViewHistoryEdge {
  cursor: String!
  node: Node!
  firstSeenAt: DateTime!
}

type HiddenActorConnection {
  edges: [HiddenActorEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type HiddenActorEdge {
  cursor: String!
  node: Actor!
  hiddenAt: DateTime!
}

type InviteLinkConnection {
  edges: [InviteLinkEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type InviteLinkEdge {
  cursor: String!
  node: InviteLink!
}
```

---

## Type system — junctions and governance

Junction nodes (role-bearing, approval-gated relationships) and the
shared `Governance` types that `Collective` and `Chat` carry.
Interface fields stay implied/omitted as before. Junctions are not
content, so they carry no `moderationStatus`. Each junction exposes
two fundamental named views — its `bearer` (the `:BEARER` actor) and
its claim parent — alongside the generic edge access.

### Junction state

```graphql
"A junction relationship's lifecycle state, derived from its
 claim/approval edge pair — never a stored flag. PENDING: claim
 only. ACTIVE: claim + approval, both top layers dim1 > 0. REVOKED:
 a non-positive (dim1 ≤ 0) top layer on either."
enum JunctionState { PENDING ACTIVE REVOKED }
```

### Junction nodes

```graphql
"Membership in a Chat, with a role. Entry may require multi-sig
 approval; the membership itself can be voted on (kick, promote)."
type ChatMember implements Node {
  "The actor this membership represents (the :BEARER edge)."
  bearer: Actor!
  "The chat this membership is in (the claim parent)."
  chat: Chat!
  "Role within the chat — default vocabulary admin / chat_mod /
   member; a chat may define its own."
  role: String!
  "Per-bearer voting-weight override; null means use the role-derived
   weight from the chat's governance."
  votingWeight: Float
  state: JunctionState!
}

"Membership in a Collective, with a role and optional role-attached
 quantities. A Collective can itself be a member, so the bearer may
 be a Collective."
type CollectiveMember implements Node {
  bearer: Actor!
  collective: Collective!
  "Role within the collective (founder / shareholder / worker / …;
   collective-defined)."
  role: String!
  "Ownership stake, when the role implies one."
  ownershipPct: Float
  "Per-bearer voting-weight override; null means role-derived."
  votingWeight: Float
  state: JunctionState!
}

"A single ownership claim on an Item. Transfers form an append-only
 chain of these per item; exactly one is ACTIVE at a time."
type ItemOwnership implements Node {
  bearer: Actor!
  item: Item!
  state: JunctionState!
}
```

### Governance

The social contract a Collective or Chat carries: per-action rules,
each pairing a gate to perform the action (`exec`) with a gate to
amend the rule itself (`amend`).

```graphql
"A node's social contract — its per-action governance rules."
type Governance {
  rules: [GovernanceRule!]!
}

"The rule for one action key (e.g. \"decision:add_member\",
 \"decision:rotate_key\"). `exec` governs performing the action;
 `amend` governs changing this rule — self-applying, no regress."
type GovernanceRule {
  actionKey: String!
  exec: GovernanceExecGate!
  amend: GovernanceAmendGate!
}

"The voting gate for performing an action: who may vote, how their
 votes are weighted, the passing condition, and whether the action's
 subject is barred from voting on it."
type GovernanceExecGate {
  "Who may vote — a predicate over graph state. Role-based in every
   current instance; the role vocabulary is open per collectives.md, so
   the schema carries it as a documented string rather than closing the
   grammar."
  eligibility: String!
  "How each eligible vote is weighted."
  weighting: VoteWeighting!
  "Passing condition — one of the threshold shapes in governance.md §2.4
   (count, fraction of eligible weight, supermajority, quorum +
   cast-fraction, dual-quorum petition, or multi-gate). Carried as a
   documented string; the exact serialization is the instance's choice."
  threshold: String!
  "Whether the subject of the action is barred from voting on it."
  excludeSubject: Boolean!
}

"The voting gate for amending a rule — the same shape as
 GovernanceExecGate without `excludeSubject`, since an amendment's
 subject is the rule entry itself, not a member junction."
type GovernanceAmendGate {
  "Who may vote — see GovernanceExecGate.eligibility."
  eligibility: String!
  "How each eligible vote is weighted."
  weighting: VoteWeighting!
  "Passing condition — see GovernanceExecGate.threshold."
  threshold: String!
}

"How each eligible vote is weighted. EQUAL: every eligible voter counts
 1 (one-member-one-vote). ROLE: the flat per-role multiplier in
 roleWeights. PROPERTY: the weight is read from the named junction
 property (e.g. \"ownership_pct\"), so a PROPERTY gate enfranchises only
 roles that carry that property. A per-junction voting_weight override,
 where set, wins over the mode."
type VoteWeighting {
  mode: WeightMode!
  "ROLE mode — per-role multipliers; null in other modes."
  roleWeights: [RoleWeight!]
  "PROPERTY mode — junction property read as the weight; null otherwise."
  property: String
}

"How a gate weights eligible votes."
enum WeightMode { EQUAL ROLE PROPERTY }

type RoleWeight {
  role: String!
  weight: Float!
}
```

---

## Type system — system, governance records, and economics

The carrier and configuration nodes: `Proposal`, the economics
records (`Campaign`, `Settlement`, `Wallet`), and the `Network`
singleton. Of these, only `Proposal` carries user-authored content —
its `proposedValue` can embed user-authored text and is moderated
like any content field
([nodes.md §6](../primitive/nodes.md#6-carrier-nodes)); the rest
carry none and have no moderation fields. Money lives on the chain;
these nodes hold only pointers and public scalar results.

### Proposal

```graphql
"The subject carrier for a property-level governance vote — targets
 one property on another node via :TARGETS."
type Proposal implements Node {
  "The node whose property is proposed for change (the :TARGETS edge)."
  target: Node!
  "Name of the targeted property, or the sentinel \"node\" for a
   whole-node operation (e.g. illegal-content classification)."
  targetProperty: String!
  "Shape discriminator for proposedValue — \"scalar:string\",
   \"scalar:float\", \"scalar:integer\", \"rule\", or
   \"composite:<action_key>\"."
  valueKind: String!
  "The proposed new value, serialized; its shape is discriminated by
   valueKind — a scalar for scalar:*, a Rule (the GovernanceRule
   exec/amend pair) for 'rule', and a handler-owned from/to bundle for
   composite:*. The one moderatable field on a Proposal — it can embed
   user-authored text, so it is reportable like any content field;
   `value` is null when redacted, and a still-OPEN Proposal then goes
   REDACTED."
  proposedValue: ModeratedText!
  "The node hosting the governance rule this proposal is judged by,
   read as-of the proposal's authorship timestamp."
  ruleAnchor: Node!
  "The proposing actor — the authoring gesture is the author's first vote."
  author: Actor!
  "The live vote tally, computed at read time from current vote edges."
  tally: ProposalTally!
  "Every vote on this Proposal — the incoming vote edges, each from a voter
   (an actor, or an eligibility junction for Shape-B scopes), dim1 carrying
   the stance. Filter by stance; paginated. Public and auditable."
  votes(stance: Sign, first: Int, after: String, last: Int, before: String): EdgeConnection!
  status: ProposalStatus!
}

"A proposal's lifecycle state — transitions exactly once, to a terminal
 value, then permanent; a Proposal stops accepting votes once it leaves
 OPEN. PASSED and PASSED_BUT_INVARIANT_REJECTED land at threshold-cross.
 FAILED is the mirror rule for tallies that count negative votes: the
 negative side satisfied the same threshold shape required of the
 positive side (petition-style tallies count no negatives, so they never
 fail — an unloved petition simply stays OPEN). REDACTED lands when
 proposedValue is redacted while still open — the payload can never
 execute; the votes already cast stay on record."
enum ProposalStatus { OPEN PASSED PASSED_BUT_INVARIANT_REJECTED FAILED REDACTED }

"The live vote tally for a Proposal, computed at read time from the current
 top layer of every eligible voter's vote edge (governance.md §3) — not
 materialized (see data-model.md, read-time aggregation at scale). Positive
 and negative aggregates cover both vote shapes; petition-style
 Network-scope tallies read only the positive side."
type ProposalTally {
  "Weighted positive votes: Σ max(sign(dim1), 0) × voterWeight."
  positiveWeight: Float!
  "Count of distinct voters with a positive top-layer stance."
  positiveCount: Int!
  "Weighted negative votes: Σ max(−sign(dim1), 0) × voterWeight. Nonzero
   only for bidirectional Shape-B scopes, where it feeds the FAILED
   mirror rule; a petition-style Network tally reads only the positive
   side."
  negativeWeight: Float!
  "Count of distinct voters with a negative top-layer stance."
  negativeCount: Int!
}
```

### Economics records

```graphql
"A pull-marketing campaign — a funded public request to raise a
 target node's reach into an anchor's cluster. Carrier node; the
 deposit and payouts live on-chain, the node holds pointers."
type Campaign implements Node {
  "The advertiser — the campaign's authoring actor."
  author: Actor!
  "Actor whose cluster the campaign buys reach into (:ANCHOR)."
  anchor: Actor!
  "The promoted node the campaign drives reach toward (:PROMOTES)."
  target: CampaignTarget!
  "On-chain escrow pointer; the deposit amount is read from chain,
   never stored on the node."
  escrow: String!
  "Decay base for the reach metric and payout split (immutable)."
  g: Float!
  "h_anchor(target) at the start — the baseline."
  hStart: Float!
  "The reach-gain goal denominator (mutable before settlement)."
  declaredGoal: Float!
  startTs: DateTime!
  endTs: DateTime!
  status: CampaignStatus!
  "Path-enumeration dust floor in force (mutable before settlement)."
  dustFloor: Float!
  "Running, approximate reach-gain record; the settled figure lives
   on the Settlement."
  achievedHGain: Float!
  "The settlement record once settled; null while open."
  settlement: Settlement
}

"What a campaign can promote — any actor, content, or Proposal node
 (never a Hashtag)."
union CampaignTarget =
    User | Collective | Post | Comment | Chat | ChatMessage | Item | Proposal

"Campaign lifecycle state. SETTLED: the advertiser released within the
 window plus grace period; AUTO_SETTLED: the backend's settlement key —
 which holds release authority after the grace period — fired the
 default split without the advertiser."
enum CampaignStatus { OPEN SETTLED AUTO_SETTLED }

"The terminal record of a settled Campaign — public results plus
 on-chain pointers. Per-wallet payouts are Merkle leaves, never on
 the graph."
type Settlement implements Node {
  "The campaign that produced this settlement."
  campaign: Campaign!
  "On-chain distributor address; a pointer, no money on the node."
  distributorAddress: String!
  "Payout Merkle root; per-wallet figures verify against it."
  merkleRoot: String!
  "Released amount (public scalar result)."
  settledP: Float!
  "Achieved sustained reach gain (public result)."
  achievedHGain: Float!
  "The attribution instant t* — pins the graph state the split was
   computed from; recorded for reproducibility alongside the dust
   floor in force on the Campaign."
  settledTStar: DateTime!
}

"An account's payout wallet — holds the counterfactual self-custody
 on-chain address. Survives account deletion."
type Wallet implements Node {
  "The counterfactual self-custody on-chain address (layered)."
  address: String!
  "The account this wallet pays out (the :PAYS_TO actor)."
  account: Actor!
}
```

### Network

```graphql
"The singleton instance-configuration node. Every configuration
 property is public and amendable via a Proposal that :TARGETS it;
 the two activity aggregates at the bottom are server-maintained
 read-only counts, not amendable properties. Quorum properties come
 in dual-quorum pairs (a fraction and an absolute count)."
type Network implements Node {
  # Moderation classification quorums
  moderationSensitiveQuorumFraction: Float!
  moderationSensitiveQuorumCount: Int!
  moderationIllegalQuorumFraction: Float!
  moderationIllegalQuorumCount: Int!

  # Moderator-role-change quorum (critical bucket)
  modRoleChangeQuorumFraction: Float!
  modRoleChangeQuorumCount: Int!

  # Platform guidelines (critical tier)
  guidelinesVersion: Int!
  "SHA-256 of the canonical guidelines document (64 hex chars)."
  guidelinesHash: String!
  guidelinesChangeQuorumFraction: Float!
  guidelinesChangeQuorumCount: Int!

  # Eligibility
  "A User counts as active with at least one outgoing actor edge
   inside this window."
  activeThresholdDays: Int!

  # Feed-ranking calibration (baseline bucket)
  timeDecayHalfLifeDays: Int!
  distanceDecayBase: Float!
  dustFloor: Float!

  # Amendment-rule quorums (governance of governance)
  propertyChangeQuorumFraction: Float!
  propertyChangeQuorumCount: Int!
  criticalPropertyChangeQuorumFraction: Float!
  criticalPropertyChangeQuorumCount: Int!

  # Mod-gate
  "Fraction of active moderators that must vote yes for critical-tier
   destructive actions."
  criticalModGateFraction: Float!

  # Maintained activity aggregates (read-only, never amendable)
  "Count of currently active Users — at least one outgoing actor edge
   within activeThresholdDays. The dual-quorum fraction denominator
   (governance.md §3), exposed so a client can compute the operative
   pass bar min(fraction × activeMemberCount, count) and verify a
   PASSED outcome."
  activeMemberCount: Int!
  "Count of currently active moderators — the critical mod-gate
   denominator (governance.md §7)."
  activeModCount: Int!
}
```

---

## Queries

The root `Query` is deliberately small — a handful of entry points;
everything else hangs off the returned nodes through their fields
and the generic edge access. Reads need no authentication; `me`
resolves to null when the request is anonymous rather than erroring.

```graphql
type Query {
  "Resolve the request's auth token to the viewer's own User node.
   Null when the request is unauthenticated — this is the one query
   a client cannot express generically, since it does not yet know
   its own id."
  me: User

  "Fetch any node by id. The generic accessor for heterogeneous ids
   — e.g. resolving a ranked feed's mixed-type UUID list."
  node(id: UUID!): Node
  "Batch form of `node` — fetch many nodes of any types at once,
   order preserved; an unknown id yields null in its slot."
  nodes(ids: [UUID!]!): [Node]!

  user(id: UUID, handle: String): User
  collective(id: UUID, handle: String): Collective
  post(id: UUID!): Post
  comment(id: UUID!): Comment
  chat(id: UUID!): Chat
  chatMessage(id: UUID!): ChatMessage
  item(id: UUID!): Item
  "Look up a hashtag by its canonical name (lowercase, no '#')."
  hashtag(name: String!): Hashtag
  proposal(id: UUID!): Proposal
  campaign(id: UUID!): Campaign
  settlement(id: UUID!): Settlement
  "An account's payout wallet by id."
  wallet(id: UUID!): Wallet
  "The singleton network-configuration node."
  network: Network!

  "Any actor's weight-bounded relevant subgraph — the raw material a
   ranker (that actor's own device or a delegated miner) orders into a
   feed. Parameterized by the `viewer` whose feed is ranked: a delegated
   miner ranks on someone's behalf without holding their auth, and
   computing any actor's view for any reader is the public-graph default
   above. Pruned by `dustFloor` and `distanceDecayBase` — the same ε and
   d(R) base the ranker runs with, defaults Network.dustFloor and
   Network.distanceDecayBase — not hop-bounded: slice membership is
   best-possible contribution `d(R) · ∏|dim| ≥ ε` (feed-ranking.md §4.4,
   §9), a function of both levers, so a ranker running a softened decay
   passes its base or the slice silently drops the distant nodes the
   tuned d(R) keeps above ε. Null if the id resolves to no rankable
   actor. The backend never ranks (feed-ranking.md §9) — it serves this
   slice, and separately hydrates the ordered result via `feed`."
  feedSlice(viewer: UUID!, dustFloor: Float, distanceDecayBase: Float): FeedSlice

  "Hydrate a ranked feed from an ordered list of node ids — a ranker's
   output. Returns those nodes in the given order as a cursor-paginated
   connection; the backend serves the order it is handed, it does not rank."
  feed(
    orderedIds: [UUID!]!
    first: Int, after: String, last: Int, before: String
  ): NodeConnection!

  "Generic edge lookup — filter by source, target, label, top-layer
   dimension sign, and/or a top-layer-timestamp window. The public way
   to read any relationship not yet exposed as a named view."
  edges(
    from: UUID
    to: UUID
    label: EdgeLabel
    dim1Sign: Sign
    dim2Sign: Sign
    since: DateTime
    until: DateTime
    first: Int, after: String, last: Int, before: String
  ): EdgeConnection!

  "The full append-only layer stack of the single edge between two nodes
   — the (from, to) pair identifies it, since an edge carries at most one
   label. Oldest first; the last page's last entry is the current top layer.
   Paginated — a long-lived edge can carry many layers. An opt-in history
   gesture, never ranked."
  edgeHistory(
    from: UUID!, to: UUID!
    first: Int, after: String, last: Int, before: String
  ): EdgeLayerConnection!

  "The full append-only layer stack of one property on a node — a graph
   property or a Postgres display-content field, named by `property`.
   Oldest first; the last page's last entry is the current value. Paginated —
   a frequently-revised property can carry many layers. An opt-in history
   gesture, never ranked."
  propertyHistory(
    id: UUID!, property: String!
    first: Int, after: String, last: Int, before: String
  ): PropertyLayerConnection!

  "Global search across nodes; returns mixed node types. Recall is
   lexical over the indexed name-class fields and post titles; order
   is exact-match tier first, then newest first — viewer-independent,
   the backend never graph-ranks (feed-ranking.md §9). A ranker may
   re-order fetched results by the viewer's feed metric. Valid kinds:
   USER, COLLECTIVE, POST, CHAT, ITEM, HASHTAG; any other kind is a
   validation error — comments carry no indexed field, and chat
   messages are searchable only through chatSearch. Full semantics in
   the Search section."
  search(
    query: String!
    kinds: [NodeKind!]
    first: Int, after: String, last: Int, before: String
  ): SearchConnection!

  "Scoped message search within one chat — word-level full-text over
   plaintext bodies, newest first. Encrypted bodies are never
   searchable server-side: the backend holds only ciphertext
   (chats.md §9). Null if the id resolves to no chat."
  chatSearch(
    chatId: UUID!
    query: String!
    first: Int, after: String, last: Int, before: String
  ): ChatMessageConnection
}
```

### Feed

The backend does not rank (feed-ranking.md §9). It serves the viewer's
weight-bounded subgraph slice; a ranker — the viewer's device or a
delegated miner — orders it and hands back an id list, which `feed`
hydrates in order. The ranking metrics and contributing paths live with
the ranker, specified in [miner-api.md](miner-api.md).

```graphql
"The viewer's relevant subgraph for ranking — nodes and the edges among
 them, weight-bounded by the dust floor under the requested decay base.
 Downloaded by the ranker; the backend computes no order over it."
type FeedSlice {
  nodes(first: Int, after: String, last: Int, before: String): NodeConnection!
  edges(first: Int, after: String, last: Int, before: String): EdgeConnection!
}

"A generic page of nodes — used by the hydrated feed and any mixed-type
 node list."
type NodeConnection {
  edges: [NodeEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type NodeEdge {
  cursor: String!
  node: Node!
}
```

### Search

Search is two surfaces: a global `search` over names and titles,
and a per-chat `chatSearch` over plaintext message bodies.

**What is indexed.** The global index covers the current value of
the name-class fields and post titles: User `username` +
`displayName`, Collective `name` + `displayName`, Hashtag `name`
(served by the Postgres registry — [hashtag.md §3](../instances/hashtag.md#3-postgres-side-content)),
Chat `name`, Item `name`, and Post `title`. Bodies, descriptions,
bios, and attachments are not indexed. A Comment carries no
indexed field and is not a searchable kind — a comment is found
through its post. Chat messages are excluded from the global
index — casual conversation doesn't surface to strangers by
keyword; their search surface is `chatSearch`, and only plaintext
bodies are searchable — encrypted content never is, since the
backend only ever holds ciphertext
([chats.md §9](../instances/chats.md#9-encryption-as-the-privacy-mechanism)).

**Match semantics.** Name-class fields match case-insensitively
by prefix and substring; Post titles and chat-message bodies
match by word-level full-text. The index technology behind those
semantics is an implementation choice.

**Order.** Backend order is exact-match tier first — a result
whose indexed field equals the query case-insensitively — then
newest first. Both keys are viewer-independent: the backend never
ranks by graph
([feed-ranking.md §9](../primitive/feed-ranking.md#9-where-ranking-and-filtering-live)).
Graph-blended ordering is the ranker's option, the same split as
the feed: the client or delegated miner re-orders the fetched
candidates by the viewer's feed metric where the match is in the
viewer's slice; matches outside the slice keep the recency order,
which is the sort cascade's deepest fallback anyway
([feed-ranking.md §5](../primitive/feed-ranking.md#5-algorithm)).
The delegated form is the miner's `rankSearch` operation
([miner-api.md](miner-api.md)).
The no-AI rule applies to search ranking as much as to feeds.
`chatSearch` is always newest first.

**Moderation.** `sensitive`-classified fields stay indexed and
matchable; a result carries its per-field status and the frontend
filters by the viewer's `content_filtering_severity_level` — the
same visibility model as every other read. Redacted fields are
excluded from the index by an explicit rule, not by construction:
the redaction cascade replaces the value in place with a visible
marker ([layers.md §5](../primitive/layers.md#5-deletion-policy)) —
e.g. the `redacted-user-{uuid}` handle sentinel — so a current
value still exists to match. The index skips redacted values (a
version row or layer carrying a non-null redaction reason);
without that rule, a substring query for "redacted" would surface
every redacted handle and title.

```graphql
type SearchConnection {
  edges: [SearchEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type SearchEdge {
  cursor: String!
  node: Node!
}
type ChatMessageConnection {
  edges: [ChatMessageEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type ChatMessageEdge {
  cursor: String!
  node: ChatMessage!
}
```

---

## Mutations

The write surface is the **principled hybrid** fixed in the
governing principles: one generic mutation for setting an actor
edge, named standalone mutations for the gestures that are
genuinely their own thing, combined only where they are the same
gesture. The root `Mutation` is the index; the input and payload
types follow per group.

### Conventions

These bind every mutation below.

- **Single input, dedicated payload.** Each mutation takes one
  `input: <Name>Input!` argument and returns a `<Name>Payload!`.
  The payload wraps the affected node(s) so a caller selects the
  exact post-write shape it needs and the payload can grow a field
  without a breaking signature change.
- **The viewer is the actor, and rides the request; `actAs` names a
  Collective acting through them.** No mutation takes an author
  argument — the authenticated viewer in the execution context is
  the source of every gesture, mirroring the read surface. A
  Collective acts through an authorized member: every mutation whose
  gesture a Collective can produce takes an optional `actAs: UUID`
  naming the Collective the gesture belongs to; null — the default —
  acts as the viewer. The *acting identity* (the viewer, or the
  Collective they act for) is what the gesture's edges originate
  from. `actAs` carries intent only, never authority: the service
  layer checks the viewer's eligibility under the Collective's
  act-as rule and rejects the gesture otherwise. Act-as rules carry
  eligibility only — an eligible member's gesture executes
  immediately as the Collective's own, never held pending
  co-signatures ([collectives.md §2](../instances/collectives.md#2-acting-through-the-collective)).
  Where the target already pins the acting identity — editing
  authored content, accepting an invitation whose membership names a
  Collective bearer, leaving, revoking, settling — there is no
  `actAs`; the identity is read off the target and the same
  eligibility check runs. The Network-scope governance verbs also
  take none — their gestures are per-User
  ([governance.md §3](../primitive/governance.md#petition-style-tally-and-dual-quorum-network-scope-only)).
- **Write inputs are raw scalars; moderation is server-assigned.**
  A field read as `ModeratedText` is *written* as a plain `String`:
  the caller never sets a moderation status, so there is no
  `status` on any input. The server assigns `NORMAL` on write and
  only moderation governance moves it.
- **Append-only, no destructive verbs.** There is no
  `delete`/`unlike`/`unfollow`/`unset`. An `edit*` mutation appends
  a property layer; re-`setEdge` appends an edge layer; severance
  is the `(0,0)` layer, not a removal. The absence follows from the
  primitive ([graph-model.md §8](../primitive/graph-model.md#8-append-only-history-edges)).
- **Proposal-backed actions create a Proposal and the author's
  first vote, atomically.** The governance gestures
  (`removeChatMember`, `classifyContent`, `amendNetworkParameter`,
  …) are convenience verbs over one mechanism: each opens a
  `Proposal` targeting the right node and property and casts the
  author's opening vote. They return that `Proposal` — the outcome
  lands later, when votes cross the threshold and the service layer
  cascades the write. The service dispatches on the target node;
  the caller names intent, not machinery.
- **Authentication.** Every mutation requires an authenticated
  viewer except `register`, `verifyEmail`,
  `resendVerificationEmail`, `logIn`, `refreshSession`,
  `requestPasswordReset`, `confirmPasswordReset`, and the
  token-bearing `confirmAccountDeletion` — the gestures that
  precede or recover a session.

```graphql
type Mutation {
  # ── Generic actor edge ───────────────────────────────────────
  "Set the acting identity's outgoing actor edge toward a node — the
   one generic write for sentiment and connection-weight. Appends a new
   layer if the edge already exists; the (0,0) tensor is severance,
   not removal. Valid targets: User, Collective, Post, Comment,
   Chat, ChatMessage, Item, and the junction nodes; never a
   Proposal (an actor edge toward a Proposal is a vote — use
   castVote), a Hashtag (not a graph gesture), or an
   economics/system node."
  setEdge(input: SetEdgeInput!): SetEdgePayload!

  # ── Content authoring ────────────────────────────────────────
  createPost(input: CreatePostInput!): CreatePostPayload!
  "Append a new layer to one or more of a Post's authored fields."
  editPost(input: EditPostInput!): EditPostPayload!
  createComment(input: CreateCommentInput!): CreateCommentPayload!
  editComment(input: EditCommentInput!): EditCommentPayload!
  "Open a Chat and seat the acting identity as its founding member in
   one gesture (the founder's self-claim collapses to ACTIVE with no
   approval, the N=0 bootstrap)."
  createChat(input: CreateChatInput!): CreateChatPayload!
  "Post a message to a Chat the acting identity is an active member
   of. contentPrivacy and epoch decide plaintext vs ciphertext."
  createChatMessage(input: CreateChatMessageInput!): CreateChatMessagePayload!
  editChatMessage(input: EditChatMessageInput!): EditChatMessagePayload!
  createItem(input: CreateItemInput!): CreateItemPayload!
  editItem(input: EditItemInput!): EditItemPayload!
  "Append a new layer to the viewer's own profile fields (handle,
   displayName, bio, avatar, cover, websiteUrl). Self only — no id,
   the viewer is the edited User."
  editProfile(input: EditProfileInput!): EditProfilePayload!
  "Upload a media asset and get back its MediaAttachment id, to
   reference from a create/edit content input."
  uploadMedia(input: UploadMediaInput!): UploadMediaPayload!

  # ── Voting ───────────────────────────────────────────────────
  "Cast — or recast — the acting identity's vote on a Proposal. The
   service resolves the vote shape: a Network-scope Proposal takes
   the viewer's direct User→Proposal actor edge (Shape A); a
   chat/collective-scope Proposal takes the structural edge from the
   voter's eligible junction (Shape B). Recasting appends a new
   layer — this is how a vote is changed; there is no separate
   gesture. dim1 carries the stance; a non-positive dim1 is a valid
   recorded edge that a petition-style tally does not count. In a
   bidirectional tally only a negative dim1 counts toward the FAILED
   mirror bar; a zero dim1 counts to neither side — (0, 0) is the
   abstain layer that vote recasting and the eligibility-dropout
   cascade write (governance.md §6). Votes are accepted only while
   the Proposal is OPEN."
  castVote(input: CastVoteInput!): CastVotePayload!

  # ── Chat membership and lifecycle ────────────────────────────
  "Request to join a Chat. Resolves to an ACTIVE membership when the
   chat admits openly (threshold 0), or a PENDING one carrying an
   admission Proposal otherwise."
  joinChat(input: JoinChatInput!): JoinChatPayload!
  "Invite an actor into a Chat (inviter-first admission). Opens the
   membership and its admission Proposal with the inviter's approving
   vote; the invitee's acceptance is their self-claim."
  inviteChatMember(input: InviteChatMemberInput!): InviteChatMemberPayload!
  "Accept a chat invitation — the invitee's self-claim: their Shape A
   vote on the admission Proposal plus their :AUTHOR edge on the
   membership; resolves to ACTIVE once approvals suffice."
  acceptChatInvite(input: AcceptChatInviteInput!): AcceptChatInvitePayload!
  "Leave a Chat — a unilateral negative layer on the named
   membership's claim; no vote, the junction goes REVOKED and the
   chat epoch advances. The membership's bearer (the viewer, or a
   Collective they act for) is who leaves."
  leaveChat(input: LeaveChatInput!): LeaveChatPayload!
  changeChatMemberRole(input: ChangeChatMemberRoleInput!): ProposalPayload!
  "Disavow a member (Level 2) — proposal-backed; on passing, a
   negative approval layer revokes the membership."
  removeChatMember(input: RemoveChatMemberInput!): ProposalPayload!
  "Disavow a message (Level 1) — proposal-backed; the body persists,
   the chat's collective stance moves away from it."
  disavowChatMessage(input: DisavowChatMessageInput!): ProposalPayload!
  "Rotate the chat key mid-epoch — proposal-backed; on passing,
   Chat.epoch advances."
  rotateChatKey(input: RotateChatKeyInput!): ProposalPayload!
  "Change one of a Chat's profile fields (name, description, image) —
   proposal-backed; each field is a simple single-property Proposal
   under its own gate, so one field per call."
  editChatProfile(input: EditChatProfileInput!): ProposalPayload!

  # ── Collectives ──────────────────────────────────────────────
  "Create a Collective and seat the acting identity as its founding
   member (N=0 bootstrap), with the social contract supplied inline."
  createCollective(input: CreateCollectiveInput!): CreateCollectivePayload!
  joinCollective(input: JoinCollectiveInput!): JoinCollectivePayload!
  inviteCollectiveMember(input: InviteCollectiveMemberInput!): InviteCollectiveMemberPayload!
  "Accept a collective invitation — the invitee's self-claim: their
   Shape A vote on the admission Proposal plus their :AUTHOR edge on
   the membership; resolves to ACTIVE once approvals suffice."
  acceptCollectiveInvite(input: AcceptCollectiveInviteInput!): AcceptCollectiveInvitePayload!
  leaveCollective(input: LeaveCollectiveInput!): LeaveCollectivePayload!
  changeCollectiveMemberRole(input: ChangeCollectiveMemberRoleInput!): ProposalPayload!
  removeCollectiveMember(input: RemoveCollectiveMemberInput!): ProposalPayload!
  "Amend one governance rule on a Collective or Chat — proposal-backed,
   judged by that rule's own amend gate."
  amendGovernanceRule(input: AmendGovernanceRuleInput!): ProposalPayload!
  "Change one of a Collective's profile fields (displayName,
   description, avatar, websiteUrl) — proposal-backed; each field is a
   simple single-property Proposal under its own gate, so one field
   per call."
  editCollectiveProfile(input: EditCollectiveProfileInput!): ProposalPayload!

  # ── Items ────────────────────────────────────────────────────
  "Initiate an ownership transfer — opens a transfer Proposal for the
   next ItemOwnership; the counterparty approves with castVote. Works
   owner-first (offer) or acquirer-first (request); the service infers
   direction from whether the acting identity is the current owner."
  transferItem(input: TransferItemInput!): TransferItemPayload!

  # ── Network-scope governance ─────────────────────────────────
  "Report content for classification (sensitive / illegal / back to
   normal) — proposal-backed, judged by the Network's moderation
   gate. Targets a per-field status, or the whole node. NORMAL is
   valid only against a SENSITIVE classification — an 'illegal'
   redaction is terminal (moderation.md §4)."
  classifyContent(input: ClassifyContentInput!): ProposalPayload!
  proposeModeratorRoleChange(input: ProposeModeratorRoleChangeInput!): ProposalPayload!
  amendNetworkParameter(input: AmendNetworkParameterInput!): ProposalPayload!
  amendGuidelines(input: AmendGuidelinesInput!): ProposalPayload!
  "The generic proposal escape hatch — propose a change to any
   targetable property for which no named verb above fits. Prefer a
   named verb when one exists."
  proposeChange(input: ProposeChangeInput!): ProposalPayload!

  # ── Economics (the API subset; money moves on-chain) ─────────
  "Open a pull-marketing campaign carrier node. The deposit is
   escrowed on-chain beforehand; the node holds only the pointer."
  createCampaign(input: CreateCampaignInput!): CreateCampaignPayload!
  "Adjust a campaign's mutable knobs (declaredGoal, endTs, dustFloor)
   while it is OPEN."
  updateCampaign(input: UpdateCampaignInput!): UpdateCampaignPayload!
  "Settle an OPEN campaign. The release is already executed
   on-chain; writes the Settlement record pointing at it. The split
   is graph-computed, never advertiser-chosen."
  settleCampaign(input: SettleCampaignInput!): SettleCampaignPayload!
  "Re-point the viewer's payout Wallet to a new on-chain address
   (append a layer; the binding survives)."
  relinkWallet(input: RelinkWalletInput!): RelinkWalletPayload!

  # ── Auth and accounts (off-graph state, per auth.md) ─────────
  "Submit a registration through an invite link. Writes the off-graph
   pending-registration record and sends the verification email — no
   User node or session exists until verifyEmail."
  register(input: RegisterInput!): RegisterPayload!
  "Complete registration with the emailed verification token.
   Atomically creates the User node and its Wallet, writes the two
   invitation edges, and issues the first session (auth.md)."
  verifyEmail(input: VerifyEmailInput!): AuthPayload!
  "Re-send the verification email for a live pending registration.
   Rate-limited per pending-registration record (auth.md)."
  resendVerificationEmail(input: ResendVerificationEmailInput!): ResendVerificationEmailPayload!
  logIn(input: LogInInput!): AuthPayload!
  refreshSession(input: RefreshSessionInput!): AuthPayload!
  "Revoke one session (the current one if no id is given)."
  revokeSession(input: RevokeSessionInput!): RevokeSessionPayload!
  "Revoke every session except the one making the request."
  revokeOtherSessions: RevokeSessionsPayload!
  requestPasswordReset(input: RequestPasswordResetInput!): RequestPasswordResetPayload!
  confirmPasswordReset(input: ConfirmPasswordResetInput!): ConfirmPasswordResetPayload!
  "Change the password from within an authenticated session,
   re-authenticating with the current one. A security event — revokes
   the account's other sessions."
  changePassword(input: ChangePasswordInput!): ChangePasswordPayload!
  "Begin an email change: re-authenticates, sends a confirmation code
   to the current (original) address to prove account control, and a
   verification link to the new address to prove it is reachable. The
   address does not change until confirmEmailChange."
  requestEmailChange(input: RequestEmailChangeInput!): RequestEmailChangePayload!
  "Complete an email change with the code from the current address;
   applies only once the new address has been verified too."
  confirmEmailChange(input: ConfirmEmailChangeInput!): ConfirmEmailChangePayload!
  "Issue a time-gated invite link — single-use or multi-use, the
   issuer's choice — carrying the inviter's pre-committed edge tensor."
  createInviteLink(input: CreateInviteLinkInput!): CreateInviteLinkPayload!
  revokeInviteLink(input: RevokeInviteLinkInput!): RevokeInviteLinkPayload!
  "Begin account deletion (identity-only, or content-inclusive);
   sends the confirmation link. The 7-day grace period opens at
   confirmAccountDeletion, not here."
  requestAccountDeletion(input: RequestAccountDeletionInput!): AccountDeletionPayload!
  confirmAccountDeletion(input: ConfirmAccountDeletionInput!): AccountDeletionPayload!
  cancelAccountDeletion: AccountDeletionPayload!

  # ── Private viewer state (Postgres; field-authorized to self) ─
  setBookmark(input: SetBookmarkInput!): SetBookmarkPayload!
  removeBookmark(input: RemoveBookmarkInput!): RemoveBookmarkPayload!
  hideActor(input: HideActorInput!): HideActorPayload!
  unhideActor(input: UnhideActorInput!): UnhideActorPayload!
  "Record that the viewer has seen a node (the feed de-dup signal)."
  markSeen(input: MarkSeenInput!): MarkSeenPayload!
  "Advance the viewer's last-read pointer in a Chat."
  markChatRead(input: MarkChatReadInput!): MarkChatReadPayload!
  setPreferences(input: SetPreferencesInput!): SetPreferencesPayload!
}

"The shared payload for every proposal-backed governance mutation:
 the Proposal that was opened, carrying the author's first vote. The
 outcome is read later off the Proposal's tally and status."
type ProposalPayload {
  proposal: Proposal!
}
```

### The generic actor edge

```graphql
"The acting identity's outgoing actor edge toward `target`. No source
 argument — the viewer (or the Collective named by actAs) is the
 source; no label — it is always the :ACTOR edge. Writing again
 appends a layer; (0,0) is severance."
input SetEdgeInput {
  target: UUID!
  dim1: Dimension!
  dim2: Dimension!
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}

type SetEdgePayload {
  "The edge's new top layer."
  edge: Edge!
}
```

The valid targets are exactly the node kinds the catalog defines an
inbound actor edge for
([edges.md §1](../primitive/edges.md#1-actor-edges)): the two actors,
the five content kinds, and the three junction kinds. A `target`
that resolves to a `Proposal`, `Hashtag`, `Campaign`, `Settlement`,
`Wallet`, or `Network` is rejected — a Proposal because the actor
edge toward it *is* a vote (one label per endpoint pair, so the two
cannot coexist; use `castVote`), a Hashtag because liking a tag is
not a graph operation, the rest because they carry no inbound actor
edge. The one further guard: a Collective setting an edge toward its
*own* `CollectiveMember` is rejected, because the `:APPROVAL` edge
already owns that pair.

### Content authoring

```graphql
"Author a Post. Body fields are plain strings — moderation status is
 server-assigned. Tags and references are explicit structured inputs,
 never parsed from the body, so display content and graph topology
 stay decoupled."
input CreatePostInput {
  title: String
  description: String
  content: String!
  "Media assets, in gallery order; mark at most one as the cover."
  attachments: [AttachmentInput!]
  "Hashtag names to tag (lowercase, no '#'); created implicitly if new."
  tags: [String!]
  "Nodes this Post references; the per-reference tensor splits the
   reference fan-out budget."
  references: [ReferenceInput!]
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}

"One attachment placement within a gallery."
input AttachmentInput {
  mediaId: UUID!
  displayOrder: Int!
  isCover: Boolean
}

"A reference from authored content to another node, carrying its
 share of the fan-out budget."
input ReferenceInput {
  target: UUID!
  dim1: Dimension!
  dim2: Dimension!
}

"Append a new layer to any subset of a Post's authored fields; a
 supplied gallery replaces the current arrangement (the assets stay
 append-only). Omitted fields are untouched; there is no overwrite."
input EditPostInput {
  id: UUID!
  title: String
  description: String
  content: String
  attachments: [AttachmentInput!]
  tags: [String!]
  references: [ReferenceInput!]
}

type CreatePostPayload { post: Post! }
type EditPostPayload { post: Post! }

input CreateCommentInput {
  "The node the comment is on (a CommentTarget)."
  target: UUID!
  content: String!
  attachments: [AttachmentInput!]
  "Hashtag names to tag (lowercase, no '#'); created implicitly if new."
  tags: [String!]
  references: [ReferenceInput!]
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
input EditCommentInput {
  id: UUID!
  content: String
  attachments: [AttachmentInput!]
  tags: [String!]
  references: [ReferenceInput!]
}
type CreateCommentPayload { comment: Comment! }
type EditCommentPayload { comment: Comment! }

"Open a Chat. The acting identity becomes its founding member in the
 same gesture; the founder seat needs no approval."
input CreateChatInput {
  name: String
  description: String
  imageMediaId: UUID
  "The social contract; defaults to the standard chat governance if
   omitted."
  governance: GovernanceInput
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
type CreateChatPayload {
  chat: Chat!
  "The founder's own membership, already ACTIVE."
  membership: ChatMember!
}

"Post a message to a chat the acting identity actively belongs to.
 For an encrypted message, `content` is the ciphertext and `epoch`
 names the key it is under; for plaintext, `epoch` is null."
input CreateChatMessageInput {
  chat: UUID!
  content: String!
  contentPrivacy: ContentPrivacy!
  epoch: Int
  attachments: [AttachmentInput!]
  references: [ReferenceInput!]
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
input EditChatMessageInput {
  id: UUID!
  content: String
  contentPrivacy: ContentPrivacy
  epoch: Int
  attachments: [AttachmentInput!]
}
type CreateChatMessagePayload { message: ChatMessage! }
type EditChatMessagePayload { message: ChatMessage! }

input CreateItemInput {
  name: String!
  description: String
  attachments: [AttachmentInput!]
  tags: [String!]
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
input EditItemInput {
  id: UUID!
  name: String
  description: String
  attachments: [AttachmentInput!]
  tags: [String!]
}
type CreateItemPayload {
  item: Item!
  "The author's initial ownership, already ACTIVE."
  ownership: ItemOwnership!
}
type EditItemPayload { item: Item! }

"Append a new layer to the viewer's own profile. Self only — the
 viewer is the User edited, so there is no id. Omitted fields are
 untouched; a handle change is subject to the global handle-uniqueness
 constraint."
input EditProfileInput {
  handle: String
  displayName: String
  bio: String
  avatarMediaId: UUID
  coverMediaId: UUID
  websiteUrl: String
}
type EditProfilePayload { user: User! }

"Upload a single media asset. The binary rides the GraphQL multipart
 request as an Upload; layout hints the server cannot infer (alt
 text) are supplied, the rest (aspect ratio, duration) are derived."
input UploadMediaInput {
  file: Upload!
  altText: String
  "Act as this Collective (see conventions); null = the viewer's own
   gesture — the asset's author."
  actAs: UUID
}
type UploadMediaPayload { media: MediaAttachment! }
```

A media gallery on a create/edit input is the **full intended
gallery** for that write: the new current arrangement, given as
`AttachmentInput` placements that reference assets already uploaded
via `uploadMedia`. Gallery arrangement is a named append-only
carve-out ([layers.md §5](../primitive/layers.md#5-deletion-policy)) —
an edit replaces the junction rows that order the gallery, while the
assets themselves stay append-only (redaction tombstones them in
place, never deletes). `Upload` is the standard GraphQL
multipart-request scalar — the one place the API ingests a binary
rather than JSON.

The valid `references` targets are per-source. A ChatMessage may
reference any node — including a Hashtag, its only path to one,
since ChatMessage has no `:TAGGING` edge type. A Post or Comment
`references` entry naming a Hashtag is rejected: `:TAGGING`
already owns that pair, and a (source, target) pair carries one
structural edge
([edges.md §2 "Reference"](../primitive/edges.md#reference));
tags go through the `tags` input.

### Voting

```graphql
"A vote on a Proposal. No voter argument — the acting identity is the
 voter, and the service resolves whether the vote is the voter's
 direct actor edge (Network scope) or their eligible junction's
 structural edge (chat/collective scope). `as` names the voting
 junction explicitly when the voter holds more than one eligible
 junction."
input CastVoteInput {
  proposal: UUID!
  dim1: Dimension!
  "Shape A only — the importance / personal-stake dimension of the
   voter's actor edge; null defaults to 0. On a Shape B vote the
   structural edge's dim2 is canon-fixed at 0 (edges.md §2): null or
   0 is accepted, anything else is a validation error."
  dim2: Dimension
  "The junction to vote from, when the voter has several eligible
   ones; defaults to the unique eligible junction."
  as: UUID
  "Act as this Collective (see conventions); null = the viewer votes.
   Coexists with `as`: actAs names who votes, `as` names which of
   their junctions carries the vote."
  actAs: UUID
}

type CastVotePayload {
  "The vote edge's new top layer."
  vote: Edge!
  "The Proposal's tally and status, recomputed after the vote."
  proposal: Proposal!
}
```

### Chat membership and lifecycle

```graphql
input JoinChatInput {
  chat: UUID!
  "Requested role; defaults to the chat's member role."
  role: String
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
type JoinChatPayload {
  membership: ChatMember!
  "The admission Proposal when approval is required; null on an open
   (threshold-0) join that is already ACTIVE."
  admission: Proposal
}

input InviteChatMemberInput {
  chat: UUID!
  invitee: UUID!
  role: String
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
type InviteChatMemberPayload {
  "The PENDING membership awaiting the invitee's self-claim."
  membership: ChatMember!
  admission: Proposal!
}

input LeaveChatInput {
  "The membership to leave. Its :BEARER pins who leaves — the viewer's
   own membership, or one borne by a Collective the viewer may act
   for; the junction id disambiguates, so there is no actAs."
  membership: UUID!
}
type LeaveChatPayload {
  membership: ChatMember!
}

input ChangeChatMemberRoleInput {
  membership: UUID!
  role: String!
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
input RemoveChatMemberInput {
  membership: UUID!
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
input DisavowChatMessageInput {
  message: UUID!
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
input RotateChatKeyInput {
  chat: UUID!
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}

"Accept an invitation to a chat — the invitee's self-claim, cast as
 their vote on the admission Proposal."
input AcceptChatInviteInput {
  membership: UUID!
}
type AcceptChatInvitePayload {
  membership: ChatMember!
  admission: Proposal!
}

"Change a Chat's profile — exactly one of name / description /
 imageMediaId. Each profile field is a simple single-property Proposal
 judged by its own `decision:set:*` gate
 ([collectives.md §8](../instances/collectives.md#simple-and-composite-actions),
 [proposal.md §2](../instances/proposal.md#composite-proposals));
 supplying more than one field is a validation error — there is no
 multi-field bundle."
input EditChatProfileInput {
  chat: UUID!
  name: String
  description: String
  imageMediaId: UUID
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
```

### Collectives

```graphql
"Create a Collective with its social contract; the acting identity
 becomes the founding member (a Collective founding a sub-Collective
 acts through actAs)."
input CreateCollectiveInput {
  handle: String!
  displayName: String!
  description: String
  avatarMediaId: UUID
  websiteUrl: String
  governance: GovernanceInput!
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
type CreateCollectivePayload {
  collective: Collective!
  membership: CollectiveMember!
}

input JoinCollectiveInput {
  collective: UUID!
  role: String
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
type JoinCollectivePayload {
  membership: CollectiveMember!
  admission: Proposal
}

input InviteCollectiveMemberInput {
  collective: UUID!
  invitee: UUID!
  role: String
  "Ownership stake, where the role implies one."
  ownershipPct: Float
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
type InviteCollectiveMemberPayload {
  membership: CollectiveMember!
  admission: Proposal!
}

input LeaveCollectiveInput {
  "The membership to leave. Its :BEARER pins who leaves — the viewer's
   own membership, or one borne by a Collective the viewer may act
   for; the junction id disambiguates, so there is no actAs."
  membership: UUID!
}
type LeaveCollectivePayload {
  membership: CollectiveMember!
}

input ChangeCollectiveMemberRoleInput {
  membership: UUID!
  role: String
  ownershipPct: Float
  votingWeight: Float
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
input RemoveCollectiveMemberInput {
  membership: UUID!
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}

"Accept an invitation to a collective — the invitee's self-claim, cast
 as their vote on the admission Proposal."
input AcceptCollectiveInviteInput {
  membership: UUID!
}
type AcceptCollectiveInvitePayload {
  membership: CollectiveMember!
  admission: Proposal!
}

"Change a Collective's profile — exactly one of displayName /
 description / avatarMediaId / websiteUrl. Each profile field is a
 simple single-property Proposal judged by its own `decision:set:*`
 gate ([collectives.md §8](../instances/collectives.md#simple-and-composite-actions));
 supplying more than one field is a validation error — there is no
 multi-field bundle."
input EditCollectiveProfileInput {
  collective: UUID!
  displayName: String
  description: String
  avatarMediaId: UUID
  websiteUrl: String
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}

"Amend one rule of a node's social contract, addressed by its action
 key. The rule's own amend gate judges the change."
input AmendGovernanceRuleInput {
  "The Collective or Chat whose governance is amended."
  node: UUID!
  actionKey: String!
  rule: GovernanceRuleInput!
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
```

The social-contract inputs (`GovernanceInput`, `GovernanceRuleInput`)
mirror the read-side `Governance` types and are defined under
[Governance inputs](#governance-inputs) below.

### Items

```graphql
"Initiate an ownership transfer. Owner-first (the acting identity is
 the current owner offering to `counterparty`) and acquirer-first (the
 acting identity requests ownership from the current owner) are the
 same gesture; the service reads the direction from the acting
 identity's relation to the item. Approval is the counterparty's
 castVote on the returned Proposal."
input TransferItemInput {
  item: UUID!
  counterparty: UUID!
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
type TransferItemPayload {
  "The PENDING next ownership."
  ownership: ItemOwnership!
  transfer: Proposal!
}
```

### Network-scope governance

```graphql
"Propose a moderation classification on content. `field` names the
 per-field status to move, or 'node' for a whole-node classification;
 `status` is the target state. NORMAL un-classifies a SENSITIVE field
 only — REDACTED ('illegal') is terminal, so a NORMAL proposal
 against a redacted field is rejected
 ([moderation.md §4](../instances/moderation.md#4-eligibility-weights-thresholds)).
 A Proposal is itself a valid target for exactly one field — its
 proposedValue."
input ClassifyContentInput {
  target: UUID!
  field: String!
  status: ModerationStatus!
}

input ProposeModeratorRoleChangeInput {
  user: UUID!
  role: NetworkRole!
}

"Amend one Network configuration property. `value` is serialized per
 the property's type."
input AmendNetworkParameterInput {
  parameter: String!
  value: String!
}

"Bump the platform guidelines to a new version and content hash."
input AmendGuidelinesInput {
  version: Int!
  "SHA-256 of the canonical guidelines document (64 hex chars)."
  hash: String!
}

"The generic proposal — a change to any targetable property. Shape
 discriminated by valueKind, exactly as the Proposal read type."
input ProposeChangeInput {
  target: UUID!
  targetProperty: String!
  valueKind: String!
  proposedValue: String!
  "Act as this Collective (see conventions); null = the viewer's own
   gesture."
  actAs: UUID
}
```

### Economics

Only the carrier-node gestures are GraphQL mutations; money moves
on-chain and is never written through this API. Minting, burning,
deposits, transfers, payout claims, and auto-settlement are on-chain
or scheduled operations — their graph traces (`:TRANSFERS`,
`:ENTITLES`, `:CLAIMS`, `:PAYS_TO`) are system-written, never set by
a client mutation ([ledger.md](ledger.md)).

```graphql
"Open a campaign. The deposit is already escrowed on-chain; `escrow`
 is the pointer, the amount is read from chain. `g` is fixed at
 open and the baseline hStart is h_anchor(target) at startTs;
 declaredGoal, endTs, and dustFloor remain tunable while OPEN."
input CreateCampaignInput {
  anchor: UUID!
  "Must differ from anchor — anchor == target is degenerate
   (h(self) is undefined) and rejected."
  target: UUID!
  escrow: String!
  "Strictly positive — the auto-settlement formula divides by it,
   so declaredGoal ≤ 0 is rejected."
  declaredGoal: Float!
  "Defaults to the Network's distance_decay_base in force at
   creation."
  g: Float
  startTs: DateTime!
  endTs: DateTime!
  dustFloor: Float
  "Act as this Collective (see conventions); null = the viewer's own
   gesture — the campaign's advertiser."
  actAs: UUID
}
type CreateCampaignPayload { campaign: Campaign! }

"Adjust an OPEN campaign's mutable knobs. Omitted fields are
 untouched; each supplied field appends a layer."
input UpdateCampaignInput {
  campaign: UUID!
  "Strictly positive, as at creation."
  declaredGoal: Float
  "Window extension — free and unlimited."
  endTs: DateTime
  dustFloor: Float
}
type UpdateCampaignPayload { campaign: Campaign! }

"Settle a campaign. The release is already executed on-chain by the
 holder of release authority; `release` is the pointer — the
 released pool P and the payout Merkle root are read from chain,
 never passed through this API. The per-wallet split is
 graph-computed, never advertiser-chosen. An earlier attribution
 snapshot may be named within the campaign window."
input SettleCampaignInput {
  campaign: UUID!
  release: String!
  attributionSnapshotTs: DateTime
}
type SettleCampaignPayload {
  campaign: Campaign!
  settlement: Settlement!
}

input RelinkWalletInput {
  wallet: UUID!
  address: String!
}
type RelinkWalletPayload { wallet: Wallet! }
```

### Auth and accounts

The token mechanics (JWT access + rotating refresh, sessions,
invitation registration) are specified in [auth.md](auth.md); this
surface consumes them.

```graphql
"Register through an invite link. Verification writes both invitation
 edges ([invitations.md](../primitive/invitations.md)): inviter→invitee
 from the link's pre-committed tensor, invitee→inviter from dim1/dim2
 here."
input RegisterInput {
  inviteLink: UUID!
  handle: String!
  email: String!
  password: String!
  "The invitee's own outgoing edge toward the inviter — initially
   their only outbound connection, so it shapes their entire first
   feed. Null means an explicit skip: the (+0.5, +0.5) fallback."
  dim1: Dimension
  dim2: Dimension
}

"The pending registration's receipt. No User node or session exists
 yet — both arrive at verifyEmail."
type RegisterPayload {
  "When the pending registration expires unverified (24 h, auth.md)."
  expiresAt: DateTime!
}

input VerifyEmailInput {
  verificationToken: String!
  deviceLabel: String
}

input ResendVerificationEmailInput { email: String! }
"Always succeeds, to avoid revealing whether a pending registration
 exists."
type ResendVerificationEmailPayload { ok: Boolean! }

input LogInInput {
  email: String!
  password: String!
  deviceLabel: String
}

input RefreshSessionInput {
  refreshToken: String!
}

"A fresh access + refresh token pair, the issuing session, and the
 viewer it authenticates."
type AuthPayload {
  accessToken: String!
  refreshToken: String!
  session: Session!
  user: User!
}

input RevokeSessionInput {
  "The session to revoke; the current one if omitted."
  session: UUID
}
type RevokeSessionPayload {
  "The revoked session, in its terminal state."
  session: Session!
}
type RevokeSessionsPayload {
  revokedCount: Int!
}

input RequestPasswordResetInput { email: String! }
"Always succeeds, to avoid revealing whether an account exists."
type RequestPasswordResetPayload { ok: Boolean! }

input ConfirmPasswordResetInput {
  resetToken: String!
  newPassword: String!
}
type ConfirmPasswordResetPayload { ok: Boolean! }

"Change the password while authenticated. Re-verifies currentPassword,
 breach-checks newPassword, and revokes the account's other sessions."
input ChangePasswordInput {
  currentPassword: String!
  newPassword: String!
}
type ChangePasswordPayload { ok: Boolean! }

"Begin an email change. Re-authenticates with currentPassword; the
 server sends a confirmation code to the current address and a
 verification link to newEmail."
input RequestEmailChangeInput {
  newEmail: String!
  currentPassword: String!
}
"Always succeeds for a well-formed request, to avoid revealing whether
 newEmail is already registered."
type RequestEmailChangePayload { ok: Boolean! }

"Complete an email change. `code` is the one mailed to the current
 (original) address; the change applies only if newEmail's
 verification link has also been followed."
input ConfirmEmailChangeInput {
  code: String!
}
type ConfirmEmailChangePayload { user: User! }

input CreateInviteLinkInput {
  expiresAt: DateTime!
  "Pre-committed tensor for the inviter→invitee edge on acceptance."
  inviterDim1: Dimension!
  inviterDim2: Dimension!
  "Consumed by the first accepted registration when true; admits many
   invitees otherwise. Defaults to multi-use."
  singleUse: Boolean
  "Act as this Collective (see conventions); null = the viewer's own
   gesture — the link's issuer."
  actAs: UUID
}
type CreateInviteLinkPayload {
  "The link — its id is the shareable capability."
  inviteLink: InviteLink!
}

input RevokeInviteLinkInput { inviteLink: UUID! }
type RevokeInviteLinkPayload { inviteLink: InviteLink! }

"Begin deletion. Identity-only by default; opt into content-level
 redaction with includeContent."
input RequestAccountDeletionInput {
  includeContent: Boolean
}
"Confirming opens the 7-day grace period and fixes the execution
 deadline ([account-deletion.md §4](../instances/account-deletion.md#4-the-user-self-service-trigger))."
input ConfirmAccountDeletionInput {
  deletionToken: String!
  "Opt into content-level redaction at confirmation — the second of
   the two moments canon allows. The election is opt-in only: true
   upgrades an identity-only request; null and false leave the
   request-time choice unchanged."
  includeContent: Boolean
}
"The pending deletion's state. scheduledFor is the grace-period
 deadline — set at confirmation, null before it and once cancelled."
type AccountDeletionPayload {
  scheduledFor: DateTime
  includesContent: Boolean!
}
```

### Private viewer state

Per-viewer operational state in Postgres
([data-model.md](data-model.md)) — each mutation writes only the
authenticated viewer's own state, the write-side mirror of the
field-level authorization on the read surface. None of it touches
the graph.

```graphql
input SetBookmarkInput { node: UUID! }
type SetBookmarkPayload { bookmark: BookmarkEdge! }
input RemoveBookmarkInput { node: UUID! }
type RemoveBookmarkPayload { ok: Boolean! }

input HideActorInput { actor: UUID! }
type HideActorPayload { hidden: HiddenActorEdge! }
input UnhideActorInput { actor: UUID! }
type UnhideActorPayload { ok: Boolean! }

input MarkSeenInput {
  "The nodes the viewer has seen."
  nodes: [UUID!]!
}
type MarkSeenPayload { ok: Boolean! }

input MarkChatReadInput {
  chat: UUID!
  "Read-pointer timestamp; defaults to now."
  at: DateTime
}
type MarkChatReadPayload { chat: Chat! }

input SetPreferencesInput {
  "0 (show everything) to 10 (strictest); null restores the default."
  contentFilteringSeverityLevel: Int
}
type SetPreferencesPayload { preferences: UserPreferences! }
```

Bookmarks and hidden-actors have explicit `remove*` verbs because the
"no destructive operation" rule is a *graph* invariant — private
operational state carries no append-only history and no public
visibility, so a remove is a genuine delete of a row, not a redaction.

### Governance inputs

The write-side mirror of the `Governance` read types. A
`GovernanceInput` is the full social contract supplied at
`createChat` / `createCollective`; a single `GovernanceRuleInput`
is the unit of `amendGovernanceRule`.

```graphql
input GovernanceInput {
  rules: [GovernanceRuleInput!]!
}

input GovernanceRuleInput {
  actionKey: String!
  exec: GovernanceExecGateInput!
  amend: GovernanceAmendGateInput!
}

input GovernanceExecGateInput {
  eligibility: String!
  weighting: VoteWeightingInput!
  threshold: String!
  excludeSubject: Boolean!
}

input GovernanceAmendGateInput {
  eligibility: String!
  weighting: VoteWeightingInput!
  threshold: String!
}

input VoteWeightingInput {
  mode: WeightMode!
  roleWeights: [RoleWeightInput!]
  property: String
}

input RoleWeightInput {
  role: String!
  weight: Float!
}
```

### Scalars added by the write surface

```graphql
"The GraphQL multipart-request upload scalar — a binary body part
 referenced from a mutation variable. Used only by uploadMedia."
scalar Upload
```
