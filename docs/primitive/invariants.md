# Invariants

A discoverable index of the load-bearing invariants of the CoGra
protocol. Each entry is one line — a short statement and a link to
the section that owns the rule. **The linked section is canonical**
(every rule below is tagged in its owning doc as `**Invariant**`);
this file is a pointer, not a restatement.

An entry earns its place only if the rule recurs across multiple
docs and binds the protocol as a whole; a rule that matters to one
doc alone lives there, untagged and unindexed.

Grep-able: `grep -ri "\*\*Invariant" docs/` finds every call-out
the entries below link to.

Themes are a curator's grouping, not part of the protocol. An
invariant load-bearing under multiple themes is listed under the
most useful one.

---

## Topology and visibility

- [One actor type behind User and Collective](nodes.md#2-accounts-user-and-collective)
  — every account resolves to one grounded Actor + Profile pair;
  L1 has no account types; "active member" and "voter" are scoped
  subsets, never instance-free.
- [Records are directional](graph-model.md#1-core-principles) —
  `A → B` and `B → A` are independent records; nobody can create
  an edge *from* you.
- [Uniform two-parameter grammar](edges.md#1-the-edge-record-and-cogras-two-axes)
  — every record carries the same two user parameters
  `(p_d, p_i)`; domain, mask, and tier are family-fixed by the
  census, never per-edge choices.
- [Parallel records are unrestricted; "current" is a declared fold](graph-model.md#3-revision-and-current-state)
  — the append layer never rejects, merges, or supersedes a
  same-author record; every current-state read names its fold.
- [Inbound records don't affect the receiver's feed](graph-model.md#5-directionality-and-influence)
  — anti-bot foundation; only outgoing records, walked forward,
  shape a feed.
- [Topology is always public](graph-model.md#1-core-principles) —
  privacy of content is payload custody and E2EE, never hidden
  nodes or records; chat topology included, only message bodies
  can be encrypted.
- [One store, partitioned by truth relationship](../implementation/architecture.md#2-one-store-partitioned-by-truth-relationship)
  — what a record *is* lives on L1; what it *shows* lives in
  Postgres; what it *weighs* is recomputed from records.

## State and lifecycle

- [No record is ever removed from the shared graph](layers.md#5-deletion-policy)
  — the only permitted transition is whole-record payload
  reduction; the structural record persists; absolute.
- [No silent deletion](layers.md#5-deletion-policy) — every
  redaction (graph-side or Postgres-side) leaves a visible mark.
- [Redaction ≠ severance](layers.md#redaction-vs-severance--two-different-vocabularies)
  — redaction removes content, whole-record; severance is the
  author netting their own bundle to `(0,0)` — content untouched,
  routing-inert for every consumer of the standing projection.
- [Authorship is intrinsic](authorship.md) — `author(e)` is part
  of the act identity: never derived, never an edge, no
  earliest-incoming-edge rule.
- [No User node before verification](user.md#2-creation) — the
  graph has no "unverified" or "pending" User state; accounts
  either exist with full standing or they don't.
- [Title is consume-only](../instances/items.md#3-ownership-and-title)
  — the current owner is the certificate lookup `owner^(k)`,
  never a traversal, never a CoGra-stored fact; the ownership
  thread is append-only public history.
- [No parallel co-ownership of an Item](../instances/items.md#8-shared-ownership-routes-through-a-collective)
  — `owner^(k)` maps each Item to one actor; sharing routes
  through a Collective.

## Authority and gates

- [Out-of-graph authority is confined to instance bootstrap](network.md#2-creation)
  — the bootstrap is the only write that escapes the
  actor-gesture-or-governance rule.
- [Mod weight = member weight = 1; mod is a gate, not a weight](governance.md#7-the-mod-gate)
  — uniform across content moderation, moderator role changes,
  and `:Network` parameter amendments.
- [No per-edge record of the acting member](../instances/collectives.md#4-acting-through-the-collective)
  — accountability lives in the social contract, not in edge
  attribution. Deliberate non-feature.

## Ranking

- [Ranking comes only from the graph](../implementation/architecture.md#4-all-ranking-comes-from-the-graph)
  — no materialized counters, popularity scores, or ML signals;
  the feed is computed at query time from viewer-rooted forward
  paths over L1 records.
- [Zero is inert](feed-ranking.md#31-the-damped-weight) — if
  either effective parameter is zero, `w̃(e) = 0` and the edge
  carries no path; nothing downstream revives a dead hop.
- [Feed traversal is forward-only](feed-ranking.md#4-the-path-set)
  — paths follow records in their stored direction;
  inbound-inert is one consequence.
- [Every hop attenuates](feed-ranking.md#2-inputs) — `w̃ < 1`
  everywhere, so path products shrink with depth and loops die by
  construction; no separate simple-path rule is needed.
- [Exactly two channels cross a T-leg](feed-ranking.md#4-the-path-set)
  — content-intrinsic or initiator-owned; a stranger's reference
  or tag reaches its target only through its own author.
- [Types are sinks](feed-ranking.md#4-the-path-set) — rankable
  targets, never transit; every path reaching a Type ends there.
- [The `bot-defense` Type name is reserved](feed-ranking.md#86-community-evidence)
  — seeded at genesis; its semantic role is platform-defined, not
  emergent from first use.

## Economics

- [No AI in the economics](economics.md#economics) — reach
  measurement, attribution, and payout are graph-computed (Shapley
  over the path-sum), never a learned "fair share".
- [The token never feeds ranking](token.md#token-cgt) — neither CGT
  balance nor token activity is an input to feed-ranking; the token is
  a pure settlement layer.
- [Campaign payout and feed-default ranking use the same path-weight formula](economics.md#economics)
  — an advertiser buys reach into the feeds around the anchor, so the
  success metric and the payout weight are the default feed formula;
  per-viewer personal layers never enter the payout sum.
- [Money never rides L1](economics.md#3-the-campaign-record) —
  amounts live on the rails (L0 admission money, CGT reward
  money); the graph carries pointers, never amounts.

---

## How to extend this index

When adding a new invariant:

1. Check it earns indexing: the rule must recur across multiple
   docs and bind the protocol as a whole.
2. Tag it in the owning doc with a `**Invariant:** ...` line at
   the most contextually relevant spot. The owning doc is
   canonical — write the full statement and the "why" there.
3. Add one line to the matching theme above: a short version of
   the statement and a link with the anchor. **Do not duplicate
   prose** — the index is a pointer.

If an invariant is genuinely cross-cutting (e.g. an edge-grammar
property that lives in `edges.md` but is invoked by every
cluster doc), pick a single canonical home and have other docs
cross-reference it. The index lists each invariant exactly once.
