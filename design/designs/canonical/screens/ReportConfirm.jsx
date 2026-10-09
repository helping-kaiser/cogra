/* REPORT, CONFIRMED BEFORE IT GOES (jakob 2026-10-09, ruling 75). What the
   menus' tail row opens: one confirm sheet that names the thing — `Report
   this post?` here, `Report this comment?` over a thread, `Report @ada?` on
   a person, `Report this account?` on a redacted one — one body line saying
   what happens, and the pair `Report`/`Cancel`. The commit sends the report
   out and the snackbar reads `Reported.`; no report machinery exists behind
   it until proposals/moderation land, and the body says what happens without
   naming the mechanism.

   A SHEET, NOT A THINK-TWICE DIALOG. Reporting is not destructive and not
   irreversible harm to the reader's own things — it is a commitment surface,
   so it takes the sheet's grammar: the menu closes, this rises in its place,
   and the scrim, the swipe, system Back and Escape drop it with nothing
   sent. `Report` is the filled commit and `Cancel` the quiet way out —
   `RemoveConfirm` inverts that pair because a removal destroys; a report
   destroys nothing.

   IT NEVER CONNECTS TO REPORT-A-PROBLEM (jakob): reporting content must not
   read as reporting the app, so nothing here names, opens or shares anything
   with `ReportProblem`.

   DRAWN ON THE POST BEING READ — `ReaderPostMenu`'s detail with the confirm
   risen where the menu stood — and a MASTER for every other host: the same
   sheet rises over the thread, the feed and the profiles, its heading
   naming that host's thing. The title, the body and the confirm heading are
   drafted for jakob.

   REGISTERED under the `postDetail` prefix (the hosting-surface rule): the
   detail beneath as `PostDetail` names it, the sheet `reportSheet` with its
   `title`, `body`, `report` and `cancel`. */
export const NODE = "postDetail";
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} node="header" />
      <DetailColumn>
        <PostCard {...ADA_POST} variant="detail" node="card" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <BottomSheet open ariaLabel="Report this post" node="reportSheet">
        <SheetTitle node="title">Report this post?</SheetTitle>
        <p
          style={{
            margin: 0,
            padding: "0 var(--space-6) var(--space-2)",
            fontSize: "var(--text-body-medium)",
            lineHeight: "var(--text-body-medium--line-height)",
            letterSpacing: "var(--text-body-medium--letter-spacing)",
            color: "var(--text-secondary)",
          }}
          data-node="body"
        >
          It goes to the people who run CoGra for a look.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", padding: "var(--space-2) var(--space-6) 0" }}>
          <Button variant="text" node="cancel">Cancel</Button>
          <Button node="report">Report</Button>
        </div>
      </BottomSheet>
    </>
  );
}
