/**
 * PROPOSED. The shape every number takes: a quiet figure that opens its own
 * explanation (§7). It does not render the explanation.
 *
 * There is no expand-in-place variant. The product's one figure is the score
 * every ranked card wears — the Feed score, one figure and one name on a post,
 * a comment, a person and a tag alike — and its explanation is four screens deep
 * (`FeedEntry` → `RankPath` → `RankHop` → `RankRecords`). Nothing here is
 * designed against a number that does not exist yet.
 */
export interface ExplainableNumberProps {
  /** Spoken name. With `glyph` set it lives only in the accessibility tree. */
  label: string;
  /** Already formatted, signed, never capped or normalised. */
  value: string;
  unit?: string;
  /** An `Icon` name. A glyph rather than a word keeps the affordance row on one line. */
  glyph?: string;
  onOpenDetail?: () => void;
  /** Restyled to sit on photography — white with a drop shadow, same register. */
  overMedia?: boolean;
  /** The data-node name its placer gives this number (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `value`. */
  node?: string;
}

export declare function ExplainableNumber(props: ExplainableNumberProps): JSX.Element;
