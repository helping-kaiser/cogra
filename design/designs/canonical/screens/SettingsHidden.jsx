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
   produce an empty surface is a tap spent on nothing.

   REGISTERED under the `settings` prefix (design ⇄ impl seam 059/061, the Hide
   packet): the page is `Settings`', and the sheet is `hiddenSheet`, its rows
   `account`s keyed by the hidden person's handle.

   A DELETED ACCOUNT STAYS HIDDEN, AND ITS ROW IS DRAWN (jakob 2026-10-07,
   HA-3 / ruling 56; the settings round, 2026-10-13). Hiding acts on an actor,
   and a redacted actor still ranks, so its row stays until it is unhidden:
   `ContentRow`'s `redacted` — the reserved disc, `Deleted account` in the
   system's voice, no aside — with the hiding's moment and `Unhide` like any
   other row. It has no handle to key by, so it is its own node,
   `redactedAccount`, keyed by the actor's id (ruling 56(c)): `account`'s key
   rule names the handle, and a registered rule is never reworded. It stands
   last because it was hidden longest ago, and the page beneath counts it. */
export const NODE = "settings";
export function Screen() {
  return (
    <>
      <SettingsBody hidden="4" />

      <BottomSheet open ariaLabel="Hidden accounts" maxHeight="88%" node="hiddenSheet">
        <SheetTitle node="title">Hidden accounts</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 var(--space-6)" }} data-node="list">
          <ContentRow
            variant="chronicle"
            inert
            chevron={false}
            name="Juno Baptiste"
            title="Juno Baptiste"
            titleAside="@juno"
            second="Hidden 3d"
            trailing={
              <InlineAction onClick={() => {}} node="unhide">
                Unhide
              </InlineAction>
            }
            node="account"
            nodeKey="juno"
          />
          <ContentRow
            variant="chronicle"
            inert
            chevron={false}
            image="comment-camera.jpg"
            title="Ada Okonkwo"
            titleAside="@ada"
            second="Hidden 14d"
            trailing={
              <InlineAction onClick={() => {}} node="unhide">
                Unhide
              </InlineAction>
            }
            node="account"
            nodeKey="ada"
          />
          <ContentRow
            variant="chronicle"
            inert
            chevron={false}
            name="Tobias Lindqvist"
            title="Tobias Lindqvist"
            titleAside="@tobias"
            second="Hidden 12.08.2026"
            trailing={
              <InlineAction onClick={() => {}} node="unhide">
                Unhide
              </InlineAction>
            }
            node="account"
            nodeKey="tobias"
          />
          <ContentRow
            variant="chronicle"
            inert
            chevron={false}
            redacted
            second="Hidden 21.07.2026"
            trailing={
              <InlineAction onClick={() => {}} node="unhide">
                Unhide
              </InlineAction>
            }
            node="redactedAccount"
            nodeKey="3f2b8c1e-7d4a-4e9b-a1c6-5e8f0d2b9a74"
          />
        </div>
      </BottomSheet>
    </>
  );
}
