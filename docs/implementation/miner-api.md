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
| `friendAuthorBoost` | Friend-author reorder config — enabled flag, freshness window, placement; null uses the Network default (on). A reordering layer, not a boost multiplier ([feed-ranking.md §5.2](../primitive/feed-ranking.md#52-frontend-reordering-friend-authored-fresh-posts)). |
| `collapseWeights` | Optional `(α, β)` for the tuple→scalar collapse, `score = α·M_s + β·M_c` ([feed-ranking.md §4.3](../primitive/feed-ranking.md#43-tuple-collapse-to-scalar)); default `(1, 1)` = sum. |

These are the `rank` operation's `params`, typed below:

```graphql
"The viewer's ranking parameters — Network-seeded defaults, all
 viewer-tunable. Every field null falls back to the Network default."
input RankParams {
  "Content ids to exclude before ranking (the seen-list)."
  seenList: [UUID!]
  "Rankable node kinds in scope; default Posts only."
  kinds: [NodeKind!]
  "d(R) base; default Network.distanceDecayBase."
  distanceDecayBase: Float
  "f(Δt) half-life; default Network.timeDecayHalfLifeDays."
  timeDecayHalfLifeDays: Int
  "ε path-pruning floor; default Network.dustFloor."
  dustFloor: Float
  "Friend-author reorder config; null uses the Network default (on)."
  friendAuthorBoost: FriendAuthorBoost
  "Tuple→scalar collapse weights; null = sum."
  collapseWeights: CollapseWeights
}

"The friend-authored-fresh-post reorder (feed-ranking.md §5.2) — a
 reordering layer over the ranked output, not a boost multiplier (a
 pre-rank multiplier was considered and rejected there). The only knobs
 are on/off, the authorship-edge freshness window, and where boosted
 posts land."
input FriendAuthorBoost {
  enabled: Boolean!
  "How fresh the author's :AUTHOR edge must be to qualify."
  freshnessThresholdHours: Int
  placement: FriendAuthorPlacement
}

"Where friend-authored fresh posts land relative to the ranked feed."
enum FriendAuthorPlacement { INTERLEAVED ABOVE }

"Per-track weights for the (sentiment, interest) tuple collapse
 (feed-ranking.md §4.3): score = α·M_s + β·M_c. Default (1, 1) = sum;
 product was rejected, since (−)(−)→+ would resurface suppressed paths."
input CollapseWeights { alpha: Float!  beta: Float! }
```

## The operation

```graphql
"Rank the viewer's slice into an ordered feed: slice plus parameters in,
 ordered FeedEntry list out. The logical contract — the runner and the
 wire form are implementation detail (see Transport); the shape is fixed.
 The id sequence of the result is what the backend's `feed` query hydrates."
rank(slice: FeedSlice!, params: RankParams!): [FeedEntry!]!
```

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

## Two runners of one traversal

The path-enumeration this surface runs is the same traversal the backend
runs to settle a campaign ([economics.md §6.5](../primitive/economics.md#65-computation--exact-streaming-oplayers-memory))
— but the two differ in who runs them, what they rank, and how
authoritative the result is.

| | Feed ranking (this doc) | Campaign settlement |
|---|---|---|
| Runner | the viewer's device or a miner | the central backend |
| Authority | advisory — the viewer's device holds final say | authoritative — it moves money |
| Targets | every rankable node in the slice | a single anchor→target pair (the reach gain `h_anchor(target)`) |
| Dust floor `ε` | viewer-tunable, slice-bounding | set per campaign for payability, recorded for reproducibility |

The single-pair, settle-once campaign computation is the tractable case;
its result reads back through the existing `Campaign.achievedHGain` /
`Settlement.achievedHGain` fields ([api-spec.md](api-spec.md)), not a
separate query. Centralizing the *feed* ranking the same way is what does
not scale (per the runner note above) — settlement runs centrally only
because money demands one authoritative figure.

## Transport

The contract above is fixed; where it runs is not, and is expected to
move. The rollout path: first the `rank` operation runs on the **backend
directly** (simplest to exercise against real slices), then in a
**separate miner container** (a delegated service), then **on the viewer's
own device** (the decentralized end state — proving a phone can rank its
own slice). The open wire-level details — how the slice reaches the runner
(re-fetched by the miner vs. forwarded by the device) and miner
authentication — are settled when the miner path is built; none of them
change the slice-in, ordered-list-out shape.
