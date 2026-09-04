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

/** The words of the menu row that opens the terms — assigned once, spelled by
 *  every surface that offers it. */
export declare const LICENSE_MENU_LABEL: string;
