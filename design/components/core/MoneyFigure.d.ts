/**
 * The money figure — the one shape every CGT amount on screen uses: two
 * decimals, thousands grouped, dust as `< 0.01`, zero as `0`, and the CGT
 * mark trailing where a unit word would sit. Negative numbers are outflows
 * and render signed (−); `signed` opts positive inflows into `+`; dust never
 * signs — its line's words carry the direction alone. Direction carries no
 * colour. The word "CGT" appears only where `unit` teaches it.
 */
export interface MoneyFigureProps {
  /** The amount in CGT. Negative means an outflow on a history line. */
  amount: number;
  /** Render an explicit `+` on positive amounts (history lines). */
  signed?: boolean;
  /** Also spell "CGT" after the mark — the teaching lockup, the wallet's
   * balance headline only. */
  unit?: boolean;
  style?: React.CSSProperties;
}

export declare function MoneyFigure(props: MoneyFigureProps): JSX.Element;

/** The CGT mark alone — the primary coin carrying the brand mark
 * (cogra-mark.svg, knocked out monochrome).
 * 1em by default, baseline-aligned, aria-hidden. */
export interface CgtMarkProps {
  size?: number | string;
  style?: React.CSSProperties;
}

export declare function CgtMark(props: CgtMarkProps): JSX.Element;

/** The formatting rule by itself: `0`, `< 0.01`, or grouped two-decimal. */
export declare function formatCgt(amount: number): string;
