/**
 * The identity row — the card-lite line every list in this product is built
 * from: a 40px disc saying who or what, two lines of words saying which and
 * when, and whatever the list keeps on its trailing edge. The wallet's history,
 * the campaigns list, the campaigns door and the chronicle are its variants.
 */
export interface ContentRowProps {
  /**
   * `ledger` — the wallet's history (label-small second line, body-sized
   * trailing figure). `campaign` — a campaign in a list; its disc image is a
   * TILE, because a campaign is a thing with a face rather than somebody with
   * one. `door` — a doorway into a section; its disc is `primary`-filled, which
   * is what says entrance rather than entry. `chronicle` — a record of an act;
   * its second line is the act's own words, so it takes body type, and its
   * trailing edge is a time.
   */
  variant?: "ledger" | "campaign" | "door" | "chronicle";
  /** The first line. Always one line, ellipsized. */
  title: React.ReactNode;
  /** A quiet word riding the title's baseline — the chronicle's context. */
  titleAside?: React.ReactNode;
  /** The second line: always ONE line, ellipsized, in `text-secondary`. */
  second?: React.ReactNode;
  /** What the list keeps on its trailing edge. A figure is the row's point and
   *  keeps `on-surface`; the chronicle's time is a quiet fact and does not. */
  trailing?: React.ReactNode;
  /** The trailing figure goes quiet and the row wears *Still settling*. */
  pending?: boolean;
  /** The disc, by precedence: an image (round, or a tile in `campaign`)… */
  image?: string;
  /** …else a monogram for this display name… */
  name?: string;
  /** …else a stance face, for a record that is a stance… */
  face?: { pDirected: number; pInterest: number };
  /** …else a glyph (defaults to the wallet glyph). */
  glyph?: string;
  /** Draws the direction badge on the disc; `in` rotates the arrow. */
  direction?: "in" | "out";
  /** The trailing chevron. On by default; the chronicle turns it off. */
  chevron?: boolean;
  /** The same card with nothing to press — a record with no destination. */
  inert?: boolean;
  /** The shell's unread dot on the row's trailing edge: this arrived and has
   *  not been opened. The bell's own mark at row scale, never a weight change. */
  unread?: boolean;
  /**
   * One control of the row's own, in the trailing-most slot — the chevron's,
   * which it replaces. The trailing edge keeps its own content and sits
   * inboard of it: on the Saved list the age is the list's order and the thing
   * a reader retraces, so the control stands beside the age, never instead of
   * it. Given one, the row splits into a pressable part and this control, so
   * there is never a button inside a button.
   */
  action?: React.ReactNode;
  /** Where the row goes. */
  onOpen?: () => void;
}

export declare function ContentRow(props: ContentRowProps): JSX.Element;
