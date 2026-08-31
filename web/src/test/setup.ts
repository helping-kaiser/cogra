import "@testing-library/jest-dom/vitest";
// jsdom ships no IndexedDB; the identity store needs one wherever the
// registration runtime mounts.
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom implements no Pointer Events (jsdom#2527), which the stance pad
// is built on — they are the platform's own unification of mouse, touch,
// and pen. MouseEvent already carries the coordinates and the bubbling
// the pad reads, so the constructor is filled in over it, and capture
// becomes a bookkeeping no-op: there is no second element to steal the
// events in a test.
if (typeof window !== "undefined" && window.PointerEvent === undefined) {
  class JsdomPointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? "mouse";
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  window.PointerEvent = JsdomPointerEvent as unknown as typeof PointerEvent;
}
if (typeof Element !== "undefined" && Element.prototype.setPointerCapture === undefined) {
  const captured = new WeakMap<Element, Set<number>>();
  Element.prototype.setPointerCapture = function (this: Element, pointerId: number) {
    const ids = captured.get(this) ?? new Set<number>();
    ids.add(pointerId);
    captured.set(this, ids);
  };
  Element.prototype.releasePointerCapture = function (this: Element, pointerId: number) {
    captured.get(this)?.delete(pointerId);
  };
  Element.prototype.hasPointerCapture = function (this: Element, pointerId: number) {
    return captured.get(this)?.has(pointerId) ?? false;
  };
}

// jsdom implements no ResizeObserver, which `react-easy-crop` observes its
// container with. jsdom also reports every element as 0x0, so a real
// implementation would have nothing to report: the stub is inert on purpose and
// the crop suite drives the cropper through its callbacks rather than through
// layout.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom ships HTMLDialogElement without its methods (jsdom#3294), so
// the native-<dialog> contract the join prompt relies on is filled in:
// showModal opens, close flips `open` and fires the close event.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (
    this: HTMLDialogElement,
    returnValue?: string,
  ) {
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
