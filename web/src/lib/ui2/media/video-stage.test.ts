// FE-28: one clip plays at a time. These pin the arbitration semantics
// mirrored from VideoStage.kt — the newest claimant wins, and a stale
// surrender can never steal the stage back from whoever replaced it —
// without any player-instance pooling, which has no web analog (see
// video-stage.ts).

import { afterEach, describe, expect, it, vi } from "vitest";

import { claim, resetVideoStageForTests, surrender } from "./video-stage";

afterEach(() => resetVideoStageForTests());

/**
 * The slice of `HTMLVideoElement` video-stage actually reads and calls.
 * `paused` is read-only on the real DOM type, so a test that flips it by
 * hand (simulating a video already paused before a claim) needs a type
 * that says so honestly, rather than fighting the real type.
 */
interface StageVideo {
  paused: boolean;
  pause(): void;
}

function fakeVideo(): HTMLVideoElement {
  const video: StageVideo = {
    paused: false,
    pause: vi.fn(function (this: StageVideo) {
      this.paused = true;
    }),
  };
  return video as unknown as HTMLVideoElement;
}

/** Set up a fake as already paused — `fakeVideo()`'s return type is the real
 * `HTMLVideoElement` (what `claim`/`surrender` take), so flipping `paused`
 * by hand goes through the narrow, honestly-mutable view instead. */
function markPaused(video: HTMLVideoElement): void {
  (video as unknown as StageVideo).paused = true;
}

describe("claim", () => {
  it("pauses the previous owner when a different token claims the stage", () => {
    const tokenA = {};
    const tokenB = {};
    const videoA = fakeVideo();
    const videoB = fakeVideo();

    claim(tokenA, videoA);
    expect(videoA.pause).not.toHaveBeenCalled();

    claim(tokenB, videoB);
    expect(videoA.pause).toHaveBeenCalledOnce();
    expect(videoB.pause).not.toHaveBeenCalled();
  });

  it("does not pause an already-paused previous owner", () => {
    const tokenA = {};
    const videoA = fakeVideo();
    markPaused(videoA);

    claim(tokenA, videoA);
    claim({}, fakeVideo());
    expect(videoA.pause).not.toHaveBeenCalled();
  });

  it("re-claiming with the same token is a no-op, not a self-pause", () => {
    const token = {};
    const video = fakeVideo();

    claim(token, video);
    claim(token, video);
    expect(video.pause).not.toHaveBeenCalled();
  });
});

describe("surrender", () => {
  it("clears ownership when the surrendering token still holds the stage", () => {
    const token = {};
    const video = fakeVideo();
    claim(token, video);

    surrender(token);
    // A fresh claim from a new token must not pause anything — the stage was
    // already empty, so there was nothing playing to interrupt.
    const other = fakeVideo();
    claim({}, other);
    expect(video.pause).not.toHaveBeenCalled();
  });

  it("a stale surrender cannot steal the stage back from whoever replaced it", () => {
    // Mirrors VideoStage.surrender's guard: a departing surface must not pull
    // the stage out from under the one that already claimed it after.
    const tokenA = {};
    const tokenB = {};
    const videoA = fakeVideo();
    const videoB = fakeVideo();

    claim(tokenA, videoA);
    claim(tokenB, videoB); // B has already replaced A on the stage.
    surrender(tokenA); // A's own cleanup runs after — must be a no-op.

    // The stage still belongs to B: a third claimant pauses B, not nothing.
    const videoC = fakeVideo();
    claim({}, videoC);
    expect(videoB.pause).toHaveBeenCalledOnce();
  });
});
