/* THE TAG'S PAGE, A TAGGED COMMENT'S MENU OPEN (round 60, backlog 284; jakob
   2026-11-19, C2 "as rec"). @ada's tagged comment, the page's third row,
   raises the reader's comment menu whole — Save, Cite in a new post,
   `Hide @ada`, Cited by, Opinions on this, License terms, Report at the
   tail — the rows copy-voice's *Menu rows* gives a comment on every host,
   a tag page among them. Over the page, unstacked: no thread is open
   beneath it, as `ProfileCommentsMenu` rises over the profile. Over
   `TagPageBody` clipped at the phone's 844, as `TagPageMenu`.

   REGISTERED under the `tagPage` prefix, `tagPage.menuSheet`, told apart
   from the post's menus by board; the page beneath stays unnamed, as on
   `TagPageMenu`. */
export const NODE = "tagPage";
export const FRAME = { width: 390, height: 844 };
export function Screen() {
  return (
    <>
      <TagPageBody />
      <CardMenuSheet items={readerCommentMenu("ada")} ariaLabel="Comment actions" />
    </>
  );
}
