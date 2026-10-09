// THE READING SESSION'S MEMORY OF EACH CLIP — where it stopped, and whether it
// has played at all (tmp_dev packet `web-stage-law.md` §3.2 rules 5 and 13,
// RF-6). Meant to be read as `import * as clipMemory from "./clip-memory"`.
//
// "WHEN feed.card.media.frame's clip stops being the playing clip -> it
// freezes on the frame it reached AND NEVER the stored still returns within
// the reading session, its card's remounts included" (FeedCover.md:9). A
// remount builds a new `<video>`, so the frame it reached cannot live on the
// element: it lives here, KEYED PER CLIP — "position is keyed per clip within
// the session" (the ruled GAP-8 sub-question) — which is also what carries a
// clip's place card → detail → viewer and back (PostDetailVideo.md:43–51,
// ViewerVideo.md:5).
//
// MODULE STATE, SO A NEW DOCUMENT FORGETS. A cold launch wears the stored
// stills again (FeedCover.md:11); on the web a cold launch is a fresh document
// load, and module state dies with the document — the same reasoning
// `mute.ts` gives for the one global mute. A list that refreshes forgets its
// own clips (FeedCover.md:13, `forgetList`).
//
// WHO WRITES, AND WHEN (`video-player.tsx`): a player writes where its clip
// stands when it unmounts, and when it hands its clip to a layer presenting
// the same clip bigger (the fullscreen viewer). Those are the only moments a
// second presentation of the clip can come to read it — the web draws one
// route at a time, and the viewer is the one layer that presents a clip the
// page already shows.
//
// A FORGOTTEN CLIP STAYS FORGOTTEN BY THE PLAYERS THAT MET IT BEFORE. A
// refresh forgets the list's clips and then remounts the list; the players
// it unmounts write where they stood on their way out, AFTER the forgetting.
// So each forgetting opens a new era, a writer says which era it was born in,
// and a write from a player born before its clip was forgotten is dropped.

/** What the session remembers of one clip. */
export type ClipMemory = {
  /** Where it stood when it last stopped, in seconds — `currentTime`. */
  readonly time: number;
  /** Whether it has ever played this session; once true, its still never returns. */
  readonly everPlayed: boolean;
  /** Whether it was playing when this was written — the viewer's carried play state (N1). */
  readonly playing?: boolean;
};

const memory = new Map<string, ClipMemory>();

/** How many forgettings the session has seen — the era a writer is born in. */
let era = 0;
/** The era each forgotten clip was forgotten in. */
const forgottenIn = new Map<string, number>();

/** The session's memory of a clip, or undefined for one it has not met. */
export function read(mediaId: string): ClipMemory | undefined {
  return memory.get(mediaId);
}

/** The era now: a player reads it once, at mount, and writes with it. */
export function currentEra(): number {
  return era;
}

/**
 * Remember where a clip stands.
 *
 * Having played is never forgotten by a write: a clip that has played keeps
 * its reached frame for the rest of the session, so `everPlayed` only ever
 * turns on here. Only {@link forgetList} turns it off.
 *
 * `since` is the era the writer was born in (default: now). A writer born
 * before its clip was forgotten is writing about a frame the refresh already
 * took back, and is not heard.
 */
export function write(mediaId: string, entry: ClipMemory, since: number = era): void {
  if ((forgottenIn.get(mediaId) ?? -1) > since) return;
  const before = memory.get(mediaId);
  memory.set(mediaId, {
    ...entry,
    everPlayed: entry.everPlayed || (before?.everPlayed ?? false),
  });
}

/**
 * A list refreshed: its clips wear their stored stills again
 * (FeedCover.md:13; RULINGS "pull-to-refresh RESETS the reached-frame
 * memory"). Per clip, so the same clip elsewhere is re-stilled too.
 */
export function forgetList(mediaIds: Iterable<string>): void {
  era += 1;
  for (const id of mediaIds) {
    memory.delete(id);
    forgottenIn.set(id, era);
  }
}

/** Test seam: nothing in the app clears the whole session's memory. */
export function resetClipMemoryForTests(): void {
  memory.clear();
  forgottenIn.clear();
  era = 0;
}
