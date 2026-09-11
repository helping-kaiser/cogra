// The house page header (Android's TopAppBar): a back arrow, the page title,
// and an optional trailing action — one pattern for every inner surface. The
// arrow is a LINK, not history.back(), so a deep-linked visitor with no history
// still lands somewhere sensible. Tab roots carry no back arrow.
//
// THE HEADER OWNS ITS BAND (design/components/navigation/PageHeader.jsx): 48px
// tall, 12px of its own side padding, and a 48px SQUARE back target with no
// negative margins. It used to grow a glyph to a ~42px target with `-m-2.5`,
// which was under the 48px minimum and a bet on the caller supplying 24px of
// gutter — inside a surface with none, the target bled off the edge and was
// clipped. 12px of padding plus a centred glyph in a 48px target puts the arrow
// exactly on the 24px screen gutter without depending on anyone.
//
// The title is `title-large`: every board's band title, and M3's top-app-bar
// spec (design/readme.md §13, the audit answers). `headline-small`'s home is a
// dialog heading.

import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/lib/ui/icons";

export function PageHeader({
  title,
  backHref,
  backLabel,
  backTestId,
  backScroll,
  action,
}: {
  /** Omit when the surface renders its own heading below the header. */
  title?: string;
  /** Omit on a shell tab root — tabs carry no back arrow. */
  backHref?: string;
  /** Accessible name for the arrow-only link, e.g. "Back to feed". */
  backLabel?: string;
  backTestId?: string;
  /**
   * Whether the arrow scrolls the destination to its top.
   *
   * `<Link>`'s own prop, passed through (Next `link.md`, "scroll"): a
   * destination that remembers where its reader was restores that place
   * itself, and Next scrolling to the first Page element would land on top of
   * it. Left at Next's default — a fresh surface starts at its top.
   */
  backScroll?: boolean;
  action?: ReactNode;
}) {
  return (
    <header className="flex min-h-12 items-center justify-between gap-3 px-3">
      <div className="flex min-w-0 items-center gap-2">
        {backHref !== undefined && (
          <Link
            href={backHref}
            scroll={backScroll}
            aria-label={backLabel}
            data-testid={backTestId}
            className="cg-state cg-focus grid size-12 flex-none place-items-center rounded-full text-on-surface-variant"
          >
            <Icon name="arrow_back" />
          </Link>
        )}
        {title !== undefined && (
          // A page title is a name and never wraps — a two-line header steals
          // the content's first row.
          <h1 className="truncate whitespace-nowrap text-title-large">{title}</h1>
        )}
      </div>
      {action}
    </header>
  );
}
