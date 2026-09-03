/** A recovery code shown once, with the type-it-back gate in front of dismissing it. */
export interface RecoveryCodeProps {
  code: string;
  /** What the code is for, and what happens if it is lost. */
  explainer: string;
  /** Fires when the reader has typed the code back correctly and confirmed. */
  onConfirmed?: () => void;
  /** M3 text-field error state on the confirm field, forwarded to it
   *  verbatim — this component draws its own field rather than composing
   *  TextField, so the error state needs this way in. */
  error?: string;
}

export declare function RecoveryCode(props: RecoveryCodeProps): JSX.Element;
