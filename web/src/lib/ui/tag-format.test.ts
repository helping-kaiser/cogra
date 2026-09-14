// @vitest-environment node

import { describe, expect, it } from "vitest";

import { formatStancePair } from "./stance-format";
import { formatConfidence, formatTagPair, formatTagParams } from "./tag-format";

describe("tag parameter formatting", () => {
  it("writes confidence without a forced sign", () => {
    expect(formatConfidence(0.9)).toBe("0.90");
    expect(formatConfidence(1)).toBe("1.00");
  });

  it("writes the revealed chip's pair with the divider", () => {
    expect(formatTagParams(0.4, 0.9)).toBe("+0.40 · 0.90");
  });

  it("writes the sheet's pair as the board draws it", () => {
    // `RefsSheet.jsx:44-45`, the two drawn tag rows.
    expect(formatTagPair(0.4, 0.9)).toBe("+0.40 / 0.90");
    expect(formatTagPair(0.1, 1)).toBe("+0.10 / 1.00");
  });

  it("signs a tag's pair differently from a citation's", () => {
    // The whole content of the two shapes: a citation carries a sign on
    // both axes, a tag only on relevance (`StanceReadout.jsx:329-340`).
    expect(formatTagPair(0.1, 0.1)).toBe("+0.10 / 0.10");
    expect(formatStancePair({ pDirected: 0.1, pInterest: 0.1 })).toBe("+0.10 / +0.10");
  });
});
