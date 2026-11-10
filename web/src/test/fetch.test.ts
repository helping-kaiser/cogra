// The test fetch's runaway guard (fetch.ts, 3): a test that sends in a loop
// ends at the limit with a network failure, and is named, instead of
// spinning the worker out of memory.

import { HttpResponse, http } from "msw/http";
import { afterEach, describe, expect, it } from "vitest";

import { resetRequestCountForTests, takeRunaway } from "./fetch";
import { startMswServer } from "./msw";

const PING = "http://localhost/ping";

// A page that always says there is another one — the endless fixture.
startMswServer(http.get(PING, () => HttpResponse.json({ hasMore: true })));

afterEach(() => resetRequestCountForTests());

describe("the test fetch's runaway guard", () => {
  it("a paging walk over an endless list ends at the limit, failed as a network failure", async () => {
    resetRequestCountForTests(5);
    let answered = 0;
    let failure: unknown = null;
    for (;;) {
      try {
        const page = (await (await fetch(PING)).json()) as { hasMore: boolean };
        answered += 1;
        if (!page.hasMore) break;
      } catch (error) {
        failure = error;
        break;
      }
    }
    expect(answered).toBe(5);
    expect(failure).toBeInstanceOf(TypeError);
    expect(takeRunaway()).toBe(
      `a request loop: more than 5 requests sent in one test, the one past them to ${PING}`,
    );
    // Taken once: the check after the test finds nothing left to report.
    expect(takeRunaway()).toBeNull();
  });

  it("a test under the limit has no runaway to report", async () => {
    resetRequestCountForTests(5);
    for (let i = 0; i < 5; i += 1) await fetch(PING);
    expect(takeRunaway()).toBeNull();
  });
});
