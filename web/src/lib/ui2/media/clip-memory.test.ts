// The session's clip memory (`clip-memory.ts`): keyed per clip, sticky about
// having played, forgotten per list on refresh and wholesale with the document.

import { afterEach, describe, expect, it, vi } from "vitest";

import * as clipMemory from "./clip-memory";

afterEach(() => {
  clipMemory.resetClipMemoryForTests();
});

describe("the clip memory", () => {
  it("knows nothing of a clip it has not met", () => {
    expect(clipMemory.read("m1")).toBeUndefined();
  });

  it("remembers where each clip stopped, keyed per clip", () => {
    clipMemory.write("m1", { time: 4.2, everPlayed: true });
    clipMemory.write("m2", { time: 9, everPlayed: true, playing: true });

    expect(clipMemory.read("m1")).toEqual({ time: 4.2, everPlayed: true });
    expect(clipMemory.read("m2")).toEqual({ time: 9, everPlayed: true, playing: true });
  });

  it("takes the latest place on every write", () => {
    clipMemory.write("m1", { time: 1, everPlayed: true });
    clipMemory.write("m1", { time: 3.5, everPlayed: true, playing: false });

    expect(clipMemory.read("m1")).toEqual({ time: 3.5, everPlayed: true, playing: false });
  });

  it("never forgets having played through a write (FeedCover.md:9)", () => {
    clipMemory.write("m1", { time: 2, everPlayed: true });
    clipMemory.write("m1", { time: 0, everPlayed: false });

    expect(clipMemory.read("m1")?.everPlayed).toBe(true);
  });

  it("forgets a refreshed list's clips, and only those (FeedCover.md:13)", () => {
    clipMemory.write("m1", { time: 2, everPlayed: true });
    clipMemory.write("m2", { time: 5, everPlayed: true });
    clipMemory.write("elsewhere", { time: 7, everPlayed: true });

    clipMemory.forgetList(["m1", "m2", "never-met"]);

    expect(clipMemory.read("m1")).toBeUndefined();
    expect(clipMemory.read("m2")).toBeUndefined();
    expect(clipMemory.read("elsewhere")).toEqual({ time: 7, everPlayed: true });
  });

  it("starts empty in a new document — a cold launch wears the stills (FeedCover.md:11)", async () => {
    clipMemory.write("m1", { time: 2, everPlayed: true });

    // A fresh document is a fresh module graph.
    vi.resetModules();
    const fresh = await import("./clip-memory");

    expect(fresh.read("m1")).toBeUndefined();
  });
});
