# Post

The **Post** is CoGra's primary public content surface — a piece
of authored content (text and/or media) published by a User or
Collective. On the substrate a Post *is* an L1 **Content** node,
minted by its author's Publish record
([substrate-map.md §2](../primitive/substrate-map.md#2-content)):
publicly attributed, priced, permanent. What the Post *shows* —
title, body, media — is CoGra display content, carried per the
payload model
([substrate.md §7](../primitive/substrate.md#7-payload-carriage)).

Posts are the canonical target
[feed-ranking](../primitive/feed-ranking.md) orders, and what most
Opinion records in a typical instance point at.

---

## 1. Creation

Publishing is one gesture: the author's **Publish** record
(Actor → Content,
[edges.md §2](../primitive/edges.md#2-binary-families-cogra-authors)).
Genesis mints the Content node and fixes `creator` — no approval
flow, no second-party affirmation. The Publish act's identifier
*is* the Post's identity, forever
([layer1-interface.md §9](../primitive/layer1-interface.md#9-node-and-edge-type-inventory)).

Like every act it is priced and gated: the backend checks the
two-gate write rule and the act debits `θ`
([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)).

The Publish record carries:

- **The attachment parameter.** Publish is a single-parameter
  family: `p_d` = the author's attachment `a ∈ [−1, 1]`, `p_i`
  fixed at `1`. The frontend defaults it low (`+0.1`) per the
  repo-wide low-defaults policy
  ([invitations.md §3](../primitive/invitations.md#3-default-values-and-customization)) —
  headroom stays for deliberately strong attachment; the default
  is a fallback, never the recommendation.
- **License qualifiers.** Attribution `a ∈ {0, 1}` and oversight
  `o ∈ {0, 0.5, 1}` are structural metadata of the Publish
  record — declared at authoring time (mandatory in every
  content-creation flow), immutable thereafter, out of reach of
  any edit. Enforcement is CoGra's, per the four planks in
  [platform-guidelines.md §5](platform-guidelines.md#5-license-and-provenance-obligations).
- **The payload envelope.** The Peer Content Envelope carries the
  Post's structured fields — title, description, body — and the
  digests of attached media; media bytes live in blob storage,
  witnessed transitively through the digests.

One act, two homes. L1 accepts the structural record with the
payload witness; CoGra — the carriage service — holds the payload
bytes and the salt (Postgres rows; media bytes in blob storage).
The bytes are no copy of anything: carriage is their only home,
verifiable against the witness. The record mirror caches the
structural record for traversal — it may lag L1, never diverge.

A Collective authoring a Post is the same gesture performed by
the Collective's own actor (custody per
[collectives.md §2](collectives.md#2-custody)). Whether
and how member consent is required is the collective's
social-contract governance, per
[collectives.md](collectives.md).

---

## 2. What rides where

| Piece | Home |
|---|---|
| Title, description, body | Envelope fields on the Publish (and edit) payloads; Postgres display rows for query and render |
| Media | Bytes in blob storage; digests committed in the envelope |
| Topics | Tag hyper-edges toward Types (§3) |
| Quotes, embeds, mentions | Reference hyper-edges with the Post as citing artifact (§3) |
| Stances | Opinion records toward the node |
| Comments | Review hyper-edges minting Comment nodes ([comment.md](comment.md)) |
| Moderation state | Postgres flags + the verdict Tag mark ([moderation.md](moderation.md)) |

The rule behind the split: the shared graph holds what the Post
*is* and every act about it; Postgres holds what it *shows*
([nodes.md §4](../primitive/nodes.md#4-display-content-and-moderation-surfaces)).

---

## 3. Acts around a Post

**By the author, with the Post:**

- **Topic tagging** — a **Tag** hyper-edge (Actor → Post → Type),
  at creation or later; each tag is its own priced act. See
  [hashtag.md](hashtag.md).
- **Quoting, embedding, mentioning** — a **Reference** hyper-edge
  (Actor → Post → target) per cited node, authored alongside the
  Publish or later; nothing is minted, both endpoints pre-exist. A
  mention targets the person's **Profile** — a positive, effortful
  mention is a weak, priced vouch
  ([edges.md §3](../primitive/edges.md#3-hyper-edge-families-cogra-authors)).

**By anyone, toward the Post:**

- **Opinion** — the stance surface: valence and connection,
  full four-quadrant vocabulary, no authoring bar.
- **Review** — commenting; the hyper-edge targets the Post and
  mints the Comment ([comment.md](comment.md)).
- **Reference** — being quoted or embedded: other artifacts point
  at the Post as their Reference target. How the feed crosses a
  reference's citation leg — the content-intrinsic and
  initiator-owned channels — is
  [feed-ranking.md §4](../primitive/feed-ranking.md#4-the-path-set).
- **Tag** — third-party topic claims: anyone may tag the Post;
  the feed reads a stranger's tag only through its author, under
  the same two channels ([hashtag.md](hashtag.md)).
- **The verdict Tag** — The Moderator's `(0,0)` + payload mark
  toward a named moderation Type ([moderation.md](moderation.md)).

---

## 4. Editing

The instantiation of the node-value update rule
([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates)):

- **Carrier:** the creator's ordinary-role **Publish** toward the
  Post — the family that minted it, so the Post's full revision
  history is its Publish bundle and any L2 identifies each edit
  from act fields alone
  ([nodes.md §1](../primitive/nodes.md#1-l1-node-types-the-shared-graph)).
  Edits are authored at attachment `0`: routing-inert,
  vouch-inert.
- **Eligible author:** the creator, alone — an eligibility read
  rule, never a write restriction.
- **Chain root:** the genesis Publish. The current value is the
  head of the creator's declared causal-parent chain from genesis;
  an edit without its chain is fold-ignored, and two edits
  declaring the same parent are a branch — neither advances the
  head ([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates)).
  The backend populates the chain at prepare time and serializes
  edits per Post.
- **Granularity:** per field — title, description, body, and the
  media manifest each fold newest-wins independently; an edit
  payload carries only the fields it changes. Replacing media is
  new digests in a new edit payload; the old bytes' digests stay
  committed on the superseded record.

Every edit is a priced act — `θ`-debited, permanently counted.
History is public: superseded payloads remain published unless
removed (§5). An edit is the Publish bundle's newest member, so it
refreshes the authorship hop's recency like any revision — but the
deepest "newest content first" fallback reads the **genesis**
Publish's age, which no edit refreshes
([feed-ranking.md §7](../primitive/feed-ranking.md#7-sort-order-tie-breakers-zero-jail)):
editing never re-bumps a Post as new content.

What never edits: the Post's identity (the genesis record), its
`creator`, and its license qualifiers.

---

## 5. Lifecycle

Post nodes are **never deleted** — the shared graph is
append-only, and the structural record of every act stays.
Removal of content is **payload removal**: the payload state moves
one way, full → reduced, per whole record; the visible mark for
"never erase silently" is the immutable structural record plus the
reduced payload state
([layers.md](../primitive/layers.md)).

Which flows trigger removal on a Post — a moderation verdict, the
author's own per-content removal, the author's account deletion
(content-level) — and the Postgres-side tombstone and archive
mechanics live in [moderation.md](moderation.md),
[erasure.md](erasure.md), and
[retention-archive.md](../primitive/retention-archive.md). A full
deletion sweeps payload and salt across the whole revision chain —
the genesis payload and every edit record's payload (§4) — while
every structural record stays; a single superseded revision can
also be removed alone
([erasure.md §1](erasure.md#1-per-content-removal)).

The Post's identity key is stable across every removal: incident
records keep pointing at the same node, and caches keyed on it
stay valid. A removed Post is a reduced but still-graph-resident
Content node, not a vanished one.

---

## What this doc is not

- **Not the feed spec.** Where a Post surfaces in a viewer's
  feed — the path set, the channels a reference crosses, the
  read-side layers — lives in
  [feed-ranking.md](../primitive/feed-ranking.md).
- **Not the update rule.** The fold semantics, the eligibility
  model, and the update-record discipline live in
  [substrate.md §9](../primitive/substrate.md#9-node-values-and-updates);
  this doc only declares the Post's three slots.
- **Not the authorship rule.** Intrinsic author binding and its
  caches live in [authorship.md](../primitive/authorship.md).
- **Not the moderation mechanism.** Reports, proposals, verdicts,
  and the removal cascade live in [moderation.md](moderation.md).
- **Not the edge catalog.** Family semantics, parameter roles,
  and census pointers live in
  [edges.md](../primitive/edges.md).
- **Not the store schemas.** Concrete Postgres columns, envelope
  key layout, and mirror shapes live in
  [data-model.md](../implementation/data-model.md).
