# Layer 1 → Layer 2 Interface

> **Provenance.** This document is a derived reference extracted from the
> **PeerNetworks Layer 1** specification by the **Peer Team** (Peer Network,
> v0.22.0-dev, July 2026), reproducing its binding surface for the purpose
> of building CoGra as a Layer 2 on it. It is not the normative source —
> the PeerNetworks paper is. Licensed under CC-BY-4.0; see
> [LICENSE-DOCS](../../LICENSE-DOCS).

**Derived file — hard facts only.** v0.22.0-dev ships as two artifacts:

- **The Closure Scope Edition** (*Peer Network — Closure Scope Markdown
  Edition*) — the binding surface only: kernel record, the admission rules,
  closure quantities, the two straddlers, and the shared mathematics.
  Terminal read-sites are *named* in its boundary ledger
  (`tbl:symbols:boundary`) but their mechanisms are not specified there.
  Cited below by anchor label (`def:…`, `post:…`, `lem:…`, `rem:…`, `ax:…`,
  `subsec:…`); Layer 0 objects are cited through `PA-` labels.
- **The full source** (`PeerNetwork_PeerNetwork_v0.22.0-dev_flat.tex`) — a
  superset: additionally specifies the terminal defaults (Content Sorting,
  Advertiser Transport, Content Governance, the Compositional Attribution
  Calculus, bilateral bridge transport) with numbered theorems. Cited below
  as *PN full §N / Theorem N.M*, and used **only** for terminal-default
  material (§4.1–4.2, §10, §14.5 below).

Proofs, motivation prose, and Layer 0 internals are omitted.

**Pinned anchor set.** This file's citation set is pinned under the spec's
anchor-stability contract: 261 distinct anchor names,
`anchor_set_hash = 8357aa61a668e5a5dafba107d2b4f5740c544423382cc3a685e5ee20a34bef38`
(sha256 over the sorted distinct anchor names joined by `\n`). Once
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
  produce the relative-standing field $\alpha_i$ (`def:epoch:standing`), and
  publishes the closure quantities admission reads. The public-auditability
  layer.
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
no $\alpha_i$, no $W_{\text{end}}(j \to i)$, no title, and no gate.
(`rem:comparator:identity-is-layer-2`)

---

## 2 The boundary predicate (feedback closure)

The boundary is not a list; it is a closure, and a Layer 2 can decide
membership itself. (`subsec:network:admission-closure`)

**Admission Closure and the Binding Boundary
(`def:network:admission-closure`).** Work on the *consumption graph*,
whose nodes are the network's published values and rules and whose directed
edge $V \to r$ records that read-site $r$ consumes value $V$. The *admission
set* $\mathcal{A}$ is the set of rules that decide what may be **written** to
$E$ and what written records **bind** — four, not three:

- **(write rule)** the two-gate write rule (`post:epoch:write-rule`), three
  sub-gates deciding whether an actor's record is writable — **W1** solvency
  (debited): $b_i \ge \theta^{(k)}$, evaluated continuously on live pairs,
  debiting $\theta^{(k)}$ on write (`post:epoch:theta-debit`); **W2a** safety
  (individual, never averaged): the boundary-frozen action stamp
  $\rho_{\text{act}}(e) \ge \rho_\theta$; **W2b** policy (averaged, never
  debited): the closed set satisfies $\rho_{\text{ep}}^{(k)} \ge
  \rho_{\text{eff}}$ and $|W_k| \le N_{\text{epoch}}$. W2a/W2b are the
  standing-derived stamp gate (who may act); W1 the solvency throttle —
  capacity **is** the balance (`post:epoch:theta-debit`);
- **(write)** the closure rule (`post:epoch:closure-rule`): the host writes a
  valid sequence of dependent sets within the target budget; validity is
  replayable from the published dependent-set partition; selection is
  discretionary and touches membership only — no recognition clause,
  tie-break, or scoring quantity reads selection position
  (`rem:graph:title-order-irrelevance`);
- **(recognition)** the settlement-recognition predicate
  (`def:graph:settlement-recognition`), whose clause (iii) reads the prior
  title certificate and thereby selects what binds. Recognition gates
  *binding effect*, not the write: an unauthorized Accept is written but
  never binds;
- **(formation)** the record-formation rule: a writable record is well-formed
  over the identifier algebra (`def:graph:identifier-algebra`), its family's
  endpoint typing, and any asserted parents (`def:graph:causal-assertion`);
  only a Registration may carry fresh grounded endpoints
  (`def:graph:registration`). Class-syntactic and stateless, except
  identity-key freshness (`lem:graph:key-uniqueness`) and the topological
  check that asserted parents are backward-only and acyclic within a batch.

The *feedback closure* $\overline{\mathcal{A}}$ is the transitive set of
values read — directly, or through other values — into any rule in
$\mathcal{A}$. A read-site is *terminal* when its output is consumed only by
an agent (a user, a terminal service, a guild, an advertiser, or another
downstream policy) and never re-enters the forward evolution of $E$. An
object is then

- **Layer 1 (binding)** iff it lies in $\overline{\mathcal{A}}$ — it
  influences admission;
- **terminal (free)** iff every one of its read-sites is terminal.

Two laws make the predicate usable:

1. **Authority is per read-site, not per object.** A value with one feedback
   read-site and one terminal read-site is Layer-1-authored yet freely
   readable downstream. Exactly two first-class objects straddle this way:
   the standing field $\alpha_i$ and the title certificate
   $\mathrm{owner}^{(k)}$.
2. **Recomputability is orthogonal to permission.** The standing field, the
   title certificate, and the damped edge weight $\tilde{w}(e)$ are all
   recomputable from $E_k$ and the published constants, yet binding:
   recomputability sets *audit cost*, never *authority*. Audit rights do not
   become override rights.

**The decision a Layer 2 runs** for any quantity $V$ it wishes to own:

1. list every read-site $r$ that consumes $V$;
2. for each $r$, ask whether $r$'s output re-enters the forward evolution of
   $E$ — whether it feeds the write rule ($W1/W2a/W2b$), the closure rule,
   the formation rule, or settlement recognition. If so, $r$ is a *feedback*
   read-site; otherwise it is *terminal*;
3. if *every* read-site is terminal, $V$ is terminal: reimplement freely;
4. if *any* read-site is feedback, $V$ is Layer 1: consume the kernel's
   value; may not override it; may recompute it to audit.

**The straddlers.** Title is read by recognition clause (iii) (*feedback*)
and by terminal routing/display (*terminal*); the one feedback site makes it
binding. Standing is the same: binding as gate input — read by the gate
through the write-rule stamps ($\rho_{\text{act}}$ at W2a, $\rho_{\text{ep}}$
at W2b) — free as a number a Layer 2 reads downstream. Straddlers are consumed at their kernel value,
audited but not authored (`rem:transport:guild-grant-preconditions`). The
symbol index closes the set: "The only straddlers are $\alpha_i$ and
$\mathrm{owner}^{(k)}$. A third straddler is a design error."

**Boundary in one sentence.** Layer 1 is the feedback closure of admission:
the accepted edge set, the declared constants, the burn snapshot, the rules
that decide what may append, and the two derived folds those rules read back
into themselves — standing as gate input, and title. Everything else the
network publishes is terminal. Permission is decided per read-site by a
single question — *does this re-enter $E$?* The grant states it as: **the
binding surface is {kernel, rules, α-as-gate, title} — and no larger.**
(`rem:network:boundary-one-sentence`, `post:transport:guild-grant`)

---

## 3 The boundary ledger (`tbl:symbols:boundary`)

The ledger is the normative referent of the closure scope and of the grant —
every published value sorted by feedback. A read-site is *feedback* if its
output re-enters the decision of what may be written to $E$ (the write rule,
the closure rule, the formation rule, or settlement recognition), and
*terminal* otherwise. Each object carries exactly one of
the **five tags** (`def:network:object-taxonomy`):

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
  participant recomputes it.
- **(L2)** — every read-site terminal; the guild's to reimplement under the
  grant.

Shared mathematics (norms, delimiters, number sets) is tag-exempt.

| Object | Feedback read-site | Terminal read-site | Verdict | Permission |
|---|---|---|---|---|
| accepted edge set $E_k$ (records, honest $\mathbb{T}_e$) | substrate of all of $\mathcal{A}$ | — | L1·closure | consume only |
| declared constants $\beta,\eta,q,\nu,\rho_{\text{pol}},N_{\text{epoch}},\delta_{\text{pos}},L,M_{\text{payload}}$ (nine) | gate / scoring / epoch target | — | L1·closure | consume only |
| derived constants $\epsilon_{\text{clip}}, \tilde{w}_{\text{spam}}, \tilde{w}_{\max}, \tilde{w}_{\max}^{\text{Op}}$ | clipping, verification, bounds | — | L1·closure | consume only; may recompute |
| burn snapshot $B_i^{(k)}$ | gate via $\alpha$ | — | L0·input | consume only |
| identity order $\prec^*$, $\mathrm{pos}(e)$ | replay tie-break | — | L1·verify | consume only; consistency-audited |
| write rule $W1{:}\,b_i \ge \theta$, $W2a{:}\,\rho_{\text{act}} \ge \rho_\theta$, $W2b{:}\,\rho_{\text{ep}} \ge \rho_{\text{eff}}$ | is admission | — | L1·closure | consume only |
| closure rule (write) | is admission | — | L1·closure | consume only |
| set price | closure rule | — | L1·closure | consume only |
| safety threshold $\theta$ (the debited price) | W1 solvency; floor validity | congestion dashboards | L1·closure | consume only; algorithmic per-epoch output |
| safety floor $\rho_\theta = \theta/\nu$ (the wall) | W2a; freeze key; fence pin | — | L1·closure | consume only; derived |
| effective floor $\rho_{\text{eff}} = \max(\rho_{\text{pol}}, \rho_\theta)$ (the door) | W2b; entry cost $\rho_{\text{eff}}\nu$ | — | L1·closure | consume only; $=\rho_{\text{pol}}$ on any valid certificate |
| action stamps $\rho_{\text{act}}$ (individual), $\rho_{\text{ep}}$ (averaged) | W2a / W2b via standing | — | L1·closure | consume only; may recompute |
| door headroom $H_k = \sum_{e\in W_k}(\rho_{\text{act}}(e) - \rho_{\text{eff}})$ | — | congestion dashboards | L1·verify | consume only; outcome, no actuator |
| recognition predicate (i)–(vi) | is admission | — | L1·closure | consume only |
| formation rule (identifier algebra; endpoint typing) | is admission | — | L1·closure | consume only |
| dependent-set partition | validity replay | guild dashboards | L1·verify | consume only; recompute to audit |
| title $\mathrm{owner}^{(k)}$ | recognition (iii) | guild routing | L1·closure ⋆ | consume kernel value; read downstream |
| standing $\alpha_i$ | gate | reward $\alpha_C$ | L1·closure ⋆ | consume kernel value; read downstream |
| bundle projection (net stance, Vouch Predicate, control-edge exclusion, inviter revocation) | via $W_{\text{end}} \to$ standing $\to$ gate | — | L1·closure | consume only |
| $\tilde{w}(e)$, $W_{\text{end}}(j\to i)$, $\epsilon(e)$/$\epsilon(p)$, action stamps | via standing $\to$ write rule | feed $S$, bridge affinity | L1·closure | consume only; may recompute |
| Self-edge bond parameter $p_i$, $(b,N)_i^{\text{last}}$ | $\tilde{w}(e_{\text{Rep}}) \to W_{\text{end}} \to$ standing $\to$ write rule | terminal reads may observe | L1·closure | consume only; may recompute |
| ownership thread, Item genesis | title $\to$ recognition (iii) | terminal display | L1·closure | consume only; may recompute |
| settlement records Bid / Accept / Ratify / Withdraw / Rescind | recognition predicate | terminal reputation / dispute policy | L1·closure (records/rules) | consume recognition result; terminal policy free |
| local certificate $\mathcal{K}_{\text{row}}$, local width $W_{\text{loc}}$ | — | guild dashboards | L1·verify | consume only; recompute to audit |
| attested boundary timestamp, closure cause | boundary-accountability replay | guild dashboards | L1·verify | consume only |
| parallel bundles, all other folds | — | the guild / user | L2 | reimplement freely |
| membership fold $\mathrm{member}^{(k)}(a,C)$ | — | guild / chat policy | L2 | reimplement freely; policy defaults L1·by-product |
| payload projection / bytes | — (terminal by postulate) | user / L2 service | L2 | reimplement freely; carriage custody per phase |
| content witness | — (evidence; authenticates carriage) | any verifier | L1·verify | consume only; retained by Layer 1 across phases (`rem:graph:payload-custody-phases`) |
| feed $S(u,c)$ | — | the user | L2 | **reimplement freely** |
| reward $R_C$ | — | the guild | L2 | **reimplement freely** |
| CAN $V(n)$, aggregation fn | — | the guild | L2 | **reimplement freely** (subject to the three invariants, §4.1) |
| consent | — | guild / advertiser | L2 | reimplement freely; canonical defaults L1·by-product |
| bridge $\Xi_A$, channels, composition | — | the guild / advertiser | L2 | **reimplement freely** |
| identity association | — | the L2 service | L2 | **reimplement freely** |
| licensing / provenance metadata | — | terminal policy | L2 | reimplement freely |

The straddler line: standing and title are consumed at their Layer-1 value
where they feed back, and read terminally by guilds downstream. The only
straddlers are $\alpha_i$ and $\mathrm{owner}^{(k)}$; a third is a design
error. (`subsec:symbols:boundary`)

Note: the payload **projection / bytes** are terminal by postulate — no
closure quantity reads them (payload-state invariance), so they are **L2**, a
carriage-custody concern per phase. The **content witness** is not: it is
**L1·verify** evidence — no formula consumes it, but it authenticates carriage
and is retained by Layer 1 across both deployment phases
(`rem:graph:payload-custody-phases`); withholding it breaks auditability. Only
the structural record is L1·closure.

---

## 4 The reimplementation grant

**Guild Reimplementation Grant (`post:transport:guild-grant`):**

> A terminal service MAY redefine, replace, or independently recompute any
> published value every read-site of which is terminal — consumed only by an
> agent and never read back into the decision of what may append to $G$ (the
> write rule $W1/W2a/W2b$, the closure rule, the formation rule, or
> settlement recognition).
>
> Equivalently: a guild owns the entire terminal complement of the admission
> closure — the feed $S(u,c)$, the reward $R_C$, the CAN and its aggregation
> function, and the bridge transport and its composition rule.
>
> It MAY NOT override any value with a feedback read-site: the kernel inputs
> (accepted edge set, declared constants, burn snapshot), the admission
> rules, standing as gate input, and title as read by recognition — which it
> must consume as published. It MAY recompute any such value to audit it.
> Recomputing to audit is not overriding.
>
> Deviating from a terminal default forks only the deviating service (loss
> of composability); attempting to deviate from a binding value forks the
> shared graph and is rejected. The binding surface is
> {kernel, rules, $\alpha$-as-gate, title} — and no larger.

On the four admission rules: the write rule ($W1/W2a/W2b$), formation, and
recognition are value-facing predicates a guild might try to recompute — the
grant's parenthetical names them, and a guild must consume their kernel
values (standing feeds the write rule through the stamps; title feeds
recognition). The **closure rule** — the host's act of admitting dependent
sets — is equally binding, but it is the host's *action*, not a value a guild
recomputes; the grant folds it into "the admission rules" generally. A guild
cannot override what the host writes; it only consumes $E_k$.

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
(Withdraw, Rescind) and conversational (Leave, De-invite L1/L2) control
records, with Rule 4 taking precedence over Rule 2 for De-invite legs.

### 4.2 Layer 1 obligations and guild obligations

Layer 1 / operator provides: the public append-only graph
(`post:introduction:public-accessibility` … `post:introduction:epoch-edge-set`),
the commitment ledger and endorsement-flow scoring infrastructure, and the
epoch machinery (PN full §6, `subsec:epoch:epoch-boundary`). Publishes the declared constants and the
derived constants (§6 below). The operator's economic inflow is the Layer 0
minting fee — the sole protocol-level value flow to the operator; no
protocol-level fee is extracted from content transactions, advertising
spend, or guild reward pools.

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
only to the endorsement-flow projection; "feed-ranking… read[s] raw records
unchanged." $q = \tfrac12$ is fixed for every Layer-1 computation; a guild
may expose $q \ne \tfrac12$ for its own sorting only (`rem:sorting:matrix-bfs`,
normative). The bridge transport changed semantically: Channel 2 is now
stance-signed ($\mathrm{sgn}(p_d(e_{\text{Op}}))$, not $\epsilon$), and
Channel 3 consent gained an **absolute direct-stance veto** (a negative net
direct stance $\bar{p}_d^{(A \to \text{Profile}_B)} < 0$ hard-zeros consent).

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
- **Ordering Consistency (`post:introduction:ordering-consistency`).** Every
  edge carries a Lamport time $\mathbb{T}_e$ satisfying the clock condition
  (`def:graph:causal-order`). Any two participants holding the same edge set
  derive the same causal order $\prec$. *No global total order over edges is
  required as a primitive.*
- **Epoch Edge-Set Provision (`post:introduction:epoch-edge-set`).** At each
  epoch boundary $k$ the operator provides a finite edge set
  $E_k = E_{k-1} \cup W_k \subseteq E$ that is causally closed
  ($e' \in E_k \wedge e \prec e' \Rightarrow e \in E_k$) and monotone
  ($E_{k-1} \subseteq E_k$), where $W_k$ is the boundary's write set of
  dependent sets (§11.6). $E_k$ is the sole topological input to the epoch-$k$
  computation, and every record in it is user-authored. The settled sampling
  depth that makes frame stability hold is a property of $E_k$, not of any
  global clock.
- **Mechanism-agnostic (`rem:introduction:mechanism-agnostic`).** Any
  mechanism delivering a causally closed, monotone $E_k$ on which honest
  participants agree is compliant. Agreement on the *set* $E_k$, not on an
  order over it, is what the downstream computation consumes.
- **Host Contract (`post:network:host-contract`).** The host's entire
  authority is what it publishes each boundary — nothing more. It publishes:
  **(i) the certificate** — the written edge set $E_k$, the burn snapshot, the
  epoch quantities ($r_i, \alpha_i, \mathrm{owner}^{(k)}$, bond parameters),
  the debit schedule $\theta^{(k)}$ and led $\theta^{(k+1)}$/$\rho_\theta^{(k+1)}$,
  the chartered margin factor $m_\theta$, the action stamps
  $\rho_{\text{act}}, \rho_{\text{ep}}$ and door headroom $H_k$, the
  verification objects $\mathcal{K}_{\text{row}}$, $W_{\text{loc}}$, and mass
  ratios $\{x_i\}$, the dependent-set partition of $W_k$, the realized epoch
  size, the closure cause (target or duration), and an attested boundary
  timestamp; **(ii) the constants ledger** under no-silent-change; **(iii) the
  boundary policy** — the epoch
  target $N_{\text{epoch}}$ and the epoch min/max durations (host wall-clock
  policy, glyph-free, announced before effect); **(iv) the policy-floor
  schedule** — $\rho_{\text{pol}}$ announced at $k$, effective at $k+1$, valid
  iff $\rho_{\text{pol}}\nu \ge \theta$. Every item is replayable; none is a
  trust assertion. Misbehavior at the boundary is *evidence, not prevention*
  (`post:graph:boundary-accountability`).

**Verification model** (`subsec:introduction:verification-model`): every
computation **that can feed admission** — the write rule ($W1/W2a/W2b$), the
closure and formation rules, settlement recognition, title as read by
recognition, and standing as read by the gate through the stamps — is
specified by published formula over the
public record and independently reproducible from records and constants
alone. The certificate additionally makes the boundary machinery replayable:
the dependent-set partition, set prices and floors, the regime bit, and the
safety-threshold lead all carry replay checks
(`subsec:verification:boundary-admission`, `subsec:verification:boundary-admission-lint`).
Centralized phase:
verification as audit (results apply before verification; constants being
calibrated, not yet locked). Decentralized phase: verification as gate
(nothing failing verification takes effect). The mathematical specification
is identical across both phases. `app:deployment` documents the **seven**
deployment invariants (§13).

---

## 6 Published constants (`tbl:verification:constants`)

| Constant | Value | Source |
|---|---|---|
| $\beta$ | 1.386 ($= 2\ln 2$) | `ax:epoch:thermodynamic-boundary` |
| $\eta$ | 0.05 | `def:graph:path-view-extraction` |
| $q$ | 0.5 (fixed for every Layer-1 computation) | `def:graph:svd-path-score` |
| $\nu$ | 0.10 (illustrative numéraire, reserve/action; not yet locked) | `def:comparator:numeraire` |
| $\rho_{\text{pol}}$ | 1 (canonical default policy floor; dimensionless, host-dialed) | `def:epoch:policy-floor` |
| $\theta$ | $\le \nu$ at reference (reserve/action; **algorithmic per-epoch output**, one-boundary lead, never a host input) | `def:epoch:safety-threshold` |
| $\rho$ | $\max(\rho_{\text{pol}}, \theta/\nu)$; $= \rho_{\text{pol}}$ on any valid certificate (derived) | `def:epoch:participation-floor` |
| $N_{\text{epoch}}$ | 10000 (illustrative **target** write budget; not yet locked) | `post:epoch:epoch-boundary` |
| $\delta_{\text{pos}}$ | 500 (illustrative burn-snapshot buffer; not yet locked) | `post:epoch:epoch-boundary` |
| BFS depth $L$ | 4 | `def:epoch:admissible-endorsement-path` |
| $\tilde{w}_{\text{spam}}$ | $\approx 0.011$ (derived) | `subsec:verification:spam-resistance` |
| $\epsilon_{\text{clip}}$ | $\approx 1.5 \times 10^{-8}$ (derived; default $\tilde{w}_{\text{spam}}^L$, $L = 4$) | `def:epoch:prospective-bound` |
| $\tilde{w}_{\max}$ | $\approx 0.986$ (derived) | `subsec:verification:self-edge-bond` |
| $\tilde{w}_{\max}^{\text{Op}}$ | $\approx 0.502$ (derived) | `subsec:verification:self-edge-bond` |
| $M_{\text{payload}}$ | deployment-calibrated | `def:graph:payload-carriage` |

The comparator's single reserve→action unit is the **numéraire** $\nu$; the
participation floor is a *pair* — the host-dialed $\rho_{\text{pol}}$ and the
network-computed safety threshold $\theta$ — governed in §11.8. Only the
derived **effective floor** $\rho = \max(\rho_{\text{pol}}, \theta/\nu)$ is
read by a binding site, and by exactly three: the gate, the freeze
condition, and the entry cost (`post:epoch:reduction-convention`). Every
dynamical and routing quantity is $\nu$-reduced and $\rho$-free. At the
reference calibration $(\nu, \rho_{\text{pol}}) = (0.10, 1)$ with
$\theta \le \nu$, $\rho = 1$ and every value coincides with a single-floor
edition.

No netting-clip constant exists: the stance-aggregation clip is the fixed
$\mathrm{clip}_{[-1,1]}$ in `def:epoch:net-stance`, not a calibrated value.

*Layer 0 surface constants* are owned by the Peer Attestation paper and
surfaced through `PA-` citations; they enter no Layer-1 closure formula
except through the interface object $(1-f)\zeta$ in the entry cost
$\delta_{\min} = \rho\nu/((1-f)\zeta)$ (`def:comparator:entry-cost`).
The interface export count is four: $A$, $\mathbb{A}$, $(1-f)\zeta$,
$A_{\max}$. Illustrative Layer 1 constants are subject to empirical
calibration during the centralized deployment phase and are not yet locked.

---

## 7 The admission rules (the set $\mathcal{A}$, exactly)

$\mathcal{A}$ is **four** rules (`def:network:admission-closure`): the
**write rule** (§7.1) — the three sub-gates W1/W2a/W2b deciding whether an
actor's record is writable; the **closure (write)** rule — the host writes a
valid sequence of dependent sets within the target budget (§11.6, and *The
Write*, §8.1); **recognition** (§7.2); and **formation** — a writable record
is well-formed over the identifier algebra, its family's endpoint typing, and
its asserted parents, with only a Registration carrying fresh grounded
endpoints (§8.3, §9). The write rule decides *who may act*; the closure rule
*what enters $E_k$*; formation *what is well-formed*; recognition *what binds*.

### 7.1 The two-gate write rule

A record by actor $i$ is writable in epoch $k$ iff all three sub-gates hold
(`post:epoch:write-rule`, `subsec:epoch:participation-gates`):

1. **W1 — solvency (debited):** $b_i \geq \theta^{(k)}$ — evaluated
   continuously on the live pair; on write the balance debits $\theta^{(k)}$
   (`post:epoch:theta-debit`). Capacity **is** the balance.
2. **W2a — safety (individual, never averaged):** the boundary-frozen action
   stamp $\rho_{\text{act}} = \hat{\alpha}_i^{(k)} \geq \rho_\theta$ (the wall).
3. **W2b — policy (averaged, never debited):** the closed set's
   action-weighted stamp $\rho_{\text{ep}}^{(k)} \geq \rho_{\text{eff}}$ (the
   door) with $|W_k| \le N_{\text{epoch}}$; band actors
   ($\rho_\theta \le \rho_{\text{act}} < \rho_{\text{eff}}$) enter when the
   door has headroom.

An insolvent actor (W1) restores capacity immediately by committing burns.
Re-crossing the wall (W2a) requires some combination of new burns raising
$r_i$ directly and new **admissible vouch-positive connections** from actors
with source rates above the current standing (positive parity alone is not
sufficient — the Vouch Predicate gates actor-directed endorsement, §11.3).

Actor states (`tbl:epoch:actor-states`), by (W2a $\rho_{\text{act}} \ge
\rho_\theta$, W1 $b \ge \theta$): **Active** (✓/✓, may act); **Band** (✓/✓,
acts when the door has headroom); **Insolvent** (✓/✗, remedy: burn
immediately); **Frozen** (✗/irrelevant, remedy: burn lump to re-cross the
wall).

Standing is **ignition-then-amplification**
(`rem:nodes:commitment-ignition`): endorsement cannot reach a zero-burn
actor as standing — an actor first clears the entry cost on their own burns
(`def:comparator:entry-cost`), and only then do vouch-positive connections
lift $\alpha_i$. Endorsement amplifies ignited commitment; it cannot
substitute for ignition.

**Newcomer admission (`rem:epoch:newcomer-admission`).** A new actor has no
prior-boundary standing. For a **Registration** record only, the gates are
evaluated from *live* ledger values ($\alpha_i := r_i$): a newcomer at the
entry deposit lands at stamp exactly $\rho_{\text{eff}}$, door-average-neutral
by construction (W1 is implied on any valid certificate, since the clamp gives
$\rho_{\text{eff}}\nu \ge \theta$). From the first boundary after acceptance,
ordinary frozen-boundary evaluation governs. The binding admission burn for
acting is
$\nu\max(1, \rho)$.

### 7.2 Settlement recognition

Five settlement edge families: three forward (Bid, Accept, Ratify), two
cancel (Withdraw, Rescind). Every state transition is caused by an authored
edge; no state changes through inaction, counting, or timeout
(`thm:graph:no-death-by-inaction`).

**Item Genesis (`def:graph:item-genesis`).** An Item $n_i$ enters the graph
together with an initial Owner edge $\text{Actor}_{a_0} \to n_i$ authored by
its originating actor $a_0$ — the genesis of the ownership thread. Item
identity is **declarative**: the Item *is* its genesis record, identified by
the structural identity key
$(\mathbb{T}_e, \mathrm{author}(e), \mathrm{src}(e), \mathrm{tgt}(e))$. No
payload datum enters the key, so identity, pointer resolution, and title
survive every payload state. Two actors listing "the same" real-world
referent create two Items with two ownership threads; out-of-band truth is
deterred by accountability cost and witnessed by `frontier:item-genesis`.
Genesis is an ordinary gated append. Title at Layer 1 is title over a
**registered claim**, never custody of a referent
(`rem:graph:item-identity-limit`, `subsec:necessity:declarative-item-identity`).

**Settles-pointer.** Accept and Ratify each carry the identity key
$(\mathbb{T}_e, \mathrm{author}(e), \mathrm{src}(e), \mathrm{tgt}(e))$ of the
Bid that created the Offer. The pointer is *metadata, not graph incidence*.

**Finalization epoch (`def:graph:finalization-epoch`).**
$\mathrm{ep}(e) = \min\{k : e \in E_k\}$ — well-defined by monotonicity of
the epoch edge sets. Two records are *co-epochal* iff their finalization
epochs are equal. Title consumes records at $\mathrm{ep}(\cdot)$ granularity
only.

**Settlement Recognition (`def:graph:settlement-recognition`).** A
settlement candidate on Item $n_i$ in epoch edge set $E_k$ is a triple
$\mathcal{S} = (\text{Bid}, \text{Accept}, \text{Ratify})$ whose Accept and
Ratify both carry settles-pointers resolving to the Bid that created the
Offer. The candidate is *recognized* iff all six clauses hold:

- **(i) Completeness.** All three records are present in $E_k$.
- **(ii) Pointer binding.** The Accept's and Ratify's settles-pointers both
  resolve to the identity key of the Bid.
- **(iii) Authorization.** The author of the Accept is the certified owner
  $\mathrm{owner}^{(k-1)}(n_i)$ at the boundary preceding the Ratify's
  finalization epoch $k = \mathrm{ep}(\text{Ratify})$ (the genesis owner if
  the thread is fresh). Clause (iii) reads the prior title certificate back
  into admission — the straddler.
- **(iv) Buyer consent.** No buyer Withdraw on this Offer satisfies
  $\mathrm{ep}(\text{Withdraw}) \le \mathrm{ep}(\text{Ratify})$.
- **(v) Seller consent.** No seller Rescind on this Offer satisfies
  $\mathrm{ep}(\text{Rescind}) \le \mathrm{ep}(\text{Ratify})$.
- **(vi) Well-formedness.** $\text{Bid} \prec \text{Accept} \prec
  \text{Ratify}$ — each party observes the prior record before authoring its
  own; a well-formedness check on the handshake chain, carrying no
  tie-breaking force.

Clauses (iv) and (v) are the **epoch-quantized consent rule**: a cancellation
co-epochal with, or earlier than, the commit defeats it; a cancellation in a
strictly later epoch is inert — the sale is final *at the certificate*, not
at the Ratify (`subsec:necessity:epoch-quantized-consent`). A recognized
candidate whose Ratify finalizes at boundary $k$ with no defeating cancel is
*unchallenged at $k$*. The predicate reads set membership,
$\mathrm{ep}(\cdot)$ indices, and the well-formedness chain — no
$\mathrm{pos}(e)$, no sub-epoch order, no Lamport comparability.

**Lifecycle states:** Open→Accepted (Accept, seller); Open→Dead (Withdraw,
buyer); Accepted→Committed (Ratify, buyer); Accepted→Dead (Withdraw, buyer);
Accepted→Dead (Rescind, seller). Dead and Committed are absorbing. No death
by inaction: no count, window, or throughput measure enters the lifecycle
map. Cleanup is an authored choice, never a silent timeout.

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
transferable at every later boundary (`subsec:necessity:mutual-consumption`).
If $C_k(n_i) = \varnothing$, title is unchanged. *First epoch wins; ties
consume* — a Ratify landing one boundary after a competitor's transfer fails
clause (iii) (the owner changed) and is not recognized.

**Order-Freeness (`thm:graph:settlement-order-freeness`).** Settlement
recognition, the ownership thread, and the title certificate are functions of
$(E_{k-1}, E_k, \mathrm{owner}^{(k-1)})$ and $\mathrm{ep}(\cdot)$ indices
alone — invariant under every intra-epoch order and reading no
$\mathrm{pos}(e)$. Sub-epoch order is title-irrelevant and closure selection
is title-invisible: the write rule decides membership only, never recognition
or tie-break (`rem:graph:title-order-irrelevance`).

**Title-certificate computation
(`alg:graph:title-certificate-computation`):** boundary-inductive — for each
Item, $\mathrm{owner}^{(k)}$ folds $\mathrm{owner}^{(k-1)}$ through
$C_k(n_i)$ by the epoch title fold (transfer on a unique co-epochal winner;
consume-without-transfer on a co-epochal tie; unchanged if none), grounding
at the genesis record. Returns $\mathrm{owner}^{(k)}$.

**Settlement reputation: stance, not parity
(`rem:graph:settlement-reputation`).** Title transfer is
sentiment-independent. The terminal commercial-reputation read-site, named
in the boundary ledger, **reads stance marginals rather than path parity**.
This is forced by the Quadrant Law: a coerced and unfair Accept with both
parameters negative has $\epsilon = +1$ — correct for routing coherence,
wrong as a verdict. Routing reads coherence; stance consumers read stance.
The closure-side gate is the Vouch Predicate on Accept/Ratify (actor-directed
records vouch only if $p_d > 0 \wedge p_i > 0$, §11.3).

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
(`frontier:boundary-censorship`).

---

## 8 Kernel data model: the graph and the edge record

### 8.1 Partition and passivity

**Graph Partition (`def:graph:partition`).** The network is a directed graph
$G = (V, E)$ with $V = V_u \sqcup V_c$: $V_u$ **active** nodes (Actors),
$V_c$ **passive** nodes (artifacts). Every **record** in $E$ is authored by
an active node. Passive-sourced edges occur only as author-fixed terminal
legs of hyper-edges whose initiating actor is recorded. The Self-edge bond is
the **sole derived family**: *both* its Declaration component (Actor →
Profile) and its Reputation component (Profile → owning Actor) are derived
from the epoch certificate, not appended records
(`post:epoch:self-edge-bond-derivation`) — the Reputation component is
additionally the *only passive-sourced* traversal edge into an Actor
(Declaration is Actor-sourced). Every record in $E$ is therefore
user-authored.

**Edge ontology (`ax:graph:edge-ontology`).** The graph's primitive record
set is the append-only set of **edge records** $E$; there is no third place
for data to live. A **node is implicit**: $v \in V$ iff some accepted record
references $v$ in an endpoint field — no node-creation operation, no node
table, no node attribute store. Every "node property" (sentiment, norm,
maturity, affordances, license, creator, ownership, membership) is a declared
**fold** over the records referencing that identifier; a property without a
declared fold is undefined. Layer 1 appends nothing: edges earlier editions
called Layer-1-issued are *derived edges* (`def:graph:derived-edges`), and the
record set is user-authored in its entirety.

**Identifier algebra (`def:graph:identifier-algebra`).** Node identifiers form
the inductive term algebra
$I ::= \mathsf{addr}(a) \mid \mathsf{prof}(a) \mid \mathsf{name}(s) \mid \mathsf{key}(\mathbb{T}, i_{\text{auth}}, i_{\text{src}}, i_{\text{tgt}})$,
classed by outermost constructor: **grounded** ($\mathsf{addr}$,
$\mathsf{prof}$ — Actor, Profile), **named** ($\mathsf{name}$ — Type, a
commons compared by exact byte equality), **minted** ($\mathsf{key}$ —
Content, Item, Chat, Offer, Comment, Message). Class is decidable
syntactically, no census lookup (`lem:graph:identifier-disjointness`). Two
constructors take atoms from outside the record set — $\mathsf{addr}$ anchors
*mass* from the reserve, $\mathsf{name}$ anchors *reference* from the string
commons. An identifier is **anchored** iff its class-specific anchor is in
$E_k$ (a Registration for grounded; the key-bearing record for minted;
vacuously for named); a referenced-but-unanchored identifier is **dangling**
and **fold-neutral** — every canonical fold returns its neutral element, so
danglingness never binds (`def:graph:anchoring`,
`lem:graph:dangling-neutral-fold`).

**Universal parallelism (`ax:graph:parallel-edges`).** For every edge family
an author may append a record parallel to their own prior record (same
author, source, target, family); the append layer never rejects, merges,
supersedes, or tombstones — it stores **chronicles, never state**. The
**parallel bundle** $\Pi(j, s, t, f)$ (per-leg for hyper-edges, keyed on full
incidence) is a strict $\prec$-chain, so its $\prec$-latest member is
well-defined without any linearization (`def:graph:parallel-bundle`). Layer 1
reads bundles in **exactly two** places (`rem:graph:bundle-consumers`): the
**standing** projection (net stance + Vouch Predicate + inviter revocation,
§11.3) and **title** (the epoch-quantized settlement fold, §7.2). Every other
reading — current profile (latest), membership, decay, amended-vs-accumulated
display — is Layer-2-free. A parallel *genesis* is rejected by record
integrity (author equivocation on one identity key): a node cannot be
re-minted, only newly written about (`post:graph:title-parallel-reservation`).

**Passive Authorship Control (`ax:graph:passivity`).** (i) Every edge is
exactly one of: (a) user-authored ($u \in V_u$); (b) a passive-sourced
terminal leg of a hyper-edge authored by some $a \in V_u$; (c) a **derived**
component of the Self-edge bond — Declaration (Actor → Profile) or Reputation
(Profile → Actor) — recomputed by Layer 1 from the certificate, not a record
in $E$; only the Reputation component is passive-sourced. (ii) No passive node
initiates,
redirects, or modifies any edge; every outgoing edge from $c \in V_c$ is
determined at creation by the authoring actor (or, for the derived bond, by
the certificate) and thereafter immutable.

Passive out-degree (`lem:graph:passive-out-degree`): Content, Type, Comment,
and Message source Tag and Review terminal legs; Offer sources Review legs but
no Tag; Item additionally sources a Bid leg; Chat additionally sources Send,
Invitation, and De-invite legs; Profile additionally sources the derived
Reputation component; and every passive type sources Reference terminal legs —
Reference's A-leg may source from any passive node (the universal citing
artifact), contributing author-fixed Reference T-legs to every passive type.
Edges between actors may be asymmetric; each
edge carries independent sentiment parameters set unilaterally by its
originating actor. Directedness is the condition that prevents unilateral
influence fabrication (`rem:graph:asymmetry`,
`subsec:necessity:directed-edges`).

**The write and the dependent set (`def:network:write`,
`def:graph:dependent-set`).** The graph's *store* is append-only; the *act*
that mutates it is the **write** — the admission of a *dependent set* into
$E_k$, at an epoch boundary and nowhere else (`post:epoch:closure-rule`). A
record's **dependencies** are exactly its **asserted parents** (identity keys
of prior records it must follow — backward-only metadata, not incidence,
`def:graph:causal-assertion`) and, for a hyper-edge, its co-leg. A
**dependent set** is a set of records closed under dependency, written whole
or not at all (`cor:graph:leg-atomicity`). A record is in $E$ iff some write
admitted its dependent set; a submission that is not written is not refused —
it is nothing (the network has no ontology of the unwritten, and only the
certificate speaks). The **set price** (`def:graph:set-price`) is the average
of member-authors' raw commitment rates, gated by two floors on two
granularities: the safety threshold **per member** ($r_j \ge \theta$, never
averaged — no member's attestation deficit is paid by another's surplus) and
the policy door **on the average** ($\ge \rho_{\text{pol}}\nu$; a committed
child may carry a poor parent, capped by the subsidy bound
`rem:graph:subsidy-bound`). Derived edges and the one-way payload reduction
are *not* writes — Layer 1 authors nothing (`rem:network:not-a-write`).

### 8.2 Temporal structure

**Temporal Attributes (`def:graph:temporal-attributes`).** For edge $e$
connecting $u, v$:

- Local time integer:
  $\mathbb{T}_e = \max(\mathbb{M}_u, \mathbb{M}_v, \mathbb{M}^{\text{dep}}_e) + 1$,
  where $\mathbb{M}_x = \max\{\mathbb{T}_{e'} \mid e' \text{ incident to } x\}$
  ($-1$ if no prior edges) and $\mathbb{M}^{\text{dep}}_e$ is the maximum local
  time among $e$'s asserted parents (`def:graph:causal-assertion`), or $-1$ if
  none.
- Maturity scalar:
  $\tau_e = 1 - 1/(1 + \max(\deg_{\text{pre}}(u), \deg_{\text{pre}}(v)))$,
  where $\deg_{\text{pre}}(x)$ counts edges incident to $x$ with
  $\mathbb{T}_{e'} < \mathbb{T}_e$.

**Causal Order (`def:graph:causal-order`).** $e \lessdot e'$ iff $e, e'$
share an endpoint and $\mathbb{T}_e < \mathbb{T}_{e'}$; the causal order
$\prec$ is the transitive closure; incomparable edges are concurrent
($\parallel$). $\mathbb{T}_e$ is a Lamport clock — the least integer
assignment satisfying **both** the structural clock condition
$e \prec e' \Rightarrow \mathbb{T}_e < \mathbb{T}_{e'}$ **and** the
asserted-parent dependency condition
(`prop:graph:lamport-clock-condition`, `def:graph:causal-assertion`). $\tau$
is a function of $\prec$
alone, invariant under any linearization of $\parallel$. $\mathbb{T}_e$
governs causal order and maturity; $\mathrm{pos}(e)$ governs epoch-boundary
placement only.

**Temporal Entropy (`def:graph:temporal-entropy`).**
$H_\tau(e) = -\tau_e \ln \tau_e - (1 - \tau_e) \ln(1 - \tau_e)$, with
$H_\tau = 0$ at $\tau_e = 0$.

### 8.3 The edge record and payload carriage

Fields the structural record carries: author binding; endpoints (src, tgt);
local time $\mathbb{T}_e$; maturity $\tau_e$ (derived); two continuous
parameters $p_d, p_i$ and a discrete domain label $D$; domain binary mask
$\mathbf{a}_D \in \{0,1\}^4$ (domain-determined); routing tier
$T(e) \in \{$Full, Half, Marginal$\}$; derived parity $\epsilon(e)$; the
**payload witness**; and the **identity key**. Settlement edges (Accept,
Ratify) additionally carry the settles-pointer — metadata, not incidence.
The record is sufficient to recompute the sentiment slice, path-view
determinant, determinant sign, damped weight, causal time, and payload
witness needed by closure quantities.

**Payload Carriage (`def:graph:payload-carriage`).** **Every edge carries a
payload projection**: a byte string the network never reads, bounded by the
kernel constant $M_{\text{payload}}$ (bounds carriage and epoch edge-set
size; enters no scoring, attribution, standing, settlement, or write-rule
formula — neither $N_i$ nor W1/W2a/W2b). The canonical empty payload is the
zero-length byte string.
The payload is removable; the structural record is not.

**Payload controller (`def:graph:payload-controller`).** Removal authority:
the author, for $V_u$-sourced edges; the **initiating actor**, for
passive-sourced hyper-edge terminal legs. The derived Self-edge components
carry no payload — excluded from the payload census
(`edge:nodes:self-reputation`).

**Payload state (`def:graph:payload-state`).** Three states: **full-empty**
(canonical zero-length bytes, private value present), **full**, **reduced**.
State moves toward reduced only.

**Separable, Concealing Edge Commitment
(`post:graph:separable-edge-commitment`).** The edge commitment factors into
a **structural** part (over the edge's irrevocable record) and a **content**
part (over the payload), the commitment reproducible from the two together.
The structural part verifies whether or not the payload is held. The content
part is **binding** (no second payload is consistent with it — removal
erases, never rewrites) and **concealing** (alone, it reveals nothing
recoverable about the payload — formed over the payload together with a
private value held beside the payload in carriage, never in the structural
record, removed atomically with it). An edge presents in two projections:
**full** and **reduced**; the structural record is invariant across the
transition.

**Payload-state invariance (`prop:graph:payload-state-invariance`).**
Invariant under every payload state: $\boldsymbol{\Psi}_e$,
$\boldsymbol{\Psi}_e^{[P]}$, $\epsilon(e)$, $\tilde{w}(e)$,
$W_{\text{end}}(j \to i)$, $\alpha_i$, $\mathcal{S}$, $\mathrm{owner}^{(k)}$,
$b_i$. Removal is scoring-neutral: the reduced projection carries the entire
Layer-1 closure surface; epoch replay is bit-identical across full and
reduced (`rem:graph:removal-scoring-neutral`).

**Payload size is not action cost
(`rem:graph:payload-size-not-action-cost`).** One accepted edge consumes one
action credit regardless of payload length; $M_{\text{payload}}$ is a
carriage bound, never an action-denomination rule.

**Custody across phases (`rem:graph:payload-custody-phases`):** the content
commitment (*witness*) is invariant across phases; only carriage migrates.
Centralized: Layer 1 tracks payload and private value. Decentralized:
Layer 1 tracks only the witness; payload and private value are a terminal
carriage obligation.

**Payload envelope convention (L2).** The opaque payload MAY carry a structured
Layer-2 **content-envelope** — a deterministic-CBOR convention; the Peer Content
Envelope is the reference format. L1 never inspects it: the envelope's
serialized-length bound `max_payload_bytes` **is** $M_{\text{payload}}$
(`def:graph:payload-carriage`), and no envelope field enters any closure
formula. Two seam facts hold regardless of the envelope's internal format:

- **Type is not in the payload.** Node type is fixed by the authoring L1 edge,
  never an envelope field (declarative identity, §7.2 / §8.1); every envelope
  has the same shape across types.
- **Conformance is an L2 admission gate, never an L1 signal.** Envelope
  well-formedness is a binary guild-admission test; it MUST NOT become a reward
  weight or scoring input. A non-conforming payload still holds a valid,
  irrevocable, scored, standing-accruing L1 edge
  (`prop:graph:payload-state-invariance`,
  `rem:graph:payload-size-not-action-cost`) — it is simply invisible in
  enforcing guilds.

A revision is new bytes / a new record, never in-place mutation. The envelope's
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

### 8.4 The stored sentiment slice

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
record's own parameters — **stored slices stay per-record**. Aggregation of
same-author bundles (net stance) happens only in the endorsement-flow
projection: see §11.3. Structural bounds: the baseline entry
$\Psi_e^{22} = \psi_+(1) > 0$ never vanishes
(`lem:graph:non-vanishing-norm`);
$\lVert\boldsymbol{\Psi}_e\rVert_F \le 3$ (`lem:graph:frobenius-bound`);
polarization floor $\Psi_e^{11} \ge \tfrac12$
(`prop:graph:polarization-floor`).

### 8.5 The closure interface

**(`def:graph:dual-view-architecture`, closure form.)** Every edge stores
$\boldsymbol{\Psi}_e$ and exposes exactly the closure path-view interface:

- the stored $3 \times 3$ slice $\boldsymbol{\Psi}_e$;
- the $2 \times 2$ path-view matrix $\boldsymbol{\Psi}_e^{[P]}$;
- the determinant magnitude $|\det \boldsymbol{\Psi}_e^{[P]}|^{1/2}$;
- the determinant sign $\epsilon(e)$.

The specified closure consumer of the resulting damped weight
$\tilde{w}(e)$ is the double-cover endorsement-flow BFS — **one formula, one
closure consumer** (`rem:epoch:shared-edge-primitive`). Terminal reads of
the stored $3 \times 3$ record (the full paper's Scalar and Attribution
Views, feed terminus norms, CAN base values) are named only in the boundary
ledger; terminal read-sites may read the same published values by ledger
permission.

### 8.6 Path view, tiers, parity, and the damped weight

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
actor-directed legs (the Vouch Predicate, §11.3). Coherent condemnation is a
strong coherent signal, but not a vouch. Normative: (1) $\epsilon(e)$ is a
coherence bit, never a favor bit; (2) indifference is zero magnitude, not a
sign; (3) stance survives in the stored slice's marginal row and terminal
stance read-sites; it is never substituted for path parity.

Determinant magnitude per tier (`prop:graph:path-view-determinant-bound`):

| Tier | $\sqrt{\lvert\det(\boldsymbol{\Psi}^{[P]})\rvert}$ | Edge types |
|---|---|---|
| Full | $\approx 0.27$–$0.36$ | Opinion, Review L1, Reference L2, Self, Owner, Participant, Send L1 |
| Half | $\approx 0.20$–$0.22$ | Bid, Accept, Ratify, Join Request, Invitation L1 |
| Marginal | $\approx 0.07$–$0.08$ | Tag, Affinity, Review L2, Reference L1, Send L2, Invitation L2, control legs |

Self/Reputation is Full but standing-dependent
($\lvert\det\rvert^{1/2} \to 0$ as $\alpha \to 0$); supremum tracked by
$\tilde{w}_{\max}$.

**Damped edge weight (`def:epoch:damped-edge-weight`,
`eq:epoch:damped-edge-weight`):**

$$\tilde{w}(e) = \underbrace{|\det \boldsymbol{\Psi}^{[P]}_e|^{1/2}}_{\text{coherence}} \cdot \underbrace{\sqrt{1 + \tau_e^2}}_{\text{maturity}} \cdot \underbrace{e^{-\beta H_\tau(e)}}_{\text{boundary}}$$

Bounds (`prop:epoch:damped-weight-bounds`, for every **non-inert** edge):
$\tilde{w}(e) > 0$;
$\tilde{w}(e) \le |\det \boldsymbol{\Psi}^{[P]}_e|^{1/2} \cdot \sqrt{2}$;
non-monotone in $\tau$ with minimum near $\tau \approx 0.5$. Maturity
crossover: $g(\tau) = \sqrt{1+\tau^2}\, e^{-\beta H_\tau} > 1$ iff
$\tau > \tau^* \approx 0.94$ (`def:epoch:maturity-crossover`,
`prop:epoch:crossover-location`).

### 8.7 Interaction domains and masks

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
Request, Invitation L1. Such edges carry genuine directional stance and
retain a full stored block; the Half-tier floor applies only in the path
view and preserves determinant sign exactly.

### 8.8 Derived path quantities consumed by the closure

- **Path matrix (`def:graph:path-matrix`):** for a directed path
  $p = (e_1, \dots, e_d)$ respecting causal order
  ($\mathbb{T}_{e_i} \le \mathbb{T}_{e_{i+1}}$):
  $P(p) = \boldsymbol{\Psi}_{e_1}^{[P]} \cdots \boldsymbol{\Psi}_{e_d}^{[P]}$.
- **Determinant product (`thm:graph:determinant-product`):**
  $\det(P(p)) = \prod_{e\in p} \det(\boldsymbol{\Psi}_e^{[P]})$.
- **Path parity (`cor:graph:path-parity-sign`):**
  $\epsilon(p) = \prod_{e\in p} \epsilon(e) = \mathrm{sgn}(\det(P(p)))$.
- **Half-score factorization (`def:graph:svd-path-score`,
  `eq:graph:half-score`):** at $q = \tfrac12$ the path score is
  $\prod_{e\in p} \big(|\det \boldsymbol{\Psi}_e^{[P]}|^{1/2}\sqrt{1+\tau_e^2}\, e^{-\beta H_\tau(e)}\big) = \prod_{e\in p}\tilde{w}(e)$
  (Dijkstra-compatible), consumed by the double-cover endorsement-flow BFS.
  $q$ is fixed at $\tfrac12$ for Layer-1 closure traversal.
- **Hyper-edge reduction (`thm:graph:hyper-edge-reduction`):** any
  hyper-edge $\mathcal{H} = (a, p, h)$ decomposes into binary legs
  $e_{ap}, e_{ph}$ with multiplying path-view determinants and signs:
  $\epsilon(\mathcal{H}) = \epsilon(e_{ap}) \cdot \epsilon(e_{ph})$. The
  closure traversal never consumes an opaque hyper-edge object; it consumes
  the legs.
- **Linearization invariance (`lem:graph:linearization-invariance`):**
  fixing $E_k$ and the published constants, $\mathbb{T}_e$, $\tau_e$,
  $\epsilon(e)$, $\tilde{w}(e)$, every path parity, $\prod\tilde{w}(e)$, and
  $W_{\text{end}}(j \to i)$ are functions of $(E_k, \prec)$ alone —
  invariant under every total order consistent with $\prec$; none references
  $\mathrm{pos}(e)$.

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

1. Every edge carries a local time integer $\mathbb{T}_e$ and maturity
   scalar $\tau_e$.
2. Every edge's stored sentiment is a $3\times3$ extended slice
   $\boldsymbol{\Psi}_e$ constructed via the canonical pipeline.
3. Every edge exposes the closure path-view interface
   $\boldsymbol{\Psi}_e^{[P]}$, its determinant magnitude, and its
   determinant sign.
4. Every hyper-edge decomposes into two binary legs whose path-view
   determinants and determinant signs multiply.
5. Boundary damping $e^{-\beta H_\tau}$ is applied at observation, not to
   stored tensors.
6. Every edge carries a separable payload commitment; payload bytes and
   payload state enter no Layer-1 closure formula.

**Canonical Tensor Pipeline (`post:nodes:canonical-tensor-pipeline`).** For
every edge (binary or hyper-edge leg): (1) role assignment — domain
parameters assigned to directional ($p_d$) and intensity ($p_i$) roles;
single-parameter edges set the missing role to 1; (2) extended slice via the
master formula with the domain's bilinear mask; (3) path-view extraction
with $\eta$-softening; (4) temporal attributes — $\mathbb{T}_e$, $\tau_e$,
$H_\tau(e)$ computed from causal structure; (5) closure extraction —
per-edge $|\det \boldsymbol{\Psi}_e^{[P]}|^{1/2}$, $\epsilon(e)$,
$\tilde{w}(e)$. Single-parameter row collapse (Owner, Publish, Send L1) is a
census property, not an incentive surface (`rem:nodes:row-collapse`).

### 9.2 Affordance traits (`tbl:nodes:affordance-traits`)

| Trait | Description | Implemented by |
|---|---|---|
| Taggable | Target of a Tag hyper-edge | Profile, Content, Item, Type, Chat, Comment, Message |
| Reviewable | Target of a Review hyper-edge; sources the author-fixed Review L2 leg to the created Comment | **All passive types**: Profile, Content, Item, Type, Chat, Comment, Message, Offer |
| Ownable | Target of Owner and Bid edges | Item |
| Conversational | Target of Join Request and Leave edges; middle node of Invitation, De-invite, and Send hyper-edges | Chat |

Offer is the sole non-Taggable passive type: a settlement artifact does not
belong in the semantic taxonomy. Target validity: Opinion → any passive;
Affinity → Type; Tag → Taggable; Review → Reviewable; Owner/Bid → Ownable;
Join Request, Invitation L1, Send L1, Leave, De-invite L1, Participant →
Chat; Withdraw/Rescind → Offer; Invitation L2 → invitee's Profile;
De-invite L2 → de-invitee's Profile. Reference is trait-independent on both
ends: its A-leg sources from any passive citing artifact, and its T-leg
targets any existing passive node, including a Profile, never an Actor
(`rem:nodes:reference-target-class`).

**Reviews are commentary, never state (`rem:graph:reviews-commentary`).**
Every passive node type implements Reviewable: anything that exists in the
graph admits attributed public commentary. A Review transitions no
settlement state, moves no title, binds no tag, creates no membership, and
enters no admission quantity. Universal Reviewability is **standing-inert**:
Review legs terminate at Comments, and every onward exit targets a Type or
Comment, never a Profile or Actor — no Review path terminates at an Actor
through the unique Reputation funnel, so $W_{\text{end}}$ and $\alpha_i$ are
unchanged by the mere existence of commentary.

### 9.3 Node types

Every node is an identifier in the algebra (§8.1); its **class** is its
outermost constructor, and a genesis/anchoring record fixes it:

| Node | Class | Constructor | Anchored by |
|---|---|---|---|
| Actor, Profile | grounded | $\mathsf{addr}(a)$, $\mathsf{prof}(a)$ | **Registration** |
| Type | named | $\mathsf{name}(s)$ (byte equality; a commons) | vacuous |
| Content | minted | $\mathsf{key}(\cdot)$ | **Publish** |
| Item | minted | $\mathsf{key}(\cdot)$ | genesis Owner |
| Chat, Comment, Message, Offer | minted | $\mathsf{key}(\cdot)$ | its creating hyper-edge / record |

**Actor** (active, $V_u$; `node:nodes:actor`) — sole active node type.
Originates all edges, injects all temporality primitives; the only nodes
eligible to appear as endpoints of endorsement flow. In: Self Rep. (from
Profile, derived), Accept, Ratify (from Actors). Out: Registration → Profile
(self-introduction), Publish → Content (genesis), and edges to all passive
leaf types; Join Request, Invitation L1, Leave, De-invite L1 → Chat;
Accept/Ratify → Actor; Withdraw/Rescind → Offer. A new actor with $B_i = 0$
has $r_i = 0$, $\alpha_i = 0$, and a degenerate (inert) Self-edge bond;
standing is ignition-then-amplification — endorsement cannot reach a
zero-burn actor as standing (`rem:nodes:commitment-ignition`, §7.1).

Reference incidence is universal and omitted from the per-node lists below:
every passive node admits Reference L1 (from an Actor, when the node serves as
the citing artifact) and Reference L2 (as the target of any passive artifact)
in-edges, and sources an author-fixed Reference L2 leg toward any passive
target (§9.6, `lem:graph:passive-out-degree`).

Passive leaf nodes (`subsec:nodes:leaf-passive-nodes`):

- **Profile** (`node:nodes:profile`) — passive identity anchor $\mathsf{prof}(a)$,
  anchored by its Registration record and uniquely bound to one Actor via the
  Self-edge bond. Taggable, Reviewable. In: **Registration**, Self (Dec.),
  Opinion, Tag L1, Review L1, **Invitation L2, De-invite L2** (from Chats).
  Out: Self (Rep.) → Actor (derived), Tag L2 → Type, Review L2 → Comment. Profile-targeted actor-directed records are filtered
  by the Vouch Predicate before they can carry source rate into standing.
- **Content** (`node:nodes:content`) — primary digital artifact, minted
  $\mathsf{key}(\cdot)$. Taggable, Reviewable. In: **Publish (genesis, fixes
  $\mathrm{creator}$)**, Opinion, Tag L1, Review L1. Out: Tag L2 → Type,
  Review L2 → Comment. (The closure edition specifies no terminal
  content-ranking mechanism.)
- **Item** (`node:nodes:item`) — ownable entity. Taggable, Reviewable,
  Ownable. In: Owner, Opinion, Tag L1, Review L1, Bid L1. Out: Tag L2,
  Review L2, Bid L2 → Offer. Closure role: genesis and title
  (`def:graph:item-genesis`, `def:graph:title-certificate`).
- **Type** (`node:nodes:type`) — semantic anchor / concept. Taggable,
  Reviewable. In: Affinity, Opinion, Tag L1, Tag L2 (from passives),
  Review L1. Out: Tag L2 → Type, Review L2 → Comment. Reviews of a Type do
  not change Type semantics, tags, standing, title, or gates.
- **Chat** (`node:nodes:chat`) — conversation container. Conversational,
  Taggable, Reviewable. In: Participant, Opinion, **Join Request, Leave**,
  Send L1, Tag L1, Review L1, **Invitation L1, De-invite L1**. Out:
  **Invitation L2 → Profile, De-invite L2 → Profile**, Send L2 → Message,
  Tag L2 → Type, Review L2 → Comment. Closure role: Participant is a
  promoted Full-tier enacted relation; Join Request and Invitation are
  proposals, not participation; Leave and De-invite are control records.
  **Membership is not a Layer-1 admission predicate; it is a terminal fold**
  (§9.8).

Hyper-leaf passive nodes (`subsec:nodes:hyper-leaf-passive-nodes`):

- **Comment** (`node:nodes:comment`) — contextual annotation via Review
  hyper-edge. Taggable, Reviewable. In: Review L2 (from passive), Opinion,
  Tag L1, Review L1. Out: Tag L2 → Type, Review L2 → Comment. Nested Comment
  Reviews are a causal chain of new records, depth bounded by $L$ and
  Marginal compounding (`rem:nodes:nested-comment-review`).
- **Message** (`node:nodes:message`) — communicative act within a Chat via
  Send hyper-edge. Taggable, Reviewable. In: Send L2 (from Chat), Opinion,
  Tag L1, Review L1. Out: Tag L2 → Type, Review L2 → Comment. A Send
  responds inside the channel; a Review annotates the utterance from outside
  it.
- **Offer** (`node:nodes:offer`) — passive proposal artifact via Bid
  hyper-edge. Reviewable; no other affordance traits. In: Bid L2 (from
  Item), Opinion, Review L1, Withdraw (buyer), Rescind (seller). Out:
  Review L2 → Comment — its sole out-edges. Settlement Accept and Ratify
  reference the Offer via settles-pointers but are **not incident** to it.

### 9.4 The Self-edge bond (`subsec:nodes:self-edge-bond-properties`)

Both components share intensity $p = \alpha_j/(\nu + \alpha_j)$,
$p_d = 1$; Identity domain, mask $(1,0,0,1)$, Full tier. Stored tensor and
path view (softened mask $(1,\eta,\eta,1)$):

$$\boldsymbol{\Psi} = \begin{pmatrix} \psi_\pm(p) & 0 & \psi_\pm(p) \\ 0 & \psi_+(p) & \psi_+(p) \\ \psi_\pm(1) & \psi_+(1) & \psi_+(1) \end{pmatrix}, \qquad \boldsymbol{\Psi}^{[P]} = \begin{pmatrix} \psi_\pm(p) & \eta\,\psi_\pm(p) \\ \eta\,\psi_\pm(p) & \psi_+(p) \end{pmatrix}$$

$$|\det \boldsymbol{\Psi}^{[P]}|^{1/2} = \sigma_{\text{sig}}(\beta p)\sqrt{\tanh(p)\big(1 - \eta^2 \tanh(p)\big)}, \qquad \epsilon(e_{\text{Dec}}) = \epsilon(e_{\text{Rep}}) = +1 \ \forall\, \alpha_j > 0$$

At $\alpha_j = 0$: $p = 0$, $\tilde{w}(e) = 0$ — the bond is inert. Both
components are derived certificate recomputations, excluded from the record
set, bundles, action counts, and the payload census
(`edge:nodes:self-reputation`).

- **Declaration** (Actor → Profile): **derived** — recomputed from the epoch
  certificate each boundary, never appended
  (`post:epoch:self-edge-bond-derivation`); binds Actor to Profile in
  traversal. Actor-sourced, so not a passive-sourced edge.
- **Reputation** (Profile → Actor): **derived** passive-sourced edge —
  recomputed from the certificate, never appended
  (`post:epoch:self-edge-bond-derivation`); terminal edge of the canonical
  2-hop endorsement-flow path; $\tilde{w}(e_{\text{Rep}})$ is determined by
  the *target* actor's $\alpha$, not the endorser's; vouch-positive by
  construction when the standing-derived parameter is positive. **Tenure
  channel:** boundary derivation ratchets $\tau_{e_{\text{Rep}}} \to 1^-$ (the
  published tenure schedule); a mature bond can outweigh a first-epoch bond at
  equal standing but stays under $\tilde{w}_{\max}$ and cannot restore a
  failed gate by itself (`rem:epoch:tau-channel-frozen`).

**Bond properties (`prop:nodes:self-edge-bond-properties`):** zero at zero;
strictly monotone increasing in $\alpha_j$; $\tilde{w}(e_{\text{Rep}}) < 1$
always; concave; positive parity; both components synchronized at every
epoch boundary; feed-through hierarchy (profile-bridged influence always
weaker than direct); tenure ceiling at frozen $p$:
$\sup_\tau \tilde{w}(e_{\text{Rep}})(p_0;\tau) = |\det \boldsymbol{\Psi}^{[P]}(p_0)|^{1/2}\sqrt{2} < 1$.
Self-loop paths Actor→Profile→Actor produce no register update in the BFS
(`prop:nodes:self-loop-neutral`).

**Profile-bridged discovery prefix
(`def:nodes:profile-bridged-discovery-path`):**
$\text{Actor}_i \xrightarrow{\text{Op}} \text{Profile}_j \xrightarrow{\text{Rep}} \text{Actor}_j$.
**Commitment amplification product
(`def:nodes:commitment-amplification-product`):**
$A(\alpha_j) = \tilde{w}(e_{\text{Rep}})(\alpha_j)\cdot(1 + \alpha_j)$,
strictly increasing, $A(0) = 0$ (terminal read-sites of $(1+\alpha_j)$ live
in the boundary ledger).

### 9.5 Binary edge types (`subsec:nodes:binary-edges`)

| Edge | Src → Tgt | Domain | Mask (stored) | Tier | Params (roles) | Notes |
|---|---|---|---|---|---|---|
| **Registration** | Actor → Profile | Identity | $(1,0,0,1)$ | Full | $p_d = p_i = 1$ (fixed); $\epsilon = +1$ forced | actor's self-introduction and the **anchoring record** of the grounded pair (Actor, Profile) — no identity key formed; the sole family carrying fresh grounded endpoints; root of the author's Lamport chain; parallel Registrations update payload only, never the identity (`edge:nodes:registration`, `def:graph:registration`) |
| **Publish** | Actor → Content | Economic | $(1,1,1,1)$ ↑promoted | Full | attachment $a \in [-1,1]$ ($p_d = a$, $p_i = 1$) | **genesis record of a Content node**, fixing $\mathrm{creator}$; mirrors Owner (row-collapse); license qualifiers are structural metadata of this record (`edge:nodes:publish`) |
| Opinion | Actor → passive | Tribal | $(1,1,1,1)$ | Full | polarity $p$, reaction $r$ ($p_d = p$, $p_i = r$) | the archetypal edge; on a Profile it is actor-directed and subject to the Vouch Predicate |
| Affinity | Actor → Type | Epistemic | $(0,1,0,1)$ | Marginal | association $a$, attraction $t$ ($p_d = a$, $p_i = t$) | relevance, not verdict; its sign is coherence, not a standing vouch |
| Participant | Actor → Chat | Relational | $(1,1,1,1)$ ↑promoted | Full | interactivity $i$, responsibility $r$ ($p_d = i$, $p_i = r$) | the actor's own membership signal for the terminal membership fold (§9.8) |
| Owner | Actor → Item | Economic | $(1,1,1,1)$ ↑promoted | Full | attachment $a \in [-1,1]$ ($p_d = a$, $p_i = 1$) | at $a = 0$ anchors the title thread but is routing-inert — title is sentiment-blind; orphaned Owner edges persist without title force |
| **Join Request** | Actor → Chat | Relational | $(1,1,1,1)$ ↑promoted | **Half** | urgency $u \in [-1,1]$, formality $f \in [-1,1]$ ($p_d = u$, $p_i = f$) | a proposal, not participation: creates no membership, alters no Chat state (`edge:nodes:join-request`) |
| Accept | Actor(seller) → Actor(buyer) | Relational | $(1,1,1,1)$ ↑promoted | **Half** | comfort $c$, equity $e$ ($p_d = c$, $p_i = e$) | settles-pointer → Bid; not binding — title moves only at Ratify; actor-directed: only stance-positive Accepts enter the endorsement-flow projection |
| Ratify | Actor(buyer) → Actor(seller) | Relational | $(1,1,1,1)$ ↑promoted | **Half** | final comfort $c$, final equity $e$ | settles-pointer must match the Accept's; the irreversible commit record; same Vouch-Predicate endorsement role |
| Withdraw | Actor(buyer) → Offer | Minimal | $(0,0,0,1)$ | Marginal | $p_d = p_i = 1$ fixed; $\epsilon = +1$ forced | control record — never vouches, excluded from the endorsement-flow projection |
| Rescind | Actor(seller) → Offer | Minimal | $(0,0,0,1)$ | Marginal | $p_d = p_i = 1$ fixed; $\epsilon = +1$ forced | seller's sole escape from a non-binding Accept before commit; control record |
| **Leave** | Actor → Chat | Minimal | $(0,0,0,1)$ | Marginal | type-fixed $p_d = p_i = 1$; $\epsilon = +1$ forced | unilateral departure/dissociation declaration; **unconditional** (no membership precondition — a Leave from a never-member is a valid public record); no effect on standing, endorsement flow, title, settlement, or gates; exit record of the terminal membership fold (`edge:nodes:leave`, `subsec:necessity:unrestricted-departure`) |

Sentiment about a departure composes through Opinion (on the Chat or the
Profile), never through the control record: a rage-quit is Leave plus a
negative Opinion (`rem:nodes:departure-composes-with-opinion`).

### 9.6 Hyper-edge types (`subsec:nodes:hyper-edges`)

Every hyper-edge decomposes into two binary legs; legs are independently
assigned domain and mask and may occupy different tiers;
$\epsilon(\mathcal{H}) = \epsilon(e_1)\cdot\epsilon(e_2)$. The leg indices
**L1 / L2** below are the source's **A-leg** (Actor → Passive) and **T-leg**
(Passive → terminal target) respectively (`edge:nodes:hyper-*`); L1/L2 name
leg position, never Layer 1 / Layer 2.

| Hyper-edge | Legs | Leg domains (masks, tiers) | Params (roles L1 / L2) |
|---|---|---|---|
| Tag | Actor → Passive → Type | Epistemic $(0,1,0,1)$ M / Epistemic $(0,1,0,1)$ M | relevance $r \in [-1,1]$, confidence $c \in [0,1]$; L1: $p_d = r, p_i = c$; L2: $p_d = c, p_i = r$ |
| Review | Actor → Passive → Comment | Tribal $(1,1,1,1)$ F / Epistemic $(0,1,0,1)$ M | enthusiasm $e$, effort $f$; L1: $p_d = e, p_i = f$; L2: $p_d = f, p_i = e$. Commentary, never state; standing-inert as a family |
| Bid | Actor → Item → Offer | Economic ↑promoted, both legs **Half** | signed generosity $g \in [-1,1]$, urgency $u \in [0,1]$; L1: $p_d = g, p_i = u$; L2: $p_d = u, p_i = g$. Both legs carry $\epsilon = \mathrm{sgn}(g)$, so composed parity is $+1$: a predatory Bid is parity-visible per leg, parity-neutral as a composition; the buyer's stance is read by stance consumers (`cor:nodes:bid-leg-parity`) |
| **Invitation** | Actor → Chat → Profile(invitee) | Relational $(1,1,1,1)$ ↑ **Half** / Epistemic $(0,1,0,1)$ M | urgency $u \in [-1,1]$, formality $f \in [-1,1]$, relevance $r \in [0,1]$; L1: $p_d = u, p_i = f$; L2: $p_d = r, p_i = 1$ (forced $+1$ for $r > 0$). A public, priced, authored vouch that the invitee fits the community; a proposal, not participation. The terminal leg targets the invitee's **Profile**, never the Actor — influence reaches the invitee only through their standing-dependent Reputation component (zero at zero standing). Revocable per author (§9.8) (`edge:nodes:hyper-invitation`, `subsec:necessity:invitation-profile-terminus`) |
| **De-invite** | Actor → Chat → Profile(de-invitee) | Minimal $(0,0,0,1)$ M / Minimal $(0,0,0,1)$ M | none — both legs type-fixed $p_d = p_i = 1$, $\epsilon = +1$ forced | declaration that another actor should not be (or no longer be) part of a Chat; a **control record** — its force is terminal policy, never a Layer-1 validity predicate. **Unconditional**: the author need not be a member, inviter, or authority; the target need not be a member. Both legs excluded from the endorsement-flow projection — a De-invite never vouches for its target. Sole closure-visible effect: per-author suppression of the author's own Invitation bundle toward the same (Chat, Profile) incidence (`edge:nodes:hyper-deinvite`, `subsec:necessity:deinvite-profile-terminus`) |
| Send | Actor → Chat → Message | Relational $(1,1,1,1)$ ↑ F / Minimal $(0,0,0,1)$ M | importance $i \in [-1,1]$; L1: $p_d = i, p_i = 1$; L2: $p_d = 1, p_i = i$. **Renamed from "Write"** (`edge:nodes:hyper-send`): *write* is now the protocol act (§8.1); a Send is carried into the graph by a write, it is not one. **Not membership-gated**: a Layer-1 membership precondition would drag membership into the admission closure (`rem:nodes:membership-is-terminal`) |
| Reference | Actor → Passive(artifact) → Passive(target) | Epistemic $(0,1,0,1)$ M / Tribal $(1,1,1,1)$ F | enthusiasm $e \in [-1,1]$, effort $f \in [-1,1]$; L1: $p_d = f, p_i = e$; L2: $p_d = e, p_i = f$. Review with its legs transposed; **mints nothing** — both endpoints of the T-leg are pre-existing nodes: the citing artifact is any passive node, the target any passive node including a Profile, never an Actor. The strong Tribal leg carries the citation itself; the weak Epistemic leg carries authorship. Commentary, never state (`rem:graph:reviews-commentary`); census sibling is Tag. Target class switches the semantics: a non-grounded target makes it parity-only and standing-inert, exactly like Tag; a Profile target makes the T-leg actor-directed and subject to the Vouch Predicate by type — a positive, effortful citation of a person is a weak, priced, authored vouch (§11.4); withdrawal is per-leg net stance (`edge:nodes:hyper-reference`, `rem:nodes:reference-target-class`) |

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
| Self (Dec.) | Identity | — | • | ∘ | ∘ | • | F | $+1$ |
| Self (Rep.) | Identity | — | • | ∘ | ∘ | • | F | $+1$ |
| Registration | Identity | — | • | ∘ | ∘ | • | F | $+1$ |
| Opinion | Tribal | — | • | • | • | • | F | $\pm 1$ |
| Affinity | Epistemic | — | ∘ | • | ∘ | • | M | $\pm 1$ |
| Participant | Relational | ↑ | • | • | • | • | F | $\pm 1$ |
| Owner | Economic | ↑ | • | • | • | • | F | $\pm 1$ |
| Publish | Economic | ↑ | • | • | • | • | F | $\pm 1$ |
| Join Request | Relational | ↑ | • | • | • | • | H | $\pm 1$ |
| Invitation L1 | Relational | ↑ | • | • | • | • | H | $\pm 1$ |
| Invitation L2 | Epistemic | — | ∘ | • | ∘ | • | M | $+1$ |
| Tag L1 | Epistemic | — | ∘ | • | ∘ | • | M | $\pm 1$ |
| Tag L2 | Epistemic | — | ∘ | • | ∘ | • | M | $\pm 1$ |
| Review L1 | Tribal | — | • | • | • | • | F | $\pm 1$ |
| Review L2 | Epistemic | — | ∘ | • | ∘ | • | M | $\pm 1$ |
| Reference L1 | Epistemic | — | ∘ | • | ∘ | • | M | $\pm 1$ |
| Reference L2 | Tribal | — | • | • | • | • | F | $\pm 1$ |
| Bid L1/L2 | Economic | ↑ | • | • | • | • | H | $\pm 1$ |
| Send L1 | Relational | ↑ | • | • | • | • | F | $\pm 1$ |
| Send L2 | Minimal | — | ∘ | ∘ | ∘ | • | M | $\pm 1$ |
| Accept | Relational | ↑ | • | • | • | • | H | $\pm 1$ |
| Ratify | Relational | ↑ | • | • | • | • | H | $\pm 1$ |
| Withdraw | Minimal | — | ∘ | ∘ | ∘ | • | M | $+1$ |
| Rescind | Minimal | — | ∘ | ∘ | ∘ | • | M | $+1$ |
| Leave | Minimal | — | ∘ | ∘ | ∘ | • | M | $+1$ |
| De-invite L1/L2 | Minimal | — | ∘ | ∘ | ∘ | • | M | $+1$ |

Forced $+1$: Self Dec/Rep and Registration ($p_d = 1$, $p_i > 0$ by
construction); Withdraw, Rescind, Leave, De-invite L1/L2 (type-fixed control
records);
Invitation L2 (relevance $r \in [0,1]$, intensity 1). All other types
contain at least one signed user-controlled parameter.

**Coherence column, not vouch column:** $\epsilon$ is routing/coherence
parity only; vouching is decided by the Vouch Predicate reading stance
marginals — a $(-,-)$ Profile Opinion has $\epsilon = +1$ but does not enter
endorsement flow.

**Dispatch rule.** Leg identity is (family, leg-role), never tensor geometry:
Reference L1 and Review L2, and Reference L2 and Review L1, are geometric
twins by construction (the transpose); the normative census determines family
and role (`rem:nodes:edge-census-normative`).

**Payload census (`tbl:nodes:payload-census`):** every edge family has a
payload controller and a canonical payload (e.g. Opinion/Affinity: author /
rationale; Participant: author / participation note; Join Request: author /
request message; Invitation L1/L2: initiating actor / invitation message +
canonical empty; Accept/Ratify: author / terms, receipt; Leave: author /
parting reason; De-invite L1/L2: initiating actor / reason + canonical
empty; Review L1/L2: initiating actor / reviewer metadata + comment body;
Reference L1/L2: initiating actor / reference note + canonical empty;
Bid L1/L2: initiating actor / bid terms + offer body; Send L1/L2:
initiating actor / metadata + message body; Self Dec/Rep: **— / no payload
projection** — the derived components are excluded from the census).

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
admission closure and enlarge the binding surface beyond
{kernel, rules, α-as-gate, title}
(`subsec:necessity:unrestricted-departure` — "who may expel" is a terminal
policy verdict).

**Inviter Revocation (`def:epoch:inviter-revocation`).** Author $j$'s
Invitation bundle toward incidence (Chat $C$, Profile $P$) is **suppressed**
in the endorsement-flow projection iff the $\prec$-maximal element of $j$'s
own {Invitation, De-invite} records with that incidence is a De-invite; a
later Invitation re-establishes it. Suppression is strictly per-author — it
never affects another author's invitation — and is a predicate, not a
parameter contribution. No control edge enters any stance sum. "Conviction
sums; consent toggles."

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
creating actor when the node enters the graph, immutable thereafter;
published as part of the self-sufficient record and independently
verifiable. **No Layer 1 formula consumes $l_{ij}$; enforcement is a Layer 2
guild responsibility** (`subsec:content:licensing`), published per the
formula-completeness invariant (App. I, `subsec:deployment:completeness`). A
high $l_{ij}$ can still act indirectly: it lowers adoption, hence betweenness
centrality $S_C$, hence a creator's guild reward $R_C$ — partially offsetting
the standing amplifier $A_C$ (`rem:content:license-guild-interaction`, a
terminal reward-economics consequence, not a Layer-1 formula).

**Provenance / AI oversight** (`subsec:content:provenance`): $o = 0$ no AI disclosure
required; $o = 0.5$ conditional disclosure (declared when queried); $o = 1$
full provenance (complete generation chain published alongside the record).
The spec records the qualifier but does not formalize the provenance chain
itself.

**Content-level metadata** (`subsec:content:metadata`): media type, format identifiers,
language tags, display metadata — carried on the record for rendering and
policy enforcement, consumed by no scoring or attribution formula.

**Payload governance across phases** (`rem:content:payload-governance-phases`):
every edge carries a payload; a centralized-phase host may impose payload
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
closure observation boundary (via $\tilde{w}(e)$); the sole specified
consumer is the double-cover endorsement-flow BFS.
$\beta = 2\ln 2 \approx 1.386$; maximum-entropy edges damp to $\approx 38\%$
of raw weight.

### 11.2 Commitment rate

$r_i = b_i/\max(N_i, 1)$ (`def:comparator:rate`, `eq:comparator:rate`), the
neutral source and unique exogenous input to the standing recursion. Its
numerator is the **residual balance**
$b_i = B_i - \sum_a \theta^{(k_a)}$ (`def:comparator:residual-balance`,
`eq:comparator:residual-balance`): the imported frame net of the consummated
per-action $\theta$-debits, summed over actor $i$'s accepted acts $a$, each
debited at its writing-epoch price $\theta^{(k_a)}$ and never re-calibrated
(the debit schedule is the sole vintage object). $b_i$ replaces the retired
excess-burn diagnostic $B_i - N_i\nu$ — the source now reads the $\theta$-debit
ledger, not the gross frame. $r_i \ge 0$, $=0$ iff $b_i = 0$; decreasing under
action ($\theta$ off the numerator, $+1$ on the denominator), non-decreasing
in $B_i$. Published per-actor scalars; derivable from the public attestation
record, the committed action count, and the published $\theta$-debit schedule
without graph traversal. The frame is verified by
recompute-and-verify-provenance, never scan-and-total
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

### 11.3 Stance aggregation and the Vouch Predicate

**Net Stance (`def:epoch:net-stance`).** For author
$j$, target node $v$, and edge type $t$, the **bundle** is the parallel
bundle $\Pi(j, v, t)$ (`def:graph:parallel-bundle`) — full-incidence keys,
hyper-edge legs netted per-leg. The bundle's net stance is

$$\bar{p}_d^{(j \to v)} = \mathrm{clip}_{[-1,1]}\Big(\sum_e p_d(e)\Big), \qquad \bar{p}_i^{(j \to v)} = \mathrm{clip}_{[-1,1]}\Big(\sum_e p_i(e)\Big).$$

Excluded from aggregation: **derived edges** (the Self-edge bond components —
not records, hence no bundle); the settlement handshake edges Bid, Accept,
Ratify (recognition reads individual records); the control edges Withdraw,
Rescind, Leave, De-invite.

The **endorsement-flow projection** of $E_k$ first replaces each eligible
same-author bundle by one effective edge with parameters
$(\bar{p}_d, \bar{p}_i)$ computed through the canonical tensor pipeline,
taking $(\mathbb{T}_e, \tau_e)$ — hence $H_\tau$ — from the bundle's
$\prec$-maximal (newest) member (well-defined: the bundle is a $\prec$-chain);
it then applies the Vouch Predicate to every actor-directed effective edge.
**The only specified consumer of the projection is the standing computation
through endorsement flow** — feed, reward, terminal attribution, and
terminal transport are not specified in the closure edition.

Aggregation properties (`prop:epoch:net-stance-properties`): order-free;
range-safe (the clip returns parameters to the master formula's domain);
vouch-gated; **priced** (every revision edge increments $N_j$, irrevocably
diluting $r_j$); append-only. Sum-then-clip is deliberate: walking back
accumulated conviction costs counter-edges in proportion to it — flip-flops
are expensive, stance is sticky (`rem:epoch:conviction-inertia`). A prior
$(0.5, 0.5)$ edge is cancelled by authoring $(-0.5, -0.5)$ toward the same
target: the bundle nets to $(0,0)$, $\epsilon$ undefined, $\tilde{w} = 0$ —
routing-inert in the projection — and the counter-edge consumed an action
(one $\theta$ debit off $b_j$): severance is burn-priced
(walkthrough under `subsec:verification:stance-aggregation`).

The aggregation key is per-author — cross-author netting is a rejected design
("one author's revision could erase another's vouch",
`subsec:necessity:per-author-netting`). The effective bundle edge's temporal
attributes are the newest member's (above) — the newest-record rule is fixed
in the spec, closing the last item that was open with the Peer Team.

**Vouch Predicate (`def:epoch:vouch-predicate`).** An edge record or
effective net bundle is
**actor-directed** when its target is a **grounded** node — outermost
identifier constructor $\mathsf{addr}$ or $\mathsf{prof}$
(`rem:graph:vouch-taxonomy`), a syntactic test so any future census row
targeting an Actor or Profile inherits the gate by construction. In the
current census these are Profile-targeted user edges and the direct
Actor-to-Actor handshake edges Accept and Ratify. A user-authored
actor-directed record with effective parameters $(p_d, p_i)$ **vouches** iff

$$p_d > 0 \quad\text{and}\quad p_i > 0.$$

For netted bundles, $(p_d, p_i) = (\bar{p}_d, \bar{p}_i)$; for non-netted
settlement records, the predicate reads the record's own parameters. The
derived Reputation component is vouch-positive by construction when
its standing-derived parameter is positive. **Control records never vouch**
and are excluded from the endorsement-flow projection outright, in every
quadrant (`rem:epoch:control-edges-never-vouch` — load-bearing for
De-invite L2, which targets a Profile with fixed positive parameters:
without the exclusion every expulsion would vacuously vouch for the
expellee).

Properties (`prop:epoch:vouch-gate-properties`): order-free;
boundary-continuous (at $p_d = 0$ or $p_i = 0$ the edge is already
routing-inert); the vouch-gated projection is a **subgraph** of the
parity-only projection (all standing hull bounds and contraction
certificates preserved or improved); record-preserving (non-vouching records
remain public, immutable, payload-removable, and readable by terminal
consumers — they simply carry no source rate into standing);
**one-quadrant correction** — mixed-sign actor-directed records were already
parity-blocked; the additional exclusion is coherent hostility $(-,-)$:
coherent for routing, not a vouch. The Vouch Predicate has no glyph: it is a
local predicate on published parameters, analogous to settlement
recognition. Coherence composes by determinant parity; stance gates
actor-directed endorsement.

### 11.4 Endorsement flow (double-cover BFS)

**Admissible Endorsement Path (`def:epoch:admissible-endorsement-path`).** A
path $p : j \to i$ is admissible iff (1) viable: consecutive edges respect
causal order $\mathbb{T}_{e_k} \leq \mathbb{T}_{e_{k+1}}$; (2) actor
endpoints: $j, i \in V_u$; (3) positive parity: $\epsilon(p) = +1$;
(4) **vouch gate: every actor-directed leg present in the endorsement-flow
projection satisfies the Vouch Predicate**; (5) bounded length:
$|p| \leq L$ (default $L = 4$). Positive parity is necessary but not
sufficient: coherence composes, stance gates.

**Endorsement Flow Weight (`def:epoch:endorsement-flow-weight`):**

$$W_{\mathrm{end}}(j \to i) = \max_{p \in \mathrm{AdmPaths}(j \to i, L)} \prod_{e \in p} \tilde{w}(e),$$

zero if no admissible endorsement path exists. Canonical two-edge form
(`def:epoch:canonical-endorsement-path`):
$\text{Actor}_j \xrightarrow{\text{Opinion}} \text{Profile}_i \xrightarrow{\text{Reputation}} \text{Actor}_i$
with $j$ holding a **vouch-positive** Opinion;
$W_{\mathrm{end}}(j \to i)^{(k)} = \tilde{w}(e_{\mathrm{Op}}) \cdot \tilde{w}(e_{\mathrm{Rep}, i})$.

A relevance-positive Invitation creates a weak conversational conduit
$j \to \text{Chat} \to \text{Profile}_b \to \text{Actor}_b$ — triply damped,
zero at zero invitee standing, suppressed by same-author De-invite
(`rem:epoch:invitation-conduit`). A relevance-positive Reference whose T-leg
targets a Profile opens the same class of weak, priced conduit
($\text{Actor}_j \to \text{Artifact} \to \text{Profile}_i \to \text{Actor}_i$)
through the target's Reputation bond, under identical damping — the Marginal
A-leg throttles it below a direct Opinion, the terminal Reputation hop is zero
at zero standing, and the path is hull-bounded. Its withdrawal channel is
per-leg net stance rather than revocation; multiple References to one Profile
do not stack (max-product), and self-reference is inert because the standing
sum excludes $j = i$ (`rem:nodes:reference-target-class`).

**Double Cover BFS State (`def:epoch:double-cover-bfs-state`).** Each node
$v$ carries $W^+(v)$ (max product over positive-parity paths from source
$j$) and $W^-(v)$ (same, negative parity). Init: $W^+(j) = 1$,
$W^-(j) = 0$, zeros elsewhere. **Prospective Contribution Bound
(`def:epoch:prospective-bound`):**
$\Phi(v, d) = (W^+(v) + W^-(v)) \cdot \tilde{w}_{\max}^{L-d}$; if
$\Phi(v,d) < \epsilon_{\mathrm{clip}}$ (default
$\tilde{w}_{\text{spam}}^L$) the node is clipped (both registers zeroed,
outgoing edges skipped, permanent within the BFS).

**Algorithm (`alg:epoch:double-cover-bfs`)** — runs on the **vouch-gated
endorsement-flow projection** $G$ (net-stance folding and Vouch-Predicate
filtering applied before traversal; the BFS itself processes every edge it
is given uniformly, `rem:epoch:vouch-gate-projection`):

```text
 1: Input: Source actor j, vouch-gated endorsement-flow projection G,
    depth bound L, published derived constants ε_clip, w̃_max
 2: W⁺(j) ← 1;  W⁻(j) ← 0
 3: W⁺(v) ← 0;  W⁻(v) ← 0;  Clipped(v) ← false for all v ≠ j
 4: for d = 1 to L do
 5:     for all edges v → w satisfying: W⁺(v) + W⁻(v) > 0,  Clipped(v) = false,
        causal-order viability do
 6:         if (W⁺(v) + W⁻(v)) · w̃_max^{L−d} < ε_clip then
 7:             W⁺(v) ← 0;  W⁻(v) ← 0;  Clipped(v) ← true;  continue
 8:         end if
 9:         w̃(e) ← |det Ψ[P]_e|^{1/2} · √(1 + τ_e²) · e^{−βH_τ(e)}
10:         ε(e) ← sgn(det(Ψ[P]_e))
11:         if ε(e) = +1 then
12:             W⁺(w) ← max(W⁺(w), W⁺(v) · w̃(e))
13:             W⁻(w) ← max(W⁻(w), W⁻(v) · w̃(e))
14:         else
15:             W⁺(w) ← max(W⁺(w), W⁻(v) · w̃(e))
16:             W⁻(w) ← max(W⁻(w), W⁺(v) · w̃(e))
17:         end if
18:     end for
19: end for
20: return W_end(j → i) = W⁺(i) for all i ∈ V_u ∖ {j}
```

Actor-to-actor structure is enforced by extracting $W^+(i)$ only for
$i \in V_u$. Spam griefing floor: a spam chain of depth $L$ contributes at
most $\tilde{w}_{\mathrm{spam}}^L \approx 1.5 \times 10^{-8}$.

### 11.5 Standing

**Standing $\alpha_i$ (`def:epoch:standing`, `eq:epoch:standing`)** — the
**weighted mediant** of post-debit $(\text{balance}, \text{count})$ pairs:

$$\alpha_i = \dfrac{b_i + \sum_{j \neq i} W_{\mathrm{end}}(j \to i) \cdot b_j}{\max(N_i, 1) + \sum_{j \neq i} W_{\mathrm{end}}(j \to i) \cdot N_j}$$

The actor's own pair enters with its own action mass $\max(N_i, 1)$; each
vouching endorser's pair enters with weight $W_{\mathrm{end}}(j \to i) \cdot
N_j$ (the endorser's action mass scaled by endorsement flow). A mediant lies
in the hull of its component ratios $r_j = b_j/N_j$. **Reduction theorem:** on
a uniform-activity population the mediant coincides exactly with the
rate-DeGroot average of earlier editions — every published numeric survives
the reduction. **Vouching is rival:** an endorser's action mass rides in every
denominator it enters, so $k$ beneficiaries split the endorser's rate rather
than clone it. Recomputed at each epoch boundary from the snapshot $E_k$ and
published in the epoch certificate; consumed downstream as a fixed external
scalar. Standing is the straddler: binding where the write rule reads it
(through the stamps $\rho_{\text{act}}/\rho_{\text{ep}}$), terminal where
downstream read-sites read it.

**Properties (`prop:epoch:standing-properties`)** (mediant properties): (1)
bidirectional — $\partial\alpha_i/\partial W_{\mathrm{end}}(j \to i)$ has sign
$\mathrm{sgn}(r_j - \alpha_i)$ (raising an endorser's weight moves standing
toward that endorser's ratio); (2) hull bound —
$\alpha_i \in [\min_j r_j, \max_j r_j]$ always; (3) neighbourhood
convergence — as mutual flow grows dense the actor's own pair becomes a
vanishing share and $\alpha_i \to \big(\sum_{j \neq i} b_j\big)/\big(\sum_{j
\neq i} N_j\big)$, the pooled leave-one-out burn-per-action of the vouching
peers (`rem:epoch:dense-cluster-fairness`).

**Dilution cost (`prop:epoch:dilution-cost`):** with
$r_i > \rho\nu$ and $n$ coordinated endorsers at arbitrary parked rate
$r_{\text{park}} \in [0, r_i)$ ($W_j \le \tilde{w}_{\max}$), reducing
$\alpha_i$ by $\epsilon$ requires
$n \geq \epsilon / \big(\tilde{w}_{\max}(r_i - r_{\text{park}} - \epsilon)\big)$.

**Rate parking (`rem:epoch:rate-parking`):** an actor whose action stamp
falls below the wall $\rho_\theta$ is participation-frozen and excluded by the
frozen-key rail; above the wall, each parked endorsement action still pays its
$\theta$. Parking is priced, visible, frozen out below the wall, and no longer
a certificate hazard (`rem:epoch:rate-parking`, `frontier:leverage-timing`).

Epoch-to-epoch, $\alpha_i$ evolves through the Self-edge bond fixed point;
the orbit converges to a unique fixed point $\alpha_i^*$ with generically
geometric rate (`thm:epoch:self-edge-convergence-summary`).

### 11.6 Epoch boundary, the write set, and bond derivation

**Epoch Closure Rule (`post:epoch:closure-rule`).** An epoch closes at the
earliest moment at which either the host determines the write set fills the
epoch **target** size $N_{\text{epoch}}$ and the published epoch minimum
duration has elapsed, or the published maximum duration has elapsed. At close
the host writes a **write set** $W_k$: a sequence of dependent sets (§8.1),
each valid at its position — (i) formation-valid, every member's author
clearing W1 and W2a individually; (ii) every member clearing the safety stamp
individually, $\rho_{\text{act}} \ge \rho_\theta$; (iii) the epoch door clears
W2b, $\rho_{\text{ep}} \ge \rho_{\text{eff}}$, over members not written by an
earlier set. $|W_k| \le N_{\text{epoch}}$. **Selection among valid write sets is host
discretion** (optimal packing is expensive; the spec fixes the constraints,
not the algorithm); the certificate publishes the dependent-set partition so
validity is replayable, and *which* valid $W_k$ was chosen is not a protocol
quantity — selection touches membership only. The epoch's **regime** is
certificate-derived: *binding* iff $|W_k| = N_{\text{epoch}}$, *slack*
otherwise.

**Epoch Certificate and Snapshot (`post:epoch:epoch-boundary`).** The
epoch-$k$ snapshot edge set is $E_k = E_{k-1} \cup W_k$ — monotone by
construction and causally closed by the dependency closure (every asserted
parent and hyper-edge co-leg of a written record is written with it or
already present), satisfying `post:introduction:epoch-edge-set` with **no
appeal to any global position coordinate**. Commitment rates $r_i^{(k)}$ are
computed from $B_i$ and $N_i$ accumulated within $E_k$; the boundary burn
state $\{B_i^{(k)}\}$ is provided alongside $E_k$, sampled at the
settlement-stability depth $\delta_{\text{pos}}$ — which buffers the *burn
snapshot*, not edge membership (membership is the closure rule's alone).

**Log Position (`def:epoch:log-position`).** $\prec^*$, the canonical
linearization by the lexicographic identity key
$(\mathbb{T}_e, \mathrm{author}(e), \mathrm{src}(e), \mathrm{tgt}(e))$, and
$\mathrm{pos}(e)$ survive only as a **replay/audit tie-break coordinate**
(verification-tier). No closure, title, or epoch-membership quantity consumes
$\mathrm{pos}(e)$; epoch placement is the write set's, not a position
window's.

**Self-Edge Bond Derivation (`post:epoch:self-edge-bond-derivation`).** At
each epoch-$k$ boundary both components of Actor $j$'s Self-edge bond are
**derived** from the epoch-$k$ certificate — recomputable by any participant,
**never appended**. Their synthetic times place them causally after every
record in $E_k$ and before every record accepted after boundary $k$; maturity
follows the published tenure schedule
$\tau_j^{(k)} = 1 - 1/(k - k_j^{\mathrm{reg}} + 1)$. Shared parameter:

$$p_j^{(k)} = \begin{cases} \dfrac{\alpha_j^{(k)}}{\nu + \alpha_j^{(k)}}, & \hat{\alpha}_j^{(k)} \geq \rho_\theta \\[2ex] \text{derived from } (b_j, N_j)^{\mathrm{last}} \text{ under current constants}, & \hat{\alpha}_j^{(k)} < \rho_\theta \end{cases}$$

where the certificate retains the **raw last-valid pair**
$(b_j, N_j)^{\mathrm{last}}$ from the most recent epoch at which
$\hat{\alpha}_j \geq \rho_\theta$ — storing raw coordinates rather than
$p^{\mathrm{last}}$ keeps freezes recoinage-clean; $p$ is re-derived from them
under the current constants. The freeze keys on the **wall** $\rho_\theta$,
not the membrane $\rho_{\text{eff}}$; freezing at the last valid value
prevents bond-weight discontinuities during temporary blocking. A blocked
actor cannot act, so its bond is inert until the gate is restored. Published
in the epoch certificate.

**No boundary append (`def:graph:derived-edges`).** Because the bond is
derived, no Layer-1 record enters $E$ at a boundary: **epoch size is user
traffic only, and every record in $E$ is user-authored.** The freeze
condition $\hat{\alpha}_j^{(k)} < \rho_\theta$ is a binding read-site of the
safety floor $\rho_\theta$ (`post:epoch:reduction-convention`).

**Epoch-$k$ derivation sequence (`alg:epoch:boundary-sequence`):**

```text
 1: Trigger: epoch edge set E_k = E_{k−1} ∪ W_k is committed.
 2: Step 0 — Snapshot
 3:     Snapshot subgraph: E_k                       (post:epoch:epoch-boundary)
 4:     Compute r_i^(k) from B_i^(k), N_i in E_k     (def:comparator:rate)
 5: Step 1 — Endorsement flow
 6:     Construct the vouch-gated endorsement-flow projection
        (net stance + Vouch Predicate + control-edge exclusion
         + inviter revocation)                       (def:epoch:net-stance)
 7:     Run the double-cover BFS on it per source actor
 8:     ⇒ W_end(j → i) for all actor pairs
 9: Step 2 — Standing
10:     Recompute α_i^(k) for all actors i           (def:epoch:standing)
11: Step 2.5 — Title certificate
12:     For each Item n_i in E_k: compute owner^(k)(n_i)  (epoch title fold)
13:     Publish owner^(k) in the epoch certificate
14: Step 3 — Self-edge bond derivation
15:     Derive both bond components for all actors   (post:epoch:self-edge-bond-derivation)
16: Step 4 — Publish debit and door data
17:     Led safety price θ^(k+1), safety floor ρ_θ^(k+1)   (def:epoch:safety-threshold, def:epoch:safety-floor)
18:     Action stamps ρ_act, ρ_ep; door headroom H_k       (def:epoch:action-stamp, def:network:door-headroom)
19:     Fence evidence 𝒦_row^(k), W_loc^(k), mass ratios {x_i}
```

There is no exchange-rate freeze or capacity reset: capacity **is** the
balance (`post:epoch:theta-debit`), continuously restored by burning and
debited $\theta$ per act, so no per-epoch capacity object is derived.

**Epoch Replay Determinism (`prop:epoch:epoch-replay-determinism`).** Given
$E_k$ and the boundary burn state, the entire epoch-$k$ derivation sequence
— $r_i^{(k)}$, $W_{\mathrm{end}}(j \to i)$, $\alpha_i^{(k)}$,
$\mathrm{owner}^{(k)}$, $p_i^{(k)}$, the led $\theta^{(k+1)}$/$\rho_\theta^{(k+1)}$,
the stamps $\rho_{\text{act}}$/$\rho_{\text{ep}}$, and the door headroom $H_k$
— is a deterministic function of these inputs and the published constants,
invariant under payload state and under every linearization of $E_k$
consistent with $\prec$.

### 11.7 The θ-debit ledger and the two-gate write rule

**θ-Debit Ledger (`post:epoch:theta-debit`, `subsec:epoch:theta-debit`).**
Each accepted act by actor $i$ in epoch $k$ debits its residual balance and
increments its count:

$$b_i \mathrel{-}= \theta^{(k)}, \qquad N_i \mathrel{+}= 1.$$

A hyper-edge is one act: one $\theta$, one stamp. The debit is consummated at
the writing epoch's price and **never re-calculated** (the sole vintage
object). $\theta$ is the **only** debited object — no gate, door, stamp, or
average moves a balance. **Capacity *is* the balance:** remaining actions
$= \lfloor b_i/\theta \rfloor$, restored immediately by burning. Standing
prices nothing and no per-epoch capacity object is derived.

**Two-Gate Write Rule (`post:epoch:write-rule`, `subsec:verification:two-gate`).**
A record $e$ by actor $i$ is writable in epoch $k$ iff all three sub-gates
hold:

- **W1 — solvency, debited:** $b_i \ge \theta^{(k)}$. Evaluated continuously
  on the **live pairs** $(b_i(t), N_i(t))$; on write the $\theta$-debit above
  executes. Only the actor's own balance pays the actor's $\theta$.
- **W2a — safety, individual:** $\rho_{\text{act}}(e) \ge \rho_\theta^{(k)}$,
  where the action stamp $\rho_{\text{act}} = \hat{\alpha}_i$ is the
  boundary-frozen post-mediant, post-debit standing (all of an actor's
  epoch-$k$ acts share one stamp). **Never averaged:** no member's deficit is
  paid by another's surplus.
- **W2b — policy, averaged:** the closed set satisfies
  $\rho_{\text{ep}}^{(k)} \ge \rho_{\text{eff}}^{(k)}$ and
  $|W_k| \le N_{\text{epoch}}$, where $\rho_{\text{ep}} = \sum_i n_i
  \rho_{\text{act},i} / \sum_i n_i$ is the action-weighted door mean.
  **Never debited**; vacuous on empty epochs. **Band actors** —
  $\rho_\theta \le \rho_{\text{act}} < \rho_{\text{eff}}$ — are writable
  exactly when the door has headroom (the door is a membrane, not a wall).

**Door headroom (`def:network:door-headroom`).**
$H_k = \sum_{e \in W_k}(\rho_{\text{act}}(e) - \rho_{\text{eff}})$ — the
epoch's aggregate stamp surplus over the door. Certificate-derived,
**(L1·verify)**, a congestion diagnostic consumed by no formula; it is never a
price and never an actuator. It supersedes the retired write-price/congestion-price
wording.

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
- **Safety price $\theta$ (`def:epoch:safety-threshold`).** The per-action
  **debited** price and the minimum attestation price behind a write the
  coupled dynamics certifiably tolerate (reserve/action). The **only** debited
  object (W1). **An algorithmic output of the epoch computation, never a host
  input** — certificate $k$ carries $\theta^{(k+1)}$ (one-boundary lead),
  governed by requirements R1–R7 (derivability, sufficiency, step-boundedness,
  hysteresis, lead, publication, declared covariance); the algorithm is a
  calibration deliverable. Interim rule
  $\theta^{(k+1)} = \nu\,\lambda^{-1}\!\big(1/(m_\theta\, W_{\text{loc}}^{(k)})\big)$
  with **chartered margin factor $m_\theta = 1.25$** (fence slack
  $\mu = 1 - 1/m_\theta = 0.20$; fence-tier certificate $1/m_\theta$;
  escalation to $m_\theta = 1.5$ if p95 one-boundary $W_{\text{loc}}$ growth
  exceeds $\sqrt{m_\theta} = 1.118$).

Gate axis (the five-ρ family — three floors plus two stamps):

- **Policy floor $\rho_{\text{pol}}$ (`def:epoch:policy-floor`).** The host's
  dimensionless standing dial against spam/Sybil pressure. Announced at
  boundary $k$, effective at $k+1$, persisting until re-announced. Purely
  extensive: it excludes, but cannot reprice a survivor's actions. Canonical
  default $1$.
- **Safety floor $\rho_\theta = \theta/\nu$ (`def:epoch:safety-floor`) — the
  wall.** The gate-axis image of the per-action price; a newly minted glyph
  (do not re-coin $\theta/\nu$). Three binding read-sites: the **W2a**
  comparator, the bond **freeze key** (`post:epoch:self-edge-bond-derivation`),
  and the width **fence pin** $\lambda(\rho_\theta)\,W_{\text{loc}}\,m_\theta = 1$.
- **Effective floor $\rho_{\text{eff}} = \max(\rho_{\text{pol}}, \rho_\theta)$
  (`def:epoch:participation-floor`) — the door.** Derived, not dialed; $=
  \rho_{\text{pol}}$ on every valid certificate (the $\max$ is fault
  totalization with *safe polarity* — a mispublishing pipeline can only
  over-floor, never under-floor). Two read-sites: the **W2b** door and the
  entry cost $\rho_{\text{eff}}\nu$ (`def:comparator:entry-cost`).
- **Action stamps $\rho_{\text{act}}, \rho_{\text{ep}}$
  (`def:epoch:action-stamp`).** The standing-derived **measurements** the
  write rule gates: $\rho_{\text{act}} = \hat{\alpha}_i$ (individual,
  boundary-frozen post-mediant post-debit standing) at W2a, and its
  action-weighted mean $\rho_{\text{ep}}$ at W2b. Measurements, never floors;
  never debited.

**Certificate validity (`eq:epoch:floor-validity`).** A certificate is valid
only if $\rho_{\text{pol}} \ge \rho_\theta$ (equivalently
$\rho_{\text{pol}}\,\nu \ge \theta$) at the values in force — the one
sanctioned meeting of the two axes. An announcement violating it against the
led $\theta^{(k+1)}$ is invalid at publication: a formula constraint on the
dial, not a discretion.

**Reduction Convention (`post:epoch:reduction-convention`).** Every dynamical
and routing quantity — the bond kernel $p_i = \alpha_i/(\nu + \alpha_i)$, the
activation, the gain — is $\nu$-reduced. The wall $\rho_\theta$ has the three
binding read-sites above; the door $\rho_{\text{eff}}$ the two above. Standing
enters admission only through the stamps, gated against these floors.

**Host authority (`rem:epoch:operator-authority-floor`).** The host's entire
floor authority is the $\rho_{\text{pol}}$ schedule — announced with
one-boundary lead, valid only above the led safety threshold, auditable ex
ante. $\theta$ and $\nu$ are not host dials ($\theta$ is algorithmic, $\nu$ a
migration constant). The safeguard remains visibility: the full formula is
public, so any participant can compute the economic consequence of any
value. The dials lock only after empirical calibration.

**Recoinage (`prop:epoch:compensation`, `rem:epoch:capacity-crush`).** Under
$(\nu, \rho_{\text{pol}}) \to (c\nu, \rho_{\text{pol}}/c)$ the door product
$\rho_{\text{pol}}\nu$ (admission set, entry cost) is invariant, the gate-axis
comparisons are invariant, and reduced quantities (balances, standing,
$W_{\text{loc}}$) scale by $1/c$; the live set is invariant when the $\theta$
algorithm declares the corresponding covariance. The historical
capacity-crush is dissolved: with capacity **being** the balance there is **no
frozen stock to crush** (`rem:epoch:capacity-crush`) — the split makes
recoinage explicit rather than latent. The door product is no longer an
independent charter surface; the host publishes $\rho_{\text{pol}}$ and the
effective floor is derived by the safety clamp (`rem:epoch:dial-scope`).

---

## 12 Consumer map (`tbl:graph:consumer-map`)

| Quantity | Closure consumer | Notes |
|---|---|---|
| $\epsilon(e)$, $\epsilon(p)$ | double-cover endorsement-flow BFS (`alg:epoch:double-cover-bfs`) | parity routing; coherence bit, never a favor bit |
| $\lvert\det \boldsymbol{\Psi}_e^{[P]}\rvert^{1/2}$ | $\tilde{w}(e)$ | coherence factor |
| $\mathbb{T}_e$, $\tau_e$, $H_\tau(e)$ | $\mathbb{T}_e$: causal order + boundary replay; $\tau_e, H_\tau$: $\tilde{w}(e)$ | maturity and boundary factors; edge weight and replay checks |
| $\prec_{\text{inc}}$, asserted parents | formation rule; causal closure of $E_k$ | backward-only dependency; formation and viability |
| $\tilde{w}(e)$ | double-cover endorsement-flow BFS | one formula, **one closure consumer**; terminal read-sites may read the published value by ledger permission |
| stance marginals $p_d, p_i$ | Vouch Predicate; settlement-adjacent stance reads | stance gates actor-directed endorsement; terminal stance consumers named in the ledger |
| `settles`-pointer | recognition clauses (i)–(ii) | identity-key resolution |
| ownership thread | title certificate; recognition clause (iii) | title as straddler |
| $\mathrm{owner}^{(k)}$ | recognition clause (iii) | terminal routing/display read it downstream |
| payload structural witness | edge integrity; payload-state invariance | (L1·verify) — retained by Layer 1 across phases; bytes never read by Layer 1 |
| terminal complement | — | feed, reward, attribution, bridge transport, identity association, payload rendering, licensing, membership policy: named only in `tbl:symbols:boundary` |

---

## 13 Deployment invariants (`app:deployment` — the seven binding invariants)

Apply in both deployment phases; what changes is the consequence of failed
verification, not the specification. The closure edition's `app:deployment`
carries these seven binding invariants; the **full paper's `app:deployment`
enumerates fifteen** — these seven plus eight terminal / Layer-0-side
invariants (client-reproducible feed ranking, device-local computation scope,
concealment-entropy custody, auditable centrality certificates,
attribution-view insulation, maturity-announcement irrevocability,
time-locked supply auditability) reproduced by their own owners.

- **Continuous Public Availability of Graph State
  (`subsec:deployment:public-availability`).** Every edge record — endpoints,
  author, parameters, domain, temporal attributes, **payload witness**, and
  the fields needed to recompute determinant magnitude, determinant sign,
  and damped weight — is available to any participant at any time without
  access control. Availability applies to the structural record and the
  retained payload residue — the witness
  (`rem:graph:payload-custody-phases`); full payload bytes are available
  only while in full projection, and Layer-1 verification never requires
  them.
- **Epoch Edge-Set Agreement
  (`subsec:deployment:epoch-edge-set-agreement`).** At each boundary the
  operator publishes a causally closed, monotone edge set $E_k$; any
  participant accepting $E_k$ replays identical epoch results — standing,
  title certificates, the led safety price/floor, and the action stamps. A
  strict global total
  order is not required; agreement is required only on the *set* $E_k$.
- **Immutability of Published Records (`subsec:deployment:immutability`).**
  Once an edge record or ledger entry is published, its structural fields
  cannot be silently altered. Changes require new records.
- **Transparency of Protocol Constants
  (`subsec:deployment:transparency-of-scoring-constants`).** The network
  constants ($\beta, \eta, q, \nu, \rho_{\text{pol}}, N_{\text{epoch}},
  \delta_{\text{pos}}, L, M_{\text{payload}}$), the derived effective floor
  $\rho$ and the per-epoch safety threshold $\theta$, the four derived
  constants ($\epsilon_{\mathrm{clip}}, \tilde{w}_{\mathrm{spam}},
  \tilde{w}_{\max}, \tilde{w}_{\max}^{\mathrm{Op}}$), and the epoch min/max
  durations (a published host-policy surface) are public and cannot change
  without clients being able to detect the change before it applies. Layer-0
  constants are surfaced through `PA-` labels and owned by Layer 0.
- **Self-Sufficient Edge Record (`subsec:deployment:sufficiency`).** The
  published record for each edge contains exactly the fields required to
  recompute $\boldsymbol{\Psi}_e$, $\boldsymbol{\Psi}_e^{[P]}$,
  $\epsilon(e)$, $\tilde{w}(e)$, the identity key, and the payload witness;
  closure computations depend on no unpublished field. The Vouch Predicate
  is likewise self-sufficient: two sign tests on public parameters, after
  public netting where applicable. Inviter revocation is self-sufficient: a
  $\prec$-maximum over a same-author, same-incidence public record chain.
- **Independent Derivability of Standing Inputs
  (`subsec:deployment:standing-inputs`).** All inputs to the standing
  computation — $B_i$ (public Layer-0 attestation interface), $N_i$ (from
  the committed $E_k$), $r_i$, the vouch-gated endorsement-flow projection
  (net stance, vouch gating, control-edge omission, and inviter revocation
  all from public records), $W_{\text{end}}$ (double-cover BFS), $\alpha_i$
  — are independently computable by any participant without querying the
  server.
- **Formula Completeness (`subsec:deployment:completeness`).** The published
  material — protocol constants; edge-type specifications and census; tensor
  pipeline; path-view extraction; mask and tier rules; determinant sign and damped weight; **net
  stance and Vouch Predicate; control-edge exclusion and inviter
  revocation**; the **write rule (W1/W2a/W2b), closure rule, formation rule,
  and the θ-debit ledger**; settlement recognition and the **epoch title
  fold**; the epoch derivation sequence and certificate definitions; the
  safety-price/five-ρ-floor family — is
  jointly sufficient to reproduce the server's output from published edge
  records alone. Terminal mechanisms are not part of this invariant; **if a terminal
  service publishes a mechanism, the grant requires that terminal
  mechanism's own completeness** — a guild that reimplements a terminal
  default publishes its own complete specification in its place.

Outside this invariant (terminal or Layer-0-side, reproduced by their own
owners): feed ranking, device-local computation scope, centrality
certificates, CAN attribution-view insulation, and the Layer-0 preservation
properties (the immutability invariant covers ledger entries).

---

## 14 Symbol ledger (Layer-1-tagged objects)

Tag semantics (`app:symbols`, `def:network:object-taxonomy`): **(L0·input)**
originates below the comparator seam, cited never authored; **(L1·closure)**
at least one read-site re-enters admission — consume the published value, may
recompute to audit (this collapses the former kernel / rule / closure tiers;
**⋆** marks a straddler, consumed at kernel value where it feeds back and read
freely downstream); **(L1·verify)** evidence for reproducing or checking a
closure output, no feedback read-site, consumed by no formula;
**(L1·by-product)** a non-normative host convenience, recomputable from the
certificate; **(—)** layer-independent shared mathematics. The subsections
below stay grouped by role (kernel data, rules, straddlers, closure) but all
carry **(L1·closure)** except $B_i$/$B_{\max}$ **(L0·input)** and the
verify-tier objects flagged inline. **No (L2) object appears in the symbol
index — terminal objects live only in the boundary ledger** (§3).

### 14.1 Kernel

| Symbol | Definition | Ref |
|---|---|---|
| $B_i$ | The imported frame, fiber-wise: $B_i := A_{\mathrm{key}(i)}$, the network's reading of the Layer 0 attestation map. Non-decreasing at sampling depth, publicly auditable, irrevocable. | `def:comparator:imported-frame` |
| $B_{\max}$ | Bootstrap capacity bound $B_{\max} := A_{\max}$. | `def:comparator:bootstrap-capacity` |
| $E_k$ | Epoch snapshot edge set; substrate of all of $\mathcal{A}$. | `post:introduction:epoch-edge-set` |
| $\prec$ (L1·closure), $\prec^*$ **(L1·verify)** | Structural causal order $\prec_{\text{inc}}$; canonical identity-key refinement $\prec_{\text{id}}$ (replay tie-break, consumed by no formula). | `def:graph:causal-order`, `def:epoch:log-position` |
| $\nu$ | Numéraire: the sole reserve→action unit and reserve-economy↔action-economy join (applied per act by the θ-debit); bond-kernel denominator. Every reserve input is $\nu$-reduced before meeting a count. Structural; moving it is a migration event. | `def:comparator:numeraire` |
| $\rho_{\text{pol}}$ | Policy floor: the host's dimensionless gate-axis dial; announced at $k$, effective at $k+1$; valid iff $\rho_{\text{pol}}\nu \ge \theta$. Canonical default $1$. | `def:epoch:policy-floor` |
| $\theta$ | Safety threshold (reserve/action): the minimum attestation price behind a write the coupled dynamics tolerate. Algorithmic per-epoch output (R1–R7), one-boundary lead; never a host input. | `def:epoch:safety-threshold` |
| $\rho$ | Effective participation floor $\max(\rho_{\text{pol}}, \theta/\nu)$; $=\rho_{\text{pol}}$ on any valid certificate. The only floor a binding site reads: gate, freeze condition, entry cost. | `def:epoch:participation-floor` |
| $\beta$ | Inverse temperature $2\ln 2 \approx 1.386$. | `ax:epoch:thermodynamic-boundary` |
| $\eta$, $\sqrt{\eta}$ | Cross-dimensional bleed $0.05$; Half-tier path-view floor $\approx 0.224$. Floor ladder $\{1, \sqrt{\eta}, \eta\}$. | `def:graph:path-view-extraction` |
| $q$ | Diversity preference, fixed at $\tfrac12$ for Layer-1 closure traversal. | `def:graph:svd-path-score` |
| $N_{\text{epoch}}$ | Epoch **target** write-set size; the write set fills toward it. | `post:epoch:epoch-boundary`, `post:epoch:closure-rule` |
| $\delta_{\text{pos}}$ | Burn-snapshot buffer (settlement-stability depth); buffers the burn snapshot, not edge membership. | `post:epoch:epoch-boundary` |
| $M_{\text{payload}}$ | Maximum payload byte length; the structural bound is L1·closure, payload bytes terminal. | `def:graph:payload-carriage` |
| $(1-f)\zeta$ | Layer-0 net-live-share interface object (imported); enters only the entry cost $\delta_{\min}$. | `def:comparator:entry-cost` |

### 14.2 Rules

| Symbol | Definition | Ref |
|---|---|---|
| write rule | $W1{:}\,b_i \ge \theta$ (debited); $W2a{:}\,\rho_{\text{act}} \ge \rho_\theta$ (individual); $W2b{:}\,\rho_{\text{ep}} \ge \rho_{\text{eff}}$, $\lvert W_k\rvert \le N_{\text{epoch}}$ (averaged). | `post:epoch:write-rule` |
| closure (write) | Host writes a valid sequence of dependent sets within the target budget; touches membership only. | `post:epoch:closure-rule` |
| formation | Record well-formed over the identifier algebra, endpoint typing, and asserted parents; only Registration carries fresh grounded endpoints. | `def:network:admission-closure` |
| $\mathcal{S}$ | Recognized settlement triple (Bid, Accept, Ratify), clauses (i)–(vi); order-free function of $(E_{k-1}, E_k, \mathrm{owner}^{(k-1)})$ and $\mathrm{ep}(\cdot)$. | `def:graph:settlement-recognition` |

### 14.3 Straddlers

| Symbol | Definition | Ref |
|---|---|---|
| $\alpha_i$ | Standing: the comparator realized on the graph, gauge fixed by the neutral source. Binding where the gate reads it; terminal read-sites (what is shown, what is owed, terminal policy) read it downstream per the ledger. Bounded in $[\min_j r_j, \max_j r_j]$. Enters the Self-edge bond via $p_i = \alpha_i/(\nu+\alpha_i)$. | `def:epoch:standing` |
| $\mathrm{owner}^{(k)}$ | Title certificate $\text{Items} \to V_u \cup \{\varnothing\}$; recognition reads it, terminal services may read it. | `def:graph:title-certificate` |

"The only straddlers are $\alpha_i$ and $\mathrm{owner}^{(k)}$. A third
straddler is a design error."

### 14.4 Closure

| Symbol | Definition | Ref |
|---|---|---|
| $r_i$ | Neutral source $B_i/\max(N_i,1)$; the unique exogenous input to the standing recursion; derivable from the public ledger without traversal. | `def:comparator:rate` |
| $N_i$ | Cumulative action count; non-decreasing; irrevocably incremented by every action. | — |
| $b_i$ | Residual balance $B_i - \sum_a \theta^{(k_a)}$ (imported frame net of consummated per-action $\theta$-debits, each vintage-frozen); numerator of $r_i$ and the object of W1. Replaces the retired excess-burn diagnostic. | `def:comparator:residual-balance` |
| $\bar{p}_d, \bar{p}_i$ | Net stance of a same-author, same-target, same-type bundle: sum-then-clip to $[-1,1]$; endorsement-flow projection only. | `def:epoch:net-stance` |
| Vouch Predicate | Actor-directed record vouches iff $p_d > 0 \wedge p_i > 0$; no glyph by design. | `def:epoch:vouch-predicate` |
| inviter revocation | Per-author suppression predicate for Invitation bundles when the latest same-incidence record is a De-invite; no glyph. | `def:epoch:inviter-revocation` |
| control-edge class | Withdraw, Rescind, Leave, De-invite L1/L2: type-fixed records, never vouch, excluded from the projection. | `rem:epoch:control-edges-never-vouch` |
| $W_{\text{end}}(j \to i)$ | Endorsement flow weight: max admissible (vouch-gated, positive-parity) path product, length $\le L$. Zero if no admissible path. | `def:epoch:endorsement-flow-weight` |
| $W^+(v), W^-(v)$ | Double-cover parity registers. | `def:epoch:double-cover-bfs-state` |
| $\Phi(v,d)$ | Prospective contribution bound $(W^+ + W^-)\tilde{w}_{\max}^{L-d}$; clip below $\epsilon_{\text{clip}}$. | `def:epoch:prospective-bound` |
| $\epsilon_{\text{clip}}$ | Clipping threshold, default $\tilde{w}_{\text{spam}}^L \approx 1.5\times 10^{-8}$ ($L=4$). | `def:epoch:prospective-bound` |
| $\tilde{w}_{\text{spam}}$ | Spam floor weight $\approx 0.011$. | `subsec:verification:spam-resistance` |
| $\tilde{w}_{\max}$ | Reputation component supremum $\approx 0.986$. | `subsec:verification:self-edge-bond` |
| $\tilde{w}_{\max}^{\text{Op}}$ | Tribal/Full Opinion ceiling $\approx 0.502$. | `subsec:verification:self-edge-bond` |
| $\mathrm{pos}(e)$ **(L1·verify)** | Canonical position under the identity-key linearization; epoch-boundary placement only; consumed by no formula. | `def:epoch:log-position` |
| $(b,N)_i^{\text{last}}$ | Raw last-valid pair from the most recent epoch clearing the wall $\rho_\theta$; freezes the derived bond below the wall (stored raw, keeping freezes recoinage-clean; $p$ re-derived under current constants). | `post:epoch:self-edge-bond-derivation` |
| $\hat{B}_i$, $\hat{\alpha}_i$ (L1·closure); $\hat{r}_i$ **(—)** | Numéraire-reduced burn / comparator / rate ($x/\nu$); $\hat{r}_i$ is a dynamics quantity, not closure. | — |
| $p_i$ | Bond intensity: Möbius kernel $\alpha_i/(\nu+\alpha_i)$ (denominator $\nu$, not $\rho\nu$ — ρ gates, it does not reduce). | `post:epoch:self-edge-bond-derivation` |
| ownership thread, Item genesis | Boundary-indexed title chain; declarative genesis record with structural identity key. | `def:graph:ownership-thread`, `def:graph:item-genesis` |
| $\delta_{\min}$ | Entry cost $\rho\nu/((1-f)\zeta)$ — the sole legitimately reserve-dimensioned user-facing quantity. | `def:comparator:entry-cost` |
| $W_k$, regime | Boundary write set (union of written dependent sets); regime binding iff $|W_k| = N_{\text{epoch}}$, else slack. | `post:epoch:closure-rule` |
| set price | Average of member-authors' raw rates; door $\ge \rho_{\text{eff}}\nu$, safety per member. | `def:graph:set-price` |
| door headroom $H_k$ | $\sum_{e\in W_k}(\rho_{\text{act}}(e) - \rho_{\text{eff}})$: epoch stamp surplus over the door; congestion diagnostic **(L1·verify)**, consumed by no formula, no actuator. | `def:network:door-headroom` |
| $W_{\text{loc}}$, $\mathcal{K}_{\text{row}}$ | Local width and local certificate **(L1·verify)**: published fence/stability evidence; consumed by no ν-side formula. | `subsec:epoch:floor-governance` |
| `settles`-pointer | Identity-key reference Accept/Ratify → Bid; metadata, not incidence. | `def:graph:settlement-recognition` |
| Accept / Ratify | Direct Actor-to-Actor settlement consent (non-binding alone) / commit; Relational, promoted, Half tier; actor-directed for the Vouch Predicate. | `edge:nodes:accept`, `edge:nodes:ratify` |
| Withdraw / Rescind / Leave / De-invite | Control records; Minimal, Marginal, forced $+1$; endorsement-inert. | §9 |
| $\tau^*$ | Maturity crossover $\approx 0.94$. | `prop:epoch:crossover-location` |
| Stability machinery **(not (L1·closure): (—) shared dynamics, plus fence objects $\lambda(\alpha^*)\hat{\Delta}$, $\mathcal{K}_{\text{row}}$, $W_{\text{loc}}$ tagged (L1·verify))** | $g(\alpha)$, $\tilde{g}(p)$, $\lambda(\alpha)$, $L_w$, $K(p)$, $\hat{\Delta}$; deployed safety gate = norm certificate $L_w\hat{\Delta} < 1$ (`thm:dynamics:coupled-contraction`); operative product $\lambda(\alpha^*)\hat{\Delta}$; $\lambda(1) = 0.32825$ (danger-band peak, App B); rate caps $\sup\Phi(\alpha) \approx 0.507$ unconditional, $\le 0.328$ gate-cleared; $\kappa_{\max} = \tfrac14\lambda(\alpha^*)\hat{\Delta}$; union-acyclic bound $L_w\hat{\Delta} < 4$; $\mathcal{E}$ endorsement/coupling graph; $C_\tau = \sqrt{1+\tau^2}e^{-\beta H_\tau}$; $\Pi$ excursion budget. The live relay set is vouch-filtered: non-vouching legs, control legs, and revocation-suppressed Invitation bundles have weight zero, so every contraction certificate weakly improves (`rem:dynamics:vouch-filtered-relays`). | `app:dynamics` |

### 14.5 Terminal objects (full paper only)

The closure edition carries no (L2·free) symbol table; the terminal
complement is named in the boundary ledger. The full paper still defines the
terminal defaults a Layer 2 may adopt or replace: $l_{ij}$ license severity
(`def:content:license-qualifiers`) · $V(n)$ scalar CAN value · $t(n)$ transmission coefficient ·
$\mu(n)$ redundancy ratio · matrix CAN $\mathbf{V}(n)$, $\mathbf{T}(n)$ ·
$H_\tau^{(C)}$ per-creator-epoch entropy (Eq. (8.3), `eq:transport:epoch-entropy`) · $\mathcal{L}$ guild
liquidity pool and $R_C$ reward (Eq. (8.2), `eq:transport:reward-formula`) · realizing-forest betweenness
$S_C$ (Thm C.24) · enriched centrality $S_C^{\text{CAN}}$ and
realizing-path normalization $V_{\max}$ (Thm C.32) · circuit-improvement
influence $I_C$ (Thm C.27) · $\Xi_A$ bridge campaign scalar ·
$\mathrm{cir}(T,B,A)$ circuit quality · $S(u,c)$ relevance score (full §7,
`def:sorting:relevance-score`, unchanged and not netting-aware). Bridge semantics: Channel 2
$\mathrm{end}(B,A)$ is stance-signed
($\mathrm{sgn}(p_d(e_{\text{Op}}))$), and Channel 3 $\mathrm{con}(A,B)$
carries an absolute direct-stance veto reading the net direct stance
$\bar{p}_d$.

### 14.6 Shared mathematics used inside L1 definitions

$H_\tau$ temporal entropy (`def:graph:temporal-entropy`) ·
$|\det \boldsymbol{\Psi}_e^{[P]}|^{1/2}$ determinant score ·
$\psi_\pm, \psi_+, \sigma_{\text{sig}}$ clamps (`def:graph:sentiment-slice`) ·
$\mathrm{clip}_{[-1,1]}$ (net-stance fold) — these are tag-exempt operators.
**Not shared mathematics — (L1·closure) per `tbl:symbols:index`, tabled in
§14.1/§14.4:** the parity bits $\epsilon(e)$ (`def:graph:determinant-sign`)
and $\epsilon(p)$ (`cor:graph:path-parity-sign`), the maturity scalar $\tau_e$
and local Lamport time $\mathbb{T}_e$ (`def:graph:temporal-attributes`), and
the BFS depth bound $L = 4$; likewise $\tilde{w}(e)$ is closure, not shared
(one specified consumer).

### 14.7 Vocabulary disambiguation (from the collision registers)

Word register (closure edition symbol index, *Word Collisions*):

- **floor** — several distinct objects, one word: the Layer 0 redemption-rate
  floor | the numéraire $\nu$ (Layer 1 reserve→action unit) | the policy floor
  $\rho_{\text{pol}}$, the safety floor $\rho_\theta = \theta/\nu$ (the wall),
  the effective floor $\rho_{\text{eff}} = \max(\rho_{\text{pol}}, \rho_\theta)$
  (the door) | the safety price $\theta$ | "through the floor" (the binding
  axiom). Never conflate the price axis ($\nu$, $\theta$) with the position
  axis ($\rho_{\text{pol}}, \rho_\theta, \rho_{\text{eff}}$).
- **accountability vs. auditability** — a record's cost-bearing property
  (its author can be held to it) vs. a computation's reproducibility (anyone
  can re-run it). Adjacent, not synonyms.
- **standing vs. source** — the comparator ($\alpha$, shared-codomain) vs.
  the neutral source ($r$, per-actor rate). Bundle is not fiber.
- **coherence vs. stance** — $\epsilon(e) = \mathrm{sgn}(p_d p_i)$ is the
  coherence bit; the stance marginal $\mathrm{sgn}(p_d)$ is the author's
  directional verdict. Coherence composes; stance gates actor-directed
  endorsement.
- **gain** — $\lambda(\alpha)$ is the local multiplier of the self-map,
  never a reward, return, or amplifier.
- **dispersion vs. hull** — additive spread vs. ratio; never merge them.
- **maturity** — $\tau$ is graph connection-context maturity; Layer-0
  maturity is a cycle/lead concept, cited only through `PA-` labels.
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
- **located onset vs. outer onset** — deployment gates use the norm
  certificate $L_w\hat{\Delta} < 1$, not a located onset.
- **husk** — persistent actor record after identity-severance and
  content-erasure: standing, title, and trust-edges remain, names and words
  gone; no glyph.

Glyph register highlights (closure edition symbol index, *Glyph
Collisions*):
$\epsilon \in \{+1,-1\}$ vs $\epsilon_{\text{clip}} \in \mathbb{R}^+$ ·
$N_i$ vs $N_{\text{epoch}}$ · $\mathbb{T}_e$ (causal computations) vs
$\mathrm{pos}(e)$ (epoch-boundary placement) · $W_{\text{end}}$ vs
$\mathcal{E}$ · $L_w$ vs $L$ ·
$g(\alpha)$ (activation) vs $g$ (Bid generosity) · $\hat{\Delta}$ vs
$\Delta k_{\min}$ (Layer 0, `PA-`-cited) · $\Pi$ (excursion budget) vs
$\prod$ · index $a$ (Layer-0 opaque address vs actor label after frame
binding). A glyph-collision row ships only when both parties appear in the
closure edition; **Full (routing tier) vs full mask (stored shape)** remains
a prose distinction — a Half edge is full-mask but Half-tier.
