/**
 * design.md §9's two content states. Same register — a statement of fact, never
 * `error` colouring — and opposite reach: one covers the body and gives it back
 * on a tap, the other takes the whole record for good.
 *
 * SENSITIVE covers the BODY as one: media, words and description veil together,
 * the title and topics stay outside it and readable, and a gallery veils whole
 * rather than one picture of it. Reveal is per POST — wrap it in
 * `SensitiveScope` and one tap answers for everything inside.
 *
 * REDACTED is the whole RECORD: an illegal verdict removes the payload, so every
 * authored field goes together. `RedactedContent` therefore replaces a node's
 * entire content region and has no field-level or inline cut.
 */
export declare function SensitiveScope(props: { children?: React.ReactNode }): JSX.Element;

export interface SensitiveVeilProps {
  children?: React.ReactNode;
  /**
   * "media" covers a tile; "text" blurs a line of type in place; "compact"
   * REPLACES a comment-scale body — words and pictures as one short block,
   * because a comment is too short to cover in place twice over.
   */
  kind?: "media" | "text" | "compact";
  /** The standard line on the wash. Default "Sensitive — tap to view". */
  label?: string;
  /** The reason behind the mark, appended to the source line after an em dash. */
  reason?: string;
  /**
   * Whose mark this is — the author's own warning or the platform's verdict.
   * Named unconditionally on the smaller second line: the two states read back
   * as the same veil, so an unnamed source would read as the other one.
   */
  source?: "author" | "platform";
  revealLabel?: string;
  /**
   * The veiled tile's radius. Authoritative: it styles the scrim AND is forwarded
   * to the child, so a veiled tile in a flush gallery cannot end up rounded
   * beside a square neighbour.
   */
  radius?: string;
}

export declare function SensitiveVeil(props: SensitiveVeilProps): JSX.Element;

export interface RedactedContentProps {
  /**
   * "illegal" — removed for cause by a passing proposal. "author" — removed by
   * choice (erasure §1). These must read differently: collapsing them would let a
   * moderation verdict hide behind an author's decision, or the reverse.
   */
  reason?: "illegal" | "author";
  /** When it was removed, in the reader's words. */
  when?: string;
  /** Replaces the second line where a case needs its own wording. */
  note?: string;
}

export declare function RedactedContent(props: RedactedContentProps): JSX.Element;
