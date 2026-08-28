# Architecture

## Overview

CoGra is a Layer 2 service on **PeerNetworks Layer 1**: a social
platform whose binding facts — actors, content, stances, membership,
ownership — live as records on the shared L1 graph, and whose feed
ranking is driven entirely by that graph and explicit user
interactions, never AI
([substrate.md](../primitive/substrate.md)). What CoGra itself
operates is deliberately small:

- **One database.** A single PostgreSQL instance holds everything
  CoGra stores: the **record mirror** (a rebuildable cache of the
  L1 records CoGra traverses), the **overlay** (Proposal tally
  state and the network parameter carrier — caches over L1
  records and published fold rules), and CoGra's authoritative L2
  state (display content, identity association, honor ledgers,
  staged applicants, operational metadata).
  [data-model.md](data-model.md) is the schema;
  [graph-db-options.md](graph-db-options.md) records why no graph
  database is in the stack.
- **The media service** — a standalone S3-compatible object store
  holding media bytes, verifiable against the digests committed in
  payload envelopes
  ([substrate.md §7](../primitive/substrate.md#7-payload-carriage)).
  Its own service with its own volume and lifecycle: never inside
  the API process, never in Postgres. The API is a client of it
  and readers fetch from its origin directly.
- **The CGT rail** — the chain carrying CoGra's reward economy:
  balances, escrow, transfers, payouts. The graph carries pointers
  to it, never amounts ([ledger.md](ledger.md)).

Two external surfaces complete the picture. **Layer 1** accepts
CoGra's relayed records and publishes the accepted acts per epoch
in their authoritative order `𝒬_k`. **Layer 0** (Peer Attestation) is read-only: CoGra consumes
the admission balance `B_i` through L1's interface and never
authors L0 records. The two moneys never mix — admission money is
Layer 0's, reward money is CGT on CoGra's own rail.

Vocabulary used throughout: **display content** is what UIs render
(bodies, names, galleries); **operational metadata** is what
drives flows without being rendered (staging state, moderation
flags, retention bookkeeping). Both are Postgres rows. Neither is
ever what a record *is* — that is always the L1 record itself.

---

## At a glance

```
┌────────────┐   GraphQL    ┌───────────────────────────────┐
│   Client   │ ───────────► │          API (Axum)           │
│ (holds the │ ◄─────────── │   prepare · relay · serve     │
│ actor key, │              └───────┬───────────────┬───────┘
│   signs)   │                      │               │
└────────────┘              ┌───────▼───────┐  ┌────▼─────┐
                            │  PostgreSQL   │  │  Media   │
                            │ record mirror │  │ service  │
                            │ overlay + L2  │  │ (S3 API) │
                            │     truth     │  └──────────┘
                            └───────▲───────┘
                                    │ ingest accepted records
       relay proposals + approvals  │
                    ┌───────────────┴───────────────┐
                    │     PeerNetworks Layer 1      │──► B_i (Layer 0
                    │          (external)           │    export, read-
                    └───────────────────────────────┘    only)

        CGT rail (chain): reward money — the graph and the
        stores hold pointers to it, never amounts (ledger.md).
```

| Concern | Choice |
|---|---|
| Backend language | Rust — latest stable toolchain (`rust-toolchain.toml` tracks `stable`), 2024 edition |
| API | Axum + async-graphql |
| Store | PostgreSQL 16 (SQLx) — record mirror, overlay, L2 truth |
| Media | A standalone S3-compatible object store, digest-verified against payload envelopes |
| Graph substrate | PeerNetworks Layer 1, behind one interface boundary |
| Admission balance | Layer 0 export `B_i`, consume-only |
| Money store | CGT rail — on-chain ledger ([ledger.md](ledger.md)) |
| Android app | Kotlin + Jetpack Compose ([android.md](android.md)) |
| Web app | Next.js + React + TypeScript ([web.md](web.md)) |
| API contract | exported `schema.graphql` → Apollo Kotlin and GraphQL Code Generator codegen |
| Ranking core | `ranker` crate — one implementation for backend, miner, and device |
| Local dev | Docker Compose |
| CI | GitHub Actions |

---

## Repository layout

One repository holds everything: `crates/` (the Rust backend),
`android/` (the Android app — [android.md](android.md)), `web/`
(the web app — [web.md](web.md)), `docs/` (the design docs), plus
`migrations/` and `docker/`. The monorepo is deliberate:

- **One docs source.** The design docs govern backend and frontend
  alike; a second repo would mean copies that drift.
- **The `ranker` crate is a path dependency** for all three of its
  consumers — backend, miner container, Android bindings
  ([miner-api.md "Transport"](miner-api.md#transport)) — with no
  publishing step and no cross-repo versioning.
- **Contract changes are atomic.** A spec change, its backend
  implementation, the regenerated `schema.graphql`, and the client
  update land in one PR.

Assistant rules are nested: the root [CLAUDE.md](../../CLAUDE.md)
holds the shared and backend rules; `android/CLAUDE.md` and
`web/CLAUDE.md` hold the platform-specific ones.

---

## Design Principles

### 1. Layer 1 owns the graph

Every binding fact is an L1 record: priced, signed, witnessed,
epoch-stamped, visible to every other L2. Nothing CoGra stores is
authoritative about the graph — the record mirror is a cache (it
may lag, it must never diverge, it is fully rebuildable from the
published ordered sequence), and the overlay caches published fold rules
(the charter's parameter schedule, Proposal tallies,
`network_role` marks). Where a local table and the L1 record could
disagree, the record governs — and because every binding value is
recomputable from public records, a distrusting participant can
audit CoGra's reads without CoGra's help.

### 2. One store, partitioned by truth relationship

**Invariant** — the decision rule, per
[substrate.md §3](../primitive/substrate.md#3-cogras-stores):
what a record **is** lives on L1; what it **shows** lives in
Postgres; what it **weighs** is recomputed from records. Within
Postgres the schema keeps three kinds of state apart — mirror
tables (L1's truth, cached), overlay tables (CoGra's own
machinery, itself derived from public records), and authoritative
L2 tables (identity association, display content, honor ledgers,
staged applicants). Money sits in none of them; payload bytes and
salts sit in the carriage tables, and media bytes in the media
service ([data-model.md](data-model.md)).

### 3. Writes are client-signed, backend-relayed

The signing key is the actor's own, lives on the device, and never
enters CoGra custody; the backend prepares, relays, and confirms
but cannot author ([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)).
Custody exceptions — system actors and Collective co-signing — are
design facts, not conveniences
([collectives.md §2](../instances/collectives.md#2-custody),
[auth.md](auth.md)). The mechanics are [below](#the-write-path).

### 4. All ranking comes from the graph

**Invariant:** the feed is computed at query time from
viewer-rooted forward paths over L1 records — no materialized
counters, no popularity scores, no algorithm-driven signals
stored anywhere. Inbound
records never shape the viewer's feed; global statistics enter as
tie-breakers only. The algorithm belongs to
[feed-ranking.md](../primitive/feed-ranking.md); this doc covers
only where it runs (per-viewer, off the central hot path).

### 5. The seam is one boundary

All Layer 1 access — relaying signed records, ingesting accepted
records, reading the `B_i` export and the published θ price the
write-rule pre-check estimates against — flows through a single
interface in the backend. Nothing else in the codebase speaks to
the substrate. That keeps the substrate swappable behind a stable
contract (the client-direct transport of the decentralized phase
crosses the same seam — [roadmap.md](roadmap.md)) and keeps every
L1 assumption in one auditable place.

---

## Components

### `crates/api`

The public-facing binary. Responsibilities:
- Starts the Axum HTTP server
- Hosts the async-graphql schema at `/graphql`
- Hosts the GraphQL playground at `/playground` (dev only)
- Orchestrates the write path (prepare → seal → approve →
  confirm) and the read paths; owns the L1 boundary interface
- Calls `postgres-store` to fulfill resolvers
- No business logic in resolvers — it orchestrates, it does not
  decide

### `crates/l1-standin`

The substrate behind the seam until PeerNetworks Layer 1 ships
([roadmap.md "The stand-in and the swap"](roadmap.md)).
Implements the host side of the
[layer1-interface.md](../primitive/layer1-interface.md) contract —
formation checks against the edge census, the admission handshake
(verify, salt, seal; approval witness), the authoritative order and
causal keys, edge-projection maturity, the θ-debit ledger, and
epoch publication — with the two documented simplifications (money
as numbers, standing stubbed). The stand-in mirrors the substrate
contract as the L1 side defines it — where a bilaterally agreed
edition supersedes the mirrored copy, the code follows the
agreement — and enforces nothing CoGra-specific: CoGra's own
restrictions live in L2 prepare and folds, keeping the delta at
the swap as small as possible. It owns its own `l1_*` tables in
the shared Postgres instance: they play L1's role, nothing outside
the crate touches them, and the whole crate is replaced at the
swap.

### `crates/postgres-store`

The PostgreSQL access layer. Responsibilities:
- Owns the `sqlx::PgPool`
- Exposes typed Rust functions for every SQL query — mirror,
  overlay, and L2 tables alike
- All SQL strings live here, nowhere else
- Manages migrations via SQLx

### `crates/common`

Shared types with no external dependencies. Responsibilities:
- Domain model structs (record families, envelope fields, account
  state)
- Shared error types
- No database or HTTP logic

### `crates/ranker`

The feed-ranking math as a pure library: `FeedSlice` +
`RankParams` in, ordered `FeedEntry` list out — the logical
contract pinned in [miner-api.md](miner-api.md). No IO, no
connection pools, no GraphQL. It consumes raw L1 edge records and
folds per-author net stances itself
([feed-ranking.md](../primitive/feed-ranking.md)). One
implementation serves all three transport stages
([miner-api.md "Transport"](miner-api.md#transport)): linked into
`api` for the backend-direct stage, wrapped by the miner
container, and bound into the Android app via UniFFI.

### `android/`

The reference frontend — Kotlin + Jetpack Compose, with the typed
GraphQL client generated from `schema.graphql`. It holds the
member's actor key and performs both signing steps of every
write — pre-commitment and approval ([android.md](android.md)). Stack reasoning, module layout, the
UniFFI binding, and the test story live there.

### `web/`

The second frontend — Next.js + React + TypeScript, with typed
operations generated from the same `schema.graphql`. It serves
everyone the Android app doesn't reach and gives CoGra linkable,
server-rendered pages; the actor key is held in WebCrypto custody
and performs the same two signing steps ([web.md](web.md)). Stack
reasoning, contract mechanics, and the test story live there.

---

## The write path

[substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)
owns the flow's semantics — L1's admission handshake takes two
device signatures per act; this is the system view of the five
steps:

1. **Prepare** (backend). Validate the gesture against L2 policy
   and envelope conformance, pre-check the write rule (below),
   assemble the canonical proposal — act body, payload envelope,
   dependency list — and store it as a **staged write** (Postgres
   row; payload bytes ride the row until confirm promotes them
   into carriage). Return the
   proposal with its pre-digests to the client so it recomputes
   what it commits to before signing.
2. **Pre-sign** (client). The device signs the proposal
   pre-commitment; the key never leaves it.
3. **Relay and seal** (backend ↔ L1). Submit the pre-signed
   proposal through the L1 boundary; the L1 host verifies it,
   adds the projection salts, and returns the sealed **verified
   act**, stored on the staged write.
4. **Approve** (client, then backend). The device verifies the
   host seal, the exact returned body, and both commitment
   openings, then signs the **approval witness** — only then is
   the act orderable. The backend relays the approval and drives
   retries across epoch boundaries. Both signatures cover the
   act, so the relay can neither alter it nor author one unasked.
5. **Confirm** (ingestion). When the accepted act arrives in the
   mirror, the staged write is promoted: payload becomes
   permanent carriage, display rows drop their pending mark, flow
   state advances. A staged write that never completes the
   handshake and lands is garbage-collected — staged payload
   included — after a bounded number of epochs (an operational
   parameter, [data-model.md](data-model.md)).

Staged content is served, not withheld. From the pre-commitment
signature onward a staged write's display rows are readable by
everyone, carrying a pending mark until confirm
([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission));
the read paths order them ahead of the newest landed record,
since a pending write has no causal key yet.

### Atomicity

Flows that touch only L2 state run in **one Postgres
transaction** — a single commit boundary; partial-failure
choreography across stores does not exist here. Flows coupled to
an L1 record never pre-commit their effects: everything that
depends on the record landing stays staged until confirm, and
there is no distributed transaction with L1 — whether a record
lands is L1's fact alone, learned through ingestion.

### Write eligibility and account states

Prepare pre-checks the two-gate write rule over the mirror's
current state — W1 solvency, W2a the individual stamp wall, W2b
the averaged door
([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)).
A failed check is a normal, visible account state, not an auth
failure: authentication gates the *service*, write standing gates
the *graph* ([auth.md](auth.md)). The product surfaces the state
and its restoration flow — an insolvent actor (W1) restores
capacity immediately by committing burns; re-crossing the wall
(W2a) takes new burns and admissible vouch-positive connections.
Who funds the debits is economics
([economics.md](../primitive/economics.md)).

---

## The read paths

### Record ingestion (the mirror contract)

Per epoch, the backend ingests the accepted ordered act sequence
`𝒬_k` through the L1 boundary and appends it to the mirror
tables — each record with its authoritative causal key (act time,
position) — advancing a stored epoch cursor. The contract is
exactly the mirror's truth relationship: it may lag L1; it must
never diverge; it is fully rebuildable from the published
sequence, so ingestion state is never precious. Confirmation of staged writes (§ above) and overlay
fold updates (tallies, the parameter carrier, role marks) are
driven off the same ingestion pass.

### Feed query

A personalized feed splits across two locations: the central
backend serves the **data**; the viewing user's device computes
the **ranking**. The split is structural, not an optimization —
per-actor ranking cannot run on the central hot path at any real
user count
([feed-ranking.md §11](../primitive/feed-ranking.md#11-where-ranking-runs)).

1. **Slice** — the backend expands hop-by-hop from the viewing
   user over the indexed record tables, forward-only and bounded
   by the dust floor χ (weight-bounded, not hop-bounded), and
   returns the slice as raw L1 edge records per the slice contract
   ([miner-api.md](miner-api.md)), together with the viewer's
   seen-list.
2. **Rank** — the client (or a delegated miner) filters and ranks
   the slice with the `ranker` core.
3. **Render** — the client fetches display content for the top-N
   items and batches viewed IDs back to the view log on natural
   checkpoints.

The backend never ranks; ranking and filtering run on the viewing
user's side, client by default, an optional delegate miner in the
future, both running the same algorithm.

---

## Genesis bootstrap

The L1-side genesis sequence belongs to
[network.md §2](../primitive/network.md#2-creation): the genesis
L0 burn, the Genesis Moderator's Registration, the system-actor
and Treasury Registrations, the endorsement Opinions, the Charter,
and the genesis role Tag land as the instance's first accepted
records. The bootstrap is the one write that escapes the
actor-gesture-or-governance rule — the out-of-graph-authority
invariant stated there; every subsequent change runs through
governance.

The bootstrap binary performs the CoGra-side seeding around those
records: the reserved Type keys (content-addressed UUIDv5 via the
naming service — [data-model.md](data-model.md)), the operational
parameter carrier initialized from the Charter's genesis payload,
and the operator account's service rows. It also finishes the
Genesis Moderator as a **person's account** — the operator carries
every global-moderation duty until a second moderator exists, so
the account must be reachable through the product: login
credentials from `GENESIS_EMAIL` / `GENESIS_PASSWORD`, and the
custodied actor seed sealed into a standard key-backup blob whose
recovery code is printed exactly once. From there the operator
uses only ordinary flows — sign in, restore the actor with the
code ([auth.md](auth.md#key-recovery)), invite. The first invite
is staged through the ordinary invite flow once it exists
([auth.md](auth.md)), not by the bootstrap.
It is idempotent and gated on **both** sides — an instance counts
as bootstrapped only when the Charter record is in the mirror
*and* the operator's service rows exist; a re-run completes the
missing half keyed on the recorded identities and writes nothing
once both halves stand. A run interrupted inside the genesis
sequence resumes rather than replays: acts the substrate already
holds are verified identical and skipped (a sealed act's approval
is recovered from the custodied key), burns are credited at most
once, and a substrate whose stored acts differ from the genesis
input is refused as diverged.

---

## Infrastructure

Local development runs PostgreSQL via Docker Compose with named
volumes, so data persists across `make down` / `make up`
([development.md](development.md) has the commands and
environment); CI pins the same engine version, so dev and CI test
against the same store. The L1 substrate sits behind the §5
boundary in every environment.

The **media service** runs beside it as its own container — MinIO
in development, any S3-compatible store in production — with its
own volume and its own lifecycle. The API reaches it through a
`BlobStore` trait that speaks the S3 object protocol rather than
a filesystem, because that is the boundary that survives the
store leaving this machine: another host, another provider, or a
federated peer serving its own members' media. Objects are
written before the row that points at them, since an orphaned
object is collectable garbage while a row pointing at nothing is
a render that can never succeed. Storage keys are
server-generated, so nothing a client sent reaches a key and path
traversal is unrepresentable rather than defended against.
Readers fetch bytes from the media origin directly, never through
the API; in development the web dev server proxies `/media/*` to
it so a phone loads media from the same origin it already trusts.
