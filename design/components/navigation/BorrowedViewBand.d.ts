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
  /** The one join entry ("Sign in or join"). Omit for signed-in applicants. */
  actionLabel?: string;
  onAction?: () => void;
}

/** The borrowed-view band: names the vantage point a guest or applicant feed
    is ranked from, riding the collapsing top in place of the guest notice. */
export function BorrowedViewBand(props: BorrowedViewBandProps): React.JSX.Element;
