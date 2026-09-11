/**
 * The transient confirmation of a completed action, fired once per event.
 */
export interface SnackbarProps {
  /** `null` leaves the live region mounted and silent. */
  message: string | null;
  /**
   * The snackbar's ONE action, as a word on the message's own line — `Undo`
   * on hiding someone. Drawn in `--action-on-snackbar`, never as a pill.
   * Leave it off where a way back would be worse than none (the canceled
   * deletion) or where the act is cheap to do again.
   */
  action?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  /** Material's short duration. */
  durationMs?: number;
  /** Render in flow instead of fixed above the bottom bar — for specimens. */
  inline?: boolean;
  /**
   * Distance from the bottom edge, px. 80 clears the bottom bar on a read
   * surface; pass 16 on a task flow, which carries no bar.
   */
  offset?: number;
}

export declare function Snackbar(props: SnackbarProps): JSX.Element;
