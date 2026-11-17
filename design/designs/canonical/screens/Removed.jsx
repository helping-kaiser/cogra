/* Removed by its author — the record's skeleton holds the thread's place.

   YOUR OWN REMOVED POST KEEPS ITS MENU (jakob 2026-11-12, question 18): the
   header's ⋮ holds `OWN_REMOVED_POST_MENU` — Save, Cite in a new post, Cited
   by, Opinions on this, License terms —
   because the record can still be kept and cited, a follow-up post
   explaining the removal among the reasons. Another's removed post is
   `RemovedOther`.

   REGISTERED under the `postDetail` prefix (seam 248): the detail it is, its
   mark `card.removalMark` as the profile names the same master, the header
   `header` with its `menu` as `PostDetail` names them. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <DetailHeader items={OWN_REMOVED_POST_MENU} node="header" />
      <DetailColumn>
        {/* The responses live on in the comments sheet — the glyph still counts
            them, which is itself the proof that nothing was quietly deleted. */}
        <PostCard id={SOL_POST.id} author={SOL} timestamp="3d" variant="detail" redacted={{ reason: "author", when: "2h" }} score="9.10" comments={2} node="card" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
