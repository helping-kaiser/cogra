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
   * vouch back"). Defaults to "How opinions work", the ordinary feed-card
   * control's name. Passed through to `StanceAlternates` unchanged.
   */
  helpLabel?: string;
  /**
   * A named pad's help paragraphs, shown in place of the pad's body when its
   * "?" is pressed (readme §11) — copy-voice's text for `helpLabel`. Absent,
   * the pad's own four lines stand.
   */
  help?: string[];
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
  /**
   * The standing's own door (the change-histories round): the "Current opinion"
   * line above the field opens the timeline the sum was built from. Pure
   * pass-through to `StanceStanding`.
   */
  onOpenHistory?: () => void;
  /**
   * First-connection mode: the control stands on a seal signing the reader's
   * first record toward the target, handed the staged default as its value.
   * Nothing to walk back yet, so the pad omits the walk-away. Off by default.
   */
  firstConnection?: boolean;
  /**
   * A pick kept pending with the key elsewhere (`PadKeyAbsent`'s "Keep it
   * pending, restore later"). The anchor shows the kept pick's face, and a
   * `PendingMarker` under it says it is waiting for the key. The bundle is
   * unchanged — nothing is signed until the key is restored. Off by default.
   */
  pendingPick?: StancePair;
  /**
   * The key is back and the kept picks' review was left unsigned: the pick
   * waits on the reader, so the line reads `Waiting for your review` and the
   * host wires the face's tap to `KeptPicksReview`, never the key notice.
   * Dropped again if the key goes. Only with `pendingPick`; off by default.
   */
  pendingReview?: boolean;
  /**
   * A signed act in flight (`"busy"`, past 200ms) or one that did not go
   * through (`"failed"`). Pad closed, it is the hold's: the anchor is inert
   * while busy, and the target's row carries `Signing…` or `SigningPending`'s
   * row line with `Retry` under the face, which has not moved. Pad open, it
   * is Set's: `Setting…`, inert; then the fault line above the commit row and
   * an outlined `Retry` in Set's slot. `"writeRule"` is the write rule's
   * refusal, a notice and not a fault: on the row, the quiet line `You can't
   * sign right now.` with no Retry; in the pad, `NoticePanel` (with its own
   * "?") where the landing line and the commit row stood, and `Not now`.
   * `"comfortFailed"` is not a signing: a read-side comfort (save, unsave,
   * hide, undo, unhide) that failed has reverted, and the row says `That
   * didn't go through.` with `Retry`, the hold's vehicle. Row only.
   * Off by default.
   */
  signing?: "busy" | "failed" | "writeRule" | "comfortFailed";
  /** The hold mid-way, for a board: the ring that fills around the face over the 500ms hold, drawn standing at this 0–1 fill. Absent, the ring is the press's own and fills live. */
  holdProgress?: number;
  /** The pad's knob under the finger, for a board: `StancePad`'s pressed layer (a 40px disc at 10 %) drawn around the knob. Absent, the layer is the drag's own. */
  knobHeld?: boolean;
  /** The data-node name its placer gives this control (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `anchor`, the resting control, with its `face` and `exact`. */
  node?: string;
}

export declare function StanceControl(props: StanceControlProps): JSX.Element;

/** Android's platform long-press timeout — what the pad's bloom waits for. */
export declare const LONG_PRESS_MS: number;
