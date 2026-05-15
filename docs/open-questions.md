# Open Questions

All unresolved design questions across the project, consolidated here.

Each entry is self-contained enough that a fresh reader (human or AI)
can engage without having to read every other doc. Pointers from the
origin docs link here; as questions are resolved, the answer moves
into the relevant design doc and the entry below is removed.

**Scope.** Design questions only — things we have not decided. Pure
implementation TODOs, known-outdated docs, and tasks on a roadmap are
out of scope. (`api-spec.md` is flagged as pending rewrite; it's not
a design question, it's a rewriting task, so it's not listed here.)

---

## Resolution order

The questions below are listed in **topic** order (roughly: ranking
primitives → onboarding → data model → chats → policy). The
**resolution** order is different — some questions genuinely can't be
answered until others are. Work them in roughly the order below;
within a phase, order is flexible.

| Phase | # | Question | Why here |
|:---:|:---:|:---:|---|
| 1. Sort fallback | 1 | **Q16** | Derivation of `S(t)`, the intrinsic per-node scalar that breaks ties at the bottom of the sort cascade. Q2 settled the rest of the math but left S's inputs open. Pure ranking math; no external dependency. |
| 2. Content back-edges | 2 | **Q17** | Should content actor edges influence ranking of other content by the same author? Five options identified (B1–B5), none evaluated. The simplest implementation — a structural `Content → Author` back-edge — has two failure modes: bot-bridge amplification and path-weight asymmetry. Mid-priority design question, not blocked. |
| 3. Path-set audit | 3 | **Q18** | Path-uniqueness (simple-paths) and path-subsumption rules for the feed-ranking traversal. Forward-blocked on Q17 — until content back-edges are decided, the path-set's gameable shapes can't be fully enumerated, since a back-edge change would create new candidate path topologies any subsumption rule would have to cover. |
| 4. Federation phase | 4 | **Q15** | Identity reconciliation across separately-running instances for handle-based and per-creation node types. Type 1 nodes (hashtags) federate for free per Q14; Types 2 and 3 need a protocol. Deferred until federation becomes concrete. |

As questions resolve, their blocks disappear from below and their
rows disappear from this table. The table stays in place until all
questions are closed.

**Resolved:**

- Q7 — see [data-model.md §"author_id + author_type"](implementation/data-model.md#author_id--author_type--discriminator-not-foreign-key).
- Q8 — see [chats.md §10](instances/chats.md#10-moderation) and [governance.md §7](primitive/governance.md#7-instances).
- Q3 — see [graph-model.md §3](primitive/graph-model.md#3-edge-categories) "What creates an actor edge — stances-not-events".
- Q2 — see [feed-ranking.md §3-§4](primitive/feed-ranking.md#3-per-edge-composition-along-a-path) (per-edge composition, parallel tracks, taint rule, sum collapser) and [graph-model.md §6](primitive/graph-model.md#6-dimension-semantics) (dim1/dim2 unification, filtering vs. graph math). S's intrinsic derivation deferred — tracked as Q16.
- Q11 — see [feed-ranking.md §3.5–§3.6](primitive/feed-ranking.md#35-bot-resistance-via-the-0-0-severance-edge) (`(0, 0)` severance edge, cascading severance, redemption) and [feed-ranking.md §5](primitive/feed-ranking.md#5-algorithm) (zero-jail banishment of `h(t) = 0`). Self-discovery and return-pathway UX surfaces are tracked as forward sub-questions Q12 and Q13.
- Q12 — see [feed-ranking.md §3.7.1](primitive/feed-ranking.md#371-severance-discovery--the-inbound-side) (severance discovery via inbound self-query, trust-weighted reading) and [feed-ranking.md §3.7.2](primitive/feed-ranking.md#372-bot-cluster-identification--auto-detection-from-path-patterns) (auto-detection of bot-bridge nodes via hourglass path patterns, with path-length-aware action guidance). Cause identification is the auto-detect's job, complemented by the community posts in §3.7.3.
- Q13 — see [feed-ranking.md §3.7.4](primitive/feed-ranking.md#374-severance-redemption--the-outbound-side) (severer-side redemption surface, hourglass check on the redeeming node's outbound) and [feed-ranking.md §3.7.5](primitive/feed-ranking.md#375-self-redemption-posts) (self-redemption posts via the same `bot-defense` hashtag mechanism, surfaced in the severer's "review severed accounts" view).
- Q14 — see [data-model.md "Node identity strategies"](implementation/data-model.md#node-identity-strategies) (three-strategy framework: content-addressed UUIDv5 for canonical-string nodes like Hashtag, random UUID + UNIQUE handle for User/Collective, random UUID alone for per-creation nodes). Hashtag IDs are now content-addressed so independent creations of the same canonical name converge on one node. Cross-instance federation reconciliation for Types 2 and 3 is deferred as Q15.
- Q6 — see [invitations.md "Default values and customization"](primitive/invitations.md#default-values-and-customization). Defaults are `(+0.5, +0.5)` on both edges; both inviter and invitee choose their own outgoing edge during the invitation flow. The doc walks through the asymmetric-friend example (`(+1, -1)` on the invitee side as a deliberate "love them, not their content" stance that lets a later second edge dominate the feed).
- Q4 — see [feed-ranking.md §7](primitive/feed-ranking.md#7-time-and-recency). Time decay anchors on the **reactor edge's top-layer age** (the last actor edge in the path), applied as a scalar `f(Δt)` multiplier alongside `d(R)` to all four metrics (`h, i, j, k`). Default exponential with **30-day half-life**, frontend-tunable. Intermediate edges don't decay — silence on a relationship edge is not stance revocation. Post-node age has no separate decay — the authorship edge is itself a reactor edge and ages with the post, so old-with-no-engagement decays naturally and old-with-fresh-engagement resurfaces via fresh reactor-edge layers. Worked cold-start example in §7.3 shows the math.
- Q1 — see [graph-model.md §8](primitive/graph-model.md#8-append-only-history-edges). Layer count, layer timestamps, and the sequence of past edge values are **not ranking inputs**. They are metadata for audit, history, and UI surfaces (e.g., a "this edge has been revised N times" indicator, or a stale-edge prompt). Ranking sees only the top layer of each edge — the user's current expressed stance. Rationale: introducing layer-count amplification would let the system infer intent from interaction frequency, in tension with both **stances-not-events** ([graph-model.md §3](primitive/graph-model.md#3-edge-categories)) and the user-controlled-ranking principle. Edge cases like "two friends with identical edges but very different real-world contact frequency" are explicitly not auto-resolved by the system; users update stances reactively (similar to pruning a stale subscription list) rather than the system inferring from behavior.
- Q5 — see [feed-ranking.md §8](primitive/feed-ranking.md#8-the-already-seen-filter). The seen-list is a per-viewer set of content UUIDs treated as **another input to the feed-ranking computation**, alongside `R`, `d(R)`, `f(Δt)`, and the §5.2 friend-author-boost. Pre-rank exclusion (perf win — already-seen content never enters the math). New activity on a seen post does **not** resurface it; the new comment/reaction is independently rankable as its own node. Storage location is the viewer's choice — backend-side `user_view_log` table in Postgres is the central frontend's default ([data-model.md](implementation/data-model.md)), but self-hosted clients/miners can keep the same data locally and pass it to the calculator (the math is the same regardless of where the JSON came from). Default frontend rule for "seen": every content item that passes through the viewport during a render. Frontend batches and flushes on natural checkpoints (batch-fill, scroll pause, app close); cache-clear before flush is an accepted small loss-window. Default 1-year compaction bounds storage at ~7 MB per active-user-year; the trade-off (a resurging old post will reappear if its view-log entry has been compacted) is documented and treated as acceptable feed character. No privacy-concealment story — viewing history is no more sensitive than reaction history per the network's transparency posture; "history" becomes a UI feature using the same data.
- Q10 — reframed as a side note rather than an open design question. See [layers.md "Side note on long-term storage"](primitive/layers.md#side-note-on-long-term-storage). Typical actor behavior bounds layer accumulation tightly — people update an edge a handful of times over its lifetime, not hundreds, and node properties change even less frequently. The corner cases that *would* accumulate substantial history (e.g., a decades-old company restructuring through CollectiveMember edges) are precisely the ones where preserving history has value. If a real instance ever runs into storage pressure, compaction-friendly approaches that respect the no-silent-deletion principle exist — but it's an implementation-time decision contingent on real data, not a design-time one to settle preemptively.
- Q9 — see [moderation.md](instances/moderation.md) and [network.md](primitive/network.md). Authorization for redaction runs through community-driven Network governance: any User authors a Proposal classifying content as `illegal`; threshold-cross requires at least one moderator's positive vote (the gate), ≥2/3 of cast votes in favor, and a low community quorum; threshold-cross triggers the [layers.md §5](primitive/layers.md#5-deletion-policy) redaction cascade. External pressure (court orders, etc.) doesn't bypass the mechanism — it prompts a moderator to start the same Proposal, which the community completes. Pathological corner cases (all moderators compromised) fall under the federation/forking exit per Q15.

---

## Q16 — Derivation of `S(t)`, the intrinsic node scalar

**Where it shows up:** [feed-ranking.md §2](primitive/feed-ranking.md#2-parameters) (S in the variable table) and [feed-ranking.md §5](primitive/feed-ranking.md#5-algorithm) (S as the final fallback after the h-cascade tie-breakers)
**Status:** open (forward sub-question of Q2)

### Context

The feed-ranking algorithm uses `S(t)` as a per-node intrinsic
scalar: the deepest fallback in the sort cascade. When `h`,
`h+i`, `h+i+j`, and `h+i+j+k` all tie, `S` decides the order.
The Q2 resolution settled the rest of the math but explicitly
left `S`'s derivation open.

### The question

What inputs feed `S(t)`?

The "intrinsic" framing is loose — nothing in CoGra is
universally intrinsic; everything is derivable from graph state
relative to a viewer. Candidate inputs include the node's own
authorship-edge age, the node's neighborhood density, the node
type itself, or composite measures over the local subgraph. The
choice affects how ties resolve in sparse graphs, on cold-start
viewers, and for users whose default values produce many exact
ties (e.g. integer `+1/0/-1` interaction styles).

### Constraints (from established principles)

- **No AI ranking.** `S` must be derivable from graph state, not
  from a learned model.
- **Append-only.** `S` is a derived value; it can be recomputed
  from the source data. It does not layer.
- **Per-viewer.** `S` is per-viewer, not globally intrinsic.
- **Rare in practice.** The cascade only triggers on strict
  equality, so `S` is the deepest fallback. Whatever derivation
  is chosen does not need to be cheap to compute on every node;
  it is computed only for the small set of candidates that
  reach this cascade depth.

### Options considered

None worked out yet.

### Related

Q2 (resolved — sets up the cascade that `S` terminates).

---

## Q17 — Should content actor edges influence ranking of other content by the same author?

**Where it shows up:** [feed-ranking.md §3.1](primitive/feed-ranking.md#31-which-edges-contribute-factors) (only actor edges contribute factors; structural edges count toward `R` but add no factor), [feed-ranking.md §3.5–§3.6](primitive/feed-ranking.md#35-bot-resistance-via-the-0-0-severance-edge) (bot-defense math), [graph-model.md §3](primitive/graph-model.md#3-edge-categories) (stances-not-events), [graph-model.md §7](primitive/graph-model.md#7-directionality-inbound-edges-dont-affect-your-graph) (inbound edges don't affect feeds)
**Status:** open (mid-priority design question, not blocked)

### Context

Today, content actor edges — `User → Post`, `User → Comment`,
`User → ChatMessage`, `User → Item` — contribute only to ranking
*that specific* content node. A post has no outgoing edge back
to its author, so paths starting at a User and passing through
one of their own content nodes terminate at the content.

That means liking a post does not, on its own, raise the weight
the feed gives to other posts by the same author. The user wants
content likes to shape the feed (matching the intuition that
"I liked their last three posts" implies "show me more from
them"), but identified two failure modes that block the
simplest implementation — a structural `Content → Author`
back-edge.

### The question

Should there be a mechanism — graph-side or frontend-side — by
which content actor edges propagate signal to ranking of other
content by the same author? If yes, which mechanism?

Two failure modes for the simplest design (a structural back-edge):

(a) **Bot bridges.** A structural `Content → Author` back-edge
    means one accidental like on a bot's post becomes a graph-
    amplification entry into the bot cluster, with much lower
    friction than the existing "deliberate follow" entry path.
    Severance + hourglass defenses
    ([feed-ranking.md §3.5–§3.6](primitive/feed-ranking.md#35-bot-resistance-via-the-0-0-severance-edge))
    still work at the entry edge, but the bar to *creating* an
    entry drops significantly.

(b) **Path-weight asymmetry.** Per
    [feed-ranking.md §3.1](primitive/feed-ranking.md#31-which-edges-contribute-factors),
    only actor edges contribute factors to path products;
    structural edges count toward `R` but add no factor. A
    content-mediated path at `R = 3` (User → actor edge → Post
    → structural back-edge → Author) carries only one actor-
    edge factor, while a user-mediated path at the same `R = 3`
    (User → friend → friend → Author) carries three. Content
    paths are mathematically privileged at equal `R`, breaking
    the symmetry the rest of the math is built on.

### Constraints (from established principles)

- **Stances-not-events**
  ([graph-model.md §3](primitive/graph-model.md#3-edge-categories)).
  No implicit edges. If signal flows from a like to an author,
  the mechanism creating that signal must itself be an explicit
  gesture by the actor.
- **Inbound edges don't affect feeds**
  ([graph-model.md §7](primitive/graph-model.md#7-directionality-inbound-edges-dont-affect-your-graph)).
  Traversal stays outbound from the viewing user; this rules
  out any "the author has many inbound likes" boost.
- **Bot defense math**
  ([feed-ranking.md §3.5–§3.6](primitive/feed-ranking.md#35-bot-resistance-via-the-0-0-severance-edge)).
  Assumes narrow bridges that severance can close. A widely-
  used back-edge surface that opens many parallel bridges into
  a cluster breaks the assumption.

### Options considered

Five sketched in the brainstorm, none evaluated:

- **B1 — Punt to frontend.** Content likes don't change the
  graph. The UI prompts the user to explicitly follow authors
  after N likes. Cleanest with respect to the principles; pushes
  the intent-capture work to the frontend.
- **B2 — Back-edge with at-most-one-per-path cap.** A
  structural `Content → Author` back-edge exists, but each
  path may traverse at most one. Bounds amplification but
  introduces a new traversal rule the rest of the math doesn't
  have.
- **B3 — Back-edge with explicit cross-edge weight discount
  (e.g. ×0.3).** Reintroduces a factor at the back-edge to
  restore path-weight symmetry. Solves the asymmetry but
  introduces a calibration constant that has to be defended.
- **B4 — Back-edge gated on bidirectional content engagement.**
  Back-edge only forms when the author has reciprocated some
  engagement with the liker. Cute but adds substantial
  complexity to edge creation and revocation.
- **B5 — Back-edge that propagates only to the author node,
  not to their other content.** Content likes surface a "people
  you might like" candidate set without opening cluster
  amplification beyond the author themselves.

A related calibration question rides on the outcome: `d(R)`
currently decays at `0.1^(R-1)`
([feed-ranking.md §4](primitive/feed-ranking.md#4-per-target-metrics)).
A back-edge that creates shorter content paths into authors
might demand a flatter decay (the user noted `0.05^(R-1)` as
the right direction in that case, to keep direct follows
dominant). The calibration stays parked with this question.

### Related

Q18 (forward sub-question, blocked on this).
[feed-ranking.md §3.1](primitive/feed-ranking.md#31-which-edges-contribute-factors)
sets up the actor-only-factor convention this question would
modify.

---

## Q18 — Path-uniqueness and path-subsumption rules for feed-ranking traversal

**Where it shows up:** [feed-ranking.md §3](primitive/feed-ranking.md#3-per-edge-composition-along-a-path) (per-edge composition along a path), [feed-ranking.md §4](primitive/feed-ranking.md#4-per-target-metrics) (per-target metrics, sum across paths)
**Status:** open (forward-blocked on Q17)

### Context

The feed-ranking traversal sums per-path contributions across
all paths from the viewing user to each candidate target. Two
things about that path-set are currently unstated:

(a) Whether every path must be **simple** (no node visited
    twice). The current edge catalog does not by itself prevent
    loops; a path revisiting a node would multiply the same
    node's mediating role into its own product.

(b) Whether paths sharing an intermediate with a shorter path
    to the same target should be **discounted or capped**. The
    user raised the concern that 100 paths at `R = 3` through
    transit node Bob can outweigh 1 path at `R = 2` from Bob
    himself, even though all 100 share the same Bob — Bob's
    mediation appears 100 times in the sum without each
    occurrence being any more informative about the target.

### The question

(a) **Simple-paths invariant.** Should "every path features
    every node at most once" be stated as an invariant in
    [feed-ranking.md §3](primitive/feed-ranking.md#3-per-edge-composition-along-a-path)?

(b) **Path-subsumption / single-transit-cap.** Should paths
    sharing an intermediate node with a shorter path to the
    same target be discounted? Or should any single transit
    node's contribution to a given target be capped?
    Trust-propagation literature has both approaches; neither
    is currently in the math.

### Constraints (from established principles)

- **Per-viewer, outbound traversal**
  ([graph-model.md §7](primitive/graph-model.md#7-directionality-inbound-edges-dont-affect-your-graph)).
  Whatever rule is chosen applies during the viewer's outbound
  walk.
- **No AI ranking** ([CLAUDE.md](../CLAUDE.md)). The rule must
  be a deterministic graph-traversal rule, not a learned
  weighting.
- **Forward-blocked on Q17.** Until Q17 decides whether content
  back-edges exist, the path-set's gameable shapes can't be
  fully enumerated — a back-edge change would create new
  candidate path topologies that any path-subsumption rule
  would have to cover.

### Options considered

None yet (blocked on Q17).

### Related

Q17 (must resolve first).

---

## Q15 — Cross-instance federation: identity reconciliation for handle-based and per-creation nodes

**Where it shows up:** [data-model.md "Node identity strategies"](implementation/data-model.md#node-identity-strategies) (Type 2 and Type 3 federation notes)
**Status:** open (deferred — federation phase)

### Context

The Q14 resolution settled three identity strategies in the data
model, with very different federation properties:

- **Type 1 — canonical-string identity, content-addressed
  UUIDv5** (Hashtag). Federates by construction. Same canonical
  name produces the same UUID across any instance or fork. No
  reconciliation needed.
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

### Constraints (from established principles)

- **No central authority.** Per CLAUDE.md, anyone can fork and
  self-host. Federation cannot depend on a central registry.
- **Append-only.** Per [layers.md](primitive/layers.md),
  reconciliation cannot retroactively rewrite local state. New
  layers / new edges may be appended; old ones stay.
- **Transparency.** Reconciliation choices (alias, claim, merge)
  leave a visible trace on-graph.
- **Severance is local to the severing community.** Per
  [feed-ranking.md §3.6](primitive/feed-ranking.md#36-cascading-severance-and-redemption), the math is
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
[feed-ranking.md §3.6](primitive/feed-ranking.md#36-cascading-severance-and-redemption) (cluster
severance — local to the severing community per principle, but
federation could change this).
