/**
 * The pair of full-width buttons that ends every signing surface: the commit,
 * filled and first, and the way back one stage under it.
 */
export interface SealFooterProps {
  /** Names what is being signed — "Sign and publish", "Sign the change". */
  signLabel?: string;
  backLabel?: string;
  /** A failed upload's stop: the commit waits for Retry. Pair it with the
   *  line that says why, never on its own. A running upload leaves the
   *  commit enabled — a press there is the signing in flight, held until
   *  the bytes land. */
  disabled?: boolean;
  /** The signing is in flight (past 200ms): the commit reads `busyLabel`
   *  and goes inert — not dimmed, no spinner. */
  busy?: boolean;
  /** The commit's present participle — "Signing and publishing…". */
  busyLabel?: string;
  onSign?: () => void;
  onBack?: () => void;
}

export declare function SealFooter(props: SealFooterProps): JSX.Element;
