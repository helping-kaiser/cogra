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
 * The visual viewport's height and offset are in visual (zoomed) pixels, so
 * they are scaled back before they are compared: a pinch zoom shrinks
 * `height` by its scale without any keyboard, and must read 0. The offset
 * counts too: where the browser has already panned the visual viewport to
 * show a field, the band it pans to is already in view and is not lifted a
 * second time. Rounded up, so a foot never sits a fraction under the edge.
 */
export function keyboardInset(layoutHeight: number, viewport: ViewportReading): number {
  const visibleBottom = (viewport.offsetTop + viewport.height) * viewport.scale;
  return Math.max(0, Math.ceil(layoutHeight - visibleBottom));
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
