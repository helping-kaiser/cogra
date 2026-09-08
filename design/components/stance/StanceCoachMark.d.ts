/** The one-time coach mark: the first tap ever teaches and stages nothing. */
export interface StanceCoachMarkProps {
  onDismiss?: () => void;
  /** Placement — the mark is anchored to the target it teaches about. */
  style?: React.CSSProperties;
}

export declare function StanceCoachMark(props: StanceCoachMarkProps): JSX.Element;

/** How the gesture works, in one place — the mark and the pad's `?` share it. */
export declare const STANCE_EXPLANATION: string;

/**
 * What the pad's `?` opens: what the field means, what commits, why the pick and
 * the resulting stance are different numbers, and what severing costs. It replaces
 * the pad's body rather than growing below it — the pad is parked, and a panel
 * that pushes Set away from the thumb defeats the parking.
 */
export declare const STANCE_PAD_HELP: readonly string[];

/**
 * The same help, for the alternates — which have no field, so the first line
 * teaches the thing the pad teaches by being a square: that the interaction
 * carries two values, not one.
 */
export declare const STANCE_ALTERNATES_HELP: readonly string[];
