// A tab whose browser refuses storage must still load and keep a session for
// the life of the page. The module-level `tokenStore` is built at import, so
// the import itself is what has to survive.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { blockStorage } from "@/test/blocked-storage";

const auth = { accessToken: "access-1", refreshToken: "refresh-1", accountId: "acct-1" };

let unblock: () => void;

beforeEach(() => {
  vi.resetModules();
  unblock = blockStorage("localStorage");
});

afterEach(() => unblock());

describe("token store with blocked storage", () => {
  it("imports without throwing and starts signed out", async () => {
    const { tokenStore } = await import("./token-store");
    expect(tokenStore.hasSession()).toBe(false);
    expect(tokenStore.refreshToken()).toBeNull();
  });

  it("holds the session in memory for the life of the page", async () => {
    const { createTokenStore } = await import("./token-store");
    const store = createTokenStore();
    store.save(auth);
    expect(store.hasSession()).toBe(true);
    expect(store.refreshToken()).toBe("refresh-1");
    expect(store.activeAccountId()).toBe("acct-1");
    expect(store.accessToken()).toBe("access-1");
    store.clear();
    expect(store.hasSession()).toBe(false);
    expect(store.activeAccountId()).toBeNull();
  });
});
