/* A CHAT WITH VOICE NOTES — readable and not (round B3 of the chats work, the
   integration round; jakob 2026-09-24).

   THE VOICE BUBBLE IS COMPACT (`VoiceNote`, jakob's canvas review, the fix
   pass: "the tall block goes"): one 40px band — the play glyph in the bubble's
   own ink, the video transport's own `Timeline` master on its surface tone,
   the length under the line's start and the bubble's clock, with its quiet
   lock where encrypted, at the same line's end. No separate clock line. A
   voice bubble takes the full media width, so every note's line is one length
   to the thumb whatever the note's duration.

   THREE FACES IN ONE FIXTURE:
   · PLAINTEXT — Mira's 0:42, heard by anyone who reads the chat;
   · ENCRYPTED AND KEYED — the reader's own 0:18, the lock by the time: the
     audio was encrypted on the device under the epoch key before upload
     (chats.md §7), and every member holding that key plays it as Mira's
     plays;
   · ENCRYPTED, NO KEY — Kel's, sealed under an epoch from before the reader
     joined: `NoKeyMedia`'s voice tile, the lock and `An encrypted voice
     message — you don't have the key to hear it.` NO EXPAND: cipher text can
     be shown as characters; cipher audio is nothing a reader could use.

   DESCRIBED FOR ACCESSIBILITY LIKE ALL MEDIA: Mira described hers, so its play
   control is named by her words; the reader's carries the fallback, `Voice
   message, 0:18`. Descriptions are written in the locked recording's
   `Describe`, never invented.

   PLAYBACK FOLLOWS THE STAGE LAW'S ONE-AT-A-TIME spirit (the feed-video
   rulings): starting a note stops any other note or clip playing in the
   thread; a note plays through with the thread scrolling under it, and the
   played part stays on its line. Behaviour, stated. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <ChatThreadColumn>
        <DayDivider>21 September</DayDivider>
        <ChatBubble author={CHAT_KEL} when="19:02" sealed fill>
          <NoKeyMedia kind="voice" />
        </ChatBubble>
        <DayDivider>23 September</DayDivider>
        <ChatBubble author={CHAT_MIRA} when="07:31" voice={{ length: "0:42", description: "Mira on the tide: low water at six, the crust firm to the second marker" }} />
        <ChatBubble own when="07:40" sealed voice={{ length: "0:18" }} />
        <ChatBubble author={CHAT_JUNO} when="07:52">
          Heard both — six at the harbour office.
        </ChatBubble>
      </ChatThreadColumn>
      <ChatFoot />
    </>
  );
}
