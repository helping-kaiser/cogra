/**
 * The quiet word naming a group on a sectioned surface. A caption, not a
 * heading: it carries no heading level, and its asymmetric padding sits it
 * with the group it opens rather than between two of them.
 */
export interface SectionLabelProps {
  children?: React.ReactNode;
  /** The data-node name its placer gives this label (design ⇄ impl seam 002; renders as attributes only). */
  node?: string;
  /** The label's content key when it is a repeated instance. */
  nodeKey?: string;
}

export declare function SectionLabel(props: SectionLabelProps): JSX.Element;
