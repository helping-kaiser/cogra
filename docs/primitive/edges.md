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
never a separate edge), its endpoints, its act's authoritative time
and its own maturity,
**two continuous user parameters `(p_d, p_i)`**, its act's payload
projection with its witness, and the act identifier. Everything else
on the record — the stored 3×3 sentiment slice, the path view, the
parity bit, the damped weight `w̃(e)` — is derived by published
formula. CoGra sets the two parameters and the payload; it consumes
the rest.

**Invariant: uniform two-parameter grammar.** Every record
carries the same two user parameters `(p_d, p_i)`; domain, mask,
and tier are family-fixed by the census, never per-edge choices.

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
  (``rem:nodes:edge-census-normative``).
- **Domain, mask, and tier are family properties**, fixed by the
  census — never per-edge choices. CoGra picks the family; the
  family fixes the math.
- **Zero is inert.** An edge with either parameter at `0` is
  routing-inert; indifference is magnitude zero, not a third sign.
- **Revision is a new record.** The record set stores chronicles:
  revising a stance appends a parallel record to the same-author
  bundle. L1's standing projection nets each bundle by
  sum-then-clip; what "current" means anywhere else is the
  consumer's declared read rule ([graph-model.md](graph-model.md)).

---

## 2. Binary families CoGra authors

| Family | Src → Tgt | CoGra gesture |
|---|---|---|
| **Registration** | Actor → Profile | Account creation — the self-introduction anchoring the grounded pair. Parameters fixed at `(1, 1)`. Profile content (bio, avatar digests, …) rides the payload; profile edits are parallel Registrations updating payload only, never identity. |
| **Publish** | Actor → Content | Creating a Post (also, for a proposer, anchoring a proposal text — [substrate-map.md §5](substrate-map.md#5-governance-and-moderation) — and, for the publisher system actor, platform documents and the network charter). `p_d` = the author's attachment; license qualifiers are structural metadata of the genesis record. An ordinary-role Publish toward an existing Content node is the revise gesture — the creator's post edit, the advertiser's campaign-term change ([substrate.md §9](substrate.md#9-node-values-and-updates)). |
| **Opinion** | Actor → any passive node | The universal stance gesture — sentiment toward a Post, Comment, Chat, Message, Item, or Profile (toward a Type the stance gesture is Affinity). Toward a Profile it is actor-directed: it feeds the target's standing only when the author's folded bundle is strictly positive (`p̄_d > 0 ∧ p̄_i > 0`; ``def:epoch:standing-recipient-resolution``), and otherwise resolves to the author's own retention channel — weighed and priced either way. Also the **ballot**: a payload-marked Opinion toward a proposal anchor, direction = stance sign ([governance.md](governance.md)); and the system-actor finalization gesture at `(0,0)` + payload. |
| **Affinity** | Actor → Type | Following a topic — relevance, not verdict; never a standing vouch. |
| **Owner** | Actor → Item | Item genesis — listing a good mints the Item and roots its ownership thread. Title is sentiment-blind: an `(0, …)` Owner still anchors the thread. An ordinary-role Owner toward an existing Item revises its listing fields under the certified owner's eligibility — no title force ([items.md §7](../instances/items.md#7-editing)). |
| **Join Request** | Actor → Chat | Asking to join — a proposal awaiting the chat's response. The membership fold never reads it; ignoring one requires no graph action. |
| **Accept** | Actor (seller) → Actor (buyer) | Transfer step 2: the owner's consent to a Bid (settlement reference to its act). Not binding alone. |
| **Ratify** | Actor (buyer) → Actor (seller) | Transfer step 3: the buyer's commit. Title moves at the epoch certificate, not at the Ratify. |
| **Withdraw** | Actor (buyer) → Offer | Buyer cancel — a control record, type-fixed parameters. |
| **Rescind** | Actor (seller) → Offer | Seller cancel before commit — control record. |
| **Leave** | Actor → Chat | Leaving — unilateral, unconditional, the exit record of the membership fold: departure *without* destination, where a Participant move act (§3) is departure *to* somewhere. A rage-quit is Leave plus a negative Opinion on the Chat; sentiment never rides control records. |

---

## 3. Hyper-edge families CoGra authors

A hyper-edge is **one act** — one θ-debit, one stamp — that
decomposes into two legs: the actor's initiating leg into the
middle node (the census's /A leg) and an author-fixed terminal leg
out of it (/T).

| Family | Shape | CoGra gesture |
|---|---|---|
| **Review** | Actor → parent → Comment | Commenting. The Review targets whatever the reply responds to — a Post, Item, Profile, Chat, Message, or another Comment — and the terminal leg mints the new Comment. Threading is direct-parent: a reply to a comment Reviews that comment, so thread structure is graph-native, a causal chain of records. Weight concentrates on the targeted node, and each nesting level compounds the terminal leg's Marginal damping — depth attenuates naturally. An ordinary-role Review — T-leg to an existing Comment, A-leg to its genesis parent — is the comment edit ([comment.md §4](../instances/comment.md#4-editing)); the feed channel-gates ordinary T-legs ([feed-ranking.md §4](feed-ranking.md#4-the-path-set)). |
| **Participant** | Actor → Chat → Chat | The movement record — one meaning, *I move from A to T*: founding targets the fresh mint with both legs, joining targets the existing chat with both, a chat-lineage **succession** runs A-leg to the predecessor and T-leg to the mint, a **move** runs A-leg to the chat left and T-leg to the chat joined. The membership fold reads it keyed on **leg role** — T-leg participation, A-leg-only departure — over the bundled lineage, with gated-chat backing keyed to the T-leg ([chats.md §4](../instances/chats.md#4-membership)). The T-leg is census-forced positive and Marginal — a weak lineage marker, never a stance; the feed crosses it initiator-owned only ([feed-ranking.md §4](feed-ranking.md#4-the-path-set)). |
| **Send** | Actor → Chat → Message | Posting a chat message; the terminal leg mints the Message. Not membership-gated at L1 — CoGra's membership fold is a read-side rule. E2EE chats commit over ciphertext. |
| **Tag** | Actor → content → Type | Declaring a topic on content — authorship is unconstrained (the census has no ownership clause): the content author's tag is the content's own topic declaration; anyone else's is a third-party topic claim the feed reads through its author, under the same two channels as citations ([feed-ranking.md §4](feed-ranking.md#4-the-path-set)). The newest tag per (author, content, Type) bundle is its author's current claim, relevance `0` withdrawing it ([hashtag.md §4](../instances/hashtag.md#4-the-current-topics-fold)). Also the moderation verdict gesture: the moderation system actor tags the target toward a named moderation Type at `(0,0)` + payload. |
| **Bid** | Actor → Item → Offer | Transfer step 1: a buyer's offer, minting the Offer node. Signed generosity is stance-visible per leg. |
| **Invitation** | Actor → Chat → Profile | Inviting someone to a chat — a public, priced vouch that the invitee fits. A proposal, not participation; the terminal leg targets the invitee's **Profile**, so its influence reaches the invitee only through their standing-dependent activation — wall-clamped: constant below the safety floor (``def:epoch:safety-wall-clamped-activation``). Revocable per author by a later De-invite. |
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

Overlay edges live in CoGra's own store and never enter any L1
quantity. They connect overlay nodes to each other and to mirrored
L1 records; their semantics are CoGra's alone. **No overlay edge
type is currently declared** — the overlay's structure today is
its nodes ([nodes.md §3](nodes.md#3-overlay-node-types-cogras-graph)).

Votes, references, proposal targets, and collective membership are
**not** overlay structure — all live on L1 and reach CoGra
through the record mirror like every other L1 record: a vote is a
payload-marked ballot Opinion toward the proposal anchor (§2), a
reference is a Reference record (§3), a proposal's subject is the
anchor's `(0,0)` Reference toward the subject node
([governance.md](governance.md)), and membership is a fold over
payload-marked records
([collectives.md §5](../instances/collectives.md#5-membership--a-public-fold)).

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
