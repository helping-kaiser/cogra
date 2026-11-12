/* Another's post, removed by its author, opened in detail (jakob 2026-11-12,
   question 18 (1), as recommended). `Removed`'s skeleton — the mark where the
   words and pictures were, the author, the age, the opinion still given, the
   score, the comment count and the share — with the reader's menu in the
   header, the rows the removed card's ⋮ raises (`readerCardMenu`): Save, Cite
   in a new post, Hide with the author's handle, Report at the tail, and no
   License terms, the license having gone with the payload (`FeedRemovedMenu`
   draws the sheet open). One menu per post, wherever it is opened.

   REGISTERED under the `postDetail` prefix, as `Removed` and `PostDetail` name
   the same surface: `header` with its `menu`, the card `card` keyed by the
   post's id, its mark `card.removalMark`. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <DetailHeader items={readerCardMenu("ada")} node="header" />
      <DetailColumn>
        <PostCard id={ADA_POST.id} author={ADA} timestamp="7d" variant="detail" redacted={{ reason: "author", when: "2d" }} score="15.20" comments={3} bundle={mkBundle(0.55, 0.2)} node="card" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
