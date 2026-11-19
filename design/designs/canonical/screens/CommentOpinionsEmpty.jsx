/* THE COMMENT'S SIDE OF THE SAME SHEET, IN ITS EMPTY STATE (backlog item 55;
   jakob ruled both doors — a row on the detail, and the comment's ⋮).

   ONE BOARD, TWO THINGS CHECKED, and both are the things the post's own sheet
   cannot show. The comment path's sheet is two sheets deep — the menu closes,
   the opinions come up over the thread, and the thread is still there under the
   wash — which is the `CommentLicense` arrangement exactly. And this is the
   empty state at comment scale: a count line drops away at zero
   (`SettingsHidden`'s rule — a tap that can only open an empty list is a tap
   spent on nothing), while a menu keeps its rows whatever the count, so the
   menu's row is the door a reader can walk through and find nobody — the
   comment's, and the post's too (`PostOpinions`' `list` chip).

   The populated rows are drawn on `PostOpinions`; nothing about them changes
   here but what the title names.

   THE LINE IS THE PRODUCT'S OWN EMPTY VOICE — calm, and naming the one thing
   that would fill it (`Nothing here yet — write the first post.`). It never
   scolds and it carries no `error` colour: a comment nobody has answered is not
   a fault.
   REGISTERED under the `postDetail` prefix (round 61, seam 380), as
   `CommentLicense` registers the sheet it stacks: the detail beneath as
   `PostDetail` names it, the thread `threadSheet`, and the sheet the post's
   own (`PostOpinions`) — `opinionsSheet`, its `title` and its `empty` — told
   apart by board, the path naming the sheet and not the host it is raised
   over. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet node="threadSheet" />

      <BottomSheet open stacked ariaLabel="Opinions on this comment" maxHeight="62%" node="opinionsSheet">
        <SheetTitle node="title">Opinions on this comment</SheetTitle>
        <div style={{ padding: "0 24px 8px" }}>
          <EmptyState title="No opinions yet" node="empty" />
        </div>
      </BottomSheet>
    </>
  );
}
