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

/** The same styling as a plain object, for a link that must look like a button. */
export declare function buttonStyle(options?: {
  variant?: "primary" | "outline" | "text";
  size?: "sm" | "lg";
  selfStart?: boolean;
  disabled?: boolean;
}): React.CSSProperties;

/** The state-layer + focus classes every pressable control wears. */
export declare const BUTTON_CLASS: string;
