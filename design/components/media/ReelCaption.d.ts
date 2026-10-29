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
  /**
   * The post is sensitive and unrevealed: the description blurs in place behind
   * the `text` veil while the handle and title stay readable. The reveal is the
   * post's one `SensitiveScope`, so wrap the stream's clip and caption in it.
   */
  sensitive?: boolean;
  /** The stream's own line — the last clip's, or the load that did not come — on a `ReelPlate` at the caption's head. */
  notice?: React.ReactNode;
  /** The data-node name its placer gives the caption (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `handle`, `title`, `description`, `show` (the veil's control) and `more`. */
  node?: string;
}

export declare function ReelCaption(props: ReelCaptionProps): JSX.Element;
