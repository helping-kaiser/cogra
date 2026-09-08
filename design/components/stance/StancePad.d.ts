import type { StancePair } from "./StanceReadout";

/**
 * The pad's field, knob, and dead-ground centre-lines. The drawn field IS the
 * value space: its corners are (±1, ±1) and the knob never leaves it.
 */
export interface StancePadProps {
  value?: StancePair;
  /** Omit for a static specimen; pass to make the field draggable. */
  onChange?: (pair: StancePair) => void;
  fieldRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * The four edge labels — Against / For, Less / More. On by default: a blank
   * square says nothing about which direction means what, and these are the same
   * words the sliders use.
   */
  showAxes?: boolean;
}

export declare function StancePad(props: StancePadProps): JSX.Element;

export declare const FIELD_CORNER_RADIUS_PX: number;
export declare const KNOB_DIAMETER_PX: number;
/** The smallest inset that keeps the knob inside the field's corner. */
export declare function knobTravelInset(cornerRadius?: number, knobDiameter?: number): number;
export declare const KNOB_TRAVEL_INSET_PX: number;
/** Half the travel box's extent — the shorter of the field's sides, inset. */
export declare function padTravelHalfExtent(rect: { width: number; height: number }, inset?: number): number;
export declare function padPercentOf(pair: StancePair): { x: number; y: number };
export declare function padPairFrom(
  base: StancePair,
  rect: { left: number; top: number; width: number; height: number },
  travel: { dx: number; dy: number },
  inset?: number,
): StancePair;
