/* THE FEED, THE REMOVAL ASKED (seam 248, RM-G9). What the feed's own menu's
   `Remove` raises: `RemoveConfirm`'s dialog on its second host — the same
   `RemoveDialog`, the post's nouns, the safe answer filled and `Remove` a
   text button in no colour — over the feed the tap was made in, @sol's card
   still whole beneath it. A removal that gets no answer fails here as it does
   on the detail, and the same `answer` chip draws it here (round 27, seam
   252): the dialog stays, `That didn't send. Try again.` in its `line` above
   the pair, `Remove` reading `Retry`, the card beneath not removed.

   REGISTERED under the `feed` prefix: the page as `Feed` names it, the dialog
   `dialog` as every confirm names it, its failed line `dialog.line` — the
   detail's `postDetail.dialog.line` on its second host. 
   THE `answer` CHIP'S `removing` IS THE REMOVAL CLOSED ON (round 37, jakob
   2026-11-11): past 200ms `Remove` reads `Removing…`, and `Keep it` reads
   `Close` from the press itself; it, the scrim, Back and Escape close the
   dialog and the removal goes on, its wait and its answer on the removed
   thing's own row. The copy is drawn unnamed, so no path moves. */
/* THE `answer` CHIP'S `closedFailed` IS THAT REMOVAL FAILING AFTER CLOSE (round
   41; jakob 2026-11-11, S5 "as rec"): the dialog is gone, the card stands as it
   was, and the line under it reads `That didn't sign.` in the failure voice
   with `Retry`, which asks the same removal again — the row line of
   `SigningAfterClose`'s edit, a removal being a signed act. The dialog's own
   failure while it stands open keeps its words, `That didn't send. Try
   again.` (`failed`). The line is a drawn copy and carries no name. */
export const NODE = "feed";
export const PROPS = { answer: { editor: "enum", options: ["asking", "failed", "removing", "closedFailed"], default: "asking" } };
export const VALS = `askingShown: this.props.answer === "asking" ? "block" : "none", failedShown: this.props.answer === "failed" ? "block" : "none", removingShown: this.props.answer === "removing" ? "block" : "none", closedFailedShown: this.props.answer === "closedFailed" ? "block" : "none"`;
const OWN_CARD_ROWS = OWN_POST_MENU.filter((row) => row !== LICENSE_ROW);
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <PostCard {...SOL_POST} menuItems={OWN_CARD_ROWS} bundle={mkBundle(0.1, 1)} node="card" />
        <div style={{ display: "{{closedFailedShown}}", padding: "var(--space-2) var(--space-4) var(--space-3)" }}>
          <SigningPending row onRetry={() => {}} />
        </div>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <div style={{ display: "{{askingShown}}" }} data-node-chip="answer" data-node-key="asking">
        <RemoveDialog kind="post" node="dialog" />
      </div>
      <div style={{ display: "{{failedShown}}" }} data-node-chip="answer" data-node-key="failed">
        <RemoveDialog kind="post" failed node="dialog" />
      </div>
      <div style={{ display: "{{removingShown}}" }}>
        <RemoveDialog kind="post" removing />
      </div>
    </>
  );
}
