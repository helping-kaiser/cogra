"use client";

// Which input the stance control offers (design.md §8.6): the pad by
// default, or one of the two alternates — paired sliders and direct
// entry. They are the same machinery on a different surface, and they are
// also the ACCESSIBLE path: the pad is a drag gesture, and design.md §10
// requires a drag to always have a non-drag equivalent. Screen-reader and
// switch users get the full range through ordinary, well-supported
// controls rather than a degraded version of the gesture.
//
// The choice replaces the pad everywhere, not per-screen (§8.6), so it is
// a stored preference rather than component state. It is a rendering
// preference with nothing private in it, so it lives in `localStorage`
// beside the session's own — no account key, and no server round-trip.
//
// `useSyncExternalStore` is React's documented way to read an external
// store: it gives the server snapshot for SSR and re-renders every
// mounted control when the preference changes, in this tab or another.

import { useCallback, useSyncExternalStore } from "react";

export type StanceInputMode = "pad" | "sliders" | "entry";

export const STANCE_INPUT_MODES: readonly StanceInputMode[] = ["pad", "sliders", "entry"];

export const DEFAULT_STANCE_INPUT_MODE: StanceInputMode = "pad";

const STORAGE_KEY = "cogra.stanceInputMode";

function isMode(value: string | null): value is StanceInputMode {
  return value !== null && (STANCE_INPUT_MODES as readonly string[]).includes(value);
}

export function readStanceInputMode(): StanceInputMode {
  if (typeof window === "undefined") return DEFAULT_STANCE_INPUT_MODE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isMode(stored) ? stored : DEFAULT_STANCE_INPUT_MODE;
}

const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

export function writeStanceInputMode(mode: StanceInputMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
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

export function useStanceInputMode(): [StanceInputMode, (mode: StanceInputMode) => void] {
  const mode = useSyncExternalStore(
    subscribe,
    readStanceInputMode,
    () => DEFAULT_STANCE_INPUT_MODE,
  );
  const set = useCallback((next: StanceInputMode) => writeStanceInputMode(next), []);
  return [mode, set];
}
