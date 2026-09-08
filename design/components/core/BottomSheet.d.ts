/**
 * The bottom sheet: a drawer of choices the reader opened and can drop, not a
 * question they must answer. Comes up from the bottom edge and goes back to it.
 */
export interface BottomSheetProps {
  open?: boolean;
  /** Pressing the scrim and Escape both call this. */
  onClose?: () => void;
  ariaLabel?: string;
  children?: React.ReactNode;
  /** Render in flow, with no scrim and no animation — for specimens. */
  inline?: boolean;
  /** Cap before the sheet scrolls internally. Default "62%". */
  maxHeight?: string;
  /**
   * Pin the sheet at a fixed size (overrides `maxHeight`) — the comments sheet
   * fills the screen up to a sliver below the top, and its pinned entry row
   * needs the surface to own the height. Children manage their own scrolling.
   */
  height?: string;
  /**
   * This sheet opens over another sheet. It takes the layer above, so its own
   * wash falls between the two and dims the sheet below, and its surface takes
   * the next tonal rung — `surfaceContainerHighest`.
   */
  stacked?: boolean;
}

export declare function BottomSheet(props: BottomSheetProps): JSX.Element | null;

/** One row: label-large, 48px minimum, left-aligned, one line, no icon. */
export interface SheetItemProps {
  label: string;
  onSelect?: () => void;
  ariaLabel?: string;
}

export declare function SheetItem(props: SheetItemProps): JSX.Element;

/**
 * The sheet's heading, when the choices need naming. No close button beside it.
 * `trailing` rides at the end of the heading's own row — the screen's "?", or the
 * switch the sheet exists for.
 */
export declare function SheetTitle(props: {
  children?: React.ReactNode;
  trailing?: React.ReactNode;
}): JSX.Element;
