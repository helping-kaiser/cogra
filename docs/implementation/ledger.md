# Ledger

The rail is the ledger of money, and the rail has a name: **CGT is
an issued asset on the Liquid Network**, traded natively against
**L-BTC (Liquid Bitcoin)**. The economics primitive defines what the
money does — the campaign equation, the payout split, the reserve
line ([economics.md](../primitive/economics.md)); token.md defines
the supply curve and the liquidity design
([token.md](../primitive/token.md)); this doc is the mechanics half:
how those designs execute as Liquid transactions — the asset, the
release schedule, the order ladder, push payouts, escrow, tipping,
the reserve conversion, the keys, and the marketplace rail.
Everything here is contract-level:
it names the on-chain shapes and their trust boundaries, not wire
formats or calibration numbers.

Money amounts never leave the rail. L1 carries the public campaign
record and pointers ([economics.md §10](../primitive/economics.md#10-the-settlement-record-and-the-payout-flow));
Postgres carries display content and cached views; balances,
escrow, transfers, and payouts live here
([architecture.md](architecture.md)). Layer 0 never appears on this
rail at all — admission money is a different asset behind the L1
boundary, read only as the scalar `B_i`
([economics.md §1](../primitive/economics.md#1-the-two-economies)).

Design history: [Q20 (resolved)](../open-questions.md).

---

## Why Liquid

The chain choice follows the pairing requirement. CGT's base market
must pair against an asset with **no issuer or custodian beyond the
chain itself** ([token.md §4.1](../primitive/token.md#41-the-base-pair)),
and the project's preferred base asset is Bitcoin — the same asset
family Layer 0's reserve instantiates as L-BTC. On Liquid, L-BTC
*is* the native asset: the pair is CGT/L-BTC with no bridge, no
wrapped asset, and no second chain anywhere in the money path.

Liquid's operator model satisfies the no-single-operator requirement
as token.md §1 states it: blocks are signed and the peg is managed
by an 11-of-15 functionary federation, so no single operator can
steal funds or permanently censor. The residual trust — a federation
quorum — is the same floor the L0 reserve already stands on.

The cost of this choice is named openly: Liquid has no
concentrated-liquidity DEX and no precedent for a protocol-run
covenant market at scale. The ladder below is novel engineering on
Liquid's covenant and Simplicity primitives, accepted knowingly —
the liquidity *jobs* are what the design requires
([token.md §4](../primitive/token.md#4-protocol-owned-liquidity-pol)),
and covenants can do them.

---

## The asset

CGT is a standard Liquid issued asset:

- **Fixed supply at issuance.** The genesis issuance creates the
  full finite supply — the mint curve's asymptote, translated into a
  single pre-mint — and creates **no reissuance tokens**, so no key
  anywhere can ever mint more. The supply cap is enforced by the
  chain, not by policy.
- **Registered.** The asset carries a Liquid Asset Registry entry
  (ticker, name, precision, issuer domain), the listing prerequisite
  for standard Liquid wallets and venues.
- **Burnable by anyone.** Burn is the protocol's `destroyamount`
  primitive — provable supply destruction, permissionless per
  holder. The campaign burn line
  ([economics.md §7](../primitive/economics.md#7-the-conservation-equation))
  executes as literal destruction, exactly the semantics
  [token.md §1](../primitive/token.md#1-the-unit-of-account) promises.
- **Deliberately explicit.** Liquid blinds amounts by default;
  protocol transactions — tranche releases, ladder placements,
  payouts, escrow movements, conversions, burns — are written with
  **explicit (unblinded) amounts and asset ids**. Public accounting
  is a design requirement, and an unreadable ledger cannot honor it.

---

## Supply release — timelocked tranches

The calendar mint of [token.md §2](../primitive/token.md#2-issuance--the-decaying-calendar-mint)
executes as a **release schedule**: the pre-minted supply is split
at genesis into tranches locked under **plain absolute timelocks**
matching the calendar curve's steps. A tranche becomes spendable
when its date arrives and not a block earlier — the schedule is
consensus-enforced, not an operational promise, and it needs no
covenant machinery: absolute timelocks are the oldest, most boring
primitive on the chain.

"Mint" in token.md's supply arithmetic thereby reads as *release*:
total issued supply is a genesis constant; the curve governs when
tranches unlock into the ladder's ask side. Live supply still
evolves as release minus burn, and the long-run deflationary
crossover of [token.md §5](../primitive/token.md#5-supply-trajectory)
is unchanged.

---

## The ladder

The protocol-owned liquidity of
[token.md §4](../primitive/token.md#4-protocol-owned-liquidity-pol)
is a **protocol-run covenant order ladder** — resting orders on the
chain itself, non-custodial once placed:

- **Ask side — released supply.** Unlocked tranche CGT sits in
  covenant sell orders spaced geometrically above the anchor price —
  the discretized band. Each covenant is spendable by anyone paying
  its stated price in L-BTC, without the protocol's cooperation.
  Freshly released CGT therefore enters circulation only as buyers
  lift orders — demand-coupled release, done the UTXO-native way.
- **Bid side — exit liquidity.** Treasury-held L-BTC sits in buy
  orders below the anchor: the always-on exit for contributors
  cashing out earnings. Ask-side sale proceeds fund this side first —
  the base-asset accrual that keeps the exit market solvent is
  protocol principal, never revenue.
- **The anchor — a fold over the ladder's own fills.** The reference
  price is a **published deterministic fold over the ladder's own
  on-chain fills**, epoch-granular — anyone recomputes it from chain
  data; no oracle, no external venue dependency. The manipulation
  economics carry over from the TWAP argument: moving an averaged,
  fill-weighted anchor takes sustained capital against the ladder's
  own depth.
- **The spread — the trading income.** Asks sit above the anchor,
  bids below; the gap is a governed parameter. A round trip through
  the ladder pays that gap to the protocol — the order-book form of
  the pool fee, collected through prices instead of a fee switch. It
  scales with everything that enters or exits CGT across this
  market: advertisers funding campaigns, earners cashing out, and
  every future use that buys in or sells out.
- **Re-placement — an auditable treasury operation.** Each epoch the
  protocol re-centers unfilled orders around the updated anchor,
  tops the bid side back to its liquidity target, and sweeps the
  realized spread gain above that target to the team treasury
  ([token.md §4.5](../primitive/token.md#45-income-disposition--the-spread-flows-to-the-team-treasury)).
  Placement and sweep transactions are explicit and follow a
  published cadence — auditable like every other treasury flow.

The division of the two L-BTC flows is deliberate: **tranche-sale
proceeds are principal** (they become the bid side's depth), **the
spread is income** (it goes to the team). Routing release proceeds
to the team would monetize the supply curve itself; the ladder
keeps the team's income tied to trading activity, as the pool fee
was.

---

## Payouts — batched push

Settlement commits the payout tree on L1 — the Merkle root inside
the settlement payload
([economics.md §10](../primitive/economics.md#10-the-settlement-record-and-the-payout-flow)).
The rail side then **pays every earner directly**: batched
transactions whose explicit outputs match the committed tree, one
output per earning account at its payout address, fees paid by the
protocol. There is no claim step, no distributor contract, and no
gas responsibility on the earner.

- **Non-payment is publicly provable.** The tree is witnessed on L1
  and the outputs are unblinded: anyone can line up leaves against
  outputs. A missing or short output is a broken public promise,
  visible to everyone — that substitutes for the trustlessness the
  claim model bought with per-user proofs.
- **Delivered, not held.** Earnings land at the earner's own
  address at settlement; there is no unclaimed pool to account for,
  expire, or strand. Delivered CGT is self-custodied
  from the moment it lands and survives anything platform-side,
  account deletion included
  ([erasure.md](../instances/erasure.md)).
- **The destination is the witnessed payout address** — the guild-key
  field of the account's Registration payload
  ([user.md §3](../primitive/user.md#3-graph-side-properties)), a
  Liquid address, public and actor-attributed. Payouts read the
  address in force at the attribution epoch `t*`, the same one-ruler
  rule everything else in a settlement reads
  ([economics.md §8.3](../primitive/economics.md#83-everything-at-t)) —
  so the committed tree pins amount *and* destination, and the
  output match stays a pure function of public state.

---

## Escrow — the campaign deposit

A campaign's deposit `D` moves into a **script escrow** when the
campaign anchor lands, and the anchor's payload carries the escrow
pointer — funding is provable from the start
([economics.md §3](../primitive/economics.md#3-the-campaign-record)).
The escrow's authority shape:

- **2-of-2, advertiser + platform**, for every movement during the
  campaign window and the evaluation delay — top-ups, the refund
  split of a discretionary settlement, the payout split itself. The
  advertiser can never be paid out *from*, and the platform can
  never redirect, unilaterally.
- **Timelock fallback to the settlement key.** Past the fallback
  maturity, the platform's settlement key alone can execute — which
  is what lets auto-settlement fire for an absent advertiser
  ([economics.md §6](../primitive/economics.md#6-settlement-and-release))
  without ever holding unilateral authority while the advertiser is
  live.

Release always executes the settlement split of
[economics.md §7](../primitive/economics.md#7-the-conservation-equation):
payout batch, treasury share, reserve line, burn, inviter shares —
one escrow, explicit outputs, matching the settlement payload.

The platform's signature is the **oracle** in this shape: Liquid
scripts cannot read L1, so the platform key attests the L1 outcome
the release matches — the settlement payload and its epoch
certificate. That seam is L1's own posture: a terminal escrow "may
observe the public log", and the observing mechanism is terminal
(`rem:graph:settlement-cross-layer`,
[layer1-interface.md §7.2](../primitive/layer1-interface.md#72-settlement-recognition)) —
the attestation is CoGra's to make and everyone's to audit, against
the same public state it attests.

---

## Conversion — the reserve line

The L0 reserve pool's single outflow
([token.md §6.2](../primitive/token.md#62-the-l0-reserve-pool)) runs
entirely inside the one chain: the pool's `reserve_share·P` inflow
is swapped **CGT → L-BTC through the protocol's own ladder** — the
reserve pool sells into the bid side like any other holder — and the
resulting L-BTC executes **destination-addressed Layer-0 burns** at
members', system actors', and Collectives' own addresses, the
funder-unconstrained burn L1 permits.

- **Execution-time price, never a frozen rate.** Each settlement's
  reserve line converts at the market the ladder shows when the
  conversion runs, chunked to bound price impact. No internal
  CGT/L-BTC factor is ever quoted or held — a layer that freezes a
  conversion factor across its period inherits and can amplify
  within-cycle timing advantages, so no such factor exists.
- **Publicly accounted.** CGT in, L-BTC out, burns executed — all
  explicit on one chain. The steady-state target ("advertiser
  revenue covers the community's L0 costs") stays checkable in
  realized terms, arithmetic over public transactions.

There is no peg step, no exchange hop, and no custody boundary in
this flow: CGT and the L0 reserve asset live on the same chain, and
the two economies still touch only here, in the one sanctioned
direction ([economics.md §1](../primitive/economics.md#1-the-two-economies)).

---

## Keys

The rail key is an ordinary **device-held Liquid key** — the same
custody posture as the actor key
([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission),
[android.md](android.md)): generated and held on the user's device,
never in CoGra custody, backed up through the same recovery-code and
client-encrypted-blob story
([auth.md "Key recovery"](auth.md#key-recovery)). There is no smart
account, no passkey contract stack, and no counterfactual address
machinery — a UTXO chain needs none of it; an address exists the
moment the key does.

The account's payout address is published as the Registration
guild-key field ([user.md §3](../primitive/user.md#3-graph-side-properties)) —
updating it is a parallel Registration, newest wins, every prior
state witnessed. Losing the key and its recovery code loses the CGT
at that address; CoGra cannot recover it and never could — the same
responsibility line auth.md draws for the actor key.

Build-time candidate: **LWK** (Blockstream's Rust Liquid wallet kit,
with UniFFI bindings) fits the existing Rust + UniFFI stack for
backend and Android alike — to be verified when the rail is built.

---

## Tipping

A tip is **a rail transfer plus a public stance**. The money leg is
an ordinary Liquid transaction from the tipper's device-held rail
key to the recipient's witnessed payout address; the graph leg is a
tipper-authored **Opinion toward the tipped node** — an ordinary
priced stance (low-defaults policy) whose payload carries the
rail-transaction pointer. The graph carries the pointer, never the
amount, like every other money fact.

- **Deliberately public.** The in-CoGra tip is public display — the
  stance, the pointer, and the explicit (unblinded) transfer are all
  readable by anyone. The private flow needs no platform: a direct
  chain send to the same address exists outside CoGra by
  construction; CoGra adds only the public gesture.
- **The destination is resolved, never chosen.** The transfer pays
  the tipped node's **author's** witnessed payout address — the same
  Registration guild-key field push payouts read. An account with no
  payout address is not tippable; the UI prompts the would-be
  recipient to set one. There are no held balances and no unclaimed
  pool, here or anywhere on the rail.
- **Targets: any authored passive node except Chats and Items.**
  Content, Comments, chat Messages, and Profiles (the direct person
  tip) all resolve to their author. Items are excluded — goods, not
  first-person expression, and the certified owner and the genesis
  author can diverge, so there is no unambiguous recipient. Chats
  are excluded — a shared space, not one member's expression. A tip
  toward an encrypted chat Message leaks nothing new: record
  existence and membership are already public L1 structure, and the
  body stays ciphertext.
- **No fee lines.** The fee is on the gate, not in the internal
  flow: protocol income realizes where CGT enters and exits — the
  ladder's spread — so a tip carries no burn, treasury, inviter, or
  reserve share
  ([economics.md §7](../primitive/economics.md#7-the-conservation-equation)).
  The tipper's only protocol cost is the stance's own θ-debit,
  admission money like any act's.

---

## The marketplace rail

Ownership rides L1's settlement machinery end to end —
`Bid → Accept → Ratify`, title read from `owner^(k)`, never authored
([items.md](../instances/items.md)). Money is the CoGra-side half,
and it is purely rail-side — a transfer is never a graph object:

- **Prices live on the graph as terms, never amounts held.** The
  asking price is a field of the Item itself, riding the edit-fold
  payload under the current certified owner's authorship —
  witnessed, public, newest-wins, portable across L2s
  ([items.md §6](../instances/items.md#6-the-money-seam)). The
  offered price is a term on the Bid's payload. Both are numbers
  the records pin; the rail moves the money.
- **Fund-at-Bid.** The buyer locks the purchase escrow before the
  Bid lands, and the Bid's payload carries the escrow pointer — the
  campaign pattern: funding provable from the start. A Bid is
  thereby funded, willing capital, never a free option. Cancel is
  the ordinary Withdraw — the offer dies instantly on L1 — and the
  refund follows on the platform's next attestation sweep.
- **The purchase escrow is a fixed-destination two-branch
  covenant.** Branch A pays the **seller's address**: executable by
  the platform's signature — attesting the settlement certificate,
  title transferred — or by the buyer's signature alone. Branch B
  **refunds the buyer**: by the platform's signature — attesting
  defeat (a Withdraw or Rescind, a consumed tie, a competitor's
  earlier epoch) — or by the seller's signature alone. Each party
  can move money only **away from itself**, and the platform only
  selects between the two legitimate outcomes — it can never
  redirect. The two bad end states — buyer holding title and
  refund, seller holding title and payment — are structurally
  unreachable: no signature combination produces them.
- **No timelock fallback — deliberately.** The script can never
  learn whether title transferred, so any time-based self-refund
  would reopen the buyer-keeps-both state. The accepted residual is
  **liveness, never safety**: a dark platform plus an apathetic
  counterparty strands funds in escrow; it never double-pays.
  Either counterparty can always resolve unilaterally in the
  other's favor, and commercial reputation
  ([items.md §5](../instances/items.md#5-commercial-reputation)) is
  the soft incentive to do so.
- **The platform signature is the oracle**, exactly as in the
  campaign escrow: it attests the L1 epoch-certificate outcome —
  recognition for branch A, defeat for branch B — because Liquid
  scripts cannot read L1; the escrow observes the public log
  through CoGra's key, and that mechanism is terminal
  (`rem:graph:settlement-cross-layer`). Release keys on the epoch
  certificate, never the Ratify — the regret window sits between
  them.
- **No per-sale fee.** The same gate posture as tips: the protocol
  earns where money enters and exits CGT, never inside the flow.
