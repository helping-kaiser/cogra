// @vitest-environment node
// Pins the shape vocabulary to design.md §4: Material 3's five corner sizes and
// nothing else. The scale is small and fixed, so unlike the type scale there is
// no package to read it from — the values are Material's own, and Android gets
// the same five from Compose's default `Shapes()`.
//
// The guard is the point: before this, one `rounded-md` dressed cards, inputs,
// buttons, and dialogs alike, which is how the two clients drifted apart on
// shape without anyone choosing to.

import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf-8");

const SCALE = {
  "extra-small": "4px",
  small: "8px",
  medium: "12px",
  large: "16px",
  "extra-large": "28px",
} as const;

/** The `@theme` block carrying the radii; the type roles live in their own. */
function shapeBlock(): string {
  const block = CSS.match(/@theme\s*\{[^}]*--radius-[^}]*\}/);
  if (block === null) throw new Error("no @theme block declaring radii");
  return block[0];
}

function sourceFiles(): string[] {
  const root = new URL("../../", import.meta.url).pathname;
  return readdirSync(root, { recursive: true, encoding: "utf-8" })
    .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
    .map((name) => `${root}${name}`);
}

describe("shape", () => {
  it("declares Material's five corner sizes", () => {
    const block = shapeBlock();
    for (const [rung, size] of Object.entries(SCALE)) {
      expect(block, `--radius-${rung}`).toContain(`--radius-${rung}: ${size};`);
    }
  });

  it("clears Tailwind's own radii so only the scale can be named", () => {
    expect(shapeBlock()).toContain("--radius-*: initial;");
  });

  it("leaves no off-scale radius in any screen", () => {
    // `rounded-full` and `rounded-none` are Tailwind static utilities, not
    // theme values: the pill is Material's button shape and survives the reset.
    const offScale = /\brounded-(?:xs|sm|md|lg|xl|2xl|3xl|4xl)\b/;
    const files = sourceFiles();
    expect(files.length, "scanned nothing — the walk is broken").toBeGreaterThan(20);
    expect(files.filter((file) => offScale.test(readFileSync(file, "utf-8")))).toEqual([]);
  });
});
