// @vitest-environment node
// Pins the readout to design.md §8.4, the way palette.test.ts pins colour
// to design/tokens/scheme.json: the doc's table is the contract both clients
// read, so it is parsed here rather than transcribed. A row edited in the
// doc and not in the code — or the reverse — fails.
//
// The low default is pinned the same way, out of §8.3: it is the one
// number the held gesture writes and the one the pad opens at, and the
// low-defaults policy is what keeps stronger stances expressible.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  bundleReadout,
  EMPTY_PICK_LABEL,
  nearestAnchor,
  RESTING_FACE_EMOJI,
  STANCE_ANCHORS,
  UNREACHABLE_EMOJI,
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

  it("takes the held default from design.md §8.3, where a tap stages nothing", () => {
    // stance-control.md "The gesture": the tap opens, the hold signs.
    expect(DESIGN).toMatch(/A tap blooms the pad and stages\s+nothing/);
    const stated = DESIGN.match(
      /press-and-hold of 500ms commits a modest\s+positive — \*\*`\(([^)]+)\)`\*\*/,
    );
    expect(stated, "§8.3 no longer states the held default").not.toBeNull();
    const [directed, interest] = stated![1].split(",").map((part) => Number(part.trim()));
    expect(TAP_DEFAULT).toEqual({ pDirected: directed, pInterest: interest });
  });

  it("reads an exact anchor as itself", () => {
    for (const anchor of STANCE_ANCHORS) {
      expect(nearestAnchor(anchor)).toEqual(anchor);
    }
  });

  it("reads the low default as the nearest anchor, not as its own face", () => {
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
      /zero bundle never speaks through the table[\s\S]*?It\s+gets its own readout: \*\*(\S+)\*\*/,
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

  it("reads a pair through the table only when both numbers are non-zero", () => {
    // Faces follow the value (jakob 2026-10-21, seam 242): the table answers
    // only off both zero lines.
    for (const pair of [
      { pDirected: -0.9, pInterest: -0.9 },
      { pDirected: 0.001, pInterest: 0.001 },
      { pDirected: 0.1, pInterest: -0.4 },
    ]) {
      expect(bundleReadout(pair, "Walked back")).toEqual(nearestAnchor(pair));
    }
  });

  it("thinks at exactly one zero and names the state, never a table face", () => {
    // design.md §8.4: "A pair with exactly one number at zero wears 🤔 and
    // names its state". The expectations are the rule's, not the table's.
    const cases: [number, number, string][] = [
      [0, 0.6, "Interested, no side taken"],
      [0, -0.35, "Rather not see it, no side taken"],
      [0.7, 0, "For it, no interest either way"],
      [0.001, 0, "For it, no interest either way"],
      [-0.1, 0, "Against it, no interest either way"],
    ];
    for (const [pDirected, pInterest, head] of cases) {
      const readout = bundleReadout({ pDirected, pInterest }, "Walked back");
      expect(readout).toEqual({ emoji: UNREACHABLE_EMOJI, label: head });
      expect(STANCE_ANCHORS.map((anchor) => anchor.emoji)).not.toContain(readout.emoji);
    }
  });

  it("speaks a pick or a never-walked-back standing at (0, 0) as Says nothing", () => {
    expect(bundleReadout(ORIGIN, EMPTY_PICK_LABEL)).toEqual({
      emoji: ZERO_BUNDLE_EMOJI,
      label: "Says nothing",
    });
    const master = readFileSync(
      new URL("../../../../design/components/stance/StanceReadout.jsx", import.meta.url),
      "utf-8",
    );
    expect(master).toContain(`export const EMPTY_PICK_LABEL = "${EMPTY_PICK_LABEL}";`);
  });

  it("shrugs at a negative zero, which a drag that never moved produces", () => {
    expect(bundleReadout({ pDirected: -0, pInterest: 0 }, "Severed").emoji).toBe(
      ZERO_BUNDLE_EMOJI,
    );
  });
});

// THE CHOKE POINT HOLDS (seam 243): the master's own checker once computed
// expected faces from the bare table and drifted, so the structure is
// pinned — outside the two table modules, nothing in the shipped source
// calls a bare table walk; every face reads `bundleReadout`/`tagReadout`.
describe("the faces' one choke point", () => {
  it("leaves the bare table walks callable only from bundleReadout and tagReadout", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const owners = new Set([join(root, "lib", "stance", "anchors.ts"), join(root, "lib", "topics", "anchors.ts")]);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "__generated__") walk(path);
        } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !owners.has(path)) {
          if (/\bnearest(Tag)?Anchor\s*\(/.test(readFileSync(path, "utf-8"))) offenders.push(path);
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe("the one-zero face", () => {
  it("stands outside the table and apart from the shrug (jakob 2026-10-20)", () => {
    // 🤷 is (0, 0)'s alone; a single zero thinks — the master's export.
    expect(STANCE_ANCHORS.map((anchor) => anchor.emoji)).not.toContain(UNREACHABLE_EMOJI);
    expect(UNREACHABLE_EMOJI).not.toBe(ZERO_BUNDLE_EMOJI);
    expect(UNREACHABLE_EMOJI).not.toBe(RESTING_FACE_EMOJI);
    const master = readFileSync(
      new URL("../../../../design/components/stance/StanceReadout.jsx", import.meta.url),
      "utf-8",
    );
    expect(master).toContain(`export const UNREACHABLE_EMOJI = "${UNREACHABLE_EMOJI}";`);
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
