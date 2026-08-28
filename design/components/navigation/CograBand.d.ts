/**
 * The read shell's top-left identity: mark + wordmark on a 48px band. Tab
 * roots wear it; inner surfaces wear `PageHeader` instead.
 */
export interface CograBandProps {
  /** The band's right edge — the tab's one working control (the feed's filter
   *  trigger). The band never spends its full width on identity alone. */
  trailing?: React.ReactNode;
  /** Rides below the band in the same non-shrinking block. */
  children?: React.ReactNode;
}

export declare function CograBand(props: CograBandProps): JSX.Element;
