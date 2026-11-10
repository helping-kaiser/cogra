import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { blockStorage } from "@/test/blocked-storage";

let unblock: () => void;

beforeEach(() => {
  vi.resetModules();
  unblock = blockStorage("localStorage");
});

afterEach(() => unblock());

describe("device preferences with blocked storage", () => {
  it("reads the fallback instead of throwing", async () => {
    const { themePreference } = await import("./device-preference");
    expect(themePreference.read()).toBe("auto");
  });

  it("keeps a choice for the life of the page rather than throwing on write", async () => {
    const { themePreference } = await import("./device-preference");
    expect(() => themePreference.write("dark")).not.toThrow();
    expect(themePreference.read()).toBe("dark");
  });
});

describe("the stance input mode with blocked storage", () => {
  it("reads the pad, and keeps a choice for the life of the page", async () => {
    const { readStanceInputMode, writeStanceInputMode } = await import("../stance/input-mode");
    expect(readStanceInputMode()).toBe("pad");
    expect(() => writeStanceInputMode("entry")).not.toThrow();
    expect(readStanceInputMode()).toBe("entry");
  });
});

describe("the stance coach flag with blocked storage", () => {
  it("reads untaught, and remembers the lesson for the life of the page", async () => {
    const { readStanceTaught, writeStanceTaught } = await import("../stance/stance-coach");
    expect(readStanceTaught()).toBe(false);
    expect(() => writeStanceTaught()).not.toThrow();
    expect(readStanceTaught()).toBe(true);
  });
});
