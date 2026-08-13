# CoGra Docs

CoGra is a Layer 2 on the **PeerNetworks Layer 1** substrate;
[`primitive/layer1-interface.md`](primitive/layer1-interface.md) is
the binding L1 → L2 contract.

## Layers

- **[`primitive/`](primitive/)** — what the graph IS and how it
  BEHAVES. The rules, mechanisms, and catalogs that describe the
  foundation independent of any specific use case.
- **[`instances/`](instances/)** — concrete applications of the
  primitive. Always reference `primitive/` for mechanics; only
  contain what's specific to that use case.
- **[`implementation/`](implementation/)** — system and code-level
  concerns: Postgres schema, dev commands, deployment, API spec.

[`open-questions.md`](open-questions.md) lives at the root of
`docs/` because it's cross-cutting — unresolved design questions
span all three layers.

## Suggested reading order

1. [`primitive/substrate.md`](primitive/substrate.md) — then
   [`primitive/graph-model.md`](primitive/graph-model.md) — for the
   foundation.
2. Any [`instances/`](instances/) doc to see the primitive applied
   (chats and collectives are the most worked-out examples).
3. Other [`primitive/`](primitive/) docs (governance, edges,
   layers, …) as the need arises.
4. [`implementation/`](implementation/) when getting ready to
   write code.

## Layer rule

When a new doc is added or content shifts, ask: **does this
describe the graph itself, an application of it, or how it runs?**
The answer puts it in exactly one folder. A new mechanism inside
an `instances/` doc is a sign the mechanism belongs in
`primitive/` — move it.

## Index

### `primitive/`

- [layer1-interface](primitive/layer1-interface.md) — the binding
  PeerNetworks Layer 1 → Layer 2 contract (derived reference, hard
  facts only): boundary predicate, admission rules, kernel data
  model, published constants.
- [substrate](primitive/substrate.md) — the L2-on-L1 flow: the
  layer stack, the boundary, CoGra's stores, the gesture pattern,
  the mechanism menu, system actors.
- [substrate-map](primitive/substrate-map.md) — per-concept routing
  table: where every CoGra concept lives on the substrate.
- [graph-model](primitive/graph-model.md) — how graph state
  behaves: record model, causal time, revision and folds,
  directionality, mirror + overlay.
- [governance](primitive/governance.md) — weighted role-based voting
  primitive: five components, the one L1 ballot shape, sticky
  outcomes, Proposal nodes, multi-candidate decisions.
- [nodes](primitive/nodes.md) — node catalog: the L1 node types
  CoGra's concepts resolve to, plus CoGra's overlay node types.
- [edges](primitive/edges.md) — edge catalog: the L1 families
  CoGra authors as gestures, plus the overlay edges.
- [layers](primitive/layers.md) — append-only across whole-record
  layers, per-property overlay layers, and versioned display-content
  rows; deletion policy.
- [retention-archive](primitive/retention-archive.md) — universal
  disposition for redacted originals; per-row legal hold;
  statutory hard-delete on expiry; legal-admin access path.
- [feed-ranking](primitive/feed-ranking.md) — ranking algorithm.
- [notation](primitive/notation.md) — the L1 / CoGra symbol split:
  which ledger owns which glyph, plus the CoGra symbol index.
- [authorship](primitive/authorship.md) — authorship as intrinsic
  to every L1 record: part of the act identity, never derived;
  node creators fixed at genesis.
- [economics](primitive/economics.md) — pull-marketing campaigns:
  graph-computed campaign value `V` from viewer weights, per-path
  Shapley payout, advertiser-discretionary settlement, the payout
  flow; no AI, no economics→ranking feedback.
- [token](primitive/token.md) — the CGT token: genesis pre-mint on
  a scheduled decaying release, burn-as-destruction, protocol-owned
  liquidity; never feeds ranking.
- [invitations](primitive/invitations.md) — two-edge onboarding
  pattern for new actors.
- [network](primitive/network.md) — the global community of all
  users on an instance; `network_role` (member / moderator);
  genesis-mod bootstrap; Proposal-driven mod role changes
  (mod-gate + dual quorum).
- [user](primitive/user.md) — per-node doc for the User actor
  node; on-behalf-of distinction with Collective; creation,
  edges, network membership, lifecycle.
- [invariants](primitive/invariants.md) — thin index of the
  load-bearing protocol invariants; each entry links into the
  owning doc's `**Invariant:**` call-out, which is canonical.

### `instances/`

- [chats](instances/chats.md) — chats and ChatMessages as
  first-class public content; E2EE privacy of content only;
  message + member disavowal.
- [collectives](instances/collectives.md) — collectives as actors;
  social-contract governance with example configurations
  (corporate, household, co-op).
- [items](instances/items.md) — items as content; the Bid →
  Accept → Ratify settlement handshake; consume-only title
  certificate `owner^(k)`; single-owner invariant.
- [moderation](instances/moderation.md) — `sensitive` as a
  read-side flag plus the `(0,0)` verdict Tag; `illegal` as
  whole-record payload removal to the reduced projection; reports
  as Proposals on the graph;
  mod-vote-required-for-every-classification gate.
- [platform-guidelines](instances/platform-guidelines.md) — the
  normative document the Network references when classifying
  content; bucket contents; amendment procedure pinned by the
  governed version + SHA-256 hash pair.
- [erasure](instances/erasure.md) — user-initiated erasure:
  per-content removal (single record or revision chain, immediate,
  archived under legal hold) and account deletion
  (identity-default, content-opt-in, 7-day grace); reuses
  redaction mechanism + archive primitives.
- [post](instances/post.md) — per-node doc for the Post content
  node; primary public-content surface; creation, edges,
  authorship, lifecycle.
- [comment](instances/comment.md) — per-node doc for the Comment
  content node; universal threading primitive that attaches to
  Post, Comment, Chat, ChatMessage, or Item.
- [hashtag](instances/hashtag.md) — per-node doc for the Hashtag
  topic node; content-addressed UUID makes creation implicit
  and federation reconciliation-free.
- [proposal](instances/proposal.md) — per-node doc for the
  Proposal carrier node; subject carrier for property-level
  governance votes (target, target_property, value_kind,
  proposed_value, rule_anchor).

### `implementation/`

- [roadmap](implementation/roadmap.md) — living sequencing plan:
  the L1 stand-in and its swap, vertical slices from the seam
  through the CGT rail and flows (each hand-testable), staged
  workstreams with their gates.
- [architecture](implementation/architecture.md) — system design
  around the L1 seam: external surfaces, stores, write and read
  paths.
- [data-model](implementation/data-model.md) — the Postgres schema:
  display content, the L1 record mirror, overlay and operational
  tables.
- [development](implementation/development.md) — local setup,
  tools, workflows.
- [api-spec](implementation/api-spec.md) — backend GraphQL spec:
  type system, queries (read surface), and mutations (the
  prepare → pre-sign → seal → approve → confirm write surface).
- [miner-api](implementation/miner-api.md) — the off-backend ranking
  surface: subgraph slice in, ordered feed out.
- [auth](implementation/auth.md) — server-side credentials,
  invitation-based registration, JWT access + Postgres refresh
  tokens, sessions.
- [design](implementation/design.md) — the design system both
  clients implement: the orange-led Material 3 palette and how
  it is generated, Figtree and the type scale, shape, motion,
  the shared component inventory, copy rules, the stance
  control, and the mark.
- [android](implementation/android.md) — the Android app: Kotlin +
  Jetpack Compose, Apollo Kotlin codegen off the exported
  `schema.graphql`, the `ranker` core via UniFFI, module and test
  layout.
- [web](implementation/web.md) — the web app: Next.js + TypeScript,
  Apollo Client with types generated off the same `schema.graphql`,
  server-rendered pages for shareable links, the `ranker` core via
  Wasm.
- [graph-db-options](implementation/graph-db-options.md) — why the
  graph state lives in Postgres and no graph database is in the
  stack; alternatives considered.
- [ledger](implementation/ledger.md) — the CGT rail on the Liquid
  Network: the issued asset, timelocked release tranches, the
  covenant order ladder, batched push payouts, campaign escrow,
  tipping, the marketplace rail, the reserve conversion, and
  device-held keys.

### Cross-cutting

- [open-questions](open-questions.md) — consolidated index of
  unresolved design calls.
