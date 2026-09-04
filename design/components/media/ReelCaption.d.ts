/**
 * The stream's caption: the post's words along the bottom of the clip, in the
 * card's own budget — the handle, the title, and the body clamped to two lines
 * with the same `More` opener a card carries (readme §13, the reel round).
 *
 * It keeps clear of the rail on the right and of the bottom bar below, and it
 * carries a text shadow rather than a plate: a panel behind the words would
 * cover the frame they sit on. The author's face is not here — it is the rail's
 * first item.
 */
export interface ReelCaptionProps {
  handle?: string;
  title?: string;
  /** Clamped to two lines; `More` appears only where there is body text to open. */
  description?: string;
  /** Distance from the surface's bottom edge, clearing the bottom bar and the seek line. */
  bottom?: number;
  onMore?: () => void;
}

export declare function ReelCaption(props: ReelCaptionProps): JSX.Element;
