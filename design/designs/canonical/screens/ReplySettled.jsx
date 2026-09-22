/* WHERE A SIGNED REPLY PUTS THE READER (readme §13, *the detail-fold and
   reply-return rulings*, 2026-09-15; backlog item 85). The flow promised "the
   thread, the comment settling" and every piece existed — `CommentCard` takes
   `pending` and reserves `children`, `PendingMarker` says "Still settling" —
   with no board saying what the three add up to. This is that board.

   THE SHEET REOPENS WHERE THE READER LEFT IT. The navigation result carries two
   values, the scroll offset and the parent comment id, and the offset is the
   half of the ruling a drawing can show: the thread is cut at the sheet's top
   edge rather than starting fresh at the first comment. It is drawn at exactly
   the card's own corner radius — enough that the top card reads as CUT rather
   than placed, little enough that the parent the reply belongs to keeps its
   author line. The size of the offset is the reader's; that it survives is the
   ruling.

   THE PARENT EXPANDS (jakob: "show the content you just wrote"). @tobias's
   replies stood behind a count on `ReplyEntry`; here the count has become the
   replies, because a reader returned to a collapsed branch would be looking at
   a number where their own words should be.

   THE NEW REPLY IS IN `children`, WHICH IS THE COMPOSER'S OWN SLOT. The master
   reserves it for "an open reply or edit composer, rendered between the card
   and its replies" — so the signed words appear exactly where the reader was
   typing them, above the older replies rather than at the end of a list they
   would have to find. It wears `pending`: it is signed, not yet settled, and
   the marker says so in the product's own words.

   THE EDIT'S RETURN IS THIS SAME ANATOMY. The ruling covers a comment edit in
   one breath ("editing sth and then not seeing the corrected version gives the
   user uncertainty if it even happened"), and the landing differs only in which
   card carries the marker — so there is no second board owed for it.

   THE THREAD AND THE DETAIL ARE `_shared.jsx`'s, EXTENDED AND NOT FORKED. The
   sheet learned `scrolledBy` and `landed`; nothing here re-draws a comment. */
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet landed scrolledBy={12} />
    </>
  );
}
