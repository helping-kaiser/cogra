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
// Installed once from setup.ts, beneath msw's own fetch patch (applied later
// at `listen()`), so msw still sees every request.

const inFlight = new Set<Promise<unknown>>();

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
    const sent = send(input, init);
    inFlight.add(sent);
    sent.then(
      () => inFlight.delete(sent),
      () => inFlight.delete(sent),
    );
    return sent;
  };
}

/** Wait until every request already sent has its answer, or `limitMs` passes. */
export async function settleFetches(limitMs = 5000): Promise<void> {
  const deadline = realNow() + limitMs;
  while (inFlight.size > 0) {
    const left = deadline - realNow();
    if (left <= 0) return;
    await Promise.race([
      Promise.allSettled([...inFlight]),
      new Promise((resolve) => realSetTimeout(resolve, left)),
    ]);
  }
}
