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
  /**
   * Render the pad already parked — for statically rendered boards showing a
   * state a click cannot reach. The master draws the card; never copy it.
   */
  defaultOpen?: boolean;
  /** The pick the parked pad opens holding. Defaults to the origin. */
  defaultPick?: StancePair;
  /** Clearance under the parked card — lift it above a bottom bar. */
  padInset?: number;
  /** One-time coaching lines (the first vouch), between the field and the landing line. */
  padNote?: JSX.Element;
}

export declare function StanceControl(props: StanceControlProps): JSX.Element;

/** Android's platform long-press timeout — what the pad's bloom waits for. */
export declare const LONG_PRESS_MS: number;
