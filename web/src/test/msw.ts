// Per-file MSW server for network-boundary tests; call inside a
// describe/file scope.

import { graphql } from "msw/graphql";
import { setupServer } from "msw/node";
import type { RequestHandler } from "msw";
import { afterAll, afterEach, beforeAll } from "vitest";

/**
 * The GraphQL link every test handler is defined on. msw 3 mocks GraphQL
 * through a link (no root-level `query`/`mutation`); the wildcard matches
 * the endpoint regardless of origin, as the unscoped handlers did. Scope it
 * here if the tests ever need to tell endpoints apart.
 */
export const gqlLink = graphql.link("*");

export function startMswServer(...handlers: RequestHandler[]) {
  const server = setupServer(...handlers);
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}
