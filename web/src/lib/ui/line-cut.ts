"use client";

// WHETHER A ONE-LINE PLACE CUTS ITS TEXT — the question a full-name heading
// waits on (TagPage.md: the tag's whole name stands under the header only
// "GIVEN the name is too long for the header's one line"). A character count
// cannot answer it: the line's width is the reader's screen, the font's
// metrics and their text size. The browser can: a box that keeps its text on
// one line with `overflow: hidden` keeps its own width, and the text it cut is
// what its scroll width carries past that (MDN, `Element.scrollWidth`: the
// width of the content "including content not visible on the screen due to
// overflow"; `Element.clientWidth`: the inner width).
//
// THE READING FOLLOWS THE BOX AND THE FONT (MDN, `ResizeObserver`;
// `FontFaceSet.ready`): a rotation, a wider window or the web font arriving
// can cut a title that fitted, or fit one that was cut.
//
// MEASURED BEFORE THE PAINT (`useMeasureEffect`): the first frame that shows
// the title already shows the answer, so a name that fits never flashes a
// heading and a name that does not never paints without one.

import { useCallback, useState } from "react";

import { useMeasureEffect } from "./measure-effect";

/**
 * Whether a one-line box cuts any of its text.
 *
 * The two widths are whole pixels (MDN, `Element.scrollWidth`: "this property
 * will round the value to an integer"), so a text a fraction of a pixel too
 * wide reads as fitting while the browser already draws its "…" — measured on
 * this lane at 412 px: an 18-character tag 332.125 px wide in a 332 px title,
 * both widths 332. So an equal pair is settled on the fractional widths MDN
 * points to (`Element.getBoundingClientRect`), the text's own laid-out width
 * taken from a range over the box's contents (MDN, `Range.getBoundingClientRect`;
 * the cut is paint only, so the range spans the whole text).
 */
export function cutsLine(element: HTMLElement): boolean {
  if (element.scrollWidth > element.clientWidth) return true;
  const range = element.ownerDocument.createRange();
  if (typeof range.getBoundingClientRect !== "function") return false;
  range.selectNodeContents(element);
  const text = range.getBoundingClientRect().width;
  const style = getComputedStyle(element);
  const inset =
    parseFloat(style.paddingLeft) +
    parseFloat(style.paddingRight) +
    parseFloat(style.borderLeftWidth) +
    parseFloat(style.borderRightWidth);
  const room = element.getBoundingClientRect().width - (Number.isNaN(inset) ? 0 : inset);
  // a hundredth of a pixel is float noise; anything past it is drawn cut
  return text - room > 0.01;
}

/**
 * The cut of one one-line text, as `[holdLine, cut]`: hand `holdLine` to the
 * `ref` of the element that keeps the line, and `cut` says whether it cuts.
 * `content` is what the element shows, so new words are measured afresh.
 */
export function useLineCut(content: string | null): [holdLine: (element: HTMLElement | null) => void, cut: boolean] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [cut, setCut] = useState(false);
  const holdLine = useCallback((next: HTMLElement | null) => setElement(next), []);

  useMeasureEffect(() => {
    if (element === null) {
      setCut(false);
      return;
    }
    const measure = () => setCut(cutsLine(element));
    measure();
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });
    if (typeof ResizeObserver === "undefined") {
      return () => {
        live = false;
      };
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [content, element]);

  return [holdLine, cut];
}
