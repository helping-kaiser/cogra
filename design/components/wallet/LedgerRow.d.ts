/**
 * One line of the wallet's history — one stream, newest first. The words
 * carry what happened and what paid it; the figure carries the money;
 * direction is the sign and the words, never a colour. A not-yet-landed
 * payout wears the product's own Still settling.
 */
export interface LedgerRowProps {
  /** e.g. 'Payout · "Sunday at the tide market"', "Tip to @ada". */
  words: string;
  /** e.g. "2d". */
  when?: string;
  amount: number;
  /** History lines default to signed (inflows wear +). */
  signed?: boolean;
  pending?: boolean;
  /** The traceability promise: opens what paid it. */
  onOpen?: () => void;
}

export declare function LedgerRow(props: LedgerRowProps): JSX.Element;
