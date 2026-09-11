# Notifications · `spec:implementation:notifications`

A notification is a **pointer at something that already
happened** — a landed record that reached the viewer's content or
account, held as a per-viewer row so the viewer can find it
again. Nothing about a notification is authoritative: every fact
it points at lives on L1 or in the account state, and the row is
a derived convenience that can be dropped and rebuilt.

The product's primary surfacing channel is the feed
([feed-ranking.md](../primitive/feed-ranking.md)). Notifications
are the second channel and answer a different question: not *what
is worth reading* but *what happened to mine*. That split decides
the taxonomy below — a notification exists where the viewer is
the addressee of someone else's act, and nowhere else.

---

## Scope

In scope:

- What notifies, and what deliberately does not.
- The delivery channels and which of them is built.
- Where the rows live, how read state works, and how the list is
  bounded.
- The read and write contract the clients consume.

Out of scope:

- **Chat unread state.** A chat's unread mark is the read pointer
  on the conversation itself (`chat_read_state`,
  [data-model.md](data-model.md)); messages do not enter the
  notification list. A conversation carries its own place, and a
  list that also held every message would stop being a list of
  things that happened *to* the viewer.
- **Moderation and governance messaging.** A verdict on the
  viewer's content, a proposal reaching quorum, a campaign
  settling — each belongs to the surface that owns it, and each
  arrives with its own slice ([moderation.md](../instances/moderation.md),
  [governance.md](../primitive/governance.md)).
- **Operational mail.** Verification, password reset, and the
  deletion confirm link are auth's transactional mail
  ([auth.md](auth.md)), not notifications.

---

## What notifies

Seven kinds. Each is a landed act by **another actor** whose
target is the viewer's own content, profile, or application.

| Kind | The act behind it | Actor | Opening the row lands on |
|---|---|---|---|
| **Comment** | a **Review** whose target is a Post the viewer authored — the terminal leg mints the Comment ([edges.md §3](../primitive/edges.md)) | the commenter | the post, its comment sheet open on that comment |
| **Reply** | a **Review** whose target is a Comment the viewer authored | the replier | the same sheet, on the reply in its thread |
| **Mention** | a **Reference** whose target is the viewer's Profile — the target's node class is what makes the citation a mention ([api-spec.md](api-spec.md)) | the citing artifact's author | the citing post or comment |
| **Citation** | a **Reference** whose target is a Post or Comment the viewer authored | the citing author | the citing post or comment |
| **Opinion on your profile** | an **Opinion** whose target is the viewer's Profile — the gesture that makes one person follow another | the opinion's author | that actor's profile |
| **Invite landed** | a **Registration** landing an account that applied through one of the viewer's invite links ([invitations.md](../primitive/invitations.md)) | the account that landed | the new member's profile |
| **Application approved** | the inviter's priced approval of the viewer's own application ([auth.md "Approval and landing"](auth.md#approval-and-landing)) | the inviter | the inviter's profile — who vouched, and where the reciprocation the landing prompts is made |

Two properties hold across all seven and are what make the set a
set rather than a list of features:

- **Someone else acted.** The viewer is the addressee, never the
  author.
- **The act reached something of the viewer's.** A post, a
  comment, a profile, an application — a thing with an owner, and
  the owner is the viewer.

**Applicants are addressees too.** An account in the applicant
state can receive the approval notification and the opinion its
inviter authors toward its new Profile, so the list and its
affordance exist from the moment an account exists. A reader with
no account has nothing that can be addressed and no list.

### What does not notify

- **Opinions on your content.** A post or comment can collect
  opinions continuously, and a notification per opinion would
  make the list a counter of ambient sentiment rather than a list
  of things that happened. Who holds an opinion on a given post
  or comment is answered on the content itself — the same
  question the profile's opinions view answers for a person — and
  that surface is ungated: anyone can ask it of anything. The
  profile opinion stays in the set because it is the follow
  gesture: a person pointing at a person is an event, not a
  reading.
- **Anything the viewer caused.** Your own post landing, your own
  edit settling, your own application landing once your device
  has signed the Registration — the surface that ran the act says
  what became of it, at the moment it happens. A notification
  about your own act is the product telling you what you just
  did.
- **Ranking.** No notification is ever produced by the feed, a
  score, or a payout computation. The channel reports acts, and
  an act has an author who can be named.

### Anti-notification rules

- **A notification never carries content the viewer could not
  otherwise read.** Every row resolves through the ordinary
  public read path, which means a redacted subject shows its
  redaction marker like anywhere else
  ([layers.md §5](../primitive/layers.md#5-deletion-policy)).
- **A withdrawn gesture leaves its notification standing.** A
  stance netted back to `(0,0)` is a later record, not an erasure
  of the earlier one; the row reports the moment it reported and
  the subject tells the current story when opened. Rewriting
  history in the list would make the one surface whose whole job
  is *what happened* the one surface that lies about it.
- **No notification is ever an advertisement.** The channel
  carries acts addressed to the viewer; a campaign addresses an
  audience ([economics.md](../primitive/economics.md)).

---

## Delivery

**The in-app list is the channel.** One surface, reached from the
bell that sits at the right edge of the top band on every root
screen, carrying an unread dot and never a count. A count invites
the reader to clear a number; a dot says only that there is
something new, which is the whole of what the channel knows.

**Push is the second channel and is not built.** It is named here
so the model is designed for it: a push message is a *delivery*
of a row that already exists, never a source of one. The list is
complete without push, push adds nothing to the list, and a
device that has never registered for push sees the same history.
Building it adds per-device registration, the platform transports,
and per-kind delivery preferences — none of which change what
notifies.

**There is no email channel.** The mailer carries auth's
transactional mail only — verification, reset, the deletion
confirm link ([auth.md](auth.md)). Routing activity to a mailbox
would put the product's attention economy in a place the reader
cannot tune from inside the app, and would send content off the
platform to a channel with no read state.

---

## Storage and read state

### The rows are operational, per-viewer, and derived

Notification rows are **personal frontend state** in the sense
[data-model.md](data-model.md#personal-frontend-state) already
defines: per-viewer, exempt from the append-only rule that governs
graph state and display content, compactable and prunable without
a visible mark. Nothing is stored *about the graph* — the row
holds the identifiers of the record and the nodes it points at,
and every displayed fact is read through them at query time.

A notification is therefore **rebuildable**: the record mirror and
the application registry together contain everything needed to
reconstruct the set for any viewer. That is the property that
makes pruning safe and makes a notification bug a display bug
rather than a data-loss event.

**Rows are written at ingestion.** When a record lands in the
mirror, the ingestion path resolves its addressee — the author of
the Review's target, the Reference's target owner, the Profile's
owner, the invite link's issuer — and writes one row per
addressee. Writing at ingestion rather than computing the list per
read is what lets read state be per row: a row needs an identity
to carry `readAt`.

**One act, one row.** A record that reaches the viewer two ways —
a comment on your post that also mentions you — writes the row for
the more specific kind, the comment, and not the mention. Two rows
for one act would make the list report the schema instead of the
event. A record that reaches two different viewers writes one row
each, as two events.

**A record never notifies its own author.** The addressee
resolution drops the row when the addressee is the acting actor —
self-citation is already refused at the surface, but self-comment
and self-opinion are ordinary acts.

### Read state has two levels

- **Seen** clears the dot. Opening the list marks everything
  currently in it as seen; the bell goes quiet. One per-viewer
  pointer carries it, in the shape `chat_read_state` already uses
  for conversations.
- **Read** clears one row's emphasis. A row keeps a quiet unread
  emphasis after the dot has gone and loses it when the viewer
  opens that row. `readAt` on the row carries it.

The two levels exist because the bell and the list answer
different questions. The bell asks *is there anything new*, and
the honest answer stops being yes the moment the reader has
looked. The row asks *have I dealt with this*, and a reader who
scrolled past four rows to open the fifth has dealt with one
thing.

**There is no mark-all-read.** A control whose only function is to
make a list stop asking is a control for a list that asks too
much, and the dot already clears on open. If the list ever grows
loud enough that readers want to silence it in bulk, the fix is
per-kind preferences, not a broom.

### Retention

**Notification rows are kept.** No age bound, no count cap, no
pruning job: a viewer's list holds every row ever written for
them. The test phase is the wrong moment to throw rows away — a
list that quietly forgets is a list nobody can audit when the
channel misbehaves, and the volumes a bound would protect against
are volumes nobody has measured yet.

**The bound belongs to the era in which a reader owns their own
storage.** How long someone's own operational rows live is a
question about whose disk they sit on, and the answer moves the
moment the reader picks that home — a delegate, their device, this
backend. So the shape of pruning is settled there, with the reader
in it, rather than fixed now as a number nobody chose.

Nothing here is load-bearing either way. These rows are
rebuildable from the record mirror and the application registry,
they carry no history anyone is entitled to, and the acts behind
them are on the graph forever — so whatever bound eventually
arrives, adopting it is a maintenance change and never a loss.

---

## The contract

The slice's target shape, stated here and moved into
[api-spec.md](api-spec.md) when the slice builds it. It follows
the spec's own rules: private data is a field on the ordinary
`User` type resolving only for its owner, never a parallel
`me`-prefixed namespace, and the list is a Relay cursor
connection like every other list.

```graphql
"Something another actor did that reached the viewer's content,
 profile, or application. A pointer, never a copy: every displayed
 fact resolves through the record and nodes below."
type Notification {
  id: UUID!
  kind: NotificationKind!
  "Who acted."
  actor: Actor!
  "What opening the row lands on — the comment, the citing post,
   the acting actor's profile."
  subject: Node
  "The viewer's own node the act reached: the post commented on,
   the comment replied to, the profile mentioned. Null for the
   two invite-flow kinds, which reach the account rather than a
   node."
  context: Node
  "The landed L1 record behind the act — the row's traceable
   source, and where a stance row reads its pair. Null for
   APPLICATION_APPROVED, which is an account-state moment with no
   record of its own."
  record: Record
  "When the act landed."
  createdAt: DateTime!
  "When the viewer opened this row; null while unread."
  readAt: DateTime
}

"The seven addressed acts. A kind is the act plus what it
 reached, which is what a reader needs to know before opening."
enum NotificationKind {
  "A comment on the viewer's post."
  COMMENT
  "A reply to the viewer's comment."
  REPLY
  "A citation whose target is the viewer's profile."
  MENTION
  "A citation whose target is the viewer's post or comment."
  CITATION
  "An opinion whose target is the viewer's profile."
  PROFILE_OPINION
  "An account applied through the viewer's invite link and landed."
  INVITE_LANDED
  "The viewer's inviter approved their application."
  APPLICATION_APPROVED
}

type NotificationConnection {
  edges: [NotificationEdge!]!
  pageInfo: PageInfo!
  totalCount: Int
}
type NotificationEdge {
  cursor: String!
  node: Notification!
}

extend type User {
  "Acts addressed to this user, newest first. Resolves only for
   the authenticated owner; null otherwise."
  notifications(first: Int, after: String, last: Int, before: String): NotificationConnection
  "Whether anything has arrived since the viewer last opened the
   list — the band's dot. A boolean, never a count: the product
   does not ask readers to clear a number."
  hasUnreadNotifications: Boolean!
}

"Clear the dot: everything currently in the list becomes seen.
 Row read state is untouched."
type MarkNotificationsSeenPayload { hasUnreadNotifications: Boolean! }

input MarkNotificationReadInput { notification: UUID! }
type MarkNotificationReadPayload { notification: Notification! }

extend type Mutation {
  markNotificationsSeen: MarkNotificationsSeenPayload!
  "Mark one row read — the emphasis it keeps until opened."
  markNotificationRead(input: MarkNotificationReadInput!): MarkNotificationReadPayload!
}
```

`subject` is nullable for the same reason `Record.target` is: a
node the viewer can no longer reach — redacted to the reduced
projection, or not yet carried as a display row — must not fail
the row. The row still says what happened and when.

The storage shape the resolvers read, for
[data-model.md](data-model.md):

```sql
-- Per-viewer notification rows. Operational state: derived from
-- the record mirror and the application registry, prunable, never
-- authoritative (see "Personal frontend state").
CREATE TABLE user_notifications (
    id          UUID        PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    kind        TEXT        NOT NULL,
    actor_id    UUID        NOT NULL REFERENCES actors(id),
    -- The node the row opens on, and the viewer's own node the act
    -- reached. Both are bare UUIDs, as user_bookmarks is: the row
    -- points at any node class and stores no discriminator.
    subject_id  UUID,
    context_id  UUID,
    -- L1's own identifier for the causing record; null for the
    -- account-state kind.
    record_id   TEXT,
    created_at  TIMESTAMPTZ NOT NULL,
    read_at     TIMESTAMPTZ
);
CREATE INDEX user_notifications_recency_idx
    ON user_notifications (user_id, created_at DESC);

-- The seen pointer behind the bell's dot — one row per viewer,
-- UPSERTed when the list opens. Unread = a notification with
-- created_at > seen_at.
CREATE TABLE user_notification_state (
    user_id  UUID        PRIMARY KEY REFERENCES actors(id) ON DELETE CASCADE,
    seen_at  TIMESTAMPTZ NOT NULL
);
```

`created_at` is the record's landing time, not the row's insert
time, so the list orders by when things happened rather than by
when ingestion caught up.

---

## Ordering

**Newest first, one flat list, no grouping.** Every row is one
act by one actor at one moment, and the list is that sequence.

Aggregation — *three people commented on your post* — is a
compression that trades away the two things the row is for: the
actor's name and the moment. It also introduces a second read
model, because a group has to decide what makes it unread and
what opening it means. The channel is worth building flat first,
and worth measuring before deciding whether it needs compressing.

The list is paged as a cursor connection like every other list
([api-spec.md "Pagination is Relay cursor connections"](api-spec.md#pagination-is-relay-cursor-connections)).

---

## Later

Named so the model leaves room for them, and designed when they
are reached:

- **Grouping.** Aggregating same-kind, same-subject rows into one.
  Needs its own read model and its own opened-state, and needs
  volume data to justify.
- **Push.** The second channel — per-device registration, the
  platform transports, per-kind delivery choice. Delivers rows;
  never creates them.
- **Preferences.** Per-kind muting, which is the honest answer to
  a loud list and the reason no mark-all exists. It becomes real
  when a kind is loud enough to mute, and belongs with
  `UserPreferences`.
- **The kinds later slices add.** Moderation verdicts, governance
  outcomes, settlements, and chat invitations each arrive with
  the slice that owns the act. The taxonomy's rule holds for
  every one of them: another actor acted, and it reached
  something of yours.

---

## Cross-references

- [roadmap.md](roadmap.md) — slice 3.1, which builds this.
- [api-spec.md](api-spec.md) — the read and write surface the
  contract above joins.
- [data-model.md](data-model.md) — personal frontend state, the
  category the rows belong to.
- [edges.md](../primitive/edges.md) — the Review, Reference, and
  Opinion families the kinds resolve to.
- [auth.md](auth.md) — the application lifecycle behind the two
  invite-flow kinds.
- [design.md](design.md) — the band the bell sits in and the list
  conventions the surface follows.
