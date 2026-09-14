/* WHAT CITES THIS POST (the topic round, 2026-09-14) — the inbound mirror of
   the opinions round (backlog item 55), and the list this canvas has never
   drawn. A post has always said what it points AT; nothing anywhere said what
   points back at it.

   IT IS NOT THE REFERENCES SHEET WITH MORE IN IT. `RefsSheet` holds the tags
   and citations the AUTHOR signed on this post, and the count on the card IS
   that list's length — a law this round leaves exactly where it stands. These
   are other people's acts, by other authors, in a different order, and merging
   the two would leave neither number checkable.

   THE DOORS ARE THE OPINIONS ROUND'S TWO, for its reasons: a count line on the
   post's detail (`Cited by 4`), absent at zero, and the comment's ⋮ row, which
   stands whatever the count is because a comment has no detail surface of its
   own. The empty state is reachable only from the second, which is why it has
   a board of its own and this one does not need to draw it.

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
   of the act. One of them is still settling and says so, which is this row
   shape's own rule and the one surface that admits it.

   THE SHEET SITS OVER THE POST DETAIL, drawn whole beneath it, because that is
   the surface the reader asked from. */
export function Screen() {
  return (
    <>
      <DetailHeader items={READER_POST_MENU} />
      <DetailColumn>
        <PostCard {...MIRA_GALLERY_POST} variant="detail" onOpenOpinions={() => {}} citedBy={CITING_ARTIFACTS.length} onOpenCitedBy={() => {}} />
      </DetailColumn>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />

      <BottomSheet open ariaLabel="Cited by" maxHeight="88%">
        <SheetTitle>Cited by</SheetTitle>
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {CITING_ARTIFACTS.map((artifact) => (
            <ReferenceRow key={artifact.name} {...artifact} onOpen={() => {}} />
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
