/**
 * The thing being answered, held above the answer — the row every reply
 * composer opens with. Contained on `surface-container-highest`, because the
 * composer's own words sit on the page's ground with no box: the box is the
 * signal that this block is quoted rather than written. Inert by design; the
 * reader is already inside what it names.
 */
export interface QuotedRowProps {
  /** The post and its author — "The long way home — @ada". Never ellipsized:
   *  losing its end loses who. */
  title: React.ReactNode;
  /** How the post starts. One line, ellipsized — a taste, not the text. */
  snippet?: React.ReactNode;
  /** The author's display name, for the monogram when there is no picture. */
  name?: string;
  /** The author's picture. */
  src?: string;
}

export declare function QuotedRow(props: QuotedRowProps): JSX.Element;
