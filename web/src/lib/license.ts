// License qualifiers (platform-guidelines.md §5): two axes, each a
// degree on [0,1] — attribution `a` and provenance `o`. Both are terms
// over downstream use, never a statement about how the content was
// made. The wire carries the full square so the record CoGra publishes
// is the field L1 reserves; the composer offers only the three readings
// CoGra publishes, because a free numeric input would ask authors to
// price a degree the platform has no reading for.

export type License = {
  attribution: number;
  provenance: number;
};

export type LicenseTier = {
  value: number;
  label: string;
  /** What the tier obliges, in the composer's own words. */
  hint: string;
};

export const PUBLIC_DOMAIN: License = { attribution: 0, provenance: 0 };

export const ATTRIBUTION_TIERS: readonly LicenseTier[] = [
  { value: 0, label: "No credit", hint: "Nobody owes you a name." },
  {
    value: 0.5,
    label: "Credit commercially",
    hint: "Commercial uses credit you; everything else is free.",
  },
  { value: 1, label: "Credit always", hint: "Every use credits you." },
];

// The tier names are VERBS, because what the author chooses is whether the
// platform logs — not what kind of record exists. *Record* is the graph's own
// word for the thing every act already is, so a tier called "No record" on a
// system where nothing is ever unrecorded said the opposite of the truth
// (copy-voice.md "The author's own tier names"; `LicenseChooser.jsx:18-21`).
export const PROVENANCE_TIERS: readonly LicenseTier[] = [
  { value: 0, label: "Not logged", hint: "Uses go unlogged." },
  {
    value: 0.5,
    label: "Log commercial use",
    hint: "Commercial uses are logged publicly and stay open to audit.",
  },
  {
    value: 1,
    label: "Log every use",
    hint: "Every use is logged publicly and stays open to audit.",
  },
];

/** The tier a degree names, or null for a degree between the tiers. */
export function tierOf(tiers: readonly LicenseTier[], value: number): LicenseTier | null {
  return tiers.find((tier) => tier.value === value) ?? null;
}

/**
 * What a pair obliges, IN THE AUTHOR'S OWN VOICE — the composer's running
 * summary of the terms it is about to sign. Public Domain is the one pair that
 * obliges nothing, so it says so instead of listing two absences; a degree
 * between the published tiers reads as the degree itself rather than being
 * rounded into a tier it is not.
 *
 * A READ SURFACE USES `licenseReadings` INSTEAD. These words address the author
 * declaring the terms, and on a read surface they told a reuser they were owed
 * the credit they in fact owe.
 */
export function licenseTerms(license: License): readonly string[] {
  if (isPublicDomain(license)) {
    return ["Public domain — no obligation on reuse"];
  }
  const terms: string[] = [];
  if (license.attribution > 0) {
    terms.push(
      tierOf(ATTRIBUTION_TIERS, license.attribution)?.hint ??
        `Credit owed to degree ${license.attribution}.`,
    );
  }
  if (license.provenance > 0) {
    terms.push(
      tierOf(PROVENANCE_TIERS, license.provenance)?.hint ??
        `Uses logged publicly to degree ${license.provenance}.`,
    );
  }
  return terms;
}

/**
 * THE READER'S READINGS, not the author's (`LicenseChooser.jsx:36-49`;
 * copy-voice.md "The license block"). The chooser's hints address the author
 * declaring the terms — "Every use credits you" — which on a read surface told
 * a reuser they were owed the credit they in fact owe. So the read side has its
 * own table, in the reuser's voice, one line per axis.
 *
 * Both rows always stand, whatever the pair: a block that dropped an axis at
 * zero would read as a shorter license rather than a term that obliges nothing,
 * and the two readings only read as a pair while they are drawn as one. The
 * Public Domain NAME rides the caption line instead (`LicenseTerms`).
 *
 * A degree between the published tiers reads as the degree itself rather than
 * being rounded into a tier it is not.
 */
const READER_READINGS = {
  attribution: {
    0: "Not required",
    0.5: "Required for commercial use",
    1: "Required for every use",
  },
  provenance: {
    0: "Not logged",
    0.5: "Commercial uses logged publicly",
    1: "Every use logged publicly",
  },
} as const satisfies Record<string, Record<number, string>>;

export type LicenseReading = {
  /** The chooser's own legend, so both sides of the act use one word. */
  axis: string;
  reading: string;
};

/** What a pair obliges, per axis, as the read surface says it. */
export function licenseReadings(license: License): readonly LicenseReading[] {
  return [
    {
      axis: "Credit",
      reading:
        READER_READINGS.attribution[license.attribution as 0 | 0.5 | 1] ??
        `Owed to degree ${license.attribution}`,
    },
    {
      axis: "Public record of use",
      reading:
        READER_READINGS.provenance[license.provenance as 0 | 0.5 | 1] ??
        `Logged to degree ${license.provenance}`,
    },
  ];
}

/** Whether a pair is the one readers already have a word for. */
export function isPublicDomain(license: License): boolean {
  return license.attribution === 0 && license.provenance === 0;
}
