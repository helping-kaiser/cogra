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
  /** Seeds the confirm field — how a board draws the typed-back state at
   *  rest (the diverged prefix on RecoveryCodeMismatch). Defaults to empty. */
  defaultTypedBack?: string;
}

export declare function RecoveryCode(props: RecoveryCodeProps): JSX.Element;

/** The one normalization every recovery-code input applies (auth.md, "Blob
 *  format"): upper case, I/L → 1, O → 0, whitespace and dashes stripped. */
export declare function readRecoveryCode(text: string): string;
