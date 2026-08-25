// @vitest-environment node
// The pad's coordinate map, tested as arithmetic rather than through the
// DOM: jsdom lays nothing out, so a component test can only assert that
// the component asks this module — this is where the map itself is
// pinned.
//
// The containment assertions are the point of the file. §8.3 makes the
// drawn field the value space and forbids the knob leaving it, so the
// test measures an actual knob against an actual rounded square rather
// than trusting the inset the module computes.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  FIELD_CORNER_RADIUS_PX,
  KNOB_DIAMETER_PX,
  knobTravelInset,
  padPairFrom,
  padPairFromTravel,
  padPercentOf,
  padTravelHalfExtent,
  type PadRect,
} from "./pad-geometry";
import { TAP_DEFAULT, type StancePair } from "./model";

/** A 200×200 pad. The knob's travel is the box inside the inset. */
const SIZE = 200;
const RECT: PadRect = { left: 0, top: 0, width: SIZE, height: SIZE };
const INSET = knobTravelInset();
const HALF = SIZE / 2 - INSET;

const close = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 10);

/**
 * How far a knob centred at `(cx, cy)` pokes outside a rounded square of
 * `size`, corner radius `r`, knob radius `k`. Zero or less is contained.
 *
 * Inside a corner band both edges are close, and the boundary is the
 * corner's arc; anywhere else the boundary is the nearest flat edge.
 */
function knobEscape(cx: number, cy: number, size: number, r: number, k: number): number {
  const nx = Math.min(cx, size - cx);
  const ny = Math.min(cy, size - cy);
  const dx = r - nx;
  const dy = r - ny;
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy) + k - r;
  return k - Math.min(nx, ny);
}

/** Where the component draws the knob's centre, in field pixels. */
function knobCentre(pair: StancePair, size = SIZE, inset = INSET): { x: number; y: number } {
  const percent = padPercentOf(pair);
  const travel = size - 2 * inset;
  return { x: inset + (percent.x / 100) * travel, y: inset + (percent.y / 100) * travel };
}

describe("the field's shape", () => {
  it("pins the corner radius to the token the field is drawn with", () => {
    // Never transcribe a token (web/CLAUDE.md): the field wears
    // `rounded-large`, so the constant has to be what that resolves to.
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf-8");
    const declared = css.match(/--radius-large:\s*(\d+)px;/);
    expect(declared, "globals.css declares no --radius-large").not.toBeNull();
    expect(FIELD_CORNER_RADIUS_PX).toBe(Number(declared?.[1]));
  });

  it("keeps the knob's centre at least its own radius off a flat edge", () => {
    expect(knobTravelInset()).toBeGreaterThanOrEqual(KNOB_DIAMETER_PX / 2);
  });

  it("asks for no more inset than the corner needs", () => {
    // The smallest inset that contains the knob: any less and the corner
    // assertion below fails, so this pins it from the other side.
    const k = KNOB_DIAMETER_PX / 2;
    expect(knobEscape(INSET, INSET, SIZE, FIELD_CORNER_RADIUS_PX, k)).toBeCloseTo(0, 10);
  });

  it("falls back to the knob's radius where the corner is gentler than the knob", () => {
    // A near-square field: the corner is no constraint, and the flat edge
    // is all that is left.
    expect(knobTravelInset(2, 20)).toBe(10);
  });
});

describe("knob containment", () => {
  const k = KNOB_DIAMETER_PX / 2;

  it("keeps the knob inside the drawn field at every corner", () => {
    for (const pDirected of [-1, 1]) {
      for (const pInterest of [-1, 1]) {
        const centre = knobCentre({ pDirected, pInterest });
        expect(
          knobEscape(centre.x, centre.y, SIZE, FIELD_CORNER_RADIUS_PX, k),
          `corner (${pDirected}, ${pInterest})`,
        ).toBeLessThanOrEqual(1e-9);
      }
    }
  });

  it("keeps the knob inside the drawn field across the whole value space", () => {
    const steps = 40;
    for (let i = 0; i <= steps; i += 1) {
      for (let j = 0; j <= steps; j += 1) {
        const pair = { pDirected: -1 + (2 * i) / steps, pInterest: -1 + (2 * j) / steps };
        const centre = knobCentre(pair);
        expect(
          knobEscape(centre.x, centre.y, SIZE, FIELD_CORNER_RADIUS_PX, k),
          `pair (${pair.pDirected}, ${pair.pInterest})`,
        ).toBeLessThanOrEqual(1e-9);
      }
    }
  });

  it("keeps the knob inside however far past the field the finger travels", () => {
    // The adversarial case: a drag that leaves the pad entirely, in every
    // direction, must still leave the knob drawn inside the field.
    for (const dx of [-10_000, -SIZE, -1, 0, 1, SIZE, 10_000]) {
      for (const dy of [-10_000, -SIZE, -1, 0, 1, SIZE, 10_000]) {
        const centre = knobCentre(padPairFromTravel(RECT, { dx, dy }));
        expect(
          knobEscape(centre.x, centre.y, SIZE, FIELD_CORNER_RADIUS_PX, k),
          `travel (${dx}, ${dy})`,
        ).toBeLessThanOrEqual(1e-9);
      }
    }
  });
});

describe("pad geometry", () => {
  it("takes the travel from the shorter side, less the inset", () => {
    expect(padTravelHalfExtent({ left: 0, top: 0, width: 200, height: 120 })).toBeCloseTo(
      60 - INSET,
      10,
    );
  });

  it("picks the origin before the pointer has travelled", () => {
    expect(padPairFromTravel(RECT, { dx: 0, dy: 0 })).toEqual({ pDirected: 0, pInterest: 0 });
  });

  it("maps horizontal to valence and vertical to connection, upward-positive", () => {
    const right = padPairFromTravel(RECT, { dx: HALF / 2, dy: 0 });
    close(right.pDirected, 0.5);
    close(right.pInterest, 0);

    // Screen y grows downward; connection grows upward.
    const up = padPairFromTravel(RECT, { dx: 0, dy: -HALF / 2 });
    close(up.pDirected, 0);
    close(up.pInterest, 0.5);

    const down = padPairFromTravel(RECT, { dx: 0, dy: HALF / 2 });
    close(down.pInterest, -0.5);
  });

  it("moves the knob exactly as far as the finger moved", () => {
    // One pixel of travel is one pixel of knob: the whole claim that the
    // drawn field IS the value space rests on this.
    for (const dx of [0, 10, 37, HALF]) {
      const centre = knobCentre(padPairFromTravel(RECT, { dx, dy: 0 }));
      close(centre.x, SIZE / 2 + dx);
    }
  });

  it("puts the drawn corner at (±1, ±1)", () => {
    // Travel to the corner of the travel box, not past the drawn edge:
    // the field's own corner is the extreme value, so nothing about the
    // square is out of reach of a finger that stays on the drawing.
    const picked = padPairFromTravel(RECT, { dx: HALF, dy: -HALF });
    close(picked.pDirected, 1);
    close(picked.pInterest, 1);
  });

  it("clamps travel past the field per axis instead of refusing it", () => {
    // Per axis, never by distance: a long horizontal drag pins valence at
    // +1 and leaves connection where it was.
    expect(padPairFromTravel(RECT, { dx: 10_000, dy: -HALF / 2 })).toEqual({
      pDirected: 1,
      pInterest: 0.5,
    });
    expect(padPairFromTravel(RECT, { dx: -10_000, dy: 10_000 })).toEqual({
      pDirected: -1,
      pInterest: -1,
    });
  });

  it("measures travel, so the pad's position on screen does not matter", () => {
    const offset: PadRect = { left: 40, top: 90, width: SIZE, height: SIZE };
    expect(padPairFromTravel(offset, { dx: HALF / 2, dy: 0 })).toEqual(
      padPairFromTravel(RECT, { dx: HALF / 2, dy: 0 }),
    );
  });

  it("picks the origin from a field with no travel in it", () => {
    const collapsed: PadRect = { left: 0, top: 0, width: 0, height: 0 };
    expect(padPairFromTravel(collapsed, { dx: 12, dy: 34 })).toEqual({
      pDirected: 0,
      pInterest: 0,
    });
    // Smaller than its own inset, rather than merely unlaid-out.
    const tiny: PadRect = { left: 0, top: 0, width: 8, height: 8 };
    expect(padPairFromTravel(tiny, { dx: 12, dy: 34 })).toEqual({ pDirected: 0, pInterest: 0 });
  });

  it("expresses the knob as a percentage of the travel box, centre at 50%", () => {
    expect(padPercentOf({ pDirected: 0, pInterest: 0 })).toEqual({ x: 50, y: 50 });
    expect(padPercentOf({ pDirected: 1, pInterest: 1 })).toEqual({ x: 100, y: 0 });
    expect(padPercentOf({ pDirected: -1, pInterest: -1 })).toEqual({ x: 0, y: 100 });
    const tap = padPercentOf(TAP_DEFAULT);
    close(tap.x, 55);
    close(tap.y, 45);
  });
});

// The pad parks and stays open (§8.3), so a second drag adjusts the pick
// already standing. Same accumulated travel, different starting point.
describe("travel from a pick already standing", () => {
  it("is the plain travel map when it starts at the origin", () => {
    const travel = { dx: HALF / 2, dy: -HALF / 4 };
    expect(padPairFrom({ pDirected: 0, pInterest: 0 }, RECT, travel)).toEqual(
      padPairFromTravel(RECT, travel),
    );
  });

  it("adds the travel to where the knob already was", () => {
    const base: StancePair = { pDirected: 0.5, pInterest: -0.25 };
    const moved = padPairFrom(base, RECT, { dx: HALF / 4, dy: HALF / 2 });
    close(moved.pDirected, 0.75);
    close(moved.pInterest, -0.75);
  });

  it("clamps the sum rather than the travel, so an off-centre base still reaches the corner", () => {
    // Clamping the travel first would stop the knob at +1 short of the
    // corner whenever the base was already positive.
    const base: StancePair = { pDirected: 0.8, pInterest: 0.8 };
    expect(padPairFrom(base, RECT, { dx: HALF, dy: -HALF })).toEqual({
      pDirected: 1,
      pInterest: 1,
    });
    expect(padPairFrom(base, RECT, { dx: HALF * 10, dy: -HALF * 10 })).toEqual({
      pDirected: 1,
      pInterest: 1,
    });
  });

  it("keeps the base when the field has no travel in it", () => {
    const collapsed: PadRect = { left: 0, top: 0, width: 0, height: 0 };
    const base: StancePair = { pDirected: 0.4, pInterest: -0.4 };
    expect(padPairFrom(base, collapsed, { dx: 99, dy: 99 })).toEqual(base);
  });

  it("never leaves the drawn square, whatever the base and the travel", () => {
    const bases: StancePair[] = [
      { pDirected: -1, pInterest: -1 },
      { pDirected: 1, pInterest: 1 },
      { pDirected: 0.3, pInterest: -0.7 },
    ];
    for (const base of bases) {
      for (const dx of [-10_000, -HALF, 0, HALF, 10_000]) {
        for (const dy of [-10_000, -HALF, 0, HALF, 10_000]) {
          const pick = padPairFrom(base, RECT, { dx, dy });
          expect(Math.abs(pick.pDirected)).toBeLessThanOrEqual(1);
          expect(Math.abs(pick.pInterest)).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
