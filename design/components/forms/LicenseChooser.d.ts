/** The two-axis license declaration a genesis content record carries. */
export interface License {
  /** Credit owed on reuse: 0, 0.5, or 1. */
  attribution: number;
  /** Public record of use: 0, 0.5, or 1. */
  provenance: number;
}

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
export declare function licenseTerms(license: License): readonly string[];
