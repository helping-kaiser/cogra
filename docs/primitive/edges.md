# Edges

The edge catalog across the substrate: the L1 edge families CoGra
authors — with what each family means as a CoGra gesture — and the
overlay edges of CoGra's own graph. The L1 side is bound by
[layer1-interface.md §9](layer1-interface.md#9-node-and-edge-type-inventory);
its census tables are normative for every family's domain, mask,
tier, and parameter roles — this doc does not restate them, it maps
CoGra's gestures onto them.

---

## 1. The edge record and CoGra's two axes

Every L1 edge record carries: its author (intrinsic — authorship is
never a separate edge), its endpoints, causal time and maturity,
**two continuous user parameters `(p_d, p_i)`**, a payload
projection with its witness, and the identity key. Everything else
on the record — the stored 3×3 sentiment slice, the path view, the
parity bit, the damped weight `w̃(e)` — is derived by published
formula. CoGra sets the two parameters and the payload; it consumes
the rest.

**CoGra's two authoring axes map onto the two parameters.** The
grammar is uniform across every family: `p_d` carries the
**directional / valence** role ("how do I stand on this?") and
`p_i` the **intensity / connection** role ("how much does this
matter to me?"). The per-family parameter names (polarity,
attachment, urgency, …) are L1's census vocabulary for the same two
slots; CoGra's frontend labels surface whichever aspect fits the
gesture.

- **The full range is the user's — in the stance vocabulary.**
  Stance-authoring families take both parameters anywhere in
  `[−1, +1]`, all four quadrants — coherent dislike `(−, −)` is a
  legitimate stance, not a filtered input. There is no frontend
  authoring bar; what the graph *does* with a stance is the
  consumers' published business (ranking, endorsement). Outside
  that vocabulary the census restricts ranges per family — Tag
  confidence, Bid urgency, and Invitation relevance in `[0, 1]`,
  control records type-fixed — and where prose and the census
  tables disagree, the tables govern
  (`rem:nodes:edge-census-normative`).
- **Domain, mask, and tier are family properties**, fixed by the
  census — never per-edge choices. CoGra picks the family; the
  family fixes the math.
- **Zero is inert.** An edge with either parameter at `0` is
  routing-inert; indifference is magnitude zero, not a third sign.
- **Revision is a new record.** The record set stores chronicles:
  revising a stance appends a parallel record to the same-author
  bundle. L1's endorsement-flow projection nets each bundle by
  sum-then-clip; what "current" means anywhere else is the
  consumer's declared read rule ([graph-model.md](graph-model.md)).

---

## 2. Binary families CoGra authors

| Family | Src → Tgt | CoGra gesture |
|---|---|---|
| **Registration** | Actor → Profile | Account creation — the self-introduction anchoring the grounded pair. Parameters fixed at `(1, 1)`. Profile content (bio, avatar digests, …) rides the payload; profile edits are parallel Registrations updating payload only, never identity. |
| **Publish** | Actor → Content | Creating a Post (also, for a proposer, anchoring a proposal text — [substrate-map.md §5](substrate-map.md#5-governance-and-moderation) — and, for the publisher system actor, platform documents and the network charter). `p_d` = the author's attachment; license qualifiers are structural metadata of this record. |
| **Opinion** | Actor → any passive node | The universal stance gesture — sentiment toward a Post, Comment, Chat, Message, Item, Type, or Profile. Toward a Profile it is actor-directed: it enters endorsement flow only when vouch-positive (`p_d > 0 ∧ p_i > 0`). Also the **ballot**: a payload-marked Opinion toward a proposal anchor, direction = stance sign ([governance.md](governance.md)); and the system-actor finalization gesture at `(0,0)` + payload. |
| **Affinity** | Actor → Type | Following a topic — relevance, not verdict; never a standing vouch. |
| **Participant** | Actor → Chat | The record the membership fold reads: member iff the actor's own ≺-latest {Participant, Leave} record toward the Chat is a Participant. In gated chats CoGra's fold policy recognizes a Participant only when backed by an approved Join Request or an Invitation. |
| **Owner** | Actor → Item | Item genesis — listing a good mints the Item and roots its ownership thread. Title is sentiment-blind: an `(0, …)` Owner still anchors the thread. |
| **Join Request** | Actor → Chat | Asking to join — a proposal awaiting the chat's response. The membership fold never reads it; ignoring one requires no graph action. |
| **Accept** | Actor (seller) → Actor (buyer) | Transfer step 2: the owner's consent to a Bid (settles-pointer to it). Not binding alone. |
| **Ratify** | Actor (buyer) → Actor (seller) | Transfer step 3: the buyer's commit. Title moves at the epoch certificate, not at the Ratify. |
| **Withdraw** | Actor (buyer) → Offer | Buyer cancel — a control record, type-fixed parameters. |
| **Rescind** | Actor (seller) → Offer | Seller cancel before commit — control record. |
| **Leave** | Actor → Chat | Leaving — unilateral, unconditional, the exit record of the membership fold. A rage-quit is Leave plus a negative Opinion on the Chat; sentiment never rides control records. |

---

## 3. Hyper-edge families CoGra authors

A hyper-edge is **one act** — one θ-debit, one stamp — that
decomposes into two legs: the actor's leg into the middle node, and
an author-fixed terminal leg out of it. (The interface's "L1/L2"
leg indices name leg *position*, never Layer 1 / Layer 2.)

| Family | Shape | CoGra gesture |
|---|---|---|
| **Review** | Actor → parent → Comment | Commenting. The Review targets whatever the reply responds to — a Post, Item, Profile, Chat, Message, or another Comment — and the terminal leg mints the new Comment. Threading is direct-parent: a reply to a comment Reviews that comment, so thread structure is graph-native, a causal chain of records. Weight concentrates on the targeted node, and each nesting level compounds the terminal leg's Marginal damping — depth attenuates naturally. |
| **Send** | Actor → Chat → Message | Posting a chat message; the terminal leg mints the Message. Not membership-gated at L1 — CoGra's membership fold is a read-side rule. E2EE chats commit over ciphertext. |
| **Tag** | Actor → content → Type | Tagging own content with a topic (authored by the content's author). Also the moderation verdict gesture: the moderation system actor tags the target toward a named moderation Type at `(0,0)` + payload, newest tag winning per (target, Type). |
| **Bid** | Actor → Item → Offer | Transfer step 1: a buyer's offer, minting the Offer node. Signed generosity is stance-visible per leg. |
| **Invitation** | Actor → Chat → Profile | Inviting someone to a chat — a public, priced vouch that the invitee fits. A proposal, not participation; the terminal leg targets the invitee's **Profile**, so its influence is zero at zero invitee standing. Revocable per author by a later De-invite. |
| **De-invite** | Actor → Chat → Profile | The expulsion mark, and the withdrawal of one's own prior Invitation. As a kick it is authored by the executing chat authority with the authorizing Proposal's anchor cited in the payload — the membership fold recognizes only proposal-backed De-invites ([substrate-map.md §4](substrate-map.md#4-conversations-and-membership)). A control record: never vouches, in any quadrant. |
| **Reference** | Actor → artifact → target | Quoting, embedding, or mentioning: the citing artifact (any passive node — usually the quoting Post or Comment) points at the cited target; nothing is minted, both endpoints pre-exist. A mention is a Reference whose target is the person's Profile — for positive, effortful stances that is a weak, priced vouch. Also the proposal-targeting gesture: the proposer authors a `(0,0)` Reference from the proposal anchor to its L1 target — routing-inert, never vouches, and makes the target relation replayable ([substrate-map.md §5](substrate-map.md#5-governance-and-moderation)). |

---

## 4. What CoGra never authors

- **The Self-edge bond** — both components (Declaration,
  Reputation) are derived from the epoch certificate by L1, never
  appended by anyone.
- **Title** — `owner^(k)` is a published certificate, not an edge;
  ownership moves only through the settlement fold.
- **Layer 0 records** — CoGra reads L0 exports through L1's
  interface, consume-only.
- **Anything outside the inventory** — there are no custom L1 edge
  types. New semantics go to payload, overlay, or off-graph, per
  the mechanism menu
  ([substrate.md §5](substrate.md#5-the-mechanism-menu-closed)).

---

## 5. Overlay edges (CoGra's graph)

Overlay edges live in CoGra's Memgraph and never enter any L1
quantity. They connect overlay nodes to each other and to mirrored
L1 records; their semantics are CoGra's alone.

| Overlay edge | Endpoints | Role |
|---|---|---|
| **Membership binding** | CollectiveMember ↔ member / Collective mirrors | The edges seating a CollectiveMember junction between its member and its Collective. Shapes: [collectives.md](../instances/collectives.md). |

Votes, references, and proposal targets are **not** overlay edges —
all three live on L1 and reach Memgraph through the mirror like
every other L1 record: a vote is a payload-marked ballot Opinion
toward the proposal anchor (§2), a reference is a Reference record
(§3), and a proposal's subject is the anchor's `(0,0)` Reference
toward the subject node ([governance.md](governance.md)).

Whether and how CoGra's feed traversal crosses overlay edges is
feed policy, declared per edge type in
[feed-ranking.md](feed-ranking.md).

---

## 6. Extension policy

CoGra cannot add L1 edge families — the inventory is L1's. A new
CoGra semantic maps onto the mechanism menu: an existing family
plus payload, an overlay edge, or off-graph state. Adding an
overlay edge type is a design discussion (it extends CoGra's own
schema), never a silent addition; the bar is a query or traversal
need the existing shapes cannot express.
