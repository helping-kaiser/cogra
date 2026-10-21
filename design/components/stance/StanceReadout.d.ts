export declare const DIMENSION_MIN: number;
export declare const DIMENSION_MAX: number;

/** One picked or folded pair: two continuous values in the closed [-1, +1]. */
export interface StancePair {
  /** On screen: "For or against". Never "valence", never "p_d". */
  pDirected: number;
  /** On screen: "How much reaches you". Never "connection", never "p_i". */
  pInterest: number;
}

/** The viewer's stance toward a target, as the read that rendered it carried. */
export interface StanceBundle {
  /** The folded pair the graph routes on — clipped to [-1, +1]. */
  current: StancePair;
  /** The unclipped history. What a walk back to zero actually walks. */
  rawSum: StancePair;
  /** How many signed records stand behind it. 0 means none. */
  records: number;
  severed?: boolean;
  /** How many counter-records reaching zero would take. */
  severance?: { records: number };
}

export interface StanceLanding {
  landing: StancePair;
  /** Either axis folded to zero: unreachable — held, shaping no feed. */
  inert: boolean;
  /** Both axes folded to zero: severance. */
  severed: boolean;
}

/** One pair's reading: the face, and the exact numbers in a `cg-exact` span that
 *  paints only in geek mode. The anchor's words ride a screen-reader-only span —
 *  an emoji's own accessible name is "slightly smiling face", not "Like this" —
 *  and are spoken in both modes. */
export interface StanceReadoutProps {
  pair: StancePair;
  /** "pick" reads the edge being authored; "standing" reads a bundle. */
  kind?: "pick" | "standing";
  /** Wording for a bundle at exactly (0, 0) — "Walked back" or "No opinion yet". */
  zeroLabel?: string;
  /** The record family's axis questions, for the spoken reading. */
  names?: AxisNames;
  style?: React.CSSProperties;
}

export declare function StanceReadout(props: StanceReadoutProps): JSX.Element;

/** The attachment an author signs with their own content: one number, because
 *  Publish and Owner carry one free parameter — `p_i` is census-pinned at 1.
 *  The face reads through `VALENCE_SIX`. The author's opinion on their own
 *  content is an ordinary Opinion, read by `StanceReadout`. */
export interface AttachmentReadoutProps {
  pDirected: number;
  style?: React.CSSProperties;
}

export declare function AttachmentReadout(props: AttachmentReadoutProps): JSX.Element;

/** The one-axis pad's readouts, above its strip: `Your pick` — the record's
 *  own value — alone on a new post's pad, `Current backing` over it on an
 *  edit's, where `AttachmentLandingLine` follows the strip. Faces read
 *  `VALENCE_SIX`, 🤔 at exactly 0.00. */
export interface AttachmentStandingProps {
  pick: number;
  /** The backing bundle's net now; omit where nothing stands yet. */
  current?: number;
  style?: React.CSSProperties;
  /** Given one, the blocks are named `current` and `pick`, each with its `label`, `face` and `exact`. */
  node?: string;
}

export declare function AttachmentStanding(props: AttachmentStandingProps): JSX.Element;

/** `Backing after`, beneath an edit's strip: `clip` of the bundle's RAW sum
 *  plus the pick. When the sum passes ±1, a quiet line states the total and
 *  the cap — clipped is not hidden. */
export interface AttachmentLandingLineProps {
  /** The backing bundle's raw sum, unclipped. */
  rawSum: number;
  pick: number;
  style?: React.CSSProperties;
  /** Given one, the readout carries it, with its `label`, `face`, `exact`, and `cap` while capped. */
  node?: string;
}

export declare function AttachmentLandingLine(props: AttachmentLandingLineProps): JSX.Element;
/** Where a pick lands the backing: the raw total, its fold, and whether the fold clipped it. */
export declare function attachmentLanding(rawSum: number, pick: number): { raw: number; landing: number; capped: boolean };
export declare const CURRENT_BACKING_LABEL: string;
export declare const BACKING_AFTER_LABEL: string;
/** The spoken word for a one-axis value of exactly 0.00, which wears 🤔. */
export declare const ZERO_BACKING_LABEL: string;

/** A stance RECORD's face and pair, drawn plainly wherever a stance is data
 *  rather than a control — the opinions page's rows, the chronicle's opinion
 *  entries. Never interactive. */
export interface StanceValueProps {
  pDirected: number;
  pInterest: number;
  /** Draws the exact pair beside the face — geek mode decides whether it paints.
   *  Defaults to true; false is for a row that has no room for it at all. */
  showPair?: boolean;
  /** The data-node name its placer gives the value (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its `face` and, while drawn, its `exact` pair. */
  node?: string;
}

export declare function StanceValue(props: StanceValueProps): JSX.Element;

/** The current opinion and the pick's face — everything above the pad's field. */
export interface StanceStandingProps {
  pick: StancePair;
  /** `undefined` while the bundle is being read, `null` where it could not be. */
  bundle: StanceBundle | null | undefined;
  /** Already in the reader's words — "this post", "@ada". */
  targetLabel: string;
  /** The record family's axis questions, for the two spoken readings. */
  names?: AxisNames;
  /**
   * Makes the "Current opinion" label a door onto the timeline the standing was
   * summed from (the change-histories round). The line takes the tappable
   * marker's form — underlined, plus `HISTORY_DOOR_TAIL` — and the readout under
   * it is untouched. Without it the label is the plain `aria-hidden` line.
   */
  onOpenHistory?: () => void;
  /** The data-node name its placer gives the standing (design ⇄ impl seam 002; renders as attributes only — the open pad's `standing`). Given one, it also names its two readouts, `current` and `pick`, each with its `label`, `face` and `exact` while it reads as a readout rather than a sentence. */
  node?: string;
}

export declare function StanceStanding(props: StanceStandingProps): JSX.Element;

/** What the standing's label gains when it becomes a history door. */
export declare const HISTORY_DOOR_TAIL: string;
/** The landing line — the one line below the field. */
export interface StanceLandingLineProps {
  landing: StanceLanding | null;
  /** The record family's axis questions, for the spoken reading. */
  names?: AxisNames;
  /** Handed, an unreachable landing's 🤔 is a button — named by the state it reads — that opens its explanation in place (`unreachableHelp`). */
  onExplainZero?: () => void;
  /** Whether that explanation is showing, for the button's `aria-expanded`. */
  zeroShown?: boolean;
  /** The reader still borrows a view: an unreachable or severed landing adds `BORROWED_KEPT_LINE` beneath it. Warns, never blocks. */
  borrowed?: boolean;
  /** The data-node name its placer gives the readout (design ⇄ impl seam 002; renders as attributes only — the open pad's `landing`). Given one, the readout carries it, with its `label`, `face` and `exact` while it reads as a readout rather than a sentence — an unreachable landing's `label`, `zero` (or `face`) and `words` — and the borrowed-view line is `borrowed`. */
  node?: string;
}

export declare function StanceLandingLine(props: StanceLandingLineProps): JSX.Element;

/** How long a pad readout must rest before it is spoken: 500ms. The visible readouts follow the knob live; the spoken reading waits for the pick to settle (release, or a pause mid-drag). */
export declare const SETTLE_MS: number;
/** The value once it has stopped changing for `ms` (default `SETTLE_MS`); the first render returns it as it stands. */
export declare function useSettled<T>(value: T, ms?: number): T;

/** The twenty-anchor contract of stance-control's *The emoji readout*. Both clients read these values. */
export declare const STANCE_ANCHORS: readonly (StancePair & { emoji: string; label: string })[];
/**
 * The thirteen-anchor contract a tag's pair reads through — four aboutness
 * bands by three certainty bands, plus the floating thirteenth. Disjoint from
 * `STANCE_ANCHORS` by ruling: no glyph appears in both tables. Both clients
 * read these values.
 */
export declare const TAG_ANCHORS: readonly (StancePair & { emoji: string; label: string })[];
/** One band of the one-axis table: the face it wears, the anchor's own position
 *  and word, and where the band stops. `to` is the band's upper edge and
 *  `toInclusive` says whether the edge belongs to it — at a midpoint the milder
 *  face wins. Exactly 0.00 never reaches the table: `nearestValenceAnchor`
 *  answers it with 🤔. */
export interface ValenceBand {
  emoji: string;
  label: string;
  /** The anchor's position on the axis, read from `STANCE_ANCHORS`. */
  pDirected: number;
  to: number;
  toInclusive: boolean;
}

/** The six-band contract a pick with no second axis reads through — the
 *  pure-valence spine of `STANCE_ANCHORS`. Both clients read these values. */
export declare const VALENCE_SIX: readonly ValenceBand[];
/** The face a one-axis pick wears. Out-of-range values are clamped in. */
export declare function nearestValenceAnchor(pDirected: number): ValenceBand;
export declare const ORIGIN: StancePair;
export declare const TAP_DEFAULT: StancePair;
export declare const DIRECTED_LABEL: string;
export declare const INTEREST_LABEL: string;
/**
 * What each axis ASKS, as opposed to where it ends. The stance family's pair is
 * the default; a family filling the same two slots with other quantities passes
 * its own, so the spoken route never asks a question the drawn one did not.
 * `PadAxes` carries these alongside the poles, and every readout below takes
 * the same object.
 */
export interface AxisNames {
  directed?: string;
  interest?: string;
  /** The family's own words for the way out; the default family's where absent. */
  severance?: SeveranceWords;
}
export declare const STANCE_AXIS_NAMES: AxisNames;
/**
 * What a record family calls taking its bundle to nothing. A person is walked
 * back; a topic is disconnected from. The sentences take what they name — the
 * target, and for `sum` the figure the reader is being shown — so one object
 * serves every target in the family.
 */
export interface SeveranceWords {
  /** The pad's standing control, and the confirming button in its dialog. */
  control: string;
  /** The confirming button while its signing is in flight — the control's
   *  present participle, "Walking it back…". */
  busy?: string;
  title: (targetLabel: string) => string;
  effect: (targetLabel: string) => string;
  sum: (targetLabel: string, total: string) => string;
  /** How a bundle already at nothing reads as a sentence. */
  gone: (targetLabel: string) => string;
  /** The same fact as a label beside a face. */
  zero: string;
  /** What the pad says a pick of (0, 0) would do. */
  landing: string;
  help: string;
  helpAlternates: string;
}
export declare const STANCE_SEVERANCE_WORDS: SeveranceWords;
export declare function severanceWords(names?: AxisNames): SeveranceWords;
export declare function nearestAnchor(pair: StancePair): StancePair & { emoji: string; label: string };
/** The nearest of the thirteen TAG anchors — the glyph a tag's pair reads as
 *  wherever it is drawn without the pad. */
export declare function nearestTagAnchor(pair: StancePair): StancePair & { emoji: string; label: string };
/** The face ANY stance pair wears — a pick, a standing bundle, a record: 🤷
 *  (with `zeroLabel`) at exactly (0, 0), 🤔 (with `unreachableHead`) at exactly
 *  one zero, the nearest of the twenty otherwise. Every face readout reads here. */
export declare function bundleReadout(pair: StancePair, zeroLabel?: string): { emoji: string; label: string };
/** The snackbar after an empty sign: where the unchanged standing leaves the reader. */
export declare function emptySignedLine(severed: boolean, targetLabel: string, names?: AxisNames): string;
/** A pick's spoken word at exactly (0, 0): it adds nothing, so it says nothing. */
export declare const EMPTY_PICK_LABEL: string;
/** The face a TAG pair wears: 🤷 withdrawn at (0, 0), 🤔 at one zero, the nearest of the thirteen otherwise. */
export declare function tagReadout(pair: StancePair): { emoji: string; label: string };
/** A tag pair's one-zero state in the tag family's words. */
export declare function tagUnreachableHead(pair: StancePair): string;
/** A tag pair's spoken word at (0, 0), the withdrawal. */
export declare const TAG_WITHDRAWN_LABEL: string;
export declare function formatStancePair(pair: StancePair): string;
export declare function formatStanceWords(pair: StancePair, names?: AxisNames): string;
/** Always signed, two decimals, the negative arm on U+2212 MINUS (readme §3). */
export declare function formatDimension(value: number): string;
/** Two decimals, no sign — for an axis whose range has no negative half. */
export declare function formatUnsigned(value: number): string;
/** A tag's pair: relevance signed, confidence unsigned, so the two families never look alike. */
export declare function formatTagPair(pair: StancePair): string;
export declare function localLanding(rawSum: StancePair, pick: StancePair): StanceLanding;
export declare function standingLine(bundle: StanceBundle | null | undefined, targetLabel: string): string;
export declare function landingLine(landing: StanceLanding | null, names?: AxisNames): string;
/** An unreachable landing's state in words — "Interested, no side taken" and its three siblings, by which number is zero and the other's sign. */
export declare function unreachableHead(pair: StancePair): string;
/** The one consequence an unreachable landing states after its head. */
export declare const UNREACHABLE_TAIL: string;
/** What an unreachable landing's 🤔 opens in place: still held, nothing passes through it, and the family's way out differs. */
export declare function unreachableHelp(names: AxisNames | undefined, targetLabel: string): readonly string[];
/** The warning under an unreachable or severed landing while the reader still borrows a view. */
export declare const BORROWED_KEPT_LINE: string;
/** The severance read, split so the raw total can lead and the cap follow it. */
export declare function severanceParts(
  bundle: StanceBundle | null | undefined,
  targetLabel: string,
): { sentence: string } | { raw: string; folded: string; capped: boolean };
/** The bundle and the landing, split for layout: a sentence, or a labelled readout. */
export declare function standingParts(bundle: StanceBundle | null | undefined, targetLabel: string, names?: AxisNames): object;
export declare function landingParts(landing: StanceLanding | null, names?: AxisNames): object;
export declare const DIRECTED_POLES: readonly string[];
export declare const INTEREST_POLES: readonly string[];
export declare const PICK_LABEL: string;
/** Wording for a bundle at exactly (0, 0) that has records behind it. */
export declare const SEVERED_LABEL: string;
/** Wording for a bundle at exactly (0, 0) that has never had a record. */
export declare const NO_STANDING_LABEL: string;
/** What a bundle at exactly (0, 0) reads as. */
export declare const ZERO_BUNDLE_EMOJI: string;
/** What a state with exactly one number at zero wears — any pair drawn as a face, the one-axis 0.00: 🤔. */
export declare const UNREACHABLE_EMOJI: string;
/** The face an unauthored target wears at rest, deliberately outside the
 *  anchor table so an empty control cannot read as an opinion already given. */
export declare const RESTING_FACE_EMOJI: string;
/** Visually hidden, still read aloud — where the anchors' words live. */
export declare const SR_ONLY: React.CSSProperties;
export declare function signedLine(standing: StancePair, records: number, severed: boolean, targetLabel: string, names?: AxisNames): string;
export declare function clampPair(pair: StancePair, ranges?: PadRanges): StancePair;
export declare function clampDimension(value: number, min?: number, max?: number): number;

/** How far each of the pad's two slots reaches — the census's business, not the control's. */
export interface PadRanges {
  pDirected: { min: number; max: number };
  pInterest: { min: number; max: number };
}

/** Both slots signed — what a stance and a citation fill. */
export declare const STANCE_RANGES: PadRanges;
/** The lowest relevance the tag field offers — below it lies the withdrawal, which the field does not carry. */
export declare const TAG_RELEVANCE_FLOOR: number;
/** What a tag's pair fills: confidence 0 to 1, relevance from the floor to 1. */
export declare const TAG_RANGES: PadRanges;

/** A help sentence: a plain string, or a face-first line whose digits ride a `cg-exact` tail. */
export type HelpSentence =
  | string
  | { text: string; face: string; exact: string; tail: string; spoken: string };

/** Renders one help sentence — the face painted, the whole fact spoken. */
export declare function HelpLine(props: { line: HelpSentence }): JSX.Element;
/** The key a list needs, whichever shape the line takes. */
export declare function helpKey(line: HelpSentence): string;

/**
 * What the pad's `?` opens: what the field means, what commits, why the pick and
 * the resulting opinion are different numbers, and what severing costs. It replaces
 * the pad's body rather than growing below it — the pad is parked, and a panel
 * that pushes Set away from the thumb defeats the parking.
 */
export declare const STANCE_PAD_HELP: readonly string[];

/**
 * The same help, for the alternates — which have no field, so the first line
 * teaches the thing the pad teaches by being a square: that the interaction
 * carries two values, not one.
 */
export declare const STANCE_ALTERNATES_HELP: readonly string[];

/**
 * The same four lines with the last one in the record family's own words — the
 * only line that names the way out. A family that names no severance of its own
 * gets the two constants above unchanged.
 */
export declare function padHelp(names?: AxisNames): readonly string[];
export declare function alternatesHelp(names?: AxisNames): readonly string[];
