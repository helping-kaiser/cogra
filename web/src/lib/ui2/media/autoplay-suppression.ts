"use client";

// WHEN THE DEVICE SUPPRESSES AUTOPLAY — the stage law's one input from the
// reader's own settings (tmp_dev packet `web-stage-law.md` §3.2 "Terms", RF-4).
//
// "ALWAYS the device suppresses autoplay GIVEN it asks for reduced motion or
// data saver" (FeedCover.md:23), and while it does, "no clip starts on its own
// on any surface" (FeedCover.md:25). Both requests are read where the platform
// publishes them:
//
// - reduced motion: the `prefers-reduced-motion: reduce` media query, read with
//   `matchMedia` and followed through its `change` event
//   (https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia,
//   https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/change_event);
// - data saver: `navigator.connection.saveData`, followed through the
//   connection's `change` event
//   (https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/saveData).
//   The Network Information API is absent from several engines; where it is,
//   the device never asks, so the clause holds vacuously.
//
// The live signal is not consumed yet — the suppression PR wires it to the
// stage and the play disc. What IS consumed today is the snapshot
// `prefersReducedMotion()`, lifted verbatim out of the player's autoplay
// effect so the two read the preference in one place.

import { useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** The connection as the Network Information API draws it, where it exists. */
type Connection = EventTarget & { readonly saveData?: boolean };

function connection(): Connection | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: Connection }).connection;
}

function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCED_MOTION);
}

/** Whether the reader asks for reduced motion, right now. */
export function prefersReducedMotion(): boolean {
  return reducedMotionQuery()?.matches ?? false;
}

/** Whether the reader asks to save data, right now. */
export function savesData(): boolean {
  return connection()?.saveData === true;
}

/** Whether the device suppresses autoplay, right now (FeedCover.md:23). */
export function isAutoplaySuppressed(): boolean {
  return prefersReducedMotion() || savesData();
}

function subscribe(listener: () => void): () => void {
  const query = reducedMotionQuery();
  const link = connection();
  query?.addEventListener("change", listener);
  link?.addEventListener?.("change", listener);
  return () => {
    query?.removeEventListener("change", listener);
    link?.removeEventListener?.("change", listener);
  };
}

/**
 * Whether the device suppresses autoplay, as a value a component re-renders
 * on — either request changing while the page is up re-renders it
 * (`useSyncExternalStore`, React's documented way to read a store outside
 * React). The server snapshot allows autoplay: a server render has no device,
 * and the client's first render after hydration reads the real answer.
 */
export function useAutoplaySuppressed(): boolean {
  return useSyncExternalStore(subscribe, isAutoplaySuppressed, () => false);
}
