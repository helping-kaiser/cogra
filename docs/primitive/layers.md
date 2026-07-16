# Layers

CoGra is **append-only everywhere that matters**. Every piece of
authored or expressed state is layered rather than overwritten,
and the current state is always an interpretation — the top
layer, a declared fold — over a fully preserved history. That is
one principle, uniform across the substrate; the stores differ
only in **what they write down per change**: the shared graph
appends a whole record, CoGra's overlay appends just the changed
property value, Postgres appends a version row. Appending a
parallel record and adding a layer on a property are the same
act at different storage granularity — same result, same
intention.

---

## Append-only vocabulary

"Append-only" in CoGra names one principle in three
representations:

1. **Whole-record layers** — the shared graph's parallel records
   (§2).
2. **Per-property layers** — CoGra's overlay nodes (§3).
3. **Versioned-row Postgres display content** — see
   [§4](#4-layers-on-postgres-side-display-content).

Other docs link the word "append-only" to this section as a
shared alias.

---

## 1. Why layers everywhere

The append-only principle isn't about any one store — it's about
never erasing what was. Transparency and auditability matter more
than the convenience of being able to "delete" something.

Concrete consequences:

- You cannot hide that you disliked a post in the past; you can
  only append counter-records that change your current net stance,
  and the whole bundle stays public.
- You cannot hide that you used to be in a chat; your Participant
  and Leave records are permanent, and the membership fold reads
  them all.
- You cannot hide that your profile used to say something else; a
  profile edit is a parallel Registration record, and the prior
  payloads remain published.
- You cannot delete a message you sent; its record and witness are
  permanent. Content can leave through the authorized redaction
  paths (§5) — but only whole-record, only one-way, and never
  silently.

---

## 2. Layers on the shared graph

On L1 a layer takes the form of a **parallel record**: revising a
stance appends a new record to the author's bundle toward the
same target, and the bundle *is* that stance's layer stack — a
public `≺`-chain, no record ever deleted, merged, superseded, or
rewritten. The store appends the whole record rather than a delta,
but the read is identical to any other layer stack: the full
history is preserved, and "current" is a declared interpretation
over it — L1's own two bundle reads, or CoGra's per-surface read
rules
([graph-model.md §3](graph-model.md#3-revision-and-current-state)).
How history is *presented* — edit timelines, current-vs-past
views — is CoGra display logic derived from the bundle, never
separately stored state.

The one one-way transition a record supports is **payload
reduction** — the deletion mechanism (§5). The structural record
is invariant across it.

---

## 3. Layers on overlay nodes

Overlay nodes — CoGra's own graph state
([nodes.md §3](nodes.md#3-overlay-node-types-cogras-graph)) — can
change over time: a Proposal's tally state, a `:Network`
parameter, a CollectiveMember's role. These changes add layers to
the **specific property** that changed: instead of appending a
copy of the node with one value different, the store appends just
the changed value — a storage economy, not a different history
model.

### Per-property layering

Each layer carries `(value, timestamp)`; a property's current
value is its top layer, and history is preserved per field,
independent of other fields. Consumers can address a specific past
layer **by timestamp** — "read property X as-of T" returns the
layer on X with the largest timestamp ≤ T. Per-node serialized
writes (the discipline used in
[governance.md "Tally serialization"](governance.md#tally-serialization))
make timestamps strictly monotonic per node, so a single timestamp
pins the node's full state at that moment — no per-property index
needed. Concrete storage shape (top-layer slot + `_layers` list)
in
[graph-data-model.md "Shared shape: layered node-property storage"](../implementation/graph-data-model.md#shared-shape-layered-node-property-storage).

### What properties belong on overlay nodes

Only what CoGra's machinery **actually reads** — governed
parameters the ranker and backend consume, role state a tally
weighs, membership properties a traversal follows. Display content
(names, descriptions, bodies) lives in Postgres, not on overlay
nodes; the layering rule still applies there, as version rows
(§4).

### Derived caches do not layer

Values derived from other state are rebuilt from the source of
truth, never layered. The source of truth includes history, not
just current state — a cache may be a fold over past events
(`Chat.epoch` is one; see
[chats.md](../instances/chats.md)). Layering a cache would
duplicate history that already lives in the source data.

---

## 4. Layers on Postgres-side display content

Display content — message bodies, post text, profile text,
attachment metadata — lives in Postgres (see
[data-model.md](../implementation/data-model.md)). The same
principle in relational form: an edit writes a **new version
row**, not an overwrite. Readers see the current version by
default; past versions stay accessible to anyone who wants the
history.

Named carve-outs to append-only exist only on the Postgres side
and only for operational state, not history:

- `user_view_log` — per-viewer seen-list, operational filter
  state rather than history, compacted on a 1-year default per
  [feed-ranking.md §8.5](feed-ranking.md#94-the-already-seen-filter).
- `user_bookmarks` — per-viewer bookmark list; removing a
  bookmark is a genuine row delete.
- `user_hidden_actors` — per-viewer hide list; unhiding is a
  genuine row delete.
- `chat_read_state` — per-viewer chat-read pointer; UPSERTed in
  place as the user reads further.
- `user_preferences` — per-user settings row, overwritten in
  place; a setting's current value is operational state, not
  history.
- content–attachment junction rows — a parent's *current* gallery
  arrangement; an edit adds and removes junction rows. The assets
  themselves remain append-only.

The per-viewer entries are operational state private to the
viewer; the junction entry is arrangement, not content. Additions
to this list require a named exception added here.

Implementation specifics (schema, version columns, how queries
pick the current version) belong in
[data-model.md](../implementation/data-model.md). The **rule**
lives here: Postgres display content is append-only too.

---

## 5. Deletion policy

### Redaction vs severance — two different vocabularies

**Invariant:** Redaction and severance describe two different
mechanisms with two different scopes; they are not interchangeable.

- **Redaction** — removal of *content* from a record under the
  authorization paths below. Whole-record, one-way, leaves the
  visible mark described in this section.
- **Severance** — an author netting their own stance bundle toward
  a target to `(0, 0)` by appending counter-records — routing-inert
  in the endorsement-flow projection and the write-side act every
  consumer respects
  ([graph-model.md §3](graph-model.md#3-revision-and-current-state),
  [feed-ranking.md](feed-ranking.md)). Touches no content; each
  counter-record is itself a priced act.

This section covers redaction only. "Takedown" is not a CoGra
term — older drafts used it as a synonym for redaction; sweep it
in favor of "redaction" wherever encountered.

### Payload removal — the redaction mechanism

Every L1 record carries a payload projection — the content bytes —
and presents in two projections, **full** and **reduced**
([layer1-interface.md §8.3](layer1-interface.md#83-the-edge-record-and-payload-carriage)).
Redaction is **payload removal**: the payload and the private
value beside it are removed from carriage, and the record drops to
its reduced projection. Three L1 facts fix the mechanism's shape:

- **Removal erases, never rewrites.** The content commitment is
  binding — no second payload is consistent with it — so a record
  can lose its content but never carry substituted content
  (`post:graph:separable-edge-commitment`). Redaction granularity
  is therefore **the record**: there is no partial rewrite, no
  per-field marker, no edited-down version.
- **The transition is monotone.** Payload state moves full →
  reduced only (`def:graph:payload-state`). Redaction is
  irreversible by construction; restoring content means authoring
  a new record.
- **Removal is scoring-neutral.** The reduced projection carries
  the entire L1 closure surface — standing, title, weights, and
  epoch replay are bit-identical across full and reduced
  (`prop:graph:payload-state-invariance`). Redaction never
  changes what a record *does*; it changes what it *shows*.

**Who removes.** L1 places removal authority with the record's
author (for hyper-edge terminal legs, the initiating actor —
`def:graph:payload-controller`). CoGra runs the
carriage-obligation shape of `rem:graph:payload-custody-phases`
ahead of decentralization: Layer 1 tracks only the witness, while
payload and private value live in CoGra's carriage, and CoGra as
the carriage service also executes removals under its published
policy — the authorization paths below. CoGra exposes no other
removal path.

**The visible mark.** The invariant "never erase silently" is
carried by the pair the substrate leaves behind: the **immutable
structural record** — author, endpoints, time, witness, all
permanent and public — plus the **monotone reduced-only payload
state**. Anyone can see that a record existed, who authored it,
and that its content was removed and can never be quietly
replaced.

### Postgres and media surfaces

Redaction touches every surface the content lives on, in the same
action:

- The Postgres display row is **tombstoned** — a new version row
  marking the removal, `redaction_reason` set. The tombstone
  itself stays.
- Media assets in blob storage are removed. Their digests remain
  committed in the witnessed envelope, so the removal is publicly
  evident — a digest that no longer resolves — rather than silent.
- Each redacted original is moved to the
  [retention archive](retention-archive.md) with a per-row legal
  hold; archive content is hard-deleted at hold expiry
  (immediately in cases like content that is illegal to retain at
  all).

Implementation specifics belong in
[data-model.md](../implementation/data-model.md).

### Scope of the invariant

Three surfaces, three rules:

- **The shared graph: no record is ever removed.** There is no
  API path, no admin escape hatch, no court-order path that
  deletes a record. The only permitted transition is the payload
  reduction above, and it leaves the structural record intact.
- **CoGra's stores: almost nothing is removed.** The overlay is
  append-only layered (§3); the mirror is a rebuildable cache of
  L1 records; Postgres display content is append-only versioned,
  with redaction tombstones that themselves stay. The named
  carve-outs (§4) are limited to per-viewer operational state and
  arrangement rows.
- **Frontends, miners, indexers, and off-graph systems: not
  governed by this invariant.** Whatever they cache, summarize,
  or discard is their concern. The shared graph is the canonical
  record; downstream consumers keep or drop their copies on their
  own contracts.

"Deletion" in CoGra always means payload removal to the reduced
projection plus the Postgres tombstone — nothing else.

### The operating principle

**Invariant:** No silent deletion. Every redaction leaves a
visible record that the change happened — the reduced projection
on the graph side, the tombstone version row on the Postgres
side. A reader can always tell that something was there and was
removed, even when they cannot see the original content.

Community-level mechanisms (severance, down-ranking, social
feedback) handle most bad content without invoking redaction. The
exception exists because append-only alone cannot solve "this
content is still illegal and still findable."

### Authorization paths

This section defines the redaction *mechanism*; the
*authorization* — who decides what gets redacted, by what process
— runs through separate instance docs by scope. Two paths exist
today:

- **Illegal content.** Network-level governance per
  [moderation](../instances/moderation.md): any User can author a
  Proposal classifying a record as `'illegal'`; threshold-cross
  requires the critical-tier mod gate and a community quorum, and
  the verdict is materialized by the moderation system actor. The
  cascade then executes the redaction defined above.
- **Personal data on user request.** A User can request that
  their own account be removed from public view, per
  [account-deletion](../instances/account-deletion.md) —
  identity-level by default, content-level on opt-in.

External pressure (court orders, legal demands) does not bypass
the moderation mechanism; the principle that all external demands
enter as ordinary Proposals lives in
[governance.md §7 "External demands enter as Proposals"](governance.md#external-demands-enter-as-proposals).
Court-ordered user-anonymization is a separate path planned in
account-deletion.md, also routed through Proposals.

Disposition of the redacted original (preserve vs. destroy) is
the same mechanism in both paths — the
[retention archive](retention-archive.md) — with per-row hold
values set per case.

### Side note on long-term storage

Growth concerns live per store. The shared graph's record growth
is L1's own concern — every record is priced, so volume has a
floor cost. CoGra's overlay layers and Postgres version rows grow
with use, but typical behavior bounds them tightly: properties
change rarely, and the cases with genuine accumulation are
precisely the ones where preserving the full history is the
value. Compaction-friendly approaches that don't break the
no-silent-deletion principle (e.g., a rollup summarizing a window
of past versions while leaving a visible marker) are an
implementation-time decision contingent on real data, not a
design-time one.
