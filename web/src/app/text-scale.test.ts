// @vitest-environment node
// The app opts in to the phone's text size (design/readme.md, "Text scale is
// honoured and never capped"): the head carries `<meta name="text-scale"
// content="scale">`, and no stylesheet pins the root font size to an
// absolute length, which "can prevent the browser from applying text
// scaling" (developer.chrome.com, "Respect Operating System Text Scale").

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { metadata } from "./layout";

// The root layout loads its family through next/font, which only exists under
// Next's compiler (as in manifest.test.ts).
vi.mock("next/font/google", () => ({ Figtree: () => ({ variable: "font-figtree" }) }));

const STYLESHEETS = ["globals.css", "tokens-2.css"].map((f) => ({
  f,
  css: readFileSync(new URL(`./${f}`, import.meta.url), "utf-8"),
}));

describe("text scale", () => {
  it("opts the document in to the OS text scale", () => {
    expect(metadata.other).toEqual(expect.objectContaining({ "text-scale": "scale" }));
  });

  it.each(STYLESHEETS)("$f never sets a font-size on html or :root", ({ css }) => {
    // every rule whose selector list names html or :root, with its body
    const rules = [...css.matchAll(/(^|[}\n])\s*([^{}@]*\b(?:html|:root)\b[^{}]*)\{([^}]*)\}/g)];
    for (const [, , selector, body] of rules) {
      expect(body, `${selector.trim()} sets a font-size`).not.toMatch(/(^|[;\s])font-size\s*:/);
    }
  });
});
