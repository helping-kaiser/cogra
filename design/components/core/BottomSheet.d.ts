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
  /**
   * Cap before the sheet scrolls internally. Default "62%"; "88%" is the raised
   * class for a sheet whose content needs the room. Either is held under the
   * tallest-sheet ceiling — a 72px sliver below the safe area — so a class can
   * never out-grow the sliver on a short screen.
   */
  maxHeight?: string;
  /**
   * Pin the sheet at a size instead of letting content set it (overrides
   * `maxHeight`, held under the same ceiling) — the footed filter sheet, whose
   * Done row is pinned beneath its scrolling sections. Children manage their own
   * scrolling.
   */
  height?: string;
  /**
   * Take the tallest-sheet class: pinned at the ceiling, a 72px sliver below the
   * safe area, children scrolling inside it. The comments sheet, whose pinned
   * composer row needs the surface itself to own the height.
   */
  tallest?: boolean;
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
