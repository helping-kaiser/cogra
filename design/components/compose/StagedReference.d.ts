import type { StancePair } from "../stance/StanceReadout";

/**
 * A reference the author has committed to, shown back to them: the kind's
 * mark, what it points at, the pair signed on the act, and the way back out.
 * The composer's twin of `ReferenceRow`, which is a way in instead.
 */
export interface StagedReferenceProps {
  /** Passed through to `NodeMark`; a person draws as a circle, the rest as tiles. */
  kind?: string;
  name?: string;
  /** The second line — what the thing is, or whose it is. */
  sub?: string;
  src?: string;
  /**
   * The pair signed on the act, as numbers — trailing and quiet. Both axes are
   * signed (`ReferenceInput`), so the row formats it with `formatStancePair`;
   * the digits paint only in geek mode and the spoken reading does not.
   */
  pair?: StancePair;
  /**
   * The pair is a stance in its own right — a kept pick waiting to be signed,
   * not a citation. The drawing is unchanged; the spoken twin becomes
   * `StanceReadout`'s, the anchor's word and both axes named.
   */
  stance?: boolean;
  /**
   * The target's removal mark — `Removed by its author`, `Deleted account` —
   * for a kept pick whose target was removed or redacted while it waited, or
   * a standing citation on an edit whose target was removed. The row stays,
   * wearing the removed-mark face: the mark's tile empty, the mark's line in
   * the name's place in the system's voice. Its controls name it by the mark:
   * the × "Remove this pick: <sub>, <mark>" (a `stance` row) or "Remove this
   * citation: <sub>, <mark>", and the row "<sub>, <mark> — set how it relates".
   */
  removed?: string;
  /**
   * A kept pick that would net its bundle to nothing says so inline, in the
   * family's landing words, under the kind; Sign is the confirmation.
   */
  consequence?: string;
  /** The × is its own button, named "Remove <name>". */
  onRemove?: () => void;
  /**
   * Opens the citation's pair editor — `StancePad` in a sheet, because both
   * of a citation's axes are signed. Given it, the row (minus the ×) becomes a
   * button named "<name> — set how it relates"; without it the row is inert.
   */
  onEdit?: () => void;
  /** The data-node name its placer gives this row (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `mark`, `name`, `kind`, `consequence`, `pair` (`face`, `exact`), `remove`. */
  node?: string;
  /** The row's content key — its position in the staged set, from 1. */
  nodeKey?: string;
}

export declare function StagedReference(props: StagedReferenceProps): JSX.Element;
