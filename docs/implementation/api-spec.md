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
  "Typed, optional, per-label metadata — surfaced but never read by
   ranking. Null on labels that don't use it."
  systemDimension: SystemDimension
}

"One immutable layer of an Edge."
type EdgeLayer {
  dim1: Dimension!
  dim2: Dimension!
  layer: Int!
  timestamp: DateTime!
}

"One immutable layer of a node property — a graph property or a Postgres
 display-content version. `value` is serialized as a string (shaped by the
 property); null when the layer is a redaction tombstone."
type PropertyLayer {
  value: String
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
([edges.md §2](../primitive/edges.md#2-structural-edges)). Today
only `:TRANSFERS` populates it (the on-chain transaction
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
  attachments(first: Int, after: String, last: Int, before: String): ItemAttachmentConnection!
  "Moderation status for the attachment gallery as a whole."
  attachmentsStatus: FieldModerationStatus!
  moderationStatus: ModerationStatus!
}

"A content-addressed topic tag — its identity is its canonical
 name. Authorless and terminal: it has no outgoing edges; content
 reaches it through incoming :TAGGING edges."
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
 gesture. Time-gated and multi-use: many invitees may register through one
 link. Its id is the link capability, so it is issuer-visible only."
type InviteLink {
  id: UUID!
  "The issuing actor (User or Collective)."
  inviter: Actor!
  "Pre-committed dim1 for the inviter→invitee edge written on acceptance."
  inviterDim1: Dimension!
  "Pre-committed dim2 for that edge."
  inviterDim2: Dimension!
  createdAt: DateTime!
  expiresAt: DateTime!
  "When the link was revoked; null if still live."
  revokedAt: DateTime
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
 only. ACTIVE: claim + approval, both top layers positive. REVOKED:
 a negative top layer on either."
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
   (count, fraction of cast, quorum, or dual-quorum petition). Carried as
   a documented string; the exact serialization is the instance's choice."
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
singleton. None carry user-authored content, so none has moderation
fields. Money lives on the chain; these nodes hold only pointers and
public scalar results.

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
   composite:*."
  proposedValue: String!
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

"A proposal's terminal outcome — transitions exactly once at
 threshold-cross, then permanent."
enum ProposalStatus { OPEN PASSED PASSED_BUT_INVARIANT_REJECTED }

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
   only for bidirectional Shape-B scopes; a petition-style Network tally
   reads only the positive side."
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

"Campaign lifecycle state."
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
"The singleton instance-configuration node. Every property is public
 config and amendable via a Proposal that :TARGETS it. Quorum
 properties come in dual-quorum pairs (a fraction and an absolute
 count)."
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
   above. Pruned by `dustFloor` — the same ε the ranker prunes with,
   default Network.dustFloor — not hop-bounded; null if the id resolves to
   no rankable actor. The backend never ranks (feed-ranking.md §9) — it
   serves this slice, and separately hydrates the ordered result via `feed`."
  feedSlice(viewer: UUID!, dustFloor: Float): FeedSlice

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

  "Search across nodes; returns mixed node types. Provisional — what
   is indexed and how matches rank is not yet specified in the design
   docs."
  search(
    query: String!
    kinds: [NodeKind!]
    first: Int, after: String, last: Int, before: String
  ): SearchConnection!
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
 them, weight-bounded by the dust floor. Downloaded by the ranker; the
 backend computes no order over it."
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
```
