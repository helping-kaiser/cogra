// THE ON-SCREEN KEYBOARD'S HEIGHT, AS ONE CSS VARIABLE.
//
// A pinned foot rides directly above the keyboard and the fields scroll in
// what is left (design → impl seam 381, on the placement law in
// design/readme.md, *Spacing and layout*: a stage or a sheet pins its footer
// "so a growing field never walks the commitment out of reach").
//
// WHY THE VISUAL VIEWPORT. Chrome for Android resizes only the visual viewport
// for the keyboard (`interactive-widget=resizes-visual`, its default since
// Chrome 108 — developer.chrome.com/blog/viewport-resize-behavior), so a fixed
// or `100dvh` box keeps its full height and its foot lies under the keyboard.
// Measured on Chrome 133 (Pixel 6 emulator): the visual viewport shrinks from
// 786 to 474 px and the comment editor's `Sign the edit` stood 296 px under
// the keyboard's edge. The two platform switches move too much:
// `resizes-content` shrinks the layout viewport for EVERY page, which lifted
// the bottom bar on Explore (722 → 410) and shrank the task pages; the
// VirtualKeyboard API's `overlaysContent` hands the whole app's occlusion to
// the page and exists only in Chromium. Reading the visual viewport (MDN
// "VisualViewport", widely available) and writing one variable moves only the
// geometry that reads it: the pinned layers, the pinned pages and the sheets.
//
// Without a keyboard the inset is 0 and nothing moves; a browser without
// `visualViewport` never writes the variable, and every reader falls back to
// `0px` — today's layout.

/** The custom property every pinned foot reads (`var(--keyboard-inset, 0px)`). */
export const KEYBOARD_INSET_VAR = "--keyboard-inset";

/** The slice of `VisualViewport` the inset is computed from. */
export type ViewportReading = Pick<VisualViewport, "height" | "offsetTop" | "scale">;

/**
 * How much of the layout viewport's bottom the keyboard covers, in CSS px.
 *
 * THE UNITS (CSSOM View, *The VisualViewport interface*; MDN
 * "VisualViewport.height"): `height` and `offsetTop` are doubles in CSS
 * pixels. A pinch zoom by `scale` shows `innerHeight / scale` CSS pixels, so
 * `height × scale` is the visible band measured back at the page's own
 * scale: `innerHeight` with no keyboard, `innerHeight` less the keyboard with
 * one. Without the multiplication a pinch zoom would read as a keyboard. The
 * offset is added so a band the browser has already panned into view (to
 * show a field) is not lifted a second time. KNOWN LIMIT: with the keyboard
 * up AND the page zoomed and panned, `offsetTop × scale` is not a layout
 * length; the inset then reads short or 0. A layout-fixed box is magnified
 * and panned with the page there anyway, so no inset could pin it to the
 * screen's keyboard edge.
 *
 * UNDER ONE PIXEL IS ROUNDING, NOT A KEYBOARD. `innerHeight` is an integer
 * (CSSOM View: `readonly attribute long innerHeight`); Chromium computes it
 * as the frame's device-pixel height divided by the zoom factor and ROUNDED
 * (`LocalDOMWindow::innerHeight` → `AdjustForAbsoluteZoom::AdjustInt` →
 * `RoundForImpreciseConversion`), so it can stand up to half a pixel above
 * the fractional visual height (measured: 786 against 786.29; elsewhere
 * 787 against 786.6). There is no fractional layout-viewport height to read
 * without reading layout, which the listener never does. So a gap under
 * 1 px reads 0 — no phantom strip under every pinned layer — and from 1 px
 * up it is rounded up, so a foot never sits a fraction under the edge.
 */
export function keyboardInset(layoutHeight: number, viewport: ViewportReading): number {
  const covered = layoutHeight - (viewport.offsetTop + viewport.height) * viewport.scale;
  return covered < 1 ? 0 : Math.ceil(covered);
}

/**
 * Keeps {@link KEYBOARD_INSET_VAR} on the document's root in step with the
 * visual viewport, and returns the function that stops it.
 *
 * `resize` and `scroll` can fire many times in a gesture (MDN), so they only
 * ask for a frame; the one write happens there, and only when the value
 * changed — no layout read-write interleaving per event.
 */
export function watchKeyboardInset(win: Window = window): () => void {
  const viewport = win.visualViewport;
  if (viewport === null || viewport === undefined) return () => {};
  const root = win.document.documentElement;
  let frame: number | null = null;
  let written: number | null = null;
  const write = () => {
    frame = null;
    const inset = keyboardInset(win.innerHeight, viewport);
    if (inset === written) return;
    written = inset;
    root.style.setProperty(KEYBOARD_INSET_VAR, `${inset}px`);
  };
  const queue = () => {
    if (frame === null) frame = win.requestAnimationFrame(write);
  };
  viewport.addEventListener("resize", queue);
  viewport.addEventListener("scroll", queue);
  queue();
  return () => {
    viewport.removeEventListener("resize", queue);
    viewport.removeEventListener("scroll", queue);
    if (frame !== null) win.cancelAnimationFrame(frame);
    root.style.removeProperty(KEYBOARD_INSET_VAR);
  };
}
