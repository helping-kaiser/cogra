# android/CLAUDE.md

Android-specific assistant rules. The root
[CLAUDE.md](../CLAUDE.md) holds the shared mission, design boundaries,
and workflow rules — they apply here too; this file adds only what is
specific to the Android app. The human-facing counterpart is
[android/README.md](README.md); the design rationale is
[docs/implementation/android.md](../docs/implementation/android.md).

Re-read the root CLAUDE.md and this file at the start of every Android task.

---

## Module discipline

Gradle modules mirror the backend's crate discipline; each unit-tests in
isolation.

- `core:domain` — use-cases and domain types. **Plain Kotlin, no Android
  dependencies.** The only DI annotation allowed here is `javax.inject`
  (plain Java), which keeps the module JVM-testable while letting Hilt build
  the use-cases. Repository and store *interfaces* live here; their
  implementations live in `core:network`.
- `core:network` — Apollo client, generated operations, the encrypted token
  store, and the DI module that binds the domain interfaces. No UI.
- `feature:*` — one module per surface: Compose screens plus their
  ViewModels. A feature depends on `core:domain`, never on `core:network`'s
  implementations directly — the DI graph supplies those.
- `app` — application shell, navigation, theme, and the build-specific
  bindings (e.g. the GraphQL endpoint URL).

`core:ranker` and the other `feature:*` modules are added by the slices that
need them ([roadmap.md](../docs/implementation/roadmap.md)) — do not scaffold
empty modules ahead of a slice.

## The contract is generated

`schema.graphql` at the repo root is the single source of truth for the
API surface; Apollo Kotlin generates the typed client from it during the
`core:network` build. **Never hand-edit generated code**, and never add a
second copy of the schema — `core:network` points Apollo at the root file.
Operations are `.graphql` files under `core:network/src/main/graphql/`. A
contract change shows up as a schema diff plus a client compile error, which
is the point.

## Architecture

- **MVVM.** ViewModels expose immutable UI state as a `StateFlow`; screens
  collect it with `collectAsStateWithLifecycle`.
- **Stateless screens.** A `*Screen` composable takes its state and callbacks
  as parameters (so it is previewable and testable); a thin `*Route`
  composable wires it to the `hiltViewModel()`. No business logic in
  composables.
- **DI is Hilt.** Use-cases get `@Inject` constructors; ViewModels are
  `@HiltViewModel`. Bindings for interfaces live in the module that owns the
  implementation.
- **Versions live in `gradle/libs.versions.toml`.** Add or bump dependencies
  there, never inline in a module's `build.gradle.kts`.

## Auth / tokens

Tokens are persisted in DataStore, encrypted via Tink with a Keystore-backed
master key (`core:network`'s token store). The refresh token rotates on every
use — the client must overwrite its stored copy each refresh
([auth.md §Tokens](../docs/implementation/auth.md)). The access token rides as
a `Bearer` header; an `UNAUTHENTICATED` response triggers a single-flight
refresh-and-replay.

## Tests ship with the code

Per the shared rule, tests land with the change, and coverage fights the
modular pieces — every branch, not just the happy path (root CLAUDE.md;
[roadmap.md](../docs/implementation/roadmap.md) — "Coverage fights the modular
pieces").

- Domain logic and ViewModels: JUnit, run as plain JVM tests.
- Network: MockWebServer against the generated Apollo client.
- UI: Compose tests under Robolectric so they run on the JVM in CI (no
  emulator). Bind assertions to `testTag`s, not display copy.
- Keep crypto behind an interface so the token store tests with a fake; the
  real Keystore-backed path carries only a thin smoke test (it needs a
  device).

CI runs `./gradlew test` and `./gradlew :app:assembleDebug`, path-filtered to
`android/**` and `schema.graphql`.
