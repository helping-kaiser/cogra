# API Specification

The API is a single GraphQL endpoint served by Axum +
async-graphql.

- **Endpoint**: `POST /graphql`
- **GraphQL IDE**: `GET /playground` (dev mode only)
- **Health check**: `GET /health`

The schema is specified in sections: the **type system** and
**queries** (the read surface), then the **mutation surface**
(the write gestures). The governing principles below bind both.
The API is CoGra's L2 service surface over the shared graph: it
serves reads from the record mirror and the display stores, and
it runs the write path — prepare, seal, approve, confirm — around
acts only the acting user's device can sign
([architecture.md](architecture.md),
[substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)).

---

## Why GraphQL

The data is deeply relational and every view wants a different
slice of it — a feed entry needs the content node, its author,
the viewer's stance records toward it, and inbound-attention
counts all at once; a profile wants none of that but a paginated
authored-content list instead. GraphQL lets a client request
exactly the fields it needs in one round trip, and lets the
server resolve each field lazily — a record-mirror traversal, a
fold, or a display-content lookup only runs when its field is
actually selected. That laziness is load-bearing here, because
the read path spans the mirror, the overlay caches, and the
display tables, and the traversals and folds are the expensive
part.

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
fit, the clearer one wins. The exploration surfaces are dev
builds' playground and the checked-in `schema.graphql`; release
builds serve no introspection ("Query budgets" below).

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
  domain has — `UUID`, `RecordId`, `DateTime`, and a bounded
  `[-1, +1]` dimension scalar — instead of loose strings and
  floats.
- **Connections** carry every list (see Pagination).

The litmus test: the schema is exact and composable because it is
a graph of types, not because a REST payload made its fields
optional.

### Everything on the graph is public; privacy is cryptographic

Per [graph-model.md §1](../primitive/graph-model.md#1-core-principles),
**every record, every node, and every content body is readable
without an account** — the shared graph is public by L1's own
construction, and CoGra's mirror adds no gate. An unauthenticated
request can compute any actor's view for any reader; accounts gate
*participation* (writing), never *viewing*.

Privacy of content is achieved by **encryption, not access
control**. An encrypted `ChatMessage` returns its ciphertext to
*every* requester exactly like any other field — the server gates
nothing — and only a holder of the chat key can decrypt it
client-side ([chats.md §7](../instances/chats.md#7-encryption-as-the-privacy-mechanism)).
Plaintext messages read like any other content, and chat topology
(the chat, its membership, who-talks-to-whom) is public
regardless. So there is no public/private *shape* split in the
schema: records and content are ordinary public fields, queried
the same way for everyone.

The server-gated set is small and entirely **off-graph state**
(per [data-model.md](data-model.md)): a viewer's personal
frontend state (bookmarks, seen-list, hidden-actors, chat read
pointers), preferences, auth/session state, staged writes, the
key-backup blob — and the **honor ledgers**, whose reads are
membership-gated in the service layer
([data-model.md "Honor ledgers"](data-model.md#honor-ledgers)).
All of it is gated by field-level authorization, not a separate
query namespace — see below.

Moderation adds no hidden set either: `sensitive` content is
returned with its status and the viewer's severity preference so
the **frontend** applies the filter
([moderation.md](../instances/moderation.md)); redacted
(`illegal`) content returns a visible redaction marker in place
of the body — the one case where the API returns something other
than the authored content, and never a silent disappearance.

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

### The graph is a chronicle; reads expose folds and records

The record set is append-only: nothing on the graph is ever
overwritten or deleted, and revising a stance or a value appends
a **parallel record** to the same-author bundle
([edges.md §1](../primitive/edges.md#1-the-edge-record-and-cogras-two-axes)).
What "current" means is always a **declared fold** over records —
newest-wins for node values
([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates)),
per-author netting for stances, the membership folds for chats
and Collectives. The typed fields below return **fold results**
(a chat's members, an item's owner, a proposal's tally); the raw
chronicle behind every fold is reachable through the generic
record surface (`records`), so any consumer can replay any fold
from public records.

Reads serve pending content. A record is its author's content from
the moment they sign it, so node reads and listings serve it to
**every** viewer — not only its author — with its pending state
visible and ahead of the newest landed entry
([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)).
Landing is a state content reaches, never the condition of its
being read.

Consequently there is no destructive verb on graph state: no
`delete`/`unlike`/`unfollow`. A stance is changed by a new
record; severance is netting a bundle to `(0,0)`, not a removal;
an edit is a new update record the fold reads. The only erasure
in the system is **payload removal** (full → reduced), reached
through the moderation flow and the self-service erasure
mutations — `removeContent` and the account-deletion trio below
([erasure.md](../instances/erasure.md)) — never through a
generic delete on ordinary writes
([substrate.md §7](../primitive/substrate.md#7-payload-carriage)).

### Viewer context rides the request, not the arguments

Reads need no authentication. When a request *does* carry an auth
token, the resolved viewer lives in the GraphQL execution context
— never passed as a field argument. Its only two jobs are the
field-level authorization above and `me` resolution; it never
scopes an ordinary read. The same query is valid authenticated or
anonymous — authentication only changes what the gated fields
yield. The auth model (staged-applicant admission, JWT access +
rotating refresh tokens, sessions) is specified in
[auth.md](auth.md); this spec consumes it.

### Pagination is Relay cursor connections

Every list, feed, and record set paginates as a Relay-style
connection (`edges { cursor node }`, `pageInfo`, optional
`totalCount`). The append-only graph makes offset pagination
quietly incorrect — items inserted at the head during a scroll
would shift offsets and cause skips or repeats — so cursors,
which point at a fixed position, are the correct primitive. A
consumer fetches the first page with `first:` alone and follows
`pageInfo.endCursor` into `after:` for the next.

> **Naming note.** Relay names its pagination wrapper `edges` /
> `node`. The graph's own central concept is the L1 **record**,
> surfaced as the `Record` type below — so the two vocabularies
> stay apart by construction: `edges` inside a `*Connection` is
> always the pagination wrapper, and the substrate concept is
> always `Record`. The Relay spelling is kept throughout.

**Page sizes are budgeted.** `first`/`last` accept at most 100
(over-asking refuses with a validation error rather than silently
clamping); a connection read with neither argument serves 20. The
caps are part of the query-budget posture below.

**Mirror-ordered reads use keyset cursors.** A cursor over a
record-backed connection encodes the landing-order key
`(epoch, act time, position)`; pages walk forward with
`first`/`after` or backward with `last`/`before` (one direction
per request), and results always come back in the connection's
declared order. The chronicle, the post listing, and thread
reads all serve newest-first — a node's landing position is its
genesis, so editing a comment never moves it up its thread.

**Pending entries come first, in their own cursor namespace.** A
pending write has no causal key yet, so it sorts under a sentinel
epoch above every real one and orders among pending entries by
`(authoring instant, node id)` — the instant alone is not unique,
because nothing serializes two authors' signatures apart. A
pending entry's cursor changes when it lands, because its position
in the order changes; a content cursor therefore carries the
entry's own id alongside the key, so a walk resuming from it can
find where the entry went instead of serving it twice. Cursors
stay opaque: what rides inside is the server's business, and a
client reads no structure into them. Every content listing takes
`includePending` (default true): false serves only what has landed
on L1 — including, on a landed node carrying an unlanded edit, the
version that landed — for a reader who wants the settled graph. The
chronicle takes no such argument: the record set has no pending
namespace, so a record is listed exactly when it is ordered fact.

**A page is a snapshot, not a live view.** A listing read computes
one view of the graph and freezes it; refetching is the client's
own explicit act. A page's own changes — a pending entry landing
into its place in the order, an expired one vanishing — appear
only in a refetched page, and the refetched page carries the new
state, never both. Clients neither merge newly pending items into
a page they already hold nor reconcile a held page against a newer
one. What the snapshot fixes is membership and order: a node read
afresh carries its own landing state to every held page showing
it, where the entry stays put.

### Query budgets

Every request is priced in validation, before any resolver runs
(roadmap.md slice 1.1): query **depth** is capped at 15 levels,
and total **complexity** at 1000 fields, with connection fields
costing their requested (or default) page size times the per-item
cost — so a nested full-page-connections query prices
multiplicatively and refuses. A tripped budget is a message-only
GraphQL validation error ("Query is nested too deep." / "Query is
too complex."), with no `extensions.code` — clients treat it as a
generic transport failure, and the budgets are sized so no real
client query ever meets it. **Introspection is disabled in release
builds** — not secrecy (the repo is public; the contract travels
as the checked-in `schema.graphql`, which both clients generate
from) but cost-benefit: the budgets apply to introspection
queries too, and admitting the standard introspection query
would take a ~50× looser complexity ceiling, which under
multiplicative connection pricing admits genuinely expensive
queries. Live introspection buys nothing the checked-in SDL
doesn't already give. Dev builds keep introspection on, with
that loose ceiling, for the playground.

**Feed ranking and cursors.** The backend does not rank
([feed-ranking.md §11](../primitive/feed-ranking.md#11-where-ranking-runs)): it serves the
viewer's weight-bounded subgraph slice, a ranker (device or delegated
miner) orders it off the hot path, and the resulting id list is hydrated
back into a cursor-paginated feed. The frozen snapshot lives with the
ranker; the cursor indexes into the order it produced, never a per-page
re-rank. The feed surface below splits the slice from the hydration.

### The API prepares and relays; only the device signs

Every graph write is an L1 act signed **twice** by the acting
actor's own key, on their device — the pre-commitment over the
proposal, then the approval witness over the exact host-sealed
verified act; the backend cannot author, alter, or sign one
([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)).
The mutation surface therefore has three legs:

- **`prepare*` mutations** stage a gesture: the server validates
  it against L2 policy, pre-checks L1's write rule, assembles the
  canonical proposal(s) — act body, payload envelope, dependency
  list — and returns them with their pre-digests for the device
  to verify and pre-sign. Nothing has happened on the graph yet.
- **`submitProposals`** relays the pre-signed proposals to L1's
  seal round trip and returns each host-sealed **verified act**
  for the device to verify — seal, exact body, both commitment
  openings — and sign the approval witness over.
- **`approveActs`** relays the approval witnesses — only an
  approved act is orderable — and drives retries across epoch
  boundaries. Confirmation is asynchronous: the act is final when
  it appears in the mirror, observed through `stagedWrite` —
  there is no synchronous "write succeeded" response, because
  whether an act lands is L1's fact alone.

Mutations that touch only L2 state (auth, private viewer state,
media upload) are ordinary synchronous operations — one Postgres
transaction, no signing.

### The write surface is a principled hybrid

Setting a plain stance toward any node is **one** generic prepare
mutation parameterized by target and the two authored parameters —
mirroring the uniform record model rather than minting a verb per
interaction. Gestures that are genuinely their own thing
(authoring a post, founding a chat, opening a campaign) are
standalone named prepares, because they carry flow-specific
payloads, mint nodes, or stage multi-record batches. Operations
are combined only where they are the same gesture — never merged
for the sake of a smaller mutation count, and never split for the
sake of a larger one.

### Errors are tiered — transport faults vs. expected outcomes

A failure surfaces in one of two places, chosen by who must act on it,
never by convenience:

- **Transport faults** — unauthenticated, forbidden, not-found,
  malformed input, rate-limited, internal — ride the GraphQL `errors`
  array with a stable `extensions.code`. The `message` is a
  developer-facing fallback; internal detail stays in the server log
  and never reaches the client, which sees only the `INTERNAL` code.
- **Expected business failures** — a bad value or a rule rejection the
  end user should see and act on — are *data*, not transport errors:
  every mutation payload carries `userErrors: [UserError!]!`, each entry
  pairing a `code` to switch on, a developer-facing `message`, and the
  input `field` at fault. The list is empty exactly when the mutation
  succeeded; a non-empty list means the named result field is null. A
  list, not a single value, because one input can fail several ways at
  once (too long *and* disallowed characters), and the client should see
  them together.

A failed **write-rule pre-check** is the canonical expected
failure: an insolvent actor (W1) or one below the wall (W2a) is a
normal, visible account state, not an auth fault — prepare
returns it as a `userError` with the restoration flow left to the
product surface
([architecture.md "Write eligibility"](architecture.md#write-eligibility-and-account-states)).

A single `ErrorCode` enum is the one vocabulary across both tiers — the
`extensions.code` on a transport fault and the `code` on a `UserError`
draw from it — so a code means the same thing wherever it appears. This
is the idiomatic-typed-schema principle applied to failure: an expected
outcome belongs in the typed contract introspection exposes, not in a
stringly-typed side channel.

---

## Type system — foundations

The cross-cutting building blocks: scalars, the shared enums and
interfaces, the `Record` type, per-field moderation, and the
pagination wrappers. The concrete node object types build on
these in the sections that follow.

### Scalars

```graphql
"A UUID — CoGra's L2 key, minted in the API layer and shared
 across the Postgres tables and payload fields. Random v4 for most
 kinds; content-addressed v5 for Hashtags (the naming service —
 hashtag.md §1). Node ids are UUIDs; L1 records carry their own
 RecordId."
scalar UUID

"An L1 record identifier, exactly as Layer 1 minted it — stored
 and served verbatim; the mirror never re-mints identity
 (data-model.md \"The record mirror\"). Opaque to clients."
scalar RecordId

"An RFC 3339 / ISO 8601 timestamp. Display-side time; the graph's
 own clock is the epoch index (plain Int fields)."
scalar DateTime

"A signed authored parameter: a float constrained to the closed
 range [-1.0, +1.0]. The range invariant lives in the type rather
 than in a plain Float. (Families outside the stance vocabulary
 restrict the range further per the L1 census — edges.md §1;
 prepare validates per family.)"
scalar Dimension
```

### Shared enums

```graphql
"A node's moderation state — the cached max severity across its
 fields. (Per-field status uses FieldModerationStatus.)"
enum ModerationStatus { NORMAL SENSITIVE ILLEGAL }

"The L1 record families CoGra authors — the fixed inventory
 (edges.md §2–§3; the census in layer1-interface.md §9 is
 normative for each family's domain, tier, and parameter roles).
 Binary families relate author → target; hyper-edge families are
 one act with an actor leg into a middle node and a terminal leg
 out of it."
enum RecordFamily {
  # Binary
  REGISTRATION PUBLISH OPINION AFFINITY PARTICIPANT OWNER
  JOIN_REQUEST ACCEPT RATIFY WITHDRAW RESCIND LEAVE
  # Hyper-edge
  REVIEW SEND TAG BID INVITATION DE_INVITE REFERENCE
}

"The kind of a node — used to filter record endpoints by the type
 of node on the far end (e.g. only a User's records that point at
 Posts). PROPOSAL and CAMPAIGN are CoGra's typed views over
 Content anchor nodes; OFFER is the Bid-minted settlement node."
enum NodeKind {
  USER COLLECTIVE
  POST COMMENT CHAT CHAT_MESSAGE ITEM HASHTAG
  PROPOSAL CAMPAIGN OFFER
}

"The sign of an authored parameter, for filtering records by
 valence or by the inert (0) state. POSITIVE: > 0. NEGATIVE: < 0.
 ZERO: exactly 0."
enum Sign { POSITIVE NEGATIVE ZERO }

"A user account's service state (auth.md \"Account states\"): it
 gates acting through CoGra, never reading, and is distinct from
 the mutual-pair membership of invitations.md §2. GUEST is
 reserved — no flow creates one yet."
enum AccountState { GUEST APPLICANT MEMBER }

"The one error vocabulary, shared across both error tiers (governing
 principles): the `extensions.code` on a transport fault and the `code` on a
 `UserError` both draw from it. Grows as gestures add expected failures."
enum ErrorCode {
  # Transport faults — carried in errors[].extensions.code
  UNAUTHENTICATED              # no / invalid access token where one is required
  FORBIDDEN                    # authenticated but not eligible (actAs, field-auth)
  NOT_FOUND                    # an id resolved to nothing
  BAD_INPUT                    # malformed args, or a constraint not modeled as data
  RATE_LIMITED                 # an auth endpoint's per-IP / per-account backoff
  INTERNAL                     # collapsed server fault; detail is logged, not surfaced

  # Expected business failures — carried in UserError.code
  INVALID_CREDENTIALS          # email / password pair did not match
  INVITE_UNUSABLE              # invite link invalid, expired, revoked, or consumed
  HANDLE_TAKEN                 # the requested handle is already in use
  WEAK_PASSWORD                # under the length floor or in the breach corpus
  EMAIL_IN_USE                 # the email already belongs to an account
  ACTOR_KEY_IN_USE             # the actor key is bound to a different account
  VERIFICATION_TOKEN_INVALID   # email verification token invalid or expired
  RESET_TOKEN_INVALID          # password-reset token invalid, expired, or used
  REFRESH_TOKEN_INVALID        # refresh token invalid, expired, or reuse-detected
  WRITE_RULE_FAILED            # the prepare pre-check: W1 solvency or W2 stamps
  STAGED_WRITE_EXPIRED         # the staged write was garbage-collected unlanded
  SIGNATURE_INVALID            # a submitted signature does not verify the record
  CHALLENGE_EXPIRED            # the key-backup upload challenge is unknown, expired, or spent
}
```

### Identity and actor interfaces

```graphql
"Anything with a graph identity — implemented by every node type.
 It exists so heterogeneous endpoints (a record's ends, a reference
 target, a comment's parent) are typed without a sprawling union.
 It is a type-modeling device, not a navigation mandate: typed
 entry points are free to exist and nothing is forced through a
 single node(id) accessor."
interface Node {
  id: UUID!
  "When this node was created — when its minting record was
   authored, which on a pending node precedes landing."
  createdAt: DateTime!
  "When this node last changed — its most recent fold-winning
   update record or display-content version; equals createdAt if
   never changed."
  updatedAt: DateTime!
  "Where this node stands relative to L1 finality — landing is a
   substrate fact about every minted node, so it lives here rather
   than on each content type."
  landing: Landing!
  "Records authored from this node — for an actor, their outgoing
   chronicle; the generic way to read any relationship before named
   convenience views exist. Filter by family, by the kind of node
   on the far end, by parameter sign (e.g. only vouch-positive
   Opinions, or (0,0) update records), payload-marked state, and/or
   a landing-epoch window."
  outgoingRecords(
    family: RecordFamily
    toKind: NodeKind
    pDirectedSign: Sign
    pInterestSign: Sign
    payloadMarked: Boolean
    sinceEpoch: Int
    untilEpoch: Int
    first: Int, after: String, last: Int, before: String
  ): RecordConnection!
  "Records pointing at this node. Exposed as public topology / an
   inbound-attention surface only — per the feed-ranking model,
   inbound records never shape this node's own feed. Same filters
   as outgoingRecords; fromKind selects the source kind."
  incomingRecords(
    family: RecordFamily
    fromKind: NodeKind
    pDirectedSign: Sign
    pInterestSign: Sign
    payloadMarked: Boolean
    sinceEpoch: Int
    untilEpoch: Int
    first: Int, after: String, last: Int, before: String
  ): RecordConnection!
}

"Where a node stands relative to L1 finality. PENDING: authored and
 signed, not yet ordered — real content whose place in the order is
 not yet fixed (substrate.md §6). LANDED: the minting act is ordered
 fact. There is no expired state: an expired act's content leaves
 every reader's view."
enum LandingState { PENDING LANDED }

"A node's landing position. `epoch` is the graph's own clock — the
 same integer as the genesis Record's landingEpoch, surfaced on the
 node so a client renders the marker without traversing to a record.
 It is null exactly while `state` is PENDING: a pending write has no
 causal key yet. An unlanded edit leaves its node PENDING, because
 the text on screen is the pending version."
type Landing {
  state: LandingState!
  epoch: Int
}

"An entity that takes actions and authors content: a User or a
 Collective. On L1 both are the same thing — an Actor + Profile
 grounded pair — so the graph refers to actors through this
 interface wherever the User-vs-Collective distinction is not
 load-bearing. Handles share one namespace across kinds: a mention
 resolves to exactly one actor (data-model.md \"Actors\")."
interface Actor implements Node {
  # + Node fields (id, createdAt, updatedAt, outgoingRecords, incomingRecords)
  "The unique mention handle — one namespace across Users,
   Collectives, and system actors."
  handle: ModeratedText!
  displayName: ModeratedText!
  avatar: ModeratedMedia!
  websiteUrl: ModeratedText!
  "Network-scope role — the fold over the Publisher's role Tags
   plus the class labels; Collectives carry COLLECTIVE
   automatically and permanently (network.md)."
  networkRole: NetworkRole!
  "The actor's CGT payout address — a witnessed guild-key field of
   their Registration profile payload, public like the rest of the
   profile; a Liquid address, a pointer and never money
   (ledger.md). Null when the actor has never set one. Updated by
   parallel Registration (prepareProfileUpdate)."
  payoutAddress: String
  "Node-level cache: max moderation severity across this actor's fields."
  moderationStatus: ModerationStatus!
  "Outstanding invite links this actor has issued — service-side
   staging state, not graph structure (the public who-invited-whom
   is the mutual Opinion pair — invitations.md §2). Field-level:
   each link's id is the link capability, so this resolves only for
   the issuing actor (or, for a Collective, its authorized
   members); null otherwise."
  inviteLinks(first: Int, after: String, last: Int, before: String): InviteLinkConnection
}

"Network-scope role. MEMBER and MODERATOR are person-accountability
 states materialized as the Publisher's role Tags; COLLECTIVE is a
 class label conferring nothing — no ballots, no activity count, no
 moderator eligibility."
enum NetworkRole { MEMBER MODERATOR COLLECTIVE }
```

### The record

```graphql
"One accepted L1 record, served from the record mirror — the
 uniform substrate fact behind every relationship and stance. The
 mirror may lag L1 and never diverges; where any cached view could
 disagree with records, records govern (architecture.md). A record
 is immutable: revision is a parallel record in the same-author
 bundle, and what \"current\" means is the consumer's declared
 fold."
type Record {
  "L1's own identifier for this record, verbatim."
  id: RecordId!
  family: RecordFamily!
  "The authoring actor — intrinsic to the signed record, never a
   separate edge (authorship.md). Null when no account fronts the
   author's address (system actors), until the actor surface
   grows."
  author: Actor
  "The record's target: the far end of a binary family, or the
   middle node the actor's leg enters on a hyper-edge (a Review's
   parent, a Send's Chat, a Tag's content). Typed when CoGra
   carries a display row for it; targetId always serves the raw
   identifier."
  target: Node
  "The raw L1 identifier of target — always present; the chronicle
   never depends on typed coverage."
  targetId: String!
  "Hyper-edge only: the terminal leg's node — minted by the act
   (Review's Comment, Send's Message, Bid's Offer) or pre-existing
   (Tag's Type, Invitation's Profile, Reference's cited target).
   Null on binary families."
  terminal: Node
  "The raw L1 identifier of terminal; null on binary families."
  terminalId: String
  "Authoritative act time — the causal key's first component."
  actTime: Int!
  "Position within the epoch's authoritative order."
  position: Int!
  "The authored directional / valence parameter p_d (frontend
   labels vary by gesture; the math role does not — edges.md §1)."
  pDirected: Dimension!
  "The authored intensity / connection parameter p_i."
  pInterest: Dimension!
  "The epoch in which the record landed — the graph's own clock;
   epoch ages read against the public epoch certificates."
  landingEpoch: Int!
  "True when the record is payload-marked — folds then read it
   individually, never through the author's netted bundle (ballots,
   edits, membership records — substrate.md §9)."
  payloadMarked: Boolean!
  "The payload state: FULL while the content is carried, REDUCED
   after payload removal — the one-way erasure that leaves the
   structural record as the visible mark (substrate.md §7)."
  payloadState: PayloadState!
  "The content witness reference — L1's evidence that the carried
   payload matches what was committed; verification material, never
   content."
  payloadWitness: String!
}

"Payload carriage state — moves one way, full to reduced."
enum PayloadState { FULL REDUCED }

"A page of posts, newest-first: pending entries, then landed
 entries in landing order."
type PostConnection {
  edges: [PostEdge!]!
  pageInfo: PageInfo!
}
type PostEdge {
  cursor: String!
  node: Post!
}

"A page of comments, newest-first: pending entries, then landed
 entries in landing order."
type CommentConnection {
  edges: [CommentEdge!]!
  pageInfo: PageInfo!
}
type CommentEdge {
  cursor: String!
  node: Comment!
}

"A page of records."
type RecordConnection {
  edges: [RecordEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type RecordEdge {
  cursor: String!
  node: Record!
}
```

The `Record` type serves the raw chronicle: same-author revisions
appear as parallel records, and a bundle's net state is the
consumer's fold, not a stored field. Decoded display content never
rides the record — it lives on the typed nodes (a `Post`'s
`content`, a `Chat`'s `name`), resolved from the display store
that carries the payload bytes. `Record` is also the type the
ranking surface consumes — the miner's `RankHop.records` and
bundle audits speak this vocabulary
([miner-api.md](miner-api.md)).

### Per-field moderation

Each user-authored field carries its moderation status co-located
with its value, so a redacted field is never confused with an empty
one. Scalar fields use a wrapper type; `value` is null when the field is
redacted (or unset, where optional), and `status` says which. A
deliberately empty value — a full-empty payload,
[layers.md §5](../primitive/layers.md#5-deletion-policy) — is an
empty string under `NORMAL` status: empty is a value, null never is.

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

"Per-field moderation state. SENSITIVE is the read-side flag the
 frontend filters on. REDACTED means the value is gone and the mark
 remains — and redaction is record-granular: an illegal verdict
 removes the whole record's payload (full → reduced), so every
 field carried by that payload goes REDACTED together
 (moderation.md). Per-field granularity exists for SENSITIVE only."
enum FieldModerationStatus { NORMAL SENSITIVE REDACTED }
```

A media *gallery* (a list) can't wrap generically, so those fields
keep their list and carry a sibling
`attachmentsStatus: FieldModerationStatus!`. Every content-bearing
node also keeps the node-level `moderationStatus: ModerationStatus!`
cache — the cheap "is anything wrong here" check. The
substrate-visible verdict behind these flags is The Moderator's
Tag record toward a named moderation Type; the flags are the
Postgres projection of it
([moderation.md](../instances/moderation.md)).

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
`node: <Element>!`. Connections are materialized per element type
in the sections that use them.

### Error types

The business-failure tier of the error model (governing principles).
`UserError` is the per-payload list every mutation carries; transport
faults need no type, riding the `errors` array with an `extensions.code`.

```graphql
"A recoverable, expected failure of a mutation — a bad value or a
 business-rule rejection the end user should see and act on. A payload's
 `userErrors` is empty exactly when the mutation succeeded; a non-empty
 list means the named result field is null."
type UserError {
  "Developer-facing fallback text; the client localizes off `code`."
  message: String!
  "The stable code the client switches on."
  code: ErrorCode!
  "Path to the offending input field — e.g. [\"declaredGoal\"], or
   [\"attachments\", \"0\", \"mediaId\"] into a nested input; null for a
   whole-operation failure."
  field: [String!]
}
```

---

## Type system — actors and content

The actor nodes and the public content nodes. To keep the listings
readable, interface fields are **implied and omitted** from each
body: the `Node` fields (`id`, `createdAt`, `updatedAt`,
`outgoingRecords`, `incomingRecords`) on every type, and the
`Actor` fields (`handle`, `displayName`, `avatar`, `websiteUrl`,
`networkRole`, `payoutAddress`, `moderationStatus`, `inviteLinks`)
on the actor types. Only fields beyond the implemented interfaces
are shown.

Two consequences of earlier principles show up throughout:

- **Moderated fields co-locate value and status** — each is a
  `ModeratedText` / `ModeratedMedia` whose `value` is null when
  redacted (or unset, where the field is optional), with `status`
  telling the two apart. A gallery keeps its list plus a sibling
  `attachmentsStatus`.
- **Relationships stay generic** except the fundamental links
  pulled forward as named views: `author` on every authored node,
  `target` on a Comment, `chat` on a ChatMessage, and the
  fold-derived views (`members`, `currentOwner`) whose value is a
  declared fold rather than a record list. Everything else is
  reached through `outgoingRecords` / `incomingRecords` until a
  named view earns its place.

### Supporting display type

```graphql
"A media asset (image / video / audio). Not a graph node — parents
 point at it and it never points back — so it carries no records.
 Bytes live in blob storage, verifiable against the digests
 committed in the referencing payload envelope (substrate.md §7)."
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
"A person on the platform — an L1 Actor + Profile grounded pair
 whose signing key lives on their own device; the server-side
 account (user_credentials) authenticates the service, never the
 graph (auth.md)."
type User implements Node & Actor {
  "Free-text profile bio."
  bio: ModeratedText!
  "Profile cover image. User-only — Collectives carry no cover."
  cover: ModeratedMedia!

  # Private viewer state — each field resolves only when the authenticated
  # viewer is this User; null otherwise (see "Private viewer state" below).
  "Saved-for-later nodes, most recent first."
  bookmarks(first: Int, after: String, last: Int, before: String): BookmarkConnection
  "Nodes this user has seen — the view history behind feed de-duplication."
  viewHistory(first: Int, after: String, last: Int, before: String): ViewHistoryConnection
  "Actors this user has hidden from their own feed — a read-side
   comfort that does not lift the viewer's own records' effect on
   anyone else's feed (feed-ranking.md §8)."
  hiddenActors(first: Int, after: String, last: Int, before: String): HiddenActorConnection
  "Active authentication sessions, one per refresh token."
  sessions: [Session!]
  "Cross-device preferences."
  preferences: UserPreferences
  "The viewer's pending staged writes — acts mid-handshake,
   awaiting a signature, the host seal, or confirmation, across
   devices."
  stagedWrites(first: Int, after: String, last: Int, before: String): StagedWriteConnection
  "The client-encrypted key-backup blob, if one was uploaded —
   ciphertext under the recovery code; the server cannot decrypt it
   (auth.md \"Key recovery\")."
  keyBackup: String
  "The account's attached actor public key (base64), null before the
   key ceremony. The client's repair-attach verifies the device-held
   key against this before offering it, so a device carrying another
   account's key never blind-fires the attach (roadmap.md slice 1.1)."
  actorPubkey: String
  "The account's attached L0 address, null before the key ceremony."
  l0Address: String
  "The account's service state — gates acting through CoGra
   (auth.md \"Account states\")."
  accountState: AccountState
  "Whether the account's email is verified — one of the two
   approvability proofs while an application is pending."
  emailVerified: Boolean
  "The account's latest application — the applicant's own view of
   its progress; null when the account has none."
  application: Application
  "The actor whose invite this account came through — landing
   provenance for the reciprocation gesture (the graph's own record
   of the vouch is the inviter's Opinion). Null for accounts
   without an application trace (genesis actors)."
  invitedBy: Actor
  "Whether the viewer's reciprocal Opinion toward invitedBy exists —
   confirmed in the record mirror (latched on the landed application
   row) or in flight as one of the viewer's staged writes. Drives
   the first-login reciprocation prompt (auth.md \"Reciprocation is
   the joiner's own act\"). Vacuously true when invitedBy is null —
   and for any viewer but the account's own: the field exists only
   to drive the viewer's own prompt."
  hasReciprocated: Boolean!
}

"A group acting through one graph identity (household, band, co-op,
 company, …) — one L1 Actor + Profile like any other; membership is
 a public payload fold, custody is creator-held with per-member
 co-signing (collectives.md)."
type Collective implements Node & Actor {
  "Profile description."
  description: ModeratedText!
  "The social contract — per-action governance rules, carried in
   the Collective's Registration profile payload and amended
   through its own governed flow. Typed in the governance section."
  governance: Governance!
  "Current members — the public membership fold: member iff the
   member-side payload-marked Opinion and the collective-side
   decision-backed recognition both stand, newest records agreeing
   (collectives.md §5). A fold view over records, not stored state."
  members(first: Int, after: String, last: Int, before: String): CollectiveMemberConnection!
}
```

### Content nodes

```graphql
"Text and/or media authored by an actor — the primary public
 surface and the canonical feed-ranking target. Minted by a Publish
 record; edits are ordinary-role Publish + payload records at
 attachment 0, read by the chain-ordered fold — the newest
 record's payload is the whole content state
 (substrate.md §9, post.md §4)."
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
  "The qualifiers the minting Publish record carried."
  license: License!
  "This post's direct comments — genesis Reviews whose actor leg
   enters here — newest-first (a comment's landing position is its
   genesis, so edits never reorder the thread). The named view over
   records(target:, family: REVIEW)."
  comments(first: Int, after: String, last: Int, before: String, includePending: Boolean! = true): CommentConnection!
}

"A threaded response — minted by a Review record targeting whatever
 it responds to; reply chains are causal chains of Reviews and
 depth attenuates natively (comment.md)."
type Comment implements Node {
  "The body."
  content: ModeratedText!
  author: Actor!
  "The node this comment is on — the Review's parent."
  target: CommentTarget!
  attachments(first: Int, after: String, last: Int, before: String): CommentAttachmentConnection!
  "Moderation status for the attachment gallery as a whole."
  attachmentsStatus: FieldModerationStatus!
  moderationStatus: ModerationStatus!
  "The qualifiers the minting Review record carried."
  license: License!
  "This comment's direct replies, newest-first."
  replies(first: Int, after: String, last: Int, before: String, includePending: Boolean! = true): CommentConnection!
}

"What a Review can respond to — root content, another Comment, a
 conversation, a good, or a person's profile (edges.md §3)."
union CommentTarget = Post | Comment | Chat | ChatMessage | Item | User | Collective
```

Coverage is staged by slice: the exported SDL carries each union
variant, `Node` implementor, and interface field from the slice
that builds its type — the content slice ships Post and Comment
with the id/createdAt/updatedAt core of `Node`, and serves
`Comment.target`, `Record.author`, and record node resolutions as
nullable until the remaining types exist. `moderationStatus` and
the per-field statuses serve constant NORMAL until the moderation
slice stores verdicts.

```graphql

"A conversation container — a first-class public node, minted by
 its founder's own Participant record (the founding payload carries
 name, description, image digests, and the governance map).
 Membership and who-talks-to-whom are public; only encrypted
 message bodies are opaque (chats.md)."
type Chat implements Node {
  "Optional display name — any chat may set one, 1:1 or group."
  name: ModeratedText!
  description: ModeratedText!
  image: ModeratedMedia!
  "The founding actor."
  author: Actor!
  "Per-decision governance — the chat's governance map: eligibility,
   role weights, thresholds, amendment gates. Typed in the
   governance section."
  governance: Governance!
  "Current members — the membership fold over the bundled lineage:
   member iff not banned, and the actor's own ≺-latest
   {Participant, Leave} — keyed on leg role, a move's A-leg is a
   departure — is a Participant strictly ≺-following any recognized
   De-invite, recognized per the chat's admission policy
   (chats.md §4). A fold view, not stored state."
  members(first: Int, after: String, last: Int, before: String): ChatMemberConnection!
  "Current E2EE key epoch — derived from the public membership
   transitions, counted over the bundled lineage (rotation is
   automatic on every membership transition; a linear succession is
   membership-preserving and rotates nothing; governance-routed
   mid-epoch rotation adds one); no counter is stored anywhere
   (chats.md §7)."
  epoch: Int!
  "The requesting user's last-read timestamp in this chat; null when
   anonymous or never read. Field-level, viewer-scoped."
  lastReadAt: DateTime
  "Count of messages newer than the viewer's lastReadAt; null when anonymous."
  unreadCount: Int
  moderationStatus: ModerationStatus!
}

"A single message in a Chat — minted by a Send record; itself a
 first-class node: likeable, commentable, referenceable."
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

"A physical or digital good — minted by its genesis Owner record.
 Ownership is L1's settlement machinery: Bid → Accept → Ratify,
 title moving at the epoch certificate; CoGra never authors title
 (items.md)."
type Item implements Node {
  name: ModeratedText!
  description: ModeratedText!
  "The listing actor — the genesis Owner's author."
  author: Actor!
  "The current certified owner — owner^(k), consumed read-only from
   L1's published title certificate; never a CoGra-authored fact."
  currentOwner: Actor!
  attachments(first: Int, after: String, last: Int, before: String): ItemAttachmentConnection!
  "Moderation status for the attachment gallery as a whole."
  attachmentsStatus: FieldModerationStatus!
  moderationStatus: ModerationStatus!
}

"A settlement node minted by a Bid — the offer thread's middle
 node, targeted by Withdraw / Rescind control records. Surfaced for
 the marketplace flows; the price is a term on the Bid's payload
 (items.md)."
type Offer implements Node {
  "The Bid that minted this offer."
  bid: Record!
  item: Item!
}

"A topic — on the substrate an L1 Type node: named identity,
 compared by byte equality, anchored vacuously, owned by nobody
 (hashtag.md). CoGra's naming service canonicalizes (lowercase, no
 '#') and keys its registry by UUIDv5 of the canonical name.
 Authorless and, by CoGra's declared traversal policy, a
 forward-traversal sink: rankable, never transit. Content reaches
 it through Tag records; follows are Affinity records; a
 ChatMessage cites it by Reference."
type Hashtag implements Node {
  "Canonical tag, lowercase and without '#'."
  name: ModeratedText!
  moderationStatus: ModerationStatus!
}
```

### Membership views

The membership folds, surfaced as typed views. These are **fold
results, not nodes**: each row is derived from public records plus
the declared fold rule, cached operationally, and rebuildable —
where a cached row and the records could disagree, the records
govern.

```graphql
"One chat member — a row of the chat membership fold."
type ChatMember {
  member: Actor!
  "Role within the chat — the chat's governance map names the
   vocabulary (admin / chat_mod / member in the reference
   contract); role state rides the governed per-chat flows."
  role: String!
  "The epoch of the Participant record the fold currently reads."
  sinceEpoch: Int!
}
type ChatMemberConnection {
  edges: [ChatMemberEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type ChatMemberEdge {
  cursor: String!
  node: ChatMember!
}

"One collective member — a row of the public membership fold
 (collectives.md §5). Roles are sets; where a gate weighs by role,
 the highest applicable weight counts."
type CollectiveMember {
  "The member — a User, or a Collective (membership recurses)."
  member: Actor!
  roles: [String!]!
  "Ownership stake, when the collective's contract carries one."
  ownershipPct: Float
  "Per-member voting-weight override; null means role-derived."
  votingWeight: Float
  "The epoch of the newest fold-winning record pair."
  sinceEpoch: Int!
}
type CollectiveMemberConnection {
  edges: [CollectiveMemberEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type CollectiveMemberEdge {
  cursor: String!
  node: CollectiveMember!
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

"An outstanding invite link issued by an actor — service-side
 staging UX (invitations.md §4, auth.md). Nothing binds at issue:
 the stance values are PRE-FILLED suggestions the inviter can
 adjust at approval, and the approval itself is the priced act.
 Time-gated and, at the issuer's choice, single-use (one applicant
 slot) or multi-use. Its id is the link capability, so it is
 issuer-visible only."
type InviteLink {
  id: UUID!
  "The issuing actor (User or Collective)."
  inviter: Actor!
  "Pre-filled p_d for the inviter's approval-time Opinion — a
   suggestion, never a commitment."
  prefillPDirected: Dimension!
  "Pre-filled p_i for that Opinion."
  prefillPInterest: Dimension!
  "Whether the link admits one applicant slot (single-use) or many
   applicants until expiry (multi-use)."
  singleUse: Boolean!
  createdAt: DateTime!
  expiresAt: DateTime!
  "When the link was revoked; null if still live."
  revokedAt: DateTime
  "Applications currently staged through this link, with their
   status — the inviter's approval queue."
  applications(first: Int, after: String, last: Int, before: String): ApplicationConnection
}

"An application attempt — the invite-link provenance and
 approval/landing bookkeeping of an account in the applicant
 state (auth.md \"Application\"). Visible to the issuing inviter
 (their approval queue) and to the applying account itself
 (User.application)."
type Application {
  id: UUID!
  "The applying account's handle."
  handle: String!
  "Whether the account has proved its email channel — one of the
   two approvability proofs."
  emailVerified: Boolean!
  "Whether the account has attached its device-minted key and L0
   address — the other approvability proof."
  keyAttached: Boolean!
  "When the inviter's priced approval happened; null while pending."
  approvedAt: DateTime
  "When the Registration confirmed and the account became a
   member; null before."
  landedAt: DateTime
  createdAt: DateTime!
  expiresAt: DateTime!
}
type ApplicationConnection {
  edges: [ApplicationEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type ApplicationEdge {
  cursor: String!
  node: Application!
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

## Type system — governance and economics

CoGra's typed views over the L1-anchored governance and campaign
patterns. A `Proposal` or `Campaign` *is* a Content anchor node
with a witnessed terms payload and `(0,0)` structure records; the
types below are the decoded view of that pattern plus the overlay
caches. Everywhere a cached figure appears (a tally, a running
campaign value), the binding truth is the epoch-quantized fold
over the public records — the cache exists for display and
disputes resolve against the records
([data-model.md](data-model.md)).

### Proposal

The L1-anchored proposal pattern
([proposal.md](../instances/proposal.md),
[governance.md](../primitive/governance.md)): the proposer authors
a **Content anchor** (payload = the proposal terms) plus a
**`(0,0)` Reference** from the anchor to the proposal's subject;
**votes are payload-marked ballot Opinions** toward the anchor,
public and permanent, read individually and never through the
netted bundle; **finalization** is the scope's executing
authority's `(0,0)` Opinion + outcome payload. The same pattern
runs at every scope — Network, chat, collective.

```graphql
"A governance proposal — the typed view over its Content anchor.
 Terms are payload-borne and immutable; a revision is a new
 proposal (substrate.md §9)."
type Proposal implements Node {
  "The proposing actor — the anchor's author. Authoring is never a
   vote: the client flow casts the proposer's explicit +1 ballot as
   its own priced act immediately after creation."
  author: Actor!
  "The proposal's subject — named by the anchor's (0,0) Reference,
   replayable public structure."
  target: Node!
  "Which governance instance this proposal runs under — the
   action-key vocabulary of the scope's contract
   (collectives.md §6, chats.md §5, governance.md for Network
   scope). E.g. \"decision:disavow_member\", \"decision:set:name\"."
  actionKey: String!
  "The proposed value, serialized; shape discriminated by
   valueKind. The one moderatable field — it can embed
   user-authored text, so it is reportable like any content; null
   when the anchor payload was redacted."
  proposedValue: ModeratedText!
  "Shape discriminator for proposedValue — \"scalar:string\",
   \"scalar:float\", \"scalar:integer\", \"rule\", or
   \"composite:<action_key>\" (proposal.md)."
  valueKind: String!
  "The rule snapshot ruler: rules are read as-of the anchor's
   landing epoch (proposal.md)."
  anchorEpoch: Int!
  "Every ballot on this proposal — the payload-marked ballot
   Opinions toward the anchor, individually. Filter by stance;
   public and auditable."
  ballots(stance: Sign, first: Int, after: String, last: Int, before: String): RecordConnection!
  "The tally — the epoch-quantized fold over accepted ballots, per
   the scope's published formula (role weights, quorum). Served
   from the overlay cache; the fold over records is binding, and
   live counts are a frontend courtesy."
  tally: ProposalTally!
  status: ProposalStatus!
  "The finalization record — the executing authority's (0,0)
   Opinion + outcome payload (outcome, tally digest); null while
   open. The outcome's public record."
  finalization: Record
}

"A proposal's lifecycle state, derived from the tally fold and the
 finalization record. The first crossing epoch triggers
 finalization. REDACTED lands when the anchor payload is removed
 while still open — the terms can never execute; ballots already
 cast stay on record."
enum ProposalStatus { OPEN PASSED FAILED REDACTED }

"The tally of a proposal — the deterministic function of each
 epoch's accepted ballot set (governance.md). Both sides carry the
 scope's weighting; a petition-style Network tally reads only the
 positive side."
type ProposalTally {
  positiveWeight: Float!
  "Count of distinct ballot authors currently positive."
  positiveCount: Int!
  negativeWeight: Float!
  negativeCount: Int!
  "The epoch whose accepted ballot set this tally folds — the
   cache's freshness mark."
  asOfEpoch: Int!
}
```

### Governance (the social contract)

The per-action rules a Collective or Chat carries — supplied in
the founding payload, amended only through its own governed flow.
Each rule pairs a gate to perform the action (`exec`) with a gate
to amend the rule itself (`amend`). Action keys are constructed
from the gesture, never invented ad hoc
([collectives.md §6](../instances/collectives.md#6-the-social-contract)):
`decision:<operation>[:<role>]` for proposal-routed decisions,
`actas:<gesture>` for outgoing-gesture eligibility, with
class-level fallbacks; dispatch walks most-specific →
class-general → the documented defaults.

```graphql
"A node's social contract — its per-action governance rules. Only
 overrides are declared; undeclared actions fall to the documented
 defaults of the owning doc (collectives.md §6, chats.md §5)."
type Governance {
  rules: [GovernanceRule!]!
}

"The rule for one action key. `exec` governs performing the
 action; `amend` governs changing this rule — self-applying, no
 regress."
type GovernanceRule {
  actionKey: String!
  exec: GovernanceExecGate!
  amend: GovernanceAmendGate!
}

"The voting gate for performing an action: who may vote, how their
 votes are weighted, the passing condition, and whether the action's
 subject is barred from voting on it."
type GovernanceExecGate {
  "Who may vote — a predicate over public state. Role-based in
   every current instance; the role vocabulary is open, so the
   schema carries it as a documented string rather than closing the
   grammar."
  eligibility: String!
  "How each eligible vote is weighted."
  weighting: VoteWeighting!
  "Passing condition — one of the threshold shapes in
   governance.md §2.4. Carried as a documented string; the exact
   serialization is the instance's choice."
  threshold: String!
  "Whether the subject of the action is barred from voting on it."
  excludeSubject: Boolean!
}

"The voting gate for amending a rule — the same shape as
 GovernanceExecGate without `excludeSubject`, since an amendment's
 subject is the rule entry itself, not a member."
type GovernanceAmendGate {
  eligibility: String!
  weighting: VoteWeighting!
  threshold: String!
}

"How each eligible vote is weighted. EQUAL: every eligible voter
 counts 1. ROLE: the flat per-role multiplier in roleWeights —
 roles are sets, the highest applicable weight counts. PROPERTY:
 the weight is read from the named membership property (e.g.
 \"ownership_pct\"), so a PROPERTY gate enfranchises only roles
 that carry it. A per-member voting-weight override, where set,
 wins over the mode."
type VoteWeighting {
  mode: WeightMode!
  "ROLE mode — per-role multipliers; null in other modes."
  roleWeights: [RoleWeight!]
  "PROPERTY mode — membership property read as the weight; null otherwise."
  property: String
}

"How a gate weights eligible votes."
enum WeightMode { EQUAL ROLE PROPERTY }

type RoleWeight {
  role: String!
  weight: Float!
}
```

### Campaign and settlement

The campaign pattern ([economics.md §3](../primitive/economics.md#3-the-campaign-record)):
the advertiser authors a **Content anchor** whose witnessed
payload carries the terms, with a `(0,0)` Reference to each named
anchor and to the target; adjustments land as witnessed payloads
on advertiser-authored `(0,0)` Opinions toward the anchor (newest
per term wins); settlement publishes one witnessed payload on a
`(0,0)` Opinion — the advertiser's when discretionary, the
Publisher's when auto-settlement fires. Money never rides L1 or
this API: the deposit sits in rail-side script escrow, payouts are
**batched pushes** whose explicit outputs match the committed
Merkle tree, and every money fact is read through pointers
([ledger.md](ledger.md)).

```graphql
"A pull-marketing campaign — the typed view over its anchor.
 Immutable after creation: anchors and target (they are the
 campaign's identity). Mutable while open, via adjustment records:
 the window end, declared_goal, the support floor, and the
 escrowed deposit — top-up only, never lowered."
type Campaign implements Node {
  "The advertiser — the anchor's author."
  author: Actor!
  "The named anchor set A — the cluster(s) the campaign buys reach
   into; any passive nodes (Profiles for person-cluster campaigns,
   Types for topic campaigns)."
  anchors: [Node!]!
  "The promoted node C the campaign drives reach toward."
  target: Node!
  "Rail-side escrow pointer; the deposit amount is read through the
   pointer, never stored here (economics.md §3)."
  escrow: String!
  "Campaign window, as epoch indices — auditable from public
   records alone."
  startEpoch: Int!
  endEpoch: Int!
  "The campaign value V at startEpoch — the baseline."
  vStart: Float!
  "The V gain the advertiser is aiming for; strictly positive."
  declaredGoal: Float!
  "The per-campaign support floor χ_c ≥ χ — the advertiser's
   targeting-sharpness and compute-cost dial."
  supportFloor: Float!
  status: CampaignStatus!
  "The running per-epoch V series — published as an operational
   convenience; derivable by anyone from records and certificates,
   and disputes resolve against the records (economics.md §9)."
  progress(first: Int, after: String, last: Int, before: String): CampaignProgressConnection!
  "The settlement view once settled; null while open."
  settlement: Settlement
}

"Campaign lifecycle state. SETTLED: the advertiser published the
 settlement payload; AUTO_SETTLED: the publisher system actor
 published it when the auto-settlement condition fired
 (economics.md §6)."
enum CampaignStatus { OPEN SETTLED AUTO_SETTLED }

"One epoch's campaign value."
type CampaignValuePoint {
  epoch: Int!
  v: Float!
}
type CampaignProgressConnection {
  edges: [CampaignProgressEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type CampaignProgressEdge {
  cursor: String!
  node: CampaignValuePoint!
}

"The settlement view — decoded from the settlement payload on the
 (0,0) Opinion toward the campaign anchor (economics.md §10). The
 payload pins everything needed to recompute the payout tree from
 epoch t*'s records: anyone can verify the split."
type Settlement {
  campaign: Campaign!
  "The settlement record itself — who published (advertiser or the
   Publisher) and when."
  record: Record!
  "Released pool (public scalar result)."
  settledP: Float!
  "Achieved sustained V gain (public result; floored at zero)."
  achievedGain: Float!
  "The attribution epoch t* — eligibility, liveness, magnitudes,
   and payout addresses all read from this one epoch's state."
  tStar: Int!
  "The reserve_share in force, recorded in the payload."
  reserveShare: Float!
  "The support floor χ_c in force, recorded in the payload."
  supportFloor: Float!
  "The payout tree's Merkle root — the public commitment of who is
   owed what. Distribution is push, not claim: the rail pays every
   earner directly at their witnessed payout address in force at
   t*, and non-payment is publicly provable against the outputs
   (ledger.md)."
  merkleRoot: String!
  "One account's payout leaf with its Merkle proof — verifiable
   against merkleRoot client-side; null when the account earned
   nothing. Frontend surface only, never on L1."
  payoutLeaf(account: UUID!): PayoutLeaf
}

"One settlement payout leaf."
type PayoutLeaf {
  account: Actor!
  "CGT amount, as the rail-precision string the leaf commits."
  amount: String!
  "The payout address the tree pinned at t*."
  address: String!
  "The Merkle proof path for client-side verification."
  proof: [String!]!
}
```

### Network parameters

The governed parameter schedule lives on L1 — the charter's
payload-folded schedule, amended by finalization payloads — and
the overlay carrier is the operational cache the backend, ranker,
and miner read ([network.md](../primitive/network.md), the
catalog's owner; this spec deliberately does not restate it).

```graphql
"One governed network parameter, from the operational carrier —
 the cache of the charter's replayable parameter schedule. The
 schedule on L1 is binding; the carrier is rebuildable from it."
type NetworkParameter {
  "The catalog key (network.md), e.g. \"gamma\", \"dust_floor\",
   \"reserve_share\"."
  key: String!
  "The current value, serialized per the parameter's kind."
  value: String!
  "The epoch of the finalization payload this value came from (the
   genesis charter payload for never-amended parameters)."
  asOfEpoch: Int!
}
```

### Honor

Honor ledgers are per-community, append-only, and
**membership-gated**: only a member's session can read their
community's ledger, and no slice or ranking path touches it
([data-model.md "Honor ledgers"](data-model.md#honor-ledgers),
[governance.md §11](../primitive/governance.md#11-honor)). The
read surface is deliberately minimal; issuance vocabulary and
policy are governance's.

```graphql
"One honor-ledger entry — append-only, never updated or deleted.
 Freeze-on-expulsion is the membership check at read time, not a
 row state."
type HonorEntry {
  member: Actor!
  amount: Float!
  "The issuance kind, per the community's governed vocabulary."
  kind: String!
  createdAt: DateTime!
}
type HonorEntryConnection {
  edges: [HonorEntryEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type HonorEntryEdge {
  cursor: String!
  node: HonorEntry!
}
```

### Application versions

The append-only release registry
([data-model.md](data-model.md), Application registry) — what the
current version of each platform component is, and where a given
version's patch notes live.

```graphql
"One release of a platform component, from the append-only
 application registry — operational metadata, never ranked."
type AppVersion {
  component: AppComponent!
  "Human-readable version string; unique per component."
  version: String!
  patchNotesUrl: String
  "Actor ids the release credits beyond the upstream repo's commit
   history (designers, translators, testers) — Users and Collectives
   in one list, resolved via `nodes`. Empty when nobody beyond the
   commit history is credited. Display-only, never an input to
   ranking or economics."
  releasedBy: [UUID!]!
  releasedAt: DateTime!
}

"A platform component with releases in the application registry."
enum AppComponent { BACKEND IOS ANDROID WEB }

type AppVersionConnection {
  edges: [AppVersionEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type AppVersionEdge {
  cursor: String!
  node: AppVersion!
}
```

---

## Queries

The root `Query` is deliberately small — a handful of entry points;
everything else hangs off the returned nodes through their fields
and the generic record access. Reads need no authentication; `me`
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

  "Look up any actor by id or unique handle — one namespace across
   kinds, so a handle resolves to exactly one actor."
  actor(id: UUID, handle: String): Actor
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

  "One L1 record by its own identifier — the unit of the chronicle."
  record(id: RecordId!): Record

  "Generic record lookup over the mirror — the public chronicle,
   filterable along the mirror's own indexes: by author, by target,
   by terminal leg (a comment's revision chain), by family,
   payload-marked state, and/or a landing-epoch window
   (data-model.md \"The record mirror\"). Served newest-first in
   landing order — the authoritative causal key (epoch, act time,
   position) — with keyset cursors; target matches the binary/actor
   leg's far end. A UUID that resolves to no known node matches
   nothing. The raw material behind every fold this schema serves —
   any consumer can replay any fold from here."
  records(
    author: UUID
    target: UUID
    terminal: UUID
    family: RecordFamily
    payloadMarked: Boolean
    sinceEpoch: Int
    untilEpoch: Int
    first: Int, after: String, last: Int, before: String
  ): RecordConnection!

  "The chronological listing (roadmap Slice 2): every post,
   newest-first — pending entries, then landed entries in landing
   order, the record set's own order, never wall clock
   (graph-model.md §2). Deliberately not the ranked feed."
  posts(first: Int, after: String, last: Int, before: String, includePending: Boolean! = true): PostConnection!

  "One staged write by id — the confirm-side observation point of
   the write path. Field-level: resolves only for the staging
   actor's session; null otherwise."
  stagedWrite(id: UUID!): StagedWrite

  "The host key the device verifies seals against before approving
   (base64) — realization transparency: every host-added field of a
   verified act is checkable on-device (substrate.md §6)."
  hostPublicKey: String!

  "Anonymous pre-submit check of an invite link, so the app can
   gate the registration form and the key ceremony on a usable
   capability. Null when the id references no link."
  inviteLinkCheck(id: UUID!): InviteLinkCheck

  "The governed network parameters, from the operational carrier —
   all of them, or the named keys. The catalog is network.md's; the
   charter schedule on L1 is binding."
  networkParameters(keys: [String!]): [NetworkParameter!]!

  "A community's honor ledger, newest first — membership-gated:
   resolves only when the authenticated viewer is a member of the
   community (the issuing Collective; CoGra itself is guild #1),
   null otherwise. `member` narrows to one member's entries."
  honorEntries(
    community: UUID!
    member: UUID
    first: Int, after: String, last: Int, before: String
  ): HonorEntryConnection

  "Releases from the application registry, newest first; `component`
   narrows to one platform component. Answers \"what's the current
   version?\" and \"where are version X's patch notes?\"."
  appVersions(
    component: AppComponent
    first: Int, after: String, last: Int, before: String
  ): AppVersionConnection!

  "Any actor's weight-bounded relevant subgraph — the raw material a
   ranker (that actor's own device or a delegated miner) orders into
   a feed. Parameterized by the `viewer` whose feed is ranked: a
   delegated miner ranks on someone's behalf without holding their
   auth, and computing any actor's view for any reader is the
   public-graph default above. Pruned by `dustFloor` (χ) and
   `gamma` (the per-hop attenuation) — defaults are the governed
   network parameters — not hop-bounded: slice membership is
   best-possible path product ∏(γ·w̃) ≥ χ, a function of both
   levers, so both travel (miner-api.md \"The slice path\"). Null if
   the id resolves to no rankable actor. The backend never ranks
   (feed-ranking.md §11) — it serves this slice, and separately
   hydrates the ordered result via `feed`."
  feedSlice(viewer: UUID!, dustFloor: Float, gamma: Float): FeedSlice

  "Hydrate a ranked feed from an ordered list of node ids — a ranker's
   output. Returns those nodes in the given order as a cursor-paginated
   connection; the backend serves the order it is handed, it does not rank."
  feed(
    orderedIds: [UUID!]!
    first: Int, after: String, last: Int, before: String
  ): NodeConnection!

  "Global search across nodes; returns mixed node types. Recall is
   lexical over the indexed name-class fields and post titles; order
   is exact-match tier first, then newest first — viewer-independent,
   the backend never graph-ranks (feed-ranking.md §11). A ranker may
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
   (chats.md §7). Null if the id resolves to no chat."
  chatSearch(
    chatId: UUID!
    query: String!
    first: Int, after: String, last: Int, before: String
  ): ChatMessageConnection

  "Connectivity report for the API process and its store."
  health: Health!
}

type Health {
  "Version of the backend serving this schema."
  backendVersion: String!
  "True when PostgreSQL answers a round-trip probe."
  postgresConnected: Boolean!
  "The last L1 epoch fully ingested into the record mirror; -1 until
   the first epoch lands, null when the cursor could not be read."
  mirrorEpoch: Int
}
```

### Feed

The backend does not rank
([feed-ranking.md §11](../primitive/feed-ranking.md#11-where-ranking-runs)).
It serves the viewer's weight-bounded subgraph slice; a ranker —
the viewer's device or a delegated miner — orders it and hands
back an id list, which `feed` hydrates in order. The ranking
metrics, the parameters, and the contributing paths live with the
ranker, specified in [miner-api.md](miner-api.md).

The slice contract is **raw L1 edge records plus their order
coordinates**: the χ-bounded node set and the accepted records
among those nodes, each with its landing epoch, its authoritative
causal key, and its host-cached edge-projection maturity `τ_e` —
a non-normative L1 by-product a distrusting consumer recomputes
from the published ordered history, which no bounded slice
carries. The ranker folds same-author bundles, derives `w̃`,
extracts, signs, and decays — all itself, exactly and never
sampled, so any consumer can spot-check any ranking claim from
the slice given the shipped maturities. Pre-folded aggregates are
permitted only as a wire optimization that changes nothing
observable
([miner-api.md "The contract"](miner-api.md#the-contract)).

The viewer's seen-list is not part of the slice: it is private
operational state the device fetches under its own session
(`User.viewHistory`) and forwards to a delegated ranker inside the
request. Named opt-in feeds (topic, friends, guild) are read-side
compositions the ranker and frontend build over the same slice
surface — a named feed is presented as what it is and never as the
neutral rank
([feed-ranking.md §10](../primitive/feed-ranking.md#10-the-default-feed-and-named-feeds)).

```graphql
"The viewer's relevant subgraph for ranking — the χ-bounded node
 set and the raw accepted records among those nodes, each with its
 landing epoch. Downloaded by the ranker; the backend computes no
 order over it."
type FeedSlice {
  nodes(first: Int, after: String, last: Int, before: String): NodeConnection!
  records(first: Int, after: String, last: Int, before: String): RecordConnection!
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
the name-class fields and post titles: actor `handle` +
`displayName`, Hashtag `name` (served by the naming-service
registry — [hashtag.md §1](../instances/hashtag.md#1-identity-and-the-naming-service)),
Chat `name`, Item `name`, and Post `title`. Bodies, descriptions,
bios, and attachments are not indexed. A Comment carries no
indexed field and is not a searchable kind — a comment is found
through its post. Chat messages are excluded from the global
index — casual conversation doesn't surface to strangers by
keyword; their search surface is `chatSearch`, and only plaintext
bodies are searchable — encrypted content never is, since the
backend only ever holds ciphertext
([chats.md §7](../instances/chats.md#7-encryption-as-the-privacy-mechanism)).

**Match semantics.** Name-class fields match case-insensitively
by prefix and substring; Post titles and chat-message bodies
match by word-level full-text. The index technology behind those
semantics is an implementation choice.

**Order.** Backend order is exact-match tier first — a result
whose indexed field equals the query case-insensitively — then
newest first. Both keys are viewer-independent: the backend never
ranks by graph
([feed-ranking.md §11](../primitive/feed-ranking.md#11-where-ranking-runs)).
Graph-blended ordering is the ranker's option, the same split as
the feed: the client or delegated miner re-orders the fetched
candidates by the viewer's feed metric where the match is in the
viewer's slice; matches outside the slice keep the recency order,
which is the sort cascade's deepest fallback anyway
([feed-ranking.md §7](../primitive/feed-ranking.md#7-sort-order-tie-breakers-zero-jail)).
The delegated form is the miner's `rankSearch` operation
([miner-api.md](miner-api.md)).
The no-AI rule applies to search ranking as much as to feeds.
`chatSearch` is always newest first.

**Moderation.** `sensitive`-classified fields stay indexed and
matchable; a result carries its per-field status and the frontend
filters by the viewer's severity preference — the same visibility
model as every other read. Redacted fields are excluded from the
index by an explicit rule, not by construction: display-side
redaction appends a tombstone version whose content fields carry
the visible marker
([data-model.md "Display-content versioning"](data-model.md#display-content-versioning))
— e.g. the `redacted-user-{uuid}` handle sentinel — so a current
value still exists to match. The index skips redacted values (a
version row carrying a non-null redaction reason); without that
rule, a substring query for "redacted" would surface every
redacted handle and title.

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
governing principles, run through the prepare → pre-sign → seal →
approve → confirm flow. Each group below lists its mutations as an
`extend type Mutation` block beside its inputs — there is no
separate root index to keep in sync.

### Conventions

These bind every mutation below.

- **Two mutation classes.** A **`prepare*`** mutation stages L1
  acts for the device to sign — nothing exists on the graph until
  the handshake completes (pre-sign, seal, approve) and the act
  confirms. Everything else (auth, private viewer state, media
  upload) is an ordinary L2 operation: one Postgres transaction,
  synchronous result.
- **Single input, dedicated payload.** Each mutation takes one
  `input: <Name>Input!` argument and returns a payload type. Every
  `prepare*` mutation returns the shared `PreparePayload` — the
  staged proposals to pre-sign — unless noted; the resulting
  entities are read through normal queries once the acts confirm.
- **A prepare may stage a batch.** A gesture with structure —
  a post with tags and references, a proposal anchor with its
  subject Reference, a Collective founding — returns several
  `PreparedWrite`s in relay order. **Each is its own priced act**
  (one θ-debit each) running its own two-signature handshake; the
  transport batches freely — one `submitProposals` or
  `approveActs` call carries the whole batch's signatures — but
  there is no cross-record atomicity: whether each lands is L1's
  fact alone, and the flow state advances per record at confirm.
  The batch size is visible to the client, so the total cost is
  legible before signing.
- **The viewer is the actor; `actAs` names a Collective acting
  through them.** No mutation takes an author argument — the
  authenticated viewer in the execution context initiates every
  gesture. A prepare whose gesture a Collective can produce takes
  an optional `actAs: UUID`; null — the default — prepares the
  viewer's own record. `actAs` carries intent, never authority:
  the record's author becomes the Collective's actor, prepare
  checks the viewer's eligibility under the Collective's
  `actas:*` rules (content-acts default any-member, governance-acts
  default deny — [collectives.md §4](../instances/collectives.md#4-acting-through-the-collective)),
  and the signing route changes (see "Acting as a Collective").
  Where the target already pins the acting identity — editing
  authored content, leaving a chat one's Collective is in — the
  identity is read off the target and the same eligibility check
  runs. The Network-scope ballot gestures take no `actAs` where
  the scope's rules make them per-User
  ([governance.md](../primitive/governance.md)).
- **Stance prepares write the picked values; severance alone is
  net-state.** A stance record carries exactly the two values the
  author picked — one new edge against the bundle, never a
  derived delta ([design.md §8.1](design.md)). The bundle is a
  read-side per-author fold — `viewerStance` on every stance-able
  node: current standing and where a pick lands it are shown,
  never folded into what is written. The one exception is the
  explicitly named severance gesture, `prepareSeverance`: there
  the client states the intent and the backend assembles the
  counter-records that net the author's bundle to `(0, 0)` —
  netting, never removal. A parameter is capped at `1`, so a
  bundle carrying more conviction than one record can walk back
  nets over several — `⌈max(|Σ_d|, |Σ_i|)⌉` of them, each its own
  priced act
  ([feed-ranking.md §8.1](../primitive/feed-ranking.md#81-the-act)).
  The batch is therefore the gesture's cost, legible before
  signing like any other prepare batch.
- **Write inputs are raw scalars; moderation is server-assigned.**
  A field read as `ModeratedText` is *written* as a plain `String`:
  the caller never sets a moderation status, so there is no
  `status` on any input. Fields start `NORMAL`; only moderation
  governance moves them.
- **Edits are update records; eligibility is checked at prepare.**
  An edit prepare stages the concept's declared carrier — parallel
  Registration for profiles; elsewhere the node's own minting
  family in its inert setting: Publish at attachment `0` for
  posts, Review at `(0,0)` for comments, Owner at attachment `0`
  for items
  ([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates)).
  L1 would accept anyone's update-shaped record and let the fold
  ignore it; CoGra's own API refuses to prepare a record its
  published fold would never read — a freelance edit is a wasted
  priced act the service does not manufacture.
- **Proposal-backed actions stage the anchor pattern.** The
  governance prepares each stage a Content anchor (terms payload)
  plus the `(0,0)` Reference to the subject. **Creation is never a
  vote**: the client flow immediately follows with
  `prepareBallot` for the author's explicit `+1` — one more priced
  act, consistent with proposer-pays
  ([governance.md](../primitive/governance.md)). Outcomes
  materialize later, off the tally fold, as the executing
  authority's own records (a finalization Opinion; The Publisher's
  role Tag; the chat authority's De-invite) — never as a cascade
  this API performs for the caller.
- **Authentication.** Every mutation requires an authenticated
  viewer except the entry and recovery gestures: `register`,
  `verifyEmail`, `resendVerificationEmail`, `logIn`,
  `refreshSession`, `requestPasswordReset`,
  `confirmPasswordReset`, and the token-bearing
  `confirmAccountDeletion`. Acting mutations further require the
  `MEMBER` account state — an acting call from a guest or
  applicant account is a `FORBIDDEN` transport fault, not a
  userError: the client already gates acting on
  `User.accountState`, so such a request is a client bug, never a
  state to render.
- **Errors follow the tiered model** (governing principles). A
  `userErrors: [UserError!]!` field is **implied on every payload type
  below and omitted from its body**, exactly as the interface fields
  are implied on the read types; a payload's named result field is null
  whenever `userErrors` is non-empty — the exported SDL therefore
  declares every named result field nullable; the bodies below show
  the populated success shape. Transport faults ride the `errors` array with an
  `extensions.code` and are never repeated per payload. The one carve-out
  carries no `userErrors`: the three deliberately-silent verbs —
  `resendVerificationEmail`, `requestPasswordReset`, `requestEmailChange`
  — always report success, so surfacing a failure there would reintroduce
  the account enumeration they exist to prevent.

### The write flow

The system view is
[architecture.md "The write path"](architecture.md#the-write-path);
these are its API types. A prepare validates, pre-checks the write
rule (a failure is a `WRITE_RULE_FAILED` userError — a normal
account state with a product-surfaced restoration flow, never an
auth fault), stages the write, and returns the canonical material.
The device recomputes the pre-digests from the proposal and
pre-signs; after `submitProposals` returns the host-sealed
verified act, it verifies the seal, the exact body, and both
commitment openings before signing the approval witness — **the
user never signs blind bytes, at either step**
([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)).
`approveActs` relays the approvals; `stagedWrite` (and
`User.stagedWrites`) observes the asynchronous confirm.

```graphql
"One staged proposal awaiting the pre-commitment signature — the
 canonical material the device verifies and pre-signs."
type PreparedWrite {
  "The staged-write id — the handle for the whole handshake."
  id: UUID!
  family: RecordFamily!
  "The canonical proposal, serialized for pre-signing (base64).
   Covers everything the author asserts — endpoints, parameters,
   payload bytes, dependency list — so the relay can neither
   alter it nor author one unasked."
  canonicalProposal: String!
  "Domain-separated digest over the payload bytes — a transport
   cross-check for the parsed proposal. The signing pre-digests are
   salted by the device's private nonce and never leave it."
  contentPreDigest: String!
  "Domain-separated digest over the canonical dependency encoding —
   the dependency-side transport cross-check."
  dependencyPreDigest: String!
  "Epoch budget: a staged write that never completes the handshake
   and lands is garbage-collected — staged payload included — after
   this many epochs (an operational parameter; data-model.md
   \"Staged writes\")."
  gcAfterEpochs: Int!
}

"The shared payload of every prepare* mutation: the staged
 proposals to pre-sign, in relay order. Each is its own priced act."
type PreparePayload {
  writes: [PreparedWrite!]
}

"A staged write's lifecycle. AWAITING_PRE_SIGN: prepared, the
 pre-commitment not yet submitted. SEALING: pre-signed and
 submitted; the backend awaits the host-sealed verified act.
 AWAITING_APPROVAL: the sealed act is back and awaits the device's
 approval witness. RELAYING: approved and submitted for ordering;
 the backend drives retries across epoch boundaries. LANDED: the
 accepted act is in the mirror and the staged effects are
 promoted. EXPIRED: garbage-collected without landing — nothing
 existed on the graph."
enum StagedWriteState {
  AWAITING_PRE_SIGN
  SEALING
  AWAITING_APPROVAL
  RELAYING
  LANDED
  EXPIRED
}

"One staged write — the observation point for the handshake and
 the asynchronous confirm. Field-authorized to the staging actor's
 session: the handshake is the author's own business. The staged
 *content* is nobody's secret — it reads through the ordinary node
 and listing surfaces from the pre-commitment onward, for every
 viewer."
type StagedWrite {
  id: UUID!
  state: StagedWriteState!
  family: RecordFamily!
  "The canonical proposal (base64) — the same bytes prepare
   returned, re-readable after a lost response. A device that
   never saw the prepare (a backend-staged Registration discovered
   on the poll, a crashed client resuming) decodes and pre-signs
   from here."
  canonicalProposal: String!
  "The host-sealed verified act once AWAITING_APPROVAL (base64):
   the exact body the device verifies — seal, equality with what
   it pre-signed, both commitment openings — and signs the
   approval witness over. Null in earlier states."
  verifiedAct: String
  "The accepted record once LANDED; null before."
  record: Record
}
type StagedWriteConnection {
  pageInfo: PageInfo!
  edges: [StagedWriteEdge!]!
}
type StagedWriteEdge {
  cursor: String!
  node: StagedWrite!
}

"One pre-signed proposal heading to the seal round trip."
input ProposalSignatureInput {
  stagedWriteId: UUID!
  "The pre-commitment blob (base64): deterministic CBOR
   `[1, nonce, preSignature]` — the device's private nonce and its
   pre-commitment signature over the canonical proposal, produced
   with the actor's device-held key; opaque to this API. For a
   co-signed Collective act the signature half is the member-side
   contribution (see \"Acting as a Collective\")."
  signature: String!
  "Collective acts only: the acting member's instruction, signed
   with their OWN key — the operational trigger the backend checks
   against the governance map before contributing its co-signing
   half. Never graph state; on the graph the Collective's actor
   signs alone."
  instructionSignature: String
}

input SubmitProposalsInput {
  proposals: [ProposalSignatureInput!]!
}
type SubmitProposalsPayload {
  stagedWrites: [StagedWrite!]
}

"One approval witness heading to the ordering relay."
input ApprovalSignatureInput {
  stagedWriteId: UUID!
  "The actor's approval-witness signature over the exact verified
   act, host-added commitments included. Collective acts follow
   the same co-signing route as the pre-commitment."
  signature: String!
  "Collective acts only — same rule as on ProposalSignatureInput."
  instructionSignature: String
}

input ApproveActsInput {
  approvals: [ApprovalSignatureInput!]!
}
type ApproveActsPayload {
  stagedWrites: [StagedWrite!]
}

extend type Mutation {
  "Relay pre-signed proposals to L1's seal round trip.
   Verification failures surface as SIGNATURE_INVALID userErrors
   per proposal. When the seal returns synchronously the payload's
   staged writes are already AWAITING_APPROVAL, verified act
   included; otherwise observe via stagedWrite. Resubmitting a
   sealed proposal is idempotent only for the exact signature that
   was sealed; differing bytes refuse as BAD_INPUT."
  submitProposals(input: SubmitProposalsInput!): SubmitProposalsPayload!
  "Relay approval witnesses — only an approved act is orderable.
   Landing stays asynchronous; observe via stagedWrite."
  approveActs(input: ApproveActsInput!): ApproveActsPayload!
}
```

#### Acting as a Collective

A record authored by a Collective is signed by the Collective's
key — creator-held, with per-member 2-of-2 co-signing; the backend
never holds a complete key
([collectives.md §2](../instances/collectives.md#2-custody)). The
API shape: prepare with `actAs` stages the record with the
Collective as author; the acting member's device submits it with
their `instructionSignature` (their own key — the client-signed
authoring path applied to the trigger) plus their member-side
signature contribution; the backend verifies the instruction
against the governance map — `actas:*` eligibility, and a passed
decision where the contract requires one — and only then completes
the signature with its half and relays. The creator's device holds
the full key and signs alone. On the shared graph the Collective's
actor signs alone either way: **no per-record member attribution
exists, deliberately** — accountability lives in the social
contract. The split-signature mechanics and their open L1
dependencies are [collectives.md §2](../instances/collectives.md#2-custody)'s;
until the splits ship, backend custody is the documented stopgap
and `signature` is omitted on such acts — the instruction alone
authorizes the backend's stopgap signing.

### The generic stance

```graphql
"Prepare the acting identity's stance toward a node — the one
 generic write for sentiment and connection. The target selects
 the family: Affinity toward a Hashtag (the follow-topic gesture),
 Opinion toward everything else — toward a Profile it is the
 interpersonal stance (and the reciprocation gesture that
 completes the CoGra-join mutual pair — invitations.md §2).
 pDirected / pInterest are written as picked — one new edge
 carrying exactly these values; the bundle is a read-side fold
 (conventions, design.md §8.1). Severance is its own explicit
 gesture, not a value these fields reach. Valid toward any
 passive node; ballots go through prepareBallot."
input PrepareStanceInput {
  target: UUID!
  pDirected: Dimension!
  pInterest: Dimension!
  "Act as this Collective (see conventions); null = the viewer's
   own gesture."
  actAs: UUID
}

"Sever the acting identity's bundle toward a node — the explicit
 gesture that nets it to (0, 0). Stages the counter-records the
 current bundle needs, each its own priced act, so the batch length
 is the gesture's cost (conventions). Refused when the bundle
 already nets to (0, 0)."
input PrepareSeveranceInput {
  target: UUID!
  actAs: UUID
}

extend type Mutation {
  prepareStance(input: PrepareStanceInput!): PreparePayload!
  prepareSeverance(input: PrepareSeveranceInput!): PreparePayload!
}
```

**Every passive node class is a stance target**, under this one
control and one fold — Profile, Content, Comment, Chat, Message,
Item, Type, Offer ([nodes.md §1](../primitive/nodes.md); Actor is
the sole active class and is stanced through its Profile). The
kinds whose slices have not landed yet join as those slices land;
none of them gets a different gesture, a different family
selection rule, or a different bundle.

#### The read-side bundle fold

What a pick *writes* is never derived from the bundle; where the
pick *lands* is, and the control has to show it
([design.md §8.2](design.md)). Every stance-able node carries the
viewer's own bundle as a field, folded by the published rule —
same-author sum-then-clip, keyed (author, target, family), with
payload-marked records excluded
([feed-ranking.md §3.2](../primitive/feed-ranking.md#32-the-fold--per-author-net-stance)).

```graphql
"A candidate pick, for projecting where it would land the bundle
 without authoring anything."
input StancePickInput {
  pDirected: Dimension!
  pInterest: Dimension!
}

"Where a bundle stands once a candidate pick folds into it."
type StanceProjection {
  pDirected: Dimension!
  pInterest: Dimension!
  "Either axis at zero — the stance would carry nothing."
  inert: Boolean!
  "Both axes at zero — the pick reaches severance."
  severed: Boolean!
}

"The viewer's own stance bundle toward one node: the read-side
 per-author fold. Null for a viewer who has none."
type StanceBundle {
  "The folded pair as it stands."
  pDirected: Dimension!
  pInterest: Dimension!
  "The raw sums the fold clips — unbounded, so Float rather than
   Dimension. What a walk back to zero actually walks."
  rawPDirected: Float!
  rawPInterest: Float!
  "How many records the bundle folds."
  recordCount: Int!
  inert: Boolean!
  severed: Boolean!
  "How many counter-records severance would stage right now — the
   gesture's cost. Zero when the bundle already nets to (0, 0)."
  severanceCost: Int!
  "Where the supplied pick lands the bundle; null without one."
  projected: StanceProjection
}
```

**Both sides of the fold are served.** The clip is the read rule,
not the storage — a bundle summing to `2.4` on valence folds to
`1.0`, and the `2.4` is what a walk back to zero actually walks.
Severance is priced off it: `severanceCost` is
`⌈max(|Σ_d|, |Σ_i|)⌉`, which the folded pair alone cannot yield.
Clients recompute the landing the same way, folding `raw + pick`
locally under the drag so the pad answers with no round trip
([design.md §8.3](design.md)); `projected` gives a caller the same
fold server-side in the read that already fetched the bundle.

The field is `viewerStance(pick: StancePickInput, includePending:
Boolean! = true)` on every stance-able node. `includePending`
carries the same meaning and default as the content listings: the
reader chooses the **L1 view** — only what has landed — or the
**L2 view**, which also counts the viewer's own acts in flight
from the pre-commitment onward. Severance computes its batch
against the L2 view, so severing and refetching reads `(0, 0)` at
once rather than an epoch later.

### Content authoring

Creating content stages a batch: the minting record (Publish for
a Post, Review for a Comment, Send for a Message, Owner for an
Item) whose payload envelope carries the body fields and media
digests, plus one Tag record per declared topic and one Reference
record per citation — each its own priced act. The license
declaration is mandatory in every content-creation flow
([platform-guidelines.md](../instances/platform-guidelines.md)):
the qualifiers are structural fields of the minting record —
public protocol references, never envelope content — so they
survive every payload state and drive the render obligations.
Attachments, tags, references, and `actAs` are staged
sub-surfaces: the inputs below are the target contract, and each
arrives with the work that carries it (media with the media
follow-up, `actAs` with collectives).

```graphql
"One attachment placement within a gallery. Assets are uploaded
 first via uploadMedia; the envelope commits their digests."
input AttachmentInput {
  mediaId: UUID!
  displayOrder: Int!
  isCover: Boolean
}

"A topic declaration — one Tag record toward the canonical Type
 (names are normalized by the naming service; a new name needs no
 creation act, Types anchor vacuously — hashtag.md). Parameters
 default per the low-defaults policy; Tag confidence is
 census-bounded to [0, 1]. Re-tagging a name revises the claim —
 the newest record per (author, content, Type) wins, and relevance
 0 is the un-tag, read as withdrawn (hashtag.md §4)."
input TagInput {
  name: String!
  pDirected: Dimension
  pInterest: Dimension
}

"A citation — one Reference record from the authored artifact to
 the target. A mention is a Reference targeting the person's
 Profile."
input ReferenceInput {
  target: UUID!
  pDirected: Dimension!
  pInterest: Dimension!
}

"The qualifiers a content node was minted with
 (layer1-interface.md §10 def:content:license-qualifiers): each a
 degree on [0, 1] — attribution `a`, how far a use must credit the
 maker; provenance `o`, how far a use must be tracked publicly and
 left open to audit. Requirements on downstream use, never a
 declaration of how the content was made."
type License {
  attribution: Float!
  provenance: Float!
}

"The mandatory authoring-time declaration (platform-guidelines.md):
 the terms downstream use must meet, as a degree on each axis. The
 composer offers the three readings CoGra publishes — 0, 0.5
 (commercial uses only), and 1. Immutable — genesis-only; edits
 never carry a license."
input LicenseInput {
  attribution: Float!
  provenance: Float!
}

"Author a Post — stages the Publish plus the Tag and Reference
 records. Body fields are plain strings — moderation status is
 server-assigned. Tags and references are explicit structured
 inputs, never parsed from the body, so display content and graph
 structure stay decoupled."
input PreparePostInput {
  title: String
  description: String
  content: String!
  attachments: [AttachmentInput!]
  tags: [TagInput!]
  references: [ReferenceInput!]
  license: LicenseInput!
  "The Publish record's attachment parameter; defaults to the
   low-defaults policy value (+0.1)."
  pDirected: Dimension
  "Act as this Collective (see conventions)."
  actAs: UUID
}

"Edit a Post — stages one ordinary-role Publish + payload record
 at attachment 0 carrying the Post's complete new content state;
 an omitted title, description, or gallery is a Post without one.
 Only the eligible author's edit is prepared. New tags or
 citations are their own gestures, not edit fields."
input PreparePostEditInput {
  id: UUID!
  title: String
  description: String
  content: String!
  attachments: [AttachmentInput!]
}

"Author a Comment — stages the Review (targeting whatever it
 responds to; the terminal leg mints the Comment) plus any Tag and
 Reference records."
input PrepareCommentInput {
  "The node the comment is on (a CommentTarget)."
  target: UUID!
  content: String!
  attachments: [AttachmentInput!]
  tags: [TagInput!]
  references: [ReferenceInput!]
  license: LicenseInput!
  pDirected: Dimension
  pInterest: Dimension
  actAs: UUID
}

input PrepareCommentEditInput {
  id: UUID!
  content: String!
  attachments: [AttachmentInput!]
}

"Update the acting identity's profile — stages a parallel
 Registration: L1's own profile-update idiom, payload only, never
 identity (substrate.md §9). Covers the display fields and the
 witnessed payout address (a Liquid address — ledger.md). Omitted
 fields are untouched. displayName refuses the explicit-null
 clear — a profile always shows a name. For a Collective's
 profile, actAs routes through its governed edit flow. The handle
 is L2 account state, not profile payload — see changeHandle."
input PrepareProfileUpdateInput {
  displayName: String
  bio: String
  avatarMediaId: UUID
  coverMediaId: UUID
  websiteUrl: String
  payoutAddress: String
  actAs: UUID
}

"Upload a single media asset. A pure L2 operation — the binary
 rides the GraphQL multipart request as an Upload; the asset's
 digest enters payload envelopes at prepare time. Layout hints the
 server cannot infer (alt text) are supplied, the rest (aspect
 ratio, duration) are derived."
input UploadMediaInput {
  file: Upload!
  altText: String
  "Act as this Collective; null = the viewer is the asset's author."
  actAs: UUID
}
type UploadMediaPayload { media: MediaAttachment! }

"A prepared content write: the staged handshake plus `node` — the
 L2 id the envelope binds to the minted node, and the id the
 content reads serve once the record lands. The client needs it to
 read its own write back; hydrating it through the record chain
 would be hostile. Null when userErrors is non-empty."
type PrepareContentPayload {
  node: UUID
  writes: [PreparedWrite!]
}

extend type Mutation {
  preparePost(input: PreparePostInput!): PrepareContentPayload!
  preparePostEdit(input: PreparePostEditInput!): PrepareContentPayload!
  prepareComment(input: PrepareCommentInput!): PrepareContentPayload!
  prepareCommentEdit(input: PrepareCommentEditInput!): PrepareContentPayload!
  prepareProfileUpdate(input: PrepareProfileUpdateInput!): PreparePayload!
  uploadMedia(input: UploadMediaInput!): UploadMediaPayload!
}
```

A content edit input carries the whole content state, so its
optional text fields are two-valued: a value renders, omitted or
null renders as nothing. A profile update's fields ride
three-valued — omitted = untouched, explicit null = cleared, a
value = replaced. `isCover` applies to post galleries only;
comment galleries ignore it.

A media gallery on a create/edit input is the **full intended
gallery** for that write: the new current arrangement, referencing
assets already uploaded via `uploadMedia`. The envelope commits
the digests; the bytes stay in CoGra carriage, verifiable against
them ([substrate.md §7](../primitive/substrate.md#7-payload-carriage)).
Messages have no edit surface: Message bodies are not among the
declared updatable values
([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates)).

### Chats

The L1 flow ([chats.md](../instances/chats.md)): the founder's own
Participant mints the Chat; Join Request and Invitation are
proposals, never participation; membership materializes only from
the invitee's **own** Participant; Leave is unilateral and
unconditional. A kick is a passed `decision:disavow_member`
proposal followed by the executing chat authority's De-invite
citing the anchor — the fold recognizes only proposal-backed
De-invites.

```graphql
"Found a Chat — stages the founding Participant; the payload
 carries name, description, image digests, and the governance map."
input PrepareChatInput {
  name: String
  description: String
  imageMediaId: UUID
  "The governance map; defaults to the reference chat contract
   (chats.md §5) if omitted."
  governance: GovernanceInput
  actAs: UUID
}

"Post a message — stages the Send (the terminal leg mints the
 Message). For an encrypted message, `content` is the ciphertext
 and `epoch` names the chat-key epoch it is under; for plaintext,
 `epoch` is null. Membership is CoGra's read-side fold policy —
 prepare enforces it as L2 policy."
input PrepareChatMessageInput {
  chat: UUID!
  content: String!
  contentPrivacy: ContentPrivacy!
  epoch: Int
  attachments: [AttachmentInput!]
  references: [ReferenceInput!]
  license: LicenseInput!
  actAs: UUID
}

"Join a Chat — stages the actor's own Participant. Prepared
 directly for openly-admitting chats; for gated chats only when
 backed by an approved Join Request or a standing Invitation, per
 the chat's recognized-membership policy."
input PrepareChatJoinInput {
  chat: UUID!
  actAs: UUID
}

"Ask to join — stages a Join Request (a proposal, never
 participation; ignoring one requires no graph action)."
input PrepareChatJoinRequestInput {
  chat: UUID!
  "Optional message, carried as payload."
  message: String
  actAs: UUID
}

"Invite someone — stages an Invitation (Actor → Chat → invitee's
 Profile): a public, priced vouch that the invitee fits. The
 invitee joins by their own Participant. Census-bounded relevance
 parameter; the message rides the payload."
input PrepareChatInvitationInput {
  chat: UUID!
  invitee: UUID!
  message: String
  pDirected: Dimension
  pInterest: Dimension
  actAs: UUID
}

"Leave — stages the unilateral Leave record. A rage-quit is Leave
 plus a separate negative stance; sentiment never rides control
 records."
input PrepareChatLeaveInput {
  chat: UUID!
  actAs: UUID
}

"Execute a passed kick — stages the De-invite (Actor → Chat →
 member's Profile) with the authorizing proposal's anchor cited in
 the payload. Prepared only for the chat authority the per-chat
 contract designates, and only against a passed
 decision:disavow_member proposal; the membership fold ignores
 anything else (a freelance De-invite merely revokes the author's
 own prior Invitation vouch)."
input PrepareDeInviteInput {
  chat: UUID!
  member: UUID!
  "The authorizing proposal."
  proposal: UUID!
  actAs: UUID
}

extend type Mutation {
  prepareChat(input: PrepareChatInput!): PreparePayload!
  prepareChatMessage(input: PrepareChatMessageInput!): PreparePayload!
  prepareChatJoin(input: PrepareChatJoinInput!): PreparePayload!
  prepareChatJoinRequest(input: PrepareChatJoinRequestInput!): PreparePayload!
  prepareChatInvitation(input: PrepareChatInvitationInput!): PreparePayload!
  prepareChatLeave(input: PrepareChatLeaveInput!): PreparePayload!
  prepareDeInvite(input: PrepareDeInviteInput!): PreparePayload!
}
```

Chat metadata has no edit mutation: a chat revises by succession,
never in place — a passed ``decision:set:metadata`` proposal is
executed by the chat's system actor as one succession act whose
founding payload carries the new values
([chats.md §8](../instances/chats.md#8-chat-metadata-and-updates)).
The governance prepares above cover the deciding; the execution is
backend-authored.

Key epochs need no mutation: rotation is automatic on every
membership transition (derived from public records), and the one
governance-routed rotation — mid-epoch, e.g. after a device
compromise — is a `decision:rotate_key` proposal through
`prepareProposal`; on pass, members re-run the key update
off-graph ([chats.md §7](../instances/chats.md#7-encryption-as-the-privacy-mechanism)).
Role changes, message disavowal, and every other chat decision
ride the same proposal machinery under the chat's governance map.

### Collectives

Founding is a device-side ceremony: the creator's device generates
the Collective's key and L0 address (custody starts creator-held —
[collectives.md §2](../instances/collectives.md#2-custody)), the
θ-debits are treasury-funded, and the prepare stages the batch —
the Collective's Registration (profile + social contract payload,
signed with the new collective key on the creator's device) and
the founder ↔ collective mutual Opinion pair (stance fabric, not
CoGra-join). Membership is the public payload fold
([collectives.md §5](../instances/collectives.md#5-membership--a-public-fold)):
member-side payload-marked `(0,0)` Opinions (join/leave) paired
with collective-side decision-backed recognition records; roles,
stakes, and weight overrides ride the collective-side payloads.

```graphql
"Found a Collective — stages its Registration and the founder ↔
 collective connectivity pair. The handle is reserved in the L2
 namespace at prepare."
input PrepareCollectiveInput {
  handle: String!
  displayName: String!
  description: String
  avatarMediaId: UUID
  websiteUrl: String
  "The social contract, carried in the Registration payload."
  governance: GovernanceInput!
  "A Collective founding a sub-Collective acts through actAs."
  actAs: UUID
}

"Declare joining — stages the member-side payload-marked (0,0)
 Opinion toward the Collective's Profile. Membership stands only
 once the collective-side recognition agrees."
input PrepareCollectiveJoinInput {
  collective: UUID!
  actAs: UUID
}

"Declare leaving — the member-side leave payload; unilateral, the
 fold reads the newest member-side record."
input PrepareCollectiveLeaveInput {
  collective: UUID!
  actAs: UUID
}

"The collective-side half of the membership fold — stages the
 decision-backed acceptance or revocation payload toward the
 member's Profile, carrying roles, ownership stake, and weight
 override where the contract defines them. actAs is the Collective
 (a governance-act: default deny, and backed by a passed decision
 where the contract requires one)."
input PrepareCollectiveRecognitionInput {
  "The Collective acting (via actAs semantics — required here)."
  actAs: UUID!
  member: UUID!
  action: RecognitionAction!
  roles: [String!]
  ownershipPct: Float
  votingWeight: Float
  "The authorizing decision's proposal, where the contract
   requires one."
  proposal: UUID
}
enum RecognitionAction { ACCEPT REVOKE }

extend type Mutation {
  prepareCollective(input: PrepareCollectiveInput!): PreparePayload!
  prepareCollectiveJoin(input: PrepareCollectiveJoinInput!): PreparePayload!
  prepareCollectiveLeave(input: PrepareCollectiveLeaveInput!): PreparePayload!
  prepareCollectiveRecognition(input: PrepareCollectiveRecognitionInput!): PreparePayload!
}
```

Profile and contract changes route through the shared machinery:
`prepareProfileUpdate` with `actAs` for display fields (the
governed edit flow), `prepareProposal` for `decision:set:*` and
rule amendments under the contract's own amend gates. Collectives
are never invited to CoGra and have no inviter
([economics.md §7.3](../primitive/economics.md#73-the-inviter-reward)).

### Items and the marketplace

L1's settlement machinery, adopted wholesale
([items.md](../instances/items.md)): the genesis Owner mints the
Item; transfer is the Bid → Accept → Ratify thread (the Bid mints
the Offer node; Withdraw / Rescind cancel); title is `owner^(k)`,
consumed read-only — it moves at the epoch certificate, never at
the Ratify. Money is the one CoGra-side piece: the asking price is
an Item payload field (the edit fold), the offered price is a term
on the Bid payload, and payment settles rail-side through the
fixed-destination two-branch purchase covenant — locked before the
Bid lands, released against the epoch certificate in which the
settlement is recognized
([ledger.md](ledger.md#the-marketplace-rail)).

```graphql
"List a good — stages the genesis Owner (mints the Item; payload
 carries the display fields and digests). Attachment parameter
 defaults to the low-defaults policy value."
input PrepareItemInput {
  name: String!
  description: String
  attachments: [AttachmentInput!]
  tags: [TagInput!]
  license: LicenseInput!
  "CGT amount, rail-precision string; omitted = not offered for
   sale (items.md §6)."
  askingPrice: String
  pDirected: Dimension
  actAs: UUID
}

"Edit an Item — stages one ordinary-role Owner + payload record at
 attachment 0. The eligible author is the current certified owner
 (owner^(k) as of the record's landing epoch); a superseded
 owner's edit is never prepared."
input PrepareItemEditInput {
  id: UUID!
  name: String
  description: String
  attachments: [AttachmentInput!]
  "Set or change the listing; empty string clears it."
  askingPrice: String
}

"Bid on an Item — stages the Bid (mints the Offer). The price is a
 payload term in CGT, a number the records pin and the rail
 settles — never money on the graph. Census-bounded urgency
 parameter."
input PrepareBidInput {
  item: UUID!
  "CGT amount, rail-precision string."
  price: String!
  "Rail-side escrow pointer; the purchase covenant is already
   locked there — a Bid is funded before it lands (fund-at-Bid,
   ledger.md)."
  escrow: String!
  pDirected: Dimension
  pInterest: Dimension
  actAs: UUID
}

"Accept a Bid (seller → buyer, settlement reference to it). Not binding
 alone — the buyer's Ratify commits."
input PrepareAcceptInput {
  offer: UUID!
  actAs: UUID
}

"Ratify (buyer → seller) — the commit. Title moves at the epoch
 certificate; the escrowed payment releases against that same
 certificate."
input PrepareRatifyInput {
  offer: UUID!
  actAs: UUID
}

"Withdraw a Bid (buyer cancel) — a control record. The offer dies
 instantly on L1; the escrow refund follows on the platform's next
 attestation sweep."
input PrepareWithdrawInput {
  offer: UUID!
  actAs: UUID
}

"Rescind an Accept before the commit (seller cancel) — a control
 record."
input PrepareRescindInput {
  offer: UUID!
  actAs: UUID
}

extend type Mutation {
  prepareItem(input: PrepareItemInput!): PreparePayload!
  prepareItemEdit(input: PrepareItemEditInput!): PreparePayload!
  prepareBid(input: PrepareBidInput!): PreparePayload!
  prepareAccept(input: PrepareAcceptInput!): PreparePayload!
  prepareRatify(input: PrepareRatifyInput!): PreparePayload!
  prepareWithdraw(input: PrepareWithdrawInput!): PreparePayload!
  prepareRescind(input: PrepareRescindInput!): PreparePayload!
}
```

For a Collective, settlement signatures (Accept / Ratify) are
governance-acts: default deny, routed through the contract
(``decision:transfer:Item``) so the cascade performs the gesture
only after the internal vote passes.

### Tipping

A tip is a rail transfer plus a public stance
([ledger.md](ledger.md#tipping)). The client reads the target
author's `payoutAddress`, sends the explicit Liquid transfer from
the device-held rail key, then prepares the stance — an Opinion
toward the tipped node whose payload carries the transaction
pointer. The backend validates the target class and checks the
transfer's destination against the author's witnessed payout
address; a target whose author has published no payout address is
not tippable — an expected outcome, not a fault, and the UI's cue
to prompt the recipient.

```graphql
"Tip a node's author — stages the tipper's Opinion toward the
 target, payload carrying the rail-transaction pointer (a pointer,
 never an amount). Valid targets: any authored passive node except
 Chats and Items — Profiles included (the direct person tip), chat
 Messages included (existence and membership are already public
 structure; the body stays ciphertext). Stance parameters default
 to the low-defaults policy value."
input PrepareTipInput {
  target: UUID!
  "Pointer to the executed Liquid transfer; its destination must
   match the target author's witnessed payout address in force."
  txPointer: String!
  pDirected: Dimension
  pInterest: Dimension
  actAs: UUID
}

extend type Mutation {
  prepareTip(input: PrepareTipInput!): PreparePayload!
}
```

### Governance and moderation

Every governance gesture is the anchor pattern (see the Proposal
type): these prepares stage the anchor batch; ballots are their
own gesture. Reporting **is** proposing — a report stages a
moderation proposal whose anchor payload carries the reporter's
justification and whose `(0,0)` Reference names the subject; there
is no separate reports store
([moderation.md](../instances/moderation.md)). Verdict
materialization (The Moderator's Tag), role materialization (The
Publisher's Tag), and finalization are the system actors' own
records, never client mutations.

```graphql
"The generic proposal — stages the Content anchor (terms payload)
 and the (0,0) Reference to the subject. The scope and its rules
 follow from the subject and actionKey (Network / chat /
 collective); the anchor's landing epoch is the rule-snapshot
 ruler. Follow with prepareBallot for the author's explicit +1."
input PrepareProposalInput {
  "The proposal's subject node."
  subject: UUID!
  "The governance instance — \"decision:<operation>[:<role>]\" per
   the scope's contract."
  actionKey: String!
  proposedValue: String!
  "Shape discriminator — \"scalar:*\", \"rule\", or
   \"composite:<action_key>\" (proposal.md)."
  valueKind: String!
  actAs: UUID
}

"A ballot — stages the payload-marked ballot Opinion toward the
 proposal's anchor: public, permanent, priced, epoch-quantized.
 Recasting is a new ballot record; the tally reads each author's
 newest. Accepted only while the proposal is OPEN as of the
 current tally fold."
input PrepareBallotInput {
  proposal: UUID!
  "The stance: POSITIVE or NEGATIVE (ZERO is not a ballot)."
  direction: Sign!
  actAs: UUID
}

"Report content — a moderation-classification proposal.
 SENSITIVE and ILLEGAL classify; NORMAL is valid only against a
 standing SENSITIVE classification — an illegal redaction is
 terminal (moderation.md). The justification rides the anchor
 payload."
input PrepareReportInput {
  target: UUID!
  status: ModerationStatus!
  justification: String!
}

"Propose a network-role change (moderator promotion / demotion) —
 a Network-scope proposal; on pass The Publisher materializes the
 role Tag."
input PrepareModeratorRoleChangeInput {
  user: UUID!
  role: NetworkRole!
}

"Amend one governed network parameter — a Network-scope proposal
 targeting the charter schedule; the catalog and buckets are
 network.md's. On pass the finalization payload extends the
 schedule and the operational carrier follows."
input PrepareParameterChangeInput {
  "The catalog key (network.md)."
  parameter: String!
  "The value, serialized per the parameter's kind."
  value: String!
}

"Bump the platform guidelines to a new version and content hash —
 a Network-scope proposal (platform-guidelines.md)."
input PrepareGuidelinesChangeInput {
  version: Int!
  "SHA-256 of the canonical guidelines document (64 hex chars)."
  hash: String!
}

extend type Mutation {
  prepareProposal(input: PrepareProposalInput!): PreparePayload!
  prepareBallot(input: PrepareBallotInput!): PreparePayload!
  prepareReport(input: PrepareReportInput!): PreparePayload!
  prepareModeratorRoleChange(input: PrepareModeratorRoleChangeInput!): PreparePayload!
  prepareParameterChange(input: PrepareParameterChangeInput!): PreparePayload!
  prepareGuidelinesChange(input: PrepareGuidelinesChangeInput!): PreparePayload!
}
```

### Campaigns

The advertiser's gestures around the campaign anchor
([economics.md §3](../primitive/economics.md#3-the-campaign-record)).
The deposit is escrowed on the rail **before** creation — the
anchor payload carries the pointer, and amounts are read through
it, never asserted. Anchors and target are immutable (they are the
campaign's identity); a different targeting is a different
campaign.

```graphql
"Open a campaign — stages the anchor Content (terms payload) and
 its (0,0) References to each named anchor and the target."
input PrepareCampaignInput {
  "The named anchor set — passive nodes (Profiles, Types)."
  anchors: [UUID!]!
  target: UUID!
  "Rail-side escrow pointer; the deposit is already locked there."
  escrow: String!
  "Campaign window, epoch indices."
  startEpoch: Int!
  endEpoch: Int!
  "Strictly positive — the auto-settlement formula divides by it."
  declaredGoal: Float!
  "χ_c ≥ χ; defaults to the network dust floor."
  supportFloor: Float
  "The advertiser; a Collective advertises through actAs."
  actAs: UUID
}

"Adjust an OPEN campaign — stages the (0,0) Opinion whose payload
 carries the changed terms (newest per term wins). Mutable:
 endEpoch (free extension — the anti-bot lever), declaredGoal,
 supportFloor, and the deposit — top-up only, via a fresh escrow
 pointer; never lowered."
input PrepareCampaignAdjustmentInput {
  campaign: UUID!
  endEpoch: Int
  declaredGoal: Float
  supportFloor: Float
  "Escrow pointer covering the topped-up deposit."
  escrowTopUp: String
}

"Settle a campaign discretionarily — stages the advertiser's
 settlement payload Opinion. The advertiser names the attribution
 epoch t* within the window; the backend computes the split from
 epoch t*'s public state (the payload pins settled_P,
 achieved_gain, t*, the shares in force, and the Merkle root, so
 anyone can recompute the tree). Auto-settlement needs no
 mutation — The Publisher authors it when the condition fires.
 The rail then pushes the payouts (ledger.md)."
input PrepareSettlementInput {
  campaign: UUID!
  "The attribution epoch, within the campaign window."
  tStar: Int!
  actAs: UUID
}

extend type Mutation {
  prepareCampaign(input: PrepareCampaignInput!): PreparePayload!
  prepareCampaignAdjustment(input: PrepareCampaignAdjustmentInput!): PreparePayload!
  prepareSettlement(input: PrepareSettlementInput!): PreparePayload!
}
```

### Auth and accounts

The flows are specified in [auth.md](auth.md); this surface
consumes them. Every member arrives through the staged-applicant
flow: a link stages, the inviter's approval is the priced act, the
joiner's own signature grounds the actor
([invitations.md §4](../primitive/invitations.md#4-invite-links-staged-applicants-explicit-approval)).
The genesis member is seeded by the bootstrap around the L1
genesis sequence and never passes through these mutations
([network.md §2](../primitive/network.md#2-creation),
[architecture.md "Genesis bootstrap"](architecture.md#genesis-bootstrap))
— which also seeds the instance's **first** invite link, since
`createInviteLink` requires an authenticated issuer and no account
exists before the genesis member.

Registration creates a real account in the **applicant** state
and returns an ordinary session (`register`); every later step
is session-authorized — there is no applicant token, no parallel
auth surface. The key ceremony is a logged-in step: the device
generates the signing key and L0 address locally and attaches
the public halves (`attachActorKey`) — approval funds a burn to
that address, so the attach is one of the two approvability
proofs (the verified email is the other), and the attached key
is replaceable until approval
([auth.md "Application"](auth.md#application-the-applicant-state)).
Progress is `me`-driven — `User.accountState`,
`User.emailVerified`, `User.application` — and the staged
Registration rides the ordinary staged-write surface: once
approval stages it, the device signs with `submitProposals` /
`approveActs` like any other write. Landing (the Registration
confirming in the mirror) flips the account to `member`; nothing
moves, nothing is claimed. Reciprocation — the joiner's own
Opinion toward the inviter's Profile, completing the mutual
pair — is an ordinary graph act after landing (`prepareStance`),
prompted at first login; auth's involvement ends at landing.

```graphql
"Register through an invite link. Creates the account — the
 actor row (no key yet) and its credentials, in the applicant
 state — records the application against the link, sends the
 verification email, and returns an ordinary session. Pure L2:
 nothing touches L1 (auth.md §Application)."
input RegisterInput {
  inviteLink: UUID!
  handle: String!
  email: String!
  password: String!
  deviceLabel: String
}
"On refusal, userErrors carries one of INVITE_UNUSABLE,
 HANDLE_TAKEN, EMAIL_IN_USE, or WEAK_PASSWORD — all surfaced at
 the form, before any later step."
type RegisterPayload {
  auth: AuthSession
  "When the account expires unless its email is verified (24 h,
   auth.md \"Expiry\")."
  expiresAt: DateTime
}

input VerifyEmailInput { verificationToken: String! }
"ok is false with a VERIFICATION_TOKEN_INVALID userError when the
 token is invalid or the account expired."
type VerifyEmailPayload { ok: Boolean! }

input ResendVerificationEmailInput { email: String! }
"Always succeeds, to avoid revealing whether an account exists."
type ResendVerificationEmailPayload { ok: Boolean! }

"Attach the device-minted actor identity to the viewer's account
 — the key ceremony's server half (auth.md §Application).
 Replaceable while the viewer's application is unapproved;
 FORBIDDEN once approval has bound the address. An address binds
 at most one account: a key already bound to a different account
 refuses with an ACTOR_KEY_IN_USE userError."
input AttachActorKeyInput {
  "The device-generated actor public key (the key never leaves the
   device; this is its public half)."
  actorPubkey: String!
  "The device-generated L0 address — the address approval funds."
  l0Address: String!
}
type AttachActorKeyPayload { user: User }

"Re-arm an expired, never-approved application with a fresh
 invite link — a new application row for the viewer's account
 (auth.md \"Expiry\"). BAD_INPUT while a live application exists;
 INVITE_UNUSABLE for a dead link."
input ApplyWithInviteInput { inviteLink: UUID! }
type ApplyWithInvitePayload { application: Application }

"Approve staged applicants — the inviter's deliberate, priced act:
 per applicant or in batch, with the pre-filled stance values
 adjusted at will. Runs the admission sequence backend-side —
 the funding burn, then the staged Registration — inside the
 approval, guarded so a retried or concurrent approval can never
 double-fund; landing waits only on the Registration confirming.
 Returns the inviter's own Opinion records to sign — the vouch is
 the inviter's signature, not a server write. Approval requires an
 approvable application — email verified and key attached; an
 already-approved, expired, or foreign-queue application refuses
 with BAD_INPUT pinned to its entry."
input ApproveApplicantsInput {
  approvals: [ApplicationApprovalInput!]!
}
input ApplicationApprovalInput {
  application: UUID!
  "The inviter's stance toward the joiner — pre-filled from the
   link, committed here."
  pDirected: Dimension!
  pInterest: Dimension!
}

input LogInInput {
  email: String!
  password: String!
  deviceLabel: String
}

input RefreshSessionInput {
  refreshToken: String!
}

"A fresh access + refresh token pair, the issuing session, and the
 viewer it authenticates — the success result shared by register,
 logIn, and refreshSession. session and user resolve lazily and
 are null only when the row vanished between minting and
 resolution."
type AuthSession {
  accessToken: String!
  refreshToken: String!
  session: Session
  user: User
}

"A session from credentials; auth is null with an INVALID_CREDENTIALS
 userError when the email / password pair did not match."
type LogInPayload {
  auth: AuthSession
  "The pending refresh-token-reuse security event (auth.md 'Reuse
   detection'), delivered exactly once: the detection time on the
   first successful login after a reuse-detected revocation, null
   otherwise and on every refusal."
  reuseDetectedAt: DateTime
}

"A rotated session; auth is null with a REFRESH_TOKEN_INVALID userError
 when the refresh token is invalid, expired, or was already rotated
 (reuse) — a reuse-detected token also revokes every session (auth.md)."
type RefreshPayload { auth: AuthSession }

input RevokeSessionInput {
  "The session to revoke; the current one if omitted."
  session: UUID
}
type RevokeSessionPayload {
  "The revoked session, in its terminal state."
  session: Session
}
type RevokeSessionsPayload {
  revokedCount: Int
}

input RequestPasswordResetInput { email: String! }
"Always succeeds, to avoid revealing whether an account exists."
type RequestPasswordResetPayload { ok: Boolean! }

input ConfirmPasswordResetInput {
  resetToken: String!
  newPassword: String!
}
"An invalid, expired, or already-used reset token is a
 RESET_TOKEN_INVALID userError pinned to resetToken; a weak
 newPassword is WEAK_PASSWORD."
type ConfirmPasswordResetPayload { ok: Boolean }

"Change the password while authenticated. Re-verifies currentPassword,
 breach-checks newPassword, and revokes the account's other sessions."
input ChangePasswordInput {
  currentPassword: String!
  newPassword: String!
}
type ChangePasswordPayload { ok: Boolean }

"Begin an email change. Re-authenticates with currentPassword; the
 server sends a confirmation code to the current address and a
 verification link to newEmail (the two-sided proof, auth.md)."
input RequestEmailChangeInput {
  newEmail: String!
  currentPassword: String!
}
"Always succeeds for a well-formed request, to avoid revealing whether
 newEmail is already registered."
type RequestEmailChangePayload { ok: Boolean! }

"Complete an email change. `code` is either side's proof — the
 code mailed to the current (original) address, or the token from
 newEmail's verification link; either may arrive first. The change
 applies only once both sides have been confirmed."
input ConfirmEmailChangeInput {
  code: String!
}
type ConfirmEmailChangePayload { user: User }

"Change the viewer's handle — L2 account state (the mention
 namespace), not graph or profile payload. Subject to the global
 handle rules: 3–30 chars of [a-z0-9_], case-folded, one namespace
 across kinds; the charset keeps the redacted-user-{uuid} sentinel
 unreachable (auth.md)."
input ChangeHandleInput { handle: String! }
type ChangeHandlePayload { user: User }

"Issue the challenge an upload must spend (auth.md \"Key
 recovery\"). Server-chosen, 32 bytes, live five minutes, one per
 account, spent on use — a client-chosen nonce would let a
 captured upload be replayed verbatim. FORBIDDEN with no actor
 key attached; asking again discards the previous one."
type KeyBackupChallengePayload {
  "The challenge to sign (base64); null with a refusal."
  challenge: String
  expiresAt: DateTime
}

"Upload (or replace) the client-encrypted key-backup blob —
 ciphertext under the device-generated recovery code; the server
 stores what it cannot decrypt (auth.md \"Key recovery\"). One
 blob per account; blobs over 4 KiB refuse as BAD_INPUT.
 Retrieval is the User.keyBackup field: login + code is the
 recovery.

 Authorized by the actor key, not the session: the signature is
 over the challenge bound to these exact blob bytes, verified
 against the account's attached public key. A bad proof is
 SIGNATURE_INVALID and does not spend the challenge; an unknown,
 expired, or already-spent one is CHALLENGE_EXPIRED. Replacing an
 existing blob mails a notice."
input UploadKeyBackupInput {
  blob: String!
  "The challenge this upload spends, from createKeyBackupChallenge."
  challenge: String!
  "The actor key's signature over the challenge and these blob bytes."
  signature: String!
}
type UploadKeyBackupPayload { ok: Boolean }

"Issue a time-gated invite link — single-use or multi-use, the
 issuer's choice — carrying the inviter's PRE-FILLED stance values
 (a suggestion; the approval commits)."
input CreateInviteLinkInput {
  expiresAt: DateTime!
  prefillPDirected: Dimension!
  prefillPInterest: Dimension!
  "One applicant slot when true; many applicants otherwise.
   Defaults to multi-use."
  singleUse: Boolean
  "Act as this Collective; null = the viewer issues."
  actAs: UUID
}
type CreateInviteLinkPayload {
  "The link — its id is the shareable capability."
  inviteLink: InviteLink
}

input RevokeInviteLinkInput { inviteLink: UUID! }
"An unknown, foreign, or already-revoked link refuses with a
 NOT_FOUND userError — the one place NOT_FOUND rides the userError
 tier rather than the transport tier, because a stale share sheet
 makes it an expected outcome, not a client bug."
type RevokeInviteLinkPayload { inviteLink: InviteLink }

"The anonymous pre-registration view of an invite link (the
 `inviteLinkCheck` query) — enough to gate the registration form
 on a usable capability, and to show who is vouching. Holding the
 id is holding the link."
type InviteLinkCheck {
  "Whether the link can stage a new applicant now — live,
   unexpired, unrevoked, and (single-use) its one slot free."
  usable: Boolean!
  "The issuing actor's handle."
  inviterHandle: String!
  expiresAt: DateTime!
}

"Remove the payload of a record the viewer authored — the
 per-content self-service erasure path (erasure.md §1). Immediate
 and permanent: the record drops to its reduced projection with
 the author-removed mark, the original moves to the retention
 archive under its legal hold. The client owns the explicit
 permanence confirmation."
input RemoveContentInput {
  record: RecordId!
  "Also remove every record in the target's revision chain — the
   whole post/comment/profile history. Defaults to false (the
   single record only)."
  includeRevisions: Boolean
}
"The removed record(s), now payloadState: REDUCED."
type RemoveContentPayload { records: [Record!]! }

"Begin account deletion (identity-only by default; opt into
 content-level redaction with includeContent). What remains after
 execution is the L1 husk: structural records, standing, and title
 persist; identity association, display content, and payloads go
 (erasure.md)."
input RequestAccountDeletionInput {
  includeContent: Boolean
}
"Confirming opens the 7-day grace period and fixes the execution
 deadline ([erasure.md §5](../instances/erasure.md#5-the-self-service-triggers))."
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

extend type Mutation {
  register(input: RegisterInput!): RegisterPayload!
  verifyEmail(input: VerifyEmailInput!): VerifyEmailPayload!
  resendVerificationEmail(input: ResendVerificationEmailInput!): ResendVerificationEmailPayload!
  attachActorKey(input: AttachActorKeyInput!): AttachActorKeyPayload!
  applyWithInvite(input: ApplyWithInviteInput!): ApplyWithInvitePayload!
  approveApplicants(input: ApproveApplicantsInput!): PreparePayload!
  logIn(input: LogInInput!): LogInPayload!
  refreshSession(input: RefreshSessionInput!): RefreshPayload!
  "Revoke one session (the current one if no id is given)."
  revokeSession(input: RevokeSessionInput!): RevokeSessionPayload!
  "Revoke every session except the one making the request."
  revokeOtherSessions: RevokeSessionsPayload!
  requestPasswordReset(input: RequestPasswordResetInput!): RequestPasswordResetPayload!
  confirmPasswordReset(input: ConfirmPasswordResetInput!): ConfirmPasswordResetPayload!
  changePassword(input: ChangePasswordInput!): ChangePasswordPayload!
  requestEmailChange(input: RequestEmailChangeInput!): RequestEmailChangePayload!
  confirmEmailChange(input: ConfirmEmailChangeInput!): ConfirmEmailChangePayload!
  changeHandle(input: ChangeHandleInput!): ChangeHandlePayload!
  createKeyBackupChallenge: KeyBackupChallengePayload!
  uploadKeyBackup(input: UploadKeyBackupInput!): UploadKeyBackupPayload!
  createInviteLink(input: CreateInviteLinkInput!): CreateInviteLinkPayload!
  revokeInviteLink(input: RevokeInviteLinkInput!): RevokeInviteLinkPayload!
  removeContent(input: RemoveContentInput!): RemoveContentPayload!
  requestAccountDeletion(input: RequestAccountDeletionInput!): AccountDeletionPayload!
  confirmAccountDeletion(input: ConfirmAccountDeletionInput!): AccountDeletionPayload!
  cancelAccountDeletion: AccountDeletionPayload!
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

extend type Mutation {
  setBookmark(input: SetBookmarkInput!): SetBookmarkPayload!
  removeBookmark(input: RemoveBookmarkInput!): RemoveBookmarkPayload!
  hideActor(input: HideActorInput!): HideActorPayload!
  unhideActor(input: UnhideActorInput!): UnhideActorPayload!
  "Record that the viewer has seen nodes (the feed de-dup signal)."
  markSeen(input: MarkSeenInput!): MarkSeenPayload!
  "Advance the viewer's last-read pointer in a Chat."
  markChatRead(input: MarkChatReadInput!): MarkChatReadPayload!
  setPreferences(input: SetPreferencesInput!): SetPreferencesPayload!
}
```

Bookmarks and hidden-actors have explicit `remove*` verbs because
the "no destructive operation" rule is a *graph* invariant —
private operational state carries no append-only history and no
public visibility, so a remove is a genuine delete of a row, not a
redaction.

### Governance inputs

The write-side mirror of the `Governance` read types. A
`GovernanceInput` is the full social contract supplied at
`prepareChat` / `prepareCollective` (riding the founding payload);
rule amendments travel as `rule`-kind proposal values.

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
