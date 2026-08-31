/**
 * The witnessed payout address — rendered whole, in mono, wrapped, never
 * truncated: a clipped address cannot be checked against a wallet. Changing
 * it is a signed act; every earlier address stays on the public record.
 */
export interface PayoutAddressProps {
  address: string;
  label?: string;
  /** Renders the Change affordance; the flow it opens is the address-change seal. */
  onChange?: () => void;
  changeLabel?: string;
}

export declare function PayoutAddress(props: PayoutAddressProps): JSX.Element;
