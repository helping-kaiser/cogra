"use client";

// WHERE THE READER WAS, TO THE PIXEL — and it stays there until the reader
// themselves moves it.
//
// AN OFFSET ALONE IS NOT A PLACE. A scroller's offset only means something
// against the layout it was measured in, and a re-mounted reading surface does
// not get that layout back all at once: a banner answers a fetch a moment
// later, a picture finds its size when it decodes, and every one of those lands
// ABOVE what the reader was reading and shoves it. Restoring the number alone
// therefore lands right and then drifts — which is the report this file
// answers. So a place is an ANCHOR — the item the reader was reading and how
// far its top sat from the top of the scrollport — with the offset kept only as
// the fallback for when that item is gone. Correcting to the anchor is what the
// CSS scroll-anchoring spec has browsers do for the same reason; it is done
// here because it has to survive the restore itself, and Safari implements no
// anchoring at all.
//
// THE PIN IS RELEASED BY THE READER, NOT BY A TIMER. Every correction records
// the offset it wrote, so the scroll event it causes is recognised and ignored;
// an offset that differs from what was written can only be the reader, and the
// first one ends the pin for good. Nothing else can move the surface in
// between, which is the whole requirement.
//
// Items name themselves with `data-scroll-anchor`, so this knows nothing about
// posts and a second surface can be pinned the same way.

import { useCallback, useEffect, useRef, type RefObject } from "react";

import { useMeasureEffect } from "./measure-effect";
import { scrollElementOf, scrollHostBy, scrollHostTo, scrollOffsetOf } from "./scroll-host";

export const ANCHOR_ATTRIBUTE = "data-scroll-anchor";

/** An item's edges, measured from the top of the scrollport. */
export type ItemEdges = { id: string; top: number; bottom: number };

/** Where a reader was, in terms that survive a re-layout. */
export type ScrollPlace = {
  /** The scroller's own offset — what stands when the anchor is gone. */
  offset: number;
  /** The item the reader was reading, or null when none was on screen. */
  anchorId: string | null;
  /** That item's top edge, measured from the top of the scrollport. */
  anchorTop: number;
};

/**
 * The item the reader is reading: the first one still on screen.
 *
 * "Still on screen" is `bottom > 0` — an item whose last pixel is above the
 * scrollport's top edge has been read past. The first survivor is the one the
 * reader's eye is on, so it is the one the place is measured against.
 */
export function anchorIn(items: readonly ItemEdges[]): ItemEdges | null {
  for (const item of items) {
    if (item.bottom > 0) return item;
  }
  return null;
}

/** The reader's place: the offset, and the anchor that gives it meaning. */
export function placeOf(offset: number, items: readonly ItemEdges[]): ScrollPlace {
  const anchor = anchorIn(items);
  return { offset, anchorId: anchor?.id ?? null, anchorTop: anchor?.top ?? 0 };
}

/**
 * How far the scroller has to move for the anchor to sit where it sat.
 *
 * Positive means the anchor has slid DOWN since — something above it grew —
 * and the scroller follows it down by the same amount. With no anchor to
 * measure against, nothing is corrected and the restored offset stands.
 */
export function driftOf(place: ScrollPlace, anchorTop: number | null): number {
  if (place.anchorId === null || anchorTop === null) return 0;
  return anchorTop - place.anchorTop;
}

function portTopOf(scroller: HTMLElement | null): number {
  // With no shell above the surface the window is the scroller, and a client
  // rect is already measured from the top of the window.
  return scroller === null ? 0 : scroller.getBoundingClientRect().top;
}

/** Every anchored item under the host, measured from the scrollport's top. */
export function measureAnchors(scroller: HTMLElement | null): ItemEdges[] {
  const root: ParentNode = scroller ?? document;
  const portTop = portTopOf(scroller);
  return [...root.querySelectorAll(`[${ANCHOR_ATTRIBUTE}]`)].map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      id: element.getAttribute(ANCHOR_ATTRIBUTE) ?? "",
      top: rect.top - portTop,
      bottom: rect.bottom - portTop,
    };
  });
}

/** One anchored item's top edge, or null when it is no longer on the page. */
export function topOfAnchor(scroller: HTMLElement | null, id: string | null): number | null {
  if (id === null) return null;
  const root: ParentNode = scroller ?? document;
  const element = root.querySelector(`[${ANCHOR_ATTRIBUTE}="${CSS.escape(id)}"]`);
  if (element === null) return null;
  return element.getBoundingClientRect().top - portTopOf(scroller);
}

/**
 * Put the reader back where they were, and keep them there.
 *
 * `place` is read ONCE, at mount — the caller holds it in a lazy state
 * initializer — so the landing happens on the first commit, before the browser
 * paints a top-of-list frame nobody asked for.
 */
export function usePinnedPlace({
  host,
  place,
  record,
}: {
  host: RefObject<HTMLElement | null> | null;
  /** Where the reader was, or null for a first arrival. */
  place: ScrollPlace | null;
  /** Called with the reader's place as they scroll. Must be stable. */
  record: (place: ScrollPlace) => void;
}): { release: () => void } {
  const pinned = useRef(place !== null);
  // The last offset this hook wrote, so the scroll it causes is not mistaken
  // for the reader scrolling.
  const written = useRef(0);

  const correct = useCallback(() => {
    if (place === null) return;
    const offset = scrollOffsetOf(host);
    // NOTHING IS ANCHORED AT THE ORIGIN. "If S is not scrolled away from the
    // origin of its scrolling area in its block flow direction, then do not
    // select an anchor node for S" (CSS Scroll Anchoring §2.1) — a reader who
    // is at the top is there to see what is at the top, and a banner that lands
    // there must be allowed to show rather than be held out of sight.
    if (offset <= 0) {
      written.current = offset;
      return;
    }
    const scroller = scrollElementOf(host);
    const drift = driftOf(place, topOfAnchor(scroller, place.anchorId));
    if (drift !== 0) scrollHostBy(host, drift);
    written.current = scrollOffsetOf(host);
  }, [host, place]);

  const release = useCallback(() => {
    pinned.current = false;
  }, []);

  // The landing, before the paint: the pages are already in this render, so the
  // scroller is as tall now as it was when the reader left.
  //
  // A SURFACE THAT PINS ITS OWN PLACE OWNS BOTH ANSWERS. Its links turn Next's
  // scroll handling off (`link.md`, "scroll") so the framework cannot land on
  // top of the restore — and the scroller is shared with whatever surface was
  // on screen before, so with no place to restore this has to put the top back
  // itself. Nothing else will.
  useMeasureEffect(() => {
    if (place === null) {
      scrollHostTo(host, 0);
      return;
    }
    scrollHostTo(host, place.offset);
    correct();
  }, [host, place, correct]);

  useEffect(() => {
    const scroller = scrollElementOf(host);
    let ticking = false;
    const onScroll = () => {
      if (pinned.current) {
        if (Math.abs(scrollOffsetOf(host) - written.current) <= 1) return;
        pinned.current = false;
      }
      if (ticking) return;
      ticking = true;
      // Kept on the way past rather than on unmount: a mobile browser may never
      // run an unmount, and one measurement per frame is cheaper than a render.
      requestAnimationFrame(() => {
        record(placeOf(scrollOffsetOf(host), measureAnchors(scrollElementOf(host))));
        ticking = false;
      });
    };
    const target: HTMLElement | Window = scroller ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });

    // What lands late is what moves the reader: a banner answering its fetch, a
    // picture finding its size. The observer hears the surface change height
    // and the anchor says by how much to follow it.
    const observer = new ResizeObserver(() => {
      if (pinned.current) correct();
    });
    if (scroller !== null) {
      for (const child of scroller.children) observer.observe(child);
    }
    return () => {
      target.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [host, record, correct]);

  return { release };
}
