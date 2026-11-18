// The guard behind `screen-layer.ts`: no full-screen layer is laid out against
// the layout viewport. jsdom has no viewport to measure, so the real-browser
// half is the conformance harness's height probe (the lane report names it);
// this half keeps the class from coming back in source.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SCREEN_LAYER } from "./screen-layer";

function sourceFiles(): string[] {
  const root = new URL("../../", import.meta.url).pathname;
  return readdirSync(root, { recursive: true, encoding: "utf-8" })
    .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
    .map((name) => `${root}${name}`);
}

describe("a layer that takes the whole screen", () => {
  it("stands on the dynamic viewport's height, pinned to the top", () => {
    expect(SCREEN_LAYER.split(" ").sort()).toEqual(["fixed", "h-dvh", "inset-x-0", "top-0"]);
  });

  it("a_full_screen_layer_is_never_sized_by_the_layout_viewport", () => {
    // `fixed inset-0` is the layout viewport's box: on a phone with its
    // address bar showing it reaches under the toolbar, and a foot at its
    // bottom goes out of reach (jakob 2026-11-18, the comment editor). Only a
    // scrim, which paints and holds nothing, may stand on it.
    const files = sourceFiles();
    expect(files.length, "scanned nothing — the walk is broken").toBeGreaterThan(20);
    const offenders = files.flatMap((file) =>
      readFileSync(file, "utf-8")
        .split("\n")
        .map((line, index) => ({ line, at: `${file.split("/src/")[1]}:${index + 1}` }))
        .filter(({ line }) => /className=.*\bfixed\b[^"`]*\binset-0\b/.test(line) && !/\bbg-scrim\b/.test(line))
        .map(({ at }) => at),
    );
    expect(offenders).toEqual([]);
  });
});
