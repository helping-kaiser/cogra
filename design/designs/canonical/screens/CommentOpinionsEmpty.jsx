/* THE COMMENT'S SIDE OF THE SAME SHEET, IN ITS EMPTY STATE (backlog item 55;
   jakob ruled both doors — a row on the detail, and the comment's ⋮).

   ONE BOARD, TWO THINGS CHECKED, and both are the things the post's own sheet
   cannot show. The comment path's sheet is two sheets deep — the menu closes,
   the opinions come up over the thread, and the thread is still there under the
   wash — which is the `CommentLicense` arrangement exactly. And this is where
   the empty state is reachable at all: a post's row drops away at zero
   (`SettingsHidden`'s rule — a tap that can only open an empty list is a tap
   spent on nothing), while a menu keeps its rows whatever the count, so the
   comment's door is the one a reader can walk through and find nobody.

   The populated rows are drawn on `PostOpinions`; nothing about them changes
   here but what the title names.

   THE LINE IS THE PRODUCT'S OWN EMPTY VOICE — calm, and naming the one thing
   that would fill it (`Nothing here yet — write the first post.`). It never
   scolds and it carries no `error` colour: a comment nobody has answered is not
   a fault. */
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet />

      <BottomSheet open stacked ariaLabel="Opinions on this comment" maxHeight="62%">
        <SheetTitle>Opinions on this comment</SheetTitle>
        <div style={{ padding: "0 24px 8px" }}>
          <EmptyState title="No opinions yet — yours would be the first." />
        </div>
      </BottomSheet>
    </>
  );
}
