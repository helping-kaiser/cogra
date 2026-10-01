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
  /**
   * The line a target's affordance row carries under the face when a
   * press-and-hold did not sign — short, `label-small`, with `Retry` at its
   * end. The hold has no surface of its own to re-raise.
   */
  row?: boolean;
  /** The row line's words, where the code says something else — the write
   *  rule's "You can't sign right now." Defaults to "That didn't sign." */
  message?: string;
  /**
   * The write rule's row line: a notice, not a fault — `--text-secondary`,
   * `role="status"`, and never a Retry.
   */
  quiet?: boolean;
  /** The row line's Retry. Omit where retrying cannot change the answer. */
  onRetry?: () => void;
}

export declare function SigningPending(props: SigningPendingProps): JSX.Element;
