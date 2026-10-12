// THE PLAYER LAYER — one clip plays at a time, app-wide (tmp_dev packet
// `web-stage-law.md` §3.2 rule 15). WHICH clip a surface plays is not decided
// here: each scroll surface's stage elects its own holder (`stage.ts`, the
// stage law of Feed.md). This module sits beneath every stage and only keeps
// playback single across them — a stage claims when its holder starts and
// surrenders when the holder freezes — and it stays the backstop for clips no
// surface hosts, so "ALWAYS at most one clip plays" (Feed.md:3) holds
// everywhere.
//
// This mirrors android/core/designsystem/.../v2/media/VideoStage.kt in BOTH of
// its halves. The OWNERSHIP semantics — the most recent claimant owns the
// player layer, and claiming pauses whoever held it before — and the
// PLAYER-POOLING: Android moves one ExoPlayer between a clip's presentations
// rather than preparing a second one, and the web moves the one live
// `<video>` element the same way (the element pool below, jakob's ruling
// q-fx2a). Moving it is what makes a handover cost nothing: a new element
// pointed at a reached moment has to decode its way there from the keyframe
// before it — measured at ~500 ms at the composer's five-second keyframe
// spacing — while the element that is already there simply carries on.

type Owner = {
  readonly token: object;
  readonly video: HTMLVideoElement;
};

let current: Owner | null = null;

/**
 * Takes the stage for `token`, on `video`.
 *
 * If a different token currently holds the stage, that owner's video is
 * paused before the claim transfers — the newest claimant always wins, and
 * the stage holds exactly one playing clip. Claiming again with the same
 * token is a no-op past updating the held video — and so is a claim on the
 * very element already held: one clip carried into its next presentation is
 * still one clip, and pausing it there would stop the clip the claim is for.
 */
export function claim(token: object, video: HTMLVideoElement): void {
  if (current && current.token !== token && current.video !== video && !current.video.paused) {
    current.video.pause();
  }
  current = { token, video };
}

/**
 * The surface is leaving.
 *
 * Ownership clears only if `token` still holds it — mirrors
 * `VideoStage.surrender`'s guard: a surface whose clip already lost the
 * stage to a newer claimant must not steal it back on its own way out.
 */
export function surrender(token: object): void {
  if (current?.token === token) {
    current = null;
  }
}

// ---- the elements ----------------------------------------------------------
//
// ONE LIVE ELEMENT PER CLIP, MOVED BETWEEN ITS PRESENTATIONS. A presentation
// (a feed card, the detail's clip, the fullscreen viewer) TAKES its clip's
// element when it mounts and RELEASES it when it leaves. A released element
// is PARKED under its clip's identity — the attachment's media id, never the
// surface it was on — and the next presentation of the same clip takes the
// parked element instead of building a new one. It arrives decoded, at the
// frame it reached, still playing if it was: nothing about it re-prepares.
//
// WHY THE ELEMENT IS THE POOL'S AND NOT REACT'S. React keeps a component's
// DOM only while the component stays at the same place in the tree
// (react.dev, "Preserving and Resetting State"), and offers no way to move a
// rendered node to another parent with its state. So the element is not
// rendered at all: the player renders an always-empty container and appends
// the pool's element into it — the arrangement react.dev documents as safe
// for DOM React has no reason to touch ("if some <div> is always empty in
// the JSX, React won't have a reason to touch its children list",
// "Manipulating the DOM with Refs").
//
// MOVING A PLAYING ELEMENT DOES NOT STOP IT. A media element removed from a
// document pauses only once the task that removed it has finished AND only if
// it is still out of every document by then (html.spec.whatwg.org, "When a
// media element is removed from a Document": await a stable state, then "if
// the media element is in a document, return"). A commit that removes one
// presentation and mounts the next runs in one task, so the element is back
// in a document before that check. One parked across tasks — a next
// presentation that mounts after a load — pauses where it stands and is
// still decoded there when taken.
//
// WHAT IS PARKED. An element worth carrying: one whose clip moved (it played,
// or stands past its start) and that a reader could be looking at, or that was
// playing, or that is handed to a layer presenting it bigger. Parking every
// card a leaving feed drops would let them push the one clip that matters out
// of the few the session keeps.
//
// A PARKED ELEMENT IS TAKEN ONLY WHILE IT IS STILL THE CLIP'S TRUTH. It goes
// when a newer presentation of the same clip leaves having moved it, when its
// source differs from the one asked for, and when its clip was forgotten after
// the element was built (a refresh, `clipMemory.forgetList`): the element
// stands at a frame the refresh took back, exactly as an outdated memory
// write would (the era rule of `clip-memory.ts`).

import * as clipMemory from "./clip-memory";

/** Who holds an element, and what it is. */
type Lease = {
  /** The presentation holding it, or null while it is parked. */
  holder: object | null;
  /** The clip it plays, or null for media that is no record's yet (never parked). */
  readonly clip: Clip | null;
  /** The memory's era when the element was built. */
  readonly bornIn: number;
  /** Whether the holder took it over from another presentation of the clip. */
  carried: boolean;
};

/** A clip's identity and the source its presentation asks for. */
export type Clip = { readonly mediaId: string; readonly src: string };

const leases = new WeakMap<HTMLVideoElement, Lease>();

/** Parked elements by clip, oldest first (a Map keeps insertion order). */
const parked = new Map<string, HTMLVideoElement>();

/**
 * How many released elements the session keeps parked. A handover carries one
 * clip; a leaving feed parks the few cards a reader could see. Each one is a
 * live media element, so the pool is bounded rather than kept per clip met.
 */
export const ELEMENTS_PARKED = 4;

/**
 * The element a presentation of `clip` shows — the clip's parked element when
 * there is one still true to it, else a new one — now held by `holder`.
 * `carried` says which: a carried element arrives at the frame it reached, and
 * nothing may point it anywhere.
 */
export function takeElement(
  holder: object,
  clip: Clip | null,
): { readonly video: HTMLVideoElement; readonly carried: boolean } {
  if (clip !== null) {
    const waiting = parked.get(clip.mediaId);
    if (waiting !== undefined) {
      parked.delete(clip.mediaId);
      const lease = leases.get(waiting);
      if (
        lease !== undefined &&
        lease.clip?.src === clip.src &&
        clipMemory.heardSince(clip.mediaId, lease.bornIn)
      ) {
        lease.holder = holder;
        lease.carried = true;
        return { video: waiting, carried: true };
      }
      unload(waiting);
    }
  }
  const video = document.createElement("video");
  leases.set(video, { holder, clip, bornIn: clipMemory.currentEra(), carried: false });
  return { video, carried: false };
}

/**
 * `holder` lets go of `video`. It leaves its container and is parked for the
 * clip's next presentation when `keep` says it is worth carrying; otherwise it
 * is dropped. `moved` says whether the clip moved under this presentation —
 * then whatever was parked for it before stands at a frame the clip has left,
 * and goes.
 */
export function releaseElement(
  holder: object,
  video: HTMLVideoElement,
  { keep, moved }: { readonly keep: boolean; readonly moved: boolean },
): void {
  const lease = leases.get(video);
  if (lease === undefined || lease.holder !== holder) return;
  lease.holder = null;
  lease.carried = false;
  video.remove();
  const clip = lease.clip;
  if (clip === null) return;
  if (keep || moved) {
    const before = parked.get(clip.mediaId);
    if (before !== undefined && before !== video) unload(before);
    parked.delete(clip.mediaId);
  }
  if (!keep) return;
  parked.set(clip.mediaId, video);
  for (const [mediaId, oldest] of parked) {
    if (parked.size <= ELEMENTS_PARKED) break;
    parked.delete(mediaId);
    unload(oldest);
  }
}

/**
 * Whether the presentation `key` may act on `video`. A stage acts on the
 * elements of the clips standing on it; an element carried on into another
 * presentation is that presentation's, and the surface it left must not pause
 * it on the way out. Elements outside the pool answer to whoever holds them.
 */
export function holds(key: object, video: HTMLVideoElement): boolean {
  const holder = leases.get(video)?.holder;
  return holder === undefined || holder === null || holder === key;
}

/** Whether `video` was carried into the presentation holding it now. */
export function carriedOver(video: HTMLVideoElement): boolean {
  return leases.get(video)?.carried === true;
}

/**
 * An element no presentation will take: stopped, and its media let go at
 * once rather than whenever it is collected — the documented way to stop a
 * media element's download is to remove its source and call `load()`
 * (https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Audio_and_video_delivery#stopping_the_download_of_media).
 */
function unload(video: HTMLVideoElement): void {
  leases.delete(video);
  if (!video.paused) video.pause();
  video.removeAttribute("src");
  video.load();
}

/** Test-only: clears the stage between tests, mirroring `resetMuteForTests`. */
export function resetVideoStageForTests(): void {
  current = null;
  parked.clear();
}

/**
 * Test seam: nothing in the app empties the pool. Elements are parked by the
 * players a test's unmounting `cleanup` takes down, so one test's clips would
 * otherwise be carried into the next test's frames.
 */
export function resetElementPoolForTests(): void {
  parked.clear();
}
