// @vitest-environment node
// Pins the tag table to the design bundle the way `stance/anchors.test.ts`
// pins the stance table to design.md §8.4: the thirteen rows are a
// cross-client contract, so they are parsed out of the master rather than
// trusted to review. A row edited there and not here — or the reverse — fails.

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { STANCE_ANCHORS } from "@/lib/stance/anchors";
import { nearestTagAnchor, TAG_ANCHORS, type TagAnchor } from "./anchors";

const MASTER = readFileSync(
  new URL("../../../../design/components/stance/StanceReadout.jsx", import.meta.url),
  "utf-8",
);

/** The `TAG_ANCHORS` block alone: the file carries the stance table too. */
function documentedAnchors(): TagAnchor[] {
  const block = MASTER.match(/export const TAG_ANCHORS = \[([\s\S]*?)\n\];/);
  if (block === null) throw new Error("the master no longer exports TAG_ANCHORS");
  const rows: TagAnchor[] = [];
  for (const [, relevance, confidence, emoji, label] of block[1]!.matchAll(
    /pDirected:\s*([0-9.]+),\s*pInterest:\s*([0-9.]+),\s*emoji:\s*"([^"]+)",\s*label:\s*"([^"]+)"/g,
  )) {
    rows.push({
      relevance: Number(relevance),
      confidence: Number(confidence),
      emoji: emoji!,
      label: label!,
    });
  }
  return rows;
}

describe("tag anchors", () => {
  it("carries the master's thirteen rows verbatim", () => {
    const documented = documentedAnchors();
    expect(documented.length, "no rows parsed — the table moved").toBe(13);
    expect(TAG_ANCHORS).toEqual(documented);
  });

  it("shares no glyph with the stance table", () => {
    const faces = new Set(STANCE_ANCHORS.map((anchor) => anchor.emoji));
    for (const anchor of TAG_ANCHORS) {
      expect(faces.has(anchor.emoji), `${anchor.emoji} is in both tables`).toBe(false);
    }
  });

  it("sits the twelve at the band centres, the thirteenth floating", () => {
    const grid = TAG_ANCHORS.slice(0, 12);
    expect(new Set(grid.map((anchor) => anchor.relevance))).toEqual(
      new Set([0.15, 0.45, 0.72, 0.95]),
    );
    expect(new Set(grid.map((anchor) => anchor.confidence))).toEqual(
      new Set([0.15, 0.55, 0.9]),
    );
    expect(TAG_ANCHORS[12]).toMatchObject({ relevance: 0.86, confidence: 0.95, emoji: "💯" });
  });

  it("reads every anchor as itself", () => {
    for (const anchor of TAG_ANCHORS) {
      expect(nearestTagAnchor(anchor.relevance, anchor.confidence)).toEqual(anchor);
    }
  });

  it("reads the board's two tag rows", () => {
    // `RefsSheet.jsx:44-45` — photography at +0.40 / 0.90, coastroad at
    // +0.10 / 1.00, the pair the drawn sheet carries on each.
    expect(nearestTagAnchor(0.4, 0.9).emoji).toBe("🔗");
    expect(nearestTagAnchor(0.1, 1).emoji).toBe("🔍");
  });
});
