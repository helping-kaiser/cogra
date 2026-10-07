"use client";

// WHETHER THE PAGE IS ON SCREEN AT ALL — a backgrounded tab, an app switched
// away from, a locked screen (tmp_dev packet `web-stage-law.md` §3.2 rule 11,
// RF-7).
//
// The stage law reads it because a clip "only plays while it is actually on
// screen" (`design/components/media/MediaAttachment.jsx:45`): "WHEN the page is
// hidden, a backgrounded app and a locked screen included -> the playing clip
// pauses on the frame it reached" (Feed.md:51), and resumes that same clip when
// the page shows again (Feed.md:53/55). The Page Visibility API is the
// platform's own signal for exactly this — `document.visibilityState`, and
// `visibilitychange` when it flips
// (https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).
//
// Every stage reads it (`stage-host.tsx`), hosted or private.

import { useSyncExternalStore } from "react";

function subscribe(listener: () => void): () => void {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

/** Whether the page is visible right now. Only `"hidden"` hides it. */
export function isPageVisible(): boolean {
  return document.visibilityState !== "hidden";
}

/**
 * Whether the page is visible, as a value a component re-renders on
 * (`useSyncExternalStore`, React's documented way to read a store outside
 * React). The server snapshot is visible: a page being rendered is a page
 * about to be shown.
 */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, isPageVisible, () => true);
}
