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
//
// THE STAGE LAW NEEDS MORE OF THE BROWSER THAN "IN VIEW OR NOT", so the same
// inert-and-driven stance extends to the rest of what the law reads
// (tmp_dev packet `web-stage-law.md` §5 RF-1):
//
// - `intersectEach` delivers ONE batched callback per observer with a
//   per-target `intersectionRatio` — a real observer reports every threshold
//   crossing of one frame in a single callback, and electing per entry instead
//   of per batch is exactly the "last one wins" defect the law forbids.
// - the scroll helpers fire what a scroller fires (`scroll`, `scrollend`, the
//   touch stream of a pull at the top) on an element whose `scrollTop` jsdom
//   already stores;
// - `setsPageVisibility` flips `document.visibilityState` and fires
//   `visibilitychange`;
// - `refusesPlay` makes `play()` reject with `NotAllowedError`, the way a
//   browser refuses unmuted playback without a user gesture
//   (https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play);
// - `currentTime` is per-element state, so a clip keeps the frame it reached;
// - `suppressesAutoplay` stands in the device's reduced-motion and data-saver
//   requests, live.
//
// Everything a test changes here is put back by `resetMediaEnvironmentForTests`,
// which the shared setup runs after every test.

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

/** One target's place in a batched observer callback. */
export type Intersection = {
  target: Element;
  /** The fraction of the target on screen, 0..1. */
  ratio: number;
  /**
   * What the browser reports beside the ratio. Defaults to `ratio > 0`; given
   * explicitly, it can disagree with the gate — a frame 69% in view still
   * "intersects", which is why the gate must read the ratio, not this flag.
   */
  isIntersecting?: boolean;
};

/**
 * Deliver ONE callback per live observer, carrying an entry for every given
 * target that observer watches — the batch a real observer delivers for one
 * frame. Observers watching none of the targets are not called.
 */
export function intersectEach(places: readonly Intersection[]): void {
  for (const observer of [...StubIntersectionObserver.live]) {
    const entries = places
      .filter((place) => observer.targets.has(place.target))
      .map((place) => ({
        isIntersecting: place.isIntersecting ?? place.ratio > 0,
        intersectionRatio: place.ratio,
        target: place.target,
      }));
    if (entries.length > 0) observer.callback(entries, observer);
  }
}

/** The threshold the component asked for, so a test can assert the contract. */
export function observedThresholds(): readonly unknown[] {
  return [...StubIntersectionObserver.live].map((observer) => observer.options?.threshold);
}

/** How many observers are still connected — the teardown-hygiene probe. */
export function liveObserverCount(): number {
  return StubIntersectionObserver.live.size;
}

// ---- the scroller ---------------------------------------------------------

/** A touch event carrying one point at `clientY`, the shape the pull reads. */
export function touchEvent(type: string, clientY: number): Event {
  const event = new Event(type, { bubbles: true });
  const points = [{ clientY }];
  Object.defineProperty(event, "touches", { value: points });
  Object.defineProperty(event, "changedTouches", { value: points });
  return event;
}

/** The scroller moves to `top` and says so, the way a scroll gesture does. */
export function scrollsTo(scroller: HTMLElement, top: number): void {
  scroller.scrollTop = top;
  scroller.dispatchEvent(new Event("scroll"));
}

/**
 * The scroll comes to rest: `scrollend`, which a browser fires once a scroll
 * that MOVED something has finished (https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event)
 * — never for a gesture that moved nothing.
 */
export function settlesScroll(scroller: HTMLElement): void {
  scroller.dispatchEvent(new Event("scrollend"));
}

/**
 * A finger pulls down from `startY` by `travel` and lets go, on a scroller the
 * test has left at its top — the app's own pull gesture (`pull-to-refresh.ts`).
 */
export function pullsAtTop(scroller: HTMLElement, travel: number, startY = 100): void {
  scroller.dispatchEvent(touchEvent("touchstart", startY));
  scroller.dispatchEvent(touchEvent("touchmove", startY + travel));
  scroller.dispatchEvent(touchEvent("touchend", startY + travel));
}

// ---- the page's visibility ------------------------------------------------

/**
 * The page is hidden or shown — a backgrounded tab, a locked screen — and the
 * document says so the way a browser does: `visibilityState` and `hidden`
 * flip first, then `visibilitychange` fires on the document
 * (https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event).
 */
export function setsPageVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => state === "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
}

function resetPageVisibility(): void {
  // The overrides are own properties of the document; dropping them restores
  // jsdom's own prototype getters.
  delete (document as unknown as Record<string, unknown>).visibilityState;
  delete (document as unknown as Record<string, unknown>).hidden;
}

// ---- the browser's autoplay policy ----------------------------------------

/**
 * Which `play()` calls the browser refuses: none (the default), only those of
 * an unmuted element — the autoplay policy's own line, since muted playback is
 * always allowed (https://developer.chrome.com/blog/autoplay/) — or all.
 */
export type PlayPolicy = "never" | "unmuted" | "always";

let playPolicy: PlayPolicy = "never";

/** Set which `play()` calls reject with `NotAllowedError`. */
export function refusesPlay(policy: PlayPolicy): void {
  playPolicy = policy;
}

// ---- the device's autoplay suppression -------------------------------------

/** A preference the platform publishes, which fires `change` when it flips. */
class DevicePreference extends EventTarget {
  constructor(
    public matches: boolean,
    public saveData: boolean,
  ) {
    super();
  }
}

let device: { query: DevicePreference; link: DevicePreference } | null = null;

/**
 * The device asks for reduced motion and/or data saver — or stops asking — the
 * way the platform says it: `matchMedia("(prefers-reduced-motion: reduce)")`
 * and `navigator.connection.saveData`, each firing `change` when it flips
 * (FeedCover.md:23; https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/change_event,
 * https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/saveData).
 * jsdom ships neither, so the first call installs both — call it before
 * mounting, as `suppressesAutoplay({})` for a device that can ask but does
 * not yet, for a test that flips the request while the page is up.
 */
export function suppressesAutoplay({
  reducedMotion = false,
  saveData = false,
}: { reducedMotion?: boolean; saveData?: boolean }): void {
  if (device === null) {
    const query = new DevicePreference(false, false);
    const link = new DevicePreference(false, false);
    device = { query, link };
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (text: string) =>
        text === "(prefers-reduced-motion: reduce)" ? query : new DevicePreference(false, false),
    });
    Object.defineProperty(navigator, "connection", { configurable: true, value: link });
  }
  if (device.query.matches !== reducedMotion) {
    device.query.matches = reducedMotion;
    device.query.dispatchEvent(new Event("change"));
  }
  if (device.link.saveData !== saveData) {
    device.link.saveData = saveData;
    device.link.dispatchEvent(new Event("change"));
  }
}

function resetDevice(): void {
  if (device === null) return;
  device = null;
  delete (window as unknown as Record<string, unknown>).matchMedia;
  delete (navigator as unknown as Record<string, unknown>).connection;
}

/** Put back everything a test changed in the environment; run after every test. */
export function resetMediaEnvironmentForTests(): void {
  playPolicy = "never";
  if (typeof document !== "undefined") resetPageVisibility();
  if (typeof window !== "undefined") resetDevice();
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
      // A refused play leaves the element exactly as it was — still paused, no
      // `play` event — and rejects, which is what a caller has to handle.
      if (playPolicy === "always" || (playPolicy === "unmuted" && !this.muted)) {
        return Promise.reject(new DOMException("play() was refused", "NotAllowedError"));
      }
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
    // contract the player reads. The state lives ON THE ELEMENT, so each clip
    // keeps the frame it reached through a pause, independently of the rest.
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
