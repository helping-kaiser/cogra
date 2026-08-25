// @vitest-environment node
// The pad's coordinate map, tested as arithmetic rather than through the
// DOM: jsdom lays nothing out, so a component test can only assert that
// the component asks this module — this is where the map itself is
// pinned.

import { describe, expect, it } from "vitest";

import { padOffsetOf, padPairAt, padPercentOf, padRadius, type PadRect } from "./pad-geometry";
import { TAP_DEFAULT } from "./model";

/** A 200×200 pad at the viewport origin: radius 100, field half-side 100/√2. */
const RECT: PadRect = { left: 0, top: 0, width: 200, height: 200 };
const HALF = 100 / Math.SQRT2;

const close = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 10);

describe("pad geometry", () => {
  it("takes the radius from the shorter side", () => {
    expect(padRadius({ left: 0, top: 0, width: 200, height: 120 })).toBe(60);
  });

  it("picks the origin at the centre", () => {
    expect(padPairAt(RECT, 100, 100)).toEqual({ pDirected: 0, pInterest: 0 });
  });

  it("maps horizontal to valence and vertical to connection, upward-positive", () => {
    const right = padPairAt(RECT, 100 + HALF / 2, 100);
    close(right.pDirected, 0.5);
    close(right.pInterest, 0);

    // Screen y grows downward; connection grows upward.
    const up = padPairAt(RECT, 100, 100 - HALF / 2);
    close(up.pDirected, 0);
    close(up.pInterest, 0.5);

    const down = padPairAt(RECT, 100, 100 + HALF / 2);
    close(down.pInterest, -0.5);
  });

  it("reaches every corner of the square — the diagonals land on the circle", () => {
    // The value square is inscribed in the bloom, so its corners sit at
    // exactly the pad radius from the centre (design.md §8.2 vs §8.3).
    for (const [dx, dy, pair] of [
      [+1, -1, { pDirected: 1, pInterest: 1 }],
      [-1, -1, { pDirected: -1, pInterest: 1 }],
      [+1, +1, { pDirected: 1, pInterest: -1 }],
      [-1, +1, { pDirected: -1, pInterest: -1 }],
    ] as const) {
      const picked = padPairAt(RECT, 100 + dx * HALF, 100 + dy * HALF);
      close(picked.pDirected, pair.pDirected);
      close(picked.pInterest, pair.pInterest);
      close(Math.hypot(dx * HALF, dy * HALF), padRadius(RECT));
    }
  });

  it("clamps a drag past the field instead of refusing it", () => {
    expect(padPairAt(RECT, 10_000, -10_000)).toEqual({ pDirected: 1, pInterest: 1 });
    expect(padPairAt(RECT, -10_000, 10_000)).toEqual({ pDirected: -1, pInterest: -1 });
  });

  it("honours the pad's own position, not just its size", () => {
    const offset: PadRect = { left: 40, top: 90, width: 200, height: 200 };
    expect(padPairAt(offset, 140, 190)).toEqual({ pDirected: 0, pInterest: 0 });
  });

  it("picks the origin from an unlaid-out pad rather than dividing by zero", () => {
    const collapsed: PadRect = { left: 0, top: 0, width: 0, height: 0 };
    expect(padPairAt(collapsed, 12, 34)).toEqual({ pDirected: 0, pInterest: 0 });
  });

  it("round-trips a pair through the knob offset", () => {
    const round = padPairAt(
      RECT,
      100 + padOffsetOf(RECT, TAP_DEFAULT).x,
      100 + padOffsetOf(RECT, TAP_DEFAULT).y,
    );
    close(round.pDirected, TAP_DEFAULT.pDirected);
    close(round.pInterest, TAP_DEFAULT.pInterest);
  });

  it("expresses the knob as a percentage of the box, centre at 50%", () => {
    expect(padPercentOf({ pDirected: 0, pInterest: 0 })).toEqual({ x: 50, y: 50 });
    const corner = padPercentOf({ pDirected: 1, pInterest: 1 });
    close(corner.x, 50 + 100 / (2 * Math.SQRT2));
    close(corner.y, 50 - 100 / (2 * Math.SQRT2));
    // Inside the box on every axis, so the knob never escapes the pad.
    for (const pair of [
      { pDirected: 1, pInterest: 1 },
      { pDirected: -1, pInterest: -1 },
    ]) {
      const percent = padPercentOf(pair);
      expect(percent.x).toBeGreaterThan(0);
      expect(percent.x).toBeLessThan(100);
      expect(percent.y).toBeGreaterThan(0);
      expect(percent.y).toBeLessThan(100);
    }
  });
});
