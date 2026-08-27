export interface FeedFilterValue {
  /** Which kinds of ranked content are in. Combinable; may be empty. */
  kinds?: readonly string[];
  /** Which forms of post: text, photos, video. Combinable. */
  forms?: readonly string[];
  /** "ranked" (default) or "newest". */
  order?: string;
  /** What the feed also admits: "sensitive", "removed". */
  also?: readonly string[];
}

/**
 * The feed's filter: one chip-shaped trigger that reads back the current view,
 * and a sheet holding the whole thing. Applies live — nothing behind a sheet is
 * inert, and a filter with an Apply button makes the reader commit to a guess.
 *
 * Turning every kind off is allowed: the feed then shows its empty state, which
 * says what is switched off. The control never prevents a choice.
 */
export interface FeedFilterProps {
  value?: FeedFilterValue;
  onChange?: (value: FeedFilterValue) => void;
  ariaLabel?: string;
}

export declare function FeedFilter(props: FeedFilterProps): JSX.Element;

/** The trigger's words, within a pill's budget: the kinds always, then either the
 *  exceptions spelled out or a count of them. Past `budget` characters the detail
 *  collapses — "far from the default" is the useful fact, and which ways is what
 *  the sheet is for. */
export declare function feedFilterSummary(value?: FeedFilterValue, budget?: number): string;

export declare const FEED_KINDS: readonly { value: string; label: string }[];
export declare const FEED_FORMS: readonly { value: string; label: string }[];
export declare const FEED_ORDER: readonly { value: string; label: string }[];
export declare const FEED_ALSO: readonly { value: string; label: string }[];
export declare const FEED_FILTER_DEFAULT: FeedFilterValue;
