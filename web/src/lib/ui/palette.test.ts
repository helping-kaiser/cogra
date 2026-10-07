// @vitest-environment node
// Pins globals.css to `design/tokens/scheme.json` — the generated M3 scheme
// (`make tokens`) that design/tokens/colors.css transcribes into the token
// contract. design-tokens.test.ts generates and contrast-checks the values;
// this asserts the stylesheet actually carries every role of the scheme, in
// both themes, and exposes each as a Tailwind role.
//
// Without this the CSS is the one copy of the palette nothing verifies, and a
// hand-edited hex would diverge from Android silently.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf-8");
const TOKENS = JSON.parse(
  readFileSync(new URL("../../../../design/tokens/scheme.json", import.meta.url), "utf-8"),
) as { light: Record<string, string>; dark: Record<string, string> };

/** `onSurfaceVariant` is `on-surface-variant`; the CSS side is kebab-case. */
const kebab = (role: string): string => role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const cssVar = (role: string): string => `--${kebab(role)}`;

/**
 * A theme's role block: `light` is the bare `:root`, `auto-dark` the one
 * nested in the dark media query (Auto on a dark device), `chosen-dark` the
 * `[data-theme="dark"]` one (Dark chosen in Settings).
 */
function declarations(block: "light" | "auto-dark" | "chosen-dark"): Map<string, string> {
  const media = CSS.indexOf("@media (prefers-color-scheme: dark)");
  const pattern = {
    light: /:root\s*\{([^}]*)\}/,
    "auto-dark": /:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/,
    "chosen-dark": /:root\[data-theme="dark"\]\s*\{([^}]*)\}/,
  }[block];
  const source = block === "light" ? CSS.slice(0, media) : CSS.slice(media);
  const found = source.match(pattern);
  if (found === null) throw new Error(`no ${block} block`);
  const roles = new Map<string, string>();
  for (const [, name, value] of found[1].matchAll(/(--[a-z-]+)\s*:\s*([^;]+);/g)) {
    roles.set(name, value.trim());
  }
  return roles;
}

describe("globals.css", () => {
  it.each([
    ["light", "light"],
    ["auto-dark", "dark"],
    ["chosen-dark", "dark"],
  ] as const)("carries every role of the %s block from the token file", (block, theme) => {
    const declared = declarations(block);
    for (const [role, value] of Object.entries(TOKENS[theme])) {
      expect(declared.get(cssVar(role)), `${block} ${cssVar(role)}`).toBe(value.toLowerCase());
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
    // rule is the bug design/readme.md §4 Colour names. Comments are prose, not styling.
    const styling = CSS.replace(/\/\*[\s\S]*?\*\//g, "").replace(/:root[^{]*\{[^}]*\}/g, "");
    expect(styling).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
