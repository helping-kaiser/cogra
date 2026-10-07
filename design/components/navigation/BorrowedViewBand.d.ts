import * as React from "react";

export interface BorrowedViewBandProps {
  /** Whose view the feed is ranked from — shown as @handle in the line. */
  handle: string;
  /** Names the monogram fallback; defaults to the handle. */
  displayName?: string;
  /** The actor's photo avatar, where they set one. */
  avatarSrc?: string;
  /** Overrides the default guest line ("Browsing from @handle's view — join
      to build your own.") — pass the applicant readings here. */
  line?: string;
  /** The one join entry ("Sign in or join"). Omit for any signed-in reader —
      applicant or landed member. */
  actionLabel?: string;
  onAction?: () => void;
  /** The data-node name its placer gives this band (design ⇄ impl seam 002; renders as attributes only). Given one, it also names its parts: `avatar`, `line`, `action`. */
  node?: string;
}

/** The borrowed-view band: names the vantage point a guest or applicant feed
    shows, riding the collapsing top in place of the guest notice. */
export function BorrowedViewBand(props: BorrowedViewBandProps): React.JSX.Element;
