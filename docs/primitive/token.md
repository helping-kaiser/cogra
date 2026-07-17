# Token (CGT)

**CGT** is CoGra's native token: the reward economy's unit — what
advertisers fund campaigns in and contributors earn, settled on
CoGra's own rail. It is one of the two moneys of
[economics.md §1](economics.md#1-the-two-economies), and it is
**fully disconnected from the other**: the Layer 0 reserve behind
`B_i` and the θ-debit is a different asset on the far side of the
L1 boundary, never minted, held, or priced by CoGra. This doc
defines how CGT comes into existence — the **mint curve**, the
**initial allocation**, and the **protocol-owned liquidity** that
releases new supply — and where the money that leaves the campaign
equation goes: the **team treasury** and the **L0 reserve pool**.
The campaign mechanics that *spend* CGT live in
[economics.md](economics.md); the rail's claim/escrow plumbing and
the specific chain are implementation
([ledger.md](../implementation/ledger.md)). Design history:
[open-questions.md Q20](../open-questions.md).

> **Notation.** The deposit `D`, payout `P`, and the governed
> `reserve_share` in the flow formulas are defined in
> [economics.md §7](economics.md#7-the-conservation-equation).

CGT requires a cheap settlement layer with a **V3-style
concentrated-liquidity DEX** (for the liquidity mechanism in §4)
and no single-operator risk — an EVM L2 with Uniswap V3 or
equivalent is the fit. The named chain is an implementation choice,
deferred to the ledger.

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
([economics.md §10](economics.md#10-the-settlement-record-and-the-claim-flow)).
CGT is a standard fungible on-chain token, and **burn is literal
supply destruction**: the per-campaign burn line of
[economics.md §7](economics.md#7-the-conservation-equation) removes
those units permanently. "Burn" in CoGra vocabulary means exactly
this — never L1's θ-debit, which spends the *other* money. Total
live supply evolves as **cumulative mint − cumulative burn** (§5),
not as a fixed number.

---

## 2. Issuance — the decaying calendar mint

CGT is issued on a **calendar schedule**, not per user action. A
fixed daily amount is minted; the daily amount **steps down ~10%
once a year** on a fixed anniversary date (the rate holds flat
within a year, then drops — not a continuous decay). Because the
steps are geometric, the curve's **lifetime issuance converges to a
finite cap**: a fixed daily mint decaying 10%/year sums to roughly
ten years of the first year's issuance and no more.

> *Illustrative, not canonical:* ≈5000 CGT/day at the schedule's
> genesis, stepping to ≈4500/day after the first year, with a
> lifetime mint asymptote on the order of ~18M CGT. The exact
> genesis rate, the precise anniversary date of each step, and the
> asymptote depend on CoGra's launch timing relative to the
> existing peer-network schedule (§3) and are pinned at launch.
> They do not change any mechanism in this doc.

CGT **inherits the peer-network token's mint schedule at its
current point** — no reset, no fresh issuance event at launch. The
schedule has already been running (§3); CGT continues it forward
from wherever it stands. The inherited curve is **CGT's own supply
curve and nothing else**: it has no relationship to the L0 reserve,
which CoGra never mints and whose economics belong to the L1/L0
kernel.

**Why a decaying calendar mint, and not per-action distribution.**
Rewarding users per activity — per like, post, or comment — is the
anti-pattern: bots out-produce humans at exactly those actions, so
a per-action mint pays the spammers. That *distribution* mechanism
is rejected. What is kept is the *supply curve*: a scheduled,
decaying mint. Early-holder upside then comes from **demand growth
against a slow-growing supply**, not from a mechanism that pays
inactive early users on a calendar — joining early and holding
benefits from the rise without rewarding squatting.

**Why scheduled, and not coupled to burn or campaign volume.** The
asymptote exists *because* the mint is scheduled and independent of
activity. Any mechanism that ties the mint amount to burn or
campaign volume makes issuance linear in volume — unbounded supply,
no asymptote. Keeping the mint on the calendar preserves the finite
cap; releasing it through liquidity rather than direct distribution
(§4) keeps it from dumping.

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
  schedule (§2) minted during roughly its first year of runtime.

Existing holders keep their **percentage** of that prior state,
translated into CGT — *not* unit-for-unit. Carrying the percentage
rather than a fixed conversion respects pre-existing holder
expectations and seeds the initial liquidity pool (§4) without
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
released through a liquidity pool the protocol owns, so that minted
CGT only enters active circulation when there is genuine demand to
absorb it — never as a calendar-timed dump.

### 4.1 The base pool

The protocol seeds and holds a **two-sided CGT/ETH pool**. The seed
(CGT from the §3 carry-forward, paired with ETH) sets the
**starting price** and is the always-on market: anyone can swap
CGT↔ETH in either direction at any time, with the price sliding
along the pool curve after each trade (standard AMM behaviour).
This base pool is the **exit liquidity** for contributors cashing
out earnings and the **entry** for advertisers buying CGT to fund
campaigns. Liquidity is never one-directional here — only the
*price* moves.

**Why ETH as the pair.** ETH is the L2's native asset: pairing
against it adds **no issuer or custodian** beyond the chain itself.
A USD stablecoin (USDC) would price CGT directly in dollars but
depends on a central issuer who can freeze or redeem; wrapped BTC
reintroduces a custodian or bridge holding the real Bitcoin. ETH is
the only deep pair with no extra trust dependency, matching the
no-single-operator requirement. The consequence: **contributor
earnings are realised in ETH**, so their USD value follows
`(contributor share) · (CGT/ETH trajectory) · (ETH/USD)` — the
contributor pool `(0.95 − reserve_share)·P` is exact and
graph-plus-parameter-determined
([economics.md §7](economics.md#7-the-conservation-equation)), but
the fiat figure carries ETH's volatility.

### 4.2 Demand-coupled release of new mint

Each mint epoch's fresh CGT is **not** added to the base pool as a
50/50 deposit (which would sell pressure straight into spot).
Instead it is deposited as a **V3 concentrated-liquidity position
placed entirely above the current price**, over the range
`[TWAP_24h, 5 × TWAP_24h]`.

A V3 position supplies liquidity only within a chosen price band. A
band sitting **above** spot holds **only CGT** and acts as a stack
of resting sell orders: it converts CGT→ETH *only as buyers push
the price up into the band*. So freshly minted CGT enters active
circulation **on demand** — when advertisers buy to fund campaigns
— and sits dormant above spot otherwise. **Total supply grows on
the calendar; active circulating supply grows on demand.** In an
idle period POL simply accumulates CGT above spot and releases it
when demand returns. This is the "add new CGT without dumping the
price" property, done the V3-native way.

### 4.3 Cadence — hourly sub-deposits

The daily mint is split into **24 hourly micro-deposits** of 1/24
each rather than one daily deposit. This spreads the MEV attack
surface across the day, and at per-hour sizes any single-event
price manipulation is uneconomic.

### 4.4 Range anchor — the pool's own TWAP

The `[TWAP_24h, 5 × TWAP_24h]` band is anchored on the **pool's own
24-hour time-weighted average price**, not an external oracle.
Cross-venue arbitrage drags any single pool's spot toward the
consensus market price within seconds, and a 24-hour average over
that arbitraged spot can only be moved by holding price off-natural
for many hours of sustained capital — uneconomic at typical mint
sizes. An external oracle (Chainlink and the like) is overkill for
the value at risk per deposit and adds a dependency the TWAP
avoids.

### 4.5 Fee disposition — POL fees flow to the team treasury

POL's positions earn DEX trading fees (the natural CGT/ETH fee tier
is 0.30%). The protocol periodically collects them — a mix of CGT
and ETH — and routes the proceeds to the **team treasury** (§6).
Rejected alternatives: holding fees in the position forever
(ignores a real revenue stream for no benefit) and buyback-and-burn
(mere decoration on a deflation story already carried by campaign
burn and the asymptotic mint curve).

### 4.6 MEV is bounded and never touches contributor proceeds

The POL surface is exposed to standard DEX MEV, but every vector
hits *fee income*, not the supply mechanism or contributor
earnings:

- **Front-running a deposit by manipulating spot** — defeated by
  the TWAP anchor plus hourly sizing (§4.3–4.4): manipulation cost
  exceeds extractable value.
- **Just-in-time liquidity** — captures a slice of POL's fee
  revenue, not principal; the supply mechanism and contributor
  payouts are untouched.
- **Range-boundary arbitrage** — reduces POL fee income, same class
  as JIT.

The contributor share is graph-plus-parameter-determined and the
CGT price trajectory is set by the mint/burn balance — both out of
MEV reach.

---

## 5. Supply trajectory

Live supply moves as **cumulative mint − cumulative burn**. Mint
follows the decaying schedule (§2); burn is the per-campaign sink
of [economics.md §7](economics.md#7-the-conservation-equation),
ranging from a small floor (`0.03%·D` on refund-only settlements)
up to `2%·D` at full payout, and persisting as long as campaigns
run.

- **Early in the curve**, the daily mint can exceed total daily
  burn, so total supply grows; the direction depends on campaign
  volume and payout mix against the then-current mint.
- **After the decay tapers**, the scheduled mint shrinks toward its
  asymptote while burn persists with campaign activity, so **burn
  comes to dominate and supply contracts** — a long-run
  deflationary regime.

Beside burn, campaign flow also *sells* CGT: the L0 reserve pool
(§6.2) converts its `reserve_share·P` inflow out of CGT entirely.
Conversion is market flow, not supply change — it moves units, the
way any holder's sale does — so the trajectory above is set by mint
and burn alone.

There is no fixed "18M supply": that figure is the *mint* curve's
asymptote, and live supply peaks somewhere below it, then declines
as burn outpaces the tapering mint. Throughout, POL's
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
- **POL fees** — a mix of CGT and ETH collected from the liquidity
  positions (§4.5).

The team treasury is free to market-sell its holdings at its
discretion. This is CoGra's answer to "if it's free, you're the
product": the project earns from the advertising economy and its
own liquidity, **not** from monetising user data.

### 6.2 The L0 reserve pool

The reserve pool receives the `reserve_share·P` settlement line
([economics.md §7.2](economics.md#72-the-l0-reserve-pool)) and
exists for exactly one kind of outflow: **funding the community's
Layer-0 burns**. CGT is traded into LBTC (one or more hops through
the base pool's ETH side) and burned at members', system actors',
and Collectives' own addresses — the funder-unconstrained burn L1
explicitly permits, raising only the funded member's own `B_i`.

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
