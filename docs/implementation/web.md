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
- End-to-end (Playwright) is added when there are flows worth
  driving, not before.

## Rules

`web/CLAUDE.md` carries the web-specific assistant rules; the root
[CLAUDE.md](../../CLAUDE.md) holds the shared ones.
