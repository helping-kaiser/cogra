/**
 * The guest prompt behind an account-needing slot: ask, never bounce.
 */
export interface JoinPromptProps {
  open?: boolean;
  /** "Keep browsing" — dismiss and leave the reader where they were. */
  onClose?: () => void;
  /** "Sign in or join". */
  onSignIn?: () => void;
  /** Render in flow rather than over a scrim, for specimens. */
  inline?: boolean;
}

export declare function JoinPrompt(props: JoinPromptProps): JSX.Element | null;

/** The bare dialog surface — surfaceContainerHigh, extra-large rung, 24px padding. */
export interface DialogSurfaceProps {
  children?: React.ReactNode;
  ariaLabel?: string;
  inline?: boolean;
  onScrimPress?: () => void;
  /** Max width; the product uses 20rem for prompts and 22rem for severance. */
  width?: string;
}

export declare function DialogSurface(props: DialogSurfaceProps): JSX.Element;
