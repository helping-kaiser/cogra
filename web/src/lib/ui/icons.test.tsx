// @vitest-environment node
// Pins every shipped glyph to `design/components/navigation/Icon.jsx`.
//
// The rule the icon set lives by is "nothing is redrawn or traced: if a glyph
// is missing, it gets exported, not invented" — and a transcription is exactly
// where that rule fails silently. So the guard compares path data character for
// character against the design system's own map rather than eyeballing a
// rendered shape, and it fails on a glyph the product ships that the design
// does not draw.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const ICONS = readFileSync(new URL("./icons.tsx", import.meta.url), "utf-8");
const MASTER = readFileSync(
  new URL("../../../../design/components/navigation/Icon.jsx", import.meta.url),
  "utf-8",
);

/** Every `d="…"` / `"M…"` path literal in a source, in order. */
function paths(source: string): string[] {
  return [...source.matchAll(/"(M[^"]{12,})"/g)].map((match) => match[1]);
}

/** The names the product's PATHS map declares. */
function shippedNames(): string[] {
  const block = ICONS.slice(ICONS.indexOf("const PATHS = {"), ICONS.indexOf("} as const;"));
  return [...block.matchAll(/^ {2}(\w+):/gm)].map((match) => match[1]);
}

describe("icons", () => {
  it("draws every glyph the design draws, path for path", () => {
    const master = new Set(paths(MASTER));
    expect(master.size, "read no paths from the master — the walk is broken").toBeGreaterThan(20);
    const foreign = paths(ICONS).filter((d) => !master.has(d));
    expect(foreign, "path data not found in design/components/navigation/Icon.jsx").toEqual([]);
  });

  it("ships the glyphs the shell and the card rows need", () => {
    // The audit's census: three glyphs existed where the boards call for the
    // bar, the band's chats affordance, the card's affordance row, and the
    // video transport.
    const needed = [
      "dynamic_feed",
      "person",
      "person_outline",
      "add",
      "arrow_back",
      "close",
      "more_vert",
      "chat_bubble",
      "forum",
      "share",
      "graph",
      "play_arrow",
      "pause",
      "fast_rewind",
      "fast_forward",
      "volume_up",
      "volume_off",
    ];
    expect([...shippedNames()].sort()).toEqual([...needed].sort());
  });

  it("keeps the Symbols glyph on its own viewBox", () => {
    // `graph` is Material Symbols, not the classic set, so a 24×24 box would
    // clip it. Every other glyph takes the classic box.
    expect(ICONS).toContain('graph: "0 -960 960 960"');
    expect(MASTER).toContain('{ graph: "0 -960 960 960" }');
  });

  it("keeps no second copy of a glyph the set already holds", () => {
    // `header-bar` carried its own arrow_back and close before the set existed;
    // two copies of one glyph is how the two drift apart. Its `?` stays: the
    // design draws that one in `HelpDot`, not in the glyph map.
    const headerBar = readFileSync(new URL("../ui2/header-bar.tsx", import.meta.url), "utf-8");
    const shipped = new Set(paths(ICONS));
    expect(paths(headerBar).filter((d) => shipped.has(d))).toEqual([]);
  });
});
