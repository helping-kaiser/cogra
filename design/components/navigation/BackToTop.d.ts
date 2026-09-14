/**
 * The feed's scroll-to-top pill. It rides in with the returning collapsing
 * band, centred directly under it, and performs the same animated jump the
 * bottom bar's re-tap ladder makes from a scrolled root.
 *
 * It is drawn FIXED rather than placed inside `CollapsingTop`'s children: the
 * region hides once half its own slot has scrolled past, so anything added to
 * that block moves the band's threshold and re-clamps the list (backlog item
 * 45.3).
 */
export interface BackToTopProps {
  /** Scrolls the list to the top, animated — the ladder's third rung. */
  onPress?: () => void;
  /**
   * Distance from the top of the scroll host, in px: the collapsing block's own
   * height, so the pill sits directly beneath it. 56 is the feed's — the 48px
   * band plus the region's `space-2` tail.
   */
  offset?: number;
  /** Renders in flow instead of fixed — for the component card. */
  inline?: boolean;
}

export declare function BackToTop(props: BackToTopProps): JSX.Element;
