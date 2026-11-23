// @vitest-environment node
// HOVER BELONGS TO A CURSOR (jakob's ruling, 2026-11-23: "on pc a cursor
// hovering over a button keeps the hover state but on phone we dont have
// this. if the finger is there we hover once it is gone we don't anymore").
//
// A touch browser gives the element under the last tap `:hover` and keeps it
// until the next tap lands elsewhere — the "sticky hover" of touch screens —
// so an ungated hover layer stays lit after the finger has lifted (measured:
// a tapped share button at `--state-hover` 2 s after the tap). The documented
// cure is to style hover only where the primary input can hover: `@media
// (hover: hover)` (Media Queries Level 4, § "hover"; MDN "hover"). The press
// keeps its own `:active` layer, which is what a finger's feedback is.
//
// So every `:hover` selector in the web's CSS must sit inside a `(hover:
// hover)` media block. Tailwind's `hover:` utilities already compile that way
// (tailwindcss 4.x: `hover` is `&:hover` wrapped in `@media (hover: hover)`),
// so the remaining guard on that side is that no stylesheet redefines the
// variant.

import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const APP = new URL("../../", import.meta.url).pathname;

function stylesheets(): string[] {
  return readdirSync(APP, { recursive: true, encoding: "utf-8" })
    .filter((name) => name.endsWith(".css"))
    .map((name) => `${APP}${name}`);
}

/** Comments out, strings kept whole — enough of CSS syntax to read block nesting. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** Every block's header with the headers of the blocks around it, outermost first. */
function blocks(css: string): { header: string; within: string[] }[] {
  const text = stripComments(css);
  const out: { header: string; within: string[] }[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "{") {
      const header = text.slice(start, i).trim();
      out.push({ header, within: [...stack] });
      stack.push(header);
      start = i + 1;
    } else if (c === "}") {
      stack.pop();
      start = i + 1;
    } else if (c === ";") {
      start = i + 1;
    }
  }
  return out;
}

const HOVER_MEDIA = /@media[^{]*\(\s*hover\s*:\s*hover\s*\)/;

/** The `:hover` rules no `(hover: hover)` block holds. */
function ungatedHover(css: string): string[] {
  return blocks(css)
    .filter(({ header }) => !header.startsWith("@") && /:hover\b/.test(header))
    .filter(({ within }) => !within.some((outer) => HOVER_MEDIA.test(outer)))
    .map(({ header }) => header);
}

describe("hover belongs to a cursor", () => {
  it("reads the gate the way a browser nests it", () => {
    expect(ungatedHover(".a:hover::after { opacity: 1 }")).toEqual([".a:hover::after"]);
    expect(ungatedHover("@media (hover: hover) { .a:hover::after { opacity: 1 } }")).toEqual([]);
    expect(ungatedHover("@media (hover:hover) and (pointer: fine) { .a:hover { x: 1 } }")).toEqual([]);
    expect(ungatedHover("@media (hover: none) { .a:hover { x: 1 } }")).toEqual([".a:hover"]);
    expect(ungatedHover("/* .a:hover { } */ .b:active { x: 1 }")).toEqual([]);
    expect(ungatedHover(".c:has(.d:hover)::after { x: 1 }")).toEqual([".c:has(.d:hover)::after"]);
  });

  it("lights a hover layer only where the primary input can hover", () => {
    const sheets = stylesheets();
    expect(sheets.length, "found no stylesheet — the walk is broken").toBeGreaterThan(0);
    const found = sheets.flatMap((file) =>
      ungatedHover(readFileSync(file, "utf-8")).map((selector) => `${file.slice(APP.length)}: ${selector}`),
    );
    expect(found).toEqual([]);
  });

  it("keeps the press's own layer for a finger, ungated", () => {
    const tokens = readFileSync(`${APP}app/tokens-2.css`, "utf-8");
    const active = blocks(tokens).filter(({ header }) => /:active\b/.test(header));
    expect(active.map(({ header }) => header)).toEqual([
      ".cg-state:active::after",
      ".cg-door-card:has(.cg-door:active)::after",
    ]);
    for (const { within } of active) expect(within.some((outer) => HOVER_MEDIA.test(outer))).toBe(false);
  });

  it("never redefines Tailwind's hover variant, which already holds the gate", () => {
    for (const file of stylesheets()) {
      expect(readFileSync(file, "utf-8"), file).not.toMatch(/@custom-variant\s+hover\b/);
    }
  });
});
