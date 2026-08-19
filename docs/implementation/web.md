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

Every IndexedDB identity record — key pair, retained seed,
pending backup blob, per-write handshake material, UX flags — is
keyed by the account it belongs to, never held in a
device-global slot
([auth.md "Multi-account device custody"](auth.md#multi-account-device-custody));
sign-out keeps each account's material in its own slot, and the
repair-attach re-attaches only from the signed-in account's slot
after verifying it against the account's attached key.

That wipe shapes the settings backup surface. While the seed is
retained (backup declined earlier), enabling is one step: seal,
upload, wipe. Once a blob exists, replacing the code re-proves
the current one: the surface fetches the blob, opens it in
memory, re-seals the seed under a fresh code, and uploads — the
seed is never re-persisted. A browser that lost the code
therefore cannot re-key; that adds no loss mode, since without
the code the actor could never reach another device anyway.

Both surfaces that show a fresh code — the ceremony and settings
— render it through one component, which also carries the
write-it-down gate: the code is dismissed only by being typed or
pasted back ([auth.md "Key recovery"](auth.md#key-recovery)).
Its copy button needs a secure context, so where one is missing
the copy fails visibly rather than silently.

**A page cannot mark a clip sensitive**, so on Android the
browser's own copy confirmation shows the code where the app
masks it. The Clipboard API exposes no sensitivity hint —
[w3c/clipboard-apis#154](https://github.com/w3c/clipboard-apis/issues/154)
has asked for one since 2021 — and Chromium's flag is reachable
only from the browser's password UI, never from page script.
Copying from a password input does not reach it either; Blink
refuses to copy an unrevealed password field at all. The
exposure is bounded: the confirmation reveals the code at the
moment the code is already on screen, and what it costs is the
masking of the clipboard preview afterwards, not secrecy at the
copy itself.

The same wipe is what gates `/settings/key`
([auth.md "Key export"](auth.md#key-export)). With a blob in
place the export opens it under the current code and shows the
secrets from the in-memory seed, re-persisting nothing; while the
seed is still retained it simply shows them, since the seed
already sits in this browser's store and a prompt would prove
nothing.

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

The route map (Android parity per surface):

| Route | Access | Surface (Android counterpart) |
|---|---|---|
| `/` | public | pure phase switch — signed out: redirect `/login`, signed in: redirect `/feed` |
| `/login` | public; signed-in → redirect `/` | Login — the signed-out entry: sign in, plus the invite (`/join`) and feed-browse entries |
| `/reset` (+`?token=` pre-fills the confirm form) | public | PasswordReset |
| `/join` | public | InviteEntry — paste an invite to start an application |
| `/join/<link-id>` | public, SSR for unfurl | InviteEntry + Apply; signed in: re-arm |
| `/verify?token=` | public, sessionless | email-verification result |
| `/feed` | public | Feed — the chronological listing; the shell's root tab |
| `/posts/<id>` | public | PostDetail |
| `/u/<handle>` | public, SSR for unfurl | Profile(handle) |
| `/profile` | gated | Profile (the viewer's own — the shell's profile tab) |
| `/profile/edit` | gated | ProfileEdit |
| `/compose` (+`?post=<id>` opens edit mode) | gated | ComposePost |
| `/key` | gated; key attached → redirect `/` | KeyCeremony |
| `/invites` | gated | Invites |
| `/settings` | gated | Settings |
| `/settings/key` | gated | KeyExport |
| `/restore` | gated | Restore |

Everything else 404. `/join`, `/verify`, and `/reset` are the
doc-fixed link URLs ([auth.md "Link URLs"](auth.md#link-urls)).

Content reads are public — the per-surface decision "Links
unfurl" above defers: the graph is continuously readable by
anyone, without an account
([graph-model.md "Core principles"](../primitive/graph-model.md#1-core-principles)),
so `/feed`, `/posts/<id>`, and `/u/<handle>` render for anonymous
visitors, with the write affordances (comment box, reply, edit)
swapped for sign-in entries. Every write surface stays gated; the
login screen — the signed-out entry — carries the browse entry so
an anonymous visitor finds the public read without an account.

The shell is the bottom bar
([design.md §6](design.md#6-components)), rendered from the root
layout so it frames the public tier and the `(app)` group alike —
one frame for every viewer: an anonymous visitor gets the same
bar on the public read surfaces, its account-needing slots
(compose, profile) opening the join prompt in place — sign in or
keep browsing — never bouncing the read; only the auth surfaces
(login, join, reset, verify) stand alone. The account-status
banners
(the security notice, the application cards, the member status)
ride the feed and the own profile. Settings hangs off the
profile's gear; invites is a standalone entry on the own
profile.

Gating is client-side — tokens are client-held, so the server
never knows the auth state. The `(app)` route group's layout
guards the gated routes and replaces a signed-out visit to
`/login`; a route's membership in the group is the gate, so the
public read surfaces live outside it. `/` redirects on the
phase, rendering nothing. Phase flips replace the location,
never push — the
Android navigation parity. Web deltas from Android: `/invites`
renders the applicant lock in-page (the URL is directly
addressable), `/reset?token=` and `/verify?token=` arrive as
links where Android pastes the token in-app, and re-arm lives in
two places — the Home card (Android parity) and a context action
on `/join/<link-id>` for a signed-in visitor, since the link
itself is directly addressable.

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

Member-time prepares — the approval vouch, reciprocation — never
join the loop: the surface signs inline within the user action
and reports the outcome there (Android's post-member model:
event-driven, no background fetch). Material a failed signing
leaves parked surfaces on Home as a resume card.

The signing orchestration lives in `src/lib/signing/` (write
signer, registration signer, flow) over the custody store in
`src/lib/identity/`; handshake material — the private nonce and
pre-signature, keyed by staged-write id — persists in IndexedDB
before the submit, so the approve step verifies against what THIS
browser pre-signed across page reloads. One write signer serves
the whole app — `resume()` spans every persisted handshake,
whichever surface started it.

## Design guidelines

[design.md](design.md) is the design system both clients
implement — colour tokens, type, shape, motion, components,
copy rules, and the stance control. Read it before writing UI.
Web-side: the Material 3 roles land as CSS custom properties in
`globals.css`, shared components live in `src/lib/ui/`, and a
raw Tailwind palette class in a component is a bug — screens
read roles, never colours.

**Transport faults never blank loaded content** (the shared rule —
[android.md "Degrade, never crash"](android.md#degrade-never-crash)):
a read surface that already holds content keeps showing it when a
refresh or page fetch fails; the full transport error is reserved
for the nothing-loaded state. The fault surfaces where the failed
fetch was requested — a failed refresh on a non-blocking banner
above the content, a failed page fetch in place of the load-more
control, message plus retry; a failed submit is a composer error
beside its button, never a read fault. The fault reflects the
last *completed* fetch — it clears on success, never eagerly at
fetch start, so a failed retry never flashes the error surface.

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
