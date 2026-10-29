/* REMOVE THIS COMMENT? — the think-twice dialog behind your own comment's
   `Remove` (the comment-removal round, 2026-10-01).

   THE POST'S CONFIRM WITH THE NOUNS SWAPPED (`RemoveDialog`, the confirm-nouns
   rule): the same title shape, the same two sentences, the same pair — the safe
   answer filled, `Remove` a text button in no colour. The one change the kind
   makes is where the mark keeps its place: a comment has one spot, in its own
   thread, where a post's place stands in threads (copy-voice, the whole-comment
   confirm).

   THE SURFACE BENEATH IS THE THREAD, whole and inert, still where the reader
   opened the menu (`REMOVED_COMMENT_SCROLL`): the menu has closed, and the
   dialog comes up over the sheet the reader asked from — lifted above it the
   way `ReplyKeyAbsent`'s notice is.

   THE `answer` CHIP DRAWS THE REMOVAL THAT DID NOT GO THROUGH (seam 248,
   RM-G7): the post's state at comment scale, `RemoveConfirm`'s chip — the
   dialog stays up over the thread, `That didn't send. Try again.` above the
   pair, `Remove` reading `Retry`, and @sol's comment still whole beneath.

   REGISTERED under the `postDetail` prefix (seam 248), once the thread was
   named: the detail as `CommentMenu` names it, the thread `threadSheet`, and
   the dialog `dialog` — raised over the sheet, not inside it, as the post's
   is over the detail. */
export const NODE = "postDetail";
export const PROPS = { answer: { editor: "enum", options: ["asking", "failed"], default: "asking" } };
export const VALS = `askingShown: this.props.answer === "failed" ? "none" : "block", failedShown: this.props.answer === "failed" ? "block" : "none"`;
export function Screen() {
  return (
    <>
      <ThreadDetail />
      <CommentsThreadSheet scrolledBy={REMOVED_COMMENT_SCROLL} node="threadSheet" />
      <div style={{ display: "{{askingShown}}" }} data-node-chip="answer" data-node-key="asking">
        <RemoveDialog kind="comment" overSheet node="dialog" />
      </div>
      <div style={{ display: "{{failedShown}}" }} data-node-chip="answer" data-node-key="failed">
        <RemoveDialog kind="comment" overSheet failed node="dialog" />
      </div>
    </>
  );
}
