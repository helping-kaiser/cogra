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
   unfolded, then one row per axis, the two readings aligned. The post carrying
   them declares credit on every use and no record of use, so the block shows
   what it is for: two axes that genuinely differ, read as a pair. The
   both-axes-zero case is the one a reader has a word for, and that word rides
   the caption line when it comes up.

   The board takes the post with ONE wide picture rather than the gallery's
   four tall ones. A reveal has to be drawn where there is room to read it, and
   the gallery post is the tallest body in the fixture set — unfolded on that
   card, the terms push the topics line and the whole affordance row past the
   fold, and a state nobody can see is a state nobody can check. */
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU_SHOWN} />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" defaultShowLicense />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
