# Nodes · `spec:primitive:nodes`

The catalog of node types across the substrate: the L1 node types
CoGra's concepts resolve to, and the overlay node types of CoGra's
own graph. The conceptual flow is in [substrate.md](substrate.md);
the per-concept routing in [substrate-map.md](substrate-map.md);
the edges that connect everything in [edges.md](edges.md). The L1
side is bound by
[layer1-interface.md §9](layer1-interface.md#9-node-and-edge-type-inventory).

---

## 1. L1 node types (the shared graph)

Three facts shape how L1 nodes work, and they differ sharply from
how a database table would:

- **Nodes are implicit.** A node exists iff some accepted record
  references it in an endpoint field. There is no node-creation
  operation, no node table, no node attribute store — the graph's
  primitive history is authored acts and their edge projections,
  nothing else (``ax:graph:authored-act-ontology``).
- **Identity is an algebra.** Every node identifier is **grounded**
  (`addr(a)` Actor, `prof(a)` Profile — anchored by a Registration),
  **named** (`name(s)` Type — a commons compared by byte equality),
  or **minted** (`mint(actid)` — the identifier of the authored
  act that created it). A node's type is fixed by its anchoring
  record, never by payload.
- **Genesis is per record, not per family.** `mint` takes an *act*
  identifier, so whether an act mints is decidable from two fields
  of the act itself: an act of a mint-capable family whose
  **terminal target** — the target of a binary act, the T-leg's
  terminus of a hyper-edge act — equals the mint of its own
  identifier is the **genesis act** — it
  mints the node, fixes `creator`, establishes genesis context, and
  (for Item) roots title; an act of the same family toward an
  existing node mints nothing — it is an ordinary-role record, the
  update shape of
  [substrate.md §9](substrate.md#9-node-values-and-updates). A node
  can never be re-minted: `mint` is injective and an ordinary act's
  target is not derived from its own identifier
  ([layer1-interface.md §8.1](layer1-interface.md#81-acts-projections-partition-and-passivity)).
- **Properties are folds.** Any "node property" — sentiment, norm,
  creator, membership — is a declared fold over the records that
  reference the node. What a node *shows* in CoGra (name, body,
  avatar) is CoGra display content in Postgres, keyed by the node's
  identity key.

| L1 node | Class | Anchored by | CoGra reading |
|---|---|---|---|
| **Actor** | grounded | its Registration | The acting identity — sole active node type; every record is authored by one. Behind every CoGra account (§2). |
| **Profile** | grounded | the same Registration | The person-facing anchor, uniquely bound to its Actor by the derived Self-edge bond. Target of interpersonal stances. Profile content rides the actor's Registration payloads (witnessed); what is shown comes from Postgres (§4). |
| **Content** | minted | its genesis Publish record | A published artifact; the genesis Publish fixes `creator`, and the creator's later ordinary-role Publishes toward the node are its revisions ([post.md §4](../instances/post.md#4-editing)). Most are CoGra Posts ([post.md](../instances/post.md)); proposer-authored Content nodes anchor proposal texts, and publisher-authored ones anchor platform documents and the network charter ([substrate-map.md §5](substrate-map.md#5-governance-and-moderation)). |
| **Item** | minted | its genesis Owner record | A physical or digital good — ownable via L1's settlement machinery; the Item *is* its genesis record. See [items.md](../instances/items.md). |
| **Type** | named | vacuous | A semantic anchor: CoGra topics (hashtags), moderation verdict categories, and any named concept. Canonical-name resolution is CoGra's L2 naming service. See [hashtag.md](../instances/hashtag.md). |
| **Chat** | minted | its creating record | A conversation container. Membership is a fold, never a stored state (see [substrate-map.md §4](substrate-map.md#4-conversations-and-membership)). See [chats.md](../instances/chats.md). |
| **Message** | minted | its genesis Send hyper-edge | A single utterance in a Chat — a first-class node: stance-able, taggable, reviewable. A Message belongs to the chat its genesis Send minted it into. |
| **Comment** | minted | its genesis Review hyper-edge | A reply or annotation on any passive parent — including another Comment or a Message; reply chains are native causal chains of Review records. The parent is the genesis Review's A-leg target ([comment.md](../instances/comment.md)). |
| **Offer** | minted | its Bid hyper-edge | A settlement artifact in the `Bid → Accept → Ratify` transfer flow. Not a content surface — CoGra reads it only through settlement recognition. |

---

## 2. Accounts: User and Collective

CoGra accounts are a service-layer concept; on the shared graph
both kinds resolve to the same grounded pair.

**Invariant: one actor type.** User and Collective are CoGra
service-layer accounts; each resolves to one ordinary grounded
Actor + Profile pair — L1 has no account types, and "active
member" and "voter" are scoped subsets, never instance-free.

- **User** — a person's account: one L1 **Actor + Profile**, one
  L0 address. The person ↔ actor association is CoGra service
  state, never graph state. No User exists before verification —
  an L2 registration rule. See [user.md](user.md).
- **Collective** — a group acting through a single graph identity:
  one L1 **Actor + Profile**, keypair creator-held with
  per-member co-signing
  ([collectives.md §2](../instances/collectives.md#2-custody)).
  Its membership, roles, and
  social contract are public payload-borne records with
  CoGra-published folds; L1's math reads none of it — it sees one
  ordinary actor. See
  [collectives.md](../instances/collectives.md).

In prose, "actor" means an L1 Actor node — the referent of every
authorship and endorsement rule; "account" means the CoGra service
identity behind it.

CoGra's **system actors** (moderation, publisher, inviter) are
ordinary Actors that CoGra regards as special —
[substrate.md §8](substrate.md#8-system-actors).

---

## 3. Overlay node types (CoGra's graph)

Overlay nodes live in CoGra's own store
([data-model.md](../implementation/data-model.md)) — real stored
state with layered properties, governed entirely by CoGra's rules.
They exist for structure that must be queryable but has no L1
home. L1 never sees them.

| Overlay node | Role |
|---|---|
| **Proposal** | The governance carrier: proposed change, tally state, and role snapshot as layered properties. The public relations all live on L1 via the proposal's Content anchor: the subject (the anchor's `(0,0)` Reference), the ballots (payload-marked Opinions toward the anchor), and the finalization edge ([substrate-map.md §5](substrate-map.md#5-governance-and-moderation)). See [proposal.md](../instances/proposal.md). |
| **Network** | Singleton per instance: the governed parameter home — feed-calibration parameters, subsidy knobs, eligibility definitions — as layered properties. Anchored on L1 by a publisher-authored Content node (the network charter): proposals about the Network target that anchor, and every passed parameter change lands as a witnessed payload on its finalization Opinion toward the anchor, so the parameter schedule is replayable from public records. The overlay's parameter carrier is the operational mirror the ranker and backend read. See [network.md](network.md). |

Collective membership needs no overlay node: it is a public fold
over payload-marked records on both sides, with roles and stakes
riding the collective-side payloads — any membership state in the
stores is mirror cache, never truth
([collectives.md §5](../instances/collectives.md#5-membership--a-public-fold)).

Every proposal subject is an L1 node, named by the anchor's `(0,0)`
Reference. Proposals about a member within a chat or collective
point at the member's **Profile**; the scope and meaning are L2,
carried in the anchor payload ([governance.md](governance.md)).

The reward economy's public record rides L1: a campaign is an
advertiser-authored Content anchor whose witnessed payloads carry
the terms and the settlement
([economics.md §3](economics.md#3-the-campaign-record)). The money
itself — escrow, payout state, balances — is never a graph object
on either side of the seam; it lives on CoGra's own rail
([economics.md §10](economics.md#10-the-settlement-record-and-the-payout-flow),
[ledger.md](../implementation/ledger.md)).

---

## 4. Display content and moderation surfaces

Every L1 node CoGra renders has its display content in Postgres,
keyed by the node's identity key — what the node *is* lives on the
shared graph; what it *shows* is CoGra's. Overlay nodes keep their
display content in Postgres the same way.

Moderation operates on those surfaces at record granularity:
`sensitive` is a read-side flag in Postgres plus a substrate-visible
Tag mark; `illegal` is whole-record payload removal to the reduced
projection. Per-field sensitive flags and the verdict vocabulary
are Postgres metadata. The mechanics live in
[moderation.md](../instances/moderation.md) and
[layers.md](layers.md).
