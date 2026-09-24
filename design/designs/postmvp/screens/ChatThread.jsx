/* A CHAT — the thread, a group of five (would-like #3; jakob's rulings and
   canvas review 2026-09-23). The richest of the round's boards: the bubble
   idiom, the three faces a message can wear, and the foot that seals.

   THE HEADER IS THE CHAT'S PICTURE AND NAME, AND IT IS A DOOR
   (`ChatThreadHeader`) — to the chat's detail surface (`ChatDetails`, the
   chat details round): members, description, mute, leave, the history of its
   name and picture. The header PINS: the list collapses, the thread never
   does.

   A GROUP, so authorship shows: Kel, Mira and Juno on the left, each run
   opened by its author's name and closed by their face; the reader's own
   message on the right, unsigned by name because it is theirs. Newest at the
   foot.

   EXACT CLOCK TIMES, AND A DAY DIVIDER WHERE THE THREAD CROSSES A DAY
   (jakob). A thread is where people agree on when — "six it is" means the six
   of one particular day — so this is the one surface that prints the clock.
   The divider says the date in the dateline's words; it never says `Today`.

   THREE FACES A MESSAGE CAN WEAR, all in one fixture:
   · PLAINTEXT — Mira's and the reader's own: words and a time.
   · ENCRYPTED AND READABLE — Juno's: the words, decrypted, and the quiet lock
     beside the time. "Even if you can read a message you should be aware that
     it was sent e2e" (jakob) — so the lock is on every encrypted message, the
     readable ones included, and on none of the others.
   · ENCRYPTED AND UNREADABLE — Kel's, the oldest, sealed under a key epoch
     from before the reader joined (chats.md §7): the friendly notice where the
     words would be, the lock beside the time like its readable twin, and
     `Show the encrypted text` under the notice, which expands the bubble in
     place to the raw text.

   THE INK IS `text-body` ON EVERY BUBBLE, the reader's own included (jakob's
   review, a conformance fix measured in `ChatBubble`).

   NOTHING ON A BUBBLE BUT CONTENT, TIME AND THE LOCK (jakob). An opinion, a
   citation, saving, replying — every act CoGra takes on a message lives behind
   a long-press (`ChatMessageMenu`), never worn. And no bubble carries
   `Edited`: messages never edit.

   THE FOOT (`ChatFoot`): the lock toggle, the live field, and the arrow that
   IS the seal. The toggle is drawn OFF — plaintext, the default for a fresh
   chat, sticky per chat once flipped — and the draft is typed, so the arrow
   stands ready. Press and hold it for `ChatSignSheet`.

   THE FIRST-SEND LINE IS DRAWN, AND THAT IS A FIXTURE CHOICE WITH A SEAM. The
   quiet line under the foot shows until the reader's first send ever, and this
   board draws it; chat grammar also asks the board to show the reader's own
   bubble — which in the product would mean the first send had happened and the
   line was gone. One board carries both so the round can be read in one frame;
   the line's real moment is a reader with no own bubble anywhere. */
export function Screen() {
  return <ChatThreadBody firstSend />;
}
