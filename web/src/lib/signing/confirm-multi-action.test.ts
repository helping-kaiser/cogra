import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_CONFIRM_MULTI_ACTION,
  readConfirmMultiAction,
  writeConfirmMultiAction,
} from "./confirm-multi-action";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("the multi-action confirmation preference", () => {
  it("asks by default — the cost should not arrive unannounced", () => {
    expect(DEFAULT_CONFIRM_MULTI_ACTION).toBe(true);
    expect(readConfirmMultiAction()).toBe(true);
  });

  it("round-trips the reader's choice", () => {
    writeConfirmMultiAction(false);
    expect(readConfirmMultiAction()).toBe(false);
    writeConfirmMultiAction(true);
    expect(readConfirmMultiAction()).toBe(true);
  });

  it("falls back to the default on a value it did not write", () => {
    window.localStorage.setItem("cogra.confirmMultiActionSubmits", "perhaps");
    expect(readConfirmMultiAction()).toBe(DEFAULT_CONFIRM_MULTI_ACTION);
  });

  // A browser with site data blocked throws on the access itself; losing
  // a preference must never take the composer down with it.
  it("survives a storage that throws on read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readConfirmMultiAction()).toBe(DEFAULT_CONFIRM_MULTI_ACTION);
  });

  it("survives a storage that throws on write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => writeConfirmMultiAction(false)).not.toThrow();
  });
});
