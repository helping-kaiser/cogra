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
    media.play = function (this: HTMLMediaElement & { _paused?: boolean }) {
      this._paused = false;
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    };
    media.pause = function (this: HTMLMediaElement & { _paused?: boolean }) {
      this._paused = true;
      this.dispatchEvent(new Event("pause"));
    };
    media.load = function () {};
  }
}
