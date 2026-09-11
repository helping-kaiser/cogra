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
  /** The pair signed on the act, trailing and quiet. */
  value?: React.ReactNode;
  /** The × is its own button, named "Remove <name>". */
  onRemove?: () => void;
  /**
   * Opens the citation's pair editor — the stance pad in a sheet, because both
   * of a citation's axes are signed. Given it, the row (minus the ×) becomes a
   * button named "<name> — set how it relates"; without it the row is inert.
   */
  onEdit?: () => void;
}

export declare function StagedReference(props: StagedReferenceProps): JSX.Element;
