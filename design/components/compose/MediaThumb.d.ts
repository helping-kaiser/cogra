/**
 * The authoring-side picture tile — one thumbnail anatomy for every composer
 * surface (pick tray, details row, Show all sheet, reply composer, comment
 * edit). Its states are the upload story: `cover` badge, `progress` ring,
 * `failed` badge, remove X. Upload starts after the crop — only the cropped
 * export is ever uploaded; crop-less comment pictures upload at pick.
 */
export interface MediaThumbProps {
  src?: string;
  alt?: string;
  /** Square edge in px (default 48). `width`/`height` override for uncropped tiles. */
  size?: number;
  width?: number;
  height?: number;
  /** "cover" (default) for cropped pictures; "contain" shows the whole frame. */
  fit?: "cover" | "contain";
  radius?: string;
  /** The "Cover" badge — the first picture; the badge travels with reorder. */
  cover?: boolean;
  /** 0..1 — the upload ring on a scrim. Omit when the upload is done. */
  progress?: number;
  /** Dims the picture and wears the error badge; the words live in `UploadErrorLine`. */
  failed?: boolean;
  /** Renders the X, top-right. Hidden on a failed tile (its ways out are in the line). */
  onRemove?: () => void;
  removeLabel?: string;
}

export declare function MediaThumb(props: MediaThumbProps): JSX.Element;
