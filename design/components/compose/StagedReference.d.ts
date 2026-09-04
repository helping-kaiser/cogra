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
  onRemove?: () => void;
}

export declare function StagedReference(props: StagedReferenceProps): JSX.Element;
