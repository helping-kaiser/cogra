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

- **Invariant: directional.** Every record runs from its author
  toward a target; `A → B` and `B → A` are independent records, and one
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
- **Invariant: public.** The shared graph is continuously readable by anyone,
  without an account — an L1 substrate guarantee, not a CoGra
  choice. Accounts gate participation in CoGra's service, never
  viewing. Privacy of content is payload custody and E2EE;
  topology — chat topology included — is always public.
- **Priced.** Every act debits its author's balance by θ at
  write time — one θ, one stamp per act, however many leg records
  a hyper-edge decomposes into — and capacity *is* the balance.
  There is no free write: spam has a floor price, and authoring
  is always attributable
  ([substrate.md §6](substrate.md#6-authoring-path-and-admission)).

---

## 2. Time, causality, maturity

Records carry **causal time, not wall-clock time**. Each accepted
**act** is a Lamport event over its endpoints, asserted parents,
and declared dependencies, and the host publishes one
authoritative order `𝒬_k` that totalizes concurrent acts — every
record inherits its act's logical time, and `≺` means precedence
in that published order
(`def:graph:authoritative-act-order`). Two participants holding
the same published order derive the same result; agreement on the
order, not merely the record set, is what replay consumes — there
is no server clock to trust.

Each record also carries a **maturity** scalar `τ_e` — how
established the endpoints already were when the record landed —
which feeds the damped weight `w̃(e)` together with the boundary
factor. Fresh corners of the graph weigh differently than
established ones, by published formula
([layer1-interface.md §8.3](layer1-interface.md#83-temporal-structure)).

Wall-clock time never orders the shared record set. CoGra keeps
it as Postgres operational timestamps for display ("posted 2h
ago") and service logic.

---

## 3. Revision and current state

Revising a stance never edits anything: it **appends a parallel
record** to the author's bundle toward the same target — the
bundle is a `≺`-chain, the full history public by construction.

**Invariant: parallel records are unrestricted; "current" is a
declared fold.** The append layer never rejects, merges, or
supersedes a same-author record
(`ax:graph:parallel-authored-acts`); every current-state read
names the fold it applies.

What "current" means is always a declared fold:

- **L1 reads bundles in exactly two places.** The standing
  projection nets each same-author bundle by sum-then-clip before
  the safe standing flow `W_end`, and the title fold reads
  settlement records epoch-quantized. Nothing else on L1 consumes a bundle.
- **Every other current-state read is its consumer's declared
  rule.** CoGra declares its folds per surface: the current
  profile is the newest Registration payload; chat membership is
  the membership fold
  ([substrate-map.md §4](substrate-map.md#4-conversations-and-membership));
  the effective network parameters are the newest finalization per
  parameter on the network charter anchor; a node's updatable
  values are the newest eligible update record's payload
  ([substrate.md §9](substrate.md#9-node-values-and-updates)). What the feed reads is
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
unless the actor gestures in response. The rule is enforced by
structure, not ethos alone: every record carries its author's own
signature and costs its author θ — an implicit signal has no path
into the graph unless the actor's key deliberately signs it, and a
frontend that converted views into records would drain its users'
capacity for noise.

The stakes: the graph is not a surveillance log; every record
corresponds to something its author consciously did; bots get no
invisible channel — influence requires visible, priced,
attributable records.

---

## 5. Directionality and influence

Two influence channels exist, and they must never be conflated:

- **Invariant: the feed is outbound-only.** Only outgoing records from the
  viewing user, walked forward, shape that user's feed — inbound
  records toward the user contribute nothing. A swarm pointing ten
  thousand stances at you appears in *their* feeds, never in
  yours. This is CoGra feed policy, stated in the published
  ranking spec ([feed-ranking.md](feed-ranking.md)).
- **Standing is inbound — and gates writing, never ranking.**
  Eligible vouches toward a person *do* move that person's
  standing `α_i` through L1's standing projection — lifting when
  the voucher's rate exceeds the target's standing, diluting
  otherwise (`prop:epoch:final-standing-bidirectional-response`);
  standing feeds the write gate and is freely readable
  downstream — but it never enters the feed: who may act, never
  what the feed shows.

In one line: inbound records never shape your feed; they can
vouch you through the gate.

---

## 6. The mirror and the overlay

CoGra's own store holds two kinds of graph-shaped state with two
different truth relationships
([substrate.md §3](substrate.md#3-cogras-stores)):

- **The mirror** caches L1 records for traversal. It may lag the
  shared record; it must never diverge from it. Truth is the L1
  record and the epoch certificate — every binding value the
  mirror holds is recomputable from published records, so a
  distrusting participant can audit CoGra's reads without CoGra's
  help.
- **The overlay** is a set of operational caches derived from L1
  records by CoGra's published fold rules: Proposal tally state
  and the network charter's parameter carrier
  ([network.md](network.md)). Overlay state carries **layered
  properties** — the append-only history pattern at per-property
  granularity — but the records and the published rules are the
  truth: every cached value is rebuildable by replaying the folds.
  Overlay state never enters any L1 quantity.

One CoGra flow typically writes all three kinds of state: the L1 gesture
is submitted through the backend, the mirror converges on the
accepted record, and the overlay caches and display content carry
the flow's CoGra-side state
([substrate.md §4](substrate.md#4-the-gesture-pattern)). The
gesture is the part that binds; everything else is CoGra's to
rebuild from the record if it is ever lost.
