import type { StanceBundle, StancePair } from "./StanceReadout";

/**
 * CoGra's signature interaction: the resting stance target, the tap, the hold,
 * the parked pad, and every confirmation behind them.
 */
export interface StanceControlProps {
  /** Already in the reader's words — "this post", "this comment", "@ada". */
  targetLabel?: string;
  /**
   * The standing the hosting read already carried. Leave it out and the control
   * starts from no standing and keeps its own.
   */
  bundle?: StanceBundle;
  /** An anonymous tap opens the join prompt rather than signing anything. */
  signedIn?: boolean;
  /** Whether this reader has already met the gesture. False shows the coach mark. */
  taught?: boolean;
  /** Fires with the picked pair and the new standing once a gesture completes. */
  onCommit?: (pick: StancePair, bundle: StanceBundle) => void;
}

export declare function StanceControl(props: StanceControlProps): JSX.Element;

/** Android's platform long-press timeout — what the pad's bloom waits for. */
export declare const LONG_PRESS_MS: number;
