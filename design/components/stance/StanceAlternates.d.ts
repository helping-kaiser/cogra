import type { PadAxes } from "./StancePad";
import type { StancePair } from "./StanceReadout";

/** The alternate — and accessible — stance inputs: paired sliders, direct entry. */
export interface StanceAlternatesProps {
  /**
   * Which control opens. "pad" (no stored preference) and "sliders" both open the
   * sliders; "entry" opens the typed fields. Only ever ONE is on screen — the
   * other is a tap away.
   */
  mode?: "pad" | "sliders" | "entry";
  pick: StancePair;
  onPick?: (pair: StancePair) => void;
  onCommit?: () => void;
  onCancel?: () => void;
  /** Severance is findable here for anyone whose input is an alternate. */
  onSever?: () => void;
  busy?: boolean;
  /** The current-opinion block, rendered above the inputs as it sits above the pad. */
  children?: React.ReactNode;
  /** The landing line, below the inputs as it sits below the field. */
  landing?: React.ReactNode;
  inline?: boolean;
  /**
   * The "?" button's accessible name (jakob's ruling A7) — the name of the pad
   * it belongs to, not a generic one. Defaults to "How opinions work", the
   * ordinary feed-card control's name; `StanceControl` passes its own
   * `helpLabel` through unchanged.
   */
  helpLabel?: string;
  /**
   * The two tracks' words, defaulting to `STANCE_AXES` — the same prop the
   * field takes, so a record family that names its own ends names them on both
   * routes. The object's `directed` and `interest` label the tracks themselves,
   * which is the one thing this surface says and the field does not.
   */
  axes?: PadAxes;
}

export declare function StanceAlternates(props: StanceAlternatesProps): JSX.Element;
