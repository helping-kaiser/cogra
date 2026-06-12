# Ledger

The chain is the ledger of money. The economics primitive defines
settlement as a graph event and the claim relationship at the
topology level ([economics.md §7](../primitive/economics.md#7-settlement-on-the-graph--the-claim-flow));
this doc is the mechanics half of that split — how an account gets a
self-custody key at signup, how the canonical claim distributor and its
non-custodial escrow work on-chain, how the `Wallet` node and the
`:PAYS_TO` edge bind it to the graph, and where campaign data lives across
the stores. Money amounts never touch the graph; the graph carries
relationships and pointers.

Design history:
[Q20 (resolved)](../open-questions.md).
The token's issuance and liquidity mechanics are a separate doc
([token.md](../primitive/token.md)); the named chain is an
implementation choice deferred there.

---

## Three stores, one ledger

The boundary rule ([data-model.md](data-model.md)) decides where each
piece of campaign and payout data lives: **navigate-or-weight → Memgraph,
display → Postgres, money → chain.** No store holds another's fields; the
shared UUID joins them ([architecture.md](architecture.md)).

| Store | Owns | Examples |
|-------|------|----------|
| **Chain** | the ledger of money | balances, transfers, per-settlement payout trees (Merkle roots), claim state, the canonical distributor's escrow |
| **Memgraph** | graph topology + pointers to chain | `Campaign` / `Settlement` / `Wallet` nodes; `:ANCHOR` `:PROMOTES` `:ENTITLES` `:CLAIMS` `:TRANSFERS` `:PAYS_TO` edges; the campaign terms that navigate or weight the graph |
| **Postgres** | display content + operational metadata | nothing campaign-specific — a `Campaign` carries no display content ([nodes.md](../primitive/nodes.md)); see [Where campaign data lives](#where-campaign-data-lives) |

---

## Self-custody from signup

Every account is backed by a signing key the **user** holds from signup —
a passkey / device-stored key backing a smart account, generated at
sign-up so onboarding is a normal login. There is no seed-phrase wall and
no "you must have a wallet to earn" gate.

- **CoGra never holds any part of the key.** No MPC shards, no custodial
  key-shard provider — that custody model is the thing being ruled out.
- **"No wallet" means no _funded or external_ wallet, not no key.** The
  cryptographic identity exists from day one, held by the user. A UI hint
  surfaces the responsibility: the key is copy-able / device-stored, and a
  lost key is unrecoverable by CoGra.
- **Counterfactual address.** A smart account's address is derivable
  before any on-chain transaction. Earnings accrue to it from the first
  settlement the account is entitled to, whether or not the user has ever
  funded or deployed the account.

### Why a key from signup is non-negotiable

Trustless claim is **equivalent** to the user holding a key from the
moment they earn — there is no zero-key trustless claim. A claimant proves
ownership with a key held since they earned, so CoGra is never in the
claim path. The zero-key alternative would force CoGra to attest
identity → wallet at claim time: a trusted gatekeeper with a liveness and
fraud surface, rejected as ethos-breaking. The key-from-signup model is
what makes the escrow below trustless, and it is why earnings survive
account deletion — the durable handle is the off-platform key, not the
in-network identity ([account-deletion.md](../instances/account-deletion.md)).

---

## The claim distributor

One **canonical, permanently-claimable distributor** contract holds every
account's claimable CGT. Each settlement publishes the per-contributor
split (Shapley, [economics.md §6](../primitive/economics.md#6-attribution--per-path-shapley))
as a **Merkle root** added to the distributor; the `Settlement` node
records that root and the canonical distributor address
([economics.md §7](../primitive/economics.md#7-settlement-on-the-graph--the-claim-flow)).

- **Claim, not push.** Each contributor claims by Merkle proof and pays
  their own gas. Push — the contract fanning CGT to every wallet at
  settlement with CoGra paying gas — is rejected: once users pay their own
  gas (the intended responsibility model) and earnings accrue as a
  claimable buildup, the mechanism *is* claim.
- **One accumulating buildup.** Because the distributor is canonical, an
  account's unclaimed total accumulates across every settlement it is
  entitled to, all claimable at its counterfactual address. The on-screen
  "unclaimed" figure is that running total — the
  test-the-network-then-cash-out UX.
- **Never expires.** Under self-custody the unclaimed pool is owned by
  user-held keys, not orphaned, so burning it would destroy *recoverable*
  user value; lost-key funds are already de-facto out of circulation
  (locked-forever ≈ economic burn without the confiscation). No supply
  reason compels expiry — deflation is carried by campaign burn and the
  asymptotic mint curve ([token.md](../primitive/token.md)).

Two consequences follow:

1. The distributor must stay **permanently claimable** — immutable, or
   upgradeable only in ways that can never strand a historical claim.
2. Supply accounting carries a growing **"unclaimed / locked" bucket**,
   surfaced for transparency, never destroyed.

**Gas batching.** Per-settlement roots are fixed by
[economics.md §7](../primitive/economics.md#7-settlement-on-the-graph--the-claim-flow)
(each `Settlement` carries its own root). A contributor entitled by
several settlements claims them in one transaction by submitting their
proofs together against the canonical distributor — the gas amortization
is a claim-call ergonomic, deferred to on-chain implementation; the
claim-by-proof model and the never-expiring buildup are unaffected by it.

---

## The `Wallet` node and the `:PAYS_TO` binding

The payout wallet is a **`Wallet` carrier node**
([nodes.md](../primitive/nodes.md)), created at signup carrying the
account's counterfactual self-custody address. The on-chain address is a
**layered property** ([layers.md](../primitive/layers.md)): re-linking
writes a new top layer, non-destructively.

- A single structural **`:PAYS_TO`** edge `User | Collective → Wallet`
  (`(0, 0)`, non-traversable) binds an account to its wallet — a one-hop
  "this account's wallet" lookup. There is exactly **one `Wallet` per
  account**: re-linking re-layers the address property on the same node,
  so the binding edge is permanent.
- The economic edges point at the **node**, not the address:
  `Settlement → Wallet` (`:ENTITLES`) and `Wallet → Settlement`
  (`:CLAIMS`) ([economics.md §7](../primitive/economics.md#7-settlement-on-the-graph--the-claim-flow)).
  Each reflects the address **in force when it was written** (the layer at
  that timestamp); future payouts read the current top layer. A wallet's
  earning and claim history stays attached across re-links.
- **Survives account deletion.** Redacting the `User` node
  ([layers.md §5](../primitive/layers.md#5-deletion-policy)) does not
  strand earnings — entitlements already point at the `Wallet`, and the
  chain honors the off-platform key
  ([account-deletion.md](../instances/account-deletion.md)).

---

## Where campaign data lives

There is **no Postgres campaign table.** A `Campaign` carries no display
content ([nodes.md](../primitive/nodes.md)), so by the boundary rule its
data splits across the other two stores:

- **Memgraph — the `Campaign` node.** The navigable / weighting terms and
  public state live as node properties
  ([economics.md §2](../primitive/economics.md#2-the-campaign-node)):
  `g`, `h_start`, `declared_goal`, `start_ts`, `end_ts`, `status`, the
  deposit pointer, the `dust_floor` in force, and the layered
  `achieved_h_gain` progress trajectory. The `:ANCHOR` / `:PROMOTES`
  declarations carry the anchor and target as topology. The
  auto-settlement
  scheduler finds campaigns past `end_ts + 30d` by querying these node
  properties — an operational query over graph state, not a Postgres scan.
- **Chain — money.** The deposit, the per-settlement Merkle root, the
  distributor escrow, and claim state. Amounts never appear on the graph;
  the `Campaign` node's deposit pointer and the `Settlement` node's
  root / address reference them
  ([economics.md §7](../primitive/economics.md#7-settlement-on-the-graph--the-claim-flow)).
  The campaign escrow grants release authority to the advertiser
  during the window and the 30-day grace period, and to the backend's
  settlement key thereafter — which is what lets auto-settlement
  ([economics.md §4](../primitive/economics.md#4-settlement-and-release))
  fire without the advertiser.

A Postgres `campaigns` table is deliberately absent: it would have to
store the `anchor` / `target` node references it keys on, and those are
graph topology, which the boundary rule keeps in Memgraph ("neither
database stores the other's fields").

---

## Write coupling: chain and graph

Settlement is a single terminal event
([economics.md §7](../primitive/economics.md#7-settlement-on-the-graph--the-claim-flow)):
the on-chain Merkle root and the on-graph `Settlement` node (plus its
`:ENTITLES` edges) are written together, so a published root always has a
graph record pointing at it. A claim writes the on-chain claim and the
`:CLAIMS` graph edge together, keeping "entitled but unclaimed" a faithful
one-hop graph query
([edges.md §2](../primitive/edges.md#2-structural-edges)). Cross-store
write ordering and the failure modes around a partial write follow the
same discipline as the Memgraph ↔ Postgres pairing documented in
[account-deletion.md "Write ordering across stores"](../instances/account-deletion.md)
and [data-model.md](data-model.md) — the chain is simply a third store
under the same rule.
