/* A DELETED ACCOUNT'S PROFILE MENU — the sheet `ProfileDeleted`'s ⋮ opens. The
   rows were ruled with that page (jakob 2026-09-12) and already live in
   `PROFILE_DELETED_MENU`; this board only draws the state they were ruled for,
   which until now was the page's one unboarded gap.

   THE SAME SHEET AS ANOTHER'S, ONE ROW SHORTER. `ProfileMenu`'s anatomy is the
   master and nothing here departs from it: the same `BottomSheet`, the same
   `SheetItem` rows, the same order — Save, then the reference row, then Share,
   then Hide last as the rarest and the only one that takes something away.

   MENTION IS THE ONE ROW THAT GOES, AND IT IS NOT A SHELL BEING DROPPED. The
   husk's shells all stand: the header, the counts, the tabs, the chronicle, and
   the three menu rows that act on an actor. Mention is not among them because
   it does not act on an actor — it stages a Reference at a PERSON and spells
   their handle into the composer, and the handle was redacted at execution.
   A disabled row would be a control that can never come back, which is a
   different promise from a row that is simply not part of this menu.

   HIDE TAKES ITS WORDS FROM THE MASTER. `HIDE_ACTOR_LABEL(null, true)` reads
   `Hide this account`, the same string every card this actor authored already
   shows, so the page and its content say one thing. The row stands at full
   strength: hiding acts on an actor, and a redacted actor still ranks into the
   reader's feed.

   SAVE AND SHARE NEED NO NAME EITHER. Saving keeps a pointer to a node, and the
   node is there; sharing sends this page, and the page is reachable by the same
   structure the reader followed to get here. */
export function Screen() {
  return (
    <>
      <ProfileDeletedBody />

      <BottomSheet open ariaLabel="Profile actions">
        {PROFILE_DELETED_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} />
        ))}
      </BottomSheet>
    </>
  );
}
