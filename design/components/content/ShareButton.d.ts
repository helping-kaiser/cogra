/**
 * The affordance row's share control: one tap, straight to the platform's own
 * share sheet (readme §13, the reel round). No menu, no confirmation and no
 * surface of ours — the OS sheet is where the reader's apps and contacts live.
 *
 * Glyph only, and no number: a share count would be a public tally of something
 * the graph does not record. Drawn on the post detail view and the stream's
 * rail; whether a feed card grows one is open (backlog item 33).
 */
export interface ShareButtonProps {
  onShare?: () => void;
  /** Completes the accessible name — "Share this post". */
  targetLabel?: string;
}

export declare function ShareButton(props: ShareButtonProps): JSX.Element;
