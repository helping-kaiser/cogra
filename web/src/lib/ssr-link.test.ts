// @vitest-environment node

import { ApolloLink, execute, gql } from "@apollo/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SSR_READ_TIMEOUT_MS, ssrFetch, ssrLink } from "./ssr-link";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A fetch that never answers and rejects the way the platform does when aborted. */
function hanging(seen: AbortSignal[] = []): typeof fetch {
  return ((_input: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal === undefined || signal === null) return;
      seen.push(signal);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    })) as typeof fetch;
}

describe("the server-side read budget", () => {
  it("is the longest bounded wait the API itself ever makes", () => {
    // `RANKER_TIMEOUT_MS`'s default (crates/api/src/ranker_pod.rs): a read that
    // outlasts every bound the API owns is hung, not slow.
    expect(SSR_READ_TIMEOUT_MS).toBe(10_000);
  });
});

describe("ssrFetch", () => {
  it("aborts a request that outlasts the budget", async () => {
    const seen: AbortSignal[] = [];
    const call = ssrFetch(hanging(seen))("http://api/graphql");
    const settled = expect(call).rejects.toBeDefined();
    await vi.advanceTimersByTimeAsync(SSR_READ_TIMEOUT_MS - 1);
    expect(seen[0]!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await settled;
    expect(seen[0]!.aborted).toBe(true);
  });

  it("starts a fresh budget for every request, never one shared clock", async () => {
    const seen: AbortSignal[] = [];
    const fetcher = ssrFetch(hanging(seen));
    void fetcher("http://api/graphql").catch(() => {});
    await vi.advanceTimersByTimeAsync(SSR_READ_TIMEOUT_MS + 5_000);
    void fetcher("http://api/graphql").catch(() => {});
    expect(seen[0]!.aborted).toBe(true);
    expect(seen[1]!.aborted).toBe(false);
  });

  it("still honours a signal the caller passes", async () => {
    const seen: AbortSignal[] = [];
    const own = new AbortController();
    const call = ssrFetch(hanging(seen))("http://api/graphql", { signal: own.signal });
    const settled = expect(call).rejects.toBeDefined();
    own.abort(new Error("gone"));
    await settled;
    expect(seen[0]!.aborted).toBe(true);
  });

  it("passes the rest of the request through untouched", async () => {
    const inner = vi.fn(async () => new Response("{}"));
    await ssrFetch(inner as unknown as typeof fetch)("http://api/graphql", {
      method: "POST",
      body: "x",
    });
    expect(inner).toHaveBeenCalledWith(
      "http://api/graphql",
      expect.objectContaining({ method: "POST", body: "x", signal: expect.any(AbortSignal) }),
    );
  });
});

describe("ssrLink", () => {
  it("gives up on a hung API instead of holding the render open", async () => {
    vi.stubGlobal("fetch", hanging());
    const link: ApolloLink = ssrLink();
    const errors: unknown[] = [];
    const done = new Promise<void>((resolve) => {
      execute(link, { query: gql`query Q { __typename }` }).subscribe({
        error: (error) => {
          errors.push(error);
          resolve();
        },
      });
    });
    await vi.advanceTimersByTimeAsync(SSR_READ_TIMEOUT_MS);
    await done;
    expect(errors).toHaveLength(1);
  });
});
