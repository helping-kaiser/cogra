# Comment

The **Comment** is CoGra's universal response surface — a reply
or annotation authored by a User or Collective on another node.
On the substrate a Comment *is* an L1 **Comment** node, minted by
the terminal leg of its author's **Review** hyper-edge
([substrate-map.md §2](../primitive/substrate-map.md#2-content)).
Universal Reviewability makes the threading primitive native:
anything that exists in the graph admits attributed public
commentary, and a Comment is itself a full node — stance-able,
taggable, reviewable, quotable, moderatable.

---

## 1. Creation

Commenting is one act: the author's **Review** hyper-edge
(Actor → parent → Comment,
[edges.md §3](../primitive/edges.md#3-hyper-edge-families-cogra-authors)) —
one `θ`-debit, one stamp, two legs. The A-leg targets the parent;
the terminal leg mints the new Comment node, whose identity is
the Review act's identifier. No approval flow, no second-party
affirmation.

**The parent is whatever the response responds to.** Threading is
direct-parent: a reply to a Post reviews the Post; a reply to a
comment reviews *that Comment*; an annotation on a chat utterance
reviews the Message (a Send responds inside the channel; a Review
annotates it from outside). Every passive node type is Reviewable
at L1 — Content, Comment, Message, Chat, Item, Type, Profile,
Offer — so which parents CoGra's UI offers a comment box on is
product policy, never a substrate limit.

The record carries:

- **The stance parameters** — enthusiasm `e` and effort `f`, the
  author's stance toward the parent riding the same act that
  responds to it (A-leg `p_d = e, p_i = f`; Tribal, Full tier).
  Defaults sit low (`+0.1, +0.1`) per the repo-wide policy
  ([invitations.md §3](../primitive/invitations.md#3-default-values-and-customization)).
- **License qualifiers** — declared at authoring time, immutable,
  same rule as every content-creation flow
  ([platform-guidelines.md §5](platform-guidelines.md#5-license-and-provenance-obligations)).
- **The payload envelope** — body text and media digests in the
  Peer Content Envelope
  ([substrate.md §7](../primitive/substrate.md#7-payload-carriage)).
  The witness lands on L1; the bytes and salt live in CoGra
  carriage — their only home, verifiable against the witness —
  and the mirror caches the structural record.

A Collective commenting is the same gesture by the Collective's
own actor ([collectives.md](collectives.md)).

---

## 2. Threading

Reply chains are **causal chains of Review records** — thread
structure is graph-native, with no parent pointer stored anywhere
else.

The geometry does the moderation of depth by itself:

- **Weight concentrates on the targeted node.** A reply lifts its
  direct parent, not the thread root; a viewer's stance lands on
  exactly the utterance it judges.
- **Depth attenuates naturally.** Each nesting level compounds the
  terminal leg's Marginal damping, so deep chains fade without any
  explicit depth cap (``rem:nodes:nested-comment-review``).

Reviews are **commentary, never state**: the family is
standing-inert, transitions no settlement, moves no title, binds
no tag, creates no membership
([layer1-interface.md §9.2](../primitive/layer1-interface.md#92-affordance-traits-tblnodesaffordance-traits)).
Commentary stays fully available to the feed and attribution —
Review legs traverse as ordinary edges with real `w̃` and real
signs ([feed-ranking.md](../primitive/feed-ranking.md)).

---

## 3. Acts around a Comment

**By the author, with the Comment:**

- **Topic tagging** — a Tag hyper-edge (Actor → Comment → Type).
  Anyone may tag; the feed reads a third party's tag through its
  author ([hashtag.md](hashtag.md)).
- **Quoting and mentioning** — Reference hyper-edges with the
  Comment as citing artifact: the original of an image it
  re-posts, a person named in its body (a Profile-targeting
  mention), a proposal anchor cited in debate. Nothing is minted;
  each reference is its own priced act.

**By anyone, toward the Comment:**

- **Opinion** — likes and dislikes on comments are native stance
  records, full four-quadrant vocabulary.
- **Review** — a reply: the next link of the causal chain.
- **Reference** — being quoted by other artifacts; the feed
  crosses citation legs per the two-channel rule
  ([feed-ranking.md §4](../primitive/feed-ranking.md#4-the-path-set)).
- **The verdict Tag** — The Moderator's `(0,0)` + payload mark
  ([moderation.md](moderation.md)).

---

## 4. Editing

The node-value update rule
([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates)),
instantiated for Comments:

- **Carrier:** the creator's ordinary-role **Review** — the same
  shape as creation: A-leg to the same parent, T-leg to the
  existing Comment instead of a fresh mint. Authored at `(0,0)`,
  routing-inert; the Comment's revision history is its Review
  bundle.
- **Eligible author:** the creator alone.
- **Chain root:** the genesis Review — head of the declared
  causal chain; same-parent siblings are a branch and the
  incumbent holds
  ([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates)).
- **Granularity:** the whole Comment — body and media manifest
  together, the winning payload read as the complete state.

**The parent is genesis-fixed.** The Comment's parent is its
**genesis** Review's A-leg target. Formation cannot check that an
edit's A-leg matches it — that would take a lookup — so an edit
whose A-leg differs from genesis is fold-ignored: it neither
reparents the Comment nor wins the body fold. The record is still
a live edge in traversal and sentiment, which is why the feed
channel-gates ordinary-role Review T-legs — a stranger's
mismatched "edit" cannot wire someone else's Comment beneath an
arbitrary carrier
([feed-ranking.md §4](../primitive/feed-ranking.md#4-the-path-set)).

One consequence, accepted knowingly: an edit's A-leg lands weight
on the parent — the existing commenting mechanic, N+1 times
instead of once.

Every edit is priced; history is public. The Comment's identity,
its `creator`, its parent, and its license qualifiers never edit —
responding to something else is a new Comment.

---

## 5. Lifecycle

Comment nodes are **never deleted**; removal is payload removal
to the reduced projection, whole-record, one-way, with the
immutable structural record as the visible mark
([layers.md](../primitive/layers.md)). Triggering flows and
Postgres-side tombstone/archive mechanics:
[moderation.md](moderation.md),
[erasure.md](erasure.md),
[retention-archive.md](../primitive/retention-archive.md).

Removal never breaks a thread: the chain is structural, so
replies below a reduced Comment keep their parent and stay
readable. The identity key is stable; every incident record keeps
pointing at the same node.

---

## What this doc is not

- **Not the feed-ranking spec.** How Review legs weigh, how depth
  damping composes, and every read-side layer live in
  [feed-ranking.md](../primitive/feed-ranking.md).
- **Not the update rule.** The fold semantics live in
  [substrate.md §9](../primitive/substrate.md#9-node-values-and-updates).
- **Not the authorship rule.** Intrinsic author binding lives in
  [authorship.md](../primitive/authorship.md).
- **Not the moderation mechanism.** Reports, verdicts, and the
  removal cascade live in [moderation.md](moderation.md).
- **Not the edge catalog.** Family semantics and census pointers
  live in [edges.md](../primitive/edges.md).
- **Not the store schemas.** Columns, envelope keys, and mirror
  shapes live in
  [data-model.md](../implementation/data-model.md).
