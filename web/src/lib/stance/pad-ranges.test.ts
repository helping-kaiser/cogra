// @vitest-environment node
// The ranged field's coordinate map — the tag pad's bound and the citation's
// signed square — tested as arithmetic, the way `pad-geometry.test.ts` pins the
// stance square. jsdom lays nothing out, so this is where the map is pinned.
//
// The tag floor and the tag ranges are a cross-client contract, so they are
// read back out of the design master rather than trusted to review.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  clampToRanges,
  knobTravelInset,
  padPairFrom,
  padPercentOf,
  rangedPairFrom,
  rangedPercentOf,
  STANCE_RANGES,
  TAG_RANGES,
  TAG_RELEVANCE_FLOOR,
  zeroPercentOf,
  type PadRect,
} from "./pad-geometry";

const MASTER = readFileSync(
  new URL("../../../../design/components/stance/StanceReadout.jsx", import.meta.url),
  "utf-8",
);

const SIZE = 200;
const RECT: PadRect = { left: 0, top: 0, width: SIZE, height: SIZE };
const INSET = knobTravelInset(undefined, 24);
const HALF = SIZE / 2 - INSET;
/** The whole travel box, edge to edge. */
const SPAN = 2 * HALF;

const close = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 10);

describe("the tag field's bound", () => {
  it("is the master's: relevance from the floor to 1, confidence 0 to 1", () => {
    const floor = MASTER.match(/export const TAG_RELEVANCE_FLOOR = ([0-9.]+);/);
    expect(floor, "the master no longer exports TAG_RELEVANCE_FLOOR").not.toBeNull();
    expect(TAG_RELEVANCE_FLOOR).toBe(Number(floor![1]));
    expect(TAG_RANGES).toEqual({
      pDirected: { min: 0.01, max: 1 },
      pInterest: { min: 0, max: 1 },
    });
  });
});

describe("rangedPercentOf — where the knob sits", () => {
  it("puts the tag field's low ends at the left and bottom edges", () => {
    expect(rangedPercentOf({ pDirected: 0.01, pInterest: 0 }, TAG_RANGES)).toEqual({ x: 0, y: 100 });
    expect(rangedPercentOf({ pDirected: 1, pInterest: 1 }, TAG_RANGES)).toEqual({ x: 100, y: 0 });
  });

  it("places the tag default +0.10 / 1.00 at the top, a short way in", () => {
    const knob = rangedPercentOf({ pDirected: 0.1, pInterest: 1 }, TAG_RANGES);
    // Rounded to six decimals before it reaches a style (the master's rule).
    expect(knob.x).toBeCloseTo(((0.1 - 0.01) / 0.99) * 100, 5);
    expect(knob.y).toBe(0);
  });

  it("holds a pair outside the reach on the field's edge", () => {
    expect(rangedPercentOf({ pDirected: -0.5, pInterest: 2 }, TAG_RANGES)).toEqual({ x: 0, y: 0 });
  });

  it("agrees with the stance square at STANCE_RANGES", () => {
    for (const pair of [
      { pDirected: 0.1, pInterest: 0.1 },
      { pDirected: -1, pInterest: 1 },
      { pDirected: 0.37, pInterest: -0.82 },
    ]) {
      const ranged = rangedPercentOf(pair, STANCE_RANGES);
      const square = padPercentOf(pair);
      close(ranged.x, square.x);
      close(ranged.y, square.y);
    }
  });
});

describe("rangedPairFrom — the tag field's drag", () => {
  const base = { pDirected: 0.1, pInterest: 1 };

  it("maps the whole travel box onto each slot's whole range", () => {
    // From the bottom-left corner, one full span right and up reaches the top-right.
    const corner = rangedPairFrom(
      { pDirected: 0.01, pInterest: 0 },
      RECT,
      { dx: SPAN, dy: -SPAN },
      INSET,
      TAG_RANGES,
    );
    close(corner.pDirected, 1);
    close(corner.pInterest, 1);
  });

  it("follows the drag from where the pair stood", () => {
    const moved = rangedPairFrom(base, RECT, { dx: SPAN / 4, dy: SPAN / 2 }, INSET, TAG_RANGES);
    close(moved.pDirected, 0.1 + 0.99 / 4);
    close(moved.pInterest, 0.5);
  });

  it("never takes relevance below the floor, however far left the drag goes", () => {
    const pinned = rangedPairFrom(base, RECT, { dx: -SIZE * 10, dy: 0 }, INSET, TAG_RANGES);
    expect(pinned.pDirected).toBe(TAG_RELEVANCE_FLOOR);
  });

  it("never takes confidence outside 0 to 1", () => {
    expect(rangedPairFrom(base, RECT, { dx: 0, dy: SIZE * 10 }, INSET, TAG_RANGES).pInterest).toBe(0);
    expect(rangedPairFrom(base, RECT, { dx: 0, dy: -SIZE * 10 }, INSET, TAG_RANGES).pInterest).toBe(1);
  });

  it("keeps the base, held in reach, on a field with no travel in it", () => {
    const flat: PadRect = { left: 0, top: 0, width: 10, height: 10 };
    expect(rangedPairFrom({ pDirected: 0, pInterest: 1 }, flat, { dx: 50, dy: 0 }, INSET, TAG_RANGES)).toEqual({
      pDirected: TAG_RELEVANCE_FLOOR,
      pInterest: 1,
    });
  });
});

describe("rangedPairFrom — the citation's signed square", () => {
  it("is the stance square's own drag at STANCE_RANGES", () => {
    const base = { pDirected: 0.1, pInterest: 0.1 };
    for (const travel of [
      { dx: 30, dy: -12 },
      { dx: -SIZE, dy: SIZE },
      { dx: 0, dy: 0 },
    ]) {
      const ranged = rangedPairFrom(base, RECT, travel, INSET, STANCE_RANGES);
      const square = padPairFrom(base, RECT, travel, INSET);
      close(ranged.pDirected, square.pDirected);
      close(ranged.pInterest, square.pInterest);
    }
  });

  it("reaches −1 to +1 on both slots", () => {
    const low = rangedPairFrom({ pDirected: 0, pInterest: 0 }, RECT, { dx: -SIZE, dy: SIZE }, INSET, STANCE_RANGES);
    const high = rangedPairFrom({ pDirected: 0, pInterest: 0 }, RECT, { dx: SIZE, dy: -SIZE }, INSET, STANCE_RANGES);
    expect(low).toEqual({ pDirected: -1, pInterest: -1 });
    expect(high).toEqual({ pDirected: 1, pInterest: 1 });
  });
});

describe("clampToRanges and zeroPercentOf", () => {
  it("clamps each slot on its own", () => {
    expect(clampToRanges({ pDirected: -3, pInterest: 0.5 }, TAG_RANGES)).toEqual({
      pDirected: TAG_RELEVANCE_FLOOR,
      pInterest: 0.5,
    });
  });

  it("draws a zero line only where a slot reaches zero from both sides", () => {
    expect(zeroPercentOf(STANCE_RANGES.pDirected)).toBe(50);
    expect(zeroPercentOf(TAG_RANGES.pDirected)).toBeNull();
    expect(zeroPercentOf(TAG_RANGES.pInterest)).toBeNull();
  });
});
