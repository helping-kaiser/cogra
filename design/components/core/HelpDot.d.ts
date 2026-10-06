/**
 * The "?" affordance — the one-per-screen door to a plain dialog: a 32px ring
 * in a 48px target, top-right of the header or of the sheet/card it explains.
 */
export interface HelpDotProps {
  ariaLabel?: string;
  onOpen?: () => void;
  /**
   * "page" (default) rings in `--border-hairline` with a `--primary` glyph;
   * "inverse" takes the panel's own `currentColor` for both, for a dot standing
   * inside a tonal block. Same geometry either way.
   */
  variant?: "page" | "inverse";
  /** The data-node name its placer gives this dot (design ⇄ impl seam 002; renders as attributes only). */
  node?: string;
}

export declare function HelpDot(props: HelpDotProps): JSX.Element;
