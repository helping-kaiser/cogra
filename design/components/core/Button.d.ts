/**
 * The house button — Material's three vocabularies, and no others.
 */
export interface ButtonProps {
  children?: React.ReactNode;
  /** filled for the one committing action, outlined for secondary, text for tertiary. */
  variant?: "primary" | "outline" | "text";
  /** Both carry label-large; they differ only in padding. */
  size?: "sm" | "lg";
  /** Layout, not look: a button in a flex column passes this so it doesn't stretch. */
  selfStart?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
  ariaLabel?: string;
  /** Extra classes; the state-layer and focus classes are applied for you. */
  className?: string;
  style?: React.CSSProperties;
}

export declare function Button(props: ButtonProps): JSX.Element;

/**
 * The bare primary word — `Button`'s label with the button's body taken away.
 * Use it for an action that rides at the end of a line the reader is already
 * reading (a seal row's "Change", the address row's "Change"); use `Button`
 * when the action owns its own line. Same 48px target, no pill.
 */
export interface InlineActionProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  /** When the word alone does not say what it changes. */
  ariaLabel?: string;
  /** Extra classes; the state-layer and focus classes are applied for you. */
  className?: string;
  style?: React.CSSProperties;
}

export declare function InlineAction(props: InlineActionProps): JSX.Element;

/** The same styling as a plain object, for a link that must look like a button. */
export declare function buttonStyle(options?: {
  variant?: "primary" | "outline" | "text";
  size?: "sm" | "lg";
  selfStart?: boolean;
  disabled?: boolean;
}): React.CSSProperties;

/** The state-layer + focus classes every pressable control wears. */
export declare const BUTTON_CLASS: string;
