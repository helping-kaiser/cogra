/**
 * The ordering section of a filter sheet — ruled identical on the feed and on
 * search: the Ranked/Newest swap plus the seen toggle in one section, because
 * both answer "how is this list arranged".
 */
export interface OrderSectionProps {
  /** "ranked" (default) or "newest". */
  order?: string;
  onOrder?: (order: string) => void;
  /** The seen toggle, default true. Seen = the card's impression entered the
   *  viewport; device-local, never a record, shared transiently with the
   *  viewer's chosen ranker. */
  seen?: boolean;
  onSeen?: (seen: boolean) => void;
}

export declare function OrderSection(props: OrderSectionProps): JSX.Element;

/** The sheet-section chrome every filter sheet uses: label, optional secondary
 *  hint, then the controls in a wrapping row. */
export interface FilterSectionProps {
  label: string;
  hint?: string;
  children?: React.ReactNode;
}

export declare function FilterSection(props: FilterSectionProps): JSX.Element;

export declare const FILTER_ORDER: readonly { value: string; label: string }[];
