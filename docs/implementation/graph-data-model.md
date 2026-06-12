# Graph Data Model — Memgraph

This document covers the **Memgraph schema** — the graph-topology layer.

Memgraph carries the **bare minimum** needed for traversal, ranking,
governance, and authorship derivation. Everything else — display content,
counts, per-viewer operational state — lives in Postgres. The leaner the
graph stays, the better it scales. See
[architecture.md §1](architecture.md#1-graph-db-owns-topology-postgres-owns-content) for the full split.

For the conceptual model (node categories, edge dimensions, append-only
rule, junction lifecycle), see:

- [graph-model.md](../primitive/graph-model.md) — foundation
- [nodes.md](../primitive/nodes.md) — full node catalog with rationale
- [edges.md](../primitive/edges.md) — full edge catalog with the
  relationship-label scheme
- [layers.md](../primitive/layers.md) — append-only across edges,
  node properties, and Postgres-side display content

For the Postgres side, see [data-model.md](data-model.md).

---

## ID strategy

UUIDs are the shared key between Memgraph and Postgres (see
[architecture.md §2](architecture.md#2-uuids-as-the-shared-key)).
Memgraph nodes store the UUID as a `String` property named `id`. Most
node types use random UUIDs (v4); Hashtags use a content-addressed UUIDv5
so independent creations of the same hashtag converge on one node — see
[data-model.md "Node identity strategies"](data-model.md#node-identity-strategies).

---

## Node labels

Memgraph allows ad-hoc properties, but the protocol leans on declarative
constraints (uniqueness, existence) wherever the rule admits one. The shapes
below describe what each label carries and the constraints/indexes the
application relies on; rules the storage layer can't directly express
(e.g. forbidding a property by absence) are stated as ethos invariants and
enforced in code tests.

### Shared shape: layered node-property storage

Properties marked "layered" in the per-label tables below carry
history per [layers.md §3](../primitive/layers.md#3-layers-on-nodes).
Each such property `X` occupies two slots on the node:

- **`X`** — the current top-layer value. Queries, indexes, and
  uniqueness constraints read this slot directly.
- **`X_layers`** — `List<Map>` of `{value, timestamp, layer}`
  entries, ordered by `layer`. One entry per layer; the last
  entry's `value` matches `X`.

Writes append to `X_layers` and overwrite `X` atomically under
the per-node serialization discipline from
[governance.md "Tally serialization"](../primitive/governance.md#tally-serialization),
which makes `timestamp` strictly monotonic per node. A single
timestamp therefore pins the node's full state at that moment —
"read property X as-of T" scans `X_layers` for the entry with the
largest `timestamp ≤ T`. The first consumer is
[proposal.md §2 `rule_anchor`](../instances/proposal.md#2-graph-side-properties).

Redaction per
[layers.md §5 "Layer contents on node properties — redactable"](../primitive/layers.md#layer-contents-on-node-properties--redactable)
overwrites the targeted layer's `value` in place with a marker;
the entry's `timestamp` and `layer` are preserved, and `X` is
updated to the marker only if the redacted layer was the top.

Properties without "layered" in their notes (`id`,
`moderation_status` cache, `epoch`) are single-slot — no
`_layers` sibling.

### Shared shape: per-field moderation-status properties

Every content-bearing node carries one graph property per user-filled
field, holding that field's current moderation status. The shape is
identical wherever it appears: `String`, layered, default `'normal'`,
values `'normal'` / `'sensitive'` / redaction marker. `'sensitive'` is
set by a passing classification Proposal on the per-field property;
the redaction marker is written by the `'illegal'` cascade.

**Naming.** For fields with no graph-side data sibling (`bio`,
`avatar`, `content`, `description`, …), the moderation-status property
is named after the field — `User.bio`, `Post.content`, etc. — and the
property's value IS the status. For fields that already have a
graph-side data property for uniqueness or content-addressing
(`User.username`, `Collective.name`, `Chat.name`, `Hashtag.name`),
a companion `<field>_status` property carries the status; the data
property keeps its name and its current shape, and the cascade writes
to both on illegal classification.

**Node-level cache.** Every content-bearing node also carries
a `moderation_status` property — `String`, **not layered**,
default `'normal'`, values `'normal'` / `'sensitive'` /
`'illegal'` — caching the max severity across that node's
per-field statuses. The cascade writes both the targeted per-field
property and the cache atomically per
[nodes.md "Node-level cache"](../primitive/nodes.md#node-level-cache-moderation_status).
The cache is what feed-ranking and filter queries read.

See [nodes.md "Universal: per-field moderation status"](../primitive/nodes.md#universal-per-field-moderation-status)
and [moderation.md](../instances/moderation.md). Each node-label
table below lists the per-field properties and the cache with a
short "per intro" note rather than repeating the shape.

### Actor nodes

#### `:User`

| Property       | Type   | Notes |
|---|---|---|
| `id`                | String | UUID v4. Always set by the API. |
| `username`          | String | Handle for mentions/lookups. Layered per [layers.md](../primitive/layers.md). Data; per-field status carried separately by `username_status`. |
| `network_role`      | String | `'member'` or `'moderator'`. Layered. Backs platform-wide governance — see [network.md](../primitive/network.md). |
| `username_status`   | String | Per intro (status for `username`). |
| `display_name`      | String | Per intro. Content lives in Postgres. |
| `bio`               | String | Per intro. Content lives in Postgres. |
| `avatar`            | String | Per intro. Asset lives in object storage; the per-field property exists for moderation targeting. |
| `website_url`       | String | Per intro. Content lives in Postgres. |
| `moderation_status` | String | Node-level cache (per intro). |

```cypher
CREATE CONSTRAINT ON (u:User) ASSERT u.id IS UNIQUE;
CREATE CONSTRAINT ON (u:User) ASSERT u.username IS UNIQUE;
CREATE INDEX ON :User(id);
```

The `username` UNIQUE constraint applies to the property's
current value — the top layer. When an account-deletion or
illegal-content cascade redacts a User's `username`, the new top
layer takes the form `redacted-user-{user_id_uuid}`, mirroring
the Postgres tombstone (see
[account-deletion.md "Username post-redaction"](../instances/account-deletion.md#username-post-redaction)).
The embedded UUID suffix makes the sentinel unique per User by
construction, so the UNIQUE constraint holds across any number
of redactions without requiring layer-aware constraint logic.

#### `:Collective`

| Property            | Type   | Notes |
|---|---|---|
| `id`                | String | UUID v4. |
| `name`              | String | Handle, analogous to `User.username`. Layered. Data; per-field status carried separately by `name_status`. |
| `name_status`       | String | Per intro (status for `name`). |
| `display_name`      | String | Per intro. Content lives in Postgres. |
| `description`       | String | Per intro. Content lives in Postgres. |
| `avatar`            | String | Per intro. Asset lives in object storage. |
| `website_url`       | String | Per intro. Content lives in Postgres. |
| `moderation_status` | String | Node-level cache (per intro). |
| `governance`        | Map    | Primitive shape `Map<String, Rule>` per [governance.md §2.6](../primitive/governance.md#26-packaging-rules-on-a-node--the-governance-map-convention). Keys are `action_key` strings in the Collective-specific namespaces `'decision:*'`, `'actas:*'`, `'system:*'` — see [collectives.md §8 "Action keys"](../instances/collectives.md#action-keys). Layered. |

```cypher
CREATE CONSTRAINT ON (c:Collective) ASSERT c.id IS UNIQUE;
CREATE CONSTRAINT ON (c:Collective) ASSERT c.name IS UNIQUE;
CREATE INDEX ON :Collective(id);
```

### Content nodes

#### `:Post`

| Property            | Type   | Notes |
|---|---|---|
| `id`                | String | UUID v4. |
| `title`             | String | Optional. Per intro. Content lives in Postgres. |
| `description`       | String | Optional. Per intro. Content lives in Postgres. |
| `content`           | String | Per intro. Body lives in Postgres. |
| `attachments`       | String | Per intro. Covers every attached media on the post as a single status (per-attachment targeting is a future refinement — see [moderation.md §5](../instances/moderation.md#5-scope)); assets live in object storage. |
| `moderation_status` | String | Node-level cache (per intro). |

```cypher
CREATE CONSTRAINT ON (p:Post) ASSERT p.id IS UNIQUE;
CREATE INDEX ON :Post(id);
```

#### `:Comment`

Carries `id`, `content`, `attachments`, and `moderation_status`
(all per intro).

```cypher
CREATE CONSTRAINT ON (c:Comment) ASSERT c.id IS UNIQUE;
CREATE INDEX ON :Comment(id);
```

#### `:Chat`

| Property            | Type   | Notes |
|---|---|---|
| `id`                | String  | UUID v4. |
| `name`              | String  | Optional; layered. The graph carries it for routing/display hints. Data; per-field status carried separately by `name_status`. |
| `name_status`       | String  | Per intro (status for `name`). |
| `description`       | String  | Per intro. Content lives in Postgres. |
| `image`             | String  | Per intro. Asset lives in object storage. |
| `governance`        | Map     | Primitive shape `Map<String, Rule>` per [governance.md §2.6](../primitive/governance.md#26-packaging-rules-on-a-node--the-governance-map-convention). Holds the chat's social contract: who admits members, disavows messages, disavows members, rotates keys, edits display fields, changes member roles. Keys are Chat-specific `action_key` strings; per-bearer voting overrides live on `:ChatMember.voting_weight`. Layered. A default map is installed at chat founding (Chats are the one default-having consumer flagged in [collectives.md §8 "No primitive defaults"](../instances/collectives.md#no-primitive-defaults)); the default contents live in [chats.md §10](../instances/chats.md#10-moderation). |
| `epoch`             | Integer | Current chat-key epoch. Default `1`. Advanced by `+1` on every membership transition that takes effect — `:CLAIM` and `:APPROVAL` both present with positive top layers (join), or active `:APPROVAL` flipped to `dim1 < 0` (leave / disavowal cascade) — and on every passing `decision:rotate_key` Proposal. Concurrent transitions serialize per Chat. Operational counter; not layered. See [chats.md §9](../instances/chats.md#9-encryption-as-the-privacy-mechanism). |
| `moderation_status` | String  | Node-level cache (per intro) for the Chat's per-field statuses (`name_status`, `description`, `image`). |

The `content_privacy` setting (plaintext vs E2EE) lives in Postgres,
not on the graph — message bodies are always Postgres-side per
[chats.md §8-9](../instances/chats.md#8-chatmessages-as-first-class-content), so the graph never reads it.
See [data-model.md](data-model.md).

```cypher
CREATE CONSTRAINT ON (c:Chat) ASSERT c.id IS UNIQUE;
CREATE INDEX ON :Chat(id);
```

#### `:ChatMessage`

| Property            | Type   | Notes |
|---|---|---|
| `id`                | String | UUID v4. |
| `content`           | String | Per intro. Body lives in Postgres (plaintext or ciphertext per [chats.md §9](../instances/chats.md#9-encryption-as-the-privacy-mechanism)). The protocol does not gate classification on disclosure of the chat key; "moderate only after reading" is a normative requirement on moderators, not a protocol invariant — see [moderation.md §5](../instances/moderation.md#5-scope). |
| `attachments`       | String | Per intro. Assets live in object storage. |
| `moderation_status` | String | Node-level cache (per intro). |

```cypher
CREATE CONSTRAINT ON (m:ChatMessage) ASSERT m.id IS UNIQUE;
CREATE INDEX ON :ChatMessage(id);
```

The `epoch` index a ciphertext was encrypted under lives in
Postgres alongside the body row, not on the graph — message bodies
are always Postgres-side per [chats.md §9](../instances/chats.md#9-encryption-as-the-privacy-mechanism),
so the graph never reads it. See [data-model.md](data-model.md).

#### `:Item`

| Property            | Type   | Notes |
|---|---|---|
| `id`                | String | UUID v4. |
| `name`              | String | Per intro. Content lives in Postgres. (Items do not need graph-side uniqueness on `name`; the moderation-status property uses the field name directly.) |
| `description`       | String | Per intro. Content lives in Postgres. |
| `attachments`       | String | Per intro. Assets live in object storage. |
| `moderation_status` | String | Node-level cache (per intro). |

```cypher
CREATE CONSTRAINT ON (i:Item) ASSERT i.id IS UNIQUE;
CREATE INDEX ON :Item(id);
```

#### `:Hashtag`

| Property            | Type   | Notes |
|---|---|---|
| `id`                | String | UUIDv5, content-addressed from `name`. See [data-model.md "Node identity strategies"](data-model.md#node-identity-strategies). |
| `name`              | String | Canonical form: lowercase, no `#`. Immutable except via the `'illegal'` redaction cascade — see [hashtag.md §5](../instances/hashtag.md#5-lifecycle). Data; per-field status carried separately by `name_status`. |
| `name_status`       | String | Per intro (status for `name`; the only user-input field on a Hashtag). |
| `moderation_status` | String | Node-level cache (per intro). |

```cypher
CREATE CONSTRAINT ON (h:Hashtag) ASSERT h.id IS UNIQUE;
CREATE CONSTRAINT ON (h:Hashtag) ASSERT h.name IS UNIQUE;
CREATE INDEX ON :Hashtag(id);
```

#### `:Proposal`

| Property          | Type    | Notes |
|---|---|---|
| `id`              | String  | UUID v4. |
| `target_property` | String  | Name of the property on the target node, or the reserved whole-node sentinel `'node'` — see [nodes.md "Whole-node targeting"](../primitive/nodes.md#whole-node-targeting-the-node-sentinel). The `'node'` sentinel covers both the moderation cascade (every user-input field plus all attachments — see [moderation.md §5](../instances/moderation.md#5-scope)) and chat-internal disavowal — see [chats.md §10](../instances/chats.md#10-moderation). |
| `value_kind`      | String  | Shape discriminator on `proposed_value` so frontends can render the right editor / display widget without out-of-band knowledge of every `target_property`. Enumerated: `'scalar:string'`, `'scalar:float'`, `'scalar:integer'`, `'rule'`, `'composite:<action_key>'`. Set at creation; does not layer. See [proposal.md §2](../instances/proposal.md#2-graph-side-properties). |
| `rule_anchor`     | String  | **Required.** UUID of the node hosting the rule property(ies) this Proposal is governed by, per [governance.md §5 "Rule snapshot at author time"](../primitive/governance.md#rule-snapshot-at-author-time). The dispatcher reads each rule property on `rule_anchor` as-of the Proposal's authorship-edge timestamp (per [authorship.md](../primitive/authorship.md)) rather than at the current top layer, so amendments committed mid-flight don't retroactively change in-flight Proposals' rule parameters. Covers every current consumer with one value — Collective and Chat Proposals point at their host (`<host>.governance` indexed by `action_key`), Network dual-quorum moderation Proposals point at the Network (both `_quorum_fraction` and `_quorum_count` read as-of the same timestamp). Set at creation; does not layer. See [proposal.md §2](../instances/proposal.md#2-graph-side-properties). |
| `status`          | String  | Lifecycle state, and the **one layered property** on `:Proposal` (the identity properties above do not layer). Default `'open'` at creation; transitions exactly once, at threshold-cross, to a terminal value — `'passed'` (cascade applied) or `'passed_but_invariant_rejected'` (threshold crossed but a composite `_from` re-validation failed, so the target writes rolled back while the crossing vote stands). A Proposal stops accepting votes once `status ≠ 'open'`; there is no `'failed'` value (a Proposal that never crosses threshold stays `'open'` indefinitely). Doubles as the on-graph outcome record where the Proposal has no target-property layer of its own — `ChatMessage` disavowal and display-content `set:*`. See [proposal.md §2](../instances/proposal.md#2-graph-side-properties), [§6](../instances/proposal.md#6-lifecycle). |
| `proposed_value`  | Variant | The proposed new value; shape determined by `value_kind`. Common patterns: (a) **Moderation classification** (`value_kind = 'scalar:string'`). `target_property` names the per-field moderation-status property on the target node (e.g., `'bio'`, `'content'`, `'username_status'`) or the `'node'` sentinel for whole-node coverage; `proposed_value ∈ {'sensitive', 'illegal', 'normal'}`. On pass, the cascade writes the new value as a layer (for `'sensitive'` / `'normal'`) or replaces the top layer with a redaction marker (for `'illegal'`, plus archive + Postgres tombstone). See [moderation.md §1](../instances/moderation.md#1-the-two-classification-paths). (b) **Chat-internal disavowal** (`value_kind = 'scalar:string'`). `target_property = 'node'`, `proposed_value ∈ {'disavowed', 'normal'}`. The cascade writes a `dim1 < 0` (or `dim1 > 0` on reversal) layer on the relevant `:APPROVAL` edge per [chats.md §10](../instances/chats.md#10-moderation). (c) **Scalar property amendments** (`value_kind ∈ {'scalar:string', 'scalar:float', 'scalar:integer'}`). `proposed_value` is the new value of whatever graph property `target_property` names — a role string, a numeric threshold, etc. (d) **Governance-rule amendments** (`value_kind = 'rule'`). `proposed_value` is a `Rule` map of `{exec, amend}` triples per [governance.md §2.6](../primitive/governance.md#26-packaging-rules-on-a-node--the-governance-map-convention). (e) **Composite atomic changes** (`value_kind = 'composite:<action_key>'`). `proposed_value` is a handler-specific bundle with `_from` / `_to` entries per affected property; the cascade re-validates against current state and refuses on mismatch — see [proposal.md §2 "Composite proposals"](../instances/proposal.md#composite-proposals). |

The target node itself is reached via a `:TARGETS` structural edge
(`Proposal → Target`), not a foreign-key property — see
[edges.md §2](../primitive/edges.md#2-structural-edges).

`:Proposal` intentionally carries no per-field moderation
properties and no `moderation_status` cache: Proposals have no
user-authored content fields, so they fall outside the
moderation scope per
[nodes.md §"Universal: per-field moderation status"](../primitive/nodes.md#universal-per-field-moderation-status).

```cypher
CREATE CONSTRAINT ON (p:Proposal) ASSERT p.id IS UNIQUE;
CREATE INDEX ON :Proposal(id);
```

See [governance.md §2.1](../primitive/governance.md#21-subject) for the role of
Proposal nodes.

#### `:Campaign`

A funded, public request to raise a target node's reach into an
anchor's cluster — the economics primitive's advertising node. Carries
the campaign terms as scalar properties and reaches its anchor and
promoted node through `:ANCHOR` / `:PROMOTES` edges. See
[economics.md §2](../primitive/economics.md#2-the-campaign-node) and
[ledger.md "Where campaign data lives"](ledger.md#where-campaign-data-lives).

| Property                        | Type          | Notes |
|---|---|---|
| `id`                            | String        | UUID v4. |
| `D`                             | String        | Pointer to the on-chain escrow holding the deposit. The amount is read from chain, never stored on the node; funded at creation, top-up only per [economics.md §2.2](../primitive/economics.md#22-adjustability). Set at creation. |
| `g`                             | Float         | The `d(R)` decay base for this campaign's reach metric and payout split. Default `0.1`. Immutable after creation. |
| `h_start`                       | Float         | `h_anchor(target)` at `start_ts` — the baseline the `declared_goal` is measured from. Set at creation. |
| `declared_goal`                 | Float         | The `h_anchor(target)` gain the advertiser is aiming for; denominator of the default-settlement formula, so constrained `> 0`. Mutable before settlement. Layered. |
| `start_ts`                      | LocalDateTime | Campaign-window start. Set at creation. |
| `end_ts`                        | LocalDateTime | Campaign-window end. Mutable before settlement (free, unlimited extensions). Layered. |
| `status`                        | String        | Lifecycle state: `'open'` / `'settled'` / `'auto-settled'`. Layered. |
| `dust_floor`                    | Float         | The dust floor bounding path enumeration; public at creation, tuneable during the campaign as a compute failsafe. The value in force at settlement is the recorded one. Mutable before settlement. Layered. |
| `achieved_h_gain`               | Float         | Public running record of the instantaneous gain `h_anchor(target) − h_start`, one layer appended per sample over the run ([economics.md §2.3](../primitive/economics.md#23-running-progress)). Approximate progress only; the settled sustained-level value is on `:Settlement`. System-written, not advertiser-adjustable. Layered. |

```cypher
CREATE CONSTRAINT ON (c:Campaign) ASSERT c.id IS UNIQUE;
CREATE INDEX ON :Campaign(id);
```

`anchor` and `target` are not properties: the campaign reaches both
through structural edges (`:ANCHOR` → anchor, `:PROMOTES` → target),
mirroring how `:Proposal` reaches its subject via `:TARGETS` rather
than a foreign-key property. The two forbidden configurations
(`anchor == target`, negative-`h` campaigns) are ethos invariants
enforced in code, not storage constraints — see
[economics.md §2.1](../primitive/economics.md#21-success-metric-and-forbidden-configurations).

#### `:Settlement`

The terminal record of a settled `Campaign`, created once at
settlement. Carries pointers to the on-chain payout tree and the public
results as properties — never a money amount. Claimants reach it via
`:ENTITLES` / `:CLAIMS` edges. See
[economics.md §7](../primitive/economics.md#7-settlement-on-the-graph--the-claim-flow).

| Property              | Type   | Notes |
|---|---|---|
| `id`                  | String | UUID v4. |
| `distributor_address` | String | On-chain address of the claim distributor holding the payout tree. A pointer; no money on the node. Written once at settlement. |
| `merkle_root`         | String | Root of the payout tree. Per-wallet payout figures are Merkle leaves verified against it, never stored on-graph. Written once at settlement. |
| `settled_P`           | Float  | The released amount `P`, recorded as a public scalar result — never a money tensor. Written once at settlement. |
| `achieved_h_gain`     | Float  | The achieved reach gain, surfaced as a public result. Written once at settlement. |
| `settled_t_star`      | String | The attribution instant `t*` the split was computed at ([economics.md §6.3](../primitive/economics.md#63-the-attribution-snapshot-t)), recorded for reproducibility alongside the `dust_floor` in force. Written once at settlement. |

```cypher
CREATE CONSTRAINT ON (s:Settlement) ASSERT s.id IS UNIQUE;
CREATE INDEX ON :Settlement(id);
```

`:Settlement` is write-once: its properties are set together at
settlement and never amended, so none layer.

#### `:Wallet`

An account's payout wallet — a carrier node holding the account's
counterfactual self-custody on-chain address. Bound to its account by a
single `:PAYS_TO` edge; `:ENTITLES` / `:CLAIMS` and `:TRANSFERS` edges
point at it. See
[ledger.md "The Wallet node and the :PAYS_TO binding"](ledger.md#the-wallet-node-and-the-pays_to-binding).

| Property  | Type   | Notes |
|---|---|---|
| `id`      | String | UUID v4. |
| `address` | String | The account's counterfactual self-custody on-chain address. Layered per [layers.md](../primitive/layers.md): re-linking writes a new top layer non-destructively, so earning and claim history stays attached across re-links. |

```cypher
CREATE CONSTRAINT ON (w:Wallet) ASSERT w.id IS UNIQUE;
CREATE INDEX ON :Wallet(id);
```

There is exactly **one `Wallet` per account**. This is a property of
the binding edge, not a node constraint: an account has a single
`:PAYS_TO` edge to its wallet (see the edge-labels table below), and
re-linking re-layers `address` on the same node rather than creating a
second wallet.

Like `:Proposal`, none of `:Campaign` / `:Settlement` / `:Wallet` carry
per-field moderation properties or a `moderation_status` cache — they
have no user-authored fields to moderate. `Campaign` and `Settlement`
are pure record nodes; `Wallet` holds only an on-chain address. See
[nodes.md "Universal: per-field moderation status"](../primitive/nodes.md#universal-per-field-moderation-status).

### Junction nodes

All three junction types bind to their bearing actor via a
`:BEARER` structural edge — `Junction → User|Collective` — set
by the API at junction creation, never re-pointed. The Shape A
self-claim — the bearer's vote on the junction's
admit-Proposal — must come from the actor this edge points at;
mismatched claims are rejected. See
[graph-model.md §5](../primitive/graph-model.md#5-junction-node-flows)
and edge-labels table below.

#### `:ChatMember`

| Property        | Type   | Notes |
|---|---|---|
| `id`            | String | UUID v4. |
| `role`          | String | Open-ended per the chat's `governance` map. Default-vocabulary strings: `'admin'`, `'chat_mod'`, `'member'`; chats can amend `governance` entries to use any role strings. Distinct from the Network-scope `User.network_role = 'moderator'`. Layered. |
| `voting_weight` | Float  | Nullable per-bearer override of the role-derived weight (role weights live in each `Chat.governance` entry's `exec.weighting` field). When non-null, the tally reads this value directly; when null (default), the entry's role-derived weight applies. Layered. See [governance.md §2.3](../primitive/governance.md#23-weight-function). |

```cypher
CREATE CONSTRAINT ON (m:ChatMember) ASSERT m.id IS UNIQUE;
CREATE INDEX ON :ChatMember(id);
```

#### `:CollectiveMember`

| Property        | Type   | Notes |
|---|---|---|
| `id`            | String | UUID v4. |
| `role`          | String | Open-ended per the social contract: `'founder'`, `'shareholder'`, `'worker'`, `'band member'`, `'subsidiary'`, `'partner'`, `'member'`, etc. Layered. |
| `ownership_pct` | Float  | Optional; when the role implies a stake. Layered. |
| `voting_weight` | Float  | Optional override. Layered. |

```cypher
CREATE CONSTRAINT ON (m:CollectiveMember) ASSERT m.id IS UNIQUE;
CREATE INDEX ON :CollectiveMember(id);
```

#### `:ItemOwnership`

| Property | Type   | Notes |
|---|---|---|
| `id`     | String | UUID v4. |

No additional properties — transfer state lives entirely in the
surrounding edges (claim, approval, and supersession layers per
[items.md](../instances/items.md)).

```cypher
CREATE CONSTRAINT ON (o:ItemOwnership) ASSERT o.id IS UNIQUE;
CREATE INDEX ON :ItemOwnership(id);
```

#### Junction state lives in topology, not in a property

None of the three junction tables declares a `status` property — by design.
Junction state (pending / active / revoked) is derived from the two-edge
state pair's top-layer `dim1` values per
[graph-model.md §5](../primitive/graph-model.md#5-junction-node-flows). A
stored flag would be a second source of truth that could drift.

Memgraph can't directly forbid a property by absence, so enforcement is
ethos + test: the schema above is the canonical declaration of what
junction labels carry, an integration test asserts no junction ever
materializes with a `status` property, and service-layer write paths never
write one.

### System nodes

#### `:Network`

A **singleton per instance** carrying Network-level configuration —
moderation thresholds, role-change quorums, eligibility-definition
parameters. Properties are layered per
[layers.md](../primitive/layers.md); each is settable via a Proposal
targeting that property name. See
[network.md](../primitive/network.md).

| Property                          | Type    | Notes |
|---|---|---|
| `id`                              | String  | UUID v4. Always set by the API at instance bootstrap. |
| `singleton_marker`                | String  | Always `'singleton'`. Combined with the existence + uniqueness constraints below, prevents a second `:Network` node from ever being inserted. Set at bootstrap; never changes. |
| `mod_role_change_quorum_fraction`     | Float   | Fractional bar for `User.network_role` Proposals: `positive_count ≥ P × \|active members\|`. Default `0.50`. Mod-gate: critical tier (fraction of active mods). |
| `mod_role_change_quorum_count`        | Integer | Absolute bar for `User.network_role` Proposals: `positive_count ≥ K`. Default `5000`. The operative bar at tally time is `min(P × \|active\|, K)`. See [governance.md §3 "Petition-style tally and dual quorum"](../primitive/governance.md#petition-style-tally-and-dual-quorum-network-scope-only). |
| `moderation_sensitive_quorum_fraction` | Float   | Fractional bar for `'sensitive'` classification Proposals. Default `0.25`. Mod-gate: baseline tier (≥1 mod positive). |
| `moderation_sensitive_quorum_count`   | Integer | Absolute bar for `'sensitive'`. Default `5000`. |
| `moderation_illegal_quorum_fraction`  | Float   | Fractional bar for `'illegal'` classification Proposals. Default `0.50`. Mod-gate: critical tier (fraction of active mods). |
| `moderation_illegal_quorum_count`     | Integer | Absolute bar for `'illegal'`. Default `10000`. |
| `guidelines_version`              | Integer | Monotonic version of the [platform guidelines](../instances/platform-guidelines.md). Bumped by 1 on each amendment Proposal. Default `1` at bootstrap. |
| `guidelines_hash`                 | String  | SHA-256 hex digest of the canonical guidelines document at the current version. 64 lowercase hex chars. Set at bootstrap to the digest of the version-1 doc; updated together with `guidelines_version` on each amendment. |
| `guidelines_change_quorum_fraction`   | Float   | Fractional bar for guidelines amendment Proposals. Default `0.50`. Mod-gate: critical tier (fraction of active mods). |
| `guidelines_change_quorum_count`      | Integer | Absolute bar for guidelines amendments. Default `10000`. |
| `property_change_quorum_fraction`     | Float   | Fractional bar for amending baseline-bucket `:Network` properties (`moderation_sensitive_*`, `active_threshold_days`, `time_decay_half_life_days`, `distance_decay_base`, `dust_floor`, the baseline pair itself). Default `0.25`. Mod-gate: baseline tier (≥1 mod positive). See [network.md §11](../primitive/network.md#11-amending-network-parameters). |
| `property_change_quorum_count`        | Integer | Absolute bar for the same. Default `5000`. |
| `critical_property_change_quorum_fraction` | Float | Fractional bar for amending critical-bucket `:Network` properties (`mod_role_change_*`, `moderation_illegal_*`, `guidelines_change_*`, `critical_mod_gate_fraction`, the critical pair itself). Default `0.50`. Mod-gate: critical tier (fraction of active mods). See [network.md §11](../primitive/network.md#11-amending-network-parameters). |
| `critical_property_change_quorum_count` | Integer | Absolute bar for the same. Default `10000`. |
| `critical_mod_gate_fraction`          | Float   | Fraction of *active* moderators that must vote positive to open the critical-tier mod-gate on a destructive action: `mod_yes ≥ ⌈critical_mod_gate_fraction · \|active mods\|⌉`. `≤ 1`, so the bar never exceeds the active-mod count and needs no absolute floor. Default `0.50`. Critical-bucket amendable. See [governance.md §7](../primitive/governance.md#7-the-mod-gate). |
| `active_threshold_days`           | Integer | A User counts as an "active member" if they have at least one outgoing actor edge with timestamp within the last N days. Default `30`. |
| `time_decay_half_life_days`       | Integer | Half-life of the reactor-edge time-decay factor `f(Δt)` used by feed-ranking. Default `30`. Baseline-bucket amendable. See [feed-ranking.md §7.3](../primitive/feed-ranking.md#73-shape--exponential-30-day-half-life-frontend-tunable). |
| `distance_decay_base`             | Float   | Base of the path distance-decay `d(R) = base^(R−1)` used by feed-ranking. Default `0.1` (each extra hop attenuates a path's contribution by 10×). Baseline-bucket amendable; sets the network default, frontend overrides per [feed-ranking.md §4.1](../primitive/feed-ranking.md#41-path-contribution-and-distance-decay). |
| `dust_floor`                      | Float   | Dust floor `ε` bounding the branch-and-bound path enumeration in feed-ranking. Default `0` (full fidelity while the graph is sparse); raised as the graph densifies. Baseline-bucket amendable; sets the network default, frontend overrides per [feed-ranking.md §4.4](../primitive/feed-ranking.md#44-dust-floor--branch-and-bound-path-pruning). |

```cypher
CREATE CONSTRAINT ON (n:Network) ASSERT n.id IS UNIQUE;
CREATE CONSTRAINT ON (n:Network) ASSERT EXISTS (n.singleton_marker);
CREATE CONSTRAINT ON (n:Network) ASSERT n.singleton_marker IS UNIQUE;
CREATE INDEX ON :Network(id);
```

There is exactly **one** `:Network` node per CoGra instance.
Singleton enforcement combines two mechanisms:

- **Graph-side constraint.** `singleton_marker` carries a fixed value
  (`'singleton'`); the existence + uniqueness constraints together refuse
  any second insert. A second `:Network` either omits the property (fails
  existence) or carries the only legal value (fails uniqueness).
- **Application discipline.** The bootstrap migration
  ([network.md §2](../primitive/network.md#2-creation)) is the only writer;
  ordinary code paths never attempt a second `:Network`.

The instance configuration knows the singleton's `id`.

---

## Edge labels

Memgraph relationships carry exactly one label. The catalog and the rules
for picking the right one live in
[edges.md §3](../primitive/edges.md#3-edge-labels-at-the-graph-layer). Per-label assignment:

| Label          | Endpoints                                                                | Source     |
|---|---|---|
| `:ACTOR`       | User \| Collective → any node                                            | Actor sets |
| `:AUTHOR`      | User \| Collective → Post \| Comment \| Chat \| ChatMessage \| Item \| Proposal \| Campaign | Actor sets |
| `:INVITE`      | User \| Collective → invited User                                        | Actor sets |
| `:CLAIM`       | Junction → Parent (e.g. `ChatMember → Chat`)                             | System     |
| `:APPROVAL`    | Parent → Junction (e.g. `Chat → ChatMember`)                             | System     |
| `:BEARER`      | Junction → User \| Collective (e.g. `ChatMember → User`)                 | System     |
| `:CONTAINMENT` | Comment → Post / Comment / Chat / ChatMessage / Item; ChatMessage → Chat | System     |
| `:TAGGING`     | Post → Hashtag, Comment → Hashtag, Item → Hashtag                        | System     |
| `:TARGETS`     | Proposal → Target Node                                                   | System     |
| `:REFERENCES`  | ChatMessage → any node; Post → any node (except Hashtag); Comment → any node (except Hashtag) | System     |
| `:ANCHOR`      | Campaign → anchor (any actor node)                                       | System     |
| `:PROMOTES`    | Campaign → target (actor, content, or Proposal node, not Hashtag)        | System     |
| `:ENTITLES`    | Settlement → Wallet                                                      | System     |
| `:CLAIMS`      | Wallet → Settlement                                                      | System     |
| `:TRANSFERS`   | Wallet → Wallet                                                          | System     |
| `:PAYS_TO`     | User \| Collective → Wallet                                              | System     |
| `:STRUCTURAL`  | Any structural edge not in a sub-category above (e.g. `Campaign → Settlement`) | System     |

### Single-edge-label enforcement

A `(source, target)` pair carries **at most one edge label** —
actor or structural. Layers within that single label are how the
pair accumulates history; a second label between the same
endpoints is forbidden. See
[edges.md §2](../primitive/edges.md#2-structural-edges) for the
invariant, the rationale, and the cases this rule rules out
(notably the `Post → Hashtag` `:TAGGING` / `:REFERENCES` carve-out
and the parent-Collective `:APPROVAL` / `:ACTOR` collision).

Two enforcement layers:

1. **Service-layer transaction (primary).** Before any edge
   insert, the service layer reads existing edges between the
   same endpoints and rejects the write if any existing edge
   carries a different label. Returns a meaningful error to the
   caller. Same-label layerings (the normal append-only path)
   pass through.
2. **Memgraph trigger (backstop).** Detects writes that bypass
   the service layer. Indicative shape — the exact abort
   primitive depends on the Memgraph version and the
   query-modules library available:

   ```cypher
   CREATE TRIGGER unique_edge_label_per_pair
   ON --> CREATE
   BEFORE COMMIT
   EXECUTE
     UNWIND createdEdges AS new_e
     MATCH (startNode(new_e))-[other]->(endNode(new_e))
     WHERE id(other) <> id(new_e)
       AND type(other) <> type(new_e)
     // Abort the transaction. The exact call depends on the
     // procedure library — e.g. a custom mgps.assert(false, msg)
     // or a write that fails (RAISE-equivalent) — but the
     // matching condition above is the invariant's contract.
     CALL custom.abort_transaction(
       'multiple labels between same (source, target) pair forbidden')
     YIELD * RETURN *;
   ```

   Same-label layers do not match the `type(other) <> type(new_e)`
   filter and pass through unchanged.

## Edge properties

Every edge carries the same property shape, regardless of label:

| Property    | Type           | Notes |
|---|---|---|
| `dim1`      | Float          | Range `[-1.0, +1.0]`. Actor edges: signed valence (sentiment / approval / affirmation). Structural edges: typically `0`, except state-bearing pairs (junction claim/approval), where `dim1 > 0` is affirmed and `≤ 0` revoked, and `:REFERENCES` edges, which carry an author-set tensor ([edges.md §2 "Reference"](../primitive/edges.md#reference)). |
| `dim2`      | Float          | Range `[-1.0, +1.0]`. Actor edges: signed connection-weight (interest / relevance / importance). Structural edges: `0`, except the author-set tensor on `:REFERENCES`. |
| `timestamp` | LocalDateTime  | When this layer was created. |
| `layer`     | Integer        | Layer number (≥ 1). |

See [graph-model.md §4](../primitive/graph-model.md#4-edge-structure) for the edge
structure and [graph-model.md §6](../primitive/graph-model.md#6-dimension-semantics) for the
unified two-axis dimension grammar.

### System-dimension slot

Alongside the four uniform fields above, every edge carries a
**system-dimension slot** — typed, optional, per-label metadata that
ranking and traversal never read. It sits outside the `(dim1, dim2)`
tensor, so it leaves the edge-uniformity invariant untouched; it is
null on edge types that don't use it. `:TRANSFERS` is the first label
to populate it, with an on-chain transaction reference — amounts stay
on-chain and are read through the reference, never stored on the edge.
The exact column schema is deferred to the edge types that populate the
slot. See
[edges.md "System-dimension slot"](../primitive/edges.md#system-dimension-slot).

### Tensor uniformity enforcement

The [edge-tensor-uniformity invariant](../primitive/invariants.md#topology-and-visibility)
— every edge carries `(dim1, dim2, timestamp, layer)` regardless of
label — is enforced at the storage layer via per-label EXISTS
constraints. Shown explicitly for `:ACTOR`; an identical block of
four constraints applies to each remaining label in the table
above (`:AUTHOR`, `:CLAIM`, `:APPROVAL`, `:BEARER`, `:CONTAINMENT`,
`:TAGGING`, `:TARGETS`, `:REFERENCES`, `:STRUCTURAL`):

```cypher
CREATE CONSTRAINT ON ()-[r:ACTOR]-() ASSERT EXISTS (r.dim1);
CREATE CONSTRAINT ON ()-[r:ACTOR]-() ASSERT EXISTS (r.dim2);
CREATE CONSTRAINT ON ()-[r:ACTOR]-() ASSERT EXISTS (r.timestamp);
CREATE CONSTRAINT ON ()-[r:ACTOR]-() ASSERT EXISTS (r.layer);
```

Range checks on `dim1` and `dim2` (`[-1.0, +1.0]`) are not
expressible as a single existence constraint; the service layer
clamps on write and a test suite asserts the invariant
end-to-end. Memgraph's type-constraint family (where available
in the deployed version) takes care of `dim1` / `dim2` being
floats and `timestamp` / `layer` being the expected types.

---

## What is intentionally NOT in Memgraph

- **Display content** — bios, profile text, post bodies, comment
  bodies, message bodies, chat descriptions, image and video URLs.
  Lives in Postgres or media servers, linked by UUID. See
  [data-model.md](data-model.md).
- **Materialized aggregations** — counts, sums, or averages over
  edges. Derivable from graph traversal at query time. See
  [architecture.md §3](architecture.md#3-all-ranking-comes-from-the-graph).
- **Per-viewer operational state** — `user_view_log` (seen-list)
  and similar per-viewer filter data. Lives in Postgres, or wherever
  the viewing user chooses to store it. See
  [data-model.md](data-model.md).

