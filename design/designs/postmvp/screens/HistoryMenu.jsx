/* WHERE THE HISTORY HANGS IN THE ⋮ — the own-post sheet with the round's one
   new row (jakob's ruling 2026-09-22).

   IT SITS BESIDE EDIT, and that placement is the argument. Edit is where a new
   version is made; Edit history is where the versions already made are read.
   The two rows are the same subject from either side, so the thumb finds them
   together and neither has to be hunted for.

   "HISTORY" WAS ALREADY TAKEN, so the row is EDIT HISTORY. Your own profile's ⋮
   carries History — the private list of what you have read — and the wallet has
   a History section of its own. A second, public, per-post History would be the
   third meaning of one word in one product.

   THE ROW APPEARS ONLY ONCE A SECOND VERSION EXISTS, and so does the marker on
   the card. A post that has never been edited has no history to open: a row
   that led to a list of one is a row that taught the reader the feature does
   nothing. This is the opposite of the menus round's standing rule for count
   rows — a count row stands at zero because a menu that changed shape would be
   a different menu — and it is a different case: this row is not a count, it is
   a door, and behind it there is either something or nothing at all.

   READER_POST_MENU AND COMMENT_MENU GAIN THE SAME ROW THE SAME WAY, in the same
   place and under the same condition. The history is public, so a reader's menu
   carries it exactly as the author's does; a comment has no detail surface, so
   its ⋮ is the only door it has. Only the author's sheet is drawn here because
   the three are one roster with one row added, and three boards of it would be
   three chances to add it differently. */
export function Screen() {
  return (
    <>
      <DetailHeader items={OWN_POST_MENU} />
      <DetailColumn>
        <PostCard {...SALT_MAPS_CURRENT} timestamp="12 September" variant="detail" edited onInspectEdit={() => {}} score="9.10" comments={2} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
      <BottomSheet open ariaLabel="Post actions">
        {OWN_POST_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} />
        ))}
      </BottomSheet>
    </>
  );
}
