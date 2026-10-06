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
  /** What the feed also admits: "sensitive", "removed", "settling". Default
   *  `["settling"]` — still-settling content is in until switched off; a value
   *  that omits the field reads as the default. */
  also?: readonly string[];
  /**
   * The one topic the feed is narrowed to — its name, hash and all — or null.
   * A topic feed is another feed setting (jakob, 2026-09-14): content reaching
   * the viewer over Tag records toward that Type. Only a topic the viewer holds
   * with POSITIVE association can sit here; one at a time, because two topics
   * would widen the read rather than narrow it.
   */
  topic?: string | null;
}

/**
 * The feed's filter: one chip-shaped trigger that reads back the current view,
 * and a sheet holding the whole thing. The trigger sits on the right edge of
 * the `CograBand` and scrolls with it. The sheet stages: `Done` commits and the
 * feed re-queries once; the scrim, a swipe down, system Back and Escape discard
 * (the sheet law, readme §4, *Sheets*). `onChange` fires on Done only, with the staged filter.
 *
 * Turning every kind off is allowed: the feed then shows its empty state, which
 * says what is switched off. The control never prevents a choice.
 */
export interface FeedFilterProps {
  value?: FeedFilterValue;
  /** The reader's own default — what the foot's `Reset` stages and what the
   *  trigger speaks deviations from. The app's default (`FEED_FILTER_DEFAULT`)
   *  until the reader sets theirs in Settings (pass C 10). */
  readerDefault?: FeedFilterValue;
  onChange?: (value: FeedFilterValue) => void;
  /** Opens "The filter" dialog — the sheet carries its own "?". */
  onHelp?: () => void;
  /** Render with the sheet already open — for static boards. */
  defaultOpen?: boolean;
  ariaLabel?: string;
  /**
   * The topics the viewer may narrow to — held, and held FOR. Names, hash and
   * all. Empty (the default) and the section is absent: a section offering
   * nothing is a row spent on nothing.
   */
  topics?: readonly string[];
  /** Opens the full "Your topics" list — everything held, including against. */
  onOpenTopics?: () => void;
  /** The data-node name its placer gives the filter's trigger (design ⇄ impl seam 002; renders as attributes only). */
  node?: string;
}

export declare function FeedFilter(props: FeedFilterProps): JSX.Element;

/** The sheet alone, for a surface that owns its trigger — the settings page's
 *  Reading row opens this directly, so the filter stays one control. */
export interface FeedFilterSheetProps {
  value?: FeedFilterValue;
  onChange?: (value: FeedFilterValue) => void;
  onHelp?: () => void;
  open?: boolean;
  onClose?: () => void;
  ariaLabel?: string;
  /** What a titled sheet says first — a heading carrying the "?" on its own
   *  row, and the reading the surface owes. Omitted, the sheet is the feed's:
   *  no heading, the "?" in the corner. */
  lead?: JSX.Element;
  /** The Done row — `FilterFoot`, `Reset` in the corner and the commit. Every
   *  filter sheet takes one (the sheet law). Given one, the sheet owns its
   *  height, the sections scroll inside it and this stays pinned under them.
   *  The topic section, the one that grows, closes the body. */
  foot?: JSX.Element;
  /** The topics the viewer may narrow to — see `FeedFilterProps.topics`. */
  topics?: readonly string[];
  /** Opens the full "Your topics" list. */
  onOpenTopics?: () => void;
}

export declare function FeedFilterSheet(props: FeedFilterSheetProps): JSX.Element;

/** The trigger's words, within a pill's budget: one kind by name or a count of
 *  them, then either the exceptions spelled out ("newest", "showing seen") or a
 *  count of those. Past `budgetPx` of rendered width the detail collapses —
 *  "far from the default" is the useful fact, and which ways is what the sheet
 *  is for. Deviations only: the default state is silence. */
export declare function feedFilterSummary(value?: FeedFilterValue, budgetPx?: number): string;

/** The width of `text` in the trigger's own type (Figtree at
 *  `--text-label-large`, wght 500), in px — the budget's measuring stick, and
 *  the gate's. */
export declare function measureTriggerText(text: string): number;

/** The room the `CograBand` leaves the trigger's words, in px. */
export declare const BAND_CEILING_PX: number;

/** The worded trigger alone, for surfaces that own their sheet (search) but
 *  wear the same pill. */
export interface FilterTriggerProps {
  reading: string;
  onOpen?: () => void;
  expanded?: boolean;
  ariaLabel?: string;
  /** The data-node name its placer gives this trigger (design ⇄ impl seam 002; renders as attributes only). */
  node?: string;
}

export declare function FilterTrigger(props: FilterTriggerProps): JSX.Element;

/** The Done row every filter sheet ends on (the sheet law): a hairline,
 *  `Reset` in the corner, and the commit. No read-back of the staged filter —
 *  the sections above it are that. */
export interface FilterFootProps {
  /** Stages the default back into the sheet — the reader's own on the feed and
   *  search, CoGra's on the settings sheet that edits the reader's own.
   *  Nothing applies until Done. */
  onReset?: () => void;
  /** Commits the staged filter — the one re-query. */
  onDone?: () => void;
  /** The data-node name its placer gives this foot's drawn row, the one over the hairline (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `reset`, `done`. */
  node?: string;
}

export declare function FilterFoot(props: FilterFootProps): JSX.Element;

/** Every kind the network ranks and V1.0 serves — Posts, Comments, Profiles,
 *  Tags (readme §13, the V1.0 scope cut). One list, shared by the feed and
 *  search; the word is "Profiles" everywhere. */
export declare const FEED_KINDS: readonly { value: string; label: string }[];
export declare const FEED_FORMS: readonly { value: string; label: string }[];
export declare const FEED_ORDER: readonly { value: string; label: string }[];
export declare const FEED_ALSO: readonly { value: string; label: string }[];
export declare const FEED_FILTER_DEFAULT: FeedFilterValue;
