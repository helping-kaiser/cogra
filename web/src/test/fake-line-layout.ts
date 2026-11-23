// A STAND-IN LAYOUT FOR ONE-LINE PLACES. jsdom lays nothing out — every width
// is 0 — so a one-line title it is handed never cuts and `useLineCut` always
// answers "fits". This fakes the two widths `line-cut.ts` reads, for the boxes
// that keep one line (`truncate`): the text runs `CHAR` pixels a character, the
// box is `width` pixels wide. Whether the browser cuts the same name at the
// same width is a layout claim only a browser confirms (the lane's headless
// sweep, the conformance harness).
//
// `resize` changes the box's width and fires every observed ResizeObserver, as
// a rotation or a wider window does. The observer it installs extends the one
// in place, so it stacks on `fakeClampLayout` and restores in either order.

import { act } from "@testing-library/react";

/** A title-large character's stand-in width. */
export const CHAR = 11;

const keepsOneLine = (element: HTMLElement) => element.classList.contains("truncate");

export function fakeLineLayout(initialWidth: number) {
  let width = initialWidth;
  Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return keepsOneLine(this) ? Math.ceil((this.textContent ?? "").length * CHAR) : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return keepsOneLine(this) ? width : 0;
    },
  });

  const observers = new Set<{ callback: ResizeObserverCallback; self: ResizeObserver }>();
  const Previous = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class extends Previous {
    private readonly entry: { callback: ResizeObserverCallback; self: ResizeObserver };
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      this.entry = { callback, self: this };
    }
    observe(target: Element, options?: ResizeObserverOptions) {
      observers.add(this.entry);
      super.observe(target, options);
    }
    disconnect() {
      observers.delete(this.entry);
      super.disconnect();
    }
  };

  return {
    resize(next: number) {
      width = next;
      act(() => {
        for (const { callback, self } of observers) callback([], self);
      });
    },
    restore() {
      delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth;
      delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
      globalThis.ResizeObserver = Previous;
    },
  };
}
