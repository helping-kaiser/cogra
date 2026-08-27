/** A recovery code shown once, with the type-it-back gate in front of dismissing it. */
export interface RecoveryCodeProps {
  code: string;
  /** What the code is for, and what happens if it is lost. */
  explainer: string;
  /** Fires when the reader has typed the code back correctly and confirmed. */
  onConfirmed?: () => void;
}

export declare function RecoveryCode(props: RecoveryCodeProps): JSX.Element;
