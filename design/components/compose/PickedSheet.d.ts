/**
 * Show all — the per-picture manager, opened by the pick step's "Show all"
 * and the details step's picked row. Order (drag; first = cover, the badge
 * travels), remove, and the per-picture Describe entry live here and nowhere
 * else. Builds on `BottomSheet`.
 */
export interface PickedSheetItem {
  src?: string;
  alt?: string;
  /** Shows the quiet "Described" word instead of the Describe link. */
  described?: boolean;
  onDescribe?: () => void;
  onRemove?: () => void;
}

export interface PickedSheetProps {
  open?: boolean;
  onClose?: () => void;
  items?: readonly PickedSheetItem[];
  onDone?: () => void;
  inline?: boolean;
}

export declare function PickedSheet(props: PickedSheetProps): JSX.Element;
