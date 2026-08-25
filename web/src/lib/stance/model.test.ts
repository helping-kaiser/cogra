// @vitest-environment node

import { describe, expect, it } from "vitest";

import { clampDimension, clampPair, ORIGIN, samePair, TAP_DEFAULT } from "./model";

describe("stance model", () => {
  it("bounds a dimension to the closed [-1, +1]", () => {
    expect(clampDimension(0.4)).toBe(0.4);
    expect(clampDimension(1)).toBe(1);
    expect(clampDimension(-1)).toBe(-1);
    expect(clampDimension(3.2)).toBe(1);
    expect(clampDimension(-3.2)).toBe(-1);
  });

  it("reads a non-numeric dimension as the inert centre", () => {
    // Direct entry hands over whatever was typed; NaN must not reach a
    // record, and the origin is the pad's own resting value.
    expect(clampDimension(Number.NaN)).toBe(0);
    expect(clampPair({ pDirected: Number.NaN, pInterest: 2 })).toEqual({
      pDirected: 0,
      pInterest: 1,
    });
  });

  it("compares pairs by value", () => {
    expect(samePair(TAP_DEFAULT, { pDirected: 0.1, pInterest: 0.1 })).toBe(true);
    expect(samePair(TAP_DEFAULT, ORIGIN)).toBe(false);
  });

  it("offers no inertness or severance predicate to the client", async () => {
    // Both are the fold's statements about itself and arrive as flags on
    // the read. A predicate here is what a client would eventually reach
    // for instead (design.md §8.2).
    const model: Record<string, unknown> = await import("./model");
    expect(Object.keys(model)).not.toContain("inertAxes");
    expect(Object.keys(model)).not.toContain("isSevered");
  });
});
