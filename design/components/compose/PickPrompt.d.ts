/**
 * The pick step's prompt — the line saying what may be picked, with the way
 * out of the media path beside it. Sits directly under the wizard header, on
 * every pick board, above the tray.
 */
export interface PickPromptProps {
  /** Optional; the pick steps pass none (jakob 2026-11-12): the roll is the instruction. */
  caption?: string;
  /** The way out of the media path: "Write words instead". */
  escapeLabel: string;
  onEscape?: () => void;
}

export declare function PickPrompt(props: PickPromptProps): JSX.Element;
