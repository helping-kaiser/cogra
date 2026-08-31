/**
 * The composer flows' header: the arrow steps ONE STAGE BACK (never out of
 * the flow), the X LEAVES the whole flow from any stage with the draft kept —
 * no confirmation, because every leave keeps the draft. The X sits between
 * the title and the trailing controls; `action` (the Next pill, or the seal's
 * "Last step" + "?") keeps the right edge.
 */
export interface WizardHeaderProps {
  title?: string;
  backHref?: string;
  /** Defaults to "Back a step" — the arrow's honest name. */
  backLabel?: string;
  onBack?: (event: React.MouseEvent) => void;
  onLeave?: () => void;
  /** Defaults to "Leave — your draft is kept"; a flow with nothing to keep (the avatar's) passes "Leave". */
  leaveLabel?: string;
  /** The stage's trailing controls — the Next pill, or "Last step" + the "?". */
  action?: React.ReactNode;
}

export declare function WizardHeader(props: WizardHeaderProps): JSX.Element;
