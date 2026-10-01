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

   THE SCORE HANGS ON THE THING (the closing batch, jakob 2026-10-01): each
   block's top-left wears the figure as an attached flag, glyph and signed
   number, `ScoreOrigin`'s one entity. Under each, its strongest path, whose
   trace ends on the thing it reached in that thing's own mark — the cover,
   the comment's glyph, the person's circle, the `#` — and speaks `then what
   reached you`, the same words for every kind. The back arrow reads `Back to
   feed`, where every kind's card stands.

   A REFERENCE BOARD, like `FeedShapes`: wired nowhere, because each block is
   the top of `FeedEntry`, which carries the wiring. */

const KIND_PATHS = [
  { kind: "post", score: "15.20", path: SCORE_PATHS[0] },
  { kind: "comment", score: "12.40", path: { through: "@mira", people: [SCORE_VIEWER, MIRA_FACED], value: "+5.10" } },
  { kind: "person", score: "11.70", path: { through: "@tobias", people: [SCORE_VIEWER, TOBIAS], value: "+4.80" } },
  { kind: "topic", score: "10.30", path: { through: "@ada", people: [SCORE_VIEWER, ADA_FACED], value: "+4.40" } },
];

export function Screen() {
  return (
    <>
      <PageHeader title="Why this reached you" backHref="#" backLabel="Back to feed" />
      <ScoreColumn>
        {KIND_PATHS.map(({ kind, score, path }) => (
          <div key={kind} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ScoreOrigin kind={kind} score={score} />
            <PathRow kind={kind} people={path.people} through={path.through} value={path.value} onOpen={() => {}} />
          </div>
        ))}
        <QuietNote>Every path here starts with an opinion you gave.</QuietNote>
      </ScoreColumn>
    </>
  );
}
