# Substrate Map

The per-concept routing table: where every CoGra concept lives on
the substrate. Each row names its **primary mechanism** from the
closed menu in [substrate.md §5](substrate.md#5-the-mechanism-menu-closed)
— `gesture` (an L1 edge from the fixed inventory), `payload` (state
riding an L1 record), `overlay` (CoGra's own Memgraph graph),
`off-graph` (Postgres / blob / service state) — plus `consume` for
concepts that are read-side constructions over L1 records:
published-value views, adopted folds, and reimplemented terminal
defaults.
Combinations are the norm; the primary mechanism is the one that
carries the concept's identity.

The L1 side of every row is bound by
[layer1-interface.md](layer1-interface.md); node and edge specifics
live in [nodes.md](nodes.md) and [edges.md](edges.md); per-instance
mechanics live in each concept's own doc.

---

## 1. Actors and identity

| Concept | Primary | Mapping |
|---|---|---|
| User | gesture | An L1 **Actor + Profile** grounded pair, anchored by the actor's own Registration record. One account = one L0 address. See [user.md](user.md). |
| Person ↔ actor map | off-graph | Identity association is terminal by L1 contract — the map from an actor to the person behind it lives in CoGra's service state, never on the shared graph. |
| Account verification | off-graph | No User exists in CoGra before verification — an L2 registration rule; L1 sees only the Registration record once CoGra submits it. |
| Email | off-graph | Authentication and recovery only. Admission is the θ-debit plus invitation (below), never an email check. |
| CoGra-join / inviter referral | gesture | A separate relation from chat invitations: mutual-pair-and-accept-gated. Any number of members may point an edge at a joiner's Profile; the inviter is the single actor the joiner reciprocates first. The referral reward fires only on that mutual pair. L1 is the truth home for the relation. See [invitations.md](invitations.md). |
| CoGra admission | gesture | An AND gate: the actor clears L1's write rule (θ-debit surface) **and** holds an accepted CoGra invitation (the mutual pair above). Funding for the debit side: [economics.md](economics.md). |
| Collective | gesture | **One L1 Actor + Profile**, keypair and L0 address held in backend custody. Founding: backend creates the pair, the θ-debit is treasury-funded, founder Opinions toward the collective Profile lift its standing. See [collectives.md](../instances/collectives.md). |
| Collective membership | overlay | Pure L2: an overlay junction node per member plus Postgres display content; role, `ownership_pct`, voting weight, and governance map as layered overlay properties. No L1 membership edge exists. Mutual member ↔ collective-Profile Opinions remain ordinary stance fabric. |
| network_role | overlay | A layered overlay property on Users only — Collectives carry none; verdict and governance eligibility are person-accountability surfaces. |
| Account deletion | off-graph | The husk: identity association forgotten, Postgres tombstoned, payloads removed to reduced projection. Standing, title, and trust edges persist on L1; names and words go. No L1 gesture exists for deletion. See [account-deletion.md](../instances/account-deletion.md). |

---

## 2. Content

| Concept | Primary | Mapping |
|---|---|---|
| Post | gesture | An L1 **Content** node minted by the author's Publish record (genesis fixes `creator`). Body and media digests ride the payload envelope; display content in Postgres. See [post.md](../instances/post.md). |
| Comment / reply | gesture | A full L1 **Review** hyper-edge (Actor → parent → Comment) targeting whatever the reply responds to — root content or another comment — and minting the Comment node. Thread structure is graph-native: reply chains are causal chains of Review records. See [comment.md](../instances/comment.md). |
| Chat | gesture | An L1 **Chat** node, minted by its creating record. See [chats.md](../instances/chats.md). |
| Chat message | gesture | An L1 **Message** via the Send hyper-edge (Actor → Chat → Message). Send is not membership-gated at L1; CoGra's membership fold is read-side (§4). |
| Item | gesture | An L1 **Item** minted by its genesis Owner edge. Item identity is declarative — the Item *is* its genesis record. See §6 and [items.md](../instances/items.md). |
| Hashtag / topic | gesture | An L1 **Type** — a named identifier compared by byte equality, anchored vacuously. Canonical-name resolution is an L2 naming service. See [hashtag.md](../instances/hashtag.md). |
| Authorship | consume | Author binding is intrinsic to every L1 record — no authoring edge exists as a separate concept. See [authorship.md](authorship.md). |
| Media / large bodies | off-graph | Bytes in CoGra blob storage; the payload envelope commits their digests, so substitution is publicly detectable ([substrate.md §7](substrate.md#7-payload-carriage)). |
| Platform documents | gesture (system actor) | Anchored by a publisher-authored Content node; the document text is witnessed payload. |

---

## 3. Stances and revision

| Concept | Primary | Mapping |
|---|---|---|
| Stance toward content | gesture | **Opinion** (Actor → any passive node) — the archetypal edge. CoGra's two authoring axes map onto the edge parameters: valence → `p_d`, connection → `p_i`; the stored 3×3 slice is derived storage. See [edges.md](edges.md). |
| Stance toward a person | gesture | **Opinion → Profile** — the interpersonal stance carrier. Vouch-positive stances (`p_d > 0 ∧ p_i > 0`) feed the target's standing through endorsement flow; everything else is routing/stance signal only. |
| Stance toward a collective | gesture | Opinion → the collective's Profile — same carrier, same vouch semantics. |
| Follow a topic | gesture | **Affinity** (Actor → Type) — relevance, not verdict. Its feed effect is feed policy, not topology: [feed-ranking.md](feed-ranking.md). |
| Tagging content | gesture | The **Tag** hyper-edge (Actor → content → Type), authored by the content's author. |
| Reference / quote / embed / mention | gesture | An L1 **Reference** hyper-edge (Actor → citing artifact → target): the quoting Post or Comment points at the cited node; nothing is minted. A mention targets the person's **Profile** — positive, effortful mentions are weak, priced vouches. Reference legs are ordinary graph fabric: the feed traverses them at their real `w̃` ([feed-ranking.md](feed-ranking.md)) and attribution reads them natively, so quoted authors are credited by the shared path math ([economics.md](economics.md)). |
| Stance revision | gesture | A new L1 record in the author's same-target bundle — records are chronicles, never overwritten. The endorsement-flow projection nets same-author bundles (sum-then-clip); presentation of "current vs. history" is L2. |
| Severance | gesture | Authoring counter-edges that net the bundle to `(0,0)` — routing-inert in the projection, and the write-side act every consumer respects. A viewer-side blocklist is separate read-side comfort: [feed-ranking.md](feed-ranking.md). |

---

## 4. Conversations and membership

| Concept | Primary | Mapping |
|---|---|---|
| Joining a chat | gesture | Membership materializes only from the joiner's **own Participant edge** (Actor → Chat). Join Request (Actor → Chat) and Invitation (Actor → Chat → Profile of the invitee) are proposals — they never participate. |
| Chat membership state | consume | The canonical membership fold over the member's own Participant / Leave chain, with recognized De-invites applied conservatively — a terminal read-site CoGra adopts as its fold. Read-side, per chat policy: [chats.md](../instances/chats.md). |
| Leaving a chat | gesture | **Leave** (Actor → Chat) — unilateral and unconditional. |
| Kick / expulsion | gesture | A passed `decision:disavow_member` Proposal (weighted per-chat roles, L2), executed by a **chat-authority actor** — an ordinary member whose per-chat role authorizes execution — authoring the L1 **De-invite** (Actor → Chat → Profile), its payload citing the authorizing Proposal's L1 anchor. The membership fold recognizes only proposal-backed De-invites, so a freelance De-invite is membership-inert (it merely revokes the author's own invitation vouch). Non-sticky: a later Participant strictly following the De-invite re-establishes membership under the fold. |

---

## 5. Governance and moderation

| Concept | Primary | Mapping |
|---|---|---|
| Proposal | gesture | The overlay Proposal node carries tally state and role snapshot; display text in Postgres. The public structure is L1: **creation** — the proposer authors a Content anchor node (payload = proposal text, witnessed, costs the proposer capacity) plus a `(0,0)` Reference from the anchor to the subject node (routing-inert, never vouches; scoped-membership subjects point at the member's Profile, scope in the payload); **votes** — payload-marked ballot Opinions toward the anchor (below); **finalization** — a system actor authors Opinion `(0,0)` + payload (outcome, tally digest) toward the anchor. See [proposal.md](../instances/proposal.md), [governance.md](governance.md). |
| Vote | gesture | An L1 **ballot**: a payload-marked Opinion toward the proposal anchor, direction = stance sign. Public, permanent, write-rule-gated, epoch-quantized, funded like every act. The tally is CoGra's published formula (role weights, quorum) over the individual ballot records — never the netted bundle, so a member's organic Opinion on the proposal cannot masquerade as a ballot. |
| Roles, quorums, mod-gate | overlay | Carried verbatim as L2 policy: two-tier mod-gate, petition + dual quorum, counter-Proposals, rule snapshot. |
| `:Network` singleton | gesture (system actor) | Anchored on L1 as a publisher-authored Content node — the network charter; proposals about the Network target that anchor. Passed parameter changes are finalized onto the anchor as witnessed payloads (newest finalization per parameter wins), making the parameter schedule replayable from public records. The overlay singleton is the operational carrier — layered governed properties — that the ranker and backend read. See [network.md](network.md). |
| Moderation: sensitive | gesture (system actor) | A read-side flag in Postgres plus a substrate-visible mark: the moderation system actor authors **Tag `(0,0)` + payload** toward a named moderation Type. Newest tag wins per (target, Type). Content stays. |
| Moderation: illegal | gesture (system actor) | Whole-record **payload removal** (full → reduced projection) plus the Tag verdict. Redaction granularity is the record — the content commitment forbids partial rewrite. The visible mark is the immutable structural record + reduced payload state. See [moderation.md](../instances/moderation.md), [layers.md](layers.md). |
| Moderation vocabulary | overlay | Verdict categories and per-field sensitive flags survive as Postgres metadata; moderation Types ride the L2 naming service. |
| License / provenance (`l_ij`, `o`) | payload | Authoring-time declaration is mandatory in every content-creation flow (an L2 write-validation rule); render obligations and the provenance-chain format are CoGra's published spec. Enforcement rides the report → Proposal → moderation path. |
| Honor ledger | off-graph | A per-community append-only Postgres ledger with membership-gated reads — never on a chain, never in Memgraph, so the ranker and miner slice structurally cannot consume it. See [governance.md](governance.md). |

---

## 6. Items and ownership

| Concept | Primary | Mapping |
|---|---|---|
| Item ownership | consume | L1's settlement machinery wholesale: ownership is the Owner / Bid / Accept / Ratify thread; the `Bid → Accept → Ratify` handshake *is* the transfer flow, with epoch-quantized consent (Withdraw / Rescind) and ties-consume. |
| Title | consume | `owner^(k)`, published in the epoch certificate — **read-only; CoGra never authors title**. |
| Shared ownership | overlay | Routes through a Collective (one L1 actor owns; sharing is the collective's L2 membership, §1). |
| Marketplace / escrow / pricing | off-graph | The money side is CoGra's own rail — listing, pricing, escrow are deferred workstreams; when built, ownership rides L1 settlement and price settles on the CoGra token rail. See [items.md](../instances/items.md), [economics.md](economics.md). |

---

## 7. Economics and feed (pointers)

The full treatments live in [economics.md](economics.md),
[token.md](token.md), [feed-ranking.md](feed-ranking.md), and
[ledger.md](../implementation/ledger.md); the map rows fix only
where each concept sits relative to the seam.

| Concept | Primary | Mapping |
|---|---|---|
| Admission money | consume | Layer 0's reserve behind `B_i` and the θ-debit — consume-only; CoGra reads `B_i` and the entry cost through L1's interface and never authors L0 records. |
| CGT (reward economy) | off-graph | CoGra's own token — the campaign-pool currency, fully disconnected from the L0 reserve. "Burn" means CGT supply destruction, never the θ-debit. |
| Subsidised θ-debits | off-graph | Only the actor's own balance ever pays the actor's θ (W1). Community funding is Layer-0 burns to the member's own address (`rem:gates:guild-funding`) — funder-unconstrained, the comparator sees a funded member exactly as a self-funded one; generosity and caps are governed `:Network` parameters. System actors and Collectives draw on the CoGra community treasury. |
| Campaigns, settlement, payouts | off-graph | The advertiser rail and payout plumbing are CoGra's; the attribution they pay against is computed over L1 records (below). |
| Inviter reward | off-graph | Single-hop 1% CGT to the accepted mutual-pair inviter (§1) — permanent, no chain of referrals. |
| Feed ranking | consume | Terminal — CoGra's own published computation over L1's per-edge primitive `w̃(e)` and viewer-rooted paths. |
| Reward attribution | consume | CoGra is a CAN built on the same path extraction as the feed, subject to the three CAN invariants. |

---

## 8. Not everything maps 1-to-1

A CoGra concept lands on L1 only where a public, priced, binding
fact is needed — and it gets a dedicated object at all only where
state must attach to it. The three membership-shaped relationships
show the full range:

- **Chat membership** has no object on either side of the seam: it
  is a derived fold over the member's own Participant and Leave
  records (§4). Nothing is stored; everything is computed.
- **Collective membership** is an object, but a purely CoGra-side
  one — the overlay junction node with its layered role properties
  (§1). L1 never sees it.
- **Item ownership** is purely L1-side: the settlement thread and
  the title certificate (§6). CoGra holds no ownership state of its
  own.

Approval flows follow the same rule: where admission or removal is
genuinely CoGra governance — collective admission, chat kick policy
— it runs as ordinary Proposal machinery (§5), never as
relationship state encoded on a graph.
