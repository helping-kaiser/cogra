import type { AxisNames, StanceBundle, StancePair } from "./StanceReadout";

/** The severance confirmation — one dialog for both routes to (0, 0). */
export interface SeveranceConfirmProps {
  /** The pick that reached this dialog; null on the explicit gesture. */
  pick?: StancePair | null;
  /** Already in the reader's words — "this post", "@ada". */
  targetLabel: string;
  bundle: StanceBundle | null | undefined;
  /** How many things reaching zero takes — the legible cost. */
  records?: number;
  /** The fold reports nothing left to walk back; severing would be a no-op. */
  alreadySevered?: boolean;
  /** The signing is in flight (past 200ms): the confirm reads the family's
   *  present participle ("Walking it back…") and goes inert, never dimmed. */
  busy?: boolean;
  /** The signing did not go through; the dialog stays open, says so above
   *  the pair, and the confirm's slot reads `Retry`. */
  failed?: boolean;
  /** The write rule refused the walk-back: a notice, not a fault. The quiet
   *  line `WRITE_RULE_WORDS.dialog` stands where the fault line would, the
   *  confirm dims, and no Retry is offered; `Keep it` returns to the pad. */
  writeRule?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  inline?: boolean;
  /** The record family's axis questions, for the pick's spoken reading. */
  names?: AxisNames;
}

export declare function SeveranceConfirm(props: SeveranceConfirmProps): JSX.Element;
