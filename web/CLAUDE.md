@AGENTS.md

# web/CLAUDE.md

Web-specific assistant rules. The root [CLAUDE.md](../CLAUDE.md)
holds the shared mission, design boundaries, and workflow rules —
they apply here too; this file adds only what is specific to the
web app. The design rationale is
[docs/implementation/web.md](../docs/implementation/web.md).

Re-read the root CLAUDE.md and this file at the start of every web
task.

---

## Follow the platform guidelines

Build the way the framework documents, not by improvisation — and
per [AGENTS.md](AGENTS.md) above, this Next.js version may differ
from training data: read the relevant guide in
`node_modules/next/dist/docs/` before writing code against an API.
For Apollo Client and GraphQL Code Generator, their own docs are
the source of truth. If a prior decision or request would have us
do something other than the documented, idiomatic way, say so and
get agreement before building it.

## The contract is generated

`schema.graphql` at the repo root is the single source of truth
for the API surface; `npm run codegen` (GraphQL Code Generator,
client preset) generates typed operations from it into
`src/__generated__/` — gitignored, regenerated in CI and by the
`predev` hook on every `npm run dev`, **never hand-edited**, and
never a second schema copy. The predev hook exists because the
gitignored artifacts silently go stale after a pull — a compiled
query then omits fields the source `.graphql` asks for. Operation
documents live in `src/lib/graphql/` or as `graphql()` calls in
components.

## Layout

- `src/app/` — routes (App Router); pages stay thin.
- `src/lib/` — Apollo wiring, domain helpers, shared UI.

Nothing is scaffolded ahead of the surface that needs it.

## Tests ship with the code

Per the shared rule, tests land with the change:

- Components and helpers: Vitest + React Testing Library
  (`npm test`).
- Network: MSW against the generated operations.
- Crypto: golden-vector tests that read the repo-root
  `client-crypto-vectors.json` — never copy vector values into
  test code.
- Colour: `src/lib/ui/design-tokens.test.ts` generates the repo-root
  `design-tokens.json` (`make tokens`) and `palette.test.ts` pins
  `globals.css` to it. Never transcribe a colour, and never write a
  raw Tailwind palette class in a component — screens read roles.
- Type: `type.test.ts` pins the fifteen M3 roles in `globals.css` to
  `@material/web`'s typescale tokens, and fails on a `text-sm`,
  `font-medium`, or `tracking-*` left in a screen. Screens read type
  roles (`text-body-medium`) the same way they read colour roles.
- Bind assertions to roles/test ids, not display copy, where copy
  is still in flux.
