/**
 * The pick step's prompt — the line saying what may be picked, with the way
 * out of the media path beside it. Sits directly under the wizard header, on
 * every pick board, above the tray.
 */
export interface PickPromptProps {
  /** What this step will take: "Pick one picture, several, or one video." */
  caption: string;
  /** The way out of the media path: "Write words instead". */
  escapeLabel: string;
  onEscape?: () => void;
}

export declare function PickPrompt(props: PickPromptProps): JSX.Element;
