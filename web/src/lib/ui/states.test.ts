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
