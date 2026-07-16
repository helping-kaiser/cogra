# Substrate

How CoGra runs as a Layer 2 on the **PeerNetworks Layer 1** — the
flow every other doc builds on: what the layers provide, what CoGra
owns, the gesture pattern, and the closed menu of mechanisms a CoGra
concept can map onto. The per-concept mappings live in
[substrate-map.md](substrate-map.md); the binding L1 contract this
doc summarizes is [layer1-interface.md](layer1-interface.md) — where
the two disagree, the interface doc governs.

---

## 1. The layer stack

- **Layer 0 (Peer Attestation)** — the frame source. Exports the
  attestation map; the admission money lives here. Layer 1 reads it
  only as the per-actor scalar `B_i` — cumulative, non-decreasing,
  publicly auditable. CoGra never authors Layer 0 records; it reads
  L0 exports through L1's interface.
- **Layer 1 (PeerNetworks)** — the shared public graph
  `G = (V, E)` and the binding surface: the accepted edge set, the
  declared constants, the burn snapshot, the four admission rules,
  and the two straddlers (standing `α_i` as gate input, title
  `owner^(k)`). Public, append-only, replayable
  ([layer1-interface.md §1](layer1-interface.md#1-the-layer-model)).
- **Layer 2 (CoGra)** — a guild in L1's terms: a terminal service
  plus the set of L1 actors acting through it. CoGra consumes L1's
  published values, authors edges from L1's fixed inventory, and
  owns the entire terminal complement — feed, reward, attribution,
  membership, moderation, governance, identity association, payload
  carriage.

**Two graphs, one substrate.** L1's graph is the shared public
record — every CoGra act that binds or must be publicly attributable
lands there as an L1 edge record. CoGra *also* owns a graph: the
Memgraph store, partitioned into a **mirror** of the L1 records
CoGra traverses and an **overlay** of L2-only structure L1 has no
home for (§3). The mirror is a cache of L1's truth; the overlay is
CoGra's own truth. Neither is a second authority over anything L1
binds.

---

## 2. The boundary: consume vs. reimplement

L1's boundary is a closure, not a list: an object is **binding**
iff some read-site of it feeds back into what may be written to the
shared graph, and **terminal** iff every read-site ends at an agent
([layer1-interface.md §2](layer1-interface.md#2-the-boundary-predicate-feedback-closure)).
The binding surface is
**{kernel, rules, α-as-gate, title} — and no larger**.

What CoGra **consumes as published** (recompute only to audit):

- the accepted edge set `E_k` and the epoch certificates;
- the declared and derived constants;
- the burn snapshot `B_i` (an L0 input surfaced by L1);
- the four admission rules — the two-gate write rule
  (W1 solvency / W2a wall / W2b door), closure, formation,
  settlement recognition
  ([layer1-interface.md §7](layer1-interface.md));
- standing `α_i` as gate input and title `owner^(k)` as read by
  recognition — the two straddlers, freely readable downstream but
  never authored.

What CoGra **owns and reimplements freely**, under the guild
reimplementation grant
([layer1-interface.md §4](layer1-interface.md#4-the-reimplementation-grant)):

- the feed `S(u,c)` — [feed-ranking.md](feed-ranking.md);
- the reward `R_C` and its attribution calculus, subject to the
  three CAN invariants (depth decay, transmission < 1,
  context independence) — [economics.md](economics.md);
- membership folds — chat membership, collective membership;
- moderation and governance — [governance.md](governance.md),
  [moderation.md](../instances/moderation.md);
- identity association — the map from an L1 actor to the person
  behind it is never represented at L1;
- payload carriage, rendering, and content schemas (§7).

The obligation that comes with the grant: **every terminal default
CoGra replaces, CoGra specifies in public** — a published, complete
spec any participant can reproduce (the formula-completeness
invariant, `subsec:deployment:completeness`). Reproducibility of
CoGra's feed and reward is CoGra's own published commitment, not a
consumed L1 guarantee.

---

## 3. CoGra's stores

CoGra runs a dual-database core, partitioned around the L1 seam:

- **Memgraph — mirror.** A cache of the L1 records CoGra's
  traversals consume (feed ranking, attribution, membership folds).
  It may lag the L1 record; it must never diverge from it. Nothing
  in the mirror is authoritative.
- **Memgraph — overlay.** CoGra's own graph: nodes and edges L1 has
  no home for. Proposal tally state, the `:Network` singleton,
  collective-membership junctions. Overlay structure is CoGra's
  truth, governed by CoGra's own rules.
- **Postgres.** Display content and operational metadata — what a
  record *shows*, never what it *is*. Graph topology never lives
  here.
- **Blob storage.** Media bytes, verifiable against the digests
  committed in payloads (§7).

Money sits in none of these. The admission money is Layer 0's, read
only as `B_i`; CoGra's own reward economy has its own rail —
[economics.md](economics.md), [token.md](token.md),
[ledger.md](../implementation/ledger.md).

Store-level mechanics (schemas, sync, failure modes) live in
[graph-data-model.md](../implementation/graph-data-model.md).

---

## 4. The gesture pattern

Every CoGra flow decomposes the same way:

1. **An L1 gesture** — an edge from L1's fixed inventory, authored
   by the acting actor (or a system actor, §8). This is the
   load-bearing public fact: priced, witnessed, irrevocable,
   visible to every other L2.
2. **L2 payload on that record** — the flow-specific content and
   state, carried in the Peer Content Envelope (§7), covered by the
   payload witness.
3. **Overlay and Postgres state** — traversal structure the mirror
   can't express and display content, written by the backend in the
   same flow.

The worked example: a chat invitation. The L1 gesture is the
Invitation hyper-edge (Actor → Chat → Profile of the invitee) — a
public, priced vouch that the invitee fits the community. The
invitation message rides as payload. Membership itself materializes
only from the invitee's **own** Participant edge — proposals never
participate
([layer1-interface.md §9.8](layer1-interface.md#98-membership-proposals-and-revocation)).
CoGra's invite UX, notification state, and acceptance flow are
overlay and Postgres state around those two records.

The pattern generalizes: the state machine of a flow lives in L2;
L1 holds the acts that must bind or be publicly attributable. What
never works: encoding CoGra state in L1 records beyond the fixed
inventory's semantics, or letting an L2 fold silently contradict
what the L1 records show.

---

## 5. The mechanism menu (closed)

Every CoGra concept maps onto **exactly one primary mechanism**
(combinations allowed, one primary named per concept — see the per
concept table in [substrate-map.md](substrate-map.md)):

1. **L1 gesture** — an edge from the fixed inventory
   ([layer1-interface.md §9](layer1-interface.md#9-node-and-edge-type-inventory)).
   CoGra authors only inventory edges; there is no custom edge
   type. Which families CoGra authors, with which semantics:
   [edges.md](edges.md).
2. **Payload on an L1 record** — content and flow state riding the
   gesture, bounded by `M_payload`, witness-covered (§7). Every
   edge carries a payload projection, so every gesture can carry
   state.
3. **L2 overlay in Memgraph** — nodes and edges of CoGra's own
   graph, for structure that must be traversable but has no L1
   home (§3).
4. **Postgres / off-graph** — display content, operational
   metadata, private per-user state.

Plus one recurring composition: **system-actor materialization** —
a passed L2 decision (a Proposal) is materialized on L1 by a
designated CoGra system actor authoring an inventory edge toward
the target (§8). This is mechanism 1 executed by a special author,
and it is the standard bridge from CoGra governance to the shared
record.

The menu is closed: a design that needs a fifth mechanism is a
design question for this doc, not a per-instance improvisation.

---

## 6. Authoring path and admission

**Backend-mediated.** The CoGra backend is the actor's authoring
agent toward L1 — it holds the association between the person's
account and their L1 actor (identity association is terminal by
contract) and submits their gestures. Client-direct authoring is a
decentralized-phase roadmap item
([roadmap.md](../implementation/roadmap.md)).

**Admission is L1's, checked before submitting.** A gesture lands
only if its author clears the two-gate write rule
([layer1-interface.md §7.1](layer1-interface.md#71-the-two-gate-write-rule)):

- **W1 — solvency:** `b_i ≥ θ`; the write debits `θ` from the
  actor's residual balance. Capacity *is* the balance — remaining
  acts are `⌊b_i/θ⌋`, restored immediately by committing burns.
- **W2a — the wall:** the actor's boundary-frozen action stamp
  clears the safety floor, `ρ_act ≥ ρ_θ`. Individual, never
  averaged.
- **W2b — the door:** the epoch's action-weighted stamp average
  clears the effective floor, `ρ_ep ≥ ρ_eff`, within the epoch
  budget. Band actors enter when the door has headroom.

The backend checks eligibility against this surface before
submitting, and drives the restoration flows when a check fails: an
insolvent actor (W1) restores capacity immediately by committing
burns; re-crossing the wall (W2a) takes some combination of new
burns and admissible vouch-positive connections from actors with
source rates above the current standing — burns alone can
suffice. Who funds these debits — genesis, pooled
subsidies, treasury — is economics:
[economics.md](economics.md).

**Vocabulary.** The L1 admission price is the **θ-debit**, named by
L1's own term. "Burn" in CoGra docs means CGT supply destruction —
CoGra's reward-economy concept — and is never borrowed for the
admission side.

---

## 7. Payload carriage

CoGra is the carriage service for its users' content. The model is
**witness-anchored carriage**
([layer1-interface.md §8.3](layer1-interface.md#83-the-edge-record-and-payload-carriage)):

- **The container is the Peer Content Envelope** — a
  deterministic-CBOR manifest holding CoGra's structured fields
  (title, body text, …) and **digests** of media and large bodies.
  CoGra's fields ride in the guild keyspace; any L2 can parse and
  round-trip the container, but CoGra's fields are opaque to
  non-CoGra L2s — interop is structural, not semantic.
- **Big bytes live external.** Media sits in CoGra blob storage,
  verifiable against the committed digests. The witness covers the
  envelope bytes; external resources are witnessed transitively
  through their digests — substitution or rot is publicly
  detectable evidence, not prevented delivery.
- **Node type is never in the payload.** Type is fixed by the
  authoring L1 edge (declarative identity); envelope conformance is
  a binary L2 admission check, never a ranking or reward signal.
- **Removal is the deletion story.** Payload state moves one way,
  full → reduced: removing payload and salt erases content — never
  rewrites it — while the structural record stays. The visible mark
  for "never erase silently" is exactly this pair: the immutable
  structural record plus the monotone reduced-only payload state.
  Policy and flows: [layers.md](layers.md),
  [moderation.md](../instances/moderation.md).
- **E2EE chat commits over ciphertext.** The witness binds the
  ciphertext; confidentiality is key custody, not record hiding.

---

## 8. System actors

CoGra system actors are **ordinary L1 actors that CoGra regards as
special** — L1 grants them nothing. They exist to materialize
CoGra-level outcomes as shared-graph records:

- a passed Proposal is finalized by a system actor authoring an
  **Opinion `(0,0)` + payload** (outcome, tally digest) toward the
  proposal's anchor — the general materialization gesture;
- moderation verdicts are **Tag `(0,0)` + payload** toward a named
  moderation Type;
- platform documents are anchored by a **publisher-authored
  Content node**.

Three genesis system actors exist — **moderation, publisher,
inviter** — burn-funded from the community treasury
([economics.md](economics.md)) and endorsed at bootstrap to clear
the wall like any other actor. The burn is not optional: standing
is ignition-then-amplification — endorsement alone cannot reach a
zero-burn actor
([layer1-interface.md §7.1](layer1-interface.md#71-the-two-gate-write-rule)). Their gestures are priced like anyone's: a verdict costs
capacity per passed proposal. Bootstrap, key handling, and the full
gesture vocabulary: [network.md](network.md),
[governance.md](governance.md),
[moderation.md](../instances/moderation.md).

---

## 9. Reading order

For the primitive layer, the docs build in this order:
[layer1-interface.md](layer1-interface.md) (the contract) → this
doc (the flow) → [substrate-map.md](substrate-map.md) (per-concept
mappings) → [nodes.md](nodes.md) / [edges.md](edges.md) (the
catalogs) → [graph-model.md](graph-model.md) (behavior of the
stores and records).
