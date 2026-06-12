# Android App

The reference frontend: a native Android app living in `android/`,
sharing this repository with the backend
([architecture.md "Repository layout"](architecture.md#repository-layout)).

| Concern | Choice |
|---|---|
| Language / UI | Kotlin + Jetpack Compose |
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

## Module layout

Gradle modules mirror the backend's crate discipline — every module
unit-tests in isolation:

- `core:network` — Apollo client and generated operations; no UI.
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
- UI: Compose UI tests per feature module.
- The ranking math is tested on the Rust side in `ranker`; the
  bindings carry a thin smoke test.

## Rules

`android/CLAUDE.md` carries the Android-specific assistant rules;
the root [CLAUDE.md](../../CLAUDE.md) holds the shared ones.
