// The test environment's `fetch`: Node's own, with two things a suite needs
// that msw 3 makes visible. msw 3 sends every mocked request through
// undici's real send path and answers it off a mock socket, so a request is
// no longer resolved in the few ticks msw 2 took.
//
// 1. Under jsdom, Node's fetch cannot send a multipart body: jsdom's FormData
//    goes out as the string "[object FormData]", and a Node FormData holding
//    a Blob trips undici's own content-length check (vitest#5672 — out of
//    Vitest's scope; patching global fetch is the workaround it names).
//    Vitest's jsdom `Request` encodes either one correctly, so an upload is
//    sent as those encoded bytes instead.
// 2. A request a test fires and never awaits is still in flight when the
//    test ends, and would be answered by the NEXT test's handlers — into its
//    logs. `settleFetches` lets the per-file server wait for them before it
//    resets the handlers, so every request is answered by its own test.
//
// 3. A test whose code sends in a loop — a paging walk over a fixture that
//    never ends — spins until the worker's heap is gone, and where its chain
//    never yields a macrotask it starves every timer that could stop it, the
//    settle wait's among them (saved-view's stream test aborted CI this way).
//    So past `RUNAWAY_LIMIT` requests in one test the next one fails as a
//    network failure does — which ends any loop that stops on one — and the
//    test fails by name (`takeRunaway`, checked after each test).
//
// Installed once from setup.ts, beneath msw's own fetch patch (applied later
// at `listen()`), so msw still sees every request.

const inFlight = new Set<Promise<unknown>>();

/** Far past what any one test sends; past it, a test is sending in a loop. */
export const RUNAWAY_LIMIT = 1000;
let limit = RUNAWAY_LIMIT;
let sent = 0;
let runaway: string | null = null;

/** A fresh count for the next test; a test of the guard itself lowers the limit. */
export function resetRequestCountForTests(nextLimit: number = RUNAWAY_LIMIT): void {
  limit = nextLimit;
  sent = 0;
  runaway = null;
}

/** The runaway this test ran into, if any — taken, so it is reported once. */
export function takeRunaway(): string | null {
  const found = runaway;
  runaway = null;
  return found;
}

// The real clock, captured before any suite fakes timers: the wait below must
// run out even when a test left fake timers installed.
const realSetTimeout = globalThis.setTimeout;
const realNow = Date.now.bind(Date);

function isMultipart(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (init?.body != null) {
    return Object.prototype.toString.call(init.body) === "[object FormData]";
  }
  return (
    input instanceof Request &&
    (input.headers.get("content-type")?.startsWith("multipart/form-data") ?? false)
  );
}

export function installTestFetch() {
  const nodeFetch = globalThis.fetch;
  const reencode = typeof window !== "undefined";

  async function send(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (!reencode || !isMultipart(input, init)) return nodeFetch(input, init);
    const request = new Request(input, init);
    return nodeFetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: await request.arrayBuffer(),
      signal: request.signal,
    });
  }

  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    sent += 1;
    if (sent > limit) {
      runaway ??= `a request loop: more than ${limit} requests sent in one test, the one past them to ${
        input instanceof Request ? input.url : String(input)
      }`;
      return Promise.reject(new TypeError("fetch failed", { cause: new Error(runaway) }));
    }
    const answer = send(input, init);
    // In flight until the answer's body has fully arrived, not just its
    // headers: the caller acts on the body. The clone is taken before the
    // caller's own continuation runs, since this one is attached first.
    const delivered: Promise<unknown> = answer.then(
      (response) => response.clone().arrayBuffer().catch(() => undefined),
      () => undefined,
    );
    inFlight.add(delivered);
    void delivered.then(() => inFlight.delete(delivered));
    return answer;
  };
}

/**
 * Wait until every request already sent has its answer delivered and its
 * caller has had a turn to act on it — including any request that turn sends
 * (a ranking's answer asks for its window) — or until `limitMs` passes.
 */
export async function settleFetches(limitMs = 5000): Promise<void> {
  const deadline = realNow() + limitMs;
  while (inFlight.size > 0) {
    const left = deadline - realNow();
    if (left <= 0) return;
    await Promise.race([
      Promise.allSettled([...inFlight]),
      new Promise((resolve) => realSetTimeout(resolve, left)),
    ]);
    if (inFlight.size === 0) await new Promise((resolve) => realSetTimeout(resolve, 0));
  }
}
