/**
 * The ordering section of a filter sheet — ruled identical on the feed and on
 * search: the Ranked/Newest swap plus the seen toggle in one section, because
 * both answer "how is this list arranged".
 */
export interface OrderSectionProps {
  /** "ranked" (default) or "newest". */
  order?: string;
  onOrder?: (order: string) => void;
  /** The seen toggle, default false — what you've seen stays out until you ask
   *  for it back. Seen = the content was fully in the viewport, the first
   *  time only; the seen-list is the reader's History — application state,
   *  never a graph record, shared transiently with the viewer's chosen
   *  ranker. */
  seen?: boolean;
  onSeen?: (seen: boolean) => void;
  /** The data-node name its placer gives this section (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `label`, `hint`, the order as `picker` (`rankedOption`, `newestOption`), and the seen toggle as `seen` (`box`, `label`). */
  node?: string;
}

export declare function OrderSection(props: OrderSectionProps): JSX.Element;

/** The sheet-section chrome every filter sheet uses: label, optional secondary
 *  hint, then the controls in a wrapping row. */
export interface FilterSectionProps {
  label: string;
  hint?: string;
  children?: React.ReactNode;
  /** The data-node name its placer gives this section (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `label`, `hint`. Its controls are named by their own placer; the row holding them is never named. */
  node?: string;
}

export declare function FilterSection(props: FilterSectionProps): JSX.Element;

export declare const FILTER_ORDER: readonly { value: string; label: string }[];
