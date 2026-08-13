// @vitest-environment node
// Pins globals.css to `design-tokens.json` (repo root) — the cross-platform
// colour contract (`make tokens`). design-tokens.test.ts generates and
// contrast-checks the values; this asserts the stylesheet actually carries
// them, in both themes, and exposes each as a Tailwind role.
//
// Without this the CSS is the one copy of the palette nothing verifies, and a
// hand-edited hex would diverge from Android silently.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf-8");
const TOKENS = JSON.parse(
  readFileSync(new URL("../../../../design-tokens.json", import.meta.url), "utf-8"),
) as { light: Record<string, string>; dark: Record<string, string> };

/** `onSurfaceVariant` is `on-surface-variant`; the CSS side is kebab-case. */
const kebab = (role: string): string => role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const cssVar = (role: string): string => `--${kebab(role)}`;

/** The `:root` block, and the one nested in the dark media query. */
function declarations(theme: "light" | "dark"): Map<string, string> {
  const source =
    theme === "light"
      ? CSS.slice(0, CSS.indexOf("@media (prefers-color-scheme: dark)"))
      : CSS.slice(CSS.indexOf("@media (prefers-color-scheme: dark)"));
  const block = source.match(/:root\s*\{([^}]*)\}/);
  if (block === null) throw new Error(`no :root block for ${theme}`);
  const found = new Map<string, string>();
  for (const [, name, value] of block[1].matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) {
    found.set(name, value.trim());
  }
  return found;
}

describe("globals.css", () => {
  it.each(["light", "dark"] as const)("carries every %s role from the token file", (theme) => {
    const declared = declarations(theme);
    for (const [role, value] of Object.entries(TOKENS[theme])) {
      expect(declared.get(cssVar(role)), `${theme} ${cssVar(role)}`).toBe(value.toLowerCase());
    }
  });

  it("exposes every role as a Tailwind colour", () => {
    // @theme inline, not @theme: the utility has to inline the value so it
    // resolves at the use site and flips with the media query.
    const theme = CSS.match(/@theme inline\s*\{([^}]*)\}/);
    expect(theme, "no @theme inline block").not.toBeNull();
    for (const role of Object.keys(TOKENS.light)) {
      const utility = `--color-${kebab(role)}`;
      expect(theme![1], `${utility} missing`).toContain(`${utility}: var(${cssVar(role)});`);
    }
  });

  it("leaves no raw palette colour in the stylesheet", () => {
    // Roles are defined in the :root blocks and nowhere else; a hex loose in a
    // rule is the bug design.md §2.3 names. Comments are prose, not styling.
    const styling = CSS.replace(/\/\*[\s\S]*?\*\//g, "").replace(/:root\s*\{[^}]*\}/g, "");
    expect(styling).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
