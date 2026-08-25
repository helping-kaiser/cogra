// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  clampDimension,
  clampPair,
  formatPair,
  inertAxes,
  isSevered,
  ORIGIN,
  samePair,
  TAP_DEFAULT,
} from "./model";

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

  it("names both axes as inert only where the folded value is zero", () => {
    expect(inertAxes(ORIGIN)).toEqual({ directed: true, interest: true });
    expect(inertAxes({ pDirected: 0, pInterest: 0.3 })).toEqual({
      directed: true,
      interest: false,
    });
    expect(inertAxes({ pDirected: -0.001, pInterest: 0.3 })).toEqual({
      directed: false,
      interest: false,
    });
  });

  it("calls only a bundle netted to (0, 0) severed", () => {
    expect(isSevered(ORIGIN)).toBe(true);
    expect(isSevered({ pDirected: 0, pInterest: 0.01 })).toBe(false);
    expect(isSevered(TAP_DEFAULT)).toBe(false);
  });

  it("compares pairs by value", () => {
    expect(samePair(TAP_DEFAULT, { pDirected: 0.1, pInterest: 0.1 })).toBe(true);
    expect(samePair(TAP_DEFAULT, ORIGIN)).toBe(false);
  });

  it("shows exact values at two decimals", () => {
    expect(formatPair(TAP_DEFAULT)).toBe("0.10, 0.10");
    expect(formatPair({ pDirected: -1, pInterest: 0.666 })).toBe("-1.00, 0.67");
  });
});
