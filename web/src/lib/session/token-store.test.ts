import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTokenStore } from "./token-store";

const REFRESH_KEY = "cogra.refreshToken";
const pair = { accessToken: "access-1", refreshToken: "refresh-1" };

beforeEach(() => {
  window.localStorage.clear();
});

describe("token store", () => {
  it("starts signed out", () => {
    const store = createTokenStore();
    expect(store.hasSession()).toBe(false);
    expect(store.accessToken()).toBeNull();
    expect(store.refreshToken()).toBeNull();
  });

  it("persists the refresh token and keeps the access token in memory", () => {
    const store = createTokenStore();
    store.save(pair);
    expect(window.localStorage.getItem(REFRESH_KEY)).toBe("refresh-1");
    expect(store.accessToken()).toBe("access-1");
    expect(store.hasSession()).toBe(true);
  });

  it("clear forgets both halves", () => {
    const store = createTokenStore();
    store.save(pair);
    store.clear();
    expect(window.localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(store.accessToken()).toBeNull();
    expect(store.hasSession()).toBe(false);
  });

  it("notifies subscribers on save and clear, until unsubscribed", () => {
    const store = createTokenStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.save(pair);
    store.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.save(pair);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("drops the in-memory access token when another tab signs out", () => {
    const store = createTokenStore();
    store.save(pair);
    const listener = vi.fn();
    store.subscribe(listener);
    // Simulate the other tab: the key is gone and its storage event arrives.
    window.localStorage.removeItem(REFRESH_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: REFRESH_KEY, newValue: null }));
    expect(store.accessToken()).toBeNull();
    expect(store.hasSession()).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it("ignores storage events for unrelated keys", () => {
    const store = createTokenStore();
    store.save(pair);
    const listener = vi.fn();
    store.subscribe(listener);
    window.dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "x" }));
    expect(listener).not.toHaveBeenCalled();
    expect(store.accessToken()).toBe("access-1");
  });
});
