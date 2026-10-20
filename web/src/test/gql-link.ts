// The GraphQL link every test handler is defined on. msw 3 mocks GraphQL
// through a link (no root-level `query`/`mutation`); the wildcard matches
// the endpoint regardless of origin, as the unscoped handlers did. Scope it
// here if the tests ever need to tell endpoints apart.
//
// A leaf module rather than part of msw.ts: the shared default handlers
// (graph-ids.ts, hidden.ts) are built at import time and msw.ts imports
// them, so defining the link there would be an import cycle.

import { graphql } from "msw/graphql";

export const gqlLink = graphql.link("*");
