/* WHY THIS REACHED YOU, FOR EVERY KIND — the top block of the score's trace,
   once per ranked kind (the feed cards, ruled 2026-10-01).

   Every ranked card's score opens the same four levels (`FeedEntry` →
   `RankPath` → `RankHop` → `RankRecords`), because the score is about the
   paths leading to a thing and never about what kind of thing it is (jakob).
   So the levels do not change with the kind — only the thing held above them
   does, carried down all four so a reader never loses what they are reading
   about. `FeedEntry` draws the post's; this board draws the four side by
   side, in the order the feed's cards are drawn on `FeedKinds`: the post by
   its title and author, the comment by its author's handle over its first
   words, the person by their name over their handle, the tag by its name
   beside its `#` tile.

   A REFERENCE BOARD, like `FeedShapes`: wired nowhere, because each block is
   the top of `FeedEntry`, which carries the wiring. */

export function Screen() {
  return (
    <>
      <PageHeader title="Why this reached you" backHref="#" backLabel="Back to feed" />
      <ScoreColumn>
        <ScoreOrigin kind="post" score="15.20" />
        <ScoreOrigin kind="comment" score="12.40" />
        <ScoreOrigin kind="person" score="11.70" />
        <ScoreOrigin kind="topic" score="10.30" />
        <QuietNote>Every path here starts with an opinion you gave.</QuietNote>
      </ScoreColumn>
    </>
  );
}
