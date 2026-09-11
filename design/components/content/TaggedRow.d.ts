import type { StancePair } from "../stance/StanceReadout";

/**
 * One row of a tag's page: the claim that put this content here, drawn as a
 * flag flush with the screen's left edge, and the content's own card attached
 * under it (`attach` on the card masters) so the two fuse into one folder-tab
 * silhouette.
 *
 * The pair belongs to the TAG RECORD, not to the card: the card is drawn by
 * its own master, untouched, and learns nothing about tags.
 */
export interface TaggedRowProps {
  /**
   * What the tag claimed, as numbers: relevance signed over [-1, +1],
   * confidence unsigned over [0, 1]. The row picks the glyph from
   * `TAG_ANCHORS` and formats the pair with `formatTagPair` — one value, so
   * the glyph and the numbers can never disagree.
   */
  pair: StancePair;
  /** The act is staged and not yet ordered; wears the usual `PendingMarker`. */
  pending?: boolean;
  /** The content card this claim points at. */
  children?: React.ReactNode;
}

export declare function TaggedRow(props: TaggedRowProps): JSX.Element;
