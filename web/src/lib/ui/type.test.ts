// @vitest-environment node
// Pins the type system to design.md §3: one variable family for the whole UI,
// loaded by next/font so nothing is fetched from Google in the browser.
//
// The subset assertion is the one worth automating — a latin-only subset still
// renders every screen we have, and only breaks later, silently, on a Turkish
// name. Nothing else would catch it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf-8");
const LAYOUT = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf-8");

describe("type", () => {
  it("loads Figtree, and only Figtree, through next/font", () => {
    const imports = LAYOUT.match(/import\s*\{([^}]*)\}\s*from\s*"next\/font\/google"/);
    expect(imports, "no next/font/google import").not.toBeNull();
    expect(imports![1].split(",").map((name) => name.trim())).toEqual(["Figtree"]);
    expect(LAYOUT).toContain('variable: "--font-figtree"');
  });

  it("subsets latin and latin-ext", () => {
    expect(LAYOUT).toContain('subsets: ["latin", "latin-ext"]');
  });

  it("drives font-sans from the loaded family", () => {
    expect(CSS).toContain("--font-sans: var(--font-figtree);");
  });

  it("takes font-mono from the platform rather than a second webfont", () => {
    const mono = CSS.match(/--font-mono:\s*([^;]+);/);
    expect(mono, "no --font-mono declaration").not.toBeNull();
    expect(mono![1]).toContain("ui-monospace");
    expect(mono![1]).not.toContain("var(");
  });
});
