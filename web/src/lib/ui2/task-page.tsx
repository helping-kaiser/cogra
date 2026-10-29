"use client";

// THE TASK PAGE (settings-surface §3.0; ChangePassword.jsx and its siblings,
// and the entry screens SignIn.jsx, Reset.jsx, InviteEntry.jsx): a header with
// the back arrow alone, then a column padded 8px 24px 32px — the
// headline-small title, the lead in the secondary ink, the fields, the commit
// in flow after the last field, and a closing quiet note. The page scrolls
// with its content (readme §4 *two placements*: a task page puts its commit in
// content flow), so the commit stays within reach at any width or text size.
//
// A MAIL LINK'S LANDING CARRIES NO HEADER (ResetNew.md, ResetExpired.md,
// VerifyExpired.md: "no header, no back arrow and no mark") — the platform's
// own Back leaves to wherever the link was opened from — and its column takes
// the header's 48px back as padding: 32px 24px.

import type { ReactNode } from "react";

import { part, testAttributes, type DataNode } from "@/lib/ui/data-node";
import { PageHeader } from "@/lib/ui/page-header";

export function TaskPage({
  node,
  backHref,
  backLabel = "Back",
  bandOnly = false,
  headerAction,
  title,
  lead,
  children,
  deletionBand,
}: {
  /**
   * The screen's registered prefix — `changePassword`, `changeHandle`,
   * `changeEmail`, `deleteAccount`; omitted on an entry screen the registry
   * does not name.
   */
  node?: DataNode;
  /** Omitted on a mail link's landing, which carries no header. */
  backHref?: string;
  /**
   * The header keeps its band and offers no way out (RecoveryCode.md: the
   * typed-back confirm is the screen's only exit).
   */
  bandOnly?: boolean;
  backLabel?: string;
  /** The header's trailing control (Join's "?"). */
  headerAction?: ReactNode;
  /** Omitted where the screen heads itself (Join's inviter block). */
  title?: string;
  /** Omitted while the words it needs are still being read. */
  lead?: ReactNode;
  children: ReactNode;
  /** `false` on the one page the deletion band steps aside on (DeleteAccountPending.md:9). */
  deletionBand?: false;
}) {
  const headed = backHref !== undefined || bandOnly;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      {headed && (
        <PageHeader
          backHref={bandOnly ? undefined : backHref}
          backLabel={backLabel}
          action={headerAction}
          node={part(node, "header")}
          deletionBand={deletionBand}
        />
      )}
      <div className={`flex flex-col px-6 ${headed ? "pb-8 pt-2" : "py-8"}`}>
        {title !== undefined && (
          <h1 className="m-0 text-headline-small" {...testAttributes(part(node, "title"))}>
            {title}
          </h1>
        )}
        {lead !== undefined && (
          <p className="m-0 mt-2 text-body-medium text-on-surface-variant" {...testAttributes(part(node, "body"))}>
            {lead}
          </p>
        )}
        {children}
      </div>
    </main>
  );
}

/** The whole-act lines a credential form can say above its commit (copy-voice *Faults by code*). */
export const NO_ANSWER = "That didn't send. Try again.";
export const RATE_LIMITED_LINE = "Too many tries. Wait a little, then try again.";
export const NOT_THROUGH = "That didn't go through. Try again.";
