/**
 * The stream's rail: the post card's action row turned on its side and laid
 * over the clip (readme §13, the reel round).
 *
 * The order is ruled — author · stance · comments · share · score. People lead;
 * then the acts in the card's own order; the score last, because it is the door
 * out of the stream and a thumb reaching for the stance must not pass over the
 * exit. Topics, the reference count and the reader's overflow are absent by
 * rule: they belong to the detail view the score opens.
 *
 * Every glyph is white at 28px with a soft shadow — a token colour on
 * photography is invisible, and a plate behind each of five controls is a wall
 * of chrome. The stance is the system's own `StanceControl` in its `overMedia`
 * dress, blooming the same pad over the paused clip.
 */
export interface ReelRailAuthor {
  handle: string;
  displayName: string;
  /** Optional avatar image; the monogram stands in without one. */
  src?: string;
}

export interface ReelRailProps {
  author?: ReelRailAuthor;
  /** The Post Score, already formatted — the rail never does arithmetic. */
  score?: string;
  /** Omitted, the comment item is not drawn. */
  comments?: number;
  /** Distance from the surface's bottom edge; clears the bottom bar and the caption. */
  bottom?: number;
  onOpenProfile?: () => void;
  onOpenComments?: () => void;
  onShare?: () => void;
  onOpenScore?: () => void;
}

export declare function ReelRail(props: ReelRailProps): JSX.Element;

/** One rail control: a 28px glyph with its count beneath, white and shadowed. */
export interface ReelRailItemProps {
  /** The accessible name — these controls are glyphs, so this is all a listener gets. */
  label: string;
  glyph: string;
  count?: number;
  onClick?: () => void;
}

export declare function ReelRailItem(props: ReelRailItemProps): JSX.Element;
