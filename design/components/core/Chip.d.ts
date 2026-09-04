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
  /** `md` is the chip proper (32px, label-large); `sm` is the same pill at 24px. */
  size?: "md" | "sm";
  /**
   * `filter` is the control. `readout` is the chip the reader is shown — the
   * borderless 24px `secondaryContainer` span in the acts card — which takes
   * no size, no selection and no handler, because it is not pressed.
   */
  tone?: "filter" | "readout";
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
  /** The same pill as a span, for a topic inside a larger tap target — a link
   *  nested in a button is two controls fighting over one press. */
  inert?: boolean;
  /** `md` is the chip proper (32px, label-large); `sm` is the 24px readout rung. */
  size?: "md" | "sm";
  style?: React.CSSProperties;
}

export declare function TopicChip(props: TopicChipProps): JSX.Element;
