/**
 * The authoring-side picture tile — one thumbnail anatomy for every composer
 * surface (pick tray, details row, Show all sheet, reply composer, comment
 * edit). Its states are the upload story: `cover` badge, `progress` ring,
 * `failed` badge, remove X. Upload starts after the crop — only the cropped
 * export is ever uploaded; a comment's pictures pass the comment's square crop
 * and upload from its Next, as a post's do.
 */
export interface MediaThumbProps {
  src?: string;
  alt?: string;
  /** Square edge in px (default 48). `width`/`height` override for a clip's tile. */
  size?: number;
  width?: number;
  height?: number;
  /** "cover" (default) for cropped pictures; "contain" shows the whole frame. */
  fit?: "cover" | "contain";
  radius?: string;
  /** The "Cover" badge — a post's first picture, the badge travelling with
   *  reorder; a clip's cover tile wears it too (`CoverTile`). */
  cover?: boolean;
  /** The picture's framing inside the tile, the way `CoverRow`'s frames carry
   *  it — a strip of frames is one picture shown several ways. */
  transform?: string;
  /** A clip's chosen cover, drawn as the frame itself: an inset thumb in the
   *  same bottom-left corner, a third of the tile's short side (28px floor)
   *  with a hairline ring. A tile is a picture's or a clip's, never both. */
  coverSrc?: string;
  /** The chosen frame's own framing inside the mark, the way `CoverRow`'s
   *  frames carry it — a strip of frames is one picture shown several ways. */
  coverTransform?: string;
  /** 0..1 — the upload ring on a scrim. Omit when the upload is done. */
  progress?: number;
  /** Dims the picture and wears the error badge; the words live in `UploadErrorLine`. */
  failed?: boolean;
  /**
   * The composer's video preview: the play disc on the frame, `duration` on
   * the trailing corner (the pill needs an 80px tile; the disc scales with
   * the tile). Authoring-side only — a reading surface never draws play.
   */
  video?: boolean;
  duration?: string;
  /**
   * The neutral tile's words — shown only where there is no `src`, so a clip
   * that yields no still reserves its space and says what belongs there. The
   * play disc is dropped in that state; the duration stays.
   */
  label?: string;
  /** Renders the X, top-right. Hidden on a failed tile (its ways out are in the line). */
  onRemove?: () => void;
  removeLabel?: string;
  /** The data-node name its placer gives this thumbnail (design ⇄ impl seam 002; renders as attributes only). */
  node?: string;
  /** The thumbnail's content key — its position in the set, from 1. */
  nodeKey?: string;
}

export declare function MediaThumb(props: MediaThumbProps): JSX.Element;
