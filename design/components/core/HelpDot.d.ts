/**
 * The "?" affordance — the one-per-screen door to a plain dialog: a 32px ring
 * in a 48px target, top-right of the header or of the sheet/card it explains.
 */
export interface HelpDotProps {
  ariaLabel?: string;
  onOpen?: () => void;
}

export declare function HelpDot(props: HelpDotProps): JSX.Element;
