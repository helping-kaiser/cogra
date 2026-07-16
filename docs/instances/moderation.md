# Moderation

Moderation is **CoGra's responsibility, exercised on CoGra's own
authority**. L1 carries every record regardless of content — no
admission rule reads a classification, and content governance is
terminal by contract
([layer1-interface.md §10](../primitive/layer1-interface.md#10-content-governance-metadata-pn-full-9-seccontent--full-paper-only)).
What CoGra does about bad content is therefore L2 policy, and this
doc is its published spec.

The machinery is the same governance primitive everything else
uses: any User can create a Proposal classifying content as
`sensitive` (soft filter) or `illegal` (redaction); the Network
votes; threshold-cross applies the classification. The outcome is
materialized on the shared graph by the **moderation system
actor** — an ordinary L1 actor CoGra regards as special
([substrate.md §8](../primitive/substrate.md#8-system-actors)) —
so every verdict is a public, priced, attributable record. **No
privileged moderator role with extra weight** — mods exist as a
gate, not as weighted voters.

The defense against bot-driven flooding lives in two places.
Every classification requires moderator consent in the tally —
**at least one positive vote**, and a fraction of the active
moderators for the destructive `illegal` redaction (§3) — so bots
can flood the community side but cannot cross the gate without
compromising real moderators. And reporting itself is priced: a
report authors the Proposal's L1 anchor, which debits the
reporter's capacity like any other act (§2).

### Vocabulary: moderation vs chat-scope kick

**Invariant — scope reservation.** "Moderation" is Network-scope:
classifying content as `sensitive` or `illegal` via the
governance flow in this doc. Removing a *member from a chat* is
the chat-scope **kick** flow — a passed `decision:disavow_member`
Proposal executed as an L1 De-invite
([substrate-map.md §4](../primitive/substrate-map.md#4-conversations-and-membership),
[chats.md §10](chats.md#10-moderation)) — with its own
eligibility (chat roles, not the Network), its own state
(the membership fold, not a classification), and its own
reversibility (non-sticky). The two never share a gesture or a
vocabulary.

## 1. The two classification paths

Both classifications target **a record and the node it carries**
— the Post, Comment, Message, Chat, Item, or Profile a viewer
actually sees (§5). They differ in what the verdict does.

### `sensitive` — read-side filter plus a public mark

A passing `'sensitive'` Proposal changes how CoGra *renders* the
content; the content stays everywhere.

- **Read-side flag.** Postgres metadata records the verdict and
  its category; frontends respect each viewing user's
  `content_filtering_severity_level`
  ([data-model.md](../implementation/data-model.md)) when
  rendering. The flag can name specific fields or attachments —
  filter granularity is a Postgres-side, read-side freedom.
- **Substrate-visible mark.** The moderation system actor authors
  a **Tag `(0,0)` + payload** toward the named moderation Type
  for the category
  ([edges.md §3](../primitive/edges.md#3-hyper-edge-families-cogra-authors)).
  The `(0,0)` parameters are routing-inert — the Tag is a pure,
  machine-readable mark any L2 can consume, and its payload
  carries the verdict and the authorizing Proposal's anchor.

**Reversal.** The newest Tag per (target, Type) wins: a later
passed Proposal clears the mark with a newer Tag whose payload
records the un-classification, and the Postgres flag is lifted.
Symmetric bars apply (§4).

### `illegal` — whole-record redaction

A passing `'illegal'` Proposal fires the redaction cascade
defined in
[layers.md §5](../primitive/layers.md#5-deletion-policy):

1. **Payload removal.** The payload and private value of the
   record carrying the content are removed from carriage; the
   record drops to its reduced projection. Granularity is **the
   record, whole** — the binding content commitment forbids
   partial rewrite, so there is no per-field redaction. The
   structural record, its witness, and everything the record does
   on L1 (standing, routing, title) are untouched.
2. **Postgres and media.** The display rows are tombstoned and
   the blob-storage assets removed; their digests remain
   committed in the (now removed) witnessed payload. The public
   evidence of removal is the reduced payload state.
3. **Archive.** Each redacted original is written to the
   [retention archive](../primitive/retention-archive.md)
   automatically. The `legal_hold_until` value is set
   asynchronously by `legal_admin` — a member of the host's
   operations team, not a graph role
   ([retention-archive.md §4](../primitive/retention-archive.md#4-access-path))
   — after case review; the cascade does not block on it.
4. **Verdict mark.** The moderation system actor authors the Tag
   `(0,0)` + payload toward the `illegal` moderation Type, same
   shape as above.

`'illegal'` is **not** reversible — payload state moves one way.
Where both classifications have been applied, `illegal` takes
precedence; the precedence is CoGra read-side policy, since the
Tags themselves are independent marks.

The cascade is bounded to what the Proposal targeted and does
**not** propagate to descendants. Classifying a Post's body
illegal does not redact its Comments; each requires its own
classification.

## 2. Reports = Proposals on the graph

A user reporting content **is** the act of creating a Proposal
([substrate-map.md §5](../primitive/substrate-map.md#5-governance-and-moderation)):

- **Subject.** An overlay Proposal node carrying `proposed_value`
  = `'sensitive'` or `'illegal'` plus the guidelines category. Its
  public structure is L1: the proposer's **Content anchor** — the
  report's justification rides it as witnessed payload — and the
  anchor's `(0,0)` Reference to the reported node, which names the
  subject on the shared graph. The act debits the reporter's
  capacity like any other record. A report is a priced,
  attributable, public act.
- **First reporter** authors the Proposal, and the client flow
  bakes their explicit `+1` ballot immediately after creation —
  one more priced act. The anchor's genesis is a Publish record;
  authoring is never read as a vote
  ([governance.md](../primitive/governance.md)).
- **Subsequent reporters** cast ballots on the existing Proposal
  rather than authoring duplicates — payload-marked Opinions
  toward its anchor, each a priced act
  ([governance.md](../primitive/governance.md)).
  A reporter who wants the *other* classification on the same
  content authors a separate Proposal — independent
  classifications, not duplicates.
- **Threshold-cross** triggers the finalization gesture (a system
  actor's Opinion `(0,0)` + outcome payload toward the anchor)
  and the verdict cascade in §1. The verdict costs the moderation
  system actor capacity **per passed proposal, not per report**.

There is **no separate Postgres reports table**. Reports live as
Proposal machinery — the anchor, the ballots, and the
finalization on L1, the tally in the overlay — fully transparent,
fully auditable, append-only by construction.

## 3. The mod-gate rule

Every moderation Proposal — classification and un-classification
— runs through the **mod-gate** before its outcome can take
effect, at the tier its stakes warrant. `sensitive`
classification and its reversal sit at the **baseline tier**: at
least one positive vote from a User with
`network_role = 'moderator'`. `illegal` redaction is destructive
and irreversible, so it sits at the **critical tier**: positive
moderator votes `≥ ⌈Network.critical_mod_gate_fraction ·
|active mods|⌉`.

The primitive definition lives in
[governance.md §7](../primitive/governance.md#7-the-mod-gate),
which states the invariant "mod weight = member weight = 1; mod
is a gate, not a weight," and names the failure modes each side
of the multi-gate pattern closes off. The same component
reappears in moderator role changes
([network.md §9](../primitive/network.md#9-mod-role-changes-via-multi-sig-proposal))
and `:Network` parameter amendments
([network.md §11](../primitive/network.md#11-amending-network-parameters)).

Instance-specific arithmetic — `moderation_sensitive_*` and
`moderation_illegal_*` quorum/threshold defaults — lives in §4.

## 4. Eligibility, weights, thresholds

The Network ([network.md](../primitive/network.md)) is the
eligibility-and-voting body for moderation Proposals.

- **Eligibility:** all active Network members, per the governed
  activity definition
  ([network.md §8](../primitive/network.md#8-membership-and-roles)).
- **Vote weight:** 1 per voter — mod or member.
- **Vote shape:** L1 ballots — payload-marked Opinions toward the
  Proposal's anchor; see
  [governance.md](../primitive/governance.md).
- **Tally:** petition-style — only positive votes contribute. See
  [governance.md §3 "Petition-style tally and dual quorum"](../primitive/governance.md#petition-style-tally-and-dual-quorum-network-scope-only).
- **Dual-quorum bars** (governed properties of the `:Network`
  overlay singleton, replayable from its charter anchor —
  [network.md](../primitive/network.md)). A Proposal passes when
  `positive_count ≥ min(P × |active members|, K)`:

  | Action | `P` (`*_quorum_fraction`) | `K` (`*_quorum_count`) | Mod gate |
  |---|---|---|---|
  | Classify `sensitive`               | `Network.moderation_sensitive_quorum_fraction` (default `0.25`) | `Network.moderation_sensitive_quorum_count` (default `5000`) | baseline tier: ≥1 mod positive |
  | Classify `illegal`                 | `Network.moderation_illegal_quorum_fraction` (default `0.50`) | `Network.moderation_illegal_quorum_count` (default `10000`) | critical tier: ⌈`critical_mod_gate_fraction` · \|active mods\|⌉ |
  | Un-classify `sensitive` → `normal` | symmetric to the original action (`moderation_sensitive_*`)     | symmetric                                                     | baseline tier: ≥1 mod positive |

  `'illegal'` has no un-classify row — payload removal is
  monotone ([layers.md §5](../primitive/layers.md#5-deletion-policy)).

The fractional bar `P` governs while the network is small (a real
majority of active members is required to pass). Once membership
scales past `K / P` active members, the absolute bar `K` takes
over (a fixed engagement-level positive-vote count is sufficient).
The mod gate carries the integrity guarantee independently of
either bar.

Every number above is a governed `:Network` parameter, amendable
via the rules in
[network.md §11](../primitive/network.md#11-amending-network-parameters)
— the `moderation_illegal_*` parameters fall in the critical
bucket (higher fractional bar, larger absolute count) because
their abuse drives the redaction cascade; the
`moderation_sensitive_*` parameters fall in the baseline bucket.
Defaults exist to bootstrap; they are not fixed rules.

## 5. Scope

A classification targets what a viewer sees — a Post, Comment,
Message, Profile, Chat, Item, or topic — and resolves to the L1
record(s) carrying that content:

| Surface | Carrying record(s) |
|---|---|
| Post body + media | the Publish record's payload envelope |
| Comment | the Review record's payload |
| Chat message | the Send record's payload (plaintext or ciphertext, [chats.md §9](chats.md#9-encryption-as-the-privacy-mechanism); see "Encrypted message classification" below) |
| Profile content (bio, avatar, display name) | the Registration bundle's payloads |
| Chat name / description / image | the chat-creating record's payload (and later parallel records revising it) |
| Item name / description / media | the genesis Owner record's payload (and revisions) |
| Topic name | a Type is a bare name with no payload; an offensive topic is a naming-service and read-side concern ([hashtag.md](hashtag.md)), plus classification of the content tagged with it |
| Proposal text / report justification | the proposal's Content anchor payload — anchors are ordinary records, moderatable like any content |
| Stance rationale | the payload of the Opinion (or other stance record) carrying it |

For `illegal`, the cascade removes each targeted record's payload
whole (§1) — where content spans parallel records (profile
revisions, edited bodies), the Proposal names the records it
covers, and each is removed whole. For `sensitive`, the Postgres
flag can be narrower — one field, one attachment — because
filtering is read-side and free of the commitment's granularity.

**Out of scope:**

- Overlay structure (Proposal tally state, `:Network` parameters,
  CollectiveMember junctions) — no user-authored content;
  governed by their own machinery.
- The reward economy's records (campaigns, settlements, payouts)
  — they live on CoGra's own rail
  ([economics.md](../primitive/economics.md)), nothing
  user-authored on a graph.

### Encrypted message classification

For a moderation Proposal targeting an encrypted Message to be
useful, voters need to be able to read the body. The disclosure
path is **independent of the moderation primitive** — any chat
member can release the relevant epoch's chat key (per
[chats.md §9](chats.md#9-encryption-as-the-privacy-mechanism))
through any normal authoring gesture: a Comment on the chat, a
public Post, a plaintext Message in the same chat, an off-graph
channel, anything. The system permits voluntary disclosure by
participants by design. Disclosure is scoped to the disclosed
epoch only; leaking one epoch key exposes that epoch's messages
and no others.

This matters in practice for cases like contracts in private
chats (forthcoming with the deferred contracts / marketplace
workstream) where one party may need to surface the other's
misbehavior.

#### Why this is a norm, not a protocol gate

Nothing blocks a Proposal authored against an opaque ciphertext,
nor votes cast on it. A bot swarm can `+1` encrypted bodies all
day, and a malicious moderator can cross the gate (§3) without
reading anything. What prevents this is the role definition, not
the code:

- **Bot voting on ciphertext** is the same noise-vs-consistency
  problem as any other bot voting (§7) — the mod gate guarantees
  consistency, since no Proposal crosses without a real
  moderator's positive vote.
- **A moderator voting on undisclosed ciphertext** is a
  mod-conduct violation. The remedy is the same Proposal
  primitive applied to that User's `network_role` — the Network
  votes the offender out of the moderator role
  ([network.md](../primitive/network.md)).

The integrity guarantee is a **two-part claim**: the mod gate (§3)
blocks the consistency attack; the de-mod-ing path addresses
moderator misconduct. Together they make "moderate only after
disclosure" a load-bearing norm rather than a protocol invariant
— the most we can offer without protocol-level guards that would
be both too weak (off-graph disclosure exists and cannot be
detected) and too strict (legitimate cases like contract disputes
would be blocked).

**The cascade fires regardless of disclosure state.** If a
Proposal targeting an encrypted Message crosses threshold —
including the mod-gate `+1` — the redaction cascade in §1 runs
whether or not any voter actually read the body; removing a
ciphertext payload is the same one-way transition as removing a
plaintext one. The tally is inspected, not decryption state. A
Network whose moderators wave through cascades on opaque
ciphertext is already broken; the remedy is the de-mod-ing path
above, not a protocol veto.

## 6. Coexistence with chat-internal moderation

Platform moderation (this doc) and the chat-scope kick flow
([chats.md §10](chats.md#10-moderation)) can both bear on the
same situation — an abusive message can be classified by the
Network while its author is kicked by the chat. They sit at
different scopes, eligibility differs (active Network members vs
per-chat roles), and outcomes write different state
(classification verdicts vs the membership fold via a De-invite)
— so they never compete for the same write.

The primitive coexistence rule — scope decides the state written,
instances at different scopes never compete for the same write —
lives in
[governance.md §9](../primitive/governance.md#9-coexistence-multiple-governance-instances-on-a-shared-subject).

## 7. Noise vs consistency — what the mod gate does and doesn't solve

A bot net could try to flood the system by **mass-creating**
moderation Proposals against legitimate content and
**mass-voting** on each other's Proposals. Two distinct concerns,
only one of which the mod gate addresses:

- **Consistency.** No spam Proposal can apply without a real
  moderator's positive vote (§3). A million bot-authored
  Proposals against legitimate content cannot cross threshold.
  The mod gate fully covers this.
- **Noise (operational).** Mods reviewing the queue could be
  drowned in bot-authored Proposals, with real reports buried in
  the noise. The mod gate doesn't address this directly.

Noise is bounded and handled by the same mechanisms as the rest
of the platform:

- **Reports are priced.** Every report authors an L1 anchor and
  debits the reporter's capacity (§2) — mass report creation has
  a floor cost per Proposal, unlike free-form flagging.
- **Feed-ranking.** Moderator UIs surface Proposals through the
  same per-viewer ranking
  ([feed-ranking.md](../primitive/feed-ranking.md)) used for
  content. Bot-authored Proposals from severed clusters rank
  nowhere for honest mods; real reports surface because they
  originate from users with real reach into the moderator's
  network.
- **API rate limits.** Per-author throttling on Proposal creation
  is an operational concern, same as login rate limits — it lives
  in the API layer.

Premature protocol-level defenses (e.g. a `vote-restricted` role)
are deliberately not added. If real-world experience proves the
operational mechanisms insufficient, a role can be added later —
but adding it speculatively would risk being wrong about the real
attack shape.

## 8. Platform guidelines

The Network publishes normative platform guidelines covering what
counts as `illegal`, what counts as `sensitive`, and what is
`normal` — voters reference these when deciding their position
on a moderation Proposal.

The guidelines live in
[platform-guidelines.md](platform-guidelines.md). They are
amendable via the same Proposal primitive (dual-quorum bars in
`Network.guidelines_change_quorum_fraction` /
`Network.guidelines_change_quorum_count`, tuned higher than
single-content classification because an amendment shifts the
normative frame for *all future* moderation). The current version
is pinned by the governed `:Network` properties
`guidelines_version` + `guidelines_hash`, and each ratified
version's text is anchored on L1 as a platform document — a
publisher-authored Content node whose anchoring Publish record
carries the document as witnessed payload
([substrate.md §8](../primitive/substrate.md#8-system-actors)).

## What this doc is not

- **Not the Network primitive.** Membership, the moderator role,
  and how mods come and go are in
  [network.md](../primitive/network.md).
- **Not the redaction mechanism.** Payload removal and the
  Postgres tombstone are defined in
  [layers.md §5](../primitive/layers.md#5-deletion-policy) and
  the archive disposition in
  [retention-archive.md](../primitive/retention-archive.md); this
  doc provides the community-driven authorization for
  illegal-content classification (account-deletion is a separate
  user-initiated authorization path).
- **Not the platform guidelines themselves.** The bucket contents
  and amendment procedure are in
  [platform-guidelines.md](platform-guidelines.md).
