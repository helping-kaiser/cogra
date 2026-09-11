import type { StancePair } from "../stance/StanceReadout";

/**
 * One row of the topics-and-references sheet, and the result-row shape search
 * reuses: leading mark · name · the signed pair (readme §13, 2026-08-28).
 */
export type ReferenceKind =
  | "topic"
  | "person"
  | "post"
  | "comment"
  | "proposal"
  | "item"
  | "campaign"
  | "offer"
  | "chat"
  | "message";

/**
 * A node kind's leading mark, on any surface: a person's avatar, a media
 * post's cover, the text post's T tile, a topic's # tile, or the kind's glyph
 * from the one semantic assignment (`NODE_GLYPHS`).
 */
export interface NodeMarkProps {
  kind?: ReferenceKind;
  /** The person's display name — read by `MonogramAvatar` for its fallback. */
  name?: string;
  /** A person's avatar photo or a media post's cover. */
  src?: string;
}

export declare function NodeMark(props: NodeMarkProps): JSX.Element;

export interface ReferenceRowProps {
  /** Decides the leading mark: avatar, cover, T tile, # tile, or node glyph. */
  kind?: ReferenceKind;
  /** The first line of text: a display name, a title, or a topic. */
  name: string;
  /**
   * The indirect-hit second line: a scoped search that matched through an
   * act's target names it here — "on Salt maps of the coast road".
   */
  sub?: string;
  /** A person's avatar photo or a media post's cover. */
  src?: string;
  /**
   * The row's right edge when what sits there is not a signal number: the age
   * past the seam, a date. Printed as given, in both reading modes.
   */
  value?: string;
  /**
   * The pair signed on this act, as numbers. A `topic` row reads it as a tag's
   * — `formatTagPair`, with the nearest of the thirteen `TAG_ANCHORS` beside
   * it — and every other kind as a citation's, both axes signed. The digits
   * paint only in geek mode; the glyph and the spoken name do not depend on it.
   */
  pair?: StancePair;
  /**
   * A viewer-relative rank: the score's graph glyph, with the number beside it
   * in geek mode. Wins over `pair` and `value`.
   */
  rank?: string;
  /**
   * An action mark at the row's edge (the picker's add glyph); wins over
   * `rank` and `value`. Decorative — the row's own tap is the action.
   */
  trailing?: JSX.Element;
  /**
   * The act is signed but not yet ordered on L1: the row wears the pending
   * marker under its pair. This sheet is the only surface that says so — a
   * chip on a card shows nothing pending.
   */
  pending?: boolean;
  /** The row navigates to the node it names. */
  onOpen?: () => void;
}

export declare function ReferenceRow(props: ReferenceRowProps): JSX.Element;
