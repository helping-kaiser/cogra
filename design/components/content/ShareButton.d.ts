/**
 * The affordance row's share control: one tap, straight to the platform's own
 * share sheet (readme §13, the reel round). No menu, no confirmation and no
 * surface of ours — the OS sheet is where the reader's apps and contacts live.
 *
 * Glyph only, and no number: a share count would be a public tally of something
 * the graph does not record. `PostCard` draws it last in the action row, whose
 * order — stance, score, comment, share — is both its order of importance and
 * the queue by which it gives way: share moves into the ⋮ menu first.
 */
export interface ShareButtonProps {
  onShare?: () => void;
  /** Completes the accessible name — "Share this post". */
  targetLabel?: string;
}

export declare function ShareButton(props: ShareButtonProps): JSX.Element;
