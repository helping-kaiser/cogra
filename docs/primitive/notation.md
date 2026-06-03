# Notation

The primitive's math docs ([feed-ranking.md](feed-ranking.md),
[economics.md](economics.md), [graph-model.md](graph-model.md),
[network.md](network.md)) are mathematical specifications, and use
symbolic notation — single letters, Greek, and subscripts — because the
formulas are meant to be read and manipulated as algebra, where symbols
carry structure that descriptive names bury.

This is the single lookup for every cryptic symbol — single letters,
Greek, subscripts — used in the math docs, whether shared across docs
or local to one. Each symbol's **canonical definition** — the full
derivation and the reasoning — lives in the linked section; this table
only says what the symbol *is* and where to read more.

Two things are deliberately left out, defined where they appear:
**mechanical notation** derived from a listed symbol (a path-specific
`R_π`, the per-track components `H_s`/`H_c` of a metric, an edge index
`e_k`), and self-explanatory `snake_case` names (`h_anchor`,
`declared_goal`, …), which are not cryptic to begin with.

## Roots, targets, and paths

| Symbol | Meaning | Canonical home |
|---|---|---|
| `U` | **Root node** — the perspective a ranking is computed from. | [feed-ranking §1](feed-ranking.md#1-setup) |
| `t` | **Target node** — the node being ranked or scored. | [feed-ranking §1](feed-ranking.md#1-setup) |
| `B` | **Reactor** — the actor whose terminal (reactor) edge expresses a stance on `t`. | [feed-ranking §3](feed-ranking.md#3-per-edge-composition-along-a-path) |
| `C` | **Content carrier** — the source of a `:REFERENCES` reactor edge `C → t`. | [feed-ranking §3](feed-ranking.md#3-per-edge-composition-along-a-path) |
| `π` | A single **path** from `U` to `t`. | [feed-ranking §3](feed-ranking.md#3-per-edge-composition-along-a-path) |
| `R` | **Path length** — number of edges from `U` to `t` (an operational cost knob, not a math bound). | [feed-ranking §2](feed-ranking.md#2-parameters) |
| `S` | **Scalar node value** — an intrinsic per-node scalar used to pre-order nodes within an `R` group at sort time. | [feed-ranking §2](feed-ranking.md#2-parameters) |
| `Δt` | **Elapsed time** since a reactor edge's top layer was added. | [feed-ranking §7](feed-ranking.md#7-time-and-recency) |

## Edge dimensions

| Symbol | Meaning | Canonical home |
|---|---|---|
| `dim1` | **Signed valence** per edge — sentiment / approval / affirmation, in `[−1, +1]`. | [graph-model §6](graph-model.md#6-dimension-semantics) |
| `dim2` | **Signed connection-weight** per edge — interest / relevance / importance, in `[−1, +1]`. | [graph-model §6](graph-model.md#6-dimension-semantics) |

## Path composition

| Symbol | Meaning | Canonical home |
|---|---|---|
| `s_path` | **dim1 chain** — signed product of `dim1` over the path's factor-contributing edges. | [feed-ranking §3.3](feed-ranking.md#33-dim1-chain--signed-multiplication) |
| `c_path` | **dim2 chain** — `\|dim2\|` product, sign tainted negative if any `dim2` on the path is negative. | [feed-ranking §3.4](feed-ranking.md#34-dim2-chain--taint-sign--magnitude-product) |

## Decay and pruning

| Symbol | Meaning | Canonical home |
|---|---|---|
| `d(R)` | **Distance decay** by path length; default `0.1^(R−1)`. Frontend- and network-tunable. | [feed-ranking §4.1](feed-ranking.md#41-path-contribution-and-distance-decay) |
| `f(Δt)` | **Time decay** on the reactor edge; default `0.5^(Δt / 30 days)`. Frontend- and network-tunable. | [feed-ranking §7.3](feed-ranking.md#73-shape--exponential-30-day-half-life-frontend-tunable) |
| `ε` | **Dust floor** — the branch-and-bound threshold below which partial paths are pruned. | [feed-ranking §4.4](feed-ranking.md#44-dust-floor--branch-and-bound-path-pruning) |
| `b` | **Branching factor** — graph degree; path count through a cluster grows as `b^(R−1)`, which is what `ε` bounds. | [feed-ranking §3.6](feed-ranking.md#36-bot-resistance-via-the-0-0-severance-edge) |

## Per-target metrics

The four metrics form an opinion-vs-reach × personal-vs-absolute grid.
Each is a 2-tuple: a **sentiment component** (`*_s`, from the `dim1`
track) and an **interest component** (`*_c`, from the `dim2` track),
collapsed to a scalar at sort time.

| Symbol | Meaning | Canonical home |
|---|---|---|
| `h` | **Personal opinion** — trust- and connection-weighted opinion toward `t` (uses `d(R)`). | [feed-ranking §4.2](feed-ranking.md#42-the-four-metrics) |
| `i` | **Personal reach** — how strongly `U` reaches the reactors, regardless of stance (uses `d(R)`). | [feed-ranking §4.2](feed-ranking.md#42-the-four-metrics) |
| `j` | **Absolute opinion** — `t`'s net valence graph-wide; same for every viewer (no `d(R)`). | [feed-ranking §4.2](feed-ranking.md#42-the-four-metrics) |
| `k` | **Absolute reach** — `t`'s total interaction volume, signs absorbed; same for every viewer (no `d(R)`). | [feed-ranking §4.2](feed-ranking.md#42-the-four-metrics) |
| `α`, `β` | **Collapse weights** — frontend weights on the sentiment and interest components when collapsing a metric tuple to a scalar (default `1, 1`, i.e. sum). | [feed-ranking §4.3](feed-ranking.md#43-tuple-collapse-to-scalar) |

## Economics

Campaign, settlement, and attribution symbols. `D` and `P` also drive
the [token](token.md) burn/treasury formulas; the rest are local to
[economics](economics.md).

| Symbol | Meaning | Canonical home |
|---|---|---|
| `D` | Campaign **deposit** — the on-chain escrow amount funding a campaign. | [economics §2](economics.md#2-the-campaign-node) |
| `P` | **Payout** — amount released to the contributor pool at settlement, `P ∈ [0, D]`. | [economics §4](economics.md#4-settlement-and-release) |
| `g` | The `d(R)` **decay base** for a campaign's reach metric and payout split (default `0.1`). | [economics §6.4](economics.md#64-earnings-by-distance--the-dr-base-g) |
| `τ` | **Sustain window** — one-third of the campaign window, `(end_ts − start_ts) / 3`; a reach level must hold for ≥ `τ` to count. | [economics §4](economics.md#4-settlement-and-release) |
| `φ_i` | **Shapley value** — player `i`'s attribution share of the contributor pool. | [economics §6.1](economics.md#61-the-closed-form) |
| `w_π` | **Path weight** in the Shapley sum: `d(R_π) · f(Δt_π) · (s_path(π) + c_path(π))`. | [economics §6.1](economics.md#61-the-closed-form) |
| `A_π` | Set of **distinct authors** of every edge and content node on path `π`. | [economics §6.1](economics.md#61-the-closed-form) |

## Network-seeded parameter names

The decay parameters above are seeded on the `:Network` singleton and
recalibrated by the network. The property names map to the symbols:

| Property | Symbol | Canonical home |
|---|---|---|
| `distance_decay_base` | base of `d(R)` (default `0.1`) | [network §3](network.md#feed-ranking-calibration) |
| `time_decay_half_life_days` | half-life of `f(Δt)` (default `30`) | [network §3](network.md#feed-ranking-calibration) |
| `dust_floor` | the floor `ε` | [network §3](network.md#feed-ranking-calibration) |
