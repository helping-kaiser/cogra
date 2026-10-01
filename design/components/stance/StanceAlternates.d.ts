import type { PadAxes } from "./StancePad";
import type { PadRanges, StancePair } from "./StanceReadout";

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
  /**
   * Severance is findable here for anyone whose input is an alternate. The
   * walk-away is drawn only when this is handed — an opinion's control always
   * hands it; a tag or citation sheet never does (its withdrawal is the
   * sheet's own control).
   */
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
  /**
   * How far each slot reaches — the census's bound, handed to both tracks and
   * both typed fields. Defaults to `STANCE_RANGES` (±1 on both); a tag's pair
   * passes `TAG_RANGES`.
   */
  ranges?: PadRanges;
  /** The dialog's title. Defaults to "Choose your opinion". Unused at `host="sheet"`. */
  title?: string;
  /** The affirmative. Defaults to "Sign it". Unused at `host="sheet"`. */
  commitLabel?: string;
  /**
   * "dialog" (default) — the alternates as their own dialog. "sheet" — no
   * dialog: the readouts, the tracks, their swap and the landing, rendered in
   * the place of a sheet's field; the sheet keeps its own title, `Done` and
   * scrim, and no "?" or action row is drawn.
   */
  host?: "dialog" | "sheet";
}

export declare function StanceAlternates(props: StanceAlternatesProps): JSX.Element;
