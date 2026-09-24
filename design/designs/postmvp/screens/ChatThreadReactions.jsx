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
export function Screen() {
  return <ReactionsThreadBody />;
}
