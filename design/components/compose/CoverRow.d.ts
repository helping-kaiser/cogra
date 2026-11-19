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
   *  frame collapse, so fewer tiles is a valid strip, never a gap. Empty is
   *  the capture-fails state: the gallery tile stands alone, and `caption`
   *  says why. */
  frames?: CoverFrame[];
  /** Index of the outlined frame; the rest sit at 65%. Defaults to `null` —
   *  no cover chosen, no outline and nothing dimmed, because choosing a cover
   *  is always a willing act. */
  selected?: number | null;
  /** A picture of the author's own, back from the cover's crop. It stands in
   *  the dashed tile's place, outlined as chosen; `selected` is ignored while
   *  it stands. A tap on it opens the picker again. */
  own?: CoverFrame;
  caption?: string;
}

export declare function CoverRow(props: CoverRowProps): JSX.Element;

/** The cover tile's spoken name: the tile is the door that changes the cover. */
export declare const CHANGE_COVER_NAME: "Change the cover";

/**
 * The cover beside the clip: at the clip tile's height and the cover's own
 * shape, wearing the `Cover` badge, the door named `Change the cover`. With no
 * `src`, the dashed `Add a cover` door, a square at the clip tile's height, the
 * add glyph in its exact middle — the words on the tile, 4 px under the glyph,
 * or beside it with `labelBeside` where the tile is too small for them.
 */
export interface CoverTileProps {
  src?: string;
  transform?: string;
  /** The chosen cover's width, at its own shape. The empty door ignores it:
   *  it is `height` square. */
  width?: number;
  /** The clip tile's height — both tiles stand at it. */
  height: number;
  progress?: number;
  failed?: boolean;
  addLabel?: string;
  labelBeside?: boolean;
  onPress?: () => void;
  node?: string;
}

export declare function CoverTile(props: CoverTileProps): JSX.Element;
