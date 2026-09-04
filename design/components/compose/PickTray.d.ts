/**
 * The pick step's tray — "Picked · N", the way into the Show all sheet, and
 * the picked thumbnails. The band above the hairline is identical on every
 * pick board; everything below it (gallery grid, drop region, refusals) is the
 * board's own and stays outside.
 */
export interface PickTrayProps {
  /** The number beside "Picked ·". */
  count?: number;
  /** Opens the per-picture manager. Omitted, the tray draws no Show all —
   *  one staged video is not a set to reorder. */
  onShowAll?: () => void;
  showAllLabel?: string;
  /** The quiet line beside the thumbs: "The first one is the cover." */
  caption?: string;
  /** Clips the thumb row instead of letting a full batch push the band wide. */
  clip?: boolean;
  /** The `MediaThumb` tiles; each board asks them for different states. */
  children?: React.ReactNode;
}

export declare function PickTray(props: PickTrayProps): JSX.Element;
