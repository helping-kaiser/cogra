import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "./token-store";

const REFRESH_KEY = "cogra.refreshToken";
const ACCOUNT_KEY = "cogra.activeAccount";
const auth = { accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" };

beforeEach(() => {
  window.localStorage.clear();
});

describe("token store", () => {
  it("starts signed out", () => {
    const store = createTokenStore();
    expect(store.hasSession()).toBe(false);
    expect(store.accessToken()).toBeNull();
    expect(store.refreshToken()).toBeNull();
    expect(store.activeAccountId()).toBeNull();
  });

  it("persists the refresh token and account id, access token in memory", () => {
    const store = createTokenStore();
    store.save(auth);
    expect(window.localStorage.getItem(REFRESH_KEY)).toBe("refresh-1");
    expect(window.localStorage.getItem(ACCOUNT_KEY)).toBe("acct-1");
    expect(store.accessToken()).toBe("access-1");
    expect(store.activeAccountId()).toBe("acct-1");
    expect(store.hasSession()).toBe(true);
  });

  it("clear forgets the tokens and the account", () => {
    const store = createTokenStore();
    store.save(auth);
    store.clear();
    expect(window.localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(window.localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(store.accessToken()).toBeNull();
    expect(store.activeAccountId()).toBeNull();
    expect(store.hasSession()).toBe(false);
  });

  it("treats a pre-multi-account refresh token as absent at creation", () => {
    // The legacy layout stored the token without an account id; one
    // re-login is the accepted migration cost.
    window.localStorage.setItem(REFRESH_KEY, "legacy-token");
    const store = createTokenStore();
    expect(window.localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(store.hasSession()).toBe(false);
  });

  it("drops an orphan account id at creation", () => {
    window.localStorage.setItem(ACCOUNT_KEY, "acct-orphan");
    const store = createTokenStore();
    expect(window.localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(store.activeAccountId()).toBeNull();
  });

  it("notifies subscribers on save and clear, until unsubscribed", () => {
    const store = createTokenStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.save(auth);
    store.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.save(auth);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("drops the in-memory access token when another tab signs out", () => {
    const store = createTokenStore();
    store.save(auth);
    const listener = vi.fn();
    store.subscribe(listener);
    // Simulate the other tab: the key is gone and its storage event arrives.
    window.localStorage.removeItem(REFRESH_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: REFRESH_KEY, newValue: null }));
    expect(store.accessToken()).toBeNull();
    expect(store.hasSession()).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it("drops the access token when another tab switches the active account", () => {
    const store = createTokenStore();
    store.save(auth);
    const listener = vi.fn();
    store.subscribe(listener);
    window.localStorage.setItem(ACCOUNT_KEY, "acct-2");
    window.localStorage.setItem(REFRESH_KEY, "refresh-2");
    window.dispatchEvent(
      new StorageEvent("storage", { key: ACCOUNT_KEY, oldValue: "acct-1", newValue: "acct-2" }),
    );
    expect(listener).toHaveBeenCalled();
    expect(store.activeAccountId()).toBe("acct-2");
    // Account A's token must never authenticate calls made as account B;
    // the guard refreshes with account B's refresh token instead.
    expect(store.accessToken()).toBeNull();
    expect(store.hasSession()).toBe(true);
  });

  it("keeps the access token when another tab only rotates the refresh token", () => {
    const store = createTokenStore();
    store.save(auth);
    window.localStorage.setItem(REFRESH_KEY, "refresh-2");
    window.dispatchEvent(
      new StorageEvent("storage", { key: REFRESH_KEY, oldValue: "refresh-1", newValue: "refresh-2" }),
    );
    // Same account, rotated session — the access token is still valid.
    expect(store.accessToken()).toBe("access-1");
    expect(store.refreshToken()).toBe("refresh-2");
  });

  it("ignores storage events for unrelated keys", () => {
    const store = createTokenStore();
    store.save(auth);
    const listener = vi.fn();
    store.subscribe(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "x" }));
    expect(listener).not.toHaveBeenCalled();
    expect(store.accessToken()).toBe("access-1");
  });
});
