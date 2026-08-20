# Layer 1 → Layer 2 Interface

> **Provenance.** This document is a derived reference extracted from the
> **PeerNetworks Layer 1** specification by the **Peer Team** (Peer Network,
> v0.23.2-dev, July 2026), reproducing its binding surface for the purpose
> of building CoGra as a Layer 2 on it. It is not the normative source —
> the PeerNetworks paper is. Licensed under CC-BY-4.0; see
> [LICENSE-DOCS](../../LICENSE-DOCS).

**Derived file — hard facts only.** v0.23.2-dev ships as the flat source
(`PeerNetwork_PeerNetwork_v0.23.2-dev_flat.tex`); its internal
`\setversion` string still reads v0.23.0-dev — the filename edition is the
one distributed, and it carries the **Edition 4** body rewrite (the
authored-act ontology, the admission handshake, the authoritative act
order, and the epoch-quantized staged standing refoundation). This
reference draws two scopes from it:

- **The closure surface** — the binding material only: kernel record, the
  admission rules, closure quantities, the two straddlers, and the shared
  mathematics. Terminal read-sites are *named* in its boundary ledger
  (`tbl:symbols:boundary`) but their mechanisms are not specified there.
  Cited below by anchor label (`def:…`, `post:…`, `lem:…`, `rem:…`, `ax:…`,
  `subsec:…`); Layer 0 objects are cited through `PA-` labels.
- **Terminal / full-paper material** — a superset: additionally specifies the
  terminal defaults (Content Sorting, Advertiser Transport, Content
  Governance, the Compositional Attribution Calculus, bilateral bridge
  transport) with numbered theorems. Cited below as *PN full §N / Theorem
  N.M*, and used **only** for terminal-default material (§4.1–4.2, §10, §14.5
  below), the grant's verbatim text (§4), and one definition in §9.4.

Proofs, motivation prose, and Layer 0 internals are omitted.

**Pinned anchor set.** This file's citation set is pinned under the spec's
anchor-stability contract: 341 distinct anchor names,
`anchor_set_hash = 2a127f2ed527da32af0f024d378dc5e14a267f4756a2f23540ea4959080e11f1`
(sha256 over the sorted distinct anchor names joined by `\n`, no trailing
newline). Once
registered with the Peer Team, renaming any pinned label is a breaking
change on their side. Recompute and re-register the hash whenever a
citation is added or removed.

Purpose: the normative reference for rebasing CoGra as a Layer 2 on this
substrate. Everything in this file is binding on a Layer 2 exactly as stated;
anything not in the feedback closure below is a Layer 2's to reimplement
(`post:transport:guild-grant`).

---

## 1 The layer model

- **Layer 0 (Peer Attestation)** — the frame source. Exports exactly one
  object, the attestation map, and by declining to price it guarantees its
  neutrality. Knows nothing of clusters, terminal read-sites, or guild
  policy. (`subsec:introduction:two-layers-derived`)
- **Layer 1 (Peer Network)** — the binding. Reads the Layer 0 object as the
  network's source, welds it onto a public directed graph $G = (V, E)$ to
  produce the relative-standing field $\alpha_i$
  (`def:epoch:final-standing`), and publishes the closure quantities
  admission reads. The public-auditability layer.
- **Terminal complement (Layer 2: guilds / consumers / services)** —
  read-sites. Downstream services consume $\alpha_i$, title, and other
  published values at terminal sites. The closure edition names the terminal
  complement only in the boundary ledger (`tbl:symbols:boundary`) and the
  grant (`post:transport:guild-grant`); it specifies none of its mechanisms.
  Identity association and payload carriage are terminal.

| Layer | Comparator role | Owns / prices |
|---|---|---|
| Layer 0 (Attestation) | frame source — supplies the neutral exogenous scalar | owns nothing of the graph (`rem:comparator:neutrality-from-silence`) |
| Layer 1 (Network) | the binding — welds the frame onto $G$, publishes the standing field, the ledger, and every closure constant | owns the public infrastructure; earns only the Layer 0 fee |
| Terminal complement | read-sites — downstream services may consume $\alpha_i$, title, and other published values at terminal sites | named only in `tbl:symbols:boundary`; mechanisms not specified in the closure edition |

(`tbl:introduction:layer-roles`)

The map from an actor to the *person* behind it is never represented at
Layer 1: it has no feedback read-site, hence terminal. Severing it changes
no $\alpha_i$, no $W_{\text{end}}^{(k)}(u \to i)$, no title, and no gate.
(`rem:comparator:identity-is-layer-2`)

---

## 2 The boundary predicate (feedback closure)

The boundary is not a list; it is a closure, and a Layer 2 can decide
membership itself. (`subsec:network:admission-closure`)

**Admission Closure and the Binding Boundary
(`def:network:admission-closure`).** Work on the *consumption graph*,
whose nodes are the network's published values and rules and whose directed
edge $V \to r$ records that read-site $r$ consumes value $V$. The *admission
set* $\mathcal{A}$ is the set of rules that decide whether a proposed final
epoch write set becomes the next public edge set — six rule groups:

- **(formation)** the act-identifier, endpoint-typing, asserted-parent,
  dependent-set, approval-witness, and authoritative-order rules
  (`def:graph:act-identifier`, `def:graph:act-causal-parents`,
  `def:graph:dependent-act-set`, `def:graph:approval-witness`,
  `def:graph:authoritative-act-order`). Formation is class-syntactic and
  stateless except act-identifier freshness
  (`lem:graph:act-edge-identifier-uniqueness`); only an approved verified
  act may be ordered, and only a Registration may carry fresh grounded
  endpoints (`def:graph:registration`);
- **(final state)** the proposed completed edge set and final post-debit
  balance/count pairs (`def:epoch:proposed-final-act-state`);
- **(conserved standing)** the complete conserved standing package — fold
  cells and their coefficients, the base allocation matrix, wall-clamped
  activation, the accepted tilt rung, source emission, and the certified
  equilibrium (`def:network:conserved-standing-package`) — which feeds
  W2a/W2b through the published final standing and stamps;
- **(final gates)** the write rule: **W1** solvency (debited)
  $b_i \ge \theta^{(k)}$, **W2a** individual final safety
  $\rho_{\text{act}}(q) \ge \rho_\theta$, **W2b** the averaged epoch door
  $\rho_{\text{ep}}^{(k)} \ge \rho_{\text{eff}}$, and the epoch act budget
  $|\mathcal{Q}_k| \le N_{\text{epoch}}$
  (`post:epoch:final-act-sequence-write-rule`);
- **(recognition)** settlement recognition and the prior title input its
  clause (iii) consumes (`def:graph:settlement-recognition`). Recognition
  gates *binding effect*, not the write — an unauthorized Accept is written
  but never binds — and reads no selection position
  (`rem:graph:title-order-irrelevance`);
- **(write)** admission of the valid final write set and publication of the
  final edge set (`def:network:write`, `post:epoch:final-edge-set`): the
  host writes a valid sequence of dependent sets within the target budget;
  selection among valid final sets is discretionary and touches membership
  only.

The *feedback closure* $\overline{\mathcal{A}}$ is the transitive set of
values read — directly, through other values, **or through a binding
validity predicate** — into any rule in $\mathcal{A}$. A value belongs to
the closure not only when it appears arithmetically in W1/W2 or
recognition, but also when its validity decides which value may appear
there: the complete-act projection, the exact depth-two envelope, the
depth-three/depth-four admission fractions, the stage equilibria, the
declared stage boxes, and the stage row-certificate verdicts all lie in
$\overline{\mathcal{A}}$ — they determine which certified stage, and
therefore which final standing, reaches W2. A **proof transcript** is
different: it is *evidence about* a binding value with no alternative
arithmetic read-site — replacing a valid transcript with another proof of
the same committed statement changes no standing. Transcripts are
verification objects, not closure inputs.

A read-site is *terminal* when its output is consumed only by an agent (a
user, a terminal service, a guild, an advertiser, or another downstream
policy) and never re-enters the forward evolution of $E$. An object is then

- **Layer 1 (binding)** iff it lies in $\overline{\mathcal{A}}$ — it
  influences admission;
- **terminal (free)** iff every one of its read-sites is terminal.

Two laws make the predicate usable:

1. **Authority is per read-site, not per object.** A value with one feedback
   read-site and one terminal read-site is closure-authored yet freely
   readable. A **straddler** is such a value whose terminal read-sites
   moreover consume the published value as an authoritative semantic object
   rather than recompute it for audit; exactly two first-class objects
   straddle this way — the standing field $\alpha_i$ (read by the gate, and
   read again as the reward multiplier) and the title certificate
   $\mathrm{owner}^{(k)}$ (read by recognition clause (iii), and read again
   by guild routing). The staged package contains many binding intermediate
   values — the exact depth-two envelope, the D3/D4 selections, the stage
   equilibria — but only the final standing field is a straddler; the
   intermediate stages carry no independent terminal semantics.
2. **Recomputability is irrelevant to authority.** The standing field, the
   title certificate, and the whole staged standing package are all
   recomputable from $E_k$ and the published constants, yet binding:
   recomputability sets *audit cost*, never *permission*. Audit rights do
   not become override rights.

**The decision a Layer 2 runs** for any quantity $V$ it wishes to own:

1. list every read-site $r$ that consumes $V$;
2. for each $r$, ask whether $r$'s output re-enters the forward evolution of
   $E$ — whether it feeds the write rule ($W1/W2a/W2b$), the formation rule,
   or settlement recognition. If so, $r$ is a *feedback* read-site;
   otherwise it is *terminal*;
3. if *every* read-site is terminal, $V$ is terminal: reimplement freely;
4. if *any* read-site is feedback, $V$ is Layer 1: consume the kernel's
   value; may not override it; may recompute it to audit.

**The straddlers.** Title is read by recognition clause (iii) (*feedback*)
and by terminal routing/display (*terminal*); the one feedback site makes it
binding — not because title is hard to compute (it is a deterministic fold
of $E_k$) but because two guilds disagreeing on the owner would recognize
different next settlements, forking $E$. Standing is the same: binding as
gate input — read by the gate through the write-rule stamps
($\rho_{\text{act}}$ at W2a, $\rho_{\text{ep}}$ at W2b) — free as a number a
Layer 2 reads downstream. Straddlers are consumed at their kernel value,
audited but not authored (`rem:transport:guild-grant-preconditions`).

**Boundary in one sentence.** The binding surface is the feedback closure
of final-set admission: the accepted record set, the final post-debit
ledger, the binding constants, the formation and recognition rules, the
complete staged standing package, final standing and stamps, and the W1/W2
validity verdicts. The exact depth-two envelope, the D3/D4 admission
fractions, the stage equilibria, and the stage row-certificate verdicts are
binding because changing any of them may change final standing and
therefore final-set admission. Everything else the network publishes is
terminal. Permission is decided per read-site by a single question — *does
this re-enter $E$?*
(`rem:network:boundary-one-sentence`, `post:transport:guild-grant`)

---

## 3 The boundary ledger (`tbl:symbols:boundary`)

The ledger is the normative referent of the closure scope and of the grant —
every published value sorted by feedback. A read-site is *feedback* if its
output **or validity verdict** re-enters the decision of what may be written
to $E$, and *terminal* otherwise. Each object carries exactly one of
the **five tags** (`tbl:network:object-taxonomy`):

- **(L0·input)** — originates below the comparator seam; cited at import,
  never authored.
- **(L1·closure)** — at least one read-site re-enters admission; consume the
  published value, recompute only to audit. **⋆** marks a *straddler*: binding
  as a feedback input, yet freely readable downstream.
- **(L1·verify)** — evidence required to reproduce or check a closure output;
  no feedback read-site, no formula consumes it; withholding it breaks
  auditability, falsifying it is publicly demonstrable.
- **(L1·by-product)** — a value the epoch computation produces anyway, which
  the host *may* publish as a non-normative convenience; a distrusting
  participant recomputes it. Nothing binding may depend on a by-product.
- **(L2)** — every read-site terminal; the guild's to reimplement under the
  grant.

Shared mathematics (norms, delimiters, number sets) is tag-exempt.

| Object | Feedback read-site | Terminal read-site | Verdict | Permission |
|---|---|---|---|---|
| accepted edge set $E_k$ + accepted authoritative act sequence $\mathcal{Q}_k$ (acts, honest $\mathbb{T}^{\text{act}}_q$) | substrate of all of $\mathcal{A}$ | — | L1·closure | consume only; agreement on $\mathcal{Q}_k$, not merely $E_k$ |
| binding constants + formula pins $\beta,\eta,\nu,\rho_{\text{pol}},\theta,m_\theta,N_{\text{epoch}},\delta_{\text{pos}},L_{\text{vch}},M_{\text{payload}}$; standing-census/compiler/coefficient/activation/allocator/certificate formula editions | standing activation / gate / formation / package validity / epoch target | — | L1·closure | consume only; no silent formula-edition change |
| canonical raw defaults: $q$, raw depth $L$, the canonical raw path-composition rule | — | feed / raw bridge / raw signed services | **L2** | reimplement freely at terminal read-sites |
| host-cached $\tilde{w}_{\text{spam}}, \tilde{w}_{\max}, \tilde{w}_{\max}^{\text{Op}}, \tilde{w}(e), \epsilon(e)$ | — | client convenience, raw diagnostics | L1·by-product | ignore and recompute freely |
| burn snapshot $B_i^{(k)}$ | gate via $\alpha$ | — | L0·input | consume only |
| identity order $\prec^*$, $\mathrm{pos}(e)$ | replay tie-break | — | L1·verify | consume only; consistency-audited |
| write rule $W1{:}\,b_i \ge \theta$, $W2a{:}\,\rho_{\text{act}} \ge \rho_\theta$, $W2b{:}\,\rho_{\text{ep}} \ge \rho_{\text{eff}}$ | is admission | — | L1·closure | consume only |
| closure rule (write) | is admission | — | L1·closure | consume only |
| set price | closure rule | — | L1·closure | consume only |
| $\theta$ / $\rho_\theta$ / $\rho_{\text{pol}}$ / $\rho_{\text{eff}}$ | floor validity / stamps / door | congestion dashboards | L1·closure | consume only; dial constrained by clamp, published |
| door headroom $H_k$ | — | congestion dashboards | L1·verify | consume only; outcome, no actuator |
| recognition predicate (i)–(vi) | is admission | — | L1·closure | consume only |
| formation rule (identifier algebra; endpoint typing; handshake) | is admission | — | L1·closure | consume only |
| dependent-set partition | validity replay | guild dashboards | L1·verify | consume only; recompute to audit |
| complete person-vouch compiler + projected standing graph (relation multigraph) | via projected standing → W2 | guild audit dashboards | L1·closure | consume only; recompute to audit |
| per-author folds, inviter revocation, person-vouch compilation | via projected paths → standing → W2 | terminal authored-history displays | L1·closure | consume only |
| relation coefficients $c(\xi)$, direct relation weights $W_{\text{rel}}$ | via source-relative paths → standing → W2 | guild audit/display | L1·closure | consume only |
| projected target activations $\bar{g}_{\text{vch}}(x_i)$ | via every projected vouch edge | terminal diagnostics | L1·closure | consume only |
| causal standing paths + source envelopes $W^{[h]}_{\text{env}}$ | via stage admission and final safe flow | terminal path diagnostics | L1·closure | consume only |
| stage admission fractions $t_k^{[h]}$, admission schedule | via $W_{\text{end}}^{(k)}$ → standing → W2 | admission dashboards | L1·closure | consume only |
| declared standing boxes, stage equilibria, path-incidence masses | standing-package validity | audit dashboards | L1·closure | consume only |
| residual balances $b_i$, action counts $N_i$ | source pairs of the standing mediant; W1 | ledger dashboards | L1·closure | consume only |
| final safe flow $W_{\text{end}}^{(k)}(u \to i)$ | standing mediant → W2 | guild/readout diagnostics | L1·closure | consume only |
| action + epoch stamps $\rho_{\text{act}}, \rho_{\text{ep}}$ | W2a / W2b | guild dashboards | L1·closure | consume only |
| stage row certificate $\mathcal{K}^{[h]}_{\text{row}}$ + binding verdict | selects positive relational schedule vs fallback | guild dashboards | L1·closure | consume only; recompute to audit |
| local width $W_{\text{loc}}$ | width fence + safety-threshold rule | guild dashboards | L1·closure | consume only; recompute to audit |
| accepted interval boxes, path-incidence transcript, fixed-point residual reports | — (evidence for the committed package) | any verifier | L1·verify | consume only; replayable evidence |
| attested boundary timestamp, closure cause | boundary-accountability replay | guild dashboards | L1·verify | consume only |
| title $\mathrm{owner}^{(k)}$ | recognition (iii) | guild routing | L1·closure ⋆ | consume kernel value; read downstream |
| standing $\alpha_i$ | gate | reward amplifier $(1+\alpha_C)$ | L1·closure ⋆ | consume kernel value; read downstream |
| ownership thread, Item genesis | title → recognition (iii) | terminal display | L1·closure | consume only; may recompute |
| settlement acts Bid / Accept / Ratify / Withdraw / Rescind | recognition predicate | terminal reputation / dispute policy | L1·closure (records/rules) | consume recognition result; terminal policy free |
| parallel bundles, all other folds | — | the guild / user | L2 | **reimplement freely** (`rem:graph:authored-act-bundle-consumers`) |
| membership fold $\mathrm{member}^{(k)}(a,C)$ | — | guild / chat policy | L2 | reimplement freely; policy defaults L1·by-product |
| raw $\tilde{w}(e)$ and $\epsilon(e)$ **formulas** | — | feed, raw bridge, raw signed diagnostics | **L2** | reimplement freely at terminal read-sites |
| payload projection / bytes | — (terminal by postulate) | user / L2 service | L2 | reimplement freely; carriage custody per phase |
| content witness | — (evidence; authenticates carriage) | any verifier | L1·verify | consume only; retained by Layer 1 across phases (`rem:graph:act-payload-custody-phases`) |
| feed $S(u,c)$ | — | the user | L2 | **reimplement freely** |
| reward $R_C$ | — | the guild | L2 | **reimplement freely** |
| CAN $V(n)$, aggregation fn | — | the guild | L2 | **reimplement freely** (subject to the three invariants, §4.1) |
| consent | — | guild / advertiser | L2 | reimplement freely; canonical defaults L1·by-product |
| bridge $\Xi_A$, channels, composition | — | the guild / advertiser | L2 | **reimplement freely** |
| identity association | — | the L2 service | L2 | **reimplement freely** |
| licensing / provenance metadata | — | terminal policy | L2 | reimplement freely |

The straddler line: standing and title are consumed at their Layer-1 value
where they feed back, and read terminally by guilds downstream. The only
straddlers are $\alpha_i$ and $\mathrm{owner}^{(k)}$; the standing package
adds binding intermediate values because W2 consumes their result and their
validity selects which relational schedule may take effect — but they are
not straddlers. (`subsec:symbols:boundary`)

Two reclassifications against the pre-Edition-4 ledger, both explicit in the
source: the **raw damped-weight and parity formulas are terminal defaults**
— $q$, raw depth $L$, $\tilde{w}(e)$, $\epsilon(e)$, and the derived raw
constants ($\tilde{w}_{\text{spam}}, \tilde{w}_{\max},
\tilde{w}_{\max}^{\text{Op}}$) are (L2) as formulas, (L1·by-product) as
host-cached values, because standing no longer consumes them
(`rem:epoch:shared-raw-edge-primitive`, `def:epoch:damped-edge-weight`);
and the raw-traversal **precision clip is deleted** — Layer 1 publishes no
raw pruning tolerance ($\epsilon_{\text{clip}}$ has no successor;
`rem:sorting:raw-pruning-is-implementation`).

Note: the payload **projection / bytes** are terminal by postulate — no
closure quantity reads them (removable-projection invariance), so they are
**L2**, a carriage-custody concern per phase. The **content witness** is
not: it is **L1·verify** evidence — no formula consumes it, but it
authenticates carriage and is retained by Layer 1 across both deployment
phases (`rem:graph:act-payload-custody-phases`); withholding it breaks
auditability. Only the structural record is L1·closure.

---

## 4 The reimplementation grant

**Guild Reimplementation Grant (`post:transport:guild-grant`):**

> A guild MAY redefine, replace, or independently recompute any published
> value every read-site of which is *terminal* — consumed only by an agent
> and never read back into the decision of what may append to $G$ (the
> write rule $W1/W2a/W2b$, the formation rule, or settlement recognition).
> Equivalently: a guild owns the entire *terminal complement* of the
> admission closure — the feed $S(u,c)$, the reward $R_C$, the CAN and its
> aggregation function, and the bridge transport and its composition rule.
>
> The terminal complement also includes raw graph scoring formulas: a
> guild may replace the canonical raw feed depth, diversity preference,
> raw damped-edge weighting, raw positive-subgraph composition, and raw
> bridge-consent policy, provided it publishes the replacement completely.
> The host's cached raw $\tilde{w}(e)$, $\epsilon(e)$, and derived raw
> constants are non-authoritative by-products.
>
> The grant does not include any component of the standing-update package:
> the complete-act compiler, projected standing graph, selected standing
> envelopes, admission fractions, standing box, row-certificate verdict,
> final $W_{\text{end}}^{(k)}$, and $\alpha_i$ are binding and must be
> consumed as published, though every participant may recompute them to
> audit.
>
> A guild MAY NOT override any value with a feedback read-site: the kernel
> inputs (accepted edge set, binding constants, burn snapshot), the
> admission rules, and the derived straddlers — the standing-update
> package with its relative-standing field $\alpha_i$ *as gate input* and
> the title certificate $T^{(k)}$ — which it must consume as published. A
> guild MAY still *recompute* any such value to audit it; recomputation is
> an audit right, never an override right.
>
> Deviating from a terminal default forks only the deviating guild (loss
> of composability); attempting to deviate from a binding value forks the
> shared graph and is rejected. The binding surface is the accepted-state
> kernel, admission rules, standing-update package, standing as gate
> input, and title — and no larger.

On the admission rules: the write rule ($W1/W2a/W2b$), formation, and
recognition are value-facing predicates a guild might try to recompute — the
grant's parenthetical names them, and a guild must consume their kernel
values (standing feeds the write rule through the stamps; title feeds
recognition). The **closure rule** — the host's act of admitting the final
write set — is equally binding, but it is the host's *action*, not a value a
guild recomputes; the grant folds it into "the admission rules" generally. A
guild cannot override what the host writes; it only consumes $\mathcal{Q}_k$
and $E_k$.

Grant soundness preconditions (`rem:transport:guild-grant-preconditions`):
(1) the binding surface is minimal and fixed; (2) straddlers are consumed at
their kernel value, audited not authored — a guild's own standing/owner has
no standing in the shared graph; (3) the feedback-but-terminally-consumed
cell (`frontier:settlement-tie-fabrication`) is flagged, its remedy handed
to the terminal complement under the grant.

**Computed share vs. realized reward** (PN full §8,
`rem:transport:guild-economic-autonomy`): the reward formula
`eq:transport:reward-formula`
produces a deterministic, independently reproducible normalized share $R_C$
of pool $\mathcal{L}$; unit of account, payout schedule, guild fee/margin,
eligibility windows, and pool-funding relationship are Layer 2 policy
reserved to the guild; the sole constraint is publication (§I.12, the
formula-completeness invariant). No protocol-level fee is extracted from
$\mathcal{L}$. *(Full paper only — the closure edition names the reward
read-site in the ledger without specifying it.)*

### 4.1 Mandatory CAN invariants (full paper only)

The closure edition names terminal attribution only in the boundary ledger.
The full paper still constrains any reimplemented CAN:

**Definition B.1 (Mandatory Guild CAN Invariants)** (PN full App. B):

> Every guild CAN specification must satisfy all three:
>
> 1. **Depth decay** (Theorem B.16): credit cannot flow upward through
>    composition.
> 2. **Transmission strictly less than one** (Proposition B.7): every composition
>    step attenuates.
> 3. **Context independence** (Theorem B.19): adding a consumer to an
>    existing node does not change its value.
>
> All other CAN parameters — aggregation function, attribution threshold,
> denomination of the enrichment factor — are guild choices within these
> constraints.

Canonical default aggregation (Definition B.6, Eq. (B.3)):
$\bar{w}(n) = \frac{1}{m}\sum_{j=1}^{m}\|\boldsymbol{\Psi}_{(n,c_j)}\|_F$,
$t(n) = \mathrm{sat}(\bar{w}(n))$ with $\mathrm{sat}(x) = \frac{x}{1+x}$;
guilds may substitute geometric mean, harmonic mean, or maximum provided
$t(n) < 1$ is preserved.

CAN composition-graph rules (PN full Def B.4): four rules; the
Layer-1-issued Declaration component enters as a leaf
keyed on source class; the Rule-2 hyper-edge families are Tag, Review, Send,
Bid, Invitation, and Reference; the control-edge exclusion covers settlement
(Withdraw, Rescind) and conversational (Leave, De-invite A·T) control
records, with Rule 4 taking precedence over Rule 2 for De-invite legs.

### 4.2 Layer 1 obligations and guild obligations

Layer 1 / operator provides: the public append-only graph
(`post:introduction:public-accessibility` … `post:introduction:epoch-edge-set`),
the commitment ledger and standing-compilation infrastructure, and the
epoch machinery (PN full §6, `subsec:epoch:epoch-boundary`). Publishes the
binding constants and the host-cached raw defaults (§6 below). The
operator's economic inflow is the Layer 0 minting fee — the sole
protocol-level value flow to the operator; no protocol-level fee is
extracted from content transactions, advertising spend, or guild reward
pools.

Each guild (PN full §8, `subsec:transport:guild-model`): (a) publishes its complete CAN recursion, all
guild-specific economic parameters, and its reward formula in full, so any
participant can independently reproduce every reward computation (§I.12);
(b) maintains a self-contained reward pool funded by guild-level advertising
spend, from which it may retain a published fee or operating margin;
(c) selects its own CAN aggregation function, attribution threshold
parameters, reward distribution schedule, and bridge composition rule;
(d) has no claim over Layer 1 infrastructure: edge records, commitment
scores, and standing values are public.

Burn consumption (`def:transport:commitment-via-burn`, PN full §8): $B_i \in \mathbb{R}_{\ge 0}$ is
the cumulative reserve-denominated value committed by actor $i$, read from
Layer 0. All formulas consume $B_i$ as a non-negative, non-decreasing,
publicly auditable scalar; no Layer 0 surface quantity appears. Burn
granularity (`rem:transport:burn-granularity`): compliant implementations must support precision
such that the reduced rate $\hat{r}_i = r_i/\nu$ is representable
to at least 8 significant figures.

Notes on the full paper's terminal defaults: $(1+\alpha_C)$
remains the sole Layer 1 factor in the guild reward formula Eq. (8.2)
(`eq:transport:reward-formula`); per-creator-epoch entropy is Eq. (8.3)
(`eq:transport:epoch-entropy`). The default feed S(u,c) (full §7,
`def:sorting:relevance-score`) is
**unchanged and explicitly not netting-aware** — stance aggregation applies
only to the standing projection; raw sorting reads raw records
unchanged. $q = \tfrac12$ is the canonical default for the raw services; a
guild may expose $q \ne \tfrac12$ for its own sorting only
(`rem:sorting:matrix-bfs`). Every relevance calculation consumes only the
**final** reduced standing of the creator; stage internals have no feed
read-site (`rem:sorting:final-standing-input`). The bridge transport:
Channel 2 is stance-signed ($\mathrm{sgn}(p_d(e_{\text{Op}}))$, not
$\epsilon$), and Channel 3 consent carries an **absolute direct-stance
veto** (a negative net direct stance
$\bar{p}_d^{(A \to \text{Profile}_B)} < 0$ hard-zeros consent).

---

## 5 Substrate guarantees (what Layer 1's infrastructure postulates)

Stated independently of any mechanism that achieves them.

- **Public Accessibility (`post:introduction:public-accessibility`).** The
  graph record and the ledger are continuously readable by any participant
  at any time, without access control or authentication.
- **Record Integrity (`post:introduction:record-integrity`).** Once an edge
  record or ledger entry is published, it cannot be silently altered. A
  participant who retrieves a record may treat it as matching what was
  published.
- **Irrevocability (`post:introduction:irrevocability`).** A ledger entry,
  once published, cannot be reversed, removed, or reduced. The monotone
  non-decrease of the committed quantity $B_i$ is a Layer 0 property the
  network reads, not a network primitive.
- **Authoritative Ordering (`post:introduction:authoritative-act-order`).**
  The host chooses a total **authoritative order** over the accepted
  authored acts of each epoch and assigns each act a logical time by its
  position (`def:graph:authoritative-act-order`). The order is semantically
  authoritative: it is not forced by incidence, but it must place every
  declared dependency earlier, and it is published so that any two
  participants holding the same ordered sequence $\mathcal{Q}_k$ reproduce
  the same result. *Agreement on $\mathcal{Q}_k$ — not merely on the edge
  set — is required.* (Supersedes the pre-Edition-4 ordering-consistency
  postulate: edges no longer own Lamport times, and no order-independence
  is claimed.)
- **Epoch Edge-Set Provision (`post:introduction:epoch-edge-set`).** At each
  epoch boundary $k$ the operator provides a finite edge set
  $E_k \subseteq E$ that is causally closed
  ($e' \in E_k \wedge e \prec e' \Rightarrow e \in E_k$) and monotone
  ($E_{k-1} \subseteq E_k$). $E_k$ is the sole topological input to the
  epoch-$k$ computation; the mechanism by which the operator forms it is
  out of scope. The settled sampling depth that makes frame stability hold
  is a property of $E_k$, not of any global clock.
- **Mechanism-agnostic (`rem:introduction:mechanism-agnostic`).** Any
  mechanism — a strict append log, an ordered cluster-closure write, a
  frontier-finality gadget — delivering a monotone $E_k$ together with an
  authoritative order $\mathcal{Q}_k$ on which honest participants agree is
  compliant. Agreement on the *ordered sequence* $\mathcal{Q}_k$, not
  merely on the set $E_k$, is what the downstream computation consumes
  (`lem:graph:ordered-replay-determinism`).
- **Host Contract (`post:network:host-contract`).** The host operates the
  boundary and publishes the results; its entire authority is what it
  publishes each boundary. One self-contained final-state package: **(i)
  accepted records** — the final write set $\mathcal{Q}_k$, final edge set
  $E_k$, dependent-set partition, realized size, closure cause, attested
  boundary timestamp; **(ii) final ledger** — settled boundary burn state,
  final residual balances, final action counts, accepted-act increments,
  debit vintages; **(iii) semantic projection** — complete person-vouch
  acts, per-author folds, inviter revocation, relation coefficients, the
  Actor-only relation multigraph; **(iv) the exact depth-two anchor** —
  candidate family, source envelopes, standing map, standing box,
  contraction certificate, fixed-point enclosure, co-maximizer witnesses;
  **(v) the delegated stages** — depth-three/depth-four certified
  selections, admission proposals, accepted backoff parameters, standing
  maps, boxes, stage row certificates, fixed-point enclosures, or the
  staged fallback; **(vi) final standing and admission** — the highest
  certified stage $h^*_k$, final safe flow $W_{\text{end}}^{(k)}$, final
  standing, final action and epoch stamps, door headroom, W1/W2 verdicts;
  **(vii) shared closure outputs and policy** — the title certificate,
  settlement-recognition result, epoch target size, min/max durations, the
  policy-floor and safety-threshold schedules, and the margin factor
  $m_\theta = 5/4$, all under no-silent-change; **(viii) reproducibility
  evidence** — formula editions, declared constants, interval boxes,
  residual bounds. Every binding value is reproducible from the accepted
  records, final ledger, public formulas, and constants. Previous standing,
  warm starts, and cached solver state are not package inputs. **No hashes,
  roots, or source digests are normative.** A finite implementation must
  publish a standing enclosure narrow enough to decide every binding
  threshold comparison — an enclosure straddling $\rho_\theta$ for an
  author or $\rho_{\text{eff}}$ for the epoch stamp leaves the proposed set
  uncertified. Misbehavior at the boundary is *evidence, not prevention*
  (`post:graph:boundary-accountability`).

**Verification model** (`subsec:introduction:verification-model`): every
computation that can feed admission is specified by published formula over
the public record and independently reproducible from records and constants
alone. For standing, verification has three explicit layers: the epoch
certificate commits the complete person-vouch projection and its selected
simple Actor paths; the admission schedule and exact balance/count mediant
are replayed from public action masses and residual balances; and the
graph-dependent path-incidence certificate checks the declared standing box
and the chartered row-contraction margin. An uncertifiable extension has
safe polarity: it contributes zero, and if all relational flow into an
actor is zero, that actor's standing is exactly their own neutral source.
Centralized phase: verification as audit (results apply before
verification; constants being calibrated, not yet locked). Decentralized
phase: verification as gate (nothing failing verification takes effect).
The mathematical specification is identical across both phases.
`app:deployment` documents the deployment invariants (§13).

---

## 6 Published constants

Binding constants (L1·closure — read by standing activation, gates,
formation, package validity, or the epoch target;
`tbl:verification:constants`, `subsec:verification:reference-constants`):

| Constant | Value | Source |
|---|---|---|
| $\beta$ | 1.386 ($= 2\ln 2$); enters the projected standing core as well as raw damping | `ax:epoch:thermodynamic-boundary` |
| $\eta$ | 0.05 (bleed; enters the core $Q$) | `def:graph:path-view-extraction` |
| $\nu$ | 0.10 (illustrative numéraire, reserve/action; structural after lock) | `def:comparator:numeraire` |
| $\rho_{\text{pol}}$ | 1 (canonical default policy floor; dimensionless, host-dialed) | `def:epoch:policy-floor` |
| $\theta$ | $\approx 0.05281$ at reference (reserve/action; **algorithmic per-epoch output**, one-boundary lead, never a host input; defined by the width-fence inversion $\theta = \nu\,\lambda_Q^{-1}(1/(m_\theta W_{\text{loc}}))$ at reference $W_{\text{loc}} = 1$) | `def:epoch:safety-threshold` |
| $\rho_\theta = \theta/\nu$ | $\approx 0.5281$ at reference (the wall) | `def:epoch:safety-floor` |
| $\rho_{\text{eff}}$ | $\max(\rho_{\text{pol}}, \rho_\theta)$; $= \rho_{\text{pol}} = 1$ on any valid certificate (derived) | `def:epoch:participation-floor` |
| $m_\theta$ | $5/4$ (chartered margin factor; one dial read four ways) | `def:epoch:safety-threshold` |
| $N_{\text{epoch}}$ | 10000 (illustrative **target** act budget, denominated in accepted authored acts; not yet locked) | `def:epoch:epoch-act-budget` |
| $\delta_{\text{pos}}$ | 500 (illustrative burn-snapshot buffer; not yet locked) | `post:epoch:final-edge-set` |
| $L_{\text{hop}}$ | 4 (chartered transport depth, in hops of the conserved transport) | `def:epoch:standing-depth-mass` |
| $\gamma$ | $1/4$ (chartered activation exponent; **not** the reciprocal of $L_{\text{hop}}$) | `def:epoch:responsive-vouch-activation` |
| $Q(1)$ | $\approx 0.6975$ (activation normalization of the deployed core) | `def:epoch:responsive-vouch-activation` |
| $\kappa_{\text{self}}$, $\omega_D$ | unity (self-retention base and every published domain weight; reference values pending the calibration lock) | `tbl:epoch:standing-domain-weights` |
| certificate screen $\mathcal{K}_k$ | a rung is accepted iff $m_\theta\,\mathcal{K}_k \le 1$; the anchor $t_k = 0$ always certifies | `def:dynamics:conserved-standing-certificate` |
| $M_{\text{payload}}$ | deployment-calibrated; **per act, aggregate over a hyper-edge's projections** | `def:graph:act-payload-projection` |

Canonical raw defaults and derived raw constants (terminal formulas,
host-cached values are by-products — §3): $q = \tfrac12$ (raw diversity
preference), raw feed depth $L = L_{\text{feed}} = 4$,
$\tilde{w}_{\text{spam}} \approx 0.011$, $\tilde{w}_{\max} \approx 0.986$
(the raw edge-weight ceiling, `thm:graph:raw-weight-ceiling`),
$\tilde{w}_{\max}^{\text{Op}} \approx 0.502$. The pre-Edition-4 raw
precision clip $\epsilon_{\text{clip}}$ is **deleted with no successor**
(`rem:sorting:raw-pruning-is-implementation`).

The comparator's single reserve→action unit is the **numéraire** $\nu$; the
participation floor is a *pair* — the host-dialed $\rho_{\text{pol}}$ and the
network-computed safety threshold $\theta$ — governed in §11.8. The wall
$\rho_\theta$ is read by W2a and keys the below-wall activation clamp; the
door $\rho_{\text{eff}}$ is read by W2b and the per-act door benchmark
$\rho_{\text{eff}}\nu$ (`post:epoch:reduction-convention`). At the
reference calibration $(\nu, \rho_{\text{pol}}) = (0.10, 1)$, $\rho_{\text{eff}} = 1$.

No netting-clip constant exists: the stance-aggregation clip is the fixed
$\mathrm{clip}_{[-1,1]}$ in `def:epoch:net-stance`, not a calibrated value.

*Layer 0 surface constants* are owned by the Peer Attestation paper and
surfaced through `PA-` citations; they enter no Layer-1 closure formula.
The Layer-0 unit-cost projection $1/((1-f)\zeta)$ converts the burn-value
admission benchmarks into reserve deposits
(`eq:comparator:admission-benchmark-deposits`, §7.1); the pre-Edition-4
single entry-cost formula $\delta_{\min}$ is superseded by that benchmark
family. Illustrative Layer 1 constants are subject to empirical calibration
during the centralized deployment phase and are not yet locked.

---

## 7 The admission rules (the set $\mathcal{A}$, exactly)

$\mathcal{A}$ is the six rule groups of `def:network:admission-closure`
(§2): **formation** (identifier algebra, endpoint typing, asserted parents,
dependent sets, the approval handshake, the authoritative order — §8.1,
§8.2, §9); the **final state** (the proposed completed edge set and final
post-debit pairs — §11.6); **staged standing** (the package that produces
final standing — §11.4); the **final gates** (the write rule W1/W2a/W2b +
the act budget — §7.1); **recognition** (§7.2); and the **write** (the
host's admission of the final set — §11.6). The write rule decides *who may
act*; the closure rule *what enters $E_k$*; formation *what is
well-formed*; recognition *what binds*.

### 7.1 The two-gate write rule

Evaluation is **final-set**: W1, W2a, W2b, standing, and the ledger are
evaluated once on the completed tentative final state indexed by the
proposed act sequence $\mathcal{Q}_k$ — no prefix of $\mathcal{Q}_k$
carries a normative standing value (`post:epoch:final-act-sequence-closure`,
`def:epoch:proposed-final-act-state`).

A record by actor $i$ is writable in epoch $k$ iff all three sub-gates hold
(`post:epoch:final-act-sequence-write-rule`,
`subsec:epoch:participation-gates`):

1. **W1 — solvency (debited):** $b_i \geq \theta^{(k)}$ — evaluated
   continuously on the live pair; on write the balance debits $\theta^{(k)}$
   (`post:epoch:act-debit`). Capacity **is** the balance; only the actor's
   own balance pays the actor's $\theta$.
2. **W2a — safety (individual, never averaged):** the act's final stamp
   $\rho_{\text{act}}(q) = \hat{\alpha}_i^{(k)} \geq \rho_\theta$ (the
   wall). The stamp is the reduced **final** standing of the completed set,
   act-owned: one stamp per act, all of an author's epoch-$k$ acts sharing
   it (`def:epoch:final-act-stamps`).
3. **W2b — policy (averaged, never debited):** the closed set's
   act-weighted epoch stamp satisfies $\rho_{\text{ep}}^{(k)} \geq
   \rho_{\text{eff}}$ with $|\mathcal{Q}_k| \le N_{\text{epoch}}$; band
   actors ($\rho_\theta \le \rho_{\text{act}} < \rho_{\text{eff}}$) enter
   when the door has headroom (the membrane, not a wall).

An insolvent actor (W1) restores capacity immediately by committing burns.
Re-crossing the wall (W2a) requires some combination of new burns raising
$r_i$ directly and new positive-rate person-vouch connections from actors
whose rates exceed the current standing, lifting the mediant within the
contributing-rate hull (`prop:epoch:final-standing-hull`).

Actor states (`tbl:epoch:actor-states`), by (W2a $\rho_{\text{act}} \ge
\rho_\theta$, W1 $b \ge \theta$): **Active** (✓/✓, may act); **Band** (✓/✓,
acts when the door has headroom); **Insolvent** (✓/✗, remedy: burn
immediately); **Frozen** (✗/irrelevant, remedy: burn lump to re-cross the
wall). Not being written is neither write failure nor solvency failure:
non-written actors remain dynamically live — their rates contribute and
their rows remain in the mediant field
(`rem:epoch:non-written-dynamic-live`).

**Registration under final-set admission
(`rem:epoch:registration-final-set-admission`).** Registration is one
ordinary act in the proposed final write set: one accepted-act increment,
one $\theta$-debit, competes under W1/W2a/W2b, consumes epoch write
capacity, and receives the same final stamp as every other same-author act
— **no special Registration branch and no live-value newcomer formula**. A
candidate actor has prior count zero; with no relational flow its stamp is
its own source rate (`prop:epoch:final-standing-embedding`), and a current
high-rate external vouch may lift it under the ordinary hull. **Same-epoch
topology creates no source** (`cor:epoch:same-epoch-source-hull`): a
same-epoch cohort whose source rates all lie below $\rho_\theta$ cannot
mutually vouch itself above the wall; only a current external positive-rate
source lifts a newly registered actor.

**Universal per-act burn benchmarks
(`cor:epoch:universal-burn-benchmarks`).** For an unsupported actor
proposing $m \ge 1$ epoch acts:

$$B_{\mathrm{W1}}(m) = m\theta, \qquad B_{\mathrm{safety}}(m) = 2m\theta,
\qquad B_{\mathrm{door}}(m) = m(\theta + \nu\rho_{\text{eff}}),$$

projected through the Layer-0 cost interface as reserve deposits
$\delta(m) = B(m)/((1-f)\zeta)$
(`eq:comparator:admission-benchmark-deposits`,
`subsec:comparator:capacity-and-admission-benchmarks`). These are
final-state gate benchmarks, not prices that guarantee selection into the
finite write set; there is no universal admission price. Band dwell is
linear and exact (`rem:epoch:band-dwell`); re-entry from below either
boundary is a burn lump — a price, not a duration.

### 7.2 Settlement recognition

Five settlement edge families: three forward (Bid, Accept, Ratify), two
cancel (Withdraw, Rescind). Every state transition is caused by an authored
act; no state changes through inaction, counting, or timeout
(`thm:graph:no-death-by-inaction`).

**Item Genesis (`def:graph:item-genesis-act`).** An Item $n_i$ enters the
graph together with an initial Owner edge $\text{Actor}_{a_0} \to n_i$
authored by its originating actor $a_0$ — the genesis of the ownership
thread. Item identity is **declarative**: the Item *is* its genesis act —
its identity is minted from the genesis **act identifier**
$\mathsf{mint}(\mathrm{actid}(q))$ (`def:graph:act-identifier`), the same
act identity that settlement references resolve to. Uniqueness holds by
construction: a colliding act identifier is author-equivocation, rejected
by record integrity, never adjudicated by title logic. No payload datum
enters the act identifier, so identity, pointer resolution, and title
survive every payload state. Two actors listing "the same" real-world
referent create two Items with two ownership threads; out-of-band truth is
deterred by accountability cost and witnessed by `frontier:item-genesis`.
Genesis is an ordinary gated append. Title at Layer 1 is title over a
**registered claim**, never custody of a referent
(`rem:graph:item-identity-limit`).

**Settlement act references (`def:graph:settlement-act-reference`).** The
Accept and Ratify acts — and only these — each carry an act-level public
protocol reference to the **Bid act identifier** that opened the Offer
($\mathrm{settles}$), and a Ratify additionally references the exact Accept
act it confirms ($\mathrm{accepts}$). These references are act-owned
*metadata, not graph incidence*: an Accept or Ratify names its settlement
partner by act identity, and its edge projection is incident only to its
two actor endpoints, never to the Offer. Because the references are
declared causal parents, any authoritative order forces
$\text{Bid} \prec \text{Accept} \prec \text{Ratify}$
(`rem:graph:title-order-irrelevance`).

**Finalization epoch (`def:graph:act-finalization-epoch`).**
$\mathrm{ep}(q) = \min\{k : q \in \mathcal{Q}_k\}$ — well-defined by
monotonicity of the accepted act history. Two acts are *co-epochal* iff
their finalization epochs are equal. Title consumes acts at
$\mathrm{ep}(\cdot)$ granularity only.

**Settlement Recognition (`def:graph:settlement-recognition`).** A
settlement candidate on Item $n_i$ in epoch edge set $E_k$ is a triple of
authored acts
$\mathcal{S} = (q_{\text{Bid}}, q_{\text{Accept}}, q_{\text{Ratify}})$
whose Accept and Ratify both carry settlement references resolving to the
Bid act identifier that opened the Offer. The candidate is *recognized* iff
all six clauses hold:

- **(i) Completeness.** All three acts are present, their edge projections
  in $E_k$.
- **(ii) Reference binding.** The Accept's and Ratify's settlement
  references both resolve to the Bid act identifier.
- **(iii) Authorization.** The author of the Accept is the certified owner
  $\mathrm{owner}^{(k-1)}(n_i)$ at the boundary preceding the Ratify's
  finalization epoch $k = \mathrm{ep}(q_{\text{Ratify}})$ (the genesis owner
  if the thread is fresh). Clause (iii) reads the prior title certificate
  back into admission — the straddler.
- **(iv) Buyer consent.** No buyer Withdraw on this Offer satisfies
  $\mathrm{ep}(\text{Withdraw}) \le \mathrm{ep}(\text{Ratify})$.
- **(v) Seller consent.** No seller Rescind on this Offer satisfies
  $\mathrm{ep}(\text{Rescind}) \le \mathrm{ep}(\text{Ratify})$.
- **(vi) Well-formedness.** $\text{Bid} \prec \text{Accept} \prec
  \text{Ratify}$ — retained as a well-formedness check on the handshake
  chain (each party observes the prior record), forced by the settlement
  references and carrying no tie-breaking force.

Clauses (iv) and (v) are the **epoch-quantized consent rule**: a cancellation
co-epochal with, or earlier than, the commit defeats it; a cancellation in a
strictly later epoch is inert — the sale is final *at the certificate*, not
at the Ratify (`rem:graph:regret-window`). A recognized candidate whose
Ratify finalizes at boundary $k$ with no defeating cancel is *unchallenged
at $k$*. The predicate reads set membership, $\mathrm{ep}(\cdot)$ indices,
and the reference-forced chain — no $\mathrm{pos}(e)$, no residual sub-epoch
order (`rem:graph:settlement-clause-structure`). Parallel settlement
records are consumed exclusively through this predicate
(`rem:graph:authored-act-bundle-consumers`).

**Lifecycle states:** Open→Accepted (Accept, seller); Open→Dead (Withdraw,
buyer); Accepted→Committed (Ratify, buyer); Accepted→Dead (Withdraw, buyer);
Accepted→Dead (Rescind, seller). Dead and Committed are absorbing. No death
by inaction: no count, window, or throughput measure enters the lifecycle
map. Cleanup is an authored choice, never a silent timeout. Cancellation is
best-effort at the boundary: ties favor the cancel, so any cancel submitted
in an epoch strictly before the commit's finalization epoch is safe
regardless of latency (`rem:graph:cancellation-best-effort`).

**Ownership Thread (`def:graph:ownership-thread`).** The **boundary-indexed**
chain rooted at the genesis Owner record, extended at each epoch boundary by
the title fold (`thm:graph:epoch-title-fold`); terminal actor is the
certified owner. An Owner record not reachable from genesis through boundary
transfers is *orphaned*: persists in the append-only record set, carries no
title force.

**Title Certificate (`def:graph:title-certificate`).** The map
$\mathrm{owner}^{(k)} : \text{Items} \to V_u \cup \{\varnothing\}$ sending
each Item to the terminal actor of its ownership thread, or $\varnothing$ if
no genesis Owner edge resolves it. Layer 1 publishes $\mathrm{owner}^{(k)}$
alongside the epoch certificate.

**Settlement Consumption (`def:graph:settlement-consumption`).** Let
$C_k(n_i)$ be the recognized, unchallenged candidates on $n_i$ whose Ratify
finalizes at boundary $k$. Every member of $C_k(n_i)$ is *consumed at $k$*:
whatever the fold's outcome, consumed records are permanently ineligible to
found recognition at any later boundary. Retrying a failed purchase requires
fresh records, each a priced act.

**Epoch Title Fold (`thm:graph:epoch-title-fold`).** At each boundary $k$,
for each Item $n_i$: if $|C_k(n_i)| = 1$, title transfers to that candidate's
buyer; if $|C_k(n_i)| \ge 2$ (conflicting co-epochal commits from one owner),
**all members are consumed without transfer** and the incumbent retains
title — *mutual invalidation, not permanence*: the Item stays fully
transferable at every later boundary. If $C_k(n_i) = \varnothing$, title is
unchanged. *First epoch wins; ties consume* — a Ratify landing one boundary
after a competitor's transfer fails clause (iii) (the owner changed) and is
not recognized.

**Order-Freeness of Title (`thm:graph:settlement-order-freeness`).**
Settlement recognition, the ownership thread, and the title certificate are
functions of the epoch partition $\{E_j\}_{j \le k}$ and the
reference-forced well-formedness chain alone — a **strictly stronger
invariance than ordered-replay determinism**: the host's residual sub-epoch
ordering of unconstrained acts enters nowhere. Handshake well-formedness is
fixed by the public, non-tombstonable settlement references; conflict
resolution reads only set membership, $\mathrm{ep}(\cdot)$ indices, and
that chain — never the tombstonable dependency projection. Closure
selection is title-invisible: the write rule decides membership only, never
recognition or tie-break (`rem:graph:title-order-irrelevance`).

**Settlement reputation: stance, not parity
(`rem:graph:settlement-reputation`).** Title transfer is
sentiment-independent. The terminal commercial-reputation read-site, named
in the boundary ledger, **reads stance marginals rather than path parity**.
This is forced by the Quadrant Law: a coerced and unfair Accept with both
parameters negative has $\epsilon = +1$ — correct for routing coherence,
wrong as a verdict. Routing reads coherence; stance consumers read stance.
The closure-side gate is person-vouch eligibility on Accept/Ratify
(actor-directed acts vouch only if all mandatory coordinates are strictly
positive, §11.3).

The full paper's **terminal default** for the read-site
(`rem:graph:settlement-reputation`): three authored edges carry three signed
stances — buyer generosity $\mathrm{sgn}(g_{\text{Bid}})$, seller comfort
$\mathrm{sgn}(c_{\text{Acc}})$, and buyer confirmation
$\mathrm{sgn}(c_{\text{Rat}})$ — and **positive commercial reputation holds
iff all three stance marginals are positive** (the *conjunction*, reading the
$p_d$ marginal row; not the parity product $\prod\epsilon(e)$, which would
reward predatory-meets-coerced). This is a terminal L2 read-site: CoGra is
free to adopt or replace it — the interface records the reference default, it
does not bind it. (`subsec:necessity:stance-marginal-reputation`)

**Cross-layer (`rem:graph:settlement-cross-layer`):** Layer 1 holds no value,
locks nothing, adjudicates nothing; it records Offers and ownership changes. A
terminal escrow or payment system may observe the public log, but that
mechanism is terminal. Layer 1 supplies the deterministic commit anchor: the
**epoch certificate** in which the settlement is recognized, unchallenged, and
title-transferring — not the Ratify, which is no longer the point of no return
(`rem:graph:regret-window`). The residual exposure is boundary censorship — a
host suppressing a co-epochal cancel while writing the commit
(`frontier:boundary-censorship`, `rem:epoch:consent-exposure`).

---

## 8 Kernel data model: authored acts, projections, and the graph

### 8.1 Acts, projections, partition, and passivity

**Authored-act ontology (`ax:graph:authored-act-ontology`,
`rem:graph:act-ownership-invariant`).** The graph's primitive append-only
public history is the set of accepted **authored acts**; edges are its
projections. An accepted act $q$ owns exactly: its act identifier, author,
family, semantic body (the authored parameters $(p_d, p_i)$, domain/mask,
family-specific structural metadata), public protocol references (including
any settlement reference and license qualifiers), asserted causal parents,
the removable payload projection and dependency projection, the commitments
and signatures of its admission handshake, and its approval witness — plus
host-attached finalization metadata: the epoch and the authoritative
logical time $\mathbb{T}^{\text{act}}_q$. Its graph projection contains
exactly one binary edge or exactly two role-labelled hyper-edge projections;
the edge set is derived,
$E_k = \bigcup_{j \le k}\bigcup_{q \in \mathcal{Q}_j} \mathrm{edges}(q)$.
An edge projection owns only its parent-act reference, role (binary, A, or
T), source, target, and the role-specific rendering of the act's semantic
coordinates — **no** independent payload, dependency list, causal-parent
set, signature, count increment, debit, or logical time; materialized
copies of inherited fields are caches with no independent authority.
Consequently:

- **Implicit existence.** A node is an identifier occurring in the endpoint
  fields of projected edges; $v \in V$ iff some projected edge references
  $v$ — no node-creation operation, no node table, no node attribute store.
- **Folds only.** Every "node property" (sentiment, norm, maturity,
  affordances, license, creator, ownership, membership) is a declared
  **fold** over the projected edges referencing that identifier; a property
  without a declared fold is undefined.
- **Derived edges.** Layer 1 appends no authored act. Edges earlier
  editions called Layer-1-issued are *derived raw edges*
  (`def:graph:derived-raw-edges`); the accepted authored-act history is
  Actor-authored in its entirety.

**Authored act (`def:graph:authored-act`,
`cor:graph:hyper-act-indivisibility`).** The authored act is the atomic
unit of formation, admission, ordering, dependency declaration, action
counting, $\theta$-debit, and final-set authorship. A binary act carries
exactly one edge record; a hyper-edge act exactly two matched records (one
A-leg, one T-leg); no other cardinality is valid. Every accepted act
increments its author's action count by one and incurs exactly one
$\theta^{(k)}$ debit — a hyper-edge does not debit per leg — and carries
exactly one dependency projection belonging to the act as a whole. A
hyper-edge's A- and T-projections are not two records later joined into one
act: they are two graph projections of one already-formed act, sharing by
construction one act identifier, author, payload lifecycle, dependency
projection, causal-parent set, approval witness, debit, count increment,
stamp, and authoritative time.

**Act identifier and minted-node identity (`def:graph:act-identifier`).**
The actor chooses a unique author-local sequence value $s_q$ fixed before
submission; the act identifier is
$\mathrm{actid}(q) = \mathsf{act}(\mathrm{author}(q), s_q,
\mathrm{family}(q))$ — no host-assigned time, no minted target, so it
exists before host salting, verification, ordering, and time assignment.
Edge-projection identifiers derive from it by role
($\mathsf{edge}(\mathrm{actid}(q), A/T)$), and a node minted by a genesis
act takes identity $\mathsf{mint}(\mathrm{actid}(q))$ — the minted node
names its genesis *act*, never itself. A monotone author-local sequence
makes accidental reuse directly detectable; distinct accepted acts never
share an act identifier (`lem:graph:act-edge-identifier-uniqueness` — a
forged equal-key pair is author-equivocation, rejected by record
integrity).

**Identifier algebra (`def:graph:identifier-algebra`).** Node identifiers
form the inductive term algebra
$I ::= \mathsf{addr}(a) \mid \mathsf{prof}(a) \mid \mathsf{name}(s) \mid \mathsf{mint}(\alpha)$
with $\alpha$ an authored-act identifier, classed by outermost constructor:
**grounded** ($\mathsf{addr}$, $\mathsf{prof}$ — Actor, Profile), **named**
($\mathsf{name}$ — Type, a commons compared by exact byte equality),
**minted** ($\mathsf{mint}$ — Content, Item, Chat, Offer, Comment,
Message). Class is decidable syntactically, no census lookup
(`lem:graph:identifier-disjointness`). Two constructors take atoms from
outside the record set — $\mathsf{addr}$ anchors *mass* from the reserve,
$\mathsf{name}$ anchors *reference* from the string commons;
$\mathsf{prof}$ is the unique non-atomic grounded constructor (one atom,
two identifiers — an Actor and its Profile are one anchoring). "A node
cannot be re-minted" is a property of term formation, not a rule. An
identifier is **anchored** iff its class-specific anchor is in $E_k$ (a
Registration for grounded; the accepted genesis act for minted; vacuously
for named); a referenced-but-unanchored identifier is **dangling** and
**fold-neutral** — every canonical fold returns its neutral element, so
danglingness never binds (`def:graph:anchoring`,
`lem:graph:dangling-neutral-fold`).

**Genesis act and creator (`def:graph:genesis-act-and-creator`).** The
genesis act of a minted node is the authored act whose identifier it mints;
the genesis families are: Item — Owner; Offer — Bid/T; Comment — Review/T;
Message — Send/T; Chat — the founding member's Participant; Content —
Publish. The creator map is uniform:
$\mathrm{creator}(n) = \mathrm{author}(\mathrm{genesis}(n))$ for minted
nodes, $n$ itself for $\mathsf{addr}(a)$, $\mathsf{addr}(a)$ for
$\mathsf{prof}(a)$, and $\bot$ for named nodes, with $\alpha_\bot := 0$ —
a Type reached as a feed terminus takes the neutral amplifier. No one owns
a concept; named nodes are commons by construction.

**Registration (`def:graph:registration`).** An actor-authored edge
Actor → Profile and the anchoring record of the grounded pair. It is the
sole record family whose endpoints may be fresh grounded identifiers —
fresh because grounded identity pre-exists the graph; nothing is minted and
no identity key is formed. It anchors; it does not create. Under final-set
admission it is one ordinary act (§7.1). The canonical payload is profile
data; the Profile husk is structural. Profile updates are parallel
Registrations: the bundle updates the payload, never the identity or the
key-binding (`rem:graph:profile-update`).

**Universal authored-act parallelism (`ax:graph:parallel-authored-acts`).**
For every edge family an author may append an authored act parallel to
their own prior act (same author, source, target, family) without
restriction beyond the universal gates. The append layer never rejects,
merges, supersedes, or tombstones — it stores **chronicles, never state**
— and assigns no Layer-1 semantics to the parallel relationship itself.

**Authored-act bundle (`def:graph:authored-act-bundle`).** The bundle
$\Pi(j, s, t, f)$ is the set of accepted acts with author $j$, source $s$,
target $t$, family $f$; for a hyper-edge family the key is the full
incidence. An author's acts chain through the author endpoint, so every
bundle is a strict $\prec$-chain and its $\prec$-latest member is
well-defined without any linearization. Bundles group acts by their public
act identities: an act consumer may not construct an act by pairing
independently folded projections, substitute an unrelated incoming edge for
an A-projection, or select a T-projection whose parent act it cannot
resolve. Layer 1 reads bundles in **exactly two** places
(`rem:graph:authored-act-bundle-consumers`): the **standing** projection
(net stance + person-vouch eligibility + inviter revocation, §11.3) and
**title** (the epoch-quantized settlement fold, §7.2). Every other reading
— current profile (latest), membership, decay, amended-vs-accumulated
display — is Layer-2-free. A parallel *genesis* is rejected by record
integrity (author equivocation on one act identifier): a node cannot be
re-minted, only newly written about
(`post:graph:title-act-bundle-reservation`).

**Edge projection (`def:graph:act-edge-projection`).** The projection is
deterministic and fixed at formation; it is not an appended record of its
own. A hyper-edge projection is formation-valid iff it contains exactly one
A-role and one T-role edge with agreeing author, family, full incidence,
and a family parameter tuple consistent under the family specification. The
two projections are siblings because they share one parent act — not
because they carry reciprocal co-leg fields; a valid accepted hyper-edge
can never have an accepted unmatched leg. The **semantic target** of a
binary act is its edge's target; of a hyper-edge act, its T-projection
target — the middle passive artifact supplies context and is never the
semantic target. The family's parameter tuple belongs to the act: leg-role
swaps are renderings, not independent standing coordinates. Both
projections inherit the one act time
$\mathbb{T}^{\text{act}}_{e_A} = \mathbb{T}^{\text{act}}_{e_T} =
\mathbb{T}^{\text{act}}_q$. Payload bytes, payload state, and the
co-removed private value enter none of the identity, author,
semantic-target, parameter, or act-time fields, so edge-projection
identity is invariant under payload reduction.

**Graph partition and passivity (`def:graph:partition`,
`ax:graph:passivity`).** $V = V_u \sqcup V_c$: $V_u$ **active** nodes
(Actors), $V_c$ **passive** nodes (artifacts). Every record in $E$ is
authored by an active node; passive-sourced edges occur only as
author-fixed terminal legs of hyper-edges whose initiating actor is
recorded. No passive node initiates, redirects, or modifies any edge;
every outgoing edge from $c \in V_c$ is determined at creation by the
authoring actor (or, for the derived raw Self-edge, by the certificate)
and thereafter immutable. Passive out-degree
(`lem:graph:passive-out-degree`): Content, Type, Comment, and Message
source Tag and Review terminal legs; Offer sources Review legs but no Tag;
Item additionally sources a Bid leg; Chat additionally sources Send,
Invitation, and De-invite legs; Profile additionally sources the derived
Reputation component; and every passive type sources Reference terminal
legs — Reference's A-leg may source from any passive node (the universal
citing artifact). Edges between actors may be asymmetric; each edge
carries independent sentiment parameters set unilaterally by its
originating actor (`rem:graph:asymmetry`).

**Derived raw edges and the raw traversal snapshot
(`def:graph:derived-raw-edges`, `def:graph:raw-traversal-snapshot`).** A
derived raw edge is a deterministic terminal graph reading computed from an
accepted epoch package and never appended to $E$. The raw Self-edge is the
sole derived family (§9.4): its Declaration and Reputation components share
the final-standing coordinate $p_i^{(k)} =
\hat{\alpha}_i^{(k)}/(1 + \hat{\alpha}_i^{(k)})$, are placed at the
boundary slot $\mathbb{T}_{\partial k}$ (boundary-relative ordering
metadata, not an act time), mature on the published tenure schedule, and
carry no payload, dependency, approval, debit, count increment, or act
time. The epoch-$k$ **raw traversal graph** is
$G_k^{\text{raw}} = (V_k, E_k \cup D_k^{\text{raw}})$, where
$D_k^{\text{raw}}$ holds the *current* derived readings — they replace
earlier derived readings rather than accumulating. Feed ranking, raw
signed traversal, and canonical bridge traversal consume
$G_k^{\text{raw}}$; **standing consumes the temporal person-vouch
multigraph and never traverses $D_k^{\text{raw}}$**.

### 8.2 The write, dependencies, and the admission handshake

**The write (`def:network:write`).** The graph's *store* is append-only;
the *act* that mutates it is the **write** — the admission, at an epoch
boundary and nowhere else, of the accepted authoritative ordered act
sequence $\mathcal{Q}_k$ into the public edge set via its record
projection $\Delta E_k = \bigcup_{q \in \mathcal{Q}_k} \mathrm{edges}(q)$,
$E_k = E_{k-1} \cup \Delta E_k$. Every act in $\mathcal{Q}_k$ is
Actor-approved, formation-valid, and dependency-valid at its position;
$\mathcal{Q}_k$ is a finite union of dependent sets, each written whole or
not at all (`cor:graph:act-projection-atomicity`), and it is written only
after the completed tentative state passes the final-set write rule. A
submission that is not written is not refused — it is nothing (the network
has no ontology of the unwritten, and only the certificate speaks). Not
writes (`rem:network:not-a-write`): derived edges (recomputation), payload
reduction, non-written candidates, provisional standing solves, and the
internal stage equilibria — only the accepted final set and its standing
package speak.

**Causal parents (`def:graph:act-causal-parents`).** An act may declare
*asserted parents*: prior-act references, structural fields of its body,
defining the directed acyclic causal-parent relation (backward-only by
construction, acyclic within a batch by the topological formation check).
Semantics: the act is admissible only into an epoch whose history contains
every asserted parent earlier. The settlement reference is the settlement
family's instance of this field. An asserted parent is metadata, not graph
incidence, and adds no endpoint pre-degree — asserted parents and declared
dependencies in a scoring formula are prohibited (the $\tau$-farming lint,
`rem:graph:act-ordering-relations`).

**Dependent act set (`def:graph:dependent-act-set`).** A *dependent set* is
a set of formed acts closed under the causal-parent relation, taken
together with both edge projections of every hyper-edge act in it. The
shared-parent grouping of a hyper-edge's projections is not a directed
parent: it groups without ordering, so admitting both projections together
creates no causal cycle. Minimal dependent sets are the closures of a
single act. The dependent set is the sole unit of the write: written whole
or not at all. Conflict grouping by causality is rejected — cancels and
commits are concurrent by construction, and the regret window depends on
it; conflict protection is boundary accountability, not write-unit
grouping (`rem:graph:dependency-closure-excludes-conflicts`).

**Public protocol references (`def:graph:public-protocol-reference`).**
Non-removable structural fields required to identify the meaning or
validity of an act: hyper-edge A/T role and shared act identifier, the
settlement references, structural target and incidence fields,
family-required prior-act references, and license qualifiers. They remain
in the structural record after every payload or dependency tombstone.
They identify *what* an act is; Actor-authored dependencies constrain
*where* the host may place it.

**Removable projections (`def:graph:act-removable-projections`,
`def:graph:act-dependency-projection`,
`def:graph:act-dependency-tombstone`).** Every act may carry two typed
removable projections — **content** (never read at Layer 1) and
**dependency** (read by the host at admission to validate order) — each
governed by the separable, concealing commitment (§8.4): full bytes and
opening material beside carriage, a binding-yet-concealing commitment
residue in the structural record, one-way tombstoning. The dependency
projection is the actor's finite canonical dependency list
$\mathrm{deps}(q)$ — each element naming one authored act, never an
individual leg, declaring that $q$'s authoritative time must exceed each
member's; the declaration grants no inclusion right. States: full-empty /
full / tombstoned (list and opening removed, the binding commitment residue
remaining — the anchor a later opening reopens). Tombstoning changes no
identity, order, time, count, debit, standing, feed, CAN, title, or
recognition quantity.

**The admission handshake** — how a proposal becomes an orderable act:

1. **Proposal pre-commitment (`def:graph:proposal-pre-commitment`).**
   Because the host contributes the final projection salts, the actor first
   binds its proposal: with a fresh private nonce, it forms domain-separated
   pre-digests of the content bytes and canonical dependency encoding, then
   signs the pre-commitment over the canonical structural body plus both
   pre-digests. The pre-commitment exists before host salting, binds the
   exact proposal, cannot be transplanted to another act identifier,
   carries no host order, and grants no inclusion.
2. **Verified act (`def:graph:verified-act`).** The host verifies the actor
   signature, act-identifier uniqueness, canonical formation, hyper-edge
   A/T consistency, public protocol references, carriage and dependency
   bounds, and the recomputed pre-commitment (a failure produces no Layer-1
   object); chooses independent fresh domain-separated salts meeting the
   published entropy floor; forms the binding content and dependency
   commitments; and seals the resulting **verified act** header (no host
   order fields) with its host signature. The seal attests receipt,
   verification, and salt addition; it promises no inclusion.
3. **Approval witness (`def:graph:approval-witness`).** The actor verifies
   the host seal, exact equality of the returned body and references,
   correct opening of both commitments, and (for a hyper-edge) agreement of
   all act-level fields across both legs — then signs the **approval
   witness** over the exact verified act including its host-added
   commitments. The witness signs no epoch index, position, logical time,
   final-set membership, standing, or title outcome. **Only a verified act
   with a valid approval witness is eligible for host ordering**; a
   verified but unaccepted act remains off-record submission state.
4. **Ordering fraud proof (`def:graph:ordering-fraud-proof`,
   `post:graph:ordering-accountability`).** For an accepted act, a fraud
   proof is the ordinary full opening of its dependency projection; it
   succeeds iff the finalized order violates the committed dependency list.
   A successful proof may trigger fault attribution, operator slashing, or
   deployment sanctions — but it does **not** reorder the epoch, delete the
   act, reverse counts or debits, recompute historical standing, or
   reverse title. The authoritative order stays authoritative even when
   proven non-compliant; by finalizing an act the host attests it held and
   validated the full dependency opening.

**Act authentication requirements
(`post:graph:act-authentication-requirements`,
`rem:graph:authentication-realization-out-of-scope`).** The deployment must
provide: (i) authorship — publicly checkable evidence the stated actor
authorized the proposal; (ii) proposal integrity — no host substitution
without detection; (iii) realization transparency — every host-added field
visible to the actor before approval; (iv) exact approval — only the exact
approved act may enter the sequence; (v) hyper-act unity; (vi)
removable-projection binding; (vii) ordering accountability. **The
specification prescribes properties, not a cryptographic realization:
signature schemes, commitment schemes, hash functions, salts, serialization
formats, key management, proof encodings, and algorithm migration are
deployment concerns.** Any implementation satisfying the postulate is
compliant.

### 8.3 Temporal structure

**Authored-act causality (`ax:graph:act-causality`,
`def:graph:act-incidence-causality`).** Authoritative logical time is
finalization metadata attached to the accepted act, not an edge-owned
attribute. Each accepted act is one Lamport event whose causal incidence is
its complete graph projection: a binary act is a two-way event over its
source and target; a hyper-edge act a **three-way** event over its
initiating Actor, contextual middle node, and semantic target (the middle
node participates in causal incidence only — no authorship, autonomy, or
standing authority). Along the host-published sequence, an act's Lamport
time is one more than the maximum over its incident endpoints' frontiers
and its predecessors' times (asserted parents ∪ declared dependencies);
every incident endpoint then advances to the act frontier. The two
projections of a hyper-edge inherit the one event frontier — never two
independently timed records.

**Authoritative act order (`def:graph:authoritative-act-order`).** For
epoch $k$ the host chooses a finite total order $\mathcal{Q}_k$ of the
accepted acts and publishes each act's position. The **authoritative causal
key** is the lexicographic pair
$(\mathbb{T}^{\text{act}}_q, \mathrm{pos}_k(q))$ — Lamport time, then host
position totalizing equal frontiers. The order is total and *semantically
authoritative*: not forced by incidence, but it must linearize every
asserted parent and declared dependency (each at strictly lower key) while
placing both edge projections of one hyper-edge at the same key. Where
this document writes $\prec$ in scoring, maturity, or path viability it
means authoritative-order precedence, with the internal A→T transition of
one act permitted at equal key.

**Host ordering discretion (`rem:graph:host-ordering-discretion`).** For
acts not ordered by a causal parent or declared dependency, Layer 1
imposes no arrival-order, fairness, neutrality, or canonical-identifier
preference — the host may select any dependency-compliant order according
to its own incentives. **Different valid host choices may produce different
authoritative causal keys, edge-projection maturities, relation frontiers,
causal standing paths, standing fields, and final-set admission
outcomes.** This is authorized boundary discretion. The guarantee is
public visibility and deterministic replay — *order transparency and
replay determinism, not incentive-neutral ordering*.

**Ordered-replay determinism (`lem:graph:ordered-replay-determinism`).**
Fixing the finalized $\mathcal{Q}_k$ and the published constants:
$\mathbb{T}^{\text{act}}$, $\tau_e$, $\tilde{w}(e)$, $\epsilon(e)$, every
path parity, the half-score, path distance, the relevance score $S(u,c)$,
and every CAN value are functions of $\mathcal{Q}_k$ and the constants
alone — every participant holding the same ordered history reproduces them
identically; none references $\mathrm{pos}(e)$ beyond the order itself.
**This supersedes the pre-Edition-4 linearization-invariance lemma**: the
claim is downgraded from order-independence to determinism given the
published order. A lower Lamport time is necessary but not sufficient for
causal ancestry (`rem:graph:causal-frontier-not-ancestry`).

**Edge-projection maturity (`def:graph:edge-projection-maturity`).** For
$e \in \mathrm{edges}(q)$:
$\tau_e = 1 - 1/(1 + \max(\deg^{\text{pre}}_q(\mathrm{src}(e)),
\deg^{\text{pre}}_q(\mathrm{tgt}(e))))$, where $\deg^{\text{pre}}_q(v)$
counts endpoint incidence in the accepted projected graph immediately
before the parent act in the authoritative replay. The two projections of
one hyper-edge see the same pre-act graph state and do not mature one
another; later acts never contribute to an earlier act's maturity; asserted
parents and declared dependencies add no pre-degree
(`rem:graph:act-time-not-wall-clock`). Maturity is
edge-projection-owned; the act time it inherits is not. $\max$ (not
$\min$) is chosen to preserve the bridging signal of sparse-to-dense
links; $\tau$ measures *connection-context maturity*. Bounds: $\tau_e = 0$
for a first edge at both endpoints, monotone in prior degree, $< 1$ on
finite graphs (`prop:graph:maturity-bounds`). This covers accepted
authored-act projections only; derived Self-edge maturity follows the
tenure schedule (§8.1, §9.4).

**Temporal entropy (`def:graph:temporal-entropy`).**
$H_\tau(e) = -\tau_e \ln \tau_e - (1 - \tau_e)\ln(1 - \tau_e)$, with
$H_\tau = 0$ at $\tau_e = 0$; applied once at the thermodynamic boundary.

### 8.4 The act record and payload carriage

Fields the structural record carries, per act: author binding; the act
identifier; family; endpoints/incidence per projection with role; the
authoritative act time; the authored parameters $p_d, p_i$ and domain label
$D$ with mask $\mathbf{a}_D$ and routing tier per projection; derived
parity $\epsilon(e)$ per projection; public protocol references
(settlement references, license qualifiers); the **payload commitment**
and the **dependency commitment**; handshake signatures and the approval
witness. The record is sufficient to recompute the sentiment slice,
path-view determinant, determinant sign, damped weight, and both
commitment verifications (`subsec:deployment:sufficiency`).

**Act payload projection (`def:graph:act-payload-projection`).** **Every
authored act carries a payload projection**: a byte string the network
never reads, bounded **per act** by $M_{\text{payload}}$. For a hyper-edge
act the payload may be a structured, role-addressed object
$(Y^{\text{act}}, Y^A, Y^T)$ — but this is *one* act payload under one
commitment and one lifecycle; the role labels are schema fields, never
payloads attached to edge projections, and the bound is **aggregate**: a
two-projection hyper-edge carries no more payload than a binary act while
paying one action and one debit. The canonical empty payload is the
zero-length byte string; the commitment component is present on every act
without exception. The payload is removable; the structural record is not.

**Payload controller (`def:graph:act-payload-controller`).** The payload
controller of an act is its **author** — there is no separate A-leg or
T-leg controller; the initiating author owns the one act payload. The
payload is removable at the request of its controller **or of any
legitimate entity**, under the phase-custody split below. Derived raw
edges carry no payload projection; there is nothing to control.

**Payload state (`def:graph:act-payload-state`).** Three states:
**full-empty** (canonical zero-length bytes, private value present),
**full**, **reduced**. State moves toward reduced only.

**Separable, Concealing Act Commitment
(`post:graph:separable-act-projections`).** The append mechanism's
commitment to every act factors into a **structural** part (over the act's
irrevocable record) and a **content** part (over the payload), the act
commitment reproducible from the two together. The structural part
verifies whether or not the payload is held. The content part is
**binding** (no second payload is consistent with it — removal erases,
never rewrites) and **concealing** (alone, it reveals nothing recoverable
about the payload — formed over the payload together with a private value
held beside the payload in carriage, never in the structural record,
removed atomically with it). An act presents in two projections: **full**
and **reduced**; the structural record is invariant across the transition.

**Removable-projection invariance
(`prop:graph:removable-projection-invariance`).** Tombstoning or removing
either removable projection — payload or dependency opening — changes
neither the edge projections nor any identifier, incidence, role,
parameter rendering, act time, standing quantity, title quantity, or raw
graph quantity: $\boldsymbol{\Psi}_e$, $\boldsymbol{\Psi}_e^{[P]}$,
$\epsilon(e)$, $\tilde{w}(e)$, $W_{\text{end}}^{(k)}$, $\alpha_i$,
settlement recognition, $\mathrm{owner}^{(k)}$, and every gate are
identical across all payload states of every act. Removal is
scoring-neutral: the reduced projection carries the entire Layer-1 closure
surface; epoch replay is bit-identical across full and reduced
(`rem:graph:act-payload-removal-neutrality`).

**Payload size is not act cost
(`rem:graph:payload-size-not-act-cost`).** One authored **act** consumes
one action credit — a hyper-edge, both projections, is one act —
regardless of payload length; $M_{\text{payload}}$ is a carriage bound,
never an action-denomination rule.

**Custody across phases (`rem:graph:act-payload-custody-phases`):** the
content commitment (*witness*) is invariant across phases; only carriage
migrates. Centralized: Layer 1 tracks payload and salt, removable on
request. Decentralized: Layer 1 tracks only the witness; payload and salt
are a terminal carriage obligation. The structural record is identical in
both.

**Payload envelope convention (L2).** The opaque payload MAY carry a structured
Layer-2 **content-envelope** — a deterministic-CBOR convention; the Peer Content
Envelope is the reference format. L1 never inspects it: the envelope's
serialized-length bound `max_payload_bytes` **is** $M_{\text{payload}}$
(`def:graph:act-payload-projection`), and no envelope field enters any closure
formula. Two seam facts hold regardless of the envelope's internal format:

- **Type is not in the payload.** Node type is fixed by the authoring L1 act,
  never an envelope field (declarative identity, §7.2 / §8.1); every envelope
  has the same shape across types.
- **Conformance is an L2 admission gate, never an L1 signal.** Envelope
  well-formedness is a binary guild-admission test; it MUST NOT become a reward
  weight or scoring input. A non-conforming payload still holds a valid,
  irrevocable, scored L1 act
  (`prop:graph:removable-projection-invariance`,
  `rem:graph:payload-size-not-act-cost`) — it is simply invisible in
  enforcing guilds.

A revision is new bytes / a new act, never in-place mutation. The envelope's
content-format specifics (body length, field set, media, encryption) are L2 and
out of scope for this interface.

**Witness reach (evidence, not prevention).** The L1 content commitment covers
the payload — the envelope bytes — and no further. External resources a manifest
references are witnessed only **transitively**: an envelope carrying a resource's
content digest binds *that the author committed to those exact bytes*, so any
participant who fetches and hashes can detect substitution or rot. This is
tamper-*evidence*, consistent with the boundary posture (§5, "misbehavior is
evidence, not prevention", `post:graph:boundary-accountability`); it compels
neither availability nor honest rendering — both terminal (L2). An L2 may
withhold, substitute at render, or decline to verify; the digest yields a
publicly falsifiable record, not enforced delivery.

### 8.5 The stored sentiment slice

Clamping functions: $\sigma_{\text{sig}}(x) = 1/(1 + e^{-x})$;
$\psi_\pm(x) = \sigma_{\text{sig}}(\beta \lvert x\rvert) \cdot \phi_{\tanh}(x)$
(signed, bounded in $(-1,1)$); $\psi_+(x) = \sigma_{\text{sig}}(\beta x)$
(non-negative, bounded in $(0.5, 1)$); $\beta = 2\ln 2$.

**Extended Sentiment Slice (`def:graph:sentiment-slice`,
`eq:graph:sentiment-slice`):** for parameters $p_d, p_i$, domain $D$, binary
mask $\mathbf{a}_D = (a_{00}, a_{01}, a_{10}, a_{11}) \in \{0,1\}^4$:

$$\boldsymbol{\Psi}_e = \begin{pmatrix} a_{00}\,\psi_\pm(p_i p_d) & a_{01}\,\psi_\pm(p_i \lvert p_d\rvert) & \psi_\pm(p_i) \\ a_{10}\,\psi_\pm(\lvert p_i\rvert p_d) & a_{11}\,\psi_+(\lvert p_i\rvert \lvert p_d\rvert) & \psi_+(\lvert p_i\rvert) \\ \psi_\pm(p_d) & \psi_+(\lvert p_d\rvert) & \psi_+(1) \end{pmatrix}$$

The mask applies only to the upper-left $2 \times 2$ bilinear block;
marginals and baseline are always active. Rows = intensity mode
$g \in \{0,1,2\}$; columns = directional mode $h$. Entry semantics:

| Position $(g,h)$ | Product | Clamp | Name |
|---|---|---|---|
| $(0,0)$ | $p_i p_d$ | $\psi_\pm$ | Tribal alignment |
| $(0,1)$ | $p_i \lvert p_d\rvert$ | $\psi_\pm$ | Popularity |
| $(1,0)$ | $\lvert p_i\rvert p_d$ | $\psi_\pm$ | Engagement buzz |
| $(1,1)$ | $\lvert p_i\rvert \lvert p_d\rvert$ | $\psi_+$ | Polarization |
| $(0,2)$ | $p_i$ | $\psi_\pm$ | Net intensity |
| $(1,2)$ | $\lvert p_i\rvert$ | $\psi_+$ | Gross intensity |
| $(2,0)$ | $p_d$ | $\psi_\pm$ | Net direction |
| $(2,1)$ | $\lvert p_d\rvert$ | $\psi_+$ | Gross direction |
| $(2,2)$ | $1$ | $\psi_+$ | Baseline |

The slice $\boldsymbol{\Psi}_e$ is the stored object, always built from the
act's own parameters — **stored slices stay per-record**. Aggregation of
same-author bundles (net stance) is a derived fold, never a change to the
stored per-record slice: see §11.3. Structural bounds: the baseline entry
$\Psi_e^{22} = \psi_+(1) > 0$ never vanishes
(`lem:graph:non-vanishing-norm`);
$\lVert\boldsymbol{\Psi}_e\rVert_F \le 3$ (`lem:graph:frobenius-bound`);
polarization floor $\Psi_e^{11} \ge \tfrac12$
(`prop:graph:polarization-floor`).

### 8.6 The raw path-view interface

**(`def:graph:dual-view-architecture`.)** Every edge projection stores
$\boldsymbol{\Psi}_e$ and exposes the raw path-view interface:

- the stored $3 \times 3$ slice $\boldsymbol{\Psi}_e$;
- the $2 \times 2$ path-view matrix $\boldsymbol{\Psi}_e^{[P]}$;
- the determinant magnitude $|\det \boldsymbol{\Psi}_e^{[P]}|^{1/2}$;
- the determinant sign $\epsilon(e)$.

The damped weight $\tilde{w}(e)$ is the identical **raw per-edge primitive**
for every raw-graph consumer — feed ranking, the raw signed double-cover
service, and Channel 1 of bridge transport — with no per-consumer variant
(**one raw formula for all raw-graph consumers**,
`rem:epoch:shared-raw-edge-primitive`). Under Edition 4 the raw formula
itself is a **terminal default** (a guild may replace it, publishing the
replacement completely; host-cached values are by-products — §3, §4).
**Standing is not a raw-graph consumer:** it compiles complete acts into
folded person-vouch relations and reads the relation coefficient and
wall-clamped target activation instead (§11.3–11.4), never $\tilde{w}$.
Terminal reads of the stored $3 \times 3$ record (the full paper's Scalar
and Attribution Views, feed terminus norms, CAN base values) are named only
in the boundary ledger.

### 8.7 Path view, tiers, parity, and the damped weight

**Path-View Extraction (`def:graph:path-view-extraction`,
`eq:graph:path-view-extraction`, `subsec:necessity:eta-softening`):**

$$\boldsymbol{\Psi}_e^{[P]} = \begin{pmatrix} \tilde{a}_{00}\,\psi_\pm(p_i p_d) & \tilde{a}_{01}\,\psi_\pm(p_i \lvert p_d\rvert) \\ \tilde{a}_{10}\,\psi_\pm(\lvert p_i\rvert p_d) & \tilde{a}_{11}\,\psi_+(\lvert p_i\rvert \lvert p_d\rvert) \end{pmatrix}$$

$$\tilde{a}_{gh} = \begin{cases} a_{gh} + (1 - a_{gh})\,\eta, & T \in \{\text{Full}, \text{Marginal}\}, \\ 1, & T = \text{Half},\ (g,h) = (1,1), \\ \sqrt{\eta}, & T = \text{Half},\ (g,h) \ne (1,1), \end{cases}$$

with $\eta = 0.05$, $\sqrt{\eta} \approx 0.224$. Polarization corner
$\tilde{a}_{11} = 1$ always. Routing-tier floor ladder:
$\{1, \sqrt{\eta}, \eta\}$ (Full, Half, Marginal). Settlement and proposal
edges route at Half (`def:graph:proposal-half-tier`); the Half floor is
path-view-only (edges carry a full stored block) and preserves determinant
sign exactly (`lem:graph:tier-floor-sign-invariance`).

**Per-Edge Determinant Sign (`def:graph:determinant-sign`):**
$\epsilon(e) = \mathrm{sgn}(\det(\boldsymbol{\Psi}_e^{[P]})) \in \{+1, -1\}$.
Well-defined whenever both parameters are nonzero ($\eta$-softening
guarantees $\det \neq 0$); if either parameter vanishes, $\epsilon(e)$ is
undefined and $\tilde{w}(e) = 0$ (routing-inert,
`rem:graph:zero-parameter-degeneracy`). Indifference is magnitude zero, not
a third sign.

**Quadrant Law (`lem:graph:quadrant-law`).** For every edge produced by the
canonical pipeline, in every mask and at every tier floor:

$$\epsilon(e) = \mathrm{sgn}(p_d\, p_i).$$

Under the joint sign flip $(p_d, p_i) \mapsto (-p_d, -p_i)$ the path-view
matrix transforms by orthogonal conjugation
($\boldsymbol{\Psi}^{[P]}(-p_d,-p_i) = D\,\boldsymbol{\Psi}^{[P]}(p_d,p_i)\,D$,
$D = \mathrm{diag}(1,-1)$): determinant magnitude, determinant sign,
singular values, and damped weight are invariant under the joint flip.

**Sign semantics: coherence bit, not favor bit
(`rem:graph:sign-semantics`).** One $\mathbb{Z}_2$ law at three scales:
parameter product within an edge, leg product within a hyper-edge, parity
product along a path. $(-1,-1)$ is gauge-equivalent to $(+1,+1)$ for
*coherence* consumers. Stance is the author's directional verdict, read from
the marginal sign of $p_d$; standing endorsement is a **stance consumer** on
person-directed acts (person-vouch eligibility, §11.3). Coherent
condemnation is a strong coherent signal, but not a vouch. Normative: (1)
$\epsilon(e)$ is a coherence bit, never a favor bit; (2) indifference is
zero magnitude, not a sign; (3) stance survives in the stored slice's
marginal row and terminal stance read-sites; it is never substituted for
path parity.

Determinant magnitude per tier (`prop:graph:path-view-determinant-bound`):

| Tier | $\sqrt{\lvert\det(\boldsymbol{\Psi}^{[P]})\rvert}$ | Edge types |
|---|---|---|
| Full | $\approx 0.27$–$0.36$ | Opinion, Review/A, Reference/T, Self, Owner, Publish, Participant, Send/A |
| Half | $\approx 0.20$–$0.22$ | Bid, Accept, Ratify, Join Request, Invitation/A |
| Marginal | $\approx 0.07$–$0.08$ | Tag, Affinity, Review/T, Reference/A, Send/T, Invitation/T, control legs |

Self/Reputation is Full but standing-dependent
($\lvert\det\rvert^{1/2} \to 0$ as $\alpha \to 0$); supremum tracked by
$\tilde{w}_{\max}$.

**Damped edge weight (`def:epoch:damped-edge-weight`,
`eq:epoch:damped-edge-weight`):**

$$\tilde{w}(e) = \underbrace{|\det \boldsymbol{\Psi}^{[P]}_e|^{1/2}}_{\text{coherence}} \cdot \underbrace{\sqrt{1 + \tau_e^2}}_{\text{maturity}} \cdot \underbrace{e^{-\beta H_\tau(e)}}_{\text{boundary}}$$

Bounds (`prop:epoch:damped-weight-bounds`): $\tilde{w}(e) \ge 0$, strictly
positive for every routing-active edge and zero exactly when a mandatory
parameter vanishes;
$\tilde{w}(e) \le |\det \boldsymbol{\Psi}^{[P]}_e|^{1/2} \cdot \sqrt{2}$;
non-monotone in $\tau$ with minimum near $\tau \approx 0.5$. **Raw
edge-weight ceiling (`thm:graph:raw-weight-ceiling`):**
$0 \le \tilde{w}(e) \le \tilde{w}_{\max} < 1$ for every raw edge
projection and derived reading, every parameter tuple, tier, and maturity
— so log costs are positive, max-product registers bounded, and every
optimal bounded raw walk has a simple representative. Maturity crossover:
$g(\tau) = \sqrt{1+\tau^2}\, e^{-\beta H_\tau} > 1$ iff
$\tau > \tau^* \approx 0.94$ (`def:epoch:maturity-crossover`,
`prop:epoch:crossover-location`).

### 8.8 Interaction domains and masks

**Interaction domains (`tbl:graph:interaction-domains`):**

| Domain | Parameters | Default mask | Tier |
|---|---|---|---|
| Tribal | polarity, reaction, enthusiasm | $(1, 1, 1, 1)$ | Full |
| Epistemic | confidence, effort, relevancy | $(0, 1, 0, 1)$ | Marginal |
| Economic | generosity, urgency, attachment | $(0, 0, 1, 1)$ | Marginal |
| Relational | formality, responsibility, equity | $(0, 0, 1, 1)$ | Marginal |
| Identity | (standing-derived) | $(1, 0, 0, 1)$ | Full |
| Minimal | (bare activity) | $(0, 0, 0, 1)$ | Marginal |

Softened masks: Tribal $(1,1,1,1)$; Identity $(1,\eta,\eta,1)$; Epistemic
$(\eta,1,\eta,1)$; Economic/Relational $(\eta,\eta,1,1)$; Minimal
$(\eta,\eta,\eta,1)$.

**Mask Promotion Criterion (`def:graph:mask-promotion-criterion`).** An edge
whose parameters are signed ($p \in [-1,1]$) and whose interaction
constitutes a directional stance has its mask promoted to $(1,1,1,1)$,
regardless of conceptual domain. **Exclusion:** a signed parameter whose
sign is a self-report about the author's own relation to the target does not
promote by this criterion. Where the reading is contestable, the Edge Census
governs (`rem:nodes:edge-census-normative`).

**Proposal Half-Tier Assignment (`def:graph:proposal-half-tier`).** A
signed-stance edge whose primary effect awaits a counterparty's own authored
act routes at the Half tier. Two families are exactly these: the settlement
handshake — Bid, Accept, Ratify; the conversational proposals — Join
Request, Invitation/A. Such edges carry genuine directional stance and
retain a full stored block; the Half-tier floor applies only in the path
view and preserves determinant sign exactly.

### 8.9 Derived path quantities consumed by raw traversal

- **Path matrix (`def:graph:path-matrix`):** for a directed path
  $p = (e_1, \dots, e_d)$ viable under the authoritative order:
  $P(p) = \boldsymbol{\Psi}_{e_1}^{[P]} \cdots \boldsymbol{\Psi}_{e_d}^{[P]}$.
- **Determinant product (`thm:graph:determinant-product`):**
  $\det(P(p)) = \prod_{e\in p} \det(\boldsymbol{\Psi}_e^{[P]})$.
- **Path parity (`cor:graph:path-parity-sign`):**
  $\epsilon(p) = \prod_{e\in p} \epsilon(e) = \mathrm{sgn}(\det(P(p)))$.
- **Half-score factorization (`def:graph:svd-path-score`,
  `eq:graph:half-score`):** at $q = \tfrac12$ the path score is
  $\prod_{e\in p} \big(|\det \boldsymbol{\Psi}_e^{[P]}|^{1/2}\sqrt{1+\tau_e^2}\, e^{-\beta H_\tau(e)}\big) = \prod_{e\in p}\tilde{w}(e)$
  (Dijkstra-compatible), consumed by the raw-graph traversals (feed ranking,
  the raw signed double-cover service, bridge Channel 1); standing reads the
  relation-layer quantities, not $\tilde{w}$ paths (§11.4).
  $q = \tfrac12$ is the canonical default; a guild may expose
  $q \ne \tfrac12$ for its own sorting at matrix-BFS cost
  (`rem:sorting:matrix-bfs`).
- **Hyper-edge reduction (`thm:graph:hyper-edge-reduction`):** any
  hyper-edge $\mathcal{H} = (a, p, h)$ decomposes into binary legs
  $e_{ap}, e_{ph}$ with multiplying path-view determinants and signs:
  $\epsilon(\mathcal{H}) = \epsilon(e_{ap}) \cdot \epsilon(e_{ph})$. The
  raw traversal never consumes an opaque hyper-edge object; it consumes
  the legs.
- **Raw snapshot paths (`def:graph:raw-snapshot-path`):** a raw snapshot
  path is a directed simple path in $G_k^{\text{raw}}$, depth = raw edge
  projections plus current derived readings traversed, at most $L$. **Raw
  path viability does not require edge times to increase**: raw feed and
  bridge services measure connectivity in the current public snapshot, not
  a chronological event chain. The host-published act order remains binding
  for act acceptance, maturity, bundle folds, title, standing, and the
  derived Self-edge parameters — it is not a path constraint on terminal
  snapshot traversal. (Supersedes the pre-Edition-4 path-viability axiom.)
- **Exactness (`rem:sorting:raw-pruning-is-implementation`):** the
  canonical raw feed, signed, and bridge services are exact bounded-depth
  max-product computations on $G_k^{\text{raw}}$. Layer 1 publishes no raw
  pruning tolerance, precision clip, semantic weak-path cutoff, or
  permanent pruned-node state; approximate or thresholded raw traversal is
  a terminal Layer-2 choice that must publish its own error, cutoff, and
  tie semantics.
- **Ordered-replay determinism (`lem:graph:ordered-replay-determinism`):**
  see §8.3 — all of the above are deterministic functions of
  $(\mathcal{Q}_k, \text{constants})$; different valid host orders may
  differ (`rem:graph:host-ordering-discretion`).

Excised from the closure edition (terminal): the general $W_q$
score, path distance $d(u,v)$, the augmented relevance tensor
$\mathcal{T}_e$, node-level aggregated sentiment
($\bar{w}_c$ / $\lVert\mathcal{T}_c\rVert_F$), hyper-edge scalar norms,
condition number, coherence ratio, mode angle, and the post-ranking
diagnostics ($\varrho$, $\vartheta$, archetypes, anisotropy penalty). They
remain specified in the full paper's terminal sections only.

---

## 9 Node and edge type inventory

### 9.1 Universal principles (`subsec:nodes:universal-principles`)

Six structural invariants for all edges and hyper-edges:

1. Every edge projection inherits its parent act's authoritative logical
   time $\mathbb{T}^{\text{act}}_q$ and carries its own maturity scalar
   $\tau_e$.
2. Every edge's stored sentiment is a $3\times3$ extended slice
   $\boldsymbol{\Psi}_e$ constructed via the canonical pipeline.
3. Every edge exposes the raw path-view interface
   $\boldsymbol{\Psi}_e^{[P]}$, its determinant magnitude, and its
   determinant sign.
4. Every hyper-edge act projects into two binary legs whose path-view
   determinants and determinant signs multiply.
5. Boundary damping $e^{-\beta H_\tau}$ is applied at observation, not to
   stored tensors.
6. Every act carries a separable payload commitment; payload bytes and
   payload state enter no Layer-1 closure formula.

**Canonical Tensor Pipeline (`post:nodes:canonical-tensor-pipeline`).** For
every edge (binary or hyper-edge leg): (1) role assignment — domain
parameters assigned to directional ($p_d$) and intensity ($p_i$) roles;
single-parameter edges set the missing role to 1; (2) extended slice via the
master formula with the domain's bilinear mask; (3) path-view extraction
with $\eta$-softening; (4) temporal attributes — the inherited act time,
$\tau_e$, $H_\tau(e)$ computed under the authoritative order; (5) closure
extraction — per-edge $|\det \boldsymbol{\Psi}_e^{[P]}|^{1/2}$,
$\epsilon(e)$, $\tilde{w}(e)$. Single-parameter row collapse (Owner,
Publish, Send/A) is a census property, not an incentive surface
(`rem:nodes:row-collapse`).

### 9.2 Affordance traits (`tbl:nodes:affordance-traits`)

| Trait | Description | Implemented by |
|---|---|---|
| Taggable | Target of a Tag hyper-edge | Profile, Content, Item, Type, Chat, Comment, Message |
| Reviewable | Target of a Review hyper-edge; sources the author-fixed Review/T leg to the created Comment | **All passive types**: Profile, Content, Item, Type, Chat, Comment, Message, Offer |
| Ownable | Target of Owner and Bid edges | Item |
| Conversational | Target of Join Request and Leave edges; middle node of Invitation, De-invite, and Send hyper-edges | Chat |

Offer is the sole non-Taggable passive type: a settlement artifact does not
belong in the semantic taxonomy. Target validity: Opinion → any passive;
Affinity → Type; Tag → Taggable; Review → Reviewable; Owner/Bid → Ownable;
Join Request, Invitation/A, Send/A, Leave, De-invite/A, Participant →
Chat; Withdraw/Rescind → Offer; Invitation/T → invitee's Profile;
De-invite/T → de-invitee's Profile. Reference is trait-independent on both
ends: its A-leg sources from any passive citing artifact, and its T-leg
targets any existing passive node, including a Profile, never an Actor
(`rem:nodes:reference-author-allocation`).

**Reviews are commentary, never state (`rem:graph:reviews-commentary`).**
Every passive node type implements Reviewable: anything that exists in the
graph admits attributed public commentary. A Review transitions no
settlement state, moves no title, binds no tag, creates no membership, and
enters no admission quantity. Universal Reviewability is **standing-inert**,
and the inertness is semantic rather than topological: Review is not a
standing-designated person-vouch family, and no raw Review leg or
Review-created Comment can lend upstream standing to a third party's later
Reference — a later Reference is evaluated as its own complete act, through
its own author (`def:graph:act-edge-projection`,
`rem:graph:grounded-target-does-not-imply-allocation`). Commentary thus stays
available to feed, CAN, and terminal guild policies without becoming a
standing conduit.

### 9.3 Node types

Every node is an identifier in the algebra (§8.1); its **class** is its
outermost constructor, and a genesis/anchoring act fixes it:

| Node | Class | Constructor | Anchored by |
|---|---|---|---|
| Actor, Profile | grounded | $\mathsf{addr}(a)$, $\mathsf{prof}(a)$ | **Registration** |
| Type | named | $\mathsf{name}(s)$ (byte equality; a commons) | vacuous |
| Content | minted | $\mathsf{mint}(\mathrm{actid})$ | **Publish** |
| Item | minted | $\mathsf{mint}(\mathrm{actid})$ | genesis Owner |
| Chat, Comment, Message, Offer | minted | $\mathsf{mint}(\mathrm{actid})$ | its creating act (founding Participant / Review/T / Send/T / Bid/T) |

**Actor** (active, $V_u$; `node:nodes:actor`) — sole active node type.
Originates all acts; the only nodes eligible to appear as endpoints of a
standing path. In: Self Rep. (from Profile, derived), Accept, Ratify (from
Actors). Out: Registration → Profile (self-introduction), Publish → Content
(genesis), and edges to all passive leaf types; Join Request, Invitation/A,
Leave, De-invite/A → Chat; Accept/Ratify → Actor; Withdraw/Rescind → Offer.
A new actor with $B_i = 0$ has $r_i = 0$ and, with no relational flow,
$\alpha_i = 0$ and an inert raw Self-edge; only a current external
positive-rate vouch lifts a newly registered actor, and same-epoch topology
creates no source (`cor:epoch:same-epoch-source-hull`, §7.1).

Reference incidence is universal and omitted from the per-node lists below:
every passive node admits Reference/A (from an Actor, when the node serves as
the citing artifact) and Reference/T (as the target of any passive artifact)
in-edges, and sources an author-fixed Reference/T leg toward any passive
target (§9.6, `lem:graph:passive-out-degree`).

Passive leaf nodes (`subsec:nodes:leaf-passive-nodes`):

- **Profile** (`node:nodes:profile`) — passive identity anchor $\mathsf{prof}(a)$,
  anchored by its Registration record and uniquely bound to one Actor via the
  Self-edge bond. Taggable, Reviewable. In: **Registration**, Self (Dec.),
  Opinion, Tag/A, Review/A, **Invitation/T, De-invite/T** (from Chats).
  Out: Self (Rep.) → Actor (derived), Tag/T → Type, Review/T → Comment.
  Profile-targeted person-directed acts are filtered by person-vouch
  eligibility before they can carry source rate into standing.
- **Content** (`node:nodes:content`) — primary digital artifact, minted
  from its Publish act. Taggable, Reviewable. In: **Publish (genesis, fixes
  $\mathrm{creator}$)**, Opinion, Tag/A, Review/A. Out: Tag/T → Type,
  Review/T → Comment. (The closure edition specifies no terminal
  content-ranking mechanism.)
- **Item** (`node:nodes:item`) — ownable entity. Taggable, Reviewable,
  Ownable. In: Owner, Opinion, Tag/A, Review/A, Bid/A. Out: Tag/T,
  Review/T, Bid/T → Offer. Closure role: genesis and title
  (`def:graph:item-genesis-act`, `def:graph:title-certificate`).
- **Type** (`node:nodes:type`) — semantic anchor / concept. Taggable,
  Reviewable. In: Affinity, Opinion, Tag/A, Tag/T (from passives),
  Review/A. Out: Tag/T → Type, Review/T → Comment. Reviews of a Type do
  not change Type semantics, tags, standing, title, or gates.
- **Chat** (`node:nodes:chat`) — conversation container, minted from its
  founding member's Participant act. Conversational, Taggable, Reviewable.
  In: Participant, Opinion, **Join Request, Leave**, Send/A, Tag/A,
  Review/A, **Invitation/A, De-invite/A**. Out: **Invitation/T → Profile,
  De-invite/T → Profile**, Send/T → Message, Tag/T → Type, Review/T →
  Comment. Closure role: Participant is a promoted Full-tier enacted
  relation; Join Request and Invitation are proposals, not participation;
  Leave and De-invite are control records. **Membership is not a Layer-1
  admission predicate; it is a terminal fold** (§9.8).

Hyper-leaf passive nodes (`subsec:nodes:hyper-leaf-passive-nodes`):

- **Comment** (`node:nodes:comment`) — contextual annotation via Review
  hyper-edge. Taggable, Reviewable. In: Review/T (from passive), Opinion,
  Tag/A, Review/A. Out: Tag/T → Type, Review/T → Comment. Nested Comment
  Reviews are a causal chain of new acts, depth bounded by $L$ and
  Marginal compounding (`rem:nodes:nested-comment-review`).
- **Message** (`node:nodes:message`) — communicative act within a Chat via
  Send hyper-edge. Taggable, Reviewable. In: Send/T (from Chat), Opinion,
  Tag/A, Review/A. Out: Tag/T → Type, Review/T → Comment. A Send
  responds inside the channel; a Review annotates the utterance from outside
  it.
- **Offer** (`node:nodes:offer`) — passive proposal artifact via Bid
  hyper-edge. Reviewable; no other affordance traits. In: Bid/T (from
  Item), Opinion, Review/A, Withdraw (buyer), Rescind (seller). Out:
  Review/T → Comment — its sole out-edges. Settlement Accept and Ratify
  reference the Offer's Bid act via settlement references but are **not
  incident** to it.

### 9.4 The raw Self-edge reading (`def:epoch:raw-self-edge-reading`)

After final standing is published, Layer 1 exposes a **raw Self-edge
reading for feed and raw bridge services only**. Both components share the
Möbius image of final reduced standing,
$p_i^{(k)} = \hat{\alpha}_i^{(k)}/(1 + \hat{\alpha}_i^{(k)}) =
\alpha_i^{(k)}/(\nu + \alpha_i^{(k)})$, with $p_d = 1$; Identity domain,
mask $(1,0,0,1)$, Full tier. Stored tensor and path view (softened mask
$(1,\eta,\eta,1)$):

$$\boldsymbol{\Psi} = \begin{pmatrix} \psi_\pm(p) & 0 & \psi_\pm(p) \\ 0 & \psi_+(p) & \psi_+(p) \\ \psi_\pm(1) & \psi_+(1) & \psi_+(1) \end{pmatrix}, \qquad \boldsymbol{\Psi}^{[P]} = \begin{pmatrix} \psi_\pm(p) & \eta\,\psi_\pm(p) \\ \eta\,\psi_\pm(p) & \psi_+(p) \end{pmatrix}$$

$$|\det \boldsymbol{\Psi}^{[P]}|^{1/2} = \sigma_{\text{sig}}(\beta p)\sqrt{\tanh(p)\big(1 - \eta^2 \tanh(p)\big)}, \qquad \epsilon(e_{\text{Dec}}) = \epsilon(e_{\text{Rep}}) = +1 \ \forall\, \alpha_j > 0$$

At $\alpha_j = 0$: $p = 0$, $\tilde{w}(e) = 0$ — the raw bond is inert.
Both components are derived certificate recomputations
(`def:graph:derived-raw-edges`, `def:graph:derived-self-reading`), excluded
from the record set, bundles, action counts, and the payload schema. **The
reading is a deterministic function of the current final standing: there is
no freeze, no previous-standing memory, and no below-wall branch** — the
pre-Edition-4 last-valid-pair freeze is deleted; below the wall, standing
uses the wall-clamped *activation* instead (§11.4), which is a property of
the standing solve, not of the raw reading.

- **Declaration** (Actor → Profile): derived — recomputed from the epoch
  package each boundary, never appended; binds Actor to Profile in raw
  traversal. Actor-sourced, so not a passive-sourced edge.
- **Reputation** (Profile → Actor): derived passive-sourced edge. Two roles,
  kept apart: for **feed** it is the terminal edge of the raw
  profile-bridged discovery path
  (`def:nodes:profile-bridged-discovery-path`), $\tilde{w}(e_{\text{Rep}})$
  set by the *target* actor's $\alpha$; for **standing** the bond instead
  supplies the projected target activation — the wall-clamped
  $\bar{g}_{\text{vch}}(x_i)$ (§11.4) — and standing never traverses the
  raw Reputation leg (`rem:dynamics:standing-feed-separation`). **Tenure
  channel:** boundary derivation ratchets
  $\tau_i^{(k)} = 1 - 1/(k - k_i^{\text{reg}} + 1) \to 1^-$; a mature bond
  can outweigh a first-epoch bond at equal standing in the feed weight, but
  stays under $\tilde{w}_{\max}$. Raw maturity amplification cannot create
  a projected standing activation
  (`rem:nodes:anchoring-and-relational-support`).

**Raw Self-edge properties (`prop:nodes:raw-self-edge-properties`)** — raw
feed/bridge/CAN properties only, not the standing activation: zero at zero;
strictly monotone increasing in $\alpha_j$; $\tilde{w}(e_{\text{Rep}}) < 1$
always; concave; positive parity; both components synchronized at every
epoch boundary; feed-through hierarchy (profile-bridged ceiling
$(\tilde{w}_{\max}^{\text{Op}})^2 \cdot \tilde{w}_{\max} \approx 0.249$ vs
direct-Opinion ceiling $\approx 0.502$ — the bridge is always at least
2× weaker); raw $\tau$-channel ceiling at frozen $p$:
$\sup_\tau \tilde{w}(e_{\text{Rep}})(p_0;\tau) = |\det \boldsymbol{\Psi}^{[P]}(p_0)|^{1/2}\sqrt{2} < 1$.
Self-loop paths Actor→Profile→Actor produce no register update in raw
traversal (`prop:nodes:self-loop-neutral`).

**Profile-bridged discovery prefix
(`def:nodes:profile-bridged-discovery-path`):**
$\text{Actor}_i \xrightarrow{\text{Op}} \text{Profile}_j \xrightarrow{\text{Rep}} \text{Actor}_j$.
**Raw profile-bridge amplification
(`def:nodes:raw-profile-bridge-amplification`):**
$A(\hat{\alpha}_j) = \tilde{w}(e_{\text{Rep}})(\alpha_j)\cdot(1 + \alpha_j)$,
strictly increasing, $A(0) = 0$ — a terminal reader of the published
standing, not a second run of the standing machinery.

### 9.5 Binary edge types (`subsec:nodes:binary-edges`)

| Edge | Src → Tgt | Domain | Mask (stored) | Tier | Params (roles) | Notes |
|---|---|---|---|---|---|---|
| **Registration** | Actor → Profile | Identity | $(1,0,0,1)$ | Full | $p_d = p_i = 1$ (fixed); $\epsilon = +1$ forced | actor's self-introduction and the **anchoring record** of the grounded pair (Actor, Profile) — nothing minted; the sole family carrying fresh grounded endpoints; root of the author's identity chain; parallel Registrations update payload only, never the identity; one ordinary act under final-set admission (`edge:nodes:registration`, `def:graph:registration`) |
| **Publish** | Actor → Content | Economic | $(1,1,1,1)$ ↑promoted | Full | attachment $a \in [-1,1]$ ($p_d = a$, $p_i = 1$) | **genesis act of a Content node**, fixing $\mathrm{creator}$; mirrors Owner (row-collapse); license qualifiers are public protocol references of this act (`edge:nodes:publish`) |
| Opinion | Actor → passive | Tribal | $(1,1,1,1)$ | Full | polarity $p$, reaction $r$ ($p_d = p$, $p_i = r$) | the archetypal edge; on a Profile it is person-directed and subject to person-vouch eligibility |
| Affinity | Actor → Type | Epistemic | $(0,1,0,1)$ | Marginal | association $a$, attraction $t$ ($p_d = a$, $p_i = t$) | relevance, not verdict; its sign is coherence, not a standing vouch |
| Participant | Actor → Chat | Relational | $(1,1,1,1)$ ↑promoted | Full | interactivity $i$, responsibility $r$ ($p_d = i$, $p_i = r$) | the actor's own membership signal for the terminal membership fold (§9.8); the founding member's Participant is the Chat's genesis act |
| Owner | Actor → Item | Economic | $(1,1,1,1)$ ↑promoted | Full | attachment $a \in [-1,1]$ ($p_d = a$, $p_i = 1$) | at $a = 0$ anchors the title thread but is routing-inert — title is sentiment-blind; orphaned Owner edges persist without title force |
| **Join Request** | Actor → Chat | Relational | $(1,1,1,1)$ ↑promoted | **Half** | urgency $u \in [-1,1]$, formality $f \in [-1,1]$ ($p_d = u$, $p_i = f$) | a proposal, not participation: creates no membership, alters no Chat state (`edge:nodes:join-request`) |
| Accept | Actor(seller) → Actor(buyer) | Relational | $(1,1,1,1)$ ↑promoted | **Half** | comfort $c$, equity $e$ ($p_d = c$, $p_i = e$) | settlement reference → Bid act; not binding — title moves only at Ratify; person-directed: only positive-coordinate Accepts fold into the standing projection |
| Ratify | Actor(buyer) → Actor(seller) | Relational | $(1,1,1,1)$ ↑promoted | **Half** | final comfort $c$, final equity $e$ | settlement reference must match the Accept's, plus the exact Accept reference; the commit record (final at the certificate); same person-vouch role |
| Withdraw | Actor(buyer) → Offer | Minimal | $(0,0,0,1)$ | Marginal | $p_d = p_i = 1$ fixed; $\epsilon = +1$ forced | control record — never vouches, excluded from the standing projection |
| Rescind | Actor(seller) → Offer | Minimal | $(0,0,0,1)$ | Marginal | $p_d = p_i = 1$ fixed; $\epsilon = +1$ forced | seller's sole escape from a non-binding Accept before commit; control record |
| **Leave** | Actor → Chat | Minimal | $(0,0,0,1)$ | Marginal | type-fixed $p_d = p_i = 1$; $\epsilon = +1$ forced | unilateral departure/dissociation declaration; **unconditional** (no membership precondition — a Leave from a never-member is a valid public record); no effect on standing, title, settlement, or gates; exit record of the terminal membership fold (`edge:nodes:leave`, `subsec:necessity:unrestricted-departure`) |

Sentiment about a departure composes through Opinion (on the Chat or the
Profile), never through the control record: a rage-quit is Leave plus a
negative Opinion (`rem:nodes:departure-composes-with-opinion`).

### 9.6 Hyper-edge types (`subsec:nodes:hyper-edges`)

Every hyper-edge act projects into two binary legs; legs are independently
assigned domain and mask and may occupy different tiers;
$\epsilon(\mathcal{H}) = \epsilon(e_A)\cdot\epsilon(e_T)$. The **A-leg**
is Actor → Passive (the initiating side), the **T-leg** Passive → terminal
target; both are projections of one act (`def:graph:act-edge-projection`).
(Pre-Edition-4 census tables named these legs "L1/L2"; the current census
names them /A and /T.)

| Hyper-edge | Legs | Leg domains (masks, tiers) | Params (roles A / T) |
|---|---|---|---|
| Tag | Actor → Passive → Type | Epistemic $(0,1,0,1)$ M / Epistemic $(0,1,0,1)$ M | relevance $r \in [-1,1]$, confidence $c \in [0,1]$; A: $p_d = r, p_i = c$; T: $p_d = c, p_i = r$ |
| Review | Actor → Passive → Comment | Tribal $(1,1,1,1)$ F / Epistemic $(0,1,0,1)$ M | enthusiasm $e$, effort $f$; A: $p_d = e, p_i = f$; T: $p_d = f, p_i = e$. Commentary, never state; standing-inert as a family |
| Bid | Actor → Item → Offer | Economic ↑promoted, both legs **Half** | signed generosity $g \in [-1,1]$, urgency $u \in [0,1]$; A: $p_d = g, p_i = u$; T: $p_d = u, p_i = g$. Both legs carry $\epsilon = \mathrm{sgn}(g)$, so composed parity is $+1$: a predatory Bid is parity-visible per leg, parity-neutral as a composition; the buyer's stance is read by stance consumers (`cor:nodes:bid-leg-parity`) |
| **Invitation** | Actor → Chat → Profile(invitee) | Relational $(1,1,1,1)$ ↑ **Half** / Epistemic $(0,1,0,1)$ M | urgency $u \in [-1,1]$, formality $f \in [-1,1]$, relevance $r \in [0,1]$; A: $p_d = u, p_i = f$; T: $p_d = r, p_i = 1$ (forced $+1$ for $r > 0$). A public, priced, authored vouch that the invitee fits the community; a proposal, not participation. The terminal leg targets the invitee's **Profile**, never the Actor — influence reaches the invitee only through their standing-dependent activation (wall-clamped, §11.4). Revocable per author (§9.8) (`edge:nodes:hyper-invitation`, `subsec:necessity:invitation-profile-terminus`) |
| **De-invite** | Actor → Chat → Profile(de-invitee) | Minimal $(0,0,0,1)$ M / Minimal $(0,0,0,1)$ M | none — both legs type-fixed $p_d = p_i = 1$, $\epsilon = +1$ forced | declaration that another actor should not be (or no longer be) part of a Chat; a **control record** — its force is terminal policy, never a Layer-1 validity predicate. **Unconditional**: the author need not be a member, inviter, or authority; the target need not be a member. Both legs excluded from the standing projection — a De-invite never vouches for its target. Sole closure-visible effect: per-author suppression of the author's own Invitation bundle toward the same (Chat, Profile) incidence (`edge:nodes:hyper-deinvite`, `subsec:necessity:deinvite-profile-terminus`) |
| Send | Actor → Chat → Message | Relational $(1,1,1,1)$ ↑ F / Minimal $(0,0,0,1)$ M | importance $i \in [-1,1]$; A: $p_d = i, p_i = 1$; T: $p_d = 1, p_i = i$. **Renamed from "Write"** (`edge:nodes:hyper-send`): *write* is the protocol act (§8.2); a Send is carried into the graph by a write, it is not one. **Not membership-gated**: a Layer-1 membership precondition would drag membership into the admission closure (`rem:nodes:membership-is-terminal`). Standing role none: sending into a Chat endorses no one |
| Reference | Actor → Passive(artifact) → Passive(target) | Epistemic $(0,1,0,1)$ M / Tribal $(1,1,1,1)$ F | enthusiasm $e \in [-1,1]$, effort $f \in [-1,1]$; A: $p_d = f, p_i = e$; T: $p_d = e, p_i = f$. Review with its legs transposed; **mints nothing** — both endpoints of the T-leg are pre-existing nodes: the citing artifact is any passive node, the target any passive node including a Profile, never an Actor. The strong Tribal leg carries the citation itself; the weak Epistemic leg carries authorship. Commentary, never state (`rem:graph:reviews-commentary`); census sibling is Tag. Target class switches the allocation destination: a **complete** Reference whose T-leg targets Profile$_i$ with strictly-positive folded $(e, f)$ resolves its fold cell to Actor $i$; every other Reference resolves to its author's self-retention channel — weighed and priced either way, but reaching no one else (still read by feed, raw signed traversal, CAN, provenance, terminal policy). The artifact supplies context, never transferable standing: incoming weight on the citing artifact enters no cell (§11.3, `def:epoch:standing-recipient-resolution`). Self-reference resolves home; withdrawal is per-leg net stance (`edge:nodes:hyper-reference`, `rem:nodes:reference-author-allocation`) |

There is no combined Actor → Actor → Chat request edge: joining is the binary
Join Request (Actor → Chat), and inviting is the Invitation hyper-edge (Chat
as middle node, Profile as terminus) — two distinct families.

### 9.7 Archetype fingerprint table (`tbl:nodes:archetype-fingerprints`)

Legend: • = active; ∘ = zeroed (stored) / $\eta$-scaled (path view);
↑ = promoted. $\epsilon$: $+1$ structurally forced; $\pm 1$ user-controlled.
Tier: F = Full, H = Half, M = Marginal. Half edges carry a full stored block
but route at the $\sqrt{\eta}$ path-view floor. **The census is normative:
where prose and the tables disagree, the tables govern**
(`rem:nodes:edge-census-normative`).

| Edge | Domain | Pr. | $\Psi^{00}$ | $\Psi^{01}$ | $\Psi^{10}$ | $\Psi^{11}$ | Tier | $\epsilon$ |
|---|---|---|---|---|---|---|---|---|
| Self (Dec., derived) | Identity | — | • | ∘ | ∘ | • | F | $+1$ |
| Self (Rep., derived) | Identity | — | • | ∘ | ∘ | • | F | $+1$ |
| Registration | Identity | — | • | ∘ | ∘ | • | F | $+1$ |
| Publish | Economic | ↑ | • | • | • | • | F | $\pm 1$ |
| Opinion | Tribal | — | • | • | • | • | F | $\pm 1$ |
| Affinity | Epistemic | — | ∘ | • | ∘ | • | M | $\pm 1$ |
| Participant | Relational | ↑ | • | • | • | • | F | $\pm 1$ |
| Owner | Economic | ↑ | • | • | • | • | F | $\pm 1$ |
| Join Request | Relational | ↑ | • | • | • | • | H | $\pm 1$ |
| Invitation/A | Relational | ↑ | • | • | • | • | H | $\pm 1$ |
| Invitation/T | Epistemic | — | ∘ | • | ∘ | • | M | $+1$ |
| Tag/A | Epistemic | — | ∘ | • | ∘ | • | M | $\pm 1$ |
| Tag/T | Epistemic | — | ∘ | • | ∘ | • | M | $\pm 1$ |
| Review/A | Tribal | — | • | • | • | • | F | $\pm 1$ |
| Review/T | Epistemic | — | ∘ | • | ∘ | • | M | $\pm 1$ |
| Reference/A | Epistemic | — | ∘ | • | ∘ | • | M | $\pm 1$ |
| Reference/T | Tribal | — | • | • | • | • | F | $\pm 1$ |
| Bid/A·T | Economic | ↑ | • | • | • | • | H | $\pm 1$ |
| Send/A | Relational | ↑ | • | • | • | • | F | $\pm 1$ |
| Send/T | Minimal | — | ∘ | ∘ | ∘ | • | M | $\pm 1$ |
| Accept | Relational | ↑ | • | • | • | • | H | $\pm 1$ |
| Ratify | Relational | ↑ | • | • | • | • | H | $\pm 1$ |
| Withdraw | Minimal | — | ∘ | ∘ | ∘ | • | M | $+1$ |
| Rescind | Minimal | — | ∘ | ∘ | ∘ | • | M | $+1$ |
| Leave | Minimal | — | ∘ | ∘ | ∘ | • | M | $+1$ |
| De-invite/A·T | Minimal | — | ∘ | ∘ | ∘ | • | M | $+1$ |

Forced $+1$: Self Dec/Rep and Registration ($p_d = 1$, $p_i > 0$ by
construction); Withdraw, Rescind, Leave, De-invite/A·T (type-fixed control
records); Invitation/T (relevance $r \in [0,1]$, intensity 1). All other
types contain at least one signed user-controlled parameter.

**Coherence column, not vouch column:** $\epsilon$ is routing/coherence
parity only; vouching is decided by person-vouch eligibility reading stance
marginals — a $(-,-)$ Profile Opinion has $\epsilon = +1$ but is not a
person-vouch (it fails the strictly-positive coordinate test).

**Dispatch rule.** Leg identity is (family, leg-role), never tensor geometry:
Reference/A and Review/T, and Reference/T and Review/A, are geometric
twins by construction (the transpose); the normative census determines family
and role (`rem:nodes:edge-census-normative`).

**Act payload schema (`tbl:nodes:act-payload-schema`):** every act family
has a payload controller — its **author** — and a canonical payload (e.g.
Opinion/Affinity: rationale; Participant: participation note; Join Request:
request message; Invitation: invitation message; Accept/Ratify: terms,
receipt; Leave: parting reason; De-invite: reason; Review: reviewer
metadata + comment body; Reference: reference note; Bid: bid terms + offer
body; Send: metadata + message body; Registration: profile data). A
hyper-edge act carries **one** payload under one commitment (role-addressed
schema fields permitted, §8.4); Self Dec/Rep are derived and carry no
payload projection.

**Structural edge properties (`prop:nodes:structural-edge-properties`):**
always-active baseline with $\|\boldsymbol{\Psi}_e\|_F \ge 0.800$
(`lem:graph:non-vanishing-norm`);
$\|\boldsymbol{\Psi}_e\|_F \le 3$; full-mask edges effectively rank-2,
restricted-mask edges path-view-composable
(`prop:graph:rank-two-constraint`); active entries monotone non-decreasing
in $|p_d|, |p_i|$; polarization floor $\Psi^{11} \ge \tfrac12$; tier
separation governed by the floor ladder $\{1, \sqrt{\eta}, \eta\}$.

### 9.8 Membership, proposals, and revocation

**Proposals do not participate
(`rem:nodes:chat-proposals-do-not-participate`).** Join Request and
Invitation are proposals. They establish no membership and do not substitute
for the Participant edge. A Chat membership signal exists only when the
joining actor authors a Participant edge. Ignoring a proposal requires no
graph action.

**Canonical Membership Fold — the full paper's Layer-2 default
(`def:nodes:canonical-membership-fold`).** For actor $a$ and Chat $C$, let
$M(a,C)$ be $a$'s own Participant and Leave records toward $C$ (a
$\prec$-chain). Then
$\mathrm{member}^{(k)}(a,C) = \text{true} \iff M(a,C) \neq \varnothing$ and
its $\prec$-maximal element is a Participant. Under this default, De-invite
records are **advisory**: they enter only through a published chat/guild
policy $\mathcal{P}$ naming an authority set (published per
`subsec:deployment:completeness`). Where $\mathcal{P}$ recognizes one, the
conservative rule governs — a recognized De-invite defeats membership only if
it strictly $\prec$-follows the $\prec$-maximal element of $M(a,C)$ (a
concurrent or earlier one is inert, mirroring the epoch title fold), and a
Participant strictly $\prec$-following the De-invite re-establishes membership
unless $\mathcal{P}$ specifies ban semantics. **This fold is not part of the
L1 interface**: membership is a Layer-2 read-site, so it is CoGra's to define,
adopt, or replace — the interface fixes only the boundary (next paragraph),
never the mechanism.

**Membership is terminal (`rem:nodes:membership-is-terminal`).** No
admission rule reads $\mathrm{member}^{(k)}$ — it feeds neither the write
rule (W1/W2a/W2b), nor formation, nor settlement recognition. Two terminal
services may derive different membership from the same $E_k$ without
forking the graph (contrast title, which recognition clause (iii) reads
back). This is why Leave and De-invite append unconditionally: a
membership or authority precondition would drag membership into the
admission closure and enlarge the binding surface
(`subsec:necessity:unrestricted-departure` — "who may expel" is a terminal
policy verdict).

**Inviter Revocation (`def:epoch:inviter-revocation`).** Author $j$'s
Invitation act toward incidence (Chat $C$, Profile $P$) is **absent** from
person-vouch compilation iff the $\prec$-maximal element of $j$'s own
{Invitation, De-invite} records with that incidence is a De-invite; a later
complete Invitation re-establishes the eligible act. Suppression is
strictly per-author — it never affects another author's invitation — and is
a suppression predicate, not a parameter contribution. No control edge
enters any stance sum. "Conviction sums; consent toggles": stance bundles
aggregate with inertia, but a vouch-of-fitness is live consent, and live
consent is latest-record-wins — the same cancel-over-commit shape as
settlement's epoch-quantized consent rule. Each toggle is a priced act;
oscillation dilutes $r_j$ irrevocably.

---

## 10 Content governance metadata (PN full §9, `sec:content` — full paper only)

The closure edition names licensing / provenance metadata policies only as a
terminal-complement ledger row ("reimplement freely"). The full paper still
specifies the defaults:

Every content node carries metadata beyond the sentiment slice — licensing
terms, provenance markers, format-level attributes. **None enter any
scoring, attribution, or transport formula**; they affect actor choices
(hence topology) indirectly and one-directionally.

**License Qualifiers (`def:content:license-qualifiers`).** Attribution $a \in \{0, 1\}$
(credit requirement) and Oversight $o \in \{0, 0.5, 1\}$ (AI provenance);
severity $l_{ij} = a_i + o_j \in [0, 2]$ over the $2\times 3$ space:

$$\mathbf{L}_{ij} = \begin{pmatrix} \text{Public Domain} & \text{Conditional Disclosure} & \text{Full Provenance} \\ \text{Attribution} & \text{Conditional Attribution} & \text{Full Provenance + Attribution} \end{pmatrix}$$

Rules: licensing metadata is a per-content-node attribute, set by the
creating actor when the node enters the graph, immutable thereafter — under
Edition 4 the qualifiers are **public protocol references of the genesis
act** (`def:graph:public-protocol-reference`), retained across every
payload state; published as part of the self-sufficient record and
independently verifiable. **No Layer 1 formula consumes $l_{ij}$;
enforcement is a Layer 2 guild responsibility**
(`subsec:content:licensing`), published per the formula-completeness
invariant (App. I, `subsec:deployment:completeness`). A high $l_{ij}$ can
still act indirectly: it lowers adoption, hence betweenness centrality
$S_C$, hence a creator's guild reward $R_C$ — partially offsetting the
standing amplifier (`rem:content:license-guild-interaction`, a terminal
reward-economics consequence, not a Layer-1 formula).

**Provenance / AI oversight** (`subsec:content:provenance`): $o = 0$ no AI disclosure
required; $o = 0.5$ conditional disclosure (declared when queried); $o = 1$
full provenance (complete generation chain published alongside the record).
The spec records the qualifier but does not formalize the provenance chain
itself.

**Content-level metadata** (`subsec:content:metadata`): media type, format identifiers,
language tags, display metadata — carried on the record for rendering and
policy enforcement, consumed by no scoring or attribution formula.

**Payload governance across phases** (`rem:content:payload-governance-phases`):
every act carries a payload; a centralized-phase host may impose payload
schemas, media, and rendering rules as custody policy without changing any
Layer 1 computation; in the decentralized phase Layer 1 carries only
structural records and payload residues, so payload governance is entirely a
Layer 2 carriage/rendering concern — the licensing qualifiers are its
content-node special case.

---

## 11 Epoch machinery (how the published values are produced)

A Layer 2 consumes these values and may recompute them to audit; it may not
override them.

### 11.1 Thermodynamic boundary

**(`ax:epoch:thermodynamic-boundary`.)** Internal quantities flow undamped.
The Boltzmann factor $e^{-\beta H_\tau}$ is applied once, per edge, at the
observation boundary (via $\tilde{w}(e)$); its consumers are the raw-graph
traversals (feed ranking, the raw signed double-cover service, bridge
Channel 1). $\beta$ also enters the projected standing core $Q$ (§11.4) —
it is a binding constant, while raw damping is a terminal default.
$\beta = 2\ln 2 \approx 1.386$; maximum-entropy edges damp to $\approx 38\%$
of raw weight.

### 11.2 Commitment rate

$r_i = b_i/\max(N_i, 1)$ (`def:comparator:rate`, `eq:comparator:rate`), the
neutral source and unique exogenous input to the standing computation. Its
numerator is the **residual balance**
$b_i = B_i - \sum_a \theta^{(k_a)}$ (`def:comparator:residual-balance`,
`eq:comparator:residual-balance`): the imported frame net of the consummated
per-act $\theta$-debits, summed over actor $i$'s accepted acts $a$, each
debited at its writing-epoch price and never re-calibrated (the debit
schedule is the sole vintage object). $r_i \ge 0$, $=0$ iff $b_i = 0$;
decreasing under action ($\theta$ off the numerator, $+1$ on the
denominator), non-decreasing in $B_i$. Published per-actor scalars;
derivable from the public attestation record, the committed act count, and
the published $\theta$-debit schedule without graph traversal. The frame is
verified by recompute-and-verify-provenance, never scan-and-total
(`rem:comparator:auditability`).

**Funding is a Layer-2 freedom (`rem:gates:guild-funding`).** Nothing in
the sustaining frontier assumes who funds an actor's burn-value: a Layer-0
burn is funder-unconstrained at the surface, and the resulting $B_i$
accrues to the actor's address whoever paid for it
(`def:comparator:imported-frame`). A terminal Layer-2 community may choose,
under its own policy, to supply a member's sustaining burn — Layer 1
neither prescribes nor prices that choice (`post:transport:guild-grant`).
This relocates **who bears the source cost** without faking it: the frame
is non-transferable across addresses (`def:comparator:frame-binding`), and
funding a member's own burns raises only that member's own source. The
comparator sees a funded member exactly as it sees a self-funded one — the
burn is real either way.

### 11.3 Act folding and the base allocation matrix

**Net Stance (`def:epoch:net-stance`).** For every eligible same-author
parallel bundle $\Pi(a, s, t, f)$ (`def:graph:authored-act-bundle` —
full-incidence keys), the epoch compiler forms the effective authored
coordinates

$$\bar{p}_d^{(a \to t)} = \mathrm{clip}_{[-1,1]}\Big(\sum_e p_d(e)\Big), \qquad \bar{p}_i^{(a \to t)} = \mathrm{clip}_{[-1,1]}\Big(\sum_e p_i(e)\Big).$$

The fold is per author, family, source, target, and full incidence — it
never nets across authors ("one author's revision could erase another's
vouch", `subsec:necessity:per-author-netting`). The compiler may fold
revisions of one authored semantic incidence but may not pair independently
folded A- and T-legs, replace an A-leg with unrelated incoming weight, or
create a complete act from unmatched records. Excluded from stance
aggregation: **derived Self-edge components** (not authored records, hence
no bundle); the settlement records **Accept and Ratify** (recognition and
standing read individual records); the **control records** Withdraw,
Rescind, Leave, De-invite/A·T; and every family that resolves to its author
where the fold would otherwise be used only to create standing. Feed
ranking, raw signed traversal, CAN, title, payload display, and settlement
recognition continue to read their declared raw records or bundles — **net
stance is one input to act folding, never a mutation of the record**, and it
never merges, hides, or removes payload projections
(`prop:graph:removable-projection-invariance`).

Aggregation properties (`prop:epoch:net-stance-properties`): order-free once
the epoch record set and bundle folds are fixed; range-safe (the clip
returns parameters to the master formula's domain); **priced** (every
revision increments $N_j$, irrevocably diluting $r_j$); append-only.
Sum-then-clip is deliberate: walking back accumulated conviction costs
counter-acts in proportion to it — flip-flops are expensive, stance is
sticky (`rem:epoch:conviction-inertia`). A prior $(0.5, 0.5)$ act is
cancelled by authoring $(-0.5, -0.5)$ toward the same target: the bundle
nets to $(0,0)$ — the cell resolves home at coefficient zero and reaches no
one — and the counter-act consumed an action (one $\theta$ debit off
$b_j$): severance is burn-priced
(`subsec:verification:stance-aggregation`).

**Standing fold cells (`def:epoch:standing-fold-cell`,
`rem:epoch:compiled-acts-fold-into-cells`).** After the per-author net-stance
fold and inviter revocation, the compiler groups the accepted acts of one
**full incidence** (author, family, source, semantic target, and — for
hyper-edges — middle) into **fold cells** $\xi$, the order-free unit of
standing input. A cell's identity is the deterministic full-incidence bundle
key, not a new act identifier; a hyper-edge act is one cell, never two
(`cor:graph:standing-act-atomicity`). A cell is a derived reading: no new
act, edge projection, payload, debit, count increment, or Lamport event.
**Every accepted Actor-authored act lies in exactly one cell of the epoch's
eligible set $\mathcal{R}_k$, and every cell is weighed**
(`post:epoch:universal-act-weighing`): there is no eligibility predicate
deciding which acts bear standing and no *role: none* category. What the
folded coordinates decide is the **destination**, not whether the act counts.

**Effective act contribution (`def:epoch:effective-act-contribution`).** Each
cell carries a total coefficient $c(\xi) \in [0,1]$: the geometric mean of
the **magnitudes** of its mandatory folded coordinates —
$\sqrt{|\bar{p}_d\,\bar{p}_i|}$ (Opinion), $\sqrt{|e\,f|}$ (Reference),
$|u\,f\,r|^{1/3}$ (Invitation), $\sqrt{|c\,e|}$ (Accept/Ratify), and
likewise for the families that never resolve outward (Publish and Owner on
$a$, Affinity on $a, t$, Tag on $r, c$, Review on $e, f$, Send on $i$, Bid on
$g, u$, Join Request on $u, f$, Participant on $i, r$). Where a family's legs
carry separate coordinates the mandatory set is the **A-leg's** — a T-leg
records where an act points, not what its author felt about pointing there.
A family carrying no authored coordinate at all (Registration and the control
records) has an empty geometric mean and coefficient $1$.

Taking magnitudes is what makes the coefficient *total*: a maximally hostile
act consumes exactly as much of its author's conserved unit as a maximally
supportive one (`rem:epoch:hostility-is-priced`). Direction decides the
destination; magnitude decides the price. A cell whose stance folds to
exactly zero has coefficient zero and contributes to no entry — it was still
admitted, debited, and counted.

**Recipient resolution (`def:epoch:standing-recipient-resolution`,
`tbl:epoch:standing-recipient-resolution`).** A published, deterministic,
order-free operator sends each cell either to a person recipient or to the
author's **self-retention channel**. It resolves outward only for a cell with
strictly positive mandatory coordinates, live authored consent, author
ownership, and an **anchored** person target — the semantic target being an
Actor or the permanently bound Profile of an Actor:

| Act class | Recipient |
|---|---|
| Positive Opinion on Profile$_j$ | Actor $j$ |
| Complete positive Invitation (unsuppressed) | the invitee |
| Complete positive Reference to Profile$_j$ | Actor $j$ |
| Accept / Ratify, title-transferring under the epoch title fold | the counterparty |
| Accept / Ratify otherwise | self |
| Withdraw, Rescind, Leave, De-invite | self |
| Artifact-directed acts: Opinion-on-content, Tag, Review, Bid, Send, Publish, Owner, Participant, Registration | self |
| Hostile or zero-stance person-directed acts | self |

Self is a destination, not a defect: a self-resolved cell lands on the
diagonal of the base matrix, priced and counted like any other. The
settlement rows read the epoch title fold and nothing else
(`post:epoch:settlement-standing-title-coupling`); the revocation rows read
epoch indices with ties favouring the revocation. Syntax alone never selects
a non-self recipient — a cell whose target identifier is not anchored in the
completed set resolves home by the same rule
(`rem:epoch:allocation-index-set`), which keeps resolution and allocation
ranging over one closed index set so that no column can receive allocation
without owning a row.

**Control acts resolve to self (`rem:epoch:control-acts-resolve-to-self`).**
Withdraw, Rescind, Leave, and De-invite/A·T are accepted acts, so they are
weighed and consume their author's allocation — they simply never direct any
of it outward. De-invite is the case that makes this load-bearing: its fixed
raw parameters are positive, and treating raw positivity as regard would turn
expulsion into standing support. The family's only compilation-visible effect
on another act is **inviter revocation**
(`def:epoch:inviter-revocation`): actor $a$'s Invitation toward $(C, P)$ is
absent iff the latest epoch index in $a$'s Invitation/De-invite records for
that pair contains a De-invite, ties within an epoch favouring the
revocation, and a later Invitation re-establishing the act. The rule is
epoch-quantized rather than order-read — no standing quantity may read
host-assigned order (`post:epoch:standing-epoch-set-determinism`) — and
strictly per author. **Conviction sums; consent toggles**: stance bundles
aggregate with inertia, but a vouch-of-fitness is live consent, and live
consent is latest-record-wins.

**Base allocation matrix (`def:epoch:domain-weighted-base-allocation`,
`eq:epoch:domain-weighted-base-allocation`).** Each cell carries a published
act-level domain profile $\delta_D(\xi) \ge 0$ with $\sum_D \delta_D(\xi) =
1$, so a hyper-edge act spreads one unit across the domains of its
projections and is never double-counted (`def:epoch:standing-domain-profile`).
With published nonnegative domain weights $\omega_D$ and the published
self-retention base $\kappa_{\text{self}} > 0$
(`def:epoch:self-retention-base`), the **base allocation score** of the
ordered Actor pair $(u, j)$ is

$$\mathsf{A}_{uj} = \kappa_{\text{self}}\,\mathbf{1}_{u=j} + \sum_{\xi:\ \mathrm{src}(\xi)=u,\ \mathrm{res}(\xi)=j} c(\xi) \sum_D \omega_D\,\delta_D(\xi) \;\ge\; 0,$$

with $\mathsf{A}_{uu} \ge \kappa_{\text{self}} > 0$, so every anchored Actor
has a well-defined row even having authored nothing. **$\mathsf{A}$ is the
sole standing-relevant reading of the epoch's acts: no standing quantity
reads the Action Graph beyond it.** Reference values for both constants are
unity, pending the calibration lock.

Because each row is normalized before transport, **artifact activity crowds
out export** (`rem:epoch:artifact-activity-crowds-out-export`): acts that
resolve home land on $\mathsf{A}_{uu}$ and shrink every one of that author's
outward shares. Allocation is conserved, and there is no unallocated
remainder to draw from — publishing more concentrates the same unit on
oneself rather than spreading more regard. Carrying others is something an
Actor *spends* on, in the same unit their own activity consumes.

**Artifacts allocate nothing (`prop:epoch:artifact-non-allocation`).**
Changing raw incidence on a passive node — a Chat, Content item, Item, Type,
Comment, Message, Offer, or Profile — leaves every entry of $\mathsf{A}$
unchanged, and therefore leaves every transported share and every standing
value unchanged. This is structural, not a guard: only accepted
Actor-authored acts fold into cells, and an artifact has no row to allocate
from and no authorship to inherit. Popularity is visible to feed and bridge,
and invisible here.

Compilation properties (`prop:epoch:act-folding-properties`):
**author-owned** (every cell is sourced by the author of the complete act
that creates it); **passive-independent** (passive context identifies the act
and its semantic target but contributes no upstream standing weight);
**standing-atomic**; **record-preserving** (incomplete, hostile, suppressed,
and self-resolving records stay public and readable by every non-standing
consumer); **range-safe**; **self-inclusive**; **deterministic**. **Folding
precedes allocation** (`rem:epoch:folding-precedes-allocation`): the compiler
reconstructs complete acts, applies folds and revocations, resolves each cell,
and emits $\mathsf{A}$ — only then does anything allocate. The exclusion of
passive nodes therefore happens once, in the compiler, rather than being
re-checked at every hop.

### 11.4 Conserved standing transport (epoch-quantized, no memory)

**Proposed final epoch state (`def:epoch:proposed-final-act-state`).** Fix
a proposed write set $\mathcal{Q}_k$. For each actor $i$, the accepted-act
increment $\Delta N_i^{(k)}$ counts proposed epoch-$k$ **acts** (one binary
record, one complete hyper-edge, or one Registration each count one). With
the settled boundary burn increment $\Delta B_i^{(k)}$:

$$b_i^{(k)} = b_i^{(k-1)} + \Delta B_i^{(k)} - \Delta N_i^{(k)}\,\theta^{(k)}, \qquad N_i^{(k)} = N_i^{(k-1)} + \Delta N_i^{(k)}$$

(`eq:epoch:final-residual-balance`, `eq:epoch:final-action-count`). Prior
debit vintages stay consummated. Every standing, path,
admission-fraction, stamp, and gate quantity associated with
$\mathcal{Q}_k$ is computed from this **completed tentative state**
$E_k = E_{k-1} \cup \Delta E_k$.

**Epoch-quantized standing (`post:epoch:standing-quantization`).** Standing
is defined only for a completed epoch edge set: one simultaneous standing
result per proposed write set. No normative standing value exists after
Registration but before a vouch, after a burn but before an action, or
between same-epoch acts — everything is interpreted together at closure.
The solver's iterates toward the equilibrium are internal current-epoch
calculations; only the final certified result is published. **The preceding
epoch's standing is not an argument of any epoch-$k$ standing map**
(`post:epoch:standing-memorylessness`) — an implementation may warm-start
from it, but uniqueness of the certified fixed point makes the result
initialization-independent
(`cor:dynamics:standing-initialization-independence`,
`rem:dynamics:warm-start-independence`). Standing at boundary $k$ is a
function of the accepted epoch set, the final ledger, the epoch title fold,
and the published constants, invariant under every dependency-compliant
permutation of the act sequence
(`post:epoch:standing-epoch-set-determinism`): causal order governs record
formation, act identity, and dependency validity, but induces no intra-epoch
standing snapshot — the iterates are a numerical path, not a timeline
(`rem:epoch:causality-without-intra-epoch-standing`).

**Standing measures; it does not hold
(`post:epoch:standing-is-measurement`).** Standing is a comparison
coordinate computed over the record, never a quantity possessed within it.
No allocation, transport, tilt, or equilibrium moves, encumbers, or spends
anything an Actor owns — the ledger after the measurement is the ledger
before it. The word "transfer" in standing prose is a defect
(`rem:epoch:transport-is-not-ledger-transfer`).

**Responsive activation (`def:epoch:responsive-vouch-activation`).** In
reduced standing $x = \hat{\alpha}_i = \alpha_i/\nu$, $p(x) = x/(1+x)$, the
non-temporal normalized deployed core is $Q(p)/Q(1)$ with
$Q(p) = \sigma_{\text{sig}}(\beta p)\sqrt{\tanh p\,(1 - \eta^2 \tanh p)}$,
and the responsive per-hop standing activation is its fourth root:

$$g_{\text{vch}}(x) = \left(\frac{Q(p(x))}{Q(1)}\right)^{\gamma}, \qquad \gamma = 1/4$$

— zero at zero standing, strictly increasing, $< 1$ at every finite
standing, independent of raw maturity and entropy. Its log-gain is one
quarter of the full core gain, so every transported chain through at most
$L_{\text{hop}}$ live targets consumes at most one full-$Q$ budget. $\gamma$
is a **chartered activation exponent, not the reciprocal of a transport
depth** — its numerical coincidence with $L_{\text{hop}} = 4$ is a
coincidence, and routing one through the other is a defect.

**Safety-wall clamp (`def:epoch:safety-wall-clamped-activation`).** Every
standing evaluation uses the **effective** activation

$$\bar{g}_{\text{vch}}(x) = g_{\text{vch}}(\max(x, \rho_\theta))$$

— it reads only the *current* state: **no previous-standing input, no
externally supplied activation mode, no frozen/live/zero branches.** Below
the wall the activation is constant with zero derivative; above it,
responsive; at the wall, continuous with a generalized gain interval
(`prop:dynamics:safety-wall-clamp`). The clamp is a within-epoch analytic
device: activation does not pay $\theta$, create source, or grant
admission.

**Pair-mass conservation (`post:epoch:standing-pair-mass-conservation`,
`thm:epoch:standing-pair-mass-conservation`).** During transport each Actor
disposes of exactly **one unit** of allocation over all recipients
*including itself*. The transported quantity is the residual pair
$(b_u^{(k)}, N_u^{(k)})$. Allocating more to one recipient necessarily
allocates less to the others or to self: no transport operation creates,
destroys, or exports pair mass beyond that unit. Conservation is an
**identity of the operator**, not a property of its fixed point — every row
of the transport sums to one at every state and every tilt rung.

**Tilt profile and hop allocation (`def:epoch:standing-tilt-profile`,
`def:epoch:hop-allocation-score`, `eq:epoch:hop-allocation-matrix`).** The
chartered shape $\upsilon_r^\circ$ assigns a nonnegative exponent to each hop
$r \in \{1, \dots, L_{\text{hop}}\}$, decreasing in $r$; at accepted strength
$t_k$ the applied profile is $\upsilon_r(t_k) = t_k\,\upsilon_r^\circ$. In
reduced standing state $\boldsymbol{x}$, for $j \ne u$,

$$s^{(r)}_{uj}(\boldsymbol{x}) = \mathsf{A}_{uj}\,\bar{g}_{\text{vch}}(x_j)^{\upsilon_r(t_k)}, \qquad s^{(r)}_{uu} = \mathsf{A}_{uu},$$

the self score **unmodulated**; normalizing each row over self and all
recipients gives the row-stochastic **hop allocation matrix**
$\Lambda^{(r)}(\boldsymbol{x})$. Hop 1 is always the source-adjacent factor,
and the exponent belongs to the **transported mass, never to the row**
(`rem:epoch:mass-owner-relative-hop-order`): one author's row renders at
hop-1 strength when it apportions that author's own pair, and at hop-$r$
strength when it relays the pair of a source $r-1$ hops away.

Standing's voice is relative, and it is the **only** voice
(`post:epoch:hop-faded-responsive-tilt`,
`prop:epoch:relative-allocation-odds`): the ratio of two recipients' shares
of one source at one hop is the ratio of their base scores times the ratio of
their clamped activations raised to $\upsilon_r(t_k)$, independent of every
other entry and of the normalization. Any second modulator — a per-recipient
export fraction, a popularity factor, a recency bonus — is a violation of the
design rather than an unchartered parameter. Rivalry is conservative per row
(`prop:epoch:rival-allocation-response`): a rising recipient gains exactly
what its siblings *and the source's own retention* lose; below the safety
wall every derivative vanishes; and a row does not depend on its own owner's
standing, so standing never directly defends its own retention.

Support is fixed before the solve (`prop:epoch:standing-support-preservation`):
the clamped activation is strictly positive, so
$\lambda^{(r)}_{uj}(\boldsymbol{x}) > 0 \iff \mathsf{A}_{uj} > 0$ at every
state and rung. **Who contributes to whom is checkable from published data**,
independently of the fixed point that has not yet been computed.

**Depth mass and source emission (`def:epoch:standing-depth-mass`,
`def:epoch:source-emission`).** The published depth mass $\mathfrak{m}_m \ge
0$, $m \in \{1, \dots, L_{\text{hop}}\}$, sums to one; its deepest supported
index is $m^*$. History travels on the back of balance: the **emission
fraction** of source $u$ is

$$\mathfrak{e}_u = \min\!\left(1,\ \frac{b_u^{(k)}}{\theta\, N_u^{(k)}}\right) = \min\!\left(1,\ \frac{\hat{r}_u}{\rho_\theta}\right) \in [0, 1],$$

the source's own reduced rate measured against the safety wall and capped at
one; the exported capacity $b_u/\theta$ *is* the ledger's remaining-action
capacity up to integrality, which is why no new constant was minted to state
it. Emission is a property of the source's **pair**, never of one of its
relations — a per-recipient fraction is prohibited, because the tilt is the
sole chartered modulator of a source's relative odds.

**Finite-depth conserved transport
(`def:epoch:finite-depth-conserved-transport`,
`eq:epoch:finite-depth-conserved-transport`).** With
$\mathfrak{E} = \mathrm{diag}(\mathfrak{e}_u)$,

$$\boldsymbol{\Pi}(\boldsymbol{x}) = \mathfrak{E} \sum_{m=1}^{L_{\text{hop}}} \mathfrak{m}_m\, \Pi^{(m)}(\boldsymbol{x}) + \big(I - \mathfrak{E}\big), \qquad \Pi^{(m)}(\boldsymbol{x}) = \Lambda^{(1)}(\boldsymbol{x}) \cdots \Lambda^{(m)}(\boldsymbol{x}).$$

Emission is applied **once, to the finished mixture**: inside a hop it would
compound as $\mathfrak{e}_u^m$ and silently reprice the depth mass, and a
depleted relay must pass a solvent source's history on at full strength.
$\boldsymbol{\Pi}(\boldsymbol{x})$ is the published operator that the
mediant, the certificate, and every boundary artifact consume; $\Pi_{ui}$
replaces any notion of a per-pair standing flow. Unexported mass returns home
(`rem:epoch:emission-self-inertia`): a depleted Actor's own row weights its
own near-zero rate *more* heavily, so rehabilitation shifts from the
community toward the Actor's own ledger — a price, never a ban, since one
burn raises $b_u$, $\hat{r}_u$, and $\mathfrak{e}_u$ together. No Actor
exports more history than its present balance could pay for at today's action
price (`thm:epoch:emission-export-bound`).

**Tilt backoff (`def:epoch:tilt-backoff-grid`, `alg:epoch:tilt-backoff`).**
The accepted strength $t_k$ is the greatest element of the published finite
grid $\mathcal{G}_t$ (chartered depth $J_{\text{tilt}}$, terminating at zero)
whose certificate passes. Backoff preserves the shape exactly — a lower rung
is **the same signal at lower volume**, never a signal substitution — and
each rung is independently certified rather than inferred from a higher one.
The anchor $t_k = 0$ is the exact no-tilt allocation rule and always
certifies (`prop:epoch:no-tilt-anchor`), which is what makes the grid safely
degradable. Lowering $t_k$ reduces **discrimination among recipients**, not a
source's total non-self allocation — that quantity is emission's, on a
different axis (`rem:epoch:tilt-backoff-is-not-export-backoff`). A rung can
fail two ways and the certificate must say which
(`rem:epoch:certificate-failure-versus-indecisive-enclosure`): a
*certificate failure* proves the fence does not hold and the graph moved; an
*indecisive enclosure* proves nothing and calls for tighter interval
arithmetic, not a lower rung.

**Raw signed double-cover service (`subsec:epoch:raw-signed-service`).** The
double-cover traversal survives as a public raw-graph service for consumers
needing signed raw-path evidence (the canonical bridge-consent
calculation). It reads the sign already computed for raw ranking and **does
not compute standing** — standing and feed share neither one activation nor
one traversal (`rem:dynamics:standing-feed-separation`).

### 11.5 Final standing

**Conserved standing map and equilibrium
(`def:epoch:conserved-standing-map`,
`def:epoch:conserved-standing-equilibrium`).** The current-epoch standing map
is the transported pair mediant over the reduced source rates
$\hat{r}_u = b_u^{(k)}/(\nu\,N_u^{(k)})$, and the epoch's standing state is
its fixed point $\boldsymbol{x}^*$ on the rate-hull box $\mathcal{B}_k$,
solved once, in the current epoch, from the completed final state.

**Final epoch standing (`def:epoch:final-standing`,
`eq:epoch:final-standing-mediant`)** — that equilibrium coordinate and its
numéraire scaling, $\hat{\alpha}_i^{(k)} = x^*_i$, $\alpha_i^{(k)} = \nu\,
\hat{\alpha}_i^{(k)}$; because the conserved map is a mediant of the
transported pairs, this equals the exact post-debit balance/count **weighted
mediant**:

$$\alpha_i^{(k)} = \dfrac{\sum_u \Pi_{ui}\, b_u^{(k)}}{\sum_u \Pi_{ui}\, N_u^{(k)}} = \dfrac{\tilde{b}_i}{\tilde{N}_i}$$

The sums run over **all** sources, Actor $i$ included: every row of the
transport carries a self column, so $i$'s own pair enters its own mediant
through $\Pi_{ii} > 0$ rather than as a separate leading term. Every
contributing source has $N_u^{(k)} \ge 1$ (Registration is an accepted act);
the $\max(\cdot,1)$ guard belongs only to the published reduced rate and is
never applied to a transporting source. **Reduction theorem:** under uniform
contributing action counts the mediant reduces exactly to the rate-weighted
DeGroot average — the mediant is the normative formula, DeGroot the
reduction. **Allocation is rival per source:** a source's pair is apportioned
across targets and self, never replicated, so what one recipient gains the
siblings and the source's own retention lose. Recomputed at each boundary
from the completed final state and published in the certificate; consumed
downstream as a fixed external scalar. Standing is the straddler: binding
where the write rule reads it (through the stamps), terminal where downstream
read-sites read it.

**Properties:** (1) bidirectional response
(`prop:epoch:final-standing-response`) —
$\mathrm{sgn}(\partial\alpha_i/\partial \Pi_{ui}) = \mathrm{sgn}(r_u -
\alpha_i)$: a higher-rate source lifts, a lower-rate source dilutes, and
Layer 1 provides no target veto
(`rem:comparator:conserved-allocation-scope`); (2) hull bound
(`prop:epoch:final-standing-hull`) — $\alpha_i$ lies in the transported-rate
hull $[\min r_u, \max r_u]$ over the sources with $\Pi_{ui} > 0$, at every
state of the solve and not merely at the fixed point, and that contributing
set is fixed by the base scores and the ledger alone, so the hull is known
before the solve begins; (3) strong-embedding limit
(`prop:epoch:final-standing-embedding`) — as incoming transported action mass
dominates the own pair, $\alpha_i$ approaches the transported-mass-weighted
source average (dense-cluster fairness: the pooled leave-one-out
burn-per-action of the support base, `rem:epoch:dense-cluster-fairness`);
with zero relational flow, $\alpha_i = r_i$ exactly; (4) equal-rate
invariance (`prop:epoch:equal-rate-standing-invariance`) — if every
contributing source carries the same reduced rate, $\alpha_i$ is exactly that
rate at every state, every rung, every profile and depth mass. A community of
equal rate cannot lift itself, and no arrangement of regard inside it changes
any member's standing.

**The average standing of a closed cluster is its ledger
(`post:epoch:cluster-rate-invariance`,
`thm:epoch:closed-cluster-rate-identity`).** Call a set $S$ of Actors
*closed* when $\mathsf{A}_{uj} = 0$ whenever exactly one of $u, j$ lies in
$S$ — a property of the base matrix alone, checkable before the solve. Then
the **transported-mass-weighted** mean standing of $S$ equals $\nu$ times its
aggregate residual balance over its aggregate action mass, at every state of
the solve. The weighting is mandatory: the identity holds for the
$\tilde{N}_i$-weighted mean only, and any restatement that drops the weight
is false. Standing transport within a closed community is purely
distributive — no internal arrangement of regard, tilt, or transport may
raise or lower what the community's ledger can back. Exact closure is a
limit, not a field condition: a boundary carrying base-allocation weight at
most $\varepsilon$ in each direction leaks proportionally to $\varepsilon$
times the rate spread across it (`cor:epoch:cluster-rate-leakage`). This is
also the criterion for admissibility: a rule that **deletes** pair mass
detaches a cluster's mean from its ledger and is inadmissible; one that
**relocates** unexported mass into its owner's own row preserves the identity
verbatim, which is exactly what source emission does
(`cor:epoch:conserving-source-root-criterion`).

**Full-pair source transport is a current nonclaim
(`rem:epoch:full-pair-source-transport`).** The mediant transports the
*full* current source pair $(b_u^{(k)}, N_u^{(k)})$ with no source-root
attenuation: a depleted source ($b_u = 0$) contributes zero numerator but
positive denominator count — pure denominator ballast through an otherwise
valid path. This is priced, visible, and hull-bounded, but the
specification makes **no** claim that every unit of relational standing
pressure is continuously backed by positive current residual balance;
replacing full-pair transport with a source-root eligibility rule is an
open question (`frontier:source-root-eligibility`,
`frontier:depleted-source-ballast`).

**Dilution cost (`prop:epoch:dilution-cost`):** coordinated low-rate
endorsement is $\theta$-priced exactly — each ballast action debits
$\theta$, sustained dilution pressure of $n$ endorsers costs $n\theta$ per
epoch-action, and total grip is bounded by spent balance$/\theta$
(capacity per reserve unit $= 1/\theta \approx 18.94$ at the chartered
value): grip is rented, not owned. Amplification by multiplicity is closed by
conservation rather than by any per-path rule — a source apportions one unit
however many acts it authors, so additional acts redistribute that unit
instead of adding to it. Griefing is bounded by four independent constraints
(`rem:epoch:griefing-resistance`): only acts their author authored enter that
author's row; every act is priced and count-dilutive; outward allocation is
one conserved unit; and what a depleted history can export is bounded by what
its author presently stakes. A low-rate source may still dilute a target
within the rate hull — attributable and priced, not impossible.

**Rate parking (`rem:epoch:rate-parking`):** a parked actor below the wall
is **wall-clamped** — its projected activation fixed at the wall value with
zero standing derivative; below-wall incoming source may still change its
standing, but the target's standing does not recursively strengthen its own
activation while below the wall; each parked endorsement action still pays
its $\theta$. Parking is priced, visible, wall-clamped — no longer a
certificate hazard.

Within the epoch, standing is a fixed-point solve, not an orbit
(`subsec:epoch:within-epoch-standing-solver`). The resolution is uniform
rather than regional: the rate hull is invariant with no certificate at all
(`thm:dynamics:conserved-standing-existence`); a valid certificate
$\mathcal{K}_k$ makes the fixed point unique on it and every orbit converge
geometrically (`thm:dynamics:certified-conserved-standing-uniqueness`,
`thm:dynamics:within-epoch-fixed-point-convergence`); and the solution does
not depend on where the solver started
(`cor:dynamics:standing-initialization-independence`). The orbit and
bifurcation apparatus of the earlier scalar regime is quarantined as
non-normative (`subsec:dynamics:quarantined-residuals`).

**Monotonicity in burn is claimed only at the anchor
(`prop:epoch:no-tilt-commitment-monotonicity`).** At $t_k = 0$ the transport
is state-independent and a burn raises the standing of everyone the burner's
allocation reaches, including the burner. At $t_k > 0$ **no such claim is
made**: the transport then depends on the state it is used to compute, and
whether final standing is monotone in an underlying burn is open
(`frontier:tilted-monotonicity`). Terminal reward monotonicity in the
*published* standing input is a separate retained property and does not
discharge this one.

### 11.6 Epoch boundary, the final act sequence, and the raw reading

**Epoch act budget (`def:epoch:epoch-act-budget`).** The epoch target
$N_{\text{epoch}}$ is denominated in **accepted authored acts**:
$|\mathcal{Q}_k| \le N_{\text{epoch}}$. A binary act, a complete
hyper-edge act, and a Registration each consume one unit; a hyper-edge's
two projections consume no independent units. The projected edge increment
$\Delta E_k$ satisfies $|\mathcal{Q}_k| \le |\Delta E_k| \le
2|\mathcal{Q}_k|$ and is not the admission budget.

**Final-set closure (`post:epoch:final-act-sequence-closure`).** An epoch
closes at the earliest moment at which either the host determines the write
set fills the target and the published minimum duration has elapsed, or the
published maximum duration has elapsed. At close the host fixes the
authoritative ordered act sequence $\mathcal{Q}_k$ and writes its record
projection — a union of dependent sets, each valid: (i) formation-valid,
every member's author clearing W1 and W2a individually; (ii) every member
clearing the safety stamp individually; (iii) the epoch door clearing W2b,
computed **once over the complete final union** — the order is used only
for dependency formation and authoritative placement; W1/W2a/W2b,
standing, and the ledger are evaluated once on the completed final union,
and no prefix of $\mathcal{Q}_k$ carries a normative standing value.
**Selection among valid ordered sequences is host discretion** (the spec
fixes the constraints, not the algorithm); the certificate publishes the
ordered dependent-set partition so validity is replayable, and the chosen
sequence, once published, is the agreed $\mathcal{Q}_k$. Conflict
recognition reads only membership and epoch, never residual sub-epoch
order. The epoch's **regime** is certificate-derived: *binding* iff
$|\mathcal{Q}_k| = N_{\text{epoch}}$, *slack* otherwise. Binding-regime
statistics are boundary-side data; no unit-level $\nu$-side formula may
consume them (`rem:epoch:admission-statistics-quarantine`).

**Final epoch edge set (`post:epoch:final-edge-set`).** $E_k = E_{k-1} \cup
\Delta E_k$ — monotone by construction, causally closed by the dependency
closure, satisfying `post:introduction:epoch-edge-set` with no appeal to
any global position coordinate. Commitment rates are computed from $B_i$
and $N_i$ accumulated within $E_k$; the boundary burn state is provided
alongside, sampled at the settlement-stability depth $\delta_{\text{pos}}$
— which buffers the *burn snapshot*, not edge membership. Any participant
accepting the same $E_k$ (and $\mathcal{Q}_k$) reproduces every epoch-$k$
quantity from the published constants alone.

**Log position (`def:epoch:log-position`).** $\mathrm{pos}(e)$, the
zero-based rank under the identity-key order $\prec^*$ (lexicographic
$(\mathbb{T}^{\text{act}}, \mathrm{author}, \mathrm{src}, \mathrm{tgt})$,
refining the authoritative order), survives only as a deterministic
**audit coordinate**: epoch membership is the closure rule's, and no
scoring, recognition, or boundary quantity consumes it. $\prec^*$ retains
exactly one consumer — an optional audit tie-break within the
authoritative order.

**Raw Self-edge reading (`def:epoch:raw-self-edge-reading`).** After final
standing is published, the raw Declaration/Reputation reading is derived
for raw consumers (§9.4): Möbius image of final reduced standing, tenure
maturity, placed at the boundary slot — **no freeze, no previous-standing
memory, no below-wall branch**. It has no effect on standing.

**Epoch-$k$ conserved standing computation
(`alg:epoch:conserved-standing-computation`):**

```text
 1: Input: proposed 𝒬_k, settled boundary burn state, E_{k−1}, constants
 2: Validate formation + dependent-set closure
 3: Form tentative E_k = E_{k−1} ∪ ΔE_k          (def:epoch:proposed-final-act-state)
 4: Apply all count increments and θ-debits; reject if any b_i^(k) < 0
 5: Fold every accepted act into cells, resolve each recipient, form 𝖠
                                                  (def:epoch:standing-fold-cell,
                                        def:epoch:domain-weighted-base-allocation)
 6: Read emission fractions 𝔢_u and contributing widths from 𝖠 + the ledger
                                                  (def:epoch:source-emission)
 7: For each rung t of 𝒢_t, greatest first: evaluate 𝒦_k over ℬ_k;
    break when m_θ·𝒦_k ≤ 1                       (alg:epoch:tilt-backoff)
 8: Solve the unique equilibrium x* at the accepted rung t_k
                                    (thm:dynamics:certified-conserved-standing-uniqueness)
 9: Compute transport entries Π_ui and final standing α^(k)
                                     (def:epoch:finite-depth-conserved-transport)
10: Compute final act stamps, epoch stamp, door headroom
                                                  (def:epoch:final-act-stamps)
11: Check W1, W2a, W2b                             (post:epoch:final-act-sequence-write-rule)
12: Derive the raw Self-edge reading               (def:epoch:raw-self-edge-reading)
13: If all conditions pass: accept 𝒬_k, publish E_k + the standing package
    with the accepted rung and 𝒦_k; else reject — no standing is published for it
```

**Epoch Replay Determinism (`prop:epoch:epoch-replay-determinism`).** Given
$E_k$, the boundary burn state, the debit schedule, the published
constants, the projection-compiler version, and the declared certificate
procedure, the entire epoch-$k$ derivation — rates, eligible relations,
coefficients, envelopes, admission fractions, final flow, final standing,
title, the raw Self-edge reading, activations, stamps, headroom, and stage
certificates — is deterministic: a function of the authoritative order
$\mathcal{Q}_k$ (`lem:graph:ordered-replay-determinism`), invariant under
every payload state.

### 11.7 The θ-debit ledger and the two-gate write rule

**θ-Debit (`post:epoch:act-debit`, `subsec:epoch:act-debit`).** Each
accepted act by actor $i$ in epoch $k$ debits its residual balance and
increments its count:

$$b_i \mathrel{-}= \theta^{(k)}, \qquad N_i \mathrel{+}= 1.$$

A hyper-edge is one act: one $\theta$, one stamp. The debit is consummated
at the writing epoch's price and **never re-calculated** (the sole vintage
object). $\theta$ is the **only** debited object — no gate, door, stamp, or
average moves a balance. **Capacity *is* the balance:** remaining actions
$= \lfloor b_i/\theta \rfloor$, restored immediately by burning. Standing
prices nothing and no per-epoch capacity object is derived. Two samplings
coexist by design (`rem:epoch:two-action-counts`): boundary pairs feed
stamps and standing; live pairs feed W1. **Translation law
(`prop:epoch:translation-law`):** at fixed endorsement weights and uniform
$\theta$-history, post-debit standing $=$ pre-debit standing $-
\rho_\theta\nu$ (reduced: rigid translation by $\rho_\theta$), exact.

**Final-Set Write Rule (`post:epoch:final-act-sequence-write-rule`,
`subsec:verification:two-gate`).** See §7.1 — W1 solvency (debited,
continuous, own-balance-only); W2a individual final stamp $\ge \rho_\theta$
(never averaged); W2b act-weighted epoch stamp $\ge \rho_{\text{eff}}$ with
the act budget (never debited; band actors enter on door headroom).

**Final standing stamps (`def:epoch:final-act-stamps`).** Every epoch-$k$
act authored by $i$ receives the same final action stamp — the reduced
final standing $\rho_{\text{act}}(q) = \hat{\alpha}_i^{(k)}$. The stamp is
**act-owned**: a hyper-edge act carries one stamp (serialized copies beside
both projections are caches counted once in W2b); there is no special
Registration branch. The act-weighted epoch stamp is
$\rho_{\text{ep}}^{(k)} = \sum_i \Delta N_i^{(k)}\hat{\alpha}_i^{(k)} /
\sum_i \Delta N_i^{(k)}$ (`eq:epoch:final-epoch-stamp`), vacuous on empty
epochs; the epoch headroom is $H_k = \sum_i \Delta N_i^{(k)}
(\hat{\alpha}_i^{(k)} - \rho_{\text{eff}})$
(`eq:epoch:final-epoch-headroom`). Measurements, never floors; stamps are
never debited. Door headroom is certificate-derived **(L1·verify)** — a
congestion diagnostic consumed by no formula, never a price, never an
actuator.

### 11.8 The price and the ρ-family floors

One price runs the whole height, and a family of derived floors divides the
roles a single threshold would otherwise conflate
(`subsec:epoch:floor-governance`). The mantra: **ν joins, θ debits, ρ_pol
admits, m_θ margins; ρ_θ walls, ρ_eff doors, and the stamps measure.** Two
axes, never conflated — the **price axis** ($\nu$, $\theta$) and the
**gate/position axis** ($\rho_{\text{pol}}, \rho_\theta, \rho_{\text{eff}}$).

Price axis:

- **Numéraire $\nu$ (`def:comparator:numeraire`).** The sole reserve→action
  unit and the reserve-economy↔action-economy join; every reserve-denominated
  input is divided by $\nu$ before it meets a count (the $\theta$-debit
  applies this join per act). Governs the reduction and the stability
  operating point — structural; moving it is a *migration event*, not a dial
  turn.
- **Safety price $\theta$ (`def:epoch:safety-threshold`).** The per-act
  **debited** price and the minimum attestation price behind a write the
  coupled dynamics certifiably tolerate (reserve/action). The **only** debited
  object (W1). **An algorithmic output of the epoch computation, never a host
  input** — certificate $k$ carries $\theta^{(k+1)}$ (one-boundary lead),
  governed by requirements R1–R7 (derivability, sufficiency, step-boundedness,
  hysteresis, lead, publication, declared covariance); the algorithm is a
  calibration deliverable. Chartered interim rule
  $\theta^{(k+1)} = \nu\,\lambda_Q^{-1}\!\big(1/(m_\theta\, W_{\text{loc}}^{(k)})\big)$
  with **margin factor $m_\theta = 5/4$** (fence slack
  $\mu = 1 - 1/m_\theta = 0.20$; R3 per-boundary step bound; R4 Schmitt
  hysteresis; escalation to $m_\theta = 1.5$ if p95 one-boundary
  $W_{\text{loc}}$ growth exceeds $\sqrt{m_\theta} = 1.118$).

Gate axis (the five-ρ family — three floors plus two stamps):

- **Policy floor $\rho_{\text{pol}}$ (`def:epoch:policy-floor`).** The host's
  dimensionless standing dial against spam/Sybil pressure. Announced at
  boundary $k$, effective at $k+1$, persisting until re-announced. Purely
  extensive: it excludes, but cannot reprice a survivor's actions. Canonical
  default $1$.
- **Safety floor $\rho_\theta = \theta/\nu$ (`def:epoch:safety-floor`) — the
  wall.** The gate-axis image of the per-act price. Binding read-sites:
  the **W2a** comparator, the **below-wall activation clamp key**
  (`def:epoch:safety-wall-clamped-activation`), and the width fence pin
  $\lambda(\rho_\theta)\,W_{\text{loc}}\,m_\theta = 1$.
- **Effective floor $\rho_{\text{eff}} = \max(\rho_{\text{pol}}, \rho_\theta)$
  (`def:epoch:participation-floor`) — the door.** Derived, not dialed; $=
  \rho_{\text{pol}}$ on every valid certificate (the $\max$ is fault
  totalization with *safe polarity* — a mispublishing pipeline can only
  over-floor, never under-floor). Read-sites: the **W2b** door and the
  per-act door benchmark $\rho_{\text{eff}}\nu$
  (`cor:epoch:universal-burn-benchmarks`).
- **Action stamps $\rho_{\text{act}}, \rho_{\text{ep}}$
  (`def:epoch:final-act-stamps`).** The standing-derived **measurements** the
  write rule gates: the act-owned reduced final standing at W2a, and its
  act-weighted mean at W2b. Measurements, never floors; never debited.

**Certificate validity (`eq:epoch:floor-validity`).** A certificate is valid
only if $\rho_{\text{pol}} \ge \rho_\theta$ (equivalently
$\rho_{\text{pol}}\,\nu \ge \theta$) at the values in force — the one
sanctioned meeting of the two axes. An announcement violating it against the
led $\theta^{(k+1)}$ is invalid at publication: a formula constraint on the
dial, not a discretion.

**Reduction Convention (`post:epoch:reduction-convention`).** Every dynamical
and routing quantity — the bond kernel $p_i = \alpha_i/(\nu + \alpha_i)$, the
activation, the gain, the stamps — is $\nu$-reduced. $\rho_{\text{eff}}$
appears in the door and the per-act door benchmark; $\rho_\theta$ in the
below-wall activation clamp and W2a. Standing enters admission only through
the stamps, gated against these floors.

**Host authority (`rem:epoch:operator-authority-floor`).** The host's entire
floor authority is the $\rho_{\text{pol}}$ schedule — announced with
one-boundary lead, valid only above the led safety threshold, auditable ex
ante. $\theta$ and $\nu$ are not host dials ($\theta$ is algorithmic, $\nu$ a
migration constant). The safeguard remains visibility: the full formula is
public, so any participant can compute the economic consequence of any
value. The dials lock only after empirical calibration.

**Recoinage (`prop:epoch:compensation`, `rem:epoch:capacity-crush`).** Under
$(\nu, \rho_{\text{pol}}) \to (c\nu, \rho_{\text{pol}}/c)$ the door product
$\rho_{\text{pol}}\nu$ (admission set, per-act door benchmark) is invariant,
the gate axis $\{\rho_{\text{pol}}, \rho_{\text{act}}, \rho_{\text{ep}}\}$
is exactly invariant (stamps and floors co-scale), and reduced quantities
scale by $1/c$; W1/W2a are $\theta$-mediated per the R7 declaration. The
historical capacity-crush is dissolved: the retroactive repricing branch
was deleted by the $\theta$-debit ledger — a consummated debit is never
re-calculated, so there is **no frozen stock to crush**. The door product
is no longer an independent charter surface; the host publishes
$\rho_{\text{pol}}$ and the effective floor is derived by the safety clamp
(`rem:epoch:dial-scope`).

---

## 12 Consumer map

| Quantity | Closure consumer | Notes |
|---|---|---|
| $\epsilon(e)$, $\epsilon(p)$ | raw signed double-cover service (`alg:epoch:double-cover-bfs`), feed ranking | parity routing; coherence bit, never a favor bit; **terminal formula** — no standing read-site |
| $\lvert\det \boldsymbol{\Psi}_e^{[P]}\rvert^{1/2}$ | $\tilde{w}(e)$ | coherence factor |
| $\mathbb{T}^{\text{act}}_q$, $\tau_e$, $H_\tau(e)$ | act time: authoritative order + formation + boundary replay; $\tau_e, H_\tau$: $\tilde{w}(e)$ | act time is closure; raw maturity and entropy are terminal (feed/bridge only) |
| causal parents, declared dependencies | formation rule; authoritative-order compliance ($\mathrm{DepOK}$); causal closure of $E_k$ | backward-only metadata; never a scoring input (the $\tau$-farming lint) |
| handshake objects ($C^{\text{pre}}_q$, verified act, approval witness) | formation — only approved verified acts are orderable | fraud proofs are verification evidence |
| $\tilde{w}(e)$ | raw-graph traversals: feed ranking, the raw signed double-cover service, bridge Channel 1 | **one raw formula for all raw-graph consumers**; the formula itself is a terminal default (§3); standing is not a raw consumer |
| stance marginals $p_d, p_i$ | person-vouch eligibility (folded coordinates); settlement-adjacent stance reads | stance gates the person-vouch; terminal stance consumers named in the ledger |
| folded relations $\xi$, coefficients $c(\xi)$ | standing projection → mediant → gate | the relation layer (§11.3) |
| $\bar{g}_{\text{vch}}(x)$ | every direct relation weight in the standing solve | wall-clamped; below-wall constant |
| envelopes, admission fractions $t_k^{[h]}$, stage equilibria, row certificates | select the certified stage → final flow → standing → W2 | binding intermediate values, not straddlers |
| $W_{\text{end}}^{(k)}(u \to i)$ | the standing mediant | sole relational input to standing |
| settlement references | recognition clauses (i)–(ii); forced handshake chain | act-identity resolution |
| ownership thread | title certificate; recognition clause (iii) | title as straddler |
| $\mathrm{owner}^{(k)}$ | recognition clause (iii) | terminal routing/display read it downstream |
| payload structural witness | act integrity; removable-projection invariance | (L1·verify) — retained by Layer 1 across phases; bytes never read by Layer 1 |
| terminal complement | — | feed, reward, attribution, bridge transport, identity association, payload rendering, licensing, membership policy, raw scoring formulas: named only in `tbl:symbols:boundary` |

---

## 13 Deployment invariants (`app:deployment`)

Apply in both deployment phases; what changes is the consequence of failed
verification, not the specification. Seven invariants bind the closure
surface; the full paper's `app:deployment` additionally documents seven
terminal / Layer-0-side invariants (client-reproducible feed ranking,
device-local computation scope, concealment-entropy custody, auditable
terminal centrality, attribution-view insulation of CAN enrichment,
maturity-announcement irrevocability, time-locked supply auditability)
reproduced by their own owners.

- **Continuous Public Availability of Graph State
  (`subsec:deployment:public-availability`).** Every edge record —
  endpoints, author, parameters, domain, the inherited act time, **payload
  witness**, and the fields needed to recompute determinant magnitude,
  determinant sign, and damped weight — is available to any participant at
  any time without access control. Availability applies to the structural
  record and the retained payload residue — the witness
  (`rem:graph:act-payload-custody-phases`); full payload bytes are
  available only while in full projection, and Layer-1 verification never
  requires them. For standing, edge availability alone is insufficient: the
  verifier must also determine that no accepted complete act was omitted —
  allocation-input completeness
  (`prop:deployment:allocation-input-completeness`) and the public declared
  inputs and formula editions supply that binding.
- **Final Epoch State Agreement
  (`subsec:deployment:final-epoch-state-agreement`).** At each boundary the
  operator publishes the authoritative ordered act sequence $\mathcal{Q}_k$
  and its record projection, the monotone edge set $E_k$; any participant
  accepting $\mathcal{Q}_k$ replays identical epoch results. **Agreement on
  the ordered sequence is required — agreement on the edge set alone is
  insufficient**, since acts the host may place in either order yield
  order-dependent results. (Supersedes the pre-Edition-4 epoch-edge-set
  agreement invariant.) The act identifier exposes equivocation rather than
  absorbing it: distinct records claiming one act identifier fail formation.
- **Immutability of Published Records (`subsec:deployment:immutability`).**
  Once an edge record or ledger entry is published, its structural fields
  cannot be silently altered. Changes require new acts.
- **Public-Object Replay (`post:deployment:public-object-replay`).** Binding
  Layer-1 objects are identified by their public structural identities and
  verified by deterministic replay from: accepted acts, the final ledger,
  published constants, and formula editions. **Layer 1 assigns no normative
  meaning to a hash, Merkle root, source digest, manifest digest, proof-tree
  root, or content-addressed locator** — such values may serve indexing,
  caching, transport, or storage integrity, but they do not alter the
  mathematical object, select among valid objects, or substitute for replay.
- **Transparency of Protocol Constants and Formulas
  (`subsec:deployment:transparency-of-protocol-formulas`).** The network
  protocol constants ($\beta, \eta, q, \nu, \rho_{\text{pol}}, \theta,
  m_\theta, N_{\text{epoch}}, \delta_{\text{pos}}, L, L_{\text{vch}},
  M_{\text{payload}}$), the derived effective floor $\rho_{\text{eff}}$,
  the published boundary triple (target size, min/max durations), the
  derived raw constants ($\tilde{w}_{\text{spam}}, \tilde{w}_{\max},
  \tilde{w}_{\max}^{\text{Op}}$), **and the standing-census, complete-act
  compiler, coefficient, projected-activation, path-selection, allocator,
  mediant, scalar-encoding, and certificate formula editions** are known to
  all clients and do not change without clients being able to detect the
  change and invalidate affected cached computations before it applies.
  Layer-0 constants are surfaced through `PA-` labels and owned by Layer 0.
- **Self-Sufficient Edge Record (`subsec:deployment:sufficiency`).** The
  published record for each edge contains exactly the fields required to
  recompute $\tilde{w}(e)$, $\epsilon(e)$, the CAN base value, and the
  identity key used for canonical boundary placement; the server's scoring
  and boundary computations depend on no unpublished field. The record
  splits into a structural part — sufficient for every Layer-1 computation
  — and a payload part (state and witness) sufficient to verify carriage;
  the structural part alone supports full replay. Derived edges add no
  record fields. For a hyper-edge leg, the record also contains its role
  and sibling identity, so complete-act identity is independently
  reconstructible.
- **Independent Reproduction of Conserved Standing
  (`subsec:deployment:conserved-standing-reproducibility`).** Every binding
  input, intermediate value, validity verdict, and output of the conserved
  standing package (`def:network:conserved-standing-package`) is
  independently derivable from $E_k$, the completed final ledger, and the
  published constants and formula editions. **No server-maintained
  allocation counter, hidden recipient assignment, unpublished tilt rung,
  private model weight, or uncommitted certificate box may enter standing.**
  The replay sequence: derive final balances and counts → reconstruct
  complete acts → apply folds and revocations → cell coefficients and
  recipient resolution → assemble the base allocation matrix → read emission
  fractions → evaluate the certificate down the tilt grid → solve the
  equilibrium and the transport → recompute the mediant → derive final
  standing, stamps, and W2 decisions. Allocation-input completeness and
  dynamic safety are orthogonal checks
  (`rem:deployment:completeness-safety-orthogonal`); a valid package
  requires both.
- **Formula Completeness (`subsec:deployment:completeness`).** The published
  material — protocol constants; edge-type specifications and census; tensor
  pipeline; path-view extraction; mask and tier rules; determinant sign and
  damped weight; **net stance, cell coefficients, recipient resolution,
  domain weights, activations, the tilt grid and emission rule, control-act
  self-resolution and inviter revocation**; the **write rule (W1/W2a/W2b),
  closure rule, formation rule + handshake, and the θ-debit ledger**;
  settlement recognition and the **epoch title fold**; the conserved
  derivation sequence and certificate definitions; the
  safety-price/five-ρ-floor family — is jointly sufficient to reproduce the
  server's output from published records alone. Terminal mechanisms are not
  part of this invariant; **if a terminal service publishes a mechanism,
  the grant requires that terminal mechanism's own completeness** — a guild
  that reimplements a terminal default publishes its own complete
  specification in its place.

Outside these (terminal or Layer-0-side, reproduced by their own owners):
feed ranking, device-local computation scope, centrality certificates, CAN
attribution-view insulation, and the Layer-0 preservation properties (the
immutability invariant covers ledger entries).

---

## 14 Symbol ledger (Layer-1-tagged objects)

Tag semantics (`app:symbols`): **(L0·input)** originates below the
comparator seam, cited never authored; **(L1·closure)** at least one
read-site — output or validity verdict — re-enters admission; **⋆** marks a
straddler; **(L1·verify)** evidence for reproducing or checking a closure
output, consumed by no formula; **(L1·by-product)** a non-normative host
convenience, recomputable from the certificate; **(—)** layer-independent
shared mathematics. **No (L2) object appears in the symbol index — terminal
objects live only in the boundary ledger** (§3).

### 14.1 Kernel

| Symbol | Definition | Ref |
|---|---|---|
| $B_i$ | The imported frame, fiber-wise: $B_i := A_{\mathrm{key}(i)}$, the network's reading of the Layer 0 attestation map. Non-decreasing at sampling depth, publicly auditable, irrevocable. | `def:comparator:imported-frame` |
| $B_{\max}$ | Bootstrap capacity bound $B_{\max} := A_{\max}$. | `def:comparator:bootstrap-capacity` |
| $q$ (act) | Authored act: the atomic public record — unit of formation, admission, ordering, dependency declaration, action counting, θ-debit, and final-set authorship. | `def:graph:authored-act` |
| $\mathrm{actid}(q)$ | Act identifier $\mathsf{act}(\mathrm{author}, s_q, \mathrm{family})$; no host time, no minted target; mints nodes as $\mathsf{mint}(\mathrm{actid}(q))$. | `def:graph:act-identifier` |
| $\mathrm{edges}(q)$, roles | Edge projection of an act (one binary edge, or A + T); a projection owns only incidence, role, and rendering. | `def:graph:act-edge-projection` |
| $\mathcal{Q}_k$ | Authoritative ordered authored-act sequence of epoch $k$; positions published; the agreed object. | `def:graph:authoritative-act-order` |
| $E_k$, $\Delta E_k$ | Epoch snapshot edge set $E_{k-1} \cup \Delta E_k$; the record projection of $\mathcal{Q}_k$; substrate of all of $\mathcal{A}$. | `post:epoch:final-edge-set` |
| $\mathbb{T}^{\text{act}}_q$ | Authoritative logical time: act-owned finalization metadata; the causal key is the pair $(\mathbb{T}^{\text{act}}_q, \mathrm{pos}_k(q))$. | `ax:graph:act-causality`, `def:graph:act-incidence-causality` |
| $\prec$ (L1·closure), $\prec^*$ **(L1·verify)** | Authoritative-order precedence; identity-key refinement (audit tie-break only). | `def:graph:authoritative-act-order`, `def:epoch:log-position` |
| $C^{\text{pre}}_q$, $V_q$, $\sigma^{\text{app}}_q$ | Proposal pre-commitment, host-sealed verified act, and approval witness of the admission handshake. | `def:graph:proposal-pre-commitment`, `def:graph:verified-act`, `def:graph:approval-witness` |
| $\mathrm{deps}(q)$, dependency commitment | Actor-authored removable dependency projection and its retained binding commitment; tombstonable, reopenable for fraud proof **(L1·verify** when opened**)**. | `def:graph:act-dependency-projection`, `def:graph:ordering-fraud-proof` |
| $\nu$ | Numéraire: the sole reserve→action unit and reserve-economy↔action-economy join (applied per act by the θ-debit); bond-kernel denominator. Structural; moving it is a migration event. | `def:comparator:numeraire` |
| $\rho_{\text{pol}}$ | Policy floor: the host's dimensionless gate-axis dial; announced at $k$, effective at $k+1$; valid iff $\rho_{\text{pol}}\nu \ge \theta$. Canonical default $1$. | `def:epoch:policy-floor` |
| $\theta$ | Safety threshold (reserve/action): the minimum attestation price behind a write the coupled dynamics tolerate. Algorithmic per-epoch output (R1–R7), one-boundary lead; never a host input. | `def:epoch:safety-threshold` |
| $\rho_\theta$, $\rho_{\text{eff}}$ | Safety floor $\theta/\nu$ (the wall: W2a, the activation-clamp key, the fence pin) and effective floor $\max(\rho_{\text{pol}}, \rho_\theta)$ (the door: W2b, the per-act door benchmark). | `def:epoch:safety-floor`, `def:epoch:participation-floor` |
| $m_\theta$ | Chartered margin factor $5/4$: contraction-certificate margin (a rung certifies iff $m_\theta\,\mathcal{K}_k \le 1$), fence slack, escalation clause. | `def:epoch:safety-threshold` |
| $\beta$, $\eta$ | Inverse temperature $2\ln 2 \approx 1.386$; bleed $0.05$ — binding (both enter the deployed core $Q$). | `ax:epoch:thermodynamic-boundary`, `def:graph:path-view-extraction` |
| $N_{\text{epoch}}$ | Epoch **target** act budget, denominated in accepted authored acts. | `def:epoch:epoch-act-budget` |
| $\delta_{\text{pos}}$ | Burn-snapshot buffer (settlement-stability depth); buffers the burn snapshot, not membership. | `post:epoch:final-edge-set` |
| $M_{\text{payload}}$ | Maximum payload byte length **per act** (aggregate over a hyper-edge's projections); the structural bound is L1·closure, payload bytes terminal. | `def:graph:act-payload-projection` |
| $L_{\text{hop}}$, $\gamma$ | Chartered transport depth 4, in hops of the conserved transport; and the chartered activation exponent $1/4$, which is deliberately not routed through it. | `def:epoch:standing-depth-mass`, `def:epoch:responsive-vouch-activation` |

### 14.2 Rules

| Symbol | Definition | Ref |
|---|---|---|
| write rule | $W1{:}\,b_i \ge \theta$ (debited); $W2a{:}\,\rho_{\text{act}}(q) \ge \rho_\theta$ (individual, act-owned stamp); $W2b{:}\,\rho_{\text{ep}} \ge \rho_{\text{eff}}$, $\lvert\mathcal{Q}_k\rvert \le N_{\text{epoch}}$ (averaged). Final-set evaluation. | `post:epoch:final-act-sequence-write-rule` |
| closure (write) | Host fixes the authoritative ordered act sequence and writes its record projection; a union of dependent sets within the target budget; selection touches membership only. | `post:epoch:final-act-sequence-closure` |
| formation | Act well-formed over the identifier algebra, endpoint typing, asserted parents, dependent sets, and the approval handshake; only Registration carries fresh grounded endpoints. | `def:network:admission-closure` |
| $\mathcal{S}$ | Recognized settlement triple of acts (Bid, Accept, Ratify), clauses (i)–(vi); function of the epoch partition and the reference-forced chain. | `def:graph:settlement-recognition` |

### 14.3 Straddlers

| Symbol | Definition | Ref |
|---|---|---|
| $\alpha_i$ | Final epoch standing: the comparator realized on the graph, gauge fixed by the neutral source; the conserved equilibrium coordinate = the exact post-debit balance/count mediant under the conserved transport. Binding where the gate reads it (through the stamps); terminal read-sites read it downstream per the ledger. Bounded in the contributing-rate hull. Enters the raw Self-edge reading via $p_i = \alpha_i/(\nu+\alpha_i)$. | `def:epoch:final-standing` |
| $\mathrm{owner}^{(k)}$ | Title certificate $\text{Items} \to V_u \cup \{\varnothing\}$; recognition reads it, terminal services may read it. | `def:graph:title-certificate` |

"The only straddlers are $\alpha_i$ and $\mathrm{owner}^{(k)}$." The standing
package's intermediate values are binding but not straddlers (§2).

### 14.4 Closure

| Symbol | Definition | Ref |
|---|---|---|
| $r_i$ | Neutral source $b_i/\max(N_i,1)$; the unique exogenous input to the standing computation; derivable from the public ledger without traversal. | `def:comparator:rate` |
| $N_i$ | Cumulative act count; non-decreasing; irrevocably incremented by every accepted act. | — |
| $b_i$ | Residual balance $B_i - \sum_a \theta^{(k_a)}$ (imported frame net of consummated per-act debits, each vintage-frozen); numerator of $r_i$ and the object of W1. | `def:comparator:residual-balance` |
| $b_i^{(k)}, N_i^{(k)}$ | Proposed final post-debit pairs of the completed tentative state — the standing inputs. | `def:epoch:proposed-final-act-state` |
| $\bar{p}_d, \bar{p}_i$ | Net stance of a same-author full-incidence bundle: sum-then-clip to $[-1,1]$; standing projection only. | `def:epoch:net-stance` |
| $\xi$, $\mathcal{R}_k$, $c(\xi)$ | Standing fold cell (one accepted Actor-authored act folded with its full-incidence bundle), the epoch's eligible cell set, and the cell's total effective coefficient — the geometric mean of the **magnitudes** of its mandatory folded coordinates, in $[0,1]$. | `def:epoch:standing-fold-cell`, `def:epoch:effective-act-contribution` |
| recipient resolution | Published order-free operator sending each cell to a person recipient or to the author's self-retention channel; strictly positive coordinates, author ownership, live consent, and an anchored person target are what send it outward. Every cell is weighed either way; no glyph. | `def:epoch:standing-recipient-resolution`, `post:epoch:universal-act-weighing` |
| inviter revocation | Per-author suppression predicate for Invitation acts when the latest epoch index in the same-incidence record set contains a De-invite; no glyph. | `def:epoch:inviter-revocation` |
| control-act class | Withdraw, Rescind, Leave, De-invite/A·T: type-fixed records, weighed and priced, always resolving to their author. | `rem:epoch:control-acts-resolve-to-self` |
| $\mathsf{A}_{uj}$, $\kappa_{\text{self}}$, $\omega_D$, $\delta_D(\xi)$ | Base allocation matrix over the anchored Actors — the sole standing-relevant reading of the epoch's acts — with the self-retention base, the published domain weights, and the act-level domain profile. | `def:epoch:domain-weighted-base-allocation`, `def:epoch:standing-domain-profile` |
| $g_{\text{vch}}(x)$, $\bar{g}_{\text{vch}}(x)$ | Responsive activation $\big(Q(p(x))/Q(1)\big)^{1/4}$ and its safety-wall clamp $g_{\text{vch}}(\max(x, \rho_\theta))$ — the sole standing activation; below-wall constant, zero derivative. | `def:epoch:responsive-vouch-activation`, `def:epoch:safety-wall-clamped-activation` |
| $\lambda^{(r)}_{uj}(\boldsymbol{x})$, $\Lambda^{(r)}(\boldsymbol{x})$ | Hop allocation score and matrix: base score tilted by the recipient's clamped activation raised to $\upsilon_r(t_k)$, self unmodulated, row-normalized — row-stochastic at every state. | `def:epoch:hop-allocation-score`, `eq:epoch:hop-allocation-matrix` |
| $\upsilon_r^\circ$, $\upsilon_r(t)$, $t_k$, $\mathcal{G}_t$ | Chartered hop-exponent shape (decreasing in $r$), the applied profile at strength $t$, the accepted rung, and the published finite backoff grid terminating at the always-certifying anchor $t = 0$. | `def:epoch:standing-tilt-profile`, `def:epoch:tilt-backoff-grid` |
| $\mathfrak{m}_m$, $L_{\text{hop}}$, $m^*$ | Published depth mass over hops (summing to one), the chartered transport depth, and the deepest supported index. | `def:epoch:standing-depth-mass` |
| $\mathfrak{e}_u$, $\mathfrak{E}$ | Source emission fraction $\min(1, \hat{r}_u/\rho_\theta)$ and its diagonal: history travels on the back of balance; a property of the source's pair, never of one relation. | `def:epoch:source-emission` |
| $\boldsymbol{\Pi}(\boldsymbol{x})$, $\Pi_{ui}$, $\tilde{b}_i$, $\tilde{N}_i$ | Conserved transport — emission applied once to the depth-mass mixture of hop products — its entries, and the transported pair mass. Sole relational input to standing; every row sums to one. | `def:epoch:finite-depth-conserved-transport`, `post:epoch:standing-pair-mass-conservation` |
| $\boldsymbol{x}^*$, $\mathcal{B}_k$ | The epoch's unique conserved equilibrium and the rate-hull box it is solved on, known before the solve begins. | `def:epoch:conserved-standing-equilibrium`, `prop:epoch:final-standing-hull` |
| $\mathcal{K}_k$ | Conserved standing certificate; a rung is accepted iff $m_\theta\,\mathcal{K}_k \le 1$, and its verdict distinguishes certificate failure from indecisive enclosure. | `def:dynamics:conserved-standing-certificate` |
| $\rho_{\text{act}}(q)$, $\rho_{\text{ep}}^{(k)}$ | Final act stamp (act-owned reduced final standing) and act-weighted epoch stamp. | `def:epoch:final-act-stamps` |
| $W^+(v), W^-(v)$ | Raw double-cover parity registers — terminal raw-service state, read by no standing quantity. | `def:epoch:double-cover-bfs-state` |
| $\mathrm{pos}(e)$ **(L1·verify)** | Audit position under the identity-key linearization; consumed by no formula. | `def:epoch:log-position` |
| ownership thread, Item genesis | Boundary-indexed title chain; declarative genesis act minting the Item's identity. | `def:graph:ownership-thread`, `def:graph:item-genesis-act` |
| set price | Average member-author raw rate over a dependent set at the closing burn snapshot; consumed by the closure rule and nothing else — averaging can clear the door, never mask a member below $\theta$. | `post:epoch:final-act-sequence-write-rule` |
| $W_k$ regime | Binding iff $|\mathcal{Q}_k| = N_{\text{epoch}}$, else slack; boundary-side data, quarantined from $\nu$-side formulas. | `post:epoch:final-act-sequence-closure` |
| door headroom $H_k$ | $\sum_i \Delta N_i^{(k)}(\hat{\alpha}_i^{(k)} - \rho_{\text{eff}})$: epoch stamp surplus over the door; congestion diagnostic **(L1·verify)**, no actuator. | `eq:epoch:final-epoch-headroom` |
| $W_{\text{loc}}$ | Local width: the width-fence input of the safety-threshold rule. | `subsec:epoch:floor-governance` |
| settlement references | Act-identity references $\mathrm{settles}$ / $\mathrm{accepts}$ (Accept/Ratify → Bid/Accept acts); metadata, not incidence; forced causal parents. | `def:graph:settlement-act-reference` |
| Accept / Ratify | Direct Actor-to-Actor settlement consent (non-binding alone) / commit; Relational, promoted, Half tier; resolves to the counterparty only when title-transferring under the epoch title fold. | `edge:nodes:accept`, `edge:nodes:ratify` |
| Withdraw / Rescind / Leave / De-invite | Control records; Minimal, Marginal, forced $+1$; weighed and priced, always resolving home. | §9 |
| $\tau^*$ | Maturity crossover $\approx 0.94$ (raw channel). | `prop:epoch:crossover-location` |
| Dynamics machinery **(certificates (L1·closure); interval evidence (L1·verify); the rest (—) shared dynamics)** | Activation properties (`prop:dynamics:responsive-vouch-activation-bound`, `-monotonicity`, `-concavity`), the wall clamp (`prop:dynamics:safety-wall-clamp`), hull invariance without a certificate (`thm:dynamics:conserved-standing-existence`), certified uniqueness and geometric convergence (`thm:dynamics:certified-conserved-standing-uniqueness`, `thm:dynamics:within-epoch-fixed-point-convergence`), initialization independence (`cor:dynamics:standing-initialization-independence`, `rem:dynamics:warm-start-independence`), the standing map-shock bound (`prop:dynamics:standing-map-shock-bound`). The earlier orbit/bifurcation apparatus is quarantined as non-normative rederivation obligations (`subsec:dynamics:quarantined-residuals`). | `app:dynamics` |

### 14.5 Terminal objects (full paper only)

The closure edition carries no (L2·free) symbol table; the terminal
complement is named in the boundary ledger. The full paper still defines
the terminal defaults a Layer 2 may adopt or replace: $l_{ij}$ license
severity (`def:content:license-qualifiers`) · $V(n)$ scalar CAN value ·
$t(n)$ transmission coefficient · $\mu(n)$ redundancy ratio · matrix CAN
$\mathbf{V}(n)$, $\mathbf{T}(n)$ · $H_\tau^{(C)}$ per-creator-epoch entropy
(Eq. (8.3), `eq:transport:epoch-entropy`) · $\mathcal{L}$ guild liquidity
pool and $R_C$ reward (Eq. (8.2), `eq:transport:reward-formula`) ·
realizing-forest betweenness $S_C$ · enriched centrality
$S_C^{\text{CAN}}$ and realizing-path normalization $V_{\max}$ ·
circuit-improvement influence $I_C$ · $\Xi_A$ bridge campaign scalar ·
$\mathrm{cir}(T,B,A)$ circuit quality · $S(u,c)$ relevance score (full §7,
`def:sorting:relevance-score`: max-product raw path relevance on
$G_k^{\text{raw}}$ × the standing amplifier of the creator × the content
norm; exact bounded-depth DP, `alg:sorting:exact-feed-traversal`) · the raw
canonical defaults $q$, $L$, $\tilde{w}_{\text{spam}}$, $\tilde{w}_{\max}$,
$\tilde{w}_{\max}^{\text{Op}}$ (§3, §6) · the raw double-cover registers.
Every relevance calculation consumes only final standing
(`rem:sorting:final-standing-input`). Bridge semantics: Channel 2
$\mathrm{end}(B,A)$ is stance-signed ($\mathrm{sgn}(p_d(e_{\text{Op}}))$),
and Channel 3 $\mathrm{con}(A,B)$ carries an absolute direct-stance veto
reading the net direct stance $\bar{p}_d$.

### 14.6 Shared mathematics used inside L1 definitions

$H_\tau$ temporal entropy (`def:graph:temporal-entropy`) ·
$|\det \boldsymbol{\Psi}_e^{[P]}|^{1/2}$ determinant score ·
$\psi_\pm, \psi_+, \sigma_{\text{sig}}$ clamps (`def:graph:sentiment-slice`) ·
$\mathrm{clip}_{[-1,1]}$ (net-stance fold) · $\mathrm{sat}(x) = x/(1+x)$
(the Möbius map shared by bond kernel and CAN saturation) — tag-exempt
operators. **Not shared mathematics:** the parity bits $\epsilon(e)$ and
$\epsilon(p)$ and the raw damped weight $\tilde{w}(e)$ are terminal-default
raw formulas (§3); the act time $\mathbb{T}^{\text{act}}_q$ is closure; the
maturity scalar $\tau_e$ is terminal (raw channel only); the activations
$g_{\text{vch}}, \bar{g}_{\text{vch}}$ are closure.

### 14.7 Vocabulary disambiguation (from the collision registers)

Word register (closure edition symbol index, *Word Collisions*):

- **act vs. record vs. edge projection** — the authored act is the atomic
  public record; "edge records" are its projections; an edge projection
  owns only incidence, role, and rendering. A hyper-edge is one act, two
  projections, one payload, one debit, one stamp, one time.
- **floor** — several distinct objects, one word: the Layer 0 redemption-rate
  floor | the numéraire $\nu$ (Layer 1 reserve→action unit) | the policy floor
  $\rho_{\text{pol}}$, the safety floor $\rho_\theta = \theta/\nu$ (the wall),
  the effective floor $\rho_{\text{eff}} = \max(\rho_{\text{pol}}, \rho_\theta)$
  (the door) | the safety price $\theta$ | "through the floor" (the binding
  axiom). Never conflate the price axis ($\nu$, $\theta$) with the position
  axis ($\rho_{\text{pol}}, \rho_\theta, \rho_{\text{eff}}$).
- **admission fraction vs. clip** — the delegated stages publish one global
  admission fraction per stage; "clip" is retired from normative Layer-1
  vocabulary (`rem:epoch:admission-not-clipping`) — net stance uses interval
  projection, activation uses the wall clamp, failed extensions use stage
  fallback.
- **authoritative vs. compliant order** — the published order fixes
  finalized state even if later proven dependency-non-compliant by a fraud
  proof; sanctions are deployment-level, never history rewrites
  (`post:graph:ordering-accountability`).
- **accountability vs. auditability** — a record's cost-bearing property
  (its author can be held to it) vs. a computation's reproducibility (anyone
  can re-run it). Adjacent, not synonyms.
- **standing vs. source** — the comparator ($\alpha$, shared-codomain) vs.
  the neutral source ($r$, per-actor rate). Bundle is not fiber.
- **coherence vs. stance** — $\epsilon(e) = \mathrm{sgn}(p_d p_i)$ is the
  coherence bit; the stance marginal $\mathrm{sgn}(p_d)$ is the author's
  directional verdict. Coherence composes; stance gates person-directed
  endorsement.
- **envelope vs. final flow** — the source envelope is the source's exact
  max-product view of an actor; the final flow is the relational mass
  admitted into that actor's standing row. Admitting less into a row does
  not rewrite the envelope.
- **maturity** — $\tau$ is graph connection-context maturity, a raw
  (terminal) channel; Layer-0 maturity is a cycle/lead concept, cited only
  through `PA-` labels. Raw maturity never enters the standing activation.
- **cycle vs. epoch** — Layer 0 has cycles; Layer 1 has epochs. Never swap
  the words.
- **Reference vs. referenced** — the edge family (capitalized; Review
  transposed, mints nothing, `edge:nodes:hyper-reference`) vs. the identifier
  status "referenced" ($v \in V$, `def:graph:anchoring`) vs. "reference
  band/parameters" in calibration prose. Capitalization and context
  distinguish; never merge.
- **payload bytes vs. content meaning** — magnitude is Layer 1's; meaning is
  terminal. Layer 1 bounds the byte length and carries the bytes unread;
  payload bytes and rendering are terminal.
- **husk** — persistent actor record after identity-severance and
  content-erasure: standing, title, and trust-edges remain, names and words
  gone; no glyph.

Glyph register highlights:
$\epsilon \in \{+1,-1\}$ (parity) — the pre-Edition-4 collision partner
$\epsilon_{\text{clip}}$ is deleted · $N_i$ vs $N_{\text{epoch}}$ ·
$\mathbb{T}^{\text{act}}_q$ (act time) vs $\mathbb{T}_{\partial k}$
(boundary slot of derived readings) vs $\mathrm{pos}(e)$ (audit
coordinate) · $x$ is reserved for reduced stage standing · $g_{\text{vch}}$
(activation) vs $g$ (Bid generosity) · $W_{\text{end}}^{(k)}$ (final flow)
vs $W^{[h]}_{\text{env}}$ (envelopes) vs $W_{\text{loc}}$ (local width) ·
$L_{\text{vch}}$ (projected) vs $L$/$L_{\text{feed}}$ (raw) · index $a$
(Layer-0 opaque address vs actor label after frame binding). **Full
(routing tier) vs full mask (stored shape)** remains a prose distinction —
a Half edge is full-mask but Half-tier.
