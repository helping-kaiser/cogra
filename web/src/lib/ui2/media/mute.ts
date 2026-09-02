"use client";

// ONE MUTE, FOR EVERY PLAYER, EVERYWHERE.
//
// The ruling is a single global sticky mute rather than a per-video one, and
// the reason is what a feed feels like without it: a reader who turns the sound
// on for one clip and scrolls has to turn it on again for the next, and the
// reader who turns it OFF in a quiet room has to turn it off again, and again.
// The decision belongs to the reader and to the session, not to a video.
//
// WHY A MODULE-LEVEL STORE rather than React context. Players are rendered by
// the feed, by the detail page, and by whatever route comes next; a context
// would have to wrap all of them and would still be re-created by a route that
// remounts its provider. Module state is shared by construction and survives
// client-side navigation, which is exactly the "across routes" the ruling asks
// for.
//
// IT DOES NOT SURVIVE A RELOAD, and that is the conservative reading rather
// than a considered product choice: "sticky" was ruled across players and
// routes, and nothing was said about persistence. Reported as an open question
// instead of quietly written to localStorage — a preference that outlives the
// tab is a different promise from one that follows the reader through a
// session.
//
// STARTS MUTED, always. Autoplay is only permitted for muted media, so an
// unmuted start would simply be an autoplay that never runs.

import { useSyncExternalStore } from "react";

let muted = true;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  if (next === muted) return;
  muted = next;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The mute, as a value a component re-renders on.
 *
 * `useSyncExternalStore` is React's documented way to read from a store outside
 * React, and it is what keeps every mounted player in step with the one a
 * reader just touched. The server snapshot is `true` because a server render
 * has no reader and no sound — and because starting muted is the only state
 * autoplay permits, so hydration cannot disagree with the first paint.
 */
export function useMuted(): boolean {
  return useSyncExternalStore(subscribe, isMuted, () => true);
}

/** Test seam: nothing in the app resets the session's choice. */
export function resetMuteForTests(): void {
  muted = true;
  emit();
}
