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
  /**
   * A fact row that counts a collection is a DOOR to what it counts: given
   * this, the whole row becomes the control and keeps its three slots. No
   * chevron and no trailing word, so `openLabel` is the only thing that tells
   * a listener a row reading "References · 3 cited · 3" opens anything. Fact
   * rows only — an action row is already a button.
   */
  onOpen?: () => void;
  /** The door's accessible name — e.g. "Manage the citations". */
  openLabel?: string;
  /** This row's own count, a bare number — e.g. "1". */
  count?: string;
}

export interface ActsCardProps {
  rows?: readonly ActsCardRow[];
  /** e.g. "3 things, signed together". */
  total?: React.ReactNode;
  /**
   * The all-or-nothing subline under the total — "they land together, or
   * none does". Pass it whenever the seal commits more than one act; omit on
   * a single-act seal.
   */
  note?: string;
}

export declare function ActsCard(props: ActsCardProps): JSX.Element;
