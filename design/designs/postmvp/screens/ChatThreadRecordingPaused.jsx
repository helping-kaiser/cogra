/* RECORDING, PAUSED — the pause ↔ play toggle drawn (round B3 of the chats
   work, the integration round's final micro-fix; jakob 2026-09-24, explicit:
   pausing flips the middle control to play, and the audio EXTENDS on resume).

   A SECOND BOARD, NOT A DOCBLOCKED VARIANT — the lane's call, flagged: the
   middle control is a different button with a different outcome, and a
   control with its own edge needs its own number on its own board.

   PAUSED, the middle control is PLAY — `Keep recording` — and pressing it goes
   on recording into the same note: the length counts on from `0:22`, the
   audio appended, never a second note. The live mark rests (the mic in
   `text-secondary`) and the length reads `0:22 · Paused`. Delete, the lock
   and the send arrow stand exactly as they did: a paused note can be sent as
   it is, sealed by what the lock says when the arrow is pressed. */
export function Screen() {
  return (
    <>
      <ChatThreadHeader name="Coast walkers" image="post-photo.jpg" />
      <CoastWalkersThread />
      <ChatFootRecording length="0:22" paused />
    </>
  );
}
