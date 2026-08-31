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
  /** Renders the Change affordance; the flow it opens is the address-change seal. */
  onChange?: () => void;
  changeLabel?: string;
  /** The quiet line under the address, e.g. "The address is public — and so is every change to it." */
  caption?: string;
}

export declare function PayoutAddress(props: PayoutAddressProps): JSX.Element;
