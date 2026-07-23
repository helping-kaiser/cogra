# ADR-001: Graph Store Selection

**Status**: Accepted
**Date**: 2026-07-22

---

## Context

The graph itself lives on PeerNetworks Layer 1 — every binding
fact is an L1 record, and nothing CoGra stores is authoritative
about topology ([substrate.md §3](../primitive/substrate.md#3-cogras-stores)).
What CoGra needs locally is:

1. **A record mirror** — a queryable copy of the L1 records its
   traversals consume. Pure cache: may lag, never diverges, fully
   rebuildable from the published ordered sequence.
2. **Overlay and operational state** — Proposal state, the
   parameter carrier, role marks; all caches over records and
   published fold rules.
3. **Authoritative L2 state** — display content, identity
   association, applicants, key-custody stores, honor ledgers.

The heavy graph math never runs in a database: the ranking and
attribution algorithm is exact greedy disjoint-path extraction
([feed-ranking.md](../primitive/feed-ranking.md)), implemented
once in the `ranker` crate for backend, miner, and device. What a
store contributes to traversal is only **slice extraction**:
hop-by-hop frontier expansion from the viewer, bounded by the dust
floor χ.

---

## Decision

**PostgreSQL only. No graph database in the stack.**

The record mirror, the overlay, and all L2 state live in one
Postgres instance ([data-model.md](data-model.md)); frontier
expansion runs in Rust over indexed record tables — each hop is
one indexed batch query, and χ-bounding shrinks the frontier fast.

Reasoning:

- **Nothing a graph store would hold is authoritative.** Every
  candidate row is a rebuildable cache, so a second database
  would be pure operational weight — backups, sync bookkeeping,
  version pinning, a second query language — purchased for query
  convenience alone.
- **The math doesn't live in a store.** Path extraction, pair
  folds, and eligibility cones are `ranker`/backend code over raw
  records regardless of storage engine; a graph engine would
  accelerate only the slice queries, which indexed SQL serves at
  the current design scale.
- **At the far end, neither engine survives anyway.** The
  large-scale design point is miner-sharded, epoch-incremental
  computation ([economics.md](../primitive/economics.md)) — not a
  bigger central database of either kind.
- **One store, one operational surface.** SQL fluency, one
  backup/migration story, and the L2 truth tables were in
  Postgres in every considered design.

---

## Alternatives Considered

### Option A: A graph database as the traversal cache (Memgraph)

Memgraph (openCypher, bolt via `neo4rs`) serves multi-hop
expansion natively — index-free adjacency instead of per-hop
index lookups — and ships a visual explorer (Memgraph Lab).

**Rejected for now:** the mirror-as-cache role removes every
durability argument, leaving only traversal speed the current
scale does not yet need, at the cost of operating and
synchronizing a second engine. Because the mirror is a pure
cache, this door stays open at zero architectural cost: a graph
store can be added later *as a cache in front of the record
tables* without touching where truth lives. That is the
escalation path if slice extraction ever dominates.

### Option B: No local copy — query the L1 store directly

**Rejected:** L1 is an external network; per-request remote
queries cannot serve feed extraction, folds, or campaign sweeps,
and every chain consumer keeps a local index for exactly this
reason. The mirror *is* that index.

### Option C: In-memory graph service built from Postgres

A dedicated process holding the record graph in memory for slice
queries. **Deferred, not rejected** — this is what Option A's
escalation would compete against if slice extraction becomes the
bottleneck. Building it now would be optimizing ahead of data.

---

## Consequences

- SQL is the only query language in the stack; all SQL lives in
  `postgres-store`.
- Slice extraction is hop-by-hop frontier expansion in Rust over
  the mirror's indexes ([architecture.md](architecture.md)).
- Graph-visual product features (profile neighborhoods, a
  walk-the-graph explorer) are served by ordinary neighborhood
  queries — one or two hops around a focal node — and rendered
  client-side; they need no graph engine.
- If slice extraction ever dominates, the escalation is a pure
  traversal cache (Option A or C) added in front of the record
  tables — an operational change, not an architectural one,
  because nothing authoritative moves.
