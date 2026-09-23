/* A CHAT — the thread, a group of five (would-like #3; jakob's rulings
   2026-09-23). The richest of the round's boards: the bubble idiom, the three
   faces a message can wear, and the foot that seals.

   A GROUP, so authorship shows: Mira, Tobias, Juno and Kel on the left, each
   run opened by its author's name and closed by their face; the reader's own
   message on the right, unsigned by name because it is theirs. Newest at the
   foot.

   THREE FACES A MESSAGE CAN WEAR, all in one fixture:
   · PLAINTEXT — Mira's, Tobias's and the reader's own: words and a time.
   · ENCRYPTED AND READABLE — Juno's: the words, decrypted, and the quiet lock
     beside the time. "Even if you can read a message you should be aware that
     it was sent e2e" (jakob) — so the lock is on every encrypted message, the
     readable ones included, and on none of the others.
   · ENCRYPTED AND UNREADABLE — Kel's: the friendly notice where the words
     would be, the lock beside the time like its readable twin, and `Show the
     encrypted text` under the notice, which expands the bubble in place to the
     raw text (the notice state is drawn; the expanded one is stated in
     `ChatSealedNotice`).

   NOTHING ON A BUBBLE BUT CONTENT, TIME AND THE LOCK (jakob). An opinion, a
   citation, saving, commenting — every act CoGra takes on a message lives
   behind a long-press and the ⋮ it opens, never worn. And no bubble carries
   `Edited`: messages never edit.

   THE FOOT (`ChatFoot`): the lock toggle, the live field, and the arrow that
   IS the seal. The toggle is drawn OFF — plaintext, the default for a fresh
   chat, sticky per chat once flipped — and the draft is typed, so the arrow
   stands ready. Long-press on it opens the what-you-sign sheet.

   THE FIRST-SEND LINE IS DRAWN, AND THAT IS A FIXTURE CHOICE WITH A SEAM. The
   quiet line under the foot shows until the reader's first send ever, and this
   board draws it; chat grammar also asks the board to show the reader's own
   bubble — which in the product would mean the first send had happened and the
   line was gone. One board carries both so the round can be read in one frame;
   the line's real moment is a reader with no own bubble anywhere.

   NO HEADER MENU THIS ROUND. The chat's own acts — mute, its details, leaving
   — have a home the base round does not draw; the back arrow is the whole
   header until they do. */
export function Screen() {
  return (
    <>
      <PageHeader title="Coast walkers" backHref="#" backLabel="Back to your chats" />
      <ChatThreadColumn>
        <ChatBubble author={CHAT_MIRA} when="3h">
          Low tide's at six tomorrow — anyone walking the flats?
        </ChatBubble>
        <ChatBubble author={CHAT_TOBIAS} when="2h">
          I'm in if the wind drops.
        </ChatBubble>
        <ChatBubble own when="2h">
          Crust held all the way past the slipway today.
        </ChatBubble>
        <ChatBubble author={CHAT_JUNO} when="1h" sealed>
          I'll bring the spare boots — tell me your size.
        </ChatBubble>
        <ChatBubble author={CHAT_KEL} when="40m" sealed>
          <ChatSealedNotice />
        </ChatBubble>
        <ChatBubble author={CHAT_MIRA} when="35m">
          Six it is. Meet at the harbour office.
        </ChatBubble>
      </ChatThreadColumn>
      <ChatFoot draft="Bringing a flask." firstSend />
    </>
  );
}
