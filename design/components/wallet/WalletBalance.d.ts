/**
 * The wallet's hero: the balance as a trophy on the brand wash
 * (`--surface-hero`, the one decorative gradient surface), the brand coin
 * ghosted into the corner, the ≈ L-BTC market line and the recent-earnings
 * delta chip beneath. Still the one surface that spells CGT.
 */
export interface WalletBalanceProps {
  amount?: number;
  /** The market estimate as an L-BTC figure string (e.g. "0.00087"). Omit when there is no reading; hidden at zero. */
  approx?: string;
  /** The recent-earnings amount — rendered by `MoneyFigure` (signed) with "this week" trailing. Omit when nothing is new. */
  delta?: number;
  onHelp?: () => void;
}

export declare function WalletBalance(props: WalletBalanceProps): JSX.Element;
