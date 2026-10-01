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
  /** For a dialog whose content is a master that lays itself out —
   *  `StanceAlternates`' chooser, the key notice. A dialog that asks passes the
   *  three slots instead. */
  children?: React.ReactNode;
  /** `headline-small`. Also the accessible name when `ariaLabel` is omitted. */
  title?: React.ReactNode;
  /** `body-medium` on `onSurfaceVariant`, 16px under the title: a string, a
   *  list of paragraphs, or nodes for a body that needs more than words. */
  body?: React.ReactNode | readonly React.ReactNode[];
  /** The buttons, at the default size, end-aligned, 24px under the body. */
  actions?: React.ReactNode;
  ariaLabel?: string;
  inline?: boolean;
  /** The safe answer — cancel, keep, stay, close — which the scrim, Escape
   *  and Android's Back all take. Never the destructive act. */
  onScrimPress?: () => void;
  /** Overrides the max only — the inset still holds, so no dialog reaches the
   *  edge. Every product dialog uses the default. */
  width?: string;
}

export declare function DialogSurface(props: DialogSurfaceProps): JSX.Element;
