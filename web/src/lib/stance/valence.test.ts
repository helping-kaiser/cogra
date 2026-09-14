// @vitest-environment node
// Pins the one-axis table to its master the way anchors.test.ts pins the
// twenty to design.md: `design/components/stance/StanceReadout.jsx` holds
// `VALENCE_SIX`, both clients read it, and a band edited there and not
// here — or the reverse — fails.
//
// EVERY BAND EDGE IS PINNED BY VALUE, not by a round-trip through the
// same comparison the code makes: the edges are where the two ruled
// tie-breaks live, they are the only values a nearest-distance
// implementation would answer differently for, and they are what a
// Kotlin port has to agree with byte for byte (`ValenceBandsTest`).

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { STANCE_ANCHORS } from "./anchors";
import {
  nearestValenceAnchor,
  VALENCE_LABEL,
  VALENCE_POLES,
  VALENCE_SIX,
  type ValenceBand,
} from "./valence";

const MASTER = readFileSync(
  new URL("../../../../design/components/stance/StanceReadout.jsx", import.meta.url),
  "utf-8",
);

/** The master's own rows: `{ emoji: "😠", to: -0.725, toInclusive: false },`. */
function masterBands(): Pick<ValenceBand, "emoji" | "to" | "toInclusive">[] {
  const table = MASTER.match(/export const VALENCE_SIX = \[([\s\S]*?)\]\.map/);
  expect(table, "the master no longer spells VALENCE_SIX as a literal table").not.toBeNull();
  const rows: Pick<ValenceBand, "emoji" | "to" | "toInclusive">[] = [];
  for (const [, emoji, to, inclusive] of table![1].matchAll(
    /\{\s*emoji:\s*"(\S+)",\s*to:\s*(-?[\d.]+|DIMENSION_MAX),\s*toInclusive:\s*(true|false)\s*\}/g,
  )) {
    rows.push({
      emoji,
      // The last row's edge is the master's own `DIMENSION_MAX`.
      to: to === "DIMENSION_MAX" ? 1 : Number(to),
      toInclusive: inclusive === "true",
    });
  }
  return rows;
}

describe("the one-axis table", () => {
  it("carries the master's six bands verbatim", () => {
    const documented = masterBands();
    expect(documented.length, "no band rows parsed — the table moved").toBe(6);
    expect(
      VALENCE_SIX.map(({ emoji, to, toInclusive }) => ({ emoji, to, toInclusive })),
    ).toEqual(documented);
  });

  it("reads glyph, word and position out of the twenty, so the six cannot drift", () => {
    for (const band of VALENCE_SIX) {
      const anchor = STANCE_ANCHORS.find((candidate) => candidate.emoji === band.emoji);
      expect(anchor, `${band.emoji} is not one of the twenty`).toBeDefined();
      expect(band.label).toBe(anchor!.label);
      expect(band.pDirected).toBe(anchor!.pDirected);
    }
  });

  it("is the pure-valence spine: the mild, middle and far face on each side", () => {
    expect(VALENCE_SIX.map((band) => band.pDirected)).toEqual([-0.9, -0.55, -0.15, 0.15, 0.55, 0.9]);
  });

  it("covers the closed axis monotonically, ending at +1", () => {
    const edges = VALENCE_SIX.map((band) => band.to);
    expect(edges).toEqual([...edges].sort((a, b) => a - b));
    expect(edges[edges.length - 1]).toBe(1);
  });

  it("names the axis and its ends the way design/readme.md §11 renamed them", () => {
    expect(VALENCE_LABEL).toBe("For or against");
    expect(VALENCE_POLES).toEqual(["Against", "For"]);
  });
});

describe("the face a one-axis pick wears", () => {
  it("reads exactly 0.00 as 🙂 — the ruled zero case", () => {
    expect(nearestValenceAnchor(0).emoji).toBe("🙂");
    expect(nearestValenceAnchor(0).label).toBe("Nice");
    // A drag that never moved horizontally produces negative zero, and it
    // is the same pick.
    expect(nearestValenceAnchor(-0).emoji).toBe("🙂");
  });

  it("gives every band edge to the MILDER face — the one nearer zero", () => {
    // Negative side: the row stops short of its edge, so the edge belongs
    // to the band above it.
    expect(nearestValenceAnchor(-0.725).emoji).toBe("🙁");
    expect(nearestValenceAnchor(-0.35).emoji).toBe("😕");
    // Positive side: the row keeps its edge, which is again the band
    // nearer zero.
    expect(nearestValenceAnchor(0.35).emoji).toBe("🙂");
    expect(nearestValenceAnchor(0.725).emoji).toBe("😊");
  });

  it("reads just inside each edge as the band that owns the interval", () => {
    expect(nearestValenceAnchor(-0.7250001).emoji).toBe("😠");
    expect(nearestValenceAnchor(-0.7249999).emoji).toBe("🙁");
    expect(nearestValenceAnchor(-0.3500001).emoji).toBe("🙁");
    expect(nearestValenceAnchor(-0.3499999).emoji).toBe("😕");
    expect(nearestValenceAnchor(-0.0000001).emoji).toBe("😕");
    expect(nearestValenceAnchor(0.0000001).emoji).toBe("🙂");
    expect(nearestValenceAnchor(0.3500001).emoji).toBe("😊");
    expect(nearestValenceAnchor(0.3499999).emoji).toBe("🙂");
    expect(nearestValenceAnchor(0.7250001).emoji).toBe("😍");
    expect(nearestValenceAnchor(0.7249999).emoji).toBe("😊");
  });

  it("reads each band's own anchor as its own face", () => {
    for (const band of VALENCE_SIX) {
      expect(nearestValenceAnchor(band.pDirected).emoji).toBe(band.emoji);
    }
  });

  it("reads both poles and the tap default", () => {
    expect(nearestValenceAnchor(-1).emoji).toBe("😠");
    expect(nearestValenceAnchor(1).emoji).toBe("😍");
    expect(nearestValenceAnchor(0.1).emoji).toBe("🙂");
  });

  it("clamps a value outside the range in rather than refusing it", () => {
    expect(nearestValenceAnchor(-4).emoji).toBe("😠");
    expect(nearestValenceAnchor(4).emoji).toBe("😍");
    // NaN names no point on the axis, so it folds to the origin's face.
    expect(nearestValenceAnchor(Number.NaN).emoji).toBe("🙂");
  });

  it("answers for every hundredth of the axis without falling through", () => {
    for (let step = -100; step <= 100; step += 1) {
      const band = nearestValenceAnchor(step / 100);
      expect(VALENCE_SIX).toContain(band);
    }
  });
});
