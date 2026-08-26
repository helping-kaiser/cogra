# Chats

Chats on CoGra are **not** what they are on WhatsApp, Signal, or
iMessage. Assuming otherwise leads to wrong designs.

This doc covers the conversation surface: the **Chat** container,
the **Message**, and **membership** — which is not a node at all
but a fold over public records
([substrate-map.md §4](../primitive/substrate-map.md#4-conversations-and-membership)).

---

## 1. Mental model reset

In most messaging apps a chat is a private, hidden space:
membership is invisible to outsiders and the conversation
effectively does not exist from the outside.

In CoGra, a chat is a **public node on the shared graph** — and
the shared graph is shared with every other L2, not just CoGra's
users. Its existence, its membership signals, and who-talks-to-whom
are public records.

Chat topology — the Chat node, the membership record set, the
message record set — is always public
([graph-model.md §1](../primitive/graph-model.md#1-core-principles)). Only the
**body** of individual Messages is private, and only when the
chat runs encrypted (§7). There is no "private chat" mode that
hides membership or metadata.

Chats and Messages are **first-class content**: stance-able,
reviewable, taggable, rankable in feeds — just like Posts. A chat
is a public discussion space that happens to have members, some
of which may choose to run with encrypted content.

---

## 2. The L1 shape

Everything a chat does decomposes into six L1 families plus the
Chat and Message nodes they anchor
([edges.md](../primitive/edges.md),
[layer1-interface.md §9](../primitive/layer1-interface.md#9-node-and-edge-type-inventory)):

| Record | Shape | Role |
|---|---|---|
| **Participant** | Actor → Chat → Chat | The hyper movement record — one meaning, *I move from A to T*: A-leg = whence, T-leg = whither. Founding targets the fresh mint with both legs; joining targets the existing chat with both; founding a **successor** runs A-leg to the predecessor, T-leg to the mint (§8); a **move** runs A-leg to the chat left, T-leg to the chat joined. The record the membership fold reads — keyed on **leg role**, never bare family incidence (§4). |
| **Leave** | Actor → Chat | The exit record — unilateral, unconditional, a control record. Departure *without* destination: there is no "nowhere" node and a self-referential T-leg is a join, so Leave is not subsumed by the move form. |
| **Join Request** | Actor → Chat | Asking to join — a proposal, never participation. |
| **Invitation** | Actor → Chat → Profile | Inviting — a public, priced vouch that the invitee fits; a proposal, never participation. |
| **De-invite** | Actor → Chat → Profile | The expulsion mark, and withdrawal of one's own Invitation; a control record. |
| **Send** | Actor → Chat → Message | Posting a message — the terminal leg mints the Message. |

Two L1 facts frame the whole doc:

- **Membership is terminal.** No L1 rule reads it — membership is
  a read-side fold CoGra defines over the records above (§4). L1
  accepts anyone's Participant, Leave, or De-invite; what they
  *mean* is CoGra's published policy.
- **Send is not membership-gated at L1.** A membership
  precondition would drag membership into the admission closure,
  so the substrate accepts any actor's Send toward any Chat.
  CoGra's membership gate on messages is the same read-side fold,
  applied at render and traversal time.

Participant's T-leg is census-forced positive and Marginal — a
weak lineage marker, structural rather than stance-bearing; the
member's real stance toward the destination rides the A-leg, and
for a join or founding the self-loop T-leg is routing-inert
whatever it carries
([layer1-interface.md §9.6](../primitive/layer1-interface.md#96-hyper-edge-types-subsecnodeshyper-edges)).

---

## 3. Creation

**Founding a Chat** is the founder's own **Participant** act,
both legs targeting the fresh mint: its act identifier mints the
Chat node, fixes the founder as creator, and is simultaneously
the first membership signal. The founding payload carries the
initial chat metadata — name, description, image digests — the
chat's governance map (§5), and the name of the chat's **system
actor** (below), in the Peer Content Envelope
([substrate.md §7](../primitive/substrate.md#7-payload-carriage)).
A Collective founds a chat the same way, through its own actor.

**Every chat has a system actor** — an ordinary L1 actor admitted
as part of chat creation and named in the founding payload. It
exists to execute the chat's passed decisions as succession acts
(§8); it holds no role in the room and earns nothing. CoGra holds
its keys — the Publisher custody pattern
([substrate.md §8](../primitive/substrate.md#8-system-actors))
applied per chat — and its admission and θ-debits are funded by
the members through rail transfers to its account.

**Lineage.** A chat is addressed and rendered as its **lineage**
— the chain of Chat nodes its successions produce (§8). A
succession is **linear** iff its founding act is authored by the
actor named in the predecessor's founding payload; a stranger's
actor cannot extend someone else's lineage, and anyone else's
succession founds a **fork** (§8). The L2 fold bundles the linear
lineage into **one logical chat**, epoch-granularly: a record
toward lineage chat `C_k` is in the bundle iff it landed in an L1
epoch ≤ the epoch where `C_k`'s successor landed. Later records
toward a superseded node are deliberate and fall out; CoGra's own
prepare step always targets the lineage head, so the cutoff only
affects records prepared outside CoGra. Membership, messages,
backing, bans, stances, and the key-epoch count all read the
bundle (§4, §7), and the feed ranks the lineage as one candidate
([feed-ranking.md §4](../primitive/feed-ranking.md#4-the-path-set)).

**The named actor changes only by succession.** Payloads are
immutable, so "changing the system actor" is an
incumbent-authored succession whose new founding payload names
the new actor, executed on a passed
`decision:change_system_actor` proposal (§5). If the incumbent
can never act again, the lineage is frozen at its head, and the
community's exit is a real fork — the intended failure mode.

**Posting a Message** is one **Send** act: the terminal leg mints
the Message node; the importance parameter rides the A-leg; the
body — plaintext or ciphertext (§7) — rides the payload envelope;
the witness lands on L1 while the bytes and salt stay in CoGra
carriage, and the mirror caches the structural record. **A
Message belongs to the chat that minted it**: the transcript is
exactly the Messages minted by Send acts into the lineage, and an
ordinary-role Send toward an existing Message — legal at L1 — is
never a transcript entry, so nobody renders someone else's
message inside another chat. Quoting,
embedding, and mentioning from a message are **Reference**
hyper-edges with the Message as citing artifact; topics are
**Tag** hyper-edges — the author's own or third-party
([hashtag.md](hashtag.md)). License qualifiers and the
low-default stance values follow the same rules as every content
flow ([post.md §1](post.md#1-creation)).

Like every act, all of these are priced (`θ`-debited) and gated by
the write rule
([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)).

---

## 4. Membership

Membership is **computed, never stored**. CoGra adopts the
canonical membership fold
(``def:nodes:canonical-membership-fold``,
[layer1-interface.md §9.8](../primitive/layer1-interface.md#98-membership-proposals-and-revocation))
**with ban semantics**, which the canonical fold explicitly
permits a policy `𝒫` to declare. "Banned" is a property this
fold computes, never a state L1 stores — a De-invite is one
record at one point in the order. Two clauses:

> **Banned.** `a` is banned from `C` iff the `≺`-maximal element
> of the authority set's recognized {De-invite, Invitation}
> records toward the incidence `(C, prof(a))` is a De-invite.
>
> **Member.** `a` is a member of `C` iff `a` is not banned, and
> `a`'s own `≺`-latest {Participant, Leave} element toward `C` is
> a Participant that strictly `≺`-follows the latest recognized
> De-invite toward `(C, prof(a))`, where one exists.

Where no De-invite exists, the member clause reduces to the
canonical fold — the ordinary join/leave path is unchanged.

On top of the fold sit CoGra's two published policy clauses, the
authority policy `𝒫`:

- **Recognition:** the ban predicate reads only **proposal-backed
  records authored by chat-authority actors** — the authorizing
  proposal's anchor cited in the payload (§6): De-invites
  (`decision:disavow_member`) and un-ban Invitations
  (`decision:lift_ban`, §5). A freelance De-invite is
  membership-inert; its only effect is suppressing the author's
  *own* Invitation vouch toward that (Chat, Profile) — evidence,
  not force, and per-author by L1's own rule. An ordinary member's
  Invitation is a vouch and admission backing, never part of the
  ban predicate — otherwise any member could un-ban anyone. L1's
  Inviter Revocation stays per-author because it governs vouch
  compilation; this predicate governs membership — two folds over
  the same records, asking different questions.
- **Backing (gated chats):** where the chat's governance map
  requires admission approval, the fold recognizes a Participant —
  keyed to its **T-leg**, the chat being entered — only when
  backed by an approved Join Request or an Invitation; the
  founding act is exempt, since it mints the chat it enters. In
  open chats, any Participant is recognized as-is.

**Three act shapes, keyed on leg role.** Participant is a
movement record — *from A to T* (§2) — so departure is
expressible two ways, and the fold for chat `C` reads three
shapes: a Participant whose **T-leg is `C`** — participation in
`C`; a Participant whose **A-leg is `C` and T-leg is not** —
departure from `C`; and a **Leave** toward `C` — departure. The
`≺`-maximal element of the combined per-author chain governs,
under the ban clause above. Keying on leg role, never bare family
incidence, is load-bearing: a fold reading "any Participant
incident on `C`" as participation would treat a move's A-leg as a
rejoin of the chat being left. One move act is simultaneously a
departure from its A-chat and an arrival in its T-chat; a "move"
from a chat the author was never in is a decorated join — origin
is unchecked at formation, and the inert claim changes nothing
the fold computes.

**Every fold here runs over the bundled lineage** (§3), never a
single Chat node — membership, the ban predicate, backing, and
the key-epoch count (§7) alike. Membership therefore carries
across a linear succession with nobody acting, and so do bans: a
De-invite or backing record anywhere in the lineage is in the
bundle, so succession cannot launder an expulsion.

### Joining

Proposals never participate — membership materializes **only from
the joiner's own Participant record**:

- **Open chat:** the joiner authors a Participant. Done.
- **Request flow:** the joiner authors a **Join Request**; the
  chat approves it per its `decision:add_member` rule (§5); the
  joiner then authors the Participant the fold now recognizes.
  Ignoring a request requires no graph action.
- **Invite flow:** an existing member authors an **Invitation**
  (Actor → Chat → Profile) — a priced public vouch, with the
  invite message as payload; the invitee, if they want in,
  authors their own Participant. An Invitation is revocable per
  author by a later De-invite; a later Invitation re-establishes
  it.

The Participant's parameters (interactivity, responsibility) are
a real stance toward the chat, defaulted low like every normal
act
([invitations.md §3](../primitive/invitations.md#3-default-values-and-customization)).

### Leaving

**Leave** — unilateral and unconditional, with no membership
precondition; no vote, no approval. Sentiment about a departure
composes through Opinion, never through the control record: a
rage-quit is Leave plus a negative Opinion on the Chat.

### Kick

A kick is a passed **`decision:disavow_member`** proposal (§6
Level 2) **executed on L1**: the executing chat-authority actor —
an ordinary member whose per-chat role authorizes execution,
never a global system actor — authors the **De-invite**
(Actor → Chat → Profile), its payload citing the authorizing
proposal's anchor. A recognized De-invite **bans**: a later
self-authored Participant does not re-establish membership, and
lifting the ban is its own community decision (un-ban below) —
expulsion and re-entry are symmetric acts of the chat, never a
race against the expelled. There is no admin-unilateral kick —
authority comes from the passed proposal, and the De-invite is
its materialization.

### Un-ban

Lifting a ban is a passed **`decision:lift_ban`** proposal (§5)
executed as a **proposal-backed Invitation**: a chat-authority
actor authors the Invitation (Actor → Chat → Profile), its
payload citing the authorizing proposal's anchor. Invitation is
already the "this person fits here" gesture over exactly this
incidence, and it does double duty — in a gated chat, the same
record supplies the admission backing the returning member needs.

An un-ban restores **eligibility, never membership**: the person
re-enters by authoring a new Participant strictly `≺`-following
the De-invite — nobody is silently re-added to a room they may
not want back into.

### Membership sentiment

There is no membership object to have feelings about. Personal
stances go where they belong: **Opinion → Profile** for the
person, **Opinion → Chat** for the space.

---

## 5. Chat governance

Every chat carries a **governance map** — its social contract:
per-decision eligibility, role weights, thresholds, and amendment
rules, with the default map installed in the founding payload.
The map rides the founding payload, so it changes only at
succession boundaries (§8), and the roles it names (`admin`,
`chat_mod`, `member` in the default vocabulary) are per-chat L2
state — L1 knows nothing of them.

Chat decisions run the **house governance pattern at chat scope**
([governance.md](../primitive/governance.md),
[proposal.md](proposal.md)): the proposer authors a Content
anchor (proposal text as witnessed payload) plus a `(0,0)`
Reference to the subject — the Chat, a Message, or a member's
**Profile** (scope in the anchor payload); votes are payload-marked
ballot Opinions toward the anchor, tallied by the chat's map over
the individual ballot records; the **finalization** is authored by
a chat-authority member — Opinion `(0,0)` + payload (outcome,
tally digest) toward the anchor. Every internal vote is a priced
public act.

Default map at founding:

| `action_key` | eligibility | weighting | threshold | exclude subject |
|---|---|---|---|---|
| `decision:add_member` | `role IN (admin, chat_mod)` | — (count) | 1 approver | — |
| `decision:disavow_message` | active members | `admin:5, chat_mod:3, member:1` | > 50% cast, ≥ 20% quorum | — |
| `decision:disavow_member` | active members | `admin:5, chat_mod:3, member:1` | ≥ 2/3 cast, ≥ 40% quorum | yes |
| `decision:lift_ban` | active members | `admin:5, chat_mod:3, member:1` | ≥ 2/3 cast, ≥ 40% quorum | — |
| `decision:rotate_key` | active members | `admin:5, chat_mod:3, member:1` | ≥ 2/3 cast, ≥ 50% quorum | — |
| `decision:change_role` | active members | `admin:5, chat_mod:3, member:1` | > 50% cast, ≥ 30% quorum | yes |
| ``decision:set:metadata`` | active members | `admin:5, chat_mod:3, member:1` | > 50% cast, ≥ 10% quorum | — |
| `decision:change_system_actor` | active members | `admin:5, chat_mod:3, member:1` | ≥ 2/3 cast, ≥ 50% quorum | — |

Each entry carries its own `amend` triple (default: ≥ 2/3 cast,
≥ 30% quorum, same weights) — governance of governance applies
all the way down. Role weight is never a veto: every act runs
through the weighted tally, and a community can pass any decision
without its admins.

A passed decision that changes the founding payload — metadata
(``decision:set:metadata``), the map itself (its `amend` triple),
the system-actor pointer (`decision:change_system_actor`) — is
executed by the chat's system actor as one succession act (§8).
Everything else executes as before: a chat-authority member's
De-invite or Invitation, an off-graph key run.

Gated admission approves a *Join Request*; the approval's public
record is the proposal thread itself.

---

## 6. Moderation inside the chat

The no-push principle: **the chat moves away from a message or a
member; it never moves the message or the member away.** Both
levels are ordinary chat-scope proposals (§5).

Chat-internal disavowal routes through a Proposal — the anchor's
`(0,0)` subject Reference names the target; no direct vote edge
from a member drives the outcome.

- **Level 1 — message disavowal** (`decision:disavow_message`):
  targets the Message via the anchor's `(0,0)` Reference. The
  passed proposal plus its finalization *is* the on-graph
  record of the chat's stance; the body is not removed, and a
  reader who wants disavowed content still sees it. A
  counter-proposal reverses.
- **Level 2 — member disavowal** (`decision:disavow_member`):
  targets the member's Profile, `exclude_subject = yes`. On pass,
  the chat authority executes the De-invite (§4 Kick). Escalation
  from message- to member-level is always a fresh community
  decision, never an automatic cascade.

**Coexistence with platform moderation:** the same Message can be
subject to chat-internal disavowal and Network-scope moderation
independently — chat stance vs. verdict Tag and payload removal.
Different records, different scopes, no conflict
([moderation.md](moderation.md)).

---

## 7. Encryption as the privacy mechanism

The shared graph and its witnesses never require plaintext:
**E2EE chats commit over ciphertext**. The Send's payload
envelope carries the ciphertext blob; the witness binds those
bytes; confidentiality is key custody, not record hiding
([substrate.md §7](../primitive/substrate.md#7-payload-carriage)).
Privacy is per-message — a chat can mix plaintext and encrypted
bodies freely; each body row carries a privacy flag and, for
ciphertext, the key-epoch index it was encrypted under.

### Keys, organized in epochs

A chat's lifetime partitions into key epochs, each with its own
symmetric key — counted over the **bundled lineage** (§3), never
per Chat node. **Rotation is automatic on every membership
transition** — join, leave, kick, each leg of a fork move — the
moment the fold's verdict changes; an evicted member must not be
able to block their own removal from future epochs, so rotation
is never voted. The membership transitions are public L1 records,
so the epoch index is derivable from public state — no counter is
stored anywhere. Key derivation itself is the off-graph group-key
protocol (Signal/MLS-style); CoGra does not reinvent crypto, and
picking the library is an implementation decision.

**Succession and forks.** A linear succession (§8) is
membership-preserving, so it is not a membership transition: no
rotation fires, and the key domain continues across the lineage —
same room, same keys, history stays readable. A **fork** starts a
fresh key domain: the branch begins at key epoch 1 and derives
its own keys, while the origin keeps its unchanged — members who
did not move still read its history and keep talking there. A
mover's act is a membership transition in **both** chats —
departure and arrival — advancing both key epochs; the mover must
not read the origin's later epochs, so this is cryptographically
required, not policy. For an encrypted chat a fork is therefore a
**hard history boundary**: even a perfect lineage fold cannot
show the origin's transcript to someone who joins the branch
later and was never in the origin — the bytes are under the
origin's keys, and no rule can hand them over except a member
choosing to disclose. For a fork that is the correct semantics: a
new room, a clean slate.

**Mid-epoch rotation** — e.g. after a device compromise, before
any membership change — is the one governance-routed rotation:
a `decision:rotate_key` proposal (§5); on pass, members re-run
the key update off-graph. Forward protection only: messages
under the old key stay readable to anyone who holds it.

### What members hold

- **Current members** hold the current key and those of epochs
  they were active in.
- **A new joiner** gets the current epoch onward — pre-join
  history requires an existing member to share an older key, a
  normal disclosure act.
- **Ex-members** keep the keys they held; they cannot derive any
  later one. You can leak what you saw, not what comes after.

Any member can disclose any key they hold — the system permits
this by design, and disclosure is scoped to the disclosed epoch.
Once disclosed, never un-disclosed. Disclosure changes no record
state: an encrypted message is exactly as moderatable as any
record — removal never needs plaintext — but a verdict
presupposes readers, and voting a verdict on a body one cannot
read is bad practice the community should refuse, not a rule the
system enforces ([moderation.md](moderation.md)).

### What encryption does not hide

- **Metadata is public by design** — who shares a chat with whom,
  who sent how many messages, when. CoGra deliberately does not
  hide who talks to whom.
- **Governance is public.** A chat-scope proposal's anchor and
  its `(0,0)` Reference publicly name the Chat — and, for member
  decisions, the member's Profile — even when the proposal text
  and ballot payloads ride encrypted. An E2EE chat's *decisions
  to act* are visible facts; only their content is private. This
  residue is accepted, not accidental.
- **No layer of the system is a trusted decryption party.** The
  graph holds witnesses over ciphertext; the Postgres operator
  holds ciphertext and no key.

### Searching

Plaintext bodies are searchable Postgres-side through the scoped
`chatSearch` query ([api-spec.md](../implementation/api-spec.md))
— one chat, word-level, newest first; chat messages stay out of
the global index. Encrypted bodies are never searchable
server-side.

---

## 8. Chat metadata and updates

Chat revises by **succession, never in place**
([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates)).
A chat's current metadata — name, description, image, governance
map — is **the lineage head's founding payload**; there is no
separate metadata fold and no in-place carrier.

- **An update is a succession authored by the chat's system
  actor** (§3): one act, A-leg to the current head `C_k`, T-leg
  minting the successor `C_{k+1}`, whose founding payload carries
  the new values. The founding payload is the unit of change —
  metadata, governance map, and system-actor name all change only
  at succession boundaries, one priced act per change, executing
  a passed proposal (§5). The actor authors everything inert:
  A-leg `(0,0)`, the T-leg's forced-positive coordinate at `0` —
  routing-inert under zero-is-inert
  ([feed-ranking.md §3.1](../primitive/feed-ranking.md#31-the-damped-weight)).
- **Nobody else acts.** The L2 fold bundles the linear lineage
  into one logical chat (§3): membership, messages, backing,
  bans, stances, and the key-epoch count carry forward
  automatically, and the feed ranks the lineage as one candidate
  ([feed-ranking.md §4](../primitive/feed-ranking.md#4-the-path-set)).
  Nobody re-joins, nothing re-anchors, and superseded heads stay
  published — history is public, as everywhere.
- **A succession by anyone else is a fork**, never an update: a
  new lineage whose members are exactly those who author their
  own move acts (§2) — partial adoption is a fork, not a failure,
  and nobody's community is moved by a proposer. A forking branch
  typically mints a fresh system actor in its founding payload to
  regain the update capability. The fork is also the escape from
  a frozen lineage (§3) and a hard history boundary for encrypted
  chats (§7).

**Message bodies never edit** — a Message has no cover to resolve
([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates));
a correction is the next message. Every update is a priced act;
history is public.

---

## 9. 1:1 vs group chats

**No structural difference.** A 1:1 chat is a chat with exactly
two members. No uniqueness constraint exists over member pairs —
two users may run any number of parallel chats; frontends may
hint ("you already have a chat with Alice — open it?") but the
substrate never forces a single thread. Uniformity over
special-casing.

---

## 10. Lifecycle

Nothing deletes. Chat and Message nodes persist; every
Participant, Leave, Invitation, De-invite, and Send record is
permanent; membership "state transitions" are new records read by
the fold, and the full history stays public.

Content removal is payload removal to the reduced projection,
whole-record and one-way, with the triggering flows —
moderation verdicts, the author's own per-content removal, the
author's account deletion — and the Postgres tombstone/archive
mechanics in [moderation.md](moderation.md),
[erasure.md](erasure.md), and
[retention-archive.md](../primitive/retention-archive.md).
Chat-specific facts:

- **Ciphertext is body content; keys are not.** Removal reduces
  the payload (the ciphertext); epoch keys live off-graph on
  members' devices and are not redactable PII — cryptography
  cannot forget what someone already saw, and the platform does
  not pretend to.
- **A chat is a public space, not first-person expression:**
  account deletion of the founder never sweeps the Chat; the
  member's own Messages are swept only under the content-level
  opt-in, or removed one at a time per
  [erasure.md §1](erasure.md#1-per-content-removal).
- **Disavowal is non-destructive** (§6) — stance, not removal.

---

## What this doc is not

- **Not the membership-fold definition.** The canonical fold and
  the terminality argument live in
  [layer1-interface.md §9.8](../primitive/layer1-interface.md#98-membership-proposals-and-revocation);
  this doc declares CoGra's `𝒫` on top of it.
- **Not the governance primitive.** Anchors, ballots, tallies,
  and finalization live in
  [governance.md](../primitive/governance.md) and
  [proposal.md](proposal.md).
- **Not the moderation primitive.** Network-scope verdicts and
  removal live in [moderation.md](moderation.md).
- **Not the edge catalog.** Family semantics and census pointers
  live in [edges.md](../primitive/edges.md).
- **Not the encryption protocol.** Key derivation and group-key
  update use an established open-source protocol — no custom
  crypto.
- **Not the store schemas.** Body rows, privacy flags, and
  mirror shapes live in
  [data-model.md](../implementation/data-model.md).
