/* Post · no such post — the terminal state of a post link (the failure pack's
   `NOT_FOUND`, copy-voice *Faults by code*; jakob 2026-10-01, backlog item
   117). `ProfileNotFound`'s construction, with the noun this surface is
   about.

   A POST TRAVELS BY LINK — a share, a notification — so an id that resolves
   to nothing is a state readers reach from outside the app. A removed post is
   not this: it keeps its place and its mark (`Removed`), because the
   node is never deleted. This is the answer when there was never a post.

   IT IS TERMINAL. Nothing retries, because nothing about asking again makes
   a post exist; the back arrow is the way out — to the state the link
   opened over, or, opened cold, to the feed, the owning tab's root (the
   layer law, jakob 2026-10-01). It is drawn cold: `Back to feed`, the
   detail's own label.

   IT IS `EmptyState`, NOT `TransportError`: the answer arrived and the answer
   was no. The header carries no title — a dead id names nothing a reader
   could recognise — and no menu, since there is no post to act on. */
export function Screen() {
  return (
    <>
      <PageHeader backHref="#" backLabel="Back to feed" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="This post doesn't exist." />
      </div>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
