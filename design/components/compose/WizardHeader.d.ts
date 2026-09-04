/**
 * The composer flows' header: the arrow steps ONE STAGE BACK (never out of
 * the flow), the X LEAVES the whole flow from any stage — keeping the draft
 * where there is one to keep, discarding where there is not, as `leaveLabel`
 * says. The stage's forward action lives at the foot of the content column,
 * never here, so the top-right corner keeps one meaning for the whole flow.
 * What the corner carries is passive: the stage's name and the screen's "?".
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
  /** The stage's name, quiet and trailing — "Last step" on every seal. */
  stageLabel?: string;
  /** The screen's one "?", by its aria-label: what the dialog behind it
   *  explains ("Signed actions", "Changing your picture"). */
  help?: string;
  onHelp?: () => void;
  /** Anything else passive the corner must carry; it follows the pair above.
   *  A bare help dot is `help`, not this. */
  action?: React.ReactNode;
}

export declare function WizardHeader(props: WizardHeaderProps): JSX.Element;
