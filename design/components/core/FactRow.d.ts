/**
 * One hairline line reading label · value, with an optional action at the end.
 * The seal's "What you sign" list and the wallet's campaign facts are this row
 * in its two emphases — they differ only in which half is the quiet one, and in
 * whether the rules enclose the block or separate its rows.
 */
export interface FactRowProps {
  /** The name of the fact. Strong in `seal`, quiet in `ledger`. */
  label: React.ReactNode;
  /**
   * The current answer. A string is drawn in the variant's own value voice; in
   * `seal` a node is handed through as given (a stance readout draws its own
   * line), while in `ledger` everything wears the answer's voice.
   */
  value?: React.ReactNode;
  /** The word at the end of the row — drawn as an `InlineAction`. A node is
   *  rendered as given. */
  action?: React.ReactNode;
  /** Called when a string `action` is pressed. */
  onAction?: () => void;
  /** `seal`: strong label, quiet value, rules enclosing the block.
   *  `ledger`: quiet label, right-aligned `on-surface` value, rules between. */
  emphasis?: "seal" | "ledger";
  /** Last row of the block — closes the `seal`'s box, drops the `ledger`'s rule. */
  last?: boolean;
}

export declare function FactRow(props: FactRowProps): JSX.Element;
