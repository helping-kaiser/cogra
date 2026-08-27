/** One picked or folded pair: two continuous values in the closed [-1, +1]. */
export interface StancePair {
  /** On screen: "For or against". Never "valence", never "p_d". */
  pDirected: number;
  /** On screen: "How much reaches you". Never "connection", never "p_i". */
  pInterest: number;
}

/** The viewer's standing toward a target, as the read that rendered it carried. */
export interface StanceBundle {
  /** The folded pair the graph routes on — clipped to [-1, +1]. */
  current: StancePair;
  /** The unclipped history. What a walk back to zero actually walks. */
  rawSum: StancePair;
  /** How many signed records stand behind it. 0 means no standing. */
  records: number;
  severed?: boolean;
  /** How many counter-records reaching zero would take. */
  severance?: { records: number };
}

export interface StanceLanding {
  landing: StancePair;
  /** Either axis folded to zero: the stance would carry nothing. */
  inert: boolean;
  /** Both axes folded to zero: severance. */
  severed: boolean;
}

/** One pair's default reading: the face and the exact numbers. The anchor's words
 *  ride a screen-reader-only span — an emoji's own accessible name is "slightly
 *  smiling face", not "Like this". */
export interface StanceReadoutProps {
  pair: StancePair;
  /** "pick" reads the edge being authored; "standing" reads a bundle. */
  kind?: "pick" | "standing";
  /** Wording for a standing at exactly (0, 0) — "Severed" or "No stance yet". */
  zeroLabel?: string;
  style?: React.CSSProperties;
}

export declare function StanceReadout(props: StanceReadoutProps): JSX.Element;

/** The standing and the pick's face — everything above the pad's field. */
export interface StanceStandingProps {
  pick: StancePair;
  /** `undefined` while the standing is being read, `null` where it could not be. */
  bundle: StanceBundle | null | undefined;
  /** Already in the reader's words — "this post", "@ada". */
  targetLabel: string;
}

export declare function StanceStanding(props: StanceStandingProps): JSX.Element;
/** The landing line — the one line below the field. */
export interface StanceLandingLineProps {
  landing: StanceLanding | null;
}

export declare function StanceLandingLine(props: StanceLandingLineProps): JSX.Element;

/** The twenty-anchor contract of design.md §8.4. Both clients read these values. */
export declare const STANCE_ANCHORS: readonly (StancePair & { emoji: string; label: string })[];
export declare const ORIGIN: StancePair;
export declare const TAP_DEFAULT: StancePair;
export declare const DIRECTED_LABEL: string;
export declare const INTEREST_LABEL: string;
export declare function nearestAnchor(pair: StancePair): StancePair & { emoji: string; label: string };
export declare function bundleReadout(pair: StancePair, zeroLabel?: string): { emoji: string; label: string };
export declare function formatStancePair(pair: StancePair): string;
export declare function formatStanceWords(pair: StancePair): string;
export declare function formatDimension(value: number): string;
export declare function localLanding(rawSum: StancePair, pick: StancePair): StanceLanding;
export declare function standingLine(bundle: StanceBundle | null | undefined, targetLabel: string): string;
export declare function landingLine(landing: StanceLanding | null): string;
/** The severance read, split so the raw total can lead and the cap follow it. */
export declare function severanceParts(
  bundle: StanceBundle | null | undefined,
  targetLabel: string,
): { sentence: string } | { raw: string; folded: string; capped: boolean };
/** The standing and the landing, split for layout: a sentence, or a labelled readout. */
export declare function standingParts(bundle: StanceBundle | null | undefined, targetLabel: string): object;
export declare function landingParts(landing: StanceLanding | null): object;
export declare const DIRECTED_POLES: readonly string[];
export declare const INTEREST_POLES: readonly string[];
export declare const PICK_LABEL: string;
/** Visually hidden, still read aloud — where the anchors' words live. */
export declare const SR_ONLY: React.CSSProperties;
export declare function signedLine(standing: StancePair, records: number, severed: boolean, targetLabel: string): string;
export declare function clampPair(pair: StancePair): StancePair;
export declare function clampDimension(value: number): number;
