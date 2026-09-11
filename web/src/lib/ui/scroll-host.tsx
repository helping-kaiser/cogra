"use client";

// WHO SCROLLS. The app shell is a dynamic-viewport-tall column whose middle
// scrolls, so a reading surface's scroller is an ELEMENT, not the window
// (`shell.tsx` says why the document itself may not be the scroller). Anything
// that reads or writes a scroll offset has to ask which element that is, and
// this context is the answer.
//
// IT CARRIES A REF, NOT THE ELEMENT. A ref is stable, so putting the scroller
// in context costs no consumer a re-render, and refs are attached before any
// effect runs — so an effect that restores a scroll offset finds the element
// already there, on the same commit that first rendered the content it is
// scrolling to. Passing the element as state would paint once at the top
// before the consumer ever saw it.
//
// A null current means "no shell above me" — a component rendered on its own,
// and in practice a test. Consumers fall back to the window there rather than
// refusing to work, because the window IS the scroller in that arrangement.

import { createContext, useContext, type RefObject } from "react";

const ScrollHostContext = createContext<RefObject<HTMLElement | null> | null>(null);

export const ScrollHostProvider = ScrollHostContext.Provider;

/** The surrounding shell's scroller ref, or null where there is no shell. */
export function useScrollHost(): RefObject<HTMLElement | null> | null {
  return useContext(ScrollHostContext);
}

/** The scrolling element itself, or null to mean the window. */
export function scrollElementOf(host: RefObject<HTMLElement | null> | null): HTMLElement | null {
  return host?.current ?? null;
}

/** How far the host has been scrolled, whichever host it is. */
export function scrollOffsetOf(host: RefObject<HTMLElement | null> | null): number {
  return scrollElementOf(host)?.scrollTop ?? window.scrollY;
}

/** Move the host to an offset, whichever host it is. */
export function scrollHostTo(host: RefObject<HTMLElement | null> | null, offset: number): void {
  const scroller = scrollElementOf(host);
  if (scroller === null) window.scrollTo(0, offset);
  else scroller.scrollTop = offset;
}

/** Move the host by a delta, whichever host it is. */
export function scrollHostBy(host: RefObject<HTMLElement | null> | null, delta: number): void {
  const scroller = scrollElementOf(host);
  if (scroller === null) window.scrollBy(0, delta);
  else scroller.scrollTop += delta;
}

/** The host's own visible height — a screenful, whichever host it is. */
export function viewportHeightOf(host: RefObject<HTMLElement | null> | null): number {
  return scrollElementOf(host)?.clientHeight ?? window.innerHeight;
}
