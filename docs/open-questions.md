# Open Questions

All unresolved design questions across the project, consolidated here.

Each entry is self-contained enough that a fresh reader (human or AI)
can engage without having to read every other doc. Pointers from the
origin docs link here; as questions are resolved, the answer moves
into the relevant design doc and the entry below is removed.

**Scope.** Design questions only — things we have not decided. Pure
implementation TODOs, known-outdated docs, and tasks on a roadmap are
out of scope.

---

## Resolution order

The questions below are listed in **topic** order (roughly: ranking
primitives → onboarding → data model → chats → policy). The
**resolution** order is different — some questions genuinely can't be
answered until others are. Work them in roughly the order below;
within a phase, order is flexible.

| Phase | # | Question | Why here |
|:---:|:---:|:---:|---|
| 1. Miner rollout phase | 1 | **Q25** | Standing miner delegation — a scoped credential or miner-held seen-list over the v1 push model. Deferred until delegated miners are real; shares the trigger with miner incentives ([miner-api.md "Out of scope"](implementation/miner-api.md#out-of-scope--miner-selection-and-incentives)). |
| 2. Federation phase | 1 | **Q15** | Identity reconciliation across separately-running instances for handle-based and per-creation node types. Type 1 nodes (hashtags) federate for free per Q14; Types 2 and 3 need a protocol; cross-instance bootstrap and integrity raise further sub-questions. Deferred until federation becomes concrete. |

As questions resolve, their blocks disappear from below and their
rows disappear from this table. The table stays in place until all
questions are closed.

**Resolved:**

- Q7 — see [data-model.md §"author_id + author_type"](implementation/data-model.md#author_id--author_type--discriminator-not-foreign-key).
- Q8 — see [chats.md §10](instances/chats.md#10-moderation) and [governance.md §8](primitive/governance.md#8-instances).
- Q3 — see [graph-model.md §3](primitive/graph-model.md#3-edge-categories) "What creates an actor edge — stances-not-events".
- Q2 — see [feed-ranking.md §3-§4](primitive/feed-ranking.md#3-per-edge-composition-along-a-path) (per-edge composition, parallel tracks, taint rule, sum collapser) and [graph-model.md §6](primitive/graph-model.md#6-dimension-semantics) (dim1/dim2 unification, filtering vs. graph math). The deepest tie-break resolved separately — see Q16.
- Q11 — see [feed-ranking.md §3.6–§3.7](primitive/feed-ranking.md#36-bot-resistance-via-the-0-0-severance-edge) (`(0, 0)` severance edge, cascading severance, redemption) and [feed-ranking.md §5](primitive/feed-ranking.md#5-algorithm) (zero-jail banishment of `h(t) = 0`). Self-discovery and return-pathway UX surfaces are tracked as forward sub-questions Q12 and Q13.
- Q12 — see [feed-ranking.md §3.8.1](primitive/feed-ranking.md#381-severance-discovery--the-inbound-side) (severance discovery via inbound self-query, trust-weighted reading) and [feed-ranking.md §3.8.2](primitive/feed-ranking.md#382-bot-cluster-identification--auto-detection-from-path-patterns) (auto-detection of bot-bridge nodes via delta-funnel path patterns, with path-length-aware action guidance). Cause identification is the auto-detect's job, complemented by the community posts in §3.8.3.
- Q13 — see [feed-ranking.md §3.8.4](primitive/feed-ranking.md#384-severance-redemption--the-outbound-side) (severer-side redemption surface, delta-funnel check on the redeeming node's outbound) and [feed-ranking.md §3.8.5](primitive/feed-ranking.md#385-self-redemption-posts) (self-redemption posts via the same `bot-defense` hashtag mechanism, surfaced in the severer's "review severed accounts" view).
- Q14 — see [data-model.md "Node identity strategies"](implementation/data-model.md#node-identity-strategies) (three-strategy framework: content-addressed UUIDv5 for canonical-string nodes like Hashtag, random UUID + UNIQUE handle for User/Collective, random UUID alone for per-creation nodes). Hashtag IDs are now content-addressed so independent creations of the same canonical name converge on one node. Cross-instance federation reconciliation for Types 2 and 3 is deferred as Q15.
- Q6 — see [invitations.md "Default values and customization"](primitive/invitations.md#default-values-and-customization). Defaults are `(+0.5, +0.5)` on both edges; both inviter and invitee choose their own outgoing edge during the invitation flow. The doc walks through the asymmetric-friend example (`(+1, -1)` on the invitee side as a deliberate "love them, not their content" stance that lets a later second edge dominate the feed).
- Q4 — see [feed-ranking.md §7](primitive/feed-ranking.md#7-time-and-recency). Time decay anchors on the **reactor edge's top-layer age** (the last actor edge in the path), applied as a scalar `f(Δt)` multiplier alongside `d(R)` to all four metrics (`h, i, j, k`). Default exponential with **30-day half-life**, frontend-tunable. Intermediate edges don't decay — silence on a relationship edge is not stance revocation. Post-node age has no separate decay — the authorship edge is itself a reactor edge and ages with the post, so old-with-no-engagement decays naturally and old-with-fresh-engagement resurfaces via fresh reactor-edge layers. Worked cold-start example in §7.3 shows the math.
- Q1 — see [graph-model.md §8](primitive/graph-model.md#8-append-only-history-edges). Layer count, layer timestamps, and the sequence of past edge values are **not ranking inputs**. They are metadata for audit, history, and UI surfaces (e.g., a "this edge has been revised N times" indicator, or a stale-edge prompt). Ranking sees only the top layer of each edge — the user's current expressed stance. Rationale: introducing layer-count amplification would let the system infer intent from interaction frequency, in tension with both **stances-not-events** ([graph-model.md §3](primitive/graph-model.md#3-edge-categories)) and the user-controlled-ranking principle. Edge cases like "two friends with identical edges but very different real-world contact frequency" are explicitly not auto-resolved by the system; users update stances reactively (similar to pruning a stale subscription list) rather than the system inferring from behavior.
- Q5 — see [feed-ranking.md §8](primitive/feed-ranking.md#8-the-already-seen-filter). The seen-list is a per-viewer set of content UUIDs treated as **another input to the feed-ranking computation**, alongside `R`, `d(R)`, `f(Δt)`, and the §5.2 friend-author-boost. Pre-rank exclusion (perf win — already-seen content never enters the math). New activity on a seen post does **not** resurface it; the new comment/reaction is independently rankable as its own node. Storage location is the viewing user's choice — backend-side `user_view_log` table in Postgres is the central frontend's default ([data-model.md](implementation/data-model.md)), but self-hosted clients can keep the same data locally and pass it to the calculator (the math is the same regardless of where the JSON came from); a delegated miner holds no copy — the seen-list rides inside each request per Q24's push model. Default frontend rule for "seen": every content item that passes through the viewport during a render. Frontend batches and flushes on natural checkpoints (batch-fill, scroll pause, app close); cache-clear before flush is an accepted small loss-window. Default 1-year compaction bounds storage at ~7 MB per active-user-year; the trade-off (a resurging old post will reappear if its view-log entry has been compacted) is documented and treated as acceptable feed character. No privacy-concealment story — viewing history is no more sensitive than reaction history per the network's transparency posture; "history" becomes a UI feature using the same data.
- Q10 — reframed as a side note rather than an open design question. See [layers.md "Side note on long-term storage"](primitive/layers.md#side-note-on-long-term-storage). Typical actor behavior bounds layer accumulation tightly — people update an edge a handful of times over its lifetime, not hundreds, and node properties change even less frequently. The corner cases that *would* accumulate substantial history (e.g., a decades-old company restructuring through CollectiveMember edges) are precisely the ones where preserving history has value. If a real instance ever runs into storage pressure, compaction-friendly approaches that respect the no-silent-deletion principle exist — but it's an implementation-time decision contingent on real data, not a design-time one to settle preemptively.
- Q9 — see [moderation.md](instances/moderation.md) and [network.md](primitive/network.md). Authorization for redaction runs through community-driven Network governance: any User authors a Proposal classifying content as `illegal`; threshold-cross requires at least one moderator's positive vote (the gate), ≥2/3 of cast votes in favor, and a low community quorum; threshold-cross triggers the [layers.md §5](primitive/layers.md#5-deletion-policy) redaction cascade. External pressure (court orders, etc.) doesn't bypass the mechanism — it prompts a moderator to start the same Proposal, which the community completes. Pathological corner cases (all moderators compromised) fall under the federation/forking exit per Q15.
- Q17 — see [feed-ranking.md §3.1](primitive/feed-ranking.md#31-which-edges-contribute-factors). No `Content → Author` back-edge exists or is added; content actor edges terminate at the content node and contribute only to ranking that content. The "I liked Alice's last three posts, so show me more Alice" intuition is supported by an explicit follow gesture, not inferred from post-affinity — that inference would be exactly the behavior-to-edge translation [graph-model.md §3](primitive/graph-model.md#3-edge-categories) (stances-not-events) rules out. Back-edge variants (with-cap, with-weight-discount, gated-on-reciprocation, propagate-to-author-only) each failed against either bot-bridge amplification or the actor-only-factor symmetry of §3.1, or both. A frontend may surface a follow-prompt after observed repeated engagement, but this is a UX nudge, not a graph mechanism, and is not added prophylactically — revisit only if feed-quality data shows the gap matters.
- Q18 — see [feed-ranking.md §3](primitive/feed-ranking.md#3-per-edge-composition-along-a-path) (simple-paths invariant — every path is vertex-simple, enforced via a per-path visited set; bidirectional topologies like mutual user edges, junction approval pairs, and `:BEARER` pairs would otherwise admit cyclic paths where the same intermediate's mediating role multiplies into the product without conveying new information) and [feed-ranking.md §4.1](primitive/feed-ranking.md#41-path-contribution-and-distance-decay) (single-transit-cap rejected — for 100 paths `U → Aᵢ → B → t` the sum factors as `d(3) · s(B → t) · Σᵢ s(U → Aᵢ) · s(Aᵢ → B)`, a clean product of "network-aggregate endorsement of `B`" times "`B`'s stance on `t`," which is trust propagation working correctly; bot-bridge amplification is already handled by severance + delta-funnel auto-detection in §3.6–§3.8, and `d(R)` already calibrates direct-vs-indirect, making 100 R=3 paths beating one R=2 path the intentional default). One-line entry added to [invariants.md "Ranking"](primitive/invariants.md#ranking) for discoverability.
- Q20 — see [economics.md](primitive/economics.md) (pull-marketing campaigns: the `Campaign` node, the sustained-level `achieved_h_gain` metric, per-path Shapley attribution `φ_i = Σ w_π/|A_π|`, advertiser-discretionary release `P ∈ [0, D]`, the conservation equation with a flat-on-D anti-spam floor plus a scaling-on-P split, and the `Settlement`-node claim flow), [token.md](primitive/token.md) (CGT: decaying calendar mint on the peer-network curve with no fresh premine, one-sided V3 POL above spot with fees routed to treasury), and [ledger.md](implementation/ledger.md) (three stores, money → chain; self-custody key from signup, non-custodial never-expiring claim escrow, the `Wallet` node). Q20.2's ledger home is the chain as a third store; Q20.3's "pull marketing" anchor is [economics.md §1](primitive/economics.md). Surfaced follow-ups: Q16's token angle (token signals excluded from `S`) carried into its recency resolution; the mod-gate hardening direction it surfaced carried into the Q19 resolution.
- Q21 — see [collectives.md §8](instances/collectives.md#8-governance--the-social-contract). The role-catalog problem dissolves under a single layered `governance` map property on `:Collective`, keyed by `action_key` string. Each entry is a `Rule` of paired `exec` + `amend` triples so amendment cost is calibrated per-rule (CEO-can-hire stays cheap; share-distribution stays expensive) and the `amend` triple is self-applying (no infinite regress, no primitive default needed). The role vocabulary is **implicit** — the set of strings used in any `governance.<key>` eligibility predicate plus the strings assigned to any active member's `role`; typos are amendable like any other `role` change via a Proposal targeting `CollectiveMember.role`. Schema is fixed (one map property, declared in [graph-data-model.md](implementation/graph-data-model.md)); the action set is data, so new action keys never require a schema change. Composite atomic changes spanning multiple junctions (e.g. admit shareholder with redistribution, transfer shares between shareholders) ride on a new `value_kind = 'composite:<action_key>'` discriminator on Proposal with `_from` / `_to` bundle entries the cascade re-validates against current state — see [proposal.md §2 "Composite proposals"](instances/proposal.md#composite-proposals). The new `value_kind` field also makes `proposed_value`'s shape self-describing for frontends (`'scalar:string'`, `'scalar:float'`, `'scalar:integer'`, `'rule'`, `'composite:*'`) — no per-action_key out-of-band knowledge needed to render the right editor.
- Q19 — see [governance.md §7](primitive/governance.md#7-the-mod-gate) (the mod-gate, now two-tiered) and [governance.md §3](primitive/governance.md#petition-style-tally-and-dual-quorum-network-scope-only) (denominator inflation reframed). The mod-gate gains a **critical tier** keyed to the existing baseline/critical stakes split: low-stakes actions keep the flat **≥1 positive moderator vote**; destructive/irreversible ones (moderator role changes, `illegal`-redaction, guidelines amendments, critical `:Network` amendments) require `mod_yes ≥ ⌈Network.critical_mod_gate_fraction · |active mods|⌉` (new `:Network` property, default `0.50`, itself in the critical bucket so loosening it is a critical act — recursion closed). This shuts the catastrophic vector the flat-one gate left open: one compromised moderator key plus a community bot-flood could pass anything. Because the fraction is `≤ 1`, `⌈f · |active mods|⌉` never exceeds the active-mod count — the gate is always satisfiable, needs no absolute floor, self-strengthens as the moderator set grows (one or two mods round to one; a real majority at three+), and is deadlock-free; and since minting a moderator is itself critical, the denominator is Sybil-resistant by construction. Stake/wealth-gating was declined upstream (Q20) as plutocracy. The community-side denominator inflation is **not** a takeover vector — a petition tally counts only positive votes, so inflation can only make a Proposal harder to pass, never force one through — so it is reframed as a bounded *liveness* residual (the absolute bar `quorum_count` caps it), not an open question. Tier annotations propagated to [network.md §9/§11](primitive/network.md#9-mod-role-changes-via-multi-sig-proposal), [moderation.md §3](instances/moderation.md#3-the-mod-gate-rule), [platform-guidelines.md](instances/platform-guidelines.md), and [graph-data-model.md](implementation/graph-data-model.md).
- Q16 — see [feed-ranking.md §5](primitive/feed-ranking.md#5-algorithm). The intrinsic per-node scalar `S(t)` is dropped: the sort cascade's deepest fallback is **recency** — newest content first, ranked by the target's authorship-edge age ([feed-ranking.md §7](primitive/feed-ranking.md#7-time-and-recency)). Recency is a global node metric — cheap, not inbound-edge-gameable, and (per Q20) token-independent, so the lone fallback channel opens no side channel onto the non-traversable `:TRANSFERS` tensor. The abstract intrinsic-scalar framing didn't fit a network where every value is graph-derived relative to a viewer; the deepest fallback wants a concrete global signal, and freshest-wins is the obvious one. The candidate token/in-degree/path-count inputs are recorded as rejected in git history.
- Q23 — see [api-spec.md "Search"](implementation/api-spec.md#search). The global `search` index covers name-class fields and post titles only — User/Collective handles + display names, Hashtag/Chat/Item names, Post `title`; bodies, descriptions, bios, and attachments are unindexed, and Comment (no indexed field) is not a searchable kind. Name-class fields match case-insensitively by prefix and substring, titles by word-level full-text. Backend order is exact-match tier then newest-first — both viewer-independent, honoring [feed-ranking.md §9](primitive/feed-ranking.md#9-where-ranking-and-filtering-live)'s backend-never-ranks split; graph-blended ordering is the ranker's option over fetched candidates (no-AI rule applies), with recency the deepest fallback per Q16 — the delegated form is the miner's `rankSearch` operation ([miner-api.md](implementation/miner-api.md)). `sensitive` fields stay indexed and return with per-field status — the standard read-surface visibility model; redacted fields leave the index by construction. Chat messages are excluded from the global index — the scoped `chatSearch` query searches one chat's plaintext bodies newest-first, and encrypted content is never searchable server-side ([chats.md §9](instances/chats.md#9-encryption-as-the-privacy-mechanism)).
- Q24 — see [miner-api.md "Transport"](implementation/miner-api.md#transport), ["Delegation and trust"](implementation/miner-api.md#delegation-and-trust), and ["The §3.8 operations"](implementation/miner-api.md#the-38-operations). Wire form is **GraphQL with the pinned types verbatim** — a remote miner serves the same small schema, the on-device runner is an in-process call over the same types, and the backend-direct rollout stage hosts the operations in the backend's own schema; a second wire encoding was rejected as a hand-synced parallel serialization. The remote signature is `rank(viewer, params)`: reads are unauthenticated and `feedSlice` is viewer-parameterized, so the **miner re-fetches the slice itself** and the device never downloads it. Delegation is a **push model with no standing credential** — seen-list and rank params ride inside each request, the miner never authenticates to the backend (indistinguishable from an anonymous reader; [auth.md](implementation/auth.md) manages no delegation tokens), and revocation is the viewer ceasing to call. Output is **advisory and spot-checkable** — deterministic math means the device can re-rank any handful of targets and compare — with no mandated audit and no attestation; the remedy for a bad miner is switching. The §3.8 surfaces get **three dedicated stateless operations** (`severanceStatus`, `clusterAnalysis`, `redemptionCheck` — polled, watch lists and cadence client-side) returning structural facts; scores, thresholds, and action guidance stay frontend-computed per §3.8's frontend-latitude rule. Miner discovery and incentives are explicitly out of scope until someone wants to operate a paid miner.
- Q22 — see [feed-ranking.md §4.5](primitive/feed-ranking.md#45-computing-the-metric--message-passing-over-the-slice) (the per-target metric decomposes into `O(R·|E_slice|)` message-passing — `d(R)` per-hop, `f(Δt)` at reactor-edge readout, `s_path` a real accumulator, `c_path` a two-state taint lift, `i` drops the reactor edge, `j`/`k` no traversal; the sole obstruction is §3's vertex-simple invariant) and [feed-ranking.md §9](primitive/feed-ranking.md#9-where-ranking-and-filtering-live) (slice membership is a best-path **max** frontier — cheap and cycle-immune; the all-paths **sum** is the deferred metric). The invariant splits by regime: exact branch-and-bound enumeration when the slice is sparse (cheap, `b^R` small), a memory-1 **non-backtracking** relaxation when dense (kills the bidirectional 2-cycles §3 names; the triangle+ residual is a sub-percent `d(R)`-decayed effect, and adversarial tight clusters are caught structurally by severance/delta-funnel [§3.6–§3.8](primitive/feed-ranking.md#36-bot-resistance-via-the-0-0-severance-edge), the actual bot-bridge defense). `ε` is a compute-budget cutoff, not the cycle defense. Surfaces updated: [miner-api.md](implementation/miner-api.md) (`rank` is message-passing over the slice, the `RankPath` drill-down a separate bounded enumeration) and [notation.md](primitive/notation.md) (`ε`/`b` corrected — `ε` bounds the node-set, not the path count).

---

## Q25 — Standing miner delegation: a scoped credential or miner-held seen-list

**Where it shows up:** [miner-api.md "Delegation and trust"](implementation/miner-api.md#delegation-and-trust),
[feed-ranking.md §8.2](primitive/feed-ranking.md#82-storage--wherever-the-viewing-user-prefers)
**Status:** open (deferred — miner rollout phase)

### Context

The v1 delegation model (Q24) is push-only: the viewer's private
inputs — the seen-list and the rank params — ride inside each
request, the miner holds no credential and no standing state, and
revocation is the viewer ceasing to call. The forwarding cost
(device fetches a backend-stored seen-list, then forwards it) was
accepted to keep the miner credential-free. Two stateful
alternatives were set aside rather than designed:

- **A scoped delegation credential** letting the miner read the
  viewer's `user_view_log` directly, cutting the device out of the
  per-request data path. Rejected for v1: [auth.md](implementation/auth.md)
  manages no delegation tokens, and a standing credential needs
  issuance, scoping, and server-side revocation the push model
  avoids entirely.
- **A miner-held seen-list** — the seen-list living with the
  delegate as its own storage home, the fullest expression of the
  decentralization vision for a viewer whose ranking already runs
  there.

### The question

When delegated miners are real, does standing delegation become
worth its machinery? Specifically: what a scoped, revocable miner
credential looks like in auth.md's session model; whether a
miner-held seen-list re-enters
[feed-ranking.md §8.2](primitive/feed-ranking.md#82-storage--wherever-the-viewing-user-prefers)'s
storage-home list, and what compaction and multi-device sync mean
for it; and whether the answer changes the trust posture (today a
miner is indistinguishable from an anonymous reader).

### Constraints (from established principles)

- **Revocation must stay simple.** The push model's symmetry — the
  viewer stops calling, nothing to revoke server-side — is the bar
  any credential design has to clear.
- **The math is storage-agnostic.** §8.1's calculator takes a JSON
  list; where it came from must keep not mattering.
- **No new sensitivity claims.** Viewing history is no more
  sensitive than reaction history per the network's transparency
  posture; a credential design shouldn't imply otherwise.

### Related

Q24 (resolved — pinned the v1 push model), miner selection and
incentives ([miner-api.md "Out of scope"](implementation/miner-api.md#out-of-scope--miner-selection-and-incentives)
— same revisit trigger: someone actually operating a miner).

---

## Q15 — Cross-instance federation: identity reconciliation for handle-based and per-creation nodes

**Where it shows up:** [data-model.md "Node identity strategies"](implementation/data-model.md#node-identity-strategies) (Type 2 and Type 3 federation notes)
**Status:** open (deferred — federation phase)

### Context

The Q14 resolution settled three identity strategies in the data
model, with very different federation properties:

- **Type 1 — canonical-string identity, content-addressed
  UUIDv5** (Hashtag). Federates by construction when forks
  intend to share the namespace: the same canonical name
  produces the same UUID across any instance or fork. Forks
  that intend to diverge implicitly create incompatible
  hashtag IDs — the namespace UUID is committed forever the
  moment the genesis migration runs, so a fork keeping it
  inherits the shared namespace, and a fork rotating it
  breaks compatibility for every existing tag.
- **Type 2 — handle-based identity, random UUID + UNIQUE handle
  per instance** (User, Collective). Within an instance, the
  UNIQUE constraint prevents collision. Across separated
  instances, instance A's `@alice` and instance B's `@alice`
  have different UUIDs and could be the same person, two
  different people, or one impersonating another.
- **Type 3 — per-creation identity, random UUID alone** (Post,
  Comment, ChatMessage, Chat, Item, junction nodes). Within an
  instance, every creation is a distinct node. Across instances,
  cross-references (e.g. a post in instance A linked from
  content in instance B) require translation between local
  identities.

Type 1 is solved. Types 2 and 3 are open for any future
federation between Cogra instances.

### The question

When two separately-running instances begin to exchange data —
through a federation protocol, partial sync, or content embedded
in one another — how do their identity spaces reconcile?

Specifically:

- **Type 2 reconciliation (handles).** Instance A's `@alice` and
  instance B's `@alice`: same person or two? Manual claim by the
  owner with a cryptographic key? Inferred from external
  signals? Aliased explicitly via a graph mechanism? Always
  treated as different unless explicitly merged?
- **Type 3 reconciliation (per-creation).** A post in instance A
  referenced from instance B: does it get a "shadow" UUID in
  B's namespace? Is the original UUID preserved with an
  instance-prefix? How does cross-instance authorship
  attribution work?
- **Federation protocol surface.** How do instances discover
  each other, agree on synchronization scope, and handle
  disagreements (e.g. instance A says "Bob is a bot, severed,"
  instance B disagrees)?
- **`:Network` singleton ID distribution.** Within an instance
  the singleton's `id` is a one-query lookup, but every client
  composing a Network-scope Proposal needs that UUID up front.
  Across instances, each `:Network` has its own UUID; a
  federation protocol has to decide whether singleton IDs are
  discoverable, signed, or pinned to instance metadata. See
  [network.md §2](primitive/network.md#2-creation) and
  [graph-data-model.md](implementation/graph-data-model.md).
- **First-user serialization across instances.** Within one
  instance, the bootstrap migration is the only path that
  writes the genesis User, so concurrent registration cannot
  race ([network.md §2](primitive/network.md#2-creation),
  [auth.md](implementation/auth.md)). Two separately-running
  instances independently mint their own genesis users; if
  they later federate, the federation protocol has to decide
  what "the genesis user" means when both instances have one.
- **Hashtag UUIDv5 backend integrity.** Hashtag IDs are
  derived from a namespace UUID and the canonical name. The
  derivation runs in the backend, with no per-row check that
  `id == UUIDv5(namespace, name)`
  ([data-model.md](implementation/data-model.md)). Within one
  honest instance, backend discipline is sufficient. Federated
  exchange of hashtag references requires deciding whether
  instance B accepts instance A's hashtag IDs on trust, recomputes
  them, or expects an attestation (binary hash, signed build, or
  similar) that A computed the UUID the agreed way.

### Constraints (from established principles)

- **No central authority.** Per CLAUDE.md, anyone can fork and
  self-host. Federation cannot depend on a central registry.
- **Append-only.** Per [layers.md](primitive/layers.md),
  reconciliation cannot retroactively rewrite local state. New
  layers / new edges may be appended; old ones stay.
- **Transparency.** Reconciliation choices (alias, claim, merge)
  leave a visible trace on-graph.
- **Severance is local to the severing community.** Per
  [feed-ranking.md §3.7](primitive/feed-ranking.md#37-cascading-severance-and-redemption), the math is
  per-viewer. Federation should not import or export severance
  state automatically.

### Options considered

None worked out yet. Surfaced as possibilities only:

- **Cryptographic claim / proof.** Users hold a key pair;
  claiming an identity across instances requires signing with
  the private key. Solves the "is this the same person?"
  question but raises key-management questions and introduces a
  cryptographic dependency.
- **Aliasing edges.** A new edge type that maps "instance A's
  `@alice` → instance B's `@alice`" as an explicit graph-level
  claim. Requires consensus on what counts as authoritative
  aliasing.
- **Always-distinct.** Instances treat each other's identities
  as separate. Federation only allows reading, not merging.
  Loses the cross-instance same-person semantics but is the
  simplest model.
- **Hybrid (per-strategy).** Different reconciliation rules for
  Type 2 (cryptographic claim) and Type 3 (instance-prefix
  cross-references).

### Related

Q14 (resolved — sets up the per-type strategies that this
question completes for the cross-instance case),
[feed-ranking.md §3.7](primitive/feed-ranking.md#37-cascading-severance-and-redemption) (cluster
severance — local to the severing community per principle, but
federation could change this).

