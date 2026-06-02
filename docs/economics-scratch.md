# Economics & token — working notes

WIP scratchpad for [Q20](open-questions.md#q20--economics-primitive-distribution-ledger-home-vocabulary-anchor).
**Nothing here is canonical** — the canonical landing pads will be
new files under `docs/primitive/` and `docs/implementation/` once
decisions stabilize. This doc gets deleted when those files exist.

Decisions marked `[settled]` are explicit user choices. `[proposal]`
items are sketches awaiting the user's call.

---

## How to use this file

This is the working doc for the Q20 economics design pass. It lives
on the long-lived branch `jakob/economics/design`. No PR into main
until the design is fully settled.

**Each session should:**

1. Re-read this file in full at the start. It replaces the previous
   session's context.
2. Pick the next item from "Discussion order" below. Don't jump
   ahead unless a prerequisite is naturally settled along the way.
   The user will flag if a topic needs an earlier resolution first.
3. Discuss with the user: lay out options + trade-offs; let the
   user decide. Per [CLAUDE.md](../CLAUDE.md), never make design
   decisions autonomously.
4. Update this file with the outcome — move resolved items into
   "Settled decisions", remove or supersede stale `[proposal]`
   sketches, add new sub-questions surfaced by the resolution.
5. Commit + push on this branch; end the session. Each session
   produces one commit on this branch.

**After the design is fully settled:**

- Open a PR merging this scratchpad into main.
- Then create separate branches for each canonical landing pad
  (see "Files this will eventually touch" at the bottom). Don't
  author canonical primitive / implementation docs from this
  design branch; this branch produces only the scratch.

## Discussion order

1. **Token issuance model** — *fully settled. Decaying calendar
   mint (peer-network curve), no fresh premine, peer-token
   percentage carry-forward, POL mechanism (V3 one-sided above
   spot, TWAP_24h-anchored hourly sub-deposits), POL fees flow
   to treasury (β).*

   *Eliminated non-burn distribution candidates: (i), (W), (X),
   (Y), (Z), (γ) — see A.*
2. **Campaign settlement behavior** — *fully settled.
   Advertiser-discretionary release `P ∈ [0, D]` (D monotonically
   non-decreasing), symmetric flat-on-D + scaling-on-P fee
   structure preserves anti-spam cost on refund-only settlements,
   30-day default settlement at `P = min(1, achieved/goal)·D`,
   free unlimited extensions, campaign primitive lives as a graph
   node with payment edges on settlement.*
3. **"Achieved h_gain" definition for default settlement** —
   *fully settled. Sustained-level metric:
   `achieved_h_gain = max { L : h ≥ L for some continuous interval
   of length ≥ τ }` over `[start_ts, end_ts]`, τ ≈ Δt/3 (exact
   value deferred to economics.md authoring). Continuous credit
   for sustained reach at any level; spike attacks earn zero
   structurally.*
4. **Attribution math concretization** — *fully settled. Shapley
   via per-path equal split among distinct authors:
   `φ_i = Σ_{π∋i} w_π / |A_π|`. Exact — `h` is a linear path-sum,
   so the 2ⁿ coalition blowup collapses to per-path arithmetic.
   Target excluded; anchor a full player; signed multiplication
   carries through; net-negatives floored. Streaming settlement,
   O(players) memory. Bot-cluster flagging folded into
   feed-ranking §3.8.2 (advisory at settlement, no auto-action);
   earnings-by-distance governed by an advertiser-chosen `d(R)`
   base, exact-Shapley preserved.*
5. Action gating specifics (which actions; quota shapes; CGT
   prices; how the soft-quota threshold gets set).
6. Wallet onboarding & claim-escrow policy.
7. Marketplace + infrastructure primitive scoping — in this design
   pass or deferred to a follow-up workstream?
8. Q19 stake-gated quorum reopen (now that a token exists).
9. Q16 `S(t)` input candidates (token-related or unrelated).
10. Authoring plan: which canonical docs in which order; what
    splits between `economics.md` / `token.md` / `ledger.md`.

## Next session pickup

**Topic 4 closed. Next: Topic 5 — action gating specifics
(which actions; quota shapes; CGT prices; how the soft-quota
threshold gets set).** Attribution is settled: Shapley via
per-path equal split among distinct authors,
`φ_i = Σ_{π∋i} w_π / |A_π|`, computed exactly because `h` is a
linear sum over paths. See *Settled decisions* and the
*C — Attribution math* section.

The auto-settlement attribution snapshot is now pinned: `t*` is
the **binding-minimum instant** of the qualifying interval `I`
(`h(t*) = h_start + L*`), so pool size and split read off one
graph state. See the *Attribution snapshot `t*`* settled bullet.

Both Topic-4 tails are now closed. Bot-cluster flagging folds
into the existing §3.8.2 delta-funnel auto-detection — advisory
at settlement, manual `(0,0)` severance only, no auto-cut. The
root-concentration dampener resolves into the `d(R)` base `g`:
advertiser-chosen per campaign (default `0.1`), steep concentrates
on the anchor, soft spreads to target-proximate contributors,
exact-Shapley preserved; the within-path reactor-tilt is rejected.
See *Settled decisions* and *C — Attribution math*.

**Invite-reward addendum (settled).** The full-payout 3% burn now
splits 2% burn + 1% to the earner's direct inviter, carved from
burn (the earner's 95% is untouched), pure-P so the `0.05%·D`
anti-spam floor is unchanged. The invite relationship gets an
explicit `:INVITE` edge label for fast settlement-time inviter
resolution. Modifies the Topic-2 conservation equation; strict cap
(`0.96·P < D`) and self-deal floor re-audited and hold; the only
cost is a one-third cut to the per-campaign deflation sink. See
*Settled decisions* and *A — Token shape*.

---

## Guiding principles surfaced in discussion

- **Fair > cheap.** Pick the cheapest only among equally-fair
  options.
- **Public auditability** of money flows is a design north star —
  vendors and buyers can't silently scam each other when contracts
  + payments are graph-visible.
- **Maximize free user actions; price only at the margins.**
  Gating exists to stop spam and fund infrastructure, not to
  extract from normal use.
- **Costs are explicit, not hidden.** "If it's free, you're the
  product" is a real observation — compute, storage, and bandwidth
  cost real resources; someone always pays. CoGra's answer is to
  make the payment relationship visible (host edges, transfer
  edges) instead of monetizing user data. Self-hosters pay nothing
  to the network; hosted users pay their host; net-negative users
  (consume more than they contribute) are sponsored explicitly by
  whoever values them, or pay themselves. Data is free for all;
  what gets paid for is *service delivery*, not data access.
- **Early-holder upside comes from demand growth, not from
  rewarding squatters.** Token price rises if advertiser demand
  outpaces fixed or slow-growing supply; "joined early and held"
  benefits from the rise without a mechanism that pays inactive
  early users on a calendar.
- **Per-action distribution is the anti-pattern, not calendar-mint
  per se.** The peer-network spec rewarded users per-activity
  (likes, posts, comments), which bots beat humans at. That
  *distribution* mechanism is rejected. The spec's *supply curve*
  (fixed daily mint with annual decay) is the chosen issuance
  shape — see *A — Token shape*.

---

## Settled decisions

- **Native CGT token, on-chain.** `[settled]` Advertisers buy CGT on
  a DEX and fund campaigns in CGT. Ledger is the chain.
- **Campaign success metric = `h_anchor(target)`.** `[settled]`
  Single anchor node. The anchor's h already aggregates her
  cluster's paths — raising it is reaching her cluster.
- **Treasury share = 2%.** `[settled]` Other 98% distributed to
  contributors.
- **Fairness over cheapness.** `[settled]` Pick the cheapest only
  among equally-fair options.
- **Ledger home (Q20.2) = the chain.** `[settled]` Postgres holds
  campaign metadata (target, anchor, goal, budget, window, status).
  Memgraph holds the graph including transfer edges. No CoGra-side
  balance store.
- **Transfer edges: recorded, not feed-traversable.** `[settled,
  with flex]` Leaning non-traversable for ranking; user noted some
  merit to making them traversable. Reopen if marketplace work
  creates pressure.
- **Action gating: reluctantly yes, scoped.** `[settled]` Used for
  (a) anti-spam on high-fanout actions and (b) compensating
  infrastructure providers for hosted users. Default posture:
  maximize free actions; price only at the margins.
- **Issuance shape = decaying calendar mint, asymptotic fixed
  supply.** `[settled]` Peer-network supply curve (fixed daily
  mint with ~10%/year decay, ~18M lifetime). Exact parameters
  TBD at `token.md` authoring (possibly a milder variant with
  smaller starting daily mint and gentler decay).
- **No fresh premine; initial CGT carries forward proportionally
  from existing peer-token holdings.** `[settled]` Existing
  peer-token holders (company, founders, alpha users) keep their
  *percentage* of the prior token state, translated into CGT —
  not unit-for-unit. Bootstraps initial LP liquidity and respects
  pre-existing holder expectations without creating new
  concentration in designated parties.
- **Two flows: marketing flow (redistribution) + calendar-mint
  top-up (new supply).** `[settled, direction]` Marketing flow
  routes existing CGT from advertiser to contributors. Calendar-
  mint top-up is *a* new-supply path into the system.
- **Strict cap: total-to-graph `< deposit` always.** `[settled]`
  Enforced structurally via advertiser-chosen release `P ∈ [0, D]`:
  contributors + inviters together take `0.96 · P ≤ 0.96 · D < D`.
  Self-deal coalition net is strictly negative for any (D > 0,
  P ≥ 0) under the floor structure below. Discretion adds reputation
  enforcement on top; mechanical guarantee unchanged.
- **Conservation equation, advertiser-discretionary `P ∈ [0, D]`.**
  `[settled]` Per campaign (calendar mint is separate; flows into
  POL, not through the campaign formula). Flat-on-D anti-spam floor
  on burn + treasury, scaling-on-P share split across burn,
  treasury, and the inviter reward. Totals match 95% / 2% treasury /
  2% burn / 1% inviter at `P = D`; floor of `0.05%·D` total fees
  (`0.03%·D` burn + `0.02%·D` treasury) on `P = 0` refund-only
  settlements. Strict cap holds:
  `P ≤ D ⟹ total-to-graph = 0.96·P ≤ 0.96·D < D`. Self-deal
  coalition cost = `0.0005·D + 0.0495·P` (`0.0005·D + 0.0395·P`
  with self-invited contributors), strictly positive for any
  (D > 0, P ≥ 0). Full formula and worked example in *A — Token
  shape*.
- **Long-run deflationary regime.** `[settled]` Total CGT supply
  evolves as `daily_mint − daily_burn`. Mint follows the peer-
  network decay curve (lifetime asymptote ≈ 18M CGT). Per-
  campaign burn ranges from a small floor (`0.03%·D` at refund-
  only settlements) to `2%·D` at full payout (the pull-marketing
  tax, net of the 1% redirected to inviters); persistent as long
  as campaigns run regardless of payout mix. After the mint decay tapers, burn dominates and
  supply contracts. Early in the curve, total-supply direction
  depends on campaign volume and payout-rate mix vs. then-
  current mint, but POL's demand-coupled release means *active*
  circulating supply tracks demand even when total supply grows.
  Long-run holding remains structurally attractive.
- **Concurrency: trivially independent under POL.** `[settled]`
  Per-campaign payouts use only D and γ; no shared pool state
  across campaigns. N concurrent campaigns each settle their own
  conservation equation independently.
- **Calendar mint = POL supply via demand-coupled release.**
  `[settled]` Calendar mint creates new CGT on schedule and
  deposits into the POL position. Mint enters *active*
  circulation only as buyers (typically advertisers funding
  campaigns) pull it from POL. Total supply grows on the calendar;
  active circulation grows on demand. Idle periods → POL
  accumulates CGT above-spot, drains on demand return.
- **Structural cap on any new-mint-to-graph mechanism.**
  `[settled, derived]` Any mechanism that creates new CGT and
  routes it to graph-defined recipients hits the same self-deal
  cap: per binding period, distribution `< γD = 0.05D`, else
  self-deal becomes profitable. Maximum net circulating-supply
  growth per binding = `γD − burn = 0.02D`, less with any safety
  margin. Future "distribute to active users" proposals must
  clear this audit first.
- **Asymptotic supply requires mint decoupled from burn
  activity.** `[settled, derived]` The peer-network curve has an
  asymptote because mint is *scheduled*. Any mechanism that ties
  mint amount to burn volume gives linear-in-volume supply →
  unbounded. POL (calendar mint into LP) preserves the
  asymptote; burn-coupled mint mechanisms do not.
- **POL mechanism = V3 one-sided concentrated liquidity above
  spot.** `[settled]` Each mint epoch deposits CGT into a fresh
  V3 position with range `[TWAP_24h, 5 × TWAP_24h]`. Position
  acts as resting limit-sell distributed across the range and
  rebalances naturally as advertisers buy (CGT → USDC) and
  contributors sell back (USDC → CGT) within the range. Demand-
  coupled supply release: mint enters active circulation only as
  buyers pull it. Requires V3-style DEX (Uniswap V3 or equivalent
  on an EVM L2 is the obvious fit).
- **POL cadence = hourly sub-deposits.** `[settled]` Daily mint
  split into 24 hourly micro-deposits of 1/24 each. Spreads MEV
  attack surface; per-event manipulation is uneconomic at this
  scale.
- **POL range anchor = pool TWAP_24h, not external oracle.**
  `[settled]` Cross-venue arbitrage pulls any single pool's spot
  toward consensus market price within seconds; 24h TWAP averages
  over that arb'd spot, so manipulating the anchor requires
  holding spot off natural for many hours of sustained capital
  deployment (uneconomic at typical mint sizes). External oracles
  (Chainlink etc.) overkill at the value-at-risk per deposit and
  add external dependency.
- **Mint schedule = peer-network curve, continuous from peer to
  CGT.** `[settled]` 5000 CGT/day at peer-genesis, 10%/year decay
  step. CGT inherits the schedule at peer's current point — no
  reset, no fresh premine. Present-day daily mint ≈ 4500 CGT.
  Lifetime supply asymptote ≈ 18M CGT. Decay-step name
  ("halvening-equivalent"), exact peer→CGT conversion ratio,
  initial split (LP seed / treasury / holder allocation), and the
  precise anchor of the next decay step deferred to token.md
  authoring (function of CoGra release date).
- **USD-flow ratio for active contributors = 0.95 × price-
  trajectory factor.** `[settled finding]` Active-user USD outcome
  per advertiser dollar = (marketing-flow %) × (CGT price at
  contributor sell / CGT price at advertiser buy). Marketing flow
  % = 0.95 (graph-determined via Shapley/conduit, ungameable).
  Trajectory factor follows supply/demand balance over the
  campaign window. Stable price → 95% USD. Mild deflation → >95%
  USD. POL MEV (front-running spot, JIT liquidity, range-boundary
  arb) attaches to POL's LP fee earnings, not contributor USD —
  both the 0.95 and the price trajectory are out of speculator
  reach.
- **POL fee disposition = fees flow to treasury (β).** `[settled]`
  Periodic `collect()` on POL's V3 positions; proceeds (mixed CGT
  + USDC) sent to treasury wallet. Treasury already takes 2% of
  campaign deposits in CGT; POL fees add an auxiliary CGT +
  counterparty stream. Treasury free to market-sell at discretion.
  Natural V3 fee tier for CGT/USDC = 0.30%. (α) hold-forever
  rejected: ignores a real auxiliary stream for no benefit. (δ)
  buyback-and-burn rejected: decoration on a deflation narrative
  already carried by campaign burn + the asymptotic mint curve.
- **Campaign settlement = advertiser-discretionary release.**
  `[settled]` Advertiser calls `settle(P)` with `P ∈ [0, D]` at
  any point during the window or up to 30 days after `end_ts`.
  Strict cap holds structurally via `P ≤ D`. Per-contributor
  split follows graph-computed attribution (Shapley); advertiser
  chooses pool size only, not who gets what fraction. Deposit D
  is monotonically non-decreasing — advertiser can top up at any
  time, cannot reduce (otherwise the flat-on-D floor would be
  zeroable pre-cancellation). Failure to settle within 30 days
  triggers default at
  `P = min(1, max(0, achieved_h_gain) / declared_goal) · D`.
  The `max(0, ·)` floors a negative `achieved_h_gain` (cluster
  severed advertiser) at zero — refund-only default in that case.
- **Fee structure = flat-on-D floor + scaling-on-P share.**
  `[settled, shape; exact numbers TBD]` Indicative values:
  `treasury = 0.0002·D + 0.0198·P`, `burn = 0.0003·D + 0.0197·P`,
  `inviter = 0.0100·P`. The flat-on-D anti-spam floor lives on
  burn + treasury only; the scaling-on-P share splits 2% treasury /
  2% burn / 1% inviter at `P = D`, and floors at `0.02%·D` treasury
  + `0.03%·D` burn (`0.05%·D` total, inviter 0) for refund-only
  settlements. Low floor chosen because honest failed campaigns
  shouldn't be punished heavily; `0.05%·D` is enough to deter
  spam-creation without burning honest advertisers.
- **Invite reward = 1% to the direct inviter, carved from burn.**
  `[settled]` Each earner's direct inviter receives `0.01·P` sized
  by that earner's Shapley share — 1% of the earner's payout-
  equivalent, drawn from what would otherwise burn (the earner's
  `0.95·P` is untouched; burn drops 3% → 2% at full payout). Pure-P,
  no D-floor: at `P = 0` nobody earned, so no inviter is paid and
  the `0.05%·D` anti-spam floor stays entirely with burn + treasury,
  unchanged. Single-hop — the direct inviter only, no chain, so no
  pyramid dynamic — and permanent: the `:INVITE` edge is never
  deleted, so the inviter earns over the invitee's lifetime (the
  intended bring-real-users LTV incentive). Genesis users have no
  inviter → their 1% falls back to burn. Not the rejected per-action
  distribution: the reward fires on the invitee *actually earning*
  from a campaign, which is already Shapley-gated on graph structure
  + severance, so it inherits that bot-resistance — a dead sybil
  invitee earns nothing, so its inviter earns nothing; bringing real,
  well-situated earners is the behavior being paid for. Mechanically
  safe: total-to-graph = `0.95·P + 0.01·P = 0.96·P < D` (strict cap
  holds); a self-deal that also controls the inviter slot recovers
  only its own campaign's burn, softening the penalty to
  `0.0005·D + 0.0395·P` (still strictly positive, ceiling `4%·D`) and
  adding no new extraction vector; not new mint, so the `γD` cap and
  the mint asymptote are untouched. Cost: a one-third cut to the
  per-campaign deflation sink — growth bought with deflation, an
  explicit trade.
- **`:INVITE` edge label.** `[settled]` The invite relationship is a
  normal traversable, dimension-carrying actor edge from inviter to
  invited — the first edge into any non-genesis node, since the
  graph grows only by invitation and no traversal can reach a node
  before that edge exists. Labeling it `:INVITE` denormalizes an
  already-derivable fact: it turns settlement-time inviter resolution
  (run per earner, per settlement) into an indexable typed lookup
  instead of a full in-edge scan with timestamp-min, and decouples
  the invite-fee economics from the implicit "first incoming edge is
  the invite" invariant (so a future feature that ever creates an
  earlier incoming edge can't silently misroute the fee). Correctness
  is unchanged under invite-only growth — the label is a performance
  + explicitness win, not a correctness fix.
- **Adjustability of campaign parameters.** `[settled]` Mutable
  before settlement: `end_ts` (free + unlimited extensions),
  `declared_goal`, and D (additive-only — D can be raised, never
  lowered, else the flat-on-D floor would be zeroable pre-
  cancellation). Immutable after creation: `anchor`, `target`, and
  `g` (the reach-profile / payout base) — they define the
  campaign's identity (who it's for, and what reach is bought);
  changing them would create a new campaign in disguise.
  Public visibility of every adjustment is the discipline; bad-
  faith edits surface on-chain and in graph state.
- **Campaign object lives as a graph node.** `[settled]` A
  `Campaign` node carries `(D, anchor, target, g, declared_goal,
  start_ts, end_ts, status, achieved_h_gain_at_settlement,
  settled_P)` as properties (`g` = the `d(R)` reach-profile base,
  see *Earnings-by-distance*). Edges: advertiser → Campaign
  (authorship); Campaign → anchor (declared target). On
  settlement, payment edges from Campaign → each contributor
  wallet carry the per-contributor payout amount as a property.
  On-chain transfers carry the CGT; the graph carries the
  public record + attribution + reputation surface. This is
  what gives the reputation layer something concrete to react
  to.
- **Reputation as additive enforcement.** `[settled]` The strict
  cap (`P ≤ D ⟹ payout ≤ 0.95·D < D`) keeps self-deal
  mechanically loss-making at a `0.05%·D` floor regardless of
  payout choice. Public visibility of advertiser settlement
  decisions + contributor flip-flopping adds a reputational
  cost on top: advertisers who refuse to pay on honest goal-met
  collapse `h_advertiser` (cluster flips edges to (0,0) /
  (-1,-1)); contributors who flip after payout signal a
  hostile-cluster pattern that future advertisers avoid. Bot-
  driven goal-hits are handled by advertiser declining
  settlement, extending the window, and posting a public call
  for the cluster to sever. Mechanical guarantees + public-
  transparent state + graph-native reputation compound rather
  than substitute.
- **Default-settlement metric = sustained-level.** `[settled]`
  `achieved_h_gain = max { L : h_anchor(target) ≥ h_start + L
  for some continuous interval of length ≥ τ }`, evaluated over
  `[start_ts, end_ts]`. The highest gain the campaign actually
  held for at least τ time, anywhere in the window. τ ≈ Δt/3
  (exact value deferred to economics.md authoring). Continuous
  credit for sustained reach at any level — a linear ramp 0→G
  yields `achieved = 2G/3` (payout `2D/3`); a campaign that
  reaches G in the first quarter and holds yields `achieved = G`
  (full D); a brief mid-window spike yields `achieved = 0` (no
  level sustained long enough to count). Rejected: peak-during-
  window (gameable by a single instantaneous spike, dangerous
  precisely in the absent-advertiser case the default exists
  for); end-of-window snapshot (contributors wiped by a late
  severance even when they did the work); time-weighted average
  (spike-resistant but under-credits honest ramp delivery at
  `D/2`, structurally underpaying the linear-delivery case).
- **Attribution rule = Shapley via per-path equal split.**
  `[settled]` Each contributor's payout share is the Shapley value
  of the path-sum game on `h_anchor(target)`. Because `h` is a
  linear sum over paths
  ([feed-ranking.md §4.2–4.3](primitive/feed-ranking.md)), each
  path is a unanimity requirement of its authors and the Shapley
  value has the closed form `φ_i = Σ_{π ∋ i} w_π / |A_π|` — the
  `2ⁿ` coalition blowup never appears.
  `w_π = d(R_π)·f(Δt_π)·(s_path + c_path)` is the same path weight
  feed-ranking sums into `h`; `A_π` is the set of distinct authors
  on path π. Rejected: leave-one-out (`Σ_{π∋i} w_π` — double-
  counts multi-author paths, over-rewards long-path participation)
  and magnitude-proportional split (magnitude already sets `w_π`,
  and in a product the *bottleneck* edge, not the strongest, is
  the most pivotal).
- **Players = authors (wallets); target excluded; anchor a full
  player.** `[settled]` `A_π` counts distinct *authors* of all
  edges *and* content nodes on the path (footprint dedup: an
  author counts once per path however many elements they own on
  it; a non-actor node is never paid, its author is). The target
  node is excluded — it is the advertiser, and a direct transfer
  is the alternative if they want to pay it. The anchor is a full
  player, typically the largest share (the influencer-marketing
  outcome); the anchor-vs-periphery share is set by the
  advertiser-chosen `d(R)` base (see the earnings-by-distance
  bullet below).
- **Sign carries through; net-negatives floored.** `[settled]`
  Signed multiplication rides through `w_π` unchanged (an even
  count of negative `dim1` → positive contribution; "enemy of my
  enemy" surfaces the advertiser and is credited). Forced by
  conservation — shares must sum to `h`. A contributor whose paths
  net negative gets `φ_i < 0`, floored to 0 (no clawback); the
  positive players renormalize to fill the pool:
  `payout_i = (φ_i / Σ_{j: φ_j > 0} φ_j) · 0.95·P`. A distrusted
  detractor earning via a double-negative path is an accepted
  property.
- **Attribution snapshot `t*`.** `[settled]` A single point in
  `[start_ts, end_ts]`, never settlement time. On active
  settlement the advertiser may select an earlier `t*` to exclude
  a late bot intrusion (defaulting toward `end_ts`). On auto-
  settlement `t*` is the **binding-minimum instant** of the
  qualifying interval `I` that realized `achieved_h_gain`
  (Topic 3): the instant within `I` where `h_anchor(target)` is at
  its minimum — `h(t*) = h_start + L*` exactly — first-occurrence
  tie-break. It is the only instant whose graph state's `h` equals
  the pool-defining level, so pool size and split are read off the
  *same* state — measured and paid on one ruler. It credits the
  load-bearing structure that held the sustained level at its
  thinnest; an early spike that decayed before the level was held
  is credited to whoever held it, not its builders — the
  sustained-not-peak property of Topic 3 carried into attribution
  (an accepted property). Free from the Topic-3 scan: the pass that
  finds `I` yields its argmin, then one attribution traversal —
  single-snapshot streaming cost unchanged. Rejected: end-of-`I`
  (credits late churn-in, the end-of-window failure mode),
  start-of-`I` (credits first-achievement, not who held the level),
  peak-in-`I` (over-credits transient over-delivery beyond `L*`),
  and time-average over `I` (breaks single-snapshot O(players)
  streaming).
- **Computation = exact, streaming, O(players) memory.**
  `[settled]` Enumerate above-dust paths anchor→target with
  branch-and-bound (prune when best-possible completion `< ε`); no
  hop cap — `d(R)` decay and `ε` bound the depth. `ε` is set by
  **author-aggregate payability**: a contributor's share sums over
  many individually sub-payable paths, so the path-level floor sits
  *below* the smallest payable CGT by the typical paths-per-author
  factor — else thinly-spread contributors are under-paid. The `ε`
  used is recorded on the `Campaign` node, so the split is
  reproducible and auditable. Distribute each path's weight to its
  authors as found, then discard it — memory `O(players M)`, never
  `O(paths P)`; time `O(P·L̄)`. This is the same path-sum traversal
  that computes `h_anchor(target)`, under the same dust floor — a
  **shared primitive feed-ranking does not yet carry** (it bounds
  path enumeration only by the R-cap and `d(R)`; see *Cross-cutting
  obstacles*). The cost bound is `ε` plus the per-campaign compute
  budget, not freeness relative to ranking. Flat in total graph size
  (only the anchor's dust-reachable neighborhood enters); exponential
  only in dense-corridor connectivity (simple-path counting is
  #P-hard), bounded in practice by `d(R)` + dust. Backstops for a
  pathological corridor: steeper `d(R)`, the per-campaign compute
  budget, a logged sampling fallback (never silent). Async/background;
  campaigns independent → trivially parallel.
- **Bot-cluster flagging at settlement = advisory only.**
  `[settled]` No campaign-specific bot detector and no automatic
  payout zeroing. The §3.8.2 delta-funnel auto-detection already
  surfaces bot bridges from path structure; the settlement
  traversal enumerates the same paths, so the advertiser's
  settlement view surfaces that signal as evidence for the
  discretionary `settle(P)` decision. Action stays manual — a
  cluster's `(0, 0)` severance gesture (feed-ranking §3.6–3.7),
  never an auto-cut at settlement, preserving §3.8.2's
  no-automatic-action rule. Bots are already handled structurally:
  severed accounts contribute 0, and the advertiser can decline,
  extend, or post a public call to sever.
- **Earnings-by-distance = advertiser-chosen `d(R)` base; no
  within-path tilt.** `[settled]` The anchor-vs-periphery payout
  profile is governed by `x = b·g·μ` (forward branching × `d(R)`
  base × mean per-edge magnitude); the only protocol-side lever is
  `g`, the `d(R)` decay base. The advertiser sets `g` per campaign
  (default = the canonical feed default `0.1`, set at campaign
  creation): steep `g`
  concentrates payout on the anchor (the influencer-marketing
  outcome), soft `g` spreads it toward target-proximate
  contributors. Any fixed `g` keeps `φ_i = Σ w_π/|A_π|` exact
  Shapley — it only rescales each `w_π`, conservation `Σφ = h`
  holds. The within-path reactor-tilt is rejected: it is the sole
  option that breaks exact Shapley and is redundant, since `g`
  already controls the same profile. `g` governs **both**
  `achieved_h_gain` and the payout split: it declares what reach is
  being bought (how far into the network counts) and pays exactly
  the contributors who delivered it — measured and paid on one
  ruler. `g` is immutable after creation (a broad-`g` declaration
  that lures distant helpers, then a steep-`g` switch at settlement
  to stiff them, would be bait-and-switch — so `g` is
  identity-defining alongside `anchor`/`target`). Declared up front
  and public on-chain, so contributors see the reach profile before
  they act; a stingy steep `g` is as visible as a stingy `P` and
  carries the same reputational cost. Mechanical safety unchanged:
  `g` redistributes the fixed `0.95·P` pool, never its size, so the
  strict cap binds for any `g`. At realistic effective branching
  `b ≈ 20–40` the anchor lands at ~15–37% of the pool as a single
  wallet under the default `g` — the influencer-as-main-benefactor
  outcome, far from the ~90% sparse-graph case.

---

## Open sub-questions

### A — Token shape

- **Chain choice.** Need cheap settlement, DEX composability,
  V3-style concentrated liquidity support (for POL), no single-
  operator risk. Candidates narrow to EVM L2s with Uniswap V3 or
  equivalent: Base, Optimism, Arbitrum. Solana could host POL via
  alternative concentrated-liquidity venues (Orca etc.) but
  decouples the mechanic from the canonical V3 implementation.
  `[proposal]` decide at primitive-writing time; chain choice is
  implementation.
- **Token issuance model: decaying calendar mint, asymptotic fixed
  supply.** `[settled, direction]` Peer-network supply curve —
  fixed daily mint with ~10%/year decay, ~18M lifetime asymptote.
  Possibly a milder variant (smaller starting daily mint + gentler
  decay) to soften the early-vs-late dropoff; not BTC-steep but
  somewhere in that family. Exact parameters TBD when authoring
  `token.md`.
  - **Rejected: large premine** — concentrates CGT in designated
    parties before any economy exists. Wrong distribution.
  - **Rejected: burn-and-remint (campaign-driven mint with
    burned advertiser deposit)** — economically equivalent to
    just paying contributors from the deposit, with extra steps,
    *unless* mint > burn, in which case it's inflation-as-subsidy
    and collapses into the calendar-mint design anyway.
- **Initial allocation: proportional carry-forward from existing
  peer-token holdings.** `[settled]` No fresh premine to designated
  parties. Existing peer-token holders (company, founders, alpha
  users) keep their *percentage* of the prior token state,
  translated into CGT — not unit-for-unit. This seeds initial LP
  liquidity and respects pre-existing holder expectations without
  creating new concentration.
- **Marketing-flow conservation equation.** `[settled]` Per
  campaign (calendar mint is separate; flows into POL, not
  through the campaign formula). Advertiser chooses release
  `P ∈ [0, D]` at settlement; flat-on-D anti-spam floor on burn +
  treasury, scaling-on-P share split across burn, treasury, and the
  inviter reward:

  ```
  D                  = contributor_payout + treasury + burn + inviter + refund

  contributor_payout = 0.95   · P                     (per Shapley)
  treasury           = 0.0002 · D + 0.0198 · P
  burn               = 0.0003 · D + 0.0197 · P
  inviter            = 0.0100 · P                     (1% to direct inviter)
  refund             = 0.9995 · (D − P)
  ```

  (Example rates; exact numbers TBD at economics.md authoring.)
  Strict cap: `P ≤ D ⟹ total-to-graph = 0.96·P ≤ 0.96·D < D`. At
  `P = D` (honest full payout): 0.95 / 0.02 treasury / 0.02 burn /
  0.01 inviter. At `P = 0` (refund-only, e.g. bot-driven hit
  declined by advertiser): 99.95% refunded, `0.02%·D` treasury and
  `0.03%·D` burn, inviter 0 (pure-P — no earner, no inviter paid).
  Self-deal coalition cost = `0.0005·D + 0.0495·P` (or
  `0.0005·D + 0.0395·P` if the coalition also controls the inviter
  slot, recovering only its own burn), strictly positive for any
  (D > 0, P ≥ 0); floor `0.05%·D`, ceiling `5%·D` (`4%·D`
  self-invited). Per-campaign net total-supply change = `−burn`,
  between `−0.03%·D` and `−2%·D`. System-wide daily total-supply
  change = `daily_mint(t) − Σ_campaigns burn`.

- **Worked example: one day in steady state, honest full
  payout.** Assume CGT ≈ $1, daily campaign volume D = $5000,
  all campaigns settle at `P = D` (advertisers satisfied with
  reach gained), present-day calendar mint ≈ 4500 CGT/day via
  hourly POL sub-deposits, V3 range `[TWAP_24h, 5 × TWAP_24h]`.

  | Flow | CGT movement | USD movement |
  |---|---|---|
  | Calendar mint → POL | +4500 CGT to POL position | — (above spot, awaiting buyers) |
  | Advertisers buy from POL | −5000 POL → +5000 advertiser | +$5000 to POL, −$5000 advertiser |
  | Campaign deposit | 5000 advertiser → campaign | — |
  | Burn | −100 CGT destroyed | — |
  | Treasury accrual | +100 CGT to treasury wallet | — |
  | Contributor payout | +4750 CGT to contributors | — |
  | Inviter reward | +50 CGT to inviters | — |
  | Contributors + inviters sell to POL | −4800 → +4800 POL | −$4800 POL → +$4800 to them |

  End of day: advertisers spent $5000, contributors received
  $4750 → **USD-to-contributor ratio = 95%** at stable CGT price
  (inviters take a further 1% = $50, for 96% total to graph
  wallets). POL position net change: `+4300 CGT`
  (= 4500 − 5000 + 4800) and `+$200 USDC` (= 5000 − 4800). POL
  naturally accumulates both sides — CGT from mint, USDC from the
  burn + treasury wedge in net trading flow.

  Long-run total-supply trajectory: `+4500 − 100 = +4400 CGT/day`
  net at present rates. Mint decays 10%/year; burn persists with
  campaign volume. After the decay arc tapers, burn dominates and
  supply contracts. Whether early-curve total-supply growth
  pressures price depends on demand scaling with adoption; POL's
  demand-coupled release means active circulating supply tracks
  demand even when total supply grows.

- **Gaming-attack audit on campaigns** (mechanical floor +
  reputation overlay):

  | Attempt | Mechanical outcome | Reputation outcome |
  |---|---|---|
  | Self-deal (advertiser ⇒ contributor) | Coalition loses `0.0005·D + 0.0495·P` always (`0.0005·D + 0.0395·P` if it also controls the inviter slot, recovering only its own burn); floor `0.05%·D` at P = 0, ceiling `5%·D` (`4%·D` self-invited) at P = D | Self-deal pattern visible in graph topology + on-chain wallet linkage; future advertisers + contributors discount |
  | Invite-farm for inviter rewards | Reward fires only on the invitee actually earning (Shapley-gated on graph structure + severance); a dead sybil invitee earns 0 → its inviter earns 0; single-hop, so no pyramid leverage | Sybil invitees severable like any other; bringing real earners is the intended behavior |
  | Refund-everything to evade payout on honest goal-met | `0.05%·D` mechanical cost only | `h_advertiser` collapses (cluster flips edges to (0,0) / (-1,-1)); brand poisoned for future campaigns |
  | Sybil contributors | Shapley measures structural contribution from graph; sybil-shaped subgraphs have low marginal Shapley | Severance fires on confirmed sybils; affected campaigns can re-settle post-severance |
  | Off-chain side payments to fake attribution | Attribution is graph-computed; off-chain payments don't move Shapley scores | — |
  | Cross-campaign coordination | Each campaign loses per formula, independently | Pattern visible across campaigns |
  | Contributor flip after payout ("got them dirty") | None — payout already settled | Cluster's hostile pattern visible to future advertisers; future advertising avoids them |
  | Cluster severance of advertiser (negative achieved h_gain) | None on coalition side — `max(0, achieved)` floors default-P at 0, advertiser likely refunds | Public signal: this cluster doesn't want this advertiser |
  | Bot-driven goal-hit | Advertiser declines settlement, extends window, calls publicly for cluster to sever bots | Honest cluster severs and re-earns; advertiser is seen acting in good faith |

- **POL MEV audit** (all bounded; none touch contributor USD):

  | Vector | Outcome |
  |---|---|
  | Front-run deposit by spot manipulation | TWAP_24h anchor + hourly sub-deposits: manipulation cost exceeds extractable value at typical mint sizes |
  | JIT (just-in-time) liquidity capturing fees | Extracts POL fee revenue, not principal; doesn't affect supply-management mechanic or contributor USD |
  | Range-boundary arbitrage | Reduces POL fee income, not principal; same as JIT |

  POL MEV attaches to fee earnings only. The 0.95 marketing-flow
  ratio (graph-determined) and the CGT price trajectory
  (mint/burn balance) are both out of MEV reach.

- **Eliminated candidates for non-burn mint distribution.**

  - **~~(i) Host / infrastructure with proof-of-resource.~~** Scrap.
    Big engineering overhead and off-ethos — distribution should
    flow to *relevant users*, not infrastructure providers, even
    if infra-providers can be proof-of-resource-verified.
  - **~~(W) Cap-relaxation for arms-length contributors.~~** Scrap.
    No un-gameable definition of "arms-length" exists — bots can
    span any graph distance with sybils, controlling both h(t)
    and hop count R between any two points in their fabricated
    sub-graph.
  - **~~(X) Target-supply commitment.~~** Not actionable. Best
    case the current mint shape is preserved — the open question
    is purely *where the mint goes*, not how much.
  - **~~(Y) Proof-of-personhood gated direct distribution.~~** Scrap.
    Off-ethos. Cogra's distinction is that bot/human resolution
    is a property of the *graph itself* (severance + topology), not
    of external differentiators (KYC, biometrics, IP scans, mouse
    tracking — all outdated and breakable).
  - **~~(Z) Importance-weighted distribution from burn activity.~~**
    Scrap. h(t) zero-jail handles free-riders structurally
    (severed/unconnected accounts contribute 0 to importance mass),
    but in-view self-deal still binds: bot funds campaign and is
    sole occupant of its own h-view neighborhood, capturing
    distribution back. Strict-cap reasoning extends to (Z) — per
    campaign distribution `< γD = 0.05D` or self-deal becomes
    profitable. At the cap, net circulating-supply growth =
    `γD − burn = 0.02D` per campaign, less with safety margin,
    and the growth lives in the campaign neighborhood — liquid
    market supply still contracts unless treasury continuously
    sells. Two shape problems on top of the small size: growth
    scales linearly with campaign volume → supply → ∞ (breaks
    the asymptotic curve), and supply direction depends on
    treasury policy rather than being structural. POL fills the
    same role without these issues.
  - **~~(γ) Periodic release of LP shares to users.~~** Scrap.
    "Release to users" requires a user-selection rule; any non-
    trivial rule (h-weighted, active-in-window, etc.) inherits
    (Z)'s self-deal exposure, any trivial rule (everyone equal
    proportional share) is a no-op stock split.

  Treasury-only direction (mint accrues directly to treasury for
  discretionary use) rejected as poor distribution narrative.

- **Treasury accrual currency.** `[settled]` Treasury takes CGT
  from campaigns (CGT-denominated, no conversion needed: floor
  `0.02%·D` plus `1.98%·P` per campaign) and CGT + counterparty
  (USDC) from POL fee collection (β). Treasury free to market-
  sell at its discretion.

### B — Campaign primitive

- **Who can be an anchor?** `[settled]` Any actor node. No
  consent required — severance is the implicit opt-out (anchor
  severs advertiser → paths through anchor collapse → cluster's
  rejection becomes a public signal that the advertiser will
  read at settlement).
- **Forbidden configurations.** `[settled]`
  - `anchor == target` (degenerate, `h(self)` undefined).
  - Negative-h campaigns (paying to *lower* someone's `h(t)`) —
    would weaponize severance and corrupt the safety primitive.
    Declared campaigns are increase-only. Achieved h_gain *can*
    be negative (cluster actively severs advertiser); the default
    formula floors at zero via `max(0, achieved_h_gain)`.
- **Campaign window and adjustability.** `[settled]` Advertiser-
  declared `end_ts`. Mutable before settlement: `end_ts` (free +
  unlimited extensions), `declared_goal`, and D (additive-only).
  Immutable after creation: `anchor`, `target`, `g` — they define
  the campaign's identity; changing them would create a new
  campaign in disguise. Settlement window = `end_ts + 30 days`; auto-
  settlement fires at the end if advertiser is absent.
- **Settlement.** `[settled]` Two paths: (a) advertiser calls
  `settle(P)` at any time during the window or up to 30 days
  after `end_ts`; (b) auto-settlement at `end_ts + 30 days` with
  default
  `P = min(1, max(0, achieved_h_gain) / declared_goal) · D`,
  where `achieved_h_gain = max { L : h_anchor(target) ≥ h_start
  + L for some continuous interval of length ≥ τ }` evaluated
  over `[start_ts, end_ts]`, τ ≈ Δt/3. Goal-hit detection is
  not a distribution trigger — it's a public signal feeding
  the advertiser's settlement decision and the default-P
  computation.
- **Concurrent campaigns.** `[settled]` Linear composition: each
  campaign computes attribution independently against its own
  anchor / target / window. A single edge can contribute to many.
  Per-campaign settlement is fully independent — no shared pool
  state across campaigns.
- **Graph representation.** `[settled]` `Campaign` node with
  properties `(D, anchor, target, g, declared_goal, start_ts,
  end_ts, status, achieved_h_gain_at_settlement, settled_P)`.
  Edges: advertiser → Campaign (authorship); Campaign → anchor
  (declared target). On settlement, payment edges from Campaign
  → each contributor wallet carry the per-contributor payout
  amount as a property. On-chain transfers carry the CGT; the
  graph carries the public record + attribution + reputation
  surface.

### C — Attribution math

- **Shapley via per-path equal split.** `[settled]` Per-contributor
  payout share = the Shapley value of the path-sum game on
  `h_anchor(target)`, which has the closed form

  ```
  φ_i = Σ_{π ∋ i}  w_π / |A_π|
  ```

  summed over all paths π from anchor to target containing an
  element authored by i, with
  `w_π = d(R_π)·f(Δt_π)·(s_path(π) + c_path(π))` the path weight
  (identical to the term feed-ranking sums into `h`,
  [§4.2–4.3](primitive/feed-ranking.md)) and `A_π` the set of
  distinct authors of every edge and content node on π. Equal
  split *is* exact Shapley because `h` is **linear** over paths:
  each path is a unanimity requirement of its authors (the kill
  rule makes every author on it equally necessary — drop one and
  the path dies), Shapley splits a unanimity game equally, and
  linearity sums those splits. Conservation: `Σ_i φ_i = h`.
- **Why the conduit earns without a special rule.** A node many
  paths route through appears in many `A_π`, collecting a share
  from each — no conduit-specific term. Equally, a node on a single
  path through a weak edge still earns its `1/|A_π|` of that path,
  because without it the path would not exist at all.
- **No gain/baseline/cut-off split.** `[settled]` Attribution runs
  on the absolute, time-decayed `h` at `t*`. `f(Δt)` already fades
  stale contributions to near-zero (a 1-year reactor edge ≈
  `2×10⁻⁴` of fresh at the 30-day half-life), so recent reach
  dominates without separate "new path" machinery. One unified
  game keeps the computation clean and lets conduit credit fall
  out naturally.
- **Players, target, anchor, non-actor nodes.** `[settled]` Player
  = author (wallet). `A_π` dedupes by author across edges and
  content nodes; a non-actor node is never paid, its author is.
  Target excluded (it is the advertiser). Anchor is a full player.
- **Sign and floor.** `[settled]` Signed multiplication carries
  through `w_π` (even count of negatives → positive contribution,
  credited; forced by conservation). `φ_i < 0` floored to 0, no
  clawback; positives renormalize to the pool `0.95·P`.
- **Cost.** `[settled]` Streaming branch-and-bound enumeration;
  `O(players)` memory, `O(P·L̄)` time, bounded by the per-campaign
  dust floor `ε` (set by author-aggregate payability, recorded for
  reproducibility) and the per-campaign compute budget. Full scaling
  treatment and backstops in the *Computation* bullet under *Settled
  decisions*.
- **Bot-cluster flagging = advisory at settlement.** `[settled]`
  No campaign-specific detector; §3.8.2 delta-funnel auto-detection
  surfaces bot bridges, the settlement view shows it to the
  advertiser as evidence for `settle(P)`, and action stays the
  manual `(0, 0)` severance gesture. See *Settled decisions*.
- **Earnings-by-distance = advertiser-chosen `d(R)` base.**
  `[settled]` Profile set by `g` (default `0.1`, advertiser-tunable
  per campaign); steep concentrates on the anchor, soft spreads to
  target-proximate. Exact-Shapley preserved (per-path reweight);
  the within-path tilt is rejected as redundant and
  Shapley-breaking. See *Settled decisions*.

### D — Ledger & on-chain mechanics

- Chain is the ledger; CoGra signs payout Merkle roots after each
  campaign closes; contributors claim from a payout contract.
- Postgres holds campaign metadata; Memgraph holds graph including
  transfer edges; chain holds balances and claim state.
- `[proposal]` Campaign object lives in Postgres as
  `(id, advertiser_id, target_node_id, anchor_node_id, goal_metric,
  budget_cgt, start_ts, end_ts, status, merkle_root_at_close)`.
- `[proposal]` Per-user wallet linkage is a `WalletAddress` system
  property on User / Collective nodes — not feed-traversable.

### E — Transfer edges & marketplace future

- **Edge type `:TRANSFERS`** (working name). Source = sender actor.
  Target = receiver actor. Tensor `(0, 0)` actor dims (no ranking
  contribution). System dimensions carry: amount, currency, on-chain
  tx hash.
- **System-dimension slot needs formalization.** CLAUDE.md mentions
  "2 dimensions + system dimensions" but
  [edges.md](primitive/edges.md) does not yet codify how system
  dimensions look. Need a small primitive addition to host
  `:TRANSFERS` cleanly.
- **Future expansion (out of scope for first economics PR).**
  - Marketplace: extend [items.md](instances/items.md) with price
    + listing semantics.
  - Contracts: graph-native escrow / multi-step agreements.
  - Proof-of-fulfillment edges (or junction nodes, user's hint)
    between contract and payment.
  - Public auditability — vendors and buyers can't silently scam
    each other when contract + payment edges are all visible.

### F — Action gating & infra payment

- **The pull-marketing spam attack.** Actor spams posts with
  `:REFERENCES` to Teufel during a Teufel campaign to harvest
  budget. Brakes:
  1. Existing severance — community severs spammer, paths collapse.
  2. Fanout-budget on `:REFERENCES` ([edges.md §2](primitive/edges.md)) —
     caps how many references one post can carry.
  3. `[proposal]` Soft per-day quota on `:REFERENCES` creation and
     post creation; CGT cost only above the quota. Free for normal
     users, expensive for spammers.
- **Infra payment.** Any node hosting its own data pays nothing.
  Hosted users pay their host. Host-of-record is a graph-recorded
  property.
  - `[proposal]` Hosts set their own prices; hosting marketplace
    lives downstream of the marketplace primitive above.
- **Posture.** User-free-actions are the default. CGT cost is *only*
  at the margins (exceeding soft limits, paying a chosen host). Keep
  the "you are the product" surface closed.

---

## Cross-cutting obstacles

- **Dust floor is a shared feed-ranking dependency.** Attribution and
  `achieved_h_gain` ride the path-sum traversal that computes `h`,
  bounded by a branch-and-bound dust floor `ε`. Feed-ranking does not
  yet have one — it bounds enumeration only by the R-cap and `d(R)`,
  so un-dusted `h` is `O(b^R)` and uncomputable for high-degree nodes
  in the late graph (a ~1000-out-edge hub is only reachable at R≤2–3).
  The cost bounds above hold once feed-ranking adopts the shared dust
  floor: finest the compute budget allows (≈0 when the graph is sparse
  and `b^R` is cheap anyway, rising only under dense-graph load).
  Coarsening loses little when dense because weak-distant aggregate
  signal is redundant — content buzzing at R3 is carried inward at full
  weight by the R2 nodes that react to it — while sparse early graphs
  propagate slowly and need the fine floor. Adding it is a feed-ranking
  primitive change for a later session (own branch). The economics side
  uses the same mechanism with the payout `ε` of the *Computation*
  bullet (author-aggregate payability, recorded per campaign).
- **No-AI rule applies.** Attribution math is graph-computed, not
  learned. Shapley on the graph is fine; ML "fair share" is not.
- **Edge tensor uniformity.** `:TRANSFERS` must fit the
  `(dim1, dim2) + system` shape. `(0, 0)` actor dims + a
  system-dimension transfer payload is the cleanest fit, but
  requires formalizing the system-dimension slot in `edges.md`.
- **Q19 (stake-gated quorum) reopen.** Now that a real token
  exists, stake gating is reachable again. Risks: contradicts
  "anyone can fork" if excessive; concentrates power in early
  holders. `[proposal]` Note in `governance.md` as a follow-up,
  don't bundle into the first economics PR.
- **Q16 (`S(t)` derivation).** Token balance as input to `S(t)` →
  reject candidate, gives wealthy users intrinsic ranking
  advantage and corrupts the graph-is-truth principle. Token
  *activity* (recent transfers, campaign participation) is a
  different question and probably also out. **User call needed.**
- **Wallet onboarding UX.** Every CoGra user needs a wallet to
  receive payouts. Not a primitive question, but flag early —
  payouts to users without wallets accumulate to a claim escrow
  with some expiry policy.

---

## Deliberately deferred

- Marketplace primitive (items + listings + contracts).
- Hosted-user infra marketplace.
- Stake-gated governance quorum (Q19 reopen).
- Specific chain choice and mint schedule (implementation).
- Wallet UX / claim escrow mechanism.

---

## Files this will eventually touch

- **New** `docs/primitive/economics.md` — pull-marketing definition,
  campaign object, h-based goal, attribution math, treasury split.
  The "pull marketing" vocabulary anchor.
- **New** `docs/primitive/token.md` — CGT semantics, on-chain model,
  mint schedule. May merge into `economics.md` if small.
- **New** `docs/implementation/ledger.md` — chain integration,
  Merkle-claim mechanics, Postgres campaign-metadata schema.
- **Update** [docs/primitive/feed-ranking.md](primitive/feed-ranking.md) —
  add the dust floor `ε` (branch-and-bound path pruning); currently
  enumeration is bounded only by the R-cap + `d(R)`. Shared with the
  attribution cost bound (see *Cross-cutting obstacles*).
- **Update** [docs/primitive/edges.md](primitive/edges.md) —
  `:TRANSFERS` edge + formalize the system-dimension slot; add the
  `:INVITE` edge label.
- **Update** [docs/primitive/authorship.md](primitive/authorship.md) —
  cross-link to economics.md.
- **Update** [docs/instances/collectives.md](instances/collectives.md) —
  advertiser role.
- **Update** [docs/primitive/governance.md](primitive/governance.md) —
  Q19 reopen note.
- **Update** README.md and CONTRIBUTING.md — point "pull marketing"
  language at the new primitive.
- **Update** [docs/open-questions.md](open-questions.md) — close
  Q20, follow-ups on Q16 and Q19.
