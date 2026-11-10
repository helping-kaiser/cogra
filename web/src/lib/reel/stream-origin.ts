// THE STREAM AS AN ORIGIN: where a door out of the stream says the reader came
// from, so the destination's way back reads `Back to the stream` and returns
// into it at the clip the reader left (copy-voice.md:721-722; readme §13, the
// navigation-and-sheets round's noun table; PostDetailVideo.md:33).
//
// The origin names the CLIP, `stream:<post id>`, because the stream is held by
// the session (`stream-session.ts`) and re-entered at a clip: the detail opened
// from the rail's score and the profile opened from its author both lead back
// to `/reel/<that clip>`.

//
// The stream belongs to the stack of the list it narrowed, so the token chains
// that list's own origin after a slash (`back-origin.ts`, the chain):
// `stream:v2/saved` keeps the Profile root lit on the doors out of a stream
// opened from Saved.

/** The `from` every door out of the stream carries. */
export const STREAM_ORIGIN = "stream:";

/** The doors' `from`: the clip, and the origin token of the list the stream narrowed, if any. */
export function streamFrom(postId: string, via: string | null = null): string {
  const token = `${STREAM_ORIGIN}${postId}`;
  return via === null || via === "" ? token : `${token}/${via}`;
}

/** The clip a `from` names, when it is the stream's; null otherwise. */
export function streamClipOf(from: string | null | undefined): string | null {
  if (typeof from !== "string" || !from.startsWith(STREAM_ORIGIN)) return null;
  const rest = from.slice(STREAM_ORIGIN.length);
  const at = rest.indexOf("/");
  const id = at < 0 ? rest : rest.slice(0, at);
  return id === "" ? null : id;
}

/** The origin a stream token carries — the list the stream narrowed — or null. */
export function streamViaOf(from: string | null | undefined): string | null {
  if (streamClipOf(from) === null) return null;
  const rest = (from as string).slice(STREAM_ORIGIN.length);
  const at = rest.indexOf("/");
  return at < 0 || at === rest.length - 1 ? null : rest.slice(at + 1);
}

/** The way back into the stream at `postId`. */
export function streamHref(postId: string): string {
  return `/reel/${encodeURIComponent(postId)}`;
}
