/* Removed by its author — the record's skeleton holds the thread's place.

   REGISTERED under the `postDetail` prefix (seam 248): the detail it is, its
   mark `card.removalMark` as the profile names the same master. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      {/* A removed post has no menu left — back is the whole header. */}
      <PageHeader backHref="#" backLabel="Back to feed" node="header" />
      <DetailColumn>
        {/* The responses live on in the comments sheet — the glyph still counts
            them, which is itself the proof that nothing was quietly deleted. */}
        <PostCard author={SOL} timestamp="3d" variant="detail" redacted={{ reason: "author", when: "2h" }} score="9.10" comments={2} node="card" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />
    </>
  );
}
