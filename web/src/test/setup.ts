import "@testing-library/jest-dom/vitest";
// jsdom ships no IndexedDB; the identity store needs one wherever the
// registration runtime mounts.
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import { resetSeenRecordForTests } from "@/lib/history/seen-record";
import { resetSeenSyncForTests } from "@/lib/history/seen-sync";
import { resetAnnouncerForTests } from "@/lib/release/newer-version-announcer";
import { resetClipMemoryForTests } from "@/lib/ui2/media/clip-memory";
import { resetElementPoolForTests } from "@/lib/ui2/media/video-stage";

import { installTestFetch } from "./fetch";
import { installMediaEnvironment, resetMediaEnvironmentForTests } from "./media-env";

afterEach(cleanup);

// jsdom implements neither IntersectionObserver nor media playback, and the
// video surface is built on both. What a test changes in that environment —
// the page's visibility, the autoplay policy — is put back after it.
installMediaEnvironment();
afterEach(resetMediaEnvironmentForTests);

// The reading session's clip memory is module state: a clip one test played
// would otherwise reach the next test's frame without its still. Cleared
// BEFORE each test rather than after, because the unmounting `cleanup` above
// is itself a writer — players record where they stood on the way out.
beforeEach(resetClipMemoryForTests);
// The same for the clips' parked elements (`video-stage.ts`): the players the
// unmounting `cleanup` takes down park theirs on the way out.
beforeEach(resetElementPoolForTests);
// The device's seen record is module state over its own IndexedDB store: a
// card one test saw would otherwise be cut from the next test's ranked feed.
// Each test gets a fresh record over a fresh store, and a page load that has
// synced no account yet.
beforeEach(() => {
  const store = new IDBFactory();
  resetSeenRecordForTests(() => store);
  resetSeenSyncForTests();
});
// The newer-version announcer's one read and one decision are per page load:
// each test is a fresh load.
beforeEach(resetAnnouncerForTests);

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

// Multipart under jsdom, and requests a test leaves in flight (fetch.ts).
installTestFetch();
