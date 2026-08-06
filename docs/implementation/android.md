# Android App

The reference frontend: a native Android app living in `android/`,
sharing this repository with the backend
([architecture.md "Repository layout"](architecture.md#repository-layout)).

| Concern | Choice |
|---|---|
| Language / UI | Kotlin + Jetpack Compose |
| Design language | [Material 3](https://m3.material.io) — what Compose's component library implements |
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
The key never leaves the device; before each signature the app
verifies what it signs — the recomputed pre-digests at pre-sign;
the host seal, exact body, and both commitment openings at
approval — so the user never signs blind bytes. The concrete signing crypto follows the L1 key model, which
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
action with an outcome to collect or an explicit refresh.

## Accessibility

Part of the bar from day one, never retrofitted: every screen
lands with its Compose semantics — content descriptions, roles,
touch-target sizes — alongside its UI tests.

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
  `feature:feed`, …): Compose screens plus their ViewModels.

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
