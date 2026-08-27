export interface OverflowMenuItem {
  label: string;
  onSelect?: () => void;
}

/**
 * The overflow menu on a piece of content: the rare interactions, kept out of the
 * affordance row so the row carries only what a reader reaches for.
 */
export interface OverflowMenuProps {
  /** One line each, `label-large`, 48px targets. No icons in the list. */
  items?: readonly OverflowMenuItem[];
  /** Accessible name for the trigger. Default "More". */
  ariaLabel?: string;
  /** Which edge the sheet aligns to. "right" in a card header. */
  align?: "left" | "right";
  /**
   * "sheet" (default) opens a `BottomSheet` from the bottom edge — both clients
   * render at phone width, and a popover pinned to a 24px glyph is a desktop
   * idiom thumbs miss. "menu" is the anchored popover, for a genuinely wide
   * surface; `align` only applies to it.
   */
  presentation?: "sheet" | "menu";
}

export declare function OverflowMenu(props: OverflowMenuProps): JSX.Element | null;
