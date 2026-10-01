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
   · A NEGATIVE SCORE. A minus sign and no colour (`ExplainableNumber`).

   A REFERENCE BOARD, like `FeedShapes`: wired nowhere, each card one a reader
   would meet on `FeedKinds`, which carries the wiring, drawn whole in a tall
   `FRAME`. */

export const FRAME = { width: 390, height: 1080 };

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
        <TagFeedCard name="#wellness" through={["tobias"]} tagged={SALTMAPS_TAGGED} score="−0.80" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
