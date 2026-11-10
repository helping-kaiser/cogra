import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { blockStorage } from "@/test/blocked-storage";
import { safeStorage } from "./safe-storage";

beforeEach(() => {
  safeStorage("local").clear();
  safeStorage("session").clear();
});

describe("safeStorage where storage works", () => {
  it("reads and writes through to the real store", () => {
    safeStorage().setItem("cogra.k", "v");
    expect(window.localStorage.getItem("cogra.k")).toBe("v");
    expect(safeStorage().getItem("cogra.k")).toBe("v");
    safeStorage().removeItem("cogra.k");
    expect(window.localStorage.getItem("cogra.k")).toBeNull();
  });

  it("keeps local and session apart", () => {
    safeStorage("session").setItem("cogra.k", "s");
    expect(safeStorage("local").getItem("cogra.k")).toBeNull();
    expect(window.sessionStorage.getItem("cogra.k")).toBe("s");
  });

  it("lists the real keys", () => {
    window.localStorage.setItem("a", "1");
    window.localStorage.setItem("b", "2");
    const store = safeStorage();
    expect(store.length).toBe(2);
    expect([store.key(0), store.key(1)].sort()).toEqual(["a", "b"]);
    expect(store.key(2)).toBeNull();
  });
});

describe("safeStorage where the browser refuses storage", () => {
  let unblock: () => void;
  beforeEach(() => {
    unblock = blockStorage("localStorage", "sessionStorage");
  });
  afterEach(() => unblock());

  it("never throws, and keeps values in memory for the page", () => {
    const store = safeStorage();
    expect(store.getItem("k")).toBeNull();
    expect(() => store.setItem("k", "v")).not.toThrow();
    expect(store.getItem("k")).toBe("v");
    expect(store.length).toBe(1);
    expect(store.key(0)).toBe("k");
    store.removeItem("k");
    expect(store.getItem("k")).toBeNull();
    expect(() => store.clear()).not.toThrow();
  });

  it("does the same for session storage", () => {
    const store = safeStorage("session");
    store.setItem("k", "v");
    expect(store.getItem("k")).toBe("v");
  });
});

describe("safeStorage where only a write is refused", () => {
  it("falls back to memory on a quota error and reads it back", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    try {
      const store = safeStorage();
      expect(() => store.setItem("k", "v")).not.toThrow();
      expect(store.getItem("k")).toBe("v");
    } finally {
      spy.mockRestore();
    }
    // A later write that lands persists, and the memory copy stops shadowing.
    safeStorage().setItem("k", "w");
    expect(window.localStorage.getItem("k")).toBe("w");
    safeStorage().removeItem("k");
    expect(safeStorage().getItem("k")).toBeNull();
  });
});

describe("safeStorage on the server", () => {
  it("answers nothing and keeps nothing, so no request sees another's value", () => {
    const store = safeStorage();
    vi.stubGlobal("window", undefined);
    try {
      store.setItem("k", "v");
      expect(store.getItem("k")).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(safeStorage().getItem("k")).toBeNull();
  });
});
