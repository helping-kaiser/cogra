/**
 * The pair of full-width buttons that ends every signing surface: the commit,
 * filled and first, and the way back one stage under it.
 */
export interface SealFooterProps {
  /** Names what is being signed — "Sign and publish", "Sign the change". */
  signLabel?: string;
  backLabel?: string;
  /** The upload's gate: nothing signs until the content it signs exists. Pair
   *  it with the line that says why, never on its own. */
  disabled?: boolean;
  onSign?: () => void;
  onBack?: () => void;
}

export declare function SealFooter(props: SealFooterProps): JSX.Element;
