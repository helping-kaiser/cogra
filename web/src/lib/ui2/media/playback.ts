"use client";

// STARTING A CLIP, and what happens when the browser says no (tmp_dev packet
// `web-stage-law.md` §3.2 rule 9).
//
// Every start — the stage electing a clip, a play-disc tap, the transport's
// play — goes through here, so the one sound decision and the one refusal
// rule are applied in one place.
//
// THE CLIP STARTS WITH THE SOUND THE READER CHOSE. "ALWAYS a clip starts muted
// GIVEN the reader has not turned sound on" (FeedCover.md:39): the element
// takes the global mute at the moment of the call, not at mount.
//
// A REFUSED UNMUTED START PLAYS MUTED AND TURNS THE SOUND OFF. "WHEN the
// browser refuses sound to a clip taking the stage GIVEN the web and sound is
// on -> the clip plays muted AND sound turns off for every clip on every
// surface AND NEVER the clip stays frozen" (FeedCover.md:41). The browser says
// it by rejecting `play()` with `NotAllowedError` — unmuted playback with no
// user gesture behind it, notably iOS Safari
// (https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play) —
// while "muted autoplay is always allowed"
// (https://developer.chrome.com/blog/autoplay/), so the muted retry is the one
// start the browser does not refuse.
//
// AN `AbortError` IS NOT A REFUSAL. It is a pause overtaking the start — which
// on a stage that freezes the outgoing clip mid-scroll is the law working, not
// a fault — so it is let go without a word.

import { isMuted, setMuted } from "./mute";

/** Whether a `play()` rejection is the browser refusing it. */
function isRefusal(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === "NotAllowedError";
}

/**
 * Start `video` playing with the reader's sound decision.
 *
 * `stillWanted` is asked before the muted retry: the refusal arrives a task
 * later, and by then the stage may have moved on to another clip, a sheet may
 * have risen, or the page may have hidden — a clip that lost its claim in the
 * meantime must not be started behind the stage's back.
 */
export function startPlayback(video: HTMLVideoElement, stillWanted: () => boolean = () => true): void {
  const sound = !isMuted();
  video.muted = !sound;
  void video.play().catch((error: unknown) => {
    if (!isRefusal(error) || !sound) return;
    // The decision is the reader's, and every disc reads it: flipping the one
    // store turns the sound off everywhere and every disc offers it back.
    setMuted(true);
    video.muted = true;
    if (!stillWanted()) return;
    void video.play().catch(() => {
      // Refused even muted — the browser's hard no (a power-saving mode, a
      // policy). Nothing further is the page's to try; the clip stands on its
      // frame with its disc, which is what a reader can act on.
    });
  });
}
