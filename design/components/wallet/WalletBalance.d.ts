/**
 * The wallet's balance headline — the one surface that spells the word CGT
 * (mark and word adjacent), with the "?" (What is CGT?) beside it and the
 * optional ≈ L-BTC value line read from the public CGT–L-BTC market.
 */
export interface WalletBalanceProps {
  amount?: number;
  /** The market estimate as an L-BTC figure string (e.g. "0.00087"). Omit when there is no market reading; hidden at zero balance. */
  approx?: string;
  onHelp?: () => void;
}

export declare function WalletBalance(props: WalletBalanceProps): JSX.Element;
