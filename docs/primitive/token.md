# Token (CGT)

**CGT** is CoGra's native token: the reward economy's unit — what
advertisers fund campaigns in and contributors earn, settled on
CoGra's own rail. It is one of the two moneys of
[economics.md §1](economics.md#1-the-two-economies), and it is
**fully disconnected from the other**: the Layer 0 reserve behind
`B_i` and the θ-debit is a different asset on the far side of the
L1 boundary, never minted, held, or priced by CoGra. This doc
defines CGT's supply side — the **release schedule**, the
**initial allocation**, and the **protocol-owned liquidity** that
moves released supply into circulation — and where the money that leaves the campaign
equation goes: the **team treasury** and the **L0 reserve pool**.
The campaign mechanics that *spend* CGT live in
[economics.md](economics.md); the rail's payout and escrow
plumbing is implementation
([ledger.md](../implementation/ledger.md)). Design history:
[open-questions.md Q20](../open-questions.md).

> **Notation.** The deposit `D`, payout `P`, and the governed
> `reserve_share` in the flow formulas are defined in
> [economics.md §7](economics.md#7-the-conservation-equation).

CGT requires a cheap settlement layer that can host the liquidity
mechanism of §4 — sell released supply above spot, keep an
always-on exit market, accrue the base asset — with **no single
operator able to steal funds or permanently censor**. CGT lives on
the **Liquid Network** as an issued asset, paired natively against
**L-BTC (Liquid Bitcoin)**: block signing and the peg rest on an
11-of-15 functionary federation, which meets that bar, and the
base pair adds no second chain and no bridge to the money path.
The rail mechanics live in the ledger
([ledger.md](../implementation/ledger.md)).

**Invariant: the token never feeds ranking.** Neither CGT balance
nor token activity (transfers, campaign participation) is ever an
input to [feed-ranking](feed-ranking.md). Balance-in-ranking is
plutocracy; activity-in-ranking is a gameable economics→ranking
feedback loop, and real reach is already in the graph through the
underlying stance records anyway. CGT is a pure settlement layer
with zero ranking feedback — the same hard boundary
[economics.md](economics.md) draws on the payout side.

---

## 1. The unit of account

Advertisers buy CGT and fund campaigns in it; contributors earn it;
the rail is the ledger of CGT amounts, and L1 carries only the
public campaign record and pointers
([economics.md §10](economics.md#10-the-settlement-record-and-the-payout-flow)).
CGT is a standard fungible on-chain token, and **burn is literal
supply destruction**: the per-campaign burn line of
[economics.md §7](economics.md#7-the-conservation-equation) removes
those units permanently. "Burn" in CoGra vocabulary means exactly
this — never L1's θ-debit, which spends the *other* money. Total
live supply evolves as **cumulative release − cumulative burn**
(§5), not as a fixed number.

---

## 2. Issuance — the decaying calendar release

CGT is released on a **calendar schedule**, not per user action. A
fixed daily amount unlocks; the daily amount **steps down ~10%
once a year** on a fixed anniversary date (the rate holds flat
within a year, then drops — not a continuous decay). Because the
steps are geometric, the curve's **lifetime release converges to a
finite cap**: a fixed daily release decaying 10%/year sums to
roughly ten years of the first year's release and no more.

> *Illustrative, not canonical:* ≈5000 CGT/day at the schedule's
> genesis, stepping to ≈4500/day after the first year, with a
> lifetime release asymptote on the order of ~18M CGT. The exact
> genesis rate, the precise anniversary date of each step, and the
> asymptote depend on CoGra's launch timing relative to the
> existing peer-network schedule (§3) and are pinned at launch.
> They do not change any mechanism in this doc.

CGT **inherits the peer-network token's release schedule at its
current point** — no reset, no fresh issuance event at launch. The
schedule has already been running (§3); CGT continues it forward
from wherever it stands. The inherited curve is **CGT's own supply
curve and nothing else**: it has no relationship to the L0 reserve,
which CoGra never mints and whose economics belong to the L1/L0
kernel.

**Why a decaying calendar release, and not per-action
distribution.** Rewarding users per activity — per like, post, or
comment — is the anti-pattern: bots out-produce humans at exactly
those actions, so a per-action release pays the spammers. That
*distribution* mechanism is rejected. What is kept is the *supply
curve*: a scheduled, decaying release. Early-holder upside then comes from **demand growth
against a slow-growing supply**, not from a mechanism that pays
inactive early users on a calendar — joining early and holding
benefits from the rise without rewarding squatting.

**Why scheduled, and not coupled to burn or campaign volume.** The
asymptote exists *because* the release is scheduled and independent
of activity. Any mechanism that ties the release amount to burn or
campaign volume makes issuance linear in volume — unbounded supply,
no asymptote. Keeping the release on the calendar preserves the
finite cap; selling it through the protocol's own market rather
than direct distribution (§4) keeps it from dumping.

The curve is enforced on the rail, not operated: the full lifetime
supply is minted **once, at genesis** — the only mint that ever
happens — pre-split into tranches under absolute timelocks, one per
calendar step. Each step is that tranche's consensus-enforced
unlock, and no key exists that could issue beyond it
([ledger.md](../implementation/ledger.md)).

---

## 3. Initial allocation — proportional carry-forward

There is **no fresh premine** to designated parties. Minting a
large new allocation to the company, founders, or alpha users
before any economy exists would concentrate supply in the wrong
place. Instead, the initial CGT supply is a **proportional
carry-forward** of the token state that already exists, from two
pools:

- **Alpha-phase tokens** — holdings from CoGra's alpha period.
- **The peer-network token's first-year supply** — what its
  schedule (§2) released during roughly its first year of runtime.

Existing holders keep their **percentage** of that prior state,
translated into CGT — *not* unit-for-unit. Carrying the percentage
rather than a fixed conversion respects pre-existing holder
expectations and seeds the initial liquidity (§4) without
manufacturing new concentration. The exact figures — the alpha
total, the first-year total, the percentage→CGT conversion, and the
split of the carried supply into liquidity-seed versus holder
balances — are pinned at launch; they set the absolute scale but
not the mechanism.

**Carry-forward stops at the economy; it does not extend to
governance.** Holding more CGT buys no extra say in the network.
Stake-weighted governance was declined precisely as the plutocracy
this would otherwise create — proportional carry-forward must not
become founder/alpha control of the network
([open-questions.md Q19](../open-questions.md)). The token is an
economic instrument, not a voting weight.

---

## 4. Protocol-owned liquidity (POL)

New supply does not arrive by transfer into user wallets. It is
sold through a market the protocol owns — a **covenant order
ladder** on the rail: resting on-chain orders, non-custodial once
placed — so that released CGT only enters active circulation when
there is genuine demand to absorb it, never as a calendar-timed
dump. The transaction-level mechanics are the ledger's
([ledger.md](../implementation/ledger.md)).

### 4.1 The base pair

The protocol's market is **CGT/L-BTC (Liquid Bitcoin)** — the
rail's native asset. Pairing against it adds **no issuer or
custodian** beyond the chain itself: a USD stablecoin prices CGT
directly in dollars but depends on a central issuer who can freeze
or redeem; wrapped or bridged BTC reintroduces a custodian holding
the real Bitcoin. L-BTC is Bitcoin inside the same federation
trust floor the Layer 0 reserve already stands on — the only deep
pair with no extra trust dependency. The consequence:
**contributor earnings are realised in L-BTC**, so their fiat
value follows
`(contributor share) · (CGT/L-BTC trajectory) · (BTC/USD)` — the
contributor pool `(0.95 − reserve_share)·P` is exact and
graph-plus-parameter-determined
([economics.md §7](economics.md#7-the-conservation-equation)), but
the fiat figure carries Bitcoin's volatility.

### 4.2 The ladder — demand-coupled release

The market is two-sided around a published anchor price (§4.3):

- **Ask side — released supply.** Each released tranche (§2) is
  placed as covenant sell orders spaced geometrically **above**
  the anchor: a stack of resting sell orders that converts
  CGT→L-BTC *only as buyers push into it*. Freshly released CGT
  enters active circulation **on demand** — when advertisers buy
  to fund campaigns — and sits dormant above the market otherwise.
  **Total supply is a genesis constant; released supply grows on
  the calendar; active circulating supply grows on demand.**
- **Bid side — exit liquidity.** Protocol-held L-BTC rests in buy
  orders **below** the anchor: the always-on exit for contributors
  cashing out earnings. Ask-side sale proceeds replenish this side
  first (§4.5), so the exit market's depth is protocol principal,
  accrued in the base asset.

Liquidity is never one-directional: anyone can buy from the asks
or sell into the bids at any time; only the price walks the
ladder.

### 4.3 The anchor — the ladder's own fills

Order placement is anchored on a **published deterministic fold
over the ladder's own on-chain fills**, epoch-granular — anyone
recomputes the anchor from public chain data; no external oracle,
no dependency on another venue's feed. At genesis, before any
fills exist, the anchor is the seeded starting price set by the §3
carry-forward's liquidity seed, pinned at launch. The manipulation
economics match the pool-TWAP argument this replaces: an averaged,
fill-weighted anchor moves only under sustained real trading
against the ladder's own depth — uneconomic at the sizes any
single re-placement exposes.

### 4.4 Cadence — epoch-granular re-placement

The ladder is maintained on an epoch cadence: each cycle the
protocol re-centers unfilled orders around the updated anchor,
places newly released tranche supply into the ask band, and tops
the bid side back up to its liquidity target. Re-placement is an
automated, publicly auditable treasury operation — explicit
transactions on a published schedule
([ledger.md](../implementation/ledger.md)).

### 4.5 Income disposition — the spread flows to the team treasury

An order ladder has no fee switch; it earns the way any standing
market-maker does — the **spread**. Asks sit above the anchor and
bids below it; the governed gap between them is paid by everyone
who enters or exits CGT across the protocol's market — the
order-book form of the pool fee this design descends from. It
scales with everything that buys in or cashes out: campaign
funding, earnings exits, and every future CGT use with an entry or
exit leg.

The two L-BTC flows the ladder produces are kept strictly apart:

- **Tranche-sale proceeds are principal.** L-BTC from ask-side
  fills funds the bid side — the exit liquidity and the protocol's
  base-asset accrual. It is never revenue: routing release
  proceeds to the team would monetise the supply curve itself.
- **The spread is income.** At each re-placement, the realized
  spread gain above the bid side's liquidity target sweeps to the
  **team treasury** (§6).

Rejected alternatives: letting all proceeds pool as principal
forever (ignores a real revenue stream for no benefit — the
project's income must scale with the economy it runs) and skimming
tranche sales (taxes supply release instead of trading activity,
and thins the exit market).

### 4.6 Manipulation is bounded and never touches contributor proceeds

The ladder's attack surface is bounded the way the pool's was:
every vector reaches *income*, never the supply mechanism or
contributor earnings.

- **Pushing spot to lift asks cheaply** — defeated by the
  fill-weighted epoch anchor (§4.3) plus geometric spacing: moving
  the anchor takes sustained capital traded against the ladder
  itself, and a single epoch's exposure is bounded by what one
  re-placement puts at market.
- **Picking off stale orders after a market move** — the standing
  market-maker's classic adverse-selection cost: an order priced
  before a move fills at yesterday's price. Epoch re-pricing
  bounds the staleness window, geometric spacing bounds the depth
  exposed near the anchor, and the cost nets against spread income
  in the same public accounting — it can thin the income stream,
  never touch the committed payout side.

The contributor share is graph-plus-parameter-determined and the
CGT price trajectory is set by the release/burn balance — both out
of reach of anyone trading against the ladder.

---

## 5. Supply trajectory

Live supply moves as **cumulative release − cumulative burn**.
Release follows the decaying schedule (§2); burn is the per-campaign sink
of [economics.md §7](economics.md#7-the-conservation-equation),
ranging from a small floor (`0.03%·D` on refund-only settlements)
up to `2%·D` at full payout, and persisting as long as campaigns
run.

- **Early in the curve**, the daily release can exceed total daily
  burn, so live supply grows; the direction depends on campaign
  volume and payout mix against the then-current release.
- **After the decay tapers**, the scheduled release shrinks toward
  its asymptote while burn persists with campaign activity, so **burn
  comes to dominate and supply contracts** — a long-run
  deflationary regime.

Beside burn, campaign flow also *sells* CGT: the L0 reserve pool
(§6.2) converts its `reserve_share·P` inflow out of CGT entirely.
Conversion is market flow, not supply change — it moves units, the
way any holder's sale does — so the trajectory above is set by
release and burn alone.

There is no fixed "18M supply": that figure is the *release*
curve's asymptote, and live supply peaks somewhere below it, then
declines as burn outpaces the tapering release. Throughout, POL's
demand-coupled release (§4.2) means **active circulating supply
tracks demand even while total supply is still growing** — so
long-run holding stays structurally attractive, with upside driven
by demand growth rather than calendar rewards to idle holders.

---

## 6. Treasury

Two pots receive the campaign equation's platform-side flow, and
they are deliberately separate: **the team treasury** is the
project's revenue; **the L0 reserve pool** is the community's
admission fund. Separating them keeps each accountable — the team's
income is not raidable by subsidy policy, and the community's
self-funding is not a discretionary line in the project's budget.

### 6.1 The team treasury

The team treasury is the project's revenue model. Everything CoGra
runs is free to use and open source, so the treasury is how the
team sustains and funds the work: **development, marketing,
giveaways, and infrastructure** (server and operating costs — CoGra
launches on central hardware, so real infra costs must be covered).

It accrues from two streams:

- **Campaign treasury share** — `0.02%·D + 1.98%·P` per settlement
  ([economics.md §7](economics.md#7-the-conservation-equation)),
  already CGT-denominated.
- **Ladder spread** — the realized spread income swept from the
  protocol's market at re-placement, L-BTC-denominated (§4.5).

The team treasury is free to market-sell its holdings at its
discretion. This is CoGra's answer to "if it's free, you're the
product": the project earns from the advertising economy and its
own liquidity, **not** from monetising user data.

### 6.2 The L0 reserve pool

The reserve pool receives the `reserve_share·P` settlement line
([economics.md §7.2](economics.md#72-the-l0-reserve-pool)) and
exists for exactly one kind of outflow: **funding the community's
Layer-0 burns**. CGT is swapped into L-BTC through the protocol's
own ladder at execution-time market price — chunked, publicly
accounted, never at a frozen internal rate
([ledger.md](../implementation/ledger.md)) — and burned at
members', system actors', and Collectives' own addresses — the
funder-unconstrained burn L1 explicitly permits, raising only the
funded member's own `B_i`.

- **Inflow rate is governed** — `reserve_share` is a `:Network`
  parameter the community sets, alongside the generosity and
  per-member caps that govern the outflow. The community that pays
  the fee governs both sides of it.
- **The steady-state target is checkable**: advertiser revenue
  covers the community's L0 costs when the pool's public inflow
  keeps pace with its on-chain burn outflow — arithmetic, not a
  promise.
- **Seeded at genesis, open to top-ups.** The genesis L0 burns that
  instantiate the network are funded directly at launch; the pool
  then carries ongoing admission. Anything may flow in; only L0
  funding flows out.

The conversion crosses the two-economy boundary in the only
sanctioned direction and place
([economics.md §1](economics.md#1-the-two-economies)): the pool
merely exchanges one asset for another on the open market and burns
the result at members' addresses. CGT and the L0 reserve stay two
distinct moneys end to end.
