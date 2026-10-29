// Per-file MSW server for network-boundary tests; call inside a
// describe/file scope.

import { setupServer } from "msw/node";
import type { RequestHandler } from "msw";
import { afterAll, afterEach, beforeAll } from "vitest";

import { QUIET_CHROME } from "./chrome";
import { settleFetches } from "./fetch";
import { GRAPH_IDS } from "./graph-ids";
import { NOTHING_HELD } from "./held";
import { NOBODY_HIDDEN } from "./hidden";
import { NOTHING_INBOUND } from "./inbound";
import { NOTHING_PUBLISHED } from "./published";

export { gqlLink } from "./gql-link";

export function startMswServer(...handlers: RequestHandler[]) {
  // The shared defaults go last: a file's own handler for either wins.
  const server = setupServer(
    ...handlers,
    NOBODY_HIDDEN,
    ...GRAPH_IDS,
    ...NOTHING_PUBLISHED,
    ...NOTHING_INBOUND,
    ...NOTHING_HELD,
    ...QUIET_CHROME,
  );
  beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
  // A request the test left in flight is answered by its own handlers, not
  // the next test's.
  afterEach(async () => {
    await settleFetches();
    server.resetHandlers();
  });
  afterAll(() => server.close());
  return server;
}
