/** The two-axis license declaration a genesis content record carries. */
export interface License {
  /** Credit owed on reuse: 0, 0.5, or 1. */
  attribution: number;
  /** Public record of use: 0, 0.5, or 1. */
  provenance: number;
}

/** One radio option on a license axis. */
export interface LicenseTier {
  value: 0 | 0.5 | 1;
  label: string;
  hint: string;
}

/** The Credit axis's three named readings, offered by `LicenseChooser`. */
export declare const ATTRIBUTION_TIERS: readonly LicenseTier[];
/** The Public record of use axis's three named readings. */
export declare const PROVENANCE_TIERS: readonly LicenseTier[];

export interface LicenseChooserProps {
  value?: License;
  onChange?: (license: License) => void;
  /** Radio-group name prefix, so two choosers on one page don't collide. */
  name?: string;
}

export declare function LicenseChooser(props: LicenseChooserProps): JSX.Element;

/** What a landed node's qualifiers oblige, on a read surface. */
export interface LicenseTermsProps {
  license?: License;
}

export declare function LicenseTerms(props: LicenseTermsProps): JSX.Element;

export declare const PUBLIC_DOMAIN: License;

/** One axis of a license as the read surface states it. */
export interface LicenseReading {
  axis: string;
  reading: string;
}

export declare function licenseReadings(license: License): readonly LicenseReading[];

/** The author's reading of a pair, by one joining rule: the pair's name
 *  (`Public domain` for the zero pair, else its two tier names joined by
 *  ` · `), a dash, then the two tier hints joined by `, and`. What the seal's
 *  License row, the license sheets' foot and the settings default all read. */
export declare function licenseSummary(license?: License): string;

/** `licenseSummary` as an element, for a slot that takes one. */
export declare function LicenseSummary(props: { license?: License }): string;

/** The words of the menu row that opens the terms — assigned once, spelled by
 *  every surface that offers it. */
export declare const LICENSE_MENU_LABEL: string;
