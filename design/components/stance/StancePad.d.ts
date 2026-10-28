import type { PadRanges, StancePair } from "./StanceReadout";

/**
 * The pad's field, knob, and dead-ground centre-lines. The drawn field IS the
 * value space: its corners are the two axes' own ends — (±1, ±1) for a stance,
 * (0, 0) to (1, 1) for a tag — and the knob never leaves it.
 */
export interface StancePadProps {
  value?: StancePair;
  /** Omit for a static specimen; pass to make the field draggable. */
  onChange?: (pair: StancePair) => void;
  fieldRef?: React.RefObject<HTMLDivElement | null>;
/**
   * The four pole words, drawn in gutters AROUND the field. On by default: a
   * blank square says nothing about which direction means what. Off drops the
   * gutters with them, so the component's box is the field alone.
   */
  showAxes?: boolean;
  /**
   * What the four poles are called. Defaults to `STANCE_AXES` — Against / For,
   * Less / More. Another record family whose two parameters are both signed
   * (a citation's relevance and support) fills the same two slots with its own
   * words. The field reads the four poles and ignores the axis questions the
   * same object may carry.
   */
  axes?: PadAxes;
  /**
   * How far each axis reaches. Defaults to `STANCE_RANGES` — both slots signed.
   * A tag's pair passes `TAG_RANGES`, whose relevance starts at the floor
   * rather than at nothing; the field, the knob's travel, and the dead-ground
   * lines all follow it.
   */
  ranges?: PadRanges;
  /** Draws the knob under the finger for a board: M3's pressed state layer, a 40px disc in the knob's colour at 10 %, around the knob. A live drag draws it on its own while the pointer is down. Never a scale. */
  held?: boolean;
  /** The data-node name its placer gives this field (design ⇄ impl seam 002; renders as attributes only — the open pad's `field`). Given one, it also names its parts: the pole words `left`, `right`, `top` and `bottom`, and the `square` — the value space — with its dead-ground lines `zeroAcross` and `zeroDown`, the `knob`, and the knob's pressed `knobLayer` while it is held. */
  node?: string;
}

/**
 * A record family's words for the two axes: horizontal is `pDirected`, vertical
 * `pInterest`. The poles say where each axis ENDS; `directed` and `interest`
 * say what it ASKS. The field draws the ends only — the questions are for the
 * surfaces that name an axis out loud, the sliders, the direct entry and the
 * spoken readouts. A family that draws only the field may omit them.
 */
export interface PadAxes {
  left: string;
  right: string;
  top: string;
  bottom: string;
  /** The question `pDirected` answers — "For or against" for a stance. */
  directed?: string;
  /** The question `pInterest` answers — "How much reaches you" for a stance. */
  interest?: string;
  /**
   * The standing readout's label — "Current opinion" when omitted. A family
   * whose record is not an opinion names its own (a citation on an edit:
   * "Current").
   */
  current?: string;
  /** The landing readout's label — "Resulting opinion" when omitted. */
  resulting?: string;
  /**
   * `false` keeps the nearest anchor's WORD out of the spoken readouts — for a
   * family that borrows the stance faces as a lossy readout but whose record
   * is not a stance (a citation). The face still paints; the pair is spoken.
   */
  anchorWord?: boolean;
}

/** The stance's own six — the pad's default. */
export declare const STANCE_AXES: PadAxes;

export declare function StancePad(props: StancePadProps): JSX.Element;

/**
 * The ring the pole words sit in, outside the field. The knob travels every
 * point the field has, so a word drawn inside it is a word the knob eventually
 * covers — the words live outside instead, and the component sizes the field
 * to what they leave.
 */
export declare const AXIS_GUTTER_X_PX: number;
export declare const AXIS_GUTTER_Y_PX: number;

export declare const FIELD_CORNER_RADIUS_PX: number;
export declare const KNOB_DIAMETER_PX: number;
/** The smallest inset that keeps the knob inside the field's corner. */
export declare function knobTravelInset(cornerRadius?: number, knobDiameter?: number): number;
export declare const KNOB_TRAVEL_INSET_PX: number;
/** Half the travel box's extent — the shorter of the field's sides, inset. */
export declare function padTravelHalfExtent(rect: { width: number; height: number }, inset?: number): number;
export declare function padPercentOf(pair: StancePair, ranges?: PadRanges): { x: number; y: number };
export declare function padPairFrom(
  base: StancePair,
  rect: { left: number; top: number; width: number; height: number },
  travel: { dx: number; dy: number },
  inset?: number,
  ranges?: PadRanges,
): StancePair;

/**
 * The one-axis field: the pad an author meets when they sign their own
 * content. Publish and Owner carry one free parameter — the attachment, on
 * `p_d`; the census pins `p_i` at 1 — so the value is one number on
 * `[−1, +1]` and the field is the square's language cut to a strip.
 */
export interface AttachmentPadProps {
  value?: number;
  /** Omit for a static specimen; pass to make the strip draggable. Called with
   *  the live pick while the finger moves — exactly 0 inside the zero
   *  hairline's detent — and once more on release with the pick parked on
   *  its nearest hundredth (`snapAttachment`). */
  onChange?: (value: number) => void;
  fieldRef?: React.RefObject<HTMLDivElement | null>;
  /** The two pole words, drawn in the square's gutters beside the strip. On by default. */
  showAxes?: boolean;
  /** What the poles are called — reads `left` and `right` only. Defaults to `STANCE_AXES`, Against / For. */
  axes?: PadAxes;
  /** Draws the knob's pressed layer for a board, as on the square. */
  held?: boolean;
  /** The data-node name its placer gives this field. Given one, it also names the pole words `left` and `right`, and the `strip` — the value space — with its dead-ground line `zeroDown`, the `knob`, and the knob's pressed `knobLayer` while it is held. */
  node?: string;
}

export declare function AttachmentPad(props: AttachmentPadProps): JSX.Element;
/** The strip's height: the knob's pressed layer with the square's breathing room. */
export declare const ATTACHMENT_FIELD_HEIGHT_PX: number;
/** Where the knob sits on the strip, as a percentage of its travel. */
export declare function attachmentPercentOf(value: number): number;
/** The attachment this much horizontal travel picks, starting from `base` —
 *  exactly 0 while the knob's centre would stand within `ATTACHMENT_DETENT_PX`
 *  of the zero hairline (the `No side yet` detent). */
export declare function attachmentFrom(base: number, rect: { width: number }, dx: number, inset?: number): number;
/** The zero detent's reach: the knob's own radius, 10px. */
export declare const ATTACHMENT_DETENT_PX: number;
/** Where a released one-axis pick parks: the nearest hundredth, clamped, never -0. */
export declare function snapAttachment(value: number): number;
