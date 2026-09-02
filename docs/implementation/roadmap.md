# Implementation Roadmap · `plan:implementation:roadmap`

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

**Slices 0, 1, and 1.1 are closed.** Backend: the seam, the stand-in,
the record mirror with its epoch cursor, the genesis bootstrap,
the staged write path, and the onboarding/session surface — the
exported GraphQL contract is the full slice-1 surface. Android:
the vector-pinned crypto (`core:crypto`), the signing
orchestration and stores (`core:domain` + `core:network`), and
the five feature surfaces (onboarding, auth, home, invites,
settings) with auth-driven navigation. Web: the same surface at
parity ([web.md](web.md)) — the crypto core, WebCrypto key
custody, the onboarding handshake, and the member surfaces. The
end-to-end hand test — invite link to landed actor, phone-signed
write, browser restore via recovery code — passed 2026-08-07.
The client-crypto groundwork both cuts build on is in place —
the key-backup blob format ([auth.md](auth.md#blob-format-v1))
and the golden vectors (`client-crypto-vectors.json`,
`make vectors`). Slice 1.1 shipped on all three fronts — the
auth-edge rate limits with the breach-corpus check, the query
budgets, and the account-keyed client custody with the verified
repair-attach — and passed its hand test. The auth contract has
since grown the reuse-detection security notice
([auth.md](auth.md) "The security notice"), closing
open-questions Q32.

**Slice 2's text core is closed** (hand-tested 2026-08-12):
Publish and Review authoring through the write path, the Peer
Content Envelope, carriage and display content in Postgres,
newest-wins snapshot edits, chronicle and node reads, and the
chronological `posts` listing — with the compose, feed, and
post-detail surfaces on both clients, public reads included.
Behind it landed two hardening passes: key custody (the signed
key-backup upload, the on-device key gate, key export, the
recovery-code confirm — [auth.md](auth.md)) and the design
system ([design.md](design.md)): palette, type, shape, and
components, with web brought to parity.

**Slice 2.1 is closed** (hand-tested 2026-08-18): the app shell —
bottom bar, compact top bars, one shell for every viewer — and the
profile surface (reads, editing, actor chips) on all three fronts,
with the bottom-bar placement rule settled as Q37 (the bar rides
read surfaces, task flows carry a back arrow).

**Slice 2.2 is closed** (hand-tested 2026-08-25, three rounds):
the generic `prepareStance` toward posts, comments, and profiles
with the raw-edge semantic, the read-side bundle fold serving both
the clipped pair and the raw sums, batch severance, and the pad on
both clients per [design.md §8](design.md) — explicit-Set commits,
fixed lower-centre placement, re-draggable field, local realtime
landing, first-tap coach, and the 🤷 zero-bundle readout. The
current visual treatment is accepted as interim: the feed, detail,
and creation surfaces get their full redesign when media lands
(2.5) and the ranked-feed rework (slice 3). The rest of the
content era is sliced below (2.3–2.7).

**Slice 2.3 is closed** (hand-tested 2026-08-27, two rounds): Tag
hyper-edges on posts and comments — at creation and from the edit
surfaces, each tag its own priced act with relevance/confidence
sliders — the hashtag registry and `hashtag(name)`, topic chips
with on-demand value reveal on detail views, the current-topics
fold (newest-wins, relevance-0 un-tag), and the topic page. Every
submit shows how many signed actions it stages, with a
multi-action confirm. Topic follow is backend-accepted but
client-hidden until the topic feed lands (slice 3, where the
"topics you follow" list and third-party tag claims also arrive).
Web/Android visual divergence is accepted as interim per the same
redesign note as 2.2.

**Slice 2.4 is closed** (hand-tested 2026-08-28, one fix round):
Reference hyper-edges on posts and comments — citations and
mentions authored at creation, from the edit surfaces, and via a
Reference affordance on every content detail, each its own priced
act with relevance/support sliders and a whole-batch solvency
pre-check. The exact-match reference finder ships as structure
(real search replaces its lookup in 2.7, behind the same field);
topics are not reference targets — tagging is the topic gesture.
Reads serve the carrier author's netted current references with
batched target resolution; withdrawal nets the bundle, its act
count quoted before anything signs. Live sets are capped at fifty
references and fifty topics per artifact, and the query budgets
are derived from measured client operations under a standing
guard. Inbound "cited by" and third-party reference claims wait
for slice 3 with their tag siblings.

## The stand-in and the swap

Until PeerNetworks Layer 1 ships, the backend runs an **L1 stand-in**
behind the interface boundary: an implementation of the
[layer1-interface.md](../primitive/layer1-interface.md) contract with
two named simplifications. **Money** — the `B_i` surface and θ-debits
honored as numbers, without a real Layer 0 economy behind them.
**Standing** — formation, the admission handshake, ordering, causal
keys, maturity, and the θ-ledger are implemented in full, but the
conserved standing solve (layer1-interface.md §11.3–11.5) is not: every
act's stamp is taken as 1, so the W2a wall and W2b door pass
trivially and the derived Self-edge reading carries a constant
coordinate. The gates' call-sites are real; the real substrate brings
the real stamps at the swap.

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

- The single L1 interface boundary in the `api` crate — the two
  relay legs (seal, approve), ingest, and the `B_i` read
  ([architecture.md](architecture.md)) — with the stand-in behind
  it. Prepare is L2 orchestration in front of the seam, not a seam
  operation ([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)).
- Record mirror tables, ingestion, epoch cursor
  ([data-model.md](data-model.md)).
- Genesis: the L1-side genesis sequence against the stand-in + the
  CoGra-side bootstrap binary
  ([architecture.md](architecture.md#genesis-bootstrap)).
- **Hand test:** submit a signed record through the boundary, watch
  ingestion land it in the mirror.
- **Surfaces:** backend.

### Slice 1 — Onboarding and client-signed writes

- The staged-applicant flow end to end: invite link → registration
  (account + session) → logged-in key ceremony (actor key + L0
  address + recovery-code offer) and email verification → approval
  with funding burn → staged Registration signed (both handshake
  steps) → landing ([auth.md](auth.md)).
- Login, sessions, credentials — the L2 half.
- The write path: prepare → pre-sign on device → seal → approve
  on device → confirm ([architecture.md](architecture.md)).
- Android from the start: the actor key lives on the device, so the
  client is not optional here — key ceremony, signing, login
  ([android.md](android.md)).
- Web at full parity ([web.md](web.md)): the web app serves everyone
  the Android app doesn't reach — without the key ceremony and
  signing in the browser, an iOS or desktop user could not join at
  all. The browser key custody is WebCrypto-held keys
  ([web.md](web.md#key-custody--webcrypto)).
- Key mobility ships with the clients: restoring the actor on a
  second device — login plus recovery code
  ([auth.md](auth.md#key-recovery)) — and the backup settings
  surface (enable late, replace the code).
- `User.hasReciprocated` in the contract, with the reciprocation
  prompt gated on it in both clients (decided 2026-08-07,
  superseding the earlier deferral to slice 2: the field is
  invite/auth-flow state, so it ships with the flow). The
  device-local answered-bit stays only as the dismissal memory.
- Actor-identity uniqueness at the attach: one account per L0
  address — `attachActorKey` refuses a key already bound to a
  different account ([auth.md](auth.md#application-the-applicant-state)).
  Surfaced by the slice-1 hand test: a second account on a device
  silently repair-attached the device's existing key and wedged
  its admission behind an unlandable duplicate Registration.
- **Hand test:** take an invite link all the way to a landed, funded
  actor; sign a write from the phone; restore the actor in the
  browser with the recovery code.
- **Surfaces:** backend, API, Android, web.

### Slice 1.1 — API-edge hardening

- Auth rate limiting (per-IP and per-account backoff on login,
  application submits, resets, resends) and the breach-corpus
  password check ([auth.md](auth.md)).
- GraphQL query depth and complexity budgets — a single nested
  query can fetch N objects without tripping any per-endpoint
  limit.
- Multi-account device custody: several accounts on one device is
  a supported pattern, so the client identity stores bind key
  material to the account it belongs to instead of one
  device-global singleton, and the repair-attach verifies the
  device key against the account's attached key before offering
  it. Build to the platforms' documented custody idioms.
- Sequenced directly behind slice 1: it hardens the auth surface
  slice 1 rebuilds and the API that protects it.
- **Surfaces:** backend, API, Android, web.

### Slice 2 — Content

- Publish and Review authoring through the write path, payloads in
  the Peer Content Envelope, display content in Postgres
  ([post.md](../instances/post.md),
  [comment.md](../instances/comment.md),
  [data-model.md](data-model.md)).
- Chronicle reads (`records`), node reads, and a chronological
  listing — deliberately **not** the ranked feed, so this slice
  doesn't block on the ranker.
- Text-first cut: posts (title/description/body) and comments,
  create and edit. The rest of the content era is the 2.x
  sub-slices below — api-spec.md keeps the full target contract.
  `actAs` moved to slice 5 with the Collectives that need it: a
  Collective is the only non-User actor there is.
- **Hand test:** post from the phone, read it back.
- **Surfaces:** backend, API, Android, web.

Sub-slice order is dependency-driven, not a strict sequence:
each names what it builds on, and one whose dependencies are met
can land in any order — 2.3 (topics) needs only the text core.

### Slice 2.1 — The shell and profiles

- The app shell from the [design.md §6](design.md) inventory —
  bottom navigation, top app bars, the compose action, bottom
  sheets, snackbars — the frame every content-era surface hangs
  from.
- Profile reads: `actor` / `user` by id or handle, the profile
  screen (avatar, bio, authored content via
  `records(author:)`), and actor chips linking every @handle
  ([api-spec.md](api-spec.md)).
- Profile editing: `prepareProfileUpdate` — a parallel
  Registration, L1's own profile-update idiom — and the
  service-side `changeHandle` ([api-spec.md](api-spec.md)).
- Content-UI gaps the same screens close: the comment edit
  affordance and nested reply rendering.
- **Hand test:** navigate by the bottom bar; open an author from
  a post card; edit your bio from your own profile.
- **Surfaces:** backend, API, Android, web.

### Slice 2.2 — The stance control

- Opinion toward any passive node — posts, comments, profiles —
  through the one generic `prepareStance`
  ([edges.md](../primitive/edges.md), [api-spec.md](api-spec.md)
  "The generic stance").
- The raw-edge semantic (decided 2026-08-14, superseding the
  slice-1 intended-net-state prepare): a stance record carries
  exactly the picked values — the client never computes, and
  the backend never derives, a delta against the author's
  bundle ([design.md §8.1](design.md)). Severance is the one
  explicit gesture that does net the bundle to `(0, 0)`, over
  `⌈max(|Σ_d|, |Σ_i|)⌉` counter-records — each its own priced
  act, so the batch is the gesture's cost. The shipped
  `prepareStance` is reworked to match.
- The read-side bundle fold: current standing toward a target
  and where a pick lands it — what the pad's readout shows.
  `viewerStance` takes the reader's choice of view, landed-only
  or pending-inclusive, on the `includePending` convention;
  severance computes against the pending-inclusive one, so a
  sever reads through immediately.
- The pad on both clients ([design.md §8](design.md)): tap for
  the `(+0.1, +0.1)` default, the press-and-hold pad, the face
  readout, the severance confirm.
- **Hand test:** stance a post and a person; watch the bundle
  reading move; sever a test actor and meet the confirm.
- **Surfaces:** backend, API, Android, web.

### Slice 2.3 — Topics

- Tag hyper-edges — in the creation batch and standalone — the
  hashtag registry (the UUIDv5 naming service),
  `hashtag(name)`, and topic chips
  ([post.md §3](../instances/post.md),
  [hashtag.md](../instances/hashtag.md)).
- Affinity toward a Hashtag — the follow-topic gesture — rides
  the same `prepareStance`; the tap default suffices until the
  pad (2.2) reaches it.
- Carries the current-topics fold: newest-wins per (author,
  content, Type) bundle, and the un-tag gesture is a further tag
  at relevance `0`
  ([hashtag.md §4](../instances/hashtag.md#4-the-current-topics-fold)).
- **Hand test:** tag a post at creation; open the topic from
  its chip; follow it.
- **Surfaces:** backend, API, Android, web.

### Slice 2.4 — References

- Reference hyper-edges: citations declared at creation,
  quote/embed, and mentions — a mention targets the Profile;
  nothing minted ([post.md §3](../instances/post.md),
  [edges.md §3](../primitive/edges.md)).
- Structured inputs only — never parsed from the body
  ([api-spec.md](api-spec.md)).
- At most ten references per creation batch — the cap tags
  carry, for the same reason: each citation is its own priced
  act, and θ prices the author's cost but not the prepare-side
  work an unbounded batch demands.
- **Hand test:** cite a post from a post; mention a person and
  land on their profile from the render.
- **Surfaces:** backend, API, Android, web.

### Slice 2.5.1 — Images and galleries

The media service is built whole here — it is video-ready from
the start — and delivery splits by content kind.

- **The media service**: a standalone S3-compatible object store
  as its own container, behind a `BlobStore` trait that speaks
  S3 because the store eventually leaves this machine
  ([architecture.md](architecture.md)). Uploads enter through
  `uploadMedia`, which sniffs, strips metadata, probes by
  decoding, digests, and writes the object before the row — bytes
  and nothing authored, so a picture uploads the moment it is
  picked.
- **The envelope's media manifest** (guild key 5) and the
  profile's avatar slot (key 11) — digest, mime and alt text per
  asset, array position carrying order
  ([data-model.md](data-model.md)).
- **Version-keyed galleries**: post and comment attachment rows
  key on the version row, so the gallery follows the winning
  version as the text does, with the reverse index the junction
  design is justified by ([post.md §4](../instances/post.md)).
- **The body XOR**: a post's body is words or media, never both;
  a comment stays words plus optional media
  ([api-spec.md](api-spec.md)).
- **Galleries as bounded fold lists**, ten per post and four per
  comment, priced at their caps rather than a page size.
- **Avatars** through the same upload path — the profile's one
  image — with three-valued profile updates and the monogram as
  the permanent no-picture fallback.
- **The compose wizard**, built as ruled and visually matched to
  the design canvas — body-first pick, crop, details, licence
  sheet, sensitive self-mark, seal screen — layered atoms →
  master components → variants → screens. Components that
  diverge from the old ones ship beside them as the **2.0
  components**; old screens migrate in their own later passes.
- Clients downscale, re-encode to WebP, and bake the author's
  crop on device, so EXIF never reaches the wire and the server
  strips again rather than trusting that.
- **Hand test:** post a photo from the phone; see it in the
  feed on the web.
- **Surfaces:** backend, API, Android, web.

### Slice 2.5.2 — Video

- Video through the same service: the per-asset poster as a real
  foreign key on the asset row, so a poster is redacted with its
  video ([data-model.md](data-model.md)); container and codec
  validation; per-type size caps; `durationMs` reading a value.
- The wizard's cover step, and animated WebP and GIF.
- The upload accepts **MP4 / H.264 + AAC** at 100 MiB and animated
  WebP at the picture's own cap, validated and never transcoded;
  GIF converts on the device. A video is the whole body and its
  poster rides the asset, named on the upload.
- Autoplay muted on visibility with one global sticky mute, and
  the viewer's real controls — settled design, unbuilt.
- **Hand test:** post a video from the phone; watch it autoplay
  muted in the web feed and take sound on tap.
- **Surfaces:** backend, API, Android, web.

### Slice 2.5.3 — The seal-adjacent settings

The non-media rulings the compose session produced, separable
from the media path and carrying their own doc write-back:

- The **default-license account setting** and the sensitive
  self-mark's contract field, which the wizard needs and the
  contract does not yet carry.
- **Edit as one batch**: an edit carrying its topic and citation
  acts together.
- Media in the **comment composer**, the **media viewer**, and
  the full feed-card redesign pass.
- **Surfaces:** backend, API, Android, web.

### Slice 2.6 — Private viewer state

- Bookmarks, hidden actors, `markSeen` / view history, and
  cross-device preferences ([api-spec.md](api-spec.md) "Private
  viewer state") — L2-only rows, no graph records.
- Sequenced before slice 3: `markSeen` feeds the ranked feed's
  de-duplication.
- **Hand test:** bookmark on the phone, find it on the web;
  hide an actor and watch their posts drop out.
- **Surfaces:** backend, API, Android, web.

### Slice 2.7 — Search

- The global `search` surface and the indexes behind it — post
  titles and the name-class fields ([api-spec.md](api-spec.md)
  "Search"). Kinds grow with later slices: collectives, chats,
  and items index when their slices land.
- Search replaces the reference finder's exact-match lookup
  *behind* `referenceCandidates`, the field the clients already
  bind to — prefix matching and ranking arrive without a client
  change.
- **Hand test:** find a post by a title word; find a person by
  handle.
- **Surfaces:** backend, API, Android, web.

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
- **Third-party topic claims** join the chip row and the topic
  feed. A tag whose author is not the content's author reaches a
  viewer only through the tagger, at the viewer's forward-path
  weight, so 2.3 serves the content-intrinsic channel alone — the
  author's own declarations — and the union across authors becomes
  servable with the weight this slice computes
  ([hashtag.md §4](../instances/hashtag.md#4-the-current-topics-fold),
  [feed-ranking.md §4](../primitive/feed-ranking.md#4-the-path-set)).
- **Inbound "cited by"** joins the same rework, for the same
  reason: a citation hung off a post by someone other than its
  author reaches a viewer only through the citer, at a weight
  this slice computes, so 2.4 serves the carrier author's own
  citations alone. Backwards traversal of references belongs
  here, alongside the searching and traversal options this slice
  introduces.
- **Severance informs about the bundles it does not net.**
  Severance is an action on one bundle and stays one. What it
  gains is a report: it checks for other edges the author
  controls toward the same node — the references they authored
  toward that Profile — and tells them, so the author can close
  those through the citation withdrawal that owns them.
- **Unhide topic follow** — the follow/unfollow control, backend-
  accepted since 2.3 (`prepareStance` toward the Hashtag) but
  hidden from the client until the topic feed exists to receive it.
- **The "topics you follow" list** — a viewerTopics-style query over
  the viewer's own Affinity bundle, surfaced alongside the unhidden
  follow control.
- The score readout — [design.md §7](design.md) "numbers are in
  scope": a post can show what it scored and why it sits where
  it does, opening into the actual paths behind it.
- **The feed, detail, and creation surfaces rework** on both
  clients: the feed gains a filter section (sorting follows once
  ranks exist), and the presentation of posts and comments — cards,
  detail views, and the compose flows — is rebuilt around the
  ranked feed. Deferred elements that land with this rework rather
  than piecemeal before it: the landed-only ("show only settled
  content") control (the `includePending` mechanism is already
  wired on both clients), the license qualifiers on the feed card
  (already fetched), the author's did-not-land notice
  ([design.md §9](design.md); rides `stagedWrite`/`EXPIRED`), and
  the composer's unchanged-snapshot guard (disable save when the
  edit is byte-identical; the protocol keeps accepting priced
  no-ops), and an optional **quick-pad variant** — hold, drag,
  commit on release, no Set step — as a second mode beside the
  full pad (jakob, 2026-08-25; the full pad stays the default).
- **The L1-view / L2-view toggle on the feed.** The stance bundle
  already lets a reader choose which view they read — landed only,
  or landed plus what is still in flight (slice 2.2). The ranked
  feed offers the same choice as a user control, for the two cases
  that motivate it: after severing a bot cluster the L2 view gives
  a clean feed immediately instead of an epoch later, and when the
  pending layer is being flooded the L1 view is the retreat to
  what has actually settled.
- **Hand test:** ranked feed on the device; later, the same feed
  ranked by the container and on-device (web ranks backend-direct
  until the Wasm stage — [web.md](web.md)).
- **Surfaces:** backend, API, miner transport, Android, web.

### Slice 3.1 — Notifications

- Design first: notifications have no doc anywhere, so the slice
  opens by writing one — what notifies, delivery channels,
  storage, read state — and then builds against it.
- Sequenced behind the ranker: the feed is the product's core
  surfacing channel and ships first; notifications are the
  second.
- **Hand test:** get commented on, see the notification on the
  phone.
- **Surfaces:** backend, API, Android, web.

### Slice 4 — Governance

- Proposal anchoring (Content anchor + `(0,0)` Reference), L1
  ballots, finalization, and the scope's executing authority
  ([proposal.md](../instances/proposal.md),
  [governance.md](../primitive/governance.md)).
- Fold caches: Proposal state, the network parameter carrier, role
  marks ([data-model.md](data-model.md)).
- The `networkParameters` read — the operational carrier's
  catalog surfaced ([api-spec.md](api-spec.md),
  [network.md](../primitive/network.md)).
- **Hand test:** raise a proposal, vote, watch it finalize and the
  parameter change land.
- **Surfaces:** backend, API.

### Slice 5 — Collectives and chats

- Collective founding, membership folds, collective-scoped
  governance; backend key custody as the documented stopgap
  ([collectives.md §2](../instances/collectives.md)) — the
  member-held splits are the Q30-gated workstream below.
- Chats: creation, membership flows, messaging, E2EE with client-side
  keys ([chats.md](../instances/chats.md)). The chat-message
  attachment junction is re-keyed on the version row and gains
  its reverse index here, with the write path that measures it
  ([data-model.md](data-model.md)).
- `actAs` across the write surface — posting, tagging, and
  stancing as a Collective ([api-spec.md](api-spec.md)
  "Conventions") — moved here from slice 2: a Collective is the
  only non-User actor there is.
- **Surfaces:** backend, API, Android, web.

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
- The item attachment junction is re-keyed on the version row and
  gains its reverse index here, with the write path that measures
  it ([data-model.md](data-model.md)).
- **Hand test:** tip a post and see the public stance land with its
  pointer; buy an Item end to end — fund, bid, accept, ratify,
  title moving at the boundary, the covenant paying out.
- **Surfaces:** rail, backend, API, Android, web.

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
- **Surfaces:** backend, API, Android, web.

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
- **Passkey-wrapped second unlock** — the WebAuthn-PRF unlock of the
  key-backup blob; a foreseen extension of the recovery-code posture,
  not a posture change ([auth.md](auth.md)).
- **The application registry** — `appVersions` and the release
  rows behind it ([api-spec.md](api-spec.md),
  [data-model.md](data-model.md)); operational metadata any slice
  can carry. Gate: the first release whose patch notes someone
  needs to find.
- **Delegated-miner standing + incentives** — parked
  ([open-questions.md Q25](../open-questions.md),
  [miner-api.md](miner-api.md)); revisit when someone actually wants
  to operate a paid miner.
- **Walk-the-graph frontend** — a visual graph-exploration client;
  parked product idea. Neighborhood queries over the record mirror
  suffice until it earns its build.

Cross-cutting design calls that outlive a single slice belong in
[open-questions.md](../open-questions.md), not here.
