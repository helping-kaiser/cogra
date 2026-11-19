/* HISTORY, A REMOVED POST'S MENU OPEN (round 55, backlog 223). A thing removed
   after it was seen keeps its place in History and wears its removal mark
   (History.md) — @ada's post, removed by her, as `FeedRemovedMenu` draws it on
   the feed — and its ⋮ raises the reader's post menu whole: Save, Cite in a
   new post, `Hide @ada`, Cited by, Opinions on this, License terms, Report at
   the tail, the same rows on a removed post as on any. Unstacked over History,
   as `HistoryPostMenu`; no row is added, removed or reordered.

   REGISTERED under the `history` prefix, `history.menuSheet`, the mark
   `card.removalMark` as `FeedRemoved` names it. */
export const NODE = "history";
export function Screen() {
  return (
    <>
      <HistoryTop>
        <PostCard id={ADA_POST.id} author={ADA} timestamp="7d" redacted={{ reason: "author", when: "2d" }} score="15.20" comments={3} bundle={mkBundle(0.55, 0.2)} menuItems={readerCardMenu("ada")} node="card" />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} node="card" />
      </HistoryTop>
      <CardMenuSheet items={readerPostMenu("ada")} />
    </>
  );
}
