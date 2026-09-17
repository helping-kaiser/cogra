// The two pieces of the media platform jsdom does not implement, filled in so
// the video surface can be tested at all.
//
// Both stubs are DELIBERATELY INERT AND DRIVEN BY THE TEST rather than
// simulated. jsdom reports every element as 0x0 and runs no layout, so a real
// IntersectionObserver would have nothing to observe and would report nothing;
// pretending otherwise would produce a test that passes for reasons unrelated
// to the browser. Instead the observer records who is watching what, and
// `intersect()` is what a test calls to say "this scrolled into view" — the
// event the component actually reacts to.
//
// jsdom also ships HTMLMediaElement without playback (jsdom#2155): `play()`
// throws "Not implemented". It is filled in as a promise plus a `paused` flag,
// which is the whole of the contract this app's player reads.

type StubEntry = {
  isIntersecting: boolean;
  intersectionRatio: number;
  target: Element;
};

class StubIntersectionObserver {
  static readonly live = new Set<StubIntersectionObserver>();

  readonly targets = new Set<Element>();

  constructor(
    readonly callback: (entries: StubEntry[], observer: StubIntersectionObserver) => void,
    readonly options?: IntersectionObserverInit,
  ) {
    StubIntersectionObserver.live.add(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    StubIntersectionObserver.live.delete(this);
  }

  takeRecords(): StubEntry[] {
    return [];
  }
}

/** Tell every live observer that what it watches just entered or left the view. */
export function intersect(isIntersecting: boolean): void {
  for (const observer of [...StubIntersectionObserver.live]) {
    const entries = [...observer.targets].map((target) => ({
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      target,
    }));
    if (entries.length > 0) observer.callback(entries, observer);
  }
}

/** The threshold the component asked for, so a test can assert the contract. */
export function observedThresholds(): readonly unknown[] {
  return [...StubIntersectionObserver.live].map((observer) => observer.options?.threshold);
}

export function installMediaEnvironment(): void {
  if (typeof globalThis.IntersectionObserver === "undefined") {
    globalThis.IntersectionObserver =
      StubIntersectionObserver as unknown as typeof IntersectionObserver;
  }

  if (typeof HTMLMediaElement !== "undefined") {
    const media = HTMLMediaElement.prototype as HTMLMediaElement & { _paused?: boolean };
    Object.defineProperty(media, "paused", {
      configurable: true,
      get(this: HTMLMediaElement & { _paused?: boolean }) {
        return this._paused ?? true;
      },
    });
    media.play = function (this: HTMLMediaElement & { _paused?: boolean; _ended?: boolean }) {
      this._paused = false;
      // A real element clears `ended` the moment playback (re)starts — the
      // player's own replay press relies on this to read `video.ended` as
      // true only up to that call (`video-player.tsx`, the play() algorithm).
      this._ended = false;
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    media.pause = function (this: HTMLMediaElement & { _paused?: boolean }) {
      this._paused = true;
      this.dispatchEvent(new Event("pause"));
    };
    media.load = function () {};

    Object.defineProperty(media, "ended", {
      configurable: true,
      get(this: HTMLMediaElement & { _ended?: boolean }) {
        return this._ended ?? false;
      },
    });

    // THE CLOCK, which jsdom also leaves out: `duration` answers NaN and
    // `currentTime` never moves, so a transport driven by either would be
    // testing the stub's silence rather than the component. Both are filled in
    // as plain state that fires the events a browser fires — `timeupdate` on a
    // seek, `durationchange` when the length lands — which is exactly the
    // contract the player reads.
    Object.defineProperty(media, "duration", {
      configurable: true,
      get(this: HTMLMediaElement & { _duration?: number }) {
        return this._duration ?? NaN;
      },
    });
    Object.defineProperty(media, "currentTime", {
      configurable: true,
      get(this: HTMLMediaElement & { _currentTime?: number }) {
        return this._currentTime ?? 0;
      },
      set(this: HTMLMediaElement & { _currentTime?: number }, seconds: number) {
        this._currentTime = seconds;
        this.dispatchEvent(new Event("timeupdate"));
      },
    });
  }
}

/** The metadata landing: what a browser reports once it has read the file. */
export function statesDuration(video: HTMLMediaElement, seconds: number): void {
  (video as HTMLMediaElement & { _duration?: number })._duration = seconds;
  video.dispatchEvent(new Event("durationchange"));
}

/** The clip running out: a real element sets `ended` before it fires the
 * event, and the transport's replay press reads that flag back
 * (`video-player.tsx`, "PLAY AT THE END IS REPLAY"). */
export function endsClip(video: HTMLMediaElement): void {
  (video as HTMLMediaElement & { _ended?: boolean })._ended = true;
  video.dispatchEvent(new Event("ended"));
}
