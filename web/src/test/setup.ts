import "@testing-library/jest-dom/vitest";
// jsdom ships no IndexedDB; the identity store needs one wherever the
// registration runtime mounts.
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

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
