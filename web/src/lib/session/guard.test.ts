import { beforeEach, describe, expect, it, vi } from "vitest";

import { failed, refused, success, unauthenticated, type Outcome } from "@/lib/api/outcome";
import { createGuard } from "./guard";
import { createTokenStore } from "./token-store";
import type { Refresher } from "./refresher";

beforeEach(() => {
  window.localStorage.clear();
});

function refresherReturning(result: boolean) {
  const refresh = vi.fn<Refresher["refresh"]>().mockResolvedValue(result);
  return { refresher: { refresh }, refresh };
}

describe("auth guard", () => {
  it("passes success through without refreshing", async () => {
    const store = createTokenStore();
    const { refresher, refresh } = refresherReturning(true);
    const guard = createGuard(store, refresher);
    const outcome = await guard.run(async () => success("v"));
    expect(outcome).toEqual(success("v"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("passes other refusals through", async () => {
    const store = createTokenStore();
    const { refresher, refresh } = refresherReturning(true);
    const guard = createGuard(store, refresher);
    const refusal = refused([{ code: "FORBIDDEN", message: "not yours", field: null }]);
    expect(await guard.run(async () => refusal)).toBe(refusal);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("never treats a RATE_LIMITED refusal like UNAUTHENTICATED — no refresh, no replay", async () => {
    const store = createTokenStore();
    const { refresher, refresh } = refresherReturning(true);
    const guard = createGuard(store, refresher);
    const refusal = refused([{ code: "RATE_LIMITED", message: "backoff", field: null }]);
    const block = vi.fn<() => Promise<Outcome<string>>>().mockResolvedValue(refusal);
    expect(await guard.run(block)).toBe(refusal);
    expect(block).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("never refreshes on a transport failure", async () => {
    const store = createTokenStore();
    const { refresher, refresh } = refresherReturning(true);
    const guard = createGuard(store, refresher);
    const failure = failed(new Error("offline"));
    expect(await guard.run(async () => failure)).toBe(failure);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes once and replays once on UNAUTHENTICATED", async () => {
    const store = createTokenStore();
    const { refresher, refresh } = refresherReturning(true);
    const guard = createGuard(store, refresher);
    const block = vi
      .fn<() => Promise<Outcome<string>>>()
      .mockResolvedValueOnce(unauthenticated())
      .mockResolvedValueOnce(success("replayed"));
    expect(await guard.run(block)).toEqual(success("replayed"));
    expect(block).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("surfaces the original refusal when the refresh fails", async () => {
    const store = createTokenStore();
    const { refresher } = refresherReturning(false);
    const guard = createGuard(store, refresher);
    const block = vi.fn<() => Promise<Outcome<string>>>().mockResolvedValue(unauthenticated());
    const outcome = await guard.run(block);
    expect(outcome.kind).toBe("refused");
    expect(block).toHaveBeenCalledTimes(1);
  });

  it("gives up after a still-unauthenticated replay — never a loop", async () => {
    const store = createTokenStore();
    const { refresher, refresh } = refresherReturning(true);
    const guard = createGuard(store, refresher);
    const block = vi.fn<() => Promise<Outcome<string>>>().mockResolvedValue(unauthenticated());
    const outcome = await guard.run(block);
    expect(outcome.kind).toBe("refused");
    expect(block).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("hands the refresher the access token from before the first call", async () => {
    const store = createTokenStore();
    store.save({ accessToken: "before", refreshToken: "r", accountId: "acct-1" });
    const { refresher, refresh } = refresherReturning(false);
    const guard = createGuard(store, refresher);
    await guard.run(async () => {
      store.save({ accessToken: "after", refreshToken: "r2", accountId: "acct-1" });
      return unauthenticated();
    });
    expect(refresh).toHaveBeenCalledWith("before");
  });
});

// F3-2: `run` learns the token was missing from the SERVER'S ANSWER, which
// arrives only after the whole body has been transferred — so a video went up
// once to be refused and once to land. `prime` is what stops the send that was
// known to be wasted before it was made.
describe("priming a token before a body goes up", () => {
  it("refreshes when this tab holds no access token", async () => {
    const store = createTokenStore();
    const { refresher, refresh } = refresherReturning(true);
    const guard = createGuard(store, refresher);

    await guard.prime();

    expect(refresh).toHaveBeenCalledTimes(1);
    // Null, not a stale value: there is nothing to compare against, and the
    // refresher's "someone else already rotated it" shortcut must not fire.
    expect(refresh).toHaveBeenCalledWith(null);
  });

  it("does nothing when a token is already in hand", async () => {
    const store = createTokenStore();
    store.save({ accessToken: "a", refreshToken: "r", accountId: "acct-1" });
    const { refresher, refresh } = refresherReturning(true);
    const guard = createGuard(store, refresher);

    await guard.prime();

    expect(refresh).not.toHaveBeenCalled();
  });

  // Ten pictures start at once. Rotating the pair ten times would spend nine
  // refresh tokens for nothing — and reuse of a rotated token is exactly what
  // a session's replay detection treats as theft.
  it("refreshes once for however many uploads start together", async () => {
    const store = createTokenStore();
    const { refresher, refresh } = refresherReturning(true);
    const guard = createGuard(store, refresher);

    await Promise.all([guard.prime(), guard.prime(), guard.prime()]);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  // A signed-out tab has no refresh token either. The call still goes out and
  // is still refused — priming removes a wasted send, never a refusal.
  it("gives up quietly when there is nothing to refresh with", async () => {
    const store = createTokenStore();
    const { refresher } = refresherReturning(false);
    const guard = createGuard(store, refresher);

    await expect(guard.prime()).resolves.toBeUndefined();
  });

  // The chain primes for EVERY request now, the replay inside `run` included.
  // A prime that rotated behind a refresh already under way would spend a
  // second refresh token on the same expiry — so it stands down for as long
  // as this tab holds any token at all, and lets `run` own the expiry.
  it("stands down while a run is already handling the expiry", async () => {
    const store = createTokenStore();
    store.save({ accessToken: "stale", refreshToken: "r", accountId: "acct-1" });
    const { refresher, refresh } = refresherReturning(true);
    const guard = createGuard(store, refresher);
    const block = vi
      .fn<() => Promise<Outcome<string>>>()
      .mockResolvedValueOnce(unauthenticated())
      .mockResolvedValueOnce(success("replayed"));

    const outcome = await guard.run(async () => {
      await guard.prime();
      return block();
    });

    expect(outcome).toEqual(success("replayed"));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("primes again on a later upload once the first attempt is done", async () => {
    const store = createTokenStore();
    const { refresher, refresh } = refresherReturning(false);
    const guard = createGuard(store, refresher);

    await guard.prime();
    await guard.prime();

    // The single-flight latch is for callers that overlap, not a once-ever
    // gate: a tab still holding no token must try again rather than give up
    // and send anonymous for the rest of its life.
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
