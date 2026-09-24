/* A MESSAGE STILL SETTLING, AND ONE THAT DIDN'T LAND — the product's pending
   grammar at chat scale (round B3 of the chats work, the integration round;
   design.md §9, *Pending*).

   PENDING SHOWS IN FULL. The arrow signed `Bringing a flask.` a moment ago and
   the record is not yet ordered on L1, so the bubble stands whole with `Still
   settling ·` before its clock, in the time's own ink — nothing greyed, nothing
   held back: the words are real, only their place in the order is not. When
   it settles, the words `Still settling` go and the clock stays.

   AND IT SHOWS TO EVERY READER, NOT ONLY ITS AUTHOR — design.md's rule, and
   the brief's "shows in full to its author" read against it: the board draws
   the author's thread, the case where it is met most, and a member reading the
   chat in the same moment sees the same bubble with the same words on it.

   AN EXPIRED MESSAGE LEAVES EVERY READER'S VIEW, AND ITS AUTHOR IS TOLD
   (`DidntLand`). The reader's 08:10 question expired unlanded: other readers
   see nothing where it was — on the graph it never existed — and the reader
   sees the calm notice in its place, on their own side, an outline rather than
   a bubble because it is no longer a message. `Nothing was spent.` `Dismiss`
   takes the notice away; `Put it back` returns the words to the field, where
   the arrow signs them again as always. Never `error` ink, never a warning
   glyph. If the field already holds a draft, the words go in after it on a
   line of their own — stated, not drawn. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <ChatThreadColumn>
        <DayDivider>23 September</DayDivider>
        <ChatBubble author={CHAT_JUNO} when="08:05" sealed id="boots">
          I'll bring the spare boots — tell me your size.
        </ChatBubble>
        <DidntLand words="Is the café by the slipway open that early?" />
        <ChatBubble author={CHAT_MIRA} when="08:40">
          Six it is. Meet at the harbour office.
        </ChatBubble>
        <ChatBubble own when="08:52" pending>
          Bringing a flask.
        </ChatBubble>
      </ChatThreadColumn>
      <ChatFoot />
    </>
  );
}
