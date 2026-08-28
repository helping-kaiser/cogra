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
  /** The row navigates to the node it names. */
  onOpen?: () => void;
}

export declare function ReferenceRow(props: ReferenceRowProps): JSX.Element;
