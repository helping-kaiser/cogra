# Feed Ranking

What a viewing user sees, and in what order. The feed is a
**terminal** concern on the substrate: PeerNetworks Layer 1
specifies a default relevance score and grants every L2 the right
to replace it, provided the replacement is published
formula-complete
([layer1-interface.md §4](layer1-interface.md#4-the-reimplementation-grant),
§I.12). This document is that publication — the complete
computation of CoGra's feed score `S(u,c)`, from raw L1 records to
sorted order. Anyone holding the published ordered records and
the epoch certificates can reproduce every ranking claim it makes.

> **Notation.** L1 symbols (`p_d`, `p_i`, `w̃(e)`, `ε`, `τ_e`,
> `𝕋^act_q`, `≺`, `E_k`, `α_i`) are the interface's
> ([layer1-interface.md §14](layer1-interface.md#14-symbol-ledger-layer-1-tagged-objects));
> CoGra's own symbols (`S(u,c)`, `k`, `γ`, `χ`, `f(Δt)`) are
> indexed in [notation.md](notation.md).

---

## 1. The hard rule

- **The default feed is driven only by the graph and its
  weights.** No AI enters ranking, in any role. No honor balance,
  no token state, no operator dial, no engagement telemetry.
- **Routing and primary rank consume only viewer-rooted forward
  paths.** Inbound records never shape the viewer's feed — a swarm
  pointing ten thousand stances at you appears in *their* feeds,
  never in yours
  ([graph-model.md §5](graph-model.md#5-directionality-and-influence)).
  Global statistics enter as tie-breakers only (§7).
- **Standing never enters.** `α_i` is a write-admission scalar —
  it gates who may act, never what anyone sees. Concretely: feed
  paths cross persons through the grounded pair, never through the
  standing-derived Self-edge bond (§4).
- **Curated feeds are labeled.** Named opt-in feeds may consume
  declared L2 signals; none of them is ever presented as the
  neutral rank (§10).

---

## 2. Inputs

The computation reads exactly:

1. **Raw L1 edge records** — the `χ`-bounded slice (§11). The
   ranker folds bundles and derives every weight itself; Reference
   records are ordinary members of the slice.
2. **Epoch certificates** — for each record's epoch age (§5.3).
3. **The viewer's read-side state** — seen-list, filters, frontend
   overrides (§9).
4. **The governed calibration parameters** (§12).

It never reads: standing `α_i`; the honor ledger (structurally
unreachable — a membership-gated Postgres store outside every
slice); CGT or Layer 0 state; payload bodies; or any session
event — the graph carries
stances, not behavior
([graph-model.md §4](graph-model.md#4-stances-not-events)).

---

## 3. The per-edge primitive and the fold

### 3.1 The damped weight

CoGra adopts L1's damped edge weight **wholesale** as the feed's
only per-edge magnitude:

```
w̃(e) = |det Ψ_e^[P]|^(1/2) · √(1 + τ_e²) · e^(−β·H_τ(e))
        coherence            maturity      boundary
```

(``def:epoch:damped-edge-weight``;
[layer1-interface.md §8.7](layer1-interface.md#87-path-view-tiers-parity-and-the-damped-weight)).
Adopting rather than re-deriving buys the proven structure:

- **Invariant: every hop attenuates.** `w̃(e) ≤ |det Ψ^[P]|^(1/2) · √2`
  (``prop:epoch:damped-weight-bounds``), and determinant magnitudes
  top out near `0.36` (Full tier), so `w̃ < 1` everywhere. Path
  products only shrink with depth.
- **The tier ladder is built in.** Full / Half / Marginal routing
  floors damp proposal-like and annotation-like hops by the
  published formula, which CoGra adopts as-is — an L1 terminal
  default.
- **Determinism.** `w̃(e)` is a function of the published
  authoritative act order `𝒬_k` and the constants alone
  (``lem:graph:ordered-replay-determinism``) — every consumer
  holding the same ordered history computes the same value.
- **One formula, three consumers.** Backend, miner, and on-device
  ranker all evaluate this same primitive; there is no CoGra-side
  variant to trust.

**Invariant: zero is inert.** If either effective parameter is zero, `ε(e)`
is undefined and `w̃(e) = 0`
(``rem:graph:zero-parameter-degeneracy``) — the edge carries no
path. Indifference is magnitude zero, not a third sign; nothing
downstream can revive a dead hop.

### 3.2 The fold — per-author net stance

Before any weight is derived, the ranker folds the raw records.
Same-author bundles — key **(author, target, edge type)** — net by
sum-then-clip into one effective edge with parameters
`(p̄_d, p̄_i)`, hyper-edge legs netted per-leg, temporal attributes
taken from the bundle's `≺`-newest member. Excluded from folding,
read per-record: the settlement handshake (Bid, Accept, Ratify).
Control records never enter feed traversal at all (§4). An
author's Invitation legs toward a `(Chat, Profile)` pair are
suppressed iff the latest epoch index represented in that
author's own {Invitation, De-invite} records with that incidence
contains a De-invite — ties within an epoch favouring the
revocation; a later complete Invitation at a subsequent epoch
re-establishes the act. The rule is epoch-quantized, not
order-read — L1's inviter-revocation rule
(``def:epoch:inviter-revocation``), adopted as the fold's rule
here.

This mirrors L1's net-stance fold (``def:epoch:net-stance``;
[layer1-interface.md §11.3](layer1-interface.md#113-act-folding-and-the-base-allocation-matrix))
deliberately, with the scope stated honestly: **L1's math makes a
`(0,0)`-netted bundle inert in the standing projection; its
inertness in CoGra's feed and attribution holds because this spec
declares the same fold.** Attribution consumes the same folded
paths (§6.4), so netting a bundle to `(0,0)` also kills earnings —
the two halves of severance (§8) stand or fall together.

The fold gives revision its economics: stances are chronicles
([graph-model.md §3](graph-model.md#3-revision-and-current-state)),
so walking back accumulated conviction costs counter-records in
proportion to it, each one a priced act
(``rem:epoch:conviction-inertia``). Flip-flops are expensive;
severance is burn-priced.

---

## 4. The path set

`S(u,c)` is computed over paths from the viewing person `u` to the
candidate `c`. What counts as a path:

**Invariant: forward-only.** Paths traverse records in their stored direction
only. This is what makes the inbound-inert rule (§1) mechanical:
propagation flows along directions the viewing user (and their
transitive network) established; records pointing *at* you move
nothing *toward* you.

**Persons are one node.** The Actor + Profile grounded pair is a
single logical node — a stance landing on a Profile continues from
the same person's own outgoing records. The derived Self-edge bond
(Declaration, Reputation) is **not a feed input**: its weight is
standing-derived, and standing — inbound-derived and epoch-lagged —
must not scale feed signal (§1). Registration records are likewise
internal to the pair, never a transit hop. A useful consequence:
node-disjointness in §6 means *person*-disjointness — a person
cannot be reused across "independent" paths via their two graph
nodes.

**Direction-forward, not time-forward.** L1's raw services measure
connectivity in the current public snapshot — raw path viability
does not require ascending times (``def:graph:raw-snapshot-path``) —
and CoGra's feed is the same: a stance recorded today must be able
to reach content published years ago, or no new connection would
ever surface an existing body of work. Staleness is `f(Δt)`'s job
(§5.3), not a path-admission rule. Causal order still matters — it
orders each bundle for the fold and anchors epoch age.

**Traversal policy.** Declared per family, as
[edges.md](edges.md#5-overlay-edges-cogras-graph) requires:

| Family | Feed traversal |
|---|---|
| Opinion, Publish, Affinity, Owner, Join Request, Accept, Ratify | Traversable at the folded `w̃` (handshake edges per-record). |
| Hyper-edges: Review, Send, Bid, Invitation, Participant | Traversable as their two legs — one hop each, each with its own leg parameters (``thm:graph:hyper-edge-reduction``). An **ordinary-role** Review's T-leg — a comment edit — is channel-gated (**Edit legs**, below), and so is a Participant's movement T-leg (**Chat lineages**, below); genesis legs are ordinary hops. |
| Reference | A-leg an ordinary hop; the citation T-leg is channel-gated (**References**, below) — not a free out-edge of the carrier. |
| Tag | A-leg an ordinary hop; the topic T-leg is channel-gated exactly like a citation (**Tags**, below). |
| Control records: Withdraw, Rescind, Leave, De-invite | **Never traversed.** They carry procedure, not stance (type-fixed parameters); routing feed signal along a De-invite would surface an expellee *because* they were expelled. Mirrors ``rem:epoch:control-acts-resolve-to-self``. |
| Derived Self-edge bond | **Never traversed** (person fold, above). |

Ballots need no row of their own: a vote is a payload-marked
Opinion toward the proposal's anchor
([substrate-map.md §5](substrate-map.md#5-governance-and-moderation)),
so a friend's vote surfaces a proposal exactly the way any stance
surfaces content. A vote stays a stance on the proposal, never on
its subject — the anchor's `(0,0)` subject Reference has `w̃ = 0`,
so the stop is enforced by the math, not by a traversal rule.

**Invariant: Types are sinks.** Every path reaching a Type ends there:
Types rank as targets — topic pages — and never transit, so
following a topic cannot amplify anything "behind" it. The stop
is CoGra's declared traversal policy, not an L1 census fact — a
Type sources Tag and Review terminal legs and author-fixed
Reference legs like any passive node
(``lem:graph:passive-out-degree``); the ranker simply never walks
them. Topic-scoped browsing is a named feed (§10), with
**Affinity** (Actor → Type) as the follow gesture.

**References.** A quote, embed, or mention is an L1 Reference: an
authorship **A-leg** (Marginal) from the author into the citing
artifact, and a **Full-tier citation T-leg** from that artifact to
the target
([substrate-map.md §3](substrate-map.md#3-stances-and-revision)).
The A-leg is an ordinary hop — reaching a reference's author
surfaces the artifact it cites. The **citation T-leg is not a free
out-edge of the artifact.** Both its endpoints are pre-existing
passive nodes, so anyone can hang a citation off anyone's content;
a passive node must never become a switchboard that carries a
stranger's reference onward to every viewer who reaches it.
**Invariant:** exactly two channels cross the T-leg:

- **Content-intrinsic** — the reference author *is* the carrier's
  author. The citation is part of the content, so any path reaching
  the carrier continues along the T-leg: endorsing a post endorses
  the references its author built into it.
- **Initiator-owned** — otherwise, the T-leg is traversable only as
  the continuation of *this* reference's own A-leg. The target is
  reached only *through* the reference's **author**, at the
  viewer's forward-path weight to that author (indirect connections
  count, decayed). A carrier with no single author — a Type, a
  Chat — has only this channel.

A `(0,0)` citation carries `w̃ = 0` and crosses neither channel.

Within a channel, signs read normally: balance and taint (§5.2)
take the reference's parameters like any stance hop, so a hostile
citation ranks its target down. Strength stays at census ceilings —
the T-leg is Full tier, and a path entering the carrier from its
own author rides **Publish** (promoted, Full) rather than the
Marginal A-leg — so a stance-bearing post about a thing ranks it at
roughly half a direct stance. A mention is a Reference whose target
is the person's **Profile**: the path lands in the grounded-pair
person fold and continues like any person transit. Carrier and
mentioned person are each one node, so within one viewer's score at
most one extracted path passes through either toward any target
(§6) — per-viewer, virality never multiplies; a genuinely endorsed
carrier counts once per viewer who reaches it, and reach is paid in
the campaign sum (§6.4).

**Tags.** Tag authorship is census-unconstrained — anyone may tag
anyone's content — so the topic T-leg gets the citation's
discipline. The A-leg is an ordinary hop: reaching a tagger
surfaces what they tagged, at the tag's real parameters. The
**topic T-leg crosses by the same two channels**:
content-intrinsic when the tag's author is the content's author
(the topic declaration is part of the content), initiator-owned
otherwise — a stranger's tag reaches the Type only through the
tagger, at the viewer's forward weight to them. Types are sinks,
so a crossed T-leg lands and stops; the same channel test decides
which Tag records the topic feed (§10) surfaces for a viewer —
the author's own declarations plus those of taggers the viewer
actually reaches, never every stranger's. The `(0,0)` verdict Tag
carries `w̃ = 0` and crosses neither channel.

**Edit legs.** A comment edit is an ordinary-role Review whose
T-leg targets the existing Comment
([comment.md §4](../instances/comment.md#4-editing)) — both its
endpoints pre-exist, the exact shape that makes a citation T-leg
gated: formation cannot check the edit's A-leg against the
Comment's genesis parent, so anyone can author a Review wiring an
arbitrary Comment beneath an arbitrary carrier, with Review/A's
full-tier strength on the first hop. The same two channels apply:
**content-intrinsic** when the Review's author is the Comment's
creator — a real edit, part of the content — and
**initiator-owned** otherwise, so a stranger's mismatched "edit"
reaches the Comment only through its own author, at the viewer's
forward weight to them. A genesis Review needs no gate: its T-leg
mints the Comment, so nothing pre-existing can be hijacked. The
parent fold is genesis-keyed regardless — a mismatched edit never
reparents ([comment.md §4](../instances/comment.md#4-editing)).

**Chat lineages.** A chat candidate is its **lineage** — the
succession chain the L2 fold bundles into one logical chat
([chats.md §8](../instances/chats.md#8-chat-metadata-and-updates))
ranks as a single candidate, and the bundle's internal records
drop out of that candidate's path set: no path to the lineage
transits its own succession legs, so a chat never self-amplifies
through its update history. A Participant's movement **T-leg**
(`C₀ → C₁`) has two pre-existing endpoints — the exact shape that
gates a citation — and its carrier is a Chat, which has no single
author: only the **initiator-owned** channel crosses it, so a
mover's or stranger's successor claim reaches the destination
only through that author, at the viewer's forward weight to them.
The A-leg is an ordinary hop; a join's or founding's self-loop
T-leg is routing-inert, and a system-actor succession is authored
entirely at zero — `w̃ = 0`, crossing nothing.

**Simple by construction.** Every hop factor is below one
(`γ ≤ 1`, `w̃ < 1`), so a strongest path never revisits a node — a
detour only multiplies in more sub-unit factors. No separate
simple-path invariant is needed, and nothing in this spec
enumerates or samples walks (§6.1).

---

## 5. Per-path quantities

Each extracted path `π` (§6) contributes one signed, decayed term.

### 5.1 Magnitude

```
m(π) = ∏ over hops of  γ · w̃(ē)
```

`γ ∈ (0, 1]` is CoGra's per-hop attenuation — a pure sorting
preference over how local a feed should be. Default `1`: the
native decay of sub-unit `w̃` products is the depth attenuator,
and the dust floor `χ` (§6.3) bounds reach. There is no hop cap
anywhere in the math.

### 5.2 Sign — balance and taint

Magnitude is L1's; **sign is CoGra's**, read from the folded
parameters of the path's stance hops:

```
balance(π) = ∏ sgn(p̄_d)                 over stance hops
tainted(π) = true iff any hop has p̄_i < 0
σ(π)       = +1  iff balance(π) = +1 and not tainted(π)
             −1  otherwise
```

Live hops always have both signs
defined (a zero parameter is already inert, §3.1).

- **Balance** is signed-graph transitivity of the directional
  verdict: the enemy of my enemy — an even number of negative
  `p̄_d` along a chain flips back to endorsement.
- **Taint** is the non-transitivity of avoidance: "I avoid A; A
  avoids B" says nothing transitive, but any crossed avoidance
  reduces what flows through the route. Taint is absorbing — two
  avoidances never compose into an endorsement.

**Why not L1's parity `ε(π)`.** The Quadrant Law
(``lem:graph:quadrant-law``) makes `ε(e) = sgn(p_d · p_i)`: a
coherence bit, never a favor bit (``rem:graph:sign-semantics``) —
`(−1, −1)` is gauge-equivalent to `(+1, +1)` for routing. That is
right for standing (coherent condemnation is a strong coherent
signal, and recipient resolution
(``def:epoch:standing-recipient-resolution``) reads stance separately) and wrong
for a feed: hate-and-avoid must rank *opposite* to love-and-seek,
not identical. The stance survives in the stored slice's marginal
row precisely for terminal read-sites — and the feed is one: it
reads `sgn(p̄_d)` and `sgn(p̄_i)` directly. No contract is bent;
L1's own default feed is parity-blind, and the feed is CoGra's to
define. The authoring vocabulary stays fully free — both
parameters anywhere in `[−1, +1]`, all four quadrants
([edges.md §1](edges.md#1-the-edge-record-and-cogras-two-axes));
what the feed *does* with quadrant III is this section.

### 5.3 Recency

Nothing in `w̃` ages: `τ_e` is novelty at landing — how
established the endpoints already were — frozen at write time
([layer1-interface.md §8.3](layer1-interface.md#83-temporal-structure)),
and the act time `𝕋^act_q` is pure order. A three-year-old record carries the
`w̃` it had the day it landed. Without a recency input, stale
accumulated signal beats a friend's brand-new post forever. So the
feed applies its own factor on each path's **terminal stance
record** — the last hop into the candidate; for a folded bundle,
its `≺`-newest member:

```
f(Δt) = 0.5^(Δt / half-life)            (default shape)
```

`Δt` is **epoch age**: the count of epoch certificates issued
since the record's first inclusion in the committed edge set
(`0` for records newer than the newest certificate). The
half-life and the shape of `f(Δt)` are both governed parameters
(§12), the half-life measured in epochs; frontends may retune the
half-life or disable recency (`f ≡ 1`) view-side.

- **Only the terminal hop decays.** Silence on a relationship
  record is not a partial revocation — stances hold until revised
  ([graph-model.md §4](graph-model.md#4-stances-not-events)).
  Intermediate hops carry full weight regardless of age.
- **Old content resurfaces organically.** A fresh stance toward it
  is a fresh terminal hop at `f ≈ 1`; a revision refreshes its
  bundle's newest member. Node age itself never enters the math.
- **Why epoch age, not wall-clock.** Epoch age is derivable from
  public records alone — a miner spot-checking a ranking needs no
  trusted clock, and no unauditable "when we observed it"
  metadata rides the slice. The certificate cadence is the
  network's own clock; the half-life breathes with network pace.

Cold start, concretely: a friend's fresh post reaches you as one
short path whose terminal record has `f = 1`; an old post buzzing
in your network years ago reaches you over many paths whose
terminal records all carry `f ≈ 0` — unless people are engaging
*now*, in which case those fresh stance records are fresh terminal
hops and the content competes at full weight. That is the intended
behavior, not a leak.

---

## 6. The score — greedy disjoint-sum

### 6.1 Definition

Extract up to `k` internally node-disjoint strongest paths,
strongest first:

1. `π₁` = the maximum-product live path `u → c`: run Dijkstra on
   per-hop cost `−ln(γ·w̃)` (max-product ≡ min-cost; all costs
   `≥ 0` since every hop factor is `≤ 1`).
2. Delete `π₁`'s interior nodes (persons delete as one node).
3. Repeat until `k` paths are extracted or the best remaining
   product falls below `χ`.

```
S(u,c) = Σ_{i=1..k}  σ(π_i) · m(π_i) · f(Δt_{π_i})
```

Ties on cost break by canonical key — the lexicographically least
sequence of record identity keys — so every consumer extracts the
same paths from the same records. `k` is governed (order 4–8).

**Exact, never sampled.** Binding on every implementation — the
ranker crate, the miner, any future rewrite: the aggregation is
computed exactly. A random-walk approximation estimates the
sum-over-*all*-paths quantity, which is rejected below; sampling
would silently reintroduce it.

### 6.2 Why disjoint paths

- **Breadth should count.** Twenty independent endorsement chains
  are better evidence than one strong chain. L1's default feed
  reads only the single best path — right for a conservative
  substrate default, too narrow for a social feed.
- **Summing all paths diverges.** At Full-tier per-hop weights
  (`w̃ ≈ 0.3–0.5`), path count grows like `b^depth`; branching
  `b ≥ 2–3` lets a cluster amplify one entry edge without bound.
  Rejecting sum-scoring for this redundancy-amplification failure
  is CoGra's call — the raw path rule is a replaceable terminal
  default — and it follows the precedent L1's standing side sets by
  conserving each source's allocation across all recipients, so
  multiplicity redistributes rather than accumulates
  (``post:epoch:standing-pair-mass-conservation``,
  ``prop:epoch:dilution-cost``).
- **Disjoint-sum is the principled middle.** By Menger's theorem
  the number of internally disjoint `u→c` paths is capped by the
  minimum node cut, so breadth counts exactly when it is realized
  by genuinely independent chains. A delta-funnel — a cluster
  fanning out behind one bridge and converging on a boost target —
  has min-cut 1: it scores as its single bridge path, an
  amplification ceiling of exactly 1×, no matter how many internal
  records it manufactures. A `k`-th disjoint path requires a
  `k`-th independent real entry.
- **`q` stays at ½, unexposed.** `q = ½` is the canonical raw
  default; a guild may expose other values for its own sorting
  (``rem:sorting:matrix-bfs``). The disjoint-sum already is the
  diversity mechanism; exposing `q` would add a redundant dial at
  roughly 3× compute. At most a future named opt-in feed.

### 6.3 The dust floor

`χ` is the contribution floor: extraction stops when the best
remaining path product is below it, and the slice itself is
bounded by it (§11). `χ` is a **compute cutoff, not a defense** —
the defenses are structural (sub-unit hops, disjointness,
severance). Governed; `≈ 0` while the graph is sparse, raised as
density grows.

### 6.4 One computation, two consumers

Feed ranking and campaign attribution are the **same extraction**:
the feed sums the `k` signed path terms into `S(u,c)`; a campaign
runs that identical per-viewer computation over its target crowd
and integrates it — `V = Σ over eligible members u of
w(u) · S(u, campaign)`, where the targeting weight `w(u)` is the
viewer's own score of the campaign's named anchor(s). Each
viewer's path terms split among that path's distinct authors
(never the viewer, never the target author) and pay from the
campaign pool ([economics.md](economics.md), which owns the
metric: anchor sets, eligibility, settlement window, pricing).
Because the path set is shared, the delta-funnel earnings ceiling
and "netting to `(0,0)` kills earnings" hold for money exactly as
they hold for visibility — per viewer a carrier earns once, and
reach pays through the crowd sum, not through per-viewer
multiplicity. The three CAN invariants
([layer1-interface.md §4.1](layer1-interface.md#41-mandatory-can-invariants-full-paper-only))
bind the attribution side.

---

## 7. Sort order, tie-breakers, zero-jail

Sort by `S(u,c)` descending.

- **Positives** at the top; **negatives visible at the bottom**,
  not banished — a friend's strong dislike is information, and
  transparency favors showing it below the fold rather than hiding
  it.
- **Unreachable candidates are absent.** No live path above `χ`
  means no score and no row — absence, not a bucket.

**Tie-breakers.** On strict `S` equality (common only in sparse
graphs and integer-stance habits), global statistics over the
folded bundles toward `t` break the tie, in governed composition
(§12): net stance `Σ_a f(Δt_a) · (p̄_d + p̄_i)`, then gross volume
`Σ_a f(Δt_a) · (|p̄_d| + |p̄_i|)`, summed per stance-author `a`;
the final fallback is recency — newest content first, by the
target's **genesis** authorship record's age. An update record
never refreshes it: "newest" means newest content, not
most-recently-edited.
Global statistics enter here and only here, never the primary
rank.

**Zero-jail.** The predicate: **every path from `u` to `t`
crosses a `(0,0)`-netted bundle** — not one traversable path
remains. You put a target there by zeroing: authoring
counter-records until your own bundle toward them nets to `(0,0)`
(§8.1). Each viewer's zeroing kills the paths through their own
records; the jail closes when the last live entry is netted — a
lone unsevered bridge is the midway state §8.3's cascade
finishes. Jailed means absent, and the absence propagates through
every consumer of the shared computation:

- no feed presence, for every viewer whose paths all cross netted
  bundles;
- no attribution earnings — the same paths carry the money (§6.4);
- no vouch propagation — netted bundles are routing-inert in
  the standing projection by L1 math;
- no subsidised capacity — an actor nobody's live records reach
  loses community funding for their θ-debits: severance and
  defunding are the same act ([economics.md](economics.md)).

The jail is **unreachability**, enforced by the fold, not by a
sort position. "Bot" here is a role, not a species: whoever the
community cuts off entirely — an actual bot swarm, a troll, an
intolerable actor — the math reads path-set properties and never a
category (§8.3). While any live entry path remains, `t` is
reachable through it, at the 1× bridge ceiling (§6.2).
A cancellation `S = 0` (opposing live paths summing to zero) is
not jail — it sorts as the neutral score it is; jail is absence.

Hyper-edge T-legs landing on a Profile source from passive
artifacts, so no viewer's netting can remove another author's
leg. For References, §4's two-channel rule closes the gap — the
citation leg crosses only through the reference's author, at the
viewer's forward weight to that author, which for a jailed author
is dead. The Invitation T-leg twin persists as accepted geometry,
handled by read-side policy — CoGra declines to render self- or
confederate-invitation trolling (resolved
[open-questions.md Q28](../open-questions.md)).

---

## 8. Severance, discovery, redemption

### 8.1 The act

Severance is write-side: author counter-records until your bundle
toward the target nets to `(0,0)`. A bundle is per family, so the
gesture cuts the one it names: severing a person nets your Opinion
bundle toward them, while a mention you authored toward their
Profile is a bundle of its own and is walked back by its own
withdrawal. The netted bundle is routing-inert in all three
consumers at once — feed (§3.2), standing projection (L1 math),
attribution (§6.4) — and it is priced:
each counter-record debits `θ`, in proportion to the conviction
being walked back. It is simultaneously the community defense and
the economic one: a bridge into a bot cluster keeps *earning* from
attribution until it is reversed to `(0,0)`.

`(0,0)` is not the everyday signal. Dislike is `(−, +)`,
avoidance `(+, −)`, hate-and-avoid `(−, −)` — all live signal the
math ranks (§5.2). Netting to `(0,0)` is the deliberate cut:
"outside my graph of relevance," with consequences ordinary
stances don't have.

### 8.2 The read-side blocklist

A viewer blocklist ("never show me X") is frontend filtering
(§9.1) — personal comfort, invisible to the graph and to everyone
else's feeds. **Frontends must hint at the difference:** blocking
does not lift the effect your own live records have on your
friends' feeds; only netting your bundles to `(0,0)` does.

### 8.3 Cascading severance — and its locality

A cluster stays reachable while any real person keeps a live
bundle into it; that transit person is the cluster's bridge,
knowingly or not. The defense cascades: viewers who see cluster
content arriving through a specific person can sever *that
person*, killing every path that transited them. As bridges
close, the min-cut drops and detection sharpens (§8.5).

Severance is local. The severing community is moving *itself*
infinitely far away — it can only ever reduce its own paths.
Cluster-internal life continues unchanged; communities that have
not severed keep their own paths on their own terms; nothing
propagates, federates, or globalizes (a binding constraint on any
future federation —
[open-questions.md Q15](../open-questions.md)). "Cluster" itself
is a viewing convention: there is no cluster object, no cluster
property; the math only ever reads paths from a viewer to a
target.

### 8.4 Discovery — the inbound self-query

Inbound records don't enter feeds, so discovering one's own
severed state takes an explicit self-query over inbound
pair-state: the folded bundles *toward* you. Two signals, both
surfaced:

- **Trusted-network severance** — a `(0,0)`-netted inbound bundle
  from someone you hold a live outbound bundle toward. Per-bundle
  alarm.
- **Stranger severance volume** — netted bundles from outside your
  outbound network. Individually weak, meaningful in bursts.

Alongside: the audit list of your own outbound bundles — current
fold, member count, newest-member age — the material a transit
node reviews to find the bridge they're holding open.

### 8.5 Bridge auto-detection

The bot-bridge signature is native to the extraction: content
behind a suspect `B` is reachable **only through `B`** — every
extracted path shares `B`, and no second disjoint path exists
(min-cut 1 at `B`). A legitimate hub fails the test: content
circulating through a hub also arrives by independent routes, so
an alternative path exists inside the traversal window.

This is graph math on the same slice the ranking reads —
client- or miner-computed, no AI, no central verdicts, and
**advisory only**: action always requires the user's own `(0,0)`
gesture. Frontends present hop-distance guidance as tooltips — a
1-hop bridge is a clean cut; a 2-hop cut carries collateral
("this also disconnects you from everything else behind that
person"); at 3+ hops the closer fixer named by the path itself is
the natural actor, or the read-side filter (§9.1) does the
personal part.

### 8.6 Community evidence

**Invariant: the `bot-defense` Type name is reserved** — seeded
at genesis; its semantic role is platform-defined, not emergent
from first use.

A **bot-defense post** adds what structure can't capture: a
regular Publish plus a Tag toward the reserved `bot-defense` Type
(seeded at genesis; canonical-name resolution per the L2 naming
service — [hashtag.md](../instances/hashtag.md)), its body
carrying the human-readable evidence. Frontends surface these
beside auto-detection: structure says "min-cut 1 behind `B`";
the post says "here is what `B` is doing." Ordinary trust
mechanics cover abuse — a bot's accusations don't reach trusted
feeds (§1), false accusers are themselves severable, and a post
amplified only from inside a cluster exhibits the min-cut-1
signature itself. The tag is shorthand, not a type restriction:
the same convention covers any narrowly-bridged cluster a
community disengages from.

### 8.7 Redemption

Reversible by the severed person's own act: net your own bridge
bundles to `(0,0)` — priced, public, chronicled. The redeemed
state is graph-derivable, so severers need no memory of *why* they
severed: `T` is clean when no positive outbound bundle of `T`
lands on a min-cut-1 bridge (§8.5). The check is effectively
binary — a genuine transit node has one or two bridges to clean
up; an account with many is the cluster's body, not its bridge.

Restoration is the severer's own new positive record, made against
the full visible chronicle — per-severer, deliberate, **never
automatic** (one person re-attaching to a live bridge is a network
failure; friction is the design). The severer's client watches
pair-state for changes both ways. A **self-redemption post** —
same reserved Type — makes the claim discoverable in the
severer's review surface; the math is checked first, the prose
read second.

---

## 9. Read-side layers

§3–§7 is the neutral computation. Everything below is viewer-side
policy over its output — real product surface, never part of
`S`.

### 9.1 Filtering vs ranking

Hard exclusions ("never show me content from X") are post-rank
frontend filters. The math stays smooth — taint reduces paths
proportionally, never snaps them to zero — and the viewer's hard
lines live in their client, not in the graph.

### 9.2 Friend-fresh reordering

The reference frontend surfaces posts whose author-person the
viewer holds a direct live stance toward (folded `p̄_i > 0`) and
whose Publish record is fresh (epoch-age threshold), near the top
— **reordering the ranked list, not changing the math**. A
pre-rank boost would fork `S`'s semantics per target and encode an
actor-identity special case no other input has. Default on;
opt-out and thresholds are frontend knobs. Deeper rings are left
to the multi-path math, which already aggregates them.

### 9.3 What is rankable

The math is target-type-agnostic: anything reachable by a live
path can carry a score. Scope is a read-side filter:

- **Default feed: Posts only.**
- **Opt-in:** Comments, Chats, Messages, Items, Offers, persons
  (Profiles), collectives, Types (topic pages), document anchor
  Content, and **Proposals** — reached through their L1 anchor
  Content; ballots are ordinary stance records toward the anchor
  (§4), so proposal discoverability is the same math as everything
  else, and the anchor's `(0,0)` subject Reference keeps proposal
  traffic off the subject.
- **Out of scope:** membership junctions (junction structure, not
  content); the network charter (instance configuration, nothing
  to rank); money has no graph presence to rank at all.

### 9.4 The already-seen filter

Per-viewer set of seen node keys, excluded from the candidate set
**before** ranking (most candidates of an active user are already
seen; excluding first avoids wasted extraction). New stance
activity on a seen node does not resurface it — a new comment is
its own node, ranked on its own merits.

The list belongs to the viewer, not the backend: backend storage
(the central frontend's default,
[data-model.md](../implementation/data-model.md)), device-local,
or nowhere at all — the calculator takes it as a parameter and an
empty list excludes nothing. A delegated miner holds no copy; the
list rides each request
([miner-api.md](../implementation/miner-api.md#delegation-and-trust);
standing delegation is
[open-questions.md Q25](../open-questions.md)).

Reference-frontend conventions: "seen" = passed through the
viewport during a render, batched and flushed at natural
checkpoints; "show everything" toggle and direct navigation bypass
the filter; a history tab is the same data read chronologically;
entries compact away after ~1 year (resurfacing a resurging old
post is accepted feed character).

### 9.5 The ranked order is a snapshot

Rank once per feed-open; paginate the frozen order; recompute only
on explicit refresh. The record set is append-only and grows
mid-scroll — re-ranking per batch would reshuffle under the
reader.

---

## 10. The default feed and named feeds

The **default feed** is `S(u,c)` — the neutral rank, this spec
entire, driven by the graph and its weights alone.

**Named opt-in feeds** are labeled curations that may consume
declared L2 signals:

- **Friends** — a scope filter over the neutral rank.
- **Topic** — content carrying Tag records toward Types the viewer
  holds Affinity for; the follow gesture is Affinity, the feed
  effect is this read-side rule (§4: Types are sinks — never
  transit amplifiers).
- **Guild** — a community feed that may read *its own* honor
  ledger, membership-gated; the single sanctioned honor read into
  any feed. Honor never enters the default feed or economics.

The honesty boundary: a named feed is presented as what it is and
never as the neutral rank — `S_Γ` for the app, `S` for the truth.
No AI in any feed, named or default.

---

## 11. Where ranking runs

The graph has no universal ordering — rank exists only relative to
a viewer — and per-viewer realtime ranking neither scales
centrally nor deserves central trust. The split:

- **The backend serves slices.** The slice is bounded by `χ` over
  **best-possible path product** — a best-first frontier on
  `−ln(γ·w̃)`, `O(|E| log |E|)`, cycle-immune since every hop
  factor is sub-unit. A cheap max builds the slice; the `k`-path
  extraction (the expensive part) is deferred to the ranker.
- **The slice contract is raw L1 edge records.** The ranker folds
  bundles and derives `w̃` itself, so any consumer can spot-check
  any ranking claim from public records and the certificates.
  Pre-folded aggregates are permitted only as a wire optimization
  that changes nothing observable.
- **Ranking runs on the viewer's device by default**, or on a
  delegated miner (battery, bandwidth); the viewer's client keeps
  authority over filters and overrides either way. One ranker
  implementation serves backend, miner, and device — one formula,
  three consumers, no divergent math to audit.

---

## 12. Calibration parameters

Network-level defaults are governed parameters of the network
charter — an L1 Content node anchored by the publisher system
actor, with passed changes landing as witnessed payloads on their
finalization Opinions toward it
(newest finalization per parameter wins) and mirrored into the
parameter carrier the ranker reads
([network.md](network.md#feed-ranking-calibration)). Set by the
genesis operator, migrating to community governance; numbers live
there, not here. Frontend overrides layer view-side on top: they
change one viewer's sort, never the published computation.

| Parameter | Role | Frontend-tunable |
|---|---|---|
| `k` | Disjoint paths extracted per (viewer, target) (§6.1) | no |
| `γ` | Per-hop attenuation, default `1` (§5.1) | yes |
| `χ` | Dust floor — compute cutoff on path product (§6.3) | yes (finer only) |
| half-life | `f(Δt)` decay, in epochs (§5.3) | yes (incl. off) |
| `f(Δt)` shape | Functional form of the recency factor; the exponential is the genesis default (§5.3) | no |
| tie-breaker composition | Order and weights of §7's cascade | no |
