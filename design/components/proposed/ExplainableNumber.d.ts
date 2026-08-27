/**
 * PROPOSED. The shape every number takes: a quiet figure that opens its own
 * explanation (§7). It does not render the explanation.
 *
 * There is no expand-in-place variant. The only figure the product has is the
 * Post Score, and its explanation is four screens deep — see
 * `components/proposed/score/`. Nothing here is designed against a number that
 * does not exist yet.
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
}

export declare function ExplainableNumber(props: ExplainableNumberProps): JSX.Element;
