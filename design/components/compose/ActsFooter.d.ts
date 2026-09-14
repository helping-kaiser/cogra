/**
 * "You're signing 2 things ⌄" — the short form of `ActsCard`, for the
 * edit wizards where the acts are the obvious consequence of what was typed.
 * Sits directly above the sign button, with no gap of its own.
 */
export interface ActsFooterProps {
  /**
   * How many acts the signature commits. At one the line reads `1 thing`,
   * `ActsCard`'s own blessed singular. At ZERO it reads `Nothing to sign yet`
   * and the footer stops being a button: the acts sheet would be empty, and a
   * tap that can only open an empty list is not offered (the menus round).
   */
  count?: number;
  /** The whole line is the button; opening the acts is what it does. Unused at
   *  zero, where there is nothing to open. */
  onOpen?: () => void;
}

export declare function ActsFooter(props: ActsFooterProps): JSX.Element;
