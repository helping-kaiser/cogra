/* Your own profile — the tab (profile round, item 23). The compact shape:
   avatar left with its change badge (a standalone signed act → the crop-and-seal
   flow), name/handle/figures beside it, bio, then Edit profile + Invites sharing
   the row. The gear and the overflow hang off the band per design.md §6 — never
   down in the header — and the ⋮ opens the sheet holding Saved, History and
   Share your profile. The chronicle sits under the icon tab row. Sol has no
   picture: the monogram is the designed fallback, and the badge on it reads as
   "add one".

   THE PAGE IS `ProfileOwnBody`, in `_shared.jsx`: the band's menu draws this
   same page under its sheet, and the chronicle's page-failure state draws it
   with one row added. Three boards, one drawing. */
export function Screen() {
  return <ProfileOwnBody />;
}
