/**
 * One line of the wallet's history — an identity row: the leading disc is
 * who or what the money moved with (avatar, campaign cover, or glyph),
 * wearing the direction badge; words + context carry what happened and what
 * paid it; direction stays the sign and the words — the amount is never
 * coloured. One stream, newest first.
 */
export interface LedgerRowProps {
  /** e.g. "Tip from @tobias", 'Payout · "Sunday at the tide market"'. */
  words: string;
  /** The source line under the words — the paid post, the tipped target. */
  context?: string;
  /** e.g. "2d". */
  when?: string;
  amount: number;
  /** History lines default to signed (inflows wear +). */
  signed?: boolean;
  /** The figure goes quiet and the row wears Still settling. */
  pending?: boolean;
  /** The disc, by precedence: an image (avatar or cover thumb)… */
  image?: string;
  /** …else a monogram for this display name… */
  name?: string;
  /** …else a glyph (defaults to the wallet glyph). */
  glyph?: string;
  /** Defaults from the amount's sign; override when they disagree. */
  direction?: "in" | "out";
  /** The traceability promise: opens what paid it. */
  onOpen?: () => void;
}

export declare function LedgerRow(props: LedgerRowProps): JSX.Element;
