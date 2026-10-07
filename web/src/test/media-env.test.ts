// The test environment's own contract (`media-env.ts`). Every stage-law suite
// stands on these stubs, so what each one promises is pinned here once rather
// than trusted in every suite that drives it.

import { describe, expect, it, vi } from "vitest";

import {
  intersect,
  intersectEach,
  liveObserverCount,
  pullsAtTop,
  refusesPlay,
  resetMediaEnvironmentForTests,
  scrollsTo,
  setsPageVisibility,
  settlesScroll,
} from "./media-env";

type Entry = { target: Element; intersectionRatio: number; isIntersecting: boolean };

function watch(...targets: Element[]) {
  const calls: Entry[][] = [];
  const observer = new IntersectionObserver((entries) => {
    calls.push(entries.map(({ target, intersectionRatio, isIntersecting }) => ({
      target,
      intersectionRatio,
      isIntersecting,
    })));
  });
  for (const target of targets) observer.observe(target);
  return { observer, calls };
}

describe("the observer stub", () => {
  it("keeps `intersect` all-or-nothing: every target, ratio 1 or 0", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    const { observer, calls } = watch(a, b);

    intersect(true);
    expect(calls).toEqual([
      [
        { target: a, intersectionRatio: 1, isIntersecting: true },
        { target: b, intersectionRatio: 1, isIntersecting: true },
      ],
    ]);
    intersect(false);
    expect(calls[1]?.map((entry) => entry.intersectionRatio)).toEqual([0, 0]);
    observer.disconnect();
  });

  it("delivers one batched callback per observer, carrying only its own targets", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    const elsewhere = document.createElement("div");
    const first = watch(a, b);
    const second = watch(elsewhere);

    intersectEach([
      { target: a, ratio: 0.8 },
      { target: b, ratio: 0.3 },
    ]);

    expect(first.calls).toEqual([
      [
        { target: a, intersectionRatio: 0.8, isIntersecting: true },
        { target: b, intersectionRatio: 0.3, isIntersecting: true },
      ],
    ]);
    // An observer watching none of the targets hears nothing.
    expect(second.calls).toEqual([]);
    first.observer.disconnect();
    second.observer.disconnect();
  });

  it("lets `isIntersecting` disagree with the gate, the way a browser's does", () => {
    const a = document.createElement("div");
    const { observer, calls } = watch(a);

    intersectEach([{ target: a, ratio: 0.69, isIntersecting: true }]);
    intersectEach([{ target: a, ratio: 0 }]);

    expect(calls[0]?.[0]).toMatchObject({ intersectionRatio: 0.69, isIntersecting: true });
    expect(calls[1]?.[0]).toMatchObject({ intersectionRatio: 0, isIntersecting: false });
    observer.disconnect();
  });

  it("counts the observers still connected", () => {
    const before = liveObserverCount();
    const { observer } = watch(document.createElement("div"));
    expect(liveObserverCount()).toBe(before + 1);
    observer.disconnect();
    expect(liveObserverCount()).toBe(before);
  });
});

describe("the scroller helpers", () => {
  it("moves the scroller and fires `scroll`", () => {
    const scroller = document.createElement("div");
    const onScroll = vi.fn(() => scroller.scrollTop);
    scroller.addEventListener("scroll", onScroll);

    scrollsTo(scroller, 240);

    expect(scroller.scrollTop).toBe(240);
    expect(onScroll).toHaveReturnedWith(240);
  });

  it("fires `scrollend` for a settle", () => {
    const scroller = document.createElement("div");
    const onEnd = vi.fn();
    scroller.addEventListener("scrollend", onEnd);

    settlesScroll(scroller);

    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("pulls as a touch stream: down at the start, moved by the travel, lifted there", () => {
    const scroller = document.createElement("div");
    const seen: string[] = [];
    for (const type of ["touchstart", "touchmove", "touchend"]) {
      scroller.addEventListener(type, (event) => {
        seen.push(`${type}@${(event as TouchEvent).touches[0]?.clientY}`);
      });
    }

    pullsAtTop(scroller, 80);

    expect(seen).toEqual(["touchstart@100", "touchmove@180", "touchend@180"]);
  });
});

describe("the page's visibility", () => {
  it("flips the document's state and fires `visibilitychange`", () => {
    const states: string[] = [];
    const onChange = () => states.push(`${document.visibilityState}/${document.hidden}`);
    document.addEventListener("visibilitychange", onChange);

    setsPageVisibility("hidden");
    setsPageVisibility("visible");

    expect(states).toEqual(["hidden/true", "visible/false"]);
    document.removeEventListener("visibilitychange", onChange);
  });

  it("is put back after the test, so no suite inherits a hidden page", () => {
    const own = () => Object.getOwnPropertyNames(document).includes("visibilityState");
    setsPageVisibility("hidden");
    expect(own()).toBe(true);
    resetMediaEnvironmentForTests();
    expect(own()).toBe(false);
  });
});

describe("the media element", () => {
  it("plays by default, as before", async () => {
    const video = document.createElement("video");
    video.muted = false;
    await video.play();
    expect(video.paused).toBe(false);
  });

  it("refuses unmuted playback with NotAllowedError, leaving the clip as it was", async () => {
    refusesPlay("unmuted");
    const video = document.createElement("video");
    const onPlay = vi.fn();
    video.addEventListener("play", onPlay);

    video.muted = false;
    await expect(video.play()).rejects.toMatchObject({ name: "NotAllowedError" });
    expect(video.paused).toBe(true);
    expect(onPlay).not.toHaveBeenCalled();

    // Muted playback is always allowed.
    video.muted = true;
    await video.play();
    expect(video.paused).toBe(false);
  });

  it("can refuse every play", async () => {
    refusesPlay("always");
    const video = document.createElement("video");
    video.muted = true;
    await expect(video.play()).rejects.toMatchObject({ name: "NotAllowedError" });
  });

  it("goes back to allowing playback after the test", async () => {
    refusesPlay("always");
    resetMediaEnvironmentForTests();
    const video = document.createElement("video");
    await video.play();
    expect(video.paused).toBe(false);
  });

  it("keeps each clip's own clock through a pause", () => {
    const one = document.createElement("video");
    const two = document.createElement("video");

    one.currentTime = 4.5;
    one.pause();
    two.currentTime = 9;

    expect(one.currentTime).toBe(4.5);
    expect(two.currentTime).toBe(9);
  });
});
