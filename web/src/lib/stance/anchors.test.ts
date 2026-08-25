// @vitest-environment node
// Pins the readout to design.md §8.4, the way palette.test.ts pins colour
// to design-tokens.json: the doc's table is the contract both clients
// read, so it is parsed here rather than transcribed. A row edited in the
// doc and not in the code — or the reverse — fails.
//
// The tap default is pinned the same way, out of §8.3: it is the one
// number the resting gesture writes, and the low-defaults policy is what
// keeps stronger stances expressible.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  bundleReadout,
  nearestAnchor,
  RESTING_FACE_EMOJI,
  STANCE_ANCHORS,
  ZERO_BUNDLE_EMOJI,
  type StanceAnchor,
} from "./anchors";
import { ORIGIN, TAP_DEFAULT } from "./model";

const DESIGN = readFileSync(
  new URL("../../../../docs/implementation/design.md", import.meta.url),
  "utf-8",
);

/**
 * The §8.4 table rows: `| +0.15 | −0.20 | 😶 | … |`. The doc sets its
 * negatives with U+2212 MINUS SIGN, which `Number` does not parse, so the
 * sign is normalized to ASCII before conversion.
 */
function documentedAnchors(): StanceAnchor[] {
  const decimal = (cell: string): number => Number(cell.replace("−", "-"));
  const rows: StanceAnchor[] = [];
  for (const [, directed, interest, emoji, label] of DESIGN.matchAll(
    /^\|\s*([+\-−]?[0-9.]+)\s*\|\s*([+\-−]?[0-9.]+)\s*\|\s*(\S+)\s*\|\s*([^|]+?)\s*\|$/gm,
  )) {
    rows.push({
      pDirected: decimal(directed),
      pInterest: decimal(interest),
      emoji,
      label,
    });
  }
  return rows;
}

describe("stance anchors", () => {
  it("carries design.md §8.4's table verbatim", () => {
    const documented = documentedAnchors();
    expect(documented.length, "no anchor rows parsed — the table moved").toBe(20);
    expect(STANCE_ANCHORS).toEqual(documented);
  });

  it("takes the tap default from design.md §8.3", () => {
    const stated = DESIGN.match(/plain tap commits a modest\s+positive — \*\*`\(([^)]+)\)`\*\*/);
    expect(stated, "§8.3 no longer states the tap default").not.toBeNull();
    const [directed, interest] = stated![1].split(",").map((part) => Number(part.trim()));
    expect(TAP_DEFAULT).toEqual({ pDirected: directed, pInterest: interest });
  });

  it("reads an exact anchor as itself", () => {
    for (const anchor of STANCE_ANCHORS) {
      expect(nearestAnchor(anchor)).toEqual(anchor);
    }
  });

  it("reads the tap default as the nearest anchor, not as its own face", () => {
    // (+0.1, +0.1) is not an anchor; the readout is the nearest one.
    expect(nearestAnchor(TAP_DEFAULT).label).toBe("Nice");
  });

  it("reads each corner as the anchor placed nearest it", () => {
    expect(nearestAnchor({ pDirected: 1, pInterest: 1 }).label).toBe("All in");
    expect(nearestAnchor({ pDirected: -1, pInterest: 1 }).label).toBe(
      "Against, and I want all of it",
    );
    expect(nearestAnchor({ pDirected: 1, pInterest: -1 }).label).toBe("Good, keep it away");
    expect(nearestAnchor({ pDirected: -1, pInterest: -1 }).label).toBe("Absolutely not");
  });

  it("reads the origin as the nearest anchor by Euclidean distance", () => {
    // The two 0.15 anchors are equidistant from the origin and nearer than
    // any other, so an untouched pad reads the first of them.
    expect(nearestAnchor({ pDirected: 0, pInterest: 0 }).label).toBe("Nice");
  });

  it("breaks an exact tie toward the earlier anchor, deterministically", () => {
    // The midpoint of (+0.15,+0.15) and (-0.15,+0.15) is equidistant from
    // both; the table's order decides, so the readout never flickers.
    const tie = { pDirected: 0, pInterest: 0.15 };
    expect(nearestAnchor(tie).label).toBe("Nice");
    expect(nearestAnchor(tie)).toBe(nearestAnchor(tie));
  });

  it("places every anchor inside the field", () => {
    for (const anchor of STANCE_ANCHORS) {
      expect(Math.abs(anchor.pDirected)).toBeLessThanOrEqual(1);
      expect(Math.abs(anchor.pInterest)).toBeLessThanOrEqual(1);
    }
  });
});

describe("the zero bundle's readout", () => {
  it("takes its emoji from design.md §8.4 rather than from here", () => {
    const stated = DESIGN.match(
      /zero bundle never speaks through the table[\s\S]*?It gets its own readout: \*\*(\S+)\*\*/,
    );
    expect(stated, "§8.4 no longer states the zero-bundle readout").not.toBeNull();
    expect(ZERO_BUNDLE_EMOJI).toBe(stated![1]);
  });

  it("shrugs at exactly zero instead of borrowing the nearest face", () => {
    // The table's answer at the origin is "🙂 Nice" — the absence of a
    // feeling read as one, which is the lie §8.4 forbids.
    expect(nearestAnchor(ORIGIN).label).toBe("Nice");

    const readout = bundleReadout(ORIGIN, "Severed");

    expect(readout.emoji).toBe(ZERO_BUNDLE_EMOJI);
    expect(readout.label).toBe("Severed");
  });

  it("takes the caller's wording, so severed and never-stanced differ", () => {
    expect(bundleReadout(ORIGIN, "No stance yet").label).toBe("No stance yet");
  });

  it("reads every non-zero bundle through the table as before", () => {
    // Including the ones that are inert on one axis: §8.4 exempts the
    // ORIGIN, not everything the fold happens to flag.
    for (const pair of [
      { pDirected: 0, pInterest: 0.6 },
      { pDirected: 0.7, pInterest: 0 },
      { pDirected: -0.9, pInterest: -0.9 },
      { pDirected: 0.001, pInterest: 0 },
    ]) {
      expect(bundleReadout(pair, "Severed")).toEqual(nearestAnchor(pair));
    }
  });

  it("shrugs at a negative zero, which a drag that never moved produces", () => {
    expect(bundleReadout({ pDirected: -0, pInterest: 0 }, "Severed").emoji).toBe(
      ZERO_BUNDLE_EMOJI,
    );
  });
});

describe("the resting face an unauthored target wears", () => {
  it("stands outside the table, so an empty control is never a standing", () => {
    // §8.3 by way of Q42: the third state is neither a pick nor a
    // bundle, so no anchor may produce its face.
    expect(STANCE_ANCHORS.map((anchor) => anchor.emoji)).not.toContain(RESTING_FACE_EMOJI);
  });

  it("is not the shrug, which a zero standing owns", () => {
    // A bundle netted to nothing and a target never given anything are
    // different states, and the read tells them apart — so the glyphs
    // must too (§8.4).
    expect(RESTING_FACE_EMOJI).not.toBe(ZERO_BUNDLE_EMOJI);
  });
});
