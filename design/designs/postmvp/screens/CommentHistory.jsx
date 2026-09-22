/* A COMMENT'S EDIT HISTORY — the post's chronicle, one kind down (jakob's
   rulings 2026-09-22).

   THE PATTERN DOES NOT CHANGE WITH THE KIND, and that is the whole reason this
   board is drawn: a page title, a list of whole versions newest first, the
   current one marked, the law at the foot. What changes is the master the
   versions are drawn by. A reader who has read one chronicle has read them all.

   IT IS A PAGE, NOT A SHEET, although a comment is read inside one. A history
   is a place a reader goes and comes back from, and a third sheet over a sheet
   over a detail is a stack nobody can find their way out of — the thread's own
   ⋮ is the door, and the door opens a page.

   THE VERSIONS CARRY NO OPINION AND NO REPLY. Both act on the comment rather
   than on one of its versions; the affordance row is simply absent, the way a
   post's version card carries none.

   NO TOMBSTONE IS DRAWN HERE and the omission is technical, not a ruling: a
   removed version wears exactly the mark the post's chronicle draws, and the
   comment master carries no redaction state to draw it with yet. */
export function Screen() {
  return (
    <>
      <PageHeader title="Edit history" backHref="#" backLabel="Back to the comment" />
      <HistoryColumn>
        <VersionBlock label="Current version · signed 12 September">
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            <CommentCard
              author={SOL}
              showStance={false}
              content="The third headland light is real — I have a print from 2019 that almost catches it. It is the bend that does it, not the light."
            />
          </ul>
        </VersionBlock>
        <VersionBlock label="Earlier version · signed 8 September">
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            <CommentCard
              author={SOL}
              showStance={false}
              content="The third headland light is real — I have a print from 2019 that almost catches it."
            />
          </ul>
        </VersionBlock>
        <ChronicleFootnote>{CHRONICLE_FOOTNOTE}</ChronicleFootnote>
      </HistoryColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
