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
    store.save({ accessToken: "before", refreshToken: "r" });
    const { refresher, refresh } = refresherReturning(false);
    const guard = createGuard(store, refresher);
    await guard.run(async () => {
      store.save({ accessToken: "after", refreshToken: "r2" });
      return unauthenticated();
    });
    expect(refresh).toHaveBeenCalledWith("before");
  });
});
