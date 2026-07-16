# Notation

Two symbol ledgers govern the math in these docs, and they never
mix:

- **L1 symbols** are defined by the PeerNetworks Layer 1 spec and
  indexed in
  [layer1-interface.md §14](layer1-interface.md#14-symbol-ledger-layer-1-tagged-objects)
  (constants in §6). CoGra docs cite them; they are never redefined
  here. The interface governs on any discrepancy.
- **CoGra symbols** — the L2's own calibration and computation
  vocabulary — are indexed below, each with its canonical home.

Mechanical notation derived from a listed symbol (path indices,
per-track components) and self-explanatory `snake_case` names are
defined where they appear.

## 1. L1 symbols most used in CoGra docs

A convenience subset; the ledger is the authority.

| Symbol | Meaning |
|---|---|
| `p_d`, `p_i` | The two user parameters of every edge record — directional and intensity role. |
| `Ψ_e`, `Ψ_e^[P]` | Stored 3×3 sentiment slice; its 2×2 path view. |
| `ε(e)`, `ε(p)` | Determinant sign of an edge / parity product of a path — the coherence bit. |
| `w̃(e)` | Damped edge weight: coherence × maturity × boundary. |
| `𝕋_e`, `τ_e`, `≺` | Lamport time, maturity scalar, causal order. |
| `E_k` | Epoch-`k` snapshot edge set. |
| `α_i` | Standing — gate input on L1, freely readable downstream. |
| `r_i`, `b_i`, `N_i` | Commitment rate, residual balance, action count. |
| `B_i` | The Layer 0 burn scalar L1 imports. |
| `θ`, `ν` | Safety price (the θ-debit) and numéraire. |
| `ρ_pol`, `ρ_θ`, `ρ_eff` | Policy floor, the wall, the door — the gate-axis floors. |
| `ρ_act`, `ρ_ep` | Action stamps read by the write rule (W2a / W2b). |
| `W_end(j → i)` | Endorsement-flow weight (vouch-gated max path product). |
| `L` | BFS depth bound of L1's endorsement flow (4). |
| `owner^(k)` | The title certificate. |
| `M_payload` | Payload byte bound. |

## 2. CoGra symbols

Feed-calibration parameters are governed properties of the
`:Network` singleton ([network.md](network.md)).

| Symbol | Meaning | Canonical home |
|---|---|---|
| `k` | Number of node-disjoint paths the feed extracts and sums per (viewer, target). | [feed-ranking.md](feed-ranking.md) |
| `γ` | Per-hop attenuation on path products (default `1`). | [feed-ranking.md](feed-ranking.md) |
| `χ` | The dust floor — the contribution floor bounding feed traversal; a compute cutoff. | [feed-ranking.md](feed-ranking.md) |
| `f(Δt)` | Recency factor on a path's terminal stance record; `Δt` is epoch age. | [feed-ranking.md](feed-ranking.md) |
| `S(u,c)` | CoGra's feed score — viewer `u`, candidate `c` (CoGra's published reimplementation of the terminal default). | [feed-ranking.md](feed-ranking.md) |
| `R_C` | CoGra's campaign reward share. | [economics.md](economics.md) |

## 3. Glyph discipline

When a new CoGra doc needs a symbol, it checks the interface
ledger first and picks a free glyph. Two collisions are
sanctioned, each disambiguated by context: CoGra's path count `k`
beside L1's epoch index `k` (as in `E_k`), and the recency factor
`f(Δt)` beside the L0 fee `f` in `(1−f)ζ`. Any other collision is
a review error, not a style choice.
