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
   * The row's right edge: the signed pair in the references sheet, the
   * viewer-relative rank in ranked results, the age past the seam.
   */
  value?: string;
  /** Old name of `value`; still accepted. */
  pair?: string;
  /**
   * A viewer-relative rank: rendered with the score's graph glyph so the
   * number is recognized before it is read. Wins over `value`.
   */
  rank?: string;
  /**
   * An action mark at the row's edge (the picker's add glyph); wins over
   * `rank` and `value`. Decorative — the row's own tap is the action.
   */
  trailing?: JSX.Element;
  /** The row navigates to the node it names. */
  onOpen?: () => void;
}

export declare function ReferenceRow(props: ReferenceRowProps): JSX.Element;
