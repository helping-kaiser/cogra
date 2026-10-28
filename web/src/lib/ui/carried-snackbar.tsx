"use client";

// A SNACKBAR THAT RIDES A NAVIGATION (KeptPicksSeal.md, KeptPicksReview.md,
// Restore.md). Some acts end by leaving for another surface and confirm there:
// the kept picks' seal returns where the review was opened from with `Signed 3
// things, still settling.`, the review's last drop returns with `Nothing left
// to sign.`, and a restore with picks waiting opens the review under `Your key
// is on this browser now.` The surface that acted is gone by the time the
// confirmation shows, so it hands the words to the shell, which outlives the
// route change, and the shell's one carried snackbar says them once.

import { useCallback, useSyncExternalStore } from "react";

import { Snackbar } from "./snackbar";

let carried: { message: string; token: number } | null = null;
let tokens = 0;
const listeners = new Set<() => void>();

function publish(next: typeof carried): void {
  carried = next;
  for (const listener of listeners) listener();
}

/** Says `message` on whatever surface the reader lands on next. */
export function carrySnackbar(message: string): void {
  tokens += 1;
  publish({ message, token: tokens });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The shell's carried snackbar, mounted once. */
export function CarriedSnackbar() {
  const current = useSyncExternalStore(
    subscribe,
    () => carried,
    () => null,
  );
  const dismiss = useCallback(() => publish(null), []);
  return (
    <Snackbar
      testId="carried-snackbar"
      message={current?.message ?? null}
      token={current?.token}
      onDismiss={dismiss}
    />
  );
}

export function resetCarriedSnackbarForTests(): void {
  carried = null;
}
