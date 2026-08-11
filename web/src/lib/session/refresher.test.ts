import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { failed, refused, success } from "@/lib/api/outcome";
import { createRefresher, type RefreshExecutor } from "./refresher";
import { createTokenStore } from "./token-store";

const pair = (n: number) => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  accountId: "acct-1",
});

const refreshTokenInvalid = () =>
  refused([{ code: "REFRESH_TOKEN_INVALID", message: "rotated", field: null }]);

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refresher", () => {
  it("short-circuits to false when signed out", async () => {
    const store = createTokenStore();
    const exec = vi.fn<RefreshExecutor>();
    const refresher = createRefresher(store, exec);
    expect(await refresher.refresh(null)).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it("rotates and saves both tokens on success", async () => {
    const store = createTokenStore();
    store.save(pair(1));
    const exec = vi.fn<RefreshExecutor>().mockResolvedValue(success(pair(2)));
    const refresher = createRefresher(store, exec);
    expect(await refresher.refresh("access-1")).toBe(true);
    expect(exec).toHaveBeenCalledWith("refresh-1");
    expect(store.accessToken()).toBe("access-2");
    expect(store.refreshToken()).toBe("refresh-2");
  });

  it("skips the network when the pair already rotated", async () => {
    const store = createTokenStore();
    store.save(pair(2));
    const exec = vi.fn<RefreshExecutor>();
    const refresher = createRefresher(store, exec);
    expect(await refresher.refresh("access-1")).toBe(true);
    expect(exec).not.toHaveBeenCalled();
  });

  it("shares one refresh between concurrent callers", async () => {
    const store = createTokenStore();
    store.save(pair(1));
    let release: (value: ReturnType<typeof success<ReturnType<typeof pair>>>) => void;
    const exec = vi.fn<RefreshExecutor>().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const refresher = createRefresher(store, exec);
    const first = refresher.refresh("access-1");
    const second = refresher.refresh("access-1");
    await Promise.resolve();
    release!(success(pair(2)));
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it("signs the device out only on REFRESH_TOKEN_INVALID", async () => {
    const store = createTokenStore();
    store.save(pair(1));
    const exec = vi.fn<RefreshExecutor>().mockResolvedValue(refreshTokenInvalid());
    const refresher = createRefresher(store, exec);
    expect(await refresher.refresh("access-1")).toBe(false);
    expect(store.hasSession()).toBe(false);
  });

  it("runs the invalidation hook before the clear, account still active", async () => {
    const store = createTokenStore();
    store.save(pair(1));
    const seen: (string | null)[] = [];
    const onInvalidated = vi.fn(() => {
      seen.push(store.activeAccountId());
      return Promise.resolve();
    });
    const exec = vi.fn<RefreshExecutor>().mockResolvedValue(refreshTokenInvalid());
    const refresher = createRefresher(store, exec, onInvalidated);
    expect(await refresher.refresh("access-1")).toBe(false);
    // The "don't remember me" purge resolves custody by the active
    // account — it must still be readable inside the hook.
    expect(seen).toEqual(["acct-1"]);
    expect(store.hasSession()).toBe(false);
    expect(store.activeAccountId()).toBeNull();
  });

  it("skips the invalidation hook on other refusals and failures", async () => {
    const store = createTokenStore();
    store.save(pair(1));
    const onInvalidated = vi.fn(() => Promise.resolve());
    const exec = vi
      .fn<RefreshExecutor>()
      .mockResolvedValueOnce(refused([{ code: "RATE_LIMITED", message: "backoff", field: null }]))
      .mockResolvedValueOnce(failed(new Error("offline")));
    const refresher = createRefresher(store, exec, onInvalidated);
    await refresher.refresh("access-1");
    await refresher.refresh("access-1");
    expect(onInvalidated).not.toHaveBeenCalled();
    expect(store.hasSession()).toBe(true);
  });

  it("clears the dead session even when the invalidation hook fails", async () => {
    const store = createTokenStore();
    store.save(pair(1));
    const onInvalidated = vi.fn(() => Promise.reject(new Error("idb broke")));
    const exec = vi.fn<RefreshExecutor>().mockResolvedValue(refreshTokenInvalid());
    const refresher = createRefresher(store, exec, onInvalidated);
    expect(await refresher.refresh("access-1")).toBe(false);
    expect(store.hasSession()).toBe(false);
  });

  it("keeps the session on any other refusal", async () => {
    const store = createTokenStore();
    store.save(pair(1));
    const exec = vi
      .fn<RefreshExecutor>()
      .mockResolvedValue(refused([{ code: "RATE_LIMITED", message: "backoff", field: null }]));
    const refresher = createRefresher(store, exec);
    expect(await refresher.refresh("access-1")).toBe(false);
    expect(store.hasSession()).toBe(true);
    expect(store.refreshToken()).toBe("refresh-1");
  });

  it("keeps the session on a transport failure — offline never signs out", async () => {
    const store = createTokenStore();
    store.save(pair(1));
    const exec = vi.fn<RefreshExecutor>().mockResolvedValue(failed(new Error("offline")));
    const refresher = createRefresher(store, exec);
    expect(await refresher.refresh("access-1")).toBe(false);
    expect(store.hasSession()).toBe(true);
  });

  it("runs the network call under the Web Lock and re-reads the stored token", async () => {
    const store = createTokenStore();
    store.save(pair(1));
    const request = vi.fn(
      (_name: string, callback: () => Promise<unknown>): Promise<unknown> => {
        // Another tab rotated while we waited for the lock.
        store.save(pair(2));
        return callback();
      },
    );
    vi.stubGlobal("navigator", { ...navigator, locks: { request } });
    const exec = vi.fn<RefreshExecutor>().mockResolvedValue(success(pair(3)));
    const refresher = createRefresher(store, exec);
    expect(await refresher.refresh(null)).toBe(true);
    expect(request).toHaveBeenCalledWith("cogra-session-refresh", expect.any(Function));
    expect(exec).toHaveBeenCalledWith("refresh-2");
  });
});
