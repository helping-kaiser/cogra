"use client";

// WHAT APP-OPEN SAYS when an ask link sent a reader who cannot vouch through
// it back there (VouchAsk.md:13, :15, :49): the applicant hears `You can
// vouch once you're in.`, the asker `That's your own ask link — send it to
// someone who's already in.` The ask's route has gone by the time the landing
// stands, so it hands the words over here, and the landing's status region
// says them once.

import { useCallback, useSyncExternalStore } from "react";

import { Snackbar } from "@/lib/ui/snackbar";

export const VOUCH_ONCE_IN = "You can vouch once you're in.";
export const YOUR_OWN_ASK_LINK = "That's your own ask link — send it to someone who's already in.";

let carried: { message: string; token: number } | null = null;
let tokens = 0;
const listeners = new Set<() => void>();

function publish(next: typeof carried): void {
  carried = next;
  for (const listener of listeners) listener();
}

/** Says `message` where app-open lands the reader next. */
export function carryToAppOpen(message: string): void {
  tokens += 1;
  publish({ message, token: tokens });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The landing's carried snackbar, mounted once by the status region. */
export function AppOpenSnackbar() {
  const current = useSyncExternalStore(
    subscribe,
    () => carried,
    () => null,
  );
  const dismiss = useCallback(() => publish(null), []);
  return (
    <Snackbar
      testId="app-open-snackbar"
      message={current?.message ?? null}
      token={current?.token}
      onDismiss={dismiss}
    />
  );
}
