// Per-file MSW server for network-boundary tests; call inside a
// describe/file scope.

import { setupServer } from "msw/node";
import type { RequestHandler } from "msw";
import { afterAll, afterEach, beforeAll } from "vitest";

import { GRAPH_IDS } from "./graph-ids";
import { NOBODY_HIDDEN } from "./hidden";

export { gqlLink } from "./gql-link";

export function startMswServer(...handlers: RequestHandler[]) {
  // The shared defaults go last: a file's own handler for either wins.
  const server = setupServer(...handlers, NOBODY_HIDDEN, ...GRAPH_IDS);
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}
