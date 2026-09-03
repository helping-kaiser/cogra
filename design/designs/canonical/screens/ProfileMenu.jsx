/* ANOTHER PERSON'S PROFILE MENU (readme §13, the menus round). Two rows, and
   neither is the post menu's: a profile declares no license, and the word for
   referencing a person is mentioning, not citing.

   MENTIONING IS CITING. Both stage the same fact — a Reference edge from the
   post being written to the thing it points at — and the two words only record
   what sits at the far end: a person, or anything else. So this row opens the
   same composer the post menu's does, with the reference already staged; only
   its label knows the difference.

   Share is a row here and a glyph elsewhere. On a post, share rides the
   affordance row, where the acts are; a profile has no such row — its one wide
   control is the stance on the person — so sharing arrives in the menu instead
   of inventing a second row to hold it. The reader's OWN profile has no menu at
   all: with mention meaningless on yourself and share the only row left, the
   band's ⋮ became the share control itself. */
export function Screen() {
  return (
    <>
      <ProfileOtherBody />

      <BottomSheet open ariaLabel="Profile actions">
        <SheetItem label="Mention in a new post" />
        <SheetItem label="Share this profile" />
      </BottomSheet>
    </>
  );
}
