// Per-file MSW server for tests that exercise the network boundary
// (web/CLAUDE.md: network is mocked with MSW against the generated
// operations). Call inside a describe/file scope.

import { setupServer } from "msw/node";
import type { RequestHandler } from "msw";
import { afterAll, afterEach, beforeAll } from "vitest";

export function startMswServer(...handlers: RequestHandler[]) {
  const server = setupServer(...handlers);
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}
