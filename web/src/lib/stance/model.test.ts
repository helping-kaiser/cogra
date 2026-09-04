// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  clampDimension,
  clampPair,
  isInert,
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

  it("never yields a negative zero, which is not a direction", () => {
    // The pad's vertical axis is inverted, so any drag that never moved
    // vertically produces -0 before this normalises it.
    expect(Object.is(clampDimension(-0), 0)).toBe(true);
    expect(Object.is(clampPair({ pDirected: 1, pInterest: -0 }).pInterest, 0)).toBe(true);
  });

  it("compares pairs by value", () => {
    expect(samePair(TAP_DEFAULT, { pDirected: 0.1, pInterest: 0.1 })).toBe(true);
    expect(samePair(TAP_DEFAULT, ORIGIN)).toBe(false);
  });

  // The predicates mirror the reference's `NetStance::is_inert` and
  // `is_severed` (crates/common/src/l1/fold.rs), and they exist for the
  // ONE thing that has no served answer: the landing line under a drag.
  // What a STORED bundle is remains the graph's statement, arriving as a
  // flag on the read — `stance-data.ts` says so, and no surface derives
  // it from a value.
  it("calls a pair inert when either axis is at zero", () => {
    expect(isInert({ pDirected: 0, pInterest: 0.8 })).toBe(true);
    expect(isInert({ pDirected: 0.8, pInterest: 0 })).toBe(true);
    expect(isInert({ pDirected: 0.8, pInterest: 0.8 })).toBe(false);
  });

  it("calls a pair severed only when both axes are at zero", () => {
    expect(isSevered(ORIGIN)).toBe(true);
    expect(isSevered({ pDirected: 0, pInterest: 0.3 })).toBe(false);
    // A negative zero is not a third state: `clampDimension` normalises
    // it away, and the predicate reads what the clip produced.
    expect(isSevered(clampPair({ pDirected: -0, pInterest: -0 }))).toBe(true);
  });
});
