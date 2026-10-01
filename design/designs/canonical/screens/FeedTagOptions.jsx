/* THE TAG CARD, THREE ANATOMIES — a working board for jakob's pick (the
   feed-cards rework, 2026-10-01). jakob: "i understand why you chose to show
   a post inside it but people might not. it needs to tell a better story..
   this is a hashtag that ranks high for you (based on your graph) and there
   might be some interesting stuff to check out behind it."

   Two halves to that story, and the options split them differently. FOR YOU
   is the score's job on every card — the figure now rides this one too —
   and option B also says it in words. STUFF BEHIND IT is what today's single
   preview row fails at: one thing reads as a post inside a header, so both
   options show more than one thing, as a glimpse (B) or as the tag page's
   own list in miniature (C).

   A REFERENCE BOARD, like `FeedShapes`: wired nowhere, because each column
   is a card a reader would meet on `FeedKinds`, which carries the wiring.
   Every door stays the same door — the whole card opens the tag's page, the
   score the trace, the share the platform's sheet. */

export const FRAME = optionFrame(3, 420);

export function Screen() {
  return (
    <>
      <OptionColumn
        label="A · Today's card, with its score and share"
        note="The baseline. The # and the name over the newest thing tagged, as one preview row with its author's picture. The shape that reads as a post inside a tag."
      >
        <TagFeedCard name="#saltmaps" newest={{ author: TOBIAS, words: "Low tide at six tomorrow — anyone walking the flats?" }} age="1h" score="10.30" />
      </OptionColumn>
      <OptionColumn
        label="B · Why it reaches you, and a glimpse"
        note="Under the name, one quiet line saying whom it reaches you through — the drill-down's own words, the strongest paths' people. The body is a glimpse: the marks of the newest things tagged, side by side, the newest one named. New copy: the why-line needs a blessing."
      >
        <TagFeedCardOption shape="glimpse" name="#saltmaps" score="10.30" />
      </OptionColumn>
      <OptionColumn
        label="C · A peek at its page"
        note="No new words: the # and the score do the talking, and the body is the tag page's own list in miniature — its two newest things as quiet rows, each with its kind's mark, its author and its age. Reads as a door to a place."
      >
        <TagFeedCardOption shape="peek" name="#saltmaps" score="10.30" />
      </OptionColumn>
    </>
  );
}
