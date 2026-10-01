/* THE TAG CARD'S SHAPES (the feed cards, ruled 2026-10-01) — the states a
   tag's card meets in the feed today, held against each other, the way
   `FeedShapes` holds the clip's three. `FeedKinds` draws the card at rest:
   two people it reaches the reader through, three things behind it, nothing
   held.

   · ONE THING BEHIND IT. The glimpse is one mark and its name, and the line
     under it is the author alone — `and n more` says only what is there.
   · ONE PERSON IT REACHES YOU THROUGH. The why-line names the one.
   · THE NEWEST IS A PICTURE. The glimpse leads with its cover, the mark a
     media post wears everywhere (`NodeMark`).
   · THE TOPIC HELD. The row's face is the reader's own Affinity.
   · MANY PEOPLE IT REACHES YOU THROUGH (the closing batch, jakob 2026-10-01).
     Past two, the why-line names the first and counts the rest: `Reaches you
     through @ada and 3 others`.
   · A HANDLE TOO LONG FOR THE LINE. The full line would not fit, so it
     compresses to the drill-down's `Through @…`, the strongest path's person;
     a handle that still does not fit ellipsizes, `ActorChip`'s law.
   · AN EMPTY TAG. Nothing carries it, yet it reaches the reader through
     people's opinions of it: the why-line stays, the glimpse gives way to
     one quiet line, and there is no age, since nothing is newest.
   · A NEGATIVE SCORE. A minus sign and no colour (`ExplainableNumber`).

   GUESTS meet these cards as every card — the face and the compose glyph
   open `GuestGate` — and no guest board draws one (`TagFeedCard`).

   A REFERENCE BOARD, like `FeedShapes`: wired nowhere, each card one a reader
   would meet on `FeedKinds`, which carries the wiring, drawn whole in a tall
   `FRAME`. */

export const FRAME = { width: 390, height: 1600 };

const NEWEST_PICTURE = [SALTMAPS_TAGGED[1], SALTMAPS_TAGGED[2]];

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={{ ...FEED_FILTER_DEFAULT, kinds: FEED_KINDS.map((kind) => kind.value) }} />} />
      <FeedList>
        <TagFeedCard name="#slipwaylight" through={["ada", "tobias"]} tagged={[SALTMAPS_TAGGED[0]]} score="9.60" />
        <TagFeedCard name="#tidetables" through={["mira"]} tagged={SALTMAPS_TAGGED} score="8.90" />
        <TagFeedCard name="#fieldnotes" through={["sol", "ada"]} tagged={NEWEST_PICTURE} score="7.70" />
        <TagFeedCard name="#coastroad" through={["ada", "tobias"]} tagged={SALTMAPS_TAGGED} bundle={mkBundle(0.45, 0.7)} score="6.50" />
        <TagFeedCard name="#lowtide" through={["ada", "tobias", "mira", "sol"]} tagged={SALTMAPS_TAGGED} score="5.80" />
        <TagFeedCard name="#harbourlights" through={["harbour_office_night_shift_kel", "ada"]} tagged={[SALTMAPS_TAGGED[2]]} score="4.30" />
        <TagFeedCard name="#estuary" through={["mira", "ada"]} tagged={[]} score="2.10" />
        <TagFeedCard name="#wellness" through={["tobias"]} tagged={SALTMAPS_TAGGED} score="−0.80" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
