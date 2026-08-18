"use client";

// The guest prompt behind an account-needing slot (design.md §6):
// ask, never bounce — the reader picks the auth flow or stays put.
// A native <dialog>, so focus trapping, Esc, and the backdrop come
// from the platform; both actions are text buttons, M3's dialog
// vocabulary.

import Link from "next/link";
import { useEffect, useRef } from "react";

import { buttonClassName } from "@/lib/ui/button";

export function JoinPrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      data-testid="join-prompt"
      onClose={onClose}
      className="m-auto w-[min(90vw,20rem)] rounded-extra-large bg-surface-container-high p-6 text-left text-on-surface backdrop:bg-scrim/50"
    >
      <h2 className="text-headline-small">Join the conversation</h2>
      <p className="mt-2 text-body-medium text-on-surface-variant">
        Posting and profiles need an account.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          data-testid="join-prompt-dismiss"
          onClick={onClose}
          className={buttonClassName({ variant: "text", size: "sm" })}
        >
          Keep browsing
        </button>
        <Link
          href="/login"
          data-testid="join-prompt-signin"
          onClick={onClose}
          className={buttonClassName({ variant: "text", size: "sm" })}
        >
          Sign in or join
        </Link>
      </div>
    </dialog>
  );
}
