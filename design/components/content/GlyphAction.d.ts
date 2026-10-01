/**
 * A feed card's own act, as a glyph — the third slot of the unified row
 * (opinion · score · the kind's own act · share). A comment's reply and a
 * tag's `Tag a new post with it` take it; a post's comments stay
 * `PostCard`'s own, with their count. The share/comment-count anatomy: 18px
 * glyph on `text-secondary`, 48px target, words only in the accessible name.
 */
export interface GlyphActionProps {
  /** An `Icon` name — `chat_bubble` for a reply, `add` for a new post. */
  glyph: string;
  /** The accessible name, the act in words — "Reply to @tobias". */
  label: string;
  onPress?: () => void;
  /** The data-node name its placer gives this button (design ⇄ impl seam 002; renders as attributes only). */
  node?: string;
}

export declare function GlyphAction(props: GlyphActionProps): JSX.Element;
