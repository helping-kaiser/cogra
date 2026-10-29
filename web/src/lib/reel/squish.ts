// THE REEL'S SQUISH (readme §13, the motion table): "the clip, still playing,
// moves to the head of the post's detail and the post rises beneath it — a
// shared element, 300ms, never a page sliding in" (Reel.md:59).
//
// React's `<ViewTransition>` is the documented shared element for an App
// Router navigation (node_modules/next/dist/docs/01-app/02-guides/
// view-transitions.md, "Morph a thumbnail into a hero image"): the clip is
// wrapped under ONE name on each presentation — the portrait card, the stream,
// the detail's head — and the browser morphs it between them. `share` names
// the class the motion is styled by (`cg-squish`, tokens-2.css) and
// `default="none"` keeps the clip out of every unrelated transition.
//
// The name is the clip's media id, the same identity the clip memory keys on
// (`clip-memory.ts`), so the shape the reader follows is the clip itself. A
// name must be unique on a page: one clip is drawn once per surface.

export function reelClipName(mediaId: string): string {
  return `reel-clip-${mediaId}`;
}
