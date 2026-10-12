"use client";

// Whether the stance gesture has been taught yet
// (design/guidelines/stance-control.md "Teaching it").
//
// "A held gesture is invisible until taught — and the pad is the teacher.
// … The account's first open ever, wherever that pad opens, carries two
// coaching lines … They close with the pad and never show again."
//
// So the stored fact is one bit: has the first open happened. It flips
// the moment the considered surface first opens, and the lines stay on
// that open until it closes. A hold opens nothing, so it teaches nothing
// and spends nothing.
//
// It is about the gesture rather than any one target, so it is stored
// once for the viewer rather than per post: teaching the same lesson
// again on the next card is the noise the rule exists to avoid. It is a
// rendering preference with nothing private in it, so it lives in
// `localStorage` beside the input mode, read through
// `useSyncExternalStore` the same way — which also keeps every mounted
// control in step, so the teaching open on one card does not leave the
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
