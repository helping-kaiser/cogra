/**
 * A person on a stances list, with the stance the row is about. Read-only: the
 * whole row opens the person, because acting on a stance happens on their
 * profile, never while scrolling past it.
 */
export interface StanceRowProps {
  name?: string;
  handle?: string;
  /** A face; without one, `MonogramAvatar` draws the initials. */
  src?: string;
  pDirected?: number;
  pInterest?: number;
  onOpen?: () => void;
}

export declare function StanceRow(props: StanceRowProps): JSX.Element;
