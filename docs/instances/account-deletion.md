# Account deletion

A User can request that their account be removed from public
view. Account deletion is **pure L2 policy — no L1 gesture
exists for it**, and nothing on the shared graph is authored,
severed, or deleted. What it does: the identity association is
forgotten, personally-identifying content is redacted from public
surfaces via payload removal
([layers.md §5](../primitive/layers.md#5-deletion-policy)) and
Postgres tombstones, and the originals move to the
[retention archive](../primitive/retention-archive.md) so the
platform can satisfy statutory retention obligations before the
data is permanently destroyed.

What remains is exactly the **L1 husk**: an actor whose records,
standing, title, and trust edges all persist — with the names and
words gone
([substrate-map.md §1](../primitive/substrate-map.md#1-actors-and-identity)).

This doc adds the **user self-service authorization path** —
parallel to [moderation.md](moderation.md)'s community-driven
authorization for illegal content. Future triggers — court order,
next-of-kin under applicable inheritance law (e.g., § 1922 BGB in
Germany), network-admin emergency action — reuse the same
redaction scope and archive mechanism; each gets its own
authorization rules.

## 1. Two redaction levels

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
  row with the identity fields cleared and `redaction_reason`
  set; `users.username` is replaced in place with the unique
  redacted form below (the one sanctioned in-place write on the
  identity row). The prior version is archived per §3.
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
  archived per §3 because they carry their own retention clocks.

**Content-level (opt-in).** Identity-level *plus*, for each
content-carrying record the user authored — Publish (posts),
Review (comments), Send (messages):

- The record's payload is removed — body, media manifest, all of
  it, whole-record per the commitment
  ([layers.md §5](../primitive/layers.md#5-deletion-policy)) —
  and archived.
- The Postgres body version rows are tombstoned and attached
  media assets removed and archived.
- The structural records, the nodes they minted, and everything
  they do on the graph are untouched. The post still exists,
  still routes, still credits its author — only the content
  becomes unavailable.

For encrypted Messages, the payload is a ciphertext blob; the
removal is the same one-way transition as for plaintext. Chat
epoch keys are **untouched** — they live off-graph on members'
devices, and past-epoch keys held by ex-members are not treated
as redactable PII (see [chats.md §9](chats.md#9-encryption-as-the-privacy-mechanism)).

**Why identity-only is the default:** content was publicly
authored — PII control happened at write time — and mass-removing
bodies destroys other actors' record of conversations they
participated in. Content-level is the explicit choice for an
actor who later regrets what they wrote.

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

## 2. What is preserved — the husk

Account deletion never affects:

- **Records.** Every record the user authored — stances,
  memberships, publications — is permanent on the shared graph;
  so is every record others authored toward the user. Deletion
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

## 3. Retention archive

Originals — the removed payloads with their private values, the
prior profile version rows, tombstoned body version rows, and
media assets — are written to the
[retention archive](../primitive/retention-archive.md) with a
per-row legal hold appropriate to the data:

- **Ordinary profile PII** (display name, bio, avatar, cover,
  website, prior profile revisions) — typically a short or zero
  hold, expirable on user request per DSGVO storage minimization.
- **Content tied to financial transactions** (forthcoming with
  the economics workstream) — statutory retention, e.g. the
  ~10-year German tax-record hold.

Hold values are set at redaction time. The archive defines the
polymorphic schema, the per-row legal-hold-then-hard-delete
mechanism, and the `legal_admin` access path; archived payloads
stay verifiable against their records' public witnesses
([retention-archive.md §1](../primitive/retention-archive.md#1-polymorphic-shape)).

## 4. The user self-service trigger

The user-initiated path is the only trigger spec'd here. Future
triggers reuse the same redaction scope (§1) and archive (§3);
only their authorization differs.

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
4. **Execution.** At deadline, the redaction runs (§5).
   Identity-level is automatic; content-level is included only if
   the user opted in during request or confirmation.
5. **Irreversibility.** After execution, the user's PII is in the
   archive and inaccessible to public surfaces. The archive's
   hold expiry will eventually destroy it. There is **no restore
   path** post-execution — payload removal is one-way, and the
   platform commits to the redaction once executed.

The grace period exists for the same reason GDPR confirmation
patterns exist: account deletion is destructive and easy to
trigger by mistake, by client bug, or by a compromised session.
The window is short enough that public surfaces clear quickly,
long enough that an affected user typically notices.

**The L0 address stays with the person.** One account = one L0
address, self-custodied — no part of the platform holds the key
([ledger.md](../implementation/ledger.md)). Account deletion
removes CoGra's identity association but does not — and cannot —
touch the address or anything resting on it. The "no restore
path" above is about the association and the PII, not about the
person's off-platform continuity.

## 5. Write ordering across stores

Account deletion writes to three places: the retention archive
(Postgres), the payload carriage, and the public Postgres display
tables. The order matters for crash safety:

1. **Archive first.** Write the original PII — payloads, private
   values, prior rows — to the retention archive. Idempotent: the
   same request can be retried without producing duplicates (key
   on `(original_id, original_type, redacted_by)`).
2. **Payload removal.** Remove payload and private value from
   carriage for every record in scope; each record drops to its
   reduced projection.
3. **Postgres tombstone.** Write the tombstone version rows for
   the profile and (if content-level was opted into) the content
   bodies and their media attachments; delete the operational
   per-user state; forget the identity association.

Each step is retryable independently. A crash mid-flow leaves the
system in a safe state: PII is already preserved in the archive;
carriage and Postgres may be partially redacted, but never lose
data. A reconciler re-runs any incomplete redaction from the
request record.

## 6. Interaction with moderation

[Moderation](moderation.md) and account deletion both invoke the
payload-removal mechanism
([layers.md §5](../primitive/layers.md#5-deletion-policy)) but
differ in authorization, scope, and archive treatment:

|                | Moderation (illegal)                                              | Account deletion                                  |
|----------------|-------------------------------------------------------------------|---------------------------------------------------|
| Authorization  | Network governance + mod gate                                     | User self-service (with grace)                    |
| Scope          | The specific record(s) a Proposal targets                         | Registration bundle + (opt-in) all authored content |
| Archive hold   | Set asynchronously by `legal_admin` per case ([retention-archive.md §4](../primitive/retention-archive.md#4-access-path)) | Per row — short for PII, longer for financial data |
| Initiator      | Any active Network member                                         | The account owner                                 |
| Public mark    | Reduced projection + tombstone + Tag verdict                      | Reduced projection + tombstone                    |

The two paths run independently. A user under active moderation
can still request account deletion. Conversely, illegal-content
classification on a redacted user's content proceeds normally —
the content is in the retention archive, and a moderator acting
on a court order can request removal of the archive copy as well,
satisfying the destruction obligation that overrides ordinary
retention for illegal content specifically.

## What this doc is not

- **Not the redaction mechanism.** Payload removal and
  Postgres-tombstone semantics live in
  [layers.md §5](../primitive/layers.md#5-deletion-policy).
- **Not the moderation authorization.** Community-driven
  classification of illegal content lives in
  [moderation.md](moderation.md). This doc is a separate
  authorization path that happens to invoke the same mechanism.
- **Not the archive schema.** Concrete column types, indexes,
  migrations, the polymorphic shape, and the access-control shape
  under which `legal_admin` reaches the archive live in
  [data-model.md](../implementation/data-model.md) and
  [retention-archive.md](../primitive/retention-archive.md).
- **Not the future triggers.** Court order, next-of-kin
  (§ 1922 BGB), and network-admin emergency action are listed
  here as planned reusers of the redaction scope; each warrants
  its own authorization spec when designed.
