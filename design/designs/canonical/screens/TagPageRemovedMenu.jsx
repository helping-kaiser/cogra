/* THE TAG'S PAGE, A REMOVED POST'S MENU OPEN (round 57, backlog 223; jakob
   2026-11-18, tag page (c)). With the feed's filter's `Removed` on, @tobias's
   tagged post, removed by him, stands in its row as the feed's removed card
   (`TagPage`'s law), and its ⋮ raises the reader's post menu whole — Save,
   Cite in a new post, `Hide @tobias`, Cited by, Opinions on this, License
   terms, Report at the tail — the same rows on a removed post as on any
   (`FeedRemovedMenu`). Over `TagPageBody` clipped at the phone's 844, as
   `TagPageMenu`.

   REGISTERED under the `tagPage` prefix, `tagPage.menuSheet`, told apart by
   board. */
export const NODE = "tagPage";
export const FRAME = { width: 390, height: 844 };
export function Screen() {
  return (
    <>
      <TagPageBody removed="tobias" />
      <CardMenuSheet items={readerPostMenu("tobias")} />
    </>
  );
}
