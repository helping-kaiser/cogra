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
// THE DETAIL CLIP'S STAGE IS A STAGE OF ITS OWN KIND (`detail`, the
// stage-law packet §3.2 rule 12, reworked by jakob's ruling 100 — design/
// readme.md §13, "The clip detail rulings"). It holds one clip, and the
// SCROLL DECIDES NOTHING ON IT: "the open is the deliberate act, so no share
// of the screen gates it on the detail" and "scroll governs starts, never
// stops … on the detail the open is the only start". So:
//
// - THE OPEN STARTS IT (`open`): "WHEN the detail opens GIVEN the clip stands
//   unveiled and the device allows autoplay -> the clip plays AND NEVER the
//   70% gate holds it back" (PostDetailVideo.md:7); "GIVEN the device
//   suppresses autoplay -> NEVER the clip starts on its own" (:9). A clip
//   carried in from the card plays on from the frame it reached (:53).
// - THE OBSERVER ELECTS NOTHING. It still reports where the frame stands —
//   `inView` asks it — but no ratio starts or stops the clip: scrolled out of
//   view it plays on (:11), scrolled back paused it stays paused (:13).
// - NOTHING ELSE STARTS IT ON ITS OWN: not autoplay coming back, not a
//   landing at a hard top (it has none). The unveil is the veiled clip's open
//   (PostDetailVideoSensitive.md:15/17).
//
// It freezes and honours the veil, the device and the page as a list does —
// "a sheet or a dialog opens over the post -> the clip stops where it is"
// (PostDetailVideo.md:41) — but it does not decide from empty when the layer
// lifts. It RESUMES: "GIVEN the clip was playing when it rose and the device
// allows autoplay -> the clip resumes where it stopped" (:43), "GIVEN the
// reader had paused the clip -> NEVER the clip resumes on its own" (:45),
// "GIVEN the device suppresses autoplay -> NEVER the clip starts on its own"
// (:47). A reader's pause on the transport keeps the stage (the clip stays the
// holder, standing still), so nothing later starts it (:21, "stops or starts
// where it is"). The opinion pad pauses and resumes it, under suppression too
// (:49/:51).
//
// What the layer's lifting resumes is only ever the clip IT stopped. An
// explicit hand-over — the fullscreen viewer carrying its play state back to
// the detail clip (PostDetailVideo.md:59/61) — seats or starts the clip by
// itself, and in doing so settles whatever the lifting owed: the explicit
// carry wins over the generic rule because it is the later, more particular
// word on the same clip, not because the generic rule knows about viewers.
//
// A STAGE ACTS ONLY ON THE ELEMENTS IT STILL HOLDS. A clip's live element
// moves between the clip's presentations (`video-stage.ts`, the element pool),
// and a surface the clip just left still has its place for a moment — its
// players leave in passive effects, its host disposes in one too. The element
// is the next presentation's by then, so freezing it on the way out would
// stop the very clip that carried on; a stage pauses and starts only what
// `holds` says is its own.
//
// A CLIP CAN ARRIVE PLAYING. A carried element that was playing keeps playing
// into its next presentation (`arrivePlaying`), and the surface it lands on
// has not measured it yet. Nothing is decided early: it plays on, holding the
// player layer, until the surface's first measurement of it — and if that
// election does not hand it the stage, it freezes on the frame it reached,
// exactly as a clip that loses the stage does. Whatever stands over the
// surface when it arrives freezes it at once.
//
// Framework-free on purpose: the React side (`stage-host.tsx`) only feeds it
// what the platform says and hands it the players' elements.

import { GATE, documentOrder, elect, type StagePlace } from "./stage-election";
import { startPlayback } from "./playback";
import { claim, holds, surrender } from "./video-stage";
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

  /**
   * The detail clip's stage: the open starts it, the scroll decides nothing,
   * and a covering layer's lifting resumes (see the note at the top).
   */
  private readonly detail: boolean;
  /** Whether the detail's open has been answered — it is the only start. */
  private opened = false;
  /** The clip a covering layer stopped while it played, which the lifting may resume. */
  private coverStopped: object | null = null;
  /**
   * Whether a sheet or a dialog stood over the detail clip since the cover
   * rose — the lifting then resumes only where autoplay is allowed
   * (PostDetailVideo.md:47); the pad alone resumes under suppression too (:51).
   */
  private coverSuspended = false;
  /** Clips that arrived playing and wait for their first measurement. */
  private readonly arrived = new Set<object>();

  constructor({
    visible,
    allowed,
    detail = false,
  }: {
    visible: boolean;
    allowed: boolean;
    detail?: boolean;
  }) {
    this.visible = visible;
    this.allowed = allowed;
    this.detail = detail;
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
    if (this.coverStopped === key) this.coverStopped = null;
    // An arrival leaving before it was measured never held the stage: it
    // freezes as a clip that lost it would.
    if (this.arrived.delete(key) && this.holder !== key) this.freeze(key);
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
    if (this.detail) {
      this.veilDetail(key, veiled);
      return;
    }
    // A veiled clip has no playback (Feed.md:43): an arrival is not let play
    // on into its first measurement.
    if (veiled && this.arrived.delete(key)) this.freeze(key);
    this.decide();
  }

  /**
   * The detail clip's veil came down or went up. Veiled, nothing plays
   * beneath it (PostDetailVideoSensitive.md:3, backlog item 103). The unveil
   * is the veiled clip's open: "WHEN the clip unveils GIVEN the device allows
   * autoplay -> the clip plays" (:15), "GIVEN the device suppresses autoplay
   * -> NEVER the clip starts on its own" (:17) — and with a layer over the
   * post or the page hidden, it waits as an open would.
   */
  private veilDetail(key: object, veiled: boolean): void {
    if (veiled) {
      this.freeze(key);
      if (this.holder === key) this.holder = null;
      if (this.coverStopped === key) this.coverStopped = null;
      if (this.hiddenPlaying === key) this.hiddenPlaying = null;
      return;
    }
    if (this.holder !== null || !this.allowed) return;
    this.seatOpened(key, false);
  }

  /**
   * Whether the clip's frame was last reported on screen at all. A question
   * only — it decides nothing here. A player leaving pictures its frame for
   * the next presentation only where a reader could be looking at it
   * (`handover-still.tsx`), so a long feed of played clips does not copy
   * every one of their frames on the way out.
   */
  inView(key: object): boolean {
    return (this.places.get(key)?.ratio ?? 0) > 0;
  }

  /** One observer batch: every ratio first, then one decision (rule 3). */
  measure(entries: readonly { target: Element; intersectionRatio: number }[]): void {
    const measured: object[] = [];
    for (const entry of entries) {
      const key = this.keys.get(entry.target);
      const place = key === undefined ? undefined : this.places.get(key);
      if (place === undefined) continue;
      measured.push(key as object);
      place.ratio = entry.intersectionRatio;
      // A clip the reader started below the gate holds while any of it is on
      // screen — until it first reaches the gate, after which it is an
      // ordinary hand-started incumbent (Feed.md:25/27, FeedCover.md:29).
      if (place.handStarted && place.ratio >= GATE) place.qualifiedSinceTap = true;
    }
    // On the detail the scroll decides nothing (see the note at the top): the
    // ratios are kept for `inView`, and no batch starts or stops the clip.
    if (this.detail) return;
    this.decide();
    // An arrival this batch measured has had its election: holding the stage
    // it plays on, and otherwise it freezes where it reached.
    for (const key of measured) {
      if (this.arrived.delete(key) && this.holder !== key) this.freeze(key);
    }
  }

  /**
   * The clip's element arrived on this surface PLAYING, carried on from
   * another presentation of the same clip (`video-stage.ts`). It plays on,
   * holding the player layer, until the surface first measures it and the
   * election says whether it holds the stage (see the note at the top). With
   * something standing over the surface, the page hidden, or no observer to
   * measure it ever, it freezes now.
   */
  arrivePlaying(key: object): void {
    const place = this.places.get(key);
    if (place === undefined || this.holder === key) return;
    if (place.video.paused || !holds(key, place.video)) return;
    // A veiled clip has no playback (Feed.md:43), whatever it carried in.
    if (place.veiled || this.cover !== null || !this.visible || this.observerFor() === null) {
      this.freeze(key);
      return;
    }
    claim(key, place.video);
    this.arrived.add(key);
  }

  /**
   * The clip stands on the surface, and no presentation carried a play state
   * to it (`VideoPlayer`'s registration). On a list, an element `carried` in
   * playing plays on into its first measurement ({@link arrivePlaying}); a
   * clip that arrived still waits for the election. On the detail this is the
   * OPEN ({@link open}).
   */
  arrive(key: object, carried: boolean): void {
    if (this.detail) this.open(key);
    else if (carried) this.arrivePlaying(key);
  }

  /**
   * The detail opens on its clip — its only start (see the note at the top).
   * Once per stage: a clip that joins again (a new source, the viewer handing
   * it back) is not opened twice.
   *
   * "WHEN the detail opens GIVEN the clip stands unveiled and the device
   * allows autoplay -> the clip plays AND NEVER the 70% gate holds it back"
   * (PostDetailVideo.md:7), from wherever it stands: an element carried in
   * from the card plays on from the frame the card reached, with no seek
   * (:53). "GIVEN the device suppresses autoplay -> NEVER the clip starts on
   * its own" (:9) — but a clip the reader started by hand on the card and
   * carried in playing is the reader's own start continuing, which
   * suppression never stops (FeedCover.md:25, ruling 96). A veiled clip is not
   * opened: its unveil is its start (PostDetailVideoSensitive.md:15/17).
   */
  open(key: object): void {
    const place = this.places.get(key);
    if (place === undefined || !this.detail || this.opened) return;
    this.opened = true;
    if (place.veiled) {
      this.freeze(key);
      return;
    }
    const playing = !place.video.paused && holds(key, place.video);
    if (!this.allowed && !playing) return;
    this.seatOpened(key, playing);
  }

  /**
   * The detail clip takes the stage on its open or its unveil: it starts —
   * or, where a layer stands over the post or the page is hidden, waits for
   * that to lift as a clip stopped by it would, and the lifting's own rule
   * then says whether it resumes.
   */
  private seatOpened(key: object, playing: boolean): void {
    const place = this.places.get(key);
    if (place === undefined) return;
    this.holder = key;
    if (this.cover !== null || !this.visible) {
      if (playing) place.video.pause();
      if (this.cover !== null) this.coverStopped = key;
      else this.hiddenPlaying = key;
      return;
    }
    this.start(key);
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
    this.arrived.delete(key);
    place.handStarted = true;
    place.qualifiedSinceTap = place.ratio >= GATE;
    this.padPaused = null;
    this.hiddenPlaying = null;
    this.coverStopped = null;
    this.start(key);
  }

  /**
   * The clip takes the stage STANDING STILL — a presentation carrying on a
   * clip the reader had paused elsewhere (the fullscreen viewer and the detail
   * clip it hands back to: "the viewer's play state carries … paused returns
   * paused", PostDetailVideo.md:61). It holds the stage as a clip started by
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
    // The carry is the last word on this clip: a covering layer's lifting
    // owes it no resume (PostDetailVideo.md:61 over :43).
    this.coverStopped = null;
    this.arrived.delete(key);
    if (!place.video.paused && holds(key, place.video)) place.video.pause();
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
    // Whatever rises over the surface finds its arrivals unelected: they
    // freeze, as nothing new plays under a layer.
    if (next !== null) this.freezeArrivals();

    if (this.detail) {
      this.coverDetail(prev, next);
      return;
    }

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
        const video = this.heldElement(this.holder);
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

  /**
   * What covers the detail clip changed (rule 12; the note above).
   * Whatever rises first stops the playing clip where it is and remembers it
   * — the opinion pad included (PostDetailVideo.md:49) — and the clip keeps
   * the stage throughout, standing still. When the last layer lifts, that
   * same clip resumes where it stopped: always after the pad alone (:51),
   * and after a sheet or a dialog only where autoplay is allowed (:43, :47).
   * A clip that was not playing when the cover rose — the reader had paused
   * it, it had played to its end, the device never started it — is not
   * remembered, so nothing resumes it (:45, :47).
   */
  private coverDetail(prev: SurfaceCover, next: SurfaceCover): void {
    if (next !== null) {
      if (next === "suspended") this.coverSuspended = true;
      if (prev !== null || this.holder === null) return;
      const video = this.heldElement(this.holder);
      if (video !== undefined && !video.paused) {
        video.pause();
        this.coverStopped = this.holder;
      }
      return;
    }

    const resume = this.coverStopped;
    const suspended = this.coverSuspended;
    this.coverStopped = null;
    this.coverSuspended = false;
    if (resume === null || resume !== this.holder || !this.visible) return;
    if (suspended && !this.allowed) return;
    this.start(resume);
  }

  /** The page was hidden or shown (Page Visibility API, `page-visibility.ts`). */
  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;

    if (!visible) {
      // "WHEN the page is hidden … -> the playing clip pauses on the frame it
      // reached" (Feed.md:51). It keeps the stage: nothing was decided.
      this.freezeArrivals();
      if (this.holder === null) return;
      const video = this.heldElement(this.holder);
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
    this.coverStopped = null;
    this.coverSuspended = false;
    this.arrived.clear();
    this.opened = false;
  }

  // ---- the machinery -----------------------------------------------------

  /** The clip's element, where this stage still holds it (see the note at the top). */
  private heldElement(key: object): HTMLVideoElement | undefined {
    const video = this.places.get(key)?.video;
    return video !== undefined && holds(key, video) ? video : undefined;
  }

  /** Every arrival not yet measured freezes where it reached. */
  private freezeArrivals(): void {
    const waiting = [...this.arrived];
    this.arrived.clear();
    for (const key of waiting) if (this.holder !== key) this.freeze(key);
  }

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
    // The detail elects nothing: its open is its only start (see the note at
    // the top), so autoplay coming back or its clip leaving starts nobody.
    if (this.detail) return;
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
    const video = this.heldElement(key);
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
    if (!place.video.paused && holds(key, place.video)) place.video.pause();
  }
}
