"use client";

// WHETHER A CLAMPED PARAGRAPH HIDES ANYTHING — the one question the `More`
// opener waits on. The master draws the opener "only where there is something
// folded away" (`PostCard.jsx`; FeedCommentShapes.md: "a long comment folds at
// two lines under More"), and offers it on a character estimate only because a
// static render cannot measure. A browser can: a line-clamped box keeps the
// clamped lines' height, and the content it cut is what its scroll height
// carries past that (MDN, `Element.scrollHeight`: the height of the content
// "including content not visible on the screen due to overflow").
//
// THE READING FOLLOWS THE BOX (MDN, `ResizeObserver`): a rotation or a wider
// window can unfold a caption on its own, and the opener then goes with it.
//
// WHILE THE TEXT IS OPEN THE CLAMP IS OFF, so nothing overflows and nothing
// can be measured; the last clamped reading stands, which is what keeps
// `Less` under the text it opened.

import { useCallback, useState } from "react";

import { useMeasureEffect } from "./measure-effect";

/**
 * Whether a clamped element cuts any of its content. Both heights are rounded
 * to whole pixels (MDN), so a one-pixel difference is rounding, never a fold —
 * a fold hides at least a line.
 */
export function cutsContent(element: HTMLElement): boolean {
  return element.scrollHeight - element.clientHeight > 1;
}

/**
 * The fold of one clamped paragraph, as `[holdClamped, folds]`: hand
 * `holdClamped` to the `ref` of the element that carries the clamp, and
 * `folds` says whether the clamp hides anything.
 *
 * `clamped` is whether the clamp is on right now; `content` is what the
 * element shows, so new words are measured afresh.
 */
export function useClampFold(
  clamped: boolean,
  content: string | null,
): [holdClamped: (element: HTMLElement | null) => void, folds: boolean] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [folds, setFolds] = useState(false);
  const holdClamped = useCallback((next: HTMLElement | null) => setElement(next), []);

  const measure = useCallback(() => {
    setFolds(element !== null && cutsContent(element));
  }, [element]);

  useMeasureEffect(() => {
    if (!clamped) return;
    measure();
    if (element === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [clamped, content, element, measure]);

  return [holdClamped, folds];
}
