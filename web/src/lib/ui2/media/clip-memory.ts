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
// Unused until the continuity PR wires it.

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

/** The session's memory of a clip, or undefined for one it has not met. */
export function read(mediaId: string): ClipMemory | undefined {
  return memory.get(mediaId);
}

/**
 * Remember where a clip stands — on every pause or freeze, and on unmount.
 *
 * Having played is never forgotten by a write: a clip that has played keeps
 * its reached frame for the rest of the session, so `everPlayed` only ever
 * turns on here. Only {@link forgetList} turns it off.
 */
export function write(mediaId: string, entry: ClipMemory): void {
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
  for (const id of mediaIds) memory.delete(id);
}

/** Test seam: nothing in the app clears the whole session's memory. */
export function resetClipMemoryForTests(): void {
  memory.clear();
}
