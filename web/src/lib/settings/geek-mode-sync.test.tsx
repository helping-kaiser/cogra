// Show exact values lands on the document as `data-geek`, the one attribute
// the stylesheet's `.cg-exact` rule keys on (design/readme.md §13, "One
// markup, two paintings"; Settings.md: Show exact values).

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { applyExactValues, exactValuesPreference } from "./device-preference";
import { GeekModeSync } from "./geek-mode-sync";
import { EXACT_VALUES_STORAGE_KEY, THEME_BOOT_SCRIPT } from "./theme-boot";

const TOKENS = readFileSync(join(process.cwd(), "src", "app", "tokens-2.css"), "utf-8");
const README = readFileSync(join(process.cwd(), "..", "design", "readme.md"), "utf-8");

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.geek;
});

describe("geek mode on the document", () => {
  it("is off by default: no data-geek, so every cg-exact span stays unpainted", () => {
    render(<GeekModeSync />);
    expect(document.documentElement.dataset.geek).toBeUndefined();
  });

  it("follows the switch both ways, live", () => {
    render(<GeekModeSync />);
    act(() => exactValuesPreference.write("on"));
    expect(document.documentElement.dataset.geek).toBe("on");
    act(() => exactValuesPreference.write("off"));
    expect(document.documentElement.dataset.geek).toBeUndefined();
  });

  it("is applied before the first paint by the head script", () => {
    window.localStorage.setItem(EXACT_VALUES_STORAGE_KEY, "on");
    new Function(THEME_BOOT_SCRIPT)();
    expect(document.documentElement.dataset.geek).toBe("on");
  });

  it("hides the digits by the master's one rule, scoped to the not-on case", () => {
    expect(README).toContain('`.screen:not([data-geek="on"]) .cg-exact { display: none }`');
    expect(TOKENS).toMatch(/:root:not\(\[data-geek="on"\]\) \.cg-exact \{\s*display: none;\s*\}/);
  });

  it("clears the attribute rather than writing it off", () => {
    applyExactValues("on");
    applyExactValues("off");
    expect(document.documentElement.hasAttribute("data-geek")).toBe(false);
  });
});
