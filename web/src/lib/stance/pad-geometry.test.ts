// @vitest-environment node
// The pad's coordinate map, tested as arithmetic rather than through the
// DOM: jsdom lays nothing out, so a component test can only assert that
// the component asks this module — this is where the map itself is
// pinned.

import { describe, expect, it } from "vitest";

import { padPairFromTravel, padPercentOf, padRadius, type PadRect } from "./pad-geometry";
import { TAP_DEFAULT } from "./model";

/** A 200×200 pad: radius 100, and 100 px of travel is a full unit. */
const RECT: PadRect = { left: 0, top: 0, width: 200, height: 200 };
const RADIUS = 100;

const close = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 10);

describe("pad geometry", () => {
  it("takes the radius from the shorter side", () => {
    expect(padRadius({ left: 0, top: 0, width: 200, height: 120 })).toBe(60);
  });

  it("picks the origin before the pointer has travelled", () => {
    expect(padPairFromTravel(RECT, { dx: 0, dy: 0 })).toEqual({ pDirected: 0, pInterest: 0 });
  });

  it("maps horizontal to valence and vertical to connection, upward-positive", () => {
    const right = padPairFromTravel(RECT, { dx: RADIUS / 2, dy: 0 });
    close(right.pDirected, 0.5);
    close(right.pInterest, 0);

    // Screen y grows downward; connection grows upward.
    const up = padPairFromTravel(RECT, { dx: 0, dy: -RADIUS / 2 });
    close(up.pDirected, 0);
    close(up.pInterest, 0.5);

    const down = padPairFromTravel(RECT, { dx: 0, dy: RADIUS / 2 });
    close(down.pInterest, -0.5);
  });

  it("gives the drawn radius the full range on each axis", () => {
    // Travel straight out to the drawn edge is exactly ±1 — the value
    // space is the square, and the radius is one unit of either axis.
    close(padPairFromTravel(RECT, { dx: RADIUS, dy: 0 }).pDirected, 1);
    close(padPairFromTravel(RECT, { dx: -RADIUS, dy: 0 }).pDirected, -1);
    close(padPairFromTravel(RECT, { dx: 0, dy: -RADIUS }).pInterest, 1);
    close(padPairFromTravel(RECT, { dx: 0, dy: RADIUS }).pInterest, -1);
  });

  it("reaches the corners by travelling past the drawn edge on the diagonal", () => {
    // A corner sits at √2 radii, so it is outside the circle the pad
    // draws: §8.2's whole square stays reachable, and travel there is
    // never refused.
    for (const [sx, sy] of [
      [+1, -1],
      [-1, -1],
      [+1, +1],
      [-1, +1],
    ] as const) {
      const travel = { dx: sx * RADIUS, dy: sy * RADIUS };
      const picked = padPairFromTravel(RECT, travel);
      close(picked.pDirected, sx);
      close(picked.pInterest, -sy);
      expect(Math.hypot(travel.dx, travel.dy)).toBeGreaterThan(padRadius(RECT));
    }
  });

  it("clamps travel past the field per axis instead of refusing it", () => {
    // Per axis, never by radius: a long horizontal drag pins valence at
    // +1 and leaves connection where it was.
    expect(padPairFromTravel(RECT, { dx: 10_000, dy: -RADIUS / 2 })).toEqual({
      pDirected: 1,
      pInterest: 0.5,
    });
    expect(padPairFromTravel(RECT, { dx: -10_000, dy: 10_000 })).toEqual({
      pDirected: -1,
      pInterest: -1,
    });
  });

  it("measures travel, so the pad's position on screen does not matter", () => {
    const offset: PadRect = { left: 40, top: 90, width: 200, height: 200 };
    expect(padPairFromTravel(offset, { dx: RADIUS / 2, dy: 0 })).toEqual(
      padPairFromTravel(RECT, { dx: RADIUS / 2, dy: 0 }),
    );
  });

  it("picks the origin from an unlaid-out pad rather than dividing by zero", () => {
    const collapsed: PadRect = { left: 0, top: 0, width: 0, height: 0 };
    expect(padPairFromTravel(collapsed, { dx: 12, dy: 34 })).toEqual({
      pDirected: 0,
      pInterest: 0,
    });
  });

  it("expresses the knob as a percentage of the box, centre at 50%", () => {
    expect(padPercentOf({ pDirected: 0, pInterest: 0 })).toEqual({ x: 50, y: 50 });
    // ±1 is the drawn edge, which is the box edge on that axis.
    expect(padPercentOf({ pDirected: 1, pInterest: 1 })).toEqual({ x: 100, y: 0 });
    expect(padPercentOf({ pDirected: -1, pInterest: -1 })).toEqual({ x: 0, y: 100 });
    const tap = padPercentOf(TAP_DEFAULT);
    close(tap.x, 55);
    close(tap.y, 45);
  });
});
