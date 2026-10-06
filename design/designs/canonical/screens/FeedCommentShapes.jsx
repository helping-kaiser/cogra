/* THE COMMENT CARD'S SHAPES (the feed cards, ruled 2026-10-01) — the states a
   comment card meets in the feed today, held against each other, the way
   `FeedShapes` holds the clip's three. `FeedKinds` draws the card at rest:
   a text comment answering a post with a picture.

   · ITS OWN PICTURES. A comment's pictures join its words inset, capped at a
     comment's height (readme §13), and in the feed they take the card's tap:
     the comment's thread, scrolled to it.
   · ITS OWN CLIP (jakob 2026-10-02). A comment's clip plays as it does in
     its thread (`ReplyMedia`): muted autoplay in the comment scale's square,
     the sound disc and nothing else. It competes for the feed's one stage
     with every post's clip, by the stage law (`behavior/Feed.md`).
   · ITS CLIP, AUTOPLAY SUPPRESSED (jakob 2026-10-06, the stage-law rulings'
     A4). Where the device asked for no motion — reduced motion, data saver —
     nothing starts on its own, so the clip rests on its still and the PLAY
     DISC takes the sound disc's place, exactly as on a post's card
     (`FeedCover`): the same disc at the same size, since every disc a media
     surface draws is one. A tap plays it where it stands; once it plays it
     wears the sound disc, and the play disc returns when it stops.
   · ANSWERING A COMMENT. A reply reaches the feed like any comment, and its
     head row names a comment — which has no title — by its author's handle
     over its first words, `QuotedRow`'s rule, with the comment's own mark.
   · VEILED. The compact veil takes the words, as it does in a thread; the
     head row stays readable, because what the comment answers is what lets a
     reader choose to reveal it.
   · ANSWERING AN UNTITLED POST (the closing batch, jakob 2026-10-01). A text
     post's title is optional, so the head row names it by its first words in
     the title's place — the quote's precedent — over its author; the mark is
     the text post's `T`.
   · ANSWERING A REMOVED POST. The head row stays and wears the removal
     mark's line, `Removed by its author`, in the system's voice over the
     author, its mark an empty tile; the comment stays readable, because a
     removed post keeps its thread and what answers it.
   · YOUR OWN. The same card; its ⋮ opens your own menu (`CommentMenuOwn`),
     and nothing else changes.
   · A LONG COMMENT folds at two lines under `More`, the caption's precedent,
     opening in place; the card is still the door to its thread.

   GUESTS meet these cards as every card — the face opens `GuestGate` — and
   no guest board draws one (`CommentFeedCard`).

   A REFERENCE BOARD, like `FeedShapes`: wired nowhere, each card one a reader
   would meet on `FeedKinds`, which carries the wiring. So the board exports a
   tall `FRAME` — a comparison cut off at 844px is one nobody can make.

   REGISTERED under the feed's own prefix (jakob 2026-10-02), as `FeedCover`
   is for a post's clip: the two clip cards alone are named, `commentCard`,
   keyed by their authors, so the stage law's lines name a comment's clip by
   `feed.commentCard.media.frame` beside a post's `feed.card.media.frame`, and
   its discs by `soundDisc` and `playDisc`. */
export const NODE = "feed";

export const FRAME = { width: 390, height: 3200 };

const LONG_COMMENT =
  "Drove it twice this summer, once in each direction, and the second time I stopped at every lay-by between the tunnel mouth and the third headland. The light does something different on the way back — lower, warmer, and it catches the salt crust on the flats so the whole shore looks drawn in chalk. Worth the four hours, and worth doing backwards.";

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
          author={TOBIAS}
          content="Eighteen seconds of the same headland, if the light comes through at all."
          timestamp="30m"
          parent={ADA_POST}
          media={[
            {
              kind: "video",
              src: "comment-clip.mp4",
              poster: "comment-camera.jpg",
              ratio: "square",
              fit: "cover",
              alt: "A film camera panning across the headland at low light.",
            },
          ]}
          score="9.10"
          node="commentCard"
        />
        <CommentFeedCard
          author={SOL}
          content="Turned them to the window before they went in the bowl."
          timestamp="1h"
          parent={MIRA_GALLERY_POST}
          media={[{ ...CLIP_GRAPES, resting: true, controls: "play" }]}
          score="8.70"
          node="commentCard"
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
        <CommentFeedCard
          author={MIRA}
          content="Six works — I'll bring the tide table and the good boots."
          timestamp="50m"
          parent={TOBIAS_POST}
          score="6.40"
        />
        <CommentFeedCard
          author={TOBIAS}
          content="Kept the rubbing from that morning anyway — the salt held the line."
          timestamp="6h"
          parent={{ author: ADA, removed: true }}
          topics={["saltmaps"]}
          score="5.90"
        />
        <CommentFeedCard
          author={SOL}
          content="The honey stand is half the reason I take the coast road at all."
          timestamp="3h"
          parent={MIRA_GALLERY_POST}
          topics={["tidemarket"]}
          score="5.20"
          own
        />
        <CommentFeedCard author={KEL} content={LONG_COMMENT} timestamp="1d" parent={ADA_POST} topics={["coastroad"]} score="4.60" />
      </FeedList>
      <BottomNav active="feed" slots={ALL_SLOTS} inline />
    </>
  );
}
