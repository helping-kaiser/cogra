"use client";

// The transient confirmation of design.md §6: "Confirmation of a
// completed action is a snackbar on both platforms, fired once per
// event." §8.3 is what makes it load-bearing rather than decoration — a
// gesture that stages a priced act must never be silent, because silence
// reads as failure and invites the same act again.
//
// The live region is mounted whether or not it has anything to say.
// Assistive technology only announces changes to a region it was already
// watching, so a region that appears together with its own text is
// routinely missed — the point of a confirmation nobody hears is nil.
//
// It clears itself after Material's short duration; anything the reader
// still needs afterwards belongs on the surface it happened on, not
// here.

import { useEffect } from "react";

/** Material's short snackbar duration. */
export const SNACKBAR_MS = 4000;

export function Snackbar({
  message,
  onDismiss,
  testId,
}: {
  /** `null` leaves the region mounted and silent. */
  message: string | null;
  onDismiss: () => void;
  testId: string;
}) {
  useEffect(() => {
    if (message === null) return;
    const timer = setTimeout(onDismiss, SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div role="status" aria-live="polite" data-testid={`${testId}-region`}>
      {message !== null && (
        <div
          data-testid={testId}
          className="fixed inset-x-4 bottom-20 z-30 mx-auto w-fit max-w-[min(92vw,24rem)] rounded-extra-small bg-inverse-surface px-4 py-3 text-body-medium text-inverse-on-surface shadow-lg"
        >
          {message}
        </div>
      )}
    </div>
  );
}
