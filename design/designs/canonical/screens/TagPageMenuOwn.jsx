/* THE TAG'S PAGE, YOUR OWN POST'S MENU OPEN (round 55, backlog 223). The page
   lists only claims whose author is the content's own author (TagPage.md), so
   your own post stands on it once you tag it — @sol's salt maps, the second
   tagged row of `TagPageBody` — and its ⋮ raises the own post menu, as on
   every host (copy-voice, *Menu rows*): Save, Cite, Edit, Mark as sensitive,
   Remove, Cited by, Opinions on this, License terms, and no Hide and no
   Report, own menus carrying none. Over `TagPageBody` clipped at the phone's
   844, as `TagPageMenu`.

   REGISTERED under the `tagPage` prefix, `tagPage.menuSheet`, told apart
   from the reader's menu by board. */
export const NODE = "tagPage";
export const FRAME = { width: 390, height: 844 };
export function Screen() {
  return (
    <>
      <TagPageBody />
      <CardMenuSheet items={OWN_POST_MENU} />
    </>
  );
}
