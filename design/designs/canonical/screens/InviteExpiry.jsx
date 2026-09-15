/* HOW LONG THE LINK LIVES — the chooser, stacked over the create sheet.

   A SHEET OVER A SHEET IS DRAWN AS LAYERS (the menus round): `stacked` puts
   this one's wash between the two, so the create sheet dims beneath it and
   keeps its top edge, its handle and its title visible above this one. The
   surface takes the next tonal rung, because two surfaces at one rung claim
   one elevation.

   THREE ROWS AND NO CUSTOM DATE. A date picker here would be a calendar opened
   to answer a question nobody asks in days-and-months: an invite is sent now
   and used soon, and the three rungs cover the shapes that exist — a link for
   one conversation, a link for a week, a link for a season. A custom date also
   invents a fourth decision the create sheet was deliberately kept clear of.

   THE ROWS ARE `SettingsRow`'s CHOICE VARIANT, because one of them is already
   true and the reader has to see which. The radio is `ComposeLicense`'s to the
   pixel — one drawing for "choose one of a group", wherever the group is.

   NO GROUP CARD AROUND THEM. A `SettingsGroup`'s fill is `surface-card`, which
   is the rung this stacked sheet already stands on: a container inside a
   container of the same colour is two containers saying one thing. The rows
   carry their own 16px inset and the wrapper makes up the 8px to the sheet's
   own 24px column, so the words line up with the title above them. */
export function Screen() {
  return (
    <>
      <InvitesBody />
      <NewInviteSheet />

      <BottomSheet open stacked ariaLabel="Expires after">
        <SheetTitle>Expires after</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", padding: "0 8px" }}>
          <SettingsRow name="invite-expiry" selected={false} label="24 hours" />
          <SettingsRow name="invite-expiry" selected label="7 days" />
          <SettingsRow name="invite-expiry" selected={false} label="30 days" />
        </div>
      </BottomSheet>
    </>
  );
}
