// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  clampDimension,
  clampPair,
  isInert,
  isSevered,
  ORIGIN,
  samePair,
  snapDimension,
  snapPair,
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

describe("the hundredths grid", () => {
  // The same table is pinned in Android's `HundredthsTest`: one grid, two
  // clients, so a drag the two apps carry to the same float lands on the
  // same hundredth.
  const VECTORS: ReadonlyArray<readonly [number, number]> = [
    [0.004, 0],
    [-0.004, 0],
    [0.005, 0.01],
    [-0.005, -0.01],
    [0.125, 0.13],
    [-0.125, -0.13],
    [0.1 + 0.2, 0.3],
    [0.994, 0.99],
    [0.10000000149011612, 0.1],
    [1.7, 1],
    [-3, -1],
  ];

  it.each(VECTORS)("lands %d on %d", (raw, grid) => {
    expect(snapDimension(raw)).toBe(grid);
  });

  it("lands a pick near zero on EXACTLY zero, which is what the gates read", () => {
    // 0.004 prints `+0.00` beside a smile today; snapped, it is the 0 that
    // wears 🤷 and that a compose Set asks about.
    expect(snapDimension(0.004) === 0).toBe(true);
    expect(isSevered(snapPair({ pDirected: 0.003, pInterest: -0.0049 }))).toBe(true);
  });

  it("never yields a negative zero", () => {
    expect(Object.is(snapDimension(-0), 0)).toBe(true);
    expect(Object.is(snapDimension(-0.004), 0)).toBe(true);
    expect(Object.is(snapPair({ pDirected: -0.001, pInterest: -0 }).pInterest, 0)).toBe(true);
  });

  it("folds NaN to the origin", () => {
    expect(snapDimension(Number.NaN)).toBe(0);
  });

  it("leaves a value already on the grid exactly where it is", () => {
    for (let k = -100; k <= 100; k++) {
      const value = k / 100;
      expect(snapDimension(value)).toBe(value === 0 ? 0 : value);
    }
  });

  it("prints exactly the hundredth it lands on", () => {
    // A drag that stops 0.37 of a hundredth past every grid point.
    for (let k = -100; k <= 100; k++) {
      expect(snapDimension(k / 100 + 0.0037).toFixed(2)).toBe((k / 100).toFixed(2));
    }
  });
});
