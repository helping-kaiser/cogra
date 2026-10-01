/* Comment · no such comment — the terminal state of a comment link (the
   failure pack's `NOT_FOUND`, copy-voice *Faults by code*; jakob 2026-10-01,
   backlog item 117). `PostNotFound`'s construction, which is
   `ProfileNotFound`'s, with the comment's noun.

   A COMMENT TRAVELS BY LINK TOO — a share, a notification, a search result —
   and a comment is never deleted: a removed one keeps its place in its thread
   under its mark (`CommentRemoved`). So this is only the answer when there
   was never a comment, and there is no thread to open it in.

   IT IS TERMINAL, AND THE WHOLE SCREEN. Nothing retries; the back arrow is
   the way out — to the state the link opened over, or, opened cold, to the
   feed, the owning tab's root (the layer law, jakob 2026-10-01). It is drawn
   cold: `Back to feed`, the post detail's label. No title and no menu: a
   dead id names nothing, and there is nothing to act on. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to feed" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="This comment doesn't exist." />
      </div>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
