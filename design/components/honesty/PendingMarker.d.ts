/** The pending marker: authored and signed, not yet ordered on L1. */
export interface PendingMarkerProps {
  /** Override only for a different honesty case; the default is the product's copy. */
  label?: string;
}

export declare function PendingMarker(props: PendingMarkerProps): JSX.Element;

/** The edit marker, with an optional tap to see what changed. */
export interface EditedMarkerProps {
  label?: string;
  /** Present it as a control only when there is a diff to open. */
  onInspect?: () => void;
}

export declare function EditedMarker(props: EditedMarkerProps): JSX.Element;
