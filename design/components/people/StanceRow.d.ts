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
  /**
   * A deleted account's row: the reserved disc, `Deleted account` in the
   * system's voice and no handle line (`ActorChip`'s law). Its placer names it
   * `redactedRow`, keyed by the actor's id.
   */
  redacted?: boolean;
  pDirected?: number;
  pInterest?: number;
  /**
   * The bundle's own `severed`: which (0, 0) the row draws, since the numbers
   * cannot tell. True — a standing walked back to nothing — speaks `Walked
   * back`; absent or false, a (0, 0) standing speaks `Says nothing` (an empty
   * sign's). Both wear 🤷; only the spoken word differs.
   */
  severed?: boolean;
  onOpen?: () => void;
  /**
   * Makes the VALUE its own target, opening the timeline this stance was summed
   * from (the change-histories round). The row then splits — person area to the
   * person, readout to the history — the way `ContentRow` splits around an
   * `action`. Without it the row stays one element and renders as it always has.
   */
  onOpenHistory?: () => void;
  /** The data-node name its placer gives this row (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `avatar`, `name`, `handle`, `value` (with the readout's `face` and `exact`) and, where it stands, the history door `history`. */
  node?: string;
  /** The row's key: the holder's handle, without @. */
  nodeKey?: string;
}

/** The spoken name of the value's history door. */
export declare const HISTORY_DOOR_LABEL: string;

export declare function StanceRow(props: StanceRowProps): JSX.Element;
