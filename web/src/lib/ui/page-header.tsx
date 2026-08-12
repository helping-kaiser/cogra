// The house page header (Android's TopAppBar): a back arrow, the page
// title, and an optional trailing action — one pattern for every inner
// surface. The arrow is a link, not history.back(), so a deep-linked
// visitor with no history still lands somewhere sensible.

import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  backHref,
  backLabel,
  backTestId,
  action,
}: {
  /** Omit when the surface renders its own heading below the header. */
  title?: string;
  backHref: string;
  /** Accessible name for the arrow-only link, e.g. "Back to feed". */
  backLabel: string;
  backTestId: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          aria-label={backLabel}
          data-testid={backTestId}
          className="rounded-md text-xl text-zinc-600 dark:text-zinc-400"
        >
          <span aria-hidden>←</span>
        </Link>
        {title !== undefined && (
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        )}
      </div>
      {action}
    </header>
  );
}
