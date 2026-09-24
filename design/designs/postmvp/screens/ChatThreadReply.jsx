/* A REPLY, BEING WRITTEN AND ALREADY LANDED — the reply quote strip (round B3
   of the chats work, the integration round; round A docblocked it on
   `ChatMessageMenu`'s `Reply`, and this board draws it).

   THE FOOT TAKES THE QUOTE. `Reply` on Juno's message closed the message's
   sheet and put Juno's words above the field (`ReplyQuoteStrip`): the
   composer's own quoted block (`QuotedRow`), `Replying to Juno Baptiste` over
   one line of what she said, and a × beside it that lets the reply go and
   keeps the words typed. The field is ready and the reader has typed, so the
   arrow stands — the reply signs and sends like any message.

   WHAT IS SENT is a new message in this chat carrying a Reference to the one
   it answers (chats.md §3). References are never encrypted (§7), so which
   message a reply answers is public even when the reply's own words are
   sealed.

   AND LANDED, THE QUOTE RIDES THE BUBBLE'S HEAD (`BubbleQuote`) — the reader's
   own reply of 22 September, answering Mira: her name, one line of her words,
   and a door that scrolls the thread back to her message. A reply to a
   message the reader holds no key for quotes `An encrypted message`, the
   preview rule — stated, not drawn. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <ChatThreadColumn>
        <DayDivider>22 September</DayDivider>
        <ChatBubble author={CHAT_MIRA} when="21:10">
          Low tide's at six tomorrow — anyone walking the flats?
        </ChatBubble>
        <ChatBubble own when="21:31" quote={{ name: "Mira Voss", snippet: "Low tide's at six tomorrow — anyone walking the flats?" }}>
          Count me in. Crust held all the way past the slipway today.
        </ChatBubble>
        <DayDivider>23 September</DayDivider>
        <ChatBubble author={CHAT_JUNO} when="08:05" sealed id="boots">
          I'll bring the spare boots — tell me your size.
        </ChatBubble>
        <ChatBubble author={CHAT_MIRA} when="08:40">
          Six it is. Meet at the harbour office.
        </ChatBubble>
      </ChatThreadColumn>
      <ChatFoot draft="Forty-two — thank you!" quote={{ name: "Juno Baptiste", snippet: "I'll bring the spare boots — tell me your size." }} />
    </>
  );
}
