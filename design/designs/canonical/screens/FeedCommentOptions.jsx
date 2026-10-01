/* THE COMMENT CARD, THREE ANATOMIES — a working board for jakob's pick (the
   feed-cards rework, 2026-10-01). jakob: "the comment card is better as it
   has the link to the original post but could be even more distinct."

   A comment in the feed is the one card whose meaning depends on something
   else: it answers a post. Today's card says so in one quiet line, and the
   two options make that relation louder in two different registers — the
   QUOTE (what is answered, held above the answer, the reply composer's own
   `QuotedRow`) and the THREAD (the post as a head row and the comment hung
   under it on a connector, the shape a reply has in its thread). Same
   comment, same fixture, same row, so the columns differ by anatomy alone.

   A REFERENCE BOARD, like `FeedShapes`: wired nowhere, because each column
   is a card a reader would meet on `FeedKinds`, which carries the wiring.
   Every door stays the same door on every option — the target opens the
   thread, the score the trace. */

export const FRAME = optionFrame(3, 500);

export function Screen() {
  return (
    <>
      <OptionColumn
        label="A · Today's card, with its score"
        note="The baseline. One quiet line names the post it answers and opens its thread; everything else is the comment. Cheapest, and the least distinct: below the line it is a short post."
      >
        <CommentFeedCard {...OPTION_COMMENT} />
      </OptionColumn>
      <OptionColumn
        label="B · The post it answers, quoted"
        note="What is answered is held above the answer, the way the reply composer quotes it — Ada's picture, the post's title and the start of its words — contained by a hairline, since a card already stands on the quoted tone. The whole block is the door to the thread. Reads as a reply at a glance; costs about one row of height."
      >
        <CommentFeedCardOption shape="quote" {...OPTION_COMMENT} />
      </OptionColumn>
      <OptionColumn
        label="C · A slice of its thread"
        note="The post as a head row — its own mark and title, its author — and the comment hanging under it on a rule, inset the way a reply hangs under what it answers. Reads as a piece of a conversation; the post's cover does the recognising."
      >
        <CommentFeedCardOption shape="thread" {...OPTION_COMMENT} />
      </OptionColumn>
    </>
  );
}
