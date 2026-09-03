/* THE TERMS, UNFOLDED (readme §13, the menus round). What the menu's License
   terms row leaves behind: the same detail view, the sheet gone, and the
   license open on the card between the body and the topics line.

   A STATE, NOT A DESTINATION. Nothing navigates to get here — the reader asked
   a question about the post they were already reading and got the answer on it,
   which is why the row's edge stays in place and this board is declared an
   entry rather than the target of a tap. The header's menu is closed here, and
   carries the folded-away wording: reopened, the row that unfolded the terms
   reads Hide license, in the same position it always had.

   The terms themselves are the master's own inset — the caption naming what
   unfolded, then one row per axis, the two readings aligned. This post is
   public domain, the pair a reader meets most, so the name of that pair rides
   the caption line while the rows still spell what it means. */
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU_SHOWN} />
      <DetailColumn>
        <PostCard {...MIRA_GALLERY_POST} variant="detail" defaultShowLicense />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
