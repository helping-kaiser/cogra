export interface SegmentedFilterOption {
  value: string;
  /** One or two words. A segment that needs a sentence is the wrong control. */
  label: string;
}

/**
 * The filter over one list: 2–4 mutually exclusive options that partition it.
 * Five or more, multi-select, or an open-ended set — use chips instead. Options
 * that lead somewhere rather than filter are navigation, not this.
 */
export interface SegmentedFilterProps {
  options?: readonly SegmentedFilterOption[];
  value?: string;
  onChange?: (value: string) => void;
  /** What the group filters, e.g. "Filter the chronicle". */
  ariaLabel?: string;
}

export declare function SegmentedFilter(props: SegmentedFilterProps): JSX.Element | null;
