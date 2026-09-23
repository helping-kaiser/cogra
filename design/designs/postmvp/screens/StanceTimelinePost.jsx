/* THE SAME TIMELINE, POINTED AT A POST — one person's every record on one
   piece of content (jakob's rulings 2026-09-22).

   ONE SHEET, TWO KINDS OF TARGET. A stance from a person to a post folds the
   way a stance from a person to a person does, so the surface that reads one
   reads the other: the same header, the same rows, the same word for a
   counter-record. Only the title changes, and it changes the way the pad's
   `targetLabel` changes — in the reader's own words.

   THE TITLE NAMES WHOSE OPINION IT IS. On a person↔person timeline both ends
   are handles; here the far end is "this post", which is what the reader is
   already looking at. Naming the post by its title would repeat the card under
   the sheet, and naming it by a link would offer a way out of a surface the
   reader is standing on top of.

   IT SITS OVER THE POST DETAIL, drawn whole beneath it — the surface the reader
   asked from, reached through the opinions sheet's own value readout
   (`OpinionsRowDoors`).

   THE NUMBERS ARE A POST'S NUMBERS. The person↔person board carries the round's
   own illustration — twenty-seven picks over three years, which is what a
   relationship looks like. A post is days old, so its sum line says days and
   single digits, and its count is the length of the list beneath it. The same
   sentence at the wrong scale would teach a reader that the line is decoration.

   AND IT OBEYS THE SUM RULES (`copy-voice.md`). Four picks from 5 to 12
   September span seven days — under two weeks, and quickly, so `in seven days`.
   Its rows add up to +2.40 / +1.50, past the dial on both axes, so the weight
   clause stands and the tail reads `before the cap`. The "?" on the title row is
   the same one the person↔person sheet carries, opening the same dialog. */
export function Screen() {
  return (
    <>
      <OpinionPostDetail />
      <TimelineSheet title="@sol on this post" ariaLabel="Every opinion @sol has signed on this post">
        <TimelineHeader
          pDirected={1}
          pInterest={1}
          sum="Built from 4 picks in seven days — more weight than the dial can show."
          exact="+2.40 / +1.50 before the cap"
          spoken="Raw sum before the cap: For or against +2.40, How much reaches you +1.50"
        />
        <TimelineRecords records={POST_TIMELINE_RECORDS} />
      </TimelineSheet>
    </>
  );
}
