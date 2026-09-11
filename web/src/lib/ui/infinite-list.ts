"use client";

// THE NEXT PAGE ARRIVES BECAUSE THE READER KEPT GOING. A list that grows on a
// button asks the reader to administer the list; a list that grows on approach
// asks nothing, which is why the boards draw no affordance at rest (design
// readme §13, the audit states) and why the only thing they draw is the row for
// a page that did not come.
//
// THE WATCH IS AN ELEMENT, NOT AN OFFSET. `IntersectionObserver` is the
// platform's own answer to "is this on screen yet" (MDN, Intersection Observer
// API): it reports off the main thread, needs no scroll listener, and costs
// nothing while the reader is nowhere near the end. It watches an item a few
// short of the last one rather than the end of the list, so the fetch starts
// while there is still something to read — a sentinel AT the end only ever
// reports once the reader has run out.
//
// The watched item moves as the list grows, so the observer is attached
// through a CALLBACK REF (React, "Manipulating the DOM with refs"): React hands
// the node to the callback when it mounts and null when it goes, which is
// exactly the observer's own lifecycle.

import { useCallback, useEffect, useRef } from "react";

import { scrollElementOf } from "./scroll-host";
import type { RefObject } from "react";

/** How many items short of the end the watch sits. */
export const TAIL_DISTANCE = 5;

/** Which item to watch in a list of this length, or -1 when there is none. */
export function tailIndexOf(count: number): number {
  if (count <= 0) return -1;
  return Math.max(0, count - TAIL_DISTANCE);
}

/**
 * Watch the approaching tail of a list.
 *
 * Returns the ref to put on the item `tailIndexOf` names. `onReach` fires when
 * that item comes into view; it is asked to be stable enough that a new
 * identity means the watch genuinely changed — a fresh cursor, a page that has
 * landed — because that is when the observer is rebuilt.
 */
export function useApproachingTail({
  root,
  onReach,
  enabled,
}: {
  /** The scrolling element the items live in; null means the viewport. */
  root: RefObject<HTMLElement | null> | null;
  onReach: () => void;
  enabled: boolean;
}): (node: Element | null) => void {
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // The observer outlives renders, so it has to be let go with the surface.
    return () => {
      observer.current?.disconnect();
      observer.current = null;
    };
  }, []);

  return useCallback(
    (node: Element | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (node === null || !enabled) return;
      const watch = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) onReach();
        },
        { root: scrollElementOf(root) },
      );
      watch.observe(node);
      observer.current = watch;
    },
    [root, onReach, enabled],
  );
}
