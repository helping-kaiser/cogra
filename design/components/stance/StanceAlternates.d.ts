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
  /** The standing block, rendered above the inputs as it sits above the pad. */
  children?: React.ReactNode;
  /** The landing line, below the inputs as it sits below the field. */
  landing?: React.ReactNode;
  inline?: boolean;
}

export declare function StanceAlternates(props: StanceAlternatesProps): JSX.Element;
