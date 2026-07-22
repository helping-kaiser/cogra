# User-initiated erasure

A User can erase their own content from public view — a single
record (§1) or the whole account (§2). Both paths are **pure L2
policy — no L1 gesture exists for erasure**, and nothing on the
shared graph is authored, severed, or deleted. The mechanism is
always the same: payload removal to the reduced projection
([layers.md §5](../primitive/layers.md#5-deletion-policy)) plus
Postgres tombstones, with the originals moved to the
[retention archive](../primitive/retention-archive.md) first —
where they sit **outside the requester's reach** under a per-row
legal hold until statutory destruction.

This doc specifies the **user self-service authorization paths**
— parallel to [moderation.md](moderation.md)'s community-driven
authorization for illegal content. Future triggers — court order,
next-of-kin under applicable inheritance law (e.g., § 1922 BGB in
Germany), network-admin emergency action — reuse the same
redaction scope and archive mechanism; each gets its own
authorization rules.

## 1. Per-content removal

The author of a record can remove its payload — one record at a
time, without touching the rest of the account. This is the
erasure path for "delete this post", "remove this message", and
"remove that old profile picture": profile content rides the
actor's Registration payloads
([nodes.md §1](../primitive/nodes.md#1-l1-node-types-the-shared-graph)),
so a superseded profile revision is an ordinary target.

- **The unit is the record.** Removal is whole-record per the
  commitment
  ([layers.md §5](../primitive/layers.md#5-deletion-policy)).
  Removing "the post" sweeps the whole revision chain — the
  genesis payload and every edit record's payload. A single
  superseded revision is also a valid target on its own: the
  old-avatar case, and equally PII edited out of a body — the
  edit blanked the current view, but the superseded payload
  stays published until removed, because edits are never erasure
  ([substrate.md §9](../primitive/substrate.md#9-node-values-and-updates)).
- **Scope: content and profile records the requesting User
  authored.** Publish (posts), Review (comments), Send
  (messages), and Registration (profile revisions). Items are
  excluded — goods are not first-person expression
  ([items.md §9](items.md#9-lifecycle)); moderation is the only
  removal trigger there. For encrypted Messages the payload is a
  ciphertext blob; the removal is the same one-way transition as
  for plaintext, and chat epoch keys are untouched
  ([chats.md §9](chats.md#7-encryption-as-the-privacy-mechanism)).
- **Immediate and permanent.** One authenticated request with an
  explicit client-side confirmation; no email round-trip, no
  grace period — proportionate for a single record, where
  account deletion's 7-day grace guards an account-wide act
  (§5). Payload removal is one-way; restoring content means
  authoring a new record.
- **Archived first, retained under hold.** The original lands in
  the retention archive before removal and stays there under a
  legal hold the requester cannot shorten (§4). Removal hides
  content from public surfaces; it never destroys evidence at
  the author's request — content that earned CGT through an
  infringing upload cannot be vanished by its author the moment
  a dispute starts.
- **The mark reads author-removed.** Reduced projection plus the
  Postgres tombstone, no verdict Tag — a reader can always
  distinguish removed-by-choice from removed-for-cause (§7).
- **Scoring-neutral, like every redaction.** The record keeps
  doing what it does — routing, standing, attribution inputs
  ([layers.md §5](../primitive/layers.md#5-deletion-policy)).
  Retracting a record's *effect* is severance, not erasure.
  Replies below a removed Comment keep their parent and stay
  readable ([comment.md §5](comment.md#5-lifecycle)).

## 2. Account deletion: two redaction levels

A User can request that their whole account be removed from
public view: the identity association is forgotten and
personally-identifying content is redacted from public surfaces.
What remains is exactly the **L1 husk**: an actor whose records,
standing, title, and trust edges all persist — with the names and
words gone
([substrate-map.md §1](../primitive/substrate-map.md#1-actors-and-identity)).

Identity-level by default, content-level on opt-in. The level
fixes *which records* the payload-removal mechanism touches; the
mechanism itself is the same one-way transition either way.

**Identity-level (default).** What is touched:

- **The identity association is forgotten.** The person ↔ actor
  map is CoGra service state, never graph state; deleting it is a
  genuine deletion of operational data. No credential CoGra holds
  links the person to the actor afterward.
- **The Registration bundle's payloads are removed.** Profile
  content — bio, display name, avatar and cover digests — rides
  the actor's Registration payloads
  ([nodes.md §1](../primitive/nodes.md#1-l1-node-types-the-shared-graph));
  removal drops every record in the bundle to its reduced
  projection, current version and prior revisions alike.
- **The Postgres profile is tombstoned** — a new profile version
  row with the identity fields cleared, `redaction_reason` set,
  and the unique redacted form below as its username value.
  Nothing is overwritten in place: the redaction is one more
  version layer marking when it happened, and the prior versions'
  values are removed and archived per §4. `users.username` is a
  derived projection of the current version
  ([layers.md §3](../primitive/layers.md#3-layers-on-overlay-nodes):
  derived caches do not layer).
- **The avatar and cover assets** in blob storage are removed and
  archived; their digests remain committed in the (now removed)
  witnessed payloads.
- **Private per-user state** (preferences, bookmarks,
  hidden-actor lists, read state) is **deleted outright** — the
  named operational carve-outs of
  [layers.md §4](../primitive/layers.md#4-layers-on-postgres-side-display-content).
  These hold no preservation value once the user is anonymized
  and carry no statutory retention obligation. Forthcoming
  economic records (transactions, payouts) will instead be
  archived per §4 because they carry their own retention clocks.

**Content-level (opt-in).** Identity-level *plus* the §1 sweep
applied to every content-carrying record the user authored —
Publish (posts), Review (comments), Send (messages): whole-record
payload removal and archiving, tombstoned Postgres body version
rows, media assets removed and archived. The structural records,
the nodes they minted, and everything they do on the graph are
untouched. The post still exists, still routes, still credits its
author — only the content becomes unavailable.

**Why identity-only is the default:** content was publicly
authored — PII control happened at write time — and mass-removing
bodies destroys other actors' record of conversations they
participated in. Content-level is the sweep for an actor who
wants everything gone at once; §1 is the targeted tool for
removing specific regretted content.

### Username post-redaction

`users.username` is `UNIQUE` in Postgres
([data-model.md](../implementation/data-model.md)). The redacted
form must therefore be guaranteed-unique, not probabilistically
unique. The user's existing UUID PK is unique by construction:

```
users.username = "redacted-user-{user_id_uuid}"
```

This preserves the column invariant, never collides, and remains
traceable to the archive row via the embedded UUID. The
user-facing display value is rendered as `[redacted user]` (or
similar) at the API layer; the storage form satisfies the
uniqueness constraint. The shared graph needs no counterpart —
no name lives on it; the actor's identifier is its address, and
what the actor *showed* was payload, now reduced.

## 3. What is preserved — the husk

No erasure path ever affects:

- **Records.** Every record the user authored — stances,
  memberships, publications — is permanent on the shared graph;
  so is every record others authored toward the user. Erasure
  authors nothing and removes nothing structural.
- **Standing and title.** The husk's standing persists — the
  vouches feeding it are *other* actors' records, and only they
  can revise them. Any title the actor holds remains in the epoch
  certificate; `owner^(k)` is untouched.
- **Counts and ranking inputs.** The user's records keep doing
  whatever they do — their stances still route, their content
  nodes still rank in others' feeds. Removing their effect would
  alter other users' record retroactively.
- **Authorship.** Author binding is intrinsic to every L1 record
  ([authorship.md](../primitive/authorship.md)); the husk is
  permanently the author of everything it wrote.
- **Chat membership.** Membership is a fold over the member's own
  Participant / Leave records
  ([substrate-map.md §4](../primitive/substrate-map.md#4-conversations-and-membership));
  deletion authors no Leave, so the fold is unchanged. A husk
  that should no longer be in a chat is the chat's call — the
  ordinary kick flow.

Mentions inside *other* users' content are not edited — those
belong to their authors. A mention of a redacted user resolves to
the redaction marker on display. This is intentional: editing
other users' content to scrub a redacted user's name would itself
be a deletion of someone else's record.

## 4. Retention archive

Originals — the removed payloads with their private values, the
prior profile version rows, tombstoned body version rows, and
media assets — are written to the
[retention archive](../primitive/retention-archive.md) with a
per-row legal hold appropriate to the data class, whichever
self-service path triggered the removal:

- **Content records** (post bodies, comments, messages, media) —
  retained under a legal hold before destruction. The hold
  follows the applicable retention ground: statutory financial
  retention where the content is tied to economic settlement —
  CGT attribution earnings, campaign payouts, marketplace flows
  (e.g. the ~10-year German tax-record hold) — and a bounded
  evidence-retention window otherwise. The requester cannot
  shorten it: removal hides, the archive remembers, and only
  hold expiry destroys.
- **Ordinary profile PII** (display name, bio, avatar, cover,
  prior profile revisions) — typically a short or zero hold,
  expirable on user request per DSGVO storage minimization.

Hold values are set at redaction time. The archive defines the
polymorphic schema, the per-row legal-hold-then-hard-delete
mechanism, and the `legal_admin` access path; archived payloads
stay verifiable against their records' public witnesses
([retention-archive.md §1](../primitive/retention-archive.md#1-polymorphic-shape)).

## 5. The self-service triggers

Two triggers are spec'd here. Future triggers reuse the same
redaction scopes (§1, §2) and archive (§4); only their
authorization differs.

**Per-content removal.** A single authenticated mutation naming
the target record — or the record plus its revision chain — from
the author's own session, behind an explicit client-side
confirmation that the removal is permanent. Execution is
immediate; there is no pending state to cancel. The API shape
lives in [api-spec.md](../implementation/api-spec.md).

**Account deletion:**

1. **Request.** The user invokes "delete my account" from the
   client. The API records the request, including whether the
   user opted into content-level redaction, and emails a
   confirmation link.
2. **Confirmation.** The user confirms via the emailed link. The
   API records the confirmed request with a 7-day deadline.
3. **Grace period.** For 7 days, the request is reversible — the
   user can cancel from any logged-in session, restoring full
   account state. Nothing is redacted yet; the request is a
   pending intent.
4. **Execution.** At deadline, the redaction runs (§6).
   Identity-level is automatic; content-level is included only if
   the user opted in during request or confirmation.
5. **Irreversibility.** After execution, the user's PII is in the
   archive and inaccessible to public surfaces. The archive's
   hold expiry will eventually destroy it. There is **no restore
   path** post-execution — payload removal is one-way, and the
   platform commits to the redaction once executed.

The grace period exists for the same reason GDPR confirmation
patterns exist: account deletion is destructive, account-wide,
and easy to trigger by mistake, by client bug, or by a
compromised session. The window is short enough that public
surfaces clear quickly, long enough that an affected user
typically notices. A single record's removal carries no such
blast radius, so §1 runs without one.

**The L0 address stays with the person.** One account = one L0
address, self-custodied — no part of the platform holds the key
([ledger.md](../implementation/ledger.md)). Account deletion
removes CoGra's identity association but does not — and cannot —
touch the address or anything resting on it. The "no restore
path" above is about the association and the PII, not about the
person's off-platform continuity.

## 6. Write ordering across stores

Every erasure writes to three places: the retention archive
(Postgres), the payload carriage, and the public Postgres display
tables. The order matters for crash safety:

1. **Archive first.** Write the originals — payloads, private
   values, prior rows — to the retention archive. Idempotent: the
   same request can be retried without producing duplicates (key
   on `(original_id, original_type, redacted_by)`).
2. **Payload removal.** Remove payload and private value from
   carriage for every record in scope; each record drops to its
   reduced projection.
3. **Postgres tombstone.** Write the tombstone version rows for
   the content bodies and their media attachments — and, for
   account deletion, the profile tombstone, the operational
   per-user state deletion, and the identity-association forget.

Each step is retryable independently. A crash mid-flow leaves the
system in a safe state: the originals are already preserved in
the archive; carriage and Postgres may be partially redacted, but
never lose data. A reconciler re-runs any incomplete redaction
from the request record.

## 7. Interaction with moderation

[Moderation](moderation.md) and the self-service paths all invoke
the payload-removal mechanism
([layers.md §5](../primitive/layers.md#5-deletion-policy)) but
differ in authorization, scope, and archive treatment:

|                | Moderation (illegal)                                              | Per-content removal                               | Account deletion                                  |
|----------------|-------------------------------------------------------------------|---------------------------------------------------|---------------------------------------------------|
| Authorization  | Network governance + mod gate                                     | Author self-service (immediate)                   | User self-service (with grace)                    |
| Scope          | The specific record(s) a Proposal targets                         | The targeted own record(s) / revision chain       | Registration bundle + (opt-in) all authored content |
| Archive hold   | Set asynchronously by `legal_admin` per case ([retention-archive.md §4](../primitive/retention-archive.md#4-access-path)) | Per data class (§4) — never requester-shortenable | Per data class (§4)                               |
| Initiator      | Any active Network member                                         | The record's author                               | The account owner                                 |
| Public mark    | Reduced projection + tombstone + Tag verdict                      | Reduced projection + tombstone                    | Reduced projection + tombstone                    |

The paths run independently. A user under active moderation can
still request erasure. Conversely, illegal-content classification
on already-removed content proceeds normally — the content is in
the retention archive, and destroying the archive copy under a
court order is `legal_admin`'s job, never a moderator's —
moderation has no authority over the archive
([retention-archive.md §4](../primitive/retention-archive.md#4-access-path)).
That destruction satisfies the obligation that overrides ordinary
retention for illegal content specifically.

## What this doc is not

- **Not the redaction mechanism.** Payload removal and
  Postgres-tombstone semantics live in
  [layers.md §5](../primitive/layers.md#5-deletion-policy).
- **Not the moderation authorization.** Community-driven
  classification of illegal content lives in
  [moderation.md](moderation.md). This doc holds the separate
  user-initiated authorization paths that invoke the same
  mechanism.
- **Not the archive schema.** Concrete column types, indexes,
  migrations, the polymorphic shape, and the access-control shape
  under which `legal_admin` reaches the archive live in
  [data-model.md](../implementation/data-model.md) and
  [retention-archive.md](../primitive/retention-archive.md).
- **Not the future triggers.** Court order, next-of-kin
  (§ 1922 BGB), and network-admin emergency action are listed
  here as planned reusers of the redaction scopes; each warrants
  its own authorization spec when designed.
