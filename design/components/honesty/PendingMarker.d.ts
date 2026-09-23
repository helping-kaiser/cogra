/** The pending marker: authored and signed, not yet ordered on L1. */
export interface PendingMarkerProps {
  /** Override only for a different honesty case; the default is the product's copy. */
  label?: string;
  /**
   * The phrasing form, for a row that is itself a button — a `<button>` takes
   * phrasing content, so the block form's `<p>` cannot nest inside one.
   */
  inline?: boolean;
}

export declare function PendingMarker(props: PendingMarkerProps): JSX.Element;

/** The edit marker, with an optional tap onto the edit history. */
export interface EditedMarkerProps {
  label?: string;
  /**
   * Present it as a control only where the history is reachable — which is only
   * once a second version exists. The history is every version whole, newest
   * first; nothing in this product stores or draws a diff.
   */
  onInspect?: () => void;
}

export declare function EditedMarker(props: EditedMarkerProps): JSX.Element;
