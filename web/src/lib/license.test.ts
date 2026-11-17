import { describe, expect, it } from "vitest";

import { ATTRIBUTION_TIERS, PROVENANCE_TIERS, PUBLIC_DOMAIN, licenseName, tierOf } from "./license";

describe("the author's reading of a pair is its name (LicenseChooser.jsx `licenseSummary`)", () => {
  it("names the zero pair Public domain and every other by its tier names", () => {
    expect(licenseName(PUBLIC_DOMAIN)).toBe("Public domain");
    expect(licenseName({ attribution: 1, provenance: 0 })).toBe("Credit always · Not logged");
    expect(licenseName({ attribution: 0.5, provenance: 1 })).toBe("Credit commercially · Log every use");
  });
});

describe("license", () => {
  it("offers exactly the three published degrees per axis", () => {
    expect(ATTRIBUTION_TIERS.map((tier) => tier.value)).toEqual([0, 0.5, 1]);
    expect(PROVENANCE_TIERS.map((tier) => tier.value)).toEqual([0, 0.5, 1]);
    expect(tierOf(ATTRIBUTION_TIERS, 0.3)).toBeNull();
  });

  // Seam 314 (round 42): a hint stands only where it says more than the
  // tier's name — the three that repeated their names are gone.
  it("carries a hint only where it says more than the tier's name", () => {
    expect(ATTRIBUTION_TIERS.map((tier) => tier.hint)).toEqual([
      undefined,
      "Commercial uses credit you; everything else is free.",
      undefined,
    ]);
    expect(PROVENANCE_TIERS.map((tier) => tier.hint)).toEqual([
      undefined,
      "Commercial uses are logged publicly and stay open to audit.",
      "Every use is logged publicly and stays open to audit.",
    ]);
  });
});
