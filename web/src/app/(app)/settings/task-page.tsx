"use client";

// THE TASK PAGE (settings-surface §3.0; ChangePassword.jsx and its siblings):
// a header with the back arrow alone, then a column padded 8px 24px 32px — the
// headline-small title, the lead in the secondary ink, the fields, the commit
// in flow after the last field, and a closing quiet note. The page scrolls
// with its content (readme §4 *two placements*: a task page puts its commit in
// content flow), so the commit stays within reach at any width or text size.

import type { ReactNode } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { PageHeader } from "@/lib/ui/page-header";

export function TaskPage({
  node,
  backHref,
  backLabel,
  title,
  lead,
  children,
}: {
  /** The screen's registered prefix — `changePassword`, `changeHandle`, `changeEmail`. */
  node: DataNode;
  backHref: string;
  backLabel: string;
  title: string;
  lead: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <PageHeader backHref={backHref} backLabel={backLabel} node={part(node, "header")} />
      <div className="flex flex-col px-6 pb-8 pt-2">
        <h1 className="m-0 text-headline-small" {...testAttributes(part(node, "title"))}>
          {title}
        </h1>
        <p className="m-0 mt-2 text-body-medium text-on-surface-variant" {...testAttributes(part(node, "body"))}>
          {lead}
        </p>
        {children}
      </div>
    </main>
  );
}

/** The whole-act lines a credential form can say above its commit (copy-voice *Faults by code*). */
export const NO_ANSWER = "That didn't send. Try again.";
export const RATE_LIMITED_LINE = "Too many tries. Wait a little, then try again.";
export const NOT_THROUGH = "That didn't go through. Try again.";
