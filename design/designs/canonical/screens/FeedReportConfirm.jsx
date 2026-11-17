/* THE FEED, ITS REPORT CONFIRM RISEN (FC-G10; ruling 75's sheet, ruling 84's
   host). What the feed's post menu's Report row opens: the menu closes and
   the confirm rises in its place over the column the tap was made in. The
   sheet is `ReportConfirm`'s, word for word — `ReportPostSheet`, the one
   both boards read — so the feed's confirm and the detail's cannot
   disagree; what differs is beneath, the feed exactly as `FeedPostMenu`
   draws it under the wash.

   REGISTERED under the `feed` prefix (the hosting-surface rule): the page as
   `Feed` names it, the sheet `reportSheet` with its `title`, `body`,
   `report` and `cancel`, mirroring `postDetail.reportSheet`'s. */
/* THE `answer` CHIP (round 51 act 2, jakob 2026-11-17, B6): as on
   `ReportConfirm` — a failed report keeps the sheet up, its line above the
   pair, `Report` reading `Retry`, never the snackbar. */
export const NODE = "feed";
export const PROPS = { answer: { editor: "enum", options: ["asking", "failed", "refused"], default: "asking" } };
export const VALS = `askingShown: this.props.answer === "asking" ? "block" : "none", failedShown: this.props.answer === "failed" ? "block" : "none", refusedShown: this.props.answer === "refused" ? "block" : "none"`;
export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter node="filterTrigger" />} node="band" />
      <FeedList>
        <PostCard {...ADA_POST} bundle={mkBundle(0.55, 0.2)} node="card" />
        <PostCard {...TOBIAS_POST} bundle={mkBundle(0.1, 0.1)} node="card" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <div style={{ display: "{{askingShown}}" }}>
        <ReportPostSheet />
      </div>
      <div style={{ display: "{{failedShown}}" }}>
        <ReportPostSheet answer="failed" />
      </div>
      <div style={{ display: "{{refusedShown}}" }}>
        <ReportPostSheet answer="refused" />
      </div>
    </>
  );
}
