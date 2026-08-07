# Web App

The second frontend: a TypeScript web app living in `web/`, serving
everyone the Android app doesn't reach — iOS and desktop users —
and giving CoGra linkable pages. Layout is phone-first; larger
screens get a usable, not yet polished, rendering.

| Concern | Choice |
|---|---|
| Framework | Next.js (App Router) + React + TypeScript |
| GraphQL client | Apollo Client; types generated from the exported `schema.graphql` via GraphQL Code Generator |
| Styling | Tailwind CSS |
| Ranking core | the `ranker` crate, compiled to WebAssembly (the browser stage of the device rollout) |
| Build | npm; Node LTS pinned in `web/.nvmrc` |
| CI | GitHub Actions, path-filtered alongside the Rust and Android jobs |

Compose Multiplatform's web target was considered and rejected: it
renders the whole UI into a canvas via Kotlin/Wasm — still beta,
and by construction unable to serve server-rendered, linkable,
unfurlable pages, which is half the point of a web version. A
native web app costs a second frontend codebase but buys real URLs.

## The contract — generated schema, generated types

Same machine-checked agreement as the Android app
([android.md](android.md#the-contract--generated-schema-generated-client)):
GraphQL Code Generator (client preset) generates typed operations
from the root `schema.graphql` — the one copy, no second schema
file. Generated code lands in `web/src/__generated__/`, is never
committed and never hand-edited; CI regenerates it on every run, so
a contract change shows up as a schema diff plus a TypeScript
compile error.

## Links unfurl — pages render on the server

Shareable links are a design goal: a CoGra URL pasted into a chat
carries a preview (OpenGraph metadata) and renders without
client-side boot. Next.js server rendering is the mechanism. It is
only the mechanism — which surfaces are viewable without a session
is decided per surface as slices land, not by the framework.

## The Rust core — ranking in the browser

The math lives once, in the `ranker` crate
([architecture.md](architecture.md#cratesranker)); the browser
binds it as a WebAssembly module, the same way the Android app
binds it through UniFFI. This is a later rollout stage
([miner-api.md "Transport"](miner-api.md#transport)); until then
the web app calls `rank` on the backend like any client.

## Key custody — WebCrypto

The browser holds the actor key with WebCrypto — decided over a
Wasm-bound `common::l1`. The interim signing schemes are
stand-in-scoped and replaced at the substrate swap
([open-questions.md Q30](../open-questions.md#q30--l1-key-model-signature-scheme-and-actor-key-rotation)),
so a shared Wasm core would buy toolchain cost without a durable
implementation. The drift risk of a reimplementation — the
handshake's deterministic CBOR, tagged hashing, and Ed25519 in
TypeScript — is pinned instead by the golden vectors in
`client-crypto-vectors.json` at the repo root, exported from the
reference implementation in `common` (`make vectors`).

The seed is generated as raw bytes — it must enter the
key-backup blob ([auth.md "Key recovery"](auth.md#key-recovery))
— then imported as a **non-extractable** Ed25519 `CryptoKey` and
persisted in IndexedDB: script injection can use the key while a
page lives, but cannot exfiltrate it. The raw seed is kept beside
it only while no backup blob exists — auth.md's "declining is not
final" needs the seed to enable or re-key a backup later — and is
wiped the moment a blob is uploaded; from then on custody is the
non-extractable key alone.

## Session tokens in the browser

The contract keeps tokens client-held (`refreshSession` takes
the refresh token as an input), so the browser stores the
rotating refresh token in persistent storage and the access
token in memory. The accepted XSS blast radius is a session —
revocable, rotating, reuse-detected
([auth.md "Tokens"](auth.md#tokens)) — never the actor key.

Concretely: the refresh token lives in `localStorage` — its
`storage` event propagates sign-out and rotation to other tabs —
and the access token lives in per-tab module memory. The XSS
exposure of `localStorage` and IndexedDB is identical, so the
choice is ergonomics, not security.

The auth phase (`resolving → signedOut / signedIn`) derives from
token presence alone, no `me` bootstrap — Android's `AuthPhase`.
Guarded calls follow Android's `AuthGuard`: on an UNAUTHENTICATED
refusal, refresh once and replay once; a still-unauthenticated
replay is surfaced, never looped. UNAUTHENTICATED arrives two
ways, and the guard handles both: a null `me` on a viewer read,
and an errors-array entry with `extensions.code` — the backend's
only emission for guarded mutations
([api-spec.md "Errors are tiered"](api-spec.md#errors-are-tiered--transport-faults-vs-expected-outcomes)),
which the outcome mapping synthesizes into the same refusal shape.

Refresh is single-flight at two levels. In-tab, concurrent
callers serialize on a mutex and a caller that finds the access
token already rotated skips the network. Cross-tab, the network
call runs under a Web Lock (`navigator.locks`) and re-reads the
stored refresh token first, so a consumed token is never spent
twice — accidental reuse would revoke every session. Web Locks
needs a secure context; without it the in-tab mutex still holds.
Only a `REFRESH_TOKEN_INVALID` refusal clears the tokens (the
global sign-out); transport failures and other refusals keep the
session — offline never signs out.

The browser talks GraphQL same-origin: a Next.js rewrite proxies
`/graphql` to `GRAPHQL_URL`, so no CORS configuration and no
public endpoint variable exist.

## Routes

The slice-1 route map (Android parity per surface):

| Route | Access | Surface (Android counterpart) |
|---|---|---|
| `/` | public | signed out: invite front door (InviteEntry); signed in: Home |
| `/login` | public; signed-in → redirect `/` | Login |
| `/reset` (+`?token=` pre-fills the confirm form) | public | PasswordReset |
| `/join/<link-id>` | public, SSR for unfurl | InviteEntry + Apply; signed in: re-arm |
| `/verify?token=` | public, sessionless | email-verification result |
| `/key` | gated; key attached → redirect `/` | KeyCeremony |
| `/invites` | gated | Invites |
| `/settings` | gated | Settings |
| `/restore` | gated | Restore |

Everything else 404. `/join`, `/verify`, and `/reset` are the
doc-fixed link URLs ([auth.md "Link URLs"](auth.md#link-urls)).

Gating is client-side — tokens are client-held, so the server
never knows the auth state. The `(app)` route group's layout
guards the gated routes and replaces a signed-out visit to
`/login`; `/` branches in place on the phase. Phase flips replace
the location, never push — the Android navigation parity. Web
deltas from Android: `/invites` renders the applicant lock
in-page (the URL is directly addressable), `/reset?token=` and
`/verify?token=` arrive as links where Android pastes the token
in-app, and re-arm lives in two places — the Home card (Android
parity) and a context action on `/join/<link-id>` for a signed-in
visitor, since the link itself is directly addressable.

## The onboarding poll loop

The poll/sign loop that advances an application is app-scoped,
above any one screen ([auth.md](auth.md) — the applicant browses
while it runs). The web loop mirrors Android's `RegistrationFlow`
semantics — the cadence is an implementation choice, mirrored for
parity, not doc-fixed:

- One pass: poll the viewer status → flush a parked backup blob
  unconditionally → branch (member / sign the staged Registration
  / re-arm needed / landing awaited / the applicant cards, with a
  silent repair-attach when the server lost the key proof).
- Cadence: 3 s while the wait is on a machine (landing, a
  transport retry), 30 s while it is on a human (verification,
  approval, a fresh invite). `ensureAdvancing()` starts the loop
  or pokes a running one into an immediate pass — called whenever
  a proof just changed server-side.
- The loop is onboarding-only: it ends for good at member and at
  a device rejection. A one-shot landed signal fires only for a
  landing the loop watched live. Web addition: sign-out resets
  the loop; the next session starts clean.
- Handshake material lost (a staged write at `SEALING` or
  `AWAITING_APPROVAL` with no local nonce — pre-signed in another
  browser, or custody cleared): the device refuses with a
  synthesized `INTERNAL` "awaiting re-stage" and keeps polling;
  the staging garbage-collects and the approved application
  re-stages on a later poll. Cross-device continuation is parked
  in [open-questions.md](../open-questions.md).

The signing orchestration lives in `src/lib/signing/` (write
signer, registration signer, flow) over the custody store in
`src/lib/identity/`; handshake material — the private nonce and
pre-signature, keyed by staged-write id — persists in IndexedDB
before the submit, so the approve step verifies against what THIS
browser pre-signed across page reloads.

## Design guidelines

Styling starts minimal: Tailwind's default scales — spacing,
type, color — are the design tokens. No component library or
fuller design language until real screens exist to justify one;
adopting one is a deliberate decision, not a drift.

## Accessibility

Part of the bar from day one, never retrofitted: every page
lands with semantic HTML, ARIA where semantics fall short, and
keyboard operability, alongside its tests.

## Layout

- `src/app/` — routes (App Router); pages stay thin.
- `src/lib/` — Apollo wiring, domain helpers, shared UI.
- `src/lib/crypto/` — the vector-pinned client crypto
  ("Key custody" above).
- `src/lib/graphql/` — operation documents; codegen output goes to
  `src/__generated__/`.

Structure firms up as slices land — nothing is scaffolded ahead of
the surface that needs it, mirroring the Android module rule.

## Tests

Tests ship with development, per the shared rule:

- Components and helpers: Vitest + React Testing Library — the
  setup Next.js documents.
- Network: mocked at the HTTP boundary with MSW against the
  generated operations (the web twin of Android's MockWebServer).
- Crypto: golden-vector tests against the repo-root
  `client-crypto-vectors.json` ("Key custody" above).
- End-to-end (Playwright) is added when there are flows worth
  driving, not before.

## Rules

`web/CLAUDE.md` carries the web-specific assistant rules; the root
[CLAUDE.md](../../CLAUDE.md) holds the shared ones.
