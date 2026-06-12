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
| `dustFloor` | `ε` floor — bounds the slice node-set (and prunes paths in the sparse enumeration regime); default from `Network.dustFloor`. |
| `friendAuthorReorder` | Friend-author reorder config — enabled flag, freshness window, placement; null uses the Network default (on). A reordering layer, not a boost multiplier ([feed-ranking.md §5.2](../primitive/feed-ranking.md#52-frontend-reordering-friend-authored-fresh-posts)). |
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
  "ε floor — bounds the slice node-set (and prunes paths in the sparse
   enumeration regime); default Network.dustFloor."
  dustFloor: Float
  "Friend-author reorder config; null uses the Network default (on)."
  friendAuthorReorder: FriendAuthorReorder
  "Tuple→scalar collapse weights; null = sum."
  collapseWeights: CollapseWeights
}

"The friend-authored-fresh-post reorder (feed-ranking.md §5.2) — a
 reordering layer over the ranked output, not a boost multiplier (a
 pre-rank multiplier was considered and rejected there). The only knobs
 are on/off, the authorship-edge freshness window, and where reordered
 posts land."
input FriendAuthorReorder {
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
   A drill-down — a separate bounded enumeration for one target, distinct
   from the message-passing that produces the order; expensive, computed
   only when selected."
  paths: [RankPath!]!
}

"The four ranking metrics (feed-ranking.md §4.2). Personal metrics use
 distance decay d(R); absolute metrics are global to the target. Each is
 the sort-time scalar collapse of its underlying (sentiment, interest)
 tuple."
type RankMetrics {
  "h — personal opinion."
  h: Float!
  "i — personal reach (drops the reactor edge's own value; f(Δt) still anchors on it)."
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

This surface and campaign settlement ([economics.md §6.5](../primitive/economics.md#65-computation--exact-streaming-oplayers-memory))
share the §3 path semantics but not the algorithm at scale. Feed ranking is
**all-targets**: in the dense regime it is computed by message-passing over
the slice ([feed-ranking.md §4.5](../primitive/feed-ranking.md#45-computing-the-metric--message-passing-over-the-slice)),
not path enumeration. Campaign settlement is a **single anchor→target pair**
computed once, where direct enumeration stays tractable. The two also differ
in who runs them, what they rank, and how authoritative the result is.

| | Feed ranking (this doc) | Campaign settlement |
|---|---|---|
| Runner | the viewer's device or a miner | the central backend |
| Authority | advisory — the viewer's device holds final say | authoritative — it moves money |
| Targets | every rankable node in the slice | a single anchor→target pair (per-path Shapley split toward the reach gain `h_anchor(target)`) |
| Dust floor `ε` | viewer-tunable, slice-bounding | set per campaign for payability, recorded for reproducibility |

The single-pair, settle-once campaign computation is the tractable case;
its result reads back through the existing `Campaign.achievedHGain` /
`Settlement.achievedHGain` fields ([api-spec.md](api-spec.md)), not a
separate query. Centralizing the *feed* ranking the same way is what does
not scale (per the runner note above) — settlement runs centrally only
because money demands one authoritative figure.

## The §3.8 operations

The post-severance surfaces of
[feed-ranking.md §3.8](../primitive/feed-ranking.md#38-post-severance-surfaces)
are client- or miner-computed derivations over existing graph state.
Their data is reachable through the generic read surface; the dedicated
contracts exist so frontends and miners code against pinned shapes
instead of each re-deriving the math from prose. All three follow
`rank`'s rules: reads over public state, the same transport and
delegation model (the remote runner fetches what it needs; private
inputs, where any exist, are pushed), stateless and polled — the runner
holds no watch lists and sends no notifications. The operations return
structural facts; scores, prominence, thresholds, and action guidance
are frontend-computed
([feed-ranking.md §3.8](../primitive/feed-ranking.md#38-post-severance-surfaces),
"frontend latitude").

### `severanceStatus` — the inbound self-query (§3.8.1)

```graphql
"The viewer's own inbound severance state plus their outbound audit
 material (feed-ranking.md §3.8.1). An explicit self-query — inbound
 edges are never in the feed pull."
severanceStatus(viewer: UUID!): SeveranceStatus!

"The two §3.8.1 surfaces: the severance pattern and the audit list."
type SeveranceStatus {
  "Inbound edges with top-of-stack (0, 0), one entry per severer."
  severances: [InboundSeverance!]!
  "The viewer's outbound edges with creation metadata — the audit
   material, reviewed with the severance pattern as context."
  outboundAudit: [AuditedEdge!]!
}

"One inbound severance, carrying the per-edge weighting §3.8.1
 derives from the viewer's reciprocal outbound edge."
type InboundSeverance {
  severer: Actor!
  "The severance layer's timestamp."
  severedAt: DateTime!
  "True when the viewer's outbound edge to the severer has non-(0, 0)
   top-of-stack — the severer is in the viewer's network, the strong
   per-edge signal. False entries signal in volume, not individually."
  fromTrustedNetwork: Boolean!
}

"An Edge plus its first-layer timestamp. Edge already carries the
 top-of-stack values, layer count, and top-layer timestamp; creation
 time is the one stack-derived fact it lacks. Full history reads via
 edgeHistory (api-spec.md)."
type AuditedEdge {
  edge: Edge!
  "The first layer's timestamp — when the relationship began."
  createdAt: DateTime!
}
```

### `clusterAnalysis` — delta-funnel auto-detection (§3.8.2)

```graphql
"Delta-funnel detection over the viewer's outbound subgraph
 (feed-ranking.md §3.8.2): suspect bridges with the structural inputs
 to the frontend's score. The score formula is frontend-computed; the
 operation reports facts, not verdicts."
clusterAnalysis(viewer: UUID!, dustFloor: Float): [SuspectBridge!]!

"One suspect bridge with the score inputs §3.8.2 names: delta-funnel
 purity and the alternative-paths check."
type SuspectBridge {
  bridge: Node!
  "Fraction of the viewer's paths into the subgraph behind the bridge
   that pass through it; 1.0 is the pure delta-funnel."
  deltaFunnelPurity: Float!
  "The alternative-paths check over sampled downstream content: how
   many sampled targets had no path avoiding the bridge. Equal to
   sampleSize means no alternative route was found anywhere — the
   bot-bridge signature; even one alternative path marks a legit hub."
  isolatedSamples: Int!
  sampleSize: Int!
  "The viewer's paths to the bridge — the drill-in material. Path
   length drives the frontend's hop-count action guidance (§3.8.2)."
  paths: [RankPath!]!
}
```

The traversal is bounded the same way ranking is — `dustFloor` (null
falls back to `Network.dustFloor`) bounds the analyzed subgraph, and
the alternative-paths check is the 1–2 hop bounded probe §3.8.2
specifies.

### `redemptionCheck` — the polled outbound watch (§3.8.4)

```graphql
"The severer's redemption check over severed accounts
 (feed-ranking.md §3.8.4). Stateless and polled: the watch list and
 cadence live client-side, passed as `targets` per call; `since`
 scopes the change report. The severer's identity never enters the
 math — the analysis runs from each target's own subgraph
 perspective. Self-redemption posts (§3.8.5) read through the
 generic read surface, not this operation."
redemptionCheck(targets: [UUID!]!, since: DateTime): [RedemptionStatus!]!

"One severed account's redemption state — binary per §3.8.4: no
 remaining suspect bridges (redeemed) or some (still bridging).
 There is no halfway-redeemed state."
type RedemptionStatus {
  target: Actor!
  redeemed: Boolean!
  "The remaining suspect bridges on the target's positive outbound
   edges, each classified by the §3.8.2 analysis run from the
   target's perspective. Empty exactly when redeemed."
  bridges: [SuspectBridge!]!
  "The target's outbound edges with a new top layer since `since` —
   the change feed the severer reviews against the full layer
   history (edgeHistory). Null `since` returns the full outbound
   audit; the restore decision is made against the complete record."
  activity: [AuditedEdge!]!
}
```

## Transport

The contract above is fixed; where it runs moves along a rollout
path: first the `rank` operation runs on the **backend directly**
(simplest to exercise against real slices), then in a **separate miner
container** (a delegated service), then **on the viewer's own device**
(the decentralized end state — proving a phone can rank its own
slice). No stage changes the slice-in, ordered-list-out shape.

### Wire form — GraphQL everywhere, in-process on-device

A remote runner serves a small GraphQL schema: the operations in this
doc and the types above, verbatim. `FeedSlice`, `RankParams`, and
`FeedEntry` travel as written — the ranker already speaks the
backend's type vocabulary, and a second wire encoding (JSON-RPC,
protobuf) would be a parallel serialization of the same types, kept in
lockstep by hand. The backend-direct rollout stage hosts the same
operations in the backend's own schema; on the viewer's device the
contract is an in-process call over the same types, no wire at all.

### The slice path — the miner re-fetches

The remote wire signature replaces the slice argument with the viewer:

```graphql
rank(viewer: UUID!, params: RankParams!): [FeedEntry!]!
```

Reads are unauthenticated and `feedSlice` is viewer-parameterized
([api-spec.md](api-spec.md)), so the miner fetches
`feedSlice(viewer, params.dustFloor)` itself — the same public
subgraph any client could fetch. The device never downloads the slice;
saving that transfer, alongside the ranking compute, is the point of
delegating. The logical contract is unchanged: the miner obtains the
slice and runs `rank(slice, params)` exactly as pinned above, which is
also the form the in-process on-device call uses directly.

## Delegation and trust

### Push model — no standing credential

The viewer's private inputs — the seen-list and the rank params — ride
inside each request. The miner holds no credential and no standing
state, and never authenticates to the backend: to the backend, a miner
is indistinguishable from any anonymous reader, and
[auth.md](auth.md) manages no delegation tokens. Revocation is
symmetric — the viewer stops calling; there is nothing to revoke
server-side.

When the seen-list lives backend-side (`user_view_log`, the central
frontend's default —
[feed-ranking.md §8.2](../primitive/feed-ranking.md#82-storage--wherever-the-viewing-user-prefers)),
the device fetches it under its own session and forwards it as
`params.seenList`. The forwarding cost is accepted: it keeps the miner
credential-free, and a client that wants to avoid it can keep the
seen-list locally — the math is the same regardless of where the JSON
came from.

### Result integrity — advisory, spot-checkable, not attested

The ordering is advisory — the viewer's device holds final authority
over filters and presentation — and the math is deterministic over
pinned inputs, so the device can re-rank any handful of targets
locally and compare. The contract mandates no audit and carries no
attestation: a lazy or dishonest miner produces a visibly wrong feed,
and the remedy is switching miners. Nothing a miner returns is written
to the graph, so a bad ranking costs the viewer one feed render, not
state.

### Out of scope — miner selection and incentives

How a viewer finds a miner is an out-of-band configuration choice (a
URL the viewer points their client at), and miner incentives are
deliberately unaddressed — nothing in the rollout path needs them.
Revisit if someone actually wants to operate a paid miner.
