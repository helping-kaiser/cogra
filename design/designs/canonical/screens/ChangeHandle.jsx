/* CHANGE YOUR HANDLE (readme §13, the settings round; jakob's review
   2026-09-09). What the Credentials group's Handle row opens — `Settings/12`.

   THE SHAPE IS THE FAMILY'S, and this is its shortest member: one field, one
   commitment, and two facts around them. Nothing is proved again — `auth.md`
   makes `changeHandle` an ordinary authenticated mutation, and asking for a
   password where the server does not would be theatre.

   THE FIRST LINE IS REASSURANCE, AND IT IS TRUE. A handle is L2 account state —
   the mention namespace — not graph structure and not profile payload, so
   nothing signed moves when it changes. A reader about to rename themselves in
   public is entitled to know that before they do it, and the honest register
   says the calm part out loud rather than leaving it to be feared.

   THE LAST LINE IS THE COST, AND IT IS NOT SOFTENED. A freed handle is
   immediately claimable, and links to the old one resolve to nothing — or to
   whoever takes it. That is the system being honest rather than the design
   being alarming, so it takes no `error` colour: §4 keeps that for failure.

   THE RULES SIT ON THE FIELD, not in a paragraph. Length and charset are what
   the reader needs while typing, which is what a hint is for; the fold to
   lowercase is said because a reader who types capitals will otherwise think
   the field ate them.

   THE PRESS ASKS FIRST (jakob 2026-10-05, the collected brief's D5: "a
   confirmation (pop up?) for sure"). Changing the handle is on §11's
   think-twice list, so `Change handle` raises `ChangeHandleConfirm`, whose
   body names the cost again at the moment of the act; the change lands only
   on its answer. The page is `ChangeHandleBody`, shared with the dialog's
   board.

   REGISTERED under the `changeHandle` prefix (design ⇄ impl seam 082, the
   settings packet), the family's surface; the body names its parts. */
export const NODE = "changeHandle";
export function Screen() {
  return <ChangeHandleBody />;
}
