"use client";

// THE ENTRY SCREENS' LINK STACK (SignIn.jsx, InviteEntry.jsx, JoinInvalid.jsx):
// the ways out below the primary action are text buttons flush with the
// screen's own gutter — `Button variant="text"` at full width, its label at
// the start and its side padding gone — plain rows, never a second row of
// pills. A row that leaves the router (the APK) is a plain anchor.
//
// A HELD ROW REFUSES A PRESS, UNDIMMED AND UNCHANGED IN FACE (SignIn.md: an
// entry form keeps its exits held while it submits), exactly as the page
// header's held back arrow does.

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

import { BUTTON_CLASS } from "@/lib/ui/button";
import { testAttributes, type DataNode } from "@/lib/ui/data-node";

/** The text button with its padding dropped and its label at the start. */
export const LINK_ROW = `${BUTTON_CLASS} box-border inline-flex min-h-10 w-full items-center justify-start gap-2 rounded-full border border-solid border-transparent p-0 text-label-large text-primary`;

export function LinkStack({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col">{children}</div>;
}

export function LinkRow({
  href,
  children,
  node,
  testId,
  download = false,
  held = false,
}: {
  href: string;
  children: ReactNode;
  /** The row's registered node, on a screen the registry names. */
  node?: DataNode;
  /** The row's own test id, on a screen that registers no node. */
  testId?: string;
  /** A file the browser saves, outside the router. */
  download?: boolean;
  /** The row refuses a press while its screen's commit waits on an answer. */
  held?: boolean;
}) {
  const hold = {
    "aria-disabled": held || undefined,
    onClick: held ? (event: MouseEvent) => event.preventDefault() : undefined,
  };
  if (download) {
    return (
      <a href={href} download {...hold} {...testAttributes(node, testId)} className={LINK_ROW}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} {...hold} {...testAttributes(node, testId)} className={LINK_ROW}>
      {children}
    </Link>
  );
}
