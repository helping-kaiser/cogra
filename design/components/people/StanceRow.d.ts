/**
 * A person on an opinions list, with the stance the row is about. Read-only: the
 * whole row opens the person, because acting on an opinion happens on their
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
  /**
   * Makes the VALUE its own target, opening the timeline this stance was summed
   * from (the change-histories round). The row then splits — person area to the
   * person, readout to the history — the way `ContentRow` splits around an
   * `action`. Without it the row stays one element and renders as it always has.
   */
  onOpenHistory?: () => void;
}

/** The spoken name of the value's history door. */
export declare const HISTORY_DOOR_LABEL: string;

export declare function StanceRow(props: StanceRowProps): JSX.Element;
