// The one piece of `captureFrames` provable without a real decoder: that it
// no longer hangs forever when the browser never fires `loadeddata` or
// `error` at all — which is jsdom's own baseline, since it implements no
// media pipeline (see `video.test.ts`'s own note on that gap). What actually
// happens once a real clip decodes is still exercised by hand; this only
// proves the deadline that used to be entirely missing now exists.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureFrames } from "./video";

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(URL, "createObjectURL", {
    value: () => "blob:capture",
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => {}, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("captureFrames", () => {
  it("gives up rather than hanging when the browser never fires loadeddata or error", async () => {
    const file = new Blob([new Uint8Array([1, 2, 3])], { type: "video/mp4" });
    const settled = expect(captureFrames(file)).rejects.toThrow(
      "this browser couldn't read that video",
    );
    // jsdom fires neither event on its own — exactly the condition that used
    // to hang this promise forever before it carried a deadline at all.
    await vi.advanceTimersByTimeAsync(8_100);
    await settled;
  });
});
