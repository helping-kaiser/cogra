# Economics

CoGra's economy turns advertiser demand into contributor earnings
**through the graph and nothing else**. Who gets paid, and how much, is
read directly off graph structure — the same path-sum that drives
[feed-ranking](feed-ranking.md). No model scores "quality"; no ranking
signal is ever bought. The native token **CGT** is the unit of account,
the chain is the ledger of money, and the graph carries the
*relationships* — who ran a campaign, who delivered reach, who was paid
— plus pointers to the on-chain record.

> **Notation.** The symbols used here — `D`, `P`, `g`, `τ`, `φ_i`,
> `w_π`, `A_π`, `d(R)`, `s_path`, … — are defined in
> [notation.md](notation.md).

This doc defines the one economic primitive: **pull marketing**. CGT
issuance — the mint curve and protocol-owned liquidity ([token.md](token.md)) —
and the on-chain claim/escrow mechanics are separate docs; here we define the campaign,
how reach is measured, how the payout pool is split among contributors,
and how settlement is recorded on the graph. Design history:
[open-questions.md Q20](../open-questions.md).

**Invariant: no AI in the economics.** Reach measurement, attribution,
and payout are graph-computed — a Shapley value over the path-sum, not a
learned "fair share". Feed ranking and ad-revenue distribution are
driven only by the graph and its weights. This is the same hard boundary
[feed-ranking](feed-ranking.md) observes; AI as a frontend helper is
fine, but it must not touch the graph's signal or the economics
computation.

**Invariant: campaign payout and feed-default ranking use the same
path-weight formula.** What an advertiser buys is reach into the feeds
around the anchor, so both the success metric `h_anchor(target)` (§3) and
the payout weight `w_π` (§6.1) are computed with the **default** feed
formula ([feed-ranking.md §4](feed-ranking.md#42-the-four-metrics)) —
never a separate economics-only metric. Anything that reshapes the
default feed reshapes payout, and nothing else can.

> **Carve-out.** "Default feed" is the shared, viewer-independent
> ranking. Per-viewer personal layers — the
> [already-seen filter](feed-ranking.md#8-the-already-seen-filter) and the
> [friend-authored fresh-post reorder](feed-ranking.md#52-frontend-reordering-friend-authored-fresh-posts) —
> are not part of the reach an advertiser pays for and never enter the
> payout sum.

---

## 1. Pull marketing

Advertisers do not push ads into feeds. An advertiser posts a
**campaign**: a declared goal to raise the reach of a **target** node
into the cluster around a chosen **anchor**, funded with a CGT deposit.
Contributors earn by *delivering* that reach — by sitting on a path from
the anchor to the target, i.e. by being someone the anchor's cluster
deliberately pointed at.

- **Target** — the node being promoted: any node the advertiser wants the
  anchor's cluster to reach — their own node, a profile, or a specific
  Post. The target's author is **excluded** from payout (§6): the campaign
  already buys the target reach and boosts its popularity, so it does not
  also draw from the contributor pool.
- **Anchor** — the influencer / community root whose cluster's reach is
  bought. Raising `h_anchor(target)` means making the anchor's cluster
  reach the target. Any actor node can be an anchor, and **no consent is
  required** — there is no opt-out, because no actor can force the edges
  of the people around them. An anchor who rejects the advertiser can say
  so directly (a visible `(-1, -1)` edge toward them) or post a call for
  their community to push the target away, but cannot by themselves stop
  reach from forming: if the actors the anchor points at choose to pull
  the target closer, the anchor's only unilateral recourse is to sever
  (`(0, 0)`) every one of their own edges toward those actors — isolating
  themselves. Severance is local — it only moves the severing actor away,
  never forces anyone else
  ([feed-ranking.md §3.7](feed-ranking.md#37-cascading-severance-and-redemption)).
  The advertiser reads whatever rejection surfaces as a public signal at
  settlement.
- **Contributors** — every author on an `anchor → target` path. They are
  the people whose deliberate edges carried reach from the anchor's
  cluster to the target.

### 1.1 You earn by being deliberately pointed at

A campaign buys **reach delivered into the target's cluster**, so a
contributor earns only by sitting on an `anchor → target` path —
reachable from the anchor through edges *others* deliberately created
toward them or their content. Unreached content earns nothing from a
campaign however good it is: the graph has no quality signal to pay, and
adding one would be the economics→AI move the no-AI invariant forbids.
The graph pays *delivered reach* instead.

This is a deliberate property of the deliberate-decisions network, not a
limitation to apologize for:

- **The earning unit is the referencing content's in-cone engagement,
  not follower count.** A single referencing post that picks up
  reactions from within the anchor's reach cone earns — its author is a
  path player per §6 — so "no followers" does not mean "cannot earn".
- **The bridge from quality to standing reach is the explicit
  follow / engagement gesture** ([feed-ranking.md §3.1](feed-ranking.md#31-which-edges-contribute-factors)),
  which a frontend may nudge after repeated engagement. It is never a
  `Content → Author` back-edge: that would amplify one real engagement
  across the author's unbounded, self-chosen outbound content set (a bot
  funnel) and break the inbound-edges-don't-affect-feeds invariant
  ([graph-model.md §7](graph-model.md#7-directionality-inbound-edges-dont-affect-your-graph)).

---

## 2. The Campaign node

A campaign is a first-class graph node. It carries the campaign's terms
as node properties and connects to the advertiser and anchor by edges,
so the whole arrangement is public and auditable on the graph.

| Property | Meaning |
|---|---|
| `D` | Pointer to the **on-chain escrow** holding the deposit. The amount is read from chain, never asserted as a bare number on the node; funded at creation and top-up only (§2.2), so the §5 floor is always backed. |
| `g` | The `d(R)` decay base used for this campaign's reach metric and payout split (§6.4). Default `0.1`, the canonical feed default. |
| `h_start` | `h_anchor(target)` at `start_ts` — the baseline. With `declared_goal` it makes the ask legible: from `h_start` to `h_start + declared_goal`. |
| `declared_goal` | The `h_anchor(target)` gain the advertiser is aiming for; denominator of the default-settlement formula (§4). Must be `> 0` (§2.1). |
| `start_ts`, `end_ts` | Campaign window. |
| `status` | Lifecycle state (open / settled / auto-settled). |
| `dust_floor` | The dust floor bounding path enumeration — public at creation, tuneable during the campaign as a compute failsafe; the value in force at settlement is recorded for reproducibility (§6.5). |
| `achieved_h_gain` | Layered. A public running record of the instantaneous gain `h_anchor(target) − h_start`, one layer appended per sample over the run (§2.3). Approximate progress only; the settled sustained-level figure is on the `:Settlement` node (§7). |

Money amounts never live on the node: the deposit is held in escrow
on-chain, and per-contributor payout figures and transfer sizes are
on-chain too (§7). The node carries the public record, the attribution
surface, and pointers to the chain.

**Edges.**

- `advertiser → Campaign` — authorship (`:AUTHOR`, per
  [authorship.md](authorship.md)). A normal actor edge.
- `Campaign → anchor` (`:ANCHOR`) — declares the anchor, so the anchor's
  cluster can see the campaign and respond to it.
- `Campaign → target` (`:PROMOTES`) — declares the promoted node: any
  actor, content, or Proposal node (not Hashtag) the advertiser wants the
  anchor's cluster to reach (a Post, a profile, their own node) — not
  smuggled through the authorship edge.
- `Campaign → Settlement` — created once, at settlement (§7).

The three `Campaign`-outbound edges (`:ANCHOR`, `:PROMOTES`, and
`Campaign → Settlement`) are `(0, 0)` and **non-traversable for feed
ranking** ([feed-ranking.md §3.5](feed-ranking.md#35-traversal-restrictions)).
A campaign records an economic relationship; it must never inject reach
toward the target. The reach is delivered by real contributor edges, and
letting `Campaign → target` carry signal would be buying ranking
directly — the economics→ranking feedback the no-AI invariant forbids.

### 2.1 Success metric and forbidden configurations

The campaign's success metric is `h_anchor(target)` — the personal
opinion metric of [feed-ranking.md §4.2](feed-ranking.md#42-the-four-metrics)
computed with the **anchor** as root node and the **target** as the
ranked node. The anchor's `h` toward the target already aggregates the
anchor cluster's paths, so raising it *is* reaching the cluster.

Two configurations are forbidden:

- **`anchor == target`** — degenerate; `h(self)` is undefined.
- **Negative-`h` campaigns** (paying to *lower* a node's `h`) — this
  would weaponize severance and corrupt the safety primitive. Declared
  campaigns are increase-only. (Achieved gain *can* still come out
  negative when a cluster actively severs the advertiser; the default
  formula floors that at zero — §4.)
- **Non-positive `declared_goal`** (`declared_goal ≤ 0`) — the
  auto-settlement formula (§4) divides by `declared_goal`, so a zero or
  negative goal leaves the default release undefined. Declared goals are
  strictly positive: `declared_goal > 0`.

### 2.2 Adjustability

Public visibility of every adjustment is the discipline: bad-faith edits
surface on-chain and in graph state.

- **Mutable before settlement:** `end_ts` (free, unlimited extensions),
  `declared_goal`, `dust_floor` (tuneable as a compute failsafe — §6.5), and the
  escrowed `D` — **top-up only**: `D` can be raised, never lowered
  (otherwise the flat-on-`D` anti-spam floor in §5 would be zeroable just
  before settlement, and the locked escrow is what backs that floor).
- **Immutable after creation:** `anchor`, `target`, and `g`. These
  define the campaign's identity — who it is for, what node is promoted,
  and what reach profile is bought. Changing them would create a
  different campaign in disguise. `g` is identity-defining specifically
  because a broad-`g` declaration that lures distant helpers, then a
  steep-`g` switch at settlement to stiff them, would be a
  bait-and-switch (§6.4).

### 2.3 Running progress

Independently of how it settles, every campaign continuously publishes
its progress so the advertiser and the anchor cluster can watch reach
mid-run. At a fixed cadence — sparse in *time* (≈30–90 evals over a
typical window) but with each `h`-eval as fine as compute allows — the
system samples `h_anchor(target)` and appends the **instantaneous** gain
`h_anchor(target) − h_start` as one layer on the layered
`achieved_h_gain` property of the `Campaign` node, in the background,
per-campaign-parallel.

It is a deliberately **approximate** public progress curve — approximate
because it is sparse in time and instantaneous, not because any eval is
coarse — and never a payout input. The settled figure is the one-time
sustained-level reduction of this same curve (§3), recorded on the
`:Settlement` node at settlement (§7); auto-settlement reuses these
stored samples for that reduction rather than scanning afresh.

---

## 3. Achieved reach — the sustained-level metric

Default settlement (§4) needs a single number for "how much reach did
the campaign actually deliver?" That number is the **sustained-level**
gain:

```
achieved_h_gain = max { L : h_anchor(target) ≥ h_start + L
                            for some continuous interval of length ≥ τ }
```

evaluated over `[start_ts, end_ts]`, where `h_start` is `h_anchor(target)`
at `start_ts` and **`τ = (end_ts − start_ts) / 3`** — a third of the
campaign window. It is the highest gain the campaign actually *held* for
at least `τ`, anywhere in the window.

This gives **continuous credit for sustained reach at any level**, and
spike attacks earn zero structurally:

- A linear ramp `0 → G` over the window holds level `2G/3` for the final
  third → `achieved = 2G/3`.
- A campaign that reaches `G` early and holds → `achieved = G`.
- A brief mid-window spike that decays before `τ` elapses → no level was
  held long enough → `achieved = 0`.

Rejected alternatives: **peak-during-window** (a single instantaneous
spike games it — dangerous precisely in the absent-advertiser case the
default exists for); **end-of-window snapshot** (a late severance wipes
contributors who did the work); **time-weighted average** (spike-
resistant but under-credits an honest ramp at `D/2`, structurally
underpaying linear delivery).

**Cost.** The reduction reads the `h_anchor(target)` gain trajectory the
campaign already records as it runs (§2.3) — no separate scan. It runs
over those stored samples, adding `end_h` and, for an advertiser
settling early, one eval at the chosen `t*` (§6.3). Every eval —
`h_start`, the stored samples, `end_h`, `t*` — is computed at the same
precision, as fine as compute allows, so subtracting them never mixes
precisions and biases the gain.

---

## 4. Settlement and release

Settlement is a **single terminal event**. The advertiser settles once,
when satisfied with the reach achieved; that act creates the on-chain
payout tree and the on-graph `Settlement` node together (§7). There is
no re-settlement. Two paths reach it:

1. **Advertiser-discretionary.** The advertiser calls `settle(P)` with a
   chosen release `P ∈ [0, D]`, at any time during the window or up to
   **30 days after `end_ts`**. The advertiser chooses the pool size `P`
   only — never who gets what fraction; the split is graph-computed (§6).
2. **Auto-settlement.** If the advertiser is absent at `end_ts + 30
   days`, settlement fires automatically with

   ```
   P = min(1, max(0, achieved_h_gain) / declared_goal) · D
   ```

   The `max(0, ·)` floors a negative `achieved_h_gain` (a cluster that
   severed the advertiser) at zero — a refund-only default in that case.

The 30-day post-`end_ts` window is an **evaluation** window, not a
second settlement: the advertiser uses it to extend `end_ts`, inspect
the trajectory, and call publicly for bot severance — none of which
writes a settlement. Severance happens *before* settlement, so the
advertiser is not paying bots when they commit.

**`P ∈ [0, D]` is discretionary because reach is not binary.** A
campaign rarely "succeeds" or "fails" cleanly; the advertiser releases
what the delivered reach was worth to them. Goal-hit detection is **not**
a distribution trigger — it is a public signal feeding the settlement
decision and the default-`P` computation. Bot-driven goal-hits are
handled by declining to settle, extending the window, and posting a
public call to sever (§8, and the reputation overlay in §5.3).

---

## 5. The conservation equation

Every campaign conserves its deposit. Per campaign (CGT issuance is
separate — it flows into protocol-owned liquidity, not through this
formula):

```
D                  = contributor_payout + treasury + burn + inviter + refund

contributor_payout = 0.95   · P                     (split per §6)
treasury           = 0.0002 · D + 0.0198 · P
burn               = 0.0003 · D + 0.0197 · P
inviter            = 0.0100 · P                     (§5.2)
refund             = 0.9995 · (D − P)
```

The structure: a **flat-on-`D` anti-spam floor** on burn + treasury, plus
a **scaling-on-`P` share** split across burn, treasury, and the inviter
reward.

- At `P = D` (honest full payout): `0.95` to contributors, `0.02`
  treasury, `0.02` burn, `0.01` inviter.
- At `P = 0` (refund-only — e.g. a bot-driven hit the advertiser
  declines): `99.95%` refunded, `0.02%·D` treasury and `0.03%·D` burn,
  inviter `0`. The floor is deliberately low because an honest failed
  campaign should not be punished heavily; `0.05%·D` is enough to deter
  spam-creation without burning honest advertisers.

### 5.1 The strict cap

**Invariant: total-to-graph `< D` always.** Contributors and inviters
together take `0.95·P + 0.01·P = 0.96·P`, and `P ≤ D`, so

```
total-to-graph = 0.96·P ≤ 0.96·D < D.
```

A self-deal coalition (advertiser funding their own contributors) is
therefore mechanically loss-making for any `(D > 0, P ≥ 0)`: it spends

```
0.0005·D + 0.0495·P
```

(or `0.0005·D + 0.0395·P` if it also controls the inviter slot,
recovering only its own burn) — strictly positive, floor `0.05%·D`,
ceiling `5%·D` (`4%·D` self-invited). The cap holds for **any** `g`
(§6.4 redistributes the fixed `0.95·P` pool, never its size) and across
**concurrent campaigns** (each settles its own equation independently —
no shared pool state). Reputation (§5.3) adds enforcement on top of this
mechanical guarantee; it never substitutes for it.

### 5.2 The inviter reward

Each earner's **direct inviter** receives `0.01·P` sized by that
earner's own payout share — 1% of the earner's payout-equivalent, carved
from what would otherwise burn (the earner's `0.95·P` is untouched; burn
drops from 3% to 2% at full payout).

- **Pure-`P`, no `D`-floor.** At `P = 0` nobody earned, so no inviter is
  paid and the `0.05%·D` anti-spam floor stays entirely with burn +
  treasury.
- **Single-hop and permanent.** The direct inviter only — no chain, so
  no pyramid dynamic. The `:INVITE` edge is never deleted, so the
  inviter earns over the invitee's lifetime (the bring-real-users LTV
  incentive). Genesis users have no inviter; their 1% falls back to burn.
- **Not per-action distribution.** The reward fires on the invitee
  *actually earning* from a campaign, which is already Shapley-gated on
  graph structure and severance — a dead sybil invitee earns nothing, so
  its inviter earns nothing. Bringing real, well-situated earners is the
  behavior being paid for.

The `:INVITE` edge is a normal traversable actor edge from inviter to
invited — the first edge into any non-genesis node, since the graph
grows only by invitation. Its schema is defined in
[invitations.md](invitations.md#the-invite-label) and
[edges.md §3](edges.md#3-edge-labels-at-the-graph-layer).

### 5.3 Reputation as additive enforcement

The strict cap keeps self-deal loss-making regardless of payout choice.
Public visibility of settlement decisions adds a reputational cost on
top: an advertiser who refuses to pay on an honest goal-met collapses
their own `h` (the cluster flips edges toward `(0, 0)` / `(-1, -1)`),
poisoning the brand for future campaigns; contributors who flip-flop
after payout signal a hostile-cluster pattern future advertisers avoid.
Mechanical guarantees, public-transparent state, and graph-native
reputation compound rather than substitute.

---

## 6. Attribution — per-path Shapley

Settlement releases a contributor pool of `0.95·P` (§5). Who gets what
fraction of it is the Shapley value of the **path-sum game** on
`h_anchor(target)`.

### 6.1 The closed form

Because `h` is a **linear sum over paths**
([feed-ranking.md §4.2–4.3](feed-ranking.md#42-the-four-metrics)), each
path is a unanimity requirement of its authors — the kill rule
([feed-ranking.md §3.2](feed-ranking.md#32-zero-handling--kill-rule))
makes every author on a path equally necessary, since dropping any one
kills the path. Shapley splits a unanimity game equally, and linearity
sums those splits. The `2ⁿ` coalition blow-up never appears; the Shapley
value has the closed form

```
φ_i = Σ_{π ∋ i}  w_π / |A_π|
```

summed over every path `π` from anchor to target that contains an
element authored by `i`, where

- `w_π = d(R_π) · f(Δt_π) · (s_path(π) + c_path(π))` is the **same path
  weight** feed-ranking sums into `h` ([§4.2](feed-ranking.md#42-the-four-metrics)),
  and
- `A_π` is the set of **distinct authors** of every edge *and* content
  node on `π`.

Conservation holds: `Σ_i φ_i = h_anchor(target)`.

**Why the conduit earns with no special rule.** A node many paths route
through appears in many `A_π`, collecting a share from each. A node on a
single path through a weak edge still earns its `1/|A_π|` of that path,
because without it the path would not exist at all. No conduit-specific
term is needed.

Rejected: **leave-one-out** (`Σ_{π∋i} w_π` double-counts multi-author
paths and over-rewards long-path participation); **magnitude-
proportional split** (`w_π` already encodes magnitude, and in a product
the *bottleneck* edge, not the strongest, is the most pivotal).

### 6.2 Players, sign, and the floor

- **Players are authors (wallets).** `A_π` counts distinct authors of
  all edges and content nodes on the path, deduped by author (an author
  who owns several elements on one path counts once for that path). A
  non-actor node is never paid — its author is.
- **The target's author is excluded entirely** — not merely the endpoint
  node, and even when the target is a third party's content. The campaign
  already promotes the target and boosts its popularity, so the target
  does not also draw from the contributor pool (an advertiser who wants
  to pay a third-party target's author does so by direct transfer). The
  **anchor is a full player**, typically the largest single share (the
  influencer-marketing outcome).
- **Sign carries through.** Signed multiplication rides through `w_π`
  unchanged ([feed-ranking.md §3.3](feed-ranking.md#33-dim1-chain--signed-multiplication)):
  an even count of negative `dim1` yields a positive contribution, so an
  "enemy of my enemy" path surfaces the advertiser and is credited.
  Forced by conservation — shares must sum to `h`.
- **Net-negatives are floored, no clawback.** A contributor whose paths
  net negative gets `φ_i < 0`, floored to `0`; the positive players
  renormalize to fill the pool:

  ```
  payout_i = (φ_i / Σ_{j : φ_j > 0} φ_j) · 0.95·P.
  ```

  A distrusted detractor earning via a double-negative path is an
  accepted property.

### 6.3 The attribution snapshot `t*`

Attribution is computed at a single instant `t* ∈ [start_ts, end_ts]` —
never settlement time, so a late bot intrusion after the window cannot
dilute the honest split.

- **Active settlement:** the advertiser may select an earlier `t*` to
  exclude a late intrusion, defaulting toward `end_ts`.
- **Auto-settlement:** `t*` is the **binding-minimum instant** of the
  qualifying interval `I` that realized `achieved_h_gain` (§3) — the
  instant within `I` where `h_anchor(target)` is at its minimum, so
  `h(t*) = h_start + achieved_h_gain` exactly (first-occurrence
  tie-break). It is the only instant whose graph state's `h` equals the
  pool-defining level, so **pool size and split are read off the same
  state — measured and paid on one ruler.** It credits the load-bearing
  structure that held the sustained level at its thinnest; an early spike
  that decayed before the level was held is credited to whoever held it,
  not its builders (the sustained-not-peak property of §3 carried into
  attribution — an accepted property).

The pass that finds `I` yields its argmin for free, so auto-settlement
adds no scan beyond §3. Rejected: end-of-`I` (credits late churn-in),
start-of-`I` (credits first-achievement, not who held the level),
peak-in-`I` (over-credits transient over-delivery), time-average over `I`
(breaks single-snapshot streaming).

### 6.4 Earnings by distance — the `d(R)` base `g`

The anchor-vs-periphery payout profile is governed by `g`, the `d(R)`
decay base ([feed-ranking.md §4.1](feed-ranking.md#41-path-contribution-and-distance-decay)).
The advertiser sets `g` per campaign (default `0.1`):

- **Steep `g`** concentrates payout on the anchor — the influencer-
  marketing outcome.
- **Soft `g`** spreads payout toward target-proximate contributors.

Any fixed `g` keeps `φ_i = Σ w_π/|A_π|` **exact Shapley** — it only
rescales each `w_π`, so conservation `Σφ = h` still holds. `g` governs
**both** `achieved_h_gain` and the split: it declares how far into the
network counts as reach and pays exactly the contributors who delivered
that reach — one ruler again. It is immutable and public from creation
(§2.2), so contributors see the reach profile before they act; a stingy
steep `g` is as visible as a stingy `P` and carries the same reputational
cost.

The within-path **reactor-tilt** alternative is rejected: it is the one
option that breaks exact Shapley, and it is redundant since `g` already
controls the same profile. At realistic effective branching `b ≈ 20–40`,
the anchor lands at ~15–37% of the pool as a single wallet under the
default `g` — the influencer-as-main-benefactor outcome, far from the
~90% sparse-graph case.

### 6.5 Computation — exact, streaming, `O(players)` memory

The split is computed exactly by **branch-and-bound path enumeration**
from anchor to target, pruning a partial path when its best-possible
completion falls below a dust floor `ε`. There is no hop cap — `d(R)`
decay and `ε` bound the depth. As each above-`ε` path is found, its
weight is distributed to its authors and the path is discarded: memory is
`O(players)` — one running share per distinct author — never `O(paths)`;
time is `O(N_p · L̄)`, the edges walked across all `N_p` above-`ε` paths of
average length `L̄`.

This is the **same path-sum traversal that computes `h_anchor(target)`**,
under the same dust floor — a shared primitive that
[feed-ranking.md §4.4](feed-ranking.md#44-dust-floor--branch-and-bound-path-pruning)
defines. The economics side sets `ε` by **author-aggregate payability**:
a contributor's share sums over many individually sub-payable paths, so
the path-level floor sits *below* the smallest payable CGT amount by the
typical paths-per-author factor — otherwise thinly-spread contributors
are underpaid. `ε` is **public at creation and tuneable during the
campaign**: if the graph grows rapidly inside the window, the advertiser
raises `ε` to keep enumeration tractable — the advertiser's
responsibility. Tuning `ε` only ever moves the *dust* cutoff, so it can
shift near-floor shares but nothing material — unlike `g` (§6.4), which is
immutable because it reshapes the whole split — and every change is
public, carrying the same reputational discipline as any other
adjustment (§2.2). The `dust_floor` in force at settlement is recorded on the
`Campaign` node (§2) for a reproducible, auditable split.

Cost is flat in total graph size (only the anchor's dust-reachable
neighborhood enters) and exponential only in dense-corridor connectivity
(simple-path counting is #P-hard), bounded in practice by `d(R)` + `ε`.
Backstops for a pathological corridor: a steeper `g`, the per-campaign
compute budget, and a **logged** sampling fallback (never silent).
Campaigns are independent, so the work is trivially parallel and runs
async in the background.

### 6.6 Bot-cluster flagging is advisory only

There is no campaign-specific bot detector and no automatic payout
zeroing. The delta-funnel auto-detection of
[feed-ranking.md §3.8.2](feed-ranking.md#382-bot-cluster-identification--auto-detection-from-path-patterns)
already surfaces bot bridges from path structure; the settlement
traversal enumerates the same paths, so the advertiser's settlement view
shows that signal as **evidence** for the discretionary `settle(P)`
decision. Action stays manual — the actors closest to a bot bridge mark
their own edges into it `(0, 0)`, and every path through it dies at that
hop ([feed-ranking.md §3.6–3.7](feed-ranking.md#36-bot-resistance-via-the-0-0-severance-edge)) —
never an auto-cut at settlement. Bots are already handled structurally:
content reached only through severed bridges contributes `0`, and the
advertiser can decline, extend, or post a public call to sever.

---

## 7. Settlement on the graph — the claim flow

Money amounts live **on-chain only**; the graph carries relationships
and pointers. Settlement (§4) creates one **`Settlement` node** and the
on-chain payout tree together:

- The `Settlement` node carries the distributor address, the payout
  tree's Merkle root, and the public results (`settled_P`,
  `achieved_h_gain`) as node properties — pointers and scalars, never a
  money tensor. `Campaign → Settlement` records the settlement act.
- **Entitlement edges** `Settlement → Wallet` (`:ENTITLES`), one per
  claimant, mark "this wallet may claim". Bare `(0, 0)`, non-traversable,
  no amount.
- On claim, the claimant creates a **claim-back edge** `Wallet →
  Settlement` (`:CLAIMS`), marking "claimed". Entitlement-out and
  claim-back on the same node-couple make "entitled but unclaimed" a
  one-hop graph query.

Per-wallet payout figures are **Merkle leaves**, verifiable against the
root the `Settlement` node points at and surfaced in frontends — never
on-graph. Distribution is **claim, not push**: each contributor claims
by proof and pays their own gas; earnings rest non-custodially at the
account's counterfactual address and never expire. The distributor
mechanics, the self-custody onboarding, and where campaign data lives
across the stores are the ledger's concern, not this primitive's
([ledger.md](../implementation/ledger.md)).

A general **`:TRANSFERS` edge** records any wallet sending another CGT,
for public auditability of money flows. It is `(0, 0)` (no ranking
contribution, non-traversable); the on-chain tx reference rides the
edge's system-dimension slot, and amount + currency are read from chain
through it, never stored. Source is the sender, target the receiver. The
`Settlement` node, the entitlement / claim edges, and `:TRANSFERS` are
catalogued in [nodes.md](nodes.md) and
[edges.md](edges.md).

---

## 8. Action gating is a property, not a quota

CoGra applies **no anti-spam action quota**. The pull-marketing spam
attack — an actor flooding posts / comments with references to a
campaign target to harvest budget — is covered structurally, so a quota
would buy no marginal defense while taxing the exact behavior campaigns
reward. The funnel-capable actions are exactly `:REFERENCES`, reactions,
and comments (bare posts and tags are dead-end sinks; memberships, votes,
and proposals create only non-traversable edges per
[feed-ranking.md §3.5](feed-ranking.md#35-traversal-restrictions)). The
stack that covers them:

1. **Forward-only traversal** — bots cannot manufacture the inbound
   edges that would give farmed content weight
   ([graph-model.md §7](graph-model.md#7-directionality-inbound-edges-dont-affect-your-graph)).
2. **The `:REFERENCES` fanout-budget** — per-source amplification is
   capped at the source's budget regardless of `N`, and reference-
   flooding is self-defeating (weight spreads to `1/N` and dust-prunes)
   ([edges.md §2 "Reference"](edges.md#reference)).
3. **Severance / zero-jail** — the actors closest to a farm cluster
   cascade `(0, 0)` onto the bridges feeding it; once every path to the
   funneled target carries a severance edge, its `h` is forced to exact
   zero and the funneling author earns `0`
   ([feed-ranking.md §3.6–3.7](feed-ranking.md#36-bot-resistance-via-the-0-0-severance-edge)).
4. **The sustained-level metric** (§3) — bursts earn `0`.
5. **Advertiser discretion** (§4) — decline, extend, public call to
   sever, backed by the §6.6 advisory detection.

A per-day quota is also mis-targeted: the only attack surviving the stack
is a *slow, sustained* funnel held for `τ ≈ Δt/3`, which sits below any
reasonable per-day quota by construction.

**Accepted residual property.** A slow funnel sustained for `τ` against
an advertiser absent for the full 30-day window *and* a community that
fails to sever in time will auto-settle on the sustained metric — the
§6.6 detection is advisory-only, with no human present to act on it.
This is accepted, not fixed: it is bounded by the long `τ` and the
30-day window the advertiser chose to skip, capped at `0.95·P`, and
consistent with the structural-plus-human, no-algorithmic-gatekeeping
ethos. The fix would let auto-settlement act on the §6.6 signal, which
reopens the advisory-only rule — rejected as the heavier, ethos-breaking
option.

The only gating CoGra applies is **infrastructure payment** — a
resource-cost charge on hosted storage / serving, so hosts are
compensated for hosted users. A node hosting its own data pays nothing.
That mechanism belongs to the deferred marketplace / infra workstream;
the default posture here is to maximize free actions and price only at
that one margin.
