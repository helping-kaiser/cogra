import { describe, expect, it } from "vitest";

import {
  ATTRIBUTION_TIERS,
  PROVENANCE_TIERS,
  PUBLIC_DOMAIN,
  licenseName,
  licenseReading,
  licenseTerms,
  tierOf,
} from "./license";

describe("the author's reading of a pair (copy-voice `licenseSummary`)", () => {
  it("names the zero pair Public domain and every other by its tier names", () => {
    expect(licenseName(PUBLIC_DOMAIN)).toBe("Public domain");
    expect(licenseName({ attribution: 1, provenance: 0 })).toBe("Credit always · Not logged");
  });

  it("joins the name and both hints into one sentence", () => {
    expect(licenseReading(PUBLIC_DOMAIN)).toBe(
      "Public domain — nobody owes you a name, and uses go unlogged.",
    );
    expect(licenseReading({ attribution: 1, provenance: 0 })).toBe(
      "Credit always · Not logged — every use credits you, and uses go unlogged.",
    );
  });
});

describe("license", () => {
  it("reads the zero corner as public domain, not as two absences", () => {
    expect(licenseTerms(PUBLIC_DOMAIN)).toEqual([
      "Public domain — no obligation on reuse",
    ]);
  });

  it("lists only the axes that oblige something", () => {
    expect(licenseTerms({ attribution: 1, provenance: 0 })).toHaveLength(1);
    expect(licenseTerms({ attribution: 0, provenance: 1 })).toHaveLength(1);
    expect(licenseTerms({ attribution: 1, provenance: 1 })).toHaveLength(2);
  });

  it("separates the commercial tier from the unconditional one", () => {
    const [commercial] = licenseTerms({ attribution: 0.5, provenance: 0 });
    const [always] = licenseTerms({ attribution: 1, provenance: 0 });
    expect(commercial).toContain("Commercial");
    expect(always).not.toEqual(commercial);
  });

  // A record may carry a degree CoGra publishes no reading for; it is
  // served as the degree rather than rounded into a tier it is not.
  it("reports an interior degree as itself", () => {
    expect(licenseTerms({ attribution: 0.3, provenance: 0 })).toEqual([
      "Credit owed to degree 0.3.",
    ]);
    expect(licenseTerms({ attribution: 0, provenance: 0.7 })).toEqual([
      "Uses logged publicly to degree 0.7.",
    ]);
  });

  it("offers exactly the three published degrees per axis", () => {
    expect(ATTRIBUTION_TIERS.map((tier) => tier.value)).toEqual([0, 0.5, 1]);
    expect(PROVENANCE_TIERS.map((tier) => tier.value)).toEqual([0, 0.5, 1]);
    expect(tierOf(ATTRIBUTION_TIERS, 0.3)).toBeNull();
  });
});
