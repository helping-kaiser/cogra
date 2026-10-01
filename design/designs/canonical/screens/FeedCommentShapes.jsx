/* THE COMMENT CARD'S SHAPES (the feed cards, ruled 2026-10-01) — the states a
   comment card meets in the feed today, held against each other, the way
   `FeedShapes` holds the clip's three. `FeedKinds` draws the card at rest:
   a text comment answering a post with a picture.

   · ITS OWN PICTURES. A comment's pictures join its words inset, capped at a
     comment's height (readme §13), and in the feed they take the card's tap:
     the comment's thread, scrolled to it.
   · ANSWERING A COMMENT. A reply reaches the feed like any comment, and its
     head row names a comment — which has no title — by its author's handle
     over its first words, `QuotedRow`'s rule, with the comment's own mark.
   · VEILED. The compact veil takes the words, as it does in a thread; the
     head row stays readable, because what the comment answers is what lets a
     reader choose to reveal it.

   A REFERENCE BOARD, like `FeedShapes`: wired nowhere, each card one a reader
   would meet on `FeedKinds`, which carries the wiring. So the board exports a
   tall `FRAME` — a comparison cut off at 844px is one nobody can make. */

export const FRAME = { width: 390, height: 1180 };

export function Screen() {
  return (
    <>
      <CograBand trailing={<FeedFilter value={{ ...FEED_FILTER_DEFAULT, kinds: FEED_KINDS.map((kind) => kind.value) }} />} />
      <FeedList>
        <CommentFeedCard
          author={ADA}
          content="Got there late — the honey was gone by nine, so this is the last of the light instead."
          timestamp="2h"
          parent={MIRA_GALLERY_POST}
          media={[{ src: "gallery-honey.jpg", ratio: "square", fit: "cover", alt: "A jar of honey in low sun." }]}
          topics={["tidemarket"]}
          score="9.80"
        />
        <CommentFeedCard
          author={SOL}
          content="Same bend, same habit — mine lives under the passenger seat."
          timestamp="40m"
          parent={{ author: TOBIAS, content: TOBIAS_COMMENT }}
          parentKind="comment"
          score="8.30"
        />
        <CommentFeedCard
          author={TOBIAS}
          content="Found this on the flats at low tide — the rubbing came out sharper than the photo."
          timestamp="5h"
          parent={SOL_POST}
          sensitive={{ reason: "A dead seabird in the second frame.", source: "author" }}
          topics={["saltmaps"]}
          score="7.10"
        />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
