"use client";

// WHO SCROLLS. The app shell is a dynamic-viewport-tall column whose middle
// scrolls, so the reading surface's scroller is an ELEMENT, not the window
// (`shell.tsx` says why the document itself may not be the scroller). Anything
// that reads or writes a scroll offset has to ask which element that is, and
// this context is the answer.
//
// Null means "no shell above me" — a component rendered on its own, and in
// practice a test. Consumers fall back to the window there rather than
// refusing to work, because the window IS the scroller in that arrangement.

import { createContext, useContext } from "react";

const ScrollHostContext = createContext<HTMLElement | null>(null);

export const ScrollHostProvider = ScrollHostContext.Provider;

/** The scrolling element of the surrounding shell, or null for the window. */
export function useScrollHost(): HTMLElement | null {
  return useContext(ScrollHostContext);
}

/** How far the host has been scrolled, whichever host it is. */
export function scrollOffsetOf(host: HTMLElement | null): number {
  return host === null ? window.scrollY : host.scrollTop;
}

/** The host's own visible height — a screenful, whichever host it is. */
export function viewportHeightOf(host: HTMLElement | null): number {
  return host === null ? window.innerHeight : host.clientHeight;
}
