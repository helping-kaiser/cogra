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
| 1. L1-author discussion | 1 | **Q30** | L1 key model — the signature scheme L1 verifies and same-actor key rotation. Q29's custody resolution leans on both: a Schnorr-family scheme makes the Collective 2-of-2 split an off-the-shelf threshold configuration, and without rotation a compromised creator key is unfixable. Open in discussion with the L1 team. |
| 2. When multi-device onboarding pain is real | 1 | **Q33** | Cross-device handshake continuation — whether a second device holding the restored actor key may complete a handshake the first device started, instead of waiting out the expiry re-stage. Interim-crypto-scoped (Q30): may dissolve at the substrate swap. |
| 2a. Stance control (slice 2.2, both clients) | 1 | **Q42** | The resting face an unauthored stance target wears. Cheap to answer and worth answering soon: the two clients are shipping the control now, and a face is a shared contract exactly as §8.4's anchor table is. |
| 2b. Profile surface (with slice 2.2) | 3 | **Q35, Q36, Q41** | The profile header's connection count (which fold counts as a connection — answerable now that every passive class rides one stance control), the owner-chosen default filter for the profile chronicle (worth carrying? witnessed payload field or L2 preference?), and whether the chronicle's targets grow a settled-content serving mode. Slice 2.1 ships without all three. |
| 3. Miner rollout phase | 1 | **Q25** | Standing miner delegation — a scoped credential or miner-held seen-list over the v1 push model. Deferred until delegated miners are real; shares the trigger with miner incentives ([miner-api.md "Out of scope"](implementation/miner-api.md#out-of-scope--miner-selection-and-incentives)). |
| 4. Federation phase | 1 | **Q15** | Federation between independently-bootstrapped L1 networks — same-person claims, cross-network references, two-Charter reconciliation. Within one network, identity is shared by construction. Deferred until federation becomes concrete. |

As questions resolve, their blocks disappear from below and their
rows disappear from this table. The table stays in place until all
questions are closed.

**Resolved:**

- Q43 — see [api-spec.md "Conventions"](implementation/api-spec.md) (a batch is priced whole before any of it is staged). Prepare reads the balance once and prices the whole batch — N acts at the current θ — refusing it entire before staging a single act, so an author never holds half a gesture they authored as one. It is a **pre-check, never a reservation**, exactly like the per-act W1 check it generalizes: nothing holds the balance, so it can still move before the acts land and a batch that passes can still take a per-act refusal later. The alternatives were declined — a client-side quote promises what no server stands behind, and leaving the per-act check alone keeps the failure the composer's one-gesture framing hides, now that a creation batch reaches 21 acts (1 minting record + 10 tags + 10 references).
- Q34 — see [hashtag.md §4](instances/hashtag.md#4-the-current-topics-fold), pointed at from [post.md §3](instances/post.md#3-acts-around-a-post), [edges.md §3](primitive/edges.md#3-hyper-edge-families-cogra-authors), and [graph-model.md §3](primitive/graph-model.md#3-revision-and-current-state)'s declared-fold index. The fold is **newest-wins per (author, content, Type) bundle** — a Tag is a standing claim about the content-topic relevance, not an event, so the author's latest declaration is their current one, the same snapshot reading content edits carry. **Relevance `0` reads as withdrawn:** the un-tag gesture is re-tagging at relevance 0, a visible priced record like any other rather than an erasure — the `[0, 1]`-bounded family's analog of the `(0,0)` severance shape, which confidence's non-negative bound cannot otherwise express. A content node's current topics are the union of the current non-zero bundles across authors. A net-over-bundle fold (the Opinion shape) was rejected: it fits signed axes, and with confidence census-bounded to `c ∈ [0, 1]` no counter-record can net an accumulated bundle back down, so withdrawal would have needed special-casing.
- Q39 — see [platform-guidelines.md §5](instances/platform-guidelines.md#5-license-and-provenance-obligations) and [layer1-interface.md §10](primitive/layer1-interface.md#10-content-governance-metadata-pn-full-9-seccontent--full-paper-only): both axes are degrees on `[0, 1]` — attribution `a` credits the maker, provenance `o` requires a public, auditable record of uses — and ``prop:content:closure-exclusion`` grants their whole interpretation to Layer 2. CoGra publishes a reading for three degrees per axis (0, 0.5 "commercial uses only", 1), offers exactly those in its composers, defaults to Public Domain `(0, 0)`, and shows the pair on every content surface.
- Q37 — see [design.md §6](implementation/design.md#6-components), [android.md "Screens"](implementation/android.md#screens), and [web.md "Routes"](implementation/web.md#routes): the bar rides every **read** surface — the tab roots and the read drill-ins (post detail, any actor's profile) — and leaves the **task** flows (compose, profile edit, settings, invites, the key and auth surfaces), which carry a back arrow instead. A read drill-in is still reading, so the frame that got the reader there stays; a flow owns the screen until it finishes or is backed out of, and a tab tap mid-write is an accidental abandon. One rule for both clients, purely presentational — no graph or economics contact.
- Q38 — see [substrate.md §6](primitive/substrate.md#6-authoring-path-and-admission) and [design.md §9](implementation/design.md#9-honesty-surfaces): expired pending content vanishes for every reader (nothing ever existed on the graph, so nothing is marked); the author gets a calm did-not-land notice.
- Q7 — see [data-model.md §"author_id"](implementation/data-model.md#author_id--one-foreign-key-still-a-cache).
- Q8 — see [chats.md §6](instances/chats.md#6-moderation-inside-the-chat) and [governance.md §8](primitive/governance.md#8-instances).
- Q3 — see [graph-model.md §4](primitive/graph-model.md#4-stances-not-events) "Stances, not events".
- Q2 — see [feed-ranking.md §3–§4](primitive/feed-ranking.md#3-the-per-edge-primitive-and-the-fold) (the per-edge primitive, the fold, the path set). The deepest tie-break resolved separately — see Q16.
- Q11 — see [feed-ranking.md §8](primitive/feed-ranking.md#8-severance-discovery-redemption) (`(0, 0)` severance edge, cascading severance, redemption) and [feed-ranking.md §6](primitive/feed-ranking.md#6-the-score--greedy-disjoint-sum) (zero-jail banishment of `h(t) = 0`). Self-discovery and return-pathway UX surfaces are tracked as forward sub-questions Q12 and Q13.
- Q12 — see [feed-ranking.md §8.4](primitive/feed-ranking.md#84-discovery--the-inbound-self-query) (severance discovery via inbound self-query, trust-weighted reading) and [feed-ranking.md §8.5](primitive/feed-ranking.md#85-bridge-auto-detection) (auto-detection of bot-bridge nodes via delta-funnel path patterns, with path-length-aware action guidance). Cause identification is the auto-detect's job, complemented by the community posts in §8.6.
- Q13 — see [feed-ranking.md §8.7](primitive/feed-ranking.md#87-redemption) (severer-side redemption surface, delta-funnel check on the redeeming node's outbound; self-redemption posts via the same `bot-defense` hashtag mechanism, surfaced in the severer's "review severed accounts" view).
- Q14 — see [data-model.md "Node identity strategies"](implementation/data-model.md#node-identity-strategies) (three-strategy framework: content-addressed UUIDv5 for canonical-string nodes like Hashtag, random UUID + UNIQUE handle for User/Collective, random UUID alone for per-creation nodes). Hashtag IDs are now content-addressed so independent creations of the same canonical name converge on one node. Cross-instance federation reconciliation for Types 2 and 3 is deferred as Q15.
- Q6 — see [invitations.md §3 "Default values and customization"](primitive/invitations.md#3-default-values-and-customization). Defaults are `(+0.1, +0.1)` on both stances — the repo-wide low-defaults policy (normal actions default low so stronger stances stay expressible); both inviter and invitee choose their own stance during the invitation flow. The doc walks through the asymmetric-friend example: "love them, not their content" is a modest positive pair, never negative connection — a `p_i < 0` stance taints every path through it and suppresses rather than neutralizes.
- Q4 — see [feed-ranking.md §5.3](primitive/feed-ranking.md#53-recency). Time decay anchors on the **reactor edge's top-layer age** (the last actor edge in the path), applied as a scalar `f(Δt)` multiplier alongside `d(R)` to all four metrics (`h, i, j, k`). Default exponential with **30-day half-life**, frontend-tunable. Intermediate edges don't decay — silence on a relationship edge is not stance revocation. Post-node age has no separate decay — the authorship edge is itself a reactor edge and ages with the post, so old-with-no-engagement decays naturally and old-with-fresh-engagement resurfaces via fresh reactor-edge layers. The mechanics this entry names are the pre-§6 design, since superseded — no `d(R)` and no `h, i, j, k` metrics exist in the current model, and `Δt` is **epoch age**, with the half-life a governed parameter measured in epochs rather than a wall-clock 30 days ([feed-ranking.md §5.3](primitive/feed-ranking.md#53-recency)).
- Q1 — see [graph-model.md §3](primitive/graph-model.md#3-revision-and-current-state). Layer count, layer timestamps, and the sequence of past edge values are **not ranking inputs**. They are metadata for audit, history, and UI surfaces (e.g., a "this edge has been revised N times" indicator, or a stale-edge prompt). Ranking sees only the top layer of each edge — the user's current expressed stance. Rationale: introducing layer-count amplification would let the system infer intent from interaction frequency, in tension with both **stances-not-events** ([graph-model.md §4](primitive/graph-model.md#4-stances-not-events)) and the user-controlled-ranking principle. Edge cases like "two friends with identical edges but very different real-world contact frequency" are explicitly not auto-resolved by the system; users update stances reactively (similar to pruning a stale subscription list) rather than the system inferring from behavior.
- Q5 — see [feed-ranking.md §9.4](primitive/feed-ranking.md#94-the-already-seen-filter). The seen-list is a per-viewer set of content UUIDs applied as a read-side layer of the feed computation, beside §9.2's friend-fresh reordering (a reorder layer, never a boost). Pre-rank exclusion (perf win — already-seen content never enters the math). New activity on a seen post does **not** resurface it; the new comment/reaction is independently rankable as its own node. Storage location is the viewing user's choice — backend-side `user_view_log` table in Postgres is the central frontend's default ([data-model.md](implementation/data-model.md)), but self-hosted clients can keep the same data locally and pass it to the calculator (the math is the same regardless of where the JSON came from); a delegated miner holds no copy — the seen-list rides inside each request per Q24's push model. Default frontend rule for "seen": every content item that passes through the viewport during a render. Frontend batches and flushes on natural checkpoints (batch-fill, scroll pause, app close); cache-clear before flush is an accepted small loss-window. Default 1-year compaction bounds storage at ~7 MB per active-user-year; the trade-off (a resurging old post will reappear if its view-log entry has been compacted) is documented and treated as acceptable feed character. No privacy-concealment story — viewing history is no more sensitive than reaction history per the network's transparency posture; "history" becomes a UI feature using the same data.
- Q10 — reframed as a side note rather than an open design question. See [layers.md "Side note on long-term storage"](primitive/layers.md#side-note-on-long-term-storage). Typical actor behavior bounds layer accumulation tightly — people update an edge a handful of times over its lifetime, not hundreds, and node properties change even less frequently. The corner cases that *would* accumulate substantial history (e.g., a decades-old company restructuring through CollectiveMember edges) are precisely the ones where preserving history has value. If a real instance ever runs into storage pressure, compaction-friendly approaches that respect the no-silent-deletion principle exist — but it's an implementation-time decision contingent on real data, not a design-time one to settle preemptively.
- Q9 — see [moderation.md](instances/moderation.md) and [network.md](primitive/network.md). Authorization for redaction runs through community-driven Network governance: any User authors a Proposal classifying content as `illegal`; threshold-cross requires at least one moderator's positive vote (the gate), ≥2/3 of cast votes in favor, and a low community quorum; threshold-cross triggers the [layers.md §5](primitive/layers.md#5-deletion-policy) redaction cascade. External pressure (court orders, etc.) doesn't bypass the mechanism — it prompts a moderator to start the same Proposal, which the community completes. Pathological corner cases (all moderators compromised) fall under the federation/forking exit per Q15.
- Q17 — see [feed-ranking.md §4](primitive/feed-ranking.md#4-the-path-set). No `Content → Author` back-edge exists or is added; content actor edges terminate at the content node and contribute only to ranking that content. The "I liked Alice's last three posts, so show me more Alice" intuition is supported by an explicit follow gesture, not inferred from post-affinity — that inference would be exactly the behavior-to-edge translation [graph-model.md §4](primitive/graph-model.md#4-stances-not-events) (stances, not events) rules out. Back-edge variants (with-cap, with-weight-discount, gated-on-reciprocation, propagate-to-author-only) each failed against either bot-bridge amplification or the actor-only-factor symmetry of §3.1, or both. A frontend may surface a follow-prompt after observed repeated engagement, but this is a UX nudge, not a graph mechanism, and is not added prophylactically — revisit only if feed-quality data shows the gap matters.
- Q18 — see [feed-ranking.md §3](primitive/feed-ranking.md#3-the-per-edge-primitive-and-the-fold) (path simplicity is by construction — every hop factor is below one, so a cyclic walk revisiting an intermediate only shrinks; no separate vertex-simple rule or visited set exists, and mutual-edge 2-cycles never let the same intermediate's mediating role multiply into the product) and [feed-ranking.md §5](primitive/feed-ranking.md#5-per-path-quantities) (single-transit-cap rejected — for 100 paths `U → Aᵢ → B → t` the sum factors as `d(3) · s(B → t) · Σᵢ s(U → Aᵢ) · s(Aᵢ → B)`, a clean product of "network-aggregate endorsement of `B`" times "`B`'s stance on `t`," which is trust propagation working correctly; bot-bridge amplification is already handled by severance + delta-funnel auto-detection in §8, and `d(R)` already calibrates direct-vs-indirect, making 100 R=3 paths beating one R=2 path the intentional default). The "every hop attenuates" entry in [invariants.md "Ranking"](primitive/invariants.md#ranking) carries the rule.
- Q20 — see [economics.md](primitive/economics.md) (pull-marketing campaigns: the `Campaign` node, the sustained-level `achieved_h_gain` metric, per-path Shapley attribution `φ_i = Σ w_π/|A_π|`, advertiser-discretionary release `P ∈ [0, D]`, the conservation equation with a flat-on-D anti-spam floor plus a scaling-on-P split, and the `Settlement`-node claim flow), [token.md](primitive/token.md) (CGT: decaying calendar mint on the peer-network curve with no fresh premine, one-sided V3 POL above spot with fees routed to treasury), and [ledger.md](implementation/ledger.md) (three stores, money → chain; self-custody key from signup, non-custodial never-expiring claim escrow, the `Wallet` node). Q20.2's ledger home is the chain as a third store; Q20.3's "pull marketing" anchor is [economics.md §2](primitive/economics.md#2-pull-marketing). Surfaced follow-ups: Q16's token angle (token signals excluded from `S`) carried into its recency resolution; the mod-gate hardening direction it surfaced carried into the Q19 resolution. The rail specifics this entry names are the pre-Liquid design, since superseded — single-store Postgres beside the Liquid-native rail, ladder POL instead of V3, push payouts instead of the claim escrow, no `Wallet` node ([ledger.md](implementation/ledger.md)).
- Q21 — see [collectives.md §6](instances/collectives.md#6-the-social-contract). The role-catalog problem dissolves under a single layered `governance` map property on `:Collective`, keyed by `action_key` string. Each entry is a `Rule` of paired `exec` + `amend` triples so amendment cost is calibrated per-rule (CEO-can-hire stays cheap; share-distribution stays expensive) and the `amend` triple is self-applying (no infinite regress, no primitive default needed). The role vocabulary is **implicit** — the set of strings used in any `governance.<key>` eligibility predicate plus the strings assigned to any active member's `role`; typos are amendable like any other `role` change via a Proposal targeting `CollectiveMember.role`. Schema is fixed (one map property, declared in [data-model.md](implementation/data-model.md)); the action set is data, so new action keys never require a schema change. Composite atomic changes spanning multiple junctions (e.g. admit shareholder with redistribution, transfer shares between shareholders) ride on a new `value_kind = 'composite:<action_key>'` discriminator on Proposal with `_from` / `_to` bundle entries the cascade re-validates against current state — see [proposal.md §2 "Composite proposals"](instances/proposal.md#composite-proposals). The new `value_kind` field also makes `proposed_value`'s shape self-describing for frontends (`'scalar:string'`, `'scalar:float'`, `'scalar:integer'`, `'rule'`, `'composite:*'`) — no per-action_key out-of-band knowledge needed to render the right editor.
- Q19 — see [governance.md §7](primitive/governance.md#7-the-mod-gate) (the mod-gate, now two-tiered) and [governance.md §3](primitive/governance.md#petition-style-tally-and-dual-quorum-network-scope-only) (denominator inflation reframed). The mod-gate gains a **critical tier** keyed to the existing baseline/critical stakes split: low-stakes actions keep the flat **≥1 positive moderator vote**; destructive/irreversible ones (moderator role changes, `illegal`-redaction, guidelines amendments, critical network parameter amendments) require `mod_yes ≥ ⌈Network.critical_mod_gate_fraction · |active mods|⌉` (new governed network property, default `0.50`, itself in the critical bucket so loosening it is a critical act — recursion closed). This shuts the catastrophic vector the flat-one gate left open: one compromised moderator key plus a community bot-flood could pass anything. Because the fraction is `≤ 1`, `⌈f · |active mods|⌉` never exceeds the active-mod count — the gate is always satisfiable, needs no absolute floor, self-strengthens as the moderator set grows (one or two mods round to one; a real majority at three+), and is deadlock-free; and since minting a moderator is itself critical, the denominator is Sybil-resistant by construction. Stake/wealth-gating was declined upstream (Q20) as plutocracy. The community-side denominator inflation is **not** a takeover vector — a petition tally counts only positive votes, so inflation can only make a Proposal harder to pass, never force one through — so it is reframed as a bounded *liveness* residual (the absolute bar `quorum_count` caps it), not an open question. Tier annotations propagated to [network.md §9/§11](primitive/network.md#9-mod-role-changes), [moderation.md §3](instances/moderation.md#3-the-mod-gate-rule), [platform-guidelines.md](instances/platform-guidelines.md), and [data-model.md](implementation/data-model.md).
- Q16 — see [feed-ranking.md §6](primitive/feed-ranking.md#6-the-score--greedy-disjoint-sum). The intrinsic per-node scalar `S(t)` is dropped: the sort cascade's deepest fallback is **recency** — newest content first, ranked by the target's **genesis** authorship record's age, which an update record never refreshes ([feed-ranking.md §5.3](primitive/feed-ranking.md#53-recency)). Recency is a global node metric — cheap, not inbound-edge-gameable, and (per Q20) token-independent, so the lone fallback channel opens no side channel onto the money rail. The abstract intrinsic-scalar framing didn't fit a network where every value is graph-derived relative to a viewer; the deepest fallback wants a concrete global signal, and freshest-wins is the obvious one. The candidate token/in-degree/path-count inputs are recorded as rejected in git history.
- Q23 — see [api-spec.md "Search"](implementation/api-spec.md#search). The global `search` index covers name-class fields and post titles only — User/Collective handles + display names, Hashtag/Chat/Item names, Post `title`; bodies, descriptions, bios, and attachments are unindexed, and Comment (no indexed field) is not a searchable kind. Name-class fields match case-insensitively by prefix and substring, titles by word-level full-text. Backend order is exact-match tier then newest-first — both viewer-independent, honoring [feed-ranking.md §11](primitive/feed-ranking.md#11-where-ranking-runs)'s backend-never-ranks split; graph-blended ordering is the ranker's option over fetched candidates (no-AI rule applies), with recency the deepest fallback per Q16 — the delegated form is the miner's `rankSearch` operation ([miner-api.md](implementation/miner-api.md)). `sensitive` fields stay indexed and return with per-field status — the standard read-surface visibility model; redacted fields are excluded by an explicit skip-redacted index rule (redaction leaves a visible in-place marker, so a current value still exists to match). Chat messages are excluded from the global index — the scoped `chatSearch` query searches one chat's plaintext bodies newest-first, and encrypted content is never searchable server-side ([chats.md §7](instances/chats.md#7-encryption-as-the-privacy-mechanism)).
- Q24 — see [miner-api.md "Transport"](implementation/miner-api.md#transport), ["Delegation and trust"](implementation/miner-api.md#delegation-and-trust), and ["The pair-state operations"](implementation/miner-api.md#the-pair-state-operations). Wire form is **GraphQL with the pinned types verbatim** — a remote miner serves the same small schema, the on-device runner is an in-process call over the same types, and the backend-direct rollout stage hosts the operations in the backend's own schema; a second wire encoding was rejected as a hand-synced parallel serialization. The remote signature is `rank(viewer, params)`: reads are unauthenticated and `feedSlice` is viewer-parameterized, so the **miner re-fetches the slice itself** and the device never downloads it. Delegation is a **push model with no standing credential** — seen-list and rank params ride inside each request, the miner never authenticates to the backend (indistinguishable from an anonymous reader; [auth.md](implementation/auth.md) manages no delegation tokens), and revocation is the viewer ceasing to call. Output is **advisory and spot-checkable** — deterministic math means the device can re-rank any handful of targets and compare — with no mandated audit and no attestation; the remedy for a bad miner is switching. The §8.4–§8.7 surfaces get **three dedicated stateless operations** (`severanceStatus`, `clusterAnalysis`, `redemptionCheck` — polled, watch lists and cadence client-side) returning structural facts; scores, thresholds, and action guidance stay frontend-computed per §3.8's frontend-latitude rule. Miner discovery and incentives are explicitly out of scope until someone wants to operate a paid miner.
- Q22 — see [feed-ranking.md §6.1](primitive/feed-ranking.md#61-definition) and [§11](primitive/feed-ranking.md#11-where-ranking-runs). Ranking is computable as declared: the score is the exact greedy disjoint-sum — a never-sampled k-node-disjoint path extraction over the viewer's slice — and [miner-api.md "The contract"](implementation/miner-api.md#the-contract) pins the slice a ranker fetches. The `RankPath` drill-down is produced by the same extraction that produced the score ([miner-api.md "Output"](implementation/miner-api.md#output)). Adversarial tight clusters are caught structurally by severance/delta-funnel ([feed-ranking.md §8](primitive/feed-ranking.md#8-severance-discovery-redemption)), the actual bot-bridge defense.
- Q26 — see [chats.md §7 "Keys, organized in epochs"](instances/chats.md#keys-organized-in-epochs) and [layers.md §3 "Derived caches do not layer"](primitive/layers.md#derived-caches-do-not-layer). `Chat.epoch` is a **derived cache** — rebuildable as `1` plus the count of effected membership transitions plus passed `decision:rotate_key` Proposals, both append-only and timestamp-pinned; layers.md now states that a cache may be a fold over past events, not only a function of current state. The rotation outcome joins [proposal.md §6](instances/proposal.md#6-lifecycle)'s no-graph-layer list: the cascade refreshes the cache in place, a cache refresh is not an outcome carrier ([governance.md §2.5](primitive/governance.md#25-outcome)), and the Proposal's terminal `status` is the on-graph record. The layered-property alternative was rejected as the exact anti-pattern layers.md names — duplicating history that already lives in the source data, at a layer per membership change.
- Q27 — see [collectives.md §6 "Example configurations"](instances/collectives.md#example-configurations) and ["Action keys"](instances/collectives.md#action-keys-and-dispatch). Resolved as a hybrid split on how binding one member's gesture is: ``actas:vote:Proposal`` stays — the Collective's vote in someone else's tally is re-castable by any eligible member while that tally is live — but Item transfer routes through a new ``decision:transfer:Item`` entry (household unanimous, co-op ≥ 2/3), because the owner's transfer signature is the sole gate on the asset and irrevocable once the counterparty signs ([items.md §4](instances/items.md#4-transfer-the-settlement-handshake)). The `decision:` namespace gains the outward-gesture form `decision:<gesture>:<target_type>`, whose cascade performs the gesture the matching `actas:` key would execute immediately — the only expressible concurrence on an outgoing gesture, act-as rules being eligibility-only per [governance.md "Co-signed acts"](primitive/governance.md#co-signed-acts-threshold--1).
- Q29 — see [auth.md "Key recovery"](implementation/auth.md#key-recovery) (user posture) and [collectives.md §2](instances/collectives.md#2-custody) (Collective custody). **Users:** email recovery restores the login only; the actor is restored by an opt-in client-encrypted key backup — the device generates a high-entropy recovery code alongside the signing key, encrypts the key locally, and CoGra stores only ciphertext it cannot decrypt (zero-custody preserved; theft needs code *and* login, so redundant copies of the code are safe against loss in a way raw-key copies never are). Generated codes only — a user-chosen passphrase over a stored blob is the offline-crackable failure mode, viable only behind guess-limited secure hardware this posture avoids depending on. Declining backup keeps husk semantics (device loss = actor loss, stated at key creation); a passkey-wrapped (WebAuthn PRF) second unlock is a foreseen extension. **Collectives:** the creator holds the full key (full custody from founding, censorship escape, same recovery posture); every other act-as-eligible member signs via a per-member 2-of-2 split — member device holds one half, the backend the other, the full key never assembled — so the backend alone can sign nothing (no operator custody) and a member cannot sign around the contract: the backend co-signs only after checking the member's user-key-signed instruction against the governance map (action-key eligibility, passed decision where required). Removal = the backend deletes its half; no membership event forces a re-key. Rejected: member-threshold signatures (human-quorum ceremony weight, resharing on every membership change) and per-member L1-registered full keys (any holder could sign decision-gated acts unilaterally); the per-member device+server split is the standard embedded-wallet architecture. The two L1 dependencies (signature scheme, actor key rotation) split off as Q30.
- Q31 — see [nodes.md §1](primitive/nodes.md#1-l1-node-types-the-shared-graph). L1 rules genesis **per record**: `mint` takes an *act* identifier, so a per-family reading would falsify the identifier algebra's arity. An act of a mint-capable family whose terminal target equals the mint of its own identifier is the genesis act and mints; an act of the same family toward an existing node mints nothing — it is an update record, the formation footing under [substrate.md §9](primitive/substrate.md#9-node-values-and-updates)'s per-family carriers. [layer1-interface.md §8.1](primitive/layer1-interface.md#81-acts-projections-partition-and-passivity) carries the rule.
- Q32 — see [auth.md "Tokens"](implementation/auth.md#tokens) ("Reuse detection" and "The security notice"). The promise gained its carrier as a narrow field: refresh-token reuse stamps `user_credentials.reuse_detected_at`, and the first successful login after detection carries the stamp as `LogInPayload.reuseDetectedAt` — read-and-cleared atomically behind the verified password, delivered exactly once, never on a refusal. Refresh-time codes stay collapsed into `REFRESH_TOKEN_INVALID` so the presenter — possibly the thief — never learns detection fired. Clients render a dismissible alert on the signed-in shell via an in-memory hand-off; a client death before rendering loses the notice, the accepted narrow-carrier trade-off. If more security-event kinds ever arise, the narrow field is removed in favor of a general security-event surface, not extended field-by-field. (The other gap the web port surfaced — a dedicated `RESET_TOKEN_INVALID` code — had already shipped with slice 1.1's custody change.) When revocation reasons landed (auth.md "Reuse detection"), a second notice kind — "you signed this device out from elsewhere" for benign owner-revoked replays — was considered and declined: those replays now refuse plainly without the theft alarm, and a distinct notice is exactly the general security-event surface this record reserves, so it waits until that surface is warranted.
- Q44 — raised and resolved in one design session (2026-08-27); the ruling is recorded in [design/readme.md §13](../design/readme.md#13-decided-in-design-sessions) until it moves into the product docs. **An anonymous or applicant reader's feed borrows a vantage point.** Ranking consumes only viewer-rooted forward paths and a guest has none, so a guest feed would have no order but newest. Decided: an invite link carries its inviter's perspective — the visitor browses the feed as the inviter sees it, which [auth.md](implementation/auth.md)'s "a frontend can serve any actor's view of it to any reader" already licenses; a bare arrival borrows the genesis moderator's view (a human account, never a system one); the borrowed view is always named on screen ("Browsing from @mira's view — join to build your own."), persists through the applicant days, and hands over at the member's first stance, the vouch-back — which the inviter seeded, so the feed barely moves at the handover. No new exposure: everything a borrowed view reveals is derivable from the public record. Carriers to update at implementation time: [feed-ranking.md](primitive/feed-ranking.md) (the anonymous read path) and [auth.md](implementation/auth.md) (the applicant shell).
- Q43 — resolved in the compose design session (2026-08-27): **a creation batch is all-or-nothing.** The prepare quotes the whole batch and refuses it whole when the balance cannot carry it — an author never keeps a half-staged batch. On screen the count of signed actions is the only cost unit ("This creates 4 signed actions"), stated before signing with "they land together, or none does"; θ is never rendered, and the community pool that covers members' signings is named at the seal ([design/readme.md §13](../design/readme.md#13-decided-in-design-sessions)). The server-side cumulative pre-check is in implementation as of this ruling. Carrier to update: [api-spec.md](implementation/api-spec.md) (the write flow's batch semantics).
- Q45 — raised and resolved in the compose design session (2026-08-27); rulings recorded in [design/readme.md §13](../design/readme.md#13-decided-in-design-sessions) until they move into the product docs. **The compose flow's product rulings:** (1) a post's body is words OR media — one picture, a set, or one video with a cover — never both; words beside media go in the description; title and description stay optional. The current API (`content` required, `attachments` beside it) needs the XOR. (2) Media carries one crop per post: Tall 4:5, Square 1:1, or Wide 1.91:1, section chosen per picture. (3) A comment stays text plus optional media. (4) Authors can self-mark content sensitive with an optional public reason; the mark veils body and description per the per-field model while the title stays readable — a new field on the creation inputs and a policy for [moderation.md](instances/moderation.md)'s read-side flags. (5) Accounts carry a default-license setting (Public domain until changed) that the composer reads. (6) An edit is one batch: the content edit plus topic/citation adds and withdrawals sign together under the all-or-nothing rule. (7) Drafts are local-only, one per target, kept automatically on leaving. (8) The did-not-land notice (Q38) is a calm card in the shell naming the post, that nothing was spent, and that the draft is saved. Carriers at implementation time: [api-spec.md](implementation/api-spec.md), [post.md](instances/post.md), [comment.md](instances/comment.md), [moderation.md](instances/moderation.md).
- Q28 — closed on both sides with the L1 author. **Standing:** v0.23's initiator-owned rebase compiles a Reference into standing only as a complete act through the source's view of its *author*, and self-reference is compiler-excluded. **Feed:** [feed-ranking.md §4](primitive/feed-ranking.md#4-the-path-set)'s two-channel rule — for a jailed reference author, the content-intrinsic channel never opens (author ≠ carrier author) and the initiator-owned channel crosses at the viewer's forward weight to the jailed author, which is dead. **Self-invitation is an accepted residual:** a confederate account reproduces the geometry legally, so no self-guard closes it; CoGra declines to render such interactions as read-side policy, and the earnings side is closed by economics.md's exclusion rules ([economics.md §8.2](primitive/economics.md#82-players-exclusions-sign)). Accepted leftover geometry, on record: the Invitation T-leg twin persists in the feed (hyper-edge legs traverse ordinarily; Marginal tier; severance cannot net the inviter's own leg) — covered by the same read-side policy, with extending the two-channel rule to Invitation T-legs available if it ever matters — and a jailed author's minted Comments stay reachable via Review T-legs (commentary visibility, moderation's domain).

---

## Q30 — L1 key model: signature scheme and actor key rotation

**Where it shows up:**
[collectives.md §2](instances/collectives.md#2-custody) (custody),
[substrate.md §6](primitive/substrate.md#6-authoring-path-and-admission)
(client-signed authoring),
[auth.md "Key recovery"](implementation/auth.md#key-recovery)
**Status:** open (in discussion with the L1 team)

### Context

Q29's custody resolution leans on two properties of L1's key
model that our docs nowhere pin down:

- **Which signature scheme does L1 verify?** The Collective
  custody model signs by per-member 2-of-2 co-signing
  ([collectives.md §2](instances/collectives.md#2-custody)).
  Under a Schnorr-family scheme (Ed25519 ideally) that is a
  standard, audited threshold-signing configuration producing an
  ordinary signature — the verifier cannot tell a split key
  signed, and needs no changes. Under ECDSA the two-party
  protocols exist in production but carry a materially worse
  implementation-attack history.
- **Can an actor rotate to a new key while keeping its identity,
  L0 address, and standing?** Without rotation, a leaked or
  compromised key — above all a Collective creator's full key —
  is unfixable forever, and any future custody migration is
  impossible.

Neither blocks documenting the resolved design; both gate its
implementation.

**Edition-4 status (PN v0.23.2-dev):** L1 now specifies a
mandatory act-authentication handshake — author pre-commitment,
host-sealed verified act, author approval witness — but expressly
declares signature schemes, key management, and algorithm
migration deployment concerns, and says nothing about rotation
(``post:graph:act-authentication-requirements``,
``rem:graph:authentication-realization-out-of-scope``;
[layer1-interface.md §8.2](primitive/layer1-interface.md#82-the-write-dependencies-and-the-admission-handshake)).
Both questions stay open, now aimed at that postulate's
realization rather than at silence.

**Interim realization (stand-in only).** The L1 stand-in's
handshake runs on Ed25519 signatures, SHA-256 salted hash
commitments, and canonical CBOR serialization
(`common::l1::crypto`) — the Schnorr-family lean this question
already records, chosen so slice work can sign records today.
A stand-in-scoped deployment choice, not a Q30 resolution: the
real substrate's schemes replace it at the swap, and rotation
remains unaddressed.

---

## Q33 — Cross-device handshake continuation

**Where it shows up:**
[api-spec.md "The write flow"](implementation/api-spec.md#the-write-flow),
[web.md "The onboarding poll loop"](implementation/web.md#the-onboarding-poll-loop)
**Status:** open (deferred — revisit when multi-device onboarding pain is real, or at the substrate swap)

### Context

The approve step verifies the host-sealed act against handshake
material persisted on the device that pre-signed — device custody
is the anti-substitution guarantee. When a staged write sits at
`SEALING`/`AWAITING_APPROVAL` and the current device holds no
material (pre-signed in another browser; custody cleared), both
clients refuse with a synthesized `INTERNAL` "awaiting re-stage"
and wait: the staging garbage-collects after `gcAfterEpochs`, and
an approved application re-stages on a later status poll. Correct
and self-healing, but slow — and on web the second-browser case
is easier to hit than on Android.

### The question

A device holding the same restored actor key could instead verify
the served act's embedded pre-signature under its own public key
(recomputing the pre-commitment message from the served body,
nonce, and payload) and approve — cryptographically sound, since
a valid pre-signature proves a holder of this key signed exactly
that body. It widens the trust posture from "what THIS device
signed" to "what SOME holder of this key signed", so it is a
deliberate design change, not an implementation shortcut. The
whole interim handshake is stand-in-scoped (Q30); decide only if
the wait proves painful before the substrate swap.

---

## Q42 — The resting face an unauthored stance target wears

**Where it shows up:**
[design.md §8.3](implementation/design.md#8-the-stance-control)
(the resting target), §8.4 (the anchor table)
**Status:** open (Android ships 😐; web has to match whatever is
decided)

### Context

§8.3 settles that a viewer with no bundle sees "a **muted,
translucent face** … never a bare word", and §8.4 settles the
zero bundle's readout as 🤷. Neither names the emoji for the
third state — the target nobody has authored anything toward.

The constraints are real and narrow it a long way. It cannot come
from the anchor table, or an empty control would read as a
standing the viewer already holds. It cannot be 🤷, which now
means "severed, or netted to zero" — a state the ViewModel
deliberately tells apart from "never authored"
(`standingRecords`). And §8.4 fixes the vocabulary as system
emoji rather than drawn faces.

Android ships 😐 at M3's 0.38 disabled-content opacity: a face
outside the table, carrying no valence, muted so it reads as
waiting rather than as an answer.

### The question

Is 😐 the resting face? The table in §8.4 is the contract because
both clients read it, and this face is the same kind of thing —
so whatever is decided belongs in §8.3 as a named value rather
than in two apps' source.

Jakob's lean (2026-08-25, hand test): **🫥** — the dotted-line
face reads as "nothing here yet" better than 😐's neutrality.
Caveat that defers the call: 🫥 renders very differently across
platforms (the WhatsApp glyph is not the system one), so the
choice wants a cross-device look first. 😐 stays until then.

---

## Q35 — The profile connection count: which fold counts

**Where it shows up:**
[design.md §6](implementation/design.md#6-components) (profile
header), [api-spec.md "Actors"](implementation/api-spec.md)
**Status:** open (deferred — the profile header ships without the
count in slice 2.1)

### Context

design.md's profile-header inventory names a **connection
count**, and the profile screen will eventually show direct
connections both ways (who this actor connects to, who connects
to them). No doc defines the fold behind the number: what counts
as a "connection" (any non-`(0,0)` Opinion bundle? reciprocated
only? a threshold on the bundle's sum?), whether a severed bundle
subtracts, and whether the two directions are one number or two.
A math-shaped claim with no math is not implementable
([CLAUDE.md](../CLAUDE.md) — trace claims to the docs).

The count reads Opinion bundles. Affinity is Actor → Type,
enforced by the census
([edges.md §2](primitive/edges.md#2-binary-families-cogra-authors)),
so no actor ever holds an Affinity toward a Profile.

### The question

What is the declared fold for an actor's connection count (and
the connection *lists* behind it)? The trigger has fired: slice
2.3 made a Type a stance target, so Affinity bundles are real and
every passive class now rides one control and one fold.
Display-only either way: inbound connections never shape the
holder's feed.

---

## Q36 — Owner-chosen default filter for the profile chronicle

**Where it shows up:**
[design.md §6](implementation/design.md#6-components),
[api-spec.md "Queries"](implementation/api-spec.md) (`records`)
**Status:** open (deferred — slice 2.1 ships a fixed default)

### Context

The profile screen lists everything an actor did — the
`records(author:)` chronicle with filter chips (posts, comments,
everything; more kinds as slices land). Slice 2.1 lands every
visitor on the posts filter. The idea on the table: the profile's
owner chooses which filter visitors land on — "people coming to
my profile start at my posts, but they can check out everything
else."

### The question

Is the default-filter choice worth carrying, and if so where does
it live? It is public display state, which suggests a
`actor_profile_versions` column plus a guild-key field on the
profile payload (witnessed like the other display fields) — but
it could also stay a pure L2 preference. Decide when profile
usage is real.

---

## Q41 — A settled-content serving mode for the chronicle's targets

**Where it shows up:**
[api-spec.md "Cursors"](implementation/api-spec.md) (`records`, the
`includePending` convention)
**Status:** open (surfaced by the chronicle landed-only pass, PR #412)

### Context

The chronicle guarantees *membership*: a record is listed exactly
when it is ordered fact, with no pending namespace to opt out of.
But a chronicle row points at a node, and a node read is always
current — a landed post carrying an unlanded edit serves the
pending version, marked PENDING. Content listings offer
`includePending: false` ("the version that landed"), so the
settled graph is reachable through `posts` — but not by
traversing from `records`.

### The question

Should the chronicle's *targets* grow a settled-content serving
mode — an `includePending`-style switch on `records` that makes
traversed nodes serve the landed version — or is the membership
guarantee the chronicle's whole contract, with settled reading
left to the content listings? Decide when a real reader wants the
settled graph through a profile.

---

## Q25 — Standing miner delegation: a scoped credential or miner-held seen-list

**Where it shows up:** [miner-api.md "Delegation and trust"](implementation/miner-api.md#delegation-and-trust),
[feed-ranking.md §9.4](primitive/feed-ranking.md#94-the-already-seen-filter)
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
[feed-ranking.md §9.4](primitive/feed-ranking.md#94-the-already-seen-filter)'s
storage-home list, and what compaction and multi-device sync mean
for it; and whether the answer changes the trust posture (today a
miner is indistinguishable from an anonymous reader).

### Constraints (from established principles)

- **Revocation must stay simple.** The push model's symmetry — the
  viewer stops calling, nothing to revoke server-side — is the bar
  any credential design has to clear.
- **The math is storage-agnostic.** The ranker takes a JSON
  list; where it came from must keep not mattering.
- **No new sensitivity claims.** Viewing history is no more
  sensitive than reaction history per the network's transparency
  posture; a credential design shouldn't imply otherwise.

### Related

Q24 (resolved — pinned the v1 push model), miner selection and
incentives ([miner-api.md "Out of scope"](implementation/miner-api.md#out-of-scope--miner-selection-and-incentives)
— same revisit trigger: someone actually operating a miner).

---

## Q15 — Federation between independently-bootstrapped L1 networks

**Where it shows up:** [data-model.md "Node identity strategies"](implementation/data-model.md#node-identity-strategies) (Type 2 and Type 3 federation notes),
[network.md §2](primitive/network.md#2-creation) (a fork sets its
own genesis)
**Status:** open (deferred — federation phase)

### Context

Within one PeerNetworks Layer 1 network, cross-instance identity
is solved by construction: every minted node is a
globally-identified L1 act shared by every L2 frontend over the
same records, and canonical-name Types converge by L1's identity
algebra with no reconciliation protocol
([hashtag.md §1](instances/hashtag.md#1-identity-and-the-naming-service)).
What remains open is the harder case: **two networks with
separate geneses** — a fork that set its own Charter
([network.md §2](primitive/network.md#2-creation)) or an
independently-bootstrapped deployment — later wanting to exchange
or merge content.

### The question

When two separately-bootstrapped networks begin to exchange data,
how do their spaces reconcile? Specifically:

- **Same-person claims.** The same person holds accounts on both
  networks. The client-held actor key makes a cryptographic claim
  the natural mechanism — the same key can sign on both — but
  what the claim binds (handles, standing, content authorship)
  and where it is recorded is undesigned.
- **Cross-network references.** A record minted on network A and
  cited from network B needs a network qualifier — minted
  identities are unique within one network's act order, not
  across orders.
- **Two-Charter reconciliation.** Each network has its own
  genesis, Charter, parameter schedule, and genesis actors;
  federation has to decide what, if anything, reconciles — and
  what "the genesis user" means when both networks have one.
- **Protocol surface.** Discovery, synchronization scope, and
  disagreement (network A severs an actor network B trusts).

### Constraints (from established principles)

- **No central authority.** Anyone can fork and self-host
  ([network.md §2](primitive/network.md#2-creation)); federation
  cannot depend on a central registry.
- **Append-only.** Per [layers.md](primitive/layers.md),
  reconciliation cannot retroactively rewrite local state; claims
  land as new records.
- **The census is closed.** No new L1 edge types can be minted;
  any aliasing or claim mechanism rides payloads on existing
  families, or lives off-graph.
- **Transparency.** Reconciliation choices (alias, claim, merge)
  leave a visible trace on-graph.
- **Severance is local to the severing community.** Per
  [feed-ranking.md §8.3](primitive/feed-ranking.md#83-cascading-severance--and-its-locality), the math is
  per-viewer. Federation should not import or export severance
  state automatically.

### Related

Q14 (resolved — sets up the per-type identity strategies; within
one network they need no cross-instance protocol at all),
[feed-ranking.md §8.3](primitive/feed-ranking.md#83-cascading-severance--and-its-locality) (cluster
severance — local to the severing community per principle, but
federation could change this).
