/* HIDDEN ACCOUNTS, over the settings page (readme §13, the private-viewer-state
   round; jakob: the list "could be a bottomsheet maybe"). What the People
   group's row opens: everyone you have hidden, and the way back.

   A SHEET, BECAUSE THE LIST IS THE WHOLE ERRAND. A reader opens this to undo
   one hiding and leave; a page would ask them to travel for a list that is
   usually three rows long, and a sheet goes back to settings by the scrim, the
   swipe or Escape.

   IT IS TITLED, like every settings sheet: this one covers the surface it was
   opened from, so it has to say what it is, and the title is the row's own
   words so the two cannot drift.

   UNHIDE RIDES THE ROW. One control per person, at the edge the eye ends on,
   and no confirm — hiding was confirm-free, and a reader undoing one of their
   own comforts is owed the same. The row itself is inert: a person's profile is
   one tap away from anywhere, and a row that both navigated and carried a
   button would be two targets fighting for one thumb.

   NO COUNT IN THE TITLE. The rows are the count, and a number in a heading is a
   second thing to keep true.

   WHEN NOBODY IS HIDDEN THIS SHEET DOES NOT OPEN. The settings row goes inert
   and reads `None` — the menus round's own rule, that a tap which can only
   produce an empty surface is a tap spent on nothing. */
export function Screen() {
  return (
    <>
      <SettingsBody />

      <BottomSheet open ariaLabel="Hidden accounts" maxHeight="88%">
        <SheetTitle>Hidden accounts</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 var(--space-6)" }}>
          <ContentRow
            variant="chronicle"
            inert
            chevron={false}
            name="Juno Baptiste"
            title="Juno Baptiste"
            titleAside="@juno"
            second="Hidden 3d"
            trailing={<InlineAction onClick={() => {}}>Unhide</InlineAction>}
          />
          <ContentRow
            variant="chronicle"
            inert
            chevron={false}
            image="ava1.jpg"
            title="Ada Okonkwo"
            titleAside="@ada"
            second="Hidden 14d"
            trailing={<InlineAction onClick={() => {}}>Unhide</InlineAction>}
          />
          <ContentRow
            variant="chronicle"
            inert
            chevron={false}
            name="Tobias Lindqvist"
            title="Tobias Lindqvist"
            titleAside="@tobias"
            second="Hidden 12.08.2026"
            trailing={<InlineAction onClick={() => {}}>Unhide</InlineAction>}
          />
        </div>
      </BottomSheet>
    </>
  );
}
