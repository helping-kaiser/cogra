/* THEIR PROFILE, JUST AFTER HIDING THEM (jakob 2026-10-07, ruling 65; the
   menus round's "the snackbar offers Undo and this page stays open").
   `ProfileMenu`'s `Hide @ada`, the sheet closed, and what the reader is left
   looking at.

   THE PAGE STAYS WHOLE. Hiding is a comfort over the reader's own feed, not
   an act on the person: their profile still opens and still reads in full,
   so nothing here dims, collapses or gains a mark — the stance anchor, the
   figures and the Posts tab the page lands on are the page as it stood
   under the sheet. The
   feed is where the hide shows, the next time it is opened (`FeedHidden`).

   THE SNACKBAR IS THE FEED'S, WORD FOR WORD — `@ada is hidden.` with
   `Undo` — because the act does not depend on where the tap was made. It sits above the bar (`Snackbar`'s
   80px). A deleted account's page takes the same shape from
   `ProfileDeletedMenu`, in the nameless twin its sidecar carries: `This
   account is hidden.`

   IT IS `ProfileOtherBody` WITH THE SNACKBAR OVER IT — the page `ProfileMenu`
   draws under its sheet, as `FeedHidden` is `Feed` with one line over it.

   REGISTERED under the `profile` prefix (design ⇄ impl seam 059/061, the
   Hide packet's registration ask), named as `ProfileOther` names the page;
   the snackbar is `snackbar`, its `message` and its `action`. */
export const NODE = "profile";
export function Screen() {
  return (
    <>
      <ProfileOtherBody />
      <Snackbar message="@ada is hidden." action="Undo" offset={80} node="snackbar" />
    </>
  );
}
