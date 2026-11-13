/**
 * The ordering section of a filter sheet — shared by the feed and search:
 * the Ranked/Newest swap plus, on the feed, the seen toggle in one section,
 * because both answer "how is this list arranged". Search takes the order
 * alone.
 */
export interface OrderSectionProps {
  /** "ranked" (default) or "newest". */
  order?: string;
  onOrder?: (order: string) => void;
  /** The seen toggle, default false — what you've seen stays out until you ask
   *  for it back. Seen = the content was fully in the viewport, the first
   *  time only; the seen-list is the reader's History — the reader's own
   *  record, application state and never a graph record. The feed's cut
   *  happens on the reader's device; the list leaves the device only if the
   *  reader picks an outside ranker, which the device then hands it to. */
  seen?: boolean;
  onSeen?: (seen: boolean) => void;
  /** Whether the seen toggle stands (default true). The search sheet passes
   *  false: search never reads the seen list (jakob 2026-11-11, seam 296). */
  seenToggle?: boolean;
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
