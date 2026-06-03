# Token (CGT)

**CGT** is CoGra's native token: the unit advertisers fund campaigns in
and contributors earn, settled on-chain. This doc defines how CGT comes
into existence — the **mint curve**, the **initial allocation**, and the
**protocol-owned liquidity** that releases new supply into the market.
The campaign and payout mechanics that *spend* CGT live in
[economics.md](economics.md); the on-chain claim/escrow and the specific
chain are an implementation concern
([ledger.md](../implementation/ledger.md)). Design history:
[open-questions.md Q20](../open-questions.md).

CGT requires a cheap settlement layer with a **V3-style
concentrated-liquidity DEX** (for the liquidity mechanism in §4) and no
single-operator risk — an EVM L2 with Uniswap V3 or equivalent is the
fit. The named chain is an implementation choice, deferred to the ledger.

**Invariant: the token never feeds ranking.** Neither CGT balance nor
token activity (transfers, campaign participation) is ever an input to
[feed-ranking](feed-ranking.md). Balance-in-ranking is plutocracy;
activity-in-ranking is a gameable economics→ranking feedback loop, and is
already reflected in the graph through the underlying reach edges anyway.
CGT is a pure settlement layer with zero ranking feedback — the same hard
boundary [economics.md](economics.md) draws on the payout side.

---

## 1. The unit of account

Advertisers buy CGT and fund campaigns in it; contributors earn it; the
chain is the ledger of money and the graph carries only the
relationships and pointers to it ([economics.md §7](economics.md#7-settlement-on-the-graph--the-claim-flow)).
CGT is a standard fungible on-chain token, and **burn is literal supply
destruction**: the per-campaign burn of [economics.md §5](economics.md#5-the-conservation-equation)
removes those units permanently. Total live supply therefore evolves as
**cumulative mint − cumulative burn** (§5), not as a fixed number.

---

## 2. Issuance — the decaying calendar mint

CGT is issued on a **calendar schedule**, not per user action. A fixed
daily amount is minted; the daily amount **steps down ~10% once a year**
on a fixed anniversary date (the rate holds flat within a year, then
drops — not a continuous decay). Because the steps are geometric, the
curve's **lifetime issuance converges to a finite cap**: a fixed daily
mint decaying 10%/year sums to roughly ten years of the first year's
issuance and no more.

> *Illustrative, not canonical:* ≈5000 CGT/day at the schedule's genesis,
> stepping to ≈4500/day after the first year, with a lifetime mint
> asymptote on the order of ~18M CGT. The exact genesis rate, the precise
> anniversary date of each step, and the asymptote depend on CoGra's
> launch timing relative to the existing peer-network schedule (§3) and
> are pinned at launch. They do not change any mechanism in this doc.

CGT **inherits the peer-network mint schedule at its current point** —
no reset, no fresh issuance event at launch. The schedule has already
been running (§3); CGT continues it forward from wherever it stands.

**Why a decaying calendar mint, and not per-action distribution.**
Rewarding users per activity — per like, post, or comment — is the
anti-pattern: bots out-produce humans at exactly those actions, so a
per-action mint pays the spammers. That *distribution* mechanism is
rejected. What is kept is the *supply curve*: a scheduled, decaying mint.
Early-holder upside then comes from **demand growth against a
slow-growing supply**, not from a mechanism that pays inactive early
users on a calendar — joining early and holding benefits from the rise
without rewarding squatting.

**Why scheduled, and not coupled to burn or campaign volume.** The
asymptote exists *because* the mint is scheduled and independent of
activity. Any mechanism that ties the mint amount to burn or campaign
volume makes issuance linear in volume — unbounded supply, no asymptote.
Keeping the mint on the calendar preserves the finite cap; releasing it
through liquidity rather than direct distribution (§4) keeps it from
dumping.

---

## 3. Initial allocation — proportional carry-forward

There is **no fresh premine** to designated parties. Minting a large new
allocation to the company, founders, or alpha users before any economy
exists would concentrate supply in the wrong place. Instead, the initial
CGT supply is a **proportional carry-forward** of the token state that
already exists, from two pools:

- **Alpha-phase tokens** — holdings from CoGra's alpha period.
- **First-year peertokens** — the supply already minted under the
  peer-network schedule (§2) during roughly its first year of runtime.

Existing holders keep their **percentage** of that prior state,
translated into CGT — *not* unit-for-unit. Carrying the percentage rather
than a fixed conversion respects pre-existing holder expectations and
seeds the initial liquidity pool (§4) without manufacturing new
concentration. The exact figures — the alpha total, the first-year
peertoken total, the percentage→CGT conversion, and the split of the
carried supply into liquidity-seed versus holder balances — are pinned at
launch; they set the absolute scale but not the mechanism.

**Carry-forward stops at the economy; it does not extend to governance.**
Holding more CGT buys no extra say in the network. Stake-weighted
governance was declined precisely as the plutocracy this would otherwise
create — proportional carry-forward must not become founder/alpha control
of the network ([open-questions.md Q19](../open-questions.md)). The token
is an economic instrument, not a voting weight.

---

## 4. Protocol-owned liquidity (POL)

New supply does not arrive by transfer into user wallets. It is released
through a liquidity pool the protocol owns, so that minted CGT only
enters active circulation when there is genuine demand to absorb it —
never as a calendar-timed dump.

### 4.1 The base pool

The protocol seeds and holds a **two-sided CGT/ETH pool**. The seed (CGT
from the §3 carry-forward, paired with ETH) sets the **starting price**
and is the always-on market: anyone can swap CGT↔ETH in either direction
at any time, with the price sliding along the pool curve after each trade
(standard AMM behaviour). This base pool is the **exit liquidity** for
contributors cashing out earnings and the **entry** for advertisers
buying CGT to fund campaigns. Liquidity is never one-directional here —
only the *price* moves.

**Why ETH as the pair.** ETH is the L2's native asset: pairing against it
adds **no issuer or custodian** beyond the chain itself. A USD stablecoin
(USDC) would price CGT directly in dollars but depends on a central
issuer who can freeze or redeem; wrapped BTC reintroduces a custodian or
bridge holding the real Bitcoin. ETH is the only deep pair with no extra
trust dependency, matching the no-single-operator requirement. The
consequence: **contributor earnings are realised in ETH**, so their USD
value follows `0.95 · (CGT/ETH trajectory) · (ETH/USD)` — the graph-fixed
0.95 marketing-flow share ([economics.md §5](economics.md#5-the-conservation-equation))
is exact, but the fiat figure carries ETH's volatility.

### 4.2 Demand-coupled release of new mint

Each mint epoch's fresh CGT is **not** added to the base pool as a 50/50
deposit (which would sell pressure straight into spot). Instead it is
deposited as a **V3 concentrated-liquidity position placed entirely above
the current price**, over the range `[TWAP_24h, 5 × TWAP_24h]`.

A V3 position supplies liquidity only within a chosen price band. A band
sitting **above** spot holds **only CGT** and acts as a stack of resting
sell orders: it converts CGT→ETH *only as buyers push the price up into
the band*. So freshly minted CGT enters active circulation **on demand** —
when advertisers buy to fund campaigns — and sits dormant above spot
otherwise. **Total supply grows on the calendar; active circulating
supply grows on demand.** In an idle period POL simply accumulates CGT
above spot and releases it when demand returns. This is the "add new CGT
without dumping the price" property, done the V3-native way.

### 4.3 Cadence — hourly sub-deposits

The daily mint is split into **24 hourly micro-deposits** of 1/24 each
rather than one daily deposit. This spreads the MEV attack surface across
the day, and at per-hour sizes any single-event price manipulation is
uneconomic.

### 4.4 Range anchor — the pool's own TWAP

The `[TWAP_24h, 5 × TWAP_24h]` band is anchored on the **pool's own
24-hour time-weighted average price**, not an external oracle.
Cross-venue arbitrage drags any single pool's spot toward the consensus
market price within seconds, and a 24-hour average over that arbitraged
spot can only be moved by holding price off-natural for many hours of
sustained capital — uneconomic at typical mint sizes. An external oracle
(Chainlink and the like) is overkill for the value at risk per deposit
and adds a dependency the TWAP avoids.

### 4.5 Fee disposition — POL fees flow to treasury

POL's positions earn DEX trading fees (the natural CGT/ETH fee tier is
0.30%). The protocol periodically collects them — a mix of CGT and ETH —
and routes the proceeds to the **treasury** (§6). Rejected alternatives:
holding fees in the position forever (ignores a real revenue stream for
no benefit) and buyback-and-burn (mere decoration on a deflation story
already carried by campaign burn and the asymptotic mint curve).

### 4.6 MEV is bounded and never touches contributor proceeds

The POL surface is exposed to standard DEX MEV, but every vector hits
*fee income*, not the supply mechanism or contributor earnings:

- **Front-running a deposit by manipulating spot** — defeated by the
  TWAP anchor plus hourly sizing (§4.3–4.4): manipulation cost exceeds
  extractable value.
- **Just-in-time liquidity** — captures a slice of POL's fee revenue, not
  principal; the supply mechanism and contributor payouts are untouched.
- **Range-boundary arbitrage** — reduces POL fee income, same class as
  JIT.

The 0.95 marketing-flow share is graph-determined and the CGT price
trajectory is set by the mint/burn balance — both out of MEV reach.

---

## 5. Supply trajectory

Live supply moves as **cumulative mint − cumulative burn**. Mint follows
the decaying schedule (§2); burn is the per-campaign sink of
[economics.md §5](economics.md#5-the-conservation-equation), ranging from
a small floor (`0.03%·D` on refund-only settlements) up to `2%·D` at full
payout, and persisting as long as campaigns run.

- **Early in the curve**, the daily mint can exceed total daily burn, so
  total supply grows; the direction depends on campaign volume and payout
  mix against the then-current mint.
- **After the decay tapers**, the scheduled mint shrinks toward its
  asymptote while burn persists with campaign activity, so **burn comes
  to dominate and supply contracts** — a long-run deflationary regime.

There is no fixed "18M supply": that figure is the *mint* curve's
asymptote, and live supply peaks somewhere below it, then declines as
burn outpaces the tapering mint. Throughout, POL's demand-coupled release
(§4.2) means **active circulating supply tracks demand even while total
supply is still growing** — so long-run holding stays structurally
attractive, with upside driven by demand growth rather than calendar
rewards to idle holders.

---

## 6. Treasury

The treasury is the project's revenue model. Everything CoGra runs is
free to use and open source, so the treasury is how the team sustains and
funds the work: **development, marketing, giveaways, and infrastructure**
(server and operating costs — CoGra is expected to launch on central
hardware before any move toward federation, so real infra costs must be
covered).

It accrues from two streams, both already defined:

- **Campaign treasury share** — CGT from every settlement: a `0.02%·D`
  floor plus `1.98%·P` ([economics.md §5](economics.md#5-the-conservation-equation)),
  already CGT-denominated, no conversion needed.
- **POL fees** — a mix of CGT and ETH collected from the liquidity
  positions (§4.5).

The treasury is free to market-sell its holdings at its discretion. This
is CoGra's answer to "if it's free, you're the product": the project
earns from the advertising economy and its own liquidity, **not** from
monetising user data.
