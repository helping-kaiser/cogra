/* THE COMMENT'S SIDE OF THE TAGS-AND-REFERENCES SHEET (round 62; jakob
   2026-11-23, B5 (a)) — `RefsSheet`'s twin, raised over the thread from a
   comment's tags line, as `CommentCitedByEmpty` raises the cited-by sheet.

   The comment's sheet is two sheets deep — the thread is still there under
   the wash — and it is the post's sheet in every other respect: one row per
   signed tag and reference, its mark, its name and its signed pair, the two
   sections counting in their own units. @tobias's comment carries
   `#glovebox`, `#coastroad` and one reference (`CommentsThreadSheet`), so
   those are the rows, each drawn as `RefsSheet` draws its own.

   REGISTERED under the `postDetail` prefix, as `RefsSheet` registers the
   post's: the detail beneath as `PostDetail` names it, the thread
   `threadSheet`, the sheet `refsSheet`, its `title`, each `tag` keyed by the
   tag's name and each `reference` by its place — told apart by board, the
   path naming the sheet and not the host it is raised over. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet node="threadSheet" />

      <BottomSheet open stacked ariaLabel="Tags and references" maxHeight="88%" node="refsSheet">
        <SheetTitle node="title">Tags &amp; references</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <SectionLabel>Tags</SectionLabel>
          <ReferenceRow kind="topic" name="glovebox" pair={{ pDirected: 0.4, pInterest: 0.9 }} onOpen={() => {}} node="tag" nodeKey="glovebox" />
          <ReferenceRow kind="topic" name="coastroad" pair={{ pDirected: 0.1, pInterest: 1 }} onOpen={() => {}} node="tag" nodeKey="coastroad" />
          <SectionLabel>References</SectionLabel>
          <ReferenceRow kind="post" name="Salt maps of the coast road" src="post-photo.jpg" pair={{ pDirected: 0.55, pInterest: 0.2 }} onOpen={() => {}} node="reference" nodeKey="1" />
        </div>
      </BottomSheet>
    </>
  );
}
