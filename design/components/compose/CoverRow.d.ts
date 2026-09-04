/**
 * The video's face: the "Cover" label, the strip of frames cut from the clip
 * with the chosen one outlined, the dashed tile that leads to the gallery, and
 * the line that says what the strip is for.
 */
export interface CoverFrame {
  src?: string;
  /** The frame's own framing inside the tile — the strip is one picture shown
   *  several ways, so the tiles differ by transform, not by source. */
  transform?: string;
}

export interface CoverRowProps {
  /** The field label above the strip. */
  label?: string;
  /** Up to four samples — 1s, 10%, 50%, 90%. Samples that land on the same
   *  frame collapse, so fewer tiles is a valid strip, never a gap. */
  frames?: CoverFrame[];
  /** Index of the outlined frame; the rest sit at 65%. */
  selected?: number;
  caption?: string;
}

export declare function CoverRow(props: CoverRowProps): JSX.Element;
