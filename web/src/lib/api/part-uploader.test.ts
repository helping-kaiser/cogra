import { describe, expect, it, vi } from "vitest";

import { createPartUploader, uploadsOrigin } from "./part-uploader";
import { MAX_ATTEMPTS, delayMs } from "./upload-retry";

// The clock is a list rather than a timer: every wait is recorded and returns
// immediately, so a suite that exercises a whole 31-second retry budget costs
// nothing and the schedule itself can be asserted. `random` is pinned too, so
// the jitter is a fixed roll rather than a source of flake.
function harness(
  responses: readonly (Response | Error)[],
  options: { random?: number; blob?: Blob; partSize?: number; partCount?: number } = {},
) {
  const waits: number[] = [];
  const requests: { url: string; init: RequestInit }[] = [];
  let call = 0;
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });
    const next = responses[Math.min(call, responses.length - 1)];
    call += 1;
    if (next instanceof Error) throw next;
    return next as Response;
  }) as unknown as typeof fetch;

  const uploader = createPartUploader({
    origin: "https://api.example",
    accessToken: () => "tok",
    sleep: async (ms) => {
      waits.push(ms);
    },
    random: () => options.random ?? 0,
    fetchImpl,
  });

  const size = 10;
  const blob = options.blob ?? new Blob([new Uint8Array(size) as BlobPart]);
  return {
    waits,
    requests,
    fetchImpl,
    run: () =>
      uploader.sendAll("up-1", blob, options.partSize ?? 4, options.partCount ?? 3),
  };
}

const ok = () => new Response(null, { status: 200 });
const status = (code: number) => new Response(null, { status: code });

describe("uploadsOrigin", () => {
  it("takes the origin of an absolute endpoint", () => {
    expect(uploadsOrigin("https://api.example:8443/graphql")).toBe("https://api.example:8443");
  });

  it("stays same-origin for the browser's relative endpoint", () => {
    // The browser talks to `/graphql` through the rewrite; the part route has
    // to go through the same origin or the phone's one trusted certificate
    // does not cover it.
    expect(uploadsOrigin("/graphql")).toBe("");
  });
});

describe("sendAll", () => {
  it("sends every part in order, sequentially, at the dictated cut", async () => {
    const h = harness([ok()]);
    expect(await h.run()).toBeNull();

    expect(h.requests.map((r) => r.url)).toEqual([
      "https://api.example/media/uploads/up-1/parts/1",
      "https://api.example/media/uploads/up-1/parts/2",
      "https://api.example/media/uploads/up-1/parts/3",
    ]);
    // Every part but the last is exactly the dictated size; the last is what
    // remains. Any other size is refused at the route.
    const sizes = await Promise.all(
      h.requests.map((r) => (r.init.body as Blob).size),
    );
    expect(sizes).toEqual([4, 4, 2]);
    // Nothing waited: the first attempt of each part is immediate.
    expect(h.waits).toEqual([]);
  });

  it("carries the bearer token and raw bytes", async () => {
    const h = harness([ok()]);
    await h.run();

    const first = h.requests[0]!;
    expect(first.init.method).toBe("PUT");
    expect(first.init.headers).toEqual({
      authorization: "Bearer tok",
      "content-type": "application/octet-stream",
    });
    expect(first.init.body).toBeInstanceOf(Blob);
  });

  it("re-reads the token per attempt, so a refresh mid-upload lands", async () => {
    const tokens = ["stale", "fresh", "fresh"];
    let read = 0;
    const uploader = createPartUploader({
      origin: "",
      accessToken: () => tokens[Math.min(read++, tokens.length - 1)]!,
      sleep: async () => {},
      random: () => 0,
      fetchImpl: vi.fn(async () => status(200)) as unknown as typeof fetch,
    });
    await uploader.sendAll("up-1", new Blob([new Uint8Array(2) as BlobPart]), 1, 2);
    expect(read).toBe(2);
  });
});

describe("retry", () => {
  it("retries a transport fault on the equal-jitter schedule and succeeds", async () => {
    // Two network faults, then the part lands.
    const h = harness([new TypeError("network"), new TypeError("network"), ok()], {
      partCount: 1,
      partSize: 10,
      random: 0,
    });
    expect(await h.run()).toBeNull();
    // Attempt 1 waits nothing; attempts 2 and 3 wait the floor of their window.
    expect(h.waits).toEqual([delayMs(2, 0), delayMs(3, 0)]);
    expect(h.requests).toHaveLength(3);
  });

  it("randomises the second half of each wait", async () => {
    const h = harness([new TypeError("network"), ok()], {
      partCount: 1,
      partSize: 10,
      random: 1,
    });
    await h.run();
    expect(h.waits).toEqual([delayMs(2, 1)]);
  });

  it("spends exactly the budget on a link that never comes back, then gives up", async () => {
    const h = harness([new TypeError("network")], { partCount: 1, partSize: 10 });
    expect(await h.run()).toBe("The upload could not reach the server.");
    expect(h.requests).toHaveLength(MAX_ATTEMPTS);
    expect(h.waits).toHaveLength(MAX_ATTEMPTS - 1);
    expect(h.waits.reduce((a, b) => a + b, 0)).toBe(15_500);
  });

  it("retries a 5xx, because the server may yet answer", async () => {
    const h = harness([status(503), status(500), ok()], { partCount: 1, partSize: 10 });
    expect(await h.run()).toBeNull();
    expect(h.requests).toHaveLength(3);
  });

  it("retries a 401 exactly once more, because the guard refreshes around this", async () => {
    const h = harness([status(401), ok()], { partCount: 1, partSize: 10 });
    expect(await h.run()).toBeNull();
    expect(h.requests).toHaveLength(2);
  });

  it("stops at the first part that gives up, rather than burning the budget on the rest", async () => {
    const h = harness([new TypeError("network")], { partCount: 3, partSize: 4 });
    await h.run();
    // Six attempts, all on part 1.
    expect(h.requests).toHaveLength(MAX_ATTEMPTS);
    expect(new Set(h.requests.map((r) => r.url)).size).toBe(1);
  });
});

describe("refusals", () => {
  // The route answers 4xx with a `UserError`-shaped body, and the codes it
  // can carry — NOT_FOUND, BAD_INPUT, FORBIDDEN — are all terminal: the
  // request was wrong, and repeating it changes nothing but the clock.
  it.each([
    ["a session that does not exist", 404],
    ["a part of the wrong size", 400],
    ["an account that may not upload", 403],
  ])("aborts on %s without a single retry", async (_name, code) => {
    const h = harness([status(code)], { partCount: 3, partSize: 4 });
    expect(await h.run()).toBe("The server would not take that video.");
    expect(h.requests).toHaveLength(1);
    expect(h.waits).toEqual([]);
  });

  it("treats anything below 500 as an answer rather than a fault", async () => {
    const h = harness([status(302)], { partCount: 1, partSize: 10 });
    expect(await h.run()).toBe("The server would not take that video.");
    expect(h.requests).toHaveLength(1);
  });

  it("refuses a plan the bytes cannot fill instead of sending an empty part", async () => {
    // A part count larger than the blob divides into: the route would refuse
    // the zero-length part, but there is nothing to learn from asking.
    const h = harness([ok()], { partCount: 4, partSize: 4 });
    expect(await h.run()).toBe("That file could not be read as a video.");
    expect(h.requests).toHaveLength(3);
  });
});
