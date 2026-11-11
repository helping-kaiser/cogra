// @vitest-environment node
// Round 28's law (design readme §13, "the whole roles", after round 20): a site
// that sets a type role sets all of it — size, leading, tracking and weight
// from the one role — except a deliberate, named one-part override the master
// itself draws.
//
// The role table is the design's `design/tokens/typography.css`; the web reads
// the same sixty variables from globals.css, and this pins them equal so the
// two cannot drift (type.test.ts pins the web side to Material's own tokens).

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const WEB = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf-8");
const DESIGN = readFileSync(new URL("../../../../design/tokens/typography.css", import.meta.url), "utf-8");

/** Every `--text-<role>[--part]: value;` declaration whose role is on the type ramp. */
function roleTable(css: string): Map<string, string> {
  const table = new Map<string, string>();
  for (const [, name, value] of css.matchAll(
    /(--text-(?:display|headline|title|body|label)-(?:large|medium|small)(?:--[a-z-]+)?):\s*([^;]+);/g,
  )) {
    if (!table.has(name)) table.set(name, value.trim());
  }
  return table;
}

describe("whole type roles", () => {
  it("carries the design's role table, all fifteen roles by four parts", () => {
    const design = roleTable(DESIGN);
    expect(design.size).toBe(60);
    expect(Object.fromEntries(roleTable(WEB))).toEqual(Object.fromEntries(design));
  });
});
