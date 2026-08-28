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
  | "chat";

export interface ReferenceRowProps {
  /** Decides the leading mark: avatar, cover, T tile, # tile, or node glyph. */
  kind?: ReferenceKind;
  /** The one line of text: a display name, a title, or a topic. */
  name: string;
  /** A person's avatar photo or a media post's cover. */
  src?: string;
  /** The pair the author signed on this act, e.g. "+0.10 / +0.10". */
  pair?: string;
  /** The row navigates to the node it names. */
  onOpen?: () => void;
}

export declare function ReferenceRow(props: ReferenceRowProps): JSX.Element;
