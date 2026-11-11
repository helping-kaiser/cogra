/* THE TAG'S PAGE, A TAGGED POST'S MENU OPEN (round 36; jakob 2026-11-11,
   H7). The tap `TagPageHidden` records the aftermath of — a tagged post's ⋮ —
   drawn open: the reader's post menu, its Hide row naming the card's author,
   @tobias, as that board's snackbar does. Save, Cite, Hide @tobias, License
   terms, Report at the tail. The page carries no bottom bar, and the sheet
   rises over `TagPageBody` clipped at the phone's 844, as `TagPageHidden`.

   REGISTERED under the `tagPage` prefix — the host's own card raises it
   (readme, the sheet node law): `tagPage.menuSheet` with one name per row. The
   page's own anatomy stays unnamed, as `TagPage` leaves it. */
export const NODE = "tagPage";
export const FRAME = { width: 390, height: 844 };
export function Screen() {
  return (
    <>
      <TagPageBody />
      <CardMenuSheet items={readerPostMenu("tobias")} />
    </>
  );
}
