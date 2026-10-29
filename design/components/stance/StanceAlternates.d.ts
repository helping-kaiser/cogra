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
  /** Legacy: the same as `signing="busy"`. */
  busy?: boolean;
  /**
   * The commit's signing, as `StanceControl`'s `signing` hands it while the
   * alternates are up (dialog host only). "busy" — past 200ms the commit
   * reads `Signing…` and goes inert, never dimmed. "failed" — `That didn't
   * send. Try again.` above the action row, and an outlined `Retry` in the
   * commit's slot. "writeRule" — the write rule's notice where the landing
   * line and the action row were, with its own "?" and `Not now`; no Retry.
   */
  signing?: "busy" | "failed" | "writeRule" | "keyAbsent";
  /**
   * The typed fields' text mid-typing, for a board — `{ pDirected: "1.5" }`.
   * The pick is the clamped value; the field shows what was typed until it
   * loses focus, then the value the pick holds.
   */
  typed?: { pDirected?: string; pInterest?: string };
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
  /**
   * "pair" (default) — two tracks, two typed fields. "one" — a family with one
   * free parameter (the backing on one's own content, `p_i` census-pinned at
   * 1): ONE track and ONE typed field over `pDirected`, the swap reading `Type
   * an exact value` / `Use a slider`. The pinned number is never drawn, not
   * even locked; the pick keeps its pair shape with the pin untouched.
   */
  axis?: "pair" | "one";
  /** The unreachable landing's explanation (`unreachableHelp`), handed by the host once its 🤔 is tapped; it replaces the body in place. */
  zeroHelp?: readonly string[] | null;
  /** Leaves `zeroHelp` for the body. */
  onZeroBack?: () => void;
}

export declare function StanceAlternates(props: StanceAlternatesProps): JSX.Element;
