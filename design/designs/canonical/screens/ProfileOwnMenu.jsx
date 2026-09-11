/* YOUR OWN PROFILE'S MENU (readme §13, the private-viewer-state round). The
   band's ⋮ over your own page, holding the two lists only you can see and the
   one thing you hand outward.

   THE PRIVATE STATE NEEDED A DOOR AND THE PROFILE IS IT (jakob). Saved and
   History are yours alone — no other reader ever sees either — so they belong
   on the one page that is yours, and a page whose single wide control is the
   person has no row to hang them off. The band's dot is the door, and once it
   opens a sheet the share row comes back with them.

   SAVED LEADS, HISTORY FOLLOWS, SHARE CLOSES. The order is use: a reader
   reaches for what they kept far more often than for what they passed, and
   handing your profile to someone is the occasional errand. History sits
   beside Saved rather than under it — two lists, one shelf.

   The page beneath is `ProfileOwnBody`, the same drawing `Profile` frames: a
   sheet board shows the page it covers, never a hand-made few rows of it. */
export function Screen() {
  return (
    <>
      <ProfileOwnBody />

      <BottomSheet open ariaLabel="More on your profile">
        {OWN_PROFILE_MENU.map((item) => (
          <SheetItem key={item.label} label={item.label} />
        ))}
      </BottomSheet>
    </>
  );
}
