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
  declared constants, the burn snapshot, the admission rules,
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
lands there as an L1 edge record. CoGra *also* holds graph state: a
**record mirror** of the L1 records CoGra traverses and an
**overlay** of operational caches over them, both tables in
CoGra's single Postgres store (§3). The mirror is a cache of L1's
truth; the overlay is derived from it by CoGra's published fold
rules. Neither is a second authority over anything L1 binds.

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
- the admission rules — formation (with the approval handshake
  and the authoritative act order), the proposed final state, the
  staged standing package, the final gates (the two-gate write
  rule: W1 solvency / W2a wall / W2b door), settlement
  recognition, and the write
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

CoGra runs a single-store core — one Postgres instance plus blob
storage — partitioned around the L1 seam:

- **The record mirror.** A cache of the L1 records CoGra's
  traversals consume (feed ranking, attribution, membership folds);
  the traversal itself runs hop-by-hop in CoGra's own code over
  indexed record tables. The mirror may lag the L1 record; it must
  never diverge from it; it is fully rebuildable from published
  records. Nothing in the mirror is authoritative.
- **The overlay.** Operational caches derived from L1 records by
  CoGra's published fold rules — Proposal tally state,
  parameter-carrier state. Rebuildable like the mirror; the
  records and the published rules are the truth.
- **Display content and operational metadata.** What a record
  *shows*, never what it *is*.
- **Blob storage.** Media bytes, verifiable against the digests
  committed in payloads (§7).

Money sits in none of these. The admission money is Layer 0's, read
only as `B_i`; CoGra's own reward economy has its own rail —
[economics.md](economics.md), [token.md](token.md),
[ledger.md](../implementation/ledger.md).

Store-level mechanics (schemas, sync, failure modes) live in
[data-model.md](../implementation/data-model.md).

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
never works: repurposing a family's L1 semantics — a record must
mean to every other L2 what the census says it means — or letting
a CoGra fold silently contradict L1's own folds. Payload-borne
semantics with a published fold — ballots, edits, collective
membership — are the house pattern, not a violation: the payload
is exactly where guild meaning belongs
([layer1-interface.md §8.4](layer1-interface.md#84-the-act-record-and-payload-carriage)).

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
3. **L2 overlay** — CoGra's own structure, for state that must be
   queryable but has no L1 home (§3).
4. **Postgres / off-graph** — display content, operational
   metadata, private per-user state.

Plus two recurring compositions. **System-actor materialization** —
a passed L2 decision (a Proposal) is materialized on L1 by a
designated CoGra system actor authoring an inventory edge toward
the target (§8). This is mechanism 1 executed by a special author,
and it is the standard bridge from CoGra governance to the shared
record. And **node-value updates** — mechanisms 1 + 2 plus a
declared read fold, the single pattern behind every "edit" in
CoGra (§9).

The menu is closed: a design that needs a fifth mechanism is a
design question for this doc, not a per-instance improvisation.

---

## 6. Authoring path and admission

**Client-signed, backend-relayed.** A record's signature is the
actor's own: the signing key lives on the member's device and never
enters CoGra custody — it is the key the actor's L0 address, and
every value burned to it, hangs on. The backend is the actor's
preparation and transport agent, never their signer (it holds the
person ↔ actor association — identity association is terminal by
contract — and the carriage stores, nothing more). L1's admission
handshake requires two author signatures per act — the proposal
pre-commitment before host salting, and the approval witness over
the exact host-sealed verified act
([layer1-interface.md §8.2](layer1-interface.md#82-the-write-dependencies-and-the-admission-handshake))
— so one write runs in five steps:

1. **Prepare.** The backend validates the gesture (envelope
   conformance, L2 policy), pre-checks the write rule below, and
   assembles the canonical proposal — act body, payload envelope,
   dependency list — returning it to the client with the
   pre-digests, so the client recomputes what it commits to. The
   user never signs blind bytes.
2. **Pre-sign.** On the device, the client signs the proposal
   pre-commitment; the key never leaves it.
3. **Relay and seal.** The backend submits the pre-signed
   proposal to L1, whose host verifies it, adds the projection
   salts, and returns the sealed **verified act**.
4. **Approve.** The client verifies the host seal and the exact
   returned body, checks both commitment openings, and signs the
   **approval witness** — only then is the act orderable. The
   backend relays the approval and drives retries across epoch
   boundaries; relaying confers nothing: both signatures cover
   the act, so the backend can neither alter it nor author one
   unasked.
5. **Confirm.** The mirror converges on the accepted act and
   the staged payload is promoted to permanent carriage (§7). A
   prepared act that never lands is discarded, staged payload
   included, after a bounded number of epochs.

**Content exists at authoring, not at landing.** A prepared record
is its author's content from the moment they sign it, readable by
everyone from that moment and marked as not yet final. Landing is
when L1 finality arrives — when the act becomes ordered fact — not
when the content begins to exist. The epoch never defines the
content; it dates it. The existence is conditional on that arrival:
when a prepared act expires unlanded and is discarded, the content
leaves every reader's view with it — on the graph nothing ever
existed, so there is nothing to mark — and its author is told that
it did not land.

**Custody exceptions:** the system actors (§8) sign in backend
custody by design. A Collective's key is creator-held with
per-member 2-of-2 co-signing — the backend holds half of each
member's split and co-signs after checking the social contract,
never a complete key
([collectives.md §2](../instances/collectives.md#2-custody));
full backend custody remains the implementation stopgap until
the splits ship. Client-direct
**transport** — the device submitting to L1 itself,
mirror-independent — is a decentralized-phase roadmap item
([roadmap.md](../implementation/roadmap.md)); the signature side
is client-held from day one.

**Admission is L1's, checked before submitting.** A gesture lands
only if its author clears the two-gate write rule
([layer1-interface.md §7.1](layer1-interface.md#71-the-two-gate-write-rule)):

- **W1 — solvency:** `b_i ≥ θ`; the write debits `θ` from the
  actor's residual balance. Capacity *is* the balance — remaining
  acts are `⌊b_i/θ⌋`, restored immediately by committing burns.
- **W2a — the wall:** the actor's act-owned stamp, evaluated once
  at final-set closure (`def:epoch:final-act-stamps`), clears the
  safety floor, `ρ_act ≥ ρ_θ`. Individual, never averaged.
- **W2b — the door:** the epoch's action-weighted stamp average
  clears the effective floor, `ρ_ep ≥ ρ_eff`, within the epoch
  budget. Band actors enter when the door has headroom.

The backend pre-checks eligibility against this surface before
submitting — an L2 estimate from the last published certificate,
since the stamps themselves are evaluated only at final-set
closure — and drives the restoration flows when a check fails: an
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
([layer1-interface.md §8.4](layer1-interface.md#84-the-act-record-and-payload-carriage)):

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

Two genesis system actors exist — **The Moderator** (verdict
gestures) and **The Publisher** (charter, platform documents,
finalizations, role Tags) — burn-funded from the community
treasury ([economics.md](economics.md)) and endorsed at bootstrap
to clear the wall like any other actor. The full bootstrap cast —
including **The Treasury**, an L1-registered account that
materializes no outcomes — is
[network.md §2](network.md#2-creation). The burn is not optional:
W1 reads only the actor's own balance — endorsement never pays an
actor's θ, a zero-rate cohort cannot vouch itself above the wall,
and only a current external positive-rate vouch lifts standing,
within the contributing-rate hull
([layer1-interface.md §7.1](layer1-interface.md#71-the-two-gate-write-rule)). Their gestures are priced like anyone's: a verdict costs
capacity per passed proposal. Bootstrap, key handling, and the full
gesture vocabulary: [network.md](network.md),
[governance.md](governance.md),
[moderation.md](../instances/moderation.md).

---

## 9. Node values and updates

An L1 node has no property store — every "node property" is a
declared fold over the records referencing the node's identifier
([layer1-interface.md §8](layer1-interface.md#8-kernel-data-model-authored-acts-projections-and-the-graph)).
A node is never re-minted and a payload is never rewritten;
updating a minted node means authoring *about* it. CoGra's single
rule for every updatable node value follows:

**A node's updatable values are a fold over witnessed payloads on
update records toward the node: per declared field, the newest
eligible record wins — "newest" read as the head of its author's
declared causal chain, never the bare `≺`-maximum.** An update is
an ordinary gesture (§4): a new inventory edge toward the existing
node, the new values in its payload envelope (§7), read back by
the declared fold. Each concept declares four slots (the
per-concept table: [substrate-map.md](substrate-map.md)):

- **Carrier family — the family that created the node revises
  it.** A genesis act mints; an act of the same family toward the
  existing node is an ordinary-role update record, and the
  distinction is decidable from two fields of the act itself
  ([nodes.md §1](nodes.md#1-l1-node-types-the-shared-graph)). That
  is what makes CoGra's edits legible to every other L2 without
  reading our payload keyspace — a Post's full revision history is
  simply its Publish bundle. The carriers: ordinary-role
  **Publish** for Content — posts and campaign terms
  ([economics.md §3.2](economics.md#32-adjustability)); ordinary-role
  **Review** for Comment — A-leg to the same parent, T-leg to the
  existing Comment; ordinary-role **Owner** for Item — no title
  force, only the self-minting act roots the thread; **parallel
  Registration** for Profile — L1's own idiom, the pattern the
  rest generalizes. Two carriers sit outside the pattern by
  design: **Tag `(0,0)` + payload at a named Type** for
  system-actor materializations (verdicts, roles; newest per
  (target, Type)), and the finalization **Opinion `(0,0)`**, which
  materializes an *outcome* (§8), never a node-value edit. **Chat
  revises by succession, not in place** — its metadata is the
  lineage head's founding payload
  ([chats.md §8](../instances/chats.md#8-chat-metadata-and-updates)).
  *(The in-place carriers rest on the Edition-5 draft's formation
  permissions — non-self-minting Publish, Review/T, and Owner
  targets; [layer1-interface.md](layer1-interface.md)'s Edition-4
  copy predates them and refreshes when the edition lands.)*
- **Eligible authors** — declared per (node, field): the creator,
  the current certified owner, or the designated system actor.
  Eligibility is a CoGra read rule, never an L1 restriction: L1
  accepts anyone's update-shaped records, and an ineligible one is
  written but never wins the fold — the same shape as freelance
  De-invites, which the membership fold ignores. Eligibility is
  per fold, so folds coexist on one node: a member updates their
  own bio while The Moderator's verdict Tag marks the same records
  — different folds, both live.
- **Fold granularity** — newest per field, per parameter, or per
  (target, Type), declared with the concept.
- **Chain root.** The head is the terminus of the declared
  causal-parent chain from the root; an update record without such
  a chain is fold-ignored. Roots: the genesis act (Content,
  Comment), the anchoring Registration (Profile), and for Item the
  genesis act *or that author's own prior head* — a new owner's
  first edit has no same-author predecessor. The chain is what
  keeps the head the author's choice: same-author records are
  guaranteed *distinct*, not author-ordered — among dependency-free
  acts the host picks the `≺`-maximum, so a bare newest-wins fold
  would be deterministic yet host-steerable. Two update records
  declaring the same parent are a branch: **neither advances the
  head — the incumbent holds.** CoGra therefore populates the
  causal parent on every update record at prepare time and
  serializes edits per (node, author), so its own clients never
  author a branch.

Discipline for update records:

- **Inert parameters, read individually.** An update is not a
  stance: each carrier is authored at its inert setting — Publish
  and Owner at attachment `0`, Review at `(0,0)` — so the record
  is routing-inert and vouch-inert (zero is inert,
  [edges.md §1](edges.md#1-the-edge-record-and-cogras-two-axes)).
  Folds read update records **individually** — never the author's
  netted bundle — the same discipline ballots use
  ([governance.md](governance.md)).
- **Priced like any act.** Every update record debits `θ` and
  permanently increments the author's record count. Editing is
  cheap, never free.
- **Selection ignores payload state.** The fold picks its head
  record first and renders that record's payload — a **reduced
  head remains the head**, rendering absent
  ([erasure.md §1](../instances/erasure.md#1-per-content-removal)).
  This is a selection rule, never "skip reduced records": falling
  through would republish a superseded payload at the exact moment
  its author exercises removal. A **full-empty** payload
  ([layers.md §5](layers.md#5-deletion-policy)) is different — a
  declared "the value is nothing" — and renders as deliberately
  empty, not absent.
- **History is public.** Superseded payloads remain published;
  removal (§7) is the only erasure and sweeps per record — full
  deletion removes payload and salt across the whole revision
  chain while every structural record stays.

What updates is what has a **cover** — a surface that renders the
node standing alone, one body at a time, so a fold must pick that
body. Post, Comment, Item, Profile, and chat metadata all render
covers and all update. A chat **Message** has none: it renders
only in transcript sequence, is not intelligible out of that
context, and a correction is simply the next message — so Message
bodies are not updatable values
([chats.md §8](../instances/chats.md#8-chat-metadata-and-updates)).
An edit toward a coverless node could only serve to hide, and
nothing here hides — superseded payloads stay published either
way.

Not everything with a cover updates — and since genesis is per
record, immutability is a **declared fold scope, never a
structural impossibility**: ordinary-role acts are legal against
any minted node, so a fold that wants immutable values must say it
reads the genesis payload alone. The rule, with its one named
exception: **a Publish toward an existing Content node means
revise — except at a proposal anchor, whose terms are its genesis
Publish payload,** because people voted on that exact text
([proposal.md §2](../instances/proposal.md#2-terms)). The network
charter's genesis values and each anchored platform document read
genesis-only the same way — the charter's parameter schedule rides
finalization payloads, and a guidelines amendment anchors a *new*
document node
([network.md §3](network.md#3-the-charter-anchor-and-the-parameter-schedule),
[platform-guidelines.md §3](../instances/platform-guidelines.md#3-amendment-procedure)).
Campaign anchors revise like posts, with `anchors` and `target`
excluded per field ([economics.md §3.2](economics.md#32-adjustability)).
Type names never update — the name *is* the identity. And a
node's **identity** never updates anywhere: the genesis record,
`creator`, and license qualifiers — structural metadata of the
genesis Publish, fixed at creation — are out of reach of any
update record.

---

## 10. Reading order

For the primitive layer, the docs build in this order:
[layer1-interface.md](layer1-interface.md) (the contract) → this
doc (the flow) → [substrate-map.md](substrate-map.md) (per-concept
mappings) → [nodes.md](nodes.md) / [edges.md](edges.md) (the
catalogs) → [graph-model.md](graph-model.md) (behavior of the
stores and records).
