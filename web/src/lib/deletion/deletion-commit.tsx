"use client";

// THE DELETION SCREENS' ONE COMMITMENT (DeleteAccount, DeleteAccountMail,
// DeleteAccountPending, DeleteAccountConfirmed): a full-width button with the
// whole-act fault above it in SignInError's slot (copy-voice *Faults by
// code*), the button staying as the retry. In flight it goes inert, never
// dimmed; where a waiting label is drawn it is said late — past 200ms, the
// caller's `useSlowAnswer` — and never with a spinner.

import { buttonClassName } from "@/lib/ui/button";
import { testAttributes, type DataNode } from "@/lib/ui/data-node";

export function DeletionCommit({
  label,
  busyLabel,
  busy,
  fault,
  onCommit,
  node,
  variant = "primary",
  className = "mt-6",
}: {
  label: string;
  /** The drawn present participle, already gated on the slow answer; omitted where none is drawn. */
  busyLabel?: string;
  busy: boolean;
  fault: string | null;
  onCommit: () => void;
  node: DataNode;
  variant?: "primary" | "outline";
  className?: string;
}) {
  return (
    <div className={`${className} flex flex-col gap-2`}>
      {fault !== null && (
        <p role="alert" className="m-0 text-body-medium text-error" data-testid="commit-fault">
          {fault}
        </p>
      )}
      <button
        type="button"
        aria-busy={busy || undefined}
        aria-disabled={busy || undefined}
        onClick={busy ? undefined : onCommit}
        className={`${buttonClassName({ variant })} w-full`}
        {...testAttributes(node)}
      >
        {busyLabel ?? label}
      </button>
    </div>
  );
}
