/**
 * Earnings per settlement as bars — honest decoration: every bar is a real
 * payout from a real public settlement and taps into it. The latest bar
 * wears primary (emphasis on recency, never direction); a zero settlement
 * is a visible stub, not a gap.
 */
export interface EarnedChartPoint {
  amount: number;
  /** Accessible name, e.g. 'Settlement of "Sunday at the tide market" — 12.40'. */
  label?: string;
  onOpen?: () => void;
}

export interface EarnedChartProps {
  points?: readonly EarnedChartPoint[];
  caption?: string;
  height?: number;
}

export declare function EarnedChart(props: EarnedChartProps): JSX.Element | null;
