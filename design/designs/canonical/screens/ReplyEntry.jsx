/* The comments sheet (readme §13, 2026-08-28): the thread lives in a bottom
   sheet over the post — near full height, a sliver of the post left above it —
   with replies collapsed behind counts, deeper answers flattened to @handles,
   and the entry row pinned at its foot. The detail view behind is just the
   post. The second comment carries a sensitive mark: the whole body veils as
   one comment-scale block, the frame around it still readable.

   THE ORDER: top-level comments newest first, the replies in a branch oldest
   first (readme §13, *Comments live in a sheet*). The fixtures' times say it —
   @tobias 1h over @mira 2h over @sol 3h, and @sol's branch 40m before 22m.

   @SOL'S COMMENT IS THE READER'S OWN (jakob 2026-10-01: "'own' should be added
   to the existing boards so it is clear that you can interact differently with
   your own comments"). It wears `CommentCard`'s `own` — `Edit` beside `Reply`,
   the anatomy `ReplyMedia` drew first — and its ⋮ opens `CommentMenuOwn`.

   IT IS MODAL OVER ITS SCRIM, AT ONE DETENT (readme §4, *Sheets*). The sliver
   of post above it takes no tap; the sheet drags down only from its handle
   area or from the thread at its scroll-top. It is the default open; a deep
   link lands it on a comment — scrolled to the sheet's top, its branch
   expanded, a brief tonal highlight that fades — and a forward navigation out
   of it comes back to it at its offset with its branches still expanded
   (readme §4, *Navigation*; the behavior sidecar's lines).

   The thread and the detail beneath it are `_shared.jsx` helpers, because the
   comment's own overflow menu draws this same board with one more sheet on it. */
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet />
    </>
  );
}
