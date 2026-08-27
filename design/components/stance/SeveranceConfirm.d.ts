import type { StanceBundle, StancePair } from "./StanceReadout";

/** The severance confirmation — one dialog for both routes to (0, 0). */
export interface SeveranceConfirmProps {
  /** The pick that reached this dialog; null on the explicit gesture. */
  pick?: StancePair | null;
  /** Already in the reader's words — "this post", "@ada". */
  targetLabel: string;
  bundle: StanceBundle | null | undefined;
  /** How many signed actions reaching zero takes — the legible cost. */
  records?: number;
  /** The fold reports nothing left to walk back; severing would be a no-op. */
  alreadySevered?: boolean;
  busy?: boolean;
  /** The signing pass did not complete; the dialog stays open and says so. */
  failed?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  inline?: boolean;
}

export declare function SeveranceConfirm(props: SeveranceConfirmProps): JSX.Element;
