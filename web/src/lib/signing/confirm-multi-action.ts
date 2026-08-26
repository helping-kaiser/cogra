"use client";

// Whether a submit that stages MORE THAN ONE signed action stops to
// confirm first (F4). Every act is priced separately, so a submit that
// quietly signs four of them is exactly the surprise this asks about —
// and the reader can switch the asking off from the dialog itself, or
// back on in settings.
//
// A rendering preference with nothing private in it, so it lives in
// `localStorage` beside the session's own — no account key, no server
// round-trip. Every read and write is guarded: a browser with site data
// blocked throws on the very access, and losing a preference must never
// take the composer down with it.
//
// `useSyncExternalStore` is React's documented way to read an external
// store: it gives the server snapshot for SSR and re-renders every
// mounted subscriber when the preference changes, in this tab or another.

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "cogra.confirmMultiActionSubmits";

/** Asking is the default: the cost of a batch should not arrive unannounced. */
export const DEFAULT_CONFIRM_MULTI_ACTION = true;

export function readConfirmMultiAction(): boolean {
  if (typeof window === "undefined") return DEFAULT_CONFIRM_MULTI_ACTION;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // Storage unavailable (private mode, blocked site data) — the
    // default stands for this session.
  }
  return DEFAULT_CONFIRM_MULTI_ACTION;
}

const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

export function writeConfirmMultiAction(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // The choice cannot be remembered past this page; it still holds for
    // every mounted subscriber below.
  }
  // `storage` fires in OTHER tabs only, so this tab is told directly.
  announce();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useConfirmMultiAction(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(
    subscribe,
    readConfirmMultiAction,
    () => DEFAULT_CONFIRM_MULTI_ACTION,
  );
  const set = useCallback((next: boolean) => writeConfirmMultiAction(next), []);
  return [enabled, set];
}
