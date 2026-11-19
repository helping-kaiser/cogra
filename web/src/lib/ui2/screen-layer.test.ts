// @vitest-environment node
// The guard behind `screen-layer.ts`: every full-screen layer keeps its foot
// above the system navigation bar. jsdom has no safe area to measure, so this
// pins the declared rule and keeps a raw full-screen box from coming back.

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
  it("a_full_screen_layer_pads_its_foot_by_the_bottom_safe_area_inset", () => {
    expect(SCREEN_LAYER.split(" ")).toContain("pb-[env(safe-area-inset-bottom)]");
  });

  it("a_full_screen_layer_ends_on_the_keyboards_top_edge", () => {
    // `inset: 0` with no keyboard; with one, the bottom edge is the keyboard's top.
    expect(SCREEN_LAYER.split(" ").sort()).toEqual([
      "bottom-[var(--keyboard-inset,0px)]",
      "fixed",
      "inset-x-0",
      "pb-[env(safe-area-inset-bottom)]",
      "top-0",
    ]);
  });

  it("every_full_screen_layer_stands_on_the_shared_screen_layer", () => {
    // A raw `fixed inset-0` layer would put its foot under an edge-to-edge
    // Chrome's navigation bar (jakob 2026-11-18, the comment editor). Only a
    // scrim, which paints and holds nothing, may stand on the raw box.
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
    const users = files.filter((file) => /\$\{SCREEN_LAYER\}/.test(readFileSync(file, "utf-8"))).map((f) => f.split("/src/")[1]);
    expect(users.sort()).toEqual([
      "app/posts/[id]/edit/comment-edit-view.tsx",
      "app/posts/[id]/reply/reply-wizard-view.tsx",
      "lib/ui2/media/media-viewer.tsx",
    ]);
  });
});
