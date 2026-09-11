/* SAVED · nothing kept yet (the private-viewer-state round). The state every
   reader starts in, and the one the list spends longest in.

   IT NAMES THE GESTURE, BECAUSE NOTHING ELSE DOES. Saving lives in a ⋮ and
   leaves no mark on the card it was used on (jakob's ruling: no saved indicator
   outside the menu), so a reader who has never opened that menu has no way to
   discover the list exists from the outside. The empty line is the one place
   the product may say where the row is — in words, never as a picture of a
   glyph.

   NO ACTION BUTTON. `EmptyState` takes the one action that fills the list where
   there is one, and here that action is "save something", which cannot be done
   from this screen — it is done on a post, three surfaces away. A button that
   only navigates somewhere vaguer than the sentence already does is chrome. */
export function Screen() {
  return (
    <>
      <PageHeader title="Saved" backHref="#" backLabel="Back to your profile" />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", padding: "8px 24px" }}>
        <EmptyState title="Nothing saved yet. A post, a comment or a person can be saved from its own menu, and it waits here." />
      </div>
      <BottomNav active={null} slots={ALL_SLOTS} inline />
    </>
  );
}
