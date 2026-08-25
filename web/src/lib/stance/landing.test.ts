// @vitest-environment node
// The local landing fold of design.md §8.3, tested as arithmetic: the
// clip, and — the point of the whole thing — that the RAW sums are what
// it folds against rather than the clipped fold a client can already see.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { localLanding } from "./landing";
import { ORIGIN, type StancePair } from "./model";

const DESIGN = readFileSync(
  new URL("../../../../docs/implementation/design.md", import.meta.url),
  "utf-8",
);

const pair = (pDirected: number, pInterest: number): StancePair => ({ pDirected, pInterest });

describe("the local landing", () => {
  it("is the fold design.md §8.3 states", () => {
    expect(DESIGN).toMatch(/the landing is a local fold\s+\(`clip` of sum plus pick\)/);
  });

  it("adds the pick to the raw sums", () => {
    expect(localLanding(pair(0.3, -0.2), pair(0.4, 0.5)).landing).toEqual(pair(0.7, 0.3));
  });

  it("leaves a bundle alone when the pick is the origin", () => {
    expect(localLanding(pair(0.4, -0.6), ORIGIN).landing).toEqual(pair(0.4, -0.6));
  });

  it("clips the result at the edges the graph reads", () => {
    expect(localLanding(pair(0.8, -0.8), pair(0.9, -0.9)).landing).toEqual(pair(1, -1));
    expect(localLanding(pair(-4, 7), pair(0, 0)).landing).toEqual(pair(-1, 1));
  });

  it("folds against sums beyond the clip without losing what they carry", () => {
    // "Clipped is not hidden" (§8.3). A bundle summing to (+5, +5) shows
    // a fold of (+1, +1); a (−1, −1) pick against the FOLD would read as
    // severance, while the graph lands at (+4, +4) — still (+1, +1) once
    // clipped, and nothing like nothing.
    const landed = localLanding(pair(5, 5), pair(-1, -1));

    expect(landed.landing).toEqual(pair(1, 1));
    expect(landed.severed).toBe(false);
    expect(landed.inert).toBe(false);
  });

  it("reaches severance only when the raw sums actually cancel", () => {
    expect(localLanding(pair(1, 1), pair(-1, -1)).severed).toBe(true);
    expect(localLanding(pair(5, 5), pair(-5, -5)).severed).toBe(true);
    expect(localLanding(pair(0.25, -0.25), pair(-0.25, 0.25)).severed).toBe(true);
  });

  it("calls a landing inert on either axis alone", () => {
    const directed = localLanding(pair(0.5, 0.5), pair(-0.5, 0));
    expect(directed.inert).toBe(true);
    expect(directed.severed).toBe(false);

    const interest = localLanding(pair(0.5, 0.5), pair(0, -0.5));
    expect(interest.inert).toBe(true);
    expect(interest.severed).toBe(false);
  });

  it("reads the flags off the clipped landing, not the raw total", () => {
    // Raw (+6, +6) with a (−5, −5) pick is (+1, +1) raw and clipped —
    // alive on both axes either way, and nothing here reports otherwise.
    const landed = localLanding(pair(6, 6), pair(-5, -5));

    expect(landed.landing).toEqual(pair(1, 1));
    expect(landed.inert).toBe(false);
  });

  it("never reports a negative zero as a direction", () => {
    // The pad's inverted vertical axis produces −0 on a drag that never
    // moved vertically, and it must not travel into a reading.
    const landed = localLanding(pair(0.5, 0), pair(-0.5, -0));

    expect(Object.is(landed.landing.pDirected, -0)).toBe(false);
    expect(Object.is(landed.landing.pInterest, -0)).toBe(false);
    expect(landed.severed).toBe(true);
  });

  it("stays inside the square for any sum and any pick", () => {
    for (const sum of [-1000, -1, -0.5, 0, 0.5, 1, 1000]) {
      for (const pick of [-1, -0.5, 0, 0.5, 1]) {
        const landed = localLanding(pair(sum, sum), pair(pick, pick));
        expect(Math.abs(landed.landing.pDirected)).toBeLessThanOrEqual(1);
        expect(Math.abs(landed.landing.pInterest)).toBeLessThanOrEqual(1);
      }
    }
  });
});
