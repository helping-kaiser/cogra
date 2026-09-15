import type { PadAxes } from "./StancePad";
import type { StanceBundle, StancePair } from "./StanceReadout";

/**
 * CoGra's signature interaction: the resting stance target, the tap, the hold,
 * the parked pad, and every confirmation behind them.
 */
export interface StanceControlProps {
  /**
   * Already in the reader's words — "this post", "this comment", "@ada". Names
   * the face's aria-label and the visually-hidden "Choose your opinion on
   * {targetLabel}" skip-link beside it, so a page (e.g. TagPage) carrying more
   * than one stance control names each of them (backlog item 46.1).
   */
  targetLabel?: string;
  /**
   * The bundle the hosting read already carried. Leave it out and the control
   * starts from nothing and keeps its own.
   */
  bundle?: StanceBundle;
  /** An anonymous tap opens the join prompt rather than signing anything. */
  signedIn?: boolean;
  /** Whether this reader has already met the gesture. False shows the coach mark. */
  taught?: boolean;
  /** Fires with the picked pair and the new bundle once a gesture completes. */
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
  /** The presentational variant a profile header wears: the anchor stretched to
   *  the row's width, with its words drawn beside the face. */
  wide?: boolean;
  /** The anchor restyled to sit on photography: a line-face glyph in the rail's
   *  family instead of the card's muted emoji. Restyles the anchor only. */
  overMedia?: boolean;
  /**
   * The pad's "?" accessible name (jakob's ruling A7) — the name of the
   * dialog it belongs to, not a generic one, on a board that draws a named
   * pad ("Your opinion on your post", "Toward what you answer", "Your
   * first opinion"). Defaults to "How opinions work", the ordinary feed-card
   * control's name. Passed through to `StanceAlternates` unchanged.
   */
  helpLabel?: string;
  /**
   * The record family's words, for a family that is not the stance's — an
   * Affinity toward a Type fills the same two signed slots with association and
   * attraction. Defaults to `STANCE_AXES`; passed through unchanged to the
   * field, to the alternates, to the severance confirm and to the three spoken
   * readouts, so the dragged route and the accessible one never name one axis
   * two ways. The poles reach the field; the axis questions reach everything
   * that says an axis out loud.
   */
  axes?: PadAxes;
}

export declare function StanceControl(props: StanceControlProps): JSX.Element;

/** Android's platform long-press timeout — what the pad's bloom waits for. */
export declare const LONG_PRESS_MS: number;
