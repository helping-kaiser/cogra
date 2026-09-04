/**
 * "This creates 2 signed actions ⌄" — the short form of `ActsCard`, for the
 * edit wizards where the acts are the obvious consequence of what was typed.
 * Sits directly above the sign button, with no gap of its own.
 */
export interface ActsFooterProps {
  /** How many acts the signature commits. Every board so far shows two or
   *  more; the singular wording is not yet ruled. */
  count?: number;
}

export declare function ActsFooter(props: ActsFooterProps): JSX.Element;
