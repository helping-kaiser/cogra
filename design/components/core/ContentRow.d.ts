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
  /** What the list keeps on its trailing edge — a figure, a time. */
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
  /** Where the row goes. */
  onOpen?: () => void;
}

export declare function ContentRow(props: ContentRowProps): JSX.Element;
