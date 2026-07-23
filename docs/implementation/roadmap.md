# Implementation Roadmap

This is the living sequencing plan for building CoGra as a Layer 2 on
PeerNetworks Layer 1: backend, API, miner transport, Android, and the
CGT rail. It records *what order* we build in and *why*; the *what*
of each surface lives in its own doc. Update this file as slices land
or the plan shifts.

## How we build

- **Vertical slices, not horizontal layers.** Each slice is a thin
  cut that runs end to end and produces something a human can
  exercise — not "all the types, then all the resolvers."
- **Every slice ships tested.** Unit and integration tests land with
  the code, not after ([CLAUDE.md](../../CLAUDE.md) — never skip
  tests). Pure logic (notably the `ranker`) is built as I/O-free
  crates so it tests in isolation.
- **Coverage fights the modular pieces.** Happy-path-only is not
  acceptable. Every public function, every error branch, every
  idempotency/retry path, every constraint and upsert arm, and every
  invariant the schema cannot enforce as a constraint carries a test
  that exercises it. A test that only proves the success path leaves
  the skipped branch unverified — and the skipped branches are where
  the bugs hide.
- **Every slice is hand-testable.** Beyond CI, each slice leaves the
  author able to drive it by hand — GraphiQL/curl early, the Android
  app from slice 1 on. The point is to feel whether the direction is
  right before building on top of it.
- **Docs are canonical; we fix, not paper over.** When a slice
  reaches a spec that contradicts itself, can't be coded, or
  disagrees with another doc, we fix the doc in the same work — never
  route around it silently.
- **The boundaries hold throughout.** Nothing outside L1 is
  authoritative about the graph — the record mirror and every
  operational cache are rebuildable projections
  ([architecture.md](architecture.md)). Money lives on the CGT rail
  and in Layer 0's admission economy; the graph carries pointers,
  never amounts. No AI in ranking or economics. These are not phased
  in — they are true from the first slice.
- **Everything crosses the seam.** All substrate access goes through
  the single L1 interface boundary
  ([architecture.md](architecture.md)). Slices build against that
  contract, never around it — that is what makes the substrate
  swappable.

## Where the code stands

The running code predates the L1 rebase: registration, login and
sessions, post/comment authoring with a chronological listing, the
exported `schema.graphql`, and the Android thin client (login +
profile) — all server-authored against the retired dual-store
design. The code phase starts by separating this into L1-role code
(superseded by the substrate and its stand-in) and L2 code (candidate
for reuse); how much is salvageable is discovered slice by slice, not
decided upfront.

## The stand-in and the swap

Until PeerNetworks Layer 1 ships, the backend runs an **L1 stand-in**
behind the interface boundary: an implementation of the
[layer1-interface.md](../primitive/layer1-interface.md) contract with
money simplified — the `B_i` surface and θ-debits honored as numbers,
without a real Layer 0 economy behind them.

Because every slice builds against the contract, the real substrate's
arrival is a **swap, not a slice**: when L1 is available, the
stand-in is replaced behind the seam and no slice reopens. The swap
is event-driven — it happens when L1 ships, wherever the slice plan
stands.

## Slices

Each slice is one logical step. Order is dependency-driven: the seam
first because everything consumes it, onboarding next because every
write needs a landed, funded actor with a device-held key.

### Slice 0 — The seam and the stand-in

- The single L1 interface boundary in the `api` crate — prepare,
  the two relay legs (seal, approve), ingest, and the `B_i` read
  ([architecture.md](architecture.md)) — with the stand-in behind it.
- Record mirror tables, ingestion, epoch cursor
  ([data-model.md](data-model.md)).
- Genesis: the L1-side genesis sequence against the stand-in + the
  CoGra-side bootstrap binary
  ([architecture.md](architecture.md#genesis-bootstrap)).
- **Hand test:** submit a signed record through the boundary, watch
  ingestion land it in the mirror.
- **Surfaces:** backend.

### Slice 1 — Onboarding and client-signed writes

- The staged-applicant flow end to end: invite link → application
  with the on-device key ceremony (actor key + L0 address +
  recovery-code offer) → funding burn → staged Registration signed
  (both handshake steps) on next open → landing ([auth.md](auth.md)).
- Login, sessions, credentials — the L2 half.
- The write path: prepare → pre-sign on device → seal → approve
  on device → confirm ([architecture.md](architecture.md)).
- Android from the start: the actor key lives on the device, so the
  client is not optional here — key ceremony, signing, login
  ([android.md](android.md)).
- **Hand test:** take an invite link all the way to a landed, funded
  actor; sign a write from the phone.
- **Surfaces:** backend, API, Android.

### Slice 2 — Content

- Publish and Review authoring through the write path, payloads in
  the Peer Content Envelope, display content in Postgres
  ([post.md](../instances/post.md),
  [comment.md](../instances/comment.md),
  [data-model.md](data-model.md)).
- Chronicle reads (`records`), node reads, and a chronological
  listing — deliberately **not** the ranked feed, so this slice
  doesn't block on the ranker.
- **Hand test:** post from the phone, read it back.
- **Surfaces:** backend, API, Android.

### Slice 3 — The ranker and the feed

- Slice extraction over the record mirror — cone/slice traversal
  hop-by-hop in Rust ([architecture.md](architecture.md)).
- The `ranker` crate: pure feed-ranking math, no I/O, one
  implementation for every transport stage.
- `feedSlice` and `feed` on the backend; the `rank` operation hosted
  **backend-direct** — the first transport stage
  ([miner-api.md](miner-api.md)).
- The rollout then continues along the same contract: the miner
  container (a delegated service), then on-device via UniFFI — the
  decentralized end state. No stage changes the slice-in,
  ordered-list-out shape.
- **Hand test:** ranked feed on the device; later, the same feed
  ranked by the container and on-device.
- **Surfaces:** backend, API, miner transport, Android.

### Slice 4 — Governance

- Proposal anchoring (Content anchor + `(0,0)` Reference), L1
  ballots, finalization, and the scope's executing authority
  ([proposal.md](../instances/proposal.md),
  [governance.md](../primitive/governance.md)).
- Fold caches: Proposal state, the network parameter carrier, role
  marks ([data-model.md](data-model.md)).
- **Hand test:** raise a proposal, vote, watch it finalize and the
  parameter change land.
- **Surfaces:** backend, API.

### Slice 5 — Collectives and chats

- Collective founding, membership folds, collective-scoped
  governance; backend key custody as the documented stopgap
  ([collectives.md §2](../instances/collectives.md)) — the
  member-held splits are the Q30-gated workstream below.
- Chats: creation, membership flows, messaging, E2EE with client-side
  keys ([chats.md](../instances/chats.md)).
- **Surfaces:** backend, API, Android.

### Slice 6 — The CGT rail

- Liquid asset issuance and the pre-minted timelocked tranches
  ([ledger.md](ledger.md)).
- The covenant order ladder and its published anchor fold — the
  rail's novel engineering, accepted knowingly; expect calibration
  work here.
- Campaign escrow, settlement, batched push payouts, and the
  conversion line.
- Rail keys ride the existing recovery-code/blob story; LWK is
  verified as the wallet kit when this slice starts
  ([ledger.md](ledger.md)).
- **Hand test:** fund a campaign, watch settlement pay every earner.
- **Surfaces:** rail, backend, API.

### Slice 7 — CGT flows: tipping and the marketplace

- Tipping: the rail-transfer-plus-public-stance flow —
  payout-address resolution, the device-signed explicit transfer,
  `prepareTip` staging the Opinion with the transaction pointer,
  the no-payout-address prompt ([ledger.md](ledger.md),
  [api-spec.md](api-spec.md)).
- Marketplace: the asking price through the Item edit fold;
  fund-at-Bid with the escrow pointer on the Bid; the
  fixed-destination two-branch purchase covenant, released against
  the epoch certificate, refunds on the attestation sweep
  ([ledger.md](ledger.md), [items.md](../instances/items.md)).
- No fee lines on either flow — protocol income stays at the ladder
  gate ([economics.md §7](../primitive/economics.md#7-the-conservation-equation)).
- **Hand test:** tip a post and see the public stance land with its
  pointer; buy an Item end to end — fund, bid, accept, ratify,
  title moving at the boundary, the covenant paying out.
- **Surfaces:** rail, backend, API, Android.

### Slice 8 — Erasure and moderation plumbing

- The retention archive with per-row legal holds; archive-first
  redaction ordering and the reconciler
  ([retention-archive.md](../primitive/retention-archive.md),
  [erasure.md](../instances/erasure.md)).
- `removeContent` per-content erasure; account deletion with the
  7-day grace ([erasure.md](../instances/erasure.md)).
- Moderation: verdict Tags, payload removal, read-side flags
  ([moderation.md](../instances/moderation.md)).
- **Hand test:** remove your own post; watch the tombstone appear and
  the archive row land.
- **Surfaces:** backend, API, Android.

## Staged workstreams

On the roadmap but outside the slice order; each names its gate.

- **Custody splits** — the member-held 2-of-2 co-signing of
  [collectives.md §2](../instances/collectives.md). Sequenced behind
  the [open-questions.md Q30](../open-questions.md#q30--l1-key-model-signature-scheme-and-actor-key-rotation)
  answers; until the splits ship, backend custody is the stopgap.
- **Client-direct transport + mirror independence** — the
  decentralized phase: the device submits its signed records to L1
  itself and verifies against the substrate without trusting the
  mirror ([substrate.md](../primitive/substrate.md)). Crosses the
  same seam; no resequencing.
- **Parameter-governance handover** — L2 policy knobs (subsidy,
  quotas, fees, adjudicator gate, honor issuance) are operator-set at
  genesis and migrate to ordinary community governance once the
  governance surface (slice 4) is live
  ([governance.md](../primitive/governance.md)).
- **The goods program** — the fiat-backed honor goods program,
  staged, starting near-zero-fiat
  ([governance.md](../primitive/governance.md)).
- **API-edge hardening** — auth rate limiting and the breach-corpus
  password check ([auth.md](auth.md)), plus GraphQL query depth and
  complexity budgets (a single nested query can fetch N objects
  without tripping any per-endpoint limit). Lands with the rebuilt
  auth surface and the API it protects.
- **Passkey-wrapped second unlock** — the WebAuthn-PRF unlock of the
  key-backup blob; a foreseen extension of the recovery-code posture,
  not a posture change ([auth.md](auth.md)).
- **Delegated-miner standing + incentives** — parked
  ([open-questions.md Q25](../open-questions.md),
  [miner-api.md](miner-api.md)); revisit when someone actually wants
  to operate a paid miner.
- **Walk-the-graph frontend** — a visual graph-exploration client;
  parked product idea. Neighborhood queries over the record mirror
  suffice until it earns its build.

Cross-cutting design calls that outlive a single slice belong in
[open-questions.md](../open-questions.md), not here.
