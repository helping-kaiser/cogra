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

/** The bare dialog surface — surfaceContainerHigh, extra-large rung, 24px
 *  padding, and `--dialog-max-width` held clear of the screen edge by
 *  `--dialog-inset`. */
export interface DialogSurfaceProps {
  children?: React.ReactNode;
  ariaLabel?: string;
  inline?: boolean;
  onScrimPress?: () => void;
  /** Overrides the max only — the inset still holds, so no dialog reaches the
   *  edge. Every product dialog uses the default. */
  width?: string;
}

export declare function DialogSurface(props: DialogSurfaceProps): JSX.Element;
