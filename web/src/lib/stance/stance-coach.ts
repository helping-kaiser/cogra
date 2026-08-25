"use client";

// Whether the stance gesture has been taught yet (design.md §8.7).
//
// "A held gesture is invisible until taught, and a tap that stages a
// priced act must not be the teaching moment's casualty. The first tap
// ever on a stance target teaches before it acts: it opens the coach mark
// — anchored to the target, overlapping nothing, staying until dismissed
// or until the first successful hold — and stages nothing. Every tap
// after that acts."
//
// So the stored fact is one bit: has the viewer met the gesture. It flips
// on the teaching tap, and equally on a successful hold by someone who
// found the gesture without being told — either way they have met it, and
// a second teaching would cost them a tap for nothing.
//
// It is about the gesture rather than any one target, so it is stored
// once for the viewer rather than per post: teaching the same lesson
// again on the next card is the noise the mark exists to avoid. It is a
// rendering preference with nothing private in it, so it lives in
// `localStorage` beside the input mode, read through
// `useSyncExternalStore` the same way — which also keeps every mounted
// control in step, so the teaching tap on one card does not leave the
// next card still waiting to teach.

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "cogra.stanceGestureTaught";

export function readStanceTaught(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

const listeners = new Set<() => void>();

export function writeStanceTaught(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, "true");
  // `storage` fires in OTHER tabs only, so this tab is told directly.
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Whether the gesture has been taught, and how to record that it has. */
export function useStanceTaught(): [boolean, () => void] {
  const taught = useSyncExternalStore(subscribe, readStanceTaught, () => true);
  const teach = useCallback(() => writeStanceTaught(), []);
  return [taught, teach];
}
