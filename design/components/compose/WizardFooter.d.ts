/**
 * The foot of a wizard step whose content runs edge to edge: the full-width
 * Next, and the side padding the step itself does not own.
 */
export interface WizardFooterProps {
  /** The step's forward word. "Next" on every board that draws it today. */
  label?: string;
  onNext?: () => void;
}

export declare function WizardFooter(props: WizardFooterProps): JSX.Element;
