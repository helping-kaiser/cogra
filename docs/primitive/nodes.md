# Nodes

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
  primitive record set is edges, and nothing else.
- **Identity is an algebra.** Every node identifier is **grounded**
  (`addr(a)` Actor, `prof(a)` Profile — anchored by a Registration),
  **named** (`name(s)` Type — a commons compared by byte equality),
  or **minted** (`key(…)` — the identity key of the record that
  created it). A node's type is fixed by its anchoring record,
  never by payload.
- **Properties are folds.** Any "node property" — sentiment, norm,
  creator, membership — is a declared fold over the records that
  reference the node. What a node *shows* in CoGra (name, body,
  avatar) is CoGra display content in Postgres, keyed by the node's
  identity key.

| L1 node | Class | Anchored by | CoGra reading |
|---|---|---|---|
| **Actor** | grounded | its Registration | The acting identity — sole active node type; every record is authored by one. Behind every CoGra account (§2). |
| **Profile** | grounded | the same Registration | The person-facing anchor, uniquely bound to its Actor by the derived Self-edge bond. Target of interpersonal stances. Profile content rides the actor's Registration payloads (witnessed); what is shown comes from Postgres (§4). |
| **Content** | minted | its Publish record | A published artifact; Publish genesis fixes `creator`. Most are CoGra Posts ([post.md](../instances/post.md)); publisher-authored Content nodes also anchor platform documents and proposal texts ([substrate-map.md §5](substrate-map.md#5-governance-and-moderation)). |
| **Item** | minted | its genesis Owner record | A physical or digital good — ownable via L1's settlement machinery; the Item *is* its genesis record. See [items.md](../instances/items.md). |
| **Type** | named | vacuous | A semantic anchor: CoGra topics (hashtags), moderation verdict categories, and any named concept. Canonical-name resolution is CoGra's L2 naming service. See [hashtag.md](../instances/hashtag.md). |
| **Chat** | minted | its creating record | A conversation container. Membership is a fold, never a stored state (see [substrate-map.md §4](substrate-map.md#4-conversations-and-membership)). See [chats.md](../instances/chats.md). |
| **Message** | minted | its Send hyper-edge | A single utterance in a Chat — a first-class node: stance-able, taggable, reviewable. |
| **Comment** | minted | its Review hyper-edge | A reply or annotation on any passive parent — including another Comment or a Message; reply chains are native causal chains of Review records. See [comment.md](../instances/comment.md). |
| **Offer** | minted | its Bid hyper-edge | A settlement artifact in the `Bid → Accept → Ratify` transfer flow. Not a content surface — CoGra reads it only through settlement recognition. |

---

## 2. Accounts: User and Collective

CoGra accounts are a service-layer concept; on the shared graph
both kinds resolve to the same grounded pair.

- **User** — a person's account: one L1 **Actor + Profile**, one
  L0 address. The person ↔ actor association is CoGra service
  state, never graph state. No User exists before verification —
  an L2 registration rule. See [user.md](user.md).
- **Collective** — a group acting through a single graph identity:
  one L1 **Actor + Profile**, keypair and L0 address in backend
  custody. Its members, roles, and internal governance are CoGra
  overlay and Postgres state (§3); L1 sees one ordinary actor. See
  [collectives.md](../instances/collectives.md).

In prose, "actor" means an L1 Actor node — the referent of every
authorship and endorsement rule; "account" means the CoGra service
identity behind it.

CoGra's **system actors** (moderation, publisher, inviter) are
ordinary Actors that CoGra regards as special —
[substrate.md §8](substrate.md#8-system-actors).

---

## 3. Overlay node types (CoGra's graph)

Overlay nodes live in CoGra's Memgraph — real stored nodes with
layered properties, governed entirely by CoGra's rules. They exist
for structure that must be traversable but has no L1 home. L1
never sees them.

| Overlay node | Role |
|---|---|
| **Proposal** | The governance carrier: proposed change, tally state, and role snapshot as layered properties; vote edges and `:TARGETS` attach to it. Its public trace on L1 is the anchor-and-finalization gesture pair ([substrate-map.md §5](substrate-map.md#5-governance-and-moderation)). See [proposal.md](../instances/proposal.md). |
| **Network** | Singleton per instance: the governed parameter home — feed-calibration parameters, subsidy knobs, eligibility definitions — as layered properties, `:TARGETS`-targetable. Anchored on L1 by a publisher-authored Content node (the network charter): every passed parameter change is finalized onto that anchor as a witnessed payload, so the parameter schedule is replayable from public records. The overlay singleton is the operational carrier the ranker and backend read. See [network.md](network.md). |
| **CollectiveMember** | The membership junction of a Collective: role, `ownership_pct`, voting weight, and governance map as layered properties, plus Postgres display content. See [collectives.md](../instances/collectives.md). |

A Proposal can target overlay nodes and L1-mirrored records alike —
the uniform anchor shape is specified with the governance machinery
([governance.md](governance.md)).

The reward economy's records — campaigns, settlements, payout
state — are not graph nodes on either side of the seam; they live
on CoGra's own rail ([economics.md](economics.md),
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
