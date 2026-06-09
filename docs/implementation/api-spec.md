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
