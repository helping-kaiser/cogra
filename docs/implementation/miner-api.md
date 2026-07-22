# Miner API

The ranking surface. The backend API ([api-spec.md](api-spec.md))
deliberately does not rank: it serves each viewer their `χ`-bounded
subgraph slice (`Query.feedSlice`) and hydrates an ordered id list back
into a feed (`Query.feed`). Between those two calls sits **ranking**, and
ranking runs off the backend's hot path — on the viewer's own device or a
delegated miner ([feed-ranking.md §11](../primitive/feed-ranking.md#11-where-ranking-runs)). This
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

A ranker consumes a `FeedSlice` plus the viewer's ranking parameters,
computes `S(u,c)` per candidate target, orders the candidates, and
returns the ordered id list. The viewer hands that list to the backend's
`feed` query for display hydration.

**The slice contract is raw L1 edge records**
([feed-ranking.md §11](../primitive/feed-ranking.md#11-where-ranking-runs)):
the `χ`-bounded node set and the accepted records among those nodes,
each with its landing epoch. The ranker derives everything else itself —
it folds same-author bundles into effective edges
([§3.2](../primitive/feed-ranking.md#32-the-fold--per-author-net-stance)),
computes `w̃` per folded hop
([§3.1](../primitive/feed-ranking.md#31-the-damped-weight)),
extracts up to `k` node-disjoint strongest paths, signs each by balance
and taint, decays each terminal record by epoch age, and sums
([§5–§6](../primitive/feed-ranking.md#5-per-path-quantities)). Epoch
ages read against the public epoch certificates; no trusted clock and no
observation metadata ride the slice. Because the inputs are raw public
records, any consumer can spot-check any ranking claim; pre-folded
aggregates are permitted only as a wire optimization that changes
nothing observable.

The extraction is **exact, never sampled** — binding here exactly as it
binds the `ranker` crate
([feed-ranking.md §6.1](../primitive/feed-ranking.md#61-definition)),
and deterministic: cost ties break by canonical record key, so two
honest runners produce identical output from the same slice.

The ranker never writes to the graph and holds no authority the backend
lacks: the slice it reads is the same public subgraph any client could
fetch, and the ordering it returns is advisory — the viewer's device
holds final authority over filters and presentation.

## Inputs

The viewer-tunable parameters of
[feed-ranking.md §12](../primitive/feed-ranking.md#12-calibration-parameters).
The three calibration fields fall back to the Network-seeded defaults
([network.md "Feed-ranking calibration"](../primitive/network.md#feed-ranking-calibration));
the governed parameters that are *not* viewer-tunable — `k`, the
`f(Δt)` shape, the tie-breaker composition — never ride the request:
the runner reads them from the published network parameters, the same
public state the slice comes from.

| Parameter | Role |
|---|---|
| `seenList` | Content ids to exclude from the candidate set before ranking ([feed-ranking.md §9.4](../primitive/feed-ranking.md#94-the-already-seen-filter)). |
| `kinds` | Which rankable node kinds are in scope (default: Posts only — [§9.3](../primitive/feed-ranking.md#93-what-is-rankable)). |
| `gamma` | `γ` — per-hop attenuation in `(0, 1]`; default `Network.gamma`. |
| `dustFloor` | `χ` — bounds the slice node-set and stops extraction; default `Network.dustFloor`. |
| `recencyHalfLifeEpochs` | `f(Δt)` half-life in epochs; default `Network.recencyHalfLifeEpochs`; `0` disables recency (`f ≡ 1`). |
| `friendAuthorReorder` | Friend-fresh reorder config — a reordering layer over the ranked output, never a boost multiplier ([§9.2](../primitive/feed-ranking.md#92-friend-fresh-reordering)); null uses the frontend default (the reference frontend ships it on). |

These are the `rank` operation's `params`, typed below:

```graphql
"The viewer's ranking parameters, all viewer-tunable. The three
 calibration fields fall back to the Network-seeded defaults; the
 governed non-tunable parameters (k, f-shape, tie-breakers) are read
 from published network state, never from the request."
input RankParams {
  "Content ids to exclude before ranking (the seen-list)."
  seenList: [UUID!]
  "Rankable node kinds in scope; default Posts only."
  kinds: [NodeKind!]
  "γ per-hop attenuation in (0, 1]; default Network.gamma."
  gamma: Float
  "χ dust floor; default Network.dustFloor."
  dustFloor: Float
  "f(Δt) half-life in epochs; default Network.recencyHalfLifeEpochs;
   0 disables recency (f ≡ 1)."
  recencyHalfLifeEpochs: Int
  "Friend-fresh reorder config; null uses the frontend default
   (the reference frontend ships it on — feed-ranking.md §9.2)."
  friendAuthorReorder: FriendAuthorReorder
}

"The friend-authored-fresh-post reorder (feed-ranking.md §9.2) — a
 reordering layer over the ranked output, not a boost multiplier (a
 pre-rank multiplier was considered and rejected there). The only knobs
 are on/off, the Publish-record freshness window, and where reordered
 posts land."
input FriendAuthorReorder {
  enabled: Boolean!
  "Epoch-age threshold on the author's Publish record."
  freshnessThresholdEpochs: Int
  placement: FriendAuthorPlacement
}

"Where friend-authored fresh posts land relative to the ranked feed."
enum FriendAuthorPlacement { INTERLEAVED ABOVE }
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

An ordered list of `FeedEntry` — the ranked targets, each carrying its
score, its tie-breaker values, and (on demand) the extracted paths. The
id sequence is what the backend `feed` query consumes; the score, the
tie-breakers, and the paths are the ranker's explanation of the order,
surfaced for inspection and never read back by the backend. Unreachable
targets are absent, not zero-scored — zero-jail is absence
([feed-ranking.md §7](../primitive/feed-ranking.md#7-sort-order-tie-breakers-zero-jail)).

```graphql
"One ranked target in the viewer's feed, with the ranker's per-target
 explanation. The target id feeds the backend's `feed` hydration."
type FeedEntry {
  "The ranked target node — any rankable node kind."
  target: Node!
  "S(u, target) — the signed greedy disjoint-sum (feed-ranking.md §6.1)."
  score: Float!
  "The global tie-breaker statistics (feed-ranking.md §7), applied in
   the governed composition on strict score equality."
  tieBreakers: TieBreakers!
  "The extracted paths (at most k) behind the score. A drill-down,
   computed with the score by the same extraction."
  paths: [RankPath!]!
}

"The tie-breaker cascade's inputs (feed-ranking.md §7), computed over
 the folded bundles toward the target."
type TieBreakers {
  "Net stance: Σ_a f(Δt_a) · (p̄_d + p̄_i), summed per stance-author."
  netStance: Float!
  "Gross volume: Σ_a f(Δt_a) · (|p̄_d| + |p̄_i|)."
  grossVolume: Float!
  "Epoch age of the newest terminal record — the final fallback."
  newestTerminalEpochAge: Int!
}

"One extracted path from the viewer to the target. Persons appear as
 one logical node (the grounded pair); paths are internally
 node-disjoint per feed-ranking.md §6.1."
type RankPath {
  "Ordered nodes, viewer → … → target."
  nodes: [Node!]!
  "The folded hops traversed, parallel to the node sequence."
  hops: [RankHop!]!
  "σ(π) — +1 or −1, from balance and taint (feed-ranking.md §5.2)."
  sign: Int!
  "m(π) = ∏ γ·w̃ over the hops."
  magnitude: Float!
  "f(Δt) of the path's terminal stance record."
  recency: Float!
  "This path's term in S: σ(π) · m(π) · f(Δt)."
  contribution: Float!
}

"One folded hop — a per-author bundle netted into an effective edge
 (feed-ranking.md §3.2), with the raw member records it folds over."
type RankHop {
  "The bundle's member records — raw, spot-checkable."
  records: [Record!]!
  "The folded parameters (p̄_d, p̄_i)."
  pDirected: Float!
  pInterest: Float!
  "This hop's factor: γ · w̃ of the folded edge."
  weight: Float!
}
```

`Node`, `Record`, and the scalars are the [api-spec.md](api-spec.md)
types — the ranker speaks the same type vocabulary as the backend it
sits beside.

## Search re-ranking

Search splits the same way the feed does: the backend's order is
viewer-independent (exact-match tier, then newest first), and
graph-blended ordering is the ranker's option. In the delegated case
that option binds here — the device never downloads the slice (see
Transport), so it cannot compute feed scores for search matches
locally. The dedicated operation:

```graphql
"Re-order search candidates by the viewer's feed score: the fetched
 hit ids in, the in-slice subset out, ordered. Candidates outside the
 slice carry no score and are not returned — the frontend keeps them
 in the backend's order below the ranked block (recency, the sort
 cascade's deepest fallback). Of the params only the calibration
 fields are read: the candidate set is given, so kinds does not apply
 (kind scoping happened at the search query) and seenList does not
 apply (the seen-filter governs feed rendering, not access —
 feed-ranking.md §9.4); friendAuthorReorder is a feed presentation
 layer."
rankSearch(slice: FeedSlice!, candidates: [UUID!]!, params: RankParams!): [FeedEntry!]!
```

The score is the one `rank` computes — every searchable kind is
rankable ([feed-ranking.md §9.3](../primitive/feed-ranking.md#93-what-is-rankable))
— so `rankSearch` is `rank` with the candidate set given (the search
hits inside the slice) instead of derived (every in-scope rankable
node in the slice).

## Two runners of one extraction

Feed ranking and campaign attribution are the same per-viewer
extraction ([feed-ranking.md §6.4](../primitive/feed-ranking.md#64-one-computation-two-consumers));
what differs is the integration, the runner, and the authority. The
feed sums one viewer's path terms into `S(u,c)` at feed-open; a
campaign runs the identical per-viewer computation over its eligible
crowd and integrates —
`V = Σ w(u)·S(u,C)` — settled once, centrally, because money demands
one authoritative figure
([economics.md §8.4](../primitive/economics.md#84-computation--exact-streaming-crowd-linear)).
The campaign computation is crowd-linear (reverse sweeps from the
anchors and target find the crowd; per-member extraction runs inside
`χ`-bounded slices, reusing the ranker's per-active-member work),
miner-shardable as pure compute, and epoch-incremental within the
evaluation delay.

| | Feed ranking (this doc) | Campaign settlement |
|---|---|---|
| Runner | the viewer's device or a miner | the central backend (shardable to miners as pure compute) |
| Authority | advisory — the viewer's device holds final say | authoritative — it moves money |
| Scope | every in-scope rankable node in one viewer's slice | one campaign × its eligible crowd |
| Dust floor | `χ`, viewer-tunable | `χ`, plus the campaign's support cutoff `χ_c`, recorded in the settlement payload |
| Time base | the live slice at feed-open | everything at the attribution epoch `t*` ([economics.md §8.3](../primitive/economics.md#83-everything-at-t)) |

## The pair-state operations

The post-severance surfaces of
[feed-ranking.md §8](../primitive/feed-ranking.md#8-severance-discovery-redemption)
are client- or miner-computed derivations over **folded pair-state** —
the per-author bundles the ranking already folds. Their data is
reachable through the generic read surface; the dedicated contracts
exist so frontends and miners code against pinned shapes instead of
each re-deriving the fold from prose. All three follow `rank`'s rules:
reads over public records, the same transport and delegation model,
stateless and polled — the runner holds no watch lists and sends no
notifications. The operations return structural facts; prominence,
thresholds, and action guidance are frontend-computed, and action
always requires the user's own priced records — advisory throughout.

### `severanceStatus` — the inbound self-query (§8.4)

```graphql
"The viewer's own inbound severance state plus their outbound audit
 material (feed-ranking.md §8.4). An explicit self-query — inbound
 records are never in the feed pull."
severanceStatus(viewer: UUID!): SeveranceStatus!

"The two §8.4 surfaces: the severance pattern and the audit list."
type SeveranceStatus {
  "Inbound bundles netted to (0,0), one entry per severing author."
  severances: [InboundSeverance!]!
  "The viewer's outbound folded bundles — the audit material a transit
   node reviews to find the bridge they hold open."
  outboundAudit: [BundleAudit!]!
}

"One inbound severance — a (0,0)-netted inbound bundle."
type InboundSeverance {
  severer: Actor!
  "Epoch age of the record that netted the bundle to (0,0)."
  severedEpochAge: Int!
  "True when the viewer's outbound bundle toward the severer is live —
   trusted-network severance, the per-bundle alarm. False entries
   signal in volume, not individually."
  fromTrustedNetwork: Boolean!
}

"One folded outbound bundle: current fold, member count, newest-member
 age — the §8.4 audit facts. The full chronicle reads via the generic
 record surface (api-spec.md)."
type BundleAudit {
  "The bundle's target."
  target: Node!
  "The record family the bundle folds over."
  family: RecordFamily!
  "The folded parameters (p̄_d, p̄_i); (0,0) is a netted bundle."
  pDirected: Float!
  pInterest: Float!
  "Raw member records in the bundle."
  memberCount: Int!
  "Epoch age of the ≺-newest member."
  newestMemberEpochAge: Int!
}
```

### `clusterAnalysis` — bridge auto-detection (§8.5)

An **optional diagnostic** — the bot-bridge signature is native to the
extraction (every extracted path shares the bridge; min-cut 1), so this
operation packages what ranking already computes rather than adding
math of its own.

```graphql
"Min-cut-1 bridge detection over the viewer's outbound subgraph
 (feed-ranking.md §8.5): suspect bridges with the structural inputs to
 the frontend's presentation. Facts, not verdicts — action requires
 the viewer's own (0,0) netting."
clusterAnalysis(viewer: UUID!, dustFloor: Float): [SuspectBridge!]!

"One suspect bridge with the inputs §8.5 names: extraction purity and
 the alternative-paths check."
type SuspectBridge {
  bridge: Node!
  "Fraction of the viewer's extracted paths into the subgraph behind
   the bridge that pass through it; 1.0 is the pure delta-funnel."
  deltaFunnelPurity: Float!
  "The alternative-paths check over sampled downstream content: how
   many sampled targets had no node-disjoint path avoiding the bridge.
   Equal to sampleSize means no alternative route exists anywhere —
   the bot-bridge signature; even one alternative path marks a
   legitimate hub."
  isolatedSamples: Int!
  sampleSize: Int!
  "The viewer's paths to the bridge — the drill-in material. Hop
   distance drives the frontend's action guidance (a 1-hop bridge is a
   clean cut; deeper cuts carry collateral)."
  paths: [RankPath!]!
}
```

The traversal is bounded the same way ranking is — `dustFloor` (null
falls back to `Network.dustFloor`) bounds the analyzed subgraph, and
the alternative-paths check is a bounded probe, not a full re-ranking.

### `redemptionCheck` — the polled outbound watch (§8.7)

```graphql
"The severer's redemption check over severed accounts
 (feed-ranking.md §8.7). Stateless and polled: the watch list and
 cadence live client-side, passed as `targets` per call; `sinceEpochs`
 scopes the change report. The severer's identity never enters the
 math — the analysis runs from each target's own outbound perspective.
 Self-redemption posts read through the generic read surface, not this
 operation; restoration is the severer's own new positive record,
 never automatic."
redemptionCheck(targets: [UUID!]!, sinceEpochs: Int): [RedemptionStatus!]!

"One severed account's redemption state — effectively binary per §8.7:
 no positive outbound bundle landing on a min-cut-1 bridge (redeemed),
 or some (still bridging). There is no halfway-redeemed state."
type RedemptionStatus {
  target: Actor!
  redeemed: Boolean!
  "The remaining suspect bridges under the target's positive outbound
   bundles, each classified by the §8.5 analysis run from the target's
   perspective. Empty exactly when redeemed."
  bridges: [SuspectBridge!]!
  "The target's outbound bundles with a new member record within
   `sinceEpochs` — the change feed the severer reviews against the
   full public chronicle. Null `sinceEpochs` returns the full outbound
   audit; the restore decision is made against the complete record."
  activity: [BundleAudit!]!
}
```

## Transport

The contract above is fixed; where it runs moves along a rollout
path: first the `rank` operation runs on the **backend directly**
(simplest to exercise against real slices), then in a **separate miner
container** (a delegated service), then **on the viewer's own device**
(the decentralized end state — proving a phone can rank its own
slice). No stage changes the slice-in, ordered-list-out shape, and the
`ranker` crate is the one implementation at every stage — one formula,
three consumers.

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

The remote wire signatures replace the slice argument with the viewer:

```graphql
rank(viewer: UUID!, params: RankParams!): [FeedEntry!]!
rankSearch(viewer: UUID!, candidates: [UUID!]!, params: RankParams!): [FeedEntry!]!
```

Reads are unauthenticated and `feedSlice` is viewer-parameterized
([api-spec.md](api-spec.md)), so the miner fetches
`feedSlice(viewer, params.dustFloor, params.gamma)` itself — the same
public subgraph any client could fetch, bounded by best-possible path
product `∏(γ·w̃) ≥ χ`
([feed-ranking.md §11](../primitive/feed-ranking.md#11-where-ranking-runs)).
Both parameters travel because slice membership depends on both: a
softened `γ` widens the slice the score is defined over. The device
never downloads the slice; saving that transfer, alongside the ranking
compute, is the point of delegating. The logical contract is
unchanged: the miner obtains the slice and runs `rank(slice, params)`
exactly as pinned above, which is also the form the in-process
on-device call uses directly.

## Delegation and trust

### Push model — no standing credential

The viewer's private inputs — the seen-list and the rank params — ride
inside each request. The miner holds no credential and no standing
state, and never authenticates to the backend: to the backend, a miner
is indistinguishable from any anonymous reader, and
[auth.md](auth.md) manages no delegation tokens. Revocation is
symmetric — the viewer stops calling; there is nothing to revoke
server-side.

When the seen-list lives backend-side (the central frontend's default —
[feed-ranking.md §9.4](../primitive/feed-ranking.md#94-the-already-seen-filter)),
the device fetches it under its own session and forwards it as
`params.seenList`. The forwarding cost is accepted: it keeps the miner
credential-free, and a client that wants to avoid it can keep the
seen-list locally — the math is the same regardless of where the JSON
came from. Standing delegation — a scoped credential or miner-held
seen-list — is parked as [open-questions.md Q25](../open-questions.md).

### Result integrity — advisory, spot-checkable, not attested

The ordering is advisory — the viewer's device holds final authority
over filters and presentation — and the math is deterministic over
public records (canonical tie-breaks, epoch-age recency), so the
device can re-rank any handful of targets locally and compare, or
re-derive any fold from the raw records in the slice. The contract
mandates no audit and carries no attestation: a lazy or dishonest
miner produces a visibly wrong feed, and the remedy is switching
miners. Nothing a miner returns is written to the graph, so a bad
ranking costs the viewer one feed render, not state.

### Out of scope — miner selection and incentives

How a viewer finds a miner is an out-of-band configuration choice (a
URL the viewer points their client at), and miner incentives are
deliberately unaddressed — nothing in the rollout path needs them.
Revisit if someone actually wants to operate a paid miner.
