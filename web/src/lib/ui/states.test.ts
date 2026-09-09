// @vitest-environment node
// Pins the interaction-state tokens to design/tokens/states.css and the
// 2026-09-09 rulings that closed the audit's O-3 and O-5.
//
// TWO DISABLED OPACITIES WERE IN FORCE AT ONCE — `--state-disabled: 0.38`
// (Material's own, and what the masters read) and a second `--opacity-disabled:
// 0.4` every component spelled as a literal. The ruling keeps 0.38 and retires
// the other, so the guard is that exactly one of them exists and that no screen
// re-spells the number. `--opacity-resting-face` is a different figure for a
// different purpose and is deliberately not covered here.
//
// `--surface-field` named a fill TextField reversed away from, and is retired
// for the same reason: an alias no one reads is an invitation to read it.

import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../../app/tokens-2.css", import.meta.url), "utf-8");

function sourceFiles(): string[] {
  const root = new URL("../../", import.meta.url).pathname;
  return readdirSync(root, { recursive: true, encoding: "utf-8" })
    .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
    .map((name) => `${root}${name}`);
}

describe("interaction states", () => {
  it("declares Material's state-layer opacities and the focus ring", () => {
    expect(CSS).toContain("--state-hover: 0.08;");
    expect(CSS).toContain("--state-press: 0.1;");
    expect(CSS).toContain("--state-disabled: 0.38;");
    expect(CSS).toContain("--focus-ring-width: 2px;");
    expect(CSS).toContain("--focus-ring-offset: 2px;");
  });

  it("carries no retired alias", () => {
    expect(CSS).not.toContain("--opacity-disabled");
    expect(CSS).not.toContain("--surface-field");
  });

  it("leaves no screen spelling a disabled opacity as a literal", () => {
    const literal = /disabled:opacity-\d/;
    const files = sourceFiles();
    expect(files.length, "scanned nothing — the walk is broken").toBeGreaterThan(20);
    expect(files.filter((file) => literal.test(readFileSync(file, "utf-8")))).toEqual([]);
  });

  it("leaves no reader of the retired aliases", () => {
    const retired = /var\(--(?:opacity-disabled|surface-field)\)/;
    expect(
      sourceFiles().filter((file) => retired.test(readFileSync(file, "utf-8"))),
    ).toEqual([]);
  });
});

// design/tokens/transitions.css and the two named durations of motion.css. The
// nine classes are the shared vocabulary — a surface that invents its own is
// how two sheets end up leaving different edges.
describe("transitions", () => {
  const DURATIONS = {
    "--duration-nav-forward": "300ms",
    "--duration-nav-back": "200ms",
    "--duration-sheet-in": "400ms",
    "--duration-sheet-out": "200ms",
    "--duration-dialog-in": "200ms",
    "--duration-scrim": "200ms",
    "--duration-collapsing-top": "200ms",
    "--duration-snackbar": "4000ms",
  } as const;

  it("declares every named duration and the travel", () => {
    for (const [token, value] of Object.entries(DURATIONS)) {
      expect(CSS, token).toContain(`${token}: ${value};`);
    }
    expect(CSS).toContain("--nav-travel: 12%;");
  });

  it("carries the nine transition classes", () => {
    for (const name of [
      "cg-nav-in",
      "cg-nav-out",
      "cg-nav-back-in",
      "cg-nav-back-out",
      "cg-sheet-in",
      "cg-sheet-out",
      "cg-dialog-in",
      "cg-scrim-in",
      "cg-scrim-out",
    ]) {
      expect(CSS, name).toContain(`.${name} {`);
    }
  });

  it("stills the collapsing top and every transition under reduced motion", () => {
    const reduced = CSS.slice(CSS.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("--duration-collapsing-top: 0ms;");
    expect(reduced).toContain("animation: none");
  });
});
