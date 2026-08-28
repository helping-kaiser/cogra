/**
 * design.md §9's two content states. Same register — a statement of fact, never
 * `error` colouring — and opposite granularity.
 *
 * SENSITIVE is per FIELD: a title, a description, a body, and each media
 * attachment can be veiled alone (`FieldModerationStatus` exists per field for
 * exactly this, and "per-field granularity exists for SENSITIVE only"). Reveal,
 * however, is per POST — wrap it in `SensitiveScope` and one tap answers for
 * everything inside.
 *
 * REDACTED is the whole RECORD: an illegal verdict removes the payload, so every
 * authored field goes together. `RedactedContent` therefore replaces a node's
 * entire content region and has no field-level or inline cut.
 */
export declare function SensitiveScope(props: { children?: React.ReactNode }): JSX.Element;

export interface SensitiveVeilProps {
  children?: React.ReactNode;
  /** "media" covers a tile; "text" blurs a line of type in place. */
  kind?: "media" | "text";
  /** The standard line on the wash. Default "Sensitive — tap to view". */
  label?: string;
  /** The author's own reason, the smaller second line under the label. */
  reason?: string;
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
