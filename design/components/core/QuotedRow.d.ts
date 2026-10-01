/**
 * The thing being answered, held above the answer — the row every reply
 * composer opens with. Contained on `surface-container-highest`, because the
 * composer's own words sit on the page's ground with no box: the box is the
 * signal that this block is quoted rather than written. Inert by design; the
 * reader is already inside what it names.
 */
export interface QuotedRowProps {
  /** What is answered and whose it is — a post as its title and author,
   *  "The long way home — @ada"; a comment, which has no title, as its
   *  author's handle, "@tobias". Never ellipsized: losing its end loses who. */
  title: React.ReactNode;
  /** How the post or comment starts. One line, ellipsized — a taste, not the
   *  text. */
  snippet?: React.ReactNode;
  /** The author's display name, for the monogram when there is no picture. */
  name?: string;
  /** The author's picture. */
  src?: string;
  /** Stands where the picture stands, for a thing whose face is not a
   *  person's — a tag's `#` tile (`NodeMark`). */
  mark?: React.ReactNode;
}

export declare function QuotedRow(props: QuotedRowProps): JSX.Element;
