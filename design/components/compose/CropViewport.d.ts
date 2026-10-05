/**
 * The crop surface — the picture under a locked window, everything outside it
 * darkened by the window's own box shadow. The shape is the shape the result
 * will be shown in; there are no shape chips.
 */
export interface CropViewportProps {
  src?: string;
  /** Decorative: the crop step's words carry the meaning. */
  alt?: string;
  /** `circle` for the profile picture, `rect` for a video's cover. */
  shape?: "circle" | "rect";
  /** The picture's zoom under the window — what pinching would change. */
  scale?: number;
  /** The picture's `transform-origin` — what dragging would change. */
  origin?: string;
  /** The frame's edge; it is square and bleeds into both gutters. */
  size?: number;
  /** The window's inset from left and right — the screen gutter. */
  inset?: number;
  /** The window's height; square by default. It is centred vertically, so a
   *  board states the ratio it wants and never a coordinate. */
  height?: number;
  /** The arrow keys' pan, the drag's non-drag twin: called with (−1|0|1, −1|0|1) per press while the focused viewport holds focus; the picture stops where its edge meets the window's. */
  onPan?: (dx: number, dy: number) => void;
}

export declare function CropViewport(props: CropViewportProps): JSX.Element;

/** The zoom's bounds: 1× is the fill (the picture just covers the window), 4× the most. */
export declare const CROP_ZOOM_MIN: number;
export declare const CROP_ZOOM_MAX: number;
/** The spoken names of the focusable viewport (`Move the picture`) and the slider (`Zoom`). */
export declare const CROP_PAN_NAME: string;
export declare const CROP_ZOOM_NAME: string;

export interface CropZoomProps {
  /** The crop's current scale, between `CROP_ZOOM_MIN` and `CROP_ZOOM_MAX`. */
  scale?: number;
  onChange?: (scale: number) => void;
}

/** The visible zoom slider under every crop viewport, on both platforms — a desktop browser has no pinch. */
export declare function CropZoom(props: CropZoomProps): JSX.Element;
