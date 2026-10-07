/**
 * The witnessed payout address in a proper home: a quiet container with the
 * label, the copy button, and Change as real affordances — the address whole
 * inside, mono, wrapped, never truncated. Changing it is a signed act;
 * every earlier address stays on the public record.
 */
export interface PayoutAddressProps {
  address: string;
  label?: string;
  /** Renders the copy icon button. */
  onCopy?: () => void;
  /** The copy button's accessible name — its only name, since it carries no word. Pass one wherever the string is not a payout address ("Copy the link"). */
  copyLabel?: string;
  /** Renders the Change affordance; the flow it opens is the address-change seal. */
  onChange?: () => void;
  changeLabel?: string;
  /** The change word in flight past 200ms — it reads `changeBusyLabel` and goes inert, never dimmed (an invite's `Revoking…`). */
  changeBusy?: boolean;
  changeBusyLabel?: string;
  /** The quiet line under the address, e.g. "The address is public — and so is every change to it." */
  caption?: string;
  /** Drops the card fill and inset, keeping the whole anatomy — for a string
   *  that restates one beside it (the invite code under its link) or that is
   *  already inside a card (the ask link in the rejected applicant's card).
   *  Never for a string that is the surface's own subject. */
  bare?: boolean;
  /** The data-node name its placer gives this card (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `label`, `copy`, `action` (the one inline act — Change, Revoke), `address`, `caption`. */
  node?: string;
}

export declare function PayoutAddress(props: PayoutAddressProps): JSX.Element;

/**
 * The at-rest form: one line near the top of the wallet — an entry point,
 * not a checking surface, so this is the single place the address may
 * shorten (head…tail). Tapping opens the full card.
 */
export interface PayoutAddressRowProps {
  address: string;
  onOpen?: () => void;
}

export declare function PayoutAddressRow(props: PayoutAddressRowProps): JSX.Element;
