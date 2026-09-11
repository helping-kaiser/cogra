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
  /**
   * Where the trigger stands. "header" (default) rides a 24px line — a card
   * header, a `PageHeader` action — as a 48px box pulled back by -12px into
   * the gutter around it. "row" stands in a row of controls, where a profile's
   * ⋮ now lives: 40px of ink beside the row's buttons, no pull, the 48px
   * target kept through `cg-hit`.
   */
  placement?: "header" | "row";
}

export declare function OverflowMenu(props: OverflowMenuProps): JSX.Element | null;
