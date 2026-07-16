# Graph Model

How graph state behaves across the substrate: the record model,
time and causality, revision, what "current state" means,
directionality, and the dynamics between the shared graph and
CoGra's own stores. The node and edge catalogs live in
[nodes.md](nodes.md) and [edges.md](edges.md); the L2-on-L1 flow in
[substrate.md](substrate.md); the binding mechanics in
[layer1-interface.md](layer1-interface.md).

---

## 1. Core principles

- **Directional.** Every record runs from its author toward a
  target; `A → B` and `B → A` are independent records, and one
  never implies the other. A friendship is two records; an
  unreciprocated stance is one. Directedness is what prevents
  unilateral influence fabrication — nobody can create an edge
  *from* you.
- **Append-only chronicles.** The record set only grows. No record
  is ever deleted, merged, superseded, or rewritten; the only
  one-way transition is payload reduction
  ([substrate.md §7](substrate.md#7-payload-carriage)). The store
  holds chronicles, never state — every notion of "current" is a
  declared read rule over the records (§3).
- **Public.** The shared graph is continuously readable by anyone,
  without an account — an L1 substrate guarantee, not a CoGra
  choice. Accounts gate participation in CoGra's service, never
  viewing. Privacy of content is payload custody and E2EE;
  topology is always public.
- **Priced.** Every act debits its author's balance by θ at
  write time — one θ, one stamp per act, however many leg records
  a hyper-edge decomposes into — and capacity *is* the balance.
  There is no free write: spam has a floor price, and authoring
  is always attributable
  ([substrate.md §6](substrate.md#6-authoring-path-and-admission)).

---

## 2. Time, causality, maturity

Records carry **causal time, not wall-clock time**. Each record's
local time `T_e` is a Lamport clock over shared endpoints and
asserted parents; the causal order `≺` is its transitive closure,
and records it doesn't relate are concurrent. Two participants
holding the same record set derive the same order — there is no
server clock to trust.

Each record also carries a **maturity** scalar `τ_e` — how
established the endpoints already were when the record landed —
which feeds the damped weight `w̃(e)` together with the boundary
factor. Fresh corners of the graph weigh differently than
established ones, by published formula
([layer1-interface.md §8.2](layer1-interface.md#82-temporal-structure)).

Wall-clock time exists only on CoGra's side of the seam — Postgres
operational timestamps for display ("posted 2h ago") and service
logic. It never orders the shared record set.

---

## 3. Revision and current state

Revising a stance never edits anything: it **appends a parallel
record** to the author's bundle toward the same target — the
bundle is a `≺`-chain, the full history public by construction.

What "current" means is always a declared fold:

- **L1 reads bundles in exactly two places.** The standing
  projection nets each same-author bundle by sum-then-clip before
  endorsement flow, and the title fold reads settlement records
  epoch-quantized. Nothing else on L1 consumes a bundle.
- **Every other current-state read is its consumer's declared
  rule.** CoGra declares its folds per surface: the current
  profile is the newest Registration payload; chat membership is
  the membership fold
  ([substrate-map.md §4](substrate-map.md#4-conversations-and-membership));
  the effective network parameters are the newest finalization per
  parameter on the network charter anchor. What the feed reads is
  declared in the published ranking spec
  ([feed-ranking.md](feed-ranking.md)).

Sum-then-clip gives revision real weight: walking back accumulated
conviction costs counter-records in proportion to it — flip-flops
are expensive, stance is sticky. Severance is the limit case:
counter-records netting a bundle to `(0,0)` make it routing-inert
for every consumer of the projection, and each counter-record is
itself a priced act.

---

## 4. Stances, not events

Records originate only in **explicit, deliberate gestures** — an
actor taking a position toward a node. The graph encodes stances:
relationships, opinions, commitments. It never encodes session
events:

- scrolling, dwell time, hover, read time;
- opening a post or a chat, however often;
- search queries;
- sharing content externally (a frontend event, not a stance);
- bookmarking — private per-user state, off-graph by design.

The frontend keeps session data local; nothing becomes graph state
unless the actor gestures in response. What was once enforced by
ethos alone is now also enforced by structure: authoring is
backend-mediated and every act costs its author θ — CoGra's
backend has no write path for implicit signals, and a frontend
that converted views into records would drain its users' capacity
for noise.

Why this matters is unchanged: the graph is not a surveillance
log; every record corresponds to something its author consciously
did; bots get no invisible channel — influence requires visible,
priced, attributable records.

---

## 5. Directionality and influence

Two influence channels exist, and they must never be conflated:

- **The feed is outbound-only.** Only outgoing records from the
  viewing user, walked forward, shape that user's feed — inbound
  records toward the user contribute nothing. A swarm pointing ten
  thousand stances at you appears in *their* feeds, never in
  yours. This is CoGra feed policy, stated in the published
  ranking spec ([feed-ranking.md](feed-ranking.md)).
- **Standing is inbound — and gates writing, never ranking.**
  Vouch-positive stances toward a person *do* lift that person's
  standing `α_i` through L1's endorsement flow; standing feeds the
  write gate and nothing else. It is a write-admission scalar:
  who may act, never what anyone sees.

The old one-liner survives with its scope made precise: inbound
records never shape your feed; they can vouch you through the
gate.

---

## 6. The mirror and the overlay

CoGra's Memgraph holds two kinds of state with two different
truth relationships
([substrate.md §3](substrate.md#3-cogras-stores)):

- **The mirror** caches L1 records for traversal. It may lag the
  shared record; it must never diverge from it. Truth is the L1
  record and the epoch certificate — every binding value the
  mirror holds is recomputable from published records, so a
  distrusting participant can audit CoGra's reads without CoGra's
  help.
- **The overlay** is CoGra's own truth: Proposal machinery, the
  `:Network` operational singleton, collective-membership
  junctions. Overlay nodes carry **layered
  properties** — the append-only history pattern, applied where
  CoGra owns the store. Overlay state never enters any L1
  quantity.

One CoGra flow typically writes all three stores: the L1 gesture
is submitted through the backend, the mirror converges on the
accepted record, and the overlay and Postgres carry the flow's
CoGra-side state
([substrate.md §4](substrate.md#4-the-gesture-pattern)). The
gesture is the part that binds; everything else is CoGra's to
rebuild from the record if it is ever lost.
