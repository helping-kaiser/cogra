/**
 * The read shell's top-left identity: mark + wordmark on a 48px band. Tab
 * roots wear it; inner surfaces wear `PageHeader` instead.
 */
export interface CograBandProps {
  /** Rides below the band in the same non-shrinking block. */
  children?: React.ReactNode;
}

export declare function CograBand(props: CograBandProps): JSX.Element;
