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
}

export declare function CropViewport(props: CropViewportProps): JSX.Element;
