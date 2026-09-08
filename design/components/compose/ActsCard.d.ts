/**
 * The seal's acts card — the container-highest list of what one signature
 * commits: one row per act kind (label, value, count) and the total as the
 * footer row. Shared by every "What you sign" surface; the all-or-nothing
 * sentence belongs to the screen, not the card.
 */
export interface ActsCardRow {
  label: string;
  /** A fact row's value. Ends a long one in an ellipsis. */
  value?: React.ReactNode;
  /**
   * An action row's words — what could still be added. The whole row is the
   * button then, and nothing in it truncates. Exclusive with `value`.
   */
  action?: React.ReactNode;
  onAct?: () => void;
  /** e.g. "1 action". */
  count?: string;
}

export interface ActsCardProps {
  rows?: readonly ActsCardRow[];
  /** e.g. "3 signed actions". */
  total?: React.ReactNode;
  /**
   * The all-or-nothing subline under the total — "they land together, or
   * none does". Pass it whenever the seal commits more than one act; omit on
   * a single-act seal.
   */
  note?: string;
}

export declare function ActsCard(props: ActsCardProps): JSX.Element;
