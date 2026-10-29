/**
 * The stream's rail: the post card's action row turned on its side and laid
 * over the clip (readme §13, the reel round).
 *
 * The order is ruled — author · opinion · comments · share · score. People lead;
 * then the acts in the card's own order; the score last, because it is the door
 * out of the stream and a thumb reaching for the opinion must not pass over the
 * exit. Topics, the reference count and the reader's overflow are absent by
 * rule: they belong to the detail view the score opens.
 *
 * Every glyph is white at 28px with a soft shadow — a token colour on
 * photography is invisible, and a plate behind each of five controls is a wall
 * of chrome. The opinion control is the system's own `StanceControl` in its `overMedia`
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
  /**
   * The Feed score, already formatted — the rail never does arithmetic: the
   * same figure the card wears (what the latest fetch of the post found, the
   * reader's own last feed fetch or the trace's since), or `—` where that
   * fetch found none. The door stays either way.
   */
  score?: string;
  /** Still settling: the score glyph stands bare with `Still settling` under it, and still opens the post. */
  settling?: boolean;
  /** A board drawing the score door in more than one state hands the slot itself (`ReelRailScore` copies). */
  scoreSlot?: React.ReactNode;
  /** The opinion face's row line — a hold that did not sign, or the write rule's refusal — on a `ReelPlate` beside the face. */
  stanceLine?: React.ReactNode;
  /** Omitted, the comment item is not drawn. */
  comments?: number;
  /** Distance from the surface's bottom edge; clears the bottom bar and the caption. */
  bottom?: number;
  onOpenProfile?: () => void;
  onOpenComments?: () => void;
  onShare?: () => void;
  onOpenScore?: () => void;
  /** The data-node name its placer gives the rail (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `author`, `stance`, `comments`, `share`, `score`. */
  node?: string;
}

export declare function ReelRail(props: ReelRailProps): JSX.Element;

/** One rail control: a 28px glyph with its count beneath, white and shadowed. */
export interface ReelRailItemProps {
  /** The accessible name — these controls are glyphs, so this is all a listener gets. */
  label: string;
  glyph: string;
  count?: number;
  onClick?: () => void;
  /** The data-node name its placer gives the control. */
  node?: string;
}

export declare function ReelRailItem(props: ReelRailItemProps): JSX.Element;

/** The rail's score door in its three faces: the figure, the dash, and settling's bare glyph over `Still settling` — the line inside the door, the whole face being the door. */
export interface ReelRailScoreProps {
  score?: string;
  settling?: boolean;
  onOpen?: () => void;
  /** The data-node name its placer gives the door; its parts are `ExplainableNumber`'s, `value` and `settling`. */
  node?: string;
}

export declare function ReelRailScore(props: ReelRailScoreProps): JSX.Element;

/**
 * The stream's plate: a line the stream owes the reader, on the wash's own
 * black at 60 %, because over a clip there is no row for it to stand on. It
 * stands until answered and never fades on a timer; the words keep their own
 * registers. `role` is `status` for a notice, `alert` for a failure.
 */
export interface ReelPlateProps {
  children: React.ReactNode;
  role?: "status" | "alert";
  /** The data-node name its placer gives the line (`notice`, `stanceLine`). */
  node?: string;
}

export declare function ReelPlate(props: ReelPlateProps): JSX.Element;
