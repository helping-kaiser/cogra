# Miner API

The ranking surface. The backend API ([api-spec.md](api-spec.md))
deliberately does not rank: it serves each viewer their weight-bounded
subgraph slice (`Query.feedSlice`) and hydrates an ordered id list back
into a feed (`Query.feed`). Between those two calls sits **ranking**, and
ranking runs off the backend's hot path — on the viewer's own device or a
delegated miner ([feed-ranking.md §9](../primitive/feed-ranking.md)). This
doc specifies that intermediate surface: slice in, ordered list out.

- **Runner**: the viewer's device (default) or a chosen miner.
- **Never the central backend.** Ranking is per-viewer and personalized;
  it does not scale as a central realtime service, and centralizing it
  would route the graph's signal through one party.

---

## The contract

```
          feedSlice                rank                feed(orderedIds)
 viewer ──────────────► backend ─► device/miner ─► backend ──────────────► feed
          (subgraph)               (ordered ids)     (hydrated nodes)
```

A ranker consumes a `FeedSlice` (nodes + the edges among them, per
api-spec.md) plus the viewer's ranking parameters, computes the four
metrics per candidate target, orders the candidates, and returns the
ordered id list. The viewer hands that list to the backend's `feed` query
for display hydration.

The ranker never writes to the graph and holds no authority the backend
lacks: the slice it reads is the same public subgraph any client could
fetch, and the ordering it returns is advisory — the viewer's device holds
final authority over filters and presentation
([feed-ranking.md §9](../primitive/feed-ranking.md)).

## Inputs

The ranking parameters (per [feed-ranking.md §8](../primitive/feed-ranking.md)),
all viewer-tunable over the Network-seeded defaults:

| Parameter | Role |
|---|---|
| `seenList` | Content ids to exclude from the candidate set before ranking. |
| `kinds` | Which rankable node kinds are in scope (default: Posts only). |
| `distanceDecayBase` | `d(R)` base; default from `Network.distanceDecayBase`. |
| `timeDecayHalfLifeDays` | `f(Δt)` half-life; default from `Network.timeDecayHalfLifeDays`. |
| `dustFloor` | `ε` path-pruning floor; default from `Network.dustFloor`. |
| `friendAuthorBoost` | Whether the friend-author reorder is applied (default on). |
| `collapseWeights` | Optional `(α, β)` for the tuple→scalar collapse (default: sum). |

## Output

An ordered list of `FeedEntry` — the ranked targets, each carrying the
four metrics and (on demand) the contributing paths. The id sequence is
what the backend `feed` query consumes; the metrics and paths are the
ranker's explanation of the order, surfaced for inspection and never read
back by the backend.

```graphql
"One ranked target in the viewer's feed, with the ranker's per-target
 explanation. The target id feeds the backend's `feed` hydration."
type FeedEntry {
  "The ranked target node — any rankable node kind."
  target: Node!
  "The four per-target ranking metrics from the viewer's vantage."
  metrics: RankMetrics!
  "The contributing paths, with intermediates and per-path contribution.
   A drill-down — expensive, computed only when selected."
  paths: [RankPath!]!
}

"The four ranking metrics (feed-ranking.md §4.2). Personal metrics use
 distance decay d(R); absolute metrics are global to the target. Each is
 the sort-time scalar collapse of its underlying (sentiment, interest)
 tuple."
type RankMetrics {
  "h — personal opinion."
  h: Float!
  "i — personal reach."
  i: Float!
  "j — absolute opinion."
  j: Float!
  "k — absolute reach."
  k: Float!
}

"One path from the viewer to the target, with its intermediates."
type RankPath {
  "Ordered nodes, viewer → … → target."
  nodes: [Node!]!
  "Edges traversed, parallel to the node sequence."
  edges: [Edge!]!
  "Path length R (hop count)."
  distance: Int!
  "This path's contribution, distance- and time-decayed: d(R) · f(Δt)."
  contribution: Float!
}
```

`Node`, `Edge`, and the scalars are the [api-spec.md](api-spec.md) types —
the ranker speaks the same type vocabulary as the backend it sits beside.

## Transport

Not yet pinned. The ranker may run in-process on the device (no wire
protocol) or as a delegated miner service; the query shape, how the slice
is passed (re-fetched by the miner vs. forwarded by the device), and miner
authentication are deferred until the miner path is built. The fixed part
is the contract above — slice + parameters in, ordered `FeedEntry` list
out.
