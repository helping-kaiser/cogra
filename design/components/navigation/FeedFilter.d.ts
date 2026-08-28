export interface FeedFilterValue {
  /** Which kinds of ranked content are in. Combinable; may be empty. */
  kinds?: readonly string[];
  /** Which forms of post: text, photos, video. Combinable. */
  forms?: readonly string[];
  /** "ranked" (default) or "newest". */
  order?: string;
  /** The seen toggle, default false — what you've seen stays out until you
   *  ask for it back. */
  seen?: boolean;
  /** What the feed also admits: "sensitive", "removed". */
  also?: readonly string[];
}

/**
 * The feed's filter: one chip-shaped trigger that reads back the current view,
 * and a sheet holding the whole thing. The trigger sits on the right edge of
 * the `CograBand` and scrolls with it. Applies live — nothing behind a sheet is
 * inert, and a filter with an Apply button makes the reader commit to a guess.
 *
 * Turning every kind off is allowed: the feed then shows its empty state, which
 * says what is switched off. The control never prevents a choice.
 */
export interface FeedFilterProps {
  value?: FeedFilterValue;
  onChange?: (value: FeedFilterValue) => void;
  /** Opens "The filter" dialog — the sheet carries its own "?". */
  onHelp?: () => void;
  /** Render with the sheet already open — for static boards. */
  defaultOpen?: boolean;
  ariaLabel?: string;
}

export declare function FeedFilter(props: FeedFilterProps): JSX.Element;

/** The trigger's words, within a pill's budget: the kinds always, then either the
 *  exceptions spelled out ("newest", "showing seen") or a count of them. Past
 *  `budget` characters the detail collapses — "far from the default" is the
 *  useful fact, and which ways is what the sheet is for. Deviations only: the
 *  default state is silence. */
export declare function feedFilterSummary(value?: FeedFilterValue, budget?: number): string;

/** The worded trigger alone, for surfaces that own their sheet (search) but
 *  wear the same pill. */
export interface FilterTriggerProps {
  reading: string;
  onOpen?: () => void;
  expanded?: boolean;
  ariaLabel?: string;
}

export declare function FilterTrigger(props: FilterTriggerProps): JSX.Element;

/** Every kind the network ranks — one list, shared by the feed and search;
 *  the word is "Profiles" everywhere. */
export declare const FEED_KINDS: readonly { value: string; label: string }[];
export declare const FEED_FORMS: readonly { value: string; label: string }[];
export declare const FEED_ORDER: readonly { value: string; label: string }[];
export declare const FEED_ALSO: readonly { value: string; label: string }[];
export declare const FEED_FILTER_DEFAULT: FeedFilterValue;
