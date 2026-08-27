/**
 * A filter the reader turns on and off. Use chips for a set that combines or
 * grows; use `SegmentedFilter` for two to four alternatives where exactly one is
 * true. 32px drawn, 48px tapped.
 */
export interface ChipProps {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  /** When the label alone does not say what is being filtered. */
  ariaLabel?: string;
  disabled?: boolean;
}

export declare function Chip(props: ChipProps): JSX.Element;

/**
 * A topic. Looks like a filter chip and behaves like a link, which is the same
 * test that separates a button from a link. The `#` is part of the word.
 */
export interface TopicChipProps {
  /** With or without the leading `#`. */
  topic: string;
  href?: string;
  onClick?: (event: React.MouseEvent) => void;
}

export declare function TopicChip(props: TopicChipProps): JSX.Element;
