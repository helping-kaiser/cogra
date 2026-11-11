// A STAND-IN LAYOUT FOR LINE CLAMPS. jsdom lays nothing out — every height is
// 0 — so a clamp it is handed never cuts anything and a measured `More` would
// never show. This fakes the two heights `clamp-fold.ts` reads, from the text
// and the clamp class alone: the text runs `charsPerLine` characters to a line
// of `LINE` pixels, and a `line-clamp-N` / `line-clamp-[N]` box stands N lines
// tall at most. Whether the browser's own clamp cuts the same paragraph at the
// same place is a layout claim only a browser confirms.
//
// `resize` changes the line width and fires every observed ResizeObserver, as
// a rotation or a wider window does.

import { act } from "@testing-library/react";

const LINE = 20;

function clampOf(element: Element): number | null {
  const match = /(?:^|\s)line-clamp-(?:\[(\d+)\]|(\d+))(?:\s|$)/.exec(element.className);
  if (match === null) return null;
  return Number(match[1] ?? match[2]);
}

export function fakeClampLayout(initialCharsPerLine: number) {
  let charsPerLine = initialCharsPerLine;
  const lines = (element: Element) => Math.ceil((element.textContent ?? "").length / charsPerLine);
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return lines(this) * LINE;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      const clamp = clampOf(this);
      return Math.min(lines(this), clamp ?? Infinity) * LINE;
    },
  });

  const observers = new Set<{ callback: ResizeObserverCallback; self: ResizeObserver }>();
  const NativeResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    private entry: { callback: ResizeObserverCallback; self: ResizeObserver };
    constructor(callback: ResizeObserverCallback) {
      this.entry = { callback, self: this as unknown as ResizeObserver };
    }
    observe() {
      observers.add(this.entry);
    }
    unobserve() {}
    disconnect() {
      observers.delete(this.entry);
    }
  } as unknown as typeof ResizeObserver;

  return {
    resize(next: number) {
      charsPerLine = next;
      act(() => {
        for (const { callback, self } of observers) callback([], self);
      });
    },
    restore() {
      // jsdom keeps both heights on `Element.prototype`; the fakes shadow
      // them on `HTMLElement.prototype`, so dropping the shadows restores them.
      delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
      delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
      globalThis.ResizeObserver = NativeResizeObserver;
    },
  };
}
