// THE STREAM AS AN ORIGIN: where a door out of the stream says the reader came
// from, so the destination's way back reads `Back to the stream` and returns
// into it at the clip the reader left (copy-voice.md:721-722; readme §13, the
// navigation-and-sheets round's noun table; PostDetailVideo.md:33).
//
// The origin names the CLIP, `stream:<post id>`, because the stream is held by
// the session (`stream-session.ts`) and re-entered at a clip: the detail opened
// from the rail's score and the profile opened from its author both lead back
// to `/reel/<that clip>`.

/** The `from` every door out of the stream carries. */
export const STREAM_ORIGIN = "stream:";

export function streamFrom(postId: string): string {
  return `${STREAM_ORIGIN}${postId}`;
}

/** The clip a `from` names, when it is the stream's; null otherwise. */
export function streamClipOf(from: string | null | undefined): string | null {
  if (typeof from !== "string" || !from.startsWith(STREAM_ORIGIN)) return null;
  const id = from.slice(STREAM_ORIGIN.length);
  return id === "" ? null : id;
}

/** The way back into the stream at `postId`. */
export function streamHref(postId: string): string {
  return `/reel/${encodeURIComponent(postId)}`;
}
