/* Someone else's profile — the drill-in an author chip opens (profile round,
   item 23). The compact shape: avatar left, name/handle/figures beside it, bio,
   then the stance on the person stretched to the row — the one action, worn
   wide the way a profile's primary action always is. The overflow (mention,
   share) rides the top bar next to the title, the detail-surface idiom; the
   bar still rides below (a read drill-in, Q37) with no slot lit — this is
   Ada's page, not one of the viewer's tabs.

   The body is a `_shared.jsx` helper: the menu's own board draws this same page
   with the sheet raised over it. */
export function Screen() {
  return <ProfileOtherBody />;
}
