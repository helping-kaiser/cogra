/* A CHAT WITH OPINIONS ON ITS MESSAGES — the reaction trace (round B3 of the
   chats work, the integration round; jakob 2026-09-24: "we add them just like
   with whatsapp.. its cool to have").

   REACTIONS ARE THE OPINIONS ALREADY CAST ON A MESSAGE — no new record kind,
   no emoji system. Each person's opinion on the message reads as the nearest
   of the twenty faces, the faces aggregate the way WhatsApp's do — most-worn
   first, three at most — and the count beside them is PEOPLE
   (`ReactionTrace`). The trace hangs from the bubble's lower edge on the page
   ground, outside the bubble, and appears only where someone has an opinion;
   the bubble itself still carries content, time and the lock.

   FOUR TRACES, FOUR CASES:
   · Mira's question — three people, three different faces (👀 🍿 🙂);
   · the reader's own message — two people, one face twice (😊 2): a trace on
     your own words is how you learn they landed;
   · Juno's sealed-and-readable message — one person (🔥 1). An opinion is a
     public record even where the words are encrypted, so a no-key reader sees
     the trace under the notice too;
   · Mira's `Six it is` — five people, four faces, the trace showing the
     three most worn (😊 😍 🤩) and the count 5; geek mode paints the first
     three pairs and `+2 more`.

   A TAP ON A TRACE OPENS `Opinions on this` — canonical's opinions sheet, the
   message menu's existing destination; giving one's own opinion stays the
   menu's `Give your opinion`. The trace is a readout, never a picker.

   THE FOOT IS EMPTY, SO IT CARRIES THE MIC (`MicSeal`): the voice note stands
   where the arrow stands until the first character is typed. */
const MIRA_QUESTION_OPINIONS = [
  { pDirected: 0.2, pInterest: 0.6 },
  { pDirected: 0.25, pInterest: 0.95 },
  { pDirected: 0.15, pInterest: 0.15 },
];
const OWN_CRUST_OPINIONS = [
  { pDirected: 0.55, pInterest: 0.2 },
  { pDirected: 0.6, pInterest: 0.25 },
];
const JUNO_BOOTS_OPINIONS = [{ pDirected: 0.95, pInterest: 0.9 }];
const MIRA_SIX_OPINIONS = [
  { pDirected: 0.55, pInterest: 0.2 },
  { pDirected: 0.9, pInterest: 0.25 },
  { pDirected: 0.5, pInterest: 0.25 },
  { pDirected: 0.6, pInterest: 0.65 },
  { pDirected: 0.15, pInterest: 0.2 },
];

export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <ChatThreadColumn>
        <DayDivider>21 September</DayDivider>
        <ChatBubble author={CHAT_KEL} when="19:02" sealed>
          <ChatSealedNotice />
        </ChatBubble>
        <DayDivider>22 September</DayDivider>
        <ChatBubble author={CHAT_MIRA} when="21:10" trace={MIRA_QUESTION_OPINIONS}>
          Low tide's at six tomorrow — anyone walking the flats?
        </ChatBubble>
        <ChatBubble own when="21:31" trace={OWN_CRUST_OPINIONS}>
          Crust held all the way past the slipway today.
        </ChatBubble>
        <DayDivider>23 September</DayDivider>
        <ChatBubble author={CHAT_JUNO} when="08:05" sealed id="boots" trace={JUNO_BOOTS_OPINIONS}>
          I'll bring the spare boots — tell me your size.
        </ChatBubble>
        <ChatBubble author={CHAT_MIRA} when="08:40" trace={MIRA_SIX_OPINIONS}>
          Six it is. Meet at the harbour office.
        </ChatBubble>
      </ChatThreadColumn>
      <ChatFoot />
    </>
  );
}
