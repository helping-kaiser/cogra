# Economics

CoGra's economy turns advertiser demand into contributor earnings
**through the graph and nothing else**. Who gets paid, and how much,
is read directly off public L1 records — the same per-viewer path
extraction that drives [feed-ranking](feed-ranking.md). No model
scores "quality"; no ranking signal is ever bought. The native token
**CGT** is the unit advertisers fund and contributors earn
([token.md](token.md)); it settles on CoGra's own rail, off-graph —
the graph carries relationships and pointers, never amounts.

This doc defines the one economic primitive: **pull marketing** —
the campaign, its value metric, how the payout pool splits among
contributors, and how settlement is published. CGT issuance and
liquidity are [token.md](token.md); the rail's payout/escrow
mechanics are implementation
([ledger.md](../implementation/ledger.md)). Design history:
[open-questions.md Q20](../open-questions.md).

> **Notation.** `S(u,c)`, `k`, `χ`, `f(Δt)` are
> [feed-ranking](feed-ranking.md)'s, indexed in
> [notation.md](notation.md); `V`, `w(u)`, and the reward share
> `R_C` are defined here. L1 symbols (`w̃`, `θ`, `B_i`, …) are the
> interface's ([layer1-interface.md §14](layer1-interface.md#14-symbol-ledger-layer-1-tagged-objects)).

**Invariant: no AI in the economics.** Reach measurement,
attribution, and payout are graph-computed — a Shapley value over
the extracted path set, never a learned "fair share". This is the
same hard boundary [feed-ranking §1](feed-ranking.md#1-the-hard-rule)
observes; AI as a frontend helper is fine, but it must not touch
the graph's signal or the economics computation.

**Invariant: feed ranking and campaign payout are one
computation.** What an advertiser buys is reach into real viewers'
feeds, so the campaign value (§4) and the payout split (§8) are
built from the same per-viewer `k`-disjoint-path extraction that
produces `S(u,c)`
([feed-ranking §6.4](feed-ranking.md#64-one-computation-two-consumers))
— never a separate economics-only metric. Anything that reshapes
the feed reshapes payout, and nothing else can. Read-side personal
layers ([feed-ranking §9](feed-ranking.md#9-read-side-layers))
never enter `S(u,c)`, so they never enter the campaign sum either.

This is CoGra exercising the interface's reimplementation grant:
the reward `R_C` and its attribution calculus are terminal
freedoms, subject to the three mandatory CAN invariants
([layer1-interface.md §4.1](layer1-interface.md#41-mandatory-can-invariants-full-paper-only))
— §8.5 verifies them. With the freedom comes the publication
obligation
([§4.2](layer1-interface.md#42-layer-1-obligations-and-guild-obligations)):
every economic parameter and the full reward formula are published
so any participant can independently reproduce every payout — this
doc is that publication, and §10 anchors the per-campaign record it
applies to.

---

## 1. The two economies

Two moneys touch CoGra, on opposite sides of the L1 boundary, and
they never mix:

- **The admission economy** — Layer 0's reserve behind `B_i` and
  the θ-debit. Writing any record costs its author θ off their own
  balance; capacity is the balance
  (`post:epoch:act-debit`). This money is the L1/L0 kernel's:
  CoGra consumes `B_i` and the burn benchmarks
  (`B_W1`/`B_safety`/`B_door`,
  `cor:epoch:universal-burn-benchmarks` — gate benchmarks; there
  is no universal admission price) through the interface and
  never authors L0 records
  ([substrate-map.md §7](substrate-map.md#7-economics-and-feed-pointers)).
- **The reward economy** — **CGT**, the advertisers' money spread
  over CoGra's users: terminal, CoGra's own, fully disconnected
  from the L0 reserve. "Burn" in CoGra vocabulary always means CGT
  supply destruction (§7), never the θ-debit — the admission side
  is named by L1's own term.

The two connect at exactly one point, and only in one direction:
the **L0 reserve pool** (§7.2) converts a share of campaign revenue
into Layer-0 burns that fund members' θ-debits. An L0 burn is
funder-unconstrained and accrues to the member's own address
whoever paid (`rem:gates:guild-funding`,
[layer1-interface.md §11.2](layer1-interface.md#112-commitment-rate));
the comparator sees a funded member exactly as a self-funded one.
System actors and Collectives draw on the same pool.

**Defunding is severance.** Community funding follows live reach:
an actor the community has cut off entirely — every path to them
crossing a `(0,0)`-netted bundle — is in zero-jail
([feed-ranking §7](feed-ranking.md#7-sort-order-tie-breakers-zero-jail)),
and the same unreachability that removes them from feeds and
earnings removes them from funding. Severance and defunding are the
same act; a defunded actor must self-fund to keep writing.

---

## 2. Pull marketing

Advertisers do not push ads into feeds. An advertiser posts a
**campaign**: a declared goal to raise the reach of a **target**
into the feeds of the crowd around named **anchors**, funded with a
CGT deposit `D`. Contributors earn by *delivering* that reach — by
authoring the records that carry the target into those viewers'
extractions.

- **Target** `C` — the node being promoted: any node the advertiser
  wants the crowd to reach (their Profile, a Post, an Item). The
  target's author is **excluded** from payout (§8.2): the campaign
  already buys the target reach, so it does not also draw from the
  contributor pool.
- **Anchors** `A` — one or more **passive nodes** that define the
  crowd: Profiles for person-cluster campaigns, Types for topic
  campaigns, any content node whose audience is the target group.
  An anchor is a **targeting label, never a revenue position**: the
  campaign weights each viewer by `w(u)` — the viewer's *own* score
  of the anchors — so the crowd defines itself through its own
  outgoing records. Being named pays the anchor's author nothing
  (they earn only like anyone else, through their own records on
  paths, §8) and injects no signal (§3). No consent is needed,
  because being named moves nothing: nobody can force the records
  of the people around an anchor, and an anchor who rejects an
  advertiser says so with their own stance records — visible to the
  crowd and to the advertiser at settlement.
- **Contributors** — every author on an eligible viewer's extracted
  paths to the target. They are the people whose deliberate records
  carried reach.

### 2.1 You earn by being deliberately pointed at

A contributor earns only by sitting on extracted `viewer → target`
paths — reachable through records *others* deliberately created
toward them or their content (paths are forward-only,
[feed-ranking §4](feed-ranking.md#4-the-path-set)). Unreached
content earns nothing from a campaign however good it is: the graph
has no quality signal to pay, and adding one would be the
economics→AI move the no-AI invariant forbids. The graph pays
*delivered reach* instead.

This is a deliberate property of the deliberate-decisions network:

- **The earning unit is in-cone engagement, not follower count.** A
  single post citing the target that picks up real stances inside
  the crowd earns — its author is a path player (§8.2) — so "no
  followers" does not mean "cannot earn".
- **The bridge from quality to standing reach is the explicit
  stance gesture** — an Opinion, an Affinity, a citation — which a
  frontend may nudge after repeated engagement. It is never an
  inbound-edge effect: records pointing *at* you move nothing
  toward you ([feed-ranking §1](feed-ranking.md#1-the-hard-rule)).

---

## 3. The campaign record

A campaign is public, priced, and replayable, so its record lives
where those properties live: **the advertiser — an ordinary L1
actor — authors a Content node as the campaign anchor**, its
witnessed payload carrying the terms. Authoring costs the
advertiser capacity like any write: the θ-debit is the record's own
anti-spam price on top of §7's deposit floor.

| Term (payload) | Meaning |
|---|---|
| `escrow` | Pointer to the rail-side escrow holding the deposit `D`. Amounts are read through the pointer, never asserted in the payload; funded at creation and top-up only (§3.2), so the §7 floor is always backed. |
| `anchors`, `target` | The named anchor set `A` and promoted node `C`, also declared structurally (below). |
| `e_start`, `e_end` | Campaign window, as epoch indices — the epoch certificate cadence is the network's own clock, so the window is auditable from public records alone. |
| `V_start` | The campaign value (§4) at `e_start` — the baseline. With `declared_goal` it makes the ask legible: from `V_start` to `V_start + declared_goal`. |
| `declared_goal` | The `V` gain the advertiser is aiming for; denominator of the auto-settlement formula (§6). Strictly positive. |
| `χ_c` | The per-campaign support floor, `χ_c ≥ χ` (§4.2) — the advertiser's targeting-sharpness and compute-cost dial. |

**Structure.** The campaign anchor carries a `(0, 0)` Reference to
each named anchor and to the target. That declares the targeting as
replayable public structure while injecting nothing: a `(0, 0)`
record has `w̃ = 0` and never vouches
(`rem:graph:zero-parameter-degeneracy`,
`def:epoch:person-vouch-eligibility`) — the same degeneracy the proposal
pattern rests on
([substrate-map.md §5](substrate-map.md#5-governance-and-moderation)).
Reach toward the target is delivered by real contributor records
only; a campaign that could carry signal would be buying ranking
directly, the feedback the no-AI invariant forbids.

**Invariant: money never rides L1.** Amounts live on the rails —
L0 admission money, CGT reward money — and the graph carries
pointers, never amounts. Here: the deposit sits in rail-side
escrow, and per-contributor figures live in the settlement tree
(§10). The
anchor carries the public record and pointers.

### 3.1 Forbidden configurations

- **Negative campaigns** (paying to *lower* reach) — this would
  weaponize severance and corrupt the safety primitive. Declared
  campaigns are increase-only. (Achieved gain *can* still come out
  negative when the crowd turns on the target; auto-settlement
  floors it at zero — §6.)
- **Non-positive `declared_goal`** — the auto-settlement formula
  divides by it.

### 3.2 Adjustability

Public visibility of every adjustment is the discipline. Term
changes land as witnessed payloads on advertiser-authored `(0, 0)`
Opinions toward the campaign anchor — newest change per term wins,
the same replayable-schedule shape as the network charter
([feed-ranking §12](feed-ranking.md#12-calibration-parameters)).

- **Mutable before settlement:** `e_end` (free, unlimited
  extensions — the anti-bot lever, §6.1), `declared_goal`, `χ_c`
  (a compute failsafe: if the graph grows rapidly mid-window the
  advertiser raises it to keep enumeration tractable), and the
  escrowed `D` — **top-up only**, never lowered: the locked escrow
  backs §7's flat-on-`D` anti-spam floor.
- **Immutable after creation:** `anchors` and `target`. They define
  the campaign's identity — whose feeds, what node. Changing them
  would create a different campaign in disguise.

---

## 4. The campaign value `V`

The campaign's success metric is the **crowd sum**

```
V = Σ over eligible viewers u of   w(u) · S(u, C)
```

— each eligible viewer's feed score of the target, weighted by that
viewer's own affinity to the anchors:

```
w(u) = Σ over a ∈ A of   S(u, a)
```

Both factors are the published feed computation itself
([feed-ranking §6.1](feed-ranking.md#61-definition)): exact
`k`-disjoint extraction, signed, recency-decayed — never a separate
metric. `w(u)` is used raw; a governed transform slot (targeting
sharpness) is reserved on the `:Network` charter but ships as
identity. Raising `V` *is* reaching the crowd: there is no reach
apart from real viewers' extractions.

`V` is evaluated **per epoch** on the committed record set — `V_e`
for epoch `e` — so the campaign's whole trajectory is exact,
public, and replayable from records and certificates; no sampling,
no trusted clock. The campaign pays its own evaluation compute
(§9).

### 4.1 Eligibility — both sides

Campaign money must not be spendable on accounts the real network
never touched. An account is **eligible** — as an earner and as a
counted viewer — iff it lies in the **forward cone of the anchors
or the target**: some live path from a named anchor or from `C`,
with path product above `χ`, reaches the account, and **no record
on that path is authored by the account itself**.

- **Forward, because inbound stances can't be self-made.** A
  forward path from an anchor to an account is a chain of records
  *others* authored toward it. A bot can author its own records
  pointing anywhere; it cannot author other people's records
  pointing at it. (The reverse relation — the account's own paths
  *to* the anchors — is what `w(u)` already measures, and is
  self-authorable; it gates nothing.)
- **Self-exclusion closes self-landing.** Hyper-edge T-legs can
  land on a Profile from a passive artifact, so without the
  exclusion an account could author the final hop of its own
  eligibility path. With it, eligibility is strictly
  other-authored. A *confederate* authoring that landing hop
  remains possible — parked as
  [open-questions.md Q28](../open-questions.md#q28--zero-jail-person-landing-the-hyper-edge-t-leg-escape)
  with an L2 policy fallback; until it resolves, this residual is
  accepted and bounded (§11).
- **Union, not intersection.** Either cone qualifies: a fresh
  advertiser's forward cone is nearly empty, so demanding both
  would strangle new campaigns; either-cone membership still
  requires real other-authored stances.
- **Honest accounts pass by construction.** Joining CoGra is
  mutual-pair gated: every member enters with at least one inbound
  person stance — the accepted inviter's Opinion toward their
  Profile ([invitations.md](invitations.md)).

A **counted viewer** additionally needs support: `|w(u)| ≥ χ_c`.
The per-campaign floor `χ_c` only moves the support cutoff — a
sharper, cheaper campaign — never the split rule.

---

## 5. Achieved reach — the sustained-level metric

Auto-settlement (§6) needs one number for "how much reach did the
campaign actually deliver?" That number is the **sustained-level
gain**:

```
achieved_gain = max { L : V_e ≥ V_start + L
                          for ≥ τ consecutive epochs in the window }
```

with **`τ = ⌈(e_end − e_start) / 3⌉`** — a third of the window. It
is the highest gain the campaign actually *held*, anywhere in the
window:

- A linear ramp `0 → G` over the window holds level `2G/3` for the
  final third → `achieved = 2G/3`.
- A campaign that reaches `G` early and holds → `achieved = G`.
- A spike that decays before `τ` epochs elapse → no level held →
  `achieved = 0`. Bursts earn zero structurally.

Rejected alternatives: **peak-during-window** (a single spike games
it — dangerous precisely in the absent-advertiser case the default
exists for); **end-of-window snapshot** (a late severance wipes
contributors who did the work); **time-weighted average**
(spike-resistant but under-credits an honest ramp, structurally
underpaying linear delivery).

The reduction reads the per-epoch `V_e` series the campaign already
publishes (§4) — every value at full precision, no mixed rulers.

---

## 6. Settlement and release

Settlement is a **single terminal event** with two decisions inside
it: the pool size `P` and the **attribution epoch `t*`** — the
epoch whose committed record set the split is computed on. There is
no re-settlement. Two paths reach it:

1. **Advertiser-discretionary.** The advertiser calls
   `settle(P, t*)` with `P ∈ [0, D]` and
   `t* ∈ [e_start, e_end]`, at any time during the window or in the
   **evaluation window** of `N_eval` epochs after `e_end`
   (governed; genesis default pinned at launch). The advertiser
   chooses pool size and attribution epoch only — never who gets
   what fraction; the split is graph-computed (§8).
2. **Auto-settlement.** If the advertiser is absent at
   `e_end + N_eval`, settlement fires with

   ```
   P  = min(1, max(0, achieved_gain) / declared_goal) · D
   t* = the binding-minimum epoch of the qualifying run
   ```

   — the epoch within the interval that realized `achieved_gain`
   where `V_e` is at its minimum (first occurrence on ties), so
   `V_{t*} = V_start + achieved_gain` exactly. Pool size and split
   are read off the same epoch state — **measured and paid on one
   ruler**. It credits the load-bearing structure that held the
   sustained level at its thinnest; the `max(0, ·)` floors a
   crowd that turned on the target at zero — a refund-only default.

   Rejected `t*` defaults: end-of-run (credits late churn-in),
   start-of-run (credits first-achievement, not who held it),
   peak-in-run (over-credits transient over-delivery).

### 6.1 The anti-bot flow is extension, not adjudication

`P ∈ [0, D]` is discretionary because reach is not binary; the
advertiser releases what the delivered reach was worth to them.
Goal-hit detection is a public signal feeding that decision, never
a distribution trigger. Against bots the flow is:

1. The advertiser watches the public `V_e` trajectory and the
   §11 advisory signals, and sees an inflated interval.
2. They **extend `e_end`** — free and unlimited (§3.2) — and post a
   public call to sever.
3. The community severs the farm
   ([feed-ranking §8](feed-ranking.md#8-severance-discovery-redemption)).
   Severance is write-side: from that epoch on, every path through
   the netted bundles is dead in every later epoch's state.
4. The advertiser picks a **clean epoch as `t*`** — one from after
   the severance landed, or before the intrusion began — and
   settles on it.

Severance never rewrites history; it changes every state after it.
Extension is what turns community action into a choosable clean
outcome, which is why the evaluation window is an inspection
period, not a second settlement.

**Accepted residual.** A slow farm sustained for `τ` against an
advertiser absent for the whole window *and* a community that fails
to sever will auto-settle on the sustained metric. This is bounded
— by the long `τ`, by the evaluation window the advertiser chose to
skip, by eligibility (§4.1), and by the pool cap (§7.1) — and
consistent with the structural-plus-human, no-algorithmic-
gatekeeping ethos: the fix would let auto-settlement act on
advisory bot signals, reopening the §11 advisory-only rule.

---

## 7. The conservation equation

Every campaign conserves its deposit. Per campaign, in CGT:

```
D              = contributors + treasury + burn + l0_reserve + inviter + refund

contributors   = (0.95 − reserve_share) · P      (split per §8)
treasury       = 0.0002 · D + 0.0198 · P
burn           = 0.0003 · D + 0.0197 · P
l0_reserve     = reserve_share · P               (§7.2)
inviter        = 0.0100 · P                      (§7.3)
refund         = 0.9995 · (D − P)
```

The structure: a **flat-on-`D` anti-spam floor** on burn +
treasury, plus a **scaling-on-`P` share** across the five outflows.
`reserve_share` is a governed `:Network` parameter (genesis default
`1%`), bounded to a pinned ceiling so governance can dial the
community's self-funding up or down but never gut the contributor
pool; the value in force at settlement applies and is recorded in
the settlement payload (§10).

- At `P = D`, `reserve_share = 1%`: `94%` contributors, `2%`
  treasury, `2%` burn, `1%` reserve, `1%` inviter.
- At `P = 0` (refund-only): `99.95%` refunded, `0.02%·D` treasury,
  `0.03%·D` burn; reserve and inviter get nothing — nobody earned,
  and the community taxes earnings, not failures. The floor is
  deliberately low: an honest failed campaign should not be
  punished; `0.05%·D` deters spam-creation without burning honest
  advertisers.

The equation is **campaign-only**. Internal CGT flows — tips,
marketplace purchases — carry none of these lines: no burn, no
treasury, no reserve, no inviter share. The fee is on the gate, not
in the flow: protocol income realizes where CGT enters and exits —
the ladder's spread
([token.md §4.5](token.md#45-income-disposition--the-spread-flows-to-the-team-treasury)) —
and scales with all of it, campaigns, tips, and purchases alike
([ledger.md](../implementation/ledger.md)).

### 7.1 The strict cap

**Total-to-graph `< D` always.** Contributors and
inviters together take `(0.95 − reserve_share)·P + 0.01·P ≤
0.96·P`, and `P ≤ D`, so

```
total-to-graph ≤ 0.96·P ≤ 0.96·D < D.
```

A self-deal coalition (an advertiser funding their own
contributors) is mechanically loss-making for any `(D > 0, P ≥ 0)`:
it spends at least

```
0.0005·D + (0.0495 + reserve_share)·P
```

(less the inviter's `0.01·P` if it also controls the inviter slot)
— strictly positive, and strictly *more* loss-making as
`reserve_share` rises. The reserve line is not extractable money:
it becomes `B_i` capacity at members' addresses, spendable only as
θ-debits, never withdrawable. The cap holds across concurrent
campaigns (each settles its own equation; no shared pool state).
Reputation (§7.4) adds enforcement on top of this mechanical
guarantee, never in place of it.

### 7.2 The L0 reserve pool

The `l0_reserve` line accrues to a dedicated pool — **the
community's admission fund**, distinct from the team treasury
([token.md §6](token.md#6-treasury)). Its outflows are exactly one
kind: CGT converted to L0 burns at members', system actors', and
Collectives' own addresses (`rem:gates:guild-funding`; conversion
mechanics in [token.md](token.md)) — covering the θ-debits the
community's members would otherwise pay out of pocket. Subsidy
generosity and per-member caps are governed `:Network` parameters
alongside `reserve_share` itself, so the community that pays the
fee also governs the rate and the spending policy — opt-in, opt-out,
and rebalanceable in low-activity times by vote.

Because inflow (the settlement line) and outflow (on-chain burns)
are both public, the steady-state target — **advertiser revenue
covers the community's L0 costs** — is a checkable claim, not a
promise. The pool is seeded at genesis and open to top-ups; the
discipline is on what leaves, not what enters.

### 7.3 The inviter reward

Each earner's **inviter** receives `0.01·P` sized by that earner's
own payout share — carved from what would otherwise burn (burn
drops from 3% to 2% of `P` at full payout; the contributor pool is
untouched).

- **Pure-`P`.** At `P = 0` nobody earned, so no inviter is paid.
- **Single-hop and permanent.** The inviter is the one actor whose
  invitation the member **accepted** — the mutual, reciprocated
  Opinion pair of the CoGra-join relation
  ([invitations.md](invitations.md)); never a chain,
  so no pyramid dynamic. The relation is permanent, so the inviter
  earns over the invitee's lifetime — the bring-real-users
  incentive. Genesis members have no inviter; their 1% falls back
  to burn. **Collectives likewise have no inviter** — their 1%
  falls back to burn, deliberately: a collective's makeup drifts
  over years, so neither its founder's inviter nor anyone else
  holds a permanent claim on its earnings; and since the share is
  carved from burn rather than the earner's payout, earning
  through a collective gains nobody anything
  ([collectives.md §9](../instances/collectives.md#9-economic-role--no-preferential-treatment)).
- **Not per-action distribution.** The reward fires on the invitee
  *actually earning*, which is already attribution-gated on real
  reach and severance — a dead sybil invitee earns nothing, so its
  inviter earns nothing.

### 7.4 Reputation as additive enforcement

Settlement decisions are public. An advertiser who refuses to pay
on an honest goal-met collapses their own standing in the crowd —
stances toward them flip to `(0,0)` / negative — poisoning the
brand for future campaigns; contributors who flip-flop after payout
signal a hostile-crowd pattern future advertisers avoid. Mechanical
guarantees, public state, and graph-native reputation compound.

---

## 8. Attribution — the reward share `R_C`

Settlement releases a contributor pool of
`(0.95 − reserve_share)·P` (§7). Who gets what fraction is the
Shapley value of the crowd-sum game on `V`.

### 8.1 The closed form

`V` is a linear sum of per-(viewer, path) terms: for each eligible
viewer `u`, the extraction
([feed-ranking §6.1](feed-ranking.md#61-definition)) yields up to
`k` disjoint paths, each contributing
`w(u) · σ(π) · m(π) · f(Δt_π)`. Within one path, every author is
equally necessary — dropping any one author's records kills the
path (the per-author fold nets their records as one bundle,
[feed-ranking §3.2](feed-ranking.md#32-the-fold--per-author-net-stance))
— so each path term is a unanimity game among its authors, which
Shapley splits equally; linearity sums the splits. The `2ⁿ`
coalition blow-up never appears:

```
φ_a = Σ over eligible u   Σ over π ∈ extraction(u,C), a ∈ A_π
          w(u) · σ(π) · m(π) · f(Δt_π) / |A_π|
```

where `A_π` is the set of **distinct persons** behind path `π`: the
authors of its records, plus the authors of its interior artifacts
(authorship is intrinsic to the minting record, so a post's author
is credited when others' citations carry reach through it — the
in-cone-engagement earning unit of §2.1). Persons are one node
([feed-ranking §4](feed-ranking.md#4-the-path-set)), so an author
counts once per path however many elements they own on it.

Raw shares conserve the metric: `Σ_a φ_a = V` before exclusions.
The paid share is then

```
R_C(a) = max(φ_a, 0) / Σ_{b : φ_b > 0} max(φ_b, 0)
payout_a = R_C(a) · (0.95 − reserve_share) · P
```

**Why the conduit earns with no special rule.** A person many
viewers' paths route through appears in many terms, collecting a
share from each. A person on a single weak path still earns its
equal split, because without them that path would not exist. No
conduit-specific term is needed.

Rejected: **leave-one-out** (over-rewards long-path participation
and double-counts multi-author paths); **magnitude-proportional
within a path** (`m(π)` already encodes magnitude, and in a product
the *bottleneck*, not the strongest link, is the most pivotal).

### 8.2 Players, exclusions, sign

- **Players are persons (accounts).** A non-actor node is never
  paid — its author is.
- **The viewer is never a payee of their own terms.** Within `u`'s
  sum, `u` is dropped from every `A_π` payout — no self-paid
  impressions; their records still carry the paths, and they earn
  normally inside *other* viewers' extractions.
- **The target's author is excluded entirely**, even when the
  target is a third party's content: the campaign already promotes
  the target, so it does not also draw from the pool (an advertiser
  who wants to pay a third-party target's author does so by direct
  transfer). Anchors get no exclusion and no privilege — they are
  labels (§2), full players exactly where their own records carry
  reach.
- **Ineligible authors are excluded early — path-level, never
  share-level.** A path containing any record authored by an
  ineligible account (§4.1) is excluded from `V` and from
  distribution entirely; the pool splits fully over the remaining
  clean paths. Striking shares post-hoc was rejected because the
  struck share needs a destination and every candidate is bad:
  advertiser retention prices bot reach at zero cost; treasury
  capture pays the platform for ineligibility rulings; path-level
  renormalization hands the share to a confederate on the same
  path. A bot-containing path exists only because of the bot's
  record, so no honest path is collateral.
- **Sign carries through.** `σ(π)` rides signed
  ([feed-ranking §5.2](feed-ranking.md#52-sign--balance-and-taint)):
  an even count of negative stances yields a positive term, so an
  "enemy of my enemy" path surfaces the target and is credited —
  forced by conservation. An author whose terms net negative gets
  `φ_a < 0`, floored to zero, no clawback; a distrusted detractor
  earning via a double-negative path is an accepted property.

### 8.3 Everything at `t*`

The whole computation — eligibility, `w(u)`, every extraction,
every sign — is a function of the epoch-`t*` committed record set
and the published terms in force. One epoch state, one ruler,
independently recomputable by anyone from public records (§10).

### 8.4 Computation — exact, streaming, crowd-linear

- **Finding the crowd:** one reverse sweep from the anchor set
  discovers every account with `|w(u)| ≥ χ_c` (and computes
  `w(u)`); forward sweeps from the anchors and the target settle
  eligibility (§4.1). All sweeps are `χ`-bounded best-first
  frontiers — cost is flat in total graph size; only the campaign's
  dust-reachable neighborhood enters. Crowd size is therefore known
  **before** the campaign runs, so evaluation and settlement
  compute are priceable in advance: **the campaign pays its own
  compute.**
- **Per-viewer extraction** is the ranker's own `k`-disjoint
  extraction inside `χ_c`-bounded slices, reusing the per-viewer
  work the feed already does for active members
  ([feed-ranking §11](feed-ranking.md#11-where-ranking-runs)). As
  each path is extracted its term is distributed to its authors and
  the path is discarded: memory is `O(players)`, never `O(paths)`.
- **Crowd-linear, never graph-linear; shardable and incremental.**
  Viewers are independent, so the work shards across miners and
  accumulates per epoch; settlement inside the evaluation window is
  an offline job over already-published per-epoch state.

### 8.5 The CAN invariants, verified

CoGra's attribution is a guild CAN, bound by the interface's three
mandatory invariants
([layer1-interface.md §4.1](layer1-interface.md#41-mandatory-can-invariants-full-paper-only)):

1. **Depth decay** — every hop multiplies a sub-unit factor
   (`γ ≤ 1`, `w̃ < 1`), so credit attenuates with composition depth
   and cannot flow upward.
2. **Transmission `< 1`** — each path term is a product of
   sub-unit factors; no composition step amplifies.
3. **Context independence** — paths are forward-only and terms
   depend only on the records *on* the path, so composing on a node
   (a new consumer record from it or through it) never changes the
   node's existing value; new records toward a node can only add
   terms, never reprice old ones.

---

## 9. Progress in public

Because `V_e` is a per-epoch fold of committed records, the
campaign's progress is not a courtesy dashboard — it is derivable
by anyone, every epoch, from the records and certificates. CoGra
publishes the running series alongside the campaign record as an
operational convenience; disputes resolve against the records, not
the series. The advertiser, the crowd, and every prospective
contributor watch the same numbers the settlement will be computed
from.

---

## 10. The settlement record and the payout flow

Money amounts live on the CGT rail only; L1 carries the public
record. Settlement (§6) publishes **one witnessed payload on a
`(0, 0)` Opinion toward the campaign anchor** — authored by the
advertiser when discretionary, by the publisher system actor when
auto-settlement fires (the standard materialization gesture,
[substrate-map.md §5](substrate-map.md#5-governance-and-moderation)).
The payload carries:

- `settled_P`, `achieved_gain`, and the attribution epoch `t*`;
- the `reserve_share` and `χ_c` in force (recorded so the split is
  a pure function of public state — anyone can recompute the payout
  tree from epoch `t*`'s records plus this payload);
- the payout tree's **Merkle root** — the public commitment of who
  is owed what.

Per-account payout figures are Merkle leaves, verifiable against
the root and surfaced in frontends — never on L1. Distribution is
**push, not claim**: the rail pays every earner directly, in
batched transactions whose explicit outputs match the committed
tree, transaction costs on the protocol — no claim step, nothing
for the earner to do. Payouts read each account's witnessed payout
address in force at `t*`, the same one-ruler rule as everything
else in the settlement (§8.3), so the tree pins amount *and*
destination and **non-payment is publicly provable** — anyone can
line the outputs up against the leaves. Earnings land
self-custodied at the earner's own address the moment the batch
settles; there is no unclaimed pool to expire or strand. Batching,
escrow release, and transaction mechanics are the ledger's concern
([ledger.md](../implementation/ledger.md)).

---

## 11. Structural defense, advisory signals, residuals

CoGra applies **no anti-spam action quota**. The campaign-farming
attack — flooding records that cite a target to harvest budget — is
covered structurally, so a quota would buy no marginal defense
while taxing exactly the behavior campaigns reward:

1. **Forward-only traversal** — bots cannot manufacture the
   other-authored records that give content weight or make an
   account eligible (§4.1).
2. **Disjoint extraction** — a delta-funnel scores as its single
   bridge path, an amplification ceiling of exactly 1× per viewer,
   no matter how many internal records it manufactures
   ([feed-ranking §6.2](feed-ranking.md#62-why-disjoint-paths)).
3. **Severance / zero-jail** — one write-side act removes a farm
   from feeds, earnings, vouch routing, and community funding at
   once ([feed-ranking §7](feed-ranking.md#7-sort-order-tie-breakers-zero-jail));
   the sustained metric gives the community `τ` epochs to act, and
   extension (§6.1) gives it more.
4. **The sustained-level metric** — bursts earn zero (§5).
5. **The strict cap** — self-funded "success" is mechanically
   loss-making (§7.1).
6. **Advertiser discretion** — decline, extend, settle on a clean
   epoch (§6.1).

**Advisory only.** There is no campaign bot detector and no
automatic payout zeroing. The delta-funnel auto-detection of
[feed-ranking §8.5](feed-ranking.md#85-bridge-auto-detection)
surfaces bridge patterns from path structure; the settlement view
shows that signal as **evidence** for the discretionary decision.
Action stays with people: the actors closest to a farm sever it,
and every path through it dies at that hop.

**Accepted residuals**, each named and bounded:

- the absent-advertiser slow farm (§6.1) — bounded by `τ`, the
  skipped evaluation window, eligibility, and the cap;
- confederate-authored eligibility (§4.1) — a real member can land
  a person-stance hop on a farm; open at L1 as
  [Q28](../open-questions.md#q28--zero-jail-person-landing-the-hyper-edge-t-leg-escape),
  with an L2 policy fallback; meanwhile the farm still earns only
  what real viewers' extractions route through it, at the funnel
  ceiling, under the cap;
- double-negative credit (§8.2) — forced by conservation.

The only gating CoGra applies is **infrastructure payment** — a
resource-cost charge on hosted storage/serving, so hosts are
compensated for hosted users; a member hosting their own data pays
nothing. That mechanism belongs to the deferred marketplace/infra
workstream ([items.md](../instances/items.md)); the default posture
is to maximize free actions and price only at that one margin.
