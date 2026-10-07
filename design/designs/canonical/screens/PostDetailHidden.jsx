/* THE POST, JUST AFTER HIDING ITS AUTHOR FROM IT (jakob 2026-10-07, ruling
   65; the hide's detail case, jakob 2026-10-02). `FeedHidden`'s other half:
   the same tap — ⋮, `Hide @ada`, the sheet closing — made on the post being
   read instead of a card in the feed.

   THE READER STAYS, AND SO DOES THE POST. Hiding clears the reader's feed of
   a person; it never takes away what is on screen, so the post they asked
   from stands exactly as it stood under `ReaderPostMenu`'s sheet. Nothing on
   it changes and nothing marks it: the graph is untouched, and the feed is
   where the hide shows, the next time it is opened (`FeedHidden`).

   THE SNACKBAR IS THE FEED'S, WORD FOR WORD. `@ada is hidden — their posts
   stay out of your feed.` with `Undo`: the line says how far the act reaches,
   and that reach is the same whichever surface the tap was made on. It lands
   where the tap was made, over the detail and above its bar (`Snackbar`'s
   80px).

   IT IS `ReaderPostMenu`'S POST WITH THE SHEET GONE, not a new detail. The
   header, the card and the bar are the detail's own, drawn as the menu's
   board draws them — the shape `FeedHidden` takes over `Feed`.

   REGISTERED under the `postDetail` prefix (design ⇄ impl seam 059/061, the
   Hide packet's registration ask), named as `ReaderPostMenu` names the
   surface; the snackbar is `snackbar`, its `message` and its `action`. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} node="header" />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" node="card" />
      </DetailColumn>
      <Snackbar message="@ada is hidden — their posts stay out of your feed." action="Undo" offset={80} node="snackbar" />
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
