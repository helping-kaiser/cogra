"use client";

// THE ENTRY SCREENS' LINK STACK (SignIn.jsx, InviteEntry.jsx, JoinInvalid.jsx):
// the ways out below the primary action are text buttons flush with the
// screen's own gutter — `Button variant="text"` at full width, its label at
// the start and its side padding gone — plain rows, never a second row of
// pills. A row that leaves the router (the APK) is a plain anchor.

import Link from "next/link";
import type { ReactNode } from "react";

import { BUTTON_CLASS } from "@/lib/ui/button";

/** The text button with its padding dropped and its label at the start. */
export const LINK_ROW = `${BUTTON_CLASS} box-border inline-flex min-h-10 w-full items-center justify-start gap-2 rounded-full border border-solid border-transparent p-0 text-label-large text-primary`;

export function LinkStack({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col">{children}</div>;
}

export function LinkRow({
  href,
  children,
  testId,
  download = false,
}: {
  href: string;
  children: ReactNode;
  testId?: string;
  /** A file the browser saves, outside the router. */
  download?: boolean;
}) {
  if (download) {
    return (
      <a href={href} download data-testid={testId} className={LINK_ROW}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} data-testid={testId} className={LINK_ROW}>
      {children}
    </Link>
  );
}
