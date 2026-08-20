// License qualifiers (platform-guidelines.md §5): two axes, each a
// degree on [0,1] — attribution `a` and oversight `o`. Both are terms
// over downstream use, never a statement about how the content was
// made. The wire carries the full square so the record CoGra publishes
// is the field L1 reserves; the composer offers only the three readings
// CoGra publishes, because a free numeric input would ask authors to
// price a degree the platform has no reading for.

export type License = {
  attribution: number;
  oversight: number;
};

export type LicenseTier = {
  value: number;
  label: string;
  /** What the tier obliges, in the composer's own words. */
  hint: string;
};

export const PUBLIC_DOMAIN: License = { attribution: 0, oversight: 0 };

export const ATTRIBUTION_TIERS: readonly LicenseTier[] = [
  { value: 0, label: "No credit", hint: "Nobody owes you a name." },
  {
    value: 0.5,
    label: "Credit commercially",
    hint: "Commercial uses credit you; everything else is free.",
  },
  { value: 1, label: "Credit always", hint: "Every use credits you." },
];

export const OVERSIGHT_TIERS: readonly LicenseTier[] = [
  { value: 0, label: "No record", hint: "Uses go unlogged." },
  {
    value: 0.5,
    label: "Record commercially",
    hint: "Commercial uses are logged publicly and stay open to audit.",
  },
  {
    value: 1,
    label: "Record always",
    hint: "Every use is logged publicly and stays open to audit.",
  },
];

/** The tier a degree names, or null for a degree between the tiers. */
export function tierOf(tiers: readonly LicenseTier[], value: number): LicenseTier | null {
  return tiers.find((tier) => tier.value === value) ?? null;
}

/**
 * The obligations a pair puts on a reuser, as display lines. Public
 * Domain is the one pair that obliges nothing, so it says so instead of
 * listing two absences; a degree between the published tiers reads as
 * the degree itself rather than being rounded into a tier it is not.
 */
export function licenseTerms(license: License): readonly string[] {
  if (license.attribution === 0 && license.oversight === 0) {
    return ["Public domain — no obligation on reuse"];
  }
  const terms: string[] = [];
  if (license.attribution > 0) {
    terms.push(
      tierOf(ATTRIBUTION_TIERS, license.attribution)?.hint ??
        `Credit owed to degree ${license.attribution}.`,
    );
  }
  if (license.oversight > 0) {
    terms.push(
      tierOf(OVERSIGHT_TIERS, license.oversight)?.hint ??
        `Uses logged publicly to degree ${license.oversight}.`,
    );
  }
  return terms;
}
