/** The house connectivity alert. */
export interface TransportErrorProps {
  /**
   * Override where the surface needs different wording — e.g. with content
   * already on screen, "Can't reach the server — new posts can't load right now."
   */
  message?: string;
}

export declare function TransportError(props: TransportErrorProps): JSX.Element;

/** The signing-didn't-finish line, naming who acts next. */
export interface SigningPendingProps {
  /** The key is absent from this device, so the reader must restore it. */
  needsKey?: boolean;
  restoreHref?: string;
}

export declare function SigningPending(props: SigningPendingProps): JSX.Element;
