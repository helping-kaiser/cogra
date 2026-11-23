/* WHAT CITES THIS POST (the topic round, 2026-09-14) — the inbound mirror of
   the opinions round (backlog item 55), and the list this canvas has never
   drawn. A post has always said what it points AT; nothing anywhere said what
   points back at it.

   IT IS NOT THE REFERENCES SHEET WITH MORE IN IT. `RefsSheet` holds the tags
   and citations the AUTHOR signed on this post, and the count on the card IS
   that list's length — a law this round leaves exactly where it stands. These
   are other people's acts, by other authors, in a different order, and merging
   the two would leave neither number checkable.

   A POST HAS TWO DOORS TO IT, the opinions sheet's two (jakob 2026-11-13,
   M1): the count line on its detail (`Cited by 4`), absent at zero and on a
   removed post, and the `Cited by` row of its ⋮ menu on every card and host,
   which stands whatever the count is. A comment has the row alone. So the
   row is how a reader meets this sheet empty — the `list` chip below.

   NEWEST FIRST, AND THAT IS A DEPARTURE. The opinions sheet is strongest-first,
   mirroring `ProfileStances`, and this sheet deliberately does not mirror it
   (jakob, 2026-09-14). An opinions list is a STANDING — a set of positions that
   hold, where the strongest is the one worth reading first. This is a CHRONICLE
   of acts: each citation happened at a moment, nobody's citation outranks
   anybody's, and what a reader comes for is what has just arrived. Two lists
   that look alike are ordered differently because they answer different
   questions, and the round record says so out loud rather than leaving the next
   reader to think one of them is wrong.

   THE ROWS ARE `ReferenceRow`, so an inbound citation reads exactly as an
   outbound one does: the kind's own mark, the artifact's name, and the pair its
   author signed — a citation's pair, both axes signed, read through the twenty
   faces, painting in geek mode. A signed act is public record; the pair is part
   of the act.

   THE SHEET SITS OVER THE POST DETAIL, drawn whole beneath it, because that is
   the surface the reader asked from.

   REGISTERED under the `postDetail` prefix (seam 248): the sheet is
   `citedBySheet`, each row a `citation` keyed by its place in the list,
   newest first — the list is a chronicle, as Notifications is, and two
   citing things can share a name.

   THE `list` CHIP DRAWS THE SHEET EMPTY AT POST SCALE (seam 248): reached
   from the menu's `Cited by` on a post nothing cites, or past a count line
   gone stale, it says so in the comment sheet's words
   (`CommentCitedByEmpty`), `Nothing cites this yet`, the line alone, as
   `empty`.
   A REMOVED OR SWEPT CITING THING IS NEVER NAMED (round 61; the pointer rule
   blessed 2026-11-19) — the `citing` chip: `removed` the fourth row's post
   removed by its author, `swept` the third's, a deleted account's post whose
   content went with the account; each row the removal mark in the name's
   place, the tile empty, the row inert (`ReferenceRow`'s `removed`, seam
   248), still counted and in its place. A deleted account's citing post
   still there keeps its title, as `live` draws it — the row prints no
   author. */
export const NODE = "postDetail";
export const PROPS = {
  list: { editor: "enum", options: ["rows", "empty"], default: "rows" },
  citing: { editor: "enum", options: ["live", "removed", "swept"], default: "live" },
};
export const VALS = `rowsShown: this.props.list === "empty" ? "none" : "flex", emptyShown: this.props.list === "empty" ? "block" : "none", removedLive: this.props.citing === "removed" ? "none" : "contents", removedShown: this.props.citing === "removed" ? "contents" : "none", sweptLive: this.props.citing === "swept" ? "none" : "contents", sweptShown: this.props.citing === "swept" ? "contents" : "none"`;
/* Which rows the `citing` chip redraws, by place: the third, `Three mornings
   on the wall`, a deleted account's post (`DELETED_POST`'s first words),
   swept with the account; the fourth removed by its author. */
const CITING_MARKED = { 2: "swept", 3: "removed" };
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} node="header" />
      <DetailColumn>
        <PostCard {...MIRA_GALLERY_POST} variant="detail" onOpenOpinions={() => {}} citedBy={CITING_ARTIFACTS.length} onOpenCitedBy={() => {}} node="card" />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline node="bottomBar" />

      <BottomSheet open ariaLabel="Cited by" maxHeight="88%" node="citedBySheet">
        <SheetTitle node="title">Cited by</SheetTitle>
        <div style={{ display: "{{rowsShown}}", flexDirection: "column", overflow: "hidden" }}>
          {CITING_ARTIFACTS.map((artifact, index) => {
            const row = <ReferenceRow key={artifact.name} {...artifact} onOpen={() => {}} node="citation" nodeKey={String(index + 1)} />;
            const marked = CITING_MARKED[index];
            if (!marked) return row;
            return (
              <React.Fragment key={artifact.name}>
                <div style={{ display: `{{${marked}Live}}` }} data-node-chip="citing" data-node-key="live">
                  {row}
                </div>
                <div style={{ display: `{{${marked}Shown}}` }} data-node-chip="citing" data-node-key={marked}>
                  <ReferenceRow {...artifact} removed="Removed by its author" redacted node="citation" nodeKey={String(index + 1)} />
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ display: "{{emptyShown}}", padding: "0 24px 8px" }} data-node-chip="list" data-node-key="empty">
          <EmptyState title="Nothing cites this yet" node="empty" />
        </div>
      </BottomSheet>
    </>
  );
}
