"use client";

// ONE SCROLL SURFACE'S STAGE — the engine a `StageHost` runs (tmp_dev packet
// `web-stage-law.md` §3.2 rules 1–4, 2a, 6–11, 14). Android's `ScrollStage`
// (`android/core/designsystem/.../v2/media/ScrollStage.kt`), on the web.
//
// It measures, asks, and acts — nothing more:
//
// - MEASURES through ONE IntersectionObserver over every clip on the surface,
//   and records each batch's ratios before deciding anything. A real observer
//   reports every threshold crossing of one frame in a single callback, and
//   deciding per entry instead is exactly the "last one wins" the law forbids
//   (rule 3, W2).
// - ASKS the pure election (`stage-election.ts`) who holds the stage, in
//   document order, with the incumbent and the device's autoplay answer.
// - ACTS on the answer: the outgoing clip FREEZES — `pause()` on the
//   still-mounted element, never `load()`, never a swapped source — and the
//   incoming one starts with the reader's sound (`playback.ts`). The player
//   layer (`video-stage.ts`) is told on both sides, so one clip plays across
//   surfaces too (rule 15).
//
// What stands OVER the surface is not a clause of the election but the
// absence of one: a sheet or a dialog SUSPENDS the stage (no holder at all,
// Feed.md:31/33), the opinion pad PAUSES the playing clip without changing
// hands (Feed.md:39/41), and a hidden page pauses it until the page shows
// again (Feed.md:51–55). While any of the three stands, the stage decides
// nothing; each one's lifting is its own rule below.
//
// Framework-free on purpose: the React side (`stage-host.tsx`) only feeds it
// what the platform says and hands it the players' elements.

import { GATE, documentOrder, elect, type StagePlace } from "./stage-election";
import { startPlayback } from "./playback";
import { claim, surrender } from "./video-stage";
import type { SurfaceCover } from "../covering-layer";

/** A clip on the surface: its element, and where it stood at the last batch. */
type Place = StagePlace & { readonly video: HTMLVideoElement };

/** What the observer is asked to report: leaving the screen, and the gate. */
const THRESHOLDS = [0, GATE];

export class Stage {
  private readonly places = new Map<object, Place>();
  private readonly keys = new Map<Element, object>();
  private observer: IntersectionObserver | null = null;
  private holder: object | null = null;

  private cover: SurfaceCover = null;
  private visible: boolean;
  private allowed: boolean;

  /** The clip the opinion pad paused, which its closing resumes (rule 7a). */
  private padPaused: object | null = null;
  /** The clip that was playing when the page hid, which showing resumes (rule 11). */
  private hiddenPlaying: object | null = null;
  /**
   * A suspension lifted while the pad was still up: the decision from empty
   * it owes waits for the pad to close too.
   */
  private liftOwed = false;

  constructor({ visible, allowed }: { visible: boolean; allowed: boolean }) {
    this.visible = visible;
    this.allowed = allowed;
  }

  // ---- the clips ---------------------------------------------------------

  /** A clip joins the surface. It stands nowhere until the observer says. */
  register(key: object, video: HTMLVideoElement, veiled: boolean): void {
    this.places.set(key, {
      video,
      ratio: 0,
      veiled,
      handStarted: false,
      qualifiedSinceTap: false,
    });
    this.keys.set(video, key);
    this.observerFor()?.observe(video);
  }

  /**
   * A clip leaves the surface. If it held the stage, succession runs now
   * (rule 2: "unmounted" is one way of no longer qualifying).
   */
  unregister(key: object): void {
    const place = this.places.get(key);
    if (place === undefined) return;
    this.observer?.unobserve(place.video);
    this.keys.delete(place.video);
    if (this.padPaused === key) this.padPaused = null;
    if (this.hiddenPlaying === key) this.hiddenPlaying = null;
    if (this.holder === key) {
      this.freeze(key);
      this.holder = null;
      this.places.delete(key);
      this.decide();
      return;
    }
    this.places.delete(key);
  }

  /**
   * The clip's veil came down or went up. A veil on the incumbent hands the
   * stage on (Feed.md:43); an unveil is an ELIGIBILITY change, not a
   * suspension lift — nothing changes while an incumbent still qualifies
   * (Feed.md:47), and only an empty stage takes the clip, by rule 3
   * (Feed.md:49).
   */
  setVeiled(key: object, veiled: boolean): void {
    const place = this.places.get(key);
    if (place === undefined || place.veiled === veiled) return;
    place.veiled = veiled;
    this.decide();
  }

  /** One observer batch: every ratio first, then one decision (rule 3). */
  measure(entries: readonly { target: Element; intersectionRatio: number }[]): void {
    for (const entry of entries) {
      const key = this.keys.get(entry.target);
      const place = key === undefined ? undefined : this.places.get(key);
      if (place === undefined) continue;
      place.ratio = entry.intersectionRatio;
      // A clip the reader started below the gate holds while any of it is on
      // screen — until it first reaches the gate, after which it is an
      // ordinary hand-started incumbent (Feed.md:25/27, FeedCover.md:29).
      if (place.handStarted && place.ratio >= GATE) place.qualifiedSinceTap = true;
    }
    this.decide();
  }

  // ---- what the reader does ---------------------------------------------

  /**
   * The reader starts this clip by hand — its play disc, or the transport's
   * play. It plays where it stands and becomes the incumbent (FeedCover.md:27,
   * ReplyMedia.md:13), deposing whoever held the stage; resumed, it plays on
   * from the frame it reached, since nothing here seeks.
   */
  handStart(key: object): void {
    const place = this.places.get(key);
    if (place === undefined) return;
    if (this.holder !== null && this.holder !== key) this.freeze(this.holder);
    this.holder = key;
    place.handStarted = true;
    place.qualifiedSinceTap = place.ratio >= GATE;
    this.padPaused = null;
    this.hiddenPlaying = null;
    this.start(key);
  }

  /**
   * The clip takes the stage STANDING STILL — a presentation carrying on a
   * clip the reader had paused elsewhere (the fullscreen viewer and the pinned
   * clip it hands back to: "the viewer's play state carries … paused returns
   * paused", PostDetailVideo.md:51). It holds the stage as a clip started by
   * hand does, so no election starts it on its own; the reader's play is what
   * starts it, from the frame it stands on.
   */
  seat(key: object): void {
    const place = this.places.get(key);
    if (place === undefined) return;
    if (this.holder !== null && this.holder !== key) this.freeze(this.holder);
    this.holder = key;
    place.handStarted = true;
    place.qualifiedSinceTap = place.ratio >= GATE;
    this.padPaused = null;
    this.hiddenPlaying = null;
    if (!place.video.paused) place.video.pause();
  }

  /**
   * The surface's scroll came to rest at its hard top (Feed.md:19/21,
   * ReplyEntry.md:3/5, TagPage.md:25/27, ProfilePosts.md:7/9, History.md:69/71).
   * The election lapses an autoplayed incumbent's claim there, never a
   * hand-started one's, and under suppression does nothing (FeedCover.md:31).
   */
  land(): void {
    this.decide(true);
  }

  // ---- what stands over the surface -------------------------------------

  /** What covers the surface changed (`covering-layer.tsx`). */
  setCover(next: SurfaceCover): void {
    const prev = this.cover;
    if (prev === next) return;
    this.cover = next;

    if (next === "suspended") {
      // "WHEN a sheet or a dialog opens over the feed -> the incumbent stops"
      // (Feed.md:31), and while it stands "no clip on the feed plays"
      // (Feed.md:33): the stage holds nobody.
      if (this.holder !== null) this.freeze(this.holder);
      this.holder = null;
      this.padPaused = null;
      this.hiddenPlaying = null;
      this.liftOwed = true;
      return;
    }

    if (next === "paused") {
      // "WHEN the opinion pad opens over the feed -> the playing clip pauses on
      // the frame it reached AND NEVER the stage changes hands" (Feed.md:39).
      if (prev === null && this.holder !== null) {
        const video = this.places.get(this.holder)?.video;
        if (video !== undefined && !video.paused) {
          video.pause();
          this.padPaused = this.holder;
        }
      }
      return;
    }

    // Nothing covers the surface any more.
    if (prev === "paused" && !this.liftOwed) {
      // "WHEN the opinion pad over the feed closes GIVEN it paused a clip,
      // under suppressed autoplay included -> that same clip resumes from the
      // frame it reached AND NEVER the stage re-elects" (Feed.md:41). A pad
      // that paused nothing starts nothing.
      const resume = this.padPaused;
      this.padPaused = null;
      if (resume !== null && resume === this.holder && this.visible) this.start(resume);
      return;
    }
    // The suspension lifted. "WHEN the sheet or the dialog over the feed
    // dismisses GIVEN a clip qualifies and the device allows autoplay -> the
    // topmost qualifying clip takes the stage" (Feed.md:35) — decided from
    // empty, never handed back to the old incumbent; suppressed, "NEVER a clip
    // plays AND a clip the reader had started by its play disc stands on the
    // frame it reached, wearing its play disc again" (Feed.md:37).
    this.liftOwed = false;
    this.decide();
  }

  /** The page was hidden or shown (Page Visibility API, `page-visibility.ts`). */
  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;

    if (!visible) {
      // "WHEN the page is hidden … -> the playing clip pauses on the frame it
      // reached" (Feed.md:51). It keeps the stage: nothing was decided.
      if (this.holder === null) return;
      const video = this.places.get(this.holder)?.video;
      if (video !== undefined && !video.paused) {
        video.pause();
        this.hiddenPlaying = this.holder;
      }
      return;
    }

    const was = this.hiddenPlaying;
    this.hiddenPlaying = null;
    if (was === null || was !== this.holder || this.cover !== null) return;
    if (this.allowed) {
      // "-> that clip resumes from the frame it reached AND NEVER the stage
      // re-elects" (Feed.md:53).
      this.start(was);
    } else {
      // "GIVEN the device suppresses autoplay -> NEVER a clip plays AND the
      // clip that was playing stands frozen on the frame it reached, wearing
      // its play disc" (Feed.md:55).
      this.freeze(was);
      this.holder = null;
    }
  }

  /**
   * Whether the device allows autoplay (FeedCover.md:23). Allowing again is
   * the standing rule 3 applying once more: an empty stage goes to the
   * topmost qualifying clip. Suppressing stops nothing already playing — "no
   * clip STARTS on its own" (FeedCover.md:25) is a rule about starts, ruled so
   * by jakob 2026-10-09 (seam 109, item 96): a mid-play suppression flip never
   * stops a playing clip.
   */
  setAllowed(allowed: boolean): void {
    if (this.allowed === allowed) return;
    this.allowed = allowed;
    if (allowed) this.decide();
  }

  /** The host is going: nothing keeps watching, nothing keeps playing. */
  dispose(): void {
    if (this.holder !== null) this.freeze(this.holder);
    this.holder = null;
    this.observer?.disconnect();
    this.observer = null;
    this.places.clear();
    this.keys.clear();
    this.padPaused = null;
    this.hiddenPlaying = null;
    this.liftOwed = false;
  }

  // ---- the machinery -----------------------------------------------------

  /** The surface's one observer — none where the platform has none, and so no autoplay. */
  private observerFor(): IntersectionObserver | null {
    if (typeof IntersectionObserver === "undefined") return null;
    if (this.observer === null) {
      // The viewport is the root: a clip inside a scrolling sheet body is
      // clipped by it on the way up, which is the "on screen" the law means.
      this.observer = new IntersectionObserver((entries) => this.measure(entries), {
        threshold: THRESHOLDS,
      });
    }
    return this.observer;
  }

  /** Who holds the stage now — decided only while nothing stands over it. */
  private decide(landedAtHardTop = false): void {
    if (this.cover !== null || !this.visible) return;
    const ordered = [...this.places.entries()]
      .sort(([, a], [, b]) => documentOrder(a.video, b.video))
      .map(([key, place]) => ({ key, place }));
    const next = elect({
      incumbent: this.holder,
      places: ordered,
      landedAtHardTop,
      autoplayAllowed: this.allowed,
    });
    if (next === this.holder) return;
    if (this.holder !== null) this.freeze(this.holder);
    this.holder = next;
    if (next !== null) this.start(next);
  }

  /** The clip takes the stage: the player layer first, then the start. */
  private start(key: object): void {
    const video = this.places.get(key)?.video;
    if (video === undefined) return;
    claim(key, video);
    startPlayback(
      video,
      () => this.holder === key && this.cover === null && this.visible,
    );
  }

  /**
   * The clip loses the stage: it freezes on the frame it reached, and forgets
   * it was started by hand — a clip off the stage is no one's incumbent, and
   * under suppression it wears its play disc again.
   */
  private freeze(key: object): void {
    const place = this.places.get(key);
    surrender(key);
    if (place === undefined) return;
    place.handStarted = false;
    place.qualifiedSinceTap = false;
    if (!place.video.paused) place.video.pause();
  }
}
