# Moderation

CoGra moderates publicly-visible content via the same governance
primitive everything else uses: any User can create a Proposal
classifying content as `sensitive` or `illegal`; the Network votes
Shape B; threshold-cross applies the classification via cascade.
**No privileged moderator role with extra weight** — mods exist as
a gate, not as weighted voters.

The defense against bot-driven flooding lives in the gate: every
classification change requires **at least one moderator's positive
vote** in the tally. Bots can flood the community side but cannot
cross the gate without compromising a real moderator.

Encrypted ChatMessages are moderable once the chat key has been
disclosed (see §5); until then their bodies aren't readable by the
community and chat-internal disavowal
([chats.md §6](../instances/chats.md)) is the alternative recourse.

## 1. The three classifications

`moderation_status` is a graph-side property on every user-input-
bearing node — User, Collective, Post, Comment, ChatMessage,
Chat, Item, Hashtag (see [nodes.md](nodes.md)). Three values:

| Value | Meaning | Effect |
|---|---|---|
| `normal` | Default; community has not classified. | None. |
| `sensitive` | Community-classified mature / disturbing / etc. | Soft flag. Frontend respects each viewer's `content_filtering_severity_level` (see [data-model.md](../implementation/data-model.md) "User preferences"). Content stays. |
| `illegal` | Community-classified illegal under the platform guidelines. | Redaction cascade per [layers.md §5](layers.md) — graph-side in-place redaction, Postgres-side tombstone. |

The property is layered, so the full classification history is
preserved.

## 2. Reports = Proposals on the graph

A user reporting content **is** the act of creating a Proposal:

- **Subject:** a Proposal node ([nodes.md](nodes.md)) with target =
  the content node (via `:TARGETS` edge), `target_property =
  'moderation_status'`, `proposed_value = 'sensitive'` or
  `'illegal'`.
- **First reporter** authors the Proposal — the system reads the
  authoring as their +1 vote.
- **Subsequent reporters** cast Shape B votes
  ([governance.md §3](governance.md)) on the existing Proposal
  rather than authoring duplicates.
- **Threshold-cross** triggers the cascade: the proposed value is
  written to `moderation_status`, and on `'illegal'` the
  layers.md §5 redaction cascade fires.

There is **no separate Postgres reports table**. Reports live on
the graph as Proposal authoring + Shape B vote layers — fully
transparent, fully auditable, append-only by construction.

## 3. The mod-gate rule

For **any** moderation Proposal to cross threshold, the tally must
include **at least one positive vote from a User with
`network_role = 'moderator'`**. This is not a weight — mods count
as 1, same as everyone else — it is a gate.

The rule applies uniformly across both `sensitive` and `illegal`,
and symmetrically to un-classification (returning content to
`'normal'`):

- Without a mod gate on `sensitive`, a small coordinated group
  could flood-flag legitimate content, forcing endless
  re-moderation.
- Without a mod gate on `illegal`, bot networks could mass-vote
  redactions of legitimate content.
- Without a mod gate on un-classification, bots could strip
  moderation flags from legitimately-classified content.

Same mechanism in every direction. Mods are validators, not
weighted-voters.

## 4. Eligibility, weights, thresholds

The Network ([network.md](network.md)) is the eligibility-and-
voting body for moderation Proposals.

- **Eligibility:** all active Network members (every User with at
  least one outgoing actor edge inside the
  `Network.active_threshold_days` window).
- **Vote weight:** 1 per voter — mod or member.
- **Vote shape:** Shape B from the voter's User node directly.
  See [governance.md §3](governance.md) for the relaxation
  that permits a User node (rather than a junction) to carry
  the vote for Network-level governance.
- **Thresholds (read from the `:Network` singleton — see
  [graph-data-model.md](../implementation/graph-data-model.md)):**

  | Action | Quorum property | Pass-threshold property | Mod gate |
  |---|---|---|---|
  | Classify `sensitive`         | `Network.moderation_sensitive_quorum` (default 1%) | `Network.moderation_sensitive_threshold` (default >50%) | ≥1 mod positive |
  | Classify `illegal`           | `Network.moderation_illegal_quorum` (default 2%) | `Network.moderation_illegal_threshold` (default ≥2/3) | ≥1 mod positive |
  | Un-classify back to `normal` | symmetric to the original action | symmetric | ≥1 mod positive |

Quorum percentages are deliberately low so decisions can actually
finish — at network scale, even 1-2% participation in a specific
decision is high. The mod gate carries the integrity guarantee;
quorum just keeps a single mod from acting unilaterally.

Every number above is a property of the `:Network` singleton,
itself amendable via the same Proposal primitive
([governance.md §2.4](governance.md)). Defaults exist to bootstrap;
they are not fixed rules.

## 5. Scope

**In scope** (`moderation_status` exists on these node types):

- **User, Collective** — for the user-authored fields (avatar,
  bio, profile text, name).
- **Post, Comment** — content bodies and media.
- **ChatMessage** — both `plaintext` and `encrypted` per
  [chats.md §5](../instances/chats.md). Encrypted messages are
  classifiable once readable (see "encrypted message classification"
  below).
- **Chat** — name, description, image.
- **Item** — name, description, media.
- **Hashtag** — the canonical name itself.

**Out of scope:**

- Junction nodes (`ChatMember`, `CollectiveMember`,
  `ItemOwnership`) and `Proposal` nodes — they carry no
  user-authored content fields.

### Encrypted message classification

For a moderation Proposal targeting an encrypted ChatMessage to be
useful, voters need to be able to read the body. The disclosure
path is **independent of the moderation primitive** — any chat
member can release the chat's symmetric key (per
[chats.md §5](../instances/chats.md)) through any normal authoring
gesture: a Comment on the chat, a public Post, a plaintext
ChatMessage in the same chat, an off-graph channel, anything. The
system permits voluntary disclosure by participants by design.

Once the key has been disclosed publicly, anyone holding it can
decrypt the chat's encrypted bodies and read the evidence; the
moderation Proposal proceeds like any other. Until disclosure,
encrypted bodies cannot be classified by community moderation, and
chat-internal disavowal ([chats.md §6](../instances/chats.md)) is
the only platform-level recourse.

This matters in practice for cases like contracts in private chats
(forthcoming with the economics) where one party may need to
surface the other's misbehavior.

## 6. Coexistence with chat-internal moderation

Two distinct mechanisms can apply to a plaintext chat message:

- **Platform moderation (this doc).** Network-level
  classification. Drives the redaction cascade for `illegal`.
  Eligibility = every User.
- **Chat-internal disavowal** ([chats.md §6](../instances/chats.md)).
  The chat's stance toward a message or member. Eligibility =
  active ChatMembers of that chat.

Both can apply to the same content and produce different outcomes
— a chat-disavowed message is still platform-`'normal'` until the
Network classifies it, and a message classified `'illegal'`
platform-wide stays in any chat that hasn't disavowed it. The
platform outcome is destructive (`illegal` → redaction); the
chat-internal outcome is non-destructive (the chat moves away;
the message stays).

## 7. Noise vs consistency — what the mod gate does and doesn't solve

A bot net could try to flood the system by **mass-creating**
moderation Proposals against legitimate content and **mass-voting**
on each other's Proposals. Two distinct concerns, only one of
which the mod gate addresses:

- **Consistency.** No spam Proposal can apply without a real
  moderator's positive vote (§3). A million bot-authored
  Proposals against legitimate content cannot cross threshold.
  The classification cannot drift from `'normal'` without mod
  consent. The mod gate fully covers this.
- **Noise (operational).** Mods reviewing the queue could be
  drowned in bot-authored Proposals, with real reports buried in
  the noise. The mod gate doesn't address this directly.

Noise is handled out-of-graph by the same mechanisms used for the
rest of the platform:

- **Feed-ranking.** Moderator UIs surface Proposals through the
  same per-viewer ranking ([feed-ranking.md](feed-ranking.md))
  used for content. Bot-authored Proposals from severed clusters
  land at zero `h(t)` and never surface to honest mods. Real
  reports surface because they originate from non-severed users
  with real reach into the moderator's network.
- **API rate limits.** Per-author throttling on Proposal creation
  is an operational concern, same as login rate limits — it lives
  in the API layer, not the graph primitive.

Premature graph-level defenses (e.g. a `vote-restricted` role)
are deliberately not added. If real-world experience proves the
operational mechanisms insufficient, a graph-level role can be
added later — but adding it speculatively would risk being wrong
about the real attack shape.

## 8. Platform guidelines

The Network publishes normative platform guidelines covering what
counts as `illegal`, what counts as `sensitive`, and what is "not
a problem" — voters reference these when deciding their position
on a moderation Proposal.

The guidelines themselves are a **separate document, deferred to a
follow-up PR**. They are amendable via the same Proposal
primitive (eligibility = Network members; threshold tuned higher
for guideline-level changes).

## What this doc is not

- **Not the Network primitive.** Membership, the moderator role,
  and how mods come and go are in [network.md](network.md).
- **Not the redaction mechanism.** The illegal-only redaction
  cascade is defined in [layers.md §5](layers.md) — this primitive
  provides the community-driven authorization that §5 was missing
  ([open-questions.md Q9](../open-questions.md) resolved here).
- **Not the platform guidelines themselves** (forthcoming).
