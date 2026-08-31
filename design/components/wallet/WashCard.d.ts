/**
 * The brand-wash card: `--surface-hero` with the ghosted oversized brand
 * coin, as one component. The wallet's hero rides it, and so do the wallet's
 * moment cards (first open, guest, applicant). At most one per screen — the
 * wash dresses a page's ONE moment, never a default card fill.
 */
export interface WashCardProps {
  /** The ghosted coin in the corner. On by default. */
  ghost?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export declare function WashCard(props: WashCardProps): JSX.Element;
