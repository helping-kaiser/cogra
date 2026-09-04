# Android App · `spec:implementation:android-app`

The reference frontend: a native Android app living in `android/`,
sharing this repository with the backend
([architecture.md "Repository layout"](architecture.md#repository-layout)).

| Concern | Choice |
|---|---|
| Language / UI | Kotlin + Jetpack Compose |
| Design language | [Material 3](https://m3.material.io) — what Compose's component library implements; the system built on it is [design.md](design.md) |
| GraphQL client | Apollo Kotlin, generated from the exported `schema.graphql` |
| Ranking core | the `ranker` crate, bound via UniFFI |
| Build | Gradle, multi-module |
| CI | GitHub Actions, path-filtered alongside the Rust jobs |

A pure-Rust Android UI (Dioxus, Tauri Mobile, Slint) was considered
and rejected: a social app leans on platform machinery — push
notifications, share sheets, camera, deep links, accessibility —
where Kotlin is first-class and Rust UI toolkits are still young.
Rust enters the app where it pays: the math core.

## The contract — generated schema, generated client

The backend exports its async-graphql schema as `schema.graphql`,
checked into the repo; CI fails when the export drifts from the
checked-in file. Apollo Kotlin generates the typed client from that
same file. Frontend/backend agreement is machine-checked at build
time — an API-surface change shows up as a schema diff and a client
compile error, not as a runtime surprise.

## The Rust core — ranking on the device

[miner-api.md "Transport"](miner-api.md#transport) pins the rollout
path: `rank` runs on the backend first, then in a miner container,
then on the viewer's own device. The math lives once, in the
`ranker` crate ([architecture.md](architecture.md#cratesranker));
the device stage binds that crate into the app through
UniFFI-generated Kotlin bindings, and the in-process call uses the
logical contract directly — `rank(slice, params)`, no wire form.

E2EE chat crypto ([chats.md](../instances/chats.md)) lands in the
same Rust core when chats are implemented: client-side crypto is
written once, in Rust, and bound to every platform the same way.

## The actor key — the device is the signer

The app is where the member's actor key lives: it mints the key
and L0 address as a logged-in step of the application
([auth.md "Application"](auth.md#application-the-applicant-state)),
attaches only the public halves, offers the recovery-code backup
at key creation (encrypt locally, upload only ciphertext — the
sealed blob uploads immediately after the attach;
[auth.md "Key recovery"](auth.md#key-recovery)), and signs both
steps of every write — the proposal pre-commitment, then the
approval witness over the host-sealed verified act
([substrate.md §6](../primitive/substrate.md#6-authoring-path-and-admission)).
The key leaves the device only when its holder asks it to — the
`KeyExport` screen, gated on `BiometricPrompt` with the device
credential, over a `FLAG_SECURE` window
([auth.md "Key export"](auth.md#key-export)) — and never over the
wire. The same gate stands in front of replacing the recovery
code, so no single tap destroys a backup. A displayed code is
dismissed only by being typed or pasted back, and the copy button
beside it flags its clip sensitive
([auth.md "Key recovery"](auth.md#key-recovery)); both live in
`core:designsystem`, since the ceremony and settings show the
same code the same way.
Before it signs an approval the app runs four checks: the returned
act carries the same body, payload and dependency list this device
pre-signed, under the same pre-signature and nonce; the host seal
verifies under the host key; and the content and dependency
commitments open over the bytes the device itself holds. The
payload rides as opaque bytes, so what the four establish is that
the host returned the act this device signed — not that the
envelope encodes what the user typed
([open-questions.md Q54](../open-questions.md#q54--semantic-verification-of-the-payload-envelope-on-clients)).
The concrete signing crypto follows the L1 key model, which
is open with the L1 team
([open-questions.md Q30](../open-questions.md#q30--l1-key-model-signature-scheme-and-actor-key-rotation));
until it resolves, the app's key handling stays scheme-neutral.

The application's poll/sign loop runs app-scoped, above any one
screen ([auth.md "Application"](auth.md#application-the-applicant-state)),
with a stage-aware cadence: 3 s while the wait is on the server
or this device (landing, a staged Registration to sign), 30 s
while it is on a human (verification, approval), and an immediate
pass on app entry and after any user action that changes server
state. Auto-polling is onboarding-only — the loop stops for good
at membership; from then on every fetch is event-driven, a user
action with an outcome to collect or an explicit refresh. The
loop is also session-bound: it watches the token store, and the
end of the session — sign-out, the reuse-detected token clear, an
account switch — cancels it and resets the flow's state, so a
signed-out device never polls and a new session starts clean.

## Degrade, never crash

Three failure classes the app absorbs instead of dying:

- **Unknown server vocabulary.** The server's enums can grow before
  the app updates. Every generated enum maps into the domain with an
  explicit `UNKNOWN` fallback, never an exception. An unknown account
  state gates acting; an unknown staged-write state or record family
  is refused by the signer *without* clearing its handshake material,
  so an updated build can resume the write. A family the client
  cannot name is never signed and never enters the identifier
  algebra.
- **Secure-store loss.** The encrypted DataStore (tokens, identity
  material) never crash-loops the app: a corrupt file is replaced via
  the DataStore corruption handler, and a value that fails to decrypt
  or decode reads as absent — signed out, or the husk state — with
  the ciphertext left in place in case the failure is transient.
  Either loss sets a persistent mark that the app shell surfaces as a
  one-time dialog: data loss is visible, never silent.
- **Transport faults never blank loaded content.** A read surface
  that already holds content keeps showing it when a refresh or
  page fetch fails; the full-screen transport error is reserved
  for the nothing-loaded state. The fault surfaces where the
  failed fetch was requested: a failed refresh rides a
  non-blocking banner above the content, a failed page fetch
  replaces the load-more control in place with the same message
  and a retry — the platform's
  [Paging load-state pattern](https://developer.android.com/topic/libraries/architecture/paging/load-state).
  A failed submit is a composer error beside its button, never a
  read fault. The fault reflects the last *completed* fetch — it
  clears on success, never eagerly at fetch start, so a failed
  retry never flashes the error surface.

## Media

**Coil 3** (`coil-compose`) is the loader — the Compose-native
one Android's own Compose documentation points at. It ships no
network fetcher, so `coil-network-okhttp` rides with it. The
version tracks the Compose and Kotlin pair the app is on rather
than the newest release: Coil follows the toolchain, so moving it
up is an AGP and Kotlin migration, not a dependency bump.

- **`AsyncImage`** draws every asset, inside a
  `Modifier.aspectRatio()` driven by `options.aspectRatio`, so
  the tile's space is reserved before a byte arrives and the feed
  never jumps as pictures load.
- **`contentDescription` comes from `altText`.** A null `altText`
  is a null description — decorative — never a fabricated one and
  never the filename.
- **Pictures are processed on the device before upload.** The
  long edge is capped at 1080 and the bytes are re-encoded to
  WebP at quality 0.8, which is the envelope the platforms at
  this tier publish. The author's crop is baked into the pixels,
  so the stored bytes are the post's bytes. The re-encode is also
  what kills EXIF: a decode-and-re-encode carries no metadata
  forward, so location and device serial are gone before the
  bytes leave the phone — and the server strips again rather than
  trusting that.

## Accessibility

Part of the bar from day one, never retrofitted: every screen
lands with its Compose semantics — content descriptions, roles,
touch-target sizes — alongside its UI tests. A drag gesture
always has a non-drag equivalent: the crop step's framing is
completable with discrete nudge and zoom controls.

## Screens

The destination map — type-safe destinations, one NavHost inside
the shell scaffold (`CograNavGraph.kt`). Auth drives navigation:
a phase flip lands on the new phase's root — `Login` signed
out, the `Feed` tab signed in — with a cleared stack, so which
stack reaches a destination is its access gate. The shell frames
every read surface with the bottom bar
([design.md §6](design.md#6-components)) — the tabs plus the read
drill-ins `PostDetail` and `Profile(handle)`; the task flows drop
it. Tabs carry no back
arrow, every inner screen carries one over `navigateUp()`. The
account-status banners (the application cards, husk/restore, the
reciprocation prompt — `feature:home`) ride above whichever tab
is active until resolved.

| Destination | Stack | Web counterpart ([web.md "Routes"](web.md#routes)) |
|---|---|---|
| `Login` (start — the signed-out entry: sign in, invite, browse) | signed out | `/login` |
| `InviteEntry` (`/join` App Links land here) | signed out | `/join` + `/join/<link-id>` |
| `Apply(inviteId)` | signed out | the apply step of `/join/<link-id>` |
| `PasswordReset` | signed out | `/reset` |
| `Feed` (signed-in root; bar tab) | both (public read) | `/feed` |
| `Profile(handle?)` (bar tab when own; drill-in by handle) | both (public read) | `/u/<handle>` |
| `ProfileEdit` | signed in | the edit form of `/u/<handle>` |
| `PostDetail(postId)` | both (public read) | `/posts/<id>` |
| `ComposePost(postId?)` (the bar's center action) | signed in | `/compose` (+`?post=<id>`) |
| `Invites` (entry on the own profile) | signed in | `/invites` |
| `Settings` (gear on the own profile) | signed in | `/settings` |
| `KeyExport` | signed in | `/settings/key` |
| `KeyCeremony` | signed in | `/key` |
| `Restore` | signed in | `/restore` |

The read surfaces are public on every client — accounts gate
participation, never viewing
([graph-model.md "Core principles"](../primitive/graph-model.md#1-core-principles)).
`Feed`, `PostDetail`, and `Profile` sit on both stacks, write
affordances swapped for join entries — the bar rides those read
surfaces for anonymous viewers too, its account-needing slots
(compose, profile) asking in place via the join prompt; the
login screen carries the invite and browse entries, and the
join entries on the read surfaces push it, so back returns to
the reading context. No guest session
exists anywhere: an anonymous read simply carries no
token. Email-carried surfaces (`/verify`, the `/reset?token=`
arrival) have no destinations: those links open in the browser.

## Module layout

Gradle modules mirror the backend's crate discipline — every module
unit-tests in isolation:

- `core:network` — Apollo client and generated operations; no UI.
- `core:crypto` — the client-side crypto mirroring `common::l1`
  (signing handshake, wire codecs, key-backup blob), pinned to the
  golden vectors; plain Kotlin, no Android dependencies.
- `core:designsystem` — shared pure-UI Compose components and the
  Material icon set; no domain or network dependencies.
- `core:domain` — use-cases and domain types; plain Kotlin, no
  Android dependencies.
- `core:ranker` — UniFFI bindings to the `ranker` crate (the
  device rollout stage).
- `feature:*` — one module per surface (`feature:auth`,
  `feature:content`, …): Compose screens plus their ViewModels.

## Tests

Tests ship with development, per the shared rule:

- Domain logic and ViewModels: JUnit unit tests, per module.
- Network: MockWebServer against the generated Apollo client.
- The handshake and key-backup crypto: the Kotlin implementation
  is pinned to the reference by the golden vectors in
  `client-crypto-vectors.json` at the repo root (`make vectors`).
- UI: Compose UI tests per feature module.
- The ranking math is tested on the Rust side in `ranker`; the
  bindings carry a thin smoke test.

## Rules

`android/CLAUDE.md` carries the Android-specific assistant rules;
the root [CLAUDE.md](../../CLAUDE.md) holds the shared ones.
